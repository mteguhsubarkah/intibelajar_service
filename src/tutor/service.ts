import{sql}from'kysely';import type{DB,Tx,Connection}from'../db.js';import{uuid}from'../platform/crypto.js';import{fail}from'../platform/errors.js';import{tutorContext}from'../learning/tutor-context.js';import{learningService}from'../learning/service.js';import{holdLearner,requireConsent}from'../privacy/service.js';import type{TutorEngine}from'./deepseek.js';
const disclosure='IntiBot dibantu AI saat mode AI aktif. Uji ini hanya memakai soal dan pesan buatan.';
async function conversation(db:Connection,learner:string,id:string){const c=(await sql<any>`select * from tutor_conversation where id=${id} and learner_id=${learner}`.execute(db)).rows[0];if(!c)fail(404,'NOT_FOUND');if(c.status!=='OPEN'||new Date(c.expires_at)<=new Date())fail(409,'SESSION_EXPIRED');return c;}
const msg=(m:any)=>({id:m.id,conversationId:m.conversation_id,ordinal:m.ordinal,role:m.role,status:m.status,quickReplies:m.quick_replies,...(m.text?{text:m.text}:{}),...(m.intent?{intent:m.intent}:{}),createdAt:new Date(m.created_at).toISOString(),...(m.completed_at?{completedAt:new Date(m.completed_at).toISOString()}: {})});
export async function tutorConversation(db:Connection,learner:string,id:string){const c=await conversation(db,learner,id);return{id:c.id,sessionId:c.session_id,questionRevisionId:c.question_revision_id,...(c.concept_id?{conceptId:c.concept_id}:{}),status:c.status,hintsUsed:c.hints_used,solutionUnlocked:c.solution_unlocked,aiDisclosure:disclosure,expiresAt:new Date(c.expires_at).toISOString(),messages:(await sql<any>`select * from tutor_message where conversation_id=${id} order by ordinal`.execute(db)).rows.map(msg)};}
export async function openTutor(tx:Tx,learner:string,body:{sessionId:string;conceptId?:string}){
 const ctx=await tutorContext(tx,learner,body.sessionId);if(body.conceptId&&!ctx.conceptIds.includes(body.conceptId))fail(404,'NOT_FOUND');
 const existing=(await sql<any>`select id from tutor_conversation where learner_id=${learner} and session_id=${body.sessionId} and concept_id is not distinct from ${body.conceptId??null}::uuid and status='OPEN' and expires_at>now()`.execute(tx)).rows[0];if(existing)return{status:200,body:await tutorConversation(tx,learner,existing.id)};
 await sql`update tutor_conversation set status='CLOSED' where learner_id=${learner} and session_id=${body.sessionId} and expires_at<=now()`.execute(tx);
 const id=uuid();await sql`insert into tutor_conversation(id,learner_id,session_id,concept_id,question_revision_id,status,context_version,expires_at)values(${id},${learner},${body.sessionId},${body.conceptId??null},${ctx.revisionId},'OPEN',${ctx.version},${ctx.expiresAt})`.execute(tx);
 return{status:201,body:await tutorConversation(tx,learner,id)};
}
export async function sendTutor(tx:Tx,learner:string,id:string,b:{text?:string;quickReply?:string;requestFullSolution?:boolean},key:Buffer,engine:boolean){
 const c=await conversation(tx,learner,id);await sql`select id from tutor_conversation where id=${id} for update`.execute(tx);
 const ctx=await tutorContext(tx,learner,c.session_id),ask=b.requestFullSolution?'Lihat pembahasan lengkap':b.quickReply??b.text??'';
 if(!ask.trim()||b.text&&b.quickReply)fail(400,'VALIDATION_FAILED');
 const learnerMsg=uuid(),reply=uuid(),n=Number((await sql<any>`select coalesce(max(ordinal),0) as n from tutor_message where conversation_id=${id}`.execute(tx)).rows[0].n)+1;
 const selected=ctx.choices.findIndex(x=>x.ask.toLowerCase()===ask.trim().toLowerCase());
 const useAI=engine&&selected>=0;
 if(useAI)await requireConsent(tx,learner,['LEARNING_DATA','AI_PROCESSING']);
 let result:any=null;
 if(!useAI)result=await learningService(key).tutor(tx,learner,c.session_id,ask);
 await sql`insert into tutor_message(id,conversation_id,ordinal,role,status,text,completed_at,intent)values(${learnerMsg},${id},${n},'LEARNER','COMPLETED',${ask},now(),'QUESTION')`.execute(tx);
 await sql`insert into tutor_message(id,conversation_id,ordinal,role,status,text,quick_replies,intent,reply_to_id,completed_at,moderation)values(${reply},${id},${n+1},'TUTOR',${useAI?'PENDING':'COMPLETED'},${result?.text??null},${JSON.stringify(result?.quick??[])}::jsonb,${useAI?null:'SOCRATIC_PROMPT'},${learnerMsg},${useAI?null:new Date()},${JSON.stringify({version:ctx.version,ask:useAI?ctx.choices[selected]!.ask:null})}::jsonb)`.execute(tx);
 if(result)await sql`update tutor_conversation set hints_used=${result.hintsUsed},updated_at=now() where id=${id}`.execute(tx);
 const rows=(await sql<any>`select * from tutor_message where id in(${learnerMsg},${reply}) order by ordinal`.execute(tx)).rows;
 return{status:202,body:{learnerMessage:msg(rows[0]),reply:msg(rows[1])}};
}
export async function tutorMessage(db:Connection,learner:string,id:string){const row=(await sql<any>`select m.* from tutor_message m join tutor_conversation c on c.id=m.conversation_id where m.id=${id} and c.learner_id=${learner}`.execute(db)).rows[0];if(!row)fail(404,'NOT_FOUND');return msg(row);}
export async function tutorTick(db:DB,key:Buffer,engine:TutorEngine|null){if(!engine)return;
 const row=(await sql<any>`select m.id,c.learner_id,c.session_id,m.moderation from tutor_message m join tutor_conversation c on c.id=m.conversation_id where m.role='TUTOR' and m.status='PENDING' and c.status='OPEN' and c.expires_at>now() order by m.created_at limit 1`.execute(db)).rows[0];if(!row)return;
 const lease=uuid();let ctx:Awaited<ReturnType<typeof tutorContext>>;
 const claimed=await db.transaction().execute(async tx=>{await holdLearner(tx,row.learner_id);try{await requireConsent(tx,row.learner_id,['LEARNING_DATA','AI_PROCESSING']);}catch{await sql`update tutor_message set status='BLOCKED',completed_at=now() where id=${row.id} and status='PENDING'`.execute(tx);return false;}
  const result=await sql`update tutor_message set moderation=moderation||${JSON.stringify({lease,until:Date.now()+30000})}::jsonb where id=${row.id} and status='PENDING' and coalesce((moderation->>'until')::bigint,0)<${Date.now()} returning id`.execute(tx);return result.rows.length>0;});if(!claimed)return;
 try{ctx=await tutorContext(db,row.learner_id,row.session_id);if(ctx.version!==row.moderation.version)throw Error();
  const index=await engine.choose(row.moderation.ask,ctx.choices,AbortSignal.timeout(20000));if(!Number.isInteger(index)||!ctx.choices[index])throw Error();
  await db.transaction().execute(async tx=>{await holdLearner(tx,row.learner_id);await requireConsent(tx,row.learner_id,['LEARNING_DATA','AI_PROCESSING']);const fresh=await tutorContext(tx,row.learner_id,row.session_id);if(fresh.version!==ctx.version)throw Error();
   const selected=ctx.choices[index]!,body=await learningService(key).tutor(tx,row.learner_id,row.session_id,selected.ask);
   const changed=await sql`update tutor_message set status='COMPLETED',text=${body.text},quick_replies=${JSON.stringify(body.quick)}::jsonb,intent='SOCRATIC_PROMPT',prompt_version='tutor@0.2.0',model='deepseek-flash',completed_at=now() where id=${row.id} and status='PENDING' and moderation->>'lease'=${lease} and (moderation->>'until')::bigint>${Date.now()} returning conversation_id`.execute(tx);
   if(!changed.rows.length)throw Error();await sql`update tutor_conversation set hints_used=${body.hintsUsed},updated_at=now() where id=${(changed.rows[0]as any).conversation_id}`.execute(tx);
  });
 }catch{await sql`update tutor_message set status='FAILED',completed_at=now() where id=${row.id} and status='PENDING' and moderation->>'lease'=${lease}`.execute(db);}
}
export async function eraseTutor(tx:Tx,id:string){await sql`delete from tutor_message where conversation_id in(select id from tutor_conversation where learner_id=${id})`.execute(tx);await sql`delete from tutor_conversation where learner_id=${id}`.execute(tx);}
