import {sql} from 'kysely';
import type {Tx} from '../db.js';
import {fail} from '../platform/errors.js';
import {requireConsent} from '../privacy/service.js';
import {learningService} from './service.js';
import {readTrialProof,verifiedTrialResponse} from '../assessment/trial-proof.js';
export async function claimTrial(tx:Tx,key:Buffer,learner:string,proof:ReturnType<typeof readTrialProof>) {
 await requireConsent(tx,learner,['LEARNING_DATA']);
 await sql`select pg_advisory_xact_lock(hashtextextended(${'trial-claim:'+proof.id},0))`.execute(tx);
 const legacy='trial-claim:'+proof.id;
 const prior=(await sql<{id:string;learner_id:string}>`select id,learner_id from learning_session where legacy_client_session_id=${legacy}`.execute(tx)).rows[0];
 if(prior){if(prior.learner_id!==learner)fail(409,'IDEMPOTENCY_KEY_REUSED');return {claimed:true,sessionId:prior.id};}
 const {questionId,response}=await verifiedTrialResponse(tx,proof);
 const learning=learningService(key,null);
 const created=await learning.create(tx,learner,{kind:'QUESTION_LOOP',origin:'FUNNEL',questionId},legacy);
 const session=created.body as {id:string;stateVersion:number};
 if(proof.hintUsed)await learning.clientHint(tx,learner,session.id);
 await learning.submitAttempt(tx,learner,session.id,{expectedStateVersion:session.stateVersion,response});
 return {claimed:true,sessionId:session.id};
}
