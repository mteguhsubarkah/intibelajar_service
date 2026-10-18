import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import { uuid } from './crypto.js';
export async function enqueueDeletion(tx:Tx,requestId:string) {
  await sql`insert into job(id,queue,deletion_request_id,status,deadline_at) values (${uuid()},'deletion',${requestId},'QUEUED',now()+interval '7 days') on conflict(deletion_request_id) do nothing`.execute(tx);
}
export async function removeDeletionJobs(tx:Tx,requests:string[]) {
  await sql`delete from job where deletion_request_id=any(${requests}::uuid[])`.execute(tx);
}
export async function purgeIdempotency(tx:Tx,id:string,guardians:string[]) {
  await sql`delete from idempotency_record where scope_id=${id} or operation like ${'%:'+id+'%'}
    or (scope_kind='GUARDIAN' and scope_id=any(${guardians}::uuid[]))`.execute(tx);
}
export async function purgeExpiredIdempotency(tx:Tx) {
  await sql`delete from idempotency_record where expires_at<=now()`.execute(tx);
}
export async function retryLease(db:Connection,lease:Lease) {
  await sql`update job set status=case when attempts>=max_attempts then 'FAILED' else 'QUEUED' end,
    available_at=now()+interval '1 second',lease_token=null,lease_until=null,last_error_code='ERASURE_FAILED',updated_at=now()
    where id=${lease.id} and lease_token=${lease.lease_token}`.execute(db);
}
export async function recoverLeases(db:Connection) {
  await sql`update job set status=case when attempts>=max_attempts or deadline_at<=now() then 'FAILED' else 'QUEUED' end,
    available_at=now()+interval '1 second',lease_token=null,lease_until=null,last_error_code='LEASE_EXPIRED',updated_at=now()
    where status='RUNNING' and lease_until<=now()`.execute(db);
}
export interface Lease {id:string;deletion_request_id:string;lease_token:string}
export async function validLease(tx:Tx,lease:Lease) {
  return Boolean((await sql`select id from job where id=${lease.id} and status='RUNNING' and lease_token=${lease.lease_token} and lease_until>now() for update`.execute(tx)).rows[0]);
}
export async function leaseDeletion(db:Connection):Promise<Lease|undefined> {
  return (await sql<Lease>`update job set status='RUNNING',lease_token=${uuid()},lease_until=now()+interval '45 seconds',attempts=attempts+1,updated_at=now()
    where id=(select id from job where queue='deletion' and status='QUEUED' and available_at<=now() and deadline_at>now() and attempts<max_attempts
    order by priority desc,available_at limit 1 for update skip locked) returning id,deletion_request_id,lease_token`.execute(db)).rows[0];
}
