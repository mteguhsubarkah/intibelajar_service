import test from 'node:test';import assert from 'node:assert/strict';
import {guideReply,plainMath} from '../src/tutor/context-guide.js';
import {validateRequest,validateResponse} from '../src/platform/contract.js';
const config={apiKey:'synthetic-key',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
const cores=[{id:'tri-i',title:'Identitas Dasar'},{id:'tri-g',title:'Kuadran & Tanda'}];
const envelope=(content:unknown)=>Response.json({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
const answer=(content:unknown)=>(async()=>envelope(content)) as typeof fetch;
test('LaTeX from the model is rewritten as plain math text',()=>{
 assert.equal(plainMath('Soalmu: \\(\\sin x = \\frac{9}{12}\\)'),'Soalmu: sin x = 9/12');
 assert.equal(plainMath('dari \\(s^2 + 3^2 = 4^2\\)'),'dari s² + 3² = 4²');
 assert.equal(plainMath('$\\sqrt{7}$ dan \\sqrt{x+1}'),'√7 dan √(x+1)');
 assert.equal(plainMath('\\frac{\\sqrt{7}}{4} dan 30^\\circ, \\cos x \\cdot 2'),'√7/4 dan 30°, cos x · 2');
 assert.equal(plainMath('\\tan x = \\frac{-3}{\\sqrt{7}}'),'tan x = (-3)/√7');
 assert.equal(plainMath('Inti **Kuadran** ✅'),'Inti **Kuadran** ✅');
});
test('IntiGuide is told to stay on the listed cores, refuse off-topic chat, and never write LaTeX',async()=>{
 let sent:any;
 const reply=await guideReply(null as any,config,{questionText:'sin x = 9/12, x kuadran 2, tan x = ?',cores,messages:[{from:'me',text:'Tulisan frac itu apa namanya di programming?'}]},(async(_u,o)=>{sent=JSON.parse(String(o?.body));return envelope({reply:'Aku fokus ke soal ini dulu ya. Dari \\(\\sin^2 x + \\cos^2 x = 1\\), cos²x berapa?',active:'tri-i',done:['tri-x']});}) as typeof fetch);
 assert.equal(sent.response_format.type,'json_object');
 const system=sent.messages[0].content;
 for(const rule of [/DAFTAR INTI/,/satu inti per giliran/,/menyederhanakan pecahan/,/pemrograman, LaTeX/,/DILARANG LaTeX/,/Jangan memberikan jawaban akhir/])assert.match(system,rule);
 assert.deepEqual(JSON.parse(sent.messages[1].content.replace('Konteks belajar: ','')).daftarInti,[{id:'tri-i',judul:'Identitas Dasar'},{id:'tri-g',judul:'Kuadran & Tanda'}]);
 assert.equal(reply.text,'Aku fokus ke soal ini dulu ya. Dari sin² x + cos² x = 1, cos²x berapa?');
 assert.deepEqual(reply.coreProgress,{active:'tri-i',done:[]},'unknown core ids are dropped');
 validateResponse('/v1/guide/messages','POST',200,reply);
 validateRequest('/v1/guide/messages','POST',{body:{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},query:{},headers:{}} as any);
});
test('progress reports finished cores; plain-text replies still work without progress',async()=>{
 const done=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'cos x = -√7/4'}]},answer({reply:'Tepat! Sekarang **Kuadran & Tanda**.',active:'tri-g',done:['tri-i','tri-i']}));
 assert.deepEqual(done.coreProgress,{active:'tri-g',done:['tri-i']});
 const plain=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},answer('Halo, kita mulai dari identitas dasar ya.'));
 assert.equal(plain.text,'Halo, kita mulai dari identitas dasar ya.');assert.deepEqual(plain.coreProgress,{active:null,done:[]});
 const noCores=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'hai'}]},answer({reply:'Halo',active:null,done:[]}));
 assert.equal(noCores.coreProgress,undefined);
 await assert.rejects(guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},answer({reply:'  ',active:null,done:[]})),(e:any)=>e.status===503);
});
