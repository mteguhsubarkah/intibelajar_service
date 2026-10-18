import { sql } from 'kysely';
import type { DB, Tx } from '../db.js';
import type { Config } from '../config.js';
import { hmac, uuid } from '../platform/crypto.js';
import { eraseGuardianIdentity, eraseLearnerIdentity } from '../identity/service.js';
import { removeDeletionJobs, purgeIdempotency, purgeExpiredIdempotency, retryLease, recoverLeases, leaseDeletion, validLease, type Lease } from '../platform/jobs.js';
import { deletion } from './service.js';
import {queueRestoredErasures} from './recovery.js';
import { eraseLearnerEvidence } from '../assessment/erasure.js';
import { eraseLearnerLearning } from '../learning/erasure.js';
export async function sweep(tx:Tx,config:Config) {
  const expired=await tx.selectFrom('learner').select('id').where('status','=','PENDING_CONSENT').where('consent_deadline_at','<=',sql<Date>`now()`).orderBy('id').forUpdate().skipLocked().execute();
  for(const row of expired) await deletion(tx,config,row.id,'SYSTEM','CONSENT_EXPIRED');
  await sql`update consent_record set status='EXPIRED',updated_at=now() where status in ('PENDING','GRANTED') and expires_at<=now()`.execute(tx);
  await sql`update learner set status='SUSPENDED',version=version+1,updated_at=now() where status='ACTIVE' and not exists
    (select 1 from consent_record where learner_id=learner.id and purpose='LEARNING_DATA' and status='GRANTED' and expires_at>now())`.execute(tx);
  await purgeExpiredIdempotency(tx);
}
export async function adoptErasure(tx:Tx,config:Config,lease:Lease) {
  const request=(await sql<{learner_id:string}>`select learner_id from deletion_request where id=${lease.deletion_request_id}`.execute(tx)).rows[0];
  if(!request) return false;
  const id=request.learner_id;
  const learner=await tx.selectFrom('learner').selectAll().where('id','=',id).forUpdate().executeTakeFirst();
  if(!learner || learner.status!=='DELETION_PENDING') return false;
  if(!await validLease(tx,lease)) return false;
  const guardians=(await tx.selectFrom('consent_record').select('guardian_id').distinct().where('learner_id','=',id).execute()).map(r=>r.guardian_id);
  await eraseLearnerEvidence(tx,id);
  await eraseLearnerLearning(tx,id);
  await eraseLearnerIdentity(tx,id);
  await tx.deleteFrom('student_profile').where('learner_id','=',id).execute();
  await tx.deleteFrom('consent_record').where('learner_id','=',id).execute();
  await purgeIdempotency(tx,id,guardians);
  await sql`delete from audit_event where subject_ref=${hmac(config.key,'subject:'+id)} or actor_ref=${hmac(config.key,'actor:'+id)}`.execute(tx);
  const requests=await tx.selectFrom('deletion_request').select('id').where('learner_id','=',id).execute();
  await removeDeletionJobs(tx,requests.map(r=>r.id));
  await sql`delete from deletion_request where learner_id=${id}`.execute(tx);
  await sql`insert into erasure_receipt(receipt_id,subject_digest,completed_at,backup_purge_after)
    values (${uuid()},${hmac(config.key,'erasure:'+id)},now(),now()+interval '35 days') on conflict(subject_digest) do nothing`.execute(tx);
  await tx.deleteFrom('learner').where('id','=',id).execute();
  for(const g of guardians) {
    const referenced=await tx.selectFrom('consent_record').select('id').where('guardian_id','=',g).executeTakeFirst();
    if(!referenced) {
      await eraseGuardianIdentity(tx,g);
      await sql`delete from audit_event where actor_ref=${hmac(config.key,'actor:'+g)}`.execute(tx);
      await tx.deleteFrom('guardian').where('id','=',g).execute();
    }
  }
  return true;
}
export async function workerTick(db:DB,config:Config) {
  await db.transaction().execute(async tx=>{await queueRestoredErasures(tx,config);await sweep(tx,config);}); await recoverLeases(db);
  const lease=await leaseDeletion(db); if(!lease) return false;
  try { return await db.transaction().execute(tx=>adoptErasure(tx,config,lease)); }
  catch {
    await retryLease(db,lease);
    return false;
  }
}
