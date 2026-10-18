import { sql } from 'kysely';
import type { Connection } from '../db.js';
import type { QuestionBody, Rubric } from './manifest.js';
// The one catalog interface that hands a rubric out, and only to assessment (INV-05; the boundary
// checker allows rubric reads here, in the publisher and in src/assessment/). Pinned by revision id,
// so a session is always graded against the content it was shown (INV-04).

export interface GradingSource {
  revisionId: string; itemType: string; body: QuestionBody; rubric: Rubric; familyCode: string; contextTag: string;
  concepts: { id: string; code: string; role: 'PRIMARY' | 'SUPPORTING'; assessable: boolean }[];
}

export async function gradingSource(db: Connection, revisionId: string): Promise<GradingSource> {
  const row = (await sql<{ item_type: string; body: QuestionBody; rubric: Rubric; family_code: string; context_tag: string; concepts: GradingSource['concepts'] }>`
    select r.item_type, r.body, r.rubric, q.family_code, r.context_tag,
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'role', qc.role, 'assessable', qc.assessable) order by c.code)
        from question_concept qc join concept c on c.id = qc.concept_id where qc.question_revision_id = r.id), '[]') as concepts
    from question_revision r join question q on q.id = r.question_id where r.id = ${revisionId}`.execute(db)).rows[0];
  if (!row) throw new Error(`Unknown question revision ${revisionId}`);
  return { revisionId, itemType: row.item_type, body: row.body, rubric: row.rubric, familyCode: row.family_code, contextTag: row.context_tag, concepts: row.concepts };
}
