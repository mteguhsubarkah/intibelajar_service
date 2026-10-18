// The PRACTICE session state machine (architecture 05: E-02, E-12–E-15, E-22–E-26). Pure: a context and a
// command in, the next context out, or a refusal. The service persists the difference in one transaction,
// so an illegal command writes nothing (05 §1.5). QUESTION_LOOP transitions arrive in Slice 2.
//
// Legality never depends on a verdict: the service may grade before asking, and grading is pure.

export type State = 'MICROLEARNING' | 'QUICK_CHECK' | 'PRACTICING' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export type Verdict = 'CORRECT' | 'INCORRECT' | 'UNREADABLE' | 'NOT_GRADED';
export type AllowedAction = 'SUBMIT_ATTEMPT' | 'ANSWER_QUICK_CHECK' | 'ADVANCE_LESSON' | 'FINISH_LESSON' | 'SKIP_LESSON' | 'SKIP_ITEM' | 'REQUEST_HINT' | 'ABANDON' | 'UPDATE_CHECKPOINT';
export const TERMINAL: readonly State[] = ['COMPLETED', 'ABANDONED', 'EXPIRED'];

export interface Check { id: string; slide: number; required: boolean; verdict: Verdict | null }
export interface Lesson { status: 'ASSIGNED' | 'IN_PROGRESS' | 'CHECKS_PENDING' | 'COMPLETED' | 'SKIPPED'; slide: number; slideCount: number; checks: Check[] }
export interface Item { id: string; ordinal: number; status: 'PENDING' | 'ANSWERED' | 'SKIPPED'; hintCount: number }
export interface Context { state: State; version: number; outcome: 'PRACTICE_FINISHED' | null; lesson: Lesson | null; items: Item[] }

export type Command =
  | { type: 'ADVANCE_LESSON'; slideIndex: number }
  | { type: 'ANSWER_QUICK_CHECK'; checkId: string; verdict: Verdict }
  | { type: 'FINISH_LESSON' } | { type: 'SKIP_LESSON' }
  | { type: 'SUBMIT_ATTEMPT'; itemId?: string; verdict: Verdict }
  | { type: 'SKIP_ITEM'; itemId: string }
  | { type: 'REQUEST_HINT'; step: number }
  | { type: 'ABANDON' } | { type: 'UPDATE_CHECKPOINT' } | { type: 'EXPIRE' }
  // Commands of the question loop; never legal in a PRACTICE session.
  | { type: 'START_LESSON' } | { type: 'START_RETRY' };

export type Result = { ok: true; next: Context; attemptStored: boolean } | { ok: false; code: 'INVALID_STATE_TRANSITION' };

const graded = (v: Verdict | null) => v === 'CORRECT' || v === 'INCORRECT';
const due = (l: Lesson) => l.checks.filter(c => c.required && !graded(c.verdict) && c.slide === l.slide);
export const nextItem = (ctx: Context) => [...ctx.items].sort((a, b) => a.ordinal - b.ordinal).find(i => i.status === 'PENDING');
const refuse: Result = { ok: false, code: 'INVALID_STATE_TRANSITION' };

/** INV-06: the version moves by exactly one when the state changes or an attempt is stored, and never otherwise. */
function settle(before: Context, after: Omit<Context, 'version'>, attemptStored: boolean): Result {
  const next = { ...after, version: before.version + (after.state !== before.state || attemptStored ? 1 : 0) };
  return { ok: true, next, attemptStored };
}
// After the last item is answered or skipped, a practice session is complete.
const afterItems = (ctx: Context, items: Item[]): Omit<Context, 'version'> =>
  items.some(i => i.status === 'PENDING') ? { ...ctx, items } : { ...ctx, items, state: 'COMPLETED', outcome: 'PRACTICE_FINISHED' };

export function transition(ctx: Context, cmd: Command): Result {
  if (TERMINAL.includes(ctx.state)) return refuse;
  const lesson = ctx.lesson;
  switch (cmd.type) {
    case 'ABANDON': return settle(ctx, { ...ctx, state: 'ABANDONED' }, false);
    case 'EXPIRE': return settle(ctx, { ...ctx, state: 'EXPIRED' }, false);
    case 'UPDATE_CHECKPOINT': return settle(ctx, ctx, false);

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

    // E-14 / E-15: finish (every required check graded) or skip the lesson; practice follows.
    case 'FINISH_LESSON':
      if (ctx.state !== 'MICROLEARNING' || !lesson || lesson.checks.some(c => c.required && !graded(c.verdict))) return refuse;
      return settle(ctx, { ...ctx, state: 'PRACTICING', lesson: { ...lesson, status: 'COMPLETED' } }, false);
    case 'SKIP_LESSON':
      if ((ctx.state !== 'MICROLEARNING' && ctx.state !== 'QUICK_CHECK') || !lesson) return refuse;
      return settle(ctx, { ...ctx, state: 'PRACTICING', lesson: { ...lesson, status: 'SKIPPED' } }, false);

    // E-22: only the next pending item, in order. An unreadable or ungraded answer keeps it pending (INV-16).
    case 'SUBMIT_ATTEMPT': {
      const item = nextItem(ctx);
      if (ctx.state !== 'PRACTICING' || !item || (cmd.itemId !== undefined && cmd.itemId !== item.id)) return refuse;
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
    default: return refuse;
  }
}

/** The commands legal right now, so clients never guess (05 §1.5). Agrees with transition() by construction and by test. */
export function allowedActions(ctx: Context): AllowedAction[] {
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
  if (ctx.state === 'PRACTICING' && item) { out.push('SUBMIT_ATTEMPT', 'SKIP_ITEM'); if (item.hintCount > 0) out.push('REQUEST_HINT'); }
  out.push('ABANDON', 'UPDATE_CHECKPOINT');
  return out;
}
