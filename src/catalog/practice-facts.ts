import { sql } from "kysely";
import type { Connection } from "../db.js";
import type { QuestionRow } from "./projection.js";

/** Public historical question text for revisions the caller already owns attempts for; no keys. */
export async function practiceRevisions(
  db: Connection,
  revisionIds: string[],
): Promise<QuestionRow[]> {
  if (!revisionIds.length) return [];
  return (
    await sql<QuestionRow>`select q.id,q.code,q.legacy_item_id,q.visibility,r.id as revision_id,r.item_type,r.body,r.difficulty,r.estimated_minutes,
    coalesce((select jsonb_agg(jsonb_build_object('conceptId',c.id,'topicId',c.topic_id,'role',qc.role,'assessable',qc.assessable))
      from question_concept qc join concept c on c.id=qc.concept_id where qc.question_revision_id=r.id),'[]') as concepts
    from question_revision r join question q on q.id=r.question_id
    where r.id in (${sql.join(revisionIds)}) and q.visibility <> 'PRIVATE'`.execute(
      db,
    )
  ).rows;
}
