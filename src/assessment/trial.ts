import type { GradingSource } from '../catalog/grading-source.js';
import type { Connection } from '../db.js';
import { currentRelease, legacyItem, loopAnchor, mappedConcepts, lessonFor } from '../catalog/interface.js';
import { gradingSource } from '../catalog/grading-source.js';
import { evaluate, type StudentResponse } from './evaluators/index.js';
import { tutorStep } from './tutor-ladder.js';
import { fail } from '../platform/errors.js';
import { hash, stable, uuid } from '../platform/crypto.js';

// Trial assessment uses the SAME published content/evaluator as account learning.
// It never creates an account, consent, mastery or permanent response record.
export interface TrialItem {
  revisionId: string; source: GradingSource; optionOrder: string[] | null;
  concepts: { code: string; title: string; legacyMapId: string | null; route: string }[];
}
export async function loadTrialItem(db: Connection, alias: string, revisionId?: string): Promise<TrialItem> {
  const release = await currentRelease(db);
  if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
  const item = await legacyItem(db, release, alias);
  if (!item) return fail(404, 'NOT_FOUND');
  const anchor = await loopAnchor(db, item.questionId);
  if (!anchor) return fail(409, 'CONTENT_UNAVAILABLE');
  // A running trial must not silently switch rubric after a catalog release.
  if (revisionId && anchor.revisionId !== revisionId) return fail(409, 'CONTENT_UNAVAILABLE');
  const source = await gradingSource(db, anchor.revisionId);
  const mapped = await mappedConcepts(db, anchor.revisionId);
  const concepts = await Promise.all(mapped.map(async c => {
    const code = source.rubric.lessonFor?.[c.code];
    const lesson = (code ? await lessonFor(db, release, { lessonCode: code, conceptId: c.id }) : null)
      ?? await lessonFor(db, release, { conceptId: c.id });
    return { code: c.code, title: c.title, legacyMapId: c.legacyMapId, route: lesson?.routeSlug ?? '' };
  }));
  return { revisionId: anchor.revisionId, source, concepts, optionOrder: item.legacyOptionOrder };
}
interface TrialContext {
  expires: number; pins: Map<string, string>; runs: Map<string, { id: string; output: any }>;
  hints: number; openedHint:boolean; solutionSeen:boolean; latestRun?: string;
}
export function trialAssessment(load: (alias: string, revision?: string) => Promise<TrialItem>,
  guide: (revision: string, text: string, used: number) => ReturnType<typeof tutorStep>, now = Date.now, proof?: (input: {owner:string;session:string;questionId:string;revisionId:string;text:string;hintUsed:boolean;solutionSeen:boolean}) => string | undefined) {
  const contexts = new Map<string, TrialContext>();
  const ttl = 2 * 60 * 60 * 1000;
  function context(owner: string, session: string) {
    for (const [key, value] of contexts) if (value.expires <= now()) contexts.delete(key);
    const key = owner + ':' + session;
    let c = contexts.get(key);
    if (!c) {
      if (contexts.size >= 2000) return fail(503, 'DEPENDENCY_UNAVAILABLE');
      c = { expires: now() + ttl, pins: new Map(), runs: new Map(), hints: 0, openedHint:false, solutionSeen:false };
      contexts.set(key, c);
    }
    return c;
  }
  async function item(c: TrialContext, alias: string) {
    const value = await load(alias, c.pins.get(alias));
    c.pins.set(alias, value.revisionId);
    return value;
  }
  return {
    async diagnose(owner: string, body: { sessionId: string; questionId: string; rawText: string; responseMode: 'know' | 'blank' | null; hintOpened?:boolean }) {
      const c = context(owner, body.sessionId);
      if(body.hintOpened)c.openedHint=true;
      const i = await item(c, body.questionId);
      const response: StudentResponse = body.rawText.trim()
        ? { schemaVersion: 1, responseType: 'TEXT', text: body.rawText, inputMode: 'TYPED' }
        : body.responseMode ? { schemaVersion: 1, responseType: 'SELF_REPORT', selfReport: body.responseMode === 'know' ? 'KNOW' : 'DONT_KNOW', inputMode: 'TYPED' }
        : fail(400, 'VALIDATION_FAILED');
      const fingerprint = hash(stable({ revision: i.revisionId, response })).toString('hex');
      const existing = c.runs.get(fingerprint);
      if (existing) return existing.output;
      const result = evaluate({ ...i.source, response });
      const id = uuid();
      const demonstrated = result.evidence.find(e => e.classification === 'UNDERSTANDING_DEMONSTRATED');
      const misconception = result.evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED');
      const supported = !!(demonstrated || misconception);
      let output: any = { diagnosisRunId: id, status: 'insufficient_evidence',
        clarification: response.responseType === 'SELF_REPORT' ? 'Tulis langkah yang kamu tahu, atau pelajari inti soalnya dulu.' : 'Tambahkan rumus atau langkahmu supaya bagian yang perlu diperkuat terlihat.' };
      if (supported) {
        const correct = result.verdict === 'CORRECT';
        const focus = i.concepts.find(x => x.code === (misconception?.conceptCode ?? demonstrated?.conceptCode))!;
        if (!focus) return fail(409, 'CONTENT_UNAVAILABLE');
        const authored = i.source.rubric.recommend?.find(x => x.misconceptionCode === misconception?.misconceptionCode);
        const reason = misconception?.rationale ?? 'Bagian ini terlihat tepat dari jawabanmu.';
        const items = i.concepts.filter(x => x.legacyMapId).map(x => {
          const evidence = result.evidence.find(e => e.conceptCode === x.code);
          return { id: x.legacyMapId!, state: evidence?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : evidence?.classification === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest',
            reason: evidence?.rationale ?? (evidence?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'Bagian ini terlihat tepat dari jawabanmu.' : 'Belum kelihatan dari soal ini.') };
        });
        if (items.length) output = { diagnosisRunId: id, status: 'completed', items, assessment: {
          tone: correct ? 'kuat' : 'gap', title: correct ? 'Mantap. Caramu sudah tepat.' : 'Ada bagian yang perlu diperkuat.',
          okName: correct ? focus.title : null,
          gap: correct ? null : { label: 'Inti yang perlu diperkuat', name: focus.title, reason, coreId: focus.route, mapId: focus.legacyMapId ?? '' },
          next: { core: focus.title, reason, formula: authored?.keyFormula ?? '', coreId: focus.route, mapId: focus.legacyMapId ?? '' }
        } };
      }
      if(result.verdict==='CORRECT' && response.responseType==='TEXT') output.claimToken=proof?.({owner,session:body.sessionId,questionId:body.questionId,revisionId:i.revisionId,text:response.text!,hintUsed:c.hints>0||c.openedHint,solutionSeen:c.solutionSeen});
      // Only bounded evaluation results and a hash are held in memory, not raw answers.
      if (c.runs.size >= 32) c.runs.delete(c.runs.keys().next().value!);
      c.runs.set(fingerprint, { id, output }); c.latestRun = id;
      return output;
    },
    run(owner: string, id: string) {
      for (const [key, c] of contexts) if (key.startsWith(owner + ':') && c.expires > now())
        for (const run of c.runs.values()) if (run.id === id) return run.output;
      return fail(404, 'NOT_FOUND');
    },
    async check(owner: string, body: { sessionId: string; itemId: string; answer: string | number }) {
      const c = context(owner, body.sessionId), i = await item(c, body.itemId);
      const response: StudentResponse = typeof body.answer === 'number'
        ? { schemaVersion: 1, responseType: 'OPTION', optionId: i.optionOrder?.[body.answer] ?? '', inputMode: 'TYPED' }
        : { schemaVersion: 1, responseType: 'TEXT', text: body.answer, inputMode: 'TYPED' };
      const r = evaluate({ ...i.source, response });
      const correct = r.verdict === 'CORRECT' ? true : r.verdict === 'INCORRECT' ? false : null;
      const option = r.revealedAnswer && 'optionId' in r.revealedAnswer ? r.revealedAnswer.optionId : undefined;
      const index = option ? i.optionOrder?.indexOf(option) : undefined;
      const items = i.concepts.filter(x => x.legacyMapId).map(x => {
        const e = r.evidence.find(e => e.conceptCode === x.code);
        return {id:x.legacyMapId!, state:e?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : e?.classification === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest',
          reason:e?.rationale ?? (e?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'Bagian ini terlihat tepat dari jawabanmu.' : 'Belum cukup bukti dari jawaban ini.')};
      });
      const claimToken = correct===true && response.responseType==='TEXT' ? proof?.({owner,session:body.sessionId,questionId:body.itemId,revisionId:i.revisionId,text:response.text!,hintUsed:c.hints>0||c.openedHint,solutionSeen:c.solutionSeen}) : undefined;
      return { correct, ...(claimToken ? {claimToken} : {}), ...(items.length ? {items} : {}), ...(index !== undefined && index >= 0 ? { correctOptionIndex: index } : {}), ...(correct === null ? { unreadable: true } : {}),
        ...(correct !== null && i.source.rubric.feedback ? { feedback: correct ? i.source.rubric.feedback.correct : i.source.rubric.feedback.incorrect } : {}) };
    },
    async solution(owner: string, body: { sessionId: string; questionId: string }) {
      const c=context(owner,body.sessionId); c.solutionSeen=true;
      const i = await item(c, body.questionId);
      return i.source.rubric.workedSolution ?? fail(409, 'CONTENT_UNAVAILABLE');
    },
    async tutor(owner: string, body: { sessionId: string; questionId: string; messages: { from: string; text: string }[] }) {
      const c = context(owner, body.sessionId), i = await item(c, body.questionId);
      const last = body.messages.at(-1);
      if (last?.from !== 'me' || !last.text.trim()) return fail(400, 'VALIDATION_FAILED');
      const step = await guide(i.revisionId, last.text, c.hints);
      if (!step) return fail(409, 'CONTENT_UNAVAILABLE');
      c.hints = step.hintsUsed;
      if (step.full) {
        c.solutionSeen=true;
        const solution = i.source.rubric.workedSolution ?? fail(409, 'CONTENT_UNAVAILABLE');
        return { text: solution.steps.map(x => x.title + ': ' + x.body).join('\n'), quick: [], hintsUsed: c.hints };
      }
      return { text: step.text, quick: step.quick, hintsUsed: c.hints };
    },
    close() { contexts.clear(); }
  };
}
