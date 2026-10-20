import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {sql} from 'kysely';
import {connect} from '../src/db.js';
import {readConfig} from '../src/config.js';
import {buildApp} from '../src/app.js';
import {migrate} from '../src/migrate.js';
import {contract} from '../src/platform/contract.js';
import {createGoogleProvider,type GoogleProvider} from '../src/identity/google-provider.js';
import {cookieName,createSession} from '../src/identity/service.js';
import {hash,hmac,uuid} from '../src/platform/crypto.js';
import {consentedLearner} from './fixtures/learner.js';
const logStream=new Writable({write(_c,_e,next){next();}});

test('real OIDC library verifies signed tokens, nonce, issuer, audience, expiry, PKCE and test-account restriction without network',async t=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk={...publicKey.export({format:'jwk'}),kid:'fixture-key',use:'sig',alg:'RS256'};
 const {privateKey:badKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const config={origin:'http://localhost:5180',google:{clientId:'synthetic.apps.googleusercontent.com',clientSecret:'synthetic-secret',testEmail:'adult@example.invalid'}}as ReturnType<typeof readConfig>;
 let delta:Record<string,unknown>={},badSignature=false;
 const claims=()=>({iss:'https://accounts.google.com',aud:config.google!.clientId,sub:'synthetic-sub',email:'adult@example.invalid',email_verified:true,
  nonce:'expected-nonce',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,...delta});
 let tokenCalls=0;
 const http=(async(url,options)=>{
  const u=String(url);let body:unknown;
  if(u.includes('openid-configuration'))body={issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256']};
  else if(u==='https://www.googleapis.com/oauth2/v3/certs')body={keys:[jwk]};
  else if(u==='https://oauth2.googleapis.com/token'){
   tokenCalls++;const form=new URLSearchParams(String(options?.body));assert.equal(form.get('code_verifier'),'a'.repeat(43));
   assert.equal(form.get('redirect_uri'),config.origin+'/v1/auth/callback/google');
   const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture-key'})).toString('base64url'),p=Buffer.from(JSON.stringify(claims())).toString('base64url');
   body={access_token:'unused-fixture',token_type:'Bearer',expires_in:600,id_token:h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),badSignature?badKey:privateKey).toString('base64url')};
  }else throw Error('Unexpected external request');
  return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
 })as typeof fetch;
 const provider=createGoogleProvider(config,http);
 const url=new URL(config.origin+'/v1/auth/callback/google?code=synthetic&state=expected-state');
 const verify=()=>provider.verify(url,'expected-state','expected-nonce','a'.repeat(43));
 await t.test('authorization code with PKCE S256, state, nonce and minimal scopes',async()=>{
  const u=new URL(await provider.authorization('expected-state','expected-nonce','a'.repeat(43)));
  assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('scope'),'openid email');
  assert.equal(u.searchParams.get('state'),'expected-state');assert.equal(u.searchParams.get('nonce'),'expected-nonce');assert.equal(u.searchParams.get('code_challenge_method'),'S256');
  assert.ok(u.searchParams.get('code_challenge'));assert.ok(!u.href.includes('synthetic-secret'));
 });
 await t.test('valid signed ID token accepted',async()=>assert.equal((await verify()).sub,'synthetic-sub'));
 for(const [name,change]of Object.entries({nonce:{nonce:'wrong'},issuer:{iss:'https://attacker.invalid'},audience:{aud:'wrong'},expiry:{exp:1},unverified:{email_verified:false},otherAccount:{email:'other@example.invalid'}})){
  await t.test('reject '+name,async()=>{delta=change;await assert.rejects(verify());delta={};});
 }
 await t.test('reject forged signature',async()=>{badSignature=true;await assert.rejects(verify());badSignature=false;});
 await t.test('reject bad state before code exchange',async()=>{const before=tokenCalls;await assert.rejects(provider.verify(url,'wrong','expected-nonce','a'.repeat(43)));assert.equal(tokenCalls,before);});
});

test('Swagger and Google routes against PostgreSQL: fail closed, cookie binding, rotation, single use and consent pending',async t=>{
 const env=JSON.parse(readFileSync('.local/test-env.json','utf8')),config=readConfig(env);
 assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 let verifies=0,subject='fixture-'+randomUUID(),email='adult@example.invalid',rejectProvider=false;
 const provider:GoogleProvider={async authorization(state,nonce,verifier){assert.ok(nonce&&verifier);return 'https://accounts.google.com/o/oauth2/v2/auth?state='+state;},async verify(){verifies++;if(rejectProvider)throw Error('Synthetic provider unavailable');return{sub:subject,email,email_verified:true};}};
 const plain=await buildApp(config,{db,logStream});
 const {app}=await buildApp(config,{db,logStream,googleProvider:provider});
 const post=(payload:unknown)=>app.inject({method:'POST',url:'/v1/auth/start',headers:{origin:config.origin,'content-type':'application/json'},payload:JSON.stringify(payload)});
 const body={provider:'google',continuation:{targetPath:'/profile',step:0}};
 const start=async()=>{const r=await post(body);assert.equal(r.statusCode,200,r.body);return{state:new URL(r.json().redirectUrl).searchParams.get('state')!,cookie:String(r.headers['set-cookie']).split(';')[0]!};};
 const callback=(s:{state:string;cookie:string},extra='code=fixture')=>app.inject({url:'/v1/auth/callback/google?state='+s.state+'&'+extra,headers:{cookie:s.cookie}});
 try{
  await t.test('Swagger serves authoritative contract and local assets only',async()=>{
   const html=await app.inject('/docs');assert.equal(html.statusCode,200);assert.match(html.body,/swagger-ui/);assert.ok(!html.body.includes('cdn'));
   assert.equal((await app.inject('/docs/swagger-ui-bundle.js')).statusCode,200);
   const doc=(await app.inject('/docs/openapi.json')).json();assert.deepEqual(doc.paths,contract.paths);assert.equal(doc.servers[0].url,'/');
   const init=(await app.inject('/docs/init.js')).body;assert.match(init,/validatorUrl:null/);assert.match(init,/X-CSRF-Token/);
  });
  await t.test('Google unconfigured returns explicit blocker; origin and continuation remain guarded',async()=>{
   const r=await plain.app.inject({method:'POST',url:'/v1/auth/start',headers:{origin:config.origin,'content-type':'application/json'},payload:JSON.stringify(body)});
   assert.equal(r.statusCode,503);assert.ok(r.json().details.blockers.includes('GOOGLE_OIDC_NOT_CONFIGURED'));
   assert.equal((await post({...body,continuation:{targetPath:'https://attacker.invalid',step:0}})).statusCode,400);
   assert.equal((await app.inject({method:'POST',url:'/v1/auth/start',headers:{origin:'https://attacker.invalid','content-type':'application/json'},payload:JSON.stringify(body)})).statusCode,403);
  });
  await t.test('wrong cookie/state and expired transaction rejected before provider',async()=>{
   const s=await start();const wrong=await createSession(db,config,null);
   assert.equal((await callback({...s,cookie:cookieName+'='+wrong.raw})).statusCode,410);
   assert.equal((await callback({...s,state:'wrong'})).statusCode,410);
   await sql`update auth_transaction set expires_at=now()-interval '1 second' where state_hash=${hash(s.state)}`.execute(db);
   assert.equal((await callback(s)).statusCode,410);assert.equal(verifies,0);
  });
  let user:string;
  await t.test('register rotates session, stores no email/tokens, creates no consent',async()=>{
   const s=await start(),r=await callback(s,'code=fixture&scope=openid%20email&authuser=0&prompt=consent&hd=example.invalid');assert.equal(r.statusCode,302,r.body);assert.equal(r.headers.location,'/kenalan');
   const cookie=String(r.headers['set-cookie']).split(';')[0]!;assert.notEqual(cookie,s.cookie);
   const session=(await app.inject({url:'/v1/auth/session',headers:{cookie}})).json();assert.equal(session.authenticated,true);assert.equal(session.learner.status,'PENDING_CONSENT');assert.deepEqual(session.learner.missingPurposes,['LEARNING_DATA']);user=session.user.id;
   const i=await db.selectFrom('auth_identity').selectAll().where('provider','=','GOOGLE').where('subject','=',subject).executeTakeFirstOrThrow();assert.equal(i.email_ciphertext,null);assert.equal(i.email_verified,true);
   const old=await db.selectFrom('auth_session').select('revoked_at').where('token_hash','=',hash(s.cookie.split('=')[1]!)).executeTakeFirstOrThrow();assert.ok(old.revoked_at);
   assert.equal((await callback(s)).statusCode,410);
   const attempt=await app.inject({method:'POST',url:'/v1/learning-sessions',headers:{cookie,origin:config.origin,'content-type':'application/json','x-csrf-token':session.csrfToken,'idempotency-key':randomUUID()},payload:JSON.stringify({kind:'PRACTICE',origin:'COMBINED_SET',withLesson:false,spec:{setCode:'gabungan'}})});
   assert.equal(attempt.statusCode,403);assert.equal(attempt.json().code,'CONSENT_REQUIRED');
  });
  await t.test('repeat sign-in resolves same sub and returns existing continuation',async()=>{
   const r=await callback(await start());assert.equal(r.statusCode,302);assert.equal(r.headers.location,'/profile');
   const session=(await app.inject({url:'/v1/auth/session',headers:{cookie:String(r.headers['set-cookie']).split(';')[0]!}})).json();assert.equal(session.user.id,user!);
  });
  await t.test('cancellation consumes transaction without calling provider',async()=>{
   const before=verifies,s=await start(),r=await callback(s,'error=access_denied');assert.equal(r.statusCode,302);assert.equal(r.headers.location,'/profile?authCancelled=1');assert.equal(verifies,before);assert.equal((await callback(s)).statusCode,410);
  });
  await t.test('only verified email identities link; synthetic/unverified email never links',async()=>{
   for(const verified of [false,true]){
    subject='fixture-'+randomUUID();email=randomUUID()+'@example.invalid';
    const prior=await consentedLearner(db,config,{consent:false});
    await db.insertInto('auth_identity').values({id:uuid(),user_id:prior.userId,provider:'EMAIL',subject:hmac(config.key,'email:'+email).toString('hex'),email_verified:verified,email_ciphertext:null}).execute();
    const r=await callback(await start());assert.equal(r.statusCode,302,r.body);
    const current=(await app.inject({url:'/v1/auth/session',headers:{cookie:String(r.headers['set-cookie']).split(';')[0]!}})).json();
    if(verified)assert.equal(current.user.id,prior.userId);else assert.notEqual(current.user.id,prior.userId);
   }
  });
  await t.test('provider failure cannot create a user and consumes the callback attempt',async()=>{
   const s=await start();rejectProvider=true;
   const r=await callback(s);assert.equal(r.statusCode,503);rejectProvider=false;
   assert.equal((await callback(s)).statusCode,410);
  });
  await t.test('disabled accounts cannot sign in again',async()=>{
   await db.updateTable('app_user').set({status:'DISABLED'}).where('id','=',(await db.selectFrom('auth_identity').select('user_id').where('provider','=','GOOGLE').where('subject','=',subject).executeTakeFirstOrThrow()).user_id).execute();
   assert.equal((await callback(await start())).statusCode,403);
  });
  await t.test('Google environment defaults off and rejects incomplete/production settings',()=>{
   assert.equal(readConfig(env).google,undefined);
   assert.throws(()=>readConfig({...env,LOCAL_GOOGLE_OIDC:'true'}));
   assert.throws(()=>readConfig({...env,NODE_ENV:'production',LOCAL_GOOGLE_OIDC:'true'}));
  });
 }finally{await app.close();await plain.app.close();await db.destroy();}
});
