import{sql}from'kysely';import type{Connection}from'../db.js';
export async function progressLearning(db:Connection,id:string){
 const sessions=(await sql<any>`select id,focus_concept_id,started_at,completed_at,outcome from learning_session where learner_id=${id}`.execute(db)).rows;
 const attempts=(await sql<any>`select id,session_id,question_revision_id,kind,source,assistance,verdict,response->>'responseType' as response_type,submitted_at,graded_at from question_attempt where learner_id=${id}`.execute(db)).rows;
 const lessons=(await sql<any>`select a.id,a.concept_id,a.session_id,a.status,a.assigned_at,a.completed_at,s.origin from lesson_assignment a join learning_session s on s.id=a.session_id where s.learner_id=${id}`.execute(db)).rows;
 return{sessions,attempts,lessons};
}
