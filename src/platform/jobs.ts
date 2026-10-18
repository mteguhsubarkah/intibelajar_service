import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { uuid } from './crypto.js';
// Durable jobs in PostgreSQL (04 §7). Delivery is at least once; adoption is exactly once, because whoever applies a
// result re-checks the lease token under lock (validLease). Queues: 'deletion' (Slice 0), 'diagnosis' (Slice 2).
export type Queue = 'deletion' | 'diagnosis';
export interface Lease { id: string; queue: Queue; deletion_request_id: string | null; diagnosis_run_id: string | null; lease_token: string; attempts: number }
const LEASE = "interval '45 seconds'";

export async function enqueueDeletion(tx:Tx,requestId:string) {
  await sql`insert into job(id,queue,deletion_request_id,status,deadline_at) values (${uuid()},'deletion',${requestId},'QUEUED',now()+interval '7 days') on conflict(deletion_request_id) do nothing`.execute(tx);
}
/** One job per diagnosis run (UNIQUE); its deadline is the run's (05 E-09: exhausted at deadline_at). */
export async function enqueueDiagnosis(tx:Tx,runId:string,deadlineAt:Date,maxAttempts=3) {
  await sql`insert into job(id,queue,diagnosis_run_id,status,deadline_at,max_attempts) values (${uuid()},'diagnosis',${runId},'QUEUED',${deadlineAt},${maxAttempts})
    on conflict(diagnosis_run_id) do nothing`.execute(tx);
}
export async function removeDeletionJobs(tx:Tx,requests:string[]) {
  await sql`delete from job where deletion_request_id=any(${requests}::uuid[])`.execute(tx);
}
/** Erasure (04 §8 step 3): the jobs of a learner's runs go before the runs. */
export async function removeRunJobs(tx:Tx,runIds:string[]) {
  if(runIds.length)await sql`delete from job where diagnosis_run_id=any(${runIds}::uuid[])`.execute(tx);
}
/** E-24/E-25: abandoning or expiring a session cancels its queued and running work; late results are then fenced out. */
export async function cancelRunJobs(tx:Tx,runIds:string[]) {
  if(runIds.length)await sql`update job set status='CANCELLED',lease_token=null,lease_until=null,updated_at=now()
    where diagnosis_run_id=any(${runIds}::uuid[]) and status in ('QUEUED','RUNNING')`.execute(tx);
}
export async function purgeIdempotency(tx:Tx,id:string,guardians:string[]) {
  await sql`delete from idempotency_record where scope_id=${id} or operation like ${'%:'+id+'%'}
    or (scope_kind='GUARDIAN' and scope_id=any(${guardians}::uuid[]))`.execute(tx);
}
export async function purgeExpiredIdempotency(tx:Tx) {
  await sql`delete from idempotency_record where expires_at<=now()`.execute(tx);
}
/**
 * Give a failed lease back. Deletion retries after a second (Slice 0 behaviour); other queues back off exponentially
 * with full jitter, capped at a minute. Past max_attempts or the deadline the job fails for good.
 */
export async function retryLease(db:Connection,lease:Lease,code=lease.queue==='deletion'?'ERASURE_FAILED':'JOB_FAILED') {
  const delay=lease.queue==='deletion'?sql`interval '1 second'`:sql`make_interval(secs => random() * least(power(2, ${lease.attempts}), 60))`;
  await sql`update job set status=case when attempts>=max_attempts or deadline_at<=now() then 'FAILED' else 'QUEUED' end,
    available_at=now()+${delay},lease_token=null,lease_until=null,last_error_code=${code},updated_at=now()
    where id=${lease.id} and lease_token=${lease.lease_token}`.execute(db);
}
export async function recoverLeases(db:Connection) {
  await sql`update job set status=case when attempts>=max_attempts or deadline_at<=now() then 'FAILED' else 'QUEUED' end,
    available_at=now()+interval '1 second',lease_token=null,lease_until=null,last_error_code='LEASE_EXPIRED',updated_at=now()
    where status='RUNNING' and lease_until<=now()`.execute(db);
}
export async function validLease(tx:Tx,lease:Pick<Lease,'id'|'lease_token'>) {
  return Boolean((await sql`select id from job where id=${lease.id} and status='RUNNING' and lease_token=${lease.lease_token} and lease_until>now() for update`.execute(tx)).rows[0]);
}
/** A long job extends its lease; a stale holder (token changed, or lease already expired) learns it lost the job. */
export async function heartbeat(db:Connection,lease:Pick<Lease,'id'|'lease_token'>) {
  const r=await sql`update job set lease_until=now()+${sql.raw(LEASE)},updated_at=now() where id=${lease.id} and status='RUNNING' and lease_token=${lease.lease_token} and lease_until>now()`.execute(db);
  return Number(r.numAffectedRows??0)===1;
}
/** Adoption succeeded: close the job inside the same transaction that applied the result. */
export async function completeLease(tx:Tx,lease:Pick<Lease,'id'|'lease_token'>) {
  const r=await sql`update job set status='DONE',lease_token=null,lease_until=null,updated_at=now() where id=${lease.id} and status='RUNNING' and lease_token=${lease.lease_token}`.execute(tx);
  return Number(r.numAffectedRows??0)===1;
}
export async function lease(db:Connection,queue:Queue):Promise<Lease|undefined> {
  return (await sql<Lease>`update job set status='RUNNING',lease_token=${uuid()},lease_until=now()+${sql.raw(LEASE)},attempts=attempts+1,updated_at=now()
    where id=(select id from job where queue=${queue} and status='QUEUED' and available_at<=now() and deadline_at>now() and attempts<max_attempts
    order by priority desc,available_at limit 1 for update skip locked) returning id,queue,deletion_request_id,diagnosis_run_id,lease_token,attempts`.execute(db)).rows[0];
}
export const leaseDeletion=(db:Connection)=>lease(db,'deletion');
