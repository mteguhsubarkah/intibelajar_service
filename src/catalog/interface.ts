import { sql } from 'kysely';
import type { Connection } from '../db.js';
import { fail } from '../platform/errors.js';
import type { QuestionBody } from './manifest.js';
// The catalog's interface for other modules (02: domain modules depend on catalog interfaces, not tables).
// Nothing here reads a rubric. Deterministic items are recognised by item_type: the manifest lint
// (EVALUATOR_SHAPE) ties MULTIPLE_CHOICE to option-v1 and NUMERIC to numeric-v1.

const DETERMINISTIC = ['MULTIPLE_CHOICE', 'NUMERIC'];
const MAX_ITEMS = 10;

export interface Release { id: string; version: number }
export async function currentRelease(db: Connection): Promise<Release | null> {
  return (await sql<Release>`select id, version from curriculum_release where is_current`.execute(db)).rows[0] ?? null;
}
export async function releaseVersion(db: Connection, releaseId: string) {
  return (await sql<{ version: number }>`select version from curriculum_release where id = ${releaseId}`.execute(db)).rows[0]!.version;
}

export interface PracticeItem { revisionId: string; questionId: string; familyCode: string; primaryConcepts: string[] }
export type PracticeSpec = { conceptId: string } | { setCode: string } | { questionIds: string[] };

// Published, non-private revisions, with their primary assessable concepts.
const items = (where: ReturnType<typeof sql>) => sql<PracticeItem & { item_type: string; code: string; difficulty: number }>`
  select r.id as "revisionId", q.id as "questionId", q.family_code as "familyCode", q.code, r.item_type, r.difficulty,
    coalesce((select array_agg(qc.concept_id order by qc.concept_id) from question_concept qc
      where qc.question_revision_id = r.id and qc.role = 'PRIMARY' and qc.assessable), '{}') as "primaryConcepts"
  from question q join question_revision r on r.question_id = q.id and r.status = 'PUBLISHED'
  where q.visibility <> 'PRIVATE' and ${where}`;
const strip = ({ revisionId, questionId, familyCode, primaryConcepts }: PracticeItem) => ({ revisionId, questionId, familyCode, primaryConcepts });

/** E-02: the server chooses and orders a practice session's items from a spec. Every item must be deterministic. */
export async function resolvePractice(db: Connection, release: Release, spec: PracticeSpec): Promise<PracticeItem[]> {
  if ('conceptId' in spec) {
    if (!(await sql`select 1 from concept where id = ${spec.conceptId}`.execute(db)).rows.length) fail(404, 'NOT_FOUND');
    const rows = (await items(sql`r.item_type in (${sql.join(DETERMINISTIC)}) and exists (select 1 from question_concept qc where qc.question_revision_id = r.id
      and qc.concept_id = ${spec.conceptId} and qc.role = 'PRIMARY' and qc.assessable)`).execute(db)).rows
      .sort((a, b) => a.difficulty - b.difficulty || (a.code < b.code ? -1 : 1)).slice(0, MAX_ITEMS);
    if (!rows.length) fail(409, 'CONTENT_UNAVAILABLE');
    return rows.map(strip);
  }
  const codes = 'setCode' in spec
    ? (await sql<{ items: string[] }>`select s -> 'items' as items from curriculum_release c, jsonb_array_elements(c.snapshot -> 'sets' -> 'sets') s
        where c.id = ${release.id} and s ->> 'code' = ${spec.setCode}`.execute(db)).rows[0]?.items
    : undefined;
  if ('setCode' in spec && !codes) fail(404, 'NOT_FOUND');
  const rows = (await items('setCode' in spec ? sql`q.code in (${sql.join(codes!)})` : sql`q.id in (${sql.join(spec.questionIds)})`).execute(db)).rows;
  const ordered = 'setCode' in spec ? codes!.map(code => rows.find(r => r.code === code)) : spec.questionIds.map(id => rows.find(r => r.questionId === id));
  if (ordered.some(r => !r)) fail(404, 'NOT_FOUND');
  if (ordered.some(r => !DETERMINISTIC.includes(r!.item_type))) fail(409, 'CONTENT_UNAVAILABLE');
  return ordered.slice(0, 20).map(r => strip(r!));
}

export interface LessonSource { lessonId: string; revisionId: string; revision: number; slideCount: number; conceptIds: string[]; routeSlug: string | null;
  checks: { microAssessmentId: string; questionId: string; questionRevisionId: string; slide: number; required: boolean }[] }

/** The published lesson for a concept (lesson_concept) or for a practice set (the lesson whose practiceSet it is). */
export async function lessonFor(db: Connection, release: Release, by: { conceptId: string } | { setCode: string }): Promise<LessonSource | null> {
  const lesson = 'conceptId' in by
    ? (await sql<{ id: string }>`select l.id from micro_lesson l join lesson_concept lc on lc.lesson_id = l.id
        where lc.concept_id = ${by.conceptId} and exists (select 1 from micro_lesson_revision r where r.lesson_id = l.id and r.status = 'PUBLISHED') order by l.code limit 1`.execute(db)).rows[0]
    : (await sql<{ id: string }>`select l.id from curriculum_release c, jsonb_array_elements(c.snapshot -> 'lessons') x join micro_lesson l on l.code = x ->> 'code'
        where c.id = ${release.id} and x ->> 'practiceSet' = ${by.setCode} limit 1`.execute(db)).rows[0];
  if (!lesson) return null;
  const r = (await sql<{ id: string; revision: number; slides: number; route_slug: string | null; concepts: string[] }>`
    select r.id, r.revision, l.route_slug, (select coalesce(max((b ->> 'slide')::int), 0) + 1 from jsonb_array_elements(r.blocks) b) as slides,
      coalesce((select array_agg(lc.concept_id order by c.ordinal, c.code) from lesson_concept lc join concept c on c.id = lc.concept_id where lc.lesson_id = l.id), '{}') as concepts
    from micro_lesson l join micro_lesson_revision r on r.lesson_id = l.id and r.status = 'PUBLISHED' where l.id = ${lesson.id}`.execute(db)).rows[0];
  if (!r) return null;
  const checks = (await sql<LessonSource['checks'][number]>`select a.id as "microAssessmentId", a.question_id as "questionId", qr.id as "questionRevisionId",
      a.slide_index as slide, a.required from micro_assessment a join question_revision qr on qr.question_id = a.question_id and qr.status = 'PUBLISHED'
    where a.lesson_revision_id = ${r.id} order by a.ordinal`.execute(db)).rows;
  return { lessonId: lesson.id, revisionId: r.id, revision: r.revision, slideCount: r.slides, conceptIds: r.concepts, routeSlug: r.route_slug, checks };
}

/** Learner-safe facts about revisions: question, family and hints (hint text is released only by the hint command). */
export async function revisionFacts(db: Connection, revisionIds: string[]) {
  if (!revisionIds.length) return new Map<string, { questionId: string; familyCode: string; hints: QuestionBody['hints']; conceptIds: Map<string, string> }>();
  const rows = (await sql<{ id: string; question_id: string; family_code: string; hints: QuestionBody['hints']; concepts: { id: string; code: string }[] }>`
    select r.id, r.question_id, q.family_code, r.body -> 'hints' as hints,
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code)) from question_concept qc join concept c on c.id = qc.concept_id
        where qc.question_revision_id = r.id), '[]') as concepts
    from question_revision r join question q on q.id = r.question_id where r.id in (${sql.join(revisionIds)})`.execute(db)).rows;
  return new Map(rows.map(r => [r.id, { questionId: r.question_id, familyCode: r.family_code, hints: r.hints ?? [], conceptIds: new Map(r.concepts.map(c => [c.code, c.id])) }]));
}

/** Titles and aliases for evidence views. */
export async function conceptLabels(db: Connection, conceptIds: string[]) {
  if (!conceptIds.length) return new Map<string, { code: string; title: string; legacyMapId: string | null; misconceptions: { code: string; description: string }[] }>();
  const rows = (await sql<{ id: string; code: string; title: string; legacy_map_id: string | null; misconceptions: { code: string; description: string }[] }>`
    select id, code, title, legacy_map_id, misconceptions from concept where id in (${sql.join(conceptIds)})`.execute(db)).rows;
  return new Map(rows.map(r => [r.id, { code: r.code, title: r.title, legacyMapId: r.legacy_map_id, misconceptions: r.misconceptions }]));
}

/** Slides of a pinned lesson revision (blocks carry their slide index). */
export async function slideCount(db: Connection, lessonRevisionId: string) {
  return (await sql<{ n: number }>`select coalesce(max((b ->> 'slide')::int), 0) + 1 as n from micro_lesson_revision r, jsonb_array_elements(r.blocks) b
    where r.id = ${lessonRevisionId}`.execute(db)).rows[0]?.n ?? 1;
}
