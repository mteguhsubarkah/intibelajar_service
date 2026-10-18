import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import type { Config } from '../config.js';
import { token, hash, hmac, equal, uuid, encrypt, decrypt } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { createPendingLearner, checkSigninLearner } from '../privacy/service.js';

export interface Principal { sessionId: string; userId: string; role: string; learnerId: string | null; guardianId: string | null; csrf: string }
export const cookieName = '__Host-ib_session';
export const cookie = (value: string, age = 2592000) => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const csrfFor = (key: Buffer, raw: string) => hmac(key, 'csrf:' + raw).toString('base64url');
export async function createSession(tx: Connection, config: Config, userId: string | null) {
  const raw = token(), csrf = csrfFor(config.key, raw), id = uuid();
  await sql`insert into auth_session(id,token_hash,csrf_secret_hash,user_id,idle_expires_at,absolute_expires_at)
    values (${id},${hash(raw)},${hash(csrf)},${userId},now()+${config.idleSeconds}*interval '1 second',now()+${config.absoluteSeconds}*interval '1 second')`.execute(tx);
  return { raw, csrf, id };
}
export async function authenticate(db: Connection, config: Config, raw?: string): Promise<Principal | undefined> {
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return;
  const row = await db.selectFrom('auth_session as s').innerJoin('app_user as u','s.user_id','u.id')
    .select(['s.id as sessionId','u.id as userId','u.role','u.learner_id as learnerId','u.guardian_id as guardianId','s.csrf_secret_hash'])
    .where('s.token_hash','=',hash(raw)).where('s.revoked_at','is',null).where('s.idle_expires_at','>',sql<Date>`now()`)
    .where('s.absolute_expires_at','>',sql<Date>`now()`).where('u.status','=','ACTIVE').executeTakeFirst();
  if (!row) return;
  const csrf = csrfFor(config.key,raw);
  if (!equal(hash(csrf),row.csrf_secret_hash)) return;
  await sql`update auth_session set last_seen_at=now(),idle_expires_at=least(absolute_expires_at,now()+${config.idleSeconds}*interval '1 second') where id=${row.sessionId}`.execute(db);
  return { sessionId: row.sessionId, userId:row.userId, role:row.role, learnerId:row.learnerId, guardianId:row.guardianId, csrf };
}
export async function revokeLearner(tx: Connection, learnerId: string) {
  await sql`update auth_session set revoked_at=now() where user_id in (select id from app_user where learner_id=${learnerId}) and revoked_at is null`.execute(tx);
}
export async function logout(db:Connection,p:Principal,all:boolean) {
  await sql`update auth_session set revoked_at=now() where ${all?sql`user_id=${p.userId}`:sql`id=${p.sessionId}`}`.execute(db);
}
export async function assertCurrentSession(tx:Connection,p:Principal) {
  const active=await tx.selectFrom('auth_session').select('id').where('id','=',p.sessionId).where('user_id','=',p.userId)
    .where('revoked_at','is',null).where('idle_expires_at','>',sql<Date>`now()`).where('absolute_expires_at','>',sql<Date>`now()`).executeTakeFirst();
  if(!active)fail(401,'UNAUTHENTICATED');
}
export async function eraseLearnerIdentity(tx: Tx, learnerId: string) {
  await sql`delete from auth_transaction where session_id in (select s.id from auth_session s join app_user u on u.id=s.user_id where u.learner_id=${learnerId})`.execute(tx);
  await sql`delete from auth_session where user_id in (select id from app_user where learner_id=${learnerId})`.execute(tx);
  await sql`delete from auth_identity where user_id in (select id from app_user where learner_id=${learnerId})`.execute(tx);
  await tx.deleteFrom('app_user').where('learner_id','=',learnerId).execute();
}
export async function eraseGuardianIdentity(tx: Tx, guardianId: string) {
  await sql`delete from auth_transaction where session_id in (select s.id from auth_session s join app_user u on u.id=s.user_id where u.guardian_id=${guardianId})`.execute(tx);
  await sql`delete from auth_session where user_id in (select id from app_user where guardian_id=${guardianId})`.execute(tx);
  await sql`delete from auth_identity where user_id in (select id from app_user where guardian_id=${guardianId})`.execute(tx);
  await tx.deleteFrom('app_user').where('guardian_id','=',guardianId).execute();
}
export interface SyntheticMail { kind: 'signin' | 'consent'; token: string; transaction?: string }
// Test harness/local fixture transport only. No HTTP endpoint exposes this mailbox.
export type Mailbox = Map<string, SyntheticMail[]>;
export function deliver(mailbox: Mailbox, address: string, mail: SyntheticMail) {
  mailbox.set(address, [...(mailbox.get(address) ?? []),mail]);
}
export function requireSynthetic(config: Config) {
  if (!config.synthetic) fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:['EMAIL_DELIVERY_NOT_CONFIGURED','GUARDIAN_VERIFICATION_NOT_CONFIGURED']});
}
export function syntheticAddress(value: string) {
  const address = value.trim().toLowerCase();
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$/.test(address)) fail(400,'VALIDATION_FAILED');
  return address;
}
export async function startEmail(tx: Tx, config: Config, continuation: {route:string;step:number}) {
  requireSynthetic(config);
  const session = await createSession(tx,config,null), transaction=token();
  await sql`insert into auth_transaction(id,session_id,provider,state_hash,continuation,expires_at)
    values (${uuid()},${session.id},'EMAIL',${hash(transaction)},${JSON.stringify(continuation)}::jsonb,now()+interval '15 minutes')`.execute(tx);
  return {session, transaction};
}
export async function sendEmail(tx: Tx, config: Config, raw: string | undefined, transaction: string, email: string) {
  requireSynthetic(config); const address=syntheticAddress(email), link=token();
  const changed=await sql`update auth_transaction t set nonce_hash=${hash(link)},pkce_verifier_ciphertext=${encrypt(config.key,address)}
    from auth_session s where t.session_id=s.id and s.token_hash=${hash(raw ?? '')} and s.revoked_at is null
    and s.idle_expires_at>now() and s.absolute_expires_at>now() and t.state_hash=${hash(transaction)}
    and t.expires_at>now() and t.consumed_at is null and t.nonce_hash is null returning t.id`.execute(tx);
  return changed.rows.length ? {address,link} : undefined;
}
export async function consumeEmail(tx: Tx, config: Config, raw: string | undefined, link: string) {
  requireSynthetic(config);
  const result=await sql<{id:string;session_id:string;pkce_verifier_ciphertext:Buffer;continuation:{route:string;step?:number}}>`select t.* from auth_transaction t
    join auth_session s on s.id=t.session_id where t.nonce_hash=${hash(link)} and s.token_hash=${hash(raw ?? '')}
    and s.revoked_at is null and s.idle_expires_at>now() and s.absolute_expires_at>now()
    and t.expires_at>now() and t.consumed_at is null for update of t,s`.execute(tx);
  const t=result.rows[0]; if (!t) fail(410,'LINK_EXPIRED');
  const email=decrypt(config.key,t.pkce_verifier_ciphertext), subject=hmac(config.key,'email:'+email).toString('hex');
  await sql`select pg_advisory_xact_lock(hashtextextended(${subject},0))`.execute(tx);
  let identity=await tx.selectFrom('auth_identity').select('user_id').where('provider','=','EMAIL').where('subject','=',subject).executeTakeFirst();
  const fresh=!identity;
  if (!identity) {
    const learner=await createPendingLearner(tx), user=uuid();
    await tx.insertInto('app_user').values({id:user,role:'STUDENT',learner_id:learner,guardian_id:null,status:'ACTIVE'}).execute();
    // false: synthetic transport never establishes a production-verified email.
    await tx.insertInto('auth_identity').values({id:uuid(),user_id:user,provider:'EMAIL',subject,email_verified:false,email_ciphertext:encrypt(config.key,email),last_login_at:sql<Date>`now()`}).execute();
    identity={user_id:user};
  }
  const account=await tx.selectFrom('app_user').selectAll().where('id','=',identity.user_id).executeTakeFirstOrThrow();
  if (account.status!=='ACTIVE') fail(403,'ACCOUNT_UNAVAILABLE');
  if (account.learner_id) {
    await checkSigninLearner(tx,account.learner_id);
  }
  await sql`update auth_transaction set consumed_at=now() where id=${t.id}`.execute(tx);
  await sql`update auth_session set revoked_at=now() where id=${t.session_id}`.execute(tx);
  const session=await createSession(tx,config,account.id);
  return {session,continuation:fresh ? {route:'/kenalan'} : t.continuation};
}
