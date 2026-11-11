import type { PilotQuestion } from './types.js';

// Opsi ditampilkan apa adanya (tidak diacak di generator maupun aplikasi), sedangkan penulis cenderung menaruh kunci di A/B.
// Kunci diputar ke posisi yang ditentukan hash kunci inti + nomor soal: tetap deterministik, tersebar merata di A–D,
// dan menambah inti baru tidak menggeser soal lain. Urutan siklis opsi dipertahankan.
export const spread = (key: string, qs: PilotQuestion[]): PilotQuestion[] => qs.map((q, i) => {
  let h = 2166136261;
  for (const ch of `${key}#${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const n = q.o.length, to = h % n, shift = (to - q.a + n) % n;
  return { ...q, o: q.o.map((_, j) => q.o[(j - shift + n) % n]), a: to };
});
