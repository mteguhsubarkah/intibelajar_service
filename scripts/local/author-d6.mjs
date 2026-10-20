// One-time authoring helper. This changes only the schema and tower overlay; never extracted content.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
const path = 'catalog/manifest.schema.json', s = JSON.parse(readFileSync(path, 'utf8'));
s.$defs.rubric.properties.tutorLadder = { type: 'object', additionalProperties: false, required: ['hints', 'nodes'], properties: {
  hints: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', minLength: 1, maxLength: 500 } },
  nodes: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['ask', 'text', 'quick'], properties: {
    ask: { type: 'string', minLength: 1, maxLength: 120 }, text: { type: 'string', minLength: 1, maxLength: 1000 },
    quick: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 80 } },
  } } },
} };
s.$defs.authored.properties.rubric.properties.tutorLadder = { $ref: '#/$defs/rubric/properties/tutorLadder' };
writeFileSync(path, JSON.stringify(s, null, 2) + '\n');
const file = 'catalog/authored/MAT.TRI.Q.SOAL_MENARA.rubric.yaml', a = parse(readFileSync(file, 'utf8'));
a.rubric.tutorLadder = {
  hints: ['Petunjuk 1: tinggi menara adalah sisi depan terhadap sudut acuan. Jarak mendatar adalah sisi samping. Perbandingan mana yang memakai keduanya?',
    'Petunjuk 2: tan = depan / samping. Cocokkan tinggi yang diketahui dengan jarak yang dicari, lalu tulis persamaanmu.'],
  nodes: [
    { ask: 'Kenapa sin nggak bisa? Kan sudutnya ada.', text: 'Sin memakai depan dan miring. Di soal ini panjang garis pandang (miring) belum diketahui. Dua sisi mana yang diketahui dan dicari?', quick: ['Depan & samping', 'Sisi miring itu yang mana?', 'Kasih petunjuk'] },
    { ask: 'Sisi miring itu yang mana?', text: 'Sisi miring berhadapan dengan siku-siku: garis pandang dari puncak menara. Panjangnya belum diketahui. Bagaimana posisi tinggi menara terhadap sudut acuan?', quick: ['Depan & samping', 'Kasih petunjuk'] },
    { ask: 'Depan & samping', text: 'Pasangan itu dipakai oleh tan. Coba bangun persamaan dari depan dibagi samping. Mana yang sudah diketahui dan mana yang dicari?', quick: ['tan', 'Kasih petunjuk'] },
    { ask: 'tan', text: 'Tan menghubungkan depan dan samping. Sekarang tulis sendiri persamaan berdasarkan posisi tinggi dan jarak mendatar.', quick: ['Hubungkan soal dengan inti', 'Kasih petunjuk'] },
    { ask: 'Hubungkan soal dengan inti', text: 'Mulai dari segitiga siku-siku, tentukan sudut acuan, lalu beri nama depan dan samping. Inti perbandingan trigonometri menghubungkan kedua sisi. Dua besaran apa yang perlu kamu hubungkan?', quick: ['Bangun soal dari inti', 'Depan & samping'] },
    { ask: 'Bangun soal dari inti', text: 'Gunakan inti segitiga siku-siku untuk menggambar hubungan menara dan tanah. Gunakan inti rasio untuk menghubungkan tinggi dengan jarak. Setelah model terbentuk, nilai sudut membantu menghitung. Coba tulis hubungan simboliknya dahulu.', quick: ['Hubungkan soal dengan inti', 'Kasih petunjuk'] },
  ],
};
a.review.fields = [...new Set([...a.review.fields, 'tutorLadder'])];
a.review.evidence.push('D3/D6 implementation authorized 2026-10-20, local synthetic scope. Tutor full response derives from the private workedSolution after two server-counted hints. Production review remains pending.');
writeFileSync(file, stringify(a, { lineWidth: 0 }));
