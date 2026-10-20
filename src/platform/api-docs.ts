import type {FastifyInstance} from 'fastify';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {contract} from './contract.js';

/** Development-only, same-origin Swagger. No CDN, telemetry, external validator or persisted credentials. */
export function registerApiDocs(app:FastifyInstance){
 const require=createRequire(import.meta.url);
 const assets=dirname(require.resolve('swagger-ui-dist/package.json'));
 const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IntiBelajar API · Development</title><link rel="stylesheet" href="/docs/swagger-ui.css"></head><body><p>Development sintetis. Untuk mencoba endpoint akun, buka /docs melalui alamat frontend dan masuk lewat /__local. Endpoint dalam kontrak dapat masih dinonaktifkan; lihat blockers pada /health/ready.</p><div id="swagger-ui"></div><script src="/docs/swagger-ui-bundle.js"></script><script src="/docs/init.js"></script></body></html>';
 const init=`window.ui=SwaggerUIBundle({url:'/docs/openapi.json',dom_id:'#swagger-ui',deepLinking:true,filter:true,validatorUrl:null,persistAuthorization:false,withCredentials:true,defaultModelsExpandDepth:1,requestInterceptor:async function(req){
 const u=new URL(req.url,location.origin);if(u.origin!==location.origin)throw new Error('Only same-origin API calls are allowed');
 req.credentials='same-origin';
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const r=await fetch('/v1/auth/session',{credentials:'same-origin',cache:'no-store'});if(r.ok){const s=await r.json();if(s.csrfToken)req.headers['X-CSRF-Token']=s.csrfToken;}
 }
 return req;
}});`;
 app.get('/docs',async(_req,reply)=>reply.header('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'").type('text/html').send(html));
 app.get('/docs/',async(_req,reply)=>reply.redirect('/docs'));
 app.get('/docs/openapi.json',async()=>({...contract,servers:[{url:'/'}]}));
 app.get('/docs/init.js',async(_req,reply)=>reply.type('application/javascript').send(init));
 for(const [name,type]of [['swagger-ui.css','text/css'],['swagger-ui-bundle.js','application/javascript']]as const){
  const data=readFileSync(join(assets,name));
  app.get('/docs/'+name,async(_req,reply)=>reply.type(type).send(data));
 }
}
