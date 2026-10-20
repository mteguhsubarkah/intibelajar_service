import{sql}from'kysely';import type{Connection}from'../db.js';import{fail}from'../platform/errors.js';import{mappedConcepts}from'../catalog/interface.js';import{tutorChoices}from'../assessment/tutor-ladder.js';
export async function tutorContext(db:Connection,learner:string,session:string){
 const s=(await sql<any>`select id,state,state_version,expires_at,anchor_question_revision_id,focus_concept_id from learning_session where id=${session} and learner_id=${learner}`.execute(db)).rows[0];
 if(!s)fail(404,'NOT_FOUND');if(new Date(s.expires_at)<=new Date()||['EXPIRED','ABANDONED'].includes(s.state))fail(409,'SESSION_EXPIRED');
 const r=s.anchor_question_revision_id??(await sql<any>`select question_revision_id from session_item where session_id=${session} order by ordinal limit 1`.execute(db)).rows[0]?.question_revision_id;
 if(!r||!s.anchor_question_revision_id)fail(409,'CONTENT_UNAVAILABLE');const concepts=await mappedConcepts(db,r);
 return{sessionId:session,revisionId:r,version:Number(s.state_version),conceptIds:concepts.map(c=>c.id),expiresAt:new Date(s.expires_at),choices:await tutorChoices(db,r)};
}
