import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { patternTokens } from './text-pattern.js';
// Alias manifest (Slice 1 M1): the reviewed source of every catalog entity and every legacy identifier.
// Pure: no database access. The publisher (M2) runs lintManifest(..., {strict:true}) before writing.

export type Namespace = 'SUBJECT'|'TOPIC'|'MAP'|'TYPED_MAP'|'ROUTE'|'TYPED_LESSON'|'ITEM';
export interface Alias { ns: Namespace; value: string }
export interface Review { status: 'PROPOSED'|'REVIEWED'; decision?: string; fields?: string[]; evidence: string[] }
export interface Misconception { code: string; description: string; example?: string; indicators: string[] }
export interface Concept {
  code: string; title: string; subtitle?: string; definition?: string; objectives: string[]; misconceptions: Misconception[];
  unit?: string; ordinal: number; estimatedMinutes: number; hidden: boolean; capstone: boolean; availability: 'READY'|'PLANNED';
  aliases: Alias[]; review?: Review;
}
export interface Prerequisite { concept: string; requires: string; kind: 'HARD'|'SOFT'; review?: Review }
export interface Unit { code: string; legacyId?: string; title: string; goal: string; ordinal: number }
export interface Topic {
  schemaVersion: 1; code: string; subject: string; title: string; subtitle?: string; phase: 'D'|'E'|'F'|'F+';
  availability: 'MAPPED'|'PLANNED'; bekal: string[]; aliases: Alias[]; units: Unit[]; concepts: Concept[];
  prerequisites: Prerequisite[]; review?: Review;
}
export interface Option { id: string; label: string }
export interface QuestionBody {
  schemaVersion: 1; prompt: string; figureRef?: string; options?: Option[];
  hints: { step: number; conceptCode: string; lead: string; note?: string }[]; answerFormat: 'OPTION'|'NUMBER'|'TEXT'; answerExample?: string;
}
export interface Rubric {
  tutorLadder?: { hints: [string, string]; nodes: { ask: string; text: string; quick: string[] }[] };
  schemaVersion: 1; evaluator: 'option-v1'|'numeric-v1'|'tower-v1'|'ai-assisted-v1';
  answer: { optionId?: string; value?: number; unit?: string; tolerance?: { relative: number; floor: number } };
  acceptedForms: string[];
  solutionPaths: { code: string; label: string; steps: { code: string; description: string; patterns?: string[]; concepts: { code: string; role: 'REQUIRED'|'SUPPORTING' }[] }[] }[];
  misconceptionMap: { pattern: { kind: 'OPTION'|'NUMERIC'|'TEXT'; optionId?: string; value?: number; regex?: string; tokens?: string[] }; conceptCode: string; misconceptionCode: string; explanation: string }[];
  finalAnswerEvidence: string[];
  /** Slice 2 D2: concept code → the lesson START_LESSON assigns for it in a question loop. */
  lessonFor?: Record<string, string>;
  /** Slice 2 M1: per catalogued misconception, the concept to learn next and its key formula. */
  recommend?: { conceptCode: string; misconceptionCode: string; keyFormula: string }[];
  feedback?: { correct?: string; incorrect?: string };
  workedSolution?: { steps: { title: string; body: string }[]; after: string[] };
}
export interface Question {
  schemaVersion: 1; code: string; familyCode: string; visibility: 'PUBLIC_PRACTICE'|'CATALOG'; origin: 'AUTHORED';
  itemType: 'FREE_RESPONSE'|'MULTIPLE_CHOICE'|'NUMERIC'; contextTag: string; difficulty: number; estimatedMinutes: number;
  provenance: { source: string; note?: string }; aliases: Alias[]; legacyOptionOrder?: string[];
  concepts: { concept: string; role: 'PRIMARY'|'SUPPORTING'; assessable: boolean }[]; body: QuestionBody; rubric: Rubric; review?: Review;
}
export type LessonBlock =
  | { type: 'heading'|'text'|'tip'; slide: number; text: string }
  | { type: 'math'; slide: number; name: string; expression: string; highlight?: boolean }
  | { type: 'figure'; slide: number; figureRef: string };
export interface Lesson {
  schemaVersion: 1; code: string; title: string; estimatedMinutes: number; aliases: Alias[]; concepts: string[];
  blocks: LessonBlock[]; checks: { question: string; ordinal: number; slideIndex: number; required: boolean }[]; practiceSet?: string; review?: Review;
}
export interface PracticeSet { code: string; title: string; origin: 'FUNNEL'|'BANK'|'COMBINED_SET'|'CONCEPT_LESSON'; items: string[]; review?: Review }
export interface Release {
  schemaVersion: 1; version: number;
  source: { extractor: string; frontendCommit: string; frontendDataDirty: boolean };
  signOff: { status: 'PENDING'|'REVIEWED'; reviewers: { name: string; role: string; date: string }[] };
  decisions: { id: string; status: 'PROPOSED'|'APPROVED'; summary: string }[];
  gaps: string[];
}
export interface UnmappedEntry { ns: Namespace; value: string; pattern?: boolean; reason: string }
/** A hand-authored overlay (catalog/authored/), applied over extractor-owned entries at load time. */
export interface Authored {
  schemaVersion: 1; kind: 'QUESTION_RUBRIC'|'CONCEPT_MISCONCEPTIONS'; target: string; provenance: { source: 'authored'; note?: string }; review: Review;
  rubric?: Pick<Rubric, 'solutionPaths'|'misconceptionMap'|'lessonFor'|'recommend'|'tutorLadder'>; misconceptions?: Misconception[];
}
export interface Manifest {
  release: Release;
  subjects: { schemaVersion: 1; subjects: { code: string; title: string; availability: 'AVAILABLE'|'COMING_SOON'; aliases: Alias[] }[] };
  topicRelations: { schemaVersion: 1; relations: { from: string; to: string; kind: 'REQUIRES'|'RELATED'; label: string; source: 'CURRICULUM'|'MATHEMATICAL'; review?: Review }[] };
  sets: { schemaVersion: 1; sets: PracticeSet[] };
  unmapped: { schemaVersion: 1; entries: UnmappedEntry[] };
  topics: Topic[]; questions: Question[]; lessons: Lesson[];
  /** Overlays as loaded, already applied to topics and questions; kept for lint and review. */
  authored?: Authored[];
}

export type Rule =
  | 'SCHEMA'|'FILE_NAME'|'KEY_IN_BODY'|'SIZE'|'CODE_DUPLICATE'|'REF_UNKNOWN'|'ALIAS_AMBIGUOUS'|'ALIAS_UNMAPPED_CONFLICT'
  | 'PREREQ_CYCLE'|'PREREQ_SELF'|'TOPIC_CYCLE'|'UNIT_UNKNOWN'|'QUESTION_NO_PRIMARY'|'STEP_CONCEPT_UNMAPPED'|'MISCONCEPTION_UNKNOWN'
  | 'EVALUATOR_SHAPE'|'OPTION_IDS'|'PRACTICE_NOT_DETERMINISTIC'|'CHECK_NOT_DETERMINISTIC'|'CHECK_PLACEMENT'|'UNREVIEWED'
  | 'PATTERN'|'LESSON_LINK'|'RECOMMEND'|'AUTHORED_TARGET';
export interface Finding { rule: Rule; severity: 'error'|'warning'; file: string; message: string }

const KINDS = { release: 'release.yaml', subjects: 'subjects.yaml', topicRelations: 'topic-relations.yaml', sets: 'sets.yaml', unmapped: 'unmapped.yaml' } as const;
const DIRS = { topics: 'topics', questions: 'questions', lessons: 'lessons' } as const;
const SCHEMA_DEFS: Record<string, string> = { release: 'release', subjects: 'subjects', topicRelations: 'topicRelations', sets: 'sets', unmapped: 'unmapped', topics: 'topic', questions: 'question', lessons: 'lesson', authored: 'authored' };
/** Overlays live beside the extracted manifest, so the extractor's output directory never contains them. */
export const AUTHORED_DIR = '../authored';
// 04 §6 caps. The snapshot cap applies to the whole manifest serialised as one JSON document.
export const SIZE_CAPS = { rubric: 64 * 1024, lessonBlocks: 64 * 1024, snapshot: 20 * 1024 * 1024 };
// Field names that would carry a key into the learner-facing body (INV-05 at authoring time).
const KEY_FIELDS = new Set(['answer', 'answers', 'correct', 'correctOptionId', 'correctAnswerId', 'ok', 'value', 'isCorrect', 'rubric', 'acceptedForms', 'explain', 'right', 'wrong']);
const DETERMINISTIC = new Set(['option-v1', 'numeric-v1']);

export const schema = JSON.parse(readFileSync(new URL('../../catalog/manifest.schema.json', import.meta.url), 'utf8'));
const ajv = new (Ajv2020 as unknown as typeof import('ajv').Ajv)({ strict: false, allErrors: true });
(addFormats as unknown as (a: typeof ajv) => void)(ajv);
ajv.addSchema(schema);
const validators = new Map(Object.values(SCHEMA_DEFS).map(def => [def, ajv.getSchema(`${schema.$id}#/$defs/${def}`)!]));

const fileOf = (kind: keyof typeof DIRS, code: string) => `${DIRS[kind]}/${code}.yaml`;
const authoredFile = (a: Authored) => (a as unknown as Record<symbol, string>)[FILE] ?? `authored/${a.target}.${a.kind === 'QUESTION_RUBRIC' ? 'rubric' : 'misconceptions'}.yaml`;

/** Loads the extracted files and, unless `authored: false`, applies the overlays in `catalog/authored/` beside them. */
export function loadManifest(dir: string, { authored: withAuthored = true } = {}): Manifest {
  const read = (file: string) => parse(readFileSync(join(dir, file), 'utf8'));
  const readDir = (sub: string) => existsSync(join(dir, sub))
    ? readdirSync(join(dir, sub)).filter(n => n.endsWith('.yaml')).sort().map(n => ({ ...read(join(sub, n)), [FILE]: `${sub}/${n}` }))
    : [];
  const authoredDir = join(dir, AUTHORED_DIR);
  const authored = withAuthored && existsSync(authoredDir)
    ? readdirSync(authoredDir).filter(n => n.endsWith('.yaml')).sort().map(n => ({ ...parse(readFileSync(join(authoredDir, n), 'utf8')), [FILE]: `authored/${n}` }))
    : [];
  return applyAuthored({
    authored,
    release: read(KINDS.release), subjects: read(KINDS.subjects), topicRelations: read(KINDS.topicRelations),
    sets: read(KINDS.sets), unmapped: read(KINDS.unmapped),
    topics: readDir(DIRS.topics), questions: readDir(DIRS.questions), lessons: [...readDir(DIRS.lessons),
      ...(withAuthored && existsSync(join(authoredDir, 'lessons')) ? readdirSync(join(authoredDir, 'lessons')).filter(n => n.endsWith('.yaml')).sort()
        .map(n => parse(readFileSync(join(authoredDir, 'lessons', n), 'utf8'))) : [])],
  });
}

/**
 * Apply hand-authored overlays (Slice 2 M1). A rubric overlay replaces the extracted solutionPaths and
 * misconceptionMap when it sets them, and adds lessonFor and recommend; a misconception overlay appends to a
 * concept. Unknown targets are left for lint (AUTHORED_TARGET), never silently dropped from review.
 */
export function applyAuthored(m: Manifest): Manifest {
  for (const a of m.authored ?? []) {
    if (a.kind === 'QUESTION_RUBRIC') {
      const q = m.questions.find(x => x.code === a.target);
      if (q && a.rubric) q.rubric = { ...q.rubric, ...structuredClone(a.rubric) };
    } else {
      const c = m.topics.flatMap(t => t.concepts).find(x => x.code === a.target);
      if (c && a.misconceptions) c.misconceptions = [...c.misconceptions, ...structuredClone(a.misconceptions)];
    }
  }
  return m;
}
// The file an entity was loaded from, kept off the serialised shape so FILE_NAME can compare it with the code.
const FILE = Symbol('file');

const dump = (value: unknown) => stringify(value, { lineWidth: 0, aliasDuplicateObjects: false });
// Deterministic output: fixed file layout, fixed key order from the caller, sorted file names.
export function writeManifest(dir: string, m: Manifest) {
  // A loaded manifest has its overlays applied; writing it would bake authored content into extractor files.
  if (m.authored?.length) throw new Error('writeManifest takes an extracted manifest, not one with authored overlays applied');
  for (const sub of Object.values(DIRS)) rmSync(join(dir, sub), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [kind, file] of Object.entries(KINDS)) writeFileSync(join(dir, file), dump(m[kind as keyof typeof KINDS]));
  for (const kind of Object.keys(DIRS) as (keyof typeof DIRS)[]) {
    mkdirSync(join(dir, DIRS[kind]), { recursive: true });
    for (const entity of m[kind]) writeFileSync(join(dir, fileOf(kind, entity.code)), dump(entity));
  }
}

/** Every alias in the manifest with the entity it names. */
export function aliasIndex(m: Manifest) {
  const out: { ns: Namespace; value: string; entity: string; file: string }[] = [];
  const add = (aliases: Alias[], entity: string, file: string) => aliases.forEach(a => out.push({ ...a, entity, file }));
  m.subjects.subjects.forEach(s => add(s.aliases, `subject ${s.code}`, KINDS.subjects));
  for (const t of m.topics) {
    add(t.aliases, `topic ${t.code}`, fileOf('topics', t.code));
    t.concepts.forEach(c => add(c.aliases, `concept ${c.code}`, fileOf('topics', t.code)));
  }
  m.questions.forEach(q => add(q.aliases, `question ${q.code}`, fileOf('questions', q.code)));
  m.lessons.forEach(l => add(l.aliases, `lesson ${l.code}`, fileOf('lessons', l.code)));
  return out;
}

export function isUnmapped(m: Manifest, ns: Namespace, value: string) {
  return m.unmapped.entries.some(e => e.ns === ns && (e.pattern ? value.startsWith(e.value.slice(0, -1)) : e.value === value));
}

export function lintManifest(m: Manifest, { strict = false } = {}): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: Rule, file: string, message: string, severity: Finding['severity'] = 'error') => findings.push({ rule, severity, file, message });

  // 1. Schema, per file. Unknown fields inside a question body are reported as KEY_IN_BODY when they name a key.
  const schemaCheck = (def: string, value: unknown, file: string) => {
    const validate = validators.get(def)!;
    if (validate(value)) return;
    for (const e of validate.errors ?? []) {
      const extra = e.keyword === 'additionalProperties' ? String((e.params as { additionalProperty: string }).additionalProperty) : '';
      if (extra && e.instancePath.startsWith('/body') && KEY_FIELDS.has(extra)) add('KEY_IN_BODY', file, `${e.instancePath}/${extra}: answer keys must not appear in the learner-facing body`);
      else add('SCHEMA', file, `${e.instancePath || '/'} ${e.message}${extra ? ` (${extra})` : ''}`);
    }
  };
  for (const [kind, file] of Object.entries(KINDS)) schemaCheck(SCHEMA_DEFS[kind]!, m[kind as keyof typeof KINDS], file);
  for (const kind of Object.keys(DIRS) as (keyof typeof DIRS)[]) for (const e of m[kind]) {
    const file = fileOf(kind, e.code);
    const loaded = (e as unknown as Record<symbol, string>)[FILE];
    if (loaded && loaded !== file) add('FILE_NAME', loaded, `file must be named ${file} after its code`);
    schemaCheck(SCHEMA_DEFS[kind]!, e, file);
  }
  for (const a of m.authored ?? []) schemaCheck('authored', a, authoredFile(a));
  // Semantic rules assume the shapes the schema promises; stop here rather than report noise.
  if (findings.some(f => f.rule === 'SCHEMA')) return findings;

  // 2. Sizes (04 §6).
  for (const q of m.questions) if (Buffer.byteLength(JSON.stringify(q.rubric)) > SIZE_CAPS.rubric) add('SIZE', fileOf('questions', q.code), `rubric exceeds ${SIZE_CAPS.rubric} bytes`);
  for (const l of m.lessons) if (Buffer.byteLength(JSON.stringify(l.blocks)) > SIZE_CAPS.lessonBlocks) add('SIZE', fileOf('lessons', l.code), `blocks exceed ${SIZE_CAPS.lessonBlocks} bytes`);
  if (Buffer.byteLength(JSON.stringify(m)) > SIZE_CAPS.snapshot) add('SIZE', KINDS.release, `manifest exceeds the ${SIZE_CAPS.snapshot}-byte snapshot cap`);

  // 3. Codes unique per entity type (DDL UNIQUE on code).
  const index = <T extends { code: string }>(type: string, items: [T, string][]) => {
    const map = new Map<string, T>();
    for (const [item, file] of items) {
      if (map.has(item.code)) add('CODE_DUPLICATE', file, `${type} code ${item.code} is used twice`);
      map.set(item.code, item);
    }
    return map;
  };
  const subjects = index('subject', m.subjects.subjects.map(s => [s, KINDS.subjects]));
  const topics = index('topic', m.topics.map(t => [t, fileOf('topics', t.code)]));
  const conceptTopic = new Map<string, Topic>();
  const concepts = index('concept', m.topics.flatMap(t => t.concepts.map(c => { conceptTopic.set(c.code, t); return [c, fileOf('topics', t.code)] as [Concept, string]; })));
  index('unit', m.topics.flatMap(t => t.units.map(u => [u, fileOf('topics', t.code)] as [Unit, string])));
  const questions = index('question', m.questions.map(q => [q, fileOf('questions', q.code)]));
  const lessons = index('lesson', m.lessons.map(l => [l, fileOf('lessons', l.code)]));
  const sets = index('set', m.sets.sets.map(s => [s, KINDS.sets]));
  const ref = (map: Map<string, unknown>, type: string, code: string | undefined, file: string, where: string) => {
    if (code !== undefined && !map.has(code)) add('REF_UNKNOWN', file, `${where} references unknown ${type} ${code}`);
    return code !== undefined && map.has(code);
  };

  // 4. Aliases: one entity per (namespace, value); never both mapped and listed as intentionally unmapped.
  const seen = new Map<string, { entity: string; file: string }>();
  for (const a of aliasIndex(m)) {
    const key = `${a.ns}:${a.value}`, first = seen.get(key);
    if (first && first.entity !== a.entity) add('ALIAS_AMBIGUOUS', a.file, `${a.ns} alias "${a.value}" names both ${first.entity} (${first.file}) and ${a.entity}`);
    else if (first) add('ALIAS_AMBIGUOUS', a.file, `${a.ns} alias "${a.value}" is listed twice on ${a.entity}`);
    seen.set(key, first ?? a);
    if (isUnmapped(m, a.ns, a.value)) add('ALIAS_UNMAPPED_CONFLICT', a.file, `${a.ns} alias "${a.value}" is mapped and also listed in unmapped.yaml`);
  }

  // 5. Topics, units, prerequisites, relations.
  for (const t of m.topics) {
    const file = fileOf('topics', t.code);
    ref(subjects, 'subject', t.subject, file, `topic ${t.code}`);
    const units = new Set(t.units.map(u => u.code));
    for (const c of t.concepts) if (c.unit !== undefined && !units.has(c.unit)) add('UNIT_UNKNOWN', file, `concept ${c.code} is in unit ${c.unit}, which is not a unit of ${t.code}`);
    for (const p of t.prerequisites) {
      ref(concepts, 'concept', p.concept, file, 'prerequisite');
      ref(concepts, 'concept', p.requires, file, `prerequisite of ${p.concept}`);
      if (p.concept === p.requires) add('PREREQ_SELF', file, `${p.concept} requires itself`);
    }
  }
  for (const r of m.topicRelations.relations) {
    ref(topics, 'topic', r.from, KINDS.topicRelations, 'relation');
    ref(topics, 'topic', r.to, KINDS.topicRelations, 'relation');
  }
  // INV-17: hard edges form a DAG over the whole release (edges may cross topics).
  const cycle = (edges: [string, string][]) => {
    const next = new Map<string, string[]>();
    for (const [from, to] of edges) next.set(from, [...(next.get(from) ?? []), to]);
    const state = new Map<string, 1 | 2>(), stack: string[] = [];
    const visit = (n: string): string[] | null => {
      if (state.get(n) === 2) return null;
      if (state.get(n) === 1) return [...stack.slice(stack.indexOf(n)), n];
      state.set(n, 1); stack.push(n);
      for (const to of next.get(n) ?? []) { const found = visit(to); if (found) return found; }
      stack.pop(); state.set(n, 2); return null;
    };
    for (const n of [...next.keys()].sort()) { const found = visit(n); if (found) return found; }
    return null;
  };
  const hardCycle = cycle(m.topics.flatMap(t => t.prerequisites.filter(p => p.kind === 'HARD' && p.concept !== p.requires).map(p => [p.requires, p.concept] as [string, string])));
  if (hardCycle) add('PREREQ_CYCLE', fileOf('topics', conceptTopic.get(hardCycle[0]!)?.code ?? '?'), `hard prerequisites form a cycle: ${hardCycle.join(' → ')}`);
  const topicCycle = cycle(m.topicRelations.relations.filter(r => r.kind === 'REQUIRES').map(r => [r.from, r.to] as [string, string]));
  if (topicCycle) add('TOPIC_CYCLE', KINDS.topicRelations, `REQUIRES relations form a cycle: ${topicCycle.join(' → ')}`);

  // 6. Questions: mappings, rubric references, evaluator shape, option identity.
  for (const q of m.questions) {
    const file = fileOf('questions', q.code), mapped = new Set(q.concepts.map(c => c.concept));
    q.concepts.forEach(c => ref(concepts, 'concept', c.concept, file, 'question_concept'));
    if (!q.concepts.some(c => c.role === 'PRIMARY')) add('QUESTION_NO_PRIMARY', file, 'a question needs at least one PRIMARY concept');
    const mustBeMapped = (code: string, where: string) => {
      if (!concepts.has(code)) add('REF_UNKNOWN', file, `${where} references unknown concept ${code}`);
      else if (!mapped.has(code)) add('STEP_CONCEPT_UNMAPPED', file, `${where} uses ${code}, which is not mapped in question_concept`);
    };
    q.rubric.solutionPaths.forEach(p => p.steps.forEach(s => s.concepts.forEach(c => mustBeMapped(c.code, `step ${p.code}.${s.code}`))));
    q.rubric.finalAnswerEvidence.forEach(c => mustBeMapped(c, 'finalAnswerEvidence'));
    q.body.hints.forEach(h => mustBeMapped(h.conceptCode, `hint step ${h.step}`));
    for (const x of q.rubric.misconceptionMap) {
      mustBeMapped(x.conceptCode, 'misconceptionMap');
      const concept = concepts.get(x.conceptCode);
      if (concept && !concept.misconceptions.some(mc => mc.code === x.misconceptionCode)) add('MISCONCEPTION_UNKNOWN', file, `misconception ${x.misconceptionCode} is not catalogued on ${x.conceptCode}`);
    }
    // Slice 2: text patterns (tower-v1), lesson links (D2) and recommendations.
    const tower = q.rubric.evaluator === 'tower-v1';
    for (const p of q.rubric.solutionPaths) for (const step of p.steps) {
      if (step.patterns && !tower) add('PATTERN', file, `step ${p.code}.${step.code} has patterns, which only tower-v1 reads`);
      if (tower && !step.patterns) add('PATTERN', file, `tower-v1 step ${p.code}.${step.code} needs patterns, or its path can never be shown`);
      for (const pattern of step.patterns ?? []) if (!patternTokens(pattern)) add('PATTERN', file, `step ${p.code}.${step.code} pattern "${pattern}" has no usable token run`);
    }
    for (const x of q.rubric.misconceptionMap) {
      if (tower && (x.pattern.kind !== 'TEXT' || !x.pattern.tokens || x.pattern.regex !== undefined))
        add('PATTERN', file, `tower-v1 misconception ${x.misconceptionCode} must be a TEXT pattern with tokens (no regex, no bare value: a wrong number alone shows no concept, T01-3)`);
      if (x.pattern.tokens && !tower) add('PATTERN', file, `misconception ${x.misconceptionCode} has tokens, which only tower-v1 reads`);
      for (const pattern of x.pattern.tokens ?? []) if (!patternTokens(pattern)) add('PATTERN', file, `misconception ${x.misconceptionCode} pattern "${pattern}" has no usable token run`);
    }
    for (const [concept, lesson] of Object.entries(q.rubric.lessonFor ?? {})) {
      mustBeMapped(concept, 'lessonFor');
      if (ref(lessons, 'lesson', lesson, file, `lessonFor ${concept}`) && !lessons.get(lesson)!.concepts.includes(concept))
        add('LESSON_LINK', file, `lessonFor ${concept} names ${lesson}, which does not teach that concept`);
    }
    for (const r of q.rubric.recommend ?? []) {
      mustBeMapped(r.conceptCode, 'recommend');
      if (!q.rubric.misconceptionMap.some(x => x.misconceptionCode === r.misconceptionCode))
        add('RECOMMEND', file, `recommend names ${r.misconceptionCode}, which no misconception pattern of this question produces`);
    }
    const recommends = (q.rubric.recommend ?? []).map(r => r.misconceptionCode);
    if (new Set(recommends).size !== recommends.length) add('RECOMMEND', file, 'one recommendation per misconception code');
    if (tower) {
      // D2: every concept a loop can recommend (primary assessable concepts for E-06, and every recommend target) has an authored lesson.
      const recommendable = new Set([...q.concepts.filter(c => c.role === 'PRIMARY' && c.assessable).map(c => c.concept), ...(q.rubric.recommend ?? []).map(r => r.conceptCode)]);
      for (const c of [...recommendable].sort()) if (!q.rubric.lessonFor?.[c]) add('LESSON_LINK', file, `tower-v1 can recommend ${c} but rubric.lessonFor has no lesson for it (D2)`);
    }
    const options = q.body.options ?? [], ids = options.map(o => o.id), { answer, evaluator } = q.rubric;
    if (new Set(ids).size !== ids.length) add('OPTION_IDS', file, 'option ids must be unique');
    if (q.legacyOptionOrder && (q.legacyOptionOrder.length !== ids.length || [...q.legacyOptionOrder].sort().join() !== [...ids].sort().join()))
      add('OPTION_IDS', file, 'legacyOptionOrder must list every option id exactly once (index → id)');
    for (const x of q.rubric.misconceptionMap) if (x.pattern.kind === 'OPTION' && !ids.includes(x.pattern.optionId ?? '')) add('OPTION_IDS', file, `misconception pattern names unknown option ${x.pattern.optionId}`);
    const shape = evaluator === 'option-v1'
      ? q.itemType === 'MULTIPLE_CHOICE' && q.body.answerFormat === 'OPTION' && options.length >= 2 && answer.optionId !== undefined && answer.value === undefined
      : evaluator === 'numeric-v1'
        ? q.itemType === 'NUMERIC' && q.body.answerFormat === 'NUMBER' && typeof answer.value === 'number' && answer.tolerance !== undefined && answer.optionId === undefined
        : evaluator === 'tower-v1' ? q.itemType === 'FREE_RESPONSE' && q.body.answerFormat === 'TEXT' && typeof answer.value === 'number' && answer.tolerance !== undefined && answer.optionId === undefined
        : q.itemType === 'FREE_RESPONSE';
    if (!shape) add('EVALUATOR_SHAPE', file, `${evaluator} does not fit itemType ${q.itemType}, answerFormat ${q.body.answerFormat} and the answer fields`);
    if (answer.optionId !== undefined && !ids.includes(answer.optionId)) add('OPTION_IDS', file, `answer option ${answer.optionId} is not an option`);
  }

  // 7. Lessons and sets: references, check placement, deterministic items only (05 §2, 04 §3).
  const deterministic = (code: string) => DETERMINISTIC.has(questions.get(code)?.rubric.evaluator ?? '');
  for (const l of m.lessons) {
    const file = fileOf('lessons', l.code), slides = Math.max(...l.blocks.map(b => b.slide)) + 1;
    l.concepts.forEach(c => ref(concepts, 'concept', c, file, 'lesson_concept'));
    ref(sets, 'set', l.practiceSet, file, 'practiceSet');
    const ordinals = new Set<number>(), checkQuestions = new Set<string>();
    for (const c of l.checks) {
      if (!ref(questions, 'question', c.question, file, `check ${c.ordinal}`)) continue;
      if (!deterministic(c.question)) add('CHECK_NOT_DETERMINISTIC', file, `check ${c.question} must use option-v1 or numeric-v1`);
      if (c.slideIndex >= slides) add('CHECK_PLACEMENT', file, `check ${c.question} sits after slide ${c.slideIndex}, but the lesson has ${slides} slides`);
      if (ordinals.has(c.ordinal) || checkQuestions.has(c.question)) add('CHECK_PLACEMENT', file, `check ordinal ${c.ordinal} or question ${c.question} repeats (UNIQUE in micro_assessment)`);
      ordinals.add(c.ordinal); checkQuestions.add(c.question);
    }
  }
  for (const s of m.sets.sets) for (const item of s.items)
    if (ref(questions, 'question', item, KINDS.sets, `set ${s.code}`) && !deterministic(item)) add('PRACTICE_NOT_DETERMINISTIC', KINDS.sets, `set ${s.code} contains ${item}, which is not deterministically gradable`);

  // 7b. Overlays: a known target of the right kind, once per target and kind, no duplicate misconception codes.
  const overlayKeys = new Set<string>();
  for (const a of m.authored ?? []) {
    const file = authoredFile(a), key = `${a.kind}:${a.target}`;
    if (overlayKeys.has(key)) add('CODE_DUPLICATE', file, `a second ${a.kind} overlay for ${a.target}`);
    overlayKeys.add(key);
    if (a.kind === 'QUESTION_RUBRIC' ? !questions.has(a.target) : !concepts.has(a.target))
      add('AUTHORED_TARGET', file, `${a.kind} overlay targets unknown ${a.kind === 'QUESTION_RUBRIC' ? 'question' : 'concept'} ${a.target}`);
    if (a.kind === 'CONCEPT_MISCONCEPTIONS' && concepts.has(a.target)) {
      const codes = concepts.get(a.target)!.misconceptions.map(x => x.code);
      if (new Set(codes).size !== codes.length) add('CODE_DUPLICATE', file, `${a.target} lists a misconception code twice after the overlay`);
    }
  }

  // 8. Open human decisions. Strict mode (publisher) refuses them.
  const severity = strict ? 'error' : 'warning';
  const reviews: [Review | undefined, string, string][] = [
    ...m.topics.flatMap(t => [[t.review, fileOf('topics', t.code), `topic ${t.code}`] as [Review | undefined, string, string],
      ...t.concepts.map(c => [c.review, fileOf('topics', t.code), `concept ${c.code}`] as [Review | undefined, string, string]),
      ...t.prerequisites.map(p => [p.review, fileOf('topics', t.code), `prerequisite ${p.concept} ← ${p.requires}`] as [Review | undefined, string, string])]),
    ...m.questions.map(q => [q.review, fileOf('questions', q.code), `question ${q.code}`] as [Review | undefined, string, string]),
    ...m.lessons.map(l => [l.review, fileOf('lessons', l.code), `lesson ${l.code}`] as [Review | undefined, string, string]),
    ...m.sets.sets.map(s => [s.review, KINDS.sets, `set ${s.code}`] as [Review | undefined, string, string]),
    ...m.topicRelations.relations.map(r => [r.review, KINDS.topicRelations, `relation ${r.from} → ${r.to}`] as [Review | undefined, string, string]),
    ...(m.authored ?? []).map(a => [a.review, authoredFile(a), `authored ${a.kind} ${a.target}`] as [Review | undefined, string, string]),
  ];
  for (const [review, file, what] of reviews) if (review?.status === 'PROPOSED')
    add('UNREVIEWED', file, `${what}: ${review.decision ? `${review.decision} ` : ''}proposal (${(review.fields ?? []).join(', ') || 'whole entry'}) awaits review`, severity);
  for (const d of m.release.decisions) if (d.status === 'PROPOSED') add('UNREVIEWED', KINDS.release, `decision ${d.id} is not approved`, severity);
  if (m.release.signOff.status !== 'REVIEWED') add('UNREVIEWED', KINDS.release, 'release sign-off is pending', severity);
  if (m.release.source.frontendDataDirty) add('UNREVIEWED', KINDS.release, 'extracted from uncommitted frontend data', severity);
  return findings;
}

export function formatFindings(findings: Finding[]) {
  return findings.map(f => `${f.severity.toUpperCase().padEnd(7)} ${f.rule.padEnd(26)} ${f.file}: ${f.message}`).join('\n');
}
