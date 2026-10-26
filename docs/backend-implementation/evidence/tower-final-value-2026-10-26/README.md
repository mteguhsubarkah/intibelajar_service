# tower-v1: nilai akhir dengan nama variabel lain (26 Oktober 2026)

Node 24.19.0 (`versions.txt`), database `*_test` saja. Belum di-commit. Perubahan ini **PROPOSED**: tower-v1 disetujui
lewat D1, jadi perilaku baru menunggu content review seperti delta lain.

## Masalah

Jawaban "tan 30 = tinggi menara / jarak mendatar . tan 30 = 2/d . d = 20 / 1 / akar 3 = 20 akar 3 ," dinilai
UNREADABLE ("Langkahmu belum cukup terlihat"). Tiga penyebab di `finalValue`:
1. hanya klausa "x = …" yang dibaca sebagai nilai akhir, padahal siswa menamai jaraknya `d`;
2. klausa tidak dipisah pada ". " (akhir kalimat), jadi "d = …" tidak pernah menjadi awal klausa;
3. koma penutup ("20 akar 3 ,") membuat nilainya tidak terbaca.

## Perubahan (`src/assessment/evaluators/tower-v1.ts`)

- Nama unknown: `x`, `jarak`, `jaraknya`, dan `jarak mendatar`. Selain itu, sebuah huruf tunggal dihitung bila
  pengerjaannya memakai huruf itu sebagai unknown dalam sebuah rasio (`20/d`, `d/20`).
- Klausa `x`/`jarak` selalu menang atas huruf lain, sehingga nilai antara ("m = 40", sisi miring) tidak menggantikan
  hasil yang dinyatakan.
- Klausa juga dipisah pada ". " (titik desimal "34.6" tidak terpengaruh).
- Tanda baca di akhir nilai diabaikan.
- Pola langkah (konten authored) **tidak** diubah. Akibatnya untuk "tan 30 = 20/d, d = 20√3", Segitiga Siku-siku
  dikreditkan dari nilai akhir yang benar (kutipan "20√3"), bukan dari langkah "20/d": pola langkahnya masih "20/x".

## Golden (`catalog/golden/answers.v2.json`): 26 kasus tower, 13 delta

| Kasus | Teks | Sekarang | Sebelumnya | `delta` |
|---|---|---|---|---|
| T22 | jawaban di atas | CORRECT | UNREADABLE | null: sama dengan analysis.ts ("kuat") |
| T23 | `tan 30 = 20/d, d = 20√3` | CORRECT | UNREADABLE | null |
| T24 | `jarak = 20√3` | CORRECT | UNREADABLE | null |
| T25 | `tan 30 = 20/d, d = 20/√3` | INCORRECT | UNREADABLE | **delta from analysis.ts**, PROPOSED (analysis.ts: "kuat") |
| T26 | `t = 20, tan 30 = 20/x, x = 20√3` | CORRECT (guard: `t` bukan unknown, `x` menang) | CORRECT | null |

Di file ini label "delta from analysis.ts" berarti **berbeda dari analysis.ts** (versi perangkat), dan tes menolak
label pada kasus yang sama dengannya. T22–T24 dan T26 kini sama dengan analysis.ts, jadi tanpa label delta.
Perubahan terhadap tower-v1 yang lama dicatat di field `source` tiap kasus ("tower-v1 change 2026-10-26 (proposed,
not yet content-reviewed)").

## Hasil

| Pemeriksaan | Hasil | File |
|---|---|---|
| Typecheck | exit 0 | `typecheck.txt` |
| Tes evaluator (golden tower 26 + 1 tes guard baru) | **14/14** | `evaluators.txt` |
| Sinkron golden | 37 opsi, 81 numerik, 26 tower (13 delta) | `golden-sync.txt` |
| `verify:frontend` (FE suite, consumer, golden v2 di Vue) | exit 0; 26 tower golden checks lulus | `frontend-verify.txt` |
| Mutation checks | **6/6 terbunuh** (putaran 1: 5/6, lihat bawah), sumber dipulihkan (checksum OK) | `mutation-checks.txt`, `mutation-checks-round-1.txt`, `mutate-tower.mjs` |
| Suite backend penuh | 251/264, exit 1. 13 kegagalan **sama persis** dengan sebelum perubahan ini (`../guest-trial-2026-10-26/README.md`); tidak ada yang baru | `backend-tests.txt` |

**Putaran 1 mutation (5/6):** mutasi "huruf apa pun dibaca" selamat. Kasus guard pertama ("tinggi menara t = 20, …")
tidak pernah cocok dengan pola awal klausa, jadi pengecekan unknown tidak teruji. Kasus diganti menjadi
"t = 20, tan 30 = 20/d" (harus UNREADABLE); putaran 2 membunuh keenamnya.

**Catatan di luar perubahan ini:** seluruh jawaban berupa "t = 20" (tanpa pengerjaan lain) sudah dari dulu dibaca
parser numerik sebagai nilai polos, sehingga dinilai INCORRECT. Perilaku itu tidak diubah.
