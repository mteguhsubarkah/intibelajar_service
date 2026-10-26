import {guideCore} from '../src/catalog/intake-interface.js';
import {legacyIntakeMap} from '../src/catalog/intake-map.js';
import {currentRelease} from '../src/catalog/interface.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {Writable} from 'node:stream';import {sql} from 'kysely';
import {readConfig} from '../src/config.js';import {connect} from '../src/db.js';import {migrate} from '../src/migrate.js';import {buildApp} from '../src/app.js';
import {publish} from '../src/catalog/publisher.js';import {reviewedFixture} from './fixtures/catalog.js';import {consentedLearner,client} from './fixtures/learner.js';
import {sealTrialProof,readTrialProof} from '../src/assessment/trial-proof.js';import {guideReply} from '../src/tutor/context-guide.js';
const key=Buffer.alloc(32,7);const input={owner:'browser',session:'trial',questionId:'soal-menara',revisionId:'revision',text:'20√3',hintUsed:false,solutionSeen:false};
test('trial proofs are browser-bound, expire and reject tampering',()=>{
 const token=sealTrialProof(key,input,1000)!;assert.equal(readTrialProof(key,token,'browser',1001).text,input.text);
 assert.throws(()=>readTrialProof(key,token,'another',1001));assert.throws(()=>readTrialProof(key,token.slice(0,-10)+'AAAAAAAAAA','browser',1001));assert.throws(()=>readTrialProof(key,token,'browser',7201001));
 assert.equal(sealTrialProof(key,{...input,solutionSeen:true}),undefined);
});
test('IntiGuide sends the current context and preserves provider failures',async()=>{
 const config={apiKey:'synthetic-key',model:'deepseek-flash'};
 const http=(async(url,options)=>{assert.equal(String(url),'https://api.deepseek.com/chat/completions');const body=JSON.parse(String(options?.body));assert.ok(body.messages[1].content.includes('soal tangga'));assert.ok(!JSON.stringify(body).includes('synthetic-key'));return Response.json({choices:[{message:{content:'Sisi mana yang diketahui?'}}]});}) as typeof fetch;
 assert.ok((await guideReply(null as any,config,{questionText:'soal tangga',messages:[{from:'me',text:'Mulai dari mana?'}]},http)).text.includes('Sisi'));
 await assert.rejects(guideReply(null as any,undefined,{questionText:'soal',messages:[{from:'me',text:'Halo'}]},http));
 await assert.rejects(guideReply(null as any,config,{questionText:'soal',messages:[{from:'me',text:'Halo'}]},async()=>new Response('',{status:503})));
});
test('claim real trial once and expose three evidenced cores in account progress',async()=>{
 const config=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8')));assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);const manifest=reviewedFixture();manifest.release.version=Number((await sql<{v:number}>`select coalesce(max(version),0)+1 as v from curriculum_release`.execute(db)).rows[0]!.v);await publish(db,manifest);
 const {app}=await buildApp(config,{db,logStream:new Writable({write(_a,_b,next){next();}})});
 try{
  const core=await guideCore(db,'tri-d');assert.ok(core?.title);
  for(const text of ['tentukan cos30','trigonometri sinus sudut 30 derajat','tangen 45°']){const mapped=await legacyIntakeMap(db,(await currentRelease(db))!,text);assert.equal(mapped.topicId,'trigonometri');assert.deepEqual(mapped.cores,['tri-f']);}
  const learner=await consentedLearner(db,config),another=await consentedLearner(db,config);const c=client(app,config,learner),other=client(app,config,another);
  const body={sessionId:'claim-integration',questionId:'soal-menara',topicId:'trigonometri',hintOpened:false,responseMode:null,rawText:'tan 30 = 20/x, x = 20√3'};
  const run=await app.inject({method:'POST',url:'/v1/trial/diagnosis',headers:{origin:config.origin,'content-type':'application/json'},payload:body});assert.equal(run.statusCode,200,run.body);
  const proof=run.json().claimToken;assert.equal(typeof proof,'string');const trialCookie=String(run.headers['set-cookie']).split(';')[0]!;
  const headers={cookie:learner.headers.cookie+'; '+trialCookie};
  const saved=await c('POST','/v1/trial/claim',{proof},headers);assert.equal(saved.status,200,JSON.stringify(saved.body));
  const repeated=await c('POST','/v1/trial/claim',{proof},headers);assert.equal(repeated.body.sessionId,saved.body.sessionId);
  const progress=await c('GET','/v1/me/progress');assert.equal(progress.status,200,JSON.stringify(progress.body));
  assert.deepEqual(progress.body.cores.filter((x:any)=>x.understandingDemonstrated).map((x:any)=>x.id).sort(),['tri-c','tri-d','tri-f']);
  const replay=await other('POST','/v1/trial/claim',{proof},{cookie:another.headers.cookie+'; '+trialCookie});assert.equal(replay.status,409);
  assert.equal((await c('POST','/v1/trial/claim',{proof})).status,400);
  assert.equal(Number((await sql<{n:string}>`select count(*) n from learning_session where learner_id=${learner.learnerId}`.execute(db)).rows[0]!.n),1);
 }finally{await app.close();await db.destroy();}
});
