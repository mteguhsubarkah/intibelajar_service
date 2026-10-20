// Explicit live smoke: submitting one allowlisted synthetic answer; worker may retry up to its bounded limit.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(resolve('../mockup/intibelajar/package.json'));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://localhost:5180/__local');
 await page.getByRole('button',{name:'Masuk sebagai Uji AI Sintetis',exact:true}).click();
 await page.locator('#formula').fill('Saya memilih sinus karena saya mengira jarak mendatar adalah sisi miring.');
 await page.locator('.diagnose-btn').click();
 let run;
 await expect.poll(async()=>{
  const id=await page.evaluate(()=>localStorage.getItem('intibelajar.loop.coba'));
  if(!id)return 'WAITING';
  const loop=await (await page.request.get('http://localhost:5180/v1/learning-sessions/'+id)).json();
  if(!loop.activeDiagnosisRunId)return 'WAITING';
  run=await (await page.request.get('http://localhost:5180/v1/diagnosis-runs/'+loop.activeDiagnosisRunId)).json();
  return run.status;
 },{timeout:150000,intervals:[2000]}).toBe('COMPLETED');
 assert.equal(run.engine,'AI_ASSISTED');
 const result={ok:true,engine:run.engine,status:run.status,verdict:run.verdict,evidenceStatus:run.evidenceStatus,date:new Date().toISOString()};
 writeFileSync('.local/local-dev/deepseek-smoke-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
