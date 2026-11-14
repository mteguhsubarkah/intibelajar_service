import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPilot} from '../scripts/catalog/pilot.js';

/*
 * Tahap 3 audit Fisika: inti tidak bisa pindah bab (CONCEPT_TOPIC_CHANGED), jadi inti yang pindah atau dipecah ditulis
 * ulang sebagai inti baru dan inti lamanya tetap di manifest sebagai hidden (tanpa materi, soal, prasyarat, atau kelas).
 * Inti yang hanya ganti judul memakai codeFrom: kode konsep, materi, dan soal tetap sama, jadi progres siswa aman.
 */
test('pilot: hidden cores and renamed cores keep catalog identity',()=>{
  const {topics,questions,lessons}=buildPilot();
  const concept=(code:string)=>topics.flatMap(t=>t.concepts.map(c=>({...c,topic:t.code}))).find(c=>c.code===code);
  const used=(code:string)=>[...questions.filter(q=>q.concepts.some(c=>c.concept===code)).map(q=>q.code),...lessons.filter(l=>l.concepts.includes(code)).map(l=>l.code)];
  for(const code of ['FIS.C26.D.GERAK.TEKANAN','FIS.C26.D.ENERGI.SUHU_DAN_PERPINDAHAN_KALOR','FIS.C26.D.ENERGI.KALOR_JENIS','FIS.C26.D.GELOMBANG.BUNYI_DAN_OPTIK','FIS.C26.F.GELOMBANG.RESONANSI_DAN_OPTIK']){
    const c=concept(code);
    assert.ok(c,code);
    assert.deepEqual([c.hidden,c.capstone,c.availability,c.grade],[true,false,'PLANNED',undefined],code);
    assert.deepEqual(used(code),[],code+' has no lesson or question');
    const t=topics.find(x=>x.code===c.topic)!;
    assert.equal(t.prerequisites.some(p=>p.concept===code||p.requires===code),false,code+' has no prerequisite');
    assert.ok(t.concepts.filter(x=>!x.hidden).every(x=>x.ordinal<c.ordinal),code+' comes after the visible cores');
  }
  // Moved content lives on under new codes in the new chapters.
  for(const code of ['FIS.C26.D.SUHU.SUHU_DAN_PERPINDAHAN_KALOR','FIS.C26.D.SUHU.KALOR_JENIS','FIS.C26.D.TEKANAN.TEKANAN_ZAT_PADAT','FIS.C26.D.GELOMBANG.ALAT_OPTIK','FIS.C26.F.GELOMBANG.RESONANSI_BUNYI'])
    assert.equal(concept(code)?.availability,'READY',code);
  // Renamed cores: new title, same concept, lesson and question codes.
  for(const [code,title,lesson] of [['FIS.C26.F.MEKANIKA.HUKUM_NEWTON_DAN_MOMENTUM','Hukum Newton dan sistem benda','FIS.C26.F.MEKANIKA.L.HUKUM_NEWTON_DAN_MOMENTUM'],
    ['FIS.C26.D.GERAK.GERAK_DAN_GAYA_RESULTAN','Gaya dan berat benda','FIS.C26.D.GERAK.L.GERAK_DAN_GAYA_RESULTAN'],
    ['FIS.C26.F.MODERN.KUANTUM_DAN_INTI_ATOM','Gejala kuantum','FIS.C26.F.MODERN.L.KUANTUM_DAN_INTI_ATOM']] as const){
    assert.equal(concept(code)?.title,title);
    assert.equal(concept(code)?.hidden,false);
    assert.ok(lessons.some(l=>l.code===lesson&&l.concepts.includes(code)),lesson);
  }
  assert.ok(questions.some(q=>q.code==='FIS.C26.F.MEKANIKA.Q.HUKUM_NEWTON_DAN_MOMENTUM_1'));
});
