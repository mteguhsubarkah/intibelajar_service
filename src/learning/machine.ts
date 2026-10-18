// The learning session state machine (architecture 05 §4.2): PRACTICE (E-02, E-12–E-15, E-22–E-26) and, from
// Slice 2, QUESTION_LOOP (E-01, E-03–E-21). Pure: a context and a command in, the next context out, or a refusal.
// The service persists the difference in one transaction, so an illegal command writes nothing (05 §1.5).
//
// Legality never depends on a verdict: the service may grade before asking, and grading is pure. Run results
// (E-05–E-09, E-17–E-20) are commands too; the service fences them by lease and attempt, the machine by state
// and generation. Content guards (a published lesson for START_LESSON) stay in the service.

export type State = 'QUESTION' | 'DIAGNOSING' | 'CLARIFICATION_NEEDED' | 'DIAGNOSIS_READY' | 'MICROLEARNING' | 'QUICK_CHECK'
  | 'RETRY' | 'VERIFYING' | 'EVALUATION_FAILED' | 'PRACTICING' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export type Verdict = 'CORRECT' | 'INCORRECT' | 'UNREADABLE' | 'NOT_GRADED';
export type Outcome = 'SOLVED_FIRST_TRY' | 'SOLVED_AFTER_LEARNING' | 'SOLUTION_REVIEWED' | 'PRACTICE_FINISHED';
export type AllowedAction = 'SUBMIT_ATTEMPT' | 'ANSWER_QUICK_CHECK' | 'START_LESSON' | 'ADVANCE_LESSON' | 'FINISH_LESSON' | 'SKIP_LESSON' | 'START_RETRY'
  | 'SKIP_ITEM' | 'REVIEW_SOLUTION' | 'REQUEST_HINT' | 'REQUEST_DIAGNOSIS' | 'ABANDON' | 'UPDATE_CHECKPOINT';
export const TERMINAL: readonly State[] = ['COMPLETED', 'ABANDONED', 'EXPIRED'];
/** 05 §4.2: two clarification rounds (E-04), two unsuccessful retries (E-19), three run generations (E-10). */
export const MAX_CLARIFICATIONS = 2, MAX_UNSUCCESSFUL_RETRIES = 2, MAX_GENERATIONS = 3;

export interface Check { id: string; slide: number; required: boolean; verdict: Verdict | null }
export interface Lesson { status: 'ASSIGNED' | 'IN_PROGRESS' | 'CHECKS_PENDING' | 'COMPLETED' | 'SKIPPED'; slide: number; slideCount: number; checks: Check[] }
export interface Item { id: string; ordinal: number; status: 'PENDING' | 'ANSWERED' | 'SKIPPED'; hintCount: number }
export type SelfReport = 'KNOW' | 'DONT_KNOW';
/** The attempt the loop is waiting on or last judged (the session's active attempt). */
export interface ActiveAttempt { kind: 'INITIAL' | 'CLARIFICATION' | 'RETRY'; selfReport: SelfReport | null }
/** The active attempt's latest diagnosis run. PENDING covers QUEUED and RUNNING. */
export interface Run { generation: number; status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; verdict: Verdict | null }
export interface Loop {
  clarificationRounds: number; unsuccessfulRetries: number; attempt: ActiveAttempt | null; run: Run | null;
  resumeState: 'DIAGNOSING' | 'VERIFYING' | null; hintCount: number; solutionRevealed: boolean;
}
/** `loop` is present exactly for QUESTION_LOOP sessions. */
export interface Context { state: State; version: number; outcome: Outcome | null; lesson: Lesson | null; items: Item[]; loop?: Loop | null }

/** A run's result. Inline runs (deterministic) complete in the submitting command; queued ones arrive later. */
export type RunOutcome =
  | { type: 'RUN_INSUFFICIENT'; verdict: 'UNREADABLE' | 'NOT_GRADED' }   // E-05, E-06, E-20
  | { type: 'RUN_DIAGNOSED' }                                            // verdict INCORRECT: E-07, E-18, E-19
  | { type: 'RUN_CORRECT' }                                              // E-08, E-17
  | { type: 'RUN_EXHAUSTED' };                                           // E-09

export type Command =
  | { type: 'ADVANCE_LESSON'; slideIndex: number }
  | { type: 'ANSWER_QUICK_CHECK'; checkId: string; verdict: Verdict }
  | { type: 'FINISH_LESSON' } | { type: 'SKIP_LESSON' }
  // PRACTICE: the inline verdict. QUESTION_LOOP: an optional self-report and, for an inline run, its outcome.
  | { type: 'SUBMIT_ATTEMPT'; itemId?: string; verdict?: Verdict; selfReport?: SelfReport; inline?: RunOutcome }
  | { type: 'SKIP_ITEM'; itemId: string }
  | { type: 'REQUEST_HINT'; step: number }
  | { type: 'ABANDON' } | { type: 'UPDATE_CHECKPOINT' } | { type: 'EXPIRE' }
  // Question loop only. START_LESSON carries the lesson the service resolved and pinned (E-11).
  | { type: 'START_LESSON'; lesson: Lesson } | { type: 'START_RETRY' } | { type: 'REVIEW_SOLUTION' } | { type: 'REQUEST_DIAGNOSIS' }
  | (RunOutcome & { generation: number });

export type Result = { ok: true; next: Context; attemptStored: boolean } | { ok: false; code: 'INVALID_STATE_TRANSITION' };
type Draft = Omit<Context, 'version'>;

const graded = (v: Verdict | null | undefined) => v === 'CORRECT' || v === 'INCORRECT';
const due = (l: Lesson) => l.checks.filter(c => c.required && !graded(c.verdict) && c.slide === l.slide);
export const nextItem = (ctx: Context) => [...ctx.items].sort((a, b) => a.ordinal - b.ordinal).find(i => i.status === 'PENDING');
const refuse: Result = { ok: false, code: 'INVALID_STATE_TRANSITION' };
/** States in which the loop takes an answer to its anchor question, and the attempt kind each one derives (05 §4.1). */
const ANSWERING: Partial<Record<State, ActiveAttempt['kind']>> = { QUESTION: 'INITIAL', CLARIFICATION_NEEDED: 'CLARIFICATION', RETRY: 'RETRY' };

/** INV-06: the version moves by exactly one when the state changes or an attempt is stored, and never otherwise. */
function settle(before: Context, after: Draft, attemptStored: boolean): Result {
  const next = { ...after, version: before.version + (after.state !== before.state || attemptStored ? 1 : 0) };
  return { ok: true, next, attemptStored };
}
// After the last item is answered or skipped, a practice session is complete.
const afterItems = (ctx: Context, items: Item[]): Draft =>
  items.some(i => i.status === 'PENDING') ? { ...ctx, items } : { ...ctx, items, state: 'COMPLETED', outcome: 'PRACTICE_FINISHED' };
// Leaving the session cancels its pending run (E-24, E-25); a late result is then refused by status.
const leave = (ctx: Context, state: 'ABANDONED' | 'EXPIRED'): Draft => {
  const run = ctx.loop?.run;
  return { ...ctx, state, ...(ctx.loop && run?.status === 'PENDING' ? { loop: { ...ctx.loop, run: { ...run, status: 'CANCELLED' } } } : {}) };
};
// Where a finished or skipped lesson leads: back to the anchor question in a loop, on to the items in practice.
const afterLesson = (ctx: Context) => ctx.loop ? 'RETRY' : 'PRACTICING';

/** E-05–E-09 and E-17–E-20 on a context whose run is pending (DIAGNOSING or VERIFYING). Null when not applicable. */
function judge(ctx: Draft, loop: Loop, outcome: RunOutcome): Draft | null {
  const attempt = loop.attempt!, run = loop.run!;
  if (ctx.state !== 'DIAGNOSING' && ctx.state !== 'VERIFYING') return null;
  // 05 §4.4: a self-report is never a verdict; only an insufficient-evidence result or exhaustion follows it.
  if (attempt.selfReport && (outcome.type === 'RUN_CORRECT' || outcome.type === 'RUN_DIAGNOSED' || (outcome.type === 'RUN_INSUFFICIENT' && outcome.verdict !== 'NOT_GRADED'))) return null;
  const done = (verdict: Verdict | null, status: Run['status'] = 'COMPLETED'): Run => ({ ...run, status, verdict });
  if (outcome.type === 'RUN_EXHAUSTED')
    return { ...ctx, state: 'EVALUATION_FAILED', loop: { ...loop, run: done(null, 'FAILED'), resumeState: ctx.state } };
  if (ctx.state === 'DIAGNOSING') {
    switch (outcome.type) {
    case 'RUN_INSUFFICIENT': {
      // E-05 asks again while rounds remain; E-06 hands over the primary concepts. "Belum tahu" goes straight to E-06.
      const ask = attempt.selfReport !== 'DONT_KNOW' && loop.clarificationRounds < MAX_CLARIFICATIONS;
      return { ...ctx, state: ask ? 'CLARIFICATION_NEEDED' : 'DIAGNOSIS_READY', loop: { ...loop, run: done(outcome.verdict) } };
    }
    case 'RUN_DIAGNOSED': return { ...ctx, state: 'DIAGNOSIS_READY', loop: { ...loop, run: done('INCORRECT') } };
    case 'RUN_CORRECT': return { ...ctx, state: 'COMPLETED', outcome: 'SOLVED_FIRST_TRY', loop: { ...loop, run: done('CORRECT') } };
    }
    return null;
  }
  switch (outcome.type) {
    // E-20 (INV-16): no retry consumed.
    case 'RUN_INSUFFICIENT': return { ...ctx, state: 'RETRY', loop: { ...loop, run: done(outcome.verdict) } };
    case 'RUN_CORRECT': return { ...ctx, state: 'COMPLETED', outcome: 'SOLVED_AFTER_LEARNING', loop: { ...loop, run: done('CORRECT') } };
    case 'RUN_DIAGNOSED': {
      // E-18 then E-19: the second unsuccessful retry ends the loop with the solution.
      const failures = loop.unsuccessfulRetries + 1, exhausted = failures >= MAX_UNSUCCESSFUL_RETRIES;
      const next = { ...loop, unsuccessfulRetries: failures, run: done('INCORRECT'), solutionRevealed: loop.solutionRevealed || exhausted };
      return exhausted ? { ...ctx, state: 'COMPLETED', outcome: 'SOLUTION_REVIEWED', loop: next } : { ...ctx, state: 'RETRY', loop: next };
    }
  }
  return null;
}

function questionLoop(ctx: Context, loop: Loop, cmd: Command): Result {
  switch (cmd.type) {
    // E-03, E-04, E-16. The kind follows the state; an inline run falls through in the same command (one version step).
    case 'SUBMIT_ATTEMPT': {
      const kind = ANSWERING[ctx.state];
      if (!kind || cmd.itemId !== undefined) return refuse;
      if (kind === 'CLARIFICATION' && loop.clarificationRounds >= MAX_CLARIFICATIONS) return refuse;
      if (kind === 'RETRY' && loop.unsuccessfulRetries >= MAX_UNSUCCESSFUL_RETRIES) return refuse;
      const submitted: Loop = {
        ...loop, attempt: { kind, selfReport: cmd.selfReport ?? null }, run: { generation: 1, status: 'PENDING', verdict: null }, resumeState: null,
        clarificationRounds: loop.clarificationRounds + (kind === 'CLARIFICATION' ? 1 : 0),
      };
      const pending: Draft = { ...ctx, state: kind === 'RETRY' ? 'VERIFYING' : 'DIAGNOSING', loop: submitted };
      if (!cmd.inline) return settle(ctx, pending, true);
      if (cmd.inline.type === 'RUN_EXHAUSTED') return refuse;   // an inline run is deterministic and completes
      const judged = judge(pending, submitted, cmd.inline);
      return judged ? settle(ctx, judged, true) : refuse;
    }
    case 'RUN_INSUFFICIENT': case 'RUN_DIAGNOSED': case 'RUN_CORRECT': case 'RUN_EXHAUSTED': {
      // Fenced: the run must be the pending one of this generation (04 §7); a stale or late result changes nothing.
      if (!loop.attempt || loop.run?.status !== 'PENDING' || loop.run.generation !== cmd.generation) return refuse;
      const { generation: _generation, ...outcome } = cmd;
      const judged = judge(ctx, loop, outcome as RunOutcome);
      return judged ? settle(ctx, judged, false) : refuse;
    }
    // E-10: a new generation for the same attempt, back to the state the failure interrupted.
    case 'REQUEST_DIAGNOSIS': {
      if (ctx.state !== 'EVALUATION_FAILED' || !loop.resumeState || !loop.run || loop.run.generation >= MAX_GENERATIONS) return refuse;
      return settle(ctx, { ...ctx, state: loop.resumeState, loop: { ...loop, resumeState: null, run: { generation: loop.run.generation + 1, status: 'PENDING', verdict: null } } }, false);
    }
    // E-11: the service has checked that the concept is mapped and a published lesson teaches it.
    case 'START_LESSON':
      if (!['DIAGNOSIS_READY', 'CLARIFICATION_NEEDED', 'RETRY'].includes(ctx.state) || !validLesson(cmd.lesson)) return refuse;
      return settle(ctx, { ...ctx, state: 'MICROLEARNING', lesson: cmd.lesson }, false);
    case 'START_RETRY':
      if (ctx.state !== 'DIAGNOSIS_READY') return refuse;
      return settle(ctx, { ...ctx, state: 'RETRY' }, false);
    // E-21: ends the loop from RETRY or EVALUATION_FAILED; once COMPLETED it only re-reads (no change, no version step).
    case 'REVIEW_SOLUTION':
      if (ctx.state === 'COMPLETED') return settle(ctx, { ...ctx, loop: { ...loop, solutionRevealed: true } }, false);
      if (ctx.state !== 'RETRY' && ctx.state !== 'EVALUATION_FAILED') return refuse;
      return settle(ctx, { ...ctx, state: 'COMPLETED', outcome: 'SOLUTION_REVIEWED', loop: { ...loop, solutionRevealed: true } }, false);
    // E-23 on the anchor question.
    case 'REQUEST_HINT':
      if (!ANSWERING[ctx.state] || !Number.isInteger(cmd.step) || cmd.step < 1 || cmd.step > loop.hintCount) return refuse;
      return settle(ctx, ctx, false);
    case 'SKIP_ITEM': return refuse;
    default: return lessonStep(ctx, cmd);
  }
}

const validLesson = (l: Lesson) => Number.isInteger(l.slideCount) && l.slideCount >= 1 && l.slide === 0 && l.status === 'ASSIGNED'
  && l.checks.every(c => c.verdict === null && Number.isInteger(c.slide) && c.slide >= 0 && c.slide < l.slideCount)
  && new Set(l.checks.map(c => c.id)).size === l.checks.length;

/** E-12–E-15: the lesson part, shared by both kinds. */
function lessonStep(ctx: Context, cmd: Command): Result {
  const lesson = ctx.lesson;
  switch (cmd.type) {
    // E-12: move to a slide; required, ungraded checks placed on it become due.
    case 'ADVANCE_LESSON': {
      if (ctx.state !== 'MICROLEARNING' || !lesson || !Number.isInteger(cmd.slideIndex) || cmd.slideIndex < 0 || cmd.slideIndex >= lesson.slideCount) return refuse;
      const moved: Lesson = { ...lesson, slide: cmd.slideIndex };
      const pending = due(moved).length > 0;
      return settle(ctx, { ...ctx, state: pending ? 'QUICK_CHECK' : 'MICROLEARNING', lesson: { ...moved, status: pending ? 'CHECKS_PENDING' : 'IN_PROGRESS' } }, false);
    }

    // E-13: a due required check (QUICK_CHECK) or an optional one on the current slide (MICROLEARNING), answered once.
    // Refinement: with several required checks on one slide, QUICK_CHECK lasts until all of them are graded.
    case 'ANSWER_QUICK_CHECK': {
      if (!lesson || (ctx.state !== 'QUICK_CHECK' && ctx.state !== 'MICROLEARNING')) return refuse;
      const check = lesson.checks.find(c => c.id === cmd.checkId);
      if (!check || check.slide !== lesson.slide || graded(check.verdict)) return refuse;
      if (ctx.state === 'QUICK_CHECK' ? !check.required : check.required) return refuse;
      const checks = lesson.checks.map(c => c.id === check.id ? { ...c, verdict: cmd.verdict } : c);
      const answered: Lesson = { ...lesson, checks };
      const state = ctx.state === 'QUICK_CHECK' && due(answered).length > 0 ? 'QUICK_CHECK' : 'MICROLEARNING';
      return settle(ctx, { ...ctx, state, lesson: { ...answered, status: state === 'QUICK_CHECK' ? 'CHECKS_PENDING' : 'IN_PROGRESS' } }, true);
    }

    // E-14 / E-15: finish (every required check graded) or skip the lesson.
    case 'FINISH_LESSON':
      if (ctx.state !== 'MICROLEARNING' || !lesson || lesson.checks.some(c => c.required && !graded(c.verdict))) return refuse;
      return settle(ctx, { ...ctx, state: afterLesson(ctx), lesson: { ...lesson, status: 'COMPLETED' } }, false);
    case 'SKIP_LESSON':
      if ((ctx.state !== 'MICROLEARNING' && ctx.state !== 'QUICK_CHECK') || !lesson) return refuse;
      return settle(ctx, { ...ctx, state: afterLesson(ctx), lesson: { ...lesson, status: 'SKIPPED' } }, false);
    default: return refuse;
  }
}

function practice(ctx: Context, cmd: Command): Result {
  switch (cmd.type) {
    // E-22: only the next pending item, in order. An unreadable or ungraded answer keeps it pending (INV-16).
    case 'SUBMIT_ATTEMPT': {
      const item = nextItem(ctx);
      if (ctx.state !== 'PRACTICING' || !item || (cmd.itemId !== undefined && cmd.itemId !== item.id) || cmd.inline || cmd.selfReport) return refuse;
      if (!graded(cmd.verdict)) return settle(ctx, ctx, true);
      return settle(ctx, afterItems(ctx, ctx.items.map(i => i.id === item.id ? { ...i, status: 'ANSWERED' } : i)), true);
    }
    case 'SKIP_ITEM': {
      const item = nextItem(ctx);
      if (ctx.state !== 'PRACTICING' || !item || cmd.itemId !== item.id) return refuse;
      return settle(ctx, afterItems(ctx, ctx.items.map(i => i.id === item.id ? { ...i, status: 'SKIPPED' } : i)), false);
    }
    // E-23: a hint step of the current item; no state change and no version bump.
    case 'REQUEST_HINT': {
      const item = nextItem(ctx);
      if (ctx.state !== 'PRACTICING' || !item || !Number.isInteger(cmd.step) || cmd.step < 1 || cmd.step > item.hintCount) return refuse;
      return settle(ctx, ctx, false);
    }
    default: return lessonStep(ctx, cmd);
  }
}

export function transition(ctx: Context, cmd: Command): Result {
  if (ctx.loop && ctx.state === 'COMPLETED' && cmd.type === 'REVIEW_SOLUTION') return questionLoop(ctx, ctx.loop, cmd);
  if (TERMINAL.includes(ctx.state)) return refuse;
  switch (cmd.type) {
    case 'ABANDON': return settle(ctx, leave(ctx, 'ABANDONED'), false);
    case 'EXPIRE': return settle(ctx, leave(ctx, 'EXPIRED'), false);
    case 'UPDATE_CHECKPOINT': return settle(ctx, ctx, false);
  }
  return ctx.loop ? questionLoop(ctx, ctx.loop, cmd) : practice(ctx, cmd);
}

/** The commands legal right now, so clients never guess (05 §1.5). Agrees with transition() by construction and by test. */
export function allowedActions(ctx: Context): AllowedAction[] {
  const loop = ctx.loop;
  if (loop && ctx.state === 'COMPLETED') return ['REVIEW_SOLUTION'];
  if (TERMINAL.includes(ctx.state)) return [];
  const out: AllowedAction[] = [];
  const lesson = ctx.lesson, item = nextItem(ctx);
  if (ctx.state === 'MICROLEARNING' && lesson) {
    out.push('ADVANCE_LESSON');
    if (lesson.checks.some(c => !c.required && c.slide === lesson.slide && !graded(c.verdict))) out.push('ANSWER_QUICK_CHECK');
    if (!lesson.checks.some(c => c.required && !graded(c.verdict))) out.push('FINISH_LESSON');
    out.push('SKIP_LESSON');
  }
  if (ctx.state === 'QUICK_CHECK' && lesson) out.push('ANSWER_QUICK_CHECK', 'SKIP_LESSON');
  if (loop) {
    const kind = ANSWERING[ctx.state];
    if (kind && !(kind === 'CLARIFICATION' && loop.clarificationRounds >= MAX_CLARIFICATIONS) && !(kind === 'RETRY' && loop.unsuccessfulRetries >= MAX_UNSUCCESSFUL_RETRIES)) out.push('SUBMIT_ATTEMPT');
    if (['DIAGNOSIS_READY', 'CLARIFICATION_NEEDED', 'RETRY'].includes(ctx.state)) out.push('START_LESSON');
    if (ctx.state === 'DIAGNOSIS_READY') out.push('START_RETRY');
    if (ctx.state === 'RETRY' || ctx.state === 'EVALUATION_FAILED') out.push('REVIEW_SOLUTION');
    if (kind && loop.hintCount > 0) out.push('REQUEST_HINT');
    if (ctx.state === 'EVALUATION_FAILED' && loop.resumeState && loop.run && loop.run.generation < MAX_GENERATIONS) out.push('REQUEST_DIAGNOSIS');
  } else if (ctx.state === 'PRACTICING' && item) { out.push('SUBMIT_ATTEMPT', 'SKIP_ITEM'); if (item.hintCount > 0) out.push('REQUEST_HINT'); }
  out.push('ABANDON', 'UPDATE_CHECKPOINT');
  return out;
}
