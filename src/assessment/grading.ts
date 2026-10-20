import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { hash, stable, uuid } from '../platform/crypto.js';
import { gradingSource } from '../catalog/grading-source.js';
import { conceptLabels } from '../catalog/interface.js';
import { evaluate, type CandidateEvidence, type Evaluation, type StudentResponse } from './evaluators/index.js';
import { reportOf } from './disputes.js';
// Inline deterministic grading (Slice 1 M6; 06 §2.3 step 1, §5). One completed GRADING run per attempt,
// one evidence row per mapped concept, with mastery and transfer eligibility decided and explained here.
// Exposure facts come from the learning module, which owns attempts and assistance events.

export const POLICY_VERSION = 'mastery-v1';
export interface Exposure { hintUsed: boolean; solutionSeen: boolean; familyFresh: boolean }
export interface GradeRequest {
  attemptId: string; learnerId: string; revisionId: string; kind: 'PRACTICE' | 'TRANSFER' | 'QUICK_CHECK';
  source: 'LIVE' | 'DEVICE_IMPORT'; response: StudentResponse; exposure: Exposure;
}
export interface Graded { runId: string; evaluation: Evaluation; familyCode: string; revealed: { optionId: string } | { value: string } | null }

type Reason = 'NOT_A_CLAIM' | 'AI_ONLY' | 'DEVICE_IMPORT' | 'FORMATIVE_CHECK' | 'SOLUTION_SEEN' | 'NOT_ASSESSABLE' | 'ANCHOR_OR_RETRY' | 'NOT_TRANSFER_ITEM' | 'HINT_USED' | 'FAMILY_NOT_FRESH';

/**
 * 06 §5.1 and §5.2. Every failing rule adds its code, so the decision stays explainable. A question loop's own
 * attempts (INITIAL, CLARIFICATION, RETRY) never transfer (INV-13); AI-only evidence never counts for mastery (INV-10).
 */
export function eligibility(e: CandidateEvidence, assessable: boolean,
    req: { kind: GradeRequest['kind'] | 'INITIAL' | 'CLARIFICATION' | 'RETRY'; source: GradeRequest['source']; exposure: Exposure; engine?: 'DETERMINISTIC' | 'AI_ASSISTED' }) {
  const mastery: Reason[] = [], transfer: Reason[] = [];
  if (!['UNDERSTANDING_DEMONSTRATED', 'MISCONCEPTION_EVIDENCED'].includes(e.classification)) mastery.push('NOT_A_CLAIM');
  if (req.engine === 'AI_ASSISTED') mastery.push('AI_ONLY');
  if (req.source !== 'LIVE') mastery.push('DEVICE_IMPORT');
  if (req.kind === 'QUICK_CHECK') mastery.push('FORMATIVE_CHECK');
  if (req.exposure.solutionSeen) mastery.push('SOLUTION_SEEN');
  if (!assessable) mastery.push('NOT_ASSESSABLE');
  if (['INITIAL', 'CLARIFICATION', 'RETRY'].includes(req.kind)) transfer.push('ANCHOR_OR_RETRY');
  else if (req.kind !== 'TRANSFER') transfer.push('NOT_TRANSFER_ITEM');
  if (req.exposure.hintUsed) transfer.push('HINT_USED');
  if (!req.exposure.familyFresh) transfer.push('FAMILY_NOT_FRESH');
  const masteryEligible = mastery.length === 0;
  return { masteryEligible, transferEligible: masteryEligible && transfer.length === 0, reasons: [...mastery, ...transfer] };
}

const COPY = {
  CORRECT: { headline: 'Jawabanmu tepat.' },
  INCORRECT: { headline: 'Belum tepat.', clarification: 'Periksa lagi langkahmu sebelum lanjut ke soal berikutnya.' },
  UNREADABLE: { headline: 'Jawaban belum terbaca.', clarification: 'Tulis ulang hasil akhirnya, misalnya sebagai angka atau pilihan yang tersedia.' },
  NOT_GRADED: { headline: 'Jawaban ini tidak dinilai.', clarification: 'Pilih jawaban atau tulis hasil akhirnya supaya bisa dinilai.' },
} as const;
const claim = (e: CandidateEvidence) => e.classification === 'UNDERSTANDING_DEMONSTRATED' || e.classification === 'MISCONCEPTION_EVIDENCED';

export async function grade(tx: Tx, req: GradeRequest): Promise<Graded> {
  const source = await gradingSource(tx, req.revisionId);
  const evaluation = evaluate({ body: source.body, rubric: source.rubric, concepts: source.concepts.map(c => ({ code: c.code, assessable: c.assessable })), response: req.response });
  const supported = evaluation.evidence.some(claim), runId = uuid();
  const copy = COPY[evaluation.verdict], feedback = evaluation.verdict === 'CORRECT' ? source.rubric.feedback?.correct : evaluation.verdict === 'INCORRECT' ? source.rubric.feedback?.incorrect : undefined;
  await sql`insert into diagnosis_run(id, attempt_id, learner_id, generation, purpose, engine, status, evidence_status, verdict, headline, lede, clarification_prompt,
      recommendations, rubric_version, policy_version, provenance, deadline_at, started_at, completed_at)
    values (${runId}, ${req.attemptId}, ${req.learnerId}, 1, 'GRADING', 'DETERMINISTIC', 'COMPLETED', ${supported ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE'}, ${evaluation.verdict},
      ${copy.headline}, ${feedback && feedback.length <= 240 ? feedback : null}, ${supported ? null : 'clarification' in copy ? copy.clarification : COPY.INCORRECT.clarification},
      '[]', ${source.rubric.evaluator}, ${POLICY_VERSION},
      ${JSON.stringify({ engine: 'DETERMINISTIC', rubricVersion: source.rubric.evaluator, policyVersion: POLICY_VERSION, inputHash: hash(stable(req.response)).toString('hex'), invocationIds: [] })}::jsonb,
      now(), now(), now())`.execute(tx);
  const concepts = new Map(source.concepts.map(c => [c.code, c]));
  for (const e of evaluation.evidence) {
    const concept = concepts.get(e.conceptCode)!, eligible = eligibility(e, concept.assessable, req);
    await sql`insert into concept_evidence(id, diagnosis_run_id, attempt_id, learner_id, concept_id, classification, misconception_code, source, uncertainty_reasons, refs,
        rationale, question_family_code, context_tag, transfer_eligible, mastery_eligible, eligibility_reasons)
      values (${uuid()}, ${runId}, ${req.attemptId}, ${req.learnerId}, ${concept.id}, ${e.classification}, ${e.misconceptionCode ?? null}, 'DETERMINISTIC',
        ${e.uncertaintyReasons}::text[], ${JSON.stringify(e.refs)}::jsonb, ${e.rationale ?? null}, ${source.familyCode}, ${source.contextTag},
        ${eligible.transferEligible}, ${eligible.masteryEligible}, ${eligible.reasons}::text[])`.execute(tx);
  }
  return { runId, evaluation, familyCode: source.familyCode, revealed: revealedOf(evaluation) };
}

const revealedOf = (e: Evaluation) => !e.revealedAnswer ? null : 'optionId' in e.revealedAnswer ? { optionId: e.revealedAnswer.optionId }
  : e.revealedAnswer.forms[0] ? { value: e.revealedAnswer.forms[0].slice(0, 64) } : null;

/**
 * The DiagnosisRun representation (09 §8) of a learner's own run, without the session view the caller adds.
 * The learning module owns attempts, so it resolves the run's attempt to its session and pinned revision.
 */
export async function runView(db: Connection, runId: string, learnerId: string, attemptOf: (attemptId: string) => Promise<{ sessionId: string; revisionId: string }>) {
  const row = (await sql<{ id: string; attempt_id: string; generation: number; purpose: string; engine: string; status: string;
      evidence_status: string | null; verdict: string | null; headline: string | null; lede: string | null; clarification_prompt: string | null; failure_code: string | null;
      recommendations: unknown[]; created_at: Date; completed_at: Date | null }>`
    select d.id, d.attempt_id, d.generation, d.purpose, d.engine, d.status, d.evidence_status, d.verdict,
      d.headline, d.lede, d.clarification_prompt, d.failure_code, d.recommendations, d.created_at, d.completed_at
    from diagnosis_run d where d.id = ${runId} and d.learner_id = ${learnerId}`.execute(db)).rows[0];
  if (!row) return null;
  const attempt = await attemptOf(row.attempt_id), run = { ...row, session_id: attempt.sessionId, revision_id: attempt.revisionId };
  const evidence = (await sql<{ concept_id: string; classification: string; misconception_code: string | null; rationale: string | null; refs: unknown[]; source: string;
      uncertainty_reasons: string[]; mastery_eligible: boolean; transfer_eligible: boolean; eligibility_reasons: string[] }>`
    select concept_id, classification, misconception_code, rationale, refs, source, uncertainty_reasons, mastery_eligible, transfer_eligible, eligibility_reasons
    from concept_evidence where diagnosis_run_id = ${runId} order by created_at, concept_id`.execute(db)).rows;
  const labels = await conceptLabels(db, evidence.map(e => e.concept_id));
  const report = await reportOf(db, runId, learnerId);
  // The key is shown only for a graded practice answer; showing it is recorded as FINAL_ANSWER_SHOWN by the learning
  // module. A question loop never reveals it here: its answer is part of the worked solution (E-19, E-21; 06 §2.4 rule 7).
  let revealed: ReturnType<typeof revealedOf> = null;
  if (run.purpose === 'GRADING' && (run.verdict === 'CORRECT' || run.verdict === 'INCORRECT')) {
    const source = await gradingSource(db, run.revision_id);
    revealed = source.rubric.answer.optionId ? { optionId: source.rubric.answer.optionId } : source.rubric.acceptedForms[0] ? { value: source.rubric.acceptedForms[0].slice(0, 64) } : null;
  }
  return {
    id: run.id, attemptId: run.attempt_id, sessionId: run.session_id, generation: run.generation, purpose: run.purpose, engine: run.engine, status: run.status,
    ...(run.evidence_status ? { evidenceStatus: run.evidence_status } : {}), ...(run.verdict ? { verdict: run.verdict } : {}),
    ...(run.headline ? { headline: run.headline } : {}), ...(run.lede ? { lede: run.lede } : {}), ...(run.clarification_prompt ? { clarificationPrompt: run.clarification_prompt } : {}),
    evidence: evidence.map(e => {
      const label = labels.get(e.concept_id)!;
      const misconception = e.misconception_code ? label.misconceptions.find(m => m.code === e.misconception_code) : undefined;
      return {
        conceptId: e.concept_id, conceptCode: label.code, ...(label.legacyMapId ? { legacyMapId: label.legacyMapId } : {}), conceptTitle: label.title, classification: e.classification,
        ...(e.misconception_code ? { misconception: { code: e.misconception_code, label: (misconception?.description ?? e.misconception_code).slice(0, 200) } } : {}),
        ...(e.rationale ? { rationale: e.rationale } : {}), refs: e.refs, source: e.source, uncertaintyReasons: e.uncertainty_reasons,
        eligibility: { mastery: e.mastery_eligible, transfer: e.transfer_eligible, reasons: e.eligibility_reasons },
      };
    }),
    recommendations: run.recommendations, aiAssisted: run.engine === 'AI_ASSISTED' && run.status === 'COMPLETED', ...(revealed ? { revealedAnswer: revealed } : {}), ...(run.failure_code ? { failureCode: run.failure_code } : {}),
    ...(report ? { report } : {}), createdAt: run.created_at.toISOString(), ...(run.completed_at ? { completedAt: run.completed_at.toISOString() } : {}),
  };
}

/** The authored feedback for a graded run, in full (the legacy L3 shape carries it; DiagnosisRun.lede is capped at 240). */
export async function feedbackFor(db: Connection, revisionId: string, verdict: string) {
  if (verdict !== 'CORRECT' && verdict !== 'INCORRECT') return undefined;
  const feedback = (await gradingSource(db, revisionId)).rubric.feedback;
  return verdict === 'CORRECT' ? feedback?.correct : feedback?.incorrect;
}
