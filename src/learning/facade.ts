import type { Tx } from '../db.js';
import { ApiError, fail } from '../platform/errors.js';
import { currentRelease, legacyItem } from '../catalog/interface.js';
import { feedbackFor } from '../assessment/grading.js';
import type { StudentResponse } from '../assessment/evaluators/index.js';
import type { learningService } from './service.js';
// Legacy facade L3: POST /v1/learning/answers/check (09 §6.1–6.2), deprecated and behind FEATURE_LEGACY_FACADE.
// A translator with no state of its own: each call becomes canonical commands on the M6 engine, in one
// transaction, so device-era screens get server grading without knowing about sessions or versions.
//
// One FlowContext.sessionId spans several screens of the shipped app, so facade sessions are keyed per context:
//   <sessionId>:lesson:<lesson code>  CoreView ids ("core:<route>:c<i>" checks, "core:<route>:q<i>" practice)
//   <sessionId>:practice:<set code>   everything else: funnel practice p1–p3, bank and combined items
// The funnel's own checks (c1–c4) belong to the question-loop lesson and wait for Slice 2.

export interface LegacyCheck { sessionId: string; kind: 'check' | 'practice' | 'retry_original'; itemId: string; answer: string | number }
export interface LegacyCheckResult { correct: boolean | null; feedback?: string; correctOptionIndex?: number; unreadable?: true }

export function legacyFacade(learning: ReturnType<typeof learningService>) {
  return async function check(tx: Tx, learnerId: string, body: LegacyCheck): Promise<LegacyCheckResult> {
    if (body.kind === 'retry_original') fail(403, 'FEATURE_DISABLED'); // the question loop is Slice 2
    const release = await currentRelease(tx);
    if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
    const item = await legacyItem(tx, release, body.itemId);
    if (!item) return fail(404, 'NOT_FOUND'); // only aliases of the frozen legacy set resolve (rule 8)

    // Where the shipped screen asked: CoreView's ids are lesson context; every other id is set practice.
    const fromLesson = body.itemId.startsWith('core:');
    const lesson = fromLesson ? item.placements.check ?? item.placements.lessonPractice : undefined;
    const set = fromLesson ? undefined : item.placements.set;
    if (fromLesson ? !lesson?.practiceSet : !set) fail(409, 'CONTENT_UNAVAILABLE');
    const legacyId = lesson ? `${body.sessionId}:lesson:${lesson.lessonCode}` : `${body.sessionId}:practice:${set!.setCode}`;

    // Find or create the canonical session for this client session and context (created on first use).
    let l = await learning.legacySession(tx, learnerId, legacyId);
    if (!l) {
      await learning.create(tx, learnerId, lesson
        ? { kind: 'PRACTICE', origin: 'CONCEPT_LESSON', withLesson: true, spec: { setCode: lesson.practiceSet! } }
        : { kind: 'PRACTICE', origin: set!.setCode === 'MAT.S.COMBINED' ? 'COMBINED_SET' : 'BANK', withLesson: false, spec: { setCode: set!.setCode } }, legacyId);
      l = (await learning.legacySession(tx, learnerId, legacyId))!;
    }
    const sessionId = l.row.id;
    let version = l.ctx.version;
    const act = async (command: object) => { version = (await learning.action(tx, learnerId, sessionId, { ...command, expectedStateVersion: version } as never)).body.session.stateVersion; };

    // Option answers arrive as an index, mapped to option ids through the manifest's legacyOptionOrder.
    // An index outside the options is sent as an unknown option, which grades as unreadable, never wrong.
    const response = (typeof body.answer === 'number' && item.legacyOptionOrder
      ? { responseType: 'OPTION', optionId: item.legacyOptionOrder[body.answer] ?? `index-${body.answer}` }
      : { responseType: 'TEXT', text: String(body.answer) }) as StudentResponse;

    const asCheck = fromLesson && item.placements.check && item.placements.check.lessonCode === lesson!.lessonCode;
    let result: { attempt: { verdict: string; questionRevisionId: string }; diagnosisRun: { revealedAnswer?: { optionId?: string } } };
    if (asCheck) {
      // Implied lesson commands (rule 6): advance to the check's slide (E-12 makes its required checks due,
      // also when the learner is already on it), then answer it.
      const target = item.placements.check!;
      if (l.ctx.state === 'MICROLEARNING') await act({ type: 'ADVANCE_LESSON', slideIndex: target.slide });
      result = (await learning.answerQuickCheck(tx, learnerId, sessionId, { expectedStateVersion: version, microAssessmentId: target.microAssessmentId, response })).body;
    } else {
      // Practice follows the lesson: finish it when every required check is graded, otherwise skip it.
      if (l.ctx.state === 'MICROLEARNING' || l.ctx.state === 'QUICK_CHECK') {
        const done = l.ctx.state === 'MICROLEARNING' && l.ctx.lesson!.checks.every(c => !c.required || c.verdict === 'CORRECT' || c.verdict === 'INCORRECT');
        await act({ type: done ? 'FINISH_LESSON' : 'SKIP_LESSON' });
      }
      // Items are answered in the server's order; an out-of-order item is refused (409), never silently skipped to.
      const sessionItem = l.items.find(i => i.question_id === item.questionId);
      if (!sessionItem) return fail(409, 'CONTENT_UNAVAILABLE');
      result = (await learning.submitAttempt(tx, learnerId, sessionId, { expectedStateVersion: version, sessionItemId: sessionItem.id, response })).body;
    }

    const verdict = result.attempt.verdict;
    if (verdict !== 'CORRECT' && verdict !== 'INCORRECT') return { correct: null, unreadable: true };
    const feedback = await feedbackFor(tx, result.attempt.questionRevisionId, verdict);
    const revealed = result.diagnosisRun.revealedAnswer?.optionId, index = revealed && item.legacyOptionOrder ? item.legacyOptionOrder.indexOf(revealed) : -1;
    return { correct: verdict === 'CORRECT', ...(feedback ? { feedback } : {}), ...(index >= 0 ? { correctOptionIndex: index } : {}) };
  };
}

/** Rule 4 (CONSENT_FIRST): a learner without consent is treated like a guest, and guests are not served. */
export const consentFirst = (error: unknown) => error instanceof ApiError && error.code === 'CONSENT_REQUIRED' ? new ApiError(403, 'FEATURE_DISABLED') : error;
