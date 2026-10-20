import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { uuid } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { requireConsent } from '../privacy/service.js';
// Disputes, learner side (Slice 2 M6; 06 §9.3): "Hasil keliru? Laporkan". A learner files one report per completed run
// of their own. The report is OPEN until staff resolve it; resolution and the EDUCATOR regrade wait for D7 (staff tool).
// While a report is OPEN the disputed evidence keeps counting (06 §9.3 rule 5): filing never touches evidence.
// The note is learner free text (class C3): it is stored, never logged, never returned, and erased with the learner.

export type ReportReason = 'ANSWER_WAS_CORRECT' | 'WRONG_CONCEPT' | 'UNCLEAR_EXPLANATION' | 'OTHER';
type ReportRow = { id: string; diagnosis_run_id: string; reason: ReportReason; status: 'OPEN' | 'UPHELD' | 'REJECTED'; created_at: Date; resolved_at: Date | null };
const view = (r: ReportRow) => ({ id: r.id, diagnosisRunId: r.diagnosis_run_id, reason: r.reason, status: r.status, createdAt: r.created_at.toISOString(),
  ...(r.resolved_at ? { resolvedAt: r.resolved_at.toISOString() } : {}) });

/**
 * File a report (the caller holds the idempotency claim and the learner lock). Order: consent, ownership (404 for a
 * run that is not the learner's), the run must be completed (a run still waiting or failed has no diagnosis to
 * dispute: 409 INVALID_STATE_TRANSITION), one report per run (409 ALREADY_REPORTED). Every refusal writes nothing.
 */
export async function fileReport(tx: Tx, learnerId: string, runId: string, body: { reason: ReportReason; note?: string }) {
  await requireConsent(tx, learnerId, ['LEARNING_DATA']);
  const run = (await sql<{ status: string }>`select status from diagnosis_run where id = ${runId} and learner_id = ${learnerId}`.execute(tx)).rows[0];
  if (!run) return fail(404, 'NOT_FOUND');
  if (run.status !== 'COMPLETED') return fail(409, 'INVALID_STATE_TRANSITION', { runStatus: run.status });
  const existing = await reportOf(tx, runId, learnerId);
  if (existing) return fail(409, 'ALREADY_REPORTED', { report: existing });
  const id = uuid();
  await sql`insert into diagnosis_report(id, diagnosis_run_id, learner_id, reason, note, status) values (${id}, ${runId}, ${learnerId}, ${body.reason}, ${body.note ?? null}, 'OPEN')`.execute(tx);
  const row = (await sql<ReportRow>`select id, diagnosis_run_id, reason, status, created_at, resolved_at from diagnosis_report where id = ${id}`.execute(tx)).rows[0]!;
  return { status: 201, body: view(row) };
}

/** The report of a learner's run, as the run view shows it (DiagnosisRun.report). */
export async function reportOf(db: Connection, runId: string, learnerId: string) {
  return (await sql<{ id: string; status: 'OPEN' | 'UPHELD' | 'REJECTED' }>`select id, status from diagnosis_report
    where diagnosis_run_id = ${runId} and learner_id = ${learnerId}`.execute(db)).rows[0] ?? null;
}
