import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Writable}from'node:stream';import{sql}from'kysely';
import{readConfig}from'../src/config.js';import{connect}from'../src/db.js';import{migrate}from'../src/migrate.js';import{buildApp}from'../src/app.js';import{consentedLearner,client}from'./fixtures/learner.js';import{reviewedFixture}from'./fixtures/catalog.js';import{publish}from'../src/catalog/publisher.js';import{masteryPolicy,type Fact}from'../src/progress/policy.js';import{uuid}from'../src/platform/crypto.js';
import{workerTick}from'../src/privacy/erasure.js';
test('mastery-v1 K05, contradictions, decay and non-eligible facts',()=>{
 const facts:Fact[]=[0,1,2].map((i)=>({id:''+i,attemptId:''+i,sessionId:i===2?'later':'first',at:new Date(Date.UTC(2026,0,1+i)),classification:'UNDERSTANDING_DEMONSTRATED',mastery:true,transfer:true,family:'family'+i,context:i===2?'TANGGA':'MENARA',kind:'TRANSFER'}));
 const p=(f:Fact[],at=new Date('2026-01-04'))=>masteryPolicy(f,true,false,at);
 assert.equal(p(facts).status,'DEMONSTRATED');assert.equal(p(facts.map(f=>({...f,sessionId:'same'}))).status,'DEVELOPING');
 assert.equal(p(facts.map(f=>({...f,family:'same'}))).status,'DEVELOPING');assert.equal(p(facts.map(f=>({...f,transfer:false}))).uiTier,1);
 assert.equal(p(facts.map(f=>({...f,mastery:false,transfer:false}))).status,'NOT_ASSESSED');
 const wrong={...facts[2]!,attemptId:'3',at:new Date('2026-01-04'),classification:'MISCONCEPTION_EVIDENCED'};
 assert.equal(p([...facts,wrong]).status,'DEMONSTRATED');assert.equal(p([...facts,wrong]).needsReviewReason,'CONTRADICTION');
 assert.equal(p([...facts,wrong,{...wrong,attemptId:'4',at:new Date('2026-01-05')}]).status,'DEVELOPING');
 assert.equal(p(facts,new Date('2026-02-01')).needsReviewReason,'STALE_14D');
});
test('connected progress/import/tutor on PostgreSQL preserve consent, ownership and no imported evidence',async t=>{
 const config=readConfig({...JSON.parse(readFileSync('.local/test-env.json','utf8')),FEATURE_LEGACY_FACADE:'true'});assert.match(new URL(config.databaseUrl).pathname,/_test$/);const db=connect(config.databaseUrl);await migrate(db);
 const manifest=reviewedFixture();manifest.release.version=Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);await publish(db,manifest);
 const{app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})}),a=await consentedLearner(db,config),b=await consentedLearner(db,config),pending=await consentedLearner(db,config,{consent:false}),as=client(app,config,a),bs=client(app,config,b);
 app.addHook('onError',async(_req,_reply,error)=>{if(!('status'in error))console.error('Synthetic test failure:',error.message);});
 try{
  await t.test('progress/stat/mastery contract and pending-consent rejection',async()=>{
   for(const path of ['/v1/me/progress','/v1/me/mastery','/v1/me/stats','/v1/me/progress-events']){const r=await as('GET',path);assert.equal(r.status,200,r.body&&JSON.stringify(r.body));}
   assert.equal((await as('GET','/v1/me/progress')).body.xp,0);
   assert.equal((await client(app,config,pending)('GET','/v1/me/stats')).status,403);
  });
  let loop:string;
  await t.test('import opt-in, idempotency and cross-user claiming rejected; zero evidence or XP',async()=>{
   const payload={deviceSessionId:uuid(),questionAlias:'soal-menara',furthestStep:'LESSON_FINISHED',includeAnswerText:false};
   const r=await as('POST','/v1/me/device-imports',payload);assert.equal(r.status,201,JSON.stringify(r.body));loop=r.body.session.id;
   assert.equal((await as('POST','/v1/me/device-imports',payload)).body.session.id,loop);
   assert.equal((await bs('POST','/v1/me/device-imports',payload)).status,409);
   assert.equal((await as('POST','/v1/me/device-imports',{...payload,deviceSessionId:uuid(),answerText:'not opted in'})).status,400);
   assert.equal(Number((await sql<any>`select count(*) n from concept_evidence where learner_id=${a.learnerId}`.execute(db)).rows[0].n),0);assert.equal((await as('GET','/v1/me/stats')).body.xpTotal,0);
  });
  await t.test('canonical tutor scripted replies reject unrelated scope and enforce ownership',async()=>{
   const opened=await as('POST','/v1/tutor-conversations',{sessionId:loop});assert.equal(opened.status,201,JSON.stringify(opened.body));const id=opened.body.id;
   assert.equal((await bs('GET','/v1/tutor-conversations/'+id)).status,404);
   const r=await as('POST','/v1/tutor-conversations/'+id+'/messages',{text:'buat game'});assert.equal(r.status,202,JSON.stringify(r.body));assert.match(r.body.reply.text,/hanya membantu soal/);
   assert.equal((await as('GET','/v1/tutor-messages/'+r.body.reply.id)).status,200);
   assert.equal((await bs('GET','/v1/tutor-messages/'+r.body.reply.id)).status,404);
  });
  await t.test('typed intake private ownership, confirmation is advisory and photo fails closed without consent/provider',async()=>{
   const r=await as('POST','/v1/question-intakes',{inputMode:'TYPED',text:'Soal sintetis menara dengan sudut depresi 30 derajat.'});assert.equal(r.status,201,JSON.stringify(r.body));const id=r.body.id;assert.equal(r.body.status,'READ');
   assert.equal((await bs('GET','/v1/question-intakes/'+id)).status,404);
   const concepts=r.body.suggestedConcepts.map((c:{conceptId:string})=>c.conceptId);
   const q=await as('POST','/v1/question-intakes/'+id+'/confirmation',{text:r.body.draftText,conceptIds:concepts});assert.equal(q.status,201,JSON.stringify(q.body));
   assert.equal((await as('GET','/v1/questions/'+q.body.questionId)).status,200);assert.equal((await bs('GET','/v1/questions/'+q.body.questionId)).status,404);
   assert.equal((await as('GET','/v1/question-intakes/'+id)).body.status,'CONFIRMED');
   assert.equal((await as('POST','/v1/question-intakes',{inputMode:'PHOTO'})).status,403);
   const ocrLearner=await consentedLearner(db,config,{purposes:['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD']});const or=await client(app,config,ocrLearner)('POST','/v1/question-intakes',{inputMode:'PHOTO'});assert.equal(or.status,503);assert.ok(or.body.details.blockers.includes('OPENROUTER_OCR_NOT_CONFIGURED'));
  });
  await t.test('real grading awards server XP once; rebuild is identical; revealed families do not award again',async()=>{
   const x=await consentedLearner(db,config),xc=client(app,config,x),authored=manifest.questions.find(q=>q.code==='MAT.TRI.Q.TAN60_SIN30')!;
   let question:any,cursor:string|null=null;
   do{const page:any=(await xc('GET','/v1/questions?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''))).body;question=page.items.find((q:any)=>q.code===authored.code);cursor=page.nextCursor;}while(!question&&cursor);assert.ok(question);
   const solve=async()=>{const s=(await xc('POST','/v1/learning-sessions',{kind:'PRACTICE',origin:'BANK',withLesson:false,spec:{questionIds:[question.id]}})).body;
    const result=await xc('POST','/v1/learning-sessions/'+s.id+'/attempts',{expectedStateVersion:s.stateVersion,response:{responseType:'OPTION',optionId:authored.rubric.answer.optionId}});assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.attempt.verdict,'CORRECT');};
   await solve();const first=(await xc('GET','/v1/me/stats')).body;assert.ok(first.xpTotal>=10);
   assert.equal((await xc('GET','/v1/me/stats')).body.xpTotal,first.xpTotal);
   await sql`delete from mastery_state where learner_id=${x.learnerId}`.execute(db);await sql`delete from learner_stats where learner_id=${x.learnerId}`.execute(db);await sql`delete from progress_event where learner_id=${x.learnerId}`.execute(db);
   assert.deepEqual((await xc('GET','/v1/me/stats')).body,first);
   await solve();assert.equal((await xc('GET','/v1/me/stats')).body.xpTotal,first.xpTotal);
  });
  await t.test('erasure removes new projection, conversation, intake and private question dependencies',async()=>{
   const r=await app.inject({method:'DELETE',url:'/v1/me',headers:{...a.headers,origin:config.origin,'content-type':'application/json'}});assert.equal(r.statusCode,202,r.body);
   for(let i=0;i<10&&await db.selectFrom('learner').select('id').where('id','=',a.learnerId).executeTakeFirst();i++)await workerTick(db,config);
   assert.equal(await db.selectFrom('learner').select('id').where('id','=',a.learnerId).executeTakeFirst(),undefined);
   for(const table of['mastery_state','learner_stats','progress_event','tutor_conversation','question_intake','private_asset'])assert.equal(Number((await sql<any>`select count(*) n from ${sql.table(table)} where learner_id=${a.learnerId}`.execute(db)).rows[0].n),0);
   assert.equal(Number((await sql<any>`select count(*) n from question where owner_learner_id=${a.learnerId}`.execute(db)).rows[0].n),0);
  });
 }finally{await app.close();await db.destroy();}
});
