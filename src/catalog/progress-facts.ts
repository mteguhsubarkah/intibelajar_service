import{sql}from'kysely';import type{Connection}from'../db.js';
export async function progressCatalog(db:Connection){
 const concepts=(await sql<any>`select c.id,c.code,c.title,c.topic_id,c.legacy_map_id as alias from concept c order by c.code`.execute(db)).rows;
 const revisions=(await sql<any>`select r.id,q.code,q.family_code,
  array(select qc.concept_id from question_concept qc where qc.question_revision_id=r.id and qc.role='PRIMARY') as concepts,
  (select count(distinct c.topic_id) from question_concept qc join concept c on c.id=qc.concept_id where qc.question_revision_id=r.id and qc.assessable)>=2 as combined
 from question_revision r join question q on q.id=r.question_id`.execute(db)).rows;
 return{concepts,revisions};
}
