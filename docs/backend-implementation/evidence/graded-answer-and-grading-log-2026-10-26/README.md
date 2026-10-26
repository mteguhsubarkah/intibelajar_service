# Jawaban yang dinilai di layar, dan log penilaian dev (26 Oktober 2026)

Node 24.19.0, database `*_test`. Belum di-commit.

## Masalah

Setelah sebuah loop `/coba` didiagnosis, menekan "Cek jawabanku" lagi tidak mengirim teks baru (satu jawaban pertama
per loop; percobaan ulang lewat materi lalu "soal tadi"). Layar tetap menampilkan hasil tersimpan, tetapi kotak
"Kamu"/"Jawabanmu" memakai isi textarea. Hasil jawaban lama (yang memakai sin) jadi tampak seperti hasil teks baru.

## Perubahan

**FE**
- `state.gradedText` menyimpan jawaban yang benar-benar dinilai server: teks yang baru dikirim, atau teks attempt
  tersimpan (`GET /v1/attempts/{id}`) saat hasil lama ditampilkan.
- Kotak "Kamu" (sorotan bagian yang meleset) dan "Jawabanmu" pada status pending/klarifikasi memakai `gradedText`.
- Bila teks di kotak berbeda dari yang dinilai, panel hasil menampilkan: "Soal ini sudah diperiksa, jadi jawaban barumu
  tidak dikirim. Hasil di bawah untuk jawaban yang sudah dinilai. Untuk mencoba lagi, pelajari intinya lalu kerjakan soal
  tadi." Bila sama (mis. tab lain), pesan tab lain yang lama tetap dipakai. **Copy baru, belum direview konten.**

**BE**
- `GRADING_LOG=true` (dinyalakan hanya oleh `npm run dev` / `local:dev`, dan hanya berlaku bila `NODE_ENV=development`)
  mencetak satu baris per run yang dinilai, misalnya:
  `grade run=… engine=DETERMINISTIC rubric=tower-v1 verdict=INCORRECT evidence=SUPPORTED | DEFINISI_SIN_COS_TAN=gap(MEMAKAI_SIN) "sin 30" | …`
- Run yang diantrekan ke AI mencetak `→ queued for AI`; hasil AI dicetak oleh worker saat diadopsi.
- Baris ini memuat kutipan jawaban, karena itu mati di test dan di luar development.

## Hasil

| Pemeriksaan | Hasil | File |
|---|---|---|
| Typecheck backend, batas modul | Lulus | — |
| `grading-log` (mati di test / tanpa flag; satu baris yang tepat di development) | Lulus | `backend-tests.txt` |
| Suite backend penuh | 249/262, exit 1. 13 kegagalan sama persis dengan sebelumnya; tidak ada yang baru | `backend-tests.txt` |
| FE `npm test` | Exit 0 | `frontend-npm-test.txt` |
| Typecheck Vue (alias dipetakan), file yang diubah | 0 error | `vue-typecheck.txt` |
| FE build | Exit 0 | `frontend-build.txt` |
| E2E: practice 2 + loop 7 + email-link 2 (tes dua tab diperbarui: pesan "tidak dikirim" dan kotak "Kamu" menampilkan jawaban yang dinilai, bukan teks baru) | **11/11**, exit 0. `npm run dev` pengguna dihentikan atas izinnya agar port 8000/5180 kosong | `browser-e2e.txt`, `browser-e2e-api-log.txt` |

Jumlah tes turun dari 264 ke 262 karena tiga tes `/v1/trial` (Codex) beserta `src/platform/trial-routes.ts` dan
`src/assessment/trial.ts` sudah dihapus dari working tree, bukan oleh sesi ini. Typecheck tetap lulus.
