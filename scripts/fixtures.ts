import {writeFileSync,mkdirSync} from 'node:fs';
import {buildApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
import {requireSynthetic} from '../src/identity/service.js';
const config=readConfig();requireSynthetic(config);
if(!/_(dev|test)$/.test(new URL(config.databaseUrl).pathname))throw new Error('Fixtures require a dedicated *_dev or *_test database');
const {app}=await buildApp(config);
try {
  const headers={origin:config.origin,'content-type':'application/json'};
  const start=await app.inject({method:'POST',url:'/v1/auth/start',headers,payload:{provider:'email',continuation:{targetPath:'/kenalan',step:0}}});
  if(start.statusCode!==200)throw new Error('Fixture sign-in initialization failed');
  const cookie=String(start.headers['set-cookie']).split(';')[0]!,transaction=new URL(start.json().redirectUrl).searchParams.get('transaction');
  const link=await app.inject({method:'POST',url:'/v1/auth/email/links',headers:{...headers,cookie},payload:{email:'learner-fixture@example.invalid',transaction}});
  if(link.statusCode!==202)throw new Error('Fixture link preparation failed');
  mkdirSync('.local',{recursive:true});writeFileSync('.local/fixture-browser.json',JSON.stringify({syntheticOnly:true,preAuthCookie:cookie},null,2),{mode:0o600});
  console.log('Synthetic fixture prepared under .local; no identity or guardian is production-verified.');
}finally{await app.close();}
