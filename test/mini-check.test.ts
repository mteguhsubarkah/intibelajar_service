import test from 'node:test';import assert from 'node:assert/strict';
import {miniQuestion,miniGrade} from '../src/tutor/mini-check.js';
import {validateRequest,validateResponse} from '../src/platform/contract.js';
import {ApiError} from '../src/platform/errors.js';
const config={apiKey:'synthetic-key',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
const envelope=(content:unknown)=>Response.json({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
const input={others:['Definisi sin, cos, tan','Sudut Istimewa'],questionText:'Sebuah menara setinggi 20 m dilihat dengan sudut depresi 30°. Berapa jarak mendatar?',answer:'sin 30 = 20/x\nx = 1/4 * 20\nx = 5',core:{id:'tri-c',title:'Segitiga Siku-siku'},reason:'Coba cek lagi sisi mana yang kamu pakai, ya.'};

test('mini question: built from the question and the learner answer, about one core only',async()=>{
 let sent:any;
 const q=await miniQuestion(config,input,(async(_u,o)=>{sent=JSON.parse(String(o?.body));return envelope({pertanyaan:'Di soalmu, tinggi menara 20 m itu sisi apa dari sudut \\(30^\\circ\\)?',petunjuk:'Lihat sisi yang berhadapan dengan sudut.'});}) as typeof fetch);
 assert.equal(sent.response_format.type,'json_object');
 assert.match(sent.messages[0].content,/JANGAN meminta atau menyebut jawaban akhir/);
 const ctx=JSON.parse(sent.messages[1].content);
 assert.equal(ctx.inti,'Segitiga Siku-siku');assert.equal(ctx.jawabanSiswa,input.answer);assert.equal(ctx.catatanPemeriksaan,input.reason);assert.deepEqual(ctx.intiLainDiSoalIni,input.others);
 assert.match(sent.messages[0].content,/JANGAN tanyakan nama sisi/);
 assert.equal(q.question,'Di soalmu, tinggi menara 20 m itu sisi apa dari sudut 30°?');
 validateResponse('/v1/trial/mini-check','POST',200,q);
});
test('mini grade: a correct reply carries the reason for "Kamu sudah kuasai ini karena …"',async()=>{
 const g=await miniGrade(config,{...input,question:'sisi apa?',reply:'drpan'},(async()=>envelope({yangBenar:'depan',benar:true,tanggapan:'Betul, tinggi menara berhadapan dengan sudut 30°.',karena:'karena kamu tahu tinggi menara adalah sisi depan dari sudut 30°.'})) as typeof fetch);
 assert.deepEqual(g,{correct:true,feedback:'Betul, tinggi menara berhadapan dengan sudut 30°.',because:'kamu tahu tinggi menara adalah sisi depan dari sudut 30°'});
 const wrong=await miniGrade(config,{...input,question:'sisi apa?',reply:'miring'},(async()=>envelope({yangBenar:'depan',benar:false,tanggapan:'Hampir. Sisi miring itu yang terpanjang.',karena:'x'})) as typeof fetch);
 assert.equal(wrong.correct,false);assert.equal(wrong.because,'');
});
test('mini check: unreadable provider output is a 503, never a guessed verdict',async()=>{
 await assert.rejects(miniGrade(config,{...input,question:'q',reply:'r'},(async()=>envelope({tanggapan:'ok'})) as typeof fetch),(e:unknown)=>e instanceof ApiError&&e.status===503);
 await assert.rejects(miniQuestion(config,input,(async()=>envelope({pertanyaan:''})) as typeof fetch),(e:unknown)=>e instanceof ApiError&&e.status===503);
 await assert.rejects(miniQuestion(undefined as any,input),(e:unknown)=>e instanceof ApiError&&e.status===503);
});
test('mini check request contract',()=>{
 validateRequest('/v1/trial/mini-check','POST',{body:{sessionId:'s',questionId:'soal-menara',topicId:null,hintOpened:false,coreId:'tri-c',currentAnswer:'sin 30 = 20/x',reply:'depan'},query:{},headers:{}} as any);
 assert.throws(()=>validateRequest('/v1/trial/mini-check','POST',{body:{sessionId:'s',questionId:'soal-menara',topicId:null,hintOpened:false},query:{},headers:{}} as any));
});
test('mini question follows the correct step for this core and never shows the final answer',async()=>{
 let calls=0,ctx:any;
 const q=await miniQuestion(config,{...input,core:{id:'tri-f',title:'Sudut Istimewa'},steps:['Hitung: x = 20 / tan 30° = 20√3 ≈ 34,6 m'],hidden:['20 √ 3','34,6','1 / √ 3']},(async(_u,o)=>{calls++;ctx=JSON.parse(JSON.parse(String(o?.body)).messages[1].content);
  return envelope(calls===1?{pertanyaan:'Kalau tan 30° = 1/√3, berapa x?',petunjuk:'-'}:{pertanyaan:'Di soalmu perbandingan yang dipakai tan 30°. Berapa nilai tan 30°?',petunjuk:'Lihat segitiga 30°.'});}) as typeof fetch);
 assert.equal(calls,2,'a question that leaks 1/√3 is asked again');
 assert.deepEqual(ctx.langkahBenarInti,['Hitung: x = 20 / tan 30° = 20√3 ≈ 34,6 m']);
 assert.match(q.question,/tan 30°/);
});
