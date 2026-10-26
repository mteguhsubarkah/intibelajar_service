import {revisionFacts} from '../catalog/interface.js';
import type {Tx} from '../db.js';
import {encrypt,decrypt,hash,uuid} from '../platform/crypto.js';
import {fail} from '../platform/errors.js';
import {requireConsent} from '../privacy/service.js';
import {loadTrialItem} from './trial.js';
import {evaluate} from './evaluators/index.js';
export interface TrialProofInput {owner:string;session:string;questionId:string;revisionId:string;text:string;hintUsed:boolean;solutionSeen:boolean}
export function sealTrialProof(key:Buffer,input:TrialProofInput,now=Date.now()) {
 if(input.solutionSeen || !input.text.trim() || input.text.length>1000)return undefined;
 const id=hash(input.owner+':'+input.session+':'+input.questionId+':'+input.text).toString('hex');
 return encrypt(key,JSON.stringify({...input,id,type:'trial-claim-v1',expires:now+7200000})).toString('base64url');
}
export function readTrialProof(key:Buffer,proof:string,owner:string,now=Date.now()) {
 let p:any;try{p=JSON.parse(decrypt(key,Buffer.from(proof,'base64url')));}catch{return fail(400,'VALIDATION_FAILED');}
 if(p.type!=='trial-claim-v1'||p.owner!==owner||typeof p.text!=='string'||p.text.length>1000||!p.text.trim()||!/^\w{64}$/.test(p.id)||typeof p.revisionId!=='string'||typeof p.questionId!=='string'||typeof p.hintUsed!=='boolean'||p.solutionSeen!==false||!Number.isFinite(p.expires))return fail(400,'VALIDATION_FAILED');
 if(p.expires<=now)return fail(410,'LINK_EXPIRED');
 return p as TrialProofInput & {id:string;expires:number};
}
export async function verifiedTrialResponse(tx:Tx,p:ReturnType<typeof readTrialProof>){
 const item=await loadTrialItem(tx,p.questionId,p.revisionId);
 const response={schemaVersion:1 as const,responseType:'TEXT' as const,text:p.text,inputMode:'TYPED' as const};
 if(evaluate({...item.source,response}).verdict!=='CORRECT')return fail(409,'CONTENT_UNAVAILABLE');
 const questionId=(await revisionFacts(tx,[p.revisionId])).get(p.revisionId)?.questionId;
 if(!questionId)return fail(409,'CONTENT_UNAVAILABLE');return {questionId,response};
}
