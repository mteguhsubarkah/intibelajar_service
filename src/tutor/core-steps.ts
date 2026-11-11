import type {GuideCoreRef} from './context-guide.js';

type Step={description:string;concepts:{code:string;role:string}[]};
type Concept={code:string;title:string;legacyMapId:string|null};

/**
 * Daftar inti IntiGuide untuk satu soal katalog, dari kunci soalnya (langkah penyelesaian pertama di rubrik).
 * - Urutan: inti dibahas mengikuti urutan langkah penyelesaian soal ini (soal kompor: setarakan, lalu mol, lalu
 *   perhitungan), bukan urutan kurikulum. Inti yang tidak muncul di langkah mana pun menyusul, urutan katalog.
 * - step: langkah soal ini yang memakai inti itu, supaya IntiGuide menuntun siswa mengerjakan langkah itu dan inti
 *   baru tuntas sesudah langkahnya selesai (bukan sesudah satu jawaban benar).
 * - Langkah terakhir memuat jawaban akhir soal: tidak pernah dikirim ke model, intinya hanya ditandai final.
 * Soal tanpa langkah penyelesaian (soal sendiri): urutan katalog, tanpa step (IntiGuide memakai aturan lama).
 */
export function orderedGuideCores(concepts:Concept[],paths:{steps:Step[]}[]|undefined):GuideCoreRef[]{
 const steps=paths?.find(p=>p.steps?.length)?.steps??[];
 const plain=concepts.map(c=>({id:c.legacyMapId??c.code,title:c.title}));
 if(!steps.length)return plain;
 const last=steps.length-1;
 // langkah yang memakai inti: REQUIRED dulu; inti yang hanya pendukung tetap dipakai bila tidak ada langkah wajibnya
 const owned=(code:string)=>{
  const of=(role?:string)=>steps.flatMap((s,i)=>s.concepts.some(c=>c.code===code&&(!role||c.role===role))?[i]:[]);
  const required=of('REQUIRED');return required.length?required:of();
 };
 return concepts.map((c,k)=>{
  const at=owned(c.code);
  const visible=at.filter(i=>i<last).map(i=>steps[i]!.description.trim()).filter(Boolean);
  return{core:{...plain[k]!,step:visible.length?visible.join(' lalu '):null,...(at.includes(last)?{final:true}:{})},first:at.length?Math.min(...at):Number.MAX_SAFE_INTEGER,k};
 }).sort((a,b)=>a.first-b.first||a.k-b.k).map(x=>x.core);
}
