import { selectCatalog, reportHtml } from './catalog-view.js';
import { createLessonEditor } from './lesson-editor.js';
import { createPracticeEditor } from './practice-editor.js';
/* Private authoring client: no external scripts, fonts, analytics or learner data. */
let token = '', state, tab = 'overview';
const $ = s => document.querySelector(s);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').className = error ? 'error' : ''; }
async function api(path, data) {
  const r = await fetch('api/' + path, { method: data ? 'POST' : 'GET', headers: { 'X-Backoffice-Key': token, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify({ ...data, revision: state?.revision }) } : {}) });
  const b = await r.json(); if (!r.ok) throw new Error(b.message + (b.details ? '\n' + b.details.slice(0, 5).map(x => x.rule + ': ' + x.message).join('\n') : '')); return b;
}
function show(name) {
  tab = name; document.querySelectorAll('[data-panel]').forEach(n => n.hidden = n.dataset.panel !== name);
  document.querySelectorAll('[data-tab]').forEach(n => n.classList.toggle('active', n.dataset.tab === name));
  $('#pageTitle').textContent = $(`[data-tab="${name}"]`).textContent;
  if (name === 'graph' && state) graph();
  if (name === 'practice' && state) practiceEditor.render();
}
document.querySelectorAll('[data-tab]').forEach(n => n.onclick = () => show(n.dataset.tab));
function row(host, title, note, onEdit) {
  const n = el('div', undefined, 'row'), text = el('div'); text.append(el('p', title), el('small', note)); n.append(text);
  if (onEdit) { const b = el('button', 'Edit'); b.onclick = onEdit; n.append(b); }
  host.append(n); return n;
}
function fill(form, values) { for (const [k,v] of Object.entries(values)) if (form.elements.namedItem(k)) form.elements.namedItem(k).value = v ?? ''; }
function revealTopic(t){if(!visible().topicCodes.has(t.code)){$('#subjectFilter').value=t.subject;$('#phaseFilter').value=t.phase;render();}}
function topicEdit(t) { revealTopic(t); show('topics'); fill($('#topicForm'), { ...t, source: state.sources[t.code]?.[0] ?? t.review?.evidence?.[0] ?? '' }); }
function coreEdit(t,c) { revealTopic(t); show('cores'); fill($('#coreForm'), { ...c, topic: t.code, objectives: c.objectives.join('\n'), source: state.sources[c.code]?.[0] ?? c.review?.evidence?.[0] ?? '' }); }
function lessonEdit(l) { show('lessons'); lessonEditor.open(l); }
function populate(select, options) { const previous = select.value; select.replaceChildren(); for (const [value,label] of options) { const o = el('option',label); o.value=value; select.append(o); } if (options.some(([v]) => v === previous)) select.value=previous; }
function visible() { return selectCatalog(state, $('#subjectFilter').value, $('#phaseFilter').value); }
function render() {
  $('#login').hidden = true; $('#workspace').hidden = false;
  const view = visible();
  populate($('#subjectFilter'), [['','Semua pelajaran'],...state.subjects.subjects.map(s=>[s.code,s.title])]);
  populate($('#topicSubject'), state.subjects.subjects.map(s=>[s.code,s.title]));
  const cores = view.topics.flatMap(t => t.concepts.map(c => [c.code, c.title]));
  document.querySelectorAll('.topicSelect').forEach(n => populate(n,view.topics.map(t => [t.code,`${t.title} · ${t.phase}`])));
  document.querySelectorAll('.coreSelect').forEach(n => populate(n,cores));
  $('#coreCodes').replaceChildren(...cores.map(([value]) => { const o = el('option'); o.value = value; return o; }));
  $('#stats').replaceChildren();
  for (const [n, label] of [[view.topics.length,'Topik'],[cores.length,'Inti'],[view.lessons.length,'Materi'],[coresWithout(view,'lesson').length,'Inti tanpa materi'],[coresWithout(view,'practice').length,'Inti tanpa latihan']]) { const d = el('div',undefined,'stat'); d.append(el('strong',n),el('span',label)); $('#stats').append(d); }
  $('#reviewCount').textContent = `${state.findings.length} temuan sebelum publikasi · revisi draf ${state.revision}`;
  $('#overviewTopics').replaceChildren(); $('#topicList').replaceChildren();
  for (const t of view.topics) {
    const a=el('article'); a.append(el('p',`FASE ${t.phase} · ${t.code}`,'eyebrow'),el('h3',t.title),el('p',`${t.concepts.length} inti · ${t.review?.status ?? 'status dari manifest'}`)); const b=el('button','Buka topik');b.onclick=()=>topicEdit(t);a.append(b);$('#overviewTopics').append(a);
    row($('#topicList'),t.title,`${t.code} · ${t.phase}`,()=>topicEdit(t));
  }
  renderCores(); $('#relationList').replaceChildren();
  for (const r of view.relations) row($('#relationList'),`${r.from} ${r.kind === 'REQUIRES' ? 'memerlukan' : 'berkaitan dengan'} ${r.to}`, r.label + (!view.topicCodes.has(r.from)||!view.topicCodes.has(r.to)?' · lintas filter':''), () => { $('#subjectFilter').value='';$('#phaseFilter').value='';render();show('relations'); fill($('#relationForm'),{code:r.from,to:r.to,type:r.kind,label:r.label}); });
  for (const p of view.prerequisites) row($('#relationList'),`${p.concept} memerlukan ${p.requires}`,p.kind + (!view.coreCodes.has(p.concept)||!view.coreCodes.has(p.requires)?' · lintas filter':''),()=>{$('#subjectFilter').value='';$('#phaseFilter').value='';render();show('relations');fill($('#prerequisiteForm'),{code:p.concept,to:p.requires,type:p.kind});});
  $('#lessonList').replaceChildren(); for (const l of view.lessons) row($('#lessonList'),l.title,`${l.code} · ${Math.max(...l.blocks.map(b=>b.slide))+1} slide`,()=>lessonEdit(l));
  $('#lessonMissing').replaceChildren(); for (const [t,c] of coresWithout(view,'lesson')) { const n=row($('#lessonMissing'),c.title,`${t.title} · ${c.code}`); const b=el('button','Buat materi'); b.onclick=()=>{show('lessons');lessonEditor.forCore(t,c);}; n.append(b); }
  if (!$('#lessonMissing').children.length) $('#lessonMissing').append(el('p','Semua inti di filter ini sudah punya materi.','muted'));
  lessonEditor.refresh(); if (tab === 'practice') practiceEditor.render();
  $('#jobs').replaceChildren(); for (const j of state.jobs) row($('#jobs'),j.status,j.message ?? 'Menunggu worker / sedang diproses');
  $('#findings').replaceChildren(); for (const f of state.findings.filter(f=>!$('#subjectFilter').value||f.file.includes($('#subjectFilter').value)||!state.subjects.subjects.some(s=>f.file.includes(s.code+'.')))) row($('#findings'),`${f.rule} · ${f.file}`,f.message);
  $('#sources').replaceChildren(); const urls = new Set(view.sources); for(const url of urls){const a=el('a',url);a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('#sources').append(a);}
  $('#audit').replaceChildren(); for(const a of state.audit.slice().reverse())row($('#audit'),a.action,`${a.at} · revisi ${a.revision}`);
  $('#importSeed').disabled = Boolean($('#subjectFilter').value && $('#subjectFilter').value !== 'MAT') || ['D','F+'].includes($('#phaseFilter').value);
  $('#filterSummary').textContent = `${view.topics.length} dari ${state.topics.length} topik · filter berlaku di semua tab. Hubungan lintas filter tetap ditandai.`;
  if(tab==='graph')graph();
}
function lessonsOf(code){return state.lessons.filter(l=>l.concepts.includes(code));}
function practiceOf(code){return state.practice.filter(q=>q.concepts.includes(code));}
/* Inti dalam filter yang belum punya materi / latihan: [topik, inti] */
function coresWithout(view,what){return view.topics.flatMap(t=>t.concepts.filter(c=>!c.hidden).map(c=>[t,c])).filter(([,c])=>what==='lesson'?!lessonsOf(c.code).length:!practiceOf(c.code).length);}
function renderCores(){
  const t=state.topics.find(t=>t.code===$('#coreFilter').value),mode=$('#coreStatus').value;$('#coreList').replaceChildren();
  const all=t?.concepts??[],shown=all.filter(c=>mode==='no-lesson'?!lessonsOf(c.code).length:mode==='no-practice'?!practiceOf(c.code).length:mode==='no-definition'?!c.definition:true);
  $('#coreSummary').textContent=t?`${shown.length} dari ${all.length} inti · ${all.filter(c=>!lessonsOf(c.code).length).length} belum ada materi · ${all.filter(c=>!practiceOf(c.code).length).length} belum ada latihan`:'';
  for(const c of shown){
    const ls=lessonsOf(c.code),qs=practiceOf(c.code);
    const n=row($('#coreList'),c.title,`${c.code} · ${c.definition??'Belum ada definisi'}`,()=>coreEdit(t,c));
    const chips=el('div',undefined,'chips');
    chips.append(el('span',ls.length?`Materi · ${Math.max(...ls[0].blocks.map(b=>b.slide))+1} slide`:'Belum ada materi',ls.length?'chip ok':'chip warn'),el('span',qs.length?`Latihan · ${qs.length} soal`:'Belum ada latihan',qs.length?'chip ok':'chip warn'));
    n.firstChild.append(chips);
    const m=el('button',ls.length?'Materi':'Buat materi');m.onclick=()=>{show('lessons');ls.length?lessonEditor.open(ls[0]):lessonEditor.forCore(t,c);};
    const p=el('button','Latihan');p.onclick=()=>{show('practice');practiceEditor.openFor(t,c.code);};
    n.append(m,p);
  }
  if(!shown.length)$('#coreList').append(el('p',t?'Tidak ada inti untuk pilihan ini.':'Pilih topik.','muted'));
}
$('#coreFilter').onchange=renderCores;$('#coreStatus').onchange=renderCores;
async function load(){state=await api('state');render();}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=new FormData(e.target).get('token');try{await load();e.target.reset();notice('Ruang kerja terbuka. Perubahan disimpan sebagai draf.');}catch(e){token='';notice(e.message,true);}};
$('#logout').onclick=()=>{token='';state=undefined;$('#workspace').hidden=true;$('#login').hidden=false;notice('Studio terkunci.');};
$('#refresh').onclick=()=>{if(token)load().catch(e=>notice(e.message,true));};
for(const [id,kind] of [['topicForm','topic'],['coreForm','core'],['relationForm','relation'],['prerequisiteForm','prerequisite']])$('#'+id).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await api('commands',{...Object.fromEntries(new FormData(e.target)),kind});await load();notice('Draf tersimpan. Belum dipublikasikan ke siswa.');}catch(e){notice(e.message,true);}finally{button.disabled=false;}};
$('#importSeed').onclick=async()=>{try{await api('imports',{});await load();notice('Impor diantrekan. Jalankan worker lalu klik Muat ulang untuk melihat hasil.');}catch(e){notice(e.message,true);}};
$('#export').onclick=async()=>{try{const r=await api('exports',{});$('#exportResult').textContent=`Folder server:\n${r.directory}\n\n${r.findings.length} temuan strict. Tinjau sebelum menggunakan catalog:publish.`;notice('Ekspor selesai; tidak ada publikasi.');}catch(e){notice(e.message,true);}};
const lessonEditor=createLessonEditor({$,api,notice,getState:()=>state,reload:load});
const practiceEditor=createPracticeEditor({$,api,notice,getState:()=>state,reload:load,visibleTopics:()=>visible().topics});
function graph(){
  const svg=$('#graph');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';const add=(tag,attrs,parent=svg)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;};
  const coreMode=$('#graphMode').value==='cores',topic=state.topics.find(t=>t.code===$('#graphTopic').value);
  const view=visible();
  let nodes=coreMode?[...(topic?.concepts??[])]:[...view.topics];
  let edges=coreMode?(topic?.prerequisites??[]).map(p=>({from:p.requires,to:p.concept,dashed:p.kind==='SOFT',label:p.kind})):view.relations.map(r=>({from:r.kind==='REQUIRES'?r.to:r.from,to:r.kind==='REQUIRES'?r.from:r.to,dashed:r.kind==='RELATED',label:r.label}));
  // Include prerequisites outside the selected topic, so cross-topic dependencies remain visible.
  if(coreMode){const all=state.topics.flatMap(t=>t.concepts);for(const e of edges)for(const id of[e.from,e.to])if(!nodes.some(n=>n.code===id)){const n=all.find(c=>c.code===id);if(n)nodes.push(n);}}
  if(!coreMode){for(const e of edges)for(const id of[e.from,e.to])if(!nodes.some(n=>n.code===id)){const n=state.topics.find(t=>t.code===id);if(n)nodes.push({...n,title:n.title+' [luar filter]'});}}
  const h=Math.max(420,Math.ceil(nodes.length/3)*115+90);svg.setAttribute('viewBox',`0 0 960 ${h}`);svg.setAttribute('height',String(h));
  const defs=add('defs',{}),marker=add('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'},defs);add('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#718f80'},marker);
  const pos=new Map(nodes.map((n,i)=>[n.code,{x:40+(i%3)*310,y:45+Math.floor(i/3)*115}]));
  for(const e of edges){const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)continue;let path;if(a.y===b.y){const right=b.x>a.x;path=`M ${a.x+(right?260:0)} ${a.y+32} L ${b.x+(right?0:260)} ${b.y+32}`;}else{const down=b.y>a.y;path=`M ${a.x+130} ${a.y+(down?65:0)} L ${b.x+130} ${b.y+(down?0:65)}`;}const line=add('path',{d:path,class:'edge'+(e.dashed?' dashed':''),...(!e.dashed||coreMode?{'marker-end':'url(#arrow)'}:{})});const title=add('title',{},line);title.textContent=e.label;}
  for(const n of nodes){const p=pos.get(n.code),g=add('g',{class:'node',tabindex:0,role:'button','aria-label':n.title});add('rect',{x:p.x,y:p.y,width:260,height:65,rx:10},g);const title=add('text',{x:p.x+14,y:p.y+27},g);title.textContent=n.title.length>32?n.title.slice(0,31)+'…':n.title;const c=add('text',{x:p.x+14,y:p.y+47,class:'code'},g);c.textContent=n.code;const open=()=>{if(coreMode){const t=state.topics.find(t=>t.concepts.some(c=>c.code===n.code));coreEdit(t,n);}else topicEdit(n);};g.onclick=open;g.onkeydown=e=>{if(e.key==='Enter')open();};}
  $('#graphDetails').textContent=`${nodes.length} simpul · ${edges.length} hubungan. Posisi simpul adalah tata letak tampilan, bukan urutan belajar resmi.`;
}
$('#graphMode').onchange=graph;$('#graphTopic').onchange=graph;

function filterChanged(){
  // Clear forms so hidden previous selections cannot be saved against a different topic.
  for(const id of ['topicForm','coreForm','relationForm','prerequisiteForm'])$('#'+id).reset();
  render();if($('#subjectFilter').value)$('#topicSubject').value=$('#subjectFilter').value;
  if($('#phaseFilter').value)$('#topicForm').elements.phase.value=$('#phaseFilter').value;
}
$('#subjectFilter').onchange=filterChanged;$('#phaseFilter').onchange=filterChanged;
$('#resetFilters').onclick=()=>{$('#subjectFilter').value='';$('#phaseFilter').value='';filterChanged();};
$('#exportPdf').onclick=()=>{
  const report=window.open('','_blank');if(!report){notice('Izinkan popup untuk membuka pratinjau PDF.',true);return;}
  const html=reportHtml(state,$('#subjectFilter').value,$('#phaseFilter').value,new URL('report.css',location.href).href);
  report.document.open();report.document.write(html);report.document.close();
  report.addEventListener('load',()=>{report.focus();report.print();},{once:true});
  notice('Pratinjau dibuka. Pilih Simpan sebagai PDF pada dialog cetak. Pilih Semua pelajaran dan Semua jenjang untuk laporan lengkap.');
};
