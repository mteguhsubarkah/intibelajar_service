import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {Writable} from 'node:stream';
import {sql} from 'kysely';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {buildApp} from '../src/app.js';
import {createSession,cookieName} from '../src/identity/service.js';
import {hash,hmac,uuid} from '../src/platform/crypto.js';
import {validateResponse} from '../src/platform/contract.js';
import {requireConsent,policyHash,policyVersion} from '../src/privacy/service.js';
import {workerTick,adoptErasure} from '../src/privacy/erasure.js';
import {leaseDeletion,recoverLeases} from '../src/platform/jobs.js';
import {command} from '../src/platform/idempotency.js';
import {InMemorySpanExporter,SimpleSpanProcessor} from '@opentelemetry/sdk-trace-base';

test('Slice 0 real PostgreSQL integration and security gates',async t=>{
  const env=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));
  const config=readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname,/_test$/,'Tests require a dedicated *_test database');
  const db=connect(config.databaseUrl);let logs='';
  const stream=new Writable({write(chunk,_encoding,done){logs+=chunk.toString();done();}});
  const exporter=new InMemorySpanExporter();
  const {app,mailbox}=await buildApp(config,{db,logStream:stream,spanProcessors:[new SimpleSpanProcessor(exporter)]});
  const inject=async(method:string,url:string,payload?:unknown,headers:Record<string,string>={})=>{
    const r=await app.inject({method:method as 'GET',url,...(payload===undefined?{}:{payload:JSON.stringify(payload)}),headers:{...(method==='GET'?{}:{origin:config.origin,'content-type':'application/json'}),...headers}});
    const path=url.split('?')[0]!.replace(/\/guardian-consents\/[^/]+/,'/guardian-consents/{token}').replace(/\/guardian\/learners\/[^/]+/,'/guardian/learners/{learnerId}')
      .replace(/\/consents\/[^/]+\/revocation/,'/consents/{purpose}/revocation').replace(/\/auth\/callback\/[^/]+/,'/auth/callback/{provider}');
    if(path.startsWith('/v1/')&&r.statusCode!==204)validateResponse(path,method,r.statusCode,r.json());
    return r;
  };
  const cookieOf=(r:{headers:Record<string,unknown>})=>String(r.headers['set-cookie']).split(';')[0]!;
  let counter=0;
  const signin=async(email:string)=>{
    const start=await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath:'/profile',step:10},questionText:'DO_NOT_PERSIST'});
    assert.equal(start.statusCode,200,start.body);const pre=cookieOf(start),transaction=new URL(start.json().redirectUrl).searchParams.get('transaction');
    const links=await inject('POST','/v1/auth/email/links',{email,transaction},{cookie:pre});assert.equal(links.statusCode,202,links.body);
    const link=mailbox.get(email)!.filter(m=>m.kind==='signin').at(-1)!.token;
    const verify=await inject('POST','/v1/auth/email/verify',{token:link},{cookie:pre});assert.equal(verify.statusCode,200,verify.body);
    const cookie=cookieOf(verify),session=await inject('GET','/v1/auth/session',undefined,{cookie});
    const s=session.json();return {cookie,csrf:s.csrfToken as string,id:s.learner.id as string,user:s.user.id as string,link,pre,session:s};
  };
  type Student=Awaited<ReturnType<typeof signin>>;
  const auth=(s:Student)=>({cookie:s.cookie,'x-csrf-token':s.csrf,'idempotency-key':'command_'+(++counter)});
  const onboard=async(s:Student)=>{const r=await inject('PATCH','/v1/me/profile',{grade:8,birthYear:2012},auth(s));assert.equal(r.statusCode,200,r.body);};
  const consent=async(s:Student,guardian='guardian@example.invalid',purposes=['LEARNING_DATA','AI_PROCESSING'])=>{
    await onboard(s);const headers=auth(s);
    const r=await inject('POST','/v1/me/consent-requests',{guardianEmail:guardian,purposes},headers);
    assert.equal(r.statusCode,201,r.body);
    return {token:mailbox.get(guardian)!.filter(m=>m.kind==='consent').at(-1)!.token,headers,r};
  };
  const decision=async(link:string,granted=true)=>{
    const view=await inject('GET','/v1/guardian-consents/'+link);assert.equal(view.statusCode,200,view.body);
    const v=view.json();const body={decisions:v.purposes.map((p:{purpose:string})=>({purpose:p.purpose,granted})),policyVersion:v.policyVersion,policyTextSha256:v.policyTextSha256,attestation:true};
    const headers={'idempotency-key':'decision_'+(++counter)};
    const r=await inject('POST',`/v1/guardian-consents/${link}/decision`,body,headers);
    assert.equal(r.statusCode,200,r.body);return {r,body,headers};
  };
  const guardianSession=async(id:string)=>{
    const user=uuid();await db.insertInto('app_user').values({id:user,role:'GUARDIAN',guardian_id:id,learner_id:null,status:'ACTIVE'}).execute();
    const s=await createSession(db,config,user);return {cookie:cookieName+'='+s.raw,'x-csrf-token':s.csrf};
  };
  try {
    await t.test('migration up, rollback, reapply, database version and atomic failure recovery',async()=>{
      assert.ok((await sql<{v:number}>`select current_setting('server_version_num')::int v`.execute(db)).rows[0]!.v>=160000);
      // Each 'down' reverts the latest migration only; roll back every applied migration (0002 catalog, then 0001).
      const downAll=async()=>{while(Number((await sql<{n:string}>`select count(*) n from schema_migration`.execute(db)).rows[0]!.n)>0)await migrate(db,'down');};
      await downAll();await migrate(db);await migrate(db);
      assert.equal((await db.selectFrom('learner').select('id').execute()).length,0);
      await downAll();
      assert.equal((await sql<{t:string|null}>`select to_regclass('learner')::text t`.execute(db)).rows[0]!.t,null);
      await migrate(db);
      writeFileSync('migrations/9999_failure.up.sql','create table rollback_canary(id int); select missing_column;');
      try {await assert.rejects(migrate(db));assert.equal((await sql<{t:string|null}>`select to_regclass('rollback_canary')::text t`.execute(db)).rows[0]!.t,null);}
      finally{unlinkSync('migrations/9999_failure.up.sql');}
      await migrate(db);assert.equal((await inject('GET','/health/ready')).statusCode,200);
    });
    await t.test('configuration fails closed for production, remote database and feature enables',()=>{
      for(const overrides of [{NODE_ENV:'production'},{DATABASE_URL:'postgresql://u:p@example.com/db'},{FEATURE_AI:'true'},{APP_KEY:'bad'},{APP_ORIGIN:'http://localhost:5173/path'}])
        assert.throws(()=>readConfig({...env,...overrides}));
    });
    let a:Student,b:Student;
    await t.test('identity sessions: hashes, cookie flags, rotation, reuse and continuation',async()=>{
      a=await signin('learner-a@example.invalid');b=await signin('learner-b@example.invalid');
      assert.equal(a.session.learner.status,'PENDING_CONSENT');
      assert.match(a.id,/^[\da-f-]{14}7/);
      assert.equal((await inject('POST','/v1/auth/email/verify',{token:a.link},{cookie:a.pre})).statusCode,410);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:a.pre})).json().authenticated,false);
      const stored=await db.selectFrom('auth_session').selectAll().where('token_hash','=',hash(a.cookie.split('=')[1]!)).executeTakeFirstOrThrow();
      assert.equal(stored.token_hash.length,32);assert.equal(stored.csrf_secret_hash.length,32);
      const start=await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath:'/core/perbandingan-trig',step:4}});
      assert.match(String(start.headers['set-cookie']),/Secure; SameSite=Lax/);assert.match(String(start.headers['set-cookie']),/HttpOnly/);
      for(const targetPath of ['https://evil.invalid','//evil.invalid','/core/good/../bad','/profile?next=evil','/core/test\n'])
        assert.equal((await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath,step:1}})).statusCode,400);
      assert.equal((await inject('POST','/v1/auth/start',{provider:'google',continuation:{targetPath:'/profile',step:1}})).statusCode,503);
      assert.equal((await inject('GET','/v1/auth/callback/google?state=abcdefghijklmnop')).statusCode,503);
    });
    await t.test('CSRF and Origin matrix on all authenticated Slice 0 mutations',async()=>{
      const cases:[string,string,unknown][]=[['PATCH','/v1/me/profile',{grade:8}],['POST','/v1/me/consent-requests',{guardianEmail:'g@e.invalid',purposes:['LEARNING_DATA']}],
        ['POST','/v1/me/consents/AI_PROCESSING/revocation',undefined],['DELETE','/v1/me',undefined],['POST','/v1/auth/logout',undefined]];
      for(const [method,url,payload]of cases){
        assert.equal((await inject(method,url,payload,{cookie:a.cookie})).statusCode,403,url);
        assert.equal((await inject(method,url,payload,{...auth(a),origin:'https://evil.invalid'})).statusCode,403,url);
        assert.equal((await inject(method,url,payload,{...auth(a),'sec-fetch-site':'cross-site'})).statusCode,403,url);
        assert.equal((await inject(method,url,payload)).statusCode,401,url);
      }
      assert.equal((await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath:'/profile',step:1}},{origin:''})).statusCode,403);
    });
    await t.test('pending onboarding minimization, strict fields, age derivation and consent guard',async()=>{
      assert.equal((await inject('PATCH','/v1/me/profile',{grade:8,learnerId:b.id},auth(a))).statusCode,400);
      assert.equal((await inject('PATCH','/v1/me/profile',{displayName:'canary-personal-data'},auth(a))).statusCode,403);
      await onboard(a);const p=(await inject('GET','/v1/me/profile',undefined,auth(a))).json();
      assert.equal(p.ageBand,'AGE_13_15');assert.ok(!('birthYear'in p));
      await assert.rejects(db.transaction().execute(tx=>requireConsent(tx,a.id,['LEARNING_DATA'])),{code:'CONSENT_REQUIRED'});
      assert.equal((await inject('POST','/v1/me/consent-requests',{guardianEmail:'real@example.com',purposes:['LEARNING_DATA']},auth(a))).statusCode,400);
      assert.equal((await inject('GET','/v1/guardian/learners',undefined,auth(a))).statusCode,403);
      const row=(await sql<{continuation:unknown}>`select continuation from auth_transaction order by created_at limit 1`.execute(db)).rows[0]!;
      assert.ok(!JSON.stringify(row).includes('DO_NOT_PERSIST'));
    });
    let guardianId:string;
    await t.test('multi-purpose consent, policy proof, idempotency replay and immediate session revocation',async()=>{
      const c=await consent(a);
      const replay=await inject('POST','/v1/me/consent-requests',{purposes:['LEARNING_DATA','AI_PROCESSING'],guardianEmail:'guardian@example.invalid'},c.headers);
      assert.equal(replay.statusCode,201);assert.equal(replay.headers['idempotency-replayed'],'true');assert.deepEqual(replay.json(),c.r.json());
      // 09 §1: a 201 names its resource, and a replay names the same one.
      assert.deepEqual([c.r.headers.location,replay.headers.location],['/v1/me/consents','/v1/me/consents']);
      const conflict=await inject('POST','/v1/me/consent-requests',{purposes:['LEARNING_DATA'],guardianEmail:'guardian@example.invalid'},c.headers);
      assert.equal(conflict.statusCode,409);
      const view=(await inject('GET','/v1/guardian-consents/'+c.token)).json();assert.match(view.policyText,/SIMULASI DEVELOPMENT/);assert.equal(view.purposes.length,2);
      const wrong=await inject('POST',`/v1/guardian-consents/${c.token}/decision`,{decisions:[{purpose:'LEARNING_DATA',granted:true}],policyVersion,policyTextSha256:'0'.repeat(64),attestation:true},{'idempotency-key':'wrong_policy'});
      assert.equal(wrong.statusCode,400);
      const d=await decision(c.token);assert.equal(d.r.json().learnerStatus,'ACTIVE');
      const dr=await inject('POST',`/v1/guardian-consents/${c.token}/decision`,d.body,d.headers);assert.equal(dr.headers['idempotency-replayed'],'true');assert.deepEqual(dr.json(),d.r.json());
      assert.equal((await inject('GET','/v1/guardian-consents/'+c.token)).statusCode,410);
      assert.equal((await inject('POST',`/v1/guardian-consents/${c.token}/decision`,d.body,{'idempotency-key':'new_decision'})).statusCode,410);
      const records=await db.selectFrom('consent_record').selectAll().where('learner_id','=',a.id).execute();
      assert.ok(records.every(r=>r.decided_by==='GUARDIAN'&&r.decided_at&&r.policy_text_sha256.equals(policyHash)));guardianId=records[0]!.guardian_id;
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:a.cookie})).json().authenticated,false);
      a=await signin('learner-a@example.invalid');await db.transaction().execute(tx=>requireConsent(tx,a.id,['LEARNING_DATA']));
      assert.equal((await inject('GET','/v1/me/profile',undefined,auth(a))).json().ageBandSource,'SELF_DECLARED');
    });
    await t.test('cross-user and guardian ownership, optional revocation and no learning capabilities',async()=>{
      const g=await guardianSession(guardianId);
      const list=await inject('GET','/v1/guardian/learners',undefined,g);assert.equal(list.statusCode,200);assert.equal(list.json().items.length,1);
      const row=await db.selectFrom('guardian').selectAll().where('id','=',guardianId).executeTakeFirstOrThrow();assert.equal(row.verified_at,null);assert.ok(!row.email_ciphertext.toString().includes('guardian@'));
      for(const id of [b.id,uuid()]){
        assert.equal((await inject('POST',`/v1/guardian/learners/${id}/consents/LEARNING_DATA/revocation`,undefined,{...g,'idempotency-key':'unauthorized'})).statusCode,404);
        assert.equal((await inject('POST',`/v1/guardian/learners/${id}/deletion-requests`,undefined,{...g,'idempotency-key':'unauthorized'})).statusCode,404);
      }
      const revoked=await inject('POST','/v1/me/consents/AI_PROCESSING/revocation',undefined,auth(a));assert.equal(revoked.statusCode,200);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:a.cookie})).json().authenticated,false);
      await assert.rejects(db.transaction().execute(tx=>requireConsent(tx,a.id,['AI_PROCESSING'])),{code:'CONSENT_REQUIRED'});
      a=await signin('learner-a@example.invalid');
      assert.equal((await inject('POST','/v1/me/consents/LEARNING_DATA/revocation',undefined,auth(a))).statusCode,403);
      // Learning sessions exist since Slice 1 M6 (consent gating: test/learning-sessions.test.ts); a malformed create is still refused.
      assert.equal((await inject('POST','/v1/learning-sessions',{} ,auth(a))).statusCode,400);
      assert.equal((await inject('POST','/v1/learning/intake/read',{imageDataUrl:'data:canary-personal-data'})).statusCode,403);
      const revokedLearning=await inject('POST',`/v1/guardian/learners/${a.id}/consents/LEARNING_DATA/revocation`,undefined,{...g,'idempotency-key':'revoke_learning'});
      assert.equal(revokedLearning.statusCode,200);assert.equal(revokedLearning.json().status,'DELETION_PENDING');
      await assert.rejects(db.transaction().execute(tx=>requireConsent(tx,a.id,['LEARNING_DATA'])),{code:'ACCOUNT_UNAVAILABLE'});
    });
    await t.test('leased deletion failure, fencing, recovery and complete Slice 0 erasure',async()=>{
      const lease=await leaseDeletion(db);assert.ok(lease);
      assert.equal(await db.transaction().execute(tx=>adoptErasure(tx,config,{...lease,lease_token:uuid()})),false);
      await sql`update job set lease_until=now()-interval '1 second' where id=${lease.id}`.execute(db);await recoverLeases(db);
      await sql`update job set available_at=now() where id=${lease.id}`.execute(db);
      const retry=await leaseDeletion(db);assert.ok(retry);assert.notEqual(retry.lease_token,lease.lease_token);
      await assert.rejects(db.transaction().execute(async tx=>{await adoptErasure(tx,config,retry);throw new Error('injected rollback');}));
      assert.ok(await db.selectFrom('learner').select('id').where('id','=',a.id).executeTakeFirst());
      assert.equal(await db.transaction().execute(tx=>adoptErasure(tx,config,retry)),true);
      assert.equal(await db.transaction().execute(tx=>adoptErasure(tx,config,retry)),false);
      const columns=(await sql<{table_name:string}>`select table_name from information_schema.columns where table_schema='public' and column_name='learner_id'`.execute(db)).rows;
      for(const {table_name}of columns){const count=await sql<{n:string}>`select count(*) n from ${sql.table(table_name)} where learner_id=${a.id}`.execute(db);assert.equal(count.rows[0]!.n,'0',table_name);}
      assert.equal((await sql<{n:string}>`select count(*) n from audit_event where subject_ref=${hmac(config.key,'subject:'+a.id)}`.execute(db)).rows[0]!.n,'0');
      assert.equal((await sql<{n:string}>`select count(*) n from erasure_receipt where subject_digest=${hmac(config.key,'erasure:'+a.id)}`.execute(db)).rows[0]!.n,'1');
      // Simulate reappearance of erased identity rows after a restore. The receipt ledger remains present.
      await sql`insert into learner(id,status,age_band,age_band_source,consent_deadline_at) values (${a.id},'PENDING_CONSENT','UNKNOWN','SELF_DECLARED',now()+interval '7 days')`.execute(db);
      await db.insertInto('student_profile').values({learner_id:a.id,display_name:null,grade:null}).execute();
      assert.equal((await inject('GET','/health/ready')).statusCode,503);
      await workerTick(db,config);
      assert.equal(await db.selectFrom('learner').select('id').where('id','=',a.id).executeTakeFirst(),undefined);
      assert.equal((await inject('GET','/health/ready')).statusCode,200);
    });
    await t.test('session idle and absolute expiry',async()=>{
      await sql`update auth_session set idle_expires_at=now()-interval '1 second' where token_hash=${hash(b.cookie.split('=')[1]!)}`.execute(db);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:b.cookie})).json().authenticated,false);
      b=await signin('learner-b@example.invalid');
      await sql`update auth_session set absolute_expires_at=now()-interval '1 second' where token_hash=${hash(b.cookie.split('=')[1]!)}`.execute(db);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:b.cookie})).json().authenticated,false);
    });
    await t.test('expired and declined consent: pending bootstrap erased, no relaxed eligibility',async()=>{
      const c=await signin('expired@example.invalid');const req=await consent(c,'expired-guardian@example.invalid');
      await sql`update consent_record set expires_at=now()-interval '1 second' where learner_id=${c.id}`.execute(db);
      assert.equal((await inject('GET','/v1/guardian-consents/'+req.token)).statusCode,410);
      await sql`update learner set consent_deadline_at=now()-interval '1 second' where id=${c.id}`.execute(db);
      await workerTick(db,config);assert.equal(await db.selectFrom('learner').select('id').where('id','=',c.id).executeTakeFirst(),undefined);
      const d=await signin('declined@example.invalid');const dc=await consent(d,'declined-guardian@example.invalid');await decision(dc.token,false);
      await workerTick(db,config);assert.equal(await db.selectFrom('learner').select('id').where('id','=',d.id).executeTakeFirst(),undefined);
    });
    await t.test('idempotency concurrency, crash rollback, replay and different payload',async()=>{
      const id=uuid(),op='test-command';let release!:()=>void;const gate=new Promise<void>(r=>release=r);let started!:()=>void;const start=new Promise<void>(r=>started=r);
      const first=db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'same_key',{},async()=>{started();await gate;return {status:200,body:{ok:true}};}));
      await start;
      await assert.rejects(db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'same_key',{},async()=>({status:200,body:{}}))),{code:'IDEMPOTENCY_IN_PROGRESS'});
      release();await first;
      const replay=await db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'same_key',{},async()=>{throw new Error('must not run');}));assert.equal(replay.replayed,true);
      await assert.rejects(db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'same_key',{x:1},async()=>({status:200,body:{}}))),{code:'IDEMPOTENCY_KEY_REUSED'});
      await assert.rejects(db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'crash_key',{},async()=>{throw new Error('injected crash');})));
      const recovered=await db.transaction().execute(tx=>command(tx,'LEARNER',id,op,'crash_key',{},async()=>({status:201,body:{ok:true}})));assert.equal(recovered.status,201);
    });
    await t.test('log canaries: URL tokens, emails, headers, malformed input and raw payloads absent',async()=>{
      await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath:'//canary-personal-data',step:1}},{authorization:'canary-personal-data','x-request-id':'canary-personal-data'});
      await inject('GET','/v1/guardian-consents/canary-personal-data');
      assert.ok(!logs.includes('canary-personal-data'));assert.ok(!logs.includes('example.invalid'));assert.ok(!logs.includes('DO_NOT_PERSIST'));
      const spans=exporter.getFinishedSpans();assert.ok(spans.length>20);
      assert.ok(!JSON.stringify(spans.map(s=>({name:s.name,attributes:s.attributes}))).includes('canary-personal-data'));
    });
    await t.test('logout current/all, deletion request, missing idempotency and adult consent defaults',async()=>{
      const s=await signin('logout@example.invalid');await onboard(s);
      assert.equal((await inject('POST','/v1/me/consent-requests',{guardianEmail:'logout-g@example.invalid',purposes:['LEARNING_DATA']},{cookie:s.cookie,'x-csrf-token':s.csrf})).statusCode,400);
      const patched=await inject('PATCH','/v1/me/profile',{birthYear:2000},auth(s));assert.equal(patched.statusCode,200);
      await assert.rejects(db.transaction().execute(tx=>requireConsent(tx,s.id,['LEARNING_DATA'])),{code:'CONSENT_REQUIRED'});
      const second=await signin('logout@example.invalid');
      const logout=await inject('POST','/v1/auth/logout?scope=current',undefined,auth(s));assert.equal(logout.statusCode,204);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:second.cookie})).json().authenticated,true);
      assert.equal((await inject('POST','/v1/auth/logout?scope=all',undefined,auth(second))).statusCode,204);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:second.cookie})).json().authenticated,false);
      const third=await signin('logout@example.invalid');const deleted=await inject('DELETE','/v1/me',undefined,auth(third));assert.equal(deleted.statusCode,202);
      assert.equal((await inject('GET','/v1/auth/session',undefined,{cookie:third.cookie})).json().authenticated,false);
      await workerTick(db,config);assert.equal(await db.selectFrom('learner').select('id').where('id','=',s.id).executeTakeFirst(),undefined);
    });
    await t.test('unconfigured integrations fail closed and auth rate limits remain enforced',async()=>{
      const disabled=await buildApp({...config,synthetic:false},{db,logStream:stream});
      try {
        const r=await disabled.app.inject({method:'POST',url:'/v1/auth/start',headers:{origin:config.origin,'content-type':'application/json'},payload:{provider:'email',continuation:{targetPath:'/profile',step:0}}});
        assert.equal(r.statusCode,503);assert.ok(r.json().details.blockers.includes('EMAIL_DELIVERY_NOT_CONFIGURED'));
      }finally{await disabled.app.close();}
      const limited=await buildApp(config,{db,logStream:stream});
      try {
        for(let i=0;i<21;i++) {
          const r=await limited.app.inject({method:'POST',url:'/v1/auth/start',headers:{origin:config.origin,'content-type':'application/json'},payload:{provider:'google',continuation:{targetPath:'/profile',step:0}}});
          assert.equal(r.statusCode,i<20?503:429);if(i===20)assert.equal(r.headers['retry-after'],'1');
        }
      }finally{await limited.app.close();}
    });
    await t.test('database unavailable produces failed readiness and can recover',async()=>{
      const badUrl=new URL(config.databaseUrl);badUrl.port='55431';const bad=connect(badUrl.href);const instance=await buildApp(config,{db:bad,logStream:stream});
      try {const r=await instance.app.inject('/health/ready');assert.equal(r.statusCode,503,r.body);assert.equal(r.json().code,'DEPENDENCY_UNAVAILABLE');}
      finally{await instance.app.close();await bad.destroy();}
      assert.equal((await inject('GET','/health/ready')).statusCode,200);
    });
  } finally {await app.close();await db.destroy();}
});
