import{readFileSync,writeFileSync}from'node:fs';const root='../mockup/intibelajar/src/';
let f=root+'components/coba/TutorDialog.vue',s=readFileSync(f,'utf8');
const start=s.indexOf("canonicalApi<TutorReply>('/v1/learning/tutor'"),end=s.indexOf(': await tutorWithBackend',start);
if(start>=0&&end>start)s=s.slice(0,start)+"serverTutor(flowState.loop.id,message)}\n      "+s.slice(end);
writeFileSync(f,s);
f=root+'composables/useLearnerProgress.ts';s=readFileSync(f,'utf8');
if(!s.includes('profileGrade:'))s=s.replace('masteryByAlias:{}','profileGrade:null as number|null,masteryByAlias:{}');
if(!s.includes('const pr=await fetch'))s=s.replace("if(d.user){try{", "if(d.user){try{\n          const pr=await fetch(base+'/v1/me/profile',{credentials:'include',signal:controller.signal});if(pr.ok){const p=await pr.json();state.profileGrade=typeof p.grade==='number'?p.grade:null;}");
writeFileSync(f,s);
f=root+'composables/useLearnerView.ts';s=readFileSync(f,'utf8').replace('computed(() => studyPreferences.grade)','computed(() => signedIn.value ? learner.profileGrade : studyPreferences.grade)');writeFileSync(f,s);
writeFileSync(root+'services/deviceImport.ts',`import {canonicalApi,operationKey}from './canonicalApi';
import {loadLearningSession}from './persistence/learningSessionStorage';
export const deviceHistory=()=>loadLearningSession();
export async function importDeviceHistory(includeAnswerText:boolean){
 const d=deviceHistory();if(!d)throw Error('Tidak ada riwayat perangkat.');
 if(d.questionId!=='soal-menara')throw Error('Import lokal saat ini hanya mendukung soal menara.');
 const text=d.workingRaw??d.selectedAnswerRaw??'';
 const furthestStep=['result'].includes(d.stage)?'COMPLETED':['retry'].includes(d.stage)?'LESSON_FINISHED':['core','diagnosis'].includes(d.stage)?'DIAGNOSIS_SEEN':'QUESTION';
 const r=await canonicalApi<{session:{id:string;checkpoint:{route:string}}}>('/v1/me/device-imports',{method:'POST',key:operationKey(),body:{deviceSessionId:d.id,questionAlias:d.questionId,furthestStep,includeAnswerText,...(includeAnswerText&&text?{answerText:text.slice(0,2000)}:{})}});
 localStorage.setItem('intibelajar.loop.coba',r.session.id);return r.session.checkpoint.route;
}
`);
f=root+'views/Slice0AccountView.vue';s=readFileSync(f,'utf8');
if(!s.includes('const includeDeviceAnswer')){
 s=s.replace("import {computed,onMounted,onUnmounted,ref}","import {deviceHistory,importDeviceHistory}from '@/services/deviceImport';\nimport {computed,onMounted,onUnmounted,ref}");
 s=s.replace("const completed=ref(false);","const completed=ref(false);\nconst localHistory=ref(deviceHistory());\nconst includeDeviceAnswer=ref(false);\nconst importHistory=()=>run(async()=>{await router.push(await importDeviceHistory(includeDeviceAnswer.value));});");
 s=s.replace('<button v-if="session?.authenticated" type="button" @click="logout"', '<section v-if="session?.learner?.status === \'ACTIVE\' &amp;&amp; localHistory"><h2>Simpan perjalanan dari perangkat ini?</h2><p>Riwayat impor tidak memberi XP atau bukti penguasaan. Untuk melanjutkan, jawaban diperiksa lagi oleh server.</p><label><input type="checkbox" v-model="includeDeviceAnswer"> Sertakan jawabanku</label><button type="button" @click="importHistory" :disabled="busy">Impor riwayat perangkat</button></section>\n        <button v-if="session?.authenticated" type="button" @click="logout"');
 // Vue directive expressions use JavaScript operators, not HTML entity text.
 s=s.replace("=== 'ACTIVE' &amp;&amp; localHistory", "=== 'ACTIVE' && localHistory");
}
writeFileSync(f,s);
