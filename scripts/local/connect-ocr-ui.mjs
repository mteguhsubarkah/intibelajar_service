import{readFileSync,writeFileSync}from'node:fs';const root='../mockup/intibelajar/src/';
writeFileSync(root+'services/serverOcr.ts',`import {canonicalApi,readSession,operationKey}from './canonicalApi';
type Intake={id:string;status:string;draftText?:string;failureCode?:string};
export async function serverOcr(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw Error('Gunakan JPEG/PNG/WebP maksimal 5 MB.');
 const intake=await canonicalApi<Intake>('/v1/question-intakes',{method:'POST',key:operationKey(),body:{inputMode:'PHOTO'}});
 const session=await readSession();
 const response=await fetch('/v1/question-intakes/'+intake.id+'/image',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':file.type,'X-CSRF-Token':session.csrfToken??''},body:file});
 if(!response.ok)throw Error('Foto belum dapat dibaca. Periksa konfigurasi OCR dan izin upload.');
 let read=await response.json() as Intake;for(let i=0;read.status==='READING'&&i<25;i++){await new Promise(r=>setTimeout(r,2000));read=await canonicalApi<Intake>('/v1/question-intakes/'+intake.id);}
 if(read.status!=='READ'||!read.draftText)throw Error('OCR belum tersedia. Kamu tetap bisa mengetik soal.');
 return {data:{text:read.draftText,demo:false},source:'backend' as const};
}
`);
const f=root+'services/intake.ts';let s=readFileSync(f,'utf8');if(!s.includes("import {serverOcr}")){
 s="import {serverOcr}from './serverOcr';\nimport {canonicalLearner}from './learningSessions';\n"+s;
 s=s.replace('export async function readPhotoWithBackend(context: FlowContext, file: File) {','export async function readPhotoWithBackend(context: FlowContext, file: File) {\n  if(await canonicalLearner())return serverOcr(file);');
}
writeFileSync(f,s);
