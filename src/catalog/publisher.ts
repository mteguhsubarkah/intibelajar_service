import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { DB, Tx } from '../db.js';
import { stable, uuid } from '../platform/crypto.js';
import { auditSystem } from '../privacy/service.js';
import { lintManifest, type Alias, type Finding, type Lesson, type Manifest, type Namespace, type Question } from './manifest.js';
// Catalog publisher (Slice 1 M2, 04 §3 publication rule). One transaction under an advisory lock:
// everything is written as DRAFT, checked again in SQL, then frozen by flipping it to PUBLISHED.
// Changed content becomes a new revision; database triggers reject in-place edits (INV-04).

export const CATALOG_LOCK = 89164002;

export class PublishError extends Error {
  constructor(readonly code: 'MANIFEST_INVALID'|'RELEASE_VERSION_NOT_INCREMENTED'|'CONCEPT_TOPIC_CHANGED'|'MISCONCEPTION_REMOVED'|'QUESTION_IDENTITY_CHANGED'|'PREREQ_CYCLE'|'STEP_CONCEPT_UNMAPPED',
    message: string, readonly findings: Finding[] = []) { super(message); }
}

export interface PublishResult {
  status: 'PUBLISHED'|'UNCHANGED'; releaseId: string; version: number; sha256: string;
  questions: { created: number; reused: number; retired: number }; lessons: { created: number; reused: number; retired: number }; aliases: number;
}

/** Canonical snapshot: key-sorted JSON of the manifest. Its SHA-256 identifies the release content. */
export function snapshotOf(m: Manifest) {
  const json = stable(m);
  return { json, sha256: createHash('sha256').update(json).digest() };
}

const first = (aliases: Alias[], ns: Namespace) => aliases.find(a => a.ns === ns)?.value ?? null;
const json = (value: unknown) => JSON.stringify(value);
// Content that defines a revision. Equal content reuses the published revision; anything else makes a new one.
const questionContent = (q: Pick<Question, 'itemType'|'body'|'rubric'|'contextTag'|'difficulty'|'estimatedMinutes'|'provenance'|'concepts'>) => stable({
  itemType: q.itemType, body: q.body, rubric: q.rubric, contextTag: q.contextTag, difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes,
  provenance: q.provenance, concepts: [...q.concepts].sort((a, b) => a.concept.localeCompare(b.concept)),
});
const lessonContent = (l: Pick<Lesson, 'title'|'estimatedMinutes'|'blocks'|'checks'>) => stable({
  title: l.title, estimatedMinutes: l.estimatedMinutes, blocks: l.blocks, checks: [...l.checks].sort((a, b) => a.ordinal - b.ordinal),
});

export async function publish(db: DB, m: Manifest): Promise<PublishResult> {
  // The publisher has no override: an unreviewed or invalid manifest is never published.
  const findings = lintManifest(m, { strict: true });
  if (findings.length) throw new PublishError('MANIFEST_INVALID', `Manifest lint failed with ${findings.length} finding(s)`, findings);
  const { json: snapshot, sha256 } = snapshotOf(m);
  return db.transaction().execute(async tx => {
    await sql`select pg_advisory_xact_lock(${CATALOG_LOCK})`.execute(tx);
    const current = await tx.selectFrom('curriculum_release').select(['id', 'version', 'snapshot_sha256']).where('is_current', '=', true).executeTakeFirst();
    const empty = { created: 0, reused: 0, retired: 0 };
    if (current?.snapshot_sha256?.equals(sha256)) return { status: 'UNCHANGED', releaseId: current.id, version: current.version, sha256: sha256.toString('hex'), questions: empty, lessons: empty, aliases: 0 };
    const latest = (await tx.selectFrom('curriculum_release').select(sql<number>`coalesce(max(version), 0)`.as('v')).executeTakeFirstOrThrow()).v;
    if (m.release.version <= latest) throw new PublishError('RELEASE_VERSION_NOT_INCREMENTED', `Manifest release version ${m.release.version} must be greater than ${latest}`);
    const releaseId = uuid();
    await tx.insertInto('curriculum_release').values({ id: releaseId, version: m.release.version, status: 'DRAFT', is_current: false }).execute();

    // Legacy alias columns are a projection of catalog_alias; clear them first so an alias may move between entities.
    await sql`update topic set legacy_id = null where legacy_id is not null`.execute(tx);
    await sql`update concept set legacy_map_id = null where legacy_map_id is not null`.execute(tx);
    await sql`update question set legacy_item_id = null where legacy_item_id is not null`.execute(tx);
    await sql`update micro_lesson set route_slug = null where route_slug is not null`.execute(tx);

    const subjectId = await upsertSubjects(tx, m), topicId = await upsertTopics(tx, m, subjectId), conceptId = await upsertConcepts(tx, m, topicId);
    await sql`delete from concept_prerequisite`.execute(tx);
    const prerequisites = m.topics.flatMap(t => t.prerequisites.map(p => ({ concept_id: conceptId.get(p.concept)!, prerequisite_id: conceptId.get(p.requires)!, kind: p.kind })));
    if (prerequisites.length) await tx.insertInto('concept_prerequisite').values(prerequisites).execute();
    await sql`delete from topic_relation`.execute(tx);
    const relations = m.topicRelations.relations.map(r => ({ from_topic_id: topicId.get(r.from)!, to_topic_id: topicId.get(r.to)!, kind: r.kind, label: r.label, source: r.source }));
    if (relations.length) await tx.insertInto('topic_relation').values(relations).execute();

    const { ids: questionId, stats: questions } = await publishQuestions(tx, m, releaseId, conceptId);
    const { ids: lessonId, stats: lessons } = await publishLessons(tx, m, releaseId, conceptId, questionId);

    const aliasRows = [
      ...m.subjects.subjects.flatMap(s => s.aliases.map(a => ({ ...a, subject_id: subjectId.get(s.code)! }))),
      ...m.topics.flatMap(t => [...t.aliases.map(a => ({ ...a, topic_id: topicId.get(t.code)! })),
        ...t.concepts.flatMap(c => c.aliases.map(a => ({ ...a, concept_id: conceptId.get(c.code)! })))]),
      ...m.questions.flatMap(q => q.aliases.map(a => ({ ...a, question_id: questionId.get(q.code)! }))),
      ...m.lessons.flatMap(l => l.aliases.map(a => ({ ...a, lesson_id: lessonId.get(l.code)! }))),
    ].map(({ ns, value, ...entity }) => ({ release_id: releaseId, namespace: ns, alias: value, ...entity }));
    if (aliasRows.length) await tx.insertInto('catalog_alias').values(aliasRows).execute();

    // Defence in depth: the rules that matter most are checked again against what was written.
    const cycle = (await sql<{ path: string[] }>`
      with recursive walk(node, path, cycle) as (
        select p.concept_id, array[p.prerequisite_id, p.concept_id], p.prerequisite_id = p.concept_id from concept_prerequisite p where p.kind = 'HARD'
        union all
        select p.concept_id, w.path || p.concept_id, p.concept_id = any(w.path)
        from walk w join concept_prerequisite p on p.prerequisite_id = w.node and p.kind = 'HARD' where not w.cycle)
      select (select array_agg(c.code order by o) from unnest(w.path) with ordinality as u(id, o) join concept c on c.id = u.id) as path
      from walk w where w.cycle limit 1`.execute(tx)).rows[0];
    if (cycle) throw new PublishError('PREREQ_CYCLE', `Hard prerequisites form a cycle: ${cycle.path.join(' → ')}`);
    const unmapped = (await sql<{ code: string; concept: string }>`
      select q.code, step_concept ->> 'code' as concept
      from question_revision r join question q on q.id = r.question_id
      cross join lateral jsonb_array_elements(r.rubric -> 'solutionPaths') path
      cross join lateral jsonb_array_elements(path -> 'steps') step
      cross join lateral jsonb_array_elements(step -> 'concepts') step_concept
      where r.release_id = ${releaseId} and not exists (
        select 1 from question_concept qc join concept c on c.id = qc.concept_id
        where qc.question_revision_id = r.id and c.code = step_concept ->> 'code')`.execute(tx)).rows;
    if (unmapped.length) throw new PublishError('STEP_CONCEPT_UNMAPPED', unmapped.map(u => `${u.code}: ${u.concept}`).join('; '));

    // Freeze: revisions of this release, then the release itself.
    await sql`update question_revision set status = 'PUBLISHED', published_at = now() where release_id = ${releaseId} and status = 'DRAFT'`.execute(tx);
    await sql`update micro_lesson_revision set status = 'PUBLISHED', published_at = now() where release_id = ${releaseId} and status = 'DRAFT'`.execute(tx);
    await sql`update curriculum_release set is_current = false where is_current`.execute(tx);
    await sql`update curriculum_release set status = 'PUBLISHED', is_current = true, snapshot = ${snapshot}::jsonb, snapshot_sha256 = ${sha256}, published_at = now() where id = ${releaseId}`.execute(tx);
    await auditSystem(tx, 'CATALOG_PUBLISHED', { version: m.release.version, sha256: sha256.toString('hex') });
    return { status: 'PUBLISHED', releaseId, version: m.release.version, sha256: sha256.toString('hex'), questions, lessons, aliases: aliasRows.length };
  });
}

async function upsertSubjects(tx: Tx, m: Manifest) {
  const ids = new Map<string, string>();
  for (const s of m.subjects.subjects) {
    const row = await tx.insertInto('subject').values({ id: uuid(), code: s.code, title: s.title, availability: s.availability })
      .onConflict(oc => oc.column('code').doUpdateSet({ title: s.title, availability: s.availability, updated_at: sql`now()` })).returning('id').executeTakeFirstOrThrow();
    ids.set(s.code, row.id);
  }
  return ids;
}

async function upsertTopics(tx: Tx, m: Manifest, subjectId: Map<string, string>) {
  const ids = new Map<string, string>();
  for (const t of m.topics) {
    const values = { subject_id: subjectId.get(t.subject)!, legacy_id: first(t.aliases, 'TOPIC'), title: t.title, subtitle: t.subtitle ?? null, phase: t.phase,
      availability: t.availability, units: json(t.units), bekal: t.bekal };
    const row = await tx.insertInto('topic').values({ id: uuid(), code: t.code, ...values })
      .onConflict(oc => oc.column('code').doUpdateSet({ ...values, updated_at: sql`now()` })).returning('id').executeTakeFirstOrThrow();
    ids.set(t.code, row.id);
  }
  return ids;
}

async function upsertConcepts(tx: Tx, m: Manifest, topicId: Map<string, string>) {
  const existing = new Map((await tx.selectFrom('concept').select(['code', 'topic_id', 'misconceptions']).execute()).map(c => [c.code, c]));
  const ids = new Map<string, string>();
  for (const t of m.topics) for (const c of t.concepts) {
    const before = existing.get(c.code);
    if (before && before.topic_id !== topicId.get(t.code)) throw new PublishError('CONCEPT_TOPIC_CHANGED', `Concept ${c.code} cannot move to topic ${t.code}`);
    const removed = ((before?.misconceptions ?? []) as { code: string }[]).filter(o => !c.misconceptions.some(n => n.code === o.code));
    if (removed.length) throw new PublishError('MISCONCEPTION_REMOVED', `Concept ${c.code} drops misconception ${removed.map(r => r.code).join(', ')}; codes are append-only`);
    const values = { topic_id: topicId.get(t.code)!, legacy_map_id: first(c.aliases, 'MAP'), title: c.title, subtitle: c.subtitle ?? null, definition: c.definition ?? null,
      objectives: json(c.objectives), misconceptions: json(c.misconceptions), unit_code: c.unit ?? null, ordinal: c.ordinal, estimated_minutes: c.estimatedMinutes,
      is_hidden: c.hidden, is_capstone: c.capstone, availability: c.availability };
    const row = await tx.insertInto('concept').values({ id: uuid(), code: c.code, ...values })
      .onConflict(oc => oc.column('code').doUpdateSet({ ...values, updated_at: sql`now()` })).returning('id').executeTakeFirstOrThrow();
    ids.set(c.code, row.id);
  }
  return ids;
}

async function publishQuestions(tx: Tx, m: Manifest, releaseId: string, conceptId: Map<string, string>) {
  const stats = { created: 0, reused: 0, retired: 0 }, ids = new Map<string, string>();
  const existing = new Map((await tx.selectFrom('question').select(['id', 'code', 'family_code', 'visibility']).where('origin', '=', 'AUTHORED').execute()).map(q => [q.code, q]));
  const published = new Map((await sql<{ question_id: string; id: string; revision: number; item_type: string; body: Question['body']; rubric: Question['rubric']; context_tag: string;
    difficulty: number; estimated_minutes: number; provenance: Question['provenance']; concepts: Question['concepts'] }>`
    select r.question_id, r.id, r.revision, r.item_type, r.body, r.rubric, r.context_tag, r.difficulty, r.estimated_minutes, r.provenance,
      coalesce((select jsonb_agg(jsonb_build_object('concept', c.code, 'role', qc.role, 'assessable', qc.assessable))
        from question_concept qc join concept c on c.id = qc.concept_id where qc.question_revision_id = r.id), '[]') as concepts
    from question_revision r where r.status = 'PUBLISHED' and r.release_id is not null`.execute(tx)).rows.map(r => [r.question_id, r]));
  for (const q of m.questions) {
    const before = existing.get(q.code);
    if (before && (before.family_code !== q.familyCode || before.visibility !== q.visibility))
      throw new PublishError('QUESTION_IDENTITY_CHANGED', `Question ${q.code} cannot change family or visibility; author a new question`);
    const row = await tx.insertInto('question').values({ id: uuid(), code: q.code, legacy_item_id: first(q.aliases, 'ITEM'), family_code: q.familyCode, visibility: q.visibility, origin: 'AUTHORED' })
      .onConflict(oc => oc.column('code').doUpdateSet({ legacy_item_id: first(q.aliases, 'ITEM'), updated_at: sql`now()` })).returning('id').executeTakeFirstOrThrow();
    ids.set(q.code, row.id);
    const live = published.get(row.id);
    if (live && questionContent({ itemType: live.item_type as Question['itemType'], body: live.body, rubric: live.rubric, contextTag: live.context_tag, difficulty: live.difficulty,
      estimatedMinutes: live.estimated_minutes, provenance: live.provenance, concepts: live.concepts }) === questionContent(q)) { stats.reused++; continue; }
    if (live) { await sql`update question_revision set status = 'RETIRED' where id = ${live.id}`.execute(tx); stats.retired++; }
    const revisionId = uuid();
    await tx.insertInto('question_revision').values({
      id: revisionId, question_id: row.id, revision: (live?.revision ?? 0) + 1, release_id: releaseId, status: 'DRAFT', item_type: q.itemType, body: json(q.body), rubric: json(q.rubric),
      review_status: 'REVIEWED', context_tag: q.contextTag, difficulty: q.difficulty, estimated_minutes: q.estimatedMinutes, provenance: json(q.provenance),
    }).execute();
    await tx.insertInto('question_concept').values(q.concepts.map(c => ({ question_revision_id: revisionId, concept_id: conceptId.get(c.concept)!, role: c.role, assessable: c.assessable }))).execute();
    stats.created++;
  }
  // Questions no longer in the manifest stay referencable by old attempts; only their live revision retires.
  for (const [code, q] of existing) if (!ids.has(code) && published.has(q.id)) {
    await sql`update question_revision set status = 'RETIRED' where id = ${published.get(q.id)!.id}`.execute(tx); stats.retired++;
  }
  return { ids, stats };
}

async function publishLessons(tx: Tx, m: Manifest, releaseId: string, conceptId: Map<string, string>, questionId: Map<string, string>) {
  const stats = { created: 0, reused: 0, retired: 0 }, ids = new Map<string, string>();
  const existing = new Map((await tx.selectFrom('micro_lesson').select(['id', 'code']).execute()).map(l => [l.code, l.id]));
  const published = new Map((await sql<{ lesson_id: string; id: string; revision: number; title: string; estimated_minutes: number; blocks: Lesson['blocks']; checks: Lesson['checks'] }>`
    select r.lesson_id, r.id, r.revision, r.title, r.estimated_minutes, r.blocks,
      coalesce((select jsonb_agg(jsonb_build_object('question', q.code, 'ordinal', a.ordinal, 'slideIndex', a.slide_index, 'required', a.required))
        from micro_assessment a join question q on q.id = a.question_id where a.lesson_revision_id = r.id), '[]') as checks
    from micro_lesson_revision r where r.status = 'PUBLISHED'`.execute(tx)).rows.map(r => [r.lesson_id, r]));
  await sql`delete from lesson_concept`.execute(tx);
  for (const l of m.lessons) {
    const row = await tx.insertInto('micro_lesson').values({ id: uuid(), code: l.code, route_slug: first(l.aliases, 'ROUTE') })
      .onConflict(oc => oc.column('code').doUpdateSet({ route_slug: first(l.aliases, 'ROUTE'), updated_at: sql`now()` })).returning('id').executeTakeFirstOrThrow();
    ids.set(l.code, row.id);
    await tx.insertInto('lesson_concept').values(l.concepts.map(c => ({ lesson_id: row.id, concept_id: conceptId.get(c)! }))).execute();
    const live = published.get(row.id);
    if (live && lessonContent({ title: live.title, estimatedMinutes: live.estimated_minutes, blocks: live.blocks, checks: live.checks }) === lessonContent(l)) { stats.reused++; continue; }
    if (live) { await sql`update micro_lesson_revision set status = 'RETIRED' where id = ${live.id}`.execute(tx); stats.retired++; }
    const revisionId = uuid();
    await tx.insertInto('micro_lesson_revision').values({ id: revisionId, lesson_id: row.id, revision: (live?.revision ?? 0) + 1, release_id: releaseId, status: 'DRAFT',
      title: l.title, estimated_minutes: l.estimatedMinutes, blocks: json(l.blocks) }).execute();
    if (l.checks.length) await tx.insertInto('micro_assessment').values(l.checks.map(c => ({ id: uuid(), lesson_revision_id: revisionId, question_id: questionId.get(c.question)!,
      ordinal: c.ordinal, required: c.required, slide_index: c.slideIndex }))).execute();
    stats.created++;
  }
  for (const [code, id] of existing) if (!ids.has(code) && published.has(id)) {
    await sql`update micro_lesson_revision set status = 'RETIRED' where id = ${published.get(id)!.id}`.execute(tx); stats.retired++;
  }
  return { ids, stats };
}
