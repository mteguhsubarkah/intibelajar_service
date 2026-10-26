import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {sql} from 'kysely';
import {connect} from '../src/db.js';
import {readConfig} from '../src/config.js';
import {buildApp} from '../src/app.js';
import {migrate} from '../src/migrate.js';
import {publish} from '../src/catalog/publisher.js';
import {reviewedFixture} from './fixtures/catalog.js';
import {consentedLearner,client} from './fixtures/learner.js';
import {projectionLearners} from '../src/privacy/service.js';

test('session authentication is independent from learning consent; policy, expiry and revocation stay enforced',async t=>{
 const config=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8')));
 assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 const manifest=reviewedFixture();manifest.release.version=Number((await sql<{v:number}>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0]!.v);await publish(db,manifest);
 const {app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})});
 try{
  await t.test('anonymous has no session and progress rejects authentication',async()=>{
   assert.deepEqual((await app.inject('/v1/auth/session')).json(),{authenticated:false});
   assert.equal((await app.inject('/v1/me/progress')).statusCode,401);
  });
  await t.test('new pending learner stays signed in while progress requires consent',async()=>{
   const c=client(app,config,await consentedLearner(db,config,{consent:false}));
   const s=await c('GET','/v1/auth/session');assert.equal(s.status,200);assert.equal(s.body.authenticated,true);assert.deepEqual(s.body.learner.missingPurposes,['LEARNING_DATA']);
   const p=await c('GET','/v1/me/progress');assert.equal(p.status,403);assert.equal(p.body.code,'CONSENT_REQUIRED');
   assert.equal((await c('GET','/v1/auth/session')).body.authenticated,true);
  });
  for(const kind of ['valid','expired','old-policy','revoked'] as const)await t.test(kind+' grant is reflected consistently in session and progress',async()=>{
   const learner=await consentedLearner(db,config),c=client(app,config,learner);
   if(kind==='expired')await sql`update consent_record set expires_at=now()-interval '1 second' where learner_id=${learner.learnerId}`.execute(db);
   if(kind==='old-policy')await sql`update consent_record set policy_version='old-fixture-policy' where learner_id=${learner.learnerId}`.execute(db);
   if(kind==='revoked')await sql`update consent_record set status='REVOKED' where learner_id=${learner.learnerId}`.execute(db);
   const s=await c('GET','/v1/auth/session');assert.equal(s.status,200);assert.equal(s.body.authenticated,true);assert.equal(s.body.user.id,learner.userId);
   assert.deepEqual(s.body.learner.missingPurposes,kind==='valid'?[]:['LEARNING_DATA']);
   const p=await c('GET','/v1/me/progress');assert.equal(p.status,kind==='valid'?200:403,JSON.stringify(p.body));
   assert.equal((await projectionLearners(db)).includes(learner.learnerId),kind==='valid');
  });
 }finally{await app.close();await db.destroy();}
});
