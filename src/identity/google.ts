import {sql} from 'kysely';
import type {DB,Tx} from '../db.js';
import type {Config} from '../config.js';
import {token,hash,hmac,encrypt,decrypt,uuid,equal} from '../platform/crypto.js';
import {fail,ApiError} from '../platform/errors.js';
import {createPendingLearner,checkSigninLearner} from '../privacy/service.js';
import {createSession} from './service.js';
import type {GoogleProvider} from './google-provider.js';

export async function startGoogle(db:DB,config:Config,provider:GoogleProvider,continuation:{route:string;step:number}){
 const state=token(),nonce=token(),verifier=token();
 // Provider discovery may fail: do it before creating an anonymous session.
 const redirectUrl=await provider.authorization(state,nonce,verifier);
 const session=await db.transaction().execute(async tx=>{
  const s=await createSession(tx,config,null);
  await sql`insert into auth_transaction(id,session_id,provider,state_hash,nonce_hash,pkce_verifier_ciphertext,continuation,expires_at)
   values(${uuid()},${s.id},'GOOGLE',${hash(state)},${hash(nonce)},${encrypt(config.key,JSON.stringify({nonce,verifier}))},${JSON.stringify(continuation)}::jsonb,now()+interval '10 minutes')`.execute(tx);
  return s;
 });
 return{session,redirectUrl};
}

/** Claim once, bound to the pre-auth cookie; no DB transaction is held across external HTTP. */
export async function finishGoogle(db:DB,config:Config,provider:GoogleProvider,raw:string|undefined,query:{state:string;code?:string;error?:string;iss?:string}){
 if(!raw||!/^[A-Za-z0-9_-]{43}$/.test(raw))fail(410,'LINK_EXPIRED');
 const t=await db.transaction().execute(async tx=>{
  const row=(await sql<{id:string;session_id:string;nonce_hash:Buffer;pkce_verifier_ciphertext:Buffer;continuation:{route:string;step:number}}>`select t.* from auth_transaction t
   join auth_session s on s.id=t.session_id where t.provider='GOOGLE' and t.state_hash=${hash(query.state)} and s.token_hash=${hash(raw)}
   and s.user_id is null and s.revoked_at is null and s.idle_expires_at>now() and s.absolute_expires_at>now()
   and t.consumed_at is null and t.expires_at>now() for update of t,s`.execute(tx)).rows[0];
  if(!row)fail(410,'LINK_EXPIRED');
  await sql`update auth_transaction set consumed_at=now() where id=${row.id}`.execute(tx);
  return row;
 });
 if(query.error){
  await sql`update auth_session set revoked_at=now() where id=${t.session_id}`.execute(db);
  return{cancelled:true as const,continuation:{route:t.continuation.route+'?authCancelled=1'}};
 }
 if(!query.code)fail(400,'VALIDATION_FAILED');
 const secret=JSON.parse(decrypt(config.key,t.pkce_verifier_ciphertext))as{nonce:string;verifier:string};
 if(!equal(hash(secret.nonce),t.nonce_hash))fail(400,'VALIDATION_FAILED');
 const url=new URL(config.origin+'/v1/auth/callback/google');url.searchParams.set('state',query.state);url.searchParams.set('code',query.code);
 if(query.iss)url.searchParams.set('iss',query.iss);
 let claims:Awaited<ReturnType<GoogleProvider['verify']>>;
 try{claims=await provider.verify(url,query.state,secret.nonce,secret.verifier);}
 catch(error){if(error instanceof ApiError)throw error;fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:['GOOGLE_OIDC_UNAVAILABLE']});}
 return db.transaction().execute(async tx=>{
  const valid=await tx.selectFrom('auth_session').select('id').where('id','=',t.session_id).where('revoked_at','is',null)
   .where('idle_expires_at','>',sql<Date>`now()`).where('absolute_expires_at','>',sql<Date>`now()`).forUpdate().executeTakeFirst();
  if(!valid)fail(410,'LINK_EXPIRED');
  const {userId,fresh}=await googleAccount(tx,config,claims);
  await sql`update auth_session set revoked_at=now() where id=${t.session_id}`.execute(tx);
  return{cancelled:false as const,session:await createSession(tx,config,userId),continuation:fresh?{route:'/kenalan'}:t.continuation};
 });
}

async function googleAccount(tx:Tx,config:Config,claims:{sub:string;email:string;email_verified:true}){
 // Stable verified Google sub is the identity, never a client-supplied email or display name.
 const emailSubject=hmac(config.key,'email:'+claims.email).toString('hex');
 await sql`select pg_advisory_xact_lock(hashtextextended(${emailSubject},0))`.execute(tx);
 await sql`select pg_advisory_xact_lock(hashtextextended(${'google:'+claims.sub},0))`.execute(tx);
 let found=await tx.selectFrom('auth_identity').select('user_id').where('provider','=','GOOGLE').where('subject','=',claims.sub).executeTakeFirst();
 let fresh=false;
 if(!found){
  // Only a previously VERIFIED email identity may link. Synthetic email transport sets false.
  const verified=await tx.selectFrom('auth_identity').select('user_id').where('provider','=','EMAIL').where('subject','=',emailSubject).where('email_verified','=',true).executeTakeFirst();
  let user=verified?.user_id;
  if(!user){user=uuid();const learner=await createPendingLearner(tx);fresh=true;
   await tx.insertInto('app_user').values({id:user,role:'STUDENT',learner_id:learner,guardian_id:null,status:'ACTIVE'}).execute();}
  await tx.insertInto('auth_identity').values({id:uuid(),user_id:user,provider:'GOOGLE',subject:claims.sub,email_verified:true,email_ciphertext:null,last_login_at:sql<Date>`now()`}).execute();
  found={user_id:user};
 }
 const account=await tx.selectFrom('app_user').selectAll().where('id','=',found.user_id).executeTakeFirstOrThrow();
 if(account.status!=='ACTIVE')fail(403,'ACCOUNT_UNAVAILABLE');
 if(account.learner_id)await checkSigninLearner(tx,account.learner_id);
 await tx.updateTable('auth_identity').set({last_login_at:sql<Date>`now()`}).where('provider','=','GOOGLE').where('subject','=',claims.sub).execute();
 return{userId:account.id,fresh};
}
