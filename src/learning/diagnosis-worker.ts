import { sql } from 'kysely';
import type { Connection } from '../db.js';
import { ApiError } from '../platform/errors.js';
import { closeRunJob, completeLease, failedRunJobs, lease, recoverLeases, retryLease, runJobError, validLease, cancelRunJobs, type Lease } from '../platform/jobs.js';
import { holdLearner, requireConsent } from '../privacy/service.js';
import { cancelRuns, completeQueued, engineInput, exhaustedRuns, failRun, InvalidOutput, queuedRun, runTimeLeft, startRun, validateCandidate, type DiagnosisEngine } from '../assessment/diagnosis.js';
import type { StudentResponse } from '../assessment/evaluators/index.js';
import { adoptionTarget, applyRunResult } from './service.js';
// The diagnosis worker (Slice 2 M5; 04 §7, 05 §5.4). Delivery is at least once and adoption exactly once: a result is
// applied only inside a transaction that holds the learner lock (and re-checks consent), the session lock, a valid
// lease, the run's generation and the session's active attempt. Anything else is a late result and is discarded with
// no evidence. Runs that cannot finish (deadline, call budget) end as E-09 with no evidence (T01-4).

export type TickResult = 'idle' | 'adopted' | 'discarded' | 'retried' | 'exhausted';

/** One worker step: recover expired leases, exhaust runs that cannot finish, then process at most one job. */
export async function diagnosisTick(db: Connection, engine: DiagnosisEngine | null): Promise<TickResult> {
  await recoverLeases(db);
  let exhausted = 0;
  for (const runId of await exhaustedRuns(db, await failedRunJobs(db))) if (await exhaust(db, runId)) exhausted++;
  if (!engine) return exhausted ? 'exhausted' : 'idle';
  const held = await lease(db, 'diagnosis');
  if (!held) return exhausted ? 'exhausted' : 'idle';
  return process(db, engine, held);
}

async function process(db: Connection, engine: DiagnosisEngine, held: Lease): Promise<TickResult> {
  const run = await queuedRun(db, held.diagnosis_run_id!);
  if (!run || !await db.transaction().execute(tx => startRun(tx, run.id))) {
    await db.transaction().execute(tx => closeRunJob(tx, held));
    return 'discarded';
  }
  const attempt = (await sql<{ question_revision_id: string; response: StudentResponse }>`select question_revision_id, response from question_attempt
    where id = ${run.attemptId}`.execute(db)).rows[0];
  if (!attempt) { await db.transaction().execute(tx => closeRunJob(tx, held)); return 'discarded'; }
  // Re-check immediately before any external call, as well as at adoption. Revocation must stop transmission.
  const mayCall = await db.transaction().execute(async tx => {
    const status = await holdLearner(tx, run.learnerId);
    if (!status || status === 'DELETION_PENDING' || !await validLease(tx, held)) return false;
    try { await requireConsent(tx, run.learnerId, ['LEARNING_DATA','AI_PROCESSING']); }
    catch (error) { if (!(error instanceof ApiError)) throw error; return false; }
    return !!await adoptionTarget(tx, run.learnerId, run.attemptId, run.generation);
  });
  if (!mayCall) { await db.transaction().execute(async tx => {
    const status=await holdLearner(tx,run.learnerId);
    if(!await validLease(tx,held))return;
    const target=status && status!=='DELETION_PENDING' ? await adoptionTarget(tx,run.learnerId,run.attemptId,run.generation) : null;
    if(target){await failRun(tx,run.id,'CONSENT_REVOKED');await applyRunResult(tx,target,run.generation,'EXHAUSTED');}
    else await cancelRuns(tx,[run.id]);
    await closeRunJob(tx,held);
  }); return 'discarded'; }
  const input = await engineInput(db, attempt.question_revision_id, run.purpose, attempt.response);
  let candidate: ReturnType<typeof validateCandidate>;
  try {
    // The call may not outlive the run's deadline (E-09); an abort or a throw is a failed call, never a diagnosis.
    const remaining = await runTimeLeft(db, run.id);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), remaining);
    try {
      const raw = await Promise.race([engine.diagnose(input, controller.signal),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('DEADLINE_EXCEEDED')), { once: true }))]);
      candidate = validateCandidate(raw, input);
    } finally { clearTimeout(timer); }
  } catch (error) {
    await retryLease(db, held, error instanceof InvalidOutput ? 'INVALID_OUTPUT' : 'JOB_FAILED');
    for (const runId of await exhaustedRuns(db, await failedRunJobs(db))) await exhaust(db, runId);
    return 'retried';
  }
  return db.transaction().execute(async tx => {
    // Fences, in the order of 04 §7: learner lock and consent, lease, session lock, generation and active attempt.
    // An erased or erasing learner's result is dropped; a revoked consent ends the run without its result (below).
    const status = await holdLearner(tx, run.learnerId);
    let consented = true;
    try { await requireConsent(tx, run.learnerId, ['LEARNING_DATA', 'AI_PROCESSING']); }
    catch (error) { if (!(error instanceof ApiError)) throw error; consented = false; }
    if (!await validLease(tx, held)) return 'discarded' as const;
    const target = status === null || status === 'DELETION_PENDING' ? null : await adoptionTarget(tx, run.learnerId, run.attemptId, run.generation);
    if (!target || (await queuedRun(tx, run.id))?.status !== 'RUNNING') {
      await cancelRuns(tx, [run.id]);
      await closeRunJob(tx, held);
      return 'discarded' as const;
    }
    if (!consented) {
      // Consent changed while the job ran: the result is not used, and the loop can resume after re-consent (E-09, E-10).
      await failRun(tx, run.id, 'CONSENT_REVOKED');
      await applyRunResult(tx, target, run.generation, 'EXHAUSTED');
      await closeRunJob(tx, held);
      return 'exhausted' as const;
    }
    const result = await completeQueued(tx, run, target, candidate);
    await applyRunResult(tx, target, run.generation, result);
    if (!await completeLease(tx, held)) throw new Error('lease lost during adoption');
    return 'adopted' as const;
  });
}

/** E-09: the run ends FAILED with no evidence; when its session still waits for it, the loop moves to EVALUATION_FAILED. */
async function exhaust(db: Connection, runId: string) {
  return db.transaction().execute(async tx => {
    const run = await queuedRun(tx, runId);
    if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) return false;
    // Learner lock first (04 §7 order), without requiring consent: exhaustion writes no learner content.
    await holdLearner(tx, run.learnerId);
    const target = await adoptionTarget(tx, run.learnerId, run.attemptId, run.generation);
    const code = run.deadlinePassed ? 'DEADLINE_EXCEEDED' : (await runJobError(tx, runId)) === 'INVALID_OUTPUT' ? 'INVALID_OUTPUT' : 'DEPENDENCY_UNAVAILABLE';
    await failRun(tx, runId, code);
    await cancelRunJobs(tx, [runId]);
    if (target) await applyRunResult(tx, target, run.generation, 'EXHAUSTED');
    return true;
  });
}
