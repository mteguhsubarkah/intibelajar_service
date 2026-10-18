import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { allowedActions, nextItem, transition, TERMINAL, type AllowedAction, type Command, type Context, type Verdict } from '../src/learning/machine.js';
// INV-06 on the pure PRACTICE machine: random command sequences from freshly created sessions.
// test/learning-sessions.test.ts runs the same model against the HTTP API and PostgreSQL.

const verdict = fc.constantFrom<Verdict>('CORRECT', 'INCORRECT', 'UNREADABLE', 'NOT_GRADED');
// A session as E-02 creates it: optional lesson (ASSIGNED, slide 0, nothing answered), all items pending.
const created = fc.record({
  lesson: fc.option(fc.integer({ min: 1, max: 4 }).chain(slideCount => fc.record({
    slideCount: fc.constant(slideCount),
    checks: fc.array(fc.record({ slide: fc.integer({ min: 0, max: slideCount - 1 }), required: fc.boolean() }), { maxLength: 4 }),
  })), { nil: null }),
  items: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 5 }),
}).map(({ lesson, items }): Context => ({
  state: lesson ? 'MICROLEARNING' : 'PRACTICING', version: 1, outcome: null,
  lesson: lesson && { status: 'ASSIGNED', slide: 0, slideCount: lesson.slideCount, checks: lesson.checks.map((c, i) => ({ id: `c${i}`, ...c, verdict: null })) },
  items: items.map((hints, i) => ({ id: `i${i}`, ordinal: i + 1, status: 'PENDING', hintCount: hints })),
}));
// Commands are drawn against the current context, so most are plausible and some are deliberately not.
const commandFor = (ctx: Context) => fc.oneof(
  fc.integer({ min: -1, max: 4 }).map((slideIndex): Command => ({ type: 'ADVANCE_LESSON', slideIndex })),
  fc.tuple(fc.integer({ min: 0, max: 4 }), verdict).map(([i, v]): Command => ({ type: 'ANSWER_QUICK_CHECK', checkId: `c${i}`, verdict: v })),
  fc.constantFrom<Command>({ type: 'FINISH_LESSON' }, { type: 'SKIP_LESSON' }, { type: 'ABANDON' }, { type: 'UPDATE_CHECKPOINT' }, { type: 'EXPIRE' }, { type: 'START_LESSON' }, { type: 'START_RETRY' }),
  fc.tuple(fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }), verdict).map(([i, v]): Command => ({ type: 'SUBMIT_ATTEMPT', itemId: i === undefined ? nextItem(ctx)?.id : `i${i}`, verdict: v })),
  fc.integer({ min: 0, max: 5 }).map((i): Command => ({ type: 'SKIP_ITEM', itemId: i === 0 ? nextItem(ctx)?.id ?? 'none' : `i${i}` })),
  fc.integer({ min: 0, max: 3 }).map((step): Command => ({ type: 'REQUEST_HINT', step })),
);

/** Walk a random sequence and check every step. */
const walk = (start: Context, seed: number, steps: number, check: (before: Context, cmd: Command, after: Context, legal: boolean, attemptStored: boolean) => void) => {
  let ctx = start;
  const rng = fc.sample(fc.array(fc.nat(), { minLength: steps, maxLength: steps }), { seed, numRuns: 1 })[0]!;
  for (const r of rng) {
    const cmd = fc.sample(commandFor(ctx), { seed: seed + r, numRuns: 1 })[0]!;
    const result = transition(ctx, cmd);
    check(ctx, cmd, result.ok ? result.next : ctx, result.ok, result.ok && result.attemptStored);
    if (result.ok) ctx = result.next;
  }
};
const property = (name: string, check: Parameters<typeof walk>[3]) => test(name, () => fc.assert(fc.property(created, fc.integer(), (ctx, seed) => walk(ctx, seed, 25, check)), { numRuns: 300 }));

property('INV-06.1: the version moves by exactly one when the state changes or an attempt is stored', (before, _cmd, after, legal, stored) => {
  assert.equal(after.version, before.version + (legal && (after.state !== before.state || stored) ? 1 : 0));
});

property('terminal states absorb every command, and only ABANDON/EXPIRE/completion reach them', (before, cmd, after, legal) => {
  if (TERMINAL.includes(before.state)) assert.equal(legal, false);
  if (legal && TERMINAL.includes(after.state) && !TERMINAL.includes(before.state))
    assert.ok(cmd.type === 'ABANDON' || cmd.type === 'EXPIRE' || (after.state === 'COMPLETED' && after.outcome === 'PRACTICE_FINISHED'));
  assert.equal(after.state === 'COMPLETED', after.outcome === 'PRACTICE_FINISHED');
});

property('practice: items finish in order, never revert, and completion means none is pending', (before, cmd, after) => {
  for (const item of before.items) if (item.status !== 'PENDING') assert.equal(after.items.find(i => i.id === item.id)!.status, item.status);
  const sorted = [...after.items].sort((a, b) => a.ordinal - b.ordinal), firstPending = sorted.findIndex(i => i.status === 'PENDING');
  if (firstPending >= 0) assert.ok(sorted.slice(firstPending).every(i => i.status === 'PENDING'), 'no item is finished while an earlier one is pending');
  if (after.state === 'COMPLETED') assert.ok(after.items.every(i => i.status !== 'PENDING'));
  if (after.state === 'PRACTICING') assert.ok(after.items.some(i => i.status === 'PENDING'));
  // INV-16: an unreadable or ungraded answer keeps the item pending.
  if (cmd.type === 'SUBMIT_ATTEMPT' && (cmd.verdict === 'UNREADABLE' || cmd.verdict === 'NOT_GRADED')) assert.deepEqual(after.items, before.items);
});

property('lessons: graded checks stay graded, and practice starts only after finishing (all required graded) or skipping', (before, cmd, after, legal) => {
  for (const c of before.lesson?.checks ?? []) if (c.verdict === 'CORRECT' || c.verdict === 'INCORRECT') assert.equal(after.lesson!.checks.find(x => x.id === c.id)!.verdict, c.verdict);
  if (legal && before.state !== 'PRACTICING' && after.state === 'PRACTICING') {
    if (cmd.type === 'FINISH_LESSON') assert.ok(after.lesson!.checks.every(c => !c.required || c.verdict === 'CORRECT' || c.verdict === 'INCORRECT'));
    else assert.equal(cmd.type, 'SKIP_LESSON');
  }
  if (after.state === 'QUICK_CHECK') assert.ok(after.lesson!.checks.some(c => c.required && c.slide === after.lesson!.slide && c.verdict !== 'CORRECT' && c.verdict !== 'INCORRECT'));
});

test('allowedActions lists exactly the commands that some argument makes legal', () => {
  const witnesses = (ctx: Context): Record<AllowedAction, Command[]> => ({
    SUBMIT_ATTEMPT: [{ type: 'SUBMIT_ATTEMPT', itemId: nextItem(ctx)?.id, verdict: 'CORRECT' }],
    ANSWER_QUICK_CHECK: (ctx.lesson?.checks ?? []).map(c => ({ type: 'ANSWER_QUICK_CHECK', checkId: c.id, verdict: 'CORRECT' })),
    ADVANCE_LESSON: Array.from({ length: ctx.lesson?.slideCount ?? 0 }, (_, slideIndex) => ({ type: 'ADVANCE_LESSON', slideIndex })),
    FINISH_LESSON: [{ type: 'FINISH_LESSON' }], SKIP_LESSON: [{ type: 'SKIP_LESSON' }], SKIP_ITEM: [{ type: 'SKIP_ITEM', itemId: nextItem(ctx)?.id ?? 'none' }],
    REQUEST_HINT: [{ type: 'REQUEST_HINT', step: 1 }], ABANDON: [{ type: 'ABANDON' }], UPDATE_CHECKPOINT: [{ type: 'UPDATE_CHECKPOINT' }],
  });
  fc.assert(fc.property(created, fc.integer(), (start, seed) => walk(start, seed, 25, (_b, _c, after) => {
    const allowed = new Set(allowedActions(after));
    for (const [action, commands] of Object.entries(witnesses(after)) as [AllowedAction, Command[]][])
      assert.equal(commands.some(c => transition(after, c).ok), allowed.has(action), `${action} in ${after.state}`);
  })), { numRuns: 300 });
});

test('question-loop commands are never legal in a practice session', () => {
  fc.assert(fc.property(created, ctx => !transition(ctx, { type: 'START_LESSON' }).ok && !transition(ctx, { type: 'START_RETRY' }).ok));
});
