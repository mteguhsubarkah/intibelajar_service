import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { hash, stable, uuid } from '../platform/crypto.js';
import { enqueueDiagnosis } from '../platform/jobs.js';
import { gradingSource, type GradingSource } from '../catalog/grading-source.js';
import { basicFirst, conceptLabels, lessonFor, mappedConcepts, type Release } from '../catalog/interface.js';
import { evaluate, EVALUATORS, type CandidateEvidence, type EvidenceRef, type StudentResponse } from './evaluators/index.js';
import { eligibility, POLICY_VERSION, type Exposure } from './grading.js';
// Diagnosis runs of a question loop (Slice 2 M5; 05 E-03–E-10, E-16–E-20; 06 §2–§5). A run is evaluated inline when
// the deterministic evaluator covers the response (06 §2.3 step 1). Otherwise, when a queued engine exists and the
// learner granted AI_PROCESSING, it is queued (step 2); otherwise it completes as insufficient evidence (step 3).
//
// In Slice 2 the only queued engine is a test-only fake (plan 05 D4): the app accepts one only when NODE_ENV=test,
// through code, never through a request. Its output is a candidate, validated here as an AI candidate would be
// (06 §2.4), and stored with source AI, which is never mastery-eligible (INV-10).

export type LoopKind = 'INITIAL' | 'CLARIFICATION' | 'RETRY';
export type Purpose = 'DIAGNOSIS' | 'VERIFICATION';
/** A run's deadline (E-09: exhausted at deadline_at) and the queued engine's call budget. */
export const RUN_DEADLINE = "interval '2 minutes'", MAX_CALLS = 3;
const CONFIDENCE_FLOOR = 0.7;

/** What a queued engine sees: the item and the response, never the learner (06 §2.1). */
export interface EngineInput {
  purpose: Purpose; response: StudentResponse; prompt: string; rubric: GradingSource['rubric'];
  concepts: { code: string; assessable: boolean; misconceptions: string[] }[];
}
export interface DiagnosisEngine {
  /** Marks an engine that exists only for tests; buildApp refuses an engine outside NODE_ENV=test. */
  readonly testOnly: boolean;
  readonly syntheticOnly?: true;
  accepts?(response: StudentResponse): boolean;
  readonly name: string;
  diagnose(input: EngineInput, signal: AbortSignal): Promise<unknown>;
}
export class InvalidOutput extends Error { constructor() { super('INVALID_OUTPUT'); } }

export interface RunRequest {
  attemptId: string; learnerId: string; revisionId: string; release: Release; kind: LoopKind; purpose: Purpose; generation: number;
  response: StudentResponse; exposure: Exposure; queue: boolean;
}
export interface RunResult { runId: string; status: 'COMPLETED' | 'QUEUED'; verdict: Verdict | null; evidenceStatus: 'SUPPORTED' | 'INSUFFICIENT_EVIDENCE' | null }
type Verdict = 'CORRECT' | 'INCORRECT' | 'UNREADABLE' | 'NOT_GRADED';

/** E-01: a loop needs an anchor its rubric can grade without AI (Slice 2 has no AI). */
export async function loopGradable(db: Connection, revisionId: string) {
  return Object.hasOwn(EVALUATORS, (await gradingSource(db, revisionId)).rubric.evaluator);
}

const claim = (e: Pick<CandidateEvidence, 'classification'>) => e.classification === 'UNDERSTANDING_DEMONSTRATED' || e.classification === 'MISCONCEPTION_EVIDENCED';

/** Learner-facing copy (06 §2.6): what the response shows, never the final answer before the retry phase. */
function copyFor(verdict: Verdict, supported: boolean, response: StudentResponse, firstRationale: string | undefined) {
  if (response.responseType === 'SELF_REPORT') return response.selfReport === 'KNOW'
    ? { headline: 'Kamu bilang tahu. Coba kelihatan dulu.', clarification: 'Tulis rumus atau langkah pertamamu.' }
    : { headline: 'Nggak apa-apa. Kita mulai dari dasarnya.', clarification: 'Pilih bagian yang mau kamu pelajari dulu.' };
  if (verdict === 'CORRECT') return { headline: 'Mantap. Caramu sudah tepat.' };
  if (verdict === 'INCORRECT' && supported) return firstRationale
    ? { headline: 'Hampir! Meleset sedikit di 1 inti.', lede: firstRationale.length <= 240 ? firstRationale : undefined }
    : { headline: 'Belum tepat.', lede: 'Langkah awalmu sudah terlihat, tapi hasil akhirnya belum tepat.' };
  if (verdict === 'INCORRECT') return { headline: 'Jawabanmu belum tepat.', clarification: 'Tulis rumus atau langkah pertamamu, supaya kelihatan bagian mana yang perlu dirapikan.' };
  return { headline: 'Langkahmu belum cukup terlihat.', clarification: 'Tulis rumus atau langkah yang kamu pakai, misalnya perbandingan yang kamu pilih.' };
}

/**
 * Recommendations (06 Recommendations VO, plan 05 M5). A catalogued misconception points to its authored concept and
 * key formula (rubric.recommend). Otherwise the primary concepts not yet shown, most basic first; a self-report
 * "belum tahu" gets every primary concept that way. Never an invented gap (D07): a recommendation says what to
 * learn next, not that the learner failed it. Lessons come from rubric.lessonFor (D2), else the concept's lesson.
 */
async function recommendationsFor(tx: Tx, source: GradingSource, release: Release, verdict: Verdict, evidence: CandidateEvidence[], response: StudentResponse) {
  if (verdict === 'CORRECT') return [];
  const mapped = await mappedConcepts(tx, source.revisionId), byCode = new Map(mapped.map(c => [c.code, c]));
  const picks: { code: string; reason: string; keyFormula?: string }[] = [];
  for (const e of evidence.filter(x => x.classification === 'MISCONCEPTION_EVIDENCED')) {
    const authored = source.rubric.recommend?.find(r => r.misconceptionCode === e.misconceptionCode);
    const code = authored?.conceptCode ?? e.conceptCode;
    if (!picks.some(p => p.code === code)) picks.push({ code, reason: (e.rationale ?? 'Pelajari bagian ini dulu.').slice(0, 240), ...(authored ? { keyFormula: authored.keyFormula } : {}) });
  }
  if (!picks.length) {
    const shown = new Set(evidence.filter(e => e.classification === 'UNDERSTANDING_DEMONSTRATED').map(e => e.conceptCode));
    const all = response.responseType === 'SELF_REPORT';
    const open = mapped.filter(c => c.role === 'PRIMARY' && c.assessable && (all || !shown.has(c.code)));
    for (const id of await basicFirst(tx, open.map(c => c.id))) {
      const c = open.find(x => x.id === id)!;
      picks.push({ code: c.code, reason: all ? 'Mulai dari dasar yang dipakai soal ini.' : 'Bagian ini belum terlihat dari jawabanmu.' });
    }
  }
  const out = [];
  for (const p of picks.slice(0, 3)) {
    const c = byCode.get(p.code);
    if (!c) continue;
    const link = source.rubric.lessonFor?.[p.code];
    const lesson = (link ? await lessonFor(tx, release, { lessonCode: link, conceptId: c.id }) : null) ?? await lessonFor(tx, release, { conceptId: c.id });
    out.push({ conceptId: c.id, conceptCode: c.code, ...(c.legacyMapId ? { legacyMapId: c.legacyMapId } : {}), conceptTitle: c.title.slice(0, 120), action: 'LEARN',
      ...(lesson ? { lessonId: lesson.lessonId, ...(lesson.routeSlug ? { lessonRouteSlug: lesson.routeSlug } : {}) } : {}),
      reason: p.reason, ...(p.keyFormula ? { keyFormula: p.keyFormula.slice(0, 120) } : {}), estimatedMinutes: c.minutes });
  }
  return out;
}

/**
 * Local development only (GRADING_LOG=true, set by npm run dev / local:dev, refused outside NODE_ENV=development):
 * one line per graded run on the terminal: engine, rubric, verdict, and each concept's classification with its quote.
 * Quotes are parts of the learner's answer, which is why this never runs in any other environment.
 */
const gradingLog = () => process.env.GRADING_LOG === 'true' && process.env.NODE_ENV === 'development';
export function logGrading(runId: string, engine: string, rubric: string, verdict: string, supported: boolean, evidence: CandidateEvidence[]) {
  if (!gradingLog()) return;
  const short: Record<string, string> = { UNDERSTANDING_DEMONSTRATED: 'ok', MISCONCEPTION_EVIDENCED: 'gap', INSUFFICIENT_EVIDENCE: 'insufficient', NOT_ASSESSED: 'not-assessed' };
  const parts = evidence.map(e => `${e.conceptCode.replace(/^[A-Z]+\.[A-Z]+\./, '')}=${short[e.classification] ?? e.classification}`
    + (e.misconceptionCode ? `(${e.misconceptionCode})` : '') + (e.refs[0]?.kind === 'SPAN' ? ` "${e.refs[0].quote}"` : ''));
  console.log(`grade run=${runId.slice(-8)} engine=${engine} rubric=${rubric} verdict=${verdict} evidence=${supported ? 'SUPPORTED' : 'INSUFFICIENT'} | ${parts.join(' | ')}`);
}

/** Store a completed run with its evidence (inline or adopted). Eligibility per 06 §5; loop attempts never transfer (INV-13). */
async function complete(tx: Tx, runId: string, req: Pick<RunRequest, 'attemptId' | 'learnerId' | 'release' | 'kind' | 'response' | 'exposure'>, source: GradingSource,
    verdict: Verdict, evidence: CandidateEvidence[], engine: 'DETERMINISTIC' | 'AI_ASSISTED', insert: boolean, purpose?: Purpose, generation?: number) {
  const supported = evidence.some(claim);
  const copy = copyFor(verdict, supported, req.response, evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED')?.rationale);
  const clarification = 'clarification' in copy ? copy.clarification : supported ? null : 'Tulis rumus atau langkah yang kamu pakai.';
  const recommendations = await recommendationsFor(tx, source, req.release, verdict, evidence, req.response);
  const provenance = JSON.stringify({ engine, rubricVersion: source.rubric.evaluator, policyVersion: POLICY_VERSION, inputHash: hash(stable(req.response)).toString('hex'), invocationIds: [] });
  if (insert) await sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, evidence_status, verdict, headline, lede, clarification_prompt,
      recommendations, rubric_version, policy_version, provenance, deadline_at, started_at, completed_at)
    values (${runId}, ${req.attemptId}, ${req.learnerId}, ${generation!}, ${purpose!}, ${engine}, 'COMPLETED', ${supported ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE'}, ${verdict},
      ${copy.headline}, ${('lede' in copy && copy.lede) || null}, ${clarification}, ${JSON.stringify(recommendations)}::jsonb, ${source.rubric.evaluator}, ${POLICY_VERSION},
      ${provenance}::jsonb, now(), now(), now())`.execute(tx);
  else await sql`update diagnosis_run set status = 'COMPLETED', evidence_status = ${supported ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE'}, verdict = ${verdict},
      headline = ${copy.headline}, lede = ${('lede' in copy && copy.lede) || null}, clarification_prompt = ${clarification},
      recommendations = ${JSON.stringify(recommendations)}::jsonb, provenance = ${provenance}::jsonb, completed_at = now()
    where id = ${runId} and status = 'RUNNING'`.execute(tx);
  const concepts = new Map(source.concepts.map(c => [c.code, c]));
  for (const e of evidence) {
    const concept = concepts.get(e.conceptCode)!;
    const eligible = eligibility(e, concept.assessable, { kind: req.kind, source: 'LIVE', exposure: req.exposure, engine });
    await sql`insert into concept_evidence(id, diagnosis_run_id, attempt_id, learner_id, concept_id, classification, misconception_code, source, confidence, uncertainty_reasons, refs,
        rationale, question_family_code, context_tag, transfer_eligible, mastery_eligible, eligibility_reasons)
      values (${uuid()}, ${runId}, ${req.attemptId}, ${req.learnerId}, ${concept.id}, ${e.classification}, ${e.misconceptionCode ?? null}, ${engine === 'AI_ASSISTED' ? 'AI' : 'DETERMINISTIC'},
        ${(e as CandidateEvidence & { confidence?: number }).confidence ?? null}, ${e.uncertaintyReasons}::text[], ${JSON.stringify(e.refs)}::jsonb, ${e.rationale ?? null},
        ${source.familyCode}, ${source.contextTag}, ${eligible.transferEligible}, ${eligible.masteryEligible}, ${eligible.reasons}::text[])`.execute(tx);
  }
  logGrading(runId, engine, source.rubric.evaluator, verdict, supported, evidence);
  return { supported };
}

/** E-03, E-04, E-16 and E-10: create the run of a loop attempt, inline when the rubric covers the response. */
export async function diagnose(tx: Tx, req: RunRequest): Promise<RunResult> {
  const source = await gradingSource(tx, req.revisionId);
  const evaluation = evaluate({ body: source.body, rubric: source.rubric, concepts: source.concepts.map(c => ({ code: c.code, assessable: c.assessable })), response: req.response });
  const covered = evaluation.verdict === 'CORRECT' || evaluation.verdict === 'INCORRECT' || req.response.responseType === 'SELF_REPORT';
  const runId = uuid();
  if (!covered && req.queue) {
    const deadline = (await sql<{ d: Date }>`select now() + ${sql.raw(RUN_DEADLINE)} as d`.execute(tx)).rows[0]!.d;
    await sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, rubric_version, policy_version, provenance, deadline_at)
      values (${runId}, ${req.attemptId}, ${req.learnerId}, ${req.generation}, ${req.purpose}, 'AI_ASSISTED', 'QUEUED', ${source.rubric.evaluator}, ${POLICY_VERSION},
        ${JSON.stringify({ engine: 'AI_ASSISTED', queued: true, inputHash: hash(stable(req.response)).toString('hex') })}::jsonb, ${deadline})`.execute(tx);
    await enqueueDiagnosis(tx, runId, deadline, MAX_CALLS);
    if (gradingLog()) console.log(`grade run=${runId.slice(-8)} rules=${source.rubric.evaluator} verdict=${evaluation.verdict} → queued for AI (the worker logs the result)`);
    return { runId, status: 'QUEUED', verdict: null, evidenceStatus: null };
  }
  const { supported } = await complete(tx, runId, req, source, evaluation.verdict, evaluation.evidence, 'DETERMINISTIC', true, req.purpose, req.generation);
  return { runId, status: 'COMPLETED', verdict: evaluation.verdict, evidenceStatus: supported ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE' };
}

export interface QueuedRun { id: string; attemptId: string; learnerId: string; generation: number; purpose: Purpose; status: string; deadlinePassed: boolean }
export async function queuedRun(db: Connection, runId: string): Promise<QueuedRun | null> {
  return (await sql<QueuedRun>`select id, attempt_id as "attemptId", learner_id as "learnerId", generation, purpose, status, deadline_at <= now() as "deadlinePassed"
    from diagnosis_run where id = ${runId}`.execute(db)).rows[0] ?? null;
}
/** Milliseconds left before the run's deadline (0 when passed). */
export async function runTimeLeft(db: Connection, runId: string) {
  return Number((await sql<{ ms: number }>`select greatest(0, extract(epoch from deadline_at - now()) * 1000)::float8 as ms from diagnosis_run where id = ${runId}`.execute(db)).rows[0]?.ms ?? 0);
}
/** The worker took the run: QUEUED → RUNNING. False when it was cancelled or already ended. */
export async function startRun(tx: Tx, runId: string) {
  const r = await sql`update diagnosis_run set status = 'RUNNING', started_at = now() where id = ${runId} and status = 'QUEUED'`.execute(tx);
  return Number(r.numAffectedRows ?? 0) === 1 || (await queuedRun(tx, runId))?.status === 'RUNNING';
}
/** E-09: a run that can no longer finish. No evidence is written (T01-4). */
export async function failRun(tx: Tx, runId: string, code: 'DEADLINE_EXCEEDED' | 'INVALID_OUTPUT' | 'DEPENDENCY_UNAVAILABLE' | 'CONSENT_REVOKED' | 'INTERNAL') {
  const r = await sql`update diagnosis_run set status = 'FAILED', failure_code = ${code} where id = ${runId} and status in ('QUEUED', 'RUNNING')`.execute(tx);
  return Number(r.numAffectedRows ?? 0) === 1;
}
/** E-24, E-25 and discarded late results: active runs end without evidence. */
export async function cancelRuns(tx: Tx, runIds: string[]) {
  if (runIds.length) await sql`update diagnosis_run set status = 'CANCELLED' where id = any(${runIds}::uuid[]) and status in ('QUEUED', 'RUNNING')`.execute(tx);
}
/** Active (QUEUED or RUNNING) runs of the given attempts. */
export async function activeRuns(db: Connection, attemptIds: string[]) {
  if (!attemptIds.length) return [];
  return (await sql<{ id: string }>`select id from diagnosis_run where attempt_id = any(${attemptIds}::uuid[]) and status in ('QUEUED', 'RUNNING')`.execute(db)).rows.map(r => r.id);
}
/** Active runs past their deadline, plus the given ones whose job gave up (E-09). */
export async function exhaustedRuns(db: Connection, failedJobRuns: string[]) {
  return (await sql<{ id: string }>`select id from diagnosis_run where status in ('QUEUED', 'RUNNING')
    and (deadline_at <= now() or id = any(${failedJobRuns}::uuid[])) order by created_at limit 20`.execute(db)).rows.map(r => r.id);
}
/** The latest run of an attempt (E-10 returns it unchanged when no new generation is allowed). */
export async function latestRun(db: Connection, attemptId: string) {
  return (await sql<{ id: string; generation: number; status: string; verdict: string | null }>`select id, generation, status, verdict from diagnosis_run
    where attempt_id = ${attemptId} order by generation desc limit 1`.execute(db)).rows[0] ?? null;
}

/** The engine's view of a run (no learner identity). */
export async function engineInput(db: Connection, revisionId: string, purpose: Purpose, response: StudentResponse): Promise<EngineInput> {
  const source = await gradingSource(db, revisionId), labels = await conceptLabels(db, source.concepts.map(c => c.id));
  return { purpose, response, prompt: source.body.prompt, rubric: source.rubric,
    concepts: source.concepts.map(c => ({ code: c.code, assessable: c.assessable, misconceptions: labels.get(c.id)!.misconceptions.map(m => m.code) })) };
}

/**
 * 06 §2.4: validate a candidate. A malformed document is INVALID_OUTPUT (the job retries); a malformed item is dropped.
 * Concepts outside the mapping, claims on non-assessable concepts, unknown misconceptions, references that are not
 * real spans of the response, unsupported claims and low confidence never become evidence.
 */
export function validateCandidate(raw: unknown, input: EngineInput): { verdict: Verdict; evidence: (CandidateEvidence & { confidence?: number })[]; dropped: string[] } {
  const doc = raw as { schemaVersion?: unknown; verdict?: unknown; concepts?: unknown };
  if (!doc || typeof doc !== 'object' || doc.schemaVersion !== 1 || !['CORRECT', 'INCORRECT', 'UNREADABLE'].includes(doc.verdict as string)
    || !Array.isArray(doc.concepts) || doc.concepts.length > 20) throw new InvalidOutput();
  const text = input.response.responseType === 'TEXT' ? input.response.text ?? '' : '';
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const dropped: string[] = [], seen = new Map<string, CandidateEvidence & { confidence?: number }>();
  for (const item of doc.concepts as Record<string, unknown>[]) {
    const concept = input.concepts.find(c => c.code === item?.conceptCode);
    const classification = item?.classification as CandidateEvidence['classification'];
    if (!concept || seen.has(concept.code)) { dropped.push('CONCEPT_SCOPE'); continue; }
    if (!['UNDERSTANDING_DEMONSTRATED', 'MISCONCEPTION_EVIDENCED', 'INSUFFICIENT_EVIDENCE', 'NOT_ASSESSED'].includes(classification)) { dropped.push('SCHEMA'); continue; }
    const isClaim = classification === 'UNDERSTANDING_DEMONSTRATED' || classification === 'MISCONCEPTION_EVIDENCED';
    if (isClaim && !concept.assessable) { dropped.push('NOT_ASSESSABLE'); continue; }
    const refs = Array.isArray(item.refs) ? item.refs as Record<string, unknown>[] : [];
    const spans = refs.every(r => r?.kind === 'SPAN' && Number.isInteger(r.start) && Number.isInteger(r.end) && (r.start as number) >= 0
      && (r.start as number) < (r.end as number) && (r.end as number) <= text.length && typeof r.quote === 'string' && norm(text.slice(r.start as number, r.end as number)) === norm(r.quote as string));
    if (!spans) { dropped.push('REFERENCE'); continue; }
    if (classification === 'MISCONCEPTION_EVIDENCED' && (!concept.misconceptions.includes(item.misconceptionCode as string)
      || typeof item.rationale !== 'string' || !item.rationale || item.rationale.length > 400)) { dropped.push('MISCONCEPTION'); continue; }
    if (isClaim && !refs.length) { dropped.push('UNSUPPORTED'); continue; }
    const confidence = typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1 ? Math.round(item.confidence * 1000) / 1000 : 0;
    const refsOut = refs.map(r => ({ kind: 'SPAN', start: r.start, end: r.end, quote: text.slice(r.start as number, r.end as number) }) as EvidenceRef);
    seen.set(concept.code, isClaim && confidence < CONFIDENCE_FLOOR
      ? { conceptCode: concept.code, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['LOW_CONFIDENCE'], confidence }
      : { conceptCode: concept.code, classification, refs: isClaim ? refsOut : [], confidence,
          ...(classification === 'MISCONCEPTION_EVIDENCED' ? { misconceptionCode: item.misconceptionCode as string, rationale: item.rationale as string } : {}),
          uncertaintyReasons: classification === 'INSUFFICIENT_EVIDENCE' ? ['INCOMPLETE_WORK'] : [] });
  }
  const evidence = input.concepts.map(c => seen.get(c.code) ?? { conceptCode: c.code, classification: 'NOT_ASSESSED' as const, refs: [], uncertaintyReasons: [] });
  return { verdict: doc.verdict as Verdict, evidence, dropped };
}

/** Adopt a validated candidate into a RUNNING run (the caller has checked every fence under lock). */
export async function completeQueued(tx: Tx, run: QueuedRun, req: Pick<RunRequest, 'revisionId' | 'release' | 'kind' | 'response' | 'exposure'>, candidate: ReturnType<typeof validateCandidate>) {
  const source = await gradingSource(tx, req.revisionId);
  const { supported } = await complete(tx, run.id, { ...req, attemptId: run.attemptId, learnerId: run.learnerId }, source, candidate.verdict, candidate.evidence, 'AI_ASSISTED', false);
  return { verdict: candidate.verdict, evidenceStatus: supported ? 'SUPPORTED' as const : 'INSUFFICIENT_EVIDENCE' as const };
}

/** E-21 and E-19: the authored worked solution of the anchor (private rubric content, released only by these commands). */
export async function workedSolution(db: Connection, revisionId: string) {
  return (await gradingSource(db, revisionId)).rubric.workedSolution ?? null;
}
/** D2: the lesson a loop assigns for a concept of its anchor, when the rubric links one. */
export async function lessonLink(db: Connection, revisionId: string, conceptCode: string) {
  return (await gradingSource(db, revisionId)).rubric.lessonFor?.[conceptCode] ?? null;
}
