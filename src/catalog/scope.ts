import { createHash } from 'node:crypto';
import { stable } from '../platform/crypto.js';
import { GRADES_OF_PHASE, type Authored, type Lesson, type Manifest, type PracticeSet, type Question, type Release, type Review, type Topic } from './manifest.js';

/* =========================================================
   Sign-off dan rilis katalog per lingkup (mapel, atau mapel + fase).

   Masalah yang dipecahkan: publisher menolak rilis selama ada SATU item
   yang belum ditinjau, jadi guru Matematika SMP harus menunggu seluruh
   katalog (±1.600 item) ditinjau. Di sini:

   - Sign-off mengikat satu lingkup (mis. MAT:D) ke ISI yang ditinjau
     lewat hash. Isi yang berubah sesudahnya tidak ikut terbit.
   - Rilis baru = isi produksi yang sedang aktif (snapshot di DB, sudah
     pernah ditinjau) + lingkup yang ditandatangani, diambil dari repo.
     Konten terbit di luar lingkup tidak pernah tertarik; konten repo di
     luar lingkup tidak pernah ikut terbit.
   - Item yang rujukannya belum ikut terbit (mis. soal multi-inti yang
     memakai inti mapel lain) disisihkan dan dilaporkan, bukan diterbitkan
     setengah jadi. Hasil akhirnya tetap lewat publish() dan strict lint.

   Fungsi di sini murni (tanpa DB), supaya bisa dites dan dipakai CLI.
========================================================= */

export const PHASES = ['D', 'E', 'F', 'F+'] as const;
export interface Scope { subject: string; phase?: Topic['phase'] }
export interface SignOff { scope: string; name: string; role: string; date: string; contentSha256: string }
export interface SignOffFile { schemaVersion: 1; signoffs: SignOff[] }

/** "MAT" atau "MAT:D" (fase: D, E, F, F+). */
export function parseScope(text: string): Scope {
  const m = /^([A-Z]{2,5})(?::(D|E|F|F\+))?$/.exec(text.trim());
  if (!m) throw new Error(`Lingkup "${text}" tidak valid. Pakai kode mapel (MAT) atau mapel:fase (MAT:D, FIS:F+).`);
  return { subject: m[1]!, ...(m[2] ? { phase: m[2] as Topic['phase'] } : {}) };
}
export const scopeText = (s: Scope) => s.subject + (s.phase ? ':' + s.phase : '');
const topicIn = (t: Pick<Topic, 'subject' | 'phase'>, scopes: Scope[]) => scopes.some(s => s.subject === t.subject && (!s.phase || s.phase === t.phase));

/** Topik pemilik sebuah materi, soal, atau set (MAT.TRI.L.X → MAT.TRI). Set tingkat mapel (MAT.S.BANK) tidak punya topik. */
export function homeTopic(code: string) {
  const m = /^(.+?)\.(?:L|Q|S)\.[^.]+$/.exec(code);
  return m && m[1]!.includes('.') ? m[1]! : null;
}
const conceptTarget = (a: Authored) => a.kind === 'CONCEPT_MISCONCEPTIONS';

/** Semua isi satu lingkup di sebuah manifest. */
export function scopeContent(m: Manifest, scopes: Scope[]) {
  const topics = m.topics.filter(t => topicIn(t, scopes));
  const codes = new Set(topics.map(t => t.code));
  const concepts = new Set(topics.flatMap(t => t.concepts.map(c => c.code)));
  const owned = (code: string) => { const h = homeTopic(code); return h !== null && codes.has(h); };
  const questions = m.questions.filter(q => owned(q.code));
  const questionCodes = new Set(questions.map(q => q.code));
  return {
    topics, concepts, topicCodes: codes,
    lessons: m.lessons.filter(l => owned(l.code)),
    questions,
    sets: m.sets.sets.filter(s => owned(s.code)),
    relations: m.topicRelations.relations.filter(r => codes.has(r.from) || codes.has(r.to)),
    authored: (m.authored ?? []).filter(a => conceptTarget(a) ? concepts.has(a.target) : questionCodes.has(a.target)),
    subjects: m.subjects.subjects.filter(s => scopes.some(x => x.subject === s.code)),
  };
}

const withoutReview = (value: unknown): unknown => Array.isArray(value) ? value.map(withoutReview)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'review').map(([k, v]) => [k, withoutReview(v)])) : value;
const byCode = <T extends { code: string }>(xs: T[]) => [...xs].sort((a, b) => a.code.localeCompare(b.code));

/** Hash isi yang ditinjau, tanpa status review: penanda bahwa isi tidak berubah sejak ditandatangani. */
export function scopeHash(m: Manifest, scope: Scope) {
  const c = scopeContent(m, [scope]);
  const content = withoutReview({
    topics: byCode(c.topics), lessons: byCode(c.lessons), questions: byCode(c.questions), sets: byCode(c.sets),
    relations: [...c.relations].sort((a, b) => `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`)),
    authored: [...c.authored].sort((a, b) => `${a.kind}:${a.target}`.localeCompare(`${b.kind}:${b.target}`)),
    subjects: byCode(c.subjects),
  });
  return createHash('sha256').update(stable(content)).digest('hex');
}

export function scopeSummary(m: Manifest, scope: Scope) {
  const c = scopeContent(m, [scope]);
  return { topics: c.topics.length, concepts: c.concepts.size, lessons: c.lessons.length, questions: c.questions.length, sets: c.sets.length };
}

/** Salinan dengan setiap tag review PROPOSED menjadi REVIEWED (seperti catalog:signoff, tetapi hanya untuk isi lingkup). */
function reviewed<T>(value: T): T {
  const copy = structuredClone(value);
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>, r = o.review as Review | undefined;
    if (r?.status === 'PROPOSED') r.status = 'REVIEWED';
    Object.values(o).forEach(walk);
  };
  walk(copy); return copy;
}
const decisionsOf = (value: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach(v => decisionsOf(v, out));
  else if (value && typeof value === 'object') {
    const r = (value as { review?: Review }).review; if (r?.decision) out.add(r.decision);
    Object.values(value).forEach(v => decisionsOf(v, out));
  }
  return out;
};

export interface Pruned { kind: 'question' | 'lesson' | 'set' | 'relation' | 'prerequisite' | 'authored'; code: string; reason: string }
export interface ScopeChange { scope: string; added: string[]; changed: string[]; retired: string[] }

/**
 * Rilis = produksi aktif di luar lingkup + isi repo di dalam lingkup (sudah ditinjau).
 * live null berarti belum ada rilis: hanya lingkup yang ditandatangani yang terbit.
 */
export function composeRelease(live: Manifest | null, repo: Manifest, signed: { scope: Scope; signOff: SignOff }[], version: number) {
  const scopes = signed.map(s => s.scope);
  const inside = scopeContent(repo, scopes);
  const liveInside = live ? scopeContent(live, scopes) : null;
  const outside = <T>(xs: T[] | undefined, skip: (x: T) => boolean) => (xs ?? []).filter(x => !skip(x));
  const liveTopicsIn = liveInside?.topicCodes ?? new Set<string>();
  const ownedBy = (set: Set<string>) => (code: string) => { const h = homeTopic(code); return h !== null && set.has(h); };
  // Isi produksi yang dimiliki topik dalam lingkup diganti seluruhnya oleh versi repo (yang hilang di repo berarti ditarik).
  const scopeTopics = new Set([...inside.topicCodes, ...liveTopicsIn]);
  const inScopeCode = ownedBy(scopeTopics);

  let topics: Topic[] = [...outside(live?.topics, t => scopeTopics.has(t.code)), ...reviewed(inside.topics)];
  let questions: Question[] = [...outside(live?.questions, q => inScopeCode(q.code)), ...reviewed(inside.questions)];
  let lessons: Lesson[] = [...outside(live?.lessons, l => inScopeCode(l.code)), ...reviewed(inside.lessons)];
  // Set tingkat mapel (bank, gabungan): anggota produksi + anggota repo dari topik dalam lingkup.
  const repoSubjectSets = new Map(repo.sets.sets.filter(s => homeTopic(s.code) === null).map(s => [s.code, s]));
  let sets: PracticeSet[] = [
    ...outside(live?.sets.sets, s => inScopeCode(s.code)).map(s => {
      const r = homeTopic(s.code) === null ? repoSubjectSets.get(s.code) : undefined;
      return r ? { ...s, items: [...new Set([...s.items, ...r.items.filter(i => inScopeCode(i))])] } : s;
    }),
    ...reviewed(inside.sets),
    ...[...repoSubjectSets.values()].filter(s => !(live?.sets.sets ?? []).some(x => x.code === s.code))
      .map(s => reviewed({ ...s, items: s.items.filter(i => inScopeCode(i)) })),
  ].filter(s => s.items.length > 0);
  const relKey = (r: { from: string; to: string }) => `${r.from}>${r.to}`;
  let relations = [...outside(live?.topicRelations.relations, r => scopeTopics.has(r.from) || scopeTopics.has(r.to)), ...reviewed(inside.relations)];
  const insideAuthored = new Set(inside.authored.map(a => `${a.kind}:${a.target}`));
  const liveAuthoredOut = (live?.authored ?? []).filter(a => {
    const t = conceptTarget(a) ? topics.find(x => x.concepts.some(c => c.code === a.target))?.code : homeTopic(a.target);
    return !(t && scopeTopics.has(t)) && !insideAuthored.has(`${a.kind}:${a.target}`);
  });
  let authored: Authored[] = [...liveAuthoredOut, ...reviewed(inside.authored)];
  // Mapel: versi repo bila seluruh mapel ditandatangani, versi produksi bila sudah ada, versi repo bila baru dibutuhkan.
  const wholeSubject = (code: string) => scopes.some(x => x.subject === code && !x.phase);
  const subjects = [...new Set([...(live?.subjects.subjects ?? []).map(s => s.code), ...topics.map(t => t.subject)])].flatMap(code => {
    const fromRepo = repo.subjects.subjects.find(s => s.code === code), fromLive = live?.subjects.subjects.find(s => s.code === code);
    if (fromRepo && (wholeSubject(code) || !fromLive)) return [reviewed(fromRepo)];
    return fromLive ? [fromLive] : [];
  });

  // Sisihkan item yang rujukannya belum ikut terbit, sampai stabil.
  const pruned: Pruned[] = [];
  for (let round = 0; round < 10; round++) {
    const before = pruned.length;
    const concepts = new Set(topics.flatMap(t => t.concepts.map(c => c.code)));
    const topicCodes = new Set(topics.map(t => t.code));
    const missingConcept = (codes: string[]) => codes.find(c => !concepts.has(c));
    topics = topics.map(t => {
      const keep = t.prerequisites.filter(p => concepts.has(p.concept) && concepts.has(p.requires));
      for (const p of t.prerequisites.filter(p => !keep.includes(p))) pruned.push({ kind: 'prerequisite', code: `${p.concept} ← ${p.requires}`, reason: 'inti prasyarat belum terbit' });
      return keep.length === t.prerequisites.length ? t : { ...t, prerequisites: keep };
    });
    const lessonCodes = new Set(lessons.map(l => l.code));
    questions = questions.filter(q => {
      const refs = [...q.concepts.map(c => c.concept), ...q.body.hints.map(h => h.conceptCode), ...q.rubric.finalAnswerEvidence,
        ...q.rubric.solutionPaths.flatMap(p => p.steps.flatMap(s => s.concepts.map(c => c.code))), ...q.rubric.misconceptionMap.map(x => x.conceptCode),
        ...(q.rubric.recommend ?? []).map(r => r.conceptCode)];
      const miss = missingConcept(refs) ?? Object.values(q.rubric.lessonFor ?? {}).find(l => !lessonCodes.has(l));
      if (miss) pruned.push({ kind: 'question', code: q.code, reason: `merujuk ${miss} yang belum terbit` });
      return !miss;
    });
    const questionCodes = new Set(questions.map(q => q.code));
    sets = sets.flatMap(s => {
      const items = s.items.filter(i => questionCodes.has(i));
      if (items.length === s.items.length) return [s];
      if (homeTopic(s.code) === null && items.length) return [{ ...s, items }];
      pruned.push({ kind: 'set', code: s.code, reason: 'berisi soal yang belum terbit' }); return [];
    });
    const setCodes = new Set(sets.map(s => s.code));
    lessons = lessons.filter(l => {
      const miss = missingConcept(l.concepts) ?? l.checks.map(c => c.question).find(q => !questionCodes.has(q)) ?? (l.practiceSet && !setCodes.has(l.practiceSet) ? l.practiceSet : undefined);
      if (miss) pruned.push({ kind: 'lesson', code: l.code, reason: `merujuk ${miss} yang belum terbit` });
      return !miss;
    });
    relations = relations.filter(r => {
      const ok = topicCodes.has(r.from) && topicCodes.has(r.to);
      if (!ok) pruned.push({ kind: 'relation', code: relKey(r), reason: 'topik di salah satu ujung belum terbit' });
      return ok;
    });
    authored = authored.filter(a => {
      const ok = conceptTarget(a) ? concepts.has(a.target) : questionCodes.has(a.target);
      if (!ok) pruned.push({ kind: 'authored', code: `${a.kind}:${a.target}`, reason: 'sasaran belum terbit' });
      return ok;
    });
    if (pruned.length === before) break;
  }

  const items = { topics, questions, lessons, sets };
  const manifest: Manifest = {
    release: releaseOf(live?.release ?? null, repo.release, signed, version, items),
    subjects: { schemaVersion: 1, subjects },
    topicRelations: { schemaVersion: 1, relations },
    sets: { schemaVersion: 1, sets },
    unmapped: repo.unmapped,
    topics, questions, lessons, authored,
  };
  // Ringkasan perubahan per lingkup terhadap produksi.
  const liveIndex = new Map<string, string>(), nextIndex = new Map<string, string>();
  const index = (m: Pick<Manifest, 'topics' | 'questions' | 'lessons'>, into: Map<string, string>) => {
    for (const t of m.topics) into.set('topic:' + t.code, stable(withoutReview(t)));
    for (const q of m.questions) into.set('question:' + q.code, stable(withoutReview(q)));
    for (const l of m.lessons) into.set('lesson:' + l.code, stable(withoutReview(l)));
  };
  if (live) index(live, liveIndex); index(manifest, nextIndex);
  const changes: ScopeChange[] = signed.map(({ scope }) => {
    const mine = (key: string) => { const code = key.split(':')[1]!; const t = key.startsWith('topic:') ? code : homeTopic(code);
      const topic = [...topics, ...(live?.topics ?? [])].find(x => x.code === t); return !!topic && topicIn(topic, [scope]); };
    const keys = [...new Set([...liveIndex.keys(), ...nextIndex.keys()])].filter(mine);
    return { scope: scopeText(scope),
      added: keys.filter(k => !liveIndex.has(k) && nextIndex.has(k)),
      changed: keys.filter(k => liveIndex.has(k) && nextIndex.has(k) && liveIndex.get(k) !== nextIndex.get(k)),
      retired: keys.filter(k => liveIndex.has(k) && !nextIndex.has(k)) };
  });
  return { manifest, pruned, changes };
}

function releaseOf(live: Release | null, repo: Release, signed: { scope: Scope; signOff: SignOff }[], version: number, items: unknown): Release {
  const used = decisionsOf(items);
  const decisions = new Map((live?.decisions ?? []).map(d => [d.id, { ...d, status: 'APPROVED' as const }]));
  for (const d of repo.decisions) if (used.has(d.id) && !decisions.has(d.id)) decisions.set(d.id, { ...d, status: 'APPROVED' });
  const reviewers = [...(live?.signOff.reviewers ?? [])];
  for (const { scope, signOff } of signed) {
    const r = { name: signOff.name, role: `${signOff.role} · lingkup ${scopeText(scope)}`, date: signOff.date };
    if (!reviewers.some(x => x.name === r.name && x.role === r.role && x.date === r.date)) reviewers.push(r);
  }
  return { schemaVersion: 1, version, source: repo.source, signOff: { status: 'REVIEWED', reviewers }, decisions: [...decisions.values()], gaps: repo.gaps };
}

/** Baca dan periksa catalog/signoffs.yaml (sudah di-parse). Isi yang rusak ditolak, bukan dilewati diam-diam. */
export function checkSignOffFile(value: unknown): SignOffFile {
  const v = value as Partial<SignOffFile> | null;
  if (!v || v.schemaVersion !== 1 || !Array.isArray(v.signoffs)) throw new Error('signoffs.yaml harus berisi schemaVersion: 1 dan daftar signoffs');
  for (const [i, e] of v.signoffs.entries()) {
    parseScope(String(e?.scope));
    if (typeof e.name !== 'string' || !e.name.trim() || typeof e.role !== 'string' || !e.role.trim()) throw new Error(`signoffs[${i}]: name dan role wajib`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) || !/^[a-f0-9]{64}$/.test(String(e.contentSha256))) throw new Error(`signoffs[${i}]: date (YYYY-MM-DD) dan contentSha256 wajib`);
  }
  return v as SignOffFile;
}

/**
 * Lingkup yang boleh terbit: sign-off yang hash-nya sama dengan isi repo sekarang (yang terakhir bila ada beberapa).
 * Lingkup yang isinya berubah sesudah ditandatangani masuk "stale": versi produksinya yang dipertahankan.
 */
export function selectSignOffs(repo: Manifest, file: SignOffFile) {
  const byScope = new Map<string, SignOff[]>();
  for (const e of file.signoffs) { const key = scopeText(parseScope(e.scope)); byScope.set(key, [...(byScope.get(key) ?? []), e]); }
  const included: { scope: Scope; signOff: SignOff }[] = [], stale: { scope: Scope; lastSigned: SignOff; current: string }[] = [];
  for (const [key, entries] of byScope) {
    const scope = parseScope(key), current = scopeHash(repo, scope), match = entries.filter(e => e.contentSha256 === current).at(-1);
    if (match) included.push({ scope, signOff: match }); else stale.push({ scope, lastSigned: entries.at(-1)!, current });
  }
  return { included, stale };
}

/**
 * Rilis khusus kelas (release.ts --grades-only): isi produksi yang sedang aktif tetap PERSIS sama; satu-satunya perubahan
 * adalah kelas (grade) tiap inti yang sudah tayang, diambil dari repo. Tidak ada materi, soal, atau bab baru yang ikut,
 * jadi bab baru tetap menunggu sign-off guru. Kelas di luar fase bab di produksi diabaikan dan dilaporkan.
 */
export interface GradeChange { subject: string; topic: string; concept: string; from?: number; to: number }
export function withRepoGrades(live: Manifest, repo: Manifest, version: number): { manifest: Manifest; changed: GradeChange[]; skipped: string[] } {
  const manifest = structuredClone(live), changed: GradeChange[] = [], skipped: string[] = [];
  const repoGrade = new Map(repo.topics.flatMap(t => t.concepts.filter(c => c.grade !== undefined).map(c => [c.code, c.grade!] as const)));
  for (const t of manifest.topics) for (const c of t.concepts) {
    const to = repoGrade.get(c.code);
    if (to === undefined || to === c.grade) continue;
    if (!GRADES_OF_PHASE[t.phase].includes(to)) { skipped.push(`${c.code}: kelas ${to} di luar fase ${t.phase}`); continue; }
    changed.push({ subject: t.subject, topic: t.code, concept: c.code, ...(c.grade !== undefined ? { from: c.grade } : {}), to });
    c.grade = to;
  }
  manifest.release.version = version;
  return { manifest, changed, skipped };
}
