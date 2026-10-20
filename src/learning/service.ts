import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { equal, hash, hmac, uuid } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { cancelRunJobs } from '../platform/jobs.js';
import { hasConsent, requireConsent } from '../privacy/service.js';
import { currentRelease, lessonFor, loopAnchor, mappedConcepts, releaseVersion, resolvePractice, revisionFacts, slideCount, type LessonSource, type PracticeSpec, type Release } from '../catalog/interface.js';
import { grade, runView, type Exposure } from '../assessment/grading.js';
import { activeRuns, cancelRuns, diagnose, latestRun, lessonLink, loopGradable, workedSolution, type DiagnosisEngine, type LoopKind, type Purpose } from '../assessment/diagnosis.js';
import { tutorStep } from '../assessment/tutor-ladder.js';
import type { StudentResponse } from '../assessment/evaluators/index.js';
import { allowedActions, nextItem, transition, TERMINAL, type Command, type Context, type Item, type Lesson, type Loop, type Outcome, type RunOutcome, type State, type Verdict } from './machine.js';
// Learning sessions: PRACTICE (Slice 1 M6) and QUESTION_LOOP (Slice 2 M5). Every command follows 04 §7 inside one
// transaction that the caller opens with the idempotency claim and the learner lock: consent, session lock, expiry,
// version, legality, then writes. The machine decides; this module loads its context and persists the difference.

const TTL = { PRACTICE: "interval '24 hours'", QUESTION_LOOP: "interval '14 days'" } as const; // E-25
const LOOP_ROUTE: Record<string, string> = { FUNNEL: '/coba', CHALLENGE: '/challenge', BANK: '/latihan/soal' };
type Kind = keyof typeof TTL;
type Row = { id: string; learner_id: string; kind: Kind; origin: string; release_id: string; anchor_question_revision_id: string | null; focus_concept_id: string | null;
  state: State; state_version: string; resume_state: 'DIAGNOSING' | 'VERIFYING' | null; outcome: Outcome | null; active_attempt_id: string | null; unsuccessful_retries: number;
  checkpoint: Record<string, unknown>; started_at: Date; last_activity_at: Date; completed_at: Date | null; expires_at: Date; expired: boolean };
type PinnedCheck = { microAssessmentId: string; questionRevisionId: string; questionId: string; slide: number; required: boolean };
type ItemRow = { id: string; ordinal: number; question_revision_id: string; question_id: string; role: 'PRACTICE' | 'TRANSFER'; status: Item['status']; hintCount: number };
type Assignment = { id: string; lesson_id: string; lesson_revision_id: string; concept_id: string; status: Lesson['status']; slide_checkpoint: number; pinned_checks: PinnedCheck[];
  verdicts: Map<string, Verdict | null> };
type Anchor = { revisionId: string; questionId: string; familyCode: string; hints: { conceptCode: string; lead: string; note?: string }[]; conceptIds: Map<string, string> };
interface Loaded { row: Row; items: ItemRow[]; assignment: Assignment | null; ctx: Context; anchor: Anchor | null; activeRunId: string | null }

async function load(db: Connection, sessionId: string, learnerId: string, lock = false): Promise<Loaded | null> {
  const row = (await sql<Row>`select id, learner_id, kind, origin, release_id, anchor_question_revision_id, focus_concept_id, state, state_version, resume_state, outcome,
      active_attempt_id, unsuccessful_retries, checkpoint, started_at, last_activity_at, completed_at, expires_at, expires_at <= now() as expired
    from learning_session where id = ${sessionId} and learner_id = ${learnerId} ${lock ? sql`for update` : sql``}`.execute(db)).rows[0];
  if (!row) return null;
  const rawItems = (await sql<Omit<ItemRow, 'question_id' | 'hintCount'>>`select id, ordinal, question_revision_id, role, status from session_item
    where session_id = ${sessionId} order by ordinal`.execute(db)).rows;
  const facts = await revisionFacts(db, [...rawItems.map(i => i.question_revision_id), ...(row.anchor_question_revision_id ? [row.anchor_question_revision_id] : [])]);
  const items = rawItems.map(i => ({ ...i, question_id: facts.get(i.question_revision_id)!.questionId, hintCount: facts.get(i.question_revision_id)!.hints.length }));
  const a = (await sql<Omit<Assignment, 'verdicts'>>`select id, lesson_id, lesson_revision_id, concept_id, status, slide_checkpoint, pinned_checks from lesson_assignment
    where session_id = ${sessionId} order by assigned_at desc, id limit 1`.execute(db)).rows[0];
  let assignment: Assignment | null = null, lesson: Lesson | null = null;
  if (a) {
    // A check counts as answered once graded; a later unreadable answer never undoes that (05 E-13).
    const answers = (await sql<{ micro_assessment_id: string; verdict: Verdict }>`select micro_assessment_id, verdict from question_attempt
      where assignment_id = ${a.id} and kind = 'QUICK_CHECK' order by ordinal`.execute(db)).rows;
    const verdicts = new Map<string, Verdict | null>(a.pinned_checks.map(c => [c.microAssessmentId, null]));
    for (const x of answers) if (!['CORRECT', 'INCORRECT'].includes(verdicts.get(x.micro_assessment_id) ?? '')) verdicts.set(x.micro_assessment_id, x.verdict);
    assignment = { ...a, verdicts };
    lesson = { status: a.status, slide: a.slide_checkpoint, slideCount: await slideCount(db, a.lesson_revision_id),
      checks: a.pinned_checks.map(c => ({ id: c.microAssessmentId, slide: c.slide, required: c.required, verdict: verdicts.get(c.microAssessmentId) ?? null })) };
  }
  let loop: Loop | null = null, anchor: Anchor | null = null, activeRunId: string | null = null;
  if (row.kind === 'QUESTION_LOOP') {
    const f = facts.get(row.anchor_question_revision_id!)!;
    anchor = { revisionId: row.anchor_question_revision_id!, questionId: f.questionId, familyCode: f.familyCode, hints: f.hints, conceptIds: f.conceptIds };
    const attempts = (await sql<{ id: string; kind: LoopKind; response: StudentResponse }>`select id, kind, response from question_attempt
      where session_id = ${sessionId} and kind in ('INITIAL', 'CLARIFICATION', 'RETRY') order by ordinal`.execute(db)).rows;
    const lastInitial = attempts.map(x => x.kind).lastIndexOf('INITIAL');
    const active = attempts.find(x => x.id === row.active_attempt_id);
    const run = row.active_attempt_id ? await latestRun(db, row.active_attempt_id) : null;
    activeRunId = run?.id ?? null;
    const revealed = (await sql`select 1 from assistance_event where session_id = ${sessionId} and type = 'FULL_SOLUTION_SHOWN'`.execute(db)).rows.length > 0;
    loop = {
      clarificationRounds: attempts.slice(lastInitial + 1).filter(x => x.kind === 'CLARIFICATION').length, unsuccessfulRetries: row.unsuccessful_retries,
      attempt: active ? { kind: active.kind, selfReport: active.response.selfReport ?? null } : null,
      run: run ? { generation: run.generation, status: run.status === 'QUEUED' || run.status === 'RUNNING' ? 'PENDING' : run.status as 'COMPLETED' | 'FAILED' | 'CANCELLED',
        verdict: run.status === 'COMPLETED' ? run.verdict as Verdict : null } : null,
      resumeState: row.resume_state, hintCount: f.hints.length, solutionRevealed: revealed,
    };
  }
  const ctx: Context = { state: row.state, version: Number(row.state_version), outcome: row.outcome, lesson, loop,
    items: items.map(i => ({ id: i.id, ordinal: i.ordinal, status: i.status, hintCount: i.hintCount })) };
  return { row, items, assignment, ctx, anchor, activeRunId };
}

const iso = (d: Date) => d.toISOString();
const stateView = (l: Loaded) => ({ id: l.row.id, state: l.ctx.state, stateVersion: l.ctx.version, allowedActions: l.row.expired ? [] : allowedActions(l.ctx) });

async function sessionView(db: Connection, l: Loaded) {
  const { row, ctx, assignment } = l;
  return {
    id: row.id, kind: row.kind, origin: row.origin, state: ctx.state, stateVersion: ctx.version, ...(row.outcome ? { outcome: row.outcome } : {}),
    ...(row.resume_state ? { resumeState: row.resume_state } : {}), unsuccessfulRetries: row.unsuccessful_retries,
    releaseVersion: await releaseVersion(db, row.release_id), ...(row.focus_concept_id ? { focusConceptId: row.focus_concept_id } : {}),
    ...(row.active_attempt_id ? { activeAttemptId: row.active_attempt_id } : {}), ...(l.activeRunId ? { activeDiagnosisRunId: l.activeRunId } : {}),
    ...(assignment && ctx.lesson ? { lesson: {
      assignmentId: assignment.id, lessonId: assignment.lesson_id, conceptId: assignment.concept_id, status: ctx.lesson.status, slideIndex: ctx.lesson.slide, slideCount: ctx.lesson.slideCount,
      checks: assignment.pinned_checks.map(c => {
        const verdict = assignment.verdicts.get(c.microAssessmentId) ?? null;
        return { microAssessmentId: c.microAssessmentId, questionId: c.questionId, slideIndex: c.slide, required: c.required,
          answered: verdict === 'CORRECT' || verdict === 'INCORRECT', ...(verdict ? { verdict } : {}) };
      }),
    } } : {}),
    items: l.items.map(i => ({ id: i.id, ordinal: i.ordinal, questionId: i.question_id, status: i.status })),
    allowedActions: stateView(l).allowedActions, checkpoint: row.checkpoint,
    startedAt: iso(row.started_at), lastActivityAt: iso(row.last_activity_at), ...(row.completed_at ? { completedAt: iso(row.completed_at) } : {}), expiresAt: iso(row.expires_at),
  };
}

type AttemptRow = { id: string; session_id: string; question_revision_id: string; kind: string; ordinal: number; session_item_id: string | null; assignment_id: string | null;
  micro_assessment_id: string | null; parent_attempt_id: string | null; response: StudentResponse & { purged?: boolean }; assistance: string; verdict: string; source: string;
  submitted_at: Date; graded_at: Date | null };
const attemptView = (a: AttemptRow) => ({
  id: a.id, sessionId: a.session_id, questionRevisionId: a.question_revision_id, kind: a.kind, ordinal: a.ordinal,
  ...(a.session_item_id ? { sessionItemId: a.session_item_id } : {}), ...(a.assignment_id ? { assignmentId: a.assignment_id } : {}),
  ...(a.micro_assessment_id ? { microAssessmentId: a.micro_assessment_id } : {}), ...(a.parent_attempt_id ? { parentAttemptId: a.parent_attempt_id } : {}),
  response: { responseType: a.response.responseType, ...(a.response.text !== undefined ? { text: a.response.text } : {}), ...(a.response.optionId ? { optionId: a.response.optionId } : {}),
    ...(a.response.numeric !== undefined ? { numeric: String(a.response.numeric) } : {}), ...(a.response.selfReport ? { selfReport: a.response.selfReport } : {}),
    inputMode: a.response.inputMode ?? 'TYPED', purged: a.response.purged === true },
  assistance: a.assistance, verdict: a.verdict, source: a.source, submittedAt: iso(a.submitted_at), ...(a.graded_at ? { gradedAt: iso(a.graded_at) } : {}),
});
const attemptRow = async (db: Connection, attemptId: string, learnerId: string) => (await sql<AttemptRow>`select id, session_id, question_revision_id, kind, ordinal, session_item_id,
    assignment_id, micro_assessment_id, parent_attempt_id, response, assistance, verdict, source, submitted_at, graded_at
  from question_attempt where id = ${attemptId} and learner_id = ${learnerId}`.execute(db)).rows[0];

/**
 * Persist the machine's result: only what changed, plus activity. Terminal sessions stop expiring forward. Leaving a
 * loop (E-24, E-25) cancels its pending run and that run's job, so a late result is fenced out.
 */
async function persist(tx: Tx, l: Loaded, next: Context, activeAttemptId = l.row.active_attempt_id) {
  await sql`update learning_session set state = ${next.state}, state_version = ${next.version}, outcome = ${next.outcome},
      resume_state = ${next.state === 'EVALUATION_FAILED' ? next.loop!.resumeState : null}, active_attempt_id = ${activeAttemptId}, unsuccessful_retries = ${next.loop?.unsuccessfulRetries ?? 0},
      completed_at = ${next.state === 'COMPLETED' ? sql`coalesce(completed_at, now())` : sql`completed_at`},
      last_activity_at = now(), expires_at = ${TERMINAL.includes(next.state) ? sql`expires_at` : sql`now() + ${sql.raw(TTL[l.row.kind])}`}, updated_at = now()
    where id = ${l.row.id}`.execute(tx);
  for (const item of next.items) if (l.ctx.items.find(i => i.id === item.id)!.status !== item.status)
    await sql`update session_item set status = ${item.status} where id = ${item.id}`.execute(tx);
  if (l.assignment && next.lesson && l.ctx.lesson && (next.lesson.status !== l.ctx.lesson.status || next.lesson.slide !== l.ctx.lesson.slide))
    await sql`update lesson_assignment set status = ${next.lesson.status}, slide_checkpoint = ${next.lesson.slide},
        completed_at = ${next.lesson.status === 'COMPLETED' ? sql`now()` : sql`completed_at`}, updated_at = now() where id = ${l.assignment.id}`.execute(tx);
  if (l.ctx.loop?.run?.status === 'PENDING' && next.loop?.run?.status === 'CANCELLED') await cancelAttemptRuns(tx, [l.row.active_attempt_id!]);
  // E-19 and E-21: the worked solution becomes readable; showing it is exposure for the family (06 §5.3), once per session.
  if (l.anchor && next.loop?.solutionRevealed && !l.ctx.loop?.solutionRevealed) await revealSolution(tx, l);
}
async function cancelAttemptRuns(tx: Tx, attemptIds: string[]) {
  const runs = await activeRuns(tx, attemptIds);
  await cancelRuns(tx, runs);
  await cancelRunJobs(tx, runs);
}
async function revealSolution(tx: Tx, l: Loaded) {
  await sql`insert into assistance_event(id, learner_id, session_id, question_family_code, type, source, dedupe_key)
    values (${uuid()}, ${l.row.learner_id}, ${l.row.id}, ${l.anchor!.familyCode}, 'FULL_SOLUTION_SHOWN', 'SERVER_DELIVERED', ${'solution:' + l.row.id + ':' + l.anchor!.familyCode})
    on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
}

/** Exposure in effect before this submission (06 §5.3), from this module's own tables. */
async function exposure(tx: Tx, learnerId: string, familyCode: string, conceptIds: string[]) {
  const events = (await sql<{ type: string }>`select distinct type from assistance_event where learner_id = ${learnerId}
    and (question_family_code = ${familyCode} ${conceptIds.length ? sql`or (type = 'LESSON_VIEWED' and concept_id in (${sql.join(conceptIds)}))` : sql``})`.execute(tx)).rows.map(r => r.type);
  const revisions = (await sql<{ question_revision_id: string }>`select distinct question_revision_id from question_attempt where learner_id = ${learnerId}`.execute(tx)).rows.map(r => r.question_revision_id);
  const families = [...(await revisionFacts(tx, revisions)).values()].map(f => f.familyCode);
  const facts: Exposure = { hintUsed: events.includes('HINT_SHOWN') || events.includes('TUTOR_HINT'),
    solutionSeen: events.includes('FULL_SOLUTION_SHOWN') || events.includes('FINAL_ANSWER_SHOWN'), familyFresh: !families.includes(familyCode) };
  // The strongest exposure in effect, stored on the attempt (NONE < LESSON < HINT < TUTOR < SOLUTION).
  const assistance = facts.solutionSeen ? 'SOLUTION' : events.includes('TUTOR_HINT') ? 'TUTOR' : events.includes('HINT_SHOWN') ? 'HINT' : events.includes('LESSON_VIEWED') ? 'LESSON' : 'NONE';
  return { facts, assistance };
}

/**
 * A completed run's result as a machine command. Verification judges the answer (an incorrect answer uses a retry,
 * E-18); diagnosis judges the evidence (an unsupported result asks for working, E-05, even with a wrong value: T01-3).
 */
export function runOutcome(from: 'DIAGNOSING' | 'VERIFYING', verdict: Verdict, evidenceStatus: 'SUPPORTED' | 'INSUFFICIENT_EVIDENCE'): RunOutcome {
  if (verdict === 'CORRECT') return { type: 'RUN_CORRECT' };
  if (verdict === 'INCORRECT' && (from === 'VERIFYING' || evidenceStatus === 'SUPPORTED')) return { type: 'RUN_DIAGNOSED' };
  return { type: 'RUN_INSUFFICIENT', verdict };
}
const LOOP_KIND: Partial<Record<State, LoopKind>> = { QUESTION: 'INITIAL', CLARIFICATION_NEEDED: 'CLARIFICATION', RETRY: 'RETRY' };

/** A pinned lesson in the machine's shape (fresh assignment: slide 0, nothing answered). */
const lessonOf = (s: LessonSource): Lesson => ({ status: 'ASSIGNED', slide: 0, slideCount: s.slideCount,
  checks: s.checks.map(c => ({ id: c.microAssessmentId, slide: c.slide, required: c.required, verdict: null })) });

export function learningService(key: Buffer, engine: DiagnosisEngine | null = null) {
  const guard = async (tx: Tx, learnerId: string, sessionId: string, expected: number | undefined, cmd: Command) => {
    await requireConsent(tx, learnerId, ['LEARNING_DATA']);
    const l = await load(tx, sessionId, learnerId, true);
    if (!l) return fail(404, 'NOT_FOUND');
    if (l.ctx.state === 'EXPIRED' || l.row.expired) fail(410, 'SESSION_EXPIRED');
    if (expected !== undefined && expected !== l.ctx.version) fail(409, 'STALE_STATE_VERSION', { currentStateVersion: l.ctx.version });
    const result = transition(l.ctx, cmd);
    if (!result.ok) fail(409, 'INVALID_STATE_TRANSITION', { state: l.ctx.state, allowedActions: allowedActions(l.ctx) });
    return { l, result };
  };
  const reload = async (tx: Tx, sessionId: string, learnerId: string) => (await load(tx, sessionId, learnerId))!;
  const releaseOf = async (tx: Tx, releaseId: string): Promise<Release> => ({ id: releaseId, version: await releaseVersion(tx, releaseId) });
  const runBody = async (tx: Tx, runId: string, learnerId: string, sessionId: string) => {
    const run = (await runView(tx, runId, learnerId, async attemptId => {
      const a = (await attemptRow(tx, attemptId, learnerId))!;
      return { sessionId: a.session_id, revisionId: a.question_revision_id };
    }))!;
    return { ...run, session: stateView(await reload(tx, sessionId, learnerId)) };
  };

  // Store, grade and apply one answer (E-13, E-22). Legality was checked before anything is written.
  const answer = async (tx: Tx, learnerId: string, l: Loaded, a: { revisionId: string; kind: 'PRACTICE' | 'TRANSFER' | 'QUICK_CHECK'; itemId?: string;
      assignmentId?: string; checkId?: string; response: StudentResponse }, command: (verdict: Verdict) => Command) => {
    const facts = (await revisionFacts(tx, [a.revisionId])).get(a.revisionId)!;
    const { facts: exposed, assistance } = await exposure(tx, learnerId, facts.familyCode, [...facts.conceptIds.values()]);
    const attemptId = uuid();
    const ordinal = (await sql<{ n: number }>`select coalesce(max(ordinal), 0) + 1 as n from question_attempt where session_id = ${l.row.id}`.execute(tx)).rows[0]!.n;
    await sql`insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, session_item_id, assignment_id, micro_assessment_id, response, assistance, source)
      values (${attemptId}, ${l.row.id}, ${learnerId}, ${a.revisionId}, ${a.kind}, ${ordinal}, ${a.itemId ?? null}, ${a.assignmentId ?? null}, ${a.checkId ?? null},
        ${JSON.stringify(a.response)}::jsonb, ${assistance}, 'LIVE')`.execute(tx);
    const graded = await grade(tx, { attemptId, learnerId, revisionId: a.revisionId, kind: a.kind, source: 'LIVE', response: a.response, exposure: exposed });
    const verdict = graded.evaluation.verdict;
    await sql`update question_attempt set verdict = ${verdict}, graded_at = now() where id = ${attemptId}`.execute(tx);
    // Showing the key after grading is exposure for the family (06 §5.3), recorded once per session.
    if (graded.revealed) await sql`insert into assistance_event(id, learner_id, session_id, question_family_code, type, source, dedupe_key)
      values (${uuid()}, ${learnerId}, ${l.row.id}, ${graded.familyCode}, 'FINAL_ANSWER_SHOWN', 'SERVER_DELIVERED', ${'final:' + l.row.id + ':' + graded.familyCode})
      on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
    const result = transition(l.ctx, command(verdict));
    if (!result.ok) throw new Error('legality changed after grading'); // impossible: guards ignore verdicts
    await persist(tx, l, result.next);
    const after = await reload(tx, l.row.id, learnerId);
    return { status: 201, body: { attempt: attemptView((await attemptRow(tx, attemptId, learnerId))!), diagnosisRun: await runBody(tx, graded.runId, learnerId, l.row.id),
      session: await sessionView(tx, after) } };
  };

  /**
   * E-03, E-04, E-16: a loop attempt on the anchor and its run. Inline runs fall through E-05…E-08 or E-17…E-20 in
   * the same command; queued runs leave the session DIAGNOSING or VERIFYING until the worker adopts a result.
   */
  const loopAttempt = async (tx: Tx, learnerId: string, l: Loaded, response: StudentResponse) => {
    const kind = LOOP_KIND[l.ctx.state]!, anchor = l.anchor!;
    const { facts: exposed, assistance } = await exposure(tx, learnerId, anchor.familyCode, [...anchor.conceptIds.values()]);
    const parent = kind === 'INITIAL' ? null : (await sql<{ id: string }>`select id from question_attempt where session_id = ${l.row.id} and kind = 'INITIAL'
      order by ordinal desc limit 1`.execute(tx)).rows[0]!.id;
    const attemptId = uuid();
    const ordinal = (await sql<{ n: number }>`select coalesce(max(ordinal), 0) + 1 as n from question_attempt where session_id = ${l.row.id}`.execute(tx)).rows[0]!.n;
    await sql`insert into question_attempt(id, session_id, learner_id, question_revision_id, kind, ordinal, parent_attempt_id, response, assistance, source)
      values (${attemptId}, ${l.row.id}, ${learnerId}, ${anchor.revisionId}, ${kind}, ${ordinal}, ${parent}, ${JSON.stringify(response)}::jsonb, ${assistance}, 'LIVE')`.execute(tx);
    const purpose: Purpose = kind === 'RETRY' ? 'VERIFICATION' : 'DIAGNOSIS', from = kind === 'RETRY' ? 'VERIFYING' : 'DIAGNOSING';
    const queue = engine !== null && (engine.accepts?.(response) ?? true) && await hasConsent(tx, learnerId, 'AI_PROCESSING');
    const run = await diagnose(tx, { attemptId, learnerId, revisionId: anchor.revisionId, release: await releaseOf(tx, l.row.release_id), kind, purpose, generation: 1,
      response, exposure: exposed, queue });
    if (run.status === 'COMPLETED') await sql`update question_attempt set verdict = ${run.verdict}, graded_at = now() where id = ${attemptId}`.execute(tx);
    const selfReport = response.responseType === 'SELF_REPORT' ? response.selfReport : undefined;
    const result = transition(l.ctx, { type: 'SUBMIT_ATTEMPT', ...(selfReport ? { selfReport } : {}),
      ...(run.status === 'COMPLETED' ? { inline: runOutcome(from, run.verdict!, run.evidenceStatus!) } : {}) });
    if (!result.ok) throw new Error('loop legality changed after evaluation'); // impossible: evaluators return only what the machine accepts
    await persist(tx, l, result.next, attemptId);
    const after = await reload(tx, l.row.id, learnerId);
    return { status: 201, body: { attempt: attemptView((await attemptRow(tx, attemptId, learnerId))!), diagnosisRun: await runBody(tx, run.runId, learnerId, l.row.id),
      session: await sessionView(tx, after) } };
  };

  const cursorSign = (payload: string) => hmac(key, 'session-cursor:' + payload).toString('base64url');

  return {
    // E-01 (QUESTION_LOOP) and E-02 (PRACTICE). Own questions from intake (origin INTAKE) arrive in Slice 6.
    async create(tx: Tx, learnerId: string, body: { kind: string; origin: string; withLesson?: boolean; spec?: PracticeSpec; questionId?: string }, legacyClientSessionId?: string) {
      if (body.kind === 'QUESTION_LOOP' && body.origin === 'INTAKE') fail(403, 'FEATURE_DISABLED');
      await requireConsent(tx, learnerId, ['LEARNING_DATA']);
      const release = await currentRelease(tx);
      if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
      if (body.kind === 'QUESTION_LOOP') {
        const anchor = await loopAnchor(tx, body.questionId!);
        if (!anchor) return fail(404, 'NOT_FOUND');
        if (!await loopGradable(tx, anchor.revisionId)) fail(409, 'CONTENT_UNAVAILABLE');
        const id = uuid();
        await sql`insert into learning_session(id, learner_id, kind, origin, release_id, anchor_question_revision_id, state, checkpoint, expires_at, legacy_client_session_id)
          values (${id}, ${learnerId}, 'QUESTION_LOOP', ${body.origin}, ${release.id}, ${anchor.revisionId}, 'QUESTION',
            ${JSON.stringify({ route: LOOP_ROUTE[body.origin] ?? '/coba', sessionId: id })}::jsonb, now() + ${sql.raw(TTL.QUESTION_LOOP)}, ${legacyClientSessionId ?? null})`.execute(tx);
        return { status: 201, body: await sessionView(tx, await reload(tx, id, learnerId)) };
      }
      const spec = body.spec!;
      const items = await resolvePractice(tx, release, spec);
      const lesson = !body.withLesson ? null
        : 'conceptId' in spec ? await lessonFor(tx, release, { conceptId: spec.conceptId })
        : 'setCode' in spec ? await lessonFor(tx, release, { setCode: spec.setCode }) : null;
      if (body.withLesson && !lesson) fail(409, 'CONTENT_UNAVAILABLE');
      const focus = 'conceptId' in spec ? spec.conceptId : lesson?.conceptIds[0] ?? null;
      // 06 §5.2: an item is a transfer item when its family is fresh for the learner and it assesses the focus concept.
      const seen = new Set([...(await revisionFacts(tx, (await sql<{ r: string }>`select distinct question_revision_id as r from question_attempt
        where learner_id = ${learnerId}`.execute(tx)).rows.map(x => x.r))).values()].map(f => f.familyCode));
      const id = uuid(), route = lesson?.routeSlug ? `/core/${lesson.routeSlug}` : '/latihan/soal';
      await sql`insert into learning_session(id, learner_id, kind, origin, release_id, focus_concept_id, state, checkpoint, expires_at, legacy_client_session_id)
        values (${id}, ${learnerId}, 'PRACTICE', ${body.origin}, ${release.id}, ${focus}, ${lesson ? 'MICROLEARNING' : 'PRACTICING'},
          ${JSON.stringify({ route, sessionId: id })}::jsonb, now() + ${sql.raw(TTL.PRACTICE)}, ${legacyClientSessionId ?? null})`.execute(tx);
      for (const [i, item] of items.entries())
        await sql`insert into session_item(id, session_id, ordinal, question_revision_id, role, status) values (${uuid()}, ${id}, ${i + 1}, ${item.revisionId},
          ${focus && item.primaryConcepts.includes(focus) && !seen.has(item.familyCode) ? 'TRANSFER' : 'PRACTICE'}, 'PENDING')`.execute(tx);
      if (lesson) await assignLesson(tx, learnerId, id, lesson, focus ?? lesson.conceptIds[0]!);
      return { status: 201, body: await sessionView(tx, await reload(tx, id, learnerId)) };
    },

    async submitAttempt(tx: Tx, learnerId: string, sessionId: string, body: { expectedStateVersion: number; response: StudentResponse; sessionItemId?: string }) {
      const response: StudentResponse = { ...body.response, schemaVersion: 1, inputMode: 'TYPED' };
      const selfReport = response.responseType === 'SELF_REPORT' ? response.selfReport : undefined;
      const { l } = await guard(tx, learnerId, sessionId, body.expectedStateVersion,
        { type: 'SUBMIT_ATTEMPT', itemId: body.sessionItemId, verdict: 'CORRECT', ...(selfReport ? { selfReport } : {}) });
      if (l.anchor) return loopAttempt(tx, learnerId, l, response);
      const item = l.items.find(i => i.id === nextItem(l.ctx)!.id)!;
      return answer(tx, learnerId, l, { revisionId: item.question_revision_id, kind: item.role, itemId: item.id, response },
        verdict => ({ type: 'SUBMIT_ATTEMPT', itemId: item.id, verdict }));
    },

    async answerQuickCheck(tx: Tx, learnerId: string, sessionId: string, body: { expectedStateVersion: number; microAssessmentId: string; response: StudentResponse }) {
      const { l } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, { type: 'ANSWER_QUICK_CHECK', checkId: body.microAssessmentId, verdict: 'CORRECT' });
      const check = l.assignment!.pinned_checks.find(c => c.microAssessmentId === body.microAssessmentId)!;
      return answer(tx, learnerId, l, { revisionId: check.questionRevisionId, kind: 'QUICK_CHECK', assignmentId: l.assignment!.id, checkId: check.microAssessmentId,
        response: { ...body.response, schemaVersion: 1, inputMode: 'TYPED' } }, verdict => ({ type: 'ANSWER_QUICK_CHECK', checkId: check.microAssessmentId, verdict }));
    },

    async action(tx: Tx, learnerId: string, sessionId: string, body: { type: string; expectedStateVersion: number; slideIndex?: number; sessionItemId?: string; conceptId?: string }) {
      if (body.type === 'START_LESSON') return startLesson(tx, learnerId, sessionId, body.expectedStateVersion, body.conceptId!);
      const cmd = (body.type === 'ADVANCE_LESSON' ? { type: 'ADVANCE_LESSON', slideIndex: body.slideIndex! } : body.type === 'SKIP_ITEM' ? { type: 'SKIP_ITEM', itemId: body.sessionItemId! }
        : { type: body.type }) as Command;
      const { l, result } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, cmd);
      if (result.ok) await persist(tx, l, result.next);
      return { status: 200, body: { session: await sessionView(tx, await reload(tx, sessionId, learnerId)) } };
    },

    // E-23: idempotent per (session, question, step); no state change and no version bump. A loop's hints are its anchor's.
    async hint(tx: Tx, learnerId: string, sessionId: string, body: { step: number }) {
      const { l } = await guard(tx, learnerId, sessionId, undefined, { type: 'REQUEST_HINT', step: body.step });
      const revisionId = l.anchor ? l.anchor.revisionId : l.items.find(i => i.id === nextItem(l.ctx)!.id)!.question_revision_id;
      const facts = (await revisionFacts(tx, [revisionId])).get(revisionId)!, h = facts.hints[body.step - 1]!;
      const conceptId = facts.conceptIds.get(h.conceptCode);
      await sql`insert into assistance_event(id, learner_id, session_id, concept_id, question_family_code, type, source, dedupe_key, detail)
        values (${uuid()}, ${learnerId}, ${sessionId}, ${conceptId ?? null}, ${facts.familyCode}, 'HINT_SHOWN', 'SERVER_DELIVERED',
          ${'hint:' + sessionId + ':' + revisionId + ':' + body.step}, ${JSON.stringify({ hintStep: body.step })}::jsonb)
        on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
      await persist(tx, l, l.ctx);
      return { status: 200, body: { step: body.step, totalSteps: facts.hints.length, lead: h.lead, ...(h.note ? { note: h.note } : {}), ...(conceptId ? { conceptId } : {}),
        session: stateView(await reload(tx, sessionId, learnerId)) } };
    },

    /**
     * E-21: the worked solution. From RETRY or EVALUATION_FAILED it ends the loop (SOLUTION_REVIEWED); from COMPLETED
     * it re-reads without a state change or version step. FULL_SOLUTION_SHOWN is recorded for the family once.
     */
    async tutor(tx: Tx, learnerId: string, sessionId: string, message: string) {
      await requireConsent(tx, learnerId, ['LEARNING_DATA']);
      const l = await load(tx, sessionId, learnerId, true);
      if (!l?.anchor) return fail(404, 'NOT_FOUND');
      if (l.row.expired || ['EXPIRED','ABANDONED'].includes(l.ctx.state)) return fail(409, 'INVALID_STATE_TRANSITION');
      const used = Number((await sql<{ n: string }>`select count(*)::text n from assistance_event where learner_id=${learnerId} and session_id=${sessionId} and type='TUTOR_HINT'`.execute(tx)).rows[0]!.n);
      const step = await tutorStep(tx, l.anchor.revisionId, message, used);
      if (!step) return fail(409, 'CONTENT_UNAVAILABLE');
      if (step.full) {
        // Use the existing solution gate and exposure recording; never create a bypass for tutor text.
        if (!allowedActions(l.ctx).includes('REVIEW_SOLUTION')) return { text:'Dua petunjuk sudah terbuka. Selesaikan materi lalu coba ulang soalnya sebelum pembahasan.', quick:['Hubungkan soal dengan inti'], hintsUsed:used };
        const revealed = await this.reviewSolution(tx, learnerId, sessionId, { expectedStateVersion:l.ctx.version });
        return { text:revealed.body.solution.steps.map(s => s.title + ': ' + s.body).join('\n'), quick:[], hintsUsed:used };
      }
      if (step.hint) await sql`insert into assistance_event(id,learner_id,session_id,question_family_code,type,source,dedupe_key)
        values (${uuid()},${learnerId},${sessionId},${l.anchor.familyCode},'TUTOR_HINT','SERVER_DELIVERED',${'tutor-hint:'+sessionId+':'+step.hintsUsed})
        on conflict (learner_id,dedupe_key) do nothing`.execute(tx);
      return { text:step.text, quick:step.quick, hintsUsed:step.hintsUsed };
    },

    async reviewSolution(tx: Tx, learnerId: string, sessionId: string, body: { expectedStateVersion: number }) {
      const { l, result } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, { type: 'REVIEW_SOLUTION' });
      const solution = await workedSolution(tx, l.anchor!.revisionId);
      if (!solution) return fail(409, 'CONTENT_UNAVAILABLE');
      if (result.ok) await persist(tx, l, result.next);
      return { status: 200, body: { solution, session: await sessionView(tx, await reload(tx, sessionId, learnerId)) } };
    },
    /** Re-read a solution this session already revealed (E-19, E-21); otherwise 403 SOLUTION_LOCKED. */
    async solution(db: Connection, learnerId: string, sessionId: string) {
      const l = await load(db, sessionId, learnerId);
      if (!l || !l.anchor) return fail(404, 'NOT_FOUND');
      if (!l.ctx.loop!.solutionRevealed) return fail(403, 'SOLUTION_LOCKED');
      return (await workedSolution(db, l.anchor.revisionId)) ?? fail(404, 'NOT_FOUND');
    },

    /**
     * E-10 (blueprint A01): the attempt's shared run. Only an EVALUATION_FAILED loop whose active attempt this is,
     * below generation 3, gets a new generation (201); every other call returns the latest run unchanged (200).
     */
    async requestDiagnosis(tx: Tx, learnerId: string, attemptId: string) {
      const a = await attemptRow(tx, attemptId, learnerId);
      if (!a) return fail(404, 'NOT_FOUND');
      await requireConsent(tx, learnerId, ['LEARNING_DATA']);
      const l = (await load(tx, a.session_id, learnerId, true))!;
      const last = await latestRun(tx, attemptId);
      if (!last) return fail(404, 'NOT_FOUND');
      const step = l.anchor && !l.row.expired && l.row.active_attempt_id === attemptId ? transition(l.ctx, { type: 'REQUEST_DIAGNOSIS' }) : null;
      if (!step?.ok) return { status: 200, body: await runBody(tx, last.id, learnerId, l.row.id) };
      const kind = a.kind as LoopKind, from = l.ctx.loop!.resumeState!;
      const { facts: exposed } = await exposure(tx, learnerId, l.anchor!.familyCode, [...l.anchor!.conceptIds.values()]);
      const run = await diagnose(tx, { attemptId, learnerId, revisionId: l.anchor!.revisionId, release: await releaseOf(tx, l.row.release_id), kind,
        purpose: from === 'VERIFYING' ? 'VERIFICATION' : 'DIAGNOSIS', generation: last.generation + 1, response: a.response, exposure: exposed,
        queue: engine !== null && (engine.accepts?.(a.response) ?? true) && await hasConsent(tx, learnerId, 'AI_PROCESSING') });
      let next = step.next;
      if (run.status === 'COMPLETED') {
        await sql`update question_attempt set verdict = ${run.verdict}, graded_at = now() where id = ${attemptId} and verdict = 'PENDING'`.execute(tx);
        const judged = transition(next, { ...runOutcome(from, run.verdict!, run.evidenceStatus!), generation: last.generation + 1 });
        if (judged.ok) next = judged.next;
      }
      await persist(tx, l, next);
      return { status: 201, body: await runBody(tx, run.runId, learnerId, l.row.id) };
    },

    // E-26: the UI checkpoint is advisory; no version bump.
    async checkpoint(tx: Tx, learnerId: string, sessionId: string, body: { route: string; sessionId?: string }) {
      if (body.sessionId !== undefined && body.sessionId !== sessionId) fail(400, 'VALIDATION_FAILED');
      const { l } = await guard(tx, learnerId, sessionId, undefined, { type: 'UPDATE_CHECKPOINT' });
      await sql`update learning_session set checkpoint = ${JSON.stringify(body)}::jsonb where id = ${sessionId}`.execute(tx);
      await persist(tx, l, l.ctx);
    },

    /**
     * The facade's session for a legacy client session id (09 §6.1 rule 4). A finished session gives its alias up,
     * so the shipped client can practise the same set again under the same FlowContext.sessionId.
     */
    async legacySession(tx: Tx, learnerId: string, legacyId: string) {
      const row = (await sql<{ id: string; state: State; expired: boolean }>`select id, state, expires_at <= now() as expired from learning_session
        where learner_id = ${learnerId} and legacy_client_session_id = ${legacyId} for update`.execute(tx)).rows[0];
      if (row && (TERMINAL.includes(row.state) || row.expired)) {
        await sql`update learning_session set legacy_client_session_id = null where id = ${row.id}`.execute(tx);
        return null;
      }
      return row ? (await load(tx, row.id, learnerId))! : null;
    },

    /** The facade's loop for a legacy key, terminal or not, without giving the alias up (L4 reads a COMPLETED loop). */
    async legacyLoop(tx: Tx, learnerId: string, legacyId: string) {
      const row = (await sql<{ id: string }>`select id from learning_session where learner_id = ${learnerId} and legacy_client_session_id = ${legacyId}
        and kind = 'QUESTION_LOOP' for update`.execute(tx)).rows[0];
      return row ? (await load(tx, row.id, learnerId))! : null;
    },

    /**
     * L1 `hintOpened: true` (09 §6.2): the shipped client showed a hint the server did not deliver. Recorded as a
     * client-reported HINT_SHOWN for the anchor's family, conservatively (it only ever removes eligibility), once per
     * session. No state change, no version step.
     */
    async clientHint(tx: Tx, learnerId: string, sessionId: string) {
      const l = await load(tx, sessionId, learnerId);
      if (!l?.anchor) return;
      await sql`insert into assistance_event(id, learner_id, session_id, question_family_code, type, source, dedupe_key)
        values (${uuid()}, ${learnerId}, ${sessionId}, ${l.anchor.familyCode}, 'HINT_SHOWN', 'CLIENT_REPORTED', ${'hint-client:' + sessionId})
        on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
    },

    async get(db: Connection, learnerId: string, sessionId: string) {
      const l = await load(db, sessionId, learnerId);
      return l ? sessionView(db, l) : fail(404, 'NOT_FOUND');
    },

    // Resume list, newest activity first; keyset cursor signed and bound to the status filter.
    async list(db: Connection, learnerId: string, status: 'active' | 'completed' | 'all', cursor: string | undefined, limit: number) {
      let after: { t: string; id: string } | undefined;
      if (cursor !== undefined) {
        const [payload, signature] = cursor.split('.');
        if (!payload || !signature || !equal(Buffer.from(signature), Buffer.from(cursorSign(payload)))) fail(400, 'VALIDATION_FAILED');
        const c = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as { t: string; id: string; s: string; l: string; e: number };
        if (c.s !== status || c.l !== hash(learnerId).toString('hex').slice(0, 16) || c.e < Date.now() / 1000) fail(400, 'VALIDATION_FAILED');
        after = c;
      }
      const filter = status === 'active' ? sql`state not in ('COMPLETED', 'ABANDONED', 'EXPIRED')` : status === 'completed' ? sql`state = 'COMPLETED'` : sql`true`;
      const rows = (await sql<{ id: string; kind: string; origin: string; state: string; state_version: string; outcome: string | null; anchor: string | null;
          focus_concept_id: string | null; last_activity_at: Date; expires_at: Date; t: string }>`
        select id, kind, origin, state, state_version, outcome, anchor_question_revision_id as anchor, focus_concept_id, last_activity_at, expires_at,
          to_char(last_activity_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as t
        from learning_session where learner_id = ${learnerId} and ${filter}
          ${after ? sql`and (last_activity_at, id) < (${after.t}::timestamp at time zone 'UTC', ${after.id}::uuid)` : sql``}
        order by last_activity_at desc, id desc limit ${limit + 1}`.execute(db)).rows;
      const page = rows.slice(0, limit), last = page.at(-1);
      const next = rows.length > limit && last ? (() => {
        const payload = Buffer.from(JSON.stringify({ t: last.t, id: last.id, s: status, l: hash(learnerId).toString('hex').slice(0, 16), e: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
        return `${payload}.${cursorSign(payload)}`;
      })() : null;
      const anchors = await revisionFacts(db, page.flatMap(r => r.anchor ? [r.anchor] : []));
      return { items: page.map(r => ({ id: r.id, kind: r.kind, origin: r.origin, state: r.state, stateVersion: Number(r.state_version), ...(r.outcome ? { outcome: r.outcome } : {}),
        ...(r.anchor ? { anchorQuestionId: anchors.get(r.anchor)!.questionId } : {}), ...(r.focus_concept_id ? { focusConceptId: r.focus_concept_id } : {}),
        lastActivityAt: iso(r.last_activity_at), expiresAt: iso(r.expires_at) })), nextCursor: next };
    },

    async attempt(db: Connection, learnerId: string, attemptId: string) {
      const a = await attemptRow(db, attemptId, learnerId);
      return a ? attemptView(a) : fail(404, 'NOT_FOUND');
    },

    async diagnosisRun(db: Connection, learnerId: string, runId: string) {
      let sessionId = '';
      const run = await runView(db, runId, learnerId, async attemptId => {
        const a = (await attemptRow(db, attemptId, learnerId))!;
        sessionId = a.session_id;
        return { sessionId: a.session_id, revisionId: a.question_revision_id };
      });
      if (!run) return fail(404, 'NOT_FOUND');
      return { ...run, session: stateView((await load(db, sessionId, learnerId))!) };
    },
  };

  /**
   * E-11: a lesson for a concept of the anchor. The concept must be mapped on the anchor revision and a published lesson
   * must teach it: the rubric's authored link (D2) when there is one, else the concept's lesson. Otherwise 409
   * CONTENT_UNAVAILABLE, after legality and with no writes.
   */
  async function startLesson(tx: Tx, learnerId: string, sessionId: string, expected: number, conceptId: string) {
    const placeholder: Lesson = { status: 'ASSIGNED', slide: 0, slideCount: 1, checks: [] };
    const { l } = await guard(tx, learnerId, sessionId, expected, { type: 'START_LESSON', lesson: placeholder });
    const concept = (await mappedConcepts(tx, l.anchor!.revisionId)).find(c => c.id === conceptId);
    if (!concept) return fail(409, 'CONTENT_UNAVAILABLE');
    const release = await releaseOf(tx, l.row.release_id), link = await lessonLink(tx, l.anchor!.revisionId, concept.code);
    const lesson = (link ? await lessonFor(tx, release, { lessonCode: link, conceptId }) : null) ?? await lessonFor(tx, release, { conceptId });
    if (!lesson) return fail(409, 'CONTENT_UNAVAILABLE');
    const result = transition(l.ctx, { type: 'START_LESSON', lesson: lessonOf(lesson) });
    if (!result.ok) return fail(409, 'CONTENT_UNAVAILABLE'); // a lesson the machine cannot pin (e.g. no slides)
    await assignLesson(tx, learnerId, sessionId, lesson, conceptId);
    await persist(tx, { ...l, assignment: null }, result.next);
    return { status: 200, body: { session: await sessionView(tx, await reload(tx, sessionId, learnerId)) } };
  }
}

/** A pinned lesson assignment and its LESSON_VIEWED exposure (E-02 with a lesson, E-11). */
async function assignLesson(tx: Tx, learnerId: string, sessionId: string, lesson: LessonSource, conceptId: string) {
  const pinned: PinnedCheck[] = lesson.checks.map(c => ({ microAssessmentId: c.microAssessmentId, questionRevisionId: c.questionRevisionId, questionId: c.questionId, slide: c.slide, required: c.required }));
  const assignmentId = uuid();
  await sql`insert into lesson_assignment(id, session_id, lesson_id, lesson_revision_id, concept_id, status, pinned_checks)
    values (${assignmentId}, ${sessionId}, ${lesson.lessonId}, ${lesson.revisionId}, ${conceptId}, 'ASSIGNED', ${JSON.stringify(pinned)}::jsonb)`.execute(tx);
  await sql`insert into assistance_event(id, learner_id, session_id, concept_id, type, source, dedupe_key, detail)
    values (${uuid()}, ${learnerId}, ${sessionId}, ${conceptId}, 'LESSON_VIEWED', 'SERVER_DELIVERED', ${'lesson:' + sessionId + ':' + assignmentId}, ${JSON.stringify({ lessonId: lesson.lessonId })}::jsonb)
    on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
}

/**
 * E-25: the sweeper expires idle non-terminal sessions (PRACTICE: 24 hours, QUESTION_LOOP: 14 days after the last
 * activity) and cancels their active runs and jobs, so a late result is discarded.
 */
export async function expireSessions(db: Connection) {
  return db.transaction().execute(async tx => {
    const expired = (await sql<{ id: string; active_attempt_id: string | null }>`update learning_session set state = 'EXPIRED', state_version = state_version + 1,
        resume_state = null, updated_at = now()
      where state not in ('COMPLETED', 'ABANDONED', 'EXPIRED') and expires_at <= now() returning id, active_attempt_id`.execute(tx)).rows;
    await cancelAttemptRuns(tx, expired.flatMap(r => r.active_attempt_id ? [r.active_attempt_id] : []));
    return expired.length;
  });
}

/* ---------- worker adoption (05 E-05…E-09, E-17…E-20 from a job; 04 §7 fencing) ---------- */

export interface Adoptable { sessionId: string; learnerId: string; attemptId: string; revisionId: string; release: Release; kind: LoopKind; response: StudentResponse; exposure: Exposure;
  from: 'DIAGNOSING' | 'VERIFYING' }
/**
 * Lock the run's session and check the fences a late result must pass: the attempt is the session's active one, its
 * run of this generation is still pending, and the session is waiting for it. The caller has already locked the
 * learner (consent) and validated the lease. Null means the result is to be discarded.
 */
export async function adoptionTarget(tx: Tx, learnerId: string, attemptId: string, generation: number): Promise<Adoptable | null> {
  const a = (await sql<{ session_id: string; question_revision_id: string; kind: string; response: StudentResponse }>`select session_id, question_revision_id, kind, response
    from question_attempt where id = ${attemptId} and learner_id = ${learnerId}`.execute(tx)).rows[0];
  if (!a) return null;
  const l = await load(tx, a.session_id, learnerId, true);
  if (!l?.anchor || l.row.active_attempt_id !== attemptId || (l.ctx.state !== 'DIAGNOSING' && l.ctx.state !== 'VERIFYING')) return null;
  if (l.ctx.loop?.run?.status !== 'PENDING' || l.ctx.loop.run.generation !== generation) return null;
  const { facts } = await exposure(tx, learnerId, l.anchor.familyCode, [...l.anchor.conceptIds.values()]);
  return { sessionId: l.row.id, learnerId, attemptId, revisionId: l.anchor.revisionId, release: { id: l.row.release_id, version: await releaseVersion(tx, l.row.release_id) },
    kind: a.kind as LoopKind, response: a.response, exposure: facts, from: l.ctx.state };
}
/** Apply an adopted or exhausted run to its session (inside the adopting transaction, after the run row is final). */
export async function applyRunResult(tx: Tx, target: Pick<Adoptable, 'sessionId' | 'learnerId' | 'attemptId' | 'from'>, generation: number,
    result: { verdict: Verdict; evidenceStatus: 'SUPPORTED' | 'INSUFFICIENT_EVIDENCE' } | 'EXHAUSTED') {
  const l = (await load(tx, target.sessionId, target.learnerId, true))!;
  if (result !== 'EXHAUSTED') await sql`update question_attempt set verdict = ${result.verdict}, graded_at = now() where id = ${target.attemptId} and verdict = 'PENDING'`.execute(tx);
  // The run row is already final, so the loaded context shows it ended; judge from the pending state it left.
  const pending: Context = { ...l.ctx, loop: { ...l.ctx.loop!, run: { generation, status: 'PENDING', verdict: null } } };
  const cmd = result === 'EXHAUSTED' ? { type: 'RUN_EXHAUSTED' as const, generation } : { ...runOutcome(target.from, result.verdict, result.evidenceStatus), generation };
  const step = transition(pending, cmd);
  if (!step.ok) throw new Error(`run result refused in ${l.ctx.state}`); // fences were checked under the same lock
  await persist(tx, { ...l, ctx: pending }, step.next);
}
