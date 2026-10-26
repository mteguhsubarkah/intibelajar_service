import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readConfig} from '../src/config.js';
import {policyVersion} from '../src/privacy/service.js';
/** Read-only audit of the current implementation, not approval via environment flags. */
export function pilotReadiness(env:NodeJS.ProcessEnv=process.env){
 const checks:{id:string;ready:boolean;reason:string}[]=[];
 let origin:URL|undefined;try{origin=new URL(env.APP_ORIGIN??'');}catch{/* reported below */}
 checks.push({id:'PUBLIC_HTTPS_ORIGIN',ready:!!origin&&origin.protocol==='https:'&&origin.origin===env.APP_ORIGIN&&!origin.username&&!origin.password,
  reason:'Public pilot requires an exact HTTPS origin and same-origin reverse proxy.'});
 let production=false;try{production=env.RUNTIME_MODE==='pilot'&&readConfig(env).mode==='pilot';}catch{/* no exception details: configuration may contain secrets */}
 checks.push({id:'PRODUCTION_RUNTIME',ready:production,reason:'Pilot runtime: RUNTIME_MODE=pilot, NODE_ENV=production, an exact public https APP_ORIGIN, TRUST_PROXY=127.0.0.1, no synthetic fixtures and no automatic consent. A valid runtime is not approval to process real data.'});
 checks.push({id:'REAL_CONSENT_POLICY',ready:!policyVersion.startsWith('synthetic-'),reason:'Current policy is synthetic-dev-v1. Adult self-consent and age assurance remain OD-02/OD-03 approval gates.'});
 checks.push({id:'ADULT_ENROLLMENT',ready:false,reason:'Test email allowlist is not a verified-adult pilot enrollment process; do not infer age from a Google account or birth year.'});
 checks.push({id:'EMAIL_ENROLLMENT',ready:false,reason:'Sign-in email goes through a durable outbox (retry, fixed Idempotency-Key, fragment token). Still open: pilot allowlist/invitations, email-Google account linking policy, a real delivery test, bounce/complaint monitoring.'});
 checks.push({id:'PRIVACY_OPERATIONS',ready:false,reason:'Approved notice/retention, processor and transfer review, deletion/restore drills, and an incident owner are required before real data.'});
 checks.push({id:'REAL_AI_DATA',ready:false,reason:'DeepSeek still permits synthetic inputs only. A configured key does not authorize real learner text or remove AI consent.'});
 return {scope:'private adult pilot',ready:checks.every(c=>c.ready),syntheticRuntimeOnly:!production,checks,
  configuration:{googleClientPresent:!!env.GOOGLE_CLIENT_ID,googleSecretPresent:!!env.GOOGLE_CLIENT_SECRET,
   deepseekKeyPresent:!!env.DEEPSEEK_API_KEY,emailProvider:env.EMAIL_PROVIDER==='resend'?'resend':'disabled',emailKeyPresent:!!env.RESEND_API_KEY},
  note:'No network calls, database mutations, emails, deployment, or approval recorded by this check.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=pilotReadiness();console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:2;}
