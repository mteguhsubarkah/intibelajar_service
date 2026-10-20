import { sql } from 'kysely';
import type { Tx } from '../db.js';
import { hash, stable } from './crypto.js';
import { fail } from './errors.js';
export interface Outcome { status: number; body: unknown; replayed?: boolean }
/**
 * Record an outcome under a second key (09 §6.1 rule 5 for derived keys): a facade command keyed by the state it ran in
 * is also remembered under the state it produced, so a network retry that arrives after the commit replays it.
 */
export async function remember(tx: Tx, kind: 'LEARNER'|'GUARDIAN', scope: string, operation: string, key: string, payload: unknown, outcome: Outcome) {
  await sql`insert into idempotency_record(scope_kind,scope_id,operation,key,request_sha256,status,response_status,response_body,expires_at)
    values (${kind},${scope},${operation},${key},${hash(stable(payload))},'COMPLETED',${outcome.status},${JSON.stringify(outcome.body)}::jsonb,now()+interval '7 days')
    on conflict (scope_kind,scope_id,operation,key) do nothing`.execute(tx);
}
export async function command(tx: Tx, kind: 'LEARNER'|'GUARDIAN', scope: string, operation: string,
  key: string | undefined, payload: unknown, run: () => Promise<Outcome>): Promise<Outcome> {
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) fail(400,'VALIDATION_FAILED');
  const requestHash=hash(stable(payload));
  const lock=await sql<{ok:boolean}>`select pg_try_advisory_xact_lock(hashtextextended(${kind+scope+operation+key},0)) as ok`.execute(tx);
  if (!lock.rows[0]?.ok) fail(409,'IDEMPOTENCY_IN_PROGRESS');
  await sql`delete from idempotency_record where scope_kind=${kind} and scope_id=${scope} and operation=${operation} and key=${key} and expires_at<=now()`.execute(tx);
  const prior=await sql<{request_sha256:Buffer;status:string;response_status:number;response_body:unknown}>`select * from idempotency_record where scope_kind=${kind} and scope_id=${scope} and operation=${operation} and key=${key}`.execute(tx);
  if (prior.rows[0]) {
    const p=prior.rows[0];
    if (!p.request_sha256.equals(requestHash)) fail(409,'IDEMPOTENCY_KEY_REUSED');
    if (p.status!=='COMPLETED') fail(409,'IDEMPOTENCY_IN_PROGRESS');
    return {status:p.response_status,body:p.response_body,replayed:true};
  }
  await sql`insert into idempotency_record(scope_kind,scope_id,operation,key,request_sha256,status,expires_at)
    values (${kind},${scope},${operation},${key},${requestHash},'IN_PROGRESS',now()+interval '7 days')`.execute(tx);
  const outcome=await run();
  await sql`update idempotency_record set status='COMPLETED',response_status=${outcome.status},response_body=${JSON.stringify(outcome.body)}::jsonb
    where scope_kind=${kind} and scope_id=${scope} and operation=${operation} and key=${key}`.execute(tx);
  return outcome;
}
