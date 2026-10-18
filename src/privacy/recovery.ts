import type {Connection,Tx} from '../db.js';
import type {Config} from '../config.js';
import {hmac} from '../platform/crypto.js';
import {deletion} from './service.js';
export async function restoredSubjects(db:Connection,config:Config) {
  const receipts=await db.selectFrom('erasure_receipt').select('subject_digest').execute();
  if(!receipts.length)return [];
  const digests=new Set(receipts.map(r=>r.subject_digest.toString('hex')));
  const learners=await db.selectFrom('learner').select('id').execute();
  return learners.filter(l=>digests.has(hmac(config.key,'erasure:'+l.id).toString('hex'))).map(l=>l.id);
}
export async function queueRestoredErasures(tx:Tx,config:Config) {
  for(const id of (await restoredSubjects(tx,config)).sort())await deletion(tx,config,id,'SYSTEM','OTHER');
}
