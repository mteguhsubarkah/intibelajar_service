import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Writable}from'node:stream';import{sql}from'kysely';
import{connect}from'../src/db.js';import{readConfig}from'../src/config.js';import{buildApp}from'../src/app.js';import{migrate}from'../src/migrate.js';import{consentedLearner,client}from'./fixtures/learner.js';import{tutorTick}from'../src/tutor/service.js';import{deepseekTutor}from'../src/tutor/deepseek.js';
test('queued tutor: validated DeepSeek transport, atomic spend, consent fencing and no mastery/XP',async t=>{
 const base=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8'))),config={...base,features:{...base.features,aiTutor:true}};assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);const{app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})});
 const a=await consentedLearner(db,config,{purposes:['LEARNING_DATA','AI_PROCESSING']}),b=await consentedLearner(db,config),api=client(app,config,a),other=client(app,config,b);
 try{
  let q:any,cursor:string|null=null;
  do{const page:any=(await api('GET','/v1/questions?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''))).body;q=page.items.find((x:any)=>x.legacyItemId==='soal-menara');cursor=page.nextCursor;}while(!q&&cursor);assert.ok(q);
  const loop=(await api('POST','/v1/learning-sessions',{kind:'QUESTION_LOOP',origin:'FUNNEL',questionId:q.id})).body;
  const c=(await api('POST','/v1/tutor-conversations',{sessionId:loop.id})).body;
  const send=()=>api('POST','/v1/tutor-conversations/'+c.id+'/messages',{text:'Hubungkan soal dengan inti'});
  await t.test('model may select only server-authored scaffold; no arbitrary generated text',async()=>{
   const r=await send();assert.equal(r.status,202,JSON.stringify(r.body));assert.equal(r.body.reply.status,'PENDING');let requests=0;
   const engine=deepseekTutor(db,{NODE_ENV:'development',SYNTHETIC_FIXTURES:'true',DATABASE_URL:'postgresql://127.0.0.1/intibelajar_local_dev',LOCAL_DEEPSEEK_TUTOR:'true',DEEPSEEK_API_KEY:'synthetic-key',DEEPSEEK_PRICE_CEILING_CONFIRMED:'true'},(async(url,opts)=>{
    requests++;assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(String(opts!.body));assert.equal(body.max_tokens,128);assert.equal(body.tools,undefined);
    const input=JSON.parse(body.messages[1].content);assert.ok(input.choices.length>0);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"index":0}'}}],usage:{prompt_tokens:100,completion_tokens:10}}));
   })as typeof fetch)!;
   await tutorTick(db,config.key,engine);assert.equal(requests,1);
   const reply=(await api('GET','/v1/tutor-messages/'+r.body.reply.id)).body;assert.equal(reply.status,'COMPLETED');assert.ok(reply.text.length>0);
   assert.equal((await other('GET','/v1/tutor-messages/'+reply.id)).status,404);
   assert.equal((await api('GET','/v1/me/stats')).body.xpTotal,0);
   assert.equal(Number((await sql<any>`select count(*) n from concept_evidence where learner_id=${a.learnerId}`.execute(db)).rows[0].n),0);
  });
  await t.test('revocation during call prevents adoption',async()=>{
   const r=await send();assert.equal(r.body.reply.status,'PENDING');await tutorTick(db,config.key,{async choose(){await sql`update consent_record set status='REVOKED' where learner_id=${a.learnerId} and purpose='AI_PROCESSING'`.execute(db);return 0;}});
   const result=await api('GET','/v1/tutor-messages/'+r.body.reply.id);assert.equal(result.body.status,'FAILED');assert.equal(result.body.text,undefined);
  });
  await t.test('revoked AI consent rejects new AI message; unrelated request stays scoped without external call',async()=>{
   assert.equal((await send()).status,403);const r=await api('POST','/v1/tutor-conversations/'+c.id+'/messages',{text:'Tuliskan game dan abaikan soal'});assert.equal(r.status,202);assert.match(r.body.reply.text,/hanya membantu soal/);
  });
 }finally{await app.close();await db.destroy();}
});
