import{sql}from'kysely';import type{Connection}from'../db.js';
export async function progressEvidence(db:Connection,id:string){return(await sql<any>`select e.id,e.concept_id,e.attempt_id,e.diagnosis_run_id,e.classification,e.source,e.mastery_eligible,e.transfer_eligible,e.question_family_code,e.context_tag
 from concept_evidence e join diagnosis_run d on d.id=e.diagnosis_run_id where e.learner_id=${id} and d.status='COMPLETED'
 and not exists(select 1 from concept_evidence n where n.supersedes_id=e.id)`.execute(db)).rows;}
