import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { equal, hash, hmac, uuid } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { requireConsent } from '../privacy/service.js';
import { currentRelease, lessonFor, releaseVersion, resolvePractice, revisionFacts, slideCount, type PracticeSpec } from '../catalog/interface.js';
import { grade, runView, type Exposure } from '../assessment/grading.js';
import type { StudentResponse } from '../assessment/evaluators/index.js';
import { allowedActions, nextItem, transition, TERMINAL, type Command, type Context, type Item, type Lesson, type State, type Verdict } from './machine.js';
// Learning sessions (Slice 1 M6): PRACTICE only. Every command follows 04 §7 inside one transaction that the
// caller opens with the idempotency claim and the learner lock: consent, session lock, expiry, version,
// legality, then writes. The machine decides; this module loads its context and persists the difference.

const PRACTICE_TTL = "interval '24 hours'"; // E-25
type Row = { id: string; learner_id: string; kind: string; origin: string; release_id: string; focus_concept_id: string | null; state: State; state_version: string;
  outcome: 'PRACTICE_FINISHED' | null; checkpoint: Record<string, unknown>; started_at: Date; last_activity_at: Date; completed_at: Date | null; expires_at: Date; expired: boolean };
type PinnedCheck = { microAssessmentId: string; questionRevisionId: string; questionId: string; slide: number; required: boolean };
type ItemRow = { id: string; ordinal: number; question_revision_id: string; question_id: string; role: 'PRACTICE' | 'TRANSFER'; status: Item['status']; hintCount: number };
type Assignment = { id: string; lesson_id: string; lesson_revision_id: string; concept_id: string; status: Lesson['status']; slide_checkpoint: number; pinned_checks: PinnedCheck[];
  verdicts: Map<string, Verdict | null> };
interface Loaded { row: Row; items: ItemRow[]; assignment: Assignment | null; ctx: Context }

async function load(db: Connection, sessionId: string, learnerId: string, lock = false): Promise<Loaded | null> {
  const row = (await sql<Row>`select id, learner_id, kind, origin, release_id, focus_concept_id, state, state_version, outcome, checkpoint, started_at, last_activity_at,
      completed_at, expires_at, expires_at <= now() as expired
    from learning_session where id = ${sessionId} and learner_id = ${learnerId} ${lock ? sql`for update` : sql``}`.execute(db)).rows[0];
  if (!row) return null;
  const rawItems = (await sql<Omit<ItemRow, 'question_id' | 'hintCount'>>`select id, ordinal, question_revision_id, role, status from session_item
    where session_id = ${sessionId} order by ordinal`.execute(db)).rows;
  const facts = await revisionFacts(db, rawItems.map(i => i.question_revision_id));
  const items = rawItems.map(i => ({ ...i, question_id: facts.get(i.question_revision_id)!.questionId, hintCount: facts.get(i.question_revision_id)!.hints.length }));
  const a = (await sql<Omit<Assignment, 'verdicts'>>`select id, lesson_id, lesson_revision_id, concept_id, status, slide_checkpoint, pinned_checks from lesson_assignment
    where session_id = ${sessionId} order by assigned_at desc limit 1`.execute(db)).rows[0];
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
  const ctx: Context = { state: row.state, version: Number(row.state_version), outcome: row.outcome, lesson, items: items.map(i => ({ id: i.id, ordinal: i.ordinal, status: i.status, hintCount: i.hintCount })) };
  return { row, items, assignment, ctx };
}

const iso = (d: Date) => d.toISOString();
const stateView = (l: Loaded) => ({ id: l.row.id, state: l.ctx.state, stateVersion: l.ctx.version, allowedActions: l.row.expired ? [] : allowedActions(l.ctx) });

async function sessionView(db: Connection, l: Loaded) {
  const { row, ctx, assignment } = l;
  return {
    id: row.id, kind: row.kind, origin: row.origin, state: ctx.state, stateVersion: ctx.version, ...(row.outcome ? { outcome: row.outcome } : {}), unsuccessfulRetries: 0,
    releaseVersion: await releaseVersion(db, row.release_id), ...(row.focus_concept_id ? { focusConceptId: row.focus_concept_id } : {}),
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

/** Persist the machine's result: only what changed, plus activity. Terminal sessions stop expiring forward. */
async function persist(tx: Tx, l: Loaded, next: Context) {
  await sql`update learning_session set state = ${next.state}, state_version = ${next.version}, outcome = ${next.outcome},
      completed_at = ${next.state === 'COMPLETED' ? sql`coalesce(completed_at, now())` : sql`completed_at`},
      last_activity_at = now(), expires_at = ${TERMINAL.includes(next.state) ? sql`expires_at` : sql`now() + ${sql.raw(PRACTICE_TTL)}`}, updated_at = now()
    where id = ${l.row.id}`.execute(tx);
  for (const item of next.items) if (l.ctx.items.find(i => i.id === item.id)!.status !== item.status)
    await sql`update session_item set status = ${item.status} where id = ${item.id}`.execute(tx);
  if (l.assignment && next.lesson && (next.lesson.status !== l.ctx.lesson!.status || next.lesson.slide !== l.ctx.lesson!.slide))
    await sql`update lesson_assignment set status = ${next.lesson.status}, slide_checkpoint = ${next.lesson.slide},
        completed_at = ${next.lesson.status === 'COMPLETED' ? sql`now()` : sql`completed_at`}, updated_at = now() where id = ${l.assignment.id}`.execute(tx);
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

export function learningService(key: Buffer) {
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
    const run = (await runView(tx, graded.runId, learnerId, async () => ({ sessionId: l.row.id, revisionId: a.revisionId })))!;
    return { status: 201, body: { attempt: attemptView((await attemptRow(tx, attemptId, learnerId))!), diagnosisRun: { ...run, session: stateView(after) }, session: await sessionView(tx, after) } };
  };

  const cursorSign = (payload: string) => hmac(key, 'session-cursor:' + payload).toString('base64url');

  return {
    // E-02. QUESTION_LOOP sessions arrive with Slice 2.
    async create(tx: Tx, learnerId: string, body: { kind: string; origin: string; withLesson: boolean; spec: PracticeSpec }, legacyClientSessionId?: string) {
      if (body.kind !== 'PRACTICE') fail(403, 'FEATURE_DISABLED');
      await requireConsent(tx, learnerId, ['LEARNING_DATA']);
      const release = await currentRelease(tx);
      if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
      const items = await resolvePractice(tx, release, body.spec);
      const lesson = !body.withLesson ? null
        : 'conceptId' in body.spec ? await lessonFor(tx, release, { conceptId: body.spec.conceptId })
        : 'setCode' in body.spec ? await lessonFor(tx, release, { setCode: body.spec.setCode }) : null;
      if (body.withLesson && !lesson) fail(409, 'CONTENT_UNAVAILABLE');
      const focus = 'conceptId' in body.spec ? body.spec.conceptId : lesson?.conceptIds[0] ?? null;
      // 06 §5.2: an item is a transfer item when its family is fresh for the learner and it assesses the focus concept.
      const seen = new Set([...(await revisionFacts(tx, (await sql<{ r: string }>`select distinct question_revision_id as r from question_attempt
        where learner_id = ${learnerId}`.execute(tx)).rows.map(x => x.r))).values()].map(f => f.familyCode));
      const id = uuid(), route = lesson?.routeSlug ? `/core/${lesson.routeSlug}` : '/latihan/soal';
      await sql`insert into learning_session(id, learner_id, kind, origin, release_id, focus_concept_id, state, checkpoint, expires_at, legacy_client_session_id)
        values (${id}, ${learnerId}, 'PRACTICE', ${body.origin}, ${release.id}, ${focus}, ${lesson ? 'MICROLEARNING' : 'PRACTICING'},
          ${JSON.stringify({ route, sessionId: id })}::jsonb, now() + ${sql.raw(PRACTICE_TTL)}, ${legacyClientSessionId ?? null})`.execute(tx);
      for (const [i, item] of items.entries())
        await sql`insert into session_item(id, session_id, ordinal, question_revision_id, role, status) values (${uuid()}, ${id}, ${i + 1}, ${item.revisionId},
          ${focus && item.primaryConcepts.includes(focus) && !seen.has(item.familyCode) ? 'TRANSFER' : 'PRACTICE'}, 'PENDING')`.execute(tx);
      if (lesson) {
        const pinned: PinnedCheck[] = lesson.checks.map(c => ({ microAssessmentId: c.microAssessmentId, questionRevisionId: c.questionRevisionId, questionId: c.questionId, slide: c.slide, required: c.required }));
        const concept = focus ?? lesson.conceptIds[0]!;
        await sql`insert into lesson_assignment(id, session_id, lesson_id, lesson_revision_id, concept_id, status, pinned_checks)
          values (${uuid()}, ${id}, ${lesson.lessonId}, ${lesson.revisionId}, ${concept}, 'ASSIGNED', ${JSON.stringify(pinned)}::jsonb)`.execute(tx);
        await sql`insert into assistance_event(id, learner_id, session_id, concept_id, type, source, dedupe_key, detail)
          values (${uuid()}, ${learnerId}, ${id}, ${concept}, 'LESSON_VIEWED', 'SERVER_DELIVERED', ${'lesson:' + id + ':' + lesson.lessonId}, ${JSON.stringify({ lessonId: lesson.lessonId })}::jsonb)`.execute(tx);
      }
      return { status: 201, body: await sessionView(tx, await reload(tx, id, learnerId)) };
    },

    async submitAttempt(tx: Tx, learnerId: string, sessionId: string, body: { expectedStateVersion: number; response: StudentResponse; sessionItemId?: string }) {
      const { l } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, { type: 'SUBMIT_ATTEMPT', itemId: body.sessionItemId, verdict: 'CORRECT' });
      const item = l.items.find(i => i.id === nextItem(l.ctx)!.id)!;
      return answer(tx, learnerId, l, { revisionId: item.question_revision_id, kind: item.role, itemId: item.id, response: { ...body.response, schemaVersion: 1, inputMode: 'TYPED' } },
        verdict => ({ type: 'SUBMIT_ATTEMPT', itemId: item.id, verdict }));
    },

    async answerQuickCheck(tx: Tx, learnerId: string, sessionId: string, body: { expectedStateVersion: number; microAssessmentId: string; response: StudentResponse }) {
      const { l } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, { type: 'ANSWER_QUICK_CHECK', checkId: body.microAssessmentId, verdict: 'CORRECT' });
      const check = l.assignment!.pinned_checks.find(c => c.microAssessmentId === body.microAssessmentId)!;
      return answer(tx, learnerId, l, { revisionId: check.questionRevisionId, kind: 'QUICK_CHECK', assignmentId: l.assignment!.id, checkId: check.microAssessmentId,
        response: { ...body.response, schemaVersion: 1, inputMode: 'TYPED' } }, verdict => ({ type: 'ANSWER_QUICK_CHECK', checkId: check.microAssessmentId, verdict }));
    },

    async action(tx: Tx, learnerId: string, sessionId: string, body: { type: string; expectedStateVersion: number; slideIndex?: number; sessionItemId?: string; conceptId?: string }) {
      const cmd = (body.type === 'ADVANCE_LESSON' ? { type: 'ADVANCE_LESSON', slideIndex: body.slideIndex! } : body.type === 'SKIP_ITEM' ? { type: 'SKIP_ITEM', itemId: body.sessionItemId! }
        : { type: body.type }) as Command;
      const { l, result } = await guard(tx, learnerId, sessionId, body.expectedStateVersion, cmd);
      if (result.ok) await persist(tx, l, result.next);
      return { status: 200, body: { session: await sessionView(tx, await reload(tx, sessionId, learnerId)) } };
    },

    // E-23: idempotent per (session, question, step); no state change and no version bump.
    async hint(tx: Tx, learnerId: string, sessionId: string, body: { step: number }) {
      const { l } = await guard(tx, learnerId, sessionId, undefined, { type: 'REQUEST_HINT', step: body.step });
      const item = l.items.find(i => i.id === nextItem(l.ctx)!.id)!;
      const facts = (await revisionFacts(tx, [item.question_revision_id])).get(item.question_revision_id)!, h = facts.hints[body.step - 1]!;
      const conceptId = facts.conceptIds.get(h.conceptCode);
      await sql`insert into assistance_event(id, learner_id, session_id, concept_id, question_family_code, type, source, dedupe_key, detail)
        values (${uuid()}, ${learnerId}, ${sessionId}, ${conceptId ?? null}, ${facts.familyCode}, 'HINT_SHOWN', 'SERVER_DELIVERED',
          ${'hint:' + sessionId + ':' + item.question_revision_id + ':' + body.step}, ${JSON.stringify({ hintStep: body.step })}::jsonb)
        on conflict (learner_id, dedupe_key) do nothing`.execute(tx);
      await persist(tx, l, l.ctx);
      return { status: 200, body: { step: body.step, totalSteps: facts.hints.length, lead: h.lead, ...(h.note ? { note: h.note } : {}), ...(conceptId ? { conceptId } : {}),
        session: stateView(await reload(tx, sessionId, learnerId)) } };
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
}

/** E-25: the sweeper expires idle non-terminal sessions (PRACTICE: 24 hours after the last activity). */
export async function expireSessions(db: Connection) {
  const r = await sql`update learning_session set state = 'EXPIRED', state_version = state_version + 1, updated_at = now()
    where state not in ('COMPLETED', 'ABANDONED', 'EXPIRED') and expires_at <= now()`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}
