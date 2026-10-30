import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {sql} from 'kysely';
import {matchOwnQuestion,ownQuestionService} from '../src/assessment/own-question.js';
import {ownCatalog,type OwnCore} from '../src/catalog/own-catalog.js';
import {readConfig} from '../src/config.js';import {connect} from '../src/db.js';import {migrate} from '../src/migrate.js';
import {publish} from '../src/catalog/publisher.js';import {reviewedFixture} from './fixtures/catalog.js';
import {validateRequest,validateResponse} from '../src/platform/contract.js';
const guide={apiKey:'test-secret',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
const core:OwnCore={id:'id',code:'SPECIAL',title:'Sudut Istimewa',description:'Nilai sudut istimewa',mapId:'tri-f',topicId:'trigonometri',subject:'matematika'};
const envelope=(v:unknown)=>Response.json({choices:[{message:{content:JSON.stringify(v)}}]});
test('own mapping is AI selection constrained to catalog, not keyword expansion or learner mastery',async()=>{
 const picked=await matchOwnQuestion(guide,'tentukan cos30',[core],async(_url,options)=>{
  const p=JSON.parse(String(options?.body));assert.equal(p.response_format.type,'json_object');assert.equal(p.model,guide.model);
  const data=JSON.parse(p.messages[1].content);assert.deepEqual(data.catalog,[{mapId:'tri-f',title:core.title,description:core.description,subject:'matematika',topic:'trigonometri'}]);assert.equal(data.question,'tentukan cos30');
  return envelope({cores:[{id:'tri-f',relation:'Nilai cos 30 derajat menggunakan nilai sudut istimewa.'}]});
 });assert.deepEqual(picked.outline,[{core,relation:'Nilai cos 30 derajat menggunakan nilai sudut istimewa.'}]);assert.deepEqual(picked.scope,{status:'IN_CATALOG',subject:null,message:''});
 for(const ids of [['foreign'],['tri-f','tri-f']])await assert.rejects(matchOwnQuestion(guide,'q',[core],async()=>envelope({cores:ids.map(id=>({id,relation:'Peran inti pada soal.'}))})),(e:any)=>e.status===503);
 await assert.rejects(matchOwnQuestion(guide,'q',[core],async()=>new Response('',{status:500})),(e:any)=>e.status===503);
 await assert.rejects(matchOwnQuestion(undefined,'q',[core]),(e:any)=>e.status===503);
});
test('questions outside the catalog or the supported subjects are refused with a reason, never with invented cores',async()=>{
 const ask=(v:unknown)=>matchOwnQuestion(guide,'q',[core],async()=>envelope(v));
 const fisika=await ask({scope:'OUT_OF_CATALOG',subject:'fisika',reason:'Ini soal gerak lurus.',cores:[]});
 assert.equal(fisika.scope.status,'OUT_OF_CATALOG');assert.match(fisika.scope.message,/Soal Fisika belum bisa dikerjakan karena intinya belum ada di katalog/);assert.match(fisika.scope.message,/gerak lurus/);
 // Fisika sudah punya inti di katalog: alasannya soal ini, bukan "baru Matematika".
 const gerak:OwnCore={...core,id:'g',mapId:'fis-e-gerak2d-glbb',subject:'fisika',topicId:'gerak-parabola'};
 const mapped=await matchOwnQuestion(guide,'q',[core,gerak],async()=>envelope({scope:'OUT_OF_CATALOG',subject:'fisika',reason:'',cores:[]}));
 assert.match(mapped.scope.message,/^Soal Fisika ini belum bisa dikerjakan karena inti yang dipakainya belum ada di katalog kami\.$/);assert.doesNotMatch(mapped.scope.message,/baru Matematika/);
 const sejarah=await ask({scope:'UNSUPPORTED_SUBJECT',subject:'lainnya',reason:'Ini soal sejarah.',cores:[]});
 assert.equal(sejarah.scope.status,'UNSUPPORTED_SUBJECT');assert.equal(sejarah.scope.subject,null);assert.match(sejarah.scope.message,/di luar pelajaran yang didukung IntiBelajar \(Matematika, Fisika, Kimia, Biologi, dan Bahasa Inggris\)/);
 const hai=await ask({scope:'NOT_A_QUESTION',subject:null,reason:'',cores:[]});
 assert.equal(hai.scope.status,'NOT_A_QUESTION');assert.match(hai.scope.message,/belum terlihat seperti soal/);
 assert.equal((await ask({scope:'IN_CATALOG',subject:'matematika',cores:[]})).scope.status,'OUT_OF_CATALOG','no cores is never in catalog');
 assert.equal((await ask({scope:'UNSUPPORTED_SUBJECT',subject:'lainnya',cores:[{id:'tri-f',relation:'Nilai sudut istimewa dipakai.'}]})).scope.status,'IN_CATALOG','matched cores win');
 assert.equal((await ask({scope:'OUT_OF_CATALOG',subject:'matematika',reason:'pakai \\frac{1}{2}',cores:[]})).scope.message.includes('frac'),false,'LaTeX reasons are dropped');
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
   if(data.catalog)return envelope({cores:[{id:'tri-f',relation:'Nilai cos 30 derajat menggunakan nilai sudut istimewa.'}]});
   assert.equal(data.question.prompt,'Tentukan nilai cos30');assert.equal(data.response.text,'√3/2');
   return envelope({correct:true,items:data.concepts.map((c:any)=>({code:c.code,state:'ok',reason:'Nilai sudut istimewa sudah tepat.',quote:'√3/2'}))});
  });
  const [hint1,hint2]=await Promise.all([service.hints('Tentukan nilai cos30','learner-a'),service.hints('Tentukan nilai cos30','learner-a')]);
  assert.deepEqual(hint1,hint2);assert.equal(calls,1);assert.equal(hint1.items[0]?.title,catalog.cores.find(c=>c.mapId==='tri-f')?.title);
  assert.match(hint1.items[0]!.relation,/cos 30/);validateResponse('/v1/own/hints','POST',200,hint1);assert.equal(hint1.scope.status,'IN_CATALOG');
  assert.deepEqual((await service.map('Tentukan nilai cos30','learner-a')).cores,['tri-f']);assert.equal(calls,1);
  const result:any=await service.diagnose({questionText:'Tentukan nilai cos30',rawText:'√3/2',sessionId:'own-typed',hintOpened:false},'learner-a');
  assert.equal(result.status,'completed');assert.equal(result.assessment.tone,'kuat');assert.deepEqual(result.items.map((i:any)=>i.id),['tri-f']);assert.equal(result.claimToken,undefined);assert.equal(calls,2);
  validateResponse('/v1/own/diagnosis','POST',200,result);assert.deepEqual(await counts(),before);
  await service.hints('Tentukan nilai cos30','learner-b');assert.equal(calls,3,'another learner has a separate cache');
  const next=reviewedFixture();next.release.version=manifest.release.version+1;await publish(db,next);
  const changed=await service.hints('Tentukan nilai cos30','learner-a');assert.notEqual(changed.catalogReleaseId,hint1.catalogReleaseId);assert.equal(calls,4,'new release invalidates cached mapping');
  const outside=ownQuestionService(db,guide,async()=>envelope({scope:'UNSUPPORTED_SUBJECT',subject:'lainnya',reason:'',cores:[]}));const unknown:any=await outside.diagnose({questionText:'Pertanyaan di luar katalog',rawText:'Jawabanku',sessionId:'out',hintOpened:false});
  assert.equal(unknown.status,'insufficient_evidence');assert.match(unknown.clarification,/di luar pelajaran yang didukung/);
  const refused=await outside.hints('Siapa presiden pertama Indonesia?','learner-a');assert.equal(refused.scope.status,'UNSUPPORTED_SUBJECT');assert.deepEqual(refused.items,[]);validateResponse('/v1/own/hints','POST',200,refused);
 }finally{await db.destroy();}
});
