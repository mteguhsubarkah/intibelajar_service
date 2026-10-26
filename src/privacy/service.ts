import { sql } from 'kysely';
export async function projectionLearners(db:import('../db.js').Connection){return(await sql<{id:string}>`select id from learner where status='ACTIVE' and exists(select 1 from consent_record c where c.learner_id=learner.id and c.purpose='LEARNING_DATA' and c.status='GRANTED' and c.expires_at>now() and c.policy_version=${policyVersion})`.execute(db)).rows.map(r=>r.id);}
import { now, type Connection, type Tx } from '../db.js';
import type { Config } from '../config.js';
import { encrypt, hash, hmac, token, uuid } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { revokeLearner, requireSynthetic, syntheticAddress, assertCurrentSession, type Principal } from '../identity/service.js';
import { enqueueDeletion } from '../platform/jobs.js';
export const purposes=['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD','PRODUCT_ANALYTICS'] as const;
export const policyVersion='synthetic-dev-v1';
export const policyText='SIMULASI DEVELOPMENT — hanya identitas dan data sintetis. Persetujuan ini bukan persetujuan produksi yang sah. Tidak ada panggilan AI, unggahan gambar, atau analitik eksternal. Guardian sintetis memilih setiap tujuan secara terpisah. Teks produksi menunggu persetujuan penasihat hukum.';
export const policyHash=hash(policyText);
export async function createPendingLearner(tx:Tx) {
  const id=uuid();
  await sql`insert into learner(id,status,age_band,age_band_source,consent_deadline_at) values (${id},'PENDING_CONSENT','UNKNOWN','SELF_DECLARED',now()+interval '7 days')`.execute(tx);
  await tx.insertInto('student_profile').values({learner_id:id,display_name:null,grade:null}).execute();return id;
}
export async function checkSigninLearner(tx:Tx,id:string) {await lockLearner(tx,id);}
export async function authorizeMutation<T>(tx:Tx,p:Principal,run:()=>Promise<T>) {
  // Lock the subject before re-checking session validity, also for account deletion.
  const learner=await tx.selectFrom('learner').select('id').where('id','=',p.learnerId!).forUpdate().executeTakeFirst();
  if(!learner)fail(404,'NOT_FOUND');await assertCurrentSession(tx,p);return run();
}
export async function lockLearner(tx: Tx, id: string, bootstrap=true) {
  const learner=await tx.selectFrom('learner').selectAll().where('id','=',id).forUpdate().executeTakeFirst();
  if (!learner) fail(404,'NOT_FOUND');
  if (['SUSPENDED','DELETION_PENDING'].includes(learner.status)) fail(403,'ACCOUNT_UNAVAILABLE');
  if (learner.status==='PENDING_CONSENT' && learner.consent_deadline_at! <= await now(tx)) fail(403,'ACCOUNT_UNAVAILABLE');
  if (!bootstrap) await requireConsent(tx,id,['LEARNING_DATA']);
  return learner;
}
/** The learner lock alone, whatever the status (04 §7 lock order for system writes); the status, or null when erased. */
export async function holdLearner(tx: Tx, id: string) {
  return (await tx.selectFrom('learner').select('status').where('id','=',id).forUpdate().executeTakeFirst())?.status ?? null;
}
export async function requireConsent(tx: Tx, id: string, required: string[]) {
  const learner=await tx.selectFrom('learner').selectAll().where('id','=',id).forUpdate().executeTakeFirst();
  if (!learner) fail(404,'NOT_FOUND');
  if (['SUSPENDED','DELETION_PENDING'].includes(learner.status)) fail(403,'ACCOUNT_UNAVAILABLE');
  const grants=await tx.selectFrom('consent_record').select('purpose').where('learner_id','=',id).where('status','=','GRANTED')
    .where('expires_at','>',sql<Date>`now()`).where('policy_version','=',policyVersion).execute();
  const missing=required.filter(p=>!grants.some(g=>g.purpose===p));
  if (learner.status!=='ACTIVE' || missing.length) fail(403,'CONSENT_REQUIRED',{missingPurposes:missing.length?missing:required});
}
/** Whether one purpose is granted now (06 §2.3 step 2: AI_PROCESSING decides whether a run may be queued). */
export async function hasConsent(db: Connection, id: string, purpose: typeof purposes[number]) {
  return Boolean(await db.selectFrom('consent_record').select('id').where('learner_id','=',id).where('purpose','=',purpose).where('status','=','GRANTED')
    .where('expires_at','>',sql<Date>`now()`).where('policy_version','=',policyVersion).executeTakeFirst());
}
export async function profile(db: Connection, id: string) {
  const row=await db.selectFrom('learner as l').innerJoin('student_profile as p','p.learner_id','l.id').selectAll()
    .where('l.id','=',id).executeTakeFirst();
  if (!row) fail(404,'NOT_FOUND');
  return {learnerId:id,status:row.status,ageBand:row.age_band,ageBandSource:row.age_band_source,timezone:row.timezone,
    preferredSubjectCodes:row.preferred_subject_codes,...(row.display_name?{displayName:row.display_name}:{}),
    ...(row.grade?{grade:row.grade}:{}),...(row.consent_deadline_at?{consentDeadlineAt:row.consent_deadline_at.toISOString()}: {})};
}
export interface ProfilePatch { displayName?:string; grade?:number; birthYear?:number; timezone?:string; preferredSubjectCodes?:string[] }
/** Izin yang diberikan siswa sendiri saat onboarding (SELF_ONBOARDING_CONSENT=true). Analitik produk tidak termasuk. */
export const selfPurposes=['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD'] as const;
/**
 * Onboarding mandiri: begitu username dan kelas terisi, siswa memberi izin sendiri (tanpa guardian)
 * dan akunnya langsung aktif. Data yang disimpan hanya email (dari login), username, dan kelas.
 */
async function selfActivate(tx:Tx,config:Config,id:string,time:Date) {
  await tx.updateTable('consent_record').set({status:'EXPIRED',updated_at:time}).where('learner_id','=',id)
    .where('purpose','in',[...selfPurposes]).where('status','=','PENDING').execute();
  const live=await tx.selectFrom('consent_record').select('purpose').where('learner_id','=',id).where('status','=','GRANTED')
    .where('expires_at','>',time).where('policy_version','=',policyVersion).execute();
  for(const purpose of selfPurposes){
    if(live.some(r=>r.purpose===purpose))continue;
    await tx.updateTable('consent_record').set({status:'EXPIRED',updated_at:time}).where('learner_id','=',id).where('purpose','=',purpose).where('status','=','GRANTED').execute();
    await tx.insertInto('consent_record').values({id:uuid(),learner_id:id,guardian_id:null,purpose,status:'GRANTED',method:'SELF_DECLARED',
      policy_version:policyVersion,policy_text_sha256:policyHash,request_token_hash:null,decided_by:'LEARNER',decided_at:time,revoked_at:null,
      expires_at:new Date(time.getTime()+365*86400000)}).execute();
  }
  await tx.updateTable('learner').set({status:'ACTIVE',consent_deadline_at:null,updated_at:time,version:sql<string>`version+1`}).where('id','=',id).execute();
  await audit(tx,config,id,'SELF_CONSENT_GRANTED','LEARNER');
}
export async function updateProfile(tx:Tx,id:string,input:ProfilePatch,config?:Config) {
  const learner=await lockLearner(tx,id);
  const selfConsent=!!config?.selfConsent;
  if(learner.status==='ACTIVE')await requireConsent(tx,id,['LEARNING_DATA']);
  if (!selfConsent && learner.status==='PENDING_CONSENT' && (input.displayName!==undefined || input.preferredSubjectCodes!==undefined))
    fail(403,'CONSENT_REQUIRED',{missingPurposes:['LEARNING_DATA']});
  const time=await now(tx);
  if (input.birthYear!==undefined) {
    const age=time.getUTCFullYear()-input.birthYear;
    if(age<0 || age>100) fail(400,'VALIDATION_FAILED');
    await tx.updateTable('learner').set({age_band:age<13?'UNDER_13':age<16?'AGE_13_15':age<18?'AGE_16_17':'ADULT',age_band_source:'SELF_DECLARED',updated_at:time,version:sql<string>`version+1`}).where('id','=',id).execute();
  }
  await tx.updateTable('student_profile').set({updated_at:time,
    ...(input.grade===undefined?{}:{grade:input.grade}),...(input.displayName===undefined?{}:{display_name:input.displayName}),
    ...(input.timezone===undefined?{}:{timezone:input.timezone}),...(input.preferredSubjectCodes===undefined?{}:{preferred_subject_codes:input.preferredSubjectCodes})})
    .where('learner_id','=',id).execute();
  if(selfConsent && learner.status==='PENDING_CONSENT'){
    const p=await tx.selectFrom('student_profile').select(['display_name','grade']).where('learner_id','=',id).executeTakeFirstOrThrow();
    if(p.display_name && p.grade) await selfActivate(tx,config!,id,time);
  }
  return profile(tx,id);
}
function item(row: {purpose:string;status:string;method:string;policy_version:string;requested_at:Date;decided_at:Date|null;expires_at:Date}) {
  return {purpose:row.purpose,status:row.status,method:row.method,policyVersion:row.policy_version,requestedAt:row.requested_at.toISOString(),
    ...(row.decided_at?{decidedAt:row.decided_at.toISOString()}:{}),expiresAt:row.expires_at.toISOString()};
}
export async function consents(db: Connection,id:string) {
  const rows=await db.selectFrom('consent_record').selectAll().where('learner_id','=',id).orderBy('created_at','desc').orderBy('id','desc').execute();
  const time=await now(db);
  return {items:purposes.map(p=>{
    const row=rows.find(r=>r.purpose===p);
    return row?item({...row,status:['GRANTED','PENDING'].includes(row.status)&&row.expires_at<=time?'EXPIRED':row.status}):{purpose:p,status:'NOT_REQUESTED'};
  })};
}
export async function audit(tx: Tx, config: Config, id: string, action: string, actor='SYSTEM', actorId=id) {
  await sql`insert into audit_event(id,actor_type,actor_ref,subject_ref,action) values (${uuid()},${actor},${hmac(config.key,'actor:'+actorId)},${hmac(config.key,'subject:'+id)},${action})`.execute(tx);
}
// System events with no data subject (e.g. CATALOG_PUBLISHED). detail must hold no personal data (≤ 2 KB CHECK).
export async function auditSystem(tx: Tx, action: string, detail: Record<string, string | number>) {
  await sql`insert into audit_event(id,actor_type,action,detail) values (${uuid()},'SYSTEM',${action},${JSON.stringify(detail)})`.execute(tx);
}
export async function requestConsent(tx: Tx,config:Config,id:string,email:string,requested:string[]) {
  requireSynthetic(config); const address=syntheticAddress(email);
  const learner=await lockLearner(tx,id), time=await now(tx);
  if(learner.age_band==='UNKNOWN') fail(400,'VALIDATION_FAILED',{fields:['birthYear']});
  await tx.updateTable('consent_record').set({status:'EXPIRED',updated_at:time}).where('learner_id','=',id)
    .where('status','in',['PENDING','GRANTED']).where('expires_at','<=',time).execute();
  const live=await tx.selectFrom('consent_record').select('purpose').where('learner_id','=',id).where('purpose','in',requested).where('status','in',['PENDING','GRANTED']).execute();
  if(live.length) fail(409,'INVALID_STATE_TRANSITION');
  const emailHash=hmac(config.key,'guardian:'+address);
  await sql`insert into guardian(id,email_hash,email_ciphertext) values (${uuid()},${emailHash},${encrypt(config.key,address)}) on conflict(email_hash) do nothing`.execute(tx);
  const guardian=await tx.selectFrom('guardian').select('id').where('email_hash','=',emailHash).executeTakeFirstOrThrow();
  const link=token();
  const deadline=new Date(Math.min(time.getTime()+7*86400000,learner.status==='PENDING_CONSENT'?learner.consent_deadline_at!.getTime():Infinity));
  for(const purpose of requested) await tx.insertInto('consent_record').values({id:uuid(),learner_id:id,guardian_id:guardian.id,purpose,status:'PENDING',method:'GUARDIAN_EMAIL',
    policy_version:policyVersion,policy_text_sha256:policyHash,request_token_hash:hash(link+':'+purpose),decided_by:null,decided_at:null,revoked_at:null,expires_at:deadline}).execute();
  await audit(tx,config,id,'SYNTHETIC_CONSENT_REQUESTED','LEARNER');
  const list=await consents(tx,id);
  return {address,link,body:{purposes:list.items.filter(i=>requested.includes(i.purpose)),linkExpiresAt:deadline.toISOString()}};
}
export async function tokenRecords(db: Connection,link:string) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(link)) fail(404,'NOT_FOUND');
  const rows=await db.selectFrom('consent_record').selectAll().where('request_token_hash','in',purposes.map(p=>hash(link+':'+p))).orderBy('purpose').execute();
  if(!rows.length) fail(404,'NOT_FOUND'); return rows;
}
export async function consentView(db: Connection,link:string) {
  const records=await tokenRecords(db,link),time=await now(db);
  if(records.some(r=>r.status!=='PENDING'||r.expires_at<=time)) fail(410,'LINK_EXPIRED');
  const p=await profile(db,records[0]!.learner_id);
  return {learner:{...('displayName'in p?{displayName:p.displayName}:{}),...('grade'in p?{grade:p.grade}:{})},
    purposes:records.map(r=>({purpose:r.purpose,title:r.purpose,description:'Simulasi saja; integrasi produksi dinonaktifkan.'})),
    policyVersion,policyText,policyTextSha256:policyHash.toString('hex'),expiresAt:records[0]!.expires_at.toISOString()};
}
export interface Decision {decisions:{purpose:string;granted:boolean}[];policyVersion:string;policyTextSha256:string;attestation:boolean}
export async function decide(tx:Tx,config:Config,link:string,input:Decision) {
  requireSynthetic(config); const initial=await tokenRecords(tx,link),id=initial[0]!.learner_id;
  await lockLearner(tx,id);
  const records=await tokenRecords(tx,link),time=await now(tx);
  if(records.some(r=>r.status!=='PENDING'||r.expires_at<=time)) fail(410,'LINK_EXPIRED');
  if(input.policyVersion!==policyVersion || input.policyTextSha256!==policyHash.toString('hex') || !input.attestation
    || new Set(input.decisions.map(d=>d.purpose)).size!==records.length || input.decisions.length!==records.length
    || records.some(r=>!input.decisions.some(d=>d.purpose===r.purpose))) fail(400,'VALIDATION_FAILED');
  for(const r of records) {
    const granted=input.decisions.find(d=>d.purpose===r.purpose)!.granted;
    // Seven-day request expiry is distinct from grant validity; dev grants last 30 days only.
    await tx.updateTable('consent_record').set({status:granted?'GRANTED':'DECLINED',decided_by:'GUARDIAN',decided_at:time,updated_at:time,
      expires_at:new Date(time.getTime()+30*86400000)}).where('id','=',r.id).execute();
    await audit(tx,config,id,granted?'SYNTHETIC_CONSENT_GRANTED':'SYNTHETIC_CONSENT_DECLINED','GUARDIAN',r.guardian_id??undefined);
  }
  const learning=input.decisions.find(d=>d.purpose==='LEARNING_DATA');
  if(learning?.granted) {
    // No age-verification claim: the decision schema contains no age attestation.
    await tx.updateTable('learner').set({status:'ACTIVE',consent_deadline_at:null,updated_at:time,version:sql<string>`version+1`}).where('id','=',id).execute();
    await revokeLearner(tx,id); // privilege change: sign in again to obtain a rotated session.
  } else if(learning) await deletion(tx,config,id,'GUARDIAN','CONSENT_DECLINED');
  const p=await profile(tx,id),list=await consents(tx,id);
  return {learnerStatus:p.status,decisions:list.items.filter(i=>input.decisions.some(d=>d.purpose===i.purpose))};
}
export async function linked(tx:Connection,guardianId:string,id:string) {
  const row=await tx.selectFrom('consent_record').select('id').where('guardian_id','=',guardianId).where('learner_id','=',id).executeTakeFirst();
  if(!row) fail(404,'NOT_FOUND');
}
export async function guardianLearner(db:Connection,id:string) {
  const p=await profile(db,id),c=await consents(db,id);
  return {learnerId:id,status:p.status,...('displayName'in p?{displayName:p.displayName}:{}),...('grade'in p?{grade:p.grade}:{}),consents:c.items};
}
export async function guardianLearners(db:Connection,guardian:string) {
  const rows=await db.selectFrom('consent_record').select('learner_id').distinct().where('guardian_id','=',guardian).execute();
  return {items:await Promise.all(rows.map(r=>guardianLearner(db,r.learner_id)))};
}
export async function revoke(tx:Tx,config:Config,id:string,purpose:string,guardian?:string) {
  if(!purposes.includes(purpose as typeof purposes[number])) fail(400,'VALIDATION_FAILED');
  if(!guardian && purpose==='LEARNING_DATA') fail(403,'FORBIDDEN');
  await lockLearner(tx,id);
  if(guardian) await linked(tx,guardian,id);
  let q=tx.updateTable('consent_record').set({status:'REVOKED',revoked_at:sql<Date>`now()`,updated_at:sql<Date>`now()`})
    .where('learner_id','=',id).where('purpose','=',purpose).where('status','in',['PENDING','GRANTED']);
  // A linked guardian cannot revoke a grant made by another guardian.
  if(guardian) q=q.where('guardian_id','=',guardian);
  await q.execute();
  await revokeLearner(tx,id);
  await audit(tx,config,id,'CONSENT_REVOKED',guardian?'GUARDIAN':'LEARNER',guardian??id);
  if(purpose==='LEARNING_DATA') await deletion(tx,config,id,'GUARDIAN','CONSENT_REVOKED');
  return guardian?guardianLearner(tx,id):consents(tx,id);
}
export async function deletion(tx:Tx,config:Config,id:string,by='LEARNER',reason='USER_REQUEST') {
  const learner=await tx.selectFrom('learner').selectAll().where('id','=',id).forUpdate().executeTakeFirst();
  if(!learner) fail(404,'NOT_FOUND');
  await sql`update learner set status='DELETION_PENDING',updated_at=now(),version=version+1 where id=${id} and status<>'DELETION_PENDING'`.execute(tx);
  await revokeLearner(tx,id);
  const result=await sql<{id:string;requested_at:Date}>`insert into deletion_request(id,learner_id,requested_by,reason,status)
    values (${uuid()},${id},${by},${reason},'QUEUED') on conflict(learner_id) where status in ('QUEUED','RUNNING') do update set learner_id=excluded.learner_id returning id,requested_at`.execute(tx);
  const request=result.rows[0]!;
  await enqueueDeletion(tx,request.id);
  await audit(tx,config,id,'DELETION_REQUESTED',by);
  return {status:'DELETION_PENDING',requestedAt:request.requested_at.toISOString(),completesBy:new Date(request.requested_at.getTime()+7*86400000).toISOString()};
}
