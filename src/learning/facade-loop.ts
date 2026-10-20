import type { Connection, Tx } from '../db.js';
import { fail } from '../platform/errors.js';
import { currentRelease, legacyItem, mappedConcepts } from '../catalog/interface.js';
import type { StudentResponse } from '../assessment/evaluators/index.js';
import type { learningService } from './service.js';
// Legacy facade L1, L2, L4 (Slice 2 M7; 09 §6.1–§6.3), deprecated and behind FEATURE_LEGACY_FACADE. A translator with
// no state of its own over the question loop (M5): the shipped funnel (/coba) starts and polls diagnoses and asks for
// the worked solution without knowing about sessions, versions or commands.
//
// One FlowContext.sessionId and question alias map to one loop: legacy key `<sessionId>:loop:<item alias>`. A finished
// loop gives the key up when the next L1 call arrives, so "Coba lagi" starts a new loop under the same client session.
// Own questions (questionId "own:…", Tanya soal) need intake (Slice 6) and are not served. L3's funnel checks c1–c4 and
// retry_original need the funnel lesson (D3), and L6 the tutor ladder (D6): both stay closed.

export interface LegacyContext { sessionId: string; questionId: string; topicId: string | null; hintOpened: boolean; questionText?: string; coreIds?: string[] }
export interface LegacyDiagnosisRequest extends LegacyContext { responseMode: 'know' | 'blank' | null; rawText: string }
type Run = Awaited<ReturnType<ReturnType<typeof learningService>['diagnosisRun']>>;
type Learning = ReturnType<typeof learningService>;

const NOT_SEEN = 'Belum kelihatan dari soal ini.';
const SHOWN = 'Bagian ini terlihat tepat dari jawabanmu.';

/** 09 §6.3: a canonical run in the shape the shipped `isRun` validates. Only frozen MAP aliases appear (rule 8). */
export async function legacyRun(db: Connection, learning: Learning, learnerId: string, run: Run) {
  const status = run.status === 'QUEUED' ? 'pending' : run.status === 'RUNNING' ? 'running'
    : run.status === 'COMPLETED' ? (run.evidenceStatus === 'SUPPORTED' ? 'completed' : 'insufficient_evidence') : 'failed';
  const base = { diagnosisRunId: run.id, status, ...(run.clarificationPrompt ? { clarification: run.clarificationPrompt } : {}) };
  if (status !== 'completed') return base;
  // Items follow the curriculum order of the anchor's concepts (tri-c, tri-d, tri-f), not the storage order.
  const revision = (await learning.attempt(db, learnerId, run.attemptId)).questionRevisionId;
  const order = new Map((await mappedConcepts(db, revision)).map((c, i) => [c.id, i]));
  const evidence = [...run.evidence].sort((a, b) => (order.get(a.conceptId) ?? 99) - (order.get(b.conceptId) ?? 99));
  const items = evidence.filter(e => e.legacyMapId).map(e => ({ id: e.legacyMapId!,
    state: e.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : e.classification === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest',
    reason: e.rationale ?? (e.classification === 'UNDERSTANDING_DEMONSTRATED' ? SHOWN : NOT_SEEN) }));
  // A completed run must carry items; without an aliased concept it is reported as insufficient evidence (§6.3).
  if (!items.length) return { diagnosisRunId: run.id, status: 'insufficient_evidence', clarification: run.clarificationPrompt ?? 'Tulis rumus atau langkah yang kamu pakai.' };
  const kuat = run.verdict === 'CORRECT';
  const recommendations = run.recommendations as { conceptId: string; conceptTitle: string; legacyMapId?: string; lessonRouteSlug?: string; reason: string; keyFormula?: string }[];
  const routeOf = (conceptId: string) => recommendations.find(r => r.conceptId === conceptId)?.lessonRouteSlug ?? '';
  const miss = evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED');
  const shown = evidence.find(e => e.classification === 'UNDERSTANDING_DEMONSTRATED');
  const first = recommendations[0];
  // gap: the first misconception's concept; a supported wrong answer without one points at the first recommendation.
  const gap = kuat ? null : miss
    ? { label: 'Core belum kuat', name: miss.conceptTitle, reason: miss.rationale ?? '', coreId: routeOf(miss.conceptId), mapId: miss.legacyMapId ?? '' }
    : { label: 'Core belum kuat', name: first?.conceptTitle ?? '', reason: first?.reason ?? '', coreId: first?.lessonRouteSlug ?? '', mapId: first?.legacyMapId ?? '' };
  // next: the first recommendation; a correct run has none, so it names the concept it just showed (the client's map
  // computes what follows from there, as analysis.ts does).
  const next = first ? { core: first.conceptTitle, reason: first.reason, formula: first.keyFormula ?? '', coreId: first.lessonRouteSlug ?? '', mapId: first.legacyMapId ?? '' }
    : { core: shown?.conceptTitle ?? '', reason: 'Bagian ini sudah terlihat dari jawabanmu.', formula: '', coreId: '', mapId: shown?.legacyMapId ?? '' };
  return { ...base, assessment: { tone: kuat ? 'kuat' : 'gap', title: run.headline ?? '', gap, okName: kuat ? shown?.conceptTitle ?? null : null, next }, items };
}

export function legacyLoopFacade(learning: Learning) {
  /** The loop for this client session and question, created on first use (or after the previous one ended). */
  const loopFor = async (tx: Tx, learnerId: string, context: LegacyContext, create: boolean) => {
    if (context.questionId.startsWith('own:') || context.questionText !== undefined || context.coreIds !== undefined) fail(403, 'FEATURE_DISABLED'); // Slice 6 intake
    const release = await currentRelease(tx);
    if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
    const item = await legacyItem(tx, release, context.questionId);
    if (!item) return fail(404, 'NOT_FOUND'); // only aliases of the frozen legacy set resolve (rule 8)
    const legacyId = `${context.sessionId}:loop:${context.questionId}`;
    if (!create) return { legacyId, l: await learning.legacyLoop(tx, learnerId, legacyId) };
    let l = await learning.legacySession(tx, learnerId, legacyId);
    if (!l) {
      await learning.create(tx, learnerId, { kind: 'QUESTION_LOOP', origin: 'FUNNEL', questionId: item.questionId }, legacyId);
      l = (await learning.legacySession(tx, learnerId, legacyId))!;
    }
    return { legacyId, l };
  };

  return {
    /** The version of the context's loop (0 without one): part of the derived idempotency key (09 §6.1 rule 5). */
    async version(tx: Tx, learnerId: string, context: Pick<LegacyContext, 'sessionId' | 'questionId'>) {
      return (await learning.legacyLoop(tx, learnerId, `${context.sessionId}:loop:${context.questionId}`))?.ctx.version ?? 0;
    },

    /**
     * L1. `know`/`blank` without text are self-reports; any written text is working. Rule 6: a loop past the question
     * (DIAGNOSIS_READY, a lesson, RETRY: the "Coba soal tadi lagi" button) moves to RETRY with the implied commands and
     * submits a RETRY attempt. A loop that is still waiting returns its pending run instead of a second attempt.
     */
    async diagnose(tx: Tx, learnerId: string, body: LegacyDiagnosisRequest) {
      const text = (body.rawText ?? '').trim();
      const response: StudentResponse = text ? { schemaVersion: 1, responseType: 'TEXT', text: body.rawText, inputMode: 'TYPED' }
        : body.responseMode === 'know' ? { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: 'KNOW', inputMode: 'TYPED' }
        : body.responseMode === 'blank' ? { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: 'DONT_KNOW', inputMode: 'TYPED' }
        : fail(400, 'VALIDATION_FAILED');
      const { l } = await loopFor(tx, learnerId, body, true);
      const sessionId = l!.row.id;
      if (body.hintOpened === true) await learning.clientHint(tx, learnerId, sessionId);
      let state = l!.ctx.state, version = l!.ctx.version;
      const act = async (type: string) => { const s = (await learning.action(tx, learnerId, sessionId, { type, expectedStateVersion: version })).body.session; state = s.state; version = s.stateVersion; };
      if (state === 'DIAGNOSING' || state === 'VERIFYING' || state === 'EVALUATION_FAILED') {
        // Waiting or failed: the run that exists is the answer (A01: one shared run); nothing new is submitted.
        const runId = (await learning.get(tx, learnerId, sessionId)).activeDiagnosisRunId!;
        return learning.diagnosisRun(tx, learnerId, runId);
      }
      if (state === 'MICROLEARNING' || state === 'QUICK_CHECK') {
        const lesson = l!.ctx.lesson!;
        await act(state === 'MICROLEARNING' && lesson.checks.every(c => !c.required || c.verdict === 'CORRECT' || c.verdict === 'INCORRECT') ? 'FINISH_LESSON' : 'SKIP_LESSON');
      }
      if (state === 'DIAGNOSIS_READY') await act('START_RETRY');
      return (await learning.submitAttempt(tx, learnerId, sessionId, { expectedStateVersion: version, response })).body.diagnosisRun as Run;
    },

    /** L4: the worked solution through REVIEW_SOLUTION (E-21), allowed in RETRY, EVALUATION_FAILED and COMPLETED. */
    async solution(tx: Tx, learnerId: string, context: LegacyContext) {
      const { l } = await loopFor(tx, learnerId, context, false);
      if (!l) return fail(404, 'NOT_FOUND');
      const { solution } = (await learning.reviewSolution(tx, learnerId, l.row.id, { expectedStateVersion: l.ctx.version })).body;
      return { steps: solution.steps, after: solution.after };
    },
  };
}
