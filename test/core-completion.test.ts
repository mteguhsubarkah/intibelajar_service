import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Writable}from'node:stream';import{sql}from'kysely';
import{readConfig}from'../src/config.js';import{connect}from'../src/db.js';import{migrate}from'../src/migrate.js';import{buildApp}from'../src/app.js';
import{consentedLearner,client}from'./fixtures/learner.js';import{reviewedFixture}from'./fixtures/catalog.js';import{publish}from'../src/catalog/publisher.js';
test('core completion is stored once per core, counted on /v1/me/progress, and never XP or mastery-v1 evidence',async()=>{
 const config=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8')));assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 // The suite shares one database: publish the reviewed catalog only when no earlier test already did.
 if(!(await sql`select 1 from concept where legacy_map_id='tri-f'`.execute(db)).rows.length){const manifest=reviewedFixture();manifest.release.version=Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);await publish(db,manifest);}
 const{app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})});
 try{
  const a=await consentedLearner(db,config),b=await consentedLearner(db,config),pending=await consentedLearner(db,config,{consent:false}),as=client(app,config,a),bs=client(app,config,b);
  const before=(await as('GET','/v1/me/progress')).body;assert.equal(before.cores.find((c:any)=>c.id==='tri-f')?.coreCompleted,false);
  const done=await as('POST','/v1/me/core-completions',{coreId:'tri-f',score:3,total:3});assert.equal(done.status,200,JSON.stringify(done.body));
  assert.deepEqual(done.body,{coreId:'tri-f',masteredCoreIds:['tri-f']});
  const again=await as('POST','/v1/me/core-completions',{coreId:'tri-f',score:4,total:4});assert.deepEqual(again.body.masteredCoreIds,['tri-f'],'one record per core');
  assert.equal(Number((await sql<any>`select count(*) n from progress_event where learner_id=${a.learnerId} and type='CORE_COMPLETED'`.execute(db)).rows[0].n),1);
  assert.equal((await as('POST','/v1/me/core-completions',{coreId:'tri-f',score:2,total:3})).status,400);
  assert.equal((await as('POST','/v1/me/core-completions',{coreId:'tidak-ada',score:1,total:1})).status,404);
  assert.equal((await as('POST','/v1/me/core-completions',{coreId:'tri-f',score:0,total:0})).status,400);
  assert.equal((await client(app,config,pending)('POST','/v1/me/core-completions',{coreId:'tri-f',score:1,total:1})).status,403);
  const after=(await as('GET','/v1/me/progress')).body,core=after.cores.find((c:any)=>c.id==='tri-f');
  assert.equal(core.coreCompleted,true);assert.equal(core.mastery,before.cores.find((c:any)=>c.id==='tri-f').mastery,'not mastery-v1 evidence');
  assert.equal(after.xp,before.xp,'no XP');assert.ok(after.activities.some((e:any)=>e.title==='Inti dituntaskan'));
  assert.equal((await as('GET','/v1/me/mastery?limit=100')).status,200);
  assert.ok((await bs('GET','/v1/me/progress')).body.cores.every((c:any)=>c.coreCompleted===false),'another learner is unaffected');
 }finally{await app.close();await db.destroy();}
});
