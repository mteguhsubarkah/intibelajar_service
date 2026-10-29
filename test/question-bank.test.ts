import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Writable}from'node:stream';import{sql}from'kysely';
import{readConfig}from'../src/config.js';import{connect}from'../src/db.js';import{migrate}from'../src/migrate.js';import{buildApp}from'../src/app.js';
import{reviewedFixture}from'./fixtures/catalog.js';import{publish}from'../src/catalog/publisher.js';
test('question bank filters by subject and phase, and similar questions share cores',async()=>{
 const config=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8')));assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 // The suite shares one database: publish the reviewed catalog only when no earlier test already did.
 if(!(await sql`select 1 from concept where legacy_map_id='tri-f'`.execute(db)).rows.length){const m=reviewedFixture();m.release.version=Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);await publish(db,m);}
 const{app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})});
 const get=async(url:string)=>{const r=await app.inject({method:'GET',url});return{status:r.statusCode,body:JSON.parse(r.body)};};
 try{
  const all=await get('/v1/questions?limit=100');assert.equal(all.status,200);assert.ok(all.body.items.length>0);
  const mat=await get('/v1/questions?limit=100&subjectCode=MAT&phase=E');assert.equal(mat.status,200);assert.equal(mat.body.items.length,all.body.items.length,'the fixture is all Matematika fase E');
  assert.equal((await get('/v1/questions?limit=100&subjectCode=FIS')).body.items.length,0);
  assert.equal((await get('/v1/questions?limit=100&phase=F')).body.items.length,0);
  assert.equal((await get('/v1/questions?phase=Z')).status,400);
  const concepts=(await get('/v1/concepts')).body.items as {id:string;legacyMapId?:string}[];
  const triF=concepts.find(c=>c.legacyMapId==='tri-f')!;assert.ok(triF);
  const similar=await get('/v1/questions/similar?cores=tri-f,tidak-ada&limit=5');assert.equal(similar.status,200);
  assert.ok(similar.body.items.length>0);assert.ok(similar.body.items.length<=5);
  for(const it of similar.body.items){assert.ok(it.question.conceptIds.includes(triF.id));assert.deepEqual(it.sharedCoreIds,['tri-f']);}
  const extras=similar.body.items.map((it:any)=>it.question.conceptIds.length);assert.deepEqual(extras,[...extras].sort((a,b)=>a-b),'closest questions (fewest extra cores) first');
  const first=similar.body.items[0].question.id;
  assert.ok(!(await get(`/v1/questions/similar?cores=tri-f&excludeId=${first}`)).body.items.some((it:any)=>it.question.id===first));
  assert.deepEqual((await get('/v1/questions/similar?cores=tidak-ada')).body.items,[]);
  assert.equal((await get('/v1/questions/similar')).status,400);
 }finally{await app.close();await db.destroy();}
});
