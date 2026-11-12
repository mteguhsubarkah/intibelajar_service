# Sign-off dan rilis katalog per lingkup (mapel / mapel + fase)

`catalog:signoff` lama menandatangani **seluruh** manifest sekaligus, dan publisher menolak rilis selama ada satu item
yang belum ditinjau. Alur di bawah ini membuat satu mapel (atau satu fase) bisa terbit setelah gurunya meninjau, tanpa
menunggu mapel lain.

**Prinsipnya:** rilis baru = isi produksi yang sedang aktif (snapshot di database, sudah pernah ditinjau) + lingkup yang
sudah ditandatangani, diambil dari repo.
- Konten yang sudah terbit di luar lingkup tidak pernah tertarik.
- Konten repo di luar lingkup tidak pernah ikut terbit.
- Sign-off terikat pada **isi** lingkup lewat hash. Kalau isinya diubah sesudah ditandatangani, lingkup itu dilewati
  (versi produksinya dipertahankan) sampai ditinjau dan ditandatangani ulang.
- Item yang merujuk konten yang belum terbit (mis. relasi ke topik mapel lain, soal multi-inti) disisihkan dan dilaporkan.
- Penerbitan tetap lewat publisher yang sama (strict lint, satu transaksi, revisi immutable).

Lingkup ditulis `MAT` (seluruh Matematika) atau `MAT:D` (Matematika Fase D). Fase: `D`, `E`, `F`, `F+`.

## 1. Guru meninjau (di repo, di PC atau server)

```bash
npm run catalog:scope-sheet -- --scope MAT:D --out lembar-MAT-D.md
```

Lembar berisi semua materi (slide demi slide) dan soal (kunci + pembahasan) lingkup itu. Materi juga bisa dilihat di
backoffice → Materi → Pratinjau, dengan tampilan aplikasi siswa. Koreksi dikerjakan di sumbernya
(`scripts/catalog/pilot/*.ts` lalu `npm run catalog:pilot`, atau backoffice), lalu lembar dibuat ulang.

## 2. Catat sign-off (keputusan manusia)

Hanya setelah lembar benar-benar diperiksa:

```bash
npm run catalog:signoff-scope -- --scope MAT:D --name "Nama Guru" --role "Guru Matematika"
git add catalog/signoffs.yaml && git commit -m "Sign-off katalog MAT:D" && git push
```

Tidak ada nilai bawaan untuk nama atau peran. Tanda tangan tersimpan di `catalog/signoffs.yaml` (lingkup, nama, peran,
tanggal, hash isi), jadi tercatat di git.

## 3. Terbitkan (di server)

```bash
cd /var/www/intibelajar_service && git pull --ff-only && npm ci
sudo -u postgres pg_dump -Fc -d intibelajar_dev > ~/backups/intibelajar/before-catalog-$(date +%Y%m%d-%H%M%S).dump

# simulasi: laporan baru/berubah/ditarik per lingkup, item yang disisihkan, dan strict lint. Tidak menerbitkan.
node --env-file=.env --import tsx scripts/catalog/release.ts --out ~/catalog-release

# bila laporannya benar:
node --env-file=.env --import tsx scripts/catalog/release.ts --publish --out ~/catalog-release
node --env-file=.env --import tsx scripts/catalog/status.ts
```

- Versi rilis otomatis = versi aktif + 1 (`--version N` untuk menentukan sendiri).
- `--out` menyimpan snapshot rilis dan laporannya sebagai arsip.
- Tidak perlu restart: API langsung melayani rilis baru.
- Rollback: restore backup langkah 3 (lihat runbook).

## Kelas per inti (sejak 12 November 2026)

Setiap inti kini membawa kelasnya (`grade`: 7–12) di file bab, dan aplikasi mengelompokkan bab per kelas, bukan per fase.
Kelas diatur di `scripts/catalog/pilot/grades.ts` dan diterapkan oleh `npm run catalog:pilot` ke semua bab, termasuk bab
lama di luar konten pilot. Generator menolak inti terlihat yang belum punya kelas, dan lint menolak kelas di luar fase
babnya (D 7–9, E 10, F dan F+ 11–12).

- **Kelas termasuk isi yang ditinjau.** Hash lingkup ikut berubah, jadi sign-off lama untuk lingkup apa pun dilewati
  (`DILEWATI … isinya berubah sejak ditandatangani`) sampai guru memeriksa penempatan kelasnya dan menandatangani ulang.
  Selama itu produksi tetap memakai rilis lama; aplikasi otomatis kembali ke pengelompokan per fase bila rilis aktif
  belum punya kelas.
- **Yang diperiksa guru:** apakah tiap inti ada di kelas yang sama dengan buku dan ATP sekolah. Pembagian kelas di dalam
  satu fase berbeda antarbuku; lembar tinjauan (`catalog:scope-sheet`) menampilkan kelas di samping tiap inti.
- **Database:** kolom `concept.grade` ditambahkan oleh migrasi `0013-concept-grade`. Di server, jalankan
  `node --env-file=.env --import tsx src/migrate.ts up` (bukan `npm run migrate`, yang tidak membaca `.env`) sebelum
  menerbitkan rilis yang memuat kelas.

### Rilis khusus kelas (tanpa menunggu tinjauan isi)

Untuk isi yang SUDAH tayang, kelas bisa diterbitkan sendiri tanpa file sign-off. Isi rilis aktif (materi, soal, judul,
urutan) tetap sama persis; yang berubah hanya `grade` tiap inti, diambil dari repo. Bab dan inti baru TIDAK ikut, tetap
menunggu sign-off guru seperti biasa.

```
cd /var/www/intibelajar_service
git pull --ff-only
node --env-file=.env --import tsx scripts/catalog/release.ts --grades-only            # simulasi: jumlah inti per mapel, inti yang pindah kelas
node --env-file=.env --import tsx scripts/catalog/release.ts --grades-only --publish  # terbitkan
```

Penempatan kelas yang terbit lewat jalur ini belum diperiksa guru; koreksi dari guru masuk lewat `grades.ts`, lalu jalankan
perintah yang sama lagi. Menjalankannya dua kali tanpa perubahan di repo tidak menerbitkan apa pun.
