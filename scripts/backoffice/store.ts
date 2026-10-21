import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lintManifest, loadManifest, writeManifest, type Manifest, type Review } from '../../src/catalog/manifest.js';

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
export function command(s: State, input: Record<string, unknown>) {
  const m = s.manifest, kind = input.kind;
  const c = code(input.code);
  const evidence: string[] = [];
  if (input.source) {
    let url: URL; try { url = new URL(str(input.source, 2000)); } catch { throw new OfficeError(422, 'URL sumber tidak valid'); }
    if (url.protocol !== 'https:') throw new OfficeError(422, 'Sumber harus HTTPS');
    evidence.push(url.href);
  }
  if (kind === 'topic') {
    const old = m.topics.find(t => t.code === c);
    const phase = str(input.phase);
    if (!['D','E','F','F+'].includes(phase)) throw new OfficeError(422, 'Fase tidak valid');
    upsert(m.topics, { ...(old ?? { schemaVersion: 1, subject: 'MAT', availability: 'PLANNED', bekal: [], aliases: [], units: [], concepts: [], prerequisites: [] }),
      code: c, title: str(input.title, 240), phase: phase as 'E', review: proposed(evidence) }, x => x.code);
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
