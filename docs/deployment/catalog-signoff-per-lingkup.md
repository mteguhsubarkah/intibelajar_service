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
