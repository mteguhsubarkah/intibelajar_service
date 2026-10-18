import type { Tx } from '../db.js';
// INV-19, 04 §8 step 3: a learner's assessment rows, before the attempts they cite. One statement per
// table, so self-references (supersedes_id) are checked after the whole set is gone.
export async function eraseLearnerEvidence(tx: Tx, learnerId: string) {
  await tx.deleteFrom('concept_evidence').where('learner_id', '=', learnerId).execute();
  await tx.deleteFrom('diagnosis_run').where('learner_id', '=', learnerId).execute();
}
