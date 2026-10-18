import { sql } from 'kysely';
import type { Tx } from '../db.js';
// INV-19, 04 §8 step 3: a learner's sessions and everything under them, child to parent. Runs after
// eraseLearnerEvidence (evidence and runs cite attempts). One statement per table, so self-references
// (parent_attempt_id) are checked after the whole set is gone; attempts stay immutable (INV-07).
export async function eraseLearnerLearning(tx: Tx, learnerId: string) {
  await sql`update learning_session set active_attempt_id = null where learner_id = ${learnerId} and active_attempt_id is not null`.execute(tx);
  await tx.deleteFrom('question_attempt').where('learner_id', '=', learnerId).execute();
  await tx.deleteFrom('assistance_event').where('learner_id', '=', learnerId).execute();
  await sql`delete from lesson_assignment where session_id in (select id from learning_session where learner_id = ${learnerId})`.execute(tx);
  await sql`delete from session_item where session_id in (select id from learning_session where learner_id = ${learnerId})`.execute(tx);
  await tx.deleteFrom('learning_session').where('learner_id', '=', learnerId).execute();
}
