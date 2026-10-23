export const levels = [['D','SMP · Fase D'],['E','SMA awal · Fase E'],['F','SMA lanjut · Fase F'],['F+','Matematika tingkat lanjut · Fase F+']];
export function selectCatalog(state, subject = '', phase = '') {
  const topics = state.topics.filter(t => (!subject || t.subject === subject) && (!phase || t.phase === phase));
  const topicCodes = new Set(topics.map(t=>t.code)), coreCodes = new Set(topics.flatMap(t=>t.concepts.map(c=>c.code)));
  const lessons = state.lessons.filter(l=>l.concepts.some(c=>coreCodes.has(c)));
  // Include incident cross-scope edges, labelled in UI/report, rather than hiding dependencies.
  const relations = state.topicRelations.relations.filter(r=>topicCodes.has(r.from)||topicCodes.has(r.to));
  const prerequisites = state.topics.flatMap(t=>t.prerequisites).filter(p=>coreCodes.has(p.concept)||coreCodes.has(p.requires));
  const codes = new Set([...topicCodes,...coreCodes,...lessons.map(l=>l.code)]);
  const sources = [...new Set(Object.entries(state.sources).filter(([code])=>codes.has(code)).flatMap(([,urls])=>urls))];
  return {topics,coreCodes,topicCodes,lessons,relations,prerequisites,sources};
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeSource = source => {try{const u=new URL(source);return u.protocol==='https:'?u.href:''}catch{return ''}};
function lines(text,max=34){const result=[];let line='';for(const word of String(text).split(/\s+/)){if((line+' '+word).length>max&&line){result.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)result.push(line);return result;}
export function graphSvg(nodes, edges, id='report') {
  // Small graph pages are split by caller. All full names remain in the adjacent list.
  const height=Math.max(130,Math.ceil(nodes.length/2)*106+25), positions=new Map(nodes.map((n,i)=>[n.code,{x:20+(i%2)*340,y:15+Math.floor(i/2)*106}]));
  const drawn=edges.filter(e=>positions.has(e.from)&&positions.has(e.to));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 ${height}" role="img" aria-label="Peta hubungan"><defs><marker id="${escape(id)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#536f69"/></marker></defs>${drawn.map(e=>{const a=positions.get(e.from),b=positions.get(e.to);return `<path d="M${a.x+145} ${a.y+68} L${b.x+145} ${b.y}" fill="none" stroke="#536f69" stroke-width="1.5" ${e.dashed?'stroke-dasharray="5 4"':''} ${!e.dashed||e.directed?`marker-end="url(#${escape(id)})"`:''}/>`}).join('')}${nodes.map(n=>{const p=positions.get(n.code),label=lines(n.title,34);return `<g><rect x="${p.x}" y="${p.y}" width="300" height="72" rx="8" fill="#f1f7f4" stroke="#aac1b6"/><text x="${p.x+10}" y="${p.y+20}" font-size="12" fill="#183b32">${label.slice(0,2).map((s,i)=>`<tspan x="${p.x+10}" dy="${i?15:0}">${escape(s)}${i===1&&label.length>2?'…':''}</tspan>`).join('')}</text><text x="${p.x+10}" y="${p.y+61}" font-size="8" fill="#4c625c">${escape(n.code)}</text></g>`}).join('')}</svg>`;
}
export function reportHtml(state, subject='', phase='', cssUrl='report.css') {
  const view=selectCatalog(state,subject,phase), allTopics=new Map(state.topics.map(t=>[t.code,t])), allCores=new Map(state.topics.flatMap(t=>t.concepts.map(c=>[c.code,c])));
  const name=code=>allTopics.get(code)?.title??allCores.get(code)?.title??code;
  const relationList=edges=>edges.length?`<ul class="edges">${edges.map(e=>`<li>${escape(name(e.from))} → ${escape(name(e.to))} <small>${escape(e.label)}</small></li>`).join('')}</ul>`:'<p class="muted">Belum ada relasi tercatat. Posisi pada graf bukan urutan belajar.</p>';
  let html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Peta kurikulum IntiBelajar - revisi ${state.revision}</title><link rel="stylesheet" href="${escape(cssUrl)}"></head><body><section class="cover"><p class="eyebrow">INTIBELAJAR / DRAF KURIKULUM</p><h1>Peta topik dan inti pembelajaran</h1><p>Revisi ${state.revision} · ${new Date().toLocaleDateString('id-ID')} · ${view.topics.length} topik · ${view.coreCodes.size} inti</p><p>Filter: ${escape(subject||'Semua pelajaran')} / ${escape(levels.find(([v])=>v===phase)?.[1]||'Semua jenjang')}.</p><p>Ringkasan editorial berdasarkan CP. Belum merupakan persetujuan konten atau publikasi ke siswa. F+ adalah label aplikasi untuk matematika tingkat lanjut SMA, bukan kuliah.</p><p>Panah: bekal → konsep yang memerlukan. Garis putus-putus: dukungan/hubungan. Daftar hubungan menyertakan relasi lintas halaman dan di luar filter.</p><p class="screen-only">Gunakan Ctrl+P → Simpan sebagai PDF. Pilih semua halaman dan ukuran A4.</p><h2>Daftar bagian</h2><ul>`;
  for(const s of state.subjects.subjects)for(const [p,label] of levels){const ts=view.topics.filter(t=>t.subject===s.code&&t.phase===p);if(ts.length)html+=`<li>${escape(s.title)} / ${escape(label)}: ${ts.length} topik, ${ts.reduce((n,t)=>n+t.concepts.length,0)} inti</li>`;}
  html+='</ul></section>';
  if(!view.topics.length)html+='<section><h2>Tidak ada topik untuk filter ini</h2></section>';
  let graphId=0;
  for(const s of state.subjects.subjects)for(const [p,label] of levels){
    const ts=view.topics.filter(t=>t.subject===s.code&&t.phase===p);if(!ts.length)continue;
    const ids=new Set(ts.map(t=>t.code));
    const edges=state.topicRelations.relations.filter(r=>ids.has(r.from)||ids.has(r.to)).map(r=>({from:r.kind==='REQUIRES'?r.to:r.from,to:r.kind==='REQUIRES'?r.from:r.to,dashed:r.kind==='RELATED',label:r.kind+' · '+r.label}));
    html+=`<section class="group"><p class="eyebrow">${escape(s.title)}</p><h1>${escape(label)}</h1><ul>${ts.map(t=>`<li>${escape(t.title)} <small>${escape(t.code)} · ${t.concepts.length} inti</small></li>`).join('')}</ul></section>`;
    for(let i=0;i<ts.length;i+=8)html+=`<section class="graph-page"><h2>${escape(s.title)} / ${escape(label)} · Peta topik ${1+i/8}</h2>${graphSvg(ts.slice(i,i+8),edges,'r'+graphId++)}<p class="muted">Panah yang melintasi halaman tercantum pada daftar hubungan berikut.</p></section>`;
    html+=`<section class="relations-page"><h2>Hubungan topik · ${escape(s.title)} / ${escape(label)}</h2>${relationList(edges)}</section>`;
    for(const t of ts){
      html+=`<section class="topic"><p class="eyebrow">${escape(s.title)} / ${escape(label)}</p><h2>${escape(t.title)}</h2><p class="muted">${escape(t.code)} · ${escape(t.review?.status??'Perlu review')} · ${t.concepts.length} inti</p>`;
      if(!t.concepts.length)html+='<p>Inti belum diisi.</p>';
      for(const c of t.concepts){const ls=state.lessons.filter(l=>l.concepts.includes(c.code));html+=`<article class="core"><h3>${escape(c.title)}</h3><small>${escape(c.code)}</small><p>${ls.length} materi terkait</p></article>`;}
      const sources=[...new Set([...(state.sources[t.code]??[]),...(t.review?.evidence??[])])].map(safeSource).filter(Boolean);
      html+=`<p class="sources">Sumber: ${sources.length?sources.map(u=>`<a href="${escape(u)}">${escape(u)}</a>`).join('<br>'):'Pemetaan sumber perlu ditinjau.'}</p></section>`;
      const coreIds=new Set(t.concepts.map(c=>c.code));
      const ce=state.topics.flatMap(t=>t.prerequisites).filter(r=>coreIds.has(r.concept)||coreIds.has(r.requires)).map(r=>({from:r.requires,to:r.concept,dashed:r.kind==='SOFT',directed:true,label:r.kind}));
      for(let i=0;i<t.concepts.length;i+=8)html+=`<section class="graph-page"><h2>Peta inti · ${escape(t.title)}${t.concepts.length>8?' · '+(1+i/8):''}</h2>${graphSvg(t.concepts.slice(i,i+8),ce,'r'+graphId++)}<p class="muted">Seluruh hubungan termasuk lintas topik tercatat pada daftar berikut.</p></section>`;
      html+=`<section class="core-relations"><h3>Hubungan inti · ${escape(t.title)}</h3>${relationList(ce)}</section>`;
    }
  }
  return html+'</body></html>';
}
