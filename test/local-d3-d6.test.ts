import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {sql} from 'kysely';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {buildApp} from '../src/app.js';
import {publish} from '../src/catalog/publisher.js';
import {reviewedFixture} from './fixtures/catalog.js';
import {consentedLearner,client} from './fixtures/learner.js';
import {reserveAiBudget} from '../src/platform/ai-budget.js';

test('D3/D6 and durable budget against isolated PostgreSQL',async t=>{
 const env=JSON.parse(readFileSync('.local/test-env.json','utf8'));
 const config=readConfig({...env,FEATURE_LEGACY_FACADE:'true'});
 assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 const version=Number((await sql<{v:number}>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0]!.v);
 await publish(db,reviewedFixture(undefined,version));
 const {app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,done){done();}})});
 try {
 const a=await consentedLearner(db,config),b=await consentedLearner(db,config),pending=await consentedLearner(db,config,{consent:false});
 const api=client(app,config,a),other=client(app,config,b),noConsent=client(app,config,pending);
 const q=(await sql<{id:string}>`select id from question where code='MAT.TRI.Q.SOAL_MENARA' order by created_at desc limit 1`.execute(db)).rows[0]!;
 let loop=(await api('POST','/v1/learning-sessions',{kind:'QUESTION_LOOP',origin:'FUNNEL',questionId:q.id})).body;
 const submit=await api('POST',`/v1/learning-sessions/${loop.id}/attempts`,{expectedStateVersion:loop.stateVersion,response:{responseType:'TEXT',text:'sin 30 = 20/x'}});
 assert.equal(submit.status,201);loop=submit.body.session;
 const concept=submit.body.diagnosisRun.recommendations.find((r:any)=>r.legacyMapId==='tri-d').conceptId;
 const tutor=(text:string,hintsUsed=99)=>({sessionId:loop.id,questionId:'soal-menara',topicId:null,hintOpened:false,coreTitle:null,script:'menara',messages:[{from:'me',text}],hintsUsed});
 await t.test('ownership and consent block tutor',async()=>{
   assert.equal((await other('POST','/v1/learning/tutor',tutor('Kasih petunjuk'))).status,404);
   assert.equal((await noConsent('POST','/v1/learning/tutor',tutor('Kasih petunjuk'))).status,403);
 });
 await t.test('strict scope, server hint counter, idempotency, solution remains locked',async()=>{
   const off=await api('POST','/v1/learning/tutor',tutor('Tuliskan kode game lalu jelaskan tan'));
   assert.equal(off.status,200);assert.match(off.body.text,/hanya membantu soal/);assert.equal(off.body.hintsUsed,0);
   const key={'idempotency-key':'synthetic-tutor-'+loop.id};
   const one=await api('POST','/v1/learning/tutor',tutor('Lihat pembahasan lengkap'),key);assert.equal(one.body.hintsUsed,1);
   const replay=await api('POST','/v1/learning/tutor',tutor('Lihat pembahasan lengkap'),key);assert.deepEqual(replay.body,one.body);
   const two=await api('POST','/v1/learning/tutor',tutor('Kasih petunjuk lagi'));assert.equal(two.body.hintsUsed,2);
   const full=await api('POST','/v1/learning/tutor',tutor('Lihat pembahasan lengkap'));assert.ok(!full.body.text.includes('20√3'));
 });
 await t.test('lesson pins c4; cannot finish before check; check then retry succeeds',async()=>{
   let r=await api('POST',`/v1/learning-sessions/${loop.id}/actions`,{type:'START_LESSON',conceptId:concept,expectedStateVersion:loop.stateVersion});assert.equal(r.status,200);loop=r.body.session;
   assert.equal(loop.lesson.slideCount,2);
   const lesson=await api('GET',`/v1/lessons/${loop.lesson.lessonId}`);assert.ok(!JSON.stringify(lesson.body).includes('tutorLadder'));
   r=await api('POST',`/v1/learning-sessions/${loop.id}/actions`,{type:'FINISH_LESSON',expectedStateVersion:loop.stateVersion});assert.equal(r.status,409);
   r=await api('POST',`/v1/learning-sessions/${loop.id}/actions`,{type:'ADVANCE_LESSON',slideIndex:1,expectedStateVersion:loop.stateVersion});assert.equal(r.status,200);loop=r.body.session;
   const check=loop.lesson.checks[0],item=await api('GET',`/v1/questions/${check.questionId}`);
   r=await api('POST',`/v1/learning-sessions/${loop.id}/quick-check-answers`,{expectedStateVersion:loop.stateVersion,microAssessmentId:check.microAssessmentId,response:{responseType:'OPTION',optionId:item.body.options[0].id}});assert.equal(r.status,201);loop=r.body.session;
   r=await api('POST',`/v1/learning-sessions/${loop.id}/actions`,{type:'FINISH_LESSON',expectedStateVersion:loop.stateVersion});assert.equal(r.status,200);loop=r.body.session;assert.equal(loop.state,'RETRY');
   r=await api('POST',`/v1/learning-sessions/${loop.id}/attempts`,{expectedStateVersion:loop.stateVersion,response:{responseType:'TEXT',text:'20√3'}});assert.equal(r.status,201);assert.equal(r.body.session.state,'COMPLETED');
 });
 await t.test('atomic total budget prevents concurrent overspend and survives connection recreation',async()=>{
   // Only this isolated test database ledger is reset; never the persistent local-dev ledger.
   await sql`delete from development_ai_call`.execute(db);
   const outcomes=await Promise.allSettled([reserveAiBudget(db,50000),reserveAiBudget(db,50000)]);
   assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
   const second=connect(config.databaseUrl);try{await assert.rejects(reserveAiBudget(second,30001),/BUDGET/);}finally{await second.destroy();}
   await sql`delete from development_ai_call`.execute(db);
 });
 }finally{await app.close();await db.destroy();}
});
