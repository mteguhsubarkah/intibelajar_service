import test from 'node:test';import assert from 'node:assert/strict';
import {trialDeepSeek} from '../src/assessment/trial-ai.js';
import {trialAssessment,type TrialItem} from '../src/assessment/trial.js';
import {orderedGuideCores} from '../src/tutor/core-steps.js';
import {guideReply,MINI_CAP} from '../src/tutor/context-guide.js';
import {validateResponse} from '../src/platform/contract.js';
import {draftManifest} from './fixtures/catalog.js';
/*
 * IntiGuide di soal /coba (kompor, bola): urutan inti dari langkah penyelesaian di kunci soal, inti baru tuntas sesudah
 * langkahnya di soal ini selesai (paling banyak 3 jawaban benar), langkah jawaban akhir tidak pernah sampai ke model,
 * dan balasan yang melompat ke inti lain ditulis ulang sekali.
 */
const manifest=draftManifest();
const all=manifest.topics.flatMap(t=>t.concepts);
const config={apiKey:'test-secret',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
/* butir soal seperti dari database: inti diurutkan menurut ordinal katalog (mappedConcepts), bukan urutan langkah */
function itemOf(alias:string):TrialItem{
 const q=manifest.questions.find(q=>q.aliases.some(a=>a.ns==='ITEM'&&a.value===alias))!;
 const concepts=q.concepts.map(c=>all.find(x=>x.code===c.concept)!).sort((a,b)=>a.ordinal-b.ordinal||a.code.localeCompare(b.code));
 return {revisionId:q.code,optionOrder:null,
  source:{revisionId:q.code,itemType:q.itemType,body:q.body,rubric:q.rubric,familyCode:q.familyCode,contextTag:q.contextTag,concepts:q.concepts.map(c=>({id:c.concept,code:c.concept,role:c.role,assessable:c.assessable}))},
  concepts:concepts.map(c=>({code:c.code,title:c.title,legacyMapId:c.aliases.find(a=>a.ns==='MAP')?.value??null,route:'lesson'}))};
}
const kompor=itemOf('soal-kompor'),bola=itemOf('soal-bola');
const envelope=(data:unknown)=>Response.json({choices:[{message:{content:typeof data==='string'?data:JSON.stringify(data)}}]});
const contextOf=(body:any)=>JSON.parse(body.messages[1].content.replace('Konteks belajar: ',''));

test('the core order comes from the question key: kompor setara -> mol -> perhitungan, bola vektor -> sudut istimewa -> peluru',()=>{
 assert.deepEqual(kompor.concepts.map(c=>c.legacyMapId),['kim-e-stoik-c1','kim-e-stoik-setara','kim-e-stoik-c2'],'catalog ordinal puts mol first (the old order)');
 const k=orderedGuideCores(kompor.concepts,kompor.source.rubric.solutionPaths);
 assert.deepEqual(k.map(c=>c.id),['kim-e-stoik-setara','kim-e-stoik-c1','kim-e-stoik-c2']);
 assert.match(k[0]!.step!,/CH₄ \+ 2O₂ → CO₂ \+ 2H₂O/);assert.match(k[1]!.step!,/mol CH₄/);
 assert.equal(k[2]!.step,null);assert.equal(k[2]!.final,true);
 assert.ok(!JSON.stringify(k).includes('44'),'the final step (44 g) never reaches the model');
 const b=orderedGuideCores(bola.concepts,bola.source.rubric.solutionPaths);
 assert.deepEqual(b.map(c=>c.id),['fis-e-gerak2d-vektor','tri-f','fis-e-gerak2d-c2']);
 assert.equal(b[2]!.final,true);assert.ok(!JSON.stringify(b).includes('2 s'));
 // tanpa langkah penyelesaian (soal sendiri): urutan katalog, tanpa step (aturan lama)
 assert.deepEqual(orderedGuideCores(kompor.concepts,[]),kompor.concepts.map(c=>({id:c.legacyMapId,title:c.title})));
});

/* percakapan trial dengan model tiruan: setiap giliran membalas isian berikutnya dan menyimpan permintaan yang dikirim */
function chat(item:TrialItem,replies:unknown[]){
 const sent:any[]=[];
 const ai=trialDeepSeek(null as any,config,(async(_u:unknown,o?:RequestInit)=>{const body=JSON.parse(String(o?.body));sent.push(body);return envelope(replies.shift());}) as typeof fetch);
 const s=trialAssessment(async()=>item,ai);
 const history:{from:string;text:string}[]=[{from:'bot',text:'Halo! Aku IntiGuide.'}];
 const say=async(text:string,session='kompor')=>{history.push({from:'me',text});const r=await s.tutor('owner',{sessionId:session,questionId:'x',messages:[...history]});history.push({from:'bot',text:r.text});return r;};
 return {sent,say};
}
const right=(reply:string,done=false)=>({cek:{pertanyaanMini:'q',jawabanSiswa:'a',yangBenar:'a',siswaBenar:true},reply,intiAktifSelesai:done});

test('soal kompor: a correct Mr does not finish Mol; the core is done once its step in this question is finished',async()=>{
 const {sent,say}=chat(kompor,[
  {cek:{siswaBenar:null},reply:'Tenang, kita pelan-pelan.\n\nKita mulai dari **Menyetarakan reaksi**. Berapa O₂ yang dibutuhkan?',intiAktifSelesai:false},
  right('Tepat, reaksinya sudah setara!\n\nSekarang **Mol dan massa molar**. Berapa Mr CH₄?',true),
  right('Betul, Mr CH₄ = 16.\n\nJadi 16 gram CH₄ itu berapa mol?'),
  right('Mantap!\n\nSekarang **Perhitungan dari persamaan reaksi**: koefisien CO₂ berapa dibanding CH₄?',true),
 ]);
 const first=await say('bingung');
 const c1=contextOf(sent[0]);
 assert.deepEqual(c1.daftarInti.map((c:any)=>c.id),['kim-e-stoik-setara','kim-e-stoik-c1','kim-e-stoik-c2']);
 assert.equal(c1.intiAktif.id,'kim-e-stoik-setara');assert.match(c1.intiAktif.langkahDiSoal,/CH₄ \+ 2O₂/);
 assert.deepEqual(c1.intiBerikutnya,{id:'kim-e-stoik-c1',judul:'Mol dan massa molar'});
 assert.equal(c1.daftarInti[2].langkahTerakhir,true);assert.equal(c1.daftarInti[2].langkahDiSoal,null);
 assert.ok(!sent[0].messages[1].content.includes('44'),'final answer never in the context');
 assert.deepEqual(first.coreProgress,{active:'kim-e-stoik-setara',done:[],order:['kim-e-stoik-setara','kim-e-stoik-c1','kim-e-stoik-c2']});
 assert.equal((first as any).streak,undefined,'the streak stays on the server');
 validateResponse('/v1/trial/tutor','POST',200,first);
 const second=await say('CH4 + 2O2 -> CO2 + 2H2O');
 assert.deepEqual(second.coreProgress?.done,['kim-e-stoik-setara']);assert.equal(second.coreProgress?.active,'kim-e-stoik-c1');
 const third=await say('Mr CH4 = 12 + 4 = 16');
 assert.equal(contextOf(sent[2]).jawabanBenarIntiAktif,0);
 assert.deepEqual(third.coreProgress?.done,['kim-e-stoik-setara'],'a correct part of the step does not finish Mol');
 assert.equal(third.coreProgress?.active,'kim-e-stoik-c1');
 const fourth=await say('16/16 = 1 mol');
 assert.equal(contextOf(sent[3]).jawabanBenarIntiAktif,1);assert.match(contextOf(sent[3]).intiAktif.langkahDiSoal,/mol CH₄/);
 assert.deepEqual(fourth.coreProgress?.done,['kim-e-stoik-setara','kim-e-stoik-c1']);assert.equal(fourth.coreProgress?.active,'kim-e-stoik-c2');
 assert.equal(sent.length,4,'no rewrite needed');
 for(const rule of [/langkahDiSoal/,/paling banyak 3 pertanyaan mini/,/langkahTerakhir:true/,/jangan pernah menyebut hasil akhirnya/,/buka HANYA intiBerikutnya/,/belum menuntaskan inti/])assert.match(sent[0].messages[0].content,rule);
});

test('soal kompor: three correct answers finish a core even if the model keeps asking (cap 3)',async()=>{
 assert.equal(MINI_CAP,3);
 const {say}=chat(kompor,[right('Setara!\n\n**Mol dan massa molar**: Mr CH₄?',true),right('Betul. Ar C berapa?'),right('Betul. Ar H berapa?'),right('Betul. Lalu molnya?'),right('ok')]);
 await say('CH4 + 2O2 -> CO2 + 2H2O','cap');
 assert.equal((await say('16','cap')).coreProgress?.active,'kim-e-stoik-c1');
 assert.equal((await say('12','cap')).coreProgress?.active,'kim-e-stoik-c1');
 const third=await say('1','cap');
 assert.deepEqual(third.coreProgress?.done,['kim-e-stoik-setara','kim-e-stoik-c1']);assert.equal(third.coreProgress?.active,'kim-e-stoik-c2');
});

test('soal kompor: a reply that skips to another core is rewritten once; the second reply is used',async()=>{
 const {sent,say}=chat(kompor,[
  right('Setara!\n\n**Mol dan massa molar**: Mr CH₄?',true),
  right('Betul!\n\nLangsung ke **Perhitungan dari persamaan reaksi**: koefisien CO₂?'),
  right('Betul, Mr CH₄ = 16.\n\nJadi 16 gram CH₄ itu berapa mol?'),
 ]);
 await say('CH4 + 2O2 -> CO2 + 2H2O','jump');
 const r=await say('Mr = 16','jump');
 assert.equal(sent.length,3,'one rewrite');
 const note=sent[2].messages.at(-1);
 assert.equal(note.role,'system');assert.match(note.content,/Perhitungan dari persamaan reaksi/);assert.match(note.content,/Tetap bahas \*\*Mol dan massa molar\*\*/);
 assert.equal(r.text,'Betul, Mr CH₄ = 16.\n\nJadi 16 gram CH₄ itu berapa mol?');
 assert.equal(r.coreProgress?.active,'kim-e-stoik-c1');
 // menutup mol lalu melompati inti berikutnya: tulis ulang dengan inti yang benar
 const skip=chat(kompor,[{cek:{siswaBenar:true},reply:'Setara! Kita langsung **Perhitungan dari persamaan reaksi**.',intiAktifSelesai:true},right('Setara!\n\nSekarang **Mol dan massa molar**: Mr CH₄?',true)]);
 const s=await skip.say('CH4 + 2O2 -> CO2 + 2H2O','skip');
 assert.match(skip.sent[1].messages.at(-1).content,/buka HANYA \*\*Mol dan massa molar\*\*/);
 assert.equal(s.coreProgress?.active,'kim-e-stoik-c1');assert.match(s.text,/Mol dan massa molar/);
 // tulis ulang yang masih melompat: tidak ada percobaan ketiga, inti tetap tidak terlewat
 const stubborn=chat(kompor,[right('Langsung **Perhitungan dari persamaan reaksi** ya.'),right('Tetap **Perhitungan dari persamaan reaksi**.')]);
 const t=await stubborn.say('bingung','stubborn');
 assert.equal(stubborn.sent.length,2);assert.equal(t.coreProgress?.active,'kim-e-stoik-setara');assert.deepEqual(t.coreProgress?.done,[]);
});

test('listing every core and then starting with the active one is not a jump',async()=>{
 const cores=orderedGuideCores(kompor.concepts,kompor.source.rubric.solutionPaths);let calls=0;
 const r=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'Inti apa yang dipakai?'}]},(async()=>{calls++;return envelope({cek:{siswaBenar:null},reply:'Soal ini memakai **Menyetarakan reaksi**, **Mol dan massa molar**, dan **Perhitungan dari persamaan reaksi**.\n\nKita mulai dari **Menyetarakan reaksi**: berapa O₂ yang dibutuhkan?',intiAktifSelesai:false});}) as typeof fetch);
 assert.equal(calls,1);assert.equal(r.coreProgress?.active,'kim-e-stoik-setara');
});

test('soal bola: after the velocity components the guide opens Sudut Istimewa, not projectile motion',async()=>{
 const {sent,say}=chat(bola,[right('Tepat, vᵧ = v sin 30°.\n\nSekarang **Sudut Istimewa**: sin 30° berapa?',true),right('Betul!\n\nJadi vᵧ berapa m/s?')]);
 const first=await say('vy = 20 sin 30','bola');
 const c=contextOf(sent[0]);
 assert.equal(c.intiAktif.id,'fis-e-gerak2d-vektor');assert.deepEqual(c.intiBerikutnya,{id:'tri-f',judul:'Sudut Istimewa'});
 assert.ok(!sent[0].messages[1].content.includes('2 s'),'final step hidden');
 assert.deepEqual(first.coreProgress,{active:'tri-f',done:['fis-e-gerak2d-vektor'],order:['fis-e-gerak2d-vektor','tri-f','fis-e-gerak2d-c2']});
 const second=await say('1/2','bola');
 assert.equal(second.coreProgress?.active,'tri-f','sin 30° = ½ alone does not finish the step (vᵧ = 10 m/s)');
});

test('keyed cores in plain-text mode: opening the next core counts as finishing; the last core finishes on one correct answer',async()=>{
 const cores=orderedGuideCores(kompor.concepts,kompor.source.rubric.solutionPaths);
 const plain=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'CH4 + 2O2'}]},(async()=>envelope('Mantap, setara!\n\nSekarang **Mol dan massa molar**: Mr CH₄ berapa?')) as typeof fetch);
 assert.equal(plain.coreProgress?.active,'kim-e-stoik-c1');
 const last=await guideReply(null as any,config,{questionText:'q',cores,done:['kim-e-stoik-setara','kim-e-stoik-c1'],messages:[{from:'me',text:'1 : 1'}]},(async()=>envelope(right('Betul, koefisiennya 1 : 1. Sekarang tulis ulang langkahmu.'))) as typeof fetch);
 assert.deepEqual(last.coreProgress?.done,['kim-e-stoik-setara','kim-e-stoik-c1','kim-e-stoik-c2']);assert.equal(last.coreProgress?.active,null);
});
