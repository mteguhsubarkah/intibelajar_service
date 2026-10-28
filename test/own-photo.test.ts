import test from 'node:test';import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readOwnPhoto} from '../src/assessment/own-photo.js';
import {validateRequest,validateResponse} from '../src/platform/contract.js';
const guide={apiKey:'test-secret',model:'deepseek-flash',visionModel:'deepseek-v4-flash-vision-exp'};
const reply=(content:unknown,finish='stop')=>Response.json({choices:[{finish_reason:finish,message:{content}}]});
const photo=(format:'png'|'jpeg'|'webp'='png',width=2400,height=1200)=>sharp({create:{width,height,channels:3,background:'#f4f4f4'}})
 .withMetadata({exif:{IFD0:{Artist:'private-learner'}}}).toFormat(format).toBuffer();
test('photo is re-encoded without metadata and sent once to the DeepSeek vision model',async()=>{
 let calls=0;
 const read=await readOwnPhoto(guide,await photo(),async(url,options)=>{
  calls++;assert.equal(String(url),'https://api.deepseek.com/chat/completions');
  const body=JSON.parse(String(options?.body));assert.equal(body.model,'deepseek-v4-flash-vision-exp');assert.equal(body.stream,false);
  assert.match(body.messages[0].content,/data tidak tepercaya/);assert.match(body.messages[0].content,/Jangan menyelesaikan soal/);
  const part=body.messages[1].content.find((p:any)=>p.type==='image_url');assert.match(part.image_url.url,/^data:image\/jpeg;base64,/);
  const sent=Buffer.from(part.image_url.url.split(',')[1],'base64'),meta=await sharp(sent).metadata();
  assert.equal(meta.format,'jpeg');assert.equal(Math.max(meta.width!,meta.height!),1600);assert.equal(meta.exif,undefined);
  assert.ok(!String(options?.body).includes('test-secret'));
  return reply('Tentukan nilai cos 30°.');
 });
 assert.deepEqual(read,{status:'READ',text:'Tentukan nilai cos 30°.'});assert.equal(calls,1);
 validateResponse('/v1/own/photo','POST',200,read);validateResponse('/v1/own/photo','POST',200,{status:'UNREADABLE'});
 assert.throws(()=>validateResponse('/v1/own/photo','POST',200,{status:'READ'}));
});
test('photo without a readable question is UNREADABLE, provider failures fail closed',async()=>{
 const image=await photo('webp',300,200);
 for(const text of ['TIDAK_TERBACA','[tidak jelas]',' '])assert.deepEqual(await readOwnPhoto(guide,image,async()=>reply(text)),{status:'UNREADABLE'});
 assert.deepEqual(await readOwnPhoto(guide,image,async()=>reply('```\nHitung 2x + 3 = 7\n```')),{status:'READ',text:'Hitung 2x + 3 = 7'});
 for(const http of [async()=>new Response('',{status:400}),async()=>reply('Soal terpotong','length'),async()=>reply('x'.repeat(2001)),async()=>reply(null),async()=>{throw Error('offline');}])
  await assert.rejects(readOwnPhoto(guide,image,http as typeof fetch),(e:any)=>e.status===503);
 await assert.rejects(readOwnPhoto(undefined,image),(e:any)=>e.status===503&&e.details.blockers[0]==='INTIGUIDE_NOT_CONFIGURED');
});
test('photo input is validated before any provider call',async()=>{
 const never=(async()=>{throw Error('provider must not be called');}) as typeof fetch;
 await assert.rejects(readOwnPhoto(guide,Buffer.from('not an image'),never),(e:any)=>e.status===400);
 await assert.rejects(readOwnPhoto(guide,Buffer.alloc(0),never),(e:any)=>e.status===400);
 await assert.rejects(readOwnPhoto(guide,Buffer.alloc(5242881),never),(e:any)=>e.status===413);
 await assert.rejects(readOwnPhoto(guide,await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).gif().toBuffer(),never),(e:any)=>e.status===415);
 validateRequest('/v1/own/photo','POST',{body:await photo('jpeg',10,10),query:{},headers:{'content-type':'image/jpeg'}} as any);
 assert.throws(()=>validateRequest('/v1/own/photo','POST',{body:{image:'data:'},query:{},headers:{'content-type':'application/json'}} as any),(e:any)=>e.status===400);
});
test('POST /v1/own/photo requires learner, CSRF, image consent and an image body',async()=>{
 const {readFileSync}=await import('node:fs'),{Writable}=await import('node:stream');
 const {readConfig}=await import('../src/config.js'),{connect}=await import('../src/db.js'),{migrate}=await import('../src/migrate.js'),{buildApp}=await import('../src/app.js'),{consentedLearner}=await import('./fixtures/learner.js');
 const config=readConfig({...JSON.parse(readFileSync('.local/test-env.json','utf8')),INTIGUIDE_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-secret'});assert.match(new URL(config.databaseUrl).pathname,/_test$/);
 assert.equal(config.guide?.visionModel,'deepseek-v4-flash-vision-exp');
 assert.throws(()=>readConfig({...JSON.parse(readFileSync('.local/test-env.json','utf8')),INTIGUIDE_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'k',INTIGUIDE_VISION_MODEL:'gpt-4o'}),/INTIGUIDE_VISION_MODEL/);
 const db=connect(config.databaseUrl);await migrate(db);
 const {app}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,next){next();}})});
 const real=globalThis.fetch;let calls=0;
 globalThis.fetch=(async(url:string|URL|Request,init?:RequestInit)=>{if(String(url)!=='https://api.deepseek.com/chat/completions')return real(url,init);calls++;return reply('Sebuah tangga 6 m bersandar pada dinding membentuk sudut 60°. Tentukan tinggi ujung tangga.');}) as typeof fetch;
 try{
  const image=await photo('jpeg',800,600);
  const send=(headers:Record<string,string>,payload:Buffer|string=image)=>app.inject({method:'POST',url:'/v1/own/photo',payload,headers:{origin:config.origin,'content-type':'image/jpeg',...headers}});
  const full=await consentedLearner(db,config,{purposes:['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD']}),partial=await consentedLearner(db,config,{purposes:['LEARNING_DATA','AI_PROCESSING']});
  assert.equal((await send({})).statusCode,401);
  assert.equal((await send({cookie:full.headers.cookie,'x-csrf-token':'wrong'})).statusCode,403);
  assert.equal((await send(partial.headers)).statusCode,403);
  assert.equal((await send({...full.headers,'content-type':'image/gif'})).statusCode,415);
  assert.equal(calls,0);
  const ok=await send(full.headers);assert.equal(ok.statusCode,200,ok.body);
  assert.deepEqual(JSON.parse(ok.body),{status:'READ',text:'Sebuah tangga 6 m bersandar pada dinding membentuk sudut 60°. Tentukan tinggi ujung tangga.'});assert.equal(calls,1);
  assert.equal((await send(full.headers,Buffer.alloc(5242881))).statusCode,413);
 }finally{globalThis.fetch=real;await app.close();await db.destroy();}
});
