import test from 'node:test';
import assert from 'node:assert/strict';
import {trialDeepSeek} from '../src/assessment/trial-ai.js';
import {trialAssessment,type TrialItem} from '../src/assessment/trial.js';
import {draftManifest} from './fixtures/catalog.js';
const manifest=draftManifest();
const q=manifest.questions.find(q=>q.aliases.some(a=>a.ns==='ITEM'&&a.value==='soal-menara'))!;
const all=manifest.topics.flatMap(t=>t.concepts);
const item:TrialItem={revisionId:q.code,optionOrder:q.legacyOptionOrder??null,
 source:{revisionId:q.code,itemType:q.itemType,body:{...q.body,answerExample:'PRIVATE_EXAMPLE'},rubric:{...q.rubric,acceptedForms:['PRIVATE_KEY']},familyCode:q.familyCode,contextTag:q.contextTag,concepts:q.concepts.map(c=>({id:c.concept,code:c.concept,role:c.role,assessable:c.assessable}))},
 concepts:q.concepts.map(c=>{const core=all.find(x=>x.code===c.concept)!;return {code:c.concept,title:core.title,legacyMapId:core.aliases.find(a=>a.ns==='MAP')?.value??null,route:'lesson'};})};
const config={apiKey:'test-secret',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
const raw='tan 30 = 20/x; x = 20/(1/2)';
const entries=(state:string,quote:string)=>item.concepts.map(c=>({code:c.code,state,quote,reason:'Bukti langkah siswa.'}));
const envelope=(data:unknown)=>Response.json({choices:[{message:{content:JSON.stringify(data)}}]});
const response={schemaVersion:1 as const,responseType:'TEXT' as const,text:raw,inputMode:'TYPED' as const};
test('trial diagnosis calls DeepSeek with public context, maps special-angle error and caches the shared run',async()=>{
 let calls=0;
 const ai=trialDeepSeek(null as any,config,async(url,options)=>{
  calls++;assert.equal(String(url),'https://api.deepseek.com/chat/completions');
  const body=JSON.parse(String(options?.body));assert.equal(body.model,config.model);assert.equal(body.response_format.type,'json_object');
  assert.ok(!JSON.stringify(body).includes('PRIVATE_KEY'));assert.ok(!JSON.stringify(body).includes('PRIVATE_EXAMPLE'));assert.ok(!JSON.stringify(body).includes('test-secret'));
  assert.equal(JSON.parse(body.messages[1].content).response.text,raw);
  return envelope({correct:false,items:item.concepts.map(c=>({code:c.code,state:c.legacyMapId==='tri-f'?'gap':'ok',quote:c.legacyMapId==='tri-f'?'1/2':'tan 30',reason:c.legacyMapId==='tri-f'?'Nilai sudut istimewa pada pembagian belum sesuai.':'Hubungan sisi terlihat tepat.'}))});
 });
 const service=trialAssessment(async()=>item,ai);
 const body={sessionId:'ai-run',questionId:'soal-menara',rawText:raw,responseMode:null};
 const [first,concurrent]=await Promise.all([service.diagnose('owner',body),service.diagnose('owner',body)]);assert.deepEqual(first,concurrent);
 assert.equal(first.assessment.gap.mapId,'tri-f');assert.ok(first.items.some((i:any)=>i.id==='tri-f'&&i.state==='gap'));
 assert.deepEqual(await service.diagnose('owner',body),first);assert.equal(calls,1);
});
test('trial check and tutor use provider; chat carries the latest answer and bounded history',async()=>{
 const answer='20√3';let grading=0,chat=0;
 const ai=trialDeepSeek(null as any,config,async(_url,options)=>{
  const body=JSON.parse(String(options?.body));
  if(body.messages[0].content.includes('penilai')){grading++;return envelope({correct:true,items:entries('ok',answer)});}
  chat++;const context=JSON.parse(body.messages[1].content.replace('Konteks belajar: ',''));assert.deepEqual(context.daftarInti.map((c:any)=>c.judul),item.concepts.map(c=>c.title));
  assert.equal(context.jawabanSaatIni,'draft yang baru diedit');assert.equal(context.soal,q.body.prompt);assert.ok(body.messages.length<=14);
  return Response.json({choices:[{message:{content:'Tepat, sekarang sisi mana yang kamu pakai? 📐'}}]});
 });
 const s=trialAssessment(async()=>item,ai);
 assert.equal((await s.check('owner',{sessionId:'a',itemId:'soal-menara',answer})).correct,true);
 const reply=await s.tutor('owner',{sessionId:'a',questionId:'soal-menara',currentAnswer:'draft yang baru diedit',messages:Array.from({length:15},(_,i)=>({from:i%2?'bot':'me',text:'pesan '+i}))});
 assert.match(reply.text,/sisi mana/);assert.equal(reply.hintsUsed,1);assert.equal(grading,1);assert.equal(chat,1);
});
test('missing config, invalid JSON, invented evidence and provider failure never fall back',async()=>{
 for(const http of [async()=>new Response('',{status:500}),async()=>{throw Error('network');},async()=>Response.json({choices:[]}),async()=>envelope({correct:true,items:entries('ok','invented quote')})]){
  const ai=trialDeepSeek(null as any,config,http);
  await assert.rejects(ai.evaluate(item,response),(e:any)=>e.status===503);
  const s=trialAssessment(async()=>item,ai);
  await assert.rejects(s.diagnose('owner',{sessionId:'fail',questionId:'soal-menara',rawText:raw,responseMode:null}),(e:any)=>e.status===503);
  await assert.rejects(s.check('owner',{sessionId:'fail',itemId:'soal-menara',answer:raw}),(e:any)=>e.status===503);
 }
 await assert.rejects(trialDeepSeek(null as any,undefined).evaluate(item,response),(e:any)=>e.status===503);
 const down=trialDeepSeek(null as any,config,async()=>new Response('',{status:500}));
 await assert.rejects(down.tutor(item,[{from:'me',text:'Bantu'}],raw,0),(e:any)=>e.status===503);
});
test('nullable AI verdict: unrelated text asks for clarification, unfinished work still gets a direction',async()=>{
 // tidak berhubungan sama sekali dengan soal: tetap klarifikasi, tanpa inti tebakan
 const off=trialAssessment(async()=>item,trialDeepSeek(null as any,config,async()=>envelope({correct:null,relevant:false,clarification:'Tulis langkah untuk soal menara.',items:entries('rest','')})));
 const run=await off.diagnose('owner',{sessionId:'off',questionId:'soal-menara',rawText:'resep nasi goreng',responseMode:null});
 assert.equal(run.status,'insufficient_evidence');assert.equal(run.assessment,undefined);
 assert.equal((await off.check('owner',{sessionId:'off',itemId:'soal-menara',answer:'resep nasi goreng'})).correct,null);
 // bingung total: mulai dari inti pertama; tidak pernah menandai sebagai benar
 const lost=trialAssessment(async()=>item,trialDeepSeek(null as any,config,async()=>envelope({correct:null,items:entries('rest','')})));
 const start=await lost.diagnose('owner',{sessionId:'lost',questionId:'soal-menara',rawText:'bingung',responseMode:null});
 assert.equal(start.status,'completed');assert.equal(start.assessment.tone,'gap');assert.equal(start.assessment.title,'Mulai dari sini.');
 assert.equal(start.items.filter((x:any)=>x.state==='gap').length,1);assert.ok(!start.items.some((x:any)=>x.state==='ok'));assert.equal(start.claimToken,undefined);
 // setengah jalan: inti yang sudah ditulis ok, inti pertama yang belum ada jadi langkah berikutnya
 const first=item.concepts[0]!.code,text='tan 30 = 20/x';
 const half=trialAssessment(async()=>item,trialDeepSeek(null as any,config,async()=>envelope({correct:null,clarification:'Lanjutkan sampai x.',items:item.concepts.map(c=>c.code===first?{code:c.code,state:'ok',quote:'tan 30',reason:'Sudah memilih perbandingan yang tepat.'}:{code:c.code,state:'rest',quote:'',reason:'Hitung nilai x dari persamaan ini.'})})));
 const partial=await half.diagnose('owner',{sessionId:'half',questionId:'soal-menara',rawText:text,responseMode:null});
 assert.equal(partial.status,'completed');assert.equal(partial.assessment.title,'Kamu sudah di jalur yang benar. Tinggal lanjutkan.');
 assert.equal(partial.items.find((x:any)=>x.state==='ok').id,item.concepts[0]!.legacyMapId);
 const next=partial.items.find((x:any)=>x.state==='gap');assert.equal(next.id,item.concepts[1]!.legacyMapId);assert.equal(next.reason,'Hitung nilai x dari persamaan ini.');assert.equal(next.quote,undefined);
});
