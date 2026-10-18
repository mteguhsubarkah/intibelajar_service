import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  aliasIndex, isUnmapped, loadManifest, writeManifest,
  type Alias, type Concept, type Lesson, type LessonBlock, type Manifest, type Namespace, type PracticeSet, type Question, type Review, type Topic,
} from '../../src/catalog/manifest.js';
// One-time draft of the alias manifest from the Vue checkout's src/data (Slice 1 M1, plan 03 §3).
// Every inference is a PROPOSED review tag that carries its evidence. After review the manifest is
// the source of truth: this script then only checks that the frontend references nothing unmapped.
//
//   npm run catalog:extract [-- --frontend <dir>] [--out catalog/manifest] [--force]
//   npm run catalog:extract -- --check     coverage + freeze drift, writes nothing

export const EXTRACTOR = 'extract-from-frontend v1';
const FREEZE_FILE = 'legacy-alias-freeze.json';

/* ---------- frontend data, loaded as the shipped modules evaluate it ---------- */

// Loosely typed views of the frontend modules; only the fields used here.
interface FeCore { id: string; minutes: number; title: string; subtitle?: string; hidden?: boolean; capstone?: boolean }
interface FeTopic { id: string; title: string; subtitle: string; fase: string; bekal: string[]; cores: FeCore[]; edges: { from: string; to: string; kind?: string }[] }
interface FeCheck { id?: string; question: string; options: { text: string; ok: boolean }[]; right: string; wrong: string }
interface FeLessonQuestion { question: string; figure?: string; options: string[]; answer: number; right: string; wrong: string }
interface FeLesson { title: string; coreId: string; playable?: boolean; chunks: { title: string; paragraphs: string[]; figure?: string; formulas?: { name: string; eq: string; on?: boolean }[]; check: FeCheck }[]; practice: FeLessonQuestion[] }
interface FeBankItem { id: string; text: string; topics: string[]; cores: string[]; difficulty: number; minutes: number; kind: string; options?: string[]; answer?: number; explain?: string }
interface FeOption { id: string; label: string; value?: number; accepts?: string[]; misconception?: string }
interface FeTypedQuestion {
  id: string; title: string; prompt: string; answerExample: string; options: FeOption[]; correctAnswerId: string;
  diagnosticSteps: { id: string }[]; diagnosis?: { cores: { kind: string; coreId: string; stepId?: string; prerequisites: string[]; evidence: { mastered: string } }[] };
}
interface FeTypedCore { id: string; title: string; estimatedMinutes: number; objective: string; explanation: string[]; checks: { id: string; prompt: string; options: { id: string; label: string }[]; correctOptionId: string }[] }
interface FeNode { id: string; title: string; availability: string; coreId?: string; prerequisites: string[] }
export interface Frontend {
  curriculum: { TOPICS: FeTopic[]; UNITS: Record<string, { id: string; title: string; goal: string; coreIds: string[] }[]>; UNMAPPED_TOPICS: { id: string; title: string; fase: string; subtitle: string }[]; RELATIONS: { from: string; to: string; kind: string; label: string; source: string }[] };
  subjects: { APP_SUBJECTS: { id: string; title: string; available: boolean }[] };
  coba: {
    TOPICS: { id: string; available: boolean }[]; SUBJECTS: { id: string; title: string }[]; CHECKS: FeCheck[]; PRACTICE: (FeLessonQuestion & { id: string; text: string })[];
    QUESTION: { title: string; prompt: string }; SOLUTION: { steps: { title: string; body: string }[]; after: string[] }; HINT: { steps: { core: string; lead: string; note: string }[] };
    CORE_ROUTES: Record<string, string>; TOWER_PARTS: string[]; FUNNEL_CORE: string; MATERI_CHECK: string; LEAD_TO: Record<string, string>; OPEN_LOOP: Record<string, { coreId: string; route: string }>;
  };
  coreLessons: { CORE_LESSONS: Record<string, FeLesson>; chunkCheckId: (route: string, i: number) => string; questionCheckId: (route: string, i: number) => string };
  bank: { BANK: FeBankItem[] };
  typedQuestions: { trigDepression01: FeTypedQuestion; trigDepression01Retry: FeTypedQuestion };
  typedCores: { identifySidesAgainstAngle: FeTypedCore; selectTanFromDiagram: FeTypedCore; buildEquationFromRatio: FeTypedCore };
  trigMap: { TRIGONOMETRY_MAP: FeNode[] };
}
export interface Source { frontendCommit: string; frontendDataDirty: boolean }

export async function loadFrontend(frontendDir: string): Promise<{ fe: Frontend; source: Source }> {
  const src = join(frontendDir, 'src');
  if (!existsSync(join(src, 'data', 'curriculum.ts'))) throw new Error(`No Vue checkout at ${frontendDir} (set FRONTEND_DIR or --frontend)`);
  const modules = { curriculum: 'data/curriculum.ts', subjects: 'data/subjects.ts', coba: 'data/coba.ts', coreLessons: 'data/coreLessons.ts', bank: 'data/bank.ts',
    typedQuestions: 'data/questions/trigDepression01.ts', typedCores: 'data/cores/index.ts', trigMap: 'data/curriculum/trigonometry.ts' };
  const contents = Object.entries(modules).map(([name, file]) => `export * as ${name} from ${JSON.stringify(join(src, file).replaceAll('\\', '/'))};`).join('\n');
  const out = await build({ stdin: { contents, resolveDir: frontendDir, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@': src }, logLevel: 'silent' });
  const dir = mkdtempSync(join(tmpdir(), 'ib-extract-'));
  try {
    const file = join(dir, 'frontend-data.mjs');
    writeFileSync(file, out.outputFiles[0]!.text);
    const fe = await import(pathToFileURL(file).href) as Frontend;
    const git = (...args: string[]) => spawnSync('git', ['-C', frontendDir, ...args], { encoding: 'utf8' });
    const head = git('rev-parse', 'HEAD'), status = git('status', '--porcelain', '--', 'src/data');
    return { fe, source: { frontendCommit: head.status === 0 ? head.stdout.trim() : 'unknown', frontendDataDirty: status.status !== 0 || status.stdout.trim() !== '' } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/* ---------- proposal tables: every non-mechanical choice is written down here ---------- */

// D3: codes. Topic and subject codes are a fixed table so a new frontend topic fails loudly instead of inventing one.
const SUBJECT_CODES: Record<string, string> = { matematika: 'MAT', fisika: 'FIS', kimia: 'KIM', biologi: 'BIO', inggris: 'ING', pemrograman: 'PRO' };
const SUBJECT_EXTRA_ALIASES: Record<string, string[]> = { PRO: ['cs'] }; // coba.ts SUBJECTS uses "cs" for Pemrograman
const TOPIC_CODES: Record<string, string> = {
  eksponen: 'MAT.EKS', barisan: 'MAT.BAR', trigonometri: 'MAT.TRI', vektor: 'MAT.VEK',
  spltv: 'MAT.SPL', kuadrat: 'MAT.KUA', statpel: 'MAT.STP', bunga: 'MAT.BNG', matriks: 'MAT.MTX', invers: 'MAT.INV', kalkulus: 'MAT.KAL',
};
// D6: the typed flow (curriculum/trigonometry.ts, data/cores) names concepts T04/T10/T13. Two match a map concept by meaning; T13 has none.
const TYPED_CONCEPTS: Record<string, { map?: string; evidence: string }> = {
  T04: { map: 'tri-c', evidence: 'T04 "Mengenali Sisi Terhadap Sudut" teaches naming depan/samping/miring against the reference angle; tri-c is "Segitiga Siku-siku: Sisi depan · samping · miring"' },
  T10: { map: 'tri-d', evidence: 'T10 "Memilih Tan dari Diagram" teaches choosing the ratio from known sides; tri-d is "Definisi sin, cos, tan: Perbandingan sisi"' },
  T13: { evidence: 'T13 "Mencari Sisi yang Belum Diketahui" (solve the side from a correct ratio) has no counterpart in curriculum.ts; proposed as a new concept without a MAP alias' },
};
// D6: funnel items in coba.ts carry no concept field. Mapping by what each item asks.
const FUNNEL_ITEM_CONCEPTS: Record<string, { core: string; evidence: string }> = {
  c1: { core: 'tri-c', evidence: 'asks which side faces the 30° angle (side naming)' },
  c2: { core: 'tri-d', evidence: 'asks which ratio uses depan and samping' },
  c3: { core: 'tri-c', evidence: 'asks which side the ground shadow is (side naming)' },
  c4: { core: 'tri-d', evidence: 'MATERI_CHECK; answering it records progress on FUNNEL_CORE tri-d (useCobaFlow)' },
  p1: { core: 'tri-d', evidence: 'asks which ratio links depan and miring' },
  p2: { core: 'tri-d', evidence: 'asks which ratio links samping and miring' },
  p3: { core: 'tri-d', evidence: 'asks which ratio links depan and samping' },
};
// D5: the tower question exists as coba/bank "soal-menara" and typed "trig-depression-01" (+ its retry). Same numbers, different wording.
const TOWER_FAMILY = 'MAT.TRI.F.TOWER_DEPRESSION_30';
const TOWER_EVIDENCE = 'soal-menara (coba.ts/bank.ts) and trig-depression-01 (questions/) are the same 20 m / 30° depression situation with different wording; trig-depression-01-retry is its declared retry. Proposed: separate questions, one family (INV-13: anchor and retries never count as independent transfer)';
// Context tags (K05 variation) by keyword; anything without a situation is BARE_VALUE or CONCEPTUAL.
const CONTEXT_KEYWORDS: [RegExp, string][] = [[/menara/i, 'MENARA'], [/tangga/i, 'TANGGA'], [/pohon/i, 'POHON'], [/gedung/i, 'GEDUNG'], [/bayangan/i, 'BAYANGAN']];
const contextTag = (text: string) => CONTEXT_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? (/[=…]|berapa nilai|\d+°.*=|^sin|^cos|^tan/i.test(text) ? 'BARE_VALUE' : 'CONCEPTUAL');
const TOLERANCE = { relative: 0.02, floor: 1 }; // services/answer/answerChecker.ts RELATIVE_TOLERANCE, scale floor 1

/* ---------- helpers ---------- */

export const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50).replace(/_+$/, '');
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
const proposed = (decision: string, fields: string[], ...evidence: string[]): Review => ({ status: 'PROPOSED', decision, fields, evidence });
const alias = (ns: Namespace, ...values: string[]): Alias[] => values.map(value => ({ ns, value }));
const PHASES: Record<string, Topic['phase']> = { D: 'D', E: 'E', F: 'F', 'F+': 'F+' };
const phase = (fase: string) => { const p = PHASES[fase]; if (!p) throw new Error(`Unknown fase ${fase}`); return p; };
const topicCode = (id: string) => { const c = TOPIC_CODES[id]; if (!c) throw new Error(`No topic code for "${id}": add it to TOPIC_CODES (decision D3)`); return c; };

/* ---------- the manifest ---------- */

export function buildManifest(fe: Frontend, source: Source): Manifest {
  const { curriculum, coba, coreLessons, bank } = fe;
  const mapCode = new Map<string, string>(), conceptByCode = new Map<string, Concept>();
  const gaps: string[] = [];

  // Topics and concepts. curriculum.ts sorts cores into learning order at import, so ordinals follow the units.
  const topics: Topic[] = curriculum.TOPICS.map(t => {
    const tc = topicCode(t.id);
    const units = (curriculum.UNITS[t.id] ?? []).map((u, i) => ({ code: `${tc}.U${i + 1}`, legacyId: u.id, title: u.title, goal: u.goal, ordinal: i + 1 }));
    const unitOf = new Map((curriculum.UNITS[t.id] ?? []).flatMap((u, i) => u.coreIds.map(id => [id, `${tc}.U${i + 1}`] as const)));
    const concepts = t.cores.map((c, i): Concept => {
      let code = `${tc}.${slug(c.title)}`;
      if (conceptByCode.has(code)) code = `${code}_${slug(c.id)}`;
      const concept: Concept = {
        code, title: c.title, ...(c.subtitle ? { subtitle: c.subtitle } : {}), objectives: [], misconceptions: [],
        ...(unitOf.get(c.id) ? { unit: unitOf.get(c.id)! } : {}), ordinal: i + 1, estimatedMinutes: c.minutes,
        hidden: !!c.hidden, capstone: !!c.capstone, availability: 'PLANNED', aliases: alias('MAP', c.id),
      };
      mapCode.set(c.id, code); conceptByCode.set(code, concept);
      return concept;
    });
    return {
      schemaVersion: 1, code: tc, subject: 'MAT', title: t.title, subtitle: t.subtitle, phase: phase(t.fase), availability: 'MAPPED', bekal: t.bekal,
      aliases: alias('TOPIC', t.id), units, concepts,
      prerequisites: t.edges.map(e => ({ concept: mapCode.get(e.to)!, requires: mapCode.get(e.from)!, kind: e.kind === 'soft' ? 'SOFT' as const : 'HARD' as const })),
    };
  });
  for (const u of curriculum.UNMAPPED_TOPICS) topics.push({
    schemaVersion: 1, code: topicCode(u.id), subject: 'MAT', title: u.title, subtitle: u.subtitle, phase: phase(u.fase), availability: 'PLANNED',
    bekal: [], aliases: alias('TOPIC', u.id), units: [], concepts: [], prerequisites: [],
  });
  const tri = topics.find(t => t.code === 'MAT.TRI')!;
  const mc = (legacy: string) => { const c = mapCode.get(legacy); if (!c) throw new Error(`Unknown map concept ${legacy}`); return c; };

  // Typed concepts (T04/T10/T13): aliases on existing concepts, or a new concept, plus objectives and the typed map's prerequisites.
  const typedCode = new Map<string, string>();
  const typedCores = [fe.typedCores.identifySidesAgainstAngle, fe.typedCores.selectTanFromDiagram, fe.typedCores.buildEquationFromRatio];
  for (const core of typedCores) {
    const plan = TYPED_CONCEPTS[core.id];
    if (!plan) throw new Error(`Typed core ${core.id} has no entry in TYPED_CONCEPTS (decision D6)`);
    let concept: Concept;
    if (plan.map) concept = conceptByCode.get(mc(plan.map))!;
    else {
      concept = {
        code: `MAT.TRI.${slug(core.title)}`, title: core.title, objectives: [], misconceptions: [], unit: 'MAT.TRI.U2',
        ordinal: Math.max(...tri.concepts.map(c => c.ordinal)) + 1, estimatedMinutes: core.estimatedMinutes, hidden: false, capstone: false, availability: 'PLANNED', aliases: [],
      };
      tri.concepts.push(concept); conceptByCode.set(concept.code, concept);
    }
    concept.aliases.push(...alias('TYPED_MAP', core.id));
    concept.objectives.push(core.objective);
    concept.review = proposed('D6', [plan.map ? 'aliases.TYPED_MAP' : 'whole concept', 'objectives'], plan.evidence, `objective copied from data/cores (${core.id})`);
    typedCode.set(core.id, concept.code);
  }
  const typedNodes = fe.trigMap.TRIGONOMETRY_MAP;
  for (const node of typedNodes.filter(n => n.coreId && !TYPED_CONCEPTS[n.coreId]?.map))
    for (const p of node.prerequisites.filter(p => typedCode.has(p)))
      tri.prerequisites.push({ concept: typedCode.get(node.coreId!)!, requires: typedCode.get(p)!, kind: 'HARD',
        review: proposed('D6', ['kind'], `curriculum/trigonometry.ts: ${node.id} lists ${p} as a prerequisite`) });
  // Planned typed-map nodes alias a map concept only on an exact title match; everything else is listed as unmapped.
  const unmapped: Manifest['unmapped']['entries'] = [];
  const byTitle = new Map(tri.concepts.map(c => [c.title, c]));
  for (const node of typedNodes.filter(n => !n.coreId)) {
    const match = byTitle.get(node.title);
    if (match) {
      match.aliases.push(...alias('TYPED_MAP', node.id));
      match.review ??= proposed('D6', ['aliases.TYPED_MAP'], `curriculum/trigonometry.ts node "${node.id}" has the same title "${node.title}"`);
    } else unmapped.push({ ns: 'TYPED_MAP', value: node.id, reason: node.id === 'soal-serupa'
      ? 'Navigation node of the typed map that leads to the retry question; not a concept'
      : `Display-only "${node.availability}" node of the typed trigonometry map ("${node.title}"); no content and no exact title match. Reviewer may alias it to a curriculum.ts concept` });
  }
  gaps.push('curriculum/trigonometry.ts declares its own prerequisite graph (e.g. sudut-depresi-elevasi requires grafik-fungsi) that disagrees with curriculum.ts edges; only curriculum.ts edges and the T13 prerequisites were imported.');

  // Questions.
  const questions: Question[] = [];
  const familyCodes = new Set<string>();
  const mcq = (o: { code: string; aliases: Alias[]; prompt: string; options: string[]; answer: number; concepts: string[]; right?: string; wrong?: string;
    figure?: string; difficulty?: number; minutes?: number; source: string; evidence: string[] }): Question => {
    const ids = letters(o.options.length);
    if (!(o.answer >= 0 && o.answer < ids.length)) throw new Error(`${o.code}: answer index out of range`);
    const primary = [...new Set(o.concepts)];
    return {
      schemaVersion: 1, code: o.code, familyCode: o.code.replace('.Q.', '.F.'), visibility: 'PUBLIC_PRACTICE', origin: 'AUTHORED', itemType: 'MULTIPLE_CHOICE',
      contextTag: contextTag(o.prompt), difficulty: o.difficulty ?? 1, estimatedMinutes: o.minutes ?? 1, provenance: { source: o.source }, aliases: o.aliases,
      legacyOptionOrder: ids, concepts: primary.map(concept => ({ concept, role: 'PRIMARY', assessable: true })),
      body: { schemaVersion: 1, prompt: o.prompt, ...(o.figure ? { figureRef: o.figure } : {}), options: o.options.map((label, i) => ({ id: ids[i]!, label })), hints: [], answerFormat: 'OPTION' },
      rubric: { schemaVersion: 1, evaluator: 'option-v1', answer: { optionId: ids[o.answer]! }, acceptedForms: [o.options[o.answer]!], solutionPaths: [], misconceptionMap: [],
        finalAnswerEvidence: primary, ...(o.right || o.wrong ? { feedback: { ...(o.right ? { correct: o.right } : {}), ...(o.wrong ? { incorrect: o.wrong } : {}) } } : {}) },
      review: proposed('D6', ['concepts', 'finalAnswerEvidence', 'contextTag', 'visibility'], ...o.evidence,
        'visibility PUBLIC_PRACTICE: the key already ships in the frontend bundle (D4)', `contextTag ${contextTag(o.prompt)} from the keyword table`),
    };
  };
  const checkAnswer = (c: FeCheck, where: string) => {
    const ok = c.options.flatMap((o, i) => o.ok ? [i] : []);
    if (ok.length !== 1) throw new Error(`${where}: expected exactly one correct option, found ${ok.length}`);
    return ok[0]!;
  };

  // Funnel checks c1–c4 and practice p1–p3 (coba.ts).
  for (const c of coba.CHECKS) questions.push(mcq({ code: `MAT.TRI.Q.FUNNEL_${slug(c.id!)}`, aliases: alias('ITEM', c.id!), prompt: c.question, options: c.options.map(o => o.text),
    answer: checkAnswer(c, c.id!), concepts: [mc(FUNNEL_ITEM_CONCEPTS[c.id!]!.core)], right: c.right, wrong: c.wrong, source: 'frontend:src/data/coba.ts CHECKS',
    evidence: [`${c.id}: ${FUNNEL_ITEM_CONCEPTS[c.id!]!.evidence}`] }));
  for (const p of coba.PRACTICE) questions.push(mcq({ code: `MAT.TRI.Q.FUNNEL_${slug(p.id)}`, aliases: alias('ITEM', p.id), prompt: p.text, options: p.options, answer: p.answer,
    concepts: [mc(FUNNEL_ITEM_CONCEPTS[p.id]!.core)], right: p.right, wrong: p.wrong, source: 'frontend:src/data/coba.ts PRACTICE', evidence: [`${p.id}: ${FUNNEL_ITEM_CONCEPTS[p.id]!.evidence}`] }));

  // Lesson chunk checks and lesson practice (coreLessons.ts). Practice items also appear in bank.ts as `${route}:${i}`.
  const bankById = new Map(bank.BANK.map(b => [b.id, b]));
  const lessonPractice = new Map<string, string[]>();
  for (const [route, lesson] of Object.entries(coreLessons.CORE_LESSONS)) {
    const lessonConcept = mc(lesson.coreId);
    lesson.chunks.forEach((chunk, i) => questions.push(mcq({ code: `MAT.TRI.Q.${slug(route)}_C${i}`, aliases: alias('ITEM', coreLessons.chunkCheckId(route, i)), prompt: chunk.check.question,
      options: chunk.check.options.map(o => o.text), answer: checkAnswer(chunk.check, `${route} chunk ${i}`), concepts: [lessonConcept], right: chunk.check.right, wrong: chunk.check.wrong,
      source: `frontend:src/data/coreLessons.ts ${route} chunks[${i}].check`, evidence: [`chunk check of lesson ${route}, whose coreId is ${lesson.coreId}`] })));
    lessonPractice.set(route, lesson.practice.map((q, i) => {
      const bankItem = bankById.get(`${route}:${i}`);
      const cores = bankItem?.cores ?? [lesson.coreId];
      questions.push(mcq({ code: `MAT.TRI.Q.${slug(route)}_P${i}`, aliases: alias('ITEM', `${route}:${i}`, coreLessons.questionCheckId(route, i)), prompt: q.question, options: q.options, answer: q.answer,
        concepts: cores.map(mc), right: q.right, wrong: q.wrong, figure: q.figure, difficulty: bankItem?.difficulty, minutes: bankItem?.minutes,
        source: `frontend:src/data/coreLessons.ts ${route} practice[${i}]`,
        evidence: [bankItem ? `bank.ts LESSON_CORES maps ${route} practice to ${cores.join(', ')}` : `no bank entry; lesson coreId ${lesson.coreId}`, 'positional legacy ids frozen as recorded (plan 03 §1.2.4)'] }));
      return `MAT.TRI.Q.${slug(route)}_P${i}`;
    }));
  }

  // Remaining bank items: option items, and the tower question (FREE_RESPONSE, tower-v1 in Slice 2).
  for (const b of bank.BANK.filter(b => !/:\d+$/.test(b.id))) {
    const tc = topicCode(b.topics[0]!);
    if (b.options && b.answer !== undefined) questions.push(mcq({ code: `${tc}.Q.${slug(b.id)}`, aliases: alias('ITEM', b.id), prompt: b.text, options: b.options, answer: b.answer,
      concepts: b.cores.map(mc), right: b.explain, wrong: b.explain, difficulty: b.difficulty, minutes: b.minutes, source: 'frontend:src/data/bank.ts',
      evidence: [`bank.ts cores ${b.cores.join(', ')} (all proposed PRIMARY and assessable)`, ...(b.kind === 'gabungan' ? ['kind gabungan: K02 question application across topics; creates no prerequisite edge (INV-17)'] : [])] }));
  }
  const menara = bankById.get('soal-menara');
  if (!menara) throw new Error('bank.ts no longer contains soal-menara');
  const towerValue = round(20 / Math.tan(Math.PI / 6));
  const towerConcepts = coba.TOWER_PARTS.map(mc);
  questions.push({
    schemaVersion: 1, code: 'MAT.TRI.Q.SOAL_MENARA', familyCode: TOWER_FAMILY, visibility: 'PUBLIC_PRACTICE', origin: 'AUTHORED', itemType: 'FREE_RESPONSE',
    contextTag: 'MENARA', difficulty: menara.difficulty, estimatedMinutes: menara.minutes, provenance: { source: 'frontend:src/data/bank.ts + coba.ts QUESTION/SOLUTION/HINT' },
    aliases: alias('ITEM', 'soal-menara'), concepts: towerConcepts.map(concept => ({ concept, role: 'PRIMARY', assessable: true })),
    body: { schemaVersion: 1, prompt: menara.text, hints: coba.HINT.steps.map((h, i) => ({ step: i + 1, conceptCode: mc(h.core), lead: h.lead, ...(h.note ? { note: h.note } : {}) })), answerFormat: 'TEXT' },
    rubric: {
      schemaVersion: 1, evaluator: 'tower-v1', answer: { value: towerValue, unit: 'm', tolerance: TOLERANCE }, acceptedForms: coba.SOLUTION.after,
      solutionPaths: [{ code: 'TAN', label: 'tan dari sisi depan dan samping', steps: coba.SOLUTION.steps.map((s, i) => ({
        code: `S${i + 1}`, description: `${s.title}: ${s.body}`, concepts: [{ code: mc(coba.HINT.steps[i]?.core ?? coba.TOWER_PARTS[i]!), role: 'REQUIRED' as const }] })) }],
      misconceptionMap: [], finalAnswerEvidence: towerConcepts, workedSolution: coba.SOLUTION,
    },
    review: proposed('D5', ['familyCode', 'solutionPaths', 'finalAnswerEvidence', 'visibility'], TOWER_EVIDENCE,
      'solution steps paired with HINT.steps cores in order (sides → ratio → special angle)', 'tower-v1 branch rules (services/analysis.ts) are ported in Slice 2; Slice 1 publishes the item but no QUESTION_LOOP uses it'),
  });

  // Typed questions (questions/trigDepression01.ts): free numeric entry graded against option values; distractors are known errors.
  const numeric = (q: FeTypedQuestion, code: string, isRetry: boolean): Question => {
    const correct = q.options.find(o => o.id === q.correctAnswerId);
    if (correct?.value === undefined) throw new Error(`${q.id}: correct option has no value`);
    const ratioConcept = typedCode.get('T10')!;
    const concepts = ['T04', 'T10', 'T13'].map(t => typedCode.get(t)!);
    const misconceptions = q.options.filter(o => o !== correct && o.misconception && o.value !== undefined);
    for (const o of misconceptions) {
      const concept = conceptByCode.get(ratioConcept)!, mcode = slug(o.misconception!);
      if (!concept.misconceptions.some(x => x.code === mcode)) concept.misconceptions.push({ code: mcode, description: o.misconception!.charAt(0).toUpperCase() + o.misconception!.slice(1), indicators: [`${q.id}: jawaban ${o.label}`] });
    }
    const rule = q.diagnosis?.cores ?? [];
    return {
      schemaVersion: 1, code, familyCode: TOWER_FAMILY, visibility: 'PUBLIC_PRACTICE', origin: 'AUTHORED', itemType: 'NUMERIC', contextTag: contextTag(q.prompt),
      difficulty: 2, estimatedMinutes: 2, provenance: { source: 'frontend:src/data/questions/trigDepression01.ts', note: `title "${q.title}"` },
      aliases: alias('ITEM', q.id), concepts: concepts.map(concept => ({ concept, role: 'PRIMARY', assessable: true })),
      body: { schemaVersion: 1, prompt: q.prompt, hints: [], answerFormat: 'NUMBER', answerExample: q.answerExample },
      rubric: {
        schemaVersion: 1, evaluator: 'numeric-v1', answer: { value: round(correct.value), unit: 'm', tolerance: TOLERANCE },
        acceptedForms: [correct.label, ...(correct.accepts ?? [])],
        solutionPaths: rule.length ? [{ code: 'TAN', label: 'Rantai sudut → sisi → rasio → persamaan', steps: rule.map(r => ({
          code: slug(r.stepId ?? 'final-answer'), description: r.evidence.mastered, concepts: [{ code: typedCode.get(r.coreId)!, role: 'REQUIRED' as const }] })) }] : [],
        misconceptionMap: misconceptions.map(o => ({ pattern: { kind: 'NUMERIC' as const, value: round(o.value!) }, conceptCode: ratioConcept, misconceptionCode: slug(o.misconception!), explanation: `Kamu ${o.misconception}.` })),
        finalAnswerEvidence: [typedCode.get('T13')!],
      },
      review: proposed('D5', ['familyCode', 'concepts', 'finalAnswerEvidence', 'misconceptionMap'], TOWER_EVIDENCE,
        isRetry ? 'retry carries no diagnosis rule; concepts copied from its anchor' : 'concepts and steps from the question\'s DiagnosticRule (T04 → T10 → T13); misconceptions attributed to the ratio concept (T10)'),
    };
  };
  questions.push(numeric(fe.typedQuestions.trigDepression01, 'MAT.TRI.Q.TRIG_DEPRESSION_01', false));
  questions.push(numeric(fe.typedQuestions.trigDepression01Retry, 'MAT.TRI.Q.TRIG_DEPRESSION_01_RETRY', true));
  gaps.push('trig-depression-01 diagnosticSteps (angle-reference, ratio-selection) are follow-up prompts with their own options; 03 §7 has no value object for them, so they are not imported. Decide in Slice 2 (QUESTION_LOOP clarification).');
  gaps.push('The /coba funnel lesson ("materi", two slides, check c4) lives in a Vue component, not in src/data; it is not a micro_lesson yet. Its check c4 is imported as a question.');
  gaps.push('Rubric.feedback (correct/incorrect text) and QuestionBody.answerExample are v1 extensions of the 03 §7 value objects, needed by L3 feedback and the typed answer field.');
  gaps.push('Practice sets have no table in 04 §3; they are in sets.yaml and will live in the release snapshot until M2 decides (practice_set table or snapshot only).');

  // Typed core checks (data/cores): ids are only unique inside a core, so the alias is "<core>:<check>".
  for (const core of typedCores) core.checks.forEach(c => {
    const ids = c.options.map(o => o.id), answer = ids.indexOf(c.correctOptionId);
    const q = mcq({ code: `MAT.TRI.Q.${core.id}_${slug(c.id)}`, aliases: alias('ITEM', `${core.id}:${c.id}`), prompt: c.prompt, options: c.options.map(o => o.label), answer,
      concepts: [typedCode.get(core.id)!], source: `frontend:src/data/cores (${core.id}.${c.id})`, evidence: [`check of typed core ${core.id}`, 'composite alias: the frontend never sends these ids to the backend'] });
    q.body.options = c.options.map(o => ({ id: o.id, label: o.label }));
    q.legacyOptionOrder = ids; q.rubric.answer = { optionId: c.correctOptionId };
    questions.push(q);
  });
  for (const q of questions) {
    if (q.familyCode !== TOWER_FAMILY && familyCodes.has(q.familyCode)) throw new Error(`family code collision ${q.familyCode}`);
    familyCodes.add(q.familyCode);
  }

  // Lessons: route lessons (coreLessons.ts) and typed core lessons (data/cores).
  const lessons: Lesson[] = [];
  const sets: PracticeSet[] = [];
  for (const [route, lesson] of Object.entries(coreLessons.CORE_LESSONS)) {
    const routedFrom = Object.entries(coba.CORE_ROUTES).filter(([, r]) => r === route).map(([core]) => core);
    const concepts = [...new Set([lesson.coreId, ...routedFrom])].map(mc);
    const blocks: LessonBlock[] = lesson.chunks.flatMap((chunk, slide): LessonBlock[] => [
      { type: 'heading', slide, text: chunk.title },
      ...chunk.paragraphs.map((text): LessonBlock => ({ type: 'text', slide, text })),
      ...(chunk.figure ? [{ type: 'figure' as const, slide, figureRef: chunk.figure }] : []),
      ...(chunk.formulas ?? []).map((f): LessonBlock => ({ type: 'math', slide, name: f.name, expression: f.eq, ...(f.on ? { highlight: true } : {}) })),
    ]);
    const setCode = `MAT.TRI.S.${slug(route)}`;
    sets.push({ code: setCode, title: `Latihan ${lesson.title}`, origin: 'CONCEPT_LESSON', items: lessonPractice.get(route)! });
    lessons.push({
      schemaVersion: 1, code: `MAT.TRI.L.${slug(route)}`, title: lesson.title,
      estimatedMinutes: Math.min(20, Math.max(1, conceptByCode.get(mc(lesson.coreId))!.estimatedMinutes)),
      aliases: alias('ROUTE', route), concepts, blocks,
      checks: lesson.chunks.map((_, i) => ({ question: `MAT.TRI.Q.${slug(route)}_C${i}`, ordinal: i, slideIndex: i, required: true })), practiceSet: setCode,
      review: proposed('D6', ['concepts'], `coreLessons.ts coreId is ${lesson.coreId}`, `coba.ts CORE_ROUTES routes ${routedFrom.join(', ') || 'nothing'} here`,
        ...(lesson.playable ? [] : ['playable flag absent: content not yet confirmed to match the map title']), 'estimatedMinutes taken from the concept, as the frontend does'),
    });
  }
  for (const core of typedCores) lessons.push({
    schemaVersion: 1, code: `MAT.TRI.L.${slug(core.title)}`, title: core.title, estimatedMinutes: core.estimatedMinutes,
    aliases: alias('TYPED_LESSON', core.id), concepts: [typedCode.get(core.id)!],
    blocks: core.explanation.map((text): LessonBlock => ({ type: 'text', slide: 0, text })),
    checks: core.checks.map((c, i) => ({ question: `MAT.TRI.Q.${core.id}_${slug(c.id)}`, ordinal: i, slideIndex: 0, required: true })),
    review: proposed('D6', ['concepts'], TYPED_CONCEPTS[core.id]!.evidence, 'single slide: data/cores has no slide boundaries; all checks after slide 0'),
  });
  sets.push({ code: 'MAT.TRI.S.FUNNEL_PRACTICE', title: 'Latihan funnel /coba', origin: 'FUNNEL', items: coba.PRACTICE.map(p => `MAT.TRI.Q.FUNNEL_${slug(p.id)}`) });
  const codeOfItem = new Map(questions.flatMap(q => q.aliases.filter(a => a.ns === 'ITEM').map(a => [a.value, q.code] as const)));
  sets.push({ code: 'MAT.S.BANK', title: 'Bank soal pilihan ganda', origin: 'BANK', items: bank.BANK.filter(b => b.options).map(b => codeOfItem.get(b.id)!) });
  sets.push({ code: 'MAT.S.COMBINED', title: 'Soal gabungan', origin: 'COMBINED_SET', items: bank.BANK.filter(b => b.kind === 'gabungan').map(b => codeOfItem.get(b.id)!) });

  // Concept availability: READY when a lesson teaches it or an item assesses it as PRIMARY (D6).
  const taught = new Set([...lessons.flatMap(l => l.concepts), ...questions.flatMap(q => q.concepts.filter(c => c.role === 'PRIMARY').map(c => c.concept))]);
  for (const c of conceptByCode.values()) c.availability = taught.has(c.code) ? 'READY' : 'PLANNED';

  // Funnel topic pickers and private intake ids are legacy ids with no catalog entity.
  for (const t of coba.TOPICS.filter(t => !TOPIC_CODES[t.id])) unmapped.push({ ns: 'TOPIC', value: t.id, reason: `coba.ts funnel topic picker "${t.id}" (available: ${t.available}); no curriculum topic exists` });
  unmapped.push({ ns: 'ITEM', value: 'own:*', pattern: true, reason: 'Learner-owned questions from Tanya soal (QuestionIntakeView); private intake revisions (Slice 6), never catalog' });

  const subjects = fe.subjects.APP_SUBJECTS.map(s => {
    const code = SUBJECT_CODES[s.id];
    if (!code) throw new Error(`No subject code for "${s.id}" (decision D3)`);
    return { code, title: s.title, availability: s.available ? 'AVAILABLE' as const : 'COMING_SOON' as const, aliases: alias('SUBJECT', s.id, ...(SUBJECT_EXTRA_ALIASES[code] ?? [])) };
  });

  return {
    release: {
      schemaVersion: 1, version: 1, source: { extractor: EXTRACTOR, ...source }, signOff: { status: 'PENDING', reviewers: [] },
      decisions: [
        { id: 'D1', status: 'APPROVED', summary: 'Published lessons and concepts are immutable; lessons get micro_lesson_revision (M2); the server numbers revisions (exposed as Lesson.contentVersion).' },
        { id: 'D2', status: 'APPROVED', summary: 'Secondary aliases live in catalog_alias (release_id, namespace, alias) with UNIQUE (release_id, namespace, alias). Namespaces: SUBJECT, TOPIC, MAP, TYPED_MAP, ROUTE, TYPED_LESSON, ITEM; option indexes via legacyOptionOrder.' },
        { id: 'D3', status: 'PROPOSED', summary: 'Codes: subject MAT/FIS/...; topic MAT.<3 letters> from a fixed table; concept <topic>.<TITLE_SLUG>; unit <topic>.U<n>; question <topic>.Q.<LEGACY_ID_SLUG>; family <topic>.F.<...>; lesson <topic>.L.<...>; set <topic|subject>.S.<...>. Content lead approves the meaning of each code.' },
        { id: 'D4', status: 'PROPOSED', summary: 'Every extracted item is PUBLIC_PRACTICE because its key already ships in the bundle. Open: may PUBLIC_PRACTICE attempts be transfer-eligible (proposed: no, reason PUBLIC_KEY)?' },
        { id: 'D5', status: 'PROPOSED', summary: 'Tower question: soal-menara, trig-depression-01 and its retry are separate questions in one family MAT.TRI.F.TOWER_DEPRESSION_30 (wording differs, so not one question with two aliases).' },
        { id: 'D6', status: 'PROPOSED', summary: 'Inferred mappings: lesson_concept (lesson coreId ∪ CORE_ROUTES), question_concept (all PRIMARY + assessable), typed T04→tri-c, T10→tri-d, new concept for T13, funnel item concepts, contextTag keyword table, concept availability (READY = taught or assessed), subject alias cs→PRO.' },
      ],
      gaps,
    },
    subjects: { schemaVersion: 1, subjects },
    topicRelations: { schemaVersion: 1, relations: curriculum.RELATIONS.map(r => ({ from: topicCode(r.from), to: topicCode(r.to), kind: r.kind === 'req' ? 'REQUIRES' as const : 'RELATED' as const,
      label: r.label, source: r.source === 'cp' ? 'CURRICULUM' as const : 'MATHEMATICAL' as const })) },
    sets: { schemaVersion: 1, sets },
    unmapped: { schemaVersion: 1, entries: unmapped },
    topics, questions, lessons,
  };
}

/* ---------- coverage: every identifier the frontend uses must resolve ---------- */

export function collectLegacyIds(fe: Frontend) {
  const ids = new Map<Namespace, Set<string>>();
  const add = (ns: Namespace, ...values: (string | undefined)[]) => { const set = ids.get(ns) ?? new Set(); values.forEach(v => v && set.add(v)); ids.set(ns, set); };
  const { curriculum, coba, coreLessons, bank } = fe;
  add('SUBJECT', ...fe.subjects.APP_SUBJECTS.map(s => s.id), ...coba.SUBJECTS.map(s => s.id));
  add('TOPIC', ...curriculum.TOPICS.map(t => t.id), ...curriculum.UNMAPPED_TOPICS.map(t => t.id), ...curriculum.RELATIONS.flatMap(r => [r.from, r.to]), ...coba.TOPICS.map(t => t.id), ...bank.BANK.flatMap(b => b.topics));
  add('MAP', ...curriculum.TOPICS.flatMap(t => t.cores.map(c => c.id)), ...bank.BANK.flatMap(b => b.cores), ...coba.TOWER_PARTS, coba.FUNNEL_CORE, ...coba.HINT.steps.map(h => h.core),
    ...Object.keys(coba.CORE_ROUTES), ...Object.entries(coba.LEAD_TO).flat(), ...Object.values(coba.OPEN_LOOP).map(o => o.coreId), ...Object.values(coreLessons.CORE_LESSONS).map(l => l.coreId));
  add('TYPED_MAP', ...fe.trigMap.TRIGONOMETRY_MAP.flatMap(n => [n.id, n.coreId, ...n.prerequisites]));
  const typed = [fe.typedCores.identifySidesAgainstAngle, fe.typedCores.selectTanFromDiagram, fe.typedCores.buildEquationFromRatio];
  add('TYPED_LESSON', ...typed.map(c => c.id));
  add('ROUTE', ...Object.keys(coreLessons.CORE_LESSONS), ...Object.values(coba.CORE_ROUTES), ...Object.values(coba.OPEN_LOOP).map(o => o.route));
  add('ITEM', ...bank.BANK.map(b => b.id), ...coba.CHECKS.map(c => c.id), ...coba.PRACTICE.map(p => p.id), coba.MATERI_CHECK, 'soal-menara',
    fe.typedQuestions.trigDepression01.id, fe.typedQuestions.trigDepression01Retry.id,
    ...Object.entries(coreLessons.CORE_LESSONS).flatMap(([route, l]) => [...l.chunks.map((_, i) => coreLessons.chunkCheckId(route, i)), ...l.practice.map((_, i) => coreLessons.questionCheckId(route, i))]),
    ...typed.flatMap(c => c.checks.map(k => `${c.id}:${k.id}`)));
  return ids;
}

/** Identifiers the frontend uses that the manifest neither aliases nor lists as unmapped. */
export function coverageGaps(m: Manifest, legacy: Map<Namespace, Set<string>>) {
  const mapped = new Set(aliasIndex(m).map(a => `${a.ns}:${a.value}`));
  return [...legacy].flatMap(([ns, values]) => [...values].filter(v => !mapped.has(`${ns}:${v}`) && !isUnmapped(m, ns, v)).map(v => `${ns}:${v}`)).sort();
}

/** The frozen legacy alias set (09 §6.1 rule 8): aliases the shipped frontend references, recorded in the manifest. */
export function freezeOf(m: Manifest, legacy: Map<Namespace, Set<string>>) {
  const mapped = new Set(aliasIndex(m).map(a => `${a.ns}:${a.value}`));
  const namespaces = Object.fromEntries([...legacy].sort(([a], [b]) => a.localeCompare(b)).map(([ns, values]) => [ns, [...values].filter(v => mapped.has(`${ns}:${v}`)).sort()]));
  return { schemaVersion: 1, frontendCommit: m.release.source.frontendCommit, frontendDataDirty: m.release.source.frontendDataDirty, namespaces };
}

/* ---------- CLI ---------- */

async function main() {
  const args = process.argv.slice(2), arg = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback;
  const frontendDir = resolve(arg('--frontend', process.env.FRONTEND_DIR ?? '../mockup/intibelajar'));
  const out = resolve(arg('--out', 'catalog/manifest')), freezePath = join(out, '..', FREEZE_FILE);
  const { fe, source } = await loadFrontend(frontendDir);
  const legacy = collectLegacyIds(fe);
  if (args.includes('--check')) {
    const m = loadManifest(out), missing = coverageGaps(m, legacy);
    const frozen = JSON.parse(readFileSync(freezePath, 'utf8')) as ReturnType<typeof freezeOf>;
    const now = freezeOf(m, legacy), added = Object.entries(now.namespaces).flatMap(([ns, v]) => v.filter(x => !frozen.namespaces[ns]?.includes(x)).map(x => `${ns}:${x}`));
    if (missing.length) console.error(`Frontend identifiers with no alias and no unmapped entry:\n  ${missing.join('\n  ')}`);
    if (added.length) console.error(`Frontend now references aliases outside the frozen set (${FREEZE_FILE}):\n  ${added.join('\n  ')}`);
    if (source.frontendCommit !== m.release.source.frontendCommit) console.log(`Note: manifest was extracted from ${m.release.source.frontendCommit}, frontend is at ${source.frontendCommit}`);
    console.log(`Alias coverage: ${[...legacy.values()].reduce((n, s) => n + s.size, 0)} frontend identifiers, ${missing.length} unresolved, ${added.length} outside the freeze`);
    process.exit(missing.length || added.length ? 1 : 0);
  }
  if (existsSync(join(out, 'release.yaml')) && !args.includes('--force')) {
    console.error(`${out} already exists. The reviewed manifest is the source of truth; pass --force only to discard it and start a new draft.`);
    process.exit(1);
  }
  const m = buildManifest(fe, source);
  const missing = coverageGaps(m, legacy);
  if (missing.length) throw new Error(`Extractor left identifiers unresolved: ${missing.join(', ')}`);
  writeManifest(out, m);
  writeFileSync(freezePath, JSON.stringify(freezeOf(m, legacy), null, 2) + '\n');
  console.log(`Draft manifest written to ${out}: ${m.topics.length} topics, ${m.topics.reduce((n, t) => n + t.concepts.length, 0)} concepts, ${m.questions.length} questions, ${m.lessons.length} lessons, ${m.sets.sets.length} sets`);
  if (source.frontendDataDirty) console.log('Warning: frontend src/data has uncommitted changes; the draft records frontendDataDirty: true');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
