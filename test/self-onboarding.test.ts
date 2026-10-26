import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {buildApp} from '../src/app.js';
import {validateResponse} from '../src/platform/contract.js';
import {emailTick} from '../src/identity/email-outbox.js';
import {resendTransport} from '../src/identity/email-transport.js';

/*
 * Onboarding mandiri (SELF_ONBOARDING_CONSENT=true) dan email masuk sungguhan (Resend).
 * Resend tidak dihubungi: fetch ke api.resend.com diganti tiruan yang mencatat kirimannya. Email nyata lewat outbox:
 * request login hanya mengantrekan; tick worker (emailTick) yang mengirim.
 */
test('self onboarding consent and real email sign-in',async t=>{
  const base=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));
  const env={...base,SYNTHETIC_FIXTURES:'true',SELF_ONBOARDING_CONSENT:'true',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'re_test_key',EMAIL_FROM:'IntiBelajar <masuk@example.com>'};
  const config=readConfig(env);
  assert.match(new URL(config.databaseUrl).pathname,/_test$/,'Tests require a dedicated *_test database');
  const db=connect(config.databaseUrl);
  await migrate(db);
  const {app,mailbox}=await buildApp(config,{db,logStream:new Writable({write(_c,_e,done){done();}})});

  const sent:{to:string[];text:string;from:string}[]=[];
  const realFetch=globalThis.fetch;
  globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{
    const url=String(input instanceof Request?input.url:input);
    if(url!=='https://api.resend.com/emails')return realFetch(input,init);
    assert.equal(new Headers(init?.headers).get('authorization'),'Bearer re_test_key');
    assert.match(new Headers(init?.headers).get('idempotency-key')??'',/^signin\/[0-9a-f-]{36}$/);
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({id:'email_1'}),{status:200,headers:{'content-type':'application/json'}});
  }) as typeof fetch;

  let counter=0;
  const inject=async(method:string,url:string,payload?:unknown,headers:Record<string,string>={})=>{
    const r=await app.inject({method:method as 'GET',url,...(payload===undefined?{}:{payload:JSON.stringify(payload)}),headers:{...(method==='GET'?{}:{origin:config.origin,'content-type':'application/json'}),...headers}});
    if(url.startsWith('/v1/')&&r.statusCode!==204)validateResponse(url.split('?')[0]!,method,r.statusCode,r.json());
    return r;
  };
  const cookieOf=(r:{headers:Record<string,unknown>})=>String(r.headers['set-cookie']).split(';')[0]!;
  const start=async()=>{
    const r=await inject('POST','/v1/auth/start',{provider:'email',continuation:{targetPath:'/home',step:0}});
    assert.equal(r.statusCode,200,r.body);
    return {pre:cookieOf(r),transaction:new URL(r.json().redirectUrl).searchParams.get('transaction')!};
  };
  const verify=async(pre:string,token:string)=>{
    const r=await inject('POST','/v1/auth/email/verify',{token},{cookie:pre});
    assert.equal(r.statusCode,200,r.body);
    const cookie=cookieOf(r),s=(await inject('GET','/v1/auth/session',undefined,{cookie})).json();
    return {cookie,csrf:s.csrfToken as string,session:s,continuation:r.json().continuation};
  };
  const stamp=Date.now().toString(36);
  const tick=()=>emailTick(db,config,resendTransport(config.email!,config.origin));
  const tokenOf=(text:string)=>{
    const link=new URL(text.match(/https?:\/\/\S+/)![0]);
    assert.equal(link.search,'','no token in the query string');
    return new URLSearchParams(link.hash.slice(1)).get('token')!;
  };

  try {
    await t.test('a real address is emailed through Resend, and its identity is verified',async()=>{
      const address=`rani.${stamp}@example.com`;
      const {pre,transaction}=await start();
      assert.equal((await inject('POST','/v1/auth/email/links',{email:address,transaction},{cookie:pre})).statusCode,202);
      assert.equal(sent.length,0,'the request only queues; the worker sends');
      assert.equal((await tick()).sent,1);
      assert.equal(sent.length,1);
      assert.deepEqual(sent[0]!.to,[address]);
      assert.equal(sent[0]!.from,'IntiBelajar <masuk@example.com>');
      assert.equal(mailbox.get(address),undefined,'real addresses never go to the synthetic mailbox');
      const link=new URL(sent[0]!.text.match(/https?:\/\/\S+/)![0]);
      assert.equal(link.origin+link.pathname,config.origin+'/auth/email');
      const s=await verify(pre,tokenOf(sent[0]!.text));
      assert.equal(s.session.learner.status,'PENDING_CONSENT');
      assert.deepEqual(s.continuation,{route:'/kenalan'});
      const identity=await db.selectFrom('auth_identity as i').innerJoin('app_user as u','u.id','i.user_id').select('i.email_verified')
        .where('u.id','=',s.session.user.id).executeTakeFirstOrThrow();
      assert.equal(identity.email_verified,true);
    });

    await t.test('onboarding with username and grade activates the account without a guardian',async()=>{
      const {pre,transaction}=await start();
      const address=`budi.${stamp}@example.com`;
      await inject('POST','/v1/auth/email/links',{email:address,transaction},{cookie:pre});
      await tick();
      const token=tokenOf(sent.at(-1)!.text);
      const s=await verify(pre,token);
      const headers=()=>({cookie:s.cookie,'x-csrf-token':s.csrf,'idempotency-key':'self_'+stamp+'_'+(++counter)});
      assert.equal((await inject('GET','/v1/me/progress',undefined,{cookie:s.cookie})).statusCode,403);

      // Kelas saja belum cukup: username juga wajib.
      const half=await inject('PATCH','/v1/me/profile',{grade:10},headers());
      assert.equal(half.statusCode,200,half.body);
      assert.equal(half.json().status,'PENDING_CONSENT');

      const done=await inject('PATCH','/v1/me/profile',{displayName:'Budi',grade:10},headers());
      assert.equal(done.statusCode,200,done.body);
      assert.equal(done.json().status,'ACTIVE');
      assert.equal(done.json().displayName,'Budi');
      assert.equal(done.json().consentDeadlineAt,undefined);

      const session=(await inject('GET','/v1/auth/session',undefined,{cookie:s.cookie})).json();
      assert.equal(session.learner.status,'ACTIVE');
      assert.deepEqual(session.learner.missingPurposes,[]);
      const consents=(await inject('GET','/v1/me/consents',undefined,{cookie:s.cookie})).json().items;
      for(const purpose of ['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD'])
        assert.equal(consents.find((c:{purpose:string})=>c.purpose===purpose).status,'GRANTED',purpose);
      assert.equal(consents.find((c:{purpose:string})=>c.purpose==='PRODUCT_ANALYTICS').status,'NOT_REQUESTED');
      const progress=await inject('GET','/v1/me/progress',undefined,{cookie:s.cookie});
      assert.equal(progress.statusCode,200,progress.body);
      assert.equal(progress.json().user.displayName,'Budi');
    });

    await t.test('without Resend, a real address is refused and the synthetic mailbox stays the only transport',async()=>{
      const local=readConfig({...base,SYNTHETIC_FIXTURES:'true'});
      const other=await buildApp(local,{db,logStream:new Writable({write(_c,_e,done){done();}})});
      try {
        const r=await other.app.inject({method:'POST',url:'/v1/auth/start',payload:JSON.stringify({provider:'email',continuation:{targetPath:'/home',step:0}}),headers:{origin:local.origin,'content-type':'application/json'}});
        const pre=cookieOf(r),transaction=new URL(r.json().redirectUrl).searchParams.get('transaction');
        const refused=await other.app.inject({method:'POST',url:'/v1/auth/email/links',payload:JSON.stringify({email:'someone@example.com',transaction}),headers:{origin:local.origin,'content-type':'application/json',cookie:pre}});
        assert.equal(refused.statusCode,400);
      } finally { await other.app.close(); }
      assert.throws(()=>readConfig({...base,EMAIL_PROVIDER:'resend',RESEND_API_KEY:'nope',EMAIL_FROM:'masuk@example.com'}));
      assert.throws(()=>readConfig({...base,EMAIL_PROVIDER:'smtp',RESEND_API_KEY:'re_x',EMAIL_FROM:'masuk@example.com'}));
    });
  } finally {
    globalThis.fetch=realFetch;
    await app.close();
    await db.destroy();
  }
});
