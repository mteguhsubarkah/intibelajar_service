import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(resolve('../mockup/intibelajar/package.json'));
const {chromium,expect:e}=require('@playwright/test'),expect=e.configure({timeout:20000});
const dir=resolve('.local/local-dev/funnel-'+Date.now());mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({reducedMotion:'reduce'});
page.setDefaultTimeout(20000);const events=[];page.on('pageerror',err=>events.push(err.message));
try{
 await page.goto('http://localhost:5180/__local');await page.getByRole('button',{name:'Masuk sebagai Uji Lokal A',exact:true}).click();
 await page.locator('#formula').fill('sin 30 = 20/x');await page.locator('.diagnose-btn').click();await expect(page.locator('.r-filled')).toBeVisible();
 const id=await page.evaluate(()=>localStorage.getItem('intibelajar.loop.coba'));assert.ok(id);
 const view=async()=>(await page.request.get('http://localhost:5180/v1/learning-sessions/'+id)).json();
 await page.getByRole('button',{name:/Pelajari inti ini/}).first().click();
 await expect(page.locator('.materi')).toBeVisible();
 await page.locator('.materi').getByRole('button',{name:'Lanjut',exact:false}).click();
 await expect(page.locator('.seg-lab')).toContainText('Slide 2');
 assert.equal((await view()).state,'QUICK_CHECK');
 await page.reload();
 await expect(page.locator('.materi')).toBeVisible();
 await expect(page.locator('.seg-lab')).toContainText('Slide 2');
 await page.locator('.materi').getByRole('button',{name:'Tanya IntiBot tentang inti ini'}).click();
 await page.locator('#tutor-input').fill('Tuliskan kode game');await page.getByRole('button',{name:'Kirim',exact:true}).click();
 await expect(page.locator('.chat .bot').last()).toContainText('hanya membantu soal');
 await page.getByRole('button',{name:'Kasih petunjuk',exact:true}).last().click();
 await expect(page.locator('.chat .bot').last()).toContainText('Petunjuk 1');
 await page.keyboard.press('Escape');
 // Option content is deliberately selected through the visible lesson check, not an API shortcut.
 const choices=page.locator('.lesson-check button');
 await choices.first().click();
 await expect(page.locator('.materi').getByRole('button',{name:/Kerjakan ulang/})).toBeEnabled();
 await page.locator('.materi').getByRole('button',{name:/Kerjakan ulang/}).click();
 await expect.poll(async()=>(await view()).state).toBe('RETRY');
 await page.locator('#retry-ans').fill('tan 30 = 20/x, x = 20√3');
 await page.getByRole('button',{name:/Cek jawabanku/}).click();
 await expect.poll(async()=>(await view()).state).toBe('COMPLETED');
 await expect(page.locator('.tutup.solved')).toBeVisible();
 await page.screenshot({path:join(dir,'retry.png'),fullPage:true});
 assert.deepEqual(events,[],'No browser runtime errors');
 writeFileSync(join(dir,'summary.json'),JSON.stringify({ok:true,checks:['diagnosis','server lesson','quick check','strict tutor','server hint','return to retry','correct retry completes loop'],events},null,2));
 console.log('PASS browser D3/D6',dir);
}catch(err){await page.screenshot({path:join(dir,'failure.png'),fullPage:true});console.error('FAIL',err.message);console.error((await page.locator('body').innerText()).slice(-4500));writeFileSync(join(dir,'summary.json'),JSON.stringify({ok:false,error:err.message,events}));process.exitCode=1;}
finally{await browser.close();}
