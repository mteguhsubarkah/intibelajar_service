import { sql } from 'kysely';
import type { Connection } from '../db.js';
import { equal, hash, hmac, stable } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import {
  conceptSummary, conceptView, lessonView, questionSummary, questionView, subjectView, topicDetail, topicView,
  type ConceptRow, type LessonRow, type QuestionRow, type SubjectRow, type TopicRow,
} from './projection.js';
// Public catalog reads (Slice 1 M3). The current release is materialised once per release into an
// in-process view (ADR option a: no cache store). Every request checks which release is current with
// one indexed lookup, so a publish is visible on the next request. Queries here never select rubric.

export interface Catalog {
  releaseId: string | null; etag: string;
  subjects: SubjectRow[]; topics: TopicRow[]; concepts: ConceptRow[]; questions: QuestionRow[]; lessons: LessonRow[];
  edges: { conceptId: string; prerequisiteId: string; kind: string }[];
  relations: { fromTopicId: string; toTopicId: string; kind: string; label: string }[];
  mapAlias: Map<string, string>;
}
const EMPTY: Catalog = { releaseId: null, etag: '"0"', subjects: [], topics: [], concepts: [], questions: [], lessons: [], edges: [], relations: [], mapAlias: new Map() };

async function load(db: Connection, release: { id: string; version: number; snapshot_sha256: Buffer }): Promise<Catalog> {
  // Membership of the release comes from its snapshot (codes only); content comes from the rows it published.
  const codes = (path: string) => sql<{ code: string }>`select jsonb_path_query(snapshot, ${path}::jsonpath) #>> '{}' as code from curriculum_release where id = ${release.id}`;
  const subjects = (await sql<SubjectRow>`select id, code, title, availability from subject
    where code in (${codes('$.subjects.subjects[*].code')}) order by code`.execute(db)).rows;
  const topics = (await sql<TopicRow>`select id, subject_id, code, legacy_id, title, subtitle, phase, availability, units from topic
    where code in (${codes('$.topics[*].code')}) order by code`.execute(db)).rows;
  const concepts = (await sql<ConceptRow>`select id, topic_id, code, legacy_map_id, title, subtitle, definition, objectives, misconceptions, unit_code,
      ordinal, estimated_minutes, availability, is_hidden, is_capstone from concept
    where code in (${codes('$.topics[*].concepts[*].code')}) order by topic_id, ordinal, code`.execute(db)).rows;
  const questions = (await sql<QuestionRow>`select q.id, q.code, q.legacy_item_id, q.visibility, r.id as revision_id, r.item_type, r.body, r.difficulty, r.estimated_minutes,
      (select jsonb_agg(jsonb_build_object('conceptId', c.id, 'topicId', c.topic_id, 'role', qc.role, 'assessable', qc.assessable) order by qc.role, c.code)
        from question_concept qc join concept c on c.id = qc.concept_id where qc.question_revision_id = r.id) as concepts
    from question q join question_revision r on r.question_id = q.id and r.status = 'PUBLISHED'
    where q.visibility <> 'PRIVATE' and q.code in (${codes('$.questions[*].code')})`.execute(db)).rows
    .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0); // keyset order must match the cursor's plain string comparison, not the DB collation
  const lessons = (await sql<LessonRow>`select l.id, l.code, l.route_slug,
      (select x ->> 'practiceSet' from curriculum_release c, jsonb_array_elements(c.snapshot -> 'lessons') x where c.id = ${release.id} and x ->> 'code' = l.code) as practice_set,
      r.revision, r.title, r.estimated_minutes, r.blocks,
      coalesce((select jsonb_agg(lc.concept_id order by c.ordinal, c.code) from lesson_concept lc join concept c on c.id = lc.concept_id where lc.lesson_id = l.id), '[]') as "conceptIds",
      coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordinal', a.ordinal, 'slide_index', a.slide_index, 'required', a.required, 'question_id', a.question_id))
        from micro_assessment a where a.lesson_revision_id = r.id), '[]') as checks
    from micro_lesson l join micro_lesson_revision r on r.lesson_id = l.id and r.status = 'PUBLISHED'
    where l.code in (${codes('$.lessons[*].code')}) order by l.code`.execute(db)).rows;
  const edges = (await sql<Catalog['edges'][number]>`select concept_id as "conceptId", prerequisite_id as "prerequisiteId", kind from concept_prerequisite order by concept_id, prerequisite_id`.execute(db)).rows;
  const relations = (await sql<Catalog['relations'][number]>`select from_topic_id as "fromTopicId", to_topic_id as "toTopicId", kind, label from topic_relation order by from_topic_id, to_topic_id`.execute(db)).rows;
  const aliases = (await sql<{ alias: string; concept_id: string }>`select alias, concept_id from catalog_alias where release_id = ${release.id} and namespace = 'MAP'`.execute(db)).rows;
  return { releaseId: release.id, etag: `"${release.version}-${release.snapshot_sha256.toString('hex').slice(0, 16)}"`, subjects, topics, concepts, questions, lessons, edges, relations,
    mapAlias: new Map(aliases.map(a => [a.alias, a.concept_id])) };
}

export interface QuestionFilter { topicId?: string; conceptId?: string; itemType?: string }

export function catalogReader(key: Buffer) {
  let cached: { releaseId: string | null; catalog: Promise<Catalog> } | undefined;
  const current = async (db: Connection) => {
    const release = await sql<{ id: string; version: number; snapshot_sha256: Buffer }>`select id, version, snapshot_sha256 from curriculum_release where is_current`.execute(db).then(r => r.rows[0]);
    const releaseId = release?.id ?? null;
    if (cached?.releaseId !== releaseId) {
      const catalog = release ? load(db, release) : Promise.resolve(EMPTY);
      cached = { releaseId, catalog };
      catalog.catch(() => { if (cached?.catalog === catalog) cached = undefined; });
    }
    return cached.catalog;
  };

  // Cursors are opaque, signed, bound to the query and the release, and expire after 24 hours (09 §5).
  const sign = (payload: string) => hmac(key, 'catalog-cursor:' + payload).toString('base64url');
  const queryHash = (f: QuestionFilter) => hash(stable(f)).toString('hex').slice(0, 32);
  const encodeCursor = (after: string, f: QuestionFilter, releaseId: string, now = Date.now()) => {
    const payload = Buffer.from(JSON.stringify({ v: 1, a: after, q: queryHash(f), r: releaseId, e: Math.floor(now / 1000) + 86400 })).toString('base64url');
    return `${payload}.${sign(payload)}`;
  };
  const decodeCursor = (cursor: string, f: QuestionFilter, releaseId: string | null) => {
    const [payload, signature, extra] = cursor.split('.');
    if (!payload || !signature || extra !== undefined || !equal(Buffer.from(signature), Buffer.from(sign(payload)))) fail(400, 'VALIDATION_FAILED');
    let c: { v: number; a: string; q: string; r: string; e: number };
    try { c = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')); } catch { return fail(400, 'VALIDATION_FAILED'); }
    if (c.v !== 1 || c.q !== queryHash(f) || c.r !== releaseId || c.e < Date.now() / 1000) fail(400, 'VALIDATION_FAILED');
    return c.a;
  };

  return {
    current, encodeCursor,
    subjects: async (db: Connection) => { const c = await current(db); return { etag: c.etag, body: { items: c.subjects.map(subjectView) } }; },
    topics: async (db: Connection, subjectCode?: string) => {
      const c = await current(db), subject = subjectCode === undefined ? undefined : c.subjects.find(s => s.code === subjectCode);
      const topics = subjectCode === undefined ? c.topics : c.topics.filter(t => t.subject_id === subject?.id);
      return { etag: c.etag, body: { items: topics.map(topicView) } };
    },
    topic: async (db: Connection, id: string) => {
      const c = await current(db), t = c.topics.find(x => x.id === id);
      if (!t) return fail(404, 'NOT_FOUND');
      const concepts = c.concepts.filter(x => x.topic_id === id), ids = new Set(concepts.map(x => x.id));
      return { etag: c.etag, body: topicDetail(t, concepts, c.edges.filter(e => ids.has(e.conceptId)), c.relations.filter(r => r.fromTopicId === id)) };
    },
    // An unknown alias gives an empty list, never another concept (09 §6.1 rule 8).
    concepts: async (db: Connection, f: { topicId?: string; legacyMapId?: string }) => {
      const c = await current(db), aliased = f.legacyMapId === undefined ? undefined : c.mapAlias.get(f.legacyMapId) ?? null;
      return { items: c.concepts.filter(x => (f.topicId === undefined || x.topic_id === f.topicId) && (aliased === undefined || x.id === aliased)).map(conceptSummary) };
    },
    concept: async (db: Connection, id: string) => {
      const c = await current(db), concept = c.concepts.find(x => x.id === id);
      if (!concept) return fail(404, 'NOT_FOUND');
      const lessons = c.lessons.filter(l => l.conceptIds.includes(id)).map(l => ({ lessonId: l.id, routeSlug: l.route_slug, title: l.title }));
      return conceptView(concept, c.edges.filter(e => e.conceptId === id).map(e => ({ conceptId: e.prerequisiteId, kind: e.kind })), lessons,
        c.questions.filter(q => q.concepts.some(x => x.conceptId === id)).length);
    },
    questions: async (db: Connection, f: QuestionFilter, cursor?: string, limit = 20) => {
      const c = await current(db), after = cursor === undefined ? undefined : decodeCursor(cursor, f, c.releaseId);
      const matching = c.questions.filter(q => (f.itemType === undefined || q.item_type === f.itemType)
        && (f.conceptId === undefined || q.concepts.some(x => x.conceptId === f.conceptId))
        && (f.topicId === undefined || q.concepts.some(x => x.topicId === f.topicId))
        && (after === undefined || q.code > after));
      const page = matching.slice(0, limit);
      return { items: page.map(questionSummary), nextCursor: matching.length > limit && c.releaseId ? encodeCursor(page.at(-1)!.code, f, c.releaseId) : null };
    },
    question: async (db: Connection, id: string) => {
      const q = (await current(db)).questions.find(x => x.id === id);
      return q ? questionView(q) : fail(404, 'NOT_FOUND');
    },
    lesson: async (db: Connection, id: string) => {
      const c = await current(db), l = c.lessons.find(x => x.id === id);
      return l ? lessonView(l, qid => c.questions.find(q => q.id === qid)) : fail(404, 'NOT_FOUND');
    },
  };
}
