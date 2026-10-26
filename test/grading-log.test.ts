import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logGrading } from '../src/assessment/diagnosis.js';

// The dev grading log quotes parts of the learner's answer, so it may print only with GRADING_LOG=true in development.
test('grading log: one line in local development only, never in test or with the flag off', () => {
  const printed: string[] = [];
  const original = console.log, env = { flag: process.env.GRADING_LOG, mode: process.env.NODE_ENV };
  console.log = (...args: unknown[]) => { printed.push(args.join(' ')); };
  const evidence = [
    { conceptCode: 'MAT.TRI.DEFINISI_SIN_COS_TAN', classification: 'MISCONCEPTION_EVIDENCED' as const, misconceptionCode: 'MEMAKAI_SIN', refs: [{ kind: 'SPAN' as const, start: 0, end: 6, quote: 'sin 30' }], uncertaintyReasons: [] },
    { conceptCode: 'MAT.TRI.SUDUT_ISTIMEWA', classification: 'NOT_ASSESSED' as const, refs: [], uncertaintyReasons: [] },
  ];
  const run = () => logGrading('0190f000-0000-7000-8000-00000000abcd', 'DETERMINISTIC', 'tower-v1', 'INCORRECT', true, evidence);
  try {
    for (const [flag, mode] of [['true', 'test'], [undefined, 'development'], ['false', 'development']] as const) {
      if (flag === undefined) delete process.env.GRADING_LOG; else process.env.GRADING_LOG = flag;
      process.env.NODE_ENV = mode; run();
    }
    assert.deepEqual(printed, [], 'silent in test, and in development without the flag');
    process.env.GRADING_LOG = 'true'; process.env.NODE_ENV = 'development'; run();
    assert.deepEqual(printed, ['grade run=0000abcd engine=DETERMINISTIC rubric=tower-v1 verdict=INCORRECT evidence=SUPPORTED | DEFINISI_SIN_COS_TAN=gap(MEMAKAI_SIN) "sin 30" | SUDUT_ISTIMEWA=not-assessed']);
  } finally {
    console.log = original;
    if (env.flag === undefined) delete process.env.GRADING_LOG; else process.env.GRADING_LOG = env.flag;
    if (env.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env.mode;
  }
});
