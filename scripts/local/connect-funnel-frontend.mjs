// Applies the authorized local FE integration to the sibling checkout. Exact anchors fail closed.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('../mockup/intibelajar');
function edit(path, changes) {
  const full = resolve(root,path); let s = readFileSync(full,'utf8').replaceAll('\r\n','\n');
  for (const [before,after] of changes) { if (!s.includes(before)) throw new Error('Missing anchor: '+path+' '+before.slice(0,60)); s=s.replace(before,after); }
  writeFileSync(full,s);
}
edit('src/services/canonicalLoop.ts',[
  ["import { catalogTitles, questionIdsOf }", "import { conceptIdOf, question, catalogTitles, questionIdsOf }"],
  ["  activeAttemptId?: string;", "  lesson?: { lessonId: string; slideIndex: number; checks: {microAssessmentId:string; questionId:string; slideIndex:number; answered:boolean; verdict?:string}[] };\n  activeAttemptId?: string;"],
]);
const loopFile=resolve(root,'src/services/canonicalLoop.ts');
writeFileSync(loopFile,readFileSync(loopFile,'utf8')+`
/** D3: the actual in-flow lesson and required check belong to this loop, never a separate practice session. */
export async function enterFunnelLesson(loop: LoopView): Promise<LoopView> {
  loop = await getLoop(loop.id);
  if (loop.lesson || !loop.allowedActions.includes('START_LESSON')) return loop;
  const conceptId = await conceptIdOf('tri-d');
  if (!conceptId) throw new Error('Materi belum tersedia.');
  const r = await act<{session:LoopView}>(loop.id,'actions',{type:'START_LESSON',conceptId,expectedStateVersion:loop.stateVersion});
  return r.ok ? r.value.session : r.loop;
}
export async function advanceFunnelLesson(loop: LoopView): Promise<LoopView> {
  loop = await enterFunnelLesson(loop);
  if (loop.state !== 'MICROLEARNING' || loop.lesson?.slideIndex === 1) return loop;
  const r = await act<{session:LoopView}>(loop.id,'actions',{type:'ADVANCE_LESSON',slideIndex:1,expectedStateVersion:loop.stateVersion});
  return r.ok ? r.value.session : r.loop;
}
export async function checkFunnelLesson(loop: LoopView, optionIndex:number) {
  loop = await advanceFunnelLesson(loop);
  const check=loop.lesson?.checks.find(c=>c.slideIndex===1);
  if (!check) throw new Error('Cek materi belum tersedia di server.');
  if (check.answered) return {loop,data:{correct:check.verdict==='CORRECT'}};
  const q=await question(check.questionId);
  if (q.legacyItemId!=='c4' || !q.options?.[optionIndex]) throw new Error('Cek materi tidak cocok dengan tampilan.');
  const r=await act<{session:LoopView;attempt:{verdict:string};diagnosisRun:{revealedAnswer?:{optionId?:string}}}>(loop.id,'quick-check-answers',{
    expectedStateVersion:loop.stateVersion,microAssessmentId:check.microAssessmentId,response:{responseType:'OPTION',optionId:q.options[optionIndex].id}});
  if (!r.ok) throw new Error('Sesi berubah. Muat ulang materi.');
  return {loop:r.value.session,data:{correct:r.value.attempt.verdict==='CORRECT',correctOptionIndex:q.options.findIndex(o=>o.id===r.value.diagnosisRun.revealedAnswer?.optionId)}};
}
export async function finishFunnelLesson(loop: LoopView): Promise<LoopView> {
  loop=await getLoop(loop.id);
  if(loop.state==='RETRY')return loop;
  const r=await act<{session:LoopView}>(loop.id,'actions',{type:'FINISH_LESSON',expectedStateVersion:loop.stateVersion});
  if(!r.ok)throw new Error('Sesi berubah. Muat ulang materi.');
  return r.value.session;
}
`);
edit('src/composables/useCobaFlow.ts',[
  ['import { attemptText,', 'import { enterFunnelLesson, advanceFunnelLesson, checkFunnelLesson, finishFunnelLesson, attemptText,'],
  ['    const result = isCanonicalLessonItem(id)', '    const funnel = state.canonical && state.loop && id === MATERI_CHECK ? await checkFunnelLesson(state.loop, optionIndex) : null;\n    if (funnel) state.loop = funnel.loop;\n    const result = funnel ? { data: funnel.data } : isCanonicalLessonItem(id)'],
  ['  async function answerCheckWithBackend(id:', `  async function openFunnelMaterial() {
    if (!state.canonical || !state.loop) return;
    state.loop = await enterFunnelLesson(state.loop);
    const answered=state.loop.lesson?.checks.find(c=>c.answered);
    if(answered){state.checks[MATERI_CHECK]=-1;state.checkResults[MATERI_CHECK]={correct:answered.verdict==='CORRECT'};}
  }
  async function nextFunnelMaterial() {
    if(state.canonical && state.loop)state.loop=await advanceFunnelLesson(state.loop);
  }
  async function finishFunnelMaterial() {
    if(state.canonical && state.loop)state.loop=await finishFunnelLesson(state.loop);
  }
  async function answerCheckWithBackend(id:`],
  ['    retryQuestion,','    openFunnelMaterial, nextFunnelMaterial, finishFunnelMaterial,\n    retryQuestion,'],
  ['      await showLoopRun(loop);\n      if (loop.state === "RETRY"', '      await showLoopRun(loop);\n      if (["MICROLEARNING","QUICK_CHECK"].includes(loop.state)) goTo(3);\n      if (loop.state === "RETRY"'],
]);
edit('src/components/coba/StepMateri.vue',[
  ['computed, nextTick, ref','computed, nextTick, ref, onMounted'],
  ['const { state } = useCobaFlow();','const { state, openFunnelMaterial, nextFunnelMaterial, finishFunnelMaterial } = useCobaFlow();\nconst busy = ref(false), serverError = ref(\'\');\nonMounted(async()=>{busy.value=true;try{await openFunnelMaterial();cur.value=state.loop?.lesson?.slideIndex ?? 0;}catch{serverError.value=\'Materi belum bisa dibuka. Muat ulang untuk mencoba lagi.\';}finally{busy.value=false;}});'],
  ['function next() {','async function next() {\n  if(busy.value)return; busy.value=true;serverError.value=\'\';\n  try {'],
  ['    cur.value = 1;','    await nextFunnelMaterial();\n    cur.value = 1;'],
  ['  emit("done", state.checkResults[MATERI_CHECK]?.correct === true);\n}', '  await finishFunnelMaterial();\n  emit("done", state.checkResults[MATERI_CHECK]?.correct === true);\n  }catch{serverError.value=\'Langkah belum tersimpan. Coba lagi.\';}finally{busy.value=false;}\n}'],
  [':disabled="cur === 1 && !answered"', ':disabled="busy || (cur === 1 && !answered)"'],
  ['    <div class="materi-bar">','    <p v-if="serverError" role="alert">{{ serverError }}</p>\n    <div class="materi-bar">'],
]);
edit('src/components/coba/TutorDialog.vue',[
  ["import { DEMO_MODE,", "import { canonicalApi, operationKey } from '@/services/canonicalApi';\nimport type { TutorReply } from '@/services/tutor';\nimport { DEMO_MODE,"],
  ['const { backendContext } = useCobaFlow();','const { backendContext, state: flowState } = useCobaFlow();'],
  ['    const result = await tutorWithBackend(', `    const result = flowState.canonical && flowState.loop
      ? {source:'backend' as const,data:await canonicalApi<TutorReply>('/v1/learning/tutor',{method:'POST',key:operationKey(),body:{
        ...backendContext(),sessionId:flowState.loop.id,questionId:'soal-menara',coreTitle:null,script:'menara',
        messages:[{from:'me',text:message}],hintsUsed:0}})}
      : await tutorWithBackend(`],
  ['    <input id="tutor-input"', '    <input maxlength="500" id="tutor-input"'],
]);
console.log('D3 lesson and D6 server tutor connected in frontend.');
