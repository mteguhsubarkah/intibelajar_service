import{sql}from'kysely';import type{Tx}from'../db.js';import{uuid,hash}from'../platform/crypto.js';import{fail}from'../platform/errors.js';
import{currentRelease,mappedConcepts}from'../catalog/interface.js';import{deviceAnchor}from'../catalog/device-anchor.js';
export interface DeviceHistory{deviceSessionId:string;questionAlias:string;furthestStep:'QUESTION'|'DIAGNOSIS_SEEN'|'LESSON_FINISHED'|'COMPLETED';lessonStep?:number;includeAnswerText:boolean;answerText?:string;deviceStartedAt?:string}
export async function importDevice(tx:Tx,learner:string,b:DeviceHistory){
 if(!b.includeAnswerText&&b.answerText!==undefined)fail(400,'VALIDATION_FAILED');
 const pointer='device:'+hash(b.deviceSessionId).toString('hex');await sql`select pg_advisory_xact_lock(hashtextextended(${pointer},0))`.execute(tx);
 const old=await tx.selectFrom('learning_session').select(['id','learner_id']).where('origin','=','DEVICE_IMPORT').where('legacy_client_session_id','=',pointer).executeTakeFirst();
 if(old){if(old.learner_id!==learner)fail(409,'DEVICE_ALREADY_IMPORTED');return old.id;}
 const anchor=await deviceAnchor(tx,b.questionAlias);if(!anchor)fail(404,'NOT_FOUND');const release=await currentRelease(tx);if(!release)fail(409,'CONTENT_UNAVAILABLE');
 const id=uuid();
 const concepts=await mappedConcepts(tx,anchor.revisionId),focus=concepts.find(c=>c.role==='PRIMARY')?.id??null;
 // Imported verdict/diagnosis/XP is never trusted. Resume as QUESTION or RETRY, with an explicit provenance checkpoint.
 const state=b.furthestStep==='QUESTION'?'QUESTION':'RETRY';
 const checkpoint={route:'/coba',sessionId:id,step:state==='QUESTION'?2:7};
 await sql`insert into learning_session(id,learner_id,kind,origin,release_id,anchor_question_revision_id,focus_concept_id,state,checkpoint,legacy_client_session_id,expires_at)
 values(${id},${learner},'QUESTION_LOOP','DEVICE_IMPORT',${release.id},${anchor.revisionId},${focus},${state},${JSON.stringify(checkpoint)}::jsonb,${pointer},now()+interval '14 days')`.execute(tx);
 if(b.includeAnswerText&&b.answerText){
  const attempt=uuid();await sql`insert into question_attempt(id,session_id,learner_id,question_revision_id,kind,ordinal,response,assistance,source,verdict)values(${attempt},${id},${learner},${anchor.revisionId},'INITIAL',1,${JSON.stringify({schemaVersion:1,responseType:'TEXT',inputMode:'TYPED',text:b.answerText})}::jsonb,'NONE','DEVICE_IMPORT','NOT_GRADED')`.execute(tx);
  await sql`update learning_session set active_attempt_id=${attempt} where id=${id}`.execute(tx);
 }
 return id;
}
