import {readFileSync,writeFileSync} from 'node:fs';
import {connect} from '../../src/db.js';
import {sql} from 'kysely';
import {engineInput} from '../../src/assessment/diagnosis.js';
import {createDevelopmentEngine} from '../../src/assessment/deepseek-development.js';
import {reserveAiBudget,finishAiBudget} from '../../src/platform/ai-budget.js';
import {requireConsent} from '../../src/privacy/service.js';
process.loadEnvFile('.local/local-dev/deepseek.env');
if(process.env.LOCAL_DEEPSEEK!=='true')throw Error('Live calls disabled; enable only after resolving provider balance');
const env=JSON.parse(readFileSync('.local/local-dev/env.json','utf8'));
if(new URL(env.DATABASE_URL).pathname!=='/intibelajar_local_dev')throw Error('Synthetic database required');
const db=connect(env.DATABASE_URL);
try{
 const identity=JSON.parse(readFileSync('.local/local-dev/identities.json','utf8')).ai;
 await db.transaction().execute(tx=>requireConsent(tx,identity.learnerId,['LEARNING_DATA','AI_PROCESSING']));
 const a=(await sql<any>`select question_revision_id,response from question_attempt where learner_id=${identity.learnerId} order by id desc limit 1`.execute(db)).rows[0];
 const input=await engineInput(db,a.question_revision_id,'DIAGNOSIS',a.response);
 const engine=createDevelopmentEngine(process.env.DEEPSEEK_API_KEY!,{reserve:n=>reserveAiBudget(db,n),finish:(...args)=>finishAiBudget(db,...args)},async(url,opts)=>{
  try{
   const r=await fetch(url,opts);console.log('Provider HTTP',r.status);
   if(r.ok){const b=await r.clone().json() as any;console.log('Finish',b.choices?.[0]?.finish_reason);writeFileSync('.local/local-dev/synthetic-provider-output.json',JSON.stringify(b.choices?.[0]?.message?.content));}
   return r;
  }catch(e){console.log('Transport category',e instanceof Error?e.name:'unknown');throw e;}
 });
 await engine.diagnose(input,new AbortController().signal);console.log('Validated synthetic response');
}finally{await db.destroy();}
