import{sql}from'kysely';import type{Connection,Tx}from'../db.js';import{currentRelease}from'./interface.js';import{legacyIntakeMap}from'./intake-map.js';import{uuid}from'../platform/crypto.js';import{fail}from'../platform/errors.js';
import{writePrivateIntakeRevision}from'./grading-source.js';
export async function intakeSuggestions(db:Connection,text:string){const release=await currentRelease(db);if(!release)fail(409,'CONTENT_UNAVAILABLE');const m=await legacyIntakeMap(db,release,text);
 const concepts=(await sql<any>`select id as "conceptId",title,legacy_map_id as "legacyMapId" from concept where legacy_map_id=any(${m.cores}::text[]) order by ordinal,code limit 6`.execute(db)).rows;
 const topic=m.topicId?(await sql<any>`select id as "topicId",title from topic where legacy_id=${m.topicId}`.execute(db)).rows[0]:undefined;return{concepts,topic};}
export async function privateIntakeQuestion(tx:Tx,learner:string,b:{text:string;topicId?:string;conceptIds:string[]}){
 const release=await currentRelease(tx);if(!release)fail(409,'CONTENT_UNAVAILABLE');
 const known=(await sql<{id:string}>`select id from concept where id=any(${b.conceptIds}::uuid[]) and (${b.topicId??null}::uuid is null or topic_id=${b.topicId??null}::uuid)`.execute(tx)).rows;
 if(known.length!==b.conceptIds.length)fail(400,'VALIDATION_FAILED');
 const questionId=uuid(),revisionId=uuid();await sql`insert into question(id,code,family_code,visibility,owner_learner_id,origin)values(${questionId},${'PRIVATE.'+questionId},${'PRIVATE.'+questionId},'PRIVATE',${learner},'INTAKE')`.execute(tx);
 await writePrivateIntakeRevision(tx,revisionId,questionId,b.text);
 for(const c of known)await sql`insert into question_concept(question_revision_id,concept_id,role,assessable)values(${revisionId},${c.id},'PRIMARY',false)`.execute(tx);
 await sql`update question_revision set status='PUBLISHED',published_at=now() where id=${revisionId}`.execute(tx);
 return{questionId,questionRevisionId:revisionId};
}
export async function eraseIntakeQuestions(tx:Tx,id:string){await sql`delete from question_concept where question_revision_id in(select r.id from question_revision r join question q on q.id=r.question_id where q.owner_learner_id=${id})`.execute(tx);await sql`delete from question_revision where question_id in(select id from question where owner_learner_id=${id})`.execute(tx);await sql`delete from question where owner_learner_id=${id}`.execute(tx);}
export async function privateQuestionView(db:Connection,id:string,learner:string){const q=(await sql<any>`select q.id,q.code,r.id as revision_id,r.body,r.difficulty,r.estimated_minutes from question q join question_revision r on r.question_id=q.id and r.status='PUBLISHED' where q.id=${id} and q.visibility='PRIVATE' and q.owner_learner_id=${learner}`.execute(db)).rows[0];if(!q)return null;
 const concepts=(await sql<any>`select concept_id as "conceptId",role from question_concept where question_revision_id=${q.revision_id}`.execute(db)).rows;
 return{id:q.id,revisionId:q.revision_id,code:q.code,itemType:'FREE_RESPONSE',prompt:q.body.prompt,answerFormat:'TEXT',hintCount:0,difficulty:q.difficulty,estimatedMinutes:q.estimated_minutes,concepts};}

export async function guideCore(db:Connection,alias:string){return(await sql<{title:string;description:string|null}>`select c.title,c.definition as description from concept c join catalog_alias a on a.concept_id=c.id join curriculum_release r on r.id=a.release_id where a.namespace='MAP' and a.alias=${alias} and r.is_current limit 1`.execute(db)).rows[0];}
