import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {sql} from 'kysely';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {buildApp} from '../src/app.js';
import {emailTick} from '../src/identity/email-outbox.js';
import {EmailSendError,resendTransport,type EmailTransport,type SigninMail} from '../src/identity/email-transport.js';
import {hashSecret,passwordProblem,verifySecret} from '../src/identity/password.js';
import {staffAccounts} from '../src/identity/staff.js';

/*
 * Daftar dengan username + password + email (migrasi 0014, FEATURE_PASSWORD_AUTH). Yang dibuktikan: fitur mati tanpa
 * flag; isian dicek (username, kekuatan password, email); akun baru dibuat hanya setelah tautan di email dibuka;
 * tautan sekali pakai dan kedaluwarsa; username unik; email yang sudah punya akun mendapat password di akun yang sama
 * (dan ditolak kalau sudah punya password); login dengan username/email + password; salah username dan salah password
 * sama-sama 401; batas percobaan per akun; email sungguhan lewat outbox ke /daftar/verifikasi; password tidak pernah
 * tersimpan atau tercatat dalam bentuk asli.
 */
const base=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));

test('password hashing and rules',async()=>{
  const stored=await hashSecret('rahasia123');
  assert.match(stored,/^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifySecret('rahasia123',stored),true);
  assert.equal(await verifySecret('rahasia124',stored),false);
  assert.notEqual(await hashSecret('rahasia123'),stored,'salted');
  assert.equal(await verifySecret('x','bcrypt$whatever'),false);
  assert.deepEqual(['pendek1','abcdefgh','12345678','rojali123','x'.repeat(129)+'1','Rahasia123'].map(p=>passwordProblem(p,'rojali123')),
    ['PASSWORD_LENGTH','PASSWORD_WEAK','PASSWORD_WEAK','PASSWORD_IS_USERNAME','PASSWORD_LENGTH',null]);
});

test('password sign-up is off without FEATURE_PASSWORD_AUTH',async()=>{
  const config=readConfig({...base});
  const db=connect(config.databaseUrl);await migrate(db);
  const {app}=await buildApp(config,{db});
  try {
    for(const [url,payload] of [['/v1/auth/password/register',{username:'rojali',email:'r@contoh.invalid',password:'rahasia123'}],
      ['/v1/auth/password/verify',{token:'a'.repeat(43)}],['/v1/auth/password/login',{username:'rojali',password:'rahasia123',continuation:{targetPath:'/home',step:0}}]] as const){
      const r=await app.inject({method:'POST',url,payload:JSON.stringify(payload),headers:{origin:config.origin,'content-type':'application/json'}});
      assert.equal(r.statusCode,403,url);assert.equal(r.json().code,'FEATURE_DISABLED');
    }
  } finally {await app.close();await db.destroy();}
  // The flag is switchable in development and in pilot mode; other features still fail closed.
  assert.equal(readConfig({...base,FEATURE_PASSWORD_AUTH:'true'}).features.passwordAuth,true);
  assert.throws(()=>readConfig({...base,FEATURE_PASSWORD_AUTH:'yes'}));
});

test('password sign-up, verification and sign-in',async t=>{
  const config=readConfig({...base,SYNTHETIC_FIXTURES:'true',FEATURE_PASSWORD_AUTH:'true',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'re_test_key',EMAIL_FROM:'IntiBelajar <masuk@example.com>'});
  assert.match(new URL(config.databaseUrl).pathname,/_test$/,'Tests require a dedicated *_test database');
  const db=connect(config.databaseUrl);await migrate(db);
  let log='';
  const {app,mailbox}=await buildApp(config,{db,logStream:new Writable({write(chunk,_e,done){log+=String(chunk);done();}})});
  const stamp=Date.now().toString(36);let n=0,ip=0;
  const name=(prefix='siswa')=>`${prefix}_${stamp}_${++n}`;
  const synthetic=()=>`daftar.${stamp}.${++n}@contoh.invalid`;
  // Each call from its own address, so the per-IP limit of /v1/auth/* does not cut the suite short.
  const post=(url:string,payload:unknown,cookie?:string,remoteAddress=`10.9.${Math.floor(++ip/250)}.${ip%250+1}`)=>app.inject({method:'POST',url,remoteAddress,
    payload:JSON.stringify(payload),headers:{origin:config.origin,'content-type':'application/json',...(cookie?{cookie}:{})}});
  const cookieOf=(r:{headers:Record<string,unknown>})=>String(r.headers['set-cookie']).split(';')[0]!;
  const session=async(cookie:string)=>(await app.inject({method:'GET',url:'/v1/auth/session',headers:{cookie}})).json();
  const register=(username:string,email:string,password='rahasia123',extra:object={})=>post('/v1/auth/password/register',{username,email,password,...extra});
  const lastToken=(email:string)=>{const mail=mailbox.get(email)?.at(-1);assert.equal(mail?.kind,'signup');return mail!.token;};
  const verify=(token:string)=>post('/v1/auth/password/verify',{token});
  const login=(username:string,password:string,remoteAddress?:string)=>post('/v1/auth/password/login',{username,password,continuation:{targetPath:'/home',step:0}},undefined,remoteAddress);
  const secrets:string[]=[];

  try {
    await t.test('register only sends a link; the account appears when the link is opened',async()=>{
      const username=name('Rojali'),email=synthetic(),password='Rahasia'+stamp+'9';secrets.push(password);
      const users=async()=>Number((await sql<{c:string}>`select count(*) c from app_user`.execute(db)).rows[0]!.c);
      const before=await users();
      const r=await register(username,email,password);
      assert.equal(r.statusCode,202,r.body);assert.deepEqual(r.json(),{accepted:true});
      assert.equal(await users(),before,'no account before verification');
      const token=lastToken(email);
      const v=await verify(token);
      assert.equal(v.statusCode,200,v.body);
      assert.deepEqual(v.json(),{continuation:{route:'/kenalan'}});
      const s=await session(cookieOf(v));
      assert.equal(s.authenticated,true);assert.equal(s.learner.status,'PENDING_CONSENT');
      // Without self-onboarding consent nothing personal is stored before consent: the profile name stays empty.
      assert.equal((await sql<{n:string|null}>`select display_name n from student_profile where learner_id=${s.learner.id}`.execute(db)).rows[0]!.n,null);
      assert.equal(await users(),before+1);
      // Signed in with the username in any case, and with the email address.
      for(const id of [username,username.toUpperCase(),' '+username+' ',email]){
        const l=await login(id,password);
        assert.equal(l.statusCode,200,id+': '+l.body);assert.deepEqual(l.json(),{continuation:{route:'/home',step:0}});
        assert.equal((await session(cookieOf(l))).user.id,s.user.id);
      }
      // The link is single-use.
      assert.equal((await verify(token)).json().code,'LINK_EXPIRED');
      // Backoffice shows the method with the username, never the hash.
      const [account]=await staffAccounts(db,config.key,{userId:s.user.id});
      const pw=account!.identities.find(i=>i.provider==='PASSWORD')!;
      assert.equal(pw.username,username.toLowerCase());
      assert.equal(JSON.stringify(account).includes('scrypt'),false);
    });

    await t.test('wrong username and wrong password are the same 401',async()=>{
      const username=name(),email=synthetic();
      await register(username,email,'benar12345');await verify(lastToken(email));
      for(const [id,pw] of [[username,'salah12345'],[name('tidakada'),'benar12345'],['tidak@ada.invalid','benar12345'],['1bukanusername','benar12345']]){
        const r=await login(id!,pw!);
        assert.equal(r.statusCode,401,id);assert.equal(r.json().code,'INVALID_CREDENTIALS');assert.equal(r.json().message,'Username atau password salah.');
        assert.equal(r.headers['set-cookie'],undefined);
      }
    });

    await t.test('fields are validated with the field named',async()=>{
      const cases:[object,string[],string?][]=[
        [{username:'ab'},['username']],[{username:'1rojali'},['username']],[{username:'rojali ganteng'},['username']],[{username:'x'.repeat(31)},['username']],
        [{password:'pendek1'},['password'],'PASSWORD_LENGTH'],[{password:'hanyahuruf'},['password'],'PASSWORD_WEAK'],
        [{username:'rojali_'+stamp+'1',password:'Rojali_'+stamp+'1'},['password'],'PASSWORD_IS_USERNAME'],
        [{email:'bukan-email'},[]],[{email:'siswa@contoh'},[]],[{email:'siswa@contoh.c'},['email']],
      ];
      for(const [change,fields,reason] of cases){
        const r=await post('/v1/auth/password/register',{username:name(),email:synthetic(),password:'rahasia123',...change});
        assert.equal(r.statusCode,400,JSON.stringify(change));assert.equal(r.json().code,'VALIDATION_FAILED');
        if(fields.length)assert.deepEqual(r.json().details?.fields,fields,JSON.stringify(change)+' '+r.body);
        if(reason)assert.equal(r.json().details.reason,reason);
      }
      // Unknown fields and a continuation outside the allow-list are refused.
      assert.equal((await post('/v1/auth/password/register',{username:name(),email:synthetic(),password:'rahasia123',role:'ADMIN'})).statusCode,400);
      assert.equal((await register(name(),synthetic(),'rahasia123',{continuation:{targetPath:'https://evil.example',step:0}})).statusCode,400);
    });

    await t.test('usernames are unique, also between two pending sign-ups',async()=>{
      const username=name(),first=synthetic(),second=synthetic();
      assert.equal((await register(username,first)).statusCode,202);
      assert.equal((await register(username.toUpperCase(),second)).statusCode,202,'not taken until verified');
      assert.equal((await verify(lastToken(first))).statusCode,200);
      const late=await verify(lastToken(second));
      assert.equal(late.statusCode,409);assert.equal(late.json().code,'USERNAME_TAKEN');
      const again=await register(username,synthetic());
      assert.equal(again.statusCode,409);assert.equal(again.json().code,'USERNAME_TAKEN');assert.deepEqual(again.json().details.fields,['username']);
    });

    await t.test('an expired link is refused',async()=>{
      const email=synthetic();await register(name(),email);
      await sql`update signup_request set expires_at=now()-interval '1 minute' where id=(select id from signup_request order by created_at desc limit 1)`.execute(db);
      const r=await verify(lastToken(email));
      assert.equal(r.statusCode,410);assert.equal(r.json().code,'LINK_EXPIRED');
      assert.equal((await verify('b'.repeat(43))).json().code,'LINK_EXPIRED');
    });

    await t.test('an address with an account gets the password on that account, once',async()=>{
      // An account created by an email sign-in link (no password yet).
      const email=synthetic();
      const start=await post('/v1/auth/start',{provider:'email',continuation:{targetPath:'/home',step:0}});
      const pre=cookieOf(start),transaction=new URL(start.json().redirectUrl).searchParams.get('transaction')!;
      await post('/v1/auth/email/links',{email,transaction},pre);
      const signedIn=await post('/v1/auth/email/verify',{token:mailbox.get(email)!.at(-1)!.token},pre);
      const owner=(await session(cookieOf(signedIn))).user.id;
      const username=name();
      await register(username,email);
      const v=await verify(lastToken(email));
      assert.equal(v.statusCode,200,v.body);
      assert.deepEqual(v.json(),{continuation:{route:'/home',step:0}},'an existing account goes home, not to onboarding');
      assert.equal((await session(cookieOf(v))).user.id,owner,'same account, no duplicate');
      assert.equal((await session(cookieOf(await login(username,'rahasia123')))).user.id,owner);
      // A second sign-up for the same address now has nothing to add.
      await register(name(),email);
      const twice=await verify(lastToken(email));
      assert.equal(twice.statusCode,409);assert.equal(twice.json().code,'ACCOUNT_EXISTS');
    });

    await t.test('sign-in attempts are limited per target account',async()=>{
      const username=name(),email=synthetic();
      await register(username,email);await verify(lastToken(email));
      const codes:number[]=[];
      for(let i=0;i<11;i++)codes.push((await login(username,'salah'+i+'9999')).statusCode);
      assert.deepEqual(codes,[...Array(10).fill(401),429]);
      assert.equal((await login(username,'rahasia123')).statusCode,429,'even the right password waits');
    });

    await t.test('a real address goes through the outbox to /daftar/verifikasi',async()=>{
      const to=`daftar.${stamp}.${++n}@example.com`,username=name(),password='Benar'+stamp+'7';secrets.push(password,to);
      const r=await register(username,to,password);
      assert.equal(r.statusCode,202,r.body);
      assert.equal(mailbox.get(to),undefined,'a real address never reaches the synthetic mailbox');
      const row=(await sql<{kind:string;delivery_key:string;signup_request_id:string;auth_transaction_id:string|null;payload_ciphertext:Buffer}>`
        select o.* from email_outbox o join signup_request r on r.id=o.signup_request_id order by r.created_at desc limit 1`.execute(db)).rows[0]!;
      assert.deepEqual([row.kind,row.delivery_key,row.auth_transaction_id],['SIGNUP','signup/'+row.signup_request_id,null]);
      const calls:SigninMail[]=[];
      const transport:EmailTransport={async send(mail){calls.push(mail);}};
      await emailTick(db,config,transport);
      const mail=calls.find(c=>c.to===to)!;
      assert.ok(mail,'sent by the worker');
      const url=new URL(mail.url);
      assert.equal(url.origin+url.pathname,config.origin+'/daftar/verifikasi');
      assert.equal(url.search,'','the token is never in the query string');
      assert.equal(mail.deliveryKey,row.delivery_key);
      const v=await verify(new URLSearchParams(url.hash.slice(1)).get('token')!);
      assert.equal(v.statusCode,200,v.body);
      const user=(await session(cookieOf(v))).user.id;
      const email=(await sql<{email_verified:boolean}>`select email_verified from auth_identity where user_id=${user} and provider='EMAIL'`.execute(db)).rows[0]!;
      assert.equal(email.email_verified,true,'a link delivered by the real sender verifies the address');
    });

    await t.test('the password is never stored or logged in clear',async()=>{
      const tables=await sql<{t:string}>`select coalesce(string_agg(x::text,' '),'') t from (
        select row_to_json(r)::text x from signup_request r union all select row_to_json(i)::text from auth_identity i
        union all select row_to_json(o)::text from email_outbox o) s`.execute(db);
      const dump=tables.rows[0]!.t;
      for(const secret of secrets)assert.equal(dump.includes(secret),false);
      // Used and expired requests keep no payload.
      const left=(await sql<{c:string}>`select count(*) c from signup_request where (consumed_at is not null or expires_at<=now()) and payload_ciphertext is not null`.execute(db)).rows[0]!.c;
      await emailTick(db,config,null);
      assert.equal(Number((await sql<{c:string}>`select count(*) c from signup_request where (consumed_at is not null or expires_at<=now()) and payload_ciphertext is not null`.execute(db)).rows[0]!.c),0,`was ${left}`);
      assert.ok(log.length>0);
      for(const secret of secrets)assert.equal(log.includes(secret),false);
    });
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('self-onboarding: the username pre-fills the profile name; /kenalan still activates the account',async()=>{
  const config=readConfig({...base,SYNTHETIC_FIXTURES:'true',FEATURE_PASSWORD_AUTH:'true',SELF_ONBOARDING_CONSENT:'true'});
  const db=connect(config.databaseUrl);await migrate(db);
  const {app,mailbox}=await buildApp(config,{db});
  try {
    const stamp=Date.now().toString(36),username='kenalan_'+stamp,email=`kenalan.${stamp}@contoh.invalid`;
    const post=(url:string,payload:unknown,headers:Record<string,string>={})=>app.inject({method:'POST',url,remoteAddress:'10.8.0.1',payload:JSON.stringify(payload),headers:{origin:config.origin,'content-type':'application/json',...headers}});
    assert.equal((await post('/v1/auth/password/register',{username,email,password:'rahasia123'})).statusCode,202);
    const v=await post('/v1/auth/password/verify',{token:mailbox.get(email)!.at(-1)!.token});
    assert.equal(v.statusCode,200,v.body);
    const cookie=String(v.headers['set-cookie']).split(';')[0]!;
    const session=(await app.inject({method:'GET',url:'/v1/auth/session',headers:{cookie}})).json();
    const profile=(await app.inject({method:'GET',url:'/v1/me/profile',headers:{cookie}})).json();
    assert.deepEqual([profile.status,profile.displayName],['PENDING_CONSENT',username]);
    const saved=await app.inject({method:'PATCH',url:'/v1/me/profile',payload:JSON.stringify({displayName:username,grade:10}),
      headers:{origin:config.origin,'content-type':'application/json',cookie,'x-csrf-token':session.csrfToken}});
    assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().status,'ACTIVE');
  } finally {await app.close();await db.destroy();}
});

test('Resend adapter: sign-up email goes only to /daftar/verifikasi',async()=>{
  const sender={provider:'resend' as const,apiKey:'re_test_key',from:'IntiBelajar <masuk@example.com>'};
  const origin='https://intibelajar.example';
  const mail={to:'siswa@example.com',url:origin+'/daftar/verifikasi#token='+'a'.repeat(43),deliveryKey:'signup/0190f000-0000-7000-8000-000000000002'};
  const requests:RequestInit[]=[];
  const http=(async(_url:string|URL|Request,init?:RequestInit)=>{requests.push(init!);return new Response('{}',{status:200});}) as typeof fetch;
  await resendTransport(sender,origin,http).send(mail);
  const body=JSON.parse(String(requests[0]!.body));
  assert.equal(body.subject,'Verifikasi pendaftaran IntiBelajar');
  assert.ok(body.text.includes(mail.url));assert.ok(body.html.includes('href="'+mail.url+'"'));
  assert.equal(new Headers(requests[0]!.headers).get('idempotency-key'),mail.deliveryKey);
  for(const change of [{url:origin+'/auth/email#token='+'a'.repeat(43)},{deliveryKey:'signin/0190f000-0000-7000-8000-000000000002',url:mail.url},{deliveryKey:'signup/../x'}])
    await assert.rejects(resendTransport(sender,origin,http).send({...mail,...change}),(e:unknown)=>e instanceof EmailSendError&&e.code==='EMAIL_INPUT_INVALID',JSON.stringify(change));
  assert.equal(requests.length,1);
});
