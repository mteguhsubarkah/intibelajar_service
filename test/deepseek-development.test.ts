import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentEngine, SYNTHETIC_AI_ANSWERS, type Budget } from '../src/assessment/deepseek-development.js';
import type { EngineInput } from '../src/assessment/diagnosis.js';
const input:EngineInput={purpose:'DIAGNOSIS',prompt:'Soal sintetis',response:{schemaVersion:1,responseType:'TEXT',text:SYNTHETIC_AI_ANSWERS[0],inputMode:'TYPED'},
  concepts:[{code:'RATIO',assessable:true,misconceptions:['SIN']}],rubric:{schemaVersion:1,evaluator:'tower-v1',answer:{value:34.6},acceptedForms:['34.6'],solutionPaths:[],misconceptionMap:[],finalAnswerEvidence:[]}};
function ledger(){let spent=0,calls=0;const done:string[]=[];return {budget:{async reserve(n:number){spent+=n;calls++;return 'call';},async finish(_id:string,status:string){done.push(status);}} as Budget,get spent(){return spent;},get calls(){return calls;},done};}
const response=()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({schemaVersion:1,verdict:'UNREADABLE',concepts:[]})}}],usage:{prompt_tokens:400,completion_tokens:40}}));
test('one provider call with JSON mode, private key, fixed host/model, spend reserved first',async()=>{
  const l=ledger();let requests=0;
  const engine=createDevelopmentEngine('synthetic-key',l.budget,(async(url,options)=>{
    assert.equal(l.calls,1);requests++;assert.equal(url,'https://api.deepseek.com/chat/completions');
    const b=JSON.parse(options!.body as string);assert.equal(b.max_tokens,2048);assert.deepEqual(b.response_format,{type:'json_object'});assert.equal(b.tools,undefined);
    assert.equal(b.thinking.type,'disabled');return response();
  }) as typeof fetch);
  const r=await engine.diagnose(input,new AbortController().signal) as any;
  assert.equal(requests,1);assert.ok(l.spent>0);assert.deepEqual(l.done,['SUCCEEDED']);assert.equal(r.verdict,'UNREADABLE');
});
test('nonfixture input and exhausted budget never call network',async()=>{
  let called=false;const http=(async()=>{called=true;return response();}) as typeof fetch;
  const l=ledger();const engine=createDevelopmentEngine('key',l.budget,http);
  await assert.rejects(engine.diagnose({...input,response:{...input.response,text:'my private answer'}},new AbortController().signal),/SYNTHETIC/);
  assert.equal(l.calls,0);
  const denied=createDevelopmentEngine('key',{...l.budget,async reserve(){throw new Error('AI_BUDGET_EXCEEDED');}},http);
  await assert.rejects(denied.diagnose(input,new AbortController().signal),/BUDGET/);assert.equal(called,false);
});
test('failure retains reservation, hides provider body, circuit stops after three failures',async()=>{
  const l=ledger();let count=0;const engine=createDevelopmentEngine('key',l.budget,(async()=>{count++;return new Response('secret provider body',{status:429});}) as typeof fetch);
  for(let n=0;n<3;n++)await assert.rejects(engine.diagnose(input,new AbortController().signal),/^Error: AI_CALL_FAILED$/);
  await assert.rejects(engine.diagnose(input,new AbortController().signal),/CIRCUIT/);
  assert.equal(count,3);assert.deepEqual(l.done,['FAILED','FAILED','FAILED']);assert.ok(l.spent>0);
});
test('empty/truncated/invalid output is failure, never mock success',async()=>{
  for(const body of [{choices:[]},{choices:[{finish_reason:'length',message:{content:'{}'}}]}, {choices:[{finish_reason:'stop',message:{content:'not json'}}],usage:{prompt_tokens:1,completion_tokens:1}}]){
    const l=ledger(),engine=createDevelopmentEngine('key',l.budget,(async()=>new Response(JSON.stringify(body))) as typeof fetch);
    await assert.rejects(engine.diagnose(input,new AbortController().signal),/AI_CALL_FAILED/);assert.deepEqual(l.done,['FAILED']);
  }
});
test('authentication or balance failure stops further HTTP and reservations until restart',async()=>{
 for(const status of [401,402]){
  const l=ledger();let requests=0;
  const engine=createDevelopmentEngine('key',l.budget,(async()=>{requests++;return new Response('',{status});}) as typeof fetch);
  await assert.rejects(engine.diagnose(input,new AbortController().signal),/AI_CALL_FAILED/);
  await assert.rejects(engine.diagnose(input,new AbortController().signal),/AI_CIRCUIT_OPEN/);
  assert.equal(requests,1);assert.equal(l.calls,1);
 }
});
