import test from'node:test';import assert from'node:assert/strict';import sharp from'sharp';import{createHash}from'node:crypto';import{readFreeOcr,ocrConfiguration}from'../src/intake/openrouter-ocr.js';
test('free OCR transport: synthetic allowlist, free vision metadata, stripped image and no paid fallback',async()=>{
 const image=await sharp({create:{width:16,height:16,channels:3,background:'white'}}).png().toBuffer();const config={key:'synthetic-key',model:'test/vision:free',allowedImageSha256:createHash('sha256').update(image).digest('hex')};let calls=0;
 const http=(async(url,opts)=>{calls++;if(String(url).endsWith('/models'))return new Response(JSON.stringify({data:[{id:config.model,pricing:{prompt:'0',completion:'0'},architecture:{input_modalities:['text','image']}}]}));
 const body=JSON.parse(String(opts!.body));assert.equal(body.model,config.model);assert.equal(body.provider.allow_fallbacks,false);assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,image:0,request:0});assert.equal(body.provider.data_collection,'deny');assert.equal(body.provider.zdr,true);
 const data=body.messages[1].content[1].image_url.url;assert.ok(data.startsWith('data:image/png;base64,'));assert.ok(!(await sharp(Buffer.from(data.split(',')[1],'base64')).metadata()).exif);
 return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Soal sintetis: tinggi menara 20 m.'}}],usage:{cost:0}}));})as typeof fetch;
 assert.match((await readFreeOcr(image,config,http)).text,/sintetis/);assert.equal(calls,2);
 await assert.rejects(readFreeOcr(Buffer.from('other'),config,http),/SYNTHETIC/);assert.equal(calls,2);
 await assert.rejects(readFreeOcr(image,{...config,model:'paid/model'},http),/CONFIGURATION/);assert.equal(calls,2);
 let post=false;await assert.rejects(readFreeOcr(image,config,(async(_u,o)=>{if(o?.method==='POST')post=true;return new Response(JSON.stringify({data:[{id:config.model,pricing:{prompt:'1',completion:'0'},architecture:{input_modalities:['image']}}]}));})as typeof fetch),/FREE_VISION/);assert.equal(post,false);
 assert.equal(ocrConfiguration({}as NodeJS.ProcessEnv),null);
});
