import{createRequire}from'node:module';import{resolve,join}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const require=createRequire(resolve('../mockup/intibelajar/package.json')),{chromium,expect:e}=require('@playwright/test'),expect=e.configure({timeout:20000});
const out=resolve('docs/backend-implementation/evidence/connections-2026-10-20');mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(20000);const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/v1/'))calls.push({method:r.method(),path:new URL(r.url()).pathname});});
try{
 await page.goto('http://localhost:5180/__local');await page.getByRole('button',{name:'Masuk sebagai Uji Lokal A',exact:true}).click();
 await page.locator('#formula').fill('sin 30 = 20/x');await page.locator('.diagnose-btn').click();await expect(page.locator('.r-filled')).toBeVisible();
 await page.getByRole('button',{name:'Hasil keliru? Laporkan',exact:false}).click();await expect(page.getByText('Laporan tersimpan di server.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Laporan tersimpan di server.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tanya IntiBot',exact:true}).click();await page.locator('#tutor-input').fill('Hubungkan soal dengan inti');await page.getByRole('button',{name:'Kirim',exact:true}).click();await expect(page.locator('.chat .bot').last()).not.toBeEmpty();
 await expect.poll(()=>calls.some(c=>c.method==='POST'&&c.path.startsWith('/v1/tutor-conversations/')&&c.path.endsWith('/messages'))).toBe(true);
 await page.keyboard.press('Escape');await page.goto('http://localhost:5180/home');await expect(page.getByText('Uji Lokal A',{exact:false}).first()).toBeVisible();
 const before=await(await page.request.get('http://localhost:5180/v1/me/stats')).json();assert.ok(Number.isInteger(before.xpTotal));
 await page.screenshot({path:join(out,'home.png'),fullPage:false});
 await page.evaluate(()=>localStorage.setItem('intibelajar:learning-session:v1',JSON.stringify({id:crypto.randomUUID(),questionId:'soal-menara',stage:'retry',events:[],workingRaw:'contoh buatan jangan diimpor tanpa checkbox',selectedAnswerRaw:null})));
 await page.goto('http://localhost:5180/account/consent');
 const [request]=await Promise.all([page.waitForRequest(r=>r.url().endsWith('/v1/me/device-imports')),page.getByRole('button',{name:'Impor riwayat perangkat',exact:true}).click()]);
 const body=request.postDataJSON();assert.equal(body.includeAnswerText,false);assert.equal(body.answerText,undefined);
 await expect(page.locator('#retry-ans')).toBeVisible();const after=await(await page.request.get('http://localhost:5180/v1/me/stats')).json();assert.equal(after.xpTotal,before.xpTotal);
 assert.deepEqual(errors,[]);writeFileSync(join(out,'browser.json'),JSON.stringify({ok:true,checks:['report persists after refresh','canonical conversation tutor','Home uses account progress','import UI explicit opt-in','import creates no XP','no browser runtime errors'],errors,calls},null,2));console.log('PASS browser connections');
}catch(error){await page.screenshot({path:join(out,'browser-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-2000));throw error;}finally{await browser.close();}
