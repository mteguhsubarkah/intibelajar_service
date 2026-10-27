import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {sql} from 'kysely';
import {matchOwnQuestion,ownQuestionService} from '../src/assessment/own-question.js';
import {ownCatalog,type OwnCore} from '../src/catalog/own-catalog.js';
import {readConfig} from '../src/config.js';import {connect} from '../src/db.js';import {migrate} from '../src/migrate.js';
import {publish} from '../src/catalog/publisher.js';import {reviewedFixture} from './fixtures/catalog.js';
import {validateRequest,validateResponse} from '../src/platform/contract.js';
const guide={apiKey:'test-secret',model:'deepseek-flash'};
const core:OwnCore={id:'id',code:'SPECIAL',title:'Sudut Istimewa',description:'Nilai sudut istimewa',mapId:'tri-f',topicId:'trigonometri',subject:'matematika'};
const envelope=(v:unknown)=>Response.json({choices:[{message:{content:JSON.stringify(v)}}]});
test('own mapping is AI selection constrained to catalog, not keyword expansion or learner mastery',async()=>{
 const picked=await matchOwnQuestion(guide,'tentukan cos30',[core],async(_url,options)=>{
  const p=JSON.parse(String(options?.body));assert.equal(p.response_format.type,'json_object');assert.equal(p.model,guide.model);
  const data=JSON.parse(p.messages[1].content);assert.deepEqual(data.catalog,[{mapId:'tri-f',title:core.title,description:core.description}]);assert.equal(data.question,'tentukan cos30');
  return envelope({cores:['tri-f']});
 });assert.deepEqual(picked,[core]);
 for(const ids of [['foreign'],['tri-f','tri-f']])await assert.rejects(matchOwnQuestion(guide,'q',[core],async()=>envelope({cores:ids})),(e:any)=>e.status===503);
 await assert.rejects(matchOwnQuestion(guide,'q',[core],async()=>new Response('',{status:500})),(e:any)=>e.status===503);
 await assert.rejects(matchOwnQuestion(undefined,'q',[core]),(e:any)=>e.status===503);
});
test('own question has a dedicated validated contract, not a catalog questionId',()=>{
 validateRequest('/v1/own/diagnosis','POST',{body:{questionText:'cos30',rawText:'√3/2',sessionId:'a',hintOpened:false},query:{},headers:{}} as any);
 assert.throws(()=>validateRequest('/v1/own/diagnosis','POST',{body:{questionId:'own:fake'},query:{},headers:{}} as any),(e:any)=>e.status===400);
});
test('typed question diagnoses through AI without catalog alias lookup, fake XP, mastery or answer-key egress',async()=>{
 const config=readConfig(JSON.parse(readFileSync('.local/test-env.json','utf8')));assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 const db=connect(config.databaseUrl);await migrate(db);
 try{
  const manifest=reviewedFixture();manifest.release.version=Number((await sql<{v:number}>`select coalesce(max(version),0)+1 as v from curriculum_release`.execute(db)).rows[0]!.v);await publish(db,manifest);
  const catalog=await ownCatalog(db);assert.ok(catalog.cores.some(c=>c.mapId==='tri-f'));
  const counts=async()=>Promise.all(['question','learning_session','concept_evidence'].map(async table=>Number((await sql<{n:string}>`select count(*) n from ${sql.table(table)}`.execute(db)).rows[0]!.n)));
  const before=await counts();let calls=0;
  const service=ownQuestionService(db,guide,async(_url,options)=>{
   calls++;const body=JSON.parse(String(options?.body));const data=JSON.parse(body.messages[1].content);
   assert.ok(!JSON.stringify(data).includes('rubric'));assert.ok(!JSON.stringify(data).includes('acceptedForms'));assert.ok(!JSON.stringify(data).includes('test-secret'));
   if(data.catalog)return envelope({cores:['tri-f']});
   assert.equal(data.question.prompt,'Tentukan nilai cos30');assert.equal(data.response.text,'√3/2');
   return envelope({correct:true,items:data.concepts.map((c:any)=>({code:c.code,state:'ok',reason:'Nilai sudut istimewa sudah tepat.',quote:'√3/2'}))});
  });
  const result:any=await service.diagnose({questionText:'Tentukan nilai cos30',rawText:'√3/2',sessionId:'own-typed',hintOpened:false});
  assert.equal(result.status,'completed');assert.equal(result.assessment.tone,'kuat');assert.deepEqual(result.items.map((i:any)=>i.id),['tri-f']);assert.equal(result.claimToken,undefined);assert.equal(calls,2);
  validateResponse('/v1/own/diagnosis','POST',200,result);assert.deepEqual(await counts(),before);
  const outside=ownQuestionService(db,guide,async()=>envelope({cores:[]}));const unknown=await outside.diagnose({questionText:'Pertanyaan di luar katalog',rawText:'Jawabanku',sessionId:'out',hintOpened:false});
  assert.equal(unknown.status,'insufficient_evidence');
 }finally{await db.destroy();}
});
