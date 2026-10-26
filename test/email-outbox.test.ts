import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {sql} from 'kysely';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {buildApp} from '../src/app.js';
import {hash} from '../src/platform/crypto.js';
import {emailTick} from '../src/identity/email-outbox.js';
import {EmailSendError,resendTransport,type EmailTransport,type SigninMail} from '../src/identity/email-transport.js';

/*
 * Email masuk lewat outbox (migrasi 0010). Tidak ada email sungguhan: worker diberi transport palsu, dan adapter
 * Resend diuji dengan fetch palsu. Yang dibuktikan: request hanya mengantrekan (dalam transaksi login), worker
 * mengirim tepat sekali dengan Idempotency-Key tetap, gagal sementara dicoba lagi, gagal permanen/kedaluwarsa/habis
 * percobaan berhenti dan isinya dihapus, lease yang hilang dipulihkan dan dipagari, dua worker tidak mengirim dobel,
 * token ada di fragment, dan alamat/token tidak pernah tampak di log atau tersimpan terbuka.
 */
test('email sign-in outbox',async t=>{
  const base=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));
  const config=readConfig({...base,SYNTHETIC_FIXTURES:'true',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'re_test_key',EMAIL_FROM:'IntiBelajar <masuk@example.com>'});
  assert.match(new URL(config.databaseUrl).pathname,/_test$/,'Tests require a dedicated *_test database');
  const db=connect(config.databaseUrl);
  await migrate(db);
  let log='';
  const {app,mailbox}=await buildApp(config,{db,logStream:new Writable({write(chunk,_e,done){log+=String(chunk);done();}})});

  // Fake transport: records every send; per-address behaviour decides success or failure.
  const calls:SigninMail[]=[];
  const behaviour=new Map<string,(nth:number,mail:SigninMail)=>Promise<void>|void>();
  const transport:EmailTransport={async send(mail){calls.push(mail);await behaviour.get(mail.to)?.(calls.filter(c=>c.to===mail.to).length,mail);}};
  const sentTo=(to:string)=>calls.filter(c=>c.to===to);
  const tick=(tr:EmailTransport|null=transport)=>emailTick(db,config,tr);

  const stamp=Date.now().toString(36);let n=0;
  const address=()=>`learner.${stamp}.${++n}@example.com`;
  const cookieOf=(r:{headers:Record<string,unknown>})=>String(r.headers['set-cookie']).split(';')[0]!;
  const post=(url:string,payload:unknown,cookie?:string)=>app.inject({method:'POST',url,payload:JSON.stringify(payload),
    headers:{origin:config.origin,'content-type':'application/json',...(cookie?{cookie}:{})}});
  const start=async()=>{
    const r=await post('/v1/auth/start',{provider:'email',continuation:{targetPath:'/home',step:0}});
    assert.equal(r.statusCode,200,r.body);
    return {pre:cookieOf(r),transaction:new URL(r.json().redirectUrl).searchParams.get('transaction')!};
  };
  const request=async(email:string)=>{
    const s=await start();
    const r=await post('/v1/auth/email/links',{email,transaction:s.transaction},s.pre);
    assert.equal(r.statusCode,202,r.body);
    return s;
  };
  interface Row {id:string;auth_transaction_id:string;delivery_key:string;payload_ciphertext:Buffer|null;status:string;attempts:number;max_attempts:number;
    available_at:Date;expires_at:Date;sent_at:Date|null;last_error_code:string|null;lease_token:string|null}
  const rowOf=async(transaction:string)=>(await sql<Row>`select o.* from email_outbox o join auth_transaction t on t.id=o.auth_transaction_id
    where t.state_hash=${hash(transaction)}`.execute(db)).rows[0];
  const due=(id:string)=>sql`update email_outbox set available_at=now() where id=${id}`.execute(db);
  const count=async()=>Number((await sql<{c:string}>`select count(*) c from email_outbox`.execute(db)).rows[0]!.c);
  const tokenOf=(mail:SigninMail)=>{
    const url=new URL(mail.url);
    assert.equal(url.origin+url.pathname,config.origin+'/auth/email');
    assert.equal(url.search,'','the token is never in the query string');
    return new URLSearchParams(url.hash.slice(1)).get('token')!;
  };
  const verify=(pre:string,token:string)=>post('/v1/auth/email/verify',{token},pre);
  const tokens:string[]=[],addresses:string[]=[];

  try {
    await t.test('the request only queues, in the login transaction; the worker sends once with a fixed Idempotency-Key',async()=>{
      const to=address();addresses.push(to);
      const {pre,transaction}=await request(to);
      const row=(await rowOf(transaction))!;
      assert.ok(row,'queued');
      assert.deepEqual([row.status,row.attempts,row.sent_at],['QUEUED',0,null]);
      assert.equal(row.delivery_key,'signin/'+row.auth_transaction_id);
      const tx=(await sql<{expires_at:Date}>`select expires_at from auth_transaction where id=${row.auth_transaction_id}`.execute(db)).rows[0]!;
      assert.equal(row.expires_at.getTime(),tx.expires_at.getTime(),'the email expires with its link');
      assert.equal(row.payload_ciphertext!.includes(Buffer.from(to)),false,'address is stored encrypted');
      assert.equal(sentTo(to).length,0,'nothing is sent by the request');
      assert.equal(mailbox.get(to),undefined,'a real address never reaches the synthetic mailbox');

      await tick();
      assert.equal(sentTo(to).length,1);
      const mail=sentTo(to)[0]!;
      assert.equal(mail.deliveryKey,row.delivery_key);
      const token=tokenOf(mail);tokens.push(token);
      assert.equal(row.payload_ciphertext!.includes(Buffer.from(token)),false,'token is stored encrypted');
      const done=(await rowOf(transaction))!;
      assert.deepEqual([done.status,done.attempts,done.payload_ciphertext,done.lease_token],['SENT',1,null,null]);
      assert.ok(done.sent_at);

      await tick();
      assert.equal(sentTo(to).length,1,'a sent email is not sent again');
      // The same transaction asked again: still one link, one row, one email (a new link needs a new login transaction).
      assert.equal((await post('/v1/auth/email/links',{email:to,transaction},pre)).statusCode,202);
      await tick();
      assert.equal(sentTo(to).length,1);
      assert.equal((await verify(pre,token)).statusCode,200);
    });

    await t.test('unknown transactions and synthetic addresses add nothing to the outbox (202 either way)',async()=>{
      const before=await count();
      const s=await start();
      assert.equal((await post('/v1/auth/email/links',{email:address(),transaction:'x'.repeat(43)},s.pre)).statusCode,202);
      const invalid=`sintetis.${stamp}@contoh.invalid`;
      assert.equal((await post('/v1/auth/email/links',{email:invalid,transaction:s.transaction},s.pre)).statusCode,202);
      assert.ok(mailbox.get(invalid),'.invalid goes to the synthetic mailbox');
      assert.equal(await count(),before);
    });

    await t.test('a provider outage is retried later with the same key and link, then the link works',async()=>{
      const to=address();addresses.push(to);
      behaviour.set(to,nth=>{if(nth<=2)throw new EmailSendError('PROVIDER_UNAVAILABLE',false);});
      const {pre,transaction}=await request(to);
      const first=await tick();
      assert.ok(first.retrying>=1);
      let row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.attempts,row.last_error_code,row.lease_token],['QUEUED',1,'PROVIDER_UNAVAILABLE',null]);
      assert.ok(row.payload_ciphertext,'kept for the retry');
      assert.ok(row.available_at.getTime()>Date.now(),'backs off before retrying');
      await tick();
      assert.equal(sentTo(to).length,1,'not retried before it is due');
      await due(row.id);await tick();
      row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.attempts],['QUEUED',2]);
      await due(row.id);await tick();
      row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.attempts,row.payload_ciphertext],['SENT',3,null]);
      const mails=sentTo(to);
      assert.equal(mails.length,3);
      assert.equal(new Set(mails.map(m=>m.deliveryKey)).size,1,'one Idempotency-Key for every attempt');
      assert.equal(new Set(mails.map(m=>m.url)).size,1,'the same link every attempt');
      tokens.push(tokenOf(mails[0]!));
      assert.equal((await verify(pre,tokenOf(mails[0]!))).statusCode,200);
    });

    await t.test('a permanent rejection fails at once, drops the payload and is not retried',async()=>{
      const to=address();addresses.push(to);
      behaviour.set(to,()=>{throw new EmailSendError('PROVIDER_REJECTED',true);});
      const {transaction}=await request(to);
      await tick();
      const row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.attempts,row.payload_ciphertext,row.last_error_code],['FAILED',1,null,'PROVIDER_REJECTED']);
      await due(row.id);await tick();
      assert.equal(sentTo(to).length,1);
    });

    await t.test('retries stop at max_attempts',async()=>{
      const to=address();addresses.push(to);
      behaviour.set(to,()=>{throw new Error('socket hang up');});
      const {transaction}=await request(to);
      const id=(await rowOf(transaction))!.id;
      await sql`update email_outbox set max_attempts=2 where id=${id}`.execute(db);
      await tick();await due(id);await tick();await due(id);await tick();
      const row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.attempts,row.payload_ciphertext,row.last_error_code],['FAILED',2,null,'TRANSPORT_ERROR']);
      assert.equal(sentTo(to).length,2);
    });

    await t.test('an expired link is never sent, even without a configured transport',async()=>{
      const to=address();addresses.push(to);
      const {transaction}=await request(to);
      const id=(await rowOf(transaction))!.id;
      await sql`update email_outbox set expires_at=now()-interval '1 second' where id=${id}`.execute(db);
      await tick(null);
      const row=(await rowOf(transaction))!;
      assert.deepEqual([row.status,row.payload_ciphertext,row.last_error_code],['EXPIRED',null,'LINK_EXPIRED']);
      await tick();
      assert.equal(sentTo(to).length,0);
    });

    await t.test('a lost lease is recovered; the resend reuses the key and the stale worker cannot overwrite the result',async()=>{
      const to=address();addresses.push(to);
      const {transaction}=await request(to);
      const id=(await rowOf(transaction))!.id;
      const second:SigninMail[]=[];
      let stale:string|null=null;
      behaviour.set(to,async nth=>{
        if(nth!==1)return;
        // While the first worker is still "sending", its lease runs out and another worker takes over and finishes.
        stale=(await sql<{lease_token:string}>`select lease_token from email_outbox where id=${id}`.execute(db)).rows[0]!.lease_token;
        await sql`update email_outbox set lease_until=now()-interval '1 second' where id=${id}`.execute(db);
        await emailTick(db,config,{async send(mail){second.push(mail);}});
        throw new EmailSendError('PROVIDER_UNAVAILABLE',false);
      });
      await tick();
      const row=(await rowOf(transaction))!;
      assert.ok(stale);
      assert.deepEqual([row.status,row.attempts,row.lease_token],['SENT',2,null],'the late failure of the stale worker is fenced out');
      assert.equal(second.length,1);
      assert.equal(second[0]!.deliveryKey,sentTo(to)[0]!.deliveryKey,'the provider sees one Idempotency-Key, so it sends once');
    });

    await t.test('two workers at the same time send each email exactly once',async()=>{
      const batch=[address(),address(),address()];addresses.push(...batch);
      for(const to of batch){behaviour.set(to,()=>new Promise(r=>setTimeout(r,50)));await request(to);}
      await Promise.all([tick(),tick(),tick()]);
      for(const to of batch)assert.equal(sentTo(to).length,1,to);
    });

    await t.test('a worker skips an email another worker holds, instead of waiting and sending it again',async()=>{
      const to=address();addresses.push(to);
      const {transaction}=await request(to);
      const id=(await rowOf(transaction))!.id;
      let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
      let locked!:()=>void;const taken=new Promise<void>(r=>{locked=r;});
      const holder=db.transaction().execute(async tx=>{await sql`select id from email_outbox where id=${id} for update`.execute(tx);locked();await held;});
      await taken;
      let outcome:unknown;
      try { outcome=await Promise.race([tick().then(()=>'done'),new Promise(r=>setTimeout(()=>r('blocked'),3000))]); }
      finally { release();await holder; }
      assert.equal(outcome,'done','the tick does not wait for a row another worker has locked');
      assert.equal(sentTo(to).length,0);
      await tick();
      assert.equal(sentTo(to).length,1);
    });

    await t.test('the emailed link is single-use and bound to the browser that asked',async()=>{
      const to=address();addresses.push(to);
      const {pre}=await request(to);
      await tick();
      const token=tokenOf(sentTo(to)[0]!);tokens.push(token);
      const other=await start();
      assert.equal((await verify(other.pre,token)).statusCode,410,'another browser');
      assert.equal((await verify(pre,token)).statusCode,200);
      assert.equal((await verify(pre,token)).statusCode,410,'replay');
    });

    await t.test('no address or token in the API log',()=>{
      assert.ok(log.length>0);
      for(const value of [...addresses,...tokens])assert.equal(log.includes(value),false);
    });
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Resend adapter: fixed endpoint, Idempotency-Key, fragment link, error classes without data',async()=>{
  const sender={provider:'resend' as const,apiKey:'re_test_key',from:'IntiBelajar <masuk@example.com>'};
  const origin='https://intibelajar.example';
  const mail={to:'learner@example.com',url:origin+'/auth/email#token='+'a'.repeat(43),deliveryKey:'signin/0190f000-0000-7000-8000-000000000001'};
  const requests:{url:string;init:RequestInit}[]=[];
  const http=(status:number|Error)=>(async(url:string|URL|Request,init?:RequestInit)=>{
    requests.push({url:String(url),init:init!});
    if(status instanceof Error)throw status;
    return new Response(JSON.stringify({id:'x',echo:mail.to}),{status});
  }) as typeof fetch;

  await resendTransport(sender,origin,http(200)).send(mail);
  const {url,init}=requests[0]!;
  const headers=new Headers(init.headers);
  assert.equal(url,'https://api.resend.com/emails');
  assert.deepEqual([init.method,init.redirect],['POST','error']);
  assert.deepEqual([headers.get('authorization'),headers.get('idempotency-key'),headers.get('content-type')],['Bearer re_test_key',mail.deliveryKey,'application/json']);
  const body=JSON.parse(String(init.body));
  assert.deepEqual([body.from,body.to,body.subject],[sender.from,[mail.to],'Tautan masuk IntiBelajar']);
  assert.ok(body.text.includes(mail.url));
  assert.ok(body.html.includes('href="'+mail.url+'"'));
  assert.equal(JSON.stringify(body).includes('re_test_key'),false);

  const classify=async(status:number|Error)=>{
    try{await resendTransport(sender,origin,http(status)).send(mail);return 'ok';}
    catch(e){assert.ok(e instanceof EmailSendError);assert.equal(e.message.includes(mail.to)||e.message.includes('aaaa'),false);return `${e.code}:${e.permanent}`;}
  };
  assert.deepEqual(await Promise.all([202,429,409,408,500,503,422,403,new Error('connect '+mail.to)].map(classify)),[
    'ok','PROVIDER_RATE_LIMITED:false','PROVIDER_BUSY:false','PROVIDER_BUSY:false','PROVIDER_UNAVAILABLE:false','PROVIDER_UNAVAILABLE:false',
    'PROVIDER_REJECTED:true','PROVIDER_REJECTED:true','PROVIDER_UNREACHABLE:false']);

  requests.length=0;
  const bad=[{url:origin+'/auth/email?token='+'a'.repeat(43)},{url:origin+'/auth/email?next=%2Fhome#token='+'a'.repeat(43)},{url:'https://evil.example/auth/email#token='+'a'.repeat(43)},{url:origin+'/elsewhere#token='+'a'.repeat(43)},
    {to:'learner@contoh.invalid'},{to:'a@example.com\r\nBcc: b@example.com'},{deliveryKey:'signin/../x'},{url:'not a url'}];
  for(const change of bad)await assert.rejects(resendTransport(sender,origin,http(200)).send({...mail,...change}),
    (e:unknown)=>e instanceof EmailSendError&&e.code==='EMAIL_INPUT_INVALID'&&e.permanent,JSON.stringify(change));
  assert.equal(requests.length,0,'invalid input never reaches the provider');

  // EMAIL_FROM with a line break is refused; the same configuration with a clean sender is accepted.
  const base=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));
  const email={EMAIL_PROVIDER:'resend',RESEND_API_KEY:'re_x'};
  assert.equal(readConfig({...base,...email,EMAIL_FROM:'IntiBelajar <masuk@example.com>'}).email?.from,'IntiBelajar <masuk@example.com>');
  assert.throws(()=>readConfig({...base,...email,EMAIL_FROM:'IntiBelajar\r\nBcc: x@example.com <masuk@example.com>'}));
});
