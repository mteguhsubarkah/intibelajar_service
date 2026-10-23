import test from 'node:test';
import assert from 'node:assert/strict';
// Browser module is pure and shared with the printable report; no DOM or dependencies.
// @ts-expect-error plain browser JS module
import {selectCatalog,reportHtml} from '../backoffice/catalog-view.js';
const state={revision:2,subjects:{subjects:[{code:'MAT',title:'Matematika'},{code:'FIS',title:'Fisika'}]},
 topics:[{code:'MAT.A',subject:'MAT',phase:'D',title:'Angka <script>alert(1)</script>',concepts:[{code:'MAT.A.C',title:'Bilangan & nilai',definition:'A & B'}],prerequisites:[]},
 {code:'FIS.B',subject:'FIS',phase:'F',title:'Gaya',concepts:[{code:'FIS.B.C',title:'Gaya'}],prerequisites:[{concept:'FIS.B.C',requires:'MAT.A.C',kind:'SOFT'}]},
 {code:'MAT.C',subject:'MAT',phase:'F+',title:'Matriks',concepts:[],prerequisites:[]}],
 lessons:[{code:'MAT.A.L',title:'Bilangan',concepts:['MAT.A.C'],blocks:[{slide:0},{slide:1}]}],
 topicRelations:{relations:[{from:'FIS.B',to:'MAT.A',kind:'REQUIRES',label:'Matematika untuk gaya'}]},
 sources:{'MAT.A':['https://example.org/cp'],'FIS.B':['https://example.org/physics']}};
test('subject and phase filter selects topics, cores, lessons, sources and cross-scope relations',()=>{
 const v=selectCatalog(state,'MAT','D');assert.deepEqual(v.topics.map((t:any)=>t.code),['MAT.A']);assert.equal(v.lessons.length,1);assert.deepEqual(v.sources,['https://example.org/cp']);assert.equal(v.relations.length,1);assert.equal(v.prerequisites.length,1);
 assert.equal(selectCatalog(state,'FIS','D').topics.length,0);assert.equal(selectCatalog(state,'','F+').topics[0].title,'Matriks');
});
test('report separates subjects and levels, includes graph, all cores, and escapes authored text',()=>{
 const html=reportHtml(state);assert(html.includes('SMP'));assert(html.includes('SMA lanjut'));assert(html.includes('Matematika tingkat lanjut'));
 assert(html.includes('<svg'));assert(html.includes('MAT.A.C'));assert(html.includes('FIS.B.C'));assert(html.includes('SOFT'));assert(html.includes('https://example.org/cp'));
 assert(!html.includes('<script>alert'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Bilangan &amp; nilai'));
 const filtered=reportHtml(state,'FIS','F');assert(!filtered.includes('Angka &lt;script&gt;alert(1)&lt;/script&gt;</h2>'));assert(filtered.includes('Gaya'));
 assert(reportHtml(state,'FIS','D').includes('Tidak ada topik'));
});
test('large report retains every node and cross-page dependency without oversized graphs',()=>{
 const many=structuredClone(state);many.topics[0].concepts=Array.from({length:25},(_,i)=>({code:'MAT.A.C'+i,title:'Inti '+i,definition:'Uraian'}));
 many.topics[0].prerequisites=[{concept:'MAT.A.C24',requires:'MAT.A.C0',kind:'SOFT'}];
 const html=reportHtml(many,'MAT','D');for(let i=0;i<25;i++)assert(html.includes('MAT.A.C'+i));
 assert(html.includes('Inti 0 → Inti 24'));assert((html.match(/<svg/g)||[]).length>=5);
});
