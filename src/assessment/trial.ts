import { confusedText, type TrialAi } from './trial-ai.js';
import type { GradingSource } from '../catalog/grading-source.js';
import type { Connection } from '../db.js';
import { currentRelease, legacyItem, loopAnchor, mappedConcepts, lessonFor } from '../catalog/interface.js';
import { gradingSource } from '../catalog/grading-source.js';
import { evaluate, type Evaluation, type StudentResponse } from './evaluators/index.js';
import { parseAnswerValue, unitKindOf, withinTolerance, type ParseOptions } from './evaluators/numeric-parse.js';
import { ApiError, fail } from '../platform/errors.js';
import { judgeCobaStep, stepValue } from './coba-steps.js';
import { specialAngleSlips } from './special-angles.js';
import { findQuote } from './trial-ai.js';
import { hash, stable, uuid } from '../platform/crypto.js';

// Public trial uses published content with an injected AI engine; no authored-response fallback.
// It never creates an account, consent, mastery or permanent response record.
export interface TrialItem {
  revisionId: string; source: GradingSource; optionOrder: string[] | null;
  /** grade: kelas inti di katalog (7–12), untuk menyesuaikan pertanyaan mini dengan tingkat siswa */
  concepts: { code: string; title: string; legacyMapId: string | null; route: string; grade?: number | null }[];
}
/*
 * Urutan pilihan yang dilihat siswa, untuk jawaban "pilihan ke-i". Soal /coba lama punya urutan tetap (alias ITEM);
 * soal katalog lain (latihan inti tamu) tampil dengan urutan pilihan katalog, sama dengan GET /v1/questions/{id}.
 */
export function optionOrderOf(legacy: string[] | null, source: GradingSource): string[] | null {
  return legacy ?? (source.body.options?.length ? source.body.options.map(o => o.id) : null);
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
    return { code: c.code, title: c.title, legacyMapId: c.legacyMapId, route: lesson?.routeSlug ?? '', grade: c.grade ?? null };
  }));
  return { revisionId: anchor.revisionId, source, concepts, optionOrder: optionOrderOf(item.legacyOptionOrder, source) };
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
  /** hasil kotak "Coba sekarang" per soal, langkah, dan isian (isian yang sama tidak dinilai dua kali) */
  steps?: Map<string, StepCheckResult>;
}
export interface StepCheckResult { correct: boolean; partial: boolean; feedback: string; judge: 'rule' | 'ai'; coreId: string }
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
const KEEP_WORDS = new Set(['akar', 'sqrt', 'meter', 'metre', 'derajat', 'detik', 'sekon', 'gram', 'menit', 'celsius', 'celcius', 'bakteri']);
export function finalValue(text: string, kind: ReturnType<typeof unitKindOf>, options: ParseOptions = {}): FinalValue | null {
  const last = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).at(-1);
  if (!last || !last.includes('=')) return null;
  for (const piece of last.split('=').at(-1)!.split('≈')) {
    const cleaned = piece.replace(/[a-zA-Z]{4,}/g, w => (KEEP_WORDS.has(w.toLowerCase()) ? w : ' ')).replace(/[,;.]\s*$/, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const v = parseAnswerValue(cleaned, kind, options);
    if (v.kind !== 'value') continue;
    const values = [v.value];
    // pembagian bertingkat tanpa kurung: siswa yang menulis "20/1/√3" bermaksud 20 / (1/√3)
    const nested = cleaned.match(/^(.+?)\/(.+)\/(.+)$/);
    if (nested && !/[()]/.test(cleaned)) {
      const alt = parseAnswerValue(`${nested[1]}/(${nested[2]}/${nested[3]})`, kind, options);
      if (alt.kind === 'value' && alt.value !== v.value) values.push(alt.value);
    }
    return { value: v.value, values, quote: piece.trim() };
  }
  return null;
}
/*
 * Jawaban yang benar menurut angka hasil akhirnya membuktikan inti hasil akhir (rubric.finalAnswerEvidence), seperti
 * penilai numeric-v1. Tanpa ini, AI yang tidak menulis bukti membuat diagnosis jatuh ke "perjelas langkahmu"
 * padahal jawabannya benar.
 */
function proven(e: Evaluation, i: TrialItem, text: string, quote?: string): Evaluation {
  const need = i.source.rubric.finalAnswerEvidence.filter(code => i.concepts.some(c => c.code === code)
    && !e.evidence.some(x => x.conceptCode === code && x.classification === 'UNDERSTANDING_DEMONSTRATED'));
  if (!need.length) return e;
  const at = quote ? text.lastIndexOf(quote) : -1;
  const refs = quote && at >= 0 ? [{ kind: 'SPAN' as const, start: at, end: at + quote.length, quote }] : [];
  return { ...e, evidence: [...e.evidence.filter(x => !need.includes(x.conceptCode)),
    ...need.map(code => ({ conceptCode: code, classification: 'UNDERSTANDING_DEMONSTRATED' as const, rationale: 'Hasil akhirmu benar.', refs, uncertaintyReasons: [] }))] } as Evaluation;
}
/*
 * Jawaban yang cuma menyatakan bingung / belum tahu caranya ("bingung ah gatau", tombol "Belum tahu caranya") tidak boleh
 * berujung galat hanya karena penilai AI tidak tersedia: belum ada langkah yang bisa dinilai, jadi hasilnya sudah pasti.
 * Belum dinilai, tidak ada inti yang salah, dan inti pertama soal menjadi tempat mulai (sama dengan hasil AI untuk bingung).
 */
const confusedResponse = (r: StudentResponse) => (r.responseType === 'TEXT' && confusedText(r.text ?? '')) || (r.responseType === 'SELF_REPORT' && r.selfReport === 'DONT_KNOW');
export function confusedWithoutAi(i: TrialItem): Evaluation {
  const start = i.concepts.find(c => c.legacyMapId) ?? i.concepts[0];
  return { confused: true, verdict: 'NOT_GRADED', reason: 'insufficient-working', value: null, misconceptionCode: null, revealedAnswer: null,
    evidence: i.concepts.map(c => ({ conceptCode: c.code, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'],
      rationale: c === start ? 'Nggak apa-apa. Mulai dari inti ini dulu: pelajari konsepnya, lalu coba langkah pertamanya.' : 'Belum kelihatan dari jawaban ini.' })) } as Evaluation;
}
/* siswa menyatakan jawabannya belum selesai */
const UNFINISHED = /\b(?:bingung|binggung|lanjut(?:nya)?|gimana|bagaimana\s+lagi|habis\s+itu|selanjutnya|belum\s+selesai|ga\s*tau|gatau|nggak\s+tau)\b|\?\s*$/i;
/* pengecoh yang berarti "berhenti di hasil antara yang benar" */
const STOPPED = /^BERHENTI_|_BELUM_DIHITUNG$/;
/**
 * Jawaban setengah jadi: tidak ada inti yang "perlu diperkuat" kecuali penilai menemukan kesalahan nyata di langkah yang sudah
 * ditulis. Hasilnya NOT_GRADED supaya diagnose memakai jalur "Kamu sudah di jalur yang benar" + langkah berikutnya.
 */
function partial(judged: Evaluation, shown?: Evaluation['evidence'][number]): Evaluation {
  const evidence = judged.evidence.filter(e => e.conceptCode !== shown?.conceptCode);
  const realGap = evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED');
  if (realGap) return { ...judged, verdict: 'INCORRECT', reason: null, evidence: shown ? [...evidence, shown] : evidence } as Evaluation;
  return { ...judged, verdict: 'NOT_GRADED', reason: 'insufficient-working', misconceptionCode: null, clarification: undefined,
    evidence: shown ? [...evidence, shown] : evidence } as Evaluation;
}
/**
 * Nilai sudut istimewa yang tertulis ("cos 30° = ½") diputuskan tabel, bukan AI: salah → Sudut Istimewa "perlu diperkuat"
 * dengan nilai itu disorot; benar → tanda salah dari AI untuk inti itu dicabut (QA TC-PANDU-044/053/058).
 */
export function withSpecialAngles(judged: Evaluation, i: TrialItem, text: string): Evaluation {
  const special = i.concepts.find(c => /SUDUT_ISTIMEWA/.test(c.code));
  const slips = special ? specialAngleSlips(text) : [];
  if (!special || !slips.length || judged.verdict === 'CORRECT') return judged;
  const wrong = slips.find(s => !s.right);
  const others = judged.evidence.filter(e => e.conceptCode !== special.code);
  const mine = judged.evidence.find(e => e.conceptCode === special.code);
  if (wrong) {
    const span = findQuote(text, wrong.written);
    return { ...judged, verdict: 'INCORRECT', reason: null, clarification: undefined, evidence: [...others, { conceptCode: special.code, classification: 'MISCONCEPTION_EVIDENCED',
      rationale: `Nilai ${wrong.fn} ${wrong.angle}° yang kamu tulis belum tepat. Coba ingat lagi nilai sudut istimewa itu, ya.`,
      refs: span ? [{ kind: 'SPAN', start: span.start, end: span.end, quote: span.quote }] : [], uncertaintyReasons: [] }] } as Evaluation;
  }
  if (mine?.classification !== 'MISCONCEPTION_EVIDENCED') return judged;
  const ok = slips[0]!, span = findQuote(text, ok.written);
  const evidence = [...others, { conceptCode: special.code, classification: 'UNDERSTANDING_DEMONSTRATED' as const,
    rationale: `Kamu sudah memakai nilai ${ok.fn} ${ok.angle}° dengan tepat.`, refs: span ? [{ kind: 'SPAN' as const, start: span.start, end: span.end, quote: span.quote }] : [], uncertaintyReasons: [] }];
  return { ...judged, evidence } as Evaluation;
}
export async function gradeTrial(ai: TrialAi, i: TrialItem, response: StudentResponse, retry?: { correction: number; previous: string }): Promise<Evaluation> {
  // soal milik siswa (ai-assisted-v1) tidak punya penilai deterministik: hanya AI yang menilai.
  // (Tanpa penjaga ini, setiap diagnosis /tanya gagal "No deterministic evaluator".)
  let fixed: Evaluation | null = null;
  try { fixed = evaluate({ ...i.source, response }); } catch { fixed = null; }
  if (response.responseType === 'OPTION' && fixed) return fixed;
  let judged: Evaluation;
  try { judged = await ai.evaluate(i, response, retry); }
  catch (e) {
    if (!(e instanceof ApiError && e.status === 503 && confusedResponse(response))) throw e;
    console.warn(JSON.stringify({ event: 'trial_ai_fallback', reason: 'confused' }));
    return confusedWithoutAi(i);
  }
  if (response.responseType === 'TEXT') judged = withSpecialAngles(judged, i, response.text ?? '');
  const key = i.source.rubric.answer;
  if (response.responseType !== 'TEXT' || typeof key?.value !== 'number') return judged;
  const text = response.text ?? '';
  /* siswa bilang belum selesai ("…, habis itu bingung", "lanjutnya gimana"): tanpa kesalahan nyata, bukan "hasil akhir salah" */
  const unfinished = UNFINISHED.test(text);
  const got = finalValue(text, unitKindOf(key.unit), { thousandsDot: key.thousandsDot === true });
  /* pengecoh katalog yang cocok dengan angka hasil akhir: penjelasan yang sudah ditinjau, angkanya disorot */
  const trapOf = (values: number[], quote: string) => {
    const trap = i.source.rubric.misconceptionMap.find(m => m.pattern.kind === 'NUMERIC' && typeof m.pattern.value === 'number'
      && values.some(value => withinTolerance(value, m.pattern.value!, key.tolerance?.relative, key.tolerance?.floor)));
    if (!trap || !i.concepts.some(c => c.code === trap.conceptCode)) return null;
    const at = text.lastIndexOf(quote);
    const refs = at >= 0 && quote ? [{ kind: 'SPAN' as const, start: at, end: at + quote.length, quote }] : [];
    // Pengecoh "berhenti di hasil antara yang benar" (kode BERHENTI_…/…_BELUM_DIHITUNG dan penjelasan katalognya "udah benar"):
    // intinya terlihat, bukan "perlu diperkuat" (QA TC-PANDU-024/031). Langkah berikutnya dipilih di diagnose.
    // "Itu masih dalam meter" (BERHENTI_DI_METER) tetap kesalahan karena penjelasannya tidak menyebut benar.
    if (STOPPED.test(trap.misconceptionCode) && /\b(?:udah|sudah) benar\b/i.test(trap.explanation)) return partial(judged, { conceptCode: trap.conceptCode,
      classification: 'UNDERSTANDING_DEMONSTRATED', rationale: trap.explanation, refs, uncertaintyReasons: [] });
    // Angka sama dengan pengecoh tapi tulisannya menunjukkan inti itu dipakai benar (mis. "20 × sin 30°" dengan nilai sin 30° yang
    // salah menghasilkan angka yang sama dengan "pakai cos"): sebab salahnya di tempat lain, pengecoh tidak dipakai (TC-PANDU-053).
    if (judged.evidence.some(e => e.conceptCode === trap.conceptCode && e.classification === 'UNDERSTANDING_DEMONSTRATED')) return null;
    // Inti lain yang ditandai salah oleh penilai tetap ditandai (beberapa kesalahan sekaligus, TC-PANDU-058).
    return { ...judged, verdict: 'INCORRECT', reason: null, clarification: undefined, misconceptionCode: trap.misconceptionCode,
      evidence: [...judged.evidence.filter(e => e.conceptCode !== trap.conceptCode), { conceptCode: trap.conceptCode,
        classification: 'MISCONCEPTION_EVIDENCED', rationale: trap.explanation, misconceptionCode: trap.misconceptionCode,
        refs, uncertaintyReasons: [] }] } as Evaluation;
  };
  if (!got) {
    // Hasil akhir dengan satuan lain ("= 6.000.000 cm" untuk kunci dalam km): angkanya hanya dicocokkan dengan pengecoh.
    // Jalur ini tidak pernah memberi benar (60 m bukan 60 km); selain pengecoh, keputusan tetap seperti sebelumnya.
    const last = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).at(-1) ?? '';
    const loose = last.includes('=') ? stepValue(last, { thousandsDot: key.thousandsDot === true }) : null;
    const quote = last.split(/[=≈]/).at(-1)?.trim() ?? '';
    const looseTrap = loose !== null ? trapOf([loose], quote) : null;
    if (looseTrap) return looseTrap;
    // angka polos tanpa "=" ("0,1", "10.000 kJ"): penilai numeric-v1 katalog membacanya sendiri dan memutuskan bila tegas
    const decisive = i.source.rubric.evaluator === 'numeric-v1' && fixed && (fixed.verdict === 'CORRECT' || fixed.verdict === 'INCORRECT');
    if (!decisive) return judged;
    return fixed!.verdict === 'CORRECT' && judged.verdict === 'CORRECT' ? proven(judged, i, text) : fixed!;
  }
  const right = got.values.some(value => withinTolerance(value, key.value!, key.tolerance?.relative, key.tolerance?.floor));
  console.log(JSON.stringify({ event: 'grade_final_value', hasil: right ? 'benar' : 'salah', bacaan: got.values.length, ai: judged.verdict }));
  if (right) {
    if (judged.verdict === 'CORRECT') return proven(judged, i, text, got.quote);
    if (fixed?.verdict === 'CORRECT') return fixed;
    // benar menurut angka: tanda salah dari AI tidak berlaku lagi
    return proven({ ...judged, verdict: 'CORRECT', reason: null, misconceptionCode: null, clarification: undefined,
      evidence: judged.evidence.map(e => e.classification === 'MISCONCEPTION_EVIDENCED' ? { ...e, classification: 'INSUFFICIENT_EVIDENCE', refs: [], uncertaintyReasons: ['INCOMPLETE_WORK'] } : e) } as Evaluation, i, text, got.quote);
  }
  // Pengecoh yang dicatat di rubrik (angka hasil akhir sama dengan pola NUMERIC): penjelasan katalog yang sudah ditinjau
  // dipakai, bukan tebakan AI. Inti lain tetap memakai bukti dari AI.
  const trap = trapOf(got.values, got.quote);
  if (trap) return trap;
  if (judged.verdict === 'INCORRECT' && judged.evidence.some(e => e.classification === 'MISCONCEPTION_EVIDENCED')) return judged;
  // belum selesai dan penilai tidak menemukan yang salah: bukan "hasil akhir salah", tapi langkah yang belum dilanjutkan
  if (unfinished) return partial(judged);
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
        // langkah berikutnya mengikuti urutan langkah penyelesaian soal (bila ada), bukan urutan inti di katalog:
        // "volume batu = 20 mL, lanjutnya gimana" → langkah berikutnya mengubah satuan, baru massa jenis (TC-PANDU-031)
        const order = (i.source.rubric.solutionPaths?.[0]?.steps ?? []).flatMap(st => st.concepts.map(c => c.code));
        const rank = (code: string) => { const k = order.indexOf(code); return k < 0 ? order.length : k; };
        const missing = [...mapped].sort((a, b) => rank(a.code) - rank(b.code)).find(x => !shown(x.code));
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
    /*
     * Kotak "Coba sekarang" di petunjuk /coba (satu inti). Aturan angka dan kata di rubric.cobaSteps memutuskan bila bisa;
     * isian bebas dinilai AI (DeepSeek) dengan key langkah itu. Langkah yang benar menandai intinya selesai untuk IntiGuide.
     */
    async stepCheck(owner: string, body: { sessionId: string; questionId: string; step: number; reply: string }): Promise<StepCheckResult> {
      const c = context(owner, body.sessionId), i = await item(c, body.questionId);
      const step = i.source.rubric.cobaSteps?.find(s => s.step === body.step);
      if (!step) return fail(404, 'NOT_FOUND');
      const core = i.concepts.find(x => x.code === step.conceptCode);
      if (!core) return fail(409, 'CONTENT_UNAVAILABLE');
      const reply = body.reply.trim().slice(0, 300);
      if (!reply) return fail(400, 'VALIDATION_FAILED');
      c.openedHint = true;
      c.steps ??= new Map();
      const cacheKey = body.questionId + '\u0000' + step.step + '\u0000' + reply;
      const cached = c.steps.get(cacheKey);
      if (cached) return cached;
      const coreId = core.legacyMapId ?? core.code, ref = { id: coreId, title: core.title };
      const answer = (c.answer ?? '').slice(0, 1000);
      const rule = judgeCobaStep(step, reply, { thousandsDot: i.source.rubric.answer.thousandsDot === true });
      let result: StepCheckResult;
      if (rule.kind === 'correct') result = { correct: true, partial: false, feedback: step.correct, judge: 'rule', coreId };
      else if (rule.kind === 'partial') result = { correct: false, partial: true, feedback: rule.feedback, judge: 'rule', coreId };
      else if (rule.kind === 'incorrect') {
        // angkanya sudah diputuskan salah; tanggapan yang menyebut langkah siswa ditulis AI bila tersedia
        let feedback = rule.feedback ?? 'Belum pas. Baca lagi rumus di atas, lalu coba lagi.';
        if (rule.by === 'number' && ai.mini) {
          try { feedback = (await ai.mini(i, { core: ref, answer, question: step.prompt, reply, key: step.key, decided: false }) as { feedback: string }).feedback || feedback; }
          catch { /* tanggapan cadangan di atas */ }
        }
        result = { correct: false, partial: false, feedback, judge: 'rule', coreId };
      } else {
        if (!ai.mini) return fail(503, 'DEPENDENCY_UNAVAILABLE', { blockers: ['TRIAL_AI_PROVIDER_UNAVAILABLE'] });
        const graded = await ai.mini(i, { core: ref, answer, question: step.prompt, reply, key: step.key }) as { correct: boolean; feedback: string };
        result = { correct: graded.correct, partial: false, feedback: graded.correct ? graded.feedback || step.correct : graded.feedback, judge: 'ai', coreId };
      }
      console.log(JSON.stringify({ event: 'trial_step_check', step: step.step, hasil: result.correct ? 'benar' : result.partial ? 'hampir' : 'belum', judge: result.judge }));
      if (result.correct) c.guideDone = [...new Set([...(c.guideDone ?? c.answerDone ?? []), coreId])];
      if (c.steps.size >= 64) c.steps.delete(c.steps.keys().next().value!);
      c.steps.set(cacheKey, result);
      return result;
    },
    /*
     * Soal /coba mana yang benar-benar ada di rilis katalog aktif, dengan teks soalnya (body publik) dan langkah
     * Coba sekarang yang punya kunci. Aplikasi memakai ini supaya soal yang belum terbit, atau versinya berbeda dengan
     * yang tampil, tidak dibuka (tanpa ini siswa mendapat 404 atau dinilai dengan kunci versi lain).
     */
    async items(ids: string[]): Promise<{ items: { id: string; available: boolean; prompt?: string; steps?: number[] }[] }> {
      const wanted = [...new Set(ids.map(id => id.trim()).filter(id => /^[a-z0-9-]{1,64}$/.test(id)))].slice(0, 16);
      const items = await Promise.all(wanted.map(async id => {
        try {
          const i = await load(id);
          return { id, available: true, prompt: i.source.body.prompt, steps: (i.source.rubric.cobaSteps ?? []).map(s => s.step) };
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return { id, available: false };
          throw e;
        }
      }));
      return { items };
    },
    close() { contexts.clear(); }
  };
}
