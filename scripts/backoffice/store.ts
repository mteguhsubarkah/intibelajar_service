import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GRADES_OF_PHASE, lintManifest, loadManifest, writeManifest, type LessonBlock, type Manifest, type Question, type Review } from '../../src/catalog/manifest.js';

export class OfficeError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) { super(message); }
}
export interface Job {
  id: string; key: string; status: 'QUEUED'|'RUNNING'|'DONE'|'FAILED'; attempts: number;
  leaseUntil?: number; leaseToken?: string; message?: string; createdAt: string;
}
export interface State {
  version: 1; revision: number; manifest: Manifest; sources: Record<string, string[]>;
  jobs: Job[]; audit: { at: string; action: string; revision: number }[];
}
export const proposed = (evidence: string[] = []): Review => ({ status: 'PROPOSED', evidence: evidence.length ? evidence : ['Original editorial draft from backoffice; external source and content review pending'] });
export const seedFile = new URL('../../catalog/curriculum/math-sma-2025.json', import.meta.url);
export function seedData() { return JSON.parse(readFileSync(seedFile, 'utf8')); }
export function seedKey() { return createHash('sha256').update(readFileSync(seedFile)).digest('hex'); }
export function validate(m: Manifest) {
  const findings = lintManifest(m);
  const errors = findings.filter(f => f.severity === 'error');
  if (errors.length) throw new OfficeError(422, 'Draf tidak valid', errors);
  return findings;
}
export class Store {
  readonly dir: string;
  constructor(dir = resolve('.local/backoffice'), readonly baseline = resolve('catalog/manifest')) {
    this.dir = resolve(dir); mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }
  read(): State {
    if (!existsSync(join(this.dir, 'state.json'))) throw new OfficeError(503, 'Jalankan inisialisasi backoffice');
    return JSON.parse(readFileSync(join(this.dir, 'state.json'), 'utf8'));
  }
  init() {
    if (existsSync(join(this.dir, 'state.json'))) return;
    this.lock(() => {
      if (existsSync(join(this.dir, 'state.json'))) return;
      // Materialize overlays only in this isolated workspace; never alter extractor-owned files.
      const manifest: Manifest = JSON.parse(JSON.stringify(loadManifest(this.baseline)));
      manifest.authored = [];
      manifest.release.signOff = { status: 'PENDING', reviewers: [] };
      validate(manifest);
      this.write({ version: 1, revision: 0, manifest, sources: {}, jobs: [], audit: [] });
    });
  }
  private lock<T>(fn: () => T): T {
    const path = join(this.dir, 'lock');
    try { mkdirSync(path); }
    catch {
      // A crash can leave a lock directory. Recover only after its recorded PID no longer exists.
      let pid = 0;
      try { pid = Number(readFileSync(join(path, 'pid'), 'utf8')); } catch { /* interrupted mkdir */ }
      let alive = true;
      if (pid) { try { process.kill(pid, 0); } catch (e) { alive = (e as NodeJS.ErrnoException).code !== 'ESRCH'; } }
      else alive = Date.now() - statSync(path).mtimeMs < 60_000;
      if (alive) throw new OfficeError(409, 'Backoffice sedang menyimpan; coba lagi');
      rmSync(path, { recursive: true }); mkdirSync(path);
    }
    writeFileSync(join(path, 'pid'), String(process.pid));
    try { return fn(); } finally { rmSync(path, { recursive: true }); }
  }
  private write(state: State) {
    const tmp = join(this.dir, `state-${randomUUID()}.tmp`);
    writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, join(this.dir, 'state.json'));
  }
  change<T>(expected: number | undefined, action: string, fn: (s: State) => T): T {
    return this.lock(() => {
      const s = this.read();
      if (expected !== undefined && expected !== s.revision) throw new OfficeError(409, 'Draf berubah. Muat ulang sebelum menyimpan.');
      const result = fn(s);
      validate(s.manifest); s.revision++;
      s.audit.push({ at: new Date().toISOString(), action, revision: s.revision });
      this.write(s); return result;
    });
  }
  export() {
    const s = this.read(); validate(s.manifest);
    // Unique output, independent of the canonical manifest and any earlier export.
    const dir = join(this.dir, 'exports', `${s.revision}-${randomUUID()}`);
    writeManifest(dir, s.manifest);
    writeFileSync(join(dir, 'backoffice-sources.json'), JSON.stringify(s.sources, null, 2));
    return { directory: dir, revision: s.revision, findings: lintManifest(s.manifest, { strict: true }) };
  }
}

const str = (v: unknown, max = 2000) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new OfficeError(422, 'Teks wajib diisi / terlalu panjang');
  return v.trim();
};
const code = (v: unknown) => { const c = str(v, 120); if (!/^[A-Z]{3}(\.[A-Z0-9][A-Z0-9_]*)*$/.test(c)) throw new OfficeError(422, 'Kode: MAT.CONTOH.INTI'); return c; };
const upsert = <T>(a: T[], row: T, key: (x: T) => string) => { const i = a.findIndex(x => key(x) === key(row)); if (i < 0) a.push(row); else a[i] = row; };
function sourceOf(input: Record<string, unknown>): string[] {
  if (!input.source) return [];
  let url: URL; try { url = new URL(str(input.source, 2000)); } catch { throw new OfficeError(422, 'URL sumber tidak valid'); }
  if (url.protocol !== 'https:') throw new OfficeError(422, 'Sumber harus HTTPS');
  return [url.href];
}
/* Materi berbentuk blok: hanya jenis dan field yang dikenal skema katalog; teks biasa (**tebal** saja), tanpa HTML. */
const MAX_SLIDES = 10, MAX_BLOCKS = 80;
export function lessonBlocks(v: unknown): LessonBlock[] {
  if (!Array.isArray(v) || !v.length || v.length > MAX_BLOCKS) throw new OfficeError(422, `Materi butuh 1–${MAX_BLOCKS} blok`);
  const blocks = v.map((raw, i): LessonBlock => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new OfficeError(422, `Blok ${i + 1} tidak valid`);
    const b = raw as Record<string, unknown>, slide = Number(b.slide);
    if (!Number.isInteger(slide) || slide < 0 || slide >= MAX_SLIDES) throw new OfficeError(422, `Blok ${i + 1}: slide harus 1–${MAX_SLIDES}`);
    const at = (field: string, max: number) => { try { return str(b[field], max); } catch { throw new OfficeError(422, `Blok ${i + 1} (${String(b.type)}): ${field} wajib diisi, maksimal ${max} karakter`); } };
    if (b.type === 'heading') return { type: 'heading', slide, text: at('text', 240) };
    if (b.type === 'text' || b.type === 'tip') return { type: b.type, slide, text: at('text', 2000) };
    if (b.type === 'math') return { type: 'math', slide, name: at('name', 240), expression: at('expression', 240), ...(b.highlight === true ? { highlight: true } : {}) };
    if (b.type === 'code') {
      // Animasi kode: dijalankan aplikasi hanya di iframe sandbox. Studio menyimpan teksnya apa adanya.
      const part = (field: 'html' | 'css' | 'js', max: number) => {
        const v = b[field];
        if (v === undefined || v === null || v === '') return undefined;
        if (typeof v !== 'string' || v.length > max) throw new OfficeError(422, `Blok ${i + 1} (animasi): ${field.toUpperCase()} maksimal ${max} karakter`);
        return v;
      };
      const html = part('html', 12000), css = part('css', 12000), js = part('js', 24000);
      if (!html?.trim() && !js?.trim()) throw new OfficeError(422, `Blok ${i + 1} (animasi): isi HTML atau JS`);
      const height = Number(b.height);
      if (!Number.isInteger(height) || height < 120 || height > 720) throw new OfficeError(422, `Blok ${i + 1} (animasi): tinggi 120–720 px`);
      return { type: 'code', slide, label: at('label', 240), height, ...(html ? { html } : {}), ...(css ? { css } : {}), ...(js ? { js } : {}) };
    }
    if (b.type === 'figure') {
      const ref = at('figureRef', 40);
      if (!/^[a-z0-9-]{1,40}$/.test(ref)) throw new OfficeError(422, `Blok ${i + 1}: kode ilustrasi hanya huruf kecil, angka, dan tanda -`);
      return { type: 'figure', slide, figureRef: ref };
    }
    throw new OfficeError(422, `Blok ${i + 1}: jenis blok tidak dikenal`);
  });
  const slides = [...new Set(blocks.map(b => b.slide))].sort((a, b) => a - b);
  if (slides.some((s, i) => s !== i)) throw new OfficeError(422, 'Slide harus berurutan mulai dari slide 1, tanpa slide kosong');
  // Urutan tampil = urutan blok dalam slide; slide dikelompokkan supaya manifest rapi.
  return blocks.map((b, i) => [b, i] as const).sort((a, b) => a[0].slide - b[0].slide || a[1] - b[1]).map(([b]) => b);
}

const between = (v: unknown, min: number, max: number, fallback: number, label: string) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new OfficeError(422, `${label} harus ${min}–${max}`);
  return n;
};
const optional = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? str(v, max) : undefined);

/* Soal latihan inti (pilihan ganda / angka). Soal dengan penilai khusus (tower, AI) tetap diedit lewat manifest. */
export const EDITABLE_EVALUATORS = new Set(['option-v1', 'numeric-v1']);
function practiceQuestion(m: Manifest, input: Record<string, unknown>, evidence: string[]): string {
  const concept = code(input.concept);
  const topic = m.topics.find(t => t.concepts.some(x => x.code === concept));
  if (!topic) throw new OfficeError(422, 'Inti tidak ditemukan');
  let c = typeof input.code === 'string' && input.code.trim() ? code(input.code) : '';
  const old = c ? m.questions.find(q => q.code === c) : undefined;
  if (c && !old) throw new OfficeError(422, 'Soal tidak ditemukan; kosongkan kode untuk membuat soal baru');
  if (old && !old.concepts.some(x => x.concept === concept && x.role === 'PRIMARY')) throw new OfficeError(422, 'Soal ini bukan latihan inti tersebut');
  if (old && !EDITABLE_EVALUATORS.has(old.rubric.evaluator)) throw new OfficeError(422, 'Soal ini memakai penilai khusus; edit lewat manifest');
  const itemType = input.itemType === 'NUMERIC' ? 'NUMERIC' : input.itemType === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : undefined;
  if (!itemType) throw new OfficeError(422, 'Jenis soal: pilihan ganda atau angka');
  if (old && old.itemType !== itemType) throw new OfficeError(422, 'Jenis soal lama tidak bisa diganti; buat soal baru');
  if (!c) {
    const stem = `${topic.code}.Q.${concept.slice(topic.code.length + 1)}`;
    let n = 1; while (m.questions.some(q => q.code === `${stem}_${n}`)) n++;
    c = `${stem}_${n}`;
  }
  const prompt = str(input.prompt, 2000);
  const feedback = { correct: optional(input.feedbackCorrect, 2000), incorrect: optional(input.feedbackIncorrect, 2000) };
  let body: Question['body'], answer: Question['rubric']['answer'], acceptedForms: string[];
  if (itemType === 'MULTIPLE_CHOICE') {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 6) throw new OfficeError(422, 'Pilihan jawaban 2–6');
    const labels = input.options.map((o, i) => { try { return str(o, 240); } catch { throw new OfficeError(422, `Pilihan ${String.fromCharCode(65 + i)} wajib diisi, maksimal 240 karakter`); } });
    if (new Set(labels).size !== labels.length) throw new OfficeError(422, 'Pilihan jawaban tidak boleh kembar');
    const ids = labels.map((_, i) => old?.body.options?.[i]?.id ?? String.fromCharCode(97 + i));
    if (old?.legacyOptionOrder && labels.length !== old.body.options?.length) throw new OfficeError(422, 'Soal ini dipakai aplikasi lama; jumlah pilihannya tidak boleh diubah');
    const key = Number(input.answerIndex);
    if (!Number.isInteger(key) || key < 0 || key >= labels.length) throw new OfficeError(422, 'Pilih kunci jawaban');
    body = { schemaVersion: 1, prompt, options: labels.map((label, i) => ({ id: ids[i]!, label })), hints: old?.body.hints ?? [], answerFormat: 'OPTION' };
    answer = { optionId: ids[key]! }; acceptedForms = [labels[key]!];
  } else {
    const value = Number(input.answerValue);
    if (input.answerValue === undefined || input.answerValue === '' || !Number.isFinite(value)) throw new OfficeError(422, 'Isi kunci jawaban berupa angka');
    const unit = optional(input.unit, 20);
    body = { schemaVersion: 1, prompt, hints: old?.body.hints ?? [], answerFormat: 'NUMBER', ...(optional(input.answerExample, 240) ? { answerExample: optional(input.answerExample, 240)! } : {}) };
    answer = { value, ...(unit ? { unit } : {}), tolerance: old?.rubric.answer.tolerance ?? { relative: 0.02, floor: 1 } };
    acceptedForms = [unit ? `${value} ${unit}` : String(value)];
  }
  const rubric: Question['rubric'] = {
    ...(old?.rubric ?? { schemaVersion: 1, solutionPaths: [], misconceptionMap: [], finalAnswerEvidence: [concept] }),
    schemaVersion: 1, evaluator: itemType === 'NUMERIC' ? 'numeric-v1' : 'option-v1', answer, acceptedForms,
    ...(feedback.correct || feedback.incorrect ? { feedback: { ...(feedback.correct ? { correct: feedback.correct } : {}), ...(feedback.incorrect ? { incorrect: feedback.incorrect } : {}) } } : {}),
  };
  if (!feedback.correct && !feedback.incorrect) delete rubric.feedback;
  // Pola miskonsepsi pilihan ganda menunjuk id pilihan; id yang hilang membuat pola itu tidak berlaku.
  if (itemType === 'MULTIPLE_CHOICE') rubric.misconceptionMap = rubric.misconceptionMap.filter(x => x.pattern.kind !== 'OPTION' || body.options!.some(o => o.id === x.pattern.optionId));
  upsert(m.questions, {
    ...(old ?? { schemaVersion: 1, familyCode: c.replace('.Q.', '.F.'), visibility: 'PUBLIC_PRACTICE', origin: 'AUTHORED', contextTag: 'PILOT', aliases: [],
      provenance: { source: 'backoffice', note: 'Ditulis di studio katalog; kunci dan pembahasan perlu dicek guru mata pelajaran.' },
      concepts: [{ concept, role: 'PRIMARY', assessable: true }] }),
    code: c, itemType, difficulty: between(input.difficulty, 1, 3, old?.difficulty ?? 1, 'Tingkat kesulitan'),
    estimatedMinutes: between(input.estimatedMinutes, 1, 30, old?.estimatedMinutes ?? 2, 'Perkiraan menit'),
    body, rubric, review: proposed(evidence),
  } as Question, x => x.code);
  return c;
}

export function command(s: State, input: Record<string, unknown>) {
  const m = s.manifest, kind = input.kind;
  if (kind === 'question') {
    const evidence = sourceOf(input), c = practiceQuestion(m, input, evidence);
    if (evidence.length) s.sources[c] = evidence;
    m.release.signOff = { status: 'PENDING', reviewers: [] };
    return c;
  }
  const c = code(input.code);
  const evidence = sourceOf(input);
  if (kind === 'topic') {
    const old = m.topics.find(t => t.code === c);
    const subject = input.subject === undefined ? old?.subject ?? 'MAT' : str(input.subject, 3);
    if (!m.subjects.subjects.some(s => s.code === subject)) throw new OfficeError(422, 'Pelajaran tidak dikenal');
    if (old && old.subject !== subject) throw new OfficeError(422, 'Topik lama tidak boleh dipindahkan antar pelajaran');
    const phase = str(input.phase);
    if (!['D','E','F','F+'].includes(phase)) throw new OfficeError(422, 'Fase tidak valid');
    upsert(m.topics, { ...(old ?? { schemaVersion: 1, subject: 'MAT', availability: 'PLANNED', bekal: [], aliases: [], units: [], concepts: [], prerequisites: [] }),
      code: c, subject, title: str(input.title, 240), phase: phase as 'E', review: proposed(evidence) }, x => x.code);
    // Fase berubah: kelas inti yang tidak lagi masuk fase itu disesuaikan (fase satu kelas) atau dikosongkan untuk ditetapkan ulang.
    const grades = GRADES_OF_PHASE[phase as 'E'];
    for (const x of m.topics.find(t => t.code === c)!.concepts) if (x.grade !== undefined && !grades.includes(x.grade)) {
      if (grades.length === 1) x.grade = grades[0]; else delete x.grade;
    }
  } else if (kind === 'core') {
    const topic = m.topics.find(t => t.code === input.topic);
    if (!topic) throw new OfficeError(422, 'Topik tidak ditemukan');
    if (m.topics.some(t => t !== topic && t.concepts.some(x => x.code === c))) throw new OfficeError(422, 'Inti tidak boleh dipindahkan antartopik');
    const old = topic.concepts.find(x => x.code === c);
    upsert(topic.concepts, { ...(old ?? { ordinal: topic.concepts.length + 1, estimatedMinutes: 5, hidden: false, capstone: false, availability: 'PLANNED', aliases: [], misconceptions: [] }),
      code: c, title: str(input.title, 240), definition: str(input.definition), objectives: str(input.objectives).split('\n').map(x => x.trim()).filter(Boolean), review: proposed(evidence) }, x => x.code);
  } else if (kind === 'relation') {
    const type = str(input.type);
    if (!['REQUIRES','RELATED'].includes(type)) throw new OfficeError(422, 'Jenis relasi tidak valid');
    if (c === input.to) throw new OfficeError(422, 'Relasi ke diri sendiri ditolak');
    const row = { from: c, to: code(input.to), kind: type as 'REQUIRES', label: str(input.label, 200), source: 'MATHEMATICAL' as const, review: proposed(evidence) };
    upsert(m.topicRelations.relations, row, x => `${x.from}:${x.to}:${x.kind}`);
  } else if (kind === 'prerequisite') {
    const topic = m.topics.find(t => t.concepts.some(x => x.code === c));
    if (!topic) throw new OfficeError(422, 'Inti tidak ditemukan');
    if (!['HARD','SOFT'].includes(String(input.type))) throw new OfficeError(422, 'Jenis prasyarat tidak valid');
    upsert(topic.prerequisites, { concept: c, requires: code(input.to), kind: input.type as 'HARD', review: proposed(evidence) }, x => `${x.concept}:${x.requires}`);
  } else if (kind === 'lesson') {
    const old = m.lessons.find(l => l.code === c);
    if (old?.blocks.some(b => b.type !== 'text' || b.slide > 1) || old?.checks.some(q => q.slideIndex > 1))
      throw new OfficeError(422, 'Materi terstruktur harus diedit melalui manifest agar rumus, ilustrasi, dan cek tetap utuh');
    const concepts = str(input.concepts).split(',').map(x => code(x.trim()));
    upsert(m.lessons, { ...(old ?? { schemaVersion: 1, estimatedMinutes: 5, aliases: [], checks: [] }), code: c, title: str(input.title, 240), concepts,
      blocks: [{ type: 'text', slide: 0, text: str(input.slide1) }, { type: 'text', slide: 1, text: str(input.slide2) }], review: proposed(evidence) }, x => x.code);
    // Existing checks on later slides must be explicitly migrated by an editor, not silently removed.
  } else if (kind === 'lesson-blocks') {
    const old = m.lessons.find(l => l.code === c);
    const concepts = (Array.isArray(input.concepts) ? input.concepts.map(String) : str(input.concepts).split(',')).map(x => code(x.trim()));
    if (!concepts.length) throw new OfficeError(422, 'Pilih minimal satu inti');
    const blocks = lessonBlocks(input.blocks), slides = Math.max(...blocks.map(b => b.slide)) + 1;
    // Cek per bagian menempel ke slide; slide tempatnya tidak boleh hilang diam-diam.
    const lost = (old?.checks ?? []).filter(q => q.slideIndex >= slides);
    if (lost.length) throw new OfficeError(422, `Cek pemahaman masih terpasang di slide ${[...new Set(lost.map(q => q.slideIndex + 1))].join(', ')}. Jangan hapus slide itu.`);
    upsert(m.lessons, { ...(old ?? { schemaVersion: 1, aliases: [], checks: [] }), code: c, title: str(input.title, 240), concepts, blocks,
      estimatedMinutes: between(input.estimatedMinutes, 1, 20, old?.estimatedMinutes ?? 5, 'Perkiraan menit'), review: proposed(evidence) }, x => x.code);
  } else throw new OfficeError(422, 'Jenis perintah tidak dikenal');
  if (evidence.length) s.sources[c] = evidence;
  m.release.signOff = { status: 'PENDING', reviewers: [] };
}

export function enqueue(s: State): Job {
  const key = seedKey();
  const old = s.jobs.find(j => j.key === key && j.status !== 'FAILED');
  if (old) return old;
  const j: Job = { id: randomUUID(), key, status: 'QUEUED', attempts: 0, createdAt: new Date().toISOString() };
  s.jobs.push(j); return j;
}
export function claim(s: State, now: number) {
  const j = s.jobs.find(x => x.status === 'QUEUED' || (x.status === 'RUNNING' && (x.leaseUntil ?? 0) <= now));
  if (!j) return;
  if (j.attempts >= 3) { j.status = 'FAILED'; j.message = 'Batas percobaan tercapai'; return; }
  j.status = 'RUNNING'; j.attempts++; j.leaseUntil = now + 60_000; j.leaseToken = randomUUID();
  return structuredClone(j);
}
export function importSeed(s: State, job: Job) {
  const current = s.jobs.find(j => j.id === job.id);
  if (!current || current.status !== 'RUNNING' || current.leaseToken !== job.leaseToken || (current.leaseUntil ?? 0) <= Date.now())
    throw new OfficeError(409, 'Lease worker kedaluwarsa');
  if (job.key !== seedKey()) throw new OfficeError(409, 'Seed berubah; antrekan ulang setelah worker diperbarui');
  const seed = seedData(); let topics = 0, cores = 0;
  for (const t of seed.topics) {
    if (!s.manifest.topics.some(x => x.code === t.code)) {
      command(s, { kind: 'topic', ...t, source: seed.sources[0].url }); topics++;
    }
    for (const core of t.cores) {
      if (s.manifest.topics.some(x => x.concepts.some(y => y.code === core.code))) continue;
      command(s, { kind: 'core', ...core, topic: t.code, source: seed.sources[0].url }); cores++;
    }
    s.sources[t.code] = seed.sources.map((x: { url: string }) => x.url);
  }
  // Edges are editorial suggestions, never represented as official CP-mandated prerequisites.
  for (const r of seed.relations ?? []) {
    if (!s.manifest.topicRelations.relations.some(x => x.from === r.code && x.to === r.to && x.kind === r.type))
      command(s, { kind: 'relation', ...r, source: seed.sources[0].url });
  }
  for (const p of seed.prerequisites ?? []) {
    if (!s.manifest.topics.some(t => t.prerequisites.some(x => x.concept === p.code && x.requires === p.to)))
      command(s, { kind: 'prerequisite', ...p, source: seed.sources[0].url });
  }
  for (const l of seed.lessons ?? []) {
    if (!s.manifest.lessons.some(x => x.code === l.code)) command(s, { kind: 'lesson', ...l, source: seed.sources[0].url });
  }
  current.status = 'DONE'; current.message = `${topics} topik, ${cores} inti ditambahkan sebagai PROPOSED; isi lama tidak ditimpa`;
  delete current.leaseUntil; delete current.leaseToken;
}
