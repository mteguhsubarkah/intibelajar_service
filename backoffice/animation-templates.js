/* Template awal blok "Animasi kode". Kode ini dijalankan aplikasi di iframe sandbox tanpa akses jaringan,
   jadi hanya boleh memakai HTML/CSS/JS di dalamnya sendiri (tanpa font, gambar, atau skrip dari luar). */
export const TEMPLATES = {
  kosong: {
    name: 'Kosong',
    label: 'Animasi',
    height: 240,
    html: '<div class="box">Halo</div>',
    css: '.box { margin: 24px auto; width: 120px; padding: 16px; text-align: center; border-radius: 14px; background: #e8efff; color: #1e40af; font-weight: 700; animation: naik 1.6s ease-in-out infinite alternate; }\n@keyframes naik { to { transform: translateY(-12px); } }\n@media (prefers-reduced-motion: reduce) { .box { animation: none; } }',
    js: '',
  },
  kuadran: {
    name: 'Kuadran & tanda sin, cos, tan',
    label: 'Animasi tanda sin, cos, dan tan di kuadran I sampai IV',
    height: 420,
    html: `<div class="wrap">
  <p id="say" class="say" aria-live="polite"></p>
  <svg viewBox="0 0 280 200" role="img" aria-labelledby="say">
    <g id="quads"></g>
    <line class="axis" x1="18" y1="100" x2="262" y2="100" />
    <line class="axis" x1="140" y1="190" x2="140" y2="12" />
    <path class="axis" d="M268 100 l-9 -4 v8 z M140 6 l-4 9 h8 z" />
    <text class="ax" x="256" y="117">x</text>
    <text class="ax" x="148" y="18">y</text>
    <line id="legX" class="leg" />
    <line id="legY" class="leg" />
    <line id="hyp" class="hyp" x1="140" y1="100" />
    <circle id="dot" class="dot" r="6" />
  </svg>
  <div class="chips">
    <span id="sin" class="chip">sin</span>
    <span id="cos" class="chip">cos</span>
    <span id="tan" class="chip">tan</span>
  </div>
  <button id="go" type="button">Jeda</button>
</div>`,
    css: `* { box-sizing: border-box; }
body { color: #0f172a; }
.wrap { display: grid; gap: 10px; justify-items: center; padding: 12px; }
.say { margin: 0; min-height: 44px; font-size: 15px; line-height: 1.45; text-align: center; font-weight: 600; }
svg { width: 100%; max-width: 360px; }
.quad { fill: #f1f5f9; stroke: #e2e8f0; transition: fill .4s; }
.quad.on { fill: #dbeafe; stroke: #93c5fd; }
.qname { font: 700 13px system-ui; fill: #64748b; }
.qhint { font: 600 11px system-ui; fill: #1d4ed8; opacity: 0; transition: opacity .4s; }
.qhint.show { opacity: 1; }
.axis { stroke: #334155; stroke-width: 1.6; fill: #334155; }
.ax { font: italic 700 13px system-ui; fill: #334155; }
.leg { stroke-width: 4; stroke-linecap: round; }
.leg.pos { stroke: #16a34a; } .leg.neg { stroke: #dc2626; }
.hyp { stroke: #1d4ed8; stroke-width: 2.5; stroke-dasharray: 5 4; }
.dot { fill: #1d4ed8; }
.chips { display: flex; gap: 8px; }
.chip { padding: 6px 12px; border-radius: 999px; font-weight: 700; font-size: 14px; background: #f1f5f9; color: #475569; transition: background .3s, color .3s; }
.chip.pos { background: #dcfce7; color: #15803d; }
.chip.neg { background: #fee2e2; color: #b91c1c; }
button { font: inherit; font-weight: 600; padding: 8px 16px; border-radius: 10px; border: 1.5px solid #cbd5e1; background: white; color: #0f172a; }`,
    js: `// Empat kuadran: tanda x dan y menentukan tanda sin (y/r), cos (x/r), dan tan (y/x).
const Q = [
  { name: 'I', x: 1, y: 1 }, { name: 'II', x: -1, y: 1 },
  { name: 'III', x: -1, y: -1 }, { name: 'IV', x: 1, y: -1 },
];
const O = { x: 140, y: 100 }, W = 110, H = 80;
const ns = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const sign = (v) => (v > 0 ? '+' : '−');
const word = (v) => (v > 0 ? 'positif' : 'negatif');

// gambar kotak kuadran beserta nama dan catatan ringkas
Q.forEach((q, i) => {
  const r = document.createElementNS(ns, 'rect');
  r.setAttribute('x', q.x > 0 ? O.x : O.x - W); r.setAttribute('y', q.y > 0 ? O.y - H : O.y);
  r.setAttribute('width', W); r.setAttribute('height', H); r.setAttribute('rx', 6);
  r.setAttribute('class', 'quad'); r.id = 'q' + i;
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', q.x > 0 ? O.x + W - 22 : O.x - W + 8); t.setAttribute('y', q.y > 0 ? O.y - H + 18 : O.y + H - 8);
  t.setAttribute('class', 'qname'); t.textContent = q.name;
  const h = document.createElementNS(ns, 'text');
  h.setAttribute('x', q.x > 0 ? O.x + 10 : O.x - W + 8); h.setAttribute('y', q.y > 0 ? O.y - 10 : O.y + 18);
  h.setAttribute('class', 'qhint'); h.id = 'h' + i;
  const pos = [q.y > 0 && q.x > 0 && 'semua +', q.y > 0 && q.x < 0 && 'sin +', q.y < 0 && q.x < 0 && 'tan +', q.y < 0 && q.x > 0 && 'cos +'].find(Boolean);
  h.textContent = pos;
  $('quads').append(r, t, h);
});

function chip(id, v) { $(id).className = 'chip ' + (v > 0 ? 'pos' : 'neg'); $(id).textContent = id + ' ' + sign(v); }

function show(i) {
  Q.forEach((_, k) => { $('q' + k).classList.toggle('on', k === i); });
  if (i === Q.length) { // ringkasan
    Q.forEach((_, k) => $('h' + k).classList.add('show'));
    ['legX', 'legY', 'hyp', 'dot'].forEach((id) => ($(id).style.opacity = 0));
    ['sin', 'cos', 'tan'].forEach((id) => { $(id).className = 'chip'; $(id).textContent = id; });
    $('say').textContent = 'Ringkasnya: kuadran I semua positif, II hanya sin, III hanya tan, IV hanya cos.';
    return;
  }
  Q.forEach((_, k) => $('h' + k).classList.remove('show'));
  const q = Q[i], px = O.x + q.x * 70, py = O.y - q.y * 50;
  ['legX', 'legY', 'hyp', 'dot'].forEach((id) => ($(id).style.opacity = 1));
  $('legX').setAttribute('x1', O.x); $('legX').setAttribute('y1', O.y); $('legX').setAttribute('x2', px); $('legX').setAttribute('y2', O.y);
  $('legX').setAttribute('class', 'leg ' + (q.x > 0 ? 'pos' : 'neg'));
  $('legY').setAttribute('x1', px); $('legY').setAttribute('y1', O.y); $('legY').setAttribute('x2', px); $('legY').setAttribute('y2', py);
  $('legY').setAttribute('class', 'leg ' + (q.y > 0 ? 'pos' : 'neg'));
  $('hyp').setAttribute('x2', px); $('hyp').setAttribute('y2', py);
  $('dot').setAttribute('cx', px); $('dot').setAttribute('cy', py);
  chip('sin', q.y); chip('cos', q.x); chip('tan', q.x * q.y);
  $('say').textContent = 'Kuadran ' + q.name + ': x ' + word(q.x) + ', y ' + word(q.y) + '.';
}

// Putar otomatis; bila pengguna memilih kurangi animasi, maju per langkah dengan tombol.
const manual = matchMedia('(prefers-reduced-motion: reduce)').matches;
let step = 0, timer = null;
function next() { step = (step + 1) % (Q.length + 1); show(step); }
function play() { timer = setInterval(next, 2200); $('go').textContent = 'Jeda'; }
function pause() { clearInterval(timer); timer = null; $('go').textContent = 'Putar'; }
$('go').onclick = () => (manual ? next() : timer ? pause() : play());
show(0);
if (manual) $('go').textContent = 'Berikutnya →'; else play();`,
  },
};
