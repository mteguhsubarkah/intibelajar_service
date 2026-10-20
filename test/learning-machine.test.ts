import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { allowedActions, nextItem, transition, TERMINAL, MAX_CLARIFICATIONS, MAX_GENERATIONS, MAX_UNSUCCESSFUL_RETRIES,
  type AllowedAction, type Command, type Context, type Lesson, type RunOutcome, type Verdict } from '../src/learning/machine.js';
// INV-06 and the loop invariants on the pure machine: random command sequences from freshly created sessions of
// both kinds. test/learning-sessions.test.ts runs the PRACTICE model against the HTTP API and PostgreSQL.

const verdict = fc.constantFrom<Verdict>('CORRECT', 'INCORRECT', 'UNREADABLE', 'NOT_GRADED');
const lessonOf = (slideCount: number, checks: { slide: number; required: boolean }[]): Lesson =>
  ({ status: 'ASSIGNED', slide: 0, slideCount, checks: checks.map((c, i) => ({ id: `c${i}`, ...c, verdict: null })) });
const lesson = fc.integer({ min: 1, max: 4 }).chain(slideCount =>
  fc.array(fc.record({ slide: fc.integer({ min: 0, max: slideCount - 1 }), required: fc.boolean() }), { maxLength: 4 }).map(checks => lessonOf(slideCount, checks)));

// A PRACTICE session as E-02 creates it: optional lesson (ASSIGNED, slide 0, nothing answered), all items pending.
const practice = fc.record({ lesson: fc.option(lesson, { nil: null }), items: fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 5 }) })
  .map(({ lesson, items }): Context => ({
    state: lesson ? 'MICROLEARNING' : 'PRACTICING', version: 1, outcome: null, lesson,
    items: items.map((hints, i) => ({ id: `i${i}`, ordinal: i + 1, status: 'PENDING', hintCount: hints })),
  }));
// A QUESTION_LOOP session as E-01 creates it.
const loop = fc.integer({ min: 0, max: 2 }).map((hintCount): Context => ({
  state: 'QUESTION', version: 1, outcome: null, lesson: null, items: [],
  loop: { clarificationRounds: 0, unsuccessfulRetries: 0, attempt: null, run: null, resumeState: null, hintCount, solutionRevealed: false },
}));
const created = fc.oneof(practice, loop);

const outcome = fc.oneof(
  fc.constantFrom<RunOutcome>({ type: 'RUN_DIAGNOSED' }, { type: 'RUN_CORRECT' }, { type: 'RUN_EXHAUSTED' }),
  fc.constantFrom('UNREADABLE', 'NOT_GRADED', 'INCORRECT').map((v): RunOutcome => ({ type: 'RUN_INSUFFICIENT', verdict: v as 'UNREADABLE' | 'NOT_GRADED' | 'INCORRECT' })));
// Commands are drawn against the current context, so most are plausible and some are deliberately not.
const lessonSteps = fc.oneof(
  fc.integer({ min: -1, max: 4 }).map((slideIndex): Command => ({ type: 'ADVANCE_LESSON', slideIndex })),
  fc.tuple(fc.integer({ min: 0, max: 4 }), verdict).map(([i, v]): Command => ({ type: 'ANSWER_QUICK_CHECK', checkId: `c${i}`, verdict: v })),
  fc.constantFrom<Command>({ type: 'FINISH_LESSON' }, { type: 'SKIP_LESSON' }, { type: 'UPDATE_CHECKPOINT' }),
  fc.integer({ min: 0, max: 3 }).map((step): Command => ({ type: 'REQUEST_HINT', step })),
);
const leaving = fc.constantFrom<Command>({ type: 'ABANDON' }, { type: 'EXPIRE' });
const lessonCommands = fc.oneof({ arbitrary: lessonSteps, weight: 4 }, { arbitrary: leaving, weight: 1 });
// Weighted towards progress, so walks reach verification, resumption and the late states before they end.
const loopCommands = (ctx: Context) => fc.oneof(
  { arbitrary: lessonSteps, weight: 4 },
  { arbitrary: fc.record({ selfReport: fc.option(fc.constantFrom('KNOW' as const, 'DONT_KNOW' as const), { nil: undefined }), inline: fc.option(outcome, { nil: undefined }) })
    .map(({ selfReport, inline }): Command => ({ type: 'SUBMIT_ATTEMPT', selfReport, inline })), weight: 3 },
  { arbitrary: fc.tuple(outcome, fc.integer({ min: 0, max: 2 })).map(([o, off]): Command => ({ ...o, generation: (ctx.loop?.run?.generation ?? 1) + (off === 2 ? 1 : 0) })), weight: 4 },
  { arbitrary: fc.oneof(lesson, fc.constant(lessonOf(0, []))).map((l): Command => ({ type: 'START_LESSON', lesson: l })), weight: 1 },
  { arbitrary: fc.constantFrom<Command>({ type: 'START_RETRY' }, { type: 'REQUEST_DIAGNOSIS' }), weight: 2 },
  { arbitrary: fc.oneof(leaving, fc.constantFrom<Command>({ type: 'REVIEW_SOLUTION' }, { type: 'SKIP_ITEM', itemId: 'i0' })), weight: 1 },
);
const practiceCommands = (ctx: Context) => fc.oneof(
  lessonCommands,
  fc.constantFrom<Command>({ type: 'START_RETRY' }, { type: 'REVIEW_SOLUTION' }, { type: 'REQUEST_DIAGNOSIS' }, { type: 'START_LESSON', lesson: lessonOf(1, []) }, { type: 'RUN_CORRECT', generation: 1 }),
  fc.tuple(fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }), verdict).map(([i, v]): Command => ({ type: 'SUBMIT_ATTEMPT', itemId: i === undefined ? nextItem(ctx)?.id : `i${i}`, verdict: v })),
  fc.integer({ min: 0, max: 5 }).map((i): Command => ({ type: 'SKIP_ITEM', itemId: i === 0 ? nextItem(ctx)?.id ?? 'none' : `i${i}` })),
);
const commandFor = (ctx: Context) => ctx.loop ? loopCommands(ctx) : practiceCommands(ctx);

type Check = (before: Context, cmd: Command, after: Context, legal: boolean, attemptStored: boolean) => void;
/** Walk a random sequence and check every step. */
const walk = (start: Context, seed: number, steps: number, check: Check) => {
  let ctx = start;
  const rng = fc.sample(fc.array(fc.nat(), { minLength: steps, maxLength: steps }), { seed, numRuns: 1 })[0]!;
  for (const r of rng) {
    const cmd = fc.sample(commandFor(ctx), { seed: seed + r, numRuns: 1 })[0]!;
    const result = transition(ctx, cmd);
    check(ctx, cmd, result.ok ? result.next : ctx, result.ok, result.ok && result.attemptStored);
    if (result.ok) ctx = result.next;
  }
};
const property = (name: string, check: Check, from = created) => test(name, () => fc.assert(fc.property(from, fc.integer(), (ctx, seed) => walk(ctx, seed, 40, check)), { numRuns: 400 }));
const inlineOf = (cmd: Command) => cmd.type === 'SUBMIT_ATTEMPT' ? cmd.inline : undefined;
const isRun = (cmd: Command) => cmd.type.startsWith('RUN_');
const LOOP_STATES = ['QUESTION', 'DIAGNOSING', 'CLARIFICATION_NEEDED', 'DIAGNOSIS_READY', 'RETRY', 'VERIFYING', 'EVALUATION_FAILED'];

property('INV-06.1: the version moves by exactly one when the state changes or an attempt is stored', (before, _cmd, after, legal, stored) => {
  assert.equal(after.version, before.version + (legal && (after.state !== before.state || stored) ? 1 : 0));
});

property('terminal states absorb every command except re-reading a loop solution; completion has a reason', (before, cmd, after, legal) => {
  if (TERMINAL.includes(before.state)) {
    assert.equal(legal, Boolean(before.loop) && before.state === 'COMPLETED' && cmd.type === 'REVIEW_SOLUTION');
    if (legal) assert.deepEqual({ ...after, loop: null }, { ...before, loop: null }, 'E-21 from COMPLETED: no state change and no version step');
  }
  if (legal && after.state === 'COMPLETED' && before.state !== 'COMPLETED') {
    const run = isRun(cmd) ? cmd.type : inlineOf(cmd)?.type;
    if (!before.loop) assert.equal(after.outcome, 'PRACTICE_FINISHED');
    else if (after.outcome === 'SOLVED_FIRST_TRY') assert.ok(run === 'RUN_CORRECT' && (before.state === 'DIAGNOSING' || before.state === 'QUESTION' || before.state === 'CLARIFICATION_NEEDED'));
    else if (after.outcome === 'SOLVED_AFTER_LEARNING') assert.ok(run === 'RUN_CORRECT' && (before.state === 'VERIFYING' || before.state === 'RETRY'));
    else assert.equal(after.outcome, 'SOLUTION_REVIEWED');
  }
  assert.equal(after.state === 'COMPLETED', after.outcome !== null);
  if (legal && TERMINAL.includes(after.state) && after.state !== 'COMPLETED') assert.ok(cmd.type === 'ABANDON' || cmd.type === 'EXPIRE');
});

property('kinds stay apart: practice never enters a loop state, a loop never practises', (_b, _c, after) => {
  if (after.loop) assert.notEqual(after.state, 'PRACTICING');
  else assert.ok(!LOOP_STATES.includes(after.state), after.state);
});

property('practice: items finish in order, never revert, and completion means none is pending', (before, cmd, after) => {
  for (const item of before.items) if (item.status !== 'PENDING') assert.equal(after.items.find(i => i.id === item.id)!.status, item.status);
  const sorted = [...after.items].sort((a, b) => a.ordinal - b.ordinal), firstPending = sorted.findIndex(i => i.status === 'PENDING');
  if (firstPending >= 0) assert.ok(sorted.slice(firstPending).every(i => i.status === 'PENDING'), 'no item is finished while an earlier one is pending');
  if (after.state === 'COMPLETED' && !after.loop) assert.ok(after.items.every(i => i.status !== 'PENDING'));
  if (after.state === 'PRACTICING') assert.ok(after.items.some(i => i.status === 'PENDING'));
  // INV-16: an unreadable or ungraded answer keeps the item pending.
  if (cmd.type === 'SUBMIT_ATTEMPT' && (cmd.verdict === 'UNREADABLE' || cmd.verdict === 'NOT_GRADED')) assert.deepEqual(after.items, before.items);
}, practice);

property('lessons: graded checks stay graded; the lesson ends only by finishing (all required graded) or skipping', (before, cmd, after, legal) => {
  if (before.lesson && after.lesson === before.lesson) return;
  if (!(legal && cmd.type === 'START_LESSON'))
    for (const c of before.lesson?.checks ?? []) if (c.verdict === 'CORRECT' || c.verdict === 'INCORRECT') assert.equal(after.lesson!.checks.find(x => x.id === c.id)!.verdict, c.verdict);
  const inLesson = (s: string) => s === 'MICROLEARNING' || s === 'QUICK_CHECK';
  if (legal && inLesson(before.state) && !inLesson(after.state) && !TERMINAL.includes(after.state)) {
    assert.equal(after.state, before.loop ? 'RETRY' : 'PRACTICING');
    if (cmd.type === 'FINISH_LESSON') assert.ok(after.lesson!.checks.every(c => !c.required || c.verdict === 'CORRECT' || c.verdict === 'INCORRECT'));
    else assert.equal(cmd.type, 'SKIP_LESSON');
  }
  if (after.state === 'QUICK_CHECK') assert.ok(after.lesson!.checks.some(c => c.required && c.slide === after.lesson!.slide && c.verdict !== 'CORRECT' && c.verdict !== 'INCORRECT'));
});

property('loop bounds: at most 2 clarification rounds, 2 unsuccessful retries and 3 run generations', (_b, _c, after) => {
  const l = after.loop!;
  assert.ok(l.clarificationRounds >= 0 && l.clarificationRounds <= MAX_CLARIFICATIONS);
  assert.ok(l.unsuccessfulRetries >= 0 && l.unsuccessfulRetries <= MAX_UNSUCCESSFUL_RETRIES);
  assert.ok(!l.run || (l.run.generation >= 1 && l.run.generation <= MAX_GENERATIONS));
}, loop);

property('INV-16: only an incorrect verification consumes a retry; unreadable and insufficient results never do', (before, cmd, after, legal) => {
  const consumed = after.loop!.unsuccessfulRetries - before.loop!.unsuccessfulRetries;
  assert.ok(consumed === 0 || consumed === 1);
  if (consumed === 1) assert.ok(legal && (before.state === 'VERIFYING' || before.state === 'RETRY') && (cmd.type === 'RUN_DIAGNOSED' || inlineOf(cmd)?.type === 'RUN_DIAGNOSED'));
  if (cmd.type === 'RUN_INSUFFICIENT' || inlineOf(cmd)?.type === 'RUN_INSUFFICIENT') assert.equal(consumed, 0);
}, loop);

property('SOLUTION_REVIEWED only after the retries are exhausted or through REVIEW_SOLUTION', (before, cmd, after) => {
  if (after.outcome === 'SOLUTION_REVIEWED' && before.outcome !== 'SOLUTION_REVIEWED')
    assert.ok(cmd.type === 'REVIEW_SOLUTION' || after.loop!.unsuccessfulRetries === MAX_UNSUCCESSFUL_RETRIES);
  if (cmd.type === 'REVIEW_SOLUTION' && after.state === 'COMPLETED' && before.state !== 'COMPLETED') assert.ok(before.state === 'RETRY' || before.state === 'EVALUATION_FAILED');
  // Once revealed, the solution stays readable; it is revealed only by E-19 or E-21.
  if (before.loop!.solutionRevealed) assert.equal(after.loop!.solutionRevealed, true);
  if (after.loop!.solutionRevealed && !before.loop!.solutionRevealed) assert.ok(cmd.type === 'REVIEW_SOLUTION' || after.outcome === 'SOLUTION_REVIEWED');
}, loop);

property('05 §4.4: a self-report never yields a verdict other than NOT_GRADED', (_b, _c, after) => {
  const l = after.loop!;
  if (l.attempt?.selfReport) assert.ok(l.run!.verdict === null || l.run!.verdict === 'NOT_GRADED', `${l.run!.verdict} for ${l.attempt.selfReport}`);
}, loop);

property('runs: pending exactly while diagnosing or verifying; results are fenced by generation and status', (before, cmd, after, legal) => {
  const l = after.loop!;
  if (!TERMINAL.includes(after.state)) assert.equal(l.run?.status === 'PENDING', after.state === 'DIAGNOSING' || after.state === 'VERIFYING');
  if (after.state === 'EVALUATION_FAILED') assert.ok(l.run!.status === 'FAILED' && l.resumeState !== null);
  if (after.state === 'ABANDONED' || after.state === 'EXPIRED') assert.notEqual(l.run?.status, 'PENDING', 'leaving cancels the pending run');
  if (isRun(cmd) && legal) assert.ok(before.loop!.run!.status === 'PENDING' && before.loop!.run!.generation === (cmd as { generation: number }).generation);
  if (cmd.type === 'REQUEST_DIAGNOSIS' && legal) assert.equal(after.loop!.run!.generation, before.loop!.run!.generation + 1);
}, loop);

test('allowedActions lists exactly the commands that some argument makes legal', () => {
  const witnesses = (ctx: Context): Record<AllowedAction, Command[]> => ({
    SUBMIT_ATTEMPT: [{ type: 'SUBMIT_ATTEMPT', itemId: nextItem(ctx)?.id, verdict: 'CORRECT' }],
    ANSWER_QUICK_CHECK: (ctx.lesson?.checks ?? []).map(c => ({ type: 'ANSWER_QUICK_CHECK', checkId: c.id, verdict: 'CORRECT' })),
    ADVANCE_LESSON: Array.from({ length: ctx.lesson?.slideCount ?? 0 }, (_, slideIndex) => ({ type: 'ADVANCE_LESSON', slideIndex })),
    FINISH_LESSON: [{ type: 'FINISH_LESSON' }], SKIP_LESSON: [{ type: 'SKIP_LESSON' }], SKIP_ITEM: [{ type: 'SKIP_ITEM', itemId: nextItem(ctx)?.id ?? 'none' }],
    REQUEST_HINT: [{ type: 'REQUEST_HINT', step: 1 }], ABANDON: [{ type: 'ABANDON' }], UPDATE_CHECKPOINT: [{ type: 'UPDATE_CHECKPOINT' }],
    START_LESSON: [{ type: 'START_LESSON', lesson: lessonOf(2, [{ slide: 1, required: true }]) }], START_RETRY: [{ type: 'START_RETRY' }],
    REVIEW_SOLUTION: [{ type: 'REVIEW_SOLUTION' }], REQUEST_DIAGNOSIS: [{ type: 'REQUEST_DIAGNOSIS' }],
  });
  fc.assert(fc.property(created, fc.integer(), (start, seed) => walk(start, seed, 30, (_b, _c, after) => {
    const allowed = new Set(allowedActions(after));
    for (const [action, commands] of Object.entries(witnesses(after)) as [AllowedAction, Command[]][])
      assert.equal(commands.some(c => transition(after, c).ok), allowed.has(action), `${action} in ${after.state}`);
  })), { numRuns: 400 });
});

test('question-loop commands are never legal in a practice session', () => {
  const loopOnly: Command[] = [{ type: 'START_LESSON', lesson: lessonOf(1, []) }, { type: 'START_RETRY' }, { type: 'REVIEW_SOLUTION' }, { type: 'REQUEST_DIAGNOSIS' },
    { type: 'RUN_CORRECT', generation: 1 }, { type: 'RUN_EXHAUSTED', generation: 1 }];
  fc.assert(fc.property(practice, fc.integer(), (start, seed) => walk(start, seed, 20, (_b, _c, after) => {
    for (const cmd of loopOnly) assert.equal(transition(after, cmd).ok, false, cmd.type);
  })));
});

// Example paths through 05 §4.2, one per row group, so a failing property has a readable counterpart.
test('question loop paths (E-01–E-21)', () => {
  const start = (hintCount = 1): Context => fc.sample(loop, 1).map(c => ({ ...c, loop: { ...c.loop!, hintCount } }))[0]!;
  const run = (ctx: Context, ...cmds: Command[]) => cmds.reduce((c, cmd, i) => {
    const r = transition(c, cmd);
    assert.ok(r.ok, `step ${i + 1} ${cmd.type} refused in ${c.state}`);
    return r.next;
  }, ctx);
  const refused = (ctx: Context, cmd: Command) => assert.equal(transition(ctx, cmd).ok, false, `${cmd.type} in ${ctx.state}`);
  const lessonCmd: Command = { type: 'START_LESSON', lesson: lessonOf(2, [{ slide: 1, required: true }]) };

  // E-03 + E-08 inline: one command, one version step.
  let s = run(start(), { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_CORRECT' } });
  assert.deepEqual([s.state, s.outcome, s.version], ['COMPLETED', 'SOLVED_FIRST_TRY', 2]);
  // E-21 from COMPLETED: readable, no version step.
  const reread = run(s, { type: 'REVIEW_SOLUTION' });
  assert.deepEqual([reread.version, reread.outcome, reread.loop!.solutionRevealed], [2, 'SOLVED_FIRST_TRY', true]);
  refused(s, { type: 'ABANDON' });

  // E-03 queued → E-05 twice → E-06 after the second round.
  s = run(start(), { type: 'SUBMIT_ATTEMPT' });
  assert.deepEqual([s.state, s.loop!.run], ['DIAGNOSING', { generation: 1, status: 'PENDING', verdict: null }]);
  refused(s, { type: 'RUN_CORRECT', generation: 2 });
  s = run(s, { type: 'RUN_INSUFFICIENT', verdict: 'UNREADABLE', generation: 1 }, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_INSUFFICIENT', verdict: 'UNREADABLE' } });
  assert.deepEqual([s.state, s.loop!.clarificationRounds], ['CLARIFICATION_NEEDED', 1]);
  s = run(s, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_INSUFFICIENT', verdict: 'UNREADABLE' } });
  assert.deepEqual([s.state, s.loop!.clarificationRounds], ['DIAGNOSIS_READY', 2]);
  refused(s, { type: 'SUBMIT_ATTEMPT' });
  refused(s, { type: 'REVIEW_SOLUTION' });

  // E-11 → E-12/E-13 → E-14 → RETRY → E-16 + E-18 → E-16 + E-20 → E-16 + E-19.
  s = run(s, lessonCmd, { type: 'ADVANCE_LESSON', slideIndex: 1 }, { type: 'ANSWER_QUICK_CHECK', checkId: 'c0', verdict: 'INCORRECT' }, { type: 'FINISH_LESSON' });
  assert.equal(s.state, 'RETRY');
  s = run(s, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } });
  assert.deepEqual([s.state, s.loop!.unsuccessfulRetries], ['RETRY', 1]);
  s = run(s, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_INSUFFICIENT', verdict: 'UNREADABLE' } });
  assert.deepEqual([s.state, s.loop!.unsuccessfulRetries], ['RETRY', 1], 'INV-16: an unreadable retry is free');
  s = run(s, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } });
  assert.deepEqual([s.state, s.outcome, s.loop!.unsuccessfulRetries, s.loop!.solutionRevealed], ['COMPLETED', 'SOLUTION_REVIEWED', 2, true]);

  // E-07 → E-15 START_RETRY → E-17.
  s = run(start(), { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } }, { type: 'START_RETRY' }, { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_CORRECT' } });
  assert.deepEqual([s.state, s.outcome], ['COMPLETED', 'SOLVED_AFTER_LEARNING']);

  // Queued verification: E-18 then E-19, and E-17, as later run results.
  const retrying = run(start(), { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } }, { type: 'START_RETRY' }, { type: 'SUBMIT_ATTEMPT' });
  assert.equal(retrying.state, 'VERIFYING');
  s = run(retrying, { type: 'RUN_DIAGNOSED', generation: 1 }, { type: 'SUBMIT_ATTEMPT' }, { type: 'RUN_DIAGNOSED', generation: 1 });
  assert.deepEqual([s.state, s.outcome, s.loop!.unsuccessfulRetries], ['COMPLETED', 'SOLUTION_REVIEWED', 2]);
  s = run(retrying, { type: 'RUN_CORRECT', generation: 1 });
  assert.deepEqual([s.state, s.outcome, s.version], ['COMPLETED', 'SOLVED_AFTER_LEARNING', retrying.version + 1]);

  // E-09 → E-10 up to generation 3, then only REVIEW_SOLUTION (E-21) or ABANDON.
  s = run(start(), { type: 'SUBMIT_ATTEMPT' }, { type: 'RUN_EXHAUSTED', generation: 1 });
  assert.deepEqual([s.state, s.loop!.resumeState], ['EVALUATION_FAILED', 'DIAGNOSING']);
  refused(s, { type: 'RUN_CORRECT', generation: 1 });
  s = run(s, { type: 'REQUEST_DIAGNOSIS' }, { type: 'RUN_EXHAUSTED', generation: 2 }, { type: 'REQUEST_DIAGNOSIS' }, { type: 'RUN_EXHAUSTED', generation: 3 });
  refused(s, { type: 'REQUEST_DIAGNOSIS' });
  assert.deepEqual(allowedActions(s), ['REVIEW_SOLUTION', 'ABANDON', 'UPDATE_CHECKPOINT']);
  // A retry's exhaustion resumes into VERIFYING.
  s = run(start(), { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } }, { type: 'START_RETRY' }, { type: 'SUBMIT_ATTEMPT' }, { type: 'RUN_EXHAUSTED', generation: 1 }, { type: 'REQUEST_DIAGNOSIS' });
  assert.deepEqual([s.state, s.loop!.run!.generation], ['VERIFYING', 2]);

  // 05 §4.4: "belum tahu" goes straight to E-06; "saya tahu caranya" is asked for proof (E-05) and never graded.
  s = run(start(), { type: 'SUBMIT_ATTEMPT', selfReport: 'DONT_KNOW', inline: { type: 'RUN_INSUFFICIENT', verdict: 'NOT_GRADED' } });
  assert.equal(s.state, 'DIAGNOSIS_READY');
  s = run(start(), { type: 'SUBMIT_ATTEMPT', selfReport: 'KNOW' });
  refused(s, { type: 'RUN_CORRECT', generation: 1 });
  refused(s, { type: 'RUN_INSUFFICIENT', verdict: 'UNREADABLE', generation: 1 });
  s = run(s, { type: 'RUN_INSUFFICIENT', verdict: 'NOT_GRADED', generation: 1 });
  assert.equal(s.state, 'CLARIFICATION_NEEDED');

  // E-23 on the anchor question; E-24 cancels the pending run and fences the late result out.
  s = run(start(2), { type: 'REQUEST_HINT', step: 2 });
  assert.equal(s.version, 1);
  refused(s, { type: 'REQUEST_HINT', step: 3 });
  s = run(s, { type: 'SUBMIT_ATTEMPT' });
  refused(s, { type: 'REQUEST_HINT', step: 1 });
  s = run(s, { type: 'ABANDON' });
  assert.equal(s.loop!.run!.status, 'CANCELLED');
  refused(s, { type: 'RUN_CORRECT', generation: 1 });
  // 05 §4.5: REVIEW_SOLUTION before the retry phase; a lesson that is not a fresh assignment.
  refused(start(), { type: 'REVIEW_SOLUTION' });
  refused(run(start(), { type: 'SUBMIT_ATTEMPT', inline: { type: 'RUN_DIAGNOSED' } }), { type: 'START_LESSON', lesson: lessonOf(0, []) });
});
