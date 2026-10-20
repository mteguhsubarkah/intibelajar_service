# Peta Kerja IntiBelajar

Peta development sederhana berbahasa Indonesia: kita sedang di mana, apa yang dikerjakan berikutnya, dan bagaimana kode Slice/M/D/T/B saling berhubungan. Hanya dokumentasi lokal; tidak mengubah aplikasi atau status proyek.

## Membuka

Klik dua kali `dist/index.html`, atau buka file itu dengan browser. Tidak memerlukan Node, database, server, internet, instalasi, atau build. Ketiga berkas pendamping (`styles.css`, `app.js`, `plan-data.js`) harus tetap berada di folder yang sama.

Untuk preview HTTP opsional, dari root backend:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Buka `http://127.0.0.1:8765/development-guide/dist/`. Hentikan server dengan Ctrl+C. Link sumber menunjuk Markdown lokal di folder docs, jadi pertahankan struktur folder bila dipindahkan.

## Isi

- Fokus lokal: buka localhost:5180/__local untuk mencoba FE/BE. B-03 sudah ditutup; B-01/B-02 masih menahan gate M5.
- Jalur keputusan D3/D6/OD-11, D7, dan D8 yang membuka pekerjaan lain.
- Roadmap Slice 0–6; rincian M1–M9 dan D1–D8 untuk Slice 1/2.
- Contoh cara membaca hubungan Slice 2/M5 → T01-11 → B-01.
- Tombol menyalin tugas B-01/B-02. Tombol hanya menyalin teks, tidak mengirim pesan atau menjalankan pekerjaan.

## Snapshot, bukan monitor live

`dist/plan-data.js` menyimpan snapshot dokumen lokal beserta hash sumber. Halaman tidak mengambil status dari backend atau menjalankan test. Tidak ada API, analytics, penyimpanan identitas, persetujuan yang bisa diubah, atau dependensi eksternal.

Generator Python memakai pustaka standar:

```powershell
python docs/development-guide/generate-data.py
```

Tabel diambil dari dokumen, sedangkan penjelasan, klasifikasi status, dan ringkasan backlog dikurasi di generator. Saat plan berubah, **tinjau dan perbarui ringkasan tersebut** sebelum regenerasi. Pemeriksaan jumlah baris dan approval menghentikan sebagian perubahan format; pemeriksaan itu tidak mendeteksi semua perubahan makna. Jangan menganggap regenerasi otomatis membuktikan status terbaru atau production readiness.

Sumber otoritatif tetap `docs/backend-architecture/` dan `docs/backend-implementation/`. Contoh angka versi di simulasi adalah ilustrasi; bukan hasil pengujian database.
