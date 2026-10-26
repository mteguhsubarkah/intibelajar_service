import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config.js';
import {createGoogleProvider} from '../src/identity/google-provider.js';
const env={NODE_ENV:'production',RUNTIME_MODE:'pilot',APP_ORIGIN:'https://intibelajar.com',TRUST_PROXY:'127.0.0.1',DATABASE_URL:'postgres://test:test@127.0.0.1/intibelajar_dev',APP_KEY:'ab'.repeat(32)};
const credentials={GOOGLE_OIDC_ENABLED:'true',GOOGLE_CLIENT_ID:'server.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-secret'};
test('pilot Google is explicit, requires complete credentials and preserves local isolation',()=>{
 assert.equal(readConfig(env).google,undefined);
 const c=readConfig({...env,...credentials});
 assert.equal(c.google?.clientId,credentials.GOOGLE_CLIENT_ID);
 assert.equal(c.google?.testEmail,undefined);
 assert.equal(c.synthetic,false);assert.equal(c.selfConsent,false);
 assert.throws(()=>readConfig({...env,GOOGLE_OIDC_ENABLED:'true'}));
 assert.throws(()=>readConfig({...env,...credentials,GOOGLE_CLIENT_SECRET:''}));
 assert.throws(()=>readConfig({...env,...credentials,GOOGLE_OIDC_ENABLED:'yes'}));
 assert.throws(()=>readConfig({...env,...credentials,LOCAL_GOOGLE_OIDC:'true'}));
 assert.throws(()=>readConfig({...env,...credentials,NODE_ENV:'development',RUNTIME_MODE:undefined,TRUST_PROXY:undefined,APP_ORIGIN:'http://localhost:5173'}));
});
test('pilot authorization uses public HTTPS callback, PKCE, nonce and state',async()=>{
 const c=readConfig({...env,...credentials});
 const http=(async()=>new Response(JSON.stringify({issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256']}),{headers:{'content-type':'application/json'}})) as typeof fetch;
 const u=new URL(await createGoogleProvider(c,http).authorization('state','nonce','a'.repeat(43)));
 assert.equal(u.searchParams.get('redirect_uri'),'https://intibelajar.com/v1/auth/callback/google');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 assert.equal(u.searchParams.get('state'),'state');assert.equal(u.searchParams.get('nonce'),'nonce');
 assert.ok(!u.href.includes(credentials.GOOGLE_CLIENT_SECRET));
});
