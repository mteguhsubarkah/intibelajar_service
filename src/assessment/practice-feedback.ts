import { sql } from "kysely";
import type { Connection } from "../db.js";
/** Already released feedback only, scoped to the owner; never read answer keys. */
export async function practiceFeedback(db: Connection, learnerId: string) {
  return (
    await sql<{
      attempt_id: string;
      headline: string | null;
      lede: string | null;
      recommendations: { conceptId?: string }[];
    }>`select distinct on (attempt_id) attempt_id,headline,lede,recommendations
    from diagnosis_run where learner_id=${learnerId} and status='COMPLETED' order by attempt_id,generation desc,id desc`.execute(
      db,
    )
  ).rows;
}
