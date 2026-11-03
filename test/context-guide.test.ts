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
test('IntiGuide works the cores in order: the server picks the active core, the model only reports it finished',async()=>{
 let sent:any;
 const reply=await guideReply(null as any,config,{questionText:'sin x = 9/12, x kuadran 2, tan x = ?',cores,messages:[{from:'me',text:'Tulisan frac itu apa namanya di programming?'}]},(async(_u,o)=>{sent=JSON.parse(String(o?.body));return envelope({reply:'Aku fokus ke soal ini dulu ya. Dari \\(\\sin^2 x + \\cos^2 x = 1\\), cos²x berapa?',intiAktifSelesai:false});}) as typeof fetch);
 assert.equal(sent.response_format.type,'json_object');
 const system=sent.messages[0].content;
 for(const rule of [/BERURUTAN/,/Bahas HANYA intiAktif/,/Jangan melompat/,/menyederhanakan pecahan/,/pemrograman, LaTeX/,/DILARANG LaTeX/,/Jangan memberikan jawaban akhir/])assert.match(system,rule);
 const context=JSON.parse(sent.messages[1].content.replace('Konteks belajar: ',''));
 assert.deepEqual(context.intiAktif,{id:'tri-i',judul:'Identitas Dasar'});
 assert.deepEqual(context.daftarInti.map((c:any)=>c.nomor),[1,2]);
 assert.equal(reply.text,'Aku fokus ke soal ini dulu ya. Dari sin² x + cos² x = 1, cos²x berapa?');
 assert.deepEqual(reply.coreProgress,{active:'tri-i',done:[]});
 validateResponse('/v1/guide/messages','POST',200,reply);
 validateRequest('/v1/guide/messages','POST',{body:{questionText:'q',cores,done:['tri-i'],messages:[{from:'me',text:'hai'}]},query:{},headers:{}} as any);
});
test('finishing the active core moves to the next one; unknown done ids are ignored',async()=>{
 let context:any;
 const http=(content:unknown)=>(async(_u:unknown,o?:RequestInit)=>{context=JSON.parse(JSON.parse(String(o?.body)).messages[1].content.replace('Konteks belajar: ',''));return envelope(content);}) as typeof fetch;
 const first=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'cos²x = 7/16'}]},http({reply:'Tepat! Sekarang **Kuadran & Tanda**.',intiAktifSelesai:true}));
 assert.deepEqual(first.coreProgress,{active:'tri-g',done:['tri-i']});
 const second=await guideReply(null as any,config,{questionText:'q',cores,done:['tri-i','tri-x'],messages:[{from:'me',text:'negatif'}]},http({reply:'Mantap, tulis ulang langkahmu.',intiAktifSelesai:true}));
 assert.equal(context.intiAktif.id,'tri-g');assert.deepEqual(second.coreProgress,{active:null,done:['tri-i','tri-g']});
 const plain=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},answer('Halo, kita mulai dari identitas dasar ya.'));
 assert.equal(plain.text,'Halo, kita mulai dari identitas dasar ya.');assert.deepEqual(plain.coreProgress,{active:'tri-i',done:[]});
 const cut=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},answer('{"reply":"Kita mulai dari **Identitas Dasar**: cos²x berapa?","intiAktifSel'));
 assert.equal(cut.text,'Kita mulai dari **Identitas Dasar**: cos²x berapa?','a cut-off JSON reply still shows the text, never raw JSON');
 const noCores=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'hai'}]},answer({reply:'Halo',intiAktifSelesai:false}));
 assert.equal(noCores.coreProgress,undefined);
});
test('a busy or empty provider reply is retried once without JSON mode; two failures are 503',async()=>{
 const calls:any[]=[];
 const flaky=(async(_u:unknown,o?:RequestInit)=>{calls.push(JSON.parse(String(o?.body)));return calls.length===1?envelope(''):envelope('Kita mulai dari **Identitas Dasar** ya.');}) as typeof fetch;
 const ok=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},flaky);
 assert.equal(ok.text,'Kita mulai dari **Identitas Dasar** ya.');assert.equal(calls.length,2);assert.equal(calls[0].response_format.type,'json_object');assert.equal(calls[1].response_format,undefined);
 let n=0;await assert.rejects(guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},(async()=>{n++;return new Response('',{status:503});}) as typeof fetch),(e:any)=>e.status===503);assert.equal(n,2);
 n=0;await assert.rejects(guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'hai'}]},(async()=>{n++;return new Response('',{status:401});}) as typeof fetch),(e:any)=>e.status===503);assert.equal(n,1,'auth errors are not retried');
});
test('replies are written as short paragraphs: the prompt asks for them and extra blank lines are tidied',async()=>{
 let sent:any;
 const reply=await guideReply(null as any,config,{questionText:'sin x = 9/12, tan x = ?',cores,done:['tri-i'],messages:[{from:'me',text:'bingung'}]},(async(_u,o)=>{sent=JSON.parse(String(o?.body));return envelope({reply:'Iya, aku paham kamu bingung.  \n\n\n\nKita mulai dari **Kuadran & Tanda**.\n\nDi kuadran 2, cos bernilai positif atau negatif?',intiAktifSelesai:false});}) as typeof fetch);
 const system=sent.messages[0].content;
 assert.match(system,/2-3 paragraf pendek/);assert.match(system,/Jangan diajarkan ulang/);assert.match(system,/tenangkan dulu/);
 assert.equal(reply.text,'Iya, aku paham kamu bingung.\n\nKita mulai dari **Kuadran & Tanda**.\n\nDi kuadran 2, cos bernilai positif atau negatif?');
 assert.deepEqual(reply.coreProgress,{active:'tri-g',done:['tri-i']});
});
test('IntiGuide may attach one validated visual; invalid visuals are dropped and the text still arrives',async()=>{
 let sent:any;
 const http=(visual:unknown)=>(async(_u:unknown,o?:RequestInit)=>{sent=JSON.parse(String(o?.body));return envelope({reply:'Lihat segitiganya.',intiAktifSelesai:false,visual});}) as typeof fetch;
 const tri=await guideReply(null as any,config,{questionText:'tangga 10 m, sudut 30°',cores,messages:[{from:'me',text:'sisi depan yang mana?'}]},
  http({type:'segitiga-siku',sudut:30,label:{depan:'?',samping:'10 m',miring:'?'},sorot:'depan',caption:'Sisi depan berhadapan dengan sudut \\(30^\\circ\\)'}));
 assert.match(sent.messages[0].content,/"type":"segitiga-siku"/);assert.match(sent.messages[0].content,/DILARANG memuat jawaban akhir/);
 assert.deepEqual(tri.visual,{type:'segitiga-siku',sudut:30,label:{depan:'?',samping:'10 m',miring:'?'},sorot:'depan',caption:'Sisi depan berhadapan dengan sudut 30°'});
 validateResponse('/v1/guide/messages','POST',200,tri);
 const pola=await guideReply(null as any,config,{questionText:'pola 1,3,6,10',messages:[{from:'me',text:'?'}]},http({type:'pola',suku:[1,3,6,10,'?'],antara:'+2, +3, +4',noktah:'segitiga'}));
 assert.deepEqual(pola.visual,{type:'pola',suku:[1,3,6,10,'?'],antara:'+2, +3, +4',noktah:'segitiga'});validateResponse('/v1/guide/messages','POST',200,pola);
 const graf=await guideReply(null as any,config,{questionText:'grafik 2^x',messages:[{from:'me',text:'?'}]},http({type:'grafik',fungsi:{jenis:'eksponen',a:1,b:2,c:0},x:[-2,3],titik:[{x:0,label:'(0, 1)'}]}));
 assert.deepEqual(graf.visual,{type:'grafik',fungsi:{jenis:'eksponen',a:1,b:2,c:0},x:[-2,3],titik:[{x:0,label:'(0, 1)'}]});validateResponse('/v1/guide/messages','POST',200,graf);
 for(const bad of [
  {type:'segitiga-siku',sudut:90,label:{}},{type:'segitiga-siku',label:{depan:'?'}},
  {type:'pola',suku:[1]},{type:'pola',suku:['?','?']},
  {type:'grafik',fungsi:{jenis:'eksponen',a:1,b:1,c:0},x:[0,2]},{type:'grafik',fungsi:{jenis:'log',a:1,b:2,c:0},x:[1,2]},{type:'grafik',fungsi:{jenis:'linear',a:1,b:0,c:0},x:[3,1]},
  {type:'svg',d:'<script>'},'<svg/>',null,
 ]){const r=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'?'}]},http(bad));assert.equal(r.text,'Lihat segitiganya.');assert.equal(r.visual,undefined,JSON.stringify(bad));}
});
test('a visual with long but sensible labels is kept: only what does not fit is dropped (soal menara)',async()=>{
 const http=(visual:unknown)=>(async()=>envelope({reply:'Oke, aku bantu pakai gambar ya.',intiAktifSelesai:false,visual})) as typeof fetch;
 const menara=await guideReply(null as any,config,{questionText:'menara, sudut elevasi 30°',messages:[{from:'me',text:'Ga kebayang visualnya'}]},
  http({type:'segitiga-siku',sudut:30,label:{depan:'tinggi menara ?',samping:'jarak mendatar 50 m',miring:'garis pandang ke puncak menara yang panjang'},sorot:'depan',caption:'Sudut 30° ada di titik pandangmu; sisi depan adalah tinggi menara, sisi samping jarak mendatar ke kaki menara, sisi miring garis pandang'}));
 assert.ok(menara.visual,'visual kept');
 const v=menara.visual as any;
 assert.deepEqual(v.label,{depan:'tinggi menara ?',samping:'jarak mendatar 50 m'});
 assert.ok(v.caption.length<=90&&v.caption.endsWith('…'));
 validateResponse('/v1/guide/messages','POST',200,menara);
 const asString=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'?'}]},http(JSON.stringify({type:'pola',suku:[1,2,'?'],noktah:'lingkaran'})));
 assert.deepEqual(asString.visual,{type:'pola',suku:[1,2,'?']});
 const clamped=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'?'}]},http({type:'segitiga-siku',sudut:88,label:{}}));
 assert.equal((clamped.visual as any).sudut,85);
});
