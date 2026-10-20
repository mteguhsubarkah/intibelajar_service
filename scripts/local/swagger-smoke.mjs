import {createRequire}from'node:module';
import {resolve,join}from'node:path';
import {mkdirSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
const require=createRequire(resolve('../mockup/intibelajar/package.json'));
const{chromium,expect}=require('@playwright/test');
const out=resolve('docs/backend-implementation/evidence/swagger-google-2026-10-20');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[],external=[],frontendExternal=[];let swaggerScope=false;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!new URL(r.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))(swaggerScope?external:frontendExternal).push(r.url());});
 await page.goto('http://localhost:5180/__local');await page.getByRole('button',{name:'Masuk sebagai Uji Lokal A',exact:true}).click();
 swaggerScope=true;await page.goto('http://localhost:5180/docs');await expect(page.locator('.swagger-ui .info .title')).toBeVisible();
 const op=page.locator('.opblock-get').filter({has:page.locator('.opblock-summary-path[data-path="/v1/auth/session"]')});
 await op.locator('.opblock-summary').click();await op.getByRole('button',{name:'Try it out',exact:true}).click();
 await op.getByRole('button',{name:'Execute',exact:true}).click();await expect(op.locator('.responses-wrapper .response-col_status').last()).toContainText('200');
 const guarded=await page.evaluate(async()=>{
  const intercept=window.ui.getConfigs().requestInterceptor;
  const r=await intercept({url:'/v1/auth/logout',method:'POST',headers:{}});
  let denied=false;try{await intercept({url:'https://example.invalid/v1/auth/logout',method:'POST',headers:{}});}catch{denied=true;}
  return{csrf:typeof r.headers['X-CSRF-Token']==='string'&&r.headers['X-CSRF-Token'].length>20,denied};
 });assert.deepEqual(guarded,{csrf:true,denied:true});
 await page.screenshot({path:join(out,'swagger.png'),fullPage:false});
 swaggerScope=false;await page.goto('http://localhost:5180/auth/email');
 const response=page.waitForResponse(r=>r.url().endsWith('/v1/auth/start'));
 await page.getByRole('button',{name:'Lanjutkan dengan Google · akun uji',exact:true}).click();
 assert.equal((await response).status(),503);await expect(page.getByRole('alert')).toBeVisible();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(join(out,'browser.json'),JSON.stringify({ok:true,checks:['Swagger renders locally','Try it out returns session through same-origin proxy','automatic CSRF','reject external target','Google button shows unconfigured blocker'],errors,external,frontendExternal,note:'Existing frontend Google Fonts requests are recorded separately; Swagger itself uses local assets only.'},null,2));
 console.log('PASS Swagger browser and Google unconfigured UI');
}finally{await browser.close();}
