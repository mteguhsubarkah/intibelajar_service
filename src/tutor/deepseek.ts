import type{DB}from'../db.js';import{reserveAiBudget,finishAiBudget}from'../platform/ai-budget.js';import{readFileSync}from'node:fs';
const system=readFileSync(new URL('../../ai/prompts/tutor/0.2.0.md',import.meta.url),'utf8');
export interface TutorEngine{choose(ask:string,choices:{ask:string;text:string}[],signal:AbortSignal):Promise<number>}
export function deepseekTutor(db:DB,env=process.env,http:typeof fetch=fetch):TutorEngine|null{
 if(env.LOCAL_DEEPSEEK_TUTOR!=='true')return null;
 if(env.NODE_ENV!=='development'||env.SYNTHETIC_FIXTURES!=='true'||new URL(env.DATABASE_URL??'').pathname!=='/intibelajar_local_dev'||!env.DEEPSEEK_API_KEY||env.DEEPSEEK_PRICE_CEILING_CONFIRMED!=='true')throw Error('DEEPSEEK_TUTOR_CONFIGURATION_REQUIRED');
 let blocked=false;
 return{async choose(ask,choices,signal){
  if(blocked)throw Error('AI_CIRCUIT_OPEN');
  if(!choices.some(c=>c.ask===ask))throw Error('SYNTHETIC_TUTOR_INPUT_REQUIRED');
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify({ask,choices:choices.map((c,index)=>({index,ask:c.ask,text:c.text}))})}];
  const bytes=Buffer.byteLength(JSON.stringify(messages));if(bytes>24000)throw Error('AI_INPUT_TOO_LARGE');
  const id=await reserveAiBudget(db,Math.ceil(((bytes+1024)*10+128*20)/1e6*20000));
  try{
   const r=await http('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{authorization:'Bearer '+env.DEEPSEEK_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'deepseek-flash',messages,thinking:{type:'disabled'},response_format:{type:'json_object'},max_tokens:128,stream:false})});
   if([401,402].includes(r.status))blocked=true;if(!r.ok)throw Error();
   const raw=await r.text();if(raw.length>16000)throw Error();const doc=JSON.parse(raw),text=doc.choices?.[0]?.message?.content;
   if(doc.choices?.length!==1||doc.choices[0].finish_reason!=='stop'||typeof text!=='string')throw Error();
   const output=JSON.parse(text);if(Object.keys(output).join()!=='index'||!Number.isInteger(output.index)||output.index<0||output.index>=choices.length)throw Error();
   const usage=doc.usage;if(!Number.isSafeInteger(usage?.prompt_tokens)||usage.prompt_tokens<0||usage.prompt_tokens>bytes+1024||!Number.isSafeInteger(usage?.completion_tokens)||usage.completion_tokens<0||usage.completion_tokens>128)throw Error();
   await finishAiBudget(db,id,'SUCCEEDED',usage.prompt_tokens,usage.completion_tokens);return output.index;
  }catch{await finishAiBudget(db,id,'FAILED');throw Error('AI_TUTOR_CALL_FAILED');}
 }};
}
