import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { Lesson, LessonBlock, PracticeSet, Question, Review, Topic } from '../../src/catalog/manifest.js';
import type { PilotExisting, PilotQuestion, PilotSlide, PilotTopic } from './pilot/types.js';
import { MAT_TOPICS, MAT_RELATIONS } from './pilot/mat.js';
import { MAT_EXISTING } from './pilot/mat-existing.js';
import { FIS_TOPICS, FIS_RELATIONS } from './pilot/fis.js';
import { KIM_TOPICS, KIM_RELATIONS } from './pilot/kim.js';
import { BIO_TOPICS, BIO_RELATIONS } from './pilot/bio.js';

// Usage: npm run catalog:pilot [-- --manifest catalog/manifest]
// Menulis konten pilot (topik, inti, soal pilihan ganda, materi dua slide) ke manifest katalog.
// Idempoten: file yang dibuat sebelumnya (review D7) dihapus dulu, lalu ditulis ulang dari scripts/catalog/pilot/.
// Semua entri baru membawa tag review PROPOSED D7: guru memeriksa kunci dan bahasa sebelum sign-off.

export const PILOT_DECISION = 'D7';
const TOPICS: PilotTopic[] = [...MAT_TOPICS, ...FIS_TOPICS, ...KIM_TOPICS, ...BIO_TOPICS];
const EXISTING: PilotExisting[] = MAT_EXISTING;
const RELATIONS = [...MAT_RELATIONS, ...FIS_RELATIONS, ...KIM_RELATIONS, ...BIO_RELATIONS];

/** Alias MAP inti pilot; FE (src/data/intiverse.ts) memakai rumus yang sama untuk menautkan peta ke katalog. */
export const aliasOf = (topic: string, core: string) =>
  `${topic.replace(/\.(C26|CP25)\./, '.').toLowerCase().replace(/\./g, '-')}-${core.toLowerCase().replace(/_/g, '-')}`;
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/&/g, ' DAN ').replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/, '');

const review = (fields: string[], evidence: string[]): Review => ({ status: 'PROPOSED', decision: PILOT_DECISION, fields, evidence });
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e'];
const SOURCE: Record<NonNullable<PilotQuestion['src']>, string> = {
  UN: 'Gaya soal Ujian Nasional SMA (kisi-kisi UN 2015–2019)',
  SNBT: 'Gaya soal UTBK-SNBT (Tes Skolastik dan Literasi)',
  KM: 'Gaya asesmen Kurikulum Merdeka (Capaian Pembelajaran 2022/2024)',
};

function question(topic: string, concept: string, key: string, n: number, q: PilotQuestion): Question {
  if (q.o.length < 2 || q.o.length > 5 || q.a < 0 || q.a >= q.o.length) throw new Error(`${topic} ${key} soal ${n}: opsi/kunci tidak valid`);
  if (new Set(q.o).size !== q.o.length) throw new Error(`${topic} ${key} soal ${n}: opsi kembar`);
  const code = `${topic}.Q.${key}_${n}`;
  return {
    schemaVersion: 1, code, familyCode: `${topic}.F.${key}_${n}`, visibility: 'PUBLIC_PRACTICE', origin: 'AUTHORED',
    itemType: 'MULTIPLE_CHOICE', contextTag: 'PILOT', difficulty: q.d ?? 2, estimatedMinutes: q.min ?? 2,
    provenance: { source: 'authored:pilot', note: `${SOURCE[q.src ?? 'UN']}; disusun ulang untuk IntiBelajar, bukan salinan soal resmi.` },
    aliases: [],
    concepts: [{ concept, role: 'PRIMARY', assessable: true }],
    body: { schemaVersion: 1, prompt: q.p, options: q.o.map((label, i) => ({ id: OPTION_IDS[i]!, label })), hints: [], answerFormat: 'OPTION' },
    rubric: {
      schemaVersion: 1, evaluator: 'option-v1', answer: { optionId: OPTION_IDS[q.a]! }, acceptedForms: [q.o[q.a]!],
      solutionPaths: [], misconceptionMap: [], finalAnswerEvidence: [concept],
      feedback: { correct: q.why, incorrect: `Jawabannya ${q.o[q.a]}. ${q.why}` },
    },
    review: review(['body', 'rubric', 'concepts'], ['soal pilot ditulis penulis konten; kunci dan pembahasan perlu dicek guru mata pelajaran']),
  };
}

function blocks(slides: PilotSlide[]): LessonBlock[] {
  return slides.flatMap((s, slide) => [
    { type: 'heading' as const, slide, text: s.h },
    ...s.t.map(text => ({ type: 'text' as const, slide, text })),
    ...(s.m ?? []).map(([name, expression], i) => ({ type: 'math' as const, slide, name, expression, ...(i === 0 ? { highlight: true } : {}) })),
    ...(s.tip ? [{ type: 'tip' as const, slide, text: s.tip }] : []),
  ]);
}

function lesson(topic: string, concept: string, key: string, title: string, minutes: number, slides: PilotSlide[], questions: Question[]): [Lesson, PracticeSet] {
  const set: PracticeSet = { code: `${topic}.S.${key}`, title: `Latihan ${title}`, origin: 'CONCEPT_LESSON', items: questions.map(q => q.code),
    review: review(['items'], ['semua soal inti ini'])};
  return [{
    schemaVersion: 1, code: `${topic}.L.${key}`, title, estimatedMinutes: minutes, aliases: [], concepts: [concept],
    blocks: blocks(slides),
    checks: questions.length ? [{ question: questions[0]!.code, ordinal: 0, slideIndex: 1, required: true }] : [],
    practiceSet: set.code,
    review: review(['blocks', 'concepts'], ['materi dua slide pilot; isi perlu dicek guru mata pelajaran']),
  }, set];
}

export function buildPilot() {
  const topics: Topic[] = [], questions: Question[] = [], lessons: Lesson[] = [], sets: PracticeSet[] = [];
  for (const t of TOPICS) {
    const codes = new Map<string, string>();
    for (const c of t.cores) {
      const code = `${t.code}.${slug(c.title)}`;
      if ([...codes.values()].includes(code)) throw new Error(`${t.code}: dua inti bernama ${c.title}`);
      codes.set(c.id, code);
    }
    const ref = (id: string) => { const code = codes.get(id); if (!code) throw new Error(`${t.code}: inti ${id} tidak ada`); return code; };
    topics.push({
      schemaVersion: 1, code: t.code, subject: t.subject, title: t.title, subtitle: t.subtitle, phase: t.phase, availability: 'MAPPED',
      bekal: t.bekal, aliases: t.alias ? [{ ns: 'TOPIC', value: t.alias }] : [], units: [],
      concepts: t.cores.map((c, i) => ({
        code: ref(c.id), title: c.title, ...(c.sub ? { subtitle: c.sub } : {}), objectives: [], misconceptions: [],
        ordinal: i + 1, estimatedMinutes: c.min ?? 5, hidden: false, capstone: !!c.capstone, availability: 'READY' as const,
        aliases: [{ ns: 'MAP' as const, value: aliasOf(t.code, c.id) }],
      })),
      prerequisites: t.edges.map(([from, to, kind]) => ({ concept: ref(to), requires: ref(from), kind: kind === 'H' ? 'HARD' as const : 'SOFT' as const })),
      review: review(['concepts', 'prerequisites'], ['inti dan urutan mengikuti peta referensi IntiVerse (Kurikulum Merdeka)']),
    });
    for (const c of t.cores) {
      const key = slug(c.id === 'C1' || c.id === 'C2' ? c.title : c.id), concept = ref(c.id);
      const qs = c.q.map((q, i) => question(t.code, concept, key, i + 1, q));
      const [l, s] = lesson(t.code, concept, key, c.title, c.min ?? 5, c.slides, qs);
      questions.push(...qs); lessons.push(l); sets.push(s);
    }
  }
  for (const e of EXISTING) {
    const qs = e.q.map((q, i) => question(e.topic, e.concept, e.key, i + 1, q));
    const [l, s] = lesson(e.topic, e.concept, e.key, e.title, e.min ?? 5, e.slides, qs);
    questions.push(...qs); lessons.push(l); sets.push(s);
  }
  return { topics, questions, lessons, sets };
}

const dump = (value: unknown) => stringify(value, { lineWidth: 0, aliasDuplicateObjects: false });
const isPilot = (file: string) => (parse(readFileSync(file, 'utf8')) as { review?: Review })?.review?.decision === PILOT_DECISION;

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dir = resolve(args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] ?? '' : 'catalog/manifest');
  const { topics, questions, lessons, sets } = buildPilot();
  for (const sub of ['questions', 'lessons', 'topics']) for (const name of readdirSync(join(dir, sub))) {
    const file = join(dir, sub, name);
    if (isPilot(file)) rmSync(file);
  }
  const write = (sub: string, code: string, value: unknown) => writeFileSync(join(dir, sub, `${code}.yaml`), dump(value));
  for (const t of topics) {
    const file = join(dir, 'topics', `${t.code}.yaml`);
    // Topik MAT lama yang masih PLANNED tanpa inti boleh diisi; topik yang sudah punya inti tidak pernah ditimpa.
    if (existsSync(file) && (parse(readFileSync(file, 'utf8')) as Topic).concepts.length) throw new Error(`${t.code} sudah punya inti; isi lewat PilotExisting`);
    const old = existsSync(file) ? parse(readFileSync(file, 'utf8')) as Topic : null;
    write('topics', t.code, { ...t, title: old?.title ?? t.title, aliases: old?.aliases.length ? old.aliases : t.aliases });
  }
  // Konsep lama yang kini punya materi dan soal menjadi READY (READY = diajarkan atau dinilai, D6).
  for (const code of new Set(EXISTING.map(e => e.topic))) {
    const file = join(dir, 'topics', `${code}.yaml`), topic = parse(readFileSync(file, 'utf8')) as Topic;
    for (const c of topic.concepts) if (EXISTING.some(e => e.concept === c.code)) c.availability = 'READY';
    writeFileSync(file, dump(topic));
  }
  for (const q of questions) write('questions', q.code, q);
  for (const l of lessons) write('lessons', l.code, l);

  const setsFile = join(dir, 'sets.yaml'), setsDoc = parse(readFileSync(setsFile, 'utf8')) as { schemaVersion: 1; sets: PracticeSet[] };
  setsDoc.sets = [...setsDoc.sets.filter(s => s.review?.decision !== PILOT_DECISION), ...sets];
  writeFileSync(setsFile, dump(setsDoc));

  const subjectsFile = join(dir, 'subjects.yaml'), subjects = parse(readFileSync(subjectsFile, 'utf8')) as { subjects: { code: string; availability: string }[] };
  for (const s of subjects.subjects) if (topics.some(t => t.subject === s.code)) s.availability = 'AVAILABLE';
  writeFileSync(subjectsFile, dump(subjects));

  const relFile = join(dir, 'topic-relations.yaml'), rel = parse(readFileSync(relFile, 'utf8')) as { relations: { from: string; to: string; review?: Review }[] };
  const kept = rel.relations.filter(r => r.review?.decision !== PILOT_DECISION);
  rel.relations = [...kept, ...RELATIONS.filter(r => !kept.some(k => k.from === r.from && k.to === r.to)).map(r => ({
    ...r, source: 'CURRICULUM', review: review(['kind', 'label'], ['hubungan antartopik dari peta referensi IntiVerse']) }))];
  writeFileSync(relFile, dump(rel));

  const releaseFile = join(dir, 'release.yaml'), release = parse(readFileSync(releaseFile, 'utf8')) as { version: number; decisions: { id: string; status: string; summary: string }[] };
  release.version = Math.max(release.version, 2);
  if (!release.decisions.some(d => d.id === PILOT_DECISION)) release.decisions.push({ id: PILOT_DECISION, status: 'PROPOSED',
    summary: 'Konten pilot MaFiKiBio (scripts/catalog/pilot): topik dan inti dari peta IntiVerse, soal pilihan ganda bergaya UN/UTBK-SNBT yang disusun ulang (bukan salinan soal resmi), dan materi dua slide per inti. Guru mata pelajaran memeriksa kunci, pembahasan, dan bahasa; daftar periksa di catalog/pilot-review.md.' });
  writeFileSync(releaseFile, dump(release));

  writeFileSync(resolve(dir, '../pilot-review.md'), reviewSheet(topics, questions, lessons));
  console.log(`Konten pilot ditulis: ${topics.length} topik, ${topics.reduce((n, t) => n + t.concepts.length, 0)} inti baru, ${questions.length} soal, ${lessons.length} materi`);
}

/** Lembar periksa untuk guru: setiap soal dengan kuncinya, dikelompokkan per topik. */
function reviewSheet(topics: Topic[], questions: Question[], lessons: Lesson[]) {
  const lines = ['# Lembar periksa konten pilot (D7)', '', 'Dibuat oleh `npm run catalog:pilot`. Centang setelah kunci, pembahasan, dan bahasa diperiksa.', ''];
  const byTopic = new Map<string, Question[]>();
  for (const q of questions) { const t = q.code.split('.Q.')[0]!; byTopic.set(t, [...(byTopic.get(t) ?? []), q]); }
  for (const [topic, qs] of byTopic) {
    lines.push(`## ${topics.find(t => t.code === topic)?.title ?? topic} (${topic})`, '', `Materi: ${lessons.filter(l => l.code.startsWith(topic + '.L.')).length} · Soal: ${qs.length}`, '');
    for (const q of qs) {
      const key = q.body.options!.find(o => o.id === q.rubric.answer.optionId)!;
      lines.push(`- [ ] **${q.code}** — ${q.body.prompt}`, `  ${q.body.options!.map(o => `${o.id.toUpperCase()}. ${o.label}`).join(' · ')}`, `  Kunci: **${key.id.toUpperCase()}** · ${q.rubric.feedback!.correct}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
