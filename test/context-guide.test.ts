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
  {type:'lingkaran',r:2},
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
test('a visual written INSIDE the reply text is pulled out: no raw JSON for the student, the picture still shows',async()=>{
 const raw='Oke, aku bantu gambar. Lihat segitiga di bawah, ya.\n\nSisi miring 13, salah satu sisi tegak 5.\n\n{"type":"segitiga-siku","sudut":30,"label":{"depan":"5","samping":"?","miring":"13"},"sorot":"samping","caption":"Cari sisi tegak lainnya dengan Pythagoras"}\n\nJadi berapa hasil √(169 − 25)?';
 for(const content of [{reply:raw,intiAktifSelesai:false},raw]){
  const r=await guideReply(null as any,config,{questionText:'menara',messages:[{from:'me',text:'Ga kebayang segitiganya'}]},(async()=>envelope(content)) as typeof fetch);
  assert.ok(!r.text.includes('{')&&!r.text.includes('"type"'),r.text);
  assert.match(r.text,/Jadi berapa hasil/);
  assert.deepEqual(r.visual,{type:'segitiga-siku',sudut:30,label:{depan:'5',samping:'?',miring:'13'},sorot:'samping',caption:'Cari sisi tegak lainnya dengan Pythagoras'});
 }
 const wrapped=await guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'?'}]},(async()=>envelope({reply:'Lihat ini.\n\nvisual: ```json\n{"type":"pola","suku":[1,3,"?"]}\n```\n\nBerapa suku ketiga?'})) as typeof fetch);
 assert.equal(wrapped.text,'Lihat ini.\n\nBerapa suku ketiga?');assert.deepEqual(wrapped.visual,{type:'pola',suku:[1,3,'?']});
});
test('grading the mini question: the model checks first (cek) and sees its earlier picture in the history',async()=>{
 let sent:any;
 const history=[{from:'bot' as const,text:'[Gambar: segitiga siku-siku, sudut 30° di kiri bawah, siku-siku di kanan bawah; dilihat dari sudut 30°: depan = tinggi menara 20 m; samping = jarak mendatar ?; miring = garis pandang; disorot: depan]\n\nSisi menara yang 20 m itu berdiri di hadapan sudut, atau bersebelahan?'},{from:'me' as const,text:'Hadapan'}];
 const reply=await guideReply(null as any,config,{questionText:'menara 20 m, sudut depresi 30°',cores,messages:history},(async(_u:unknown,o?:RequestInit)=>{sent=JSON.parse(String(o?.body));
  return envelope({cek:{pertanyaanMini:'menara berhadapan atau bersebelahan dengan sudut?',jawabanSiswa:'Hadapan',yangBenar:'berhadapan (sisi depan)',siswaBenar:true},reply:'Tepat! Tinggi menara itu **sisi depan**.\n\nSekarang **Kuadran & Tanda**: ...'});}) as typeof fetch);
 const system=sent.messages[0].content;
 for(const rule of [/SEBELUM menulis reply, isi "cek"/,/\[Gambar: \.\.\.\]/,/sisi depan = sisi yang berhadapan/,/tinggi menara\/gedung = sisi depan/,/"hadapan"/,/"cek" tidak ditampilkan/])assert.match(system,rule);
 assert.match(sent.messages.at(-2).content,/\[Gambar: segitiga siku-siku/,'the picture description reaches the model');
 assert.deepEqual(reply.coreProgress,{active:'tri-g',done:['tri-i']},'cek.siswaBenar finishes the core when intiAktifSelesai is missing');
 assert.ok(!reply.text.includes('cek')&&!reply.text.includes('siswaBenar'));
 validateRequest('/v1/guide/messages','POST',{body:{questionText:'q',cores,messages:history},query:{},headers:{}} as any);
});
test('the right angle itself: sudut 90 or no angle gives a generic triangle with the right angle highlighted',async()=>{
 const http=(visual:unknown)=>(async()=>envelope({reply:'Siap, aku kasih gambar biar kebayang.',visual})) as typeof fetch;
 const ask=(v:unknown)=>guideReply(null as any,config,{questionText:'q',messages:[{from:'me',text:'Aduh ga kebayang visualnya'}]},http(v));
 assert.deepEqual((await ask({type:'segitiga-siku',sudut:90,label:{miring:'paling panjang'}})).visual,{type:'segitiga-siku',label:{miring:'paling panjang'},sorot:'siku'});
 assert.deepEqual((await ask({type:'segitiga',label:{},sorot:'siku',caption:'Pojok siku-siku'})).visual,{type:'segitiga-siku',label:{},sorot:'siku',caption:'Pojok siku-siku'});
 const r=await ask({type:'segitiga-siku',label:{depan:'?'}});assert.deepEqual(r.visual,{type:'segitiga-siku',label:{depan:'?'}});validateResponse('/v1/guide/messages','POST',200,r);
});
test('a correct mini answer finishes the core even when the model wants to keep asking about it',async()=>{
 const r=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'bot',text:'Sisi mana yang disebut sisi samping?'},{from:'me',text:'Sisi bawah garid pandang pengamat'}]},
  (async()=>envelope({cek:{pertanyaanMini:'sisi samping yang mana?',jawabanSiswa:'sisi bawah',yangBenar:'jarak mendatar',siswaBenar:true},reply:'Bagus, arahnya sudah benar!',intiAktifSelesai:false})) as typeof fetch);
 assert.deepEqual(r.coreProgress,{active:'tri-g',done:['tri-i']});
 const wrong=await guideReply(null as any,config,{questionText:'q',cores,messages:[{from:'me',text:'miring'}]},(async()=>envelope({cek:{siswaBenar:false},reply:'Coba lagi.',intiAktifSelesai:false})) as typeof fetch);
 assert.deepEqual(wrong.coreProgress,{active:'tri-i',done:[]});
});
test('the model lists every passed core (intiTuntas); the picture note from the history never reaches the student',async()=>{
 const three=[{id:'tri-c',title:'Segitiga Siku-siku'},{id:'tri-d',title:'Definisi sin, cos, tan'},{id:'tri-f',title:'Sudut Istimewa'}];
 let sent:any;
 const r=await guideReply(null as any,config,{questionText:'menara',cores:three,done:['tri-c'],messages:[{from:'bot',text:'[Gambar: segitiga siku-siku, sudut 30°]\n\nPerbandingan apa yang cocok?'},{from:'me',text:'Tan'}]},
  (async(_u:unknown,o?:RequestInit)=>{sent=JSON.parse(String(o?.body));return envelope({cek:{siswaBenar:null},reply:'[Gambar: segitiga siku-siku, sudut 30° di kiri bawah; depan = 20 m; samping = ?]\n\nBetul! tan = depan/samping.\n\nLanjut ke inti terakhir, **Sudut Istimewa**. Berapa nilai tan 30°?',intiAktifSelesai:false,intiTuntas:['tri-c','tri-d','tri-zz']});}) as typeof fetch);
 assert.match(sent.messages[0].content,/"intiTuntas"/);assert.match(sent.messages[0].content,/JANGAN pernah menulisnya di reply/);
 assert.ok(!r.text.includes('[Gambar'),r.text);assert.match(r.text,/^Betul!/);
 assert.deepEqual(r.coreProgress,{active:'tri-f',done:['tri-c','tri-d']},'model list counts; unknown ids ignored');
 const keep=await guideReply(null as any,config,{questionText:'q',cores:three,done:['tri-c','tri-d'],messages:[{from:'me',text:'?'}]},(async()=>envelope({reply:'Ok',intiTuntas:[]})) as typeof fetch);
 assert.deepEqual(keep.coreProgress,{active:'tri-f',done:['tri-c','tri-d']},'never un-ticks');
});
