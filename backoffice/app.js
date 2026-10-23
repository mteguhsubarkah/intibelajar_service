import { selectCatalog, reportHtml } from './catalog-view.js';
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
}
document.querySelectorAll('[data-tab]').forEach(n => n.onclick = () => show(n.dataset.tab));
function row(host, title, note, onEdit) {
  const n = el('div', undefined, 'row'), text = el('div'); text.append(el('p', title), el('small', note)); n.append(text);
  if (onEdit) { const b = el('button', 'Edit'); b.onclick = onEdit; n.append(b); }
  host.append(n);
}
function fill(form, values) { for (const [k,v] of Object.entries(values)) if (form.elements.namedItem(k)) form.elements.namedItem(k).value = v ?? ''; }
function revealTopic(t){if(!visible().topicCodes.has(t.code)){$('#subjectFilter').value=t.subject;$('#phaseFilter').value=t.phase;render();}}
function topicEdit(t) { revealTopic(t); show('topics'); fill($('#topicForm'), { ...t, source: state.sources[t.code]?.[0] ?? t.review?.evidence?.[0] ?? '' }); }
function coreEdit(t,c) { revealTopic(t); show('cores'); fill($('#coreForm'), { ...c, topic: t.code, objectives: c.objectives.join('\n'), source: state.sources[c.code]?.[0] ?? c.review?.evidence?.[0] ?? '' }); }
function lessonEdit(l) {
  if (l.blocks.some(b => b.type !== 'text' || b.slide > 1)) { notice('Materi ini memakai blok terstruktur. Ekspor dan gunakan editor manifest agar rumus/ilustrasi tetap utuh.', true); return; }
  show('lessons'); fill($('#lessonForm'), { ...l, concepts: l.concepts.join(', '), slide1: l.blocks.filter(b => b.slide === 0).map(b => b.text).join('\n'), slide2: l.blocks.filter(b => b.slide === 1).map(b => b.text).join('\n'), source: state.sources[l.code]?.[0] ?? '' }); preview();
}
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
  for (const [n, label] of [[view.topics.length,'Topik'],[cores.length,'Inti'],[view.lessons.length,'Materi'],[view.relations.length,'Relasi topik']]) { const d = el('div',undefined,'stat'); d.append(el('strong',n),el('span',label)); $('#stats').append(d); }
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
  $('#jobs').replaceChildren(); for (const j of state.jobs) row($('#jobs'),j.status,j.message ?? 'Menunggu worker / sedang diproses');
  $('#findings').replaceChildren(); for (const f of state.findings.filter(f=>!$('#subjectFilter').value||f.file.includes($('#subjectFilter').value)||!state.subjects.subjects.some(s=>f.file.includes(s.code+'.')))) row($('#findings'),`${f.rule} · ${f.file}`,f.message);
  $('#sources').replaceChildren(); const urls = new Set(view.sources); for(const url of urls){const a=el('a',url);a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('#sources').append(a);}
  $('#audit').replaceChildren(); for(const a of state.audit.slice().reverse())row($('#audit'),a.action,`${a.at} · revisi ${a.revision}`);
  $('#importSeed').disabled = Boolean($('#subjectFilter').value && $('#subjectFilter').value !== 'MAT') || ['D','F+'].includes($('#phaseFilter').value);
  $('#filterSummary').textContent = `${view.topics.length} dari ${state.topics.length} topik · filter berlaku di semua tab. Hubungan lintas filter tetap ditandai.`;
  if(tab==='graph')graph();
}
function renderCores(){const t=state.topics.find(t=>t.code===$('#coreFilter').value);$('#coreList').replaceChildren();for(const c of t?.concepts??[])row($('#coreList'),c.title,`${c.code} · ${c.definition??'Belum ada definisi'}`,()=>coreEdit(t,c));}
$('#coreFilter').onchange=renderCores;
async function load(){state=await api('state');render();}
$('#loginForm').onsubmit=async e=>{e.preventDefault();token=new FormData(e.target).get('token');try{await load();e.target.reset();notice('Ruang kerja terbuka. Perubahan disimpan sebagai draf.');}catch(e){token='';notice(e.message,true);}};
$('#logout').onclick=()=>{token='';state=undefined;$('#workspace').hidden=true;$('#login').hidden=false;notice('Studio terkunci.');};
$('#refresh').onclick=()=>{if(token)load().catch(e=>notice(e.message,true));};
for(const [id,kind] of [['topicForm','topic'],['coreForm','core'],['relationForm','relation'],['prerequisiteForm','prerequisite'],['lessonForm','lesson']])$('#'+id).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await api('commands',{...Object.fromEntries(new FormData(e.target)),kind});await load();notice('Draf tersimpan. Belum dipublikasikan ke siswa.');}catch(e){notice(e.message,true);}finally{button.disabled=false;}};
$('#importSeed').onclick=async()=>{try{await api('imports',{});await load();notice('Impor diantrekan. Jalankan worker lalu klik Muat ulang untuk melihat hasil.');}catch(e){notice(e.message,true);}};
$('#export').onclick=async()=>{try{const r=await api('exports',{});$('#exportResult').textContent=`Folder server:\n${r.directory}\n\n${r.findings.length} temuan strict. Tinjau sebelum menggunakan catalog:publish.`;notice('Ekspor selesai; tidak ada publikasi.');}catch(e){notice(e.message,true);}};
function preview(){const f=$('#lessonForm');$('#slidePreview').replaceChildren();for(let i=1;i<=2;i++){const d=el('div',undefined,'slide');d.append(el('small',`SLIDE ${i} / 2`),el('h3',f.elements.title.value||'Judul materi'),el('p',f.elements['slide'+i].value||'Teks slide akan muncul di sini.'));$('#slidePreview').append(d);}}
$('#lessonForm').oninput=preview;preview();
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
  for(const id of ['topicForm','coreForm','relationForm','prerequisiteForm','lessonForm'])$('#'+id).reset();
  render();if($('#subjectFilter').value)$('#topicSubject').value=$('#subjectFilter').value;
  if($('#phaseFilter').value)$('#topicForm').elements.phase.value=$('#phaseFilter').value;preview();
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
