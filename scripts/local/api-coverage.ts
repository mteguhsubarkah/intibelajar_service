import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Writable} from 'node:stream';
import {readConfig} from '../../src/config.js';
import {buildApp} from '../../src/app.js';
import {contract} from '../../src/platform/contract.js';
const env=JSON.parse(readFileSync('.local/local-dev/env.json','utf8'));
const {app}=await buildApp(readConfig({...env,LOCAL_GOOGLE_OIDC:'false',LOCAL_DEEPSEEK:'false'}),{logStream:new Writable({write(_c,_e,next){next();}})});
try{
 await app.ready();
 const items=[];
 for(const[path,ops]of Object.entries(contract.paths)as[string,Record<string,any>][]){
  for(const[method,operation]of Object.entries(ops)){
   if(!['get','post','put','patch','delete'].includes(method))continue;
   const route=app.hasRoute({method:method.toUpperCase()as'GET',url:path.replace(/\{(\w+)\}/g,':$1')});
   const disabled=path==='/v1/public/evaluations'||path==='/v1/learning/intake/read';
   items.push({method:method.toUpperCase(),path,operationId:operation.operationId,registered:route,status:!route?'NOT_IMPLEMENTED':disabled?'FEATURE_DISABLED':path.includes('/auth/callback/')||path==='/v1/auth/start'?'PARTIAL_PROVIDER_CONFIGURATION':'REGISTERED_REQUIRES_AUTH_CONSENT_OR_OTHER_GATES'});
  }
 }
 const out=process.env.API_COVERAGE_OUTPUT??'docs/backend-implementation/evidence/connections-2026-10-20';mkdirSync(out,{recursive:true});
 writeFileSync(out+'/api-coverage.json',JSON.stringify({scope:'Static route registration with local facade enabled; not a claim of runtime/production readiness',items},null,2));
 console.log(JSON.stringify({operations:items.length,notImplemented:items.filter(i=>!i.registered).map(i=>i.method+' '+i.path)}));
}finally{await app.close();}
