export interface Fact {id:string;attemptId:string;sessionId:string;at:Date;classification:string;mastery:boolean;transfer:boolean;family:string;context:string;kind:string;
 /** alasan bukti tidak dihitung untuk penguasaan (AI_ONLY, SOLUTION_SEEN, …) */reasons?:string[]}
/*
 * Kenal (tingkat 1) = "sudah benar menjawab 1 soal inti ini". Jawaban yang dinilai AI, memakai petunjuk, atau sesudah
 * kunci soal yang sama pernah tampil (kunci tercatat per keluarga soal, selamanya) tetap dihitung untuk tingkat ini;
 * yang tidak dihitung hanya cek singkat di dalam materi dan inti yang tidak bisa dinilai. Mahir dan Kuasai tetap hanya
 * dari bukti yang memenuhi syarat penguasaan (INV-10).
 */
const NOT_KENAL=['FORMATIVE_CHECK','NOT_ASSESSABLE'];
export function masteryPolicy(input:Fact[],visited:boolean,lesson:boolean,now:Date){
 const facts=[...input].sort((a,b)=>a.at.getTime()-b.at.getTime()||a.attemptId.localeCompare(b.attemptId));
 const m=facts.filter(e=>e.mastery),t=m.filter(e=>e.transfer);let demonstrated:Date|null=null,review=false;
 for(let i=0;i<t.length;i++){
  const tail=t.slice(Math.max(0,i-2),i+1),e=t[i]!;
  if(demonstrated){if(e.classification==='MISCONCEPTION_EVIDENCED'){review=true;if(tail.filter(x=>x.classification==='MISCONCEPTION_EVIDENCED').length>=2){demonstrated=null;review=false;}}else review=false;}
  if(!demonstrated&&tail.length===3&&tail.every(x=>x.classification==='UNDERSTANDING_DEMONSTRATED')&&new Set(tail.map(x=>x.family)).size===3&&new Set(tail.map(x=>x.context)).size>=2
   &&tail.some(x=>x.sessionId!==tail[0]!.sessionId&&x.at.getTime()-tail[0]!.at.getTime()>=86400000))demonstrated=e.at;
 }
 const correct=m.filter(e=>e.classification==='UNDERSTANDING_DEMONSTRATED').length,total=t.filter(e=>e.classification==='UNDERSTANDING_DEMONSTRATED').length;
 let streak=0;for(let i=t.length-1;i>=0&&t[i]!.classification==='UNDERSTANDING_DEMONSTRATED'&&streak<3;i--)streak++;
 const kenal=facts.some(e=>e.classification==='UNDERSTANDING_DEMONSTRATED'&&!(e.reasons??[]).some(r=>NOT_KENAL.includes(r)));
 const tier=demonstrated?3:correct?total?2:1:kenal?1:(facts.length||visited||lesson)?0:-1,last=m.at(-1)?.at;
 const stale=tier>=2&&!!last&&now.getTime()-last.getTime()>14*86400000;
 return{status:demonstrated?'DEMONSTRATED':m.length?'DEVELOPING':'NOT_ASSESSED',uiTier:tier,exploration:visited||facts.length||lesson?'VISITED':'UNVISITED',lessonComplete:lesson,
 practiced:m.some(e=>['PRACTICE','TRANSFER'].includes(e.kind)),transferStreak:streak,transferCorrectTotal:total,qualifyingContexts:streak?new Set(t.slice(-streak).map(e=>e.context)).size:0,
 needsReview:review||stale,...(review||stale?{needsReviewReason:review?'CONTRADICTION':'STALE_14D'}:{}),...(demonstrated?{demonstratedAt:demonstrated.toISOString()}:{}),...(last?{lastPracticedAt:last.toISOString()}:{}),policyVersion:'mastery-v1'};
}
