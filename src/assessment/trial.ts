import type { TrialAi } from './trial-ai.js';
import type { GradingSource } from '../catalog/grading-source.js';
import type { Connection } from '../db.js';
import { currentRelease, legacyItem, loopAnchor, mappedConcepts, lessonFor } from '../catalog/interface.js';
import { gradingSource } from '../catalog/grading-source.js';
import { evaluate, type Evaluation, type StudentResponse } from './evaluators/index.js';
import { parseAnswerValue, unitKindOf, withinTolerance } from './evaluators/numeric-parse.js';
import { fail } from '../platform/errors.js';
import { hash, stable, uuid } from '../platform/crypto.js';

// Public trial uses published content with an injected AI engine; no authored-response fallback.
// It never creates an account, consent, mastery or permanent response record.
export interface TrialItem {
  revisionId: string; source: GradingSource; optionOrder: string[] | null;
  concepts: { code: string; title: string; legacyMapId: string | null; route: string }[];
}
export async function loadTrialItem(db: Connection, alias: string, revisionId?: string): Promise<TrialItem> {
  const release = await currentRelease(db);
  if (!release) return fail(409, 'CONTENT_UNAVAILABLE');
  // alias lama (soal /coba, cek materi) atau ID soal katalog (soal latihan akun: banyak soal pilot tanpa alias ITEM)
  const item = await legacyItem(db, release, alias)
    ?? (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alias) ? { questionId: alias, legacyOptionOrder: null } : null);
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
/** For a gap only: the quoted part of the learner's own answer (an evidence span), so the client can highlight it. */
function gapQuote(e: Evaluation['evidence'][number] | undefined) {
  if (e?.classification !== 'MISCONCEPTION_EVIDENCED') return undefined;
  const span = e.refs.find((r): r is Extract<typeof r, { kind: 'SPAN' }> => r.kind === 'SPAN');
  const quote = span?.quote.trim();
  return quote ? quote.slice(0, 200) : undefined;
}
interface TrialContext {
  expires: number; pins: Map<string, string>; runs: Map<string, { id: string; output: any }>;
  hints: number; guideDone?: string[]; answerDone?: string[]; guideStreak?: { core: string | null; correct: number }; openedHint:boolean; solutionSeen:boolean; latestRun?: string; answer?:string; pending:Map<string,Promise<any>>;
  /** pertanyaan mini per inti + jawaban siswa: dinilai terhadap pertanyaan yang dibuat server, bukan kiriman browser */
  mini?: Map<string,{question:string;hint:string;key?:string}>;
}
/*
 * Penilaian trial.
 * - Pilihan ganda: dinilai dengan kuncinya (deterministik, tanpa AI).
 * - Jawaban tulisan dengan kunci angka (mis. soal menara, 34,64 m): angka HASIL AKHIR siswa (bagian terakhir sesudah "="
 *   di baris terakhir) dihitung dengan pembaca angka katalog, lalu dibandingkan dengan kunci + toleransinya. Angka itu
 *   yang memutuskan benar/salah, bukan AI dan bukan pola langkah: "x = 20*1/akar 3" (11,5) pernah lolos sebagai benar
 *   karena memuat 1/√3, dan "20/1/√3 = 20√3" pernah disalahkan AI.
 * - Hasil akhir tidak terbaca (masih ada x, belum dihitung, kalimat): AI yang menilai.
 */
/** values: bacaan angka hasil akhir; selain bacaan baku, "a/b/c" juga dibaca a/(b/c) (maksud "20/1/√3" = 20 dibagi 1/√3) */
type FinalValue = { value: number; values: number[]; quote: string };
const KEEP_WORDS = new Set(['akar', 'sqrt', 'meter', 'metre', 'derajat', 'detik', 'sekon', 'gram', 'menit']);
export function finalValue(text: string, kind: ReturnType<typeof unitKindOf>): FinalValue | null {
  const last = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).at(-1);
  if (!last || !last.includes('=')) return null;
  for (const piece of last.split('=').at(-1)!.split('≈')) {
    const cleaned = piece.replace(/[a-zA-Z]{4,}/g, w => (KEEP_WORDS.has(w.toLowerCase()) ? w : ' ')).replace(/[,;.]\s*$/, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const v = parseAnswerValue(cleaned, kind);
    if (v.kind !== 'value') continue;
    const values = [v.value];
    // pembagian bertingkat tanpa kurung: siswa yang menulis "20/1/√3" bermaksud 20 / (1/√3)
    const nested = cleaned.match(/^(.+?)\/(.+)\/(.+)$/);
    if (nested && !/[()]/.test(cleaned)) {
      const alt = parseAnswerValue(`${nested[1]}/(${nested[2]}/${nested[3]})`, kind);
      if (alt.kind === 'value' && alt.value !== v.value) values.push(alt.value);
    }
    return { value: v.value, values, quote: piece.trim() };
  }
  return null;
}
export async function gradeTrial(ai: TrialAi, i: TrialItem, response: StudentResponse, retry?: { correction: number; previous: string }): Promise<Evaluation> {
  // soal milik siswa (ai-assisted-v1) tidak punya penilai deterministik: hanya AI yang menilai.
  // (Tanpa penjaga ini, setiap diagnosis /tanya gagal "No deterministic evaluator".)
  let fixed: Evaluation | null = null;
  try { fixed = evaluate({ ...i.source, response }); } catch { fixed = null; }
  if (response.responseType === 'OPTION' && fixed) return fixed;
  const judged = await ai.evaluate(i, response, retry);
  const key = i.source.rubric.answer;
  if (response.responseType !== 'TEXT' || typeof key?.value !== 'number') return judged;
  const text = response.text ?? '';
  const got = finalValue(text, unitKindOf(key.unit));
  if (!got) return judged;
  const right = got.values.some(value => withinTolerance(value, key.value!, key.tolerance?.relative, key.tolerance?.floor));
  console.log(JSON.stringify({ event: 'grade_final_value', hasil: right ? 'benar' : 'salah', bacaan: got.values.length, ai: judged.verdict }));
  if (right) {
    if (judged.verdict === 'CORRECT') return judged;
    if (fixed?.verdict === 'CORRECT') return fixed;
    // benar menurut angka: tanda salah dari AI tidak berlaku lagi
    return { ...judged, verdict: 'CORRECT', reason: null, misconceptionCode: null, clarification: undefined,
      evidence: judged.evidence.map(e => e.classification === 'MISCONCEPTION_EVIDENCED' ? { ...e, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'] } : e) } as Evaluation;
  }
  if (judged.verdict === 'INCORRECT' && judged.evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED')) return judged;
  // salah menurut angka, padahal AI tidak menemukan yang salah: hasil akhirnya yang ditandai, pada inti langkah "hitung" terakhir
  const path = i.source.rubric.solutionPaths?.[0];
  const concept = path?.steps.at(-1)?.concepts[0]?.code ?? i.concepts.at(-1)?.code;
  const start = text.lastIndexOf(got.quote);
  const evidence = judged.evidence.filter(e => e.conceptCode !== concept);
  if (concept) evidence.push({ conceptCode: concept, classification: 'MISCONCEPTION_EVIDENCED', rationale: 'Langkahmu sudah jalan, tapi hasil akhirnya belum sama dengan yang dicari. Hitung lagi bagian yang disorot, ya.',
    refs: start >= 0 ? [{ kind: 'SPAN', start, end: start + got.quote.length, quote: got.quote }] : [], uncertaintyReasons: [] });
  return { ...judged, verdict: 'INCORRECT', reason: null, clarification: undefined, evidence } as Evaluation;
}
export function trialAssessment(load: (alias: string, revision?: string) => Promise<TrialItem>,
  ai: TrialAi, now = Date.now, proof?: (input: {owner:string;session:string;questionId:string;revisionId:string;text:string;hintUsed:boolean;solutionSeen:boolean}) => string | undefined) {
  const contexts = new Map<string, TrialContext>();
  const ttl = 2 * 60 * 60 * 1000;
  function context(owner: string, session: string) {
    for (const [key, value] of contexts) if (value.expires <= now()) contexts.delete(key);
    const key = owner + ':' + session;
    let c = contexts.get(key);
    if (!c) {
      if (contexts.size >= 2000) return fail(503, 'DEPENDENCY_UNAVAILABLE');
      c = { expires: now() + ttl, pins: new Map(), runs: new Map(), pending:new Map(), hints: 0, openedHint:false, solutionSeen:false };
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
    async diagnose(owner: string, body: { sessionId: string; questionId: string; rawText: string; responseMode: 'know' | 'blank' | null; hintOpened?:boolean;
      /** koreksi soal yang sama (soal milik siswa): penilai diberi tahu koreksi ke berapa dan jawaban sebelumnya */ retry?: { correction: number; previous: string } }) {
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
      const pending=c.pending.get(fingerprint);
      if(pending)return pending;
      const work=(async()=>{
      const result = await gradeTrial(ai, i, response, body.retry);
      c.answer = response.text?.slice(0,1000) ?? '';
      const id = uuid();
      const demonstrated = result.evidence.find(e => e.classification === 'UNDERSTANDING_DEMONSTRATED');
      const misconception = result.evidence.find(e => e.classification === 'MISCONCEPTION_EVIDENCED');
      const supported = result.verdict === 'CORRECT' ? !!demonstrated : result.verdict === 'INCORRECT' && !!misconception;
      let output: any = { diagnosisRunId: id, status: 'insufficient_evidence',
        clarification: result.clarification ?? (response.responseType === 'SELF_REPORT' ? 'Tulis langkah yang kamu tahu, atau pelajari inti soalnya dulu.' : 'Tambahkan rumus atau langkahmu supaya bagian yang perlu diperkuat terlihat.') };
      if (supported) {
        const correct = result.verdict === 'CORRECT';
        const focus = i.concepts.find(x => x.code === (misconception?.conceptCode ?? demonstrated?.conceptCode))!;
        if (!focus) return fail(409, 'CONTENT_UNAVAILABLE');
        const authored = i.source.rubric.recommend?.find(x => x.misconceptionCode === misconception?.misconceptionCode);
        const reason = misconception?.rationale ?? 'Bagian ini terlihat tepat dari jawabanmu.';
        const items = i.concepts.filter(x => x.legacyMapId).map(x => {
          const evidence = result.evidence.find(e => e.conceptCode === x.code);
          const quote = gapQuote(evidence);
          return { id: x.legacyMapId!, state: evidence?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : evidence?.classification === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest',
            reason: evidence?.rationale ?? (evidence?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'Bagian ini terlihat tepat dari jawabanmu.' : 'Belum kelihatan dari soal ini.'), ...(quote ? { quote } : {}) };
        });
        if (items.length) output = { diagnosisRunId: id, status: 'completed', items, assessment: {
          tone: correct ? 'kuat' : 'gap', title: correct ? 'Mantap. Caramu sudah tepat.' : 'Ada bagian yang perlu diperkuat.',
          okName: correct ? focus.title : null,
          gap: correct ? null : { label: 'Inti yang perlu diperkuat', name: focus.title, reason, coreId: focus.route, mapId: focus.legacyMapId ?? '' },
          next: { core: focus.title, reason, formula: authored?.keyFormula ?? '', coreId: focus.route, mapId: focus.legacyMapId ?? '' }
        } };
      }
      // Jawaban belum tuntas (berhenti di tengah, "bingung", atau "belum tahu caranya") tetap diberi arah: inti yang sudah
      // terlihat ditandai, dan inti pertama yang belum ada di jawaban (urutan katalog) menjadi langkah berikutnya.
      // Hanya jawaban yang tidak berhubungan dengan soal (OUT_OF_SCOPE) atau tidak terbaca yang tetap meminta klarifikasi.
      const unrelated = result.evidence.some(e => e.uncertaintyReasons.includes('OUT_OF_SCOPE'));
      if (!supported && result.verdict === 'NOT_GRADED' && result.evidence.length && !unrelated && !misconception) {
        const mapped = i.concepts.filter(x => x.legacyMapId);
        const shown = (code: string) => result.evidence.find(e => e.conceptCode === code)?.classification === 'UNDERSTANDING_DEMONSTRATED';
        const missing = mapped.find(x => !shown(x.code));
        if (missing) {
          const started = mapped.some(x => shown(x.code));
          const reason = result.evidence.find(e => e.conceptCode === missing.code)?.rationale?.trim()
            || (started ? 'Langkah ini belum ada di jawabanmu. Lanjutkan dari sini.' : 'Mulai dari inti ini untuk menyusun langkahmu.');
          // Belum ada yang SALAH: inti titik mulai tetap "belum terlihat" (bukan "perlu diperkuat"); assessment.gap hanya
          // menunjuk dari mana mulai. "Perlu diperkuat" khusus kesalahan yang terbukti.
          const items = mapped.map(x => {
            const evidence = result.evidence.find(e => e.conceptCode === x.code);
            return x === missing ? { id: x.legacyMapId!, state: 'rest', reason }
              : shown(x.code) ? { id: x.legacyMapId!, state: 'ok', reason: evidence?.rationale ?? 'Bagian ini terlihat tepat dari jawabanmu.' }
              : { id: x.legacyMapId!, state: 'rest', reason: evidence?.rationale ?? 'Belum kelihatan dari jawaban ini.' };
          });
          const confused = !!result.confused && !started;
          output = { diagnosisRunId: id, status: 'completed', items, assessment: {
            tone: 'gap', title: confused ? 'Nggak apa-apa kalau masih bingung.' : started ? 'Kamu sudah di jalur yang benar. Tinggal lanjutkan.' : 'Mulai dari sini.', okName: null,
            gap: { label: started ? 'Langkah berikutnya' : 'Mulai dari inti ini', name: missing.title, reason, coreId: missing.route, mapId: missing.legacyMapId ?? '' },
            next: { core: missing.title, reason, formula: '', coreId: missing.route, mapId: missing.legacyMapId ?? '' },
          } };
        }
      }
      if(proof && result.verdict==='CORRECT' && response.responseType==='TEXT' && evaluate({...i.source,response}).verdict==='CORRECT') output.claimToken=proof?.({owner,session:body.sessionId,questionId:body.questionId,revisionId:i.revisionId,text:response.text!,hintUsed:c.hints>0||c.openedHint,solutionSeen:c.solutionSeen});
      // Inti yang sudah terlihat di jawaban ini tidak diajarkan ulang oleh IntiGuide: ditandai selesai untuk percakapan berikutnya.
      if (output.items) {
        // inti yang terlihat benar dari jawaban siswa: tetap tercentang di setiap percakapan IntiGuide berikutnya
        const ok = output.items.filter((x: { state: string }) => x.state === 'ok').map((x: { id: string }) => x.id);
        c.answerDone = [...new Set([...(c.answerDone ?? []), ...ok])];
        c.guideDone = [...new Set([...(c.guideDone ?? []), ...ok])];
      }
      // Bounded results and the latest answer (for tutor context) expire with the anonymous session.
      if (c.runs.size >= 32) c.runs.delete(c.runs.keys().next().value!);
      c.runs.set(fingerprint, { id, output }); c.latestRun = id;
      return output;
      })();
      c.pending.set(fingerprint,work);
      try{return await work;}finally{c.pending.delete(fingerprint);}
    },
    run(owner: string, id: string) {
      for (const [key, c] of contexts) if (key.startsWith(owner + ':') && c.expires > now())
        for (const run of c.runs.values()) if (run.id === id) return run.output;
      return fail(404, 'NOT_FOUND');
    },
    async check(owner: string, body: { sessionId: string; itemId: string; answer: string | number; kind?: string; correction?: number }) {
      const c = context(owner, body.sessionId), i = await item(c, body.itemId);
      const response: StudentResponse = typeof body.answer === 'number'
        ? { schemaVersion: 1, responseType: 'OPTION', optionId: i.optionOrder?.[body.answer] ?? '', inputMode: 'TYPED' }
        : { schemaVersion: 1, responseType: 'TEXT', text: body.answer, inputMode: 'TYPED' };
      // koreksi soal tadi: penilai diberi tahu ini koreksi ke berapa dan jawaban yang dinilai sebelumnya
      const retry = body.kind === 'retry_original' && response.responseType === 'TEXT' ? { correction: body.correction ?? 1, previous: c.answer ?? '' } : undefined;
      if (retry) console.log(JSON.stringify({ event: 'trial_retry_check', correction: retry.correction }));
      const r = await gradeTrial(ai, i, response, retry);
      if(response.responseType==='TEXT')c.answer=response.text?.slice(0,1000) ?? '';
      const correct = r.verdict === 'CORRECT' ? true : r.verdict === 'INCORRECT' ? false : null;
      const option = r.revealedAnswer && 'optionId' in r.revealedAnswer ? r.revealedAnswer.optionId : undefined;
      const index = option ? i.optionOrder?.indexOf(option) : undefined;
      const items = i.concepts.filter(x => x.legacyMapId).map(x => {
        const e = r.evidence.find(e => e.conceptCode === x.code);
        const quote = gapQuote(e);
        return {id:x.legacyMapId!, state:e?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'ok' : e?.classification === 'MISCONCEPTION_EVIDENCED' ? 'gap' : 'rest',
          reason:e?.rationale ?? (e?.classification === 'UNDERSTANDING_DEMONSTRATED' ? 'Bagian ini terlihat tepat dari jawabanmu.' : 'Belum cukup bukti dari jawaban ini.'), ...(quote ? { quote } : {})};
      });
      const claimToken = proof && correct===true && response.responseType==='TEXT' && evaluate({...i.source,response}).verdict==='CORRECT' ? proof?.({owner,session:body.sessionId,questionId:body.itemId,revisionId:i.revisionId,text:response.text!,hintUsed:c.hints>0||c.openedHint,solutionSeen:c.solutionSeen}) : undefined;
      return { correct, ...(claimToken ? {claimToken} : {}), ...(items.length ? {items} : {}), ...(index !== undefined && index >= 0 ? { correctOptionIndex: index } : {}), ...(correct === null ? { unreadable: true } : {}),
        ...(correct !== null && i.source.rubric.feedback ? { feedback: correct ? i.source.rubric.feedback.correct : i.source.rubric.feedback.incorrect } : {}) };
    },
    async solution(owner: string, body: { sessionId: string; questionId: string }) {
      const c=context(owner,body.sessionId); c.solutionSeen=true;
      const i = await item(c, body.questionId);
      return i.source.rubric.workedSolution ?? fail(409, 'CONTENT_UNAVAILABLE');
    },
    async tutor(owner: string, body: { sessionId: string; questionId: string; messages: { from: string; text: string }[]; currentAnswer?:string }) {
      const c = context(owner, body.sessionId), i = await item(c, body.questionId);
      const last = body.messages.at(-1);
      if (last?.from !== 'me' || !last.text.trim()) return fail(400, 'VALIDATION_FAILED');
      // percakapan baru (dialog ditutup lalu dibuka: hanya sambutan + pesan pertama siswa): inti dari percakapan
      // sebelumnya tidak dibawa, hanya inti yang terbukti dari jawaban siswa
      const fresh = body.messages.filter((m) => m.from === 'bot').length <= 1;
      const done = fresh ? (c.answerDone ?? []) : (c.guideDone ?? c.answerDone ?? []);
      if (fresh) c.guideStreak = undefined;
      const { streak, ...reply } = await ai.tutor(i,body.messages,(body.currentAnswer ?? c.answer ?? '').slice(0,1000),c.hints,done,c.guideStreak);
      c.hints=reply.hintsUsed;
      // inti yang sudah lewat di chat ini disimpan di sesi trial, supaya IntiGuide melanjutkan urutannya;
      // jumlah jawaban benar untuk inti aktif juga (batas 3 pertanyaan mini per inti), tidak dikirim ke browser
      if(reply.coreProgress)c.guideDone=reply.coreProgress.done;
      c.guideStreak = streak;
      return reply;
    },
    async miniCheck(owner: string, body: { sessionId: string; questionId: string; coreId: string; currentAnswer?: string; reply?: string; round?: number }): Promise<{ question: string; hint: string; correct?: boolean; feedback?: string; because?: string }> {
      const c = context(owner, body.sessionId), i = await item(c, body.questionId);
      const core = i.concepts.find(x => (x.legacyMapId ?? x.code) === body.coreId);
      if (!core) return fail(404, 'NOT_FOUND');
      if (!ai.mini) return fail(503, 'DEPENDENCY_UNAVAILABLE', {blockers:['TRIAL_AI_PROVIDER_UNAVAILABLE']});
      const answer = (body.currentAnswer ?? c.answer ?? '').slice(0, 1000);
      const latest = [...c.runs.values()].find(r => r.id === c.latestRun)?.output;
      const reason = latest?.items?.find((x: { id: string }) => x.id === body.coreId)?.reason as string | undefined;
      const ref = { id: body.coreId, title: core.title };
      // per inti, jawaban, dan putaran belajar: sesudah koreksi yang belum tepat, inti yang dipelajari lagi mendapat pertanyaan baru
      // per soal, inti, jawaban, dan putaran belajar (inti yang sama, mis. Sudut Istimewa, dipakai beberapa soal /coba)
      const scope = body.questionId + '\u0000' + body.coreId + '\u0000' + answer + '\u0000';
      const key = scope + (body.round ?? 0);
      c.mini ??= new Map();
      if (body.reply === undefined) {
        const cached = c.mini.get(key);
        if (cached) return { question: cached.question, hint: cached.hint };
        // putaran berikutnya: pertanyaan dari putaran sebelumnya untuk inti ini dikirim supaya yang baru berbeda
        const previous = [...c.mini.entries()].filter(([k]) => k.startsWith(scope) && k !== key).map(([, v]) => v.question).at(-1);
        const asked = await ai.mini(i, { core: ref, answer, ...(reason ? { reason } : {}), ...(previous ? { previous } : {}) }) as {question:string;hint:string;key?:string};
        if (c.mini.size >= 32) c.mini.delete(c.mini.keys().next().value!);
        // kunci jawaban disimpan di sesi server untuk penilai; yang dikirim ke browser hanya pertanyaan dan petunjuk
        c.mini.set(key, { question: asked.question, hint: asked.hint, ...(asked.key ? { key: asked.key } : {}) });
        return { question: asked.question, hint: asked.hint };
      }
      const asked = c.mini.get(key);
      if (!asked || !body.reply.trim()) return fail(400, 'VALIDATION_FAILED');
      const graded = await ai.mini(i, { core: ref, answer, ...(reason ? { reason } : {}), question: asked.question, reply: body.reply, ...(asked.key ? { key: asked.key } : {}) }) as {correct:boolean;feedback:string;because:string};
      // inti yang terbukti lewat pertanyaan mini tidak diajarkan ulang oleh IntiGuide
      if (graded.correct) c.guideDone = [...new Set([...(c.guideDone ?? c.answerDone ?? []), body.coreId])];
      return { question: asked.question, hint: asked.hint, correct: graded.correct, feedback: graded.feedback, ...(graded.because ? { because: graded.because } : {}) };
    },
    close() { contexts.clear(); }
  };
}
