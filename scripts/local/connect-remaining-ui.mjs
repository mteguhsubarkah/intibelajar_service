import{readFileSync,writeFileSync}from'node:fs';
const root='../mockup/intibelajar/src/';
writeFileSync(root+'services/serverTutor.ts',`import {canonicalApi,operationKey}from './canonicalApi';
type Message={id:string;status:string;text?:string;quickReplies:string[]};
const conversations=new Map<string,Promise<{id:string}>>();
export async function serverTutor(sessionId:string,text:string){
 if(!conversations.has(sessionId))conversations.set(sessionId,canonicalApi<{id:string}>('/v1/tutor-conversations',{method:'POST',key:operationKey(),body:{sessionId}}).catch(e=>{conversations.delete(sessionId);throw e;}));
 const c=await conversations.get(sessionId)!;
 const result=await canonicalApi<{reply:Message}>('/v1/tutor-conversations/'+c.id+'/messages',{method:'POST',key:operationKey(),body:{text}});
 let reply=result.reply;for(let i=0;reply.status==='PENDING'&&i<15;i++){await new Promise(r=>setTimeout(r,2000));reply=await canonicalApi<Message>('/v1/tutor-messages/'+reply.id);}
 if(reply.status!=='COMPLETED'||!reply.text)throw Error('Tutor belum dapat menjawab.');
 const view=await canonicalApi<{hintsUsed:number}>('/v1/tutor-conversations/'+c.id);
 return{text:reply.text,quick:reply.quickReplies,hintsUsed:view.hintsUsed};
}
`);
let f=root+'components/coba/TutorDialog.vue',s=readFileSync(f,'utf8');
if(!s.includes("import {serverTutor}"))s=s.replace("import type { TutorReply }", "import {serverTutor}from '@/services/serverTutor';\nimport type { TutorReply }");
const old="canonicalApi<TutorReply>('/v1/learning/tutor',{method:'POST',key:operationKey(),body:{\n          ...backendContext(),sessionId:flowState.loop.id,questionId:'soal-menara',coreTitle:null,script:'menara',\n          messages:[{from:'me',text:message}],hintsUsed:0}})";
s=s.replace(old,"serverTutor(flowState.loop.id,message)").replace('Uji lokal · petunjuk bernaskah dari server, belum chatbot AI.','Uji lokal · naskah server; DeepSeek membantu memilih scaffolding hanya jika mode AI diaktifkan.');
writeFileSync(f,s);
f=root+'components/coba/StepQuestion.vue';s=readFileSync(f,'utf8');
if(!s.includes('const reporting =')){
 s=s.replace('import { computed, nextTick, ref }','import { computed, nextTick, ref, watch }');
 s=s.replace('import { track }',"import {canonicalApi,operationKey,ApiFailure}from '@/services/canonicalApi';\nimport { track }");
 s=s.replace('@click="report">{{ DIAGNOSIS.report }}','@click="report" :disabled="reporting">{{ reporting ? \'Mengirim…\' : DIAGNOSIS.report }}');
 s=s.replace('<span v-else class="report-done" role="status">{{ DIAGNOSIS.reported }}</span>','<span v-else class="report-done" role="status">{{ state.canonical ? \'Laporan tersimpan di server.\' : DIAGNOSIS.reported }}</span><span v-if="reportError" role="alert">{{ reportError }}</span>');
 s=s.replace('function report() {\n  reported.value = true;',`const reporting = ref(false);
const reportError = ref('');
let reportKey = operationKey();
watch(()=>state.loop?.activeDiagnosisRunId,async id=>{reported.value=false;reportKey=operationKey();if(state.canonical&&id){try{const r=await canonicalApi<{report?:unknown}>('/v1/diagnosis-runs/'+id);reported.value=!!r.report;}catch{/* Keep report retry available. */}}},{immediate:true});
async function report() {
 if(reporting.value)return;
 if(state.canonical&&state.loop?.activeDiagnosisRunId){reporting.value=true;reportError.value='';try{await canonicalApi('/v1/diagnosis-runs/'+state.loop.activeDiagnosisRunId+'/reports',{method:'POST',key:reportKey,body:{reason:'UNCLEAR_EXPLANATION'}});reported.value=true;}catch(e){if(e instanceof ApiFailure&&e.code==='ALREADY_REPORTED')reported.value=true;else reportError.value='Laporan belum tersimpan. Coba lagi.';}finally{reporting.value=false;}return;}
 reported.value = true;`);
}
writeFileSync(f,s);
f=root+'composables/useLearnerProgress.ts';s=readFileSync(f,'utf8');
if(!s.includes('serverMissions:')){
 s=s.replace('const state = reactive({',"const state = reactive({masteryByAlias:{} as Record<string,{uiTier:number;needsReview:boolean}>,serverMissions:null as {id:string;title:string;done:number;target:number}[]|null,");
 s=s.replace('state.status=\'ready\';',`state.masteryByAlias={};state.serverMissions=null;
        if(d.user){try{
          const [mr,sr]=await Promise.all([fetch(base+'/v1/me/mastery?limit=100',{credentials:'include',signal:controller.signal}),fetch(base+'/v1/me/stats',{credentials:'include',signal:controller.signal})]);
          if(mr.ok){const m=await mr.json();for(const v of m.items??[])if(typeof v.legacyMapId==='string'&&findCore(v.legacyMapId)&&Number.isInteger(v.uiTier)&&typeof v.needsReview==='boolean')state.masteryByAlias[v.legacyMapId]={uiTier:v.uiTier,needsReview:v.needsReview};}
          if(sr.ok){const stats=await sr.json();if(Array.isArray(stats.today?.missions))state.serverMissions=stats.today.missions.map((m:{code:string;title:string;done:number;target:number})=>({id:m.code,title:m.title,done:m.done,target:m.target}));}
        }catch{/* Legacy response remains compatible while canonical projections are unavailable. */}}
        state.status='ready';`);
 // The replacement may also match guest fallback: d is not in that catch scope, so keep that occurrence simple.
 const marker="} catch {\n        if (DEMO_MODE)";const pos=s.indexOf(marker);
 if(pos>=0){const before=s.slice(0,pos),after=s.slice(pos);const begin=after.indexOf('state.masteryByAlias={}'),end=after.indexOf("state.status='ready';",begin);if(begin>=0)s=before+after.slice(0,begin)+"state.masteryByAlias={};state.serverMissions=null;\n          "+after.slice(end);}
}
writeFileSync(f,s);
f=root+'composables/useLearnerView.ts';s=readFileSync(f,'utf8');
if(!s.includes('learner.masteryByAlias[coreId]')){
 s=s.replace('if (signedIn.value) {\n      const c = learner.cores', 'if (signedIn.value) {\n      const server = learner.masteryByAlias[coreId]; if(server)return server.uiTier;\n      const c = learner.cores');
 s=s.replace('if (!signedIn.value) return false;', 'if (!signedIn.value) return false;\n    const server = learner.masteryByAlias[coreId]; if(server)return server.needsReview;');
 s=s.replace('const missions = computed<Mission[]>(() => {','const missions = computed<Mission[]>(() => {\n    if(signedIn.value && learner.serverMissions)return learner.serverMissions;');
}
writeFileSync(f,s);
