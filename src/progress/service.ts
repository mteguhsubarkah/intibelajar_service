import{sql}from'kysely';import type{Tx,Connection}from'../db.js';
import{progressEvidence}from'../assessment/progress-facts.js';import{progressLearning}from'../learning/progress-facts.js';import{progressCatalog}from'../catalog/progress-facts.js';
import{masteryPolicy,type Fact}from'./policy.js';import{uuid,hmac,equal}from'../platform/crypto.js';import{fail}from'../platform/errors.js';
const levels=[[0,'Pemula'],[200,'Penjelajah'],[600,'Perintis'],[1500,'Navigator'],[3000,'Arsitek'],[5000,'Pemandu'],[8000,'Perancang'],[12000,'Cendekia'],[17000,'Pakar'],[24000,'Mahaguru']]as const;
const day=(date:Date,tz:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const labels:Record<string,string>={CONCEPT_VISITED:'Inti dikunjungi',ATTEMPT_GRADED:'Jawaban diperiksa',LESSON_COMPLETED:'Materi selesai',SESSION_COMPLETED:'Sesi selesai',MASTERY_CHANGED:'Pemahaman diperbarui',TIER_CHANGED:'Tingkat inti berubah',XP_AWARDED:'XP diperoleh',STREAK_EXTENDED:'Hari belajar',MISSION_COMPLETED:'Misi selesai',DEVICE_HISTORY_IMPORTED:'Riwayat perangkat diimpor'};
export async function rebuildProgress(tx:Tx,id:string,timezone:string,now=new Date()){
 await sql`select pg_advisory_xact_lock(hashtextextended(${'progress:'+id},0))`.execute(tx);
 const [learning,evidence,catalog]=await Promise.all([progressLearning(tx,id),progressEvidence(tx,id),progressCatalog(tx)]);
 const attempts=new Map(learning.attempts.map(a=>[a.id,a])),revisions=new Map(catalog.revisions.map(r=>[r.id,r]));
 const imported=(await sql<any>`select payload from progress_event where learner_id=${id} and type='DEVICE_HISTORY_IMPORTED'`.execute(tx)).rows;
 const views:any[]=[];const activeDates=new Set<string>();let dailyCorrect=0,dailyCombined=0,dailyLessons=0,dailyRefresh=0,reviewMission=false;const today=day(now,timezone);
 const dayStart=new Date(Date.parse(today+'T00:00:00Z')-({'Asia/Jakarta':7,'Asia/Makassar':8,'Asia/Jayapura':9}[timezone]??7)*3600000);
 const event=async(key:string,type:string,at:Date,session:string|null,payload:Record<string,unknown>={},xp=0)=>{
  await sql`insert into progress_event(id,learner_id,session_id,event_key,type,xp_delta,payload,local_date,occurred_at)
   values(${uuid()},${id},${session},${key},${type},${xp},${JSON.stringify(payload)}::jsonb,${day(at,timezone)}::date,${at}) on conflict(learner_id,event_key) do nothing`.execute(tx);
 };
 for(const a of learning.attempts.sort((a,b)=>new Date(a.submitted_at).getTime()-new Date(b.submitted_at).getTime()||a.id.localeCompare(b.id))){
  const at=new Date(a.submitted_at),r=revisions.get(a.question_revision_id);if(!r)continue;
  const es=evidence.filter(e=>e.attempt_id===a.id);
  const eligible=a.source==='LIVE'&&a.kind!=='QUICK_CHECK'&&a.assistance!=='SOLUTION'&&a.response_type!=='SELF_REPORT'&&es.some(e=>['DETERMINISTIC','EDUCATOR'].includes(e.source));
  if(eligible){activeDates.add(day(at,timezone));if(a.verdict==='CORRECT'){
   await event('xp:family:'+r.family_code,'XP_AWARDED',at,a.session_id,{rule:r.combined?'SOAL_GABUNGAN':'SOAL_BENAR'},r.combined?20:10);
   if(day(at,timezone)===today){dailyCorrect++;if(r.combined)dailyCombined++;}
  }}
  if(a.source==='LIVE'&&a.graded_at)await event('attempt:'+a.id,'ATTEMPT_GRADED',at,a.session_id);
 }
 for(const c of catalog.concepts){
  const es=evidence.filter(e=>e.concept_id===c.id),facts:Fact[]=es.flatMap(e=>{const a=attempts.get(e.attempt_id);return a?[{id:e.id,attemptId:a.id,sessionId:a.session_id,at:new Date(a.submitted_at),classification:e.classification,mastery:e.mastery_eligible,transfer:e.transfer_eligible,family:e.question_family_code,context:e.context_tag,kind:a.kind}]:[];});
  facts.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.attemptId.localeCompare(b.attemptId));
  const lessons=learning.lessons.filter(l=>l.concept_id===c.id),completed=lessons.filter(l=>l.status==='COMPLETED'),liveCompleted=completed.filter(l=>l.origin!=='DEVICE_IMPORT');
  const visited=learning.sessions.some(s=>s.focus_concept_id===c.id)||lessons.length>0||learning.attempts.some(a=>revisions.get(a.question_revision_id)?.concepts.includes(c.id));
  const importedLesson=imported.some(i=>i.payload.conceptId===c.id&&i.payload.lessonComplete===true);
  const v={conceptId:c.id,conceptCode:c.code,title:c.title,...(c.alias?{legacyMapId:c.alias}:{}),...masteryPolicy(facts,visited,completed.length>0||importedLesson,now)};views.push(v);
  await sql`insert into mastery_state(learner_id,concept_id,exploration,status,lesson_complete,practiced,transfer_streak,transfer_correct_total,qualifying_contexts,needs_review,needs_review_reason,ui_tier,demonstrated_at,last_practiced_at,policy_version)
   values(${id},${c.id},${v.exploration},${v.status},${v.lessonComplete},${v.practiced},${v.transferStreak},${v.transferCorrectTotal},${v.qualifyingContexts},${v.needsReview},${v.needsReviewReason??null},${v.uiTier},${v.demonstratedAt??null}::timestamptz,${v.lastPracticedAt??null}::timestamptz,'mastery-v1')
   on conflict(learner_id,concept_id) do update set exploration=excluded.exploration,status=excluded.status,lesson_complete=excluded.lesson_complete,practiced=excluded.practiced,transfer_streak=excluded.transfer_streak,transfer_correct_total=excluded.transfer_correct_total,qualifying_contexts=excluded.qualifying_contexts,needs_review=excluded.needs_review,needs_review_reason=excluded.needs_review_reason,ui_tier=excluded.ui_tier,demonstrated_at=excluded.demonstrated_at,last_practiced_at=excluded.last_practiced_at,updated_at=now(),version=mastery_state.version+1`.execute(tx);
  // Replay every historical prefix so first-tier awards survive a projection rebuild after contradiction.
  const reached=new Map<number,Fact>();for(let n=1;n<=facts.length;n++){const f=facts.slice(0,n),p=masteryPolicy(f,visited,completed.length>0,f.at(-1)!.at);for(let tier=1;tier<=p.uiTier;tier++)if(!reached.has(tier))reached.set(tier,f.at(-1)!);}
  if(masteryPolicy(facts.filter(f=>f.at<dayStart),visited,false,dayStart).needsReview)reviewMission=true;
  for(let n=1;n<facts.length;n++){const f=facts[n]!,prior=masteryPolicy(facts.slice(0,n),visited,false,f.at);if(f.mastery&&f.classification==='UNDERSTANDING_DEMONSTRATED'&&prior.needsReview){await event('xp:SEGARKAN:'+c.id+':'+day(f.at,timezone),'XP_AWARDED',f.at,f.sessionId,{conceptId:c.id,rule:'SEGARKAN'},5);if(day(f.at,timezone)===today)dailyRefresh++;}}
  for(const[tier,f]of reached)await event('xp:NAIK_TINGKAT:'+c.id+':'+tier,'XP_AWARDED',f.at,f.sessionId,{conceptId:c.id,rule:'NAIK_TINGKAT'},15);
  for(const l of liveCompleted){const at=new Date(l.completed_at);activeDates.add(day(at,timezone));await event('lesson:'+l.id,'LESSON_COMPLETED',at,l.session_id,{conceptId:c.id});}
  if(liveCompleted.length&&day(new Date(liveCompleted.sort((a,b)=>new Date(a.completed_at).getTime()-new Date(b.completed_at).getTime())[0]!.completed_at),timezone)===today)dailyLessons++;
 }
 for(const s of learning.sessions.filter(s=>s.completed_at)){await event('session:'+s.id,'SESSION_COMPLETED',new Date(s.completed_at),s.id);
  if(s.outcome==='SOLVED_AFTER_LEARNING'&&learning.lessons.some(l=>l.session_id===s.id&&l.status==='COMPLETED')&&evidence.some(e=>['DETERMINISTIC','EDUCATOR'].includes(e.source)&&attempts.get(e.attempt_id)?.session_id===s.id&&attempts.get(e.attempt_id)?.verdict==='CORRECT'&&attempts.get(e.attempt_id)?.assistance!=='SOLUTION'&&attempts.get(e.attempt_id)?.source==='LIVE')&&evidence.some(e=>e.classification==='MISCONCEPTION_EVIDENCED'&&attempts.get(e.attempt_id)?.session_id===s.id&&attempts.get(e.attempt_id)?.kind==='INITIAL'))
   await event('xp:TUNTAS:'+s.id,'XP_AWARDED',new Date(s.completed_at),s.id,{rule:'TUNTAS_SETELAH_BELAJAR'},30);
 }
 for(const d of activeDates)await event('streak:'+d,'STREAK_EXTENDED',new Date(d+'T12:00:00Z'),null);
 const days=[...activeDates].sort();let longest=0,current=0,prev='';for(const d of days){current=prev&&Date.parse(d)-Date.parse(prev)===86400000?current+1:1;longest=Math.max(longest,current);prev=d;}
 if(!prev||Date.parse(today)-Date.parse(prev)>86400000)current=0;
 const missions=[{code:'SOAL',title:'Kerjakan 2 soal',done:Math.min(2,dailyCorrect),target:2},reviewMission?{code:'SEGARKAN',title:'Segarkan 1 inti yang goyah',done:Math.min(1,dailyRefresh),target:1}:{code:'GABUNGAN',title:'Coba 1 soal gabungan',done:Math.min(1,dailyCombined),target:1},{code:'BARU',title:'Pelajari 1 inti baru',done:Math.min(1,dailyLessons),target:1}];
 const allDone=missions.every(m=>m.done>=m.target);for(const m of missions)if(m.done>=m.target)await event('mission:'+today+':'+m.code,'MISSION_COMPLETED',now,null,{code:m.code});
 if(allDone)await event('xp:MISI_HARIAN:'+today,'XP_AWARDED',now,null,{rule:'MISI_HARIAN'},30);
 const xp=Number((await sql<any>`select coalesce(sum(xp_delta),0) as total from progress_event where learner_id=${id}`.execute(tx)).rows[0].total);
 await sql`insert into learner_stats(learner_id,xp_total,current_streak_days,longest_streak_days,last_active_local_date,policy_version) values(${id},${xp},${current},${longest},${prev||null}::date,'mastery-v1')
  on conflict(learner_id) do update set xp_total=excluded.xp_total,current_streak_days=excluded.current_streak_days,longest_streak_days=excluded.longest_streak_days,last_active_local_date=excluded.last_active_local_date,version=learner_stats.version+1,updated_at=now()`.execute(tx);
 let i=0;while(i+1<levels.length&&xp>=levels[i+1]![0])i++;const l=levels[i]!;
 return{views,catalog,evidence,attempts,stats:{xpTotal:xp,level:{num:i+1,name:l[1],min:l[0],nextMin:levels[i+1]?.[0]??null},currentStreakDays:current,longestStreakDays:longest,streakFreezes:0,today:{localDate:today,missions,allDone},policyVersion:'mastery-v1'}};
}
export async function progressEvents(db:Connection,id:string){return(await sql<any>`select id,type,xp_delta,session_id,payload,local_date::text,occurred_at from progress_event where learner_id=${id} order by occurred_at desc,id desc`.execute(db)).rows.map(e=>({id:e.id,type:e.type,title:labels[e.type]??'Aktivitas belajar',xpDelta:e.xp_delta,...(e.session_id?{sessionId:e.session_id}:{}),...(e.payload.conceptId?{conceptId:e.payload.conceptId}:{}),localDate:e.local_date,occurredAt:new Date(e.occurred_at).toISOString()}));}
export function progressPage(items:any[],cursor:string|undefined,limit:number,key:Buffer,binding:string){let start=0;if(cursor){try{const [payload,signature]=cursor.split('.');if(!payload||!signature||!equal(hmac(key,binding+payload),Buffer.from(signature,'base64url')))throw Error();const d=JSON.parse(Buffer.from(payload,'base64url').toString());if(d.exp<Date.now()||!Number.isInteger(d.n)||d.n<0)throw Error();start=d.n;}catch{fail(400,'VALIDATION_FAILED');}}
 const end=start+limit,payload=Buffer.from(JSON.stringify({n:end,exp:Date.now()+86400000})).toString('base64url');return{items:items.slice(start,end),nextCursor:end<items.length?payload+'.'+hmac(key,binding+payload).toString('base64url'):null};}
export async function eraseProgress(tx:Tx,id:string){await sql`delete from learner_stats where learner_id=${id}`.execute(tx);await sql`delete from mastery_state where learner_id=${id}`.execute(tx);await sql`delete from progress_event where learner_id=${id}`.execute(tx);}
export async function recordDeviceHistory(tx:Tx,id:string,sessionId:string,conceptId:string|undefined,step:string){await sql`insert into progress_event(id,learner_id,session_id,event_key,type,payload,local_date)values(${uuid()},${id},${sessionId},${'device-history:'+sessionId},'DEVICE_HISTORY_IMPORTED',${JSON.stringify({...(conceptId?{conceptId}:{}),furthestStep:step,lessonComplete:['LESSON_FINISHED','COMPLETED'].includes(step)})}::jsonb,current_date)on conflict(learner_id,event_key)do nothing`.execute(tx);}
