import type { Tx } from '../db.js';
import { removeRunJobs } from '../platform/jobs.js';
// INV-19, 04 §8 step 3: a learner's assessment rows, before the attempts they cite. One statement per
// table, so self-references (supersedes_id) are checked after the whole set is gone. Reports and the
// runs' jobs reference the runs, so they go first.
export async function eraseLearnerEvidence(tx: Tx, learnerId: string) {
  const runs = (await tx.selectFrom('diagnosis_run').select('id').where('learner_id', '=', learnerId).execute()).map(r => r.id);
  await tx.deleteFrom('diagnosis_report').where('learner_id', '=', learnerId).execute();
  await removeRunJobs(tx, runs);
  await tx.deleteFrom('concept_evidence').where('learner_id', '=', learnerId).execute();
  await tx.deleteFrom('diagnosis_run').where('learner_id', '=', learnerId).execute();
}
