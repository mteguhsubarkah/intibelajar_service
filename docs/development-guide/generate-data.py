"""Refresh the offline guide's snapshot from repository planning documents. No dependencies."""
from pathlib import Path
import datetime
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
FILES = {
    'slice0': 'backend-implementation/01-slice0-report.md',
    'slice1Plan': 'backend-implementation/03-slice1-plan.md',
    'slice1Report': 'backend-implementation/04-slice1-report.md',
    'slice2': 'backend-implementation/05-slice2-plan.md',
    'roadmap': 'backend-architecture/12-implementation-roadmap.md',
    'tests': 'backend-architecture/11-test-matrix.md',
    'domain': 'backend-architecture/03-domain-model.md',
    'machine': 'backend-architecture/05-learning-state-machine.md',
    'api': 'backend-architecture/09-api-design.md',
    'adrs': 'backend-architecture/10-architecture-decisions.md',
}
texts = {key: (DOCS / path).read_text(encoding='utf-8') for key, path in FILES.items()}

def plain(value):
    value = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', value)
    return value.replace('`', '').replace('**', '').strip()

def rows(text, pattern):
    found = []
    for line in text.splitlines():
        if re.match(pattern, line):
            found.append([plain(c) for c in line.strip().strip('|').split('|')])
    return found

def source(key, anchor=''):
    return '../../' + FILES[key] + ('#' + anchor if anchor else '')

glossary = [
    dict(id='Slice', name='Paket fitur besar', question='Produk ini dibangun per bagian apa?',
         explanation='Satu Slice mengumpulkan kemampuan produk yang bisa dipakai dan diuji bersama. Di dalamnya ada beberapa milestone.',
         analogy='Seperti satu bagian rumah: fondasi, ruang belajar, lalu fasilitas tambahan.',
         example='Slice 2 = alur soal → diagnosis → materi singkat → coba lagi.',
         scope='Nomor Slice berlaku untuk roadmap besar: 0 sampai 6.', source=source('roadmap'), tag='Lingkup pekerjaan'),
    dict(id='M', name='Milestone / langkah kerja', question='Pekerjaan apa yang sedang dibuat?',
         explanation='M adalah potongan pekerjaan di dalam satu Slice. Nomornya dimulai lagi pada Slice berikutnya, sehingga M5 harus selalu dibaca bersama nomor Slice.',
         analogy='Seperti langkah memasang pintu dalam pekerjaan satu ruangan.',
         example='Slice 1/M5 = evaluator angka dan pilihan. Slice 2/M5 = service dan endpoint question loop.',
         scope='Tulis Slice 2/M5, bukan M5 saja saat berdiskusi lintas Slice.', source=source('slice2'), tag='Lingkup pekerjaan'),
    dict(id='D', name='Decision / keputusan per Slice', question='Pilihan apa yang perlu disepakati?',
         explanation='D mencatat pilihan produk, konten, atau engineering. Keputusan yang masih OPEN belum otomatis disetujui karena implementasi atau tesnya sudah ada.',
         analogy='Seperti memutuskan model pintu sebelum pemasangannya diselesaikan.',
         example='Slice 2/D3 = materi funnel. Slice 2/D6 = tangga hint tutor.',
         scope='D1 di Slice 1 berbeda dengan D1 di Slice 2. Kode D07 dari blueprint juga berbeda dengan Slice 2/D7.', source=source('slice2'), tag='Keputusan'),
    dict(id='OD', name='Open Decision / keputusan lintas proyek', question='Persetujuan besar apa yang masih dibutuhkan?',
         explanation='OD berasal dari roadmap arsitektur dan dapat memengaruhi beberapa Slice. Sebagian memerlukan pemilik produk, security, manajemen, atau penasihat hukum.',
         analogy='Seperti persetujuan pemilik dan izin yang memengaruhi keseluruhan rumah.',
         example='OD-11 = copy/alur “Saya tahu caranya”. OD-02 = minimum umur dan metode age assurance.',
         scope='Development default adalah pilihan sementara; bukan bukti approval produksi.', source=source('roadmap'), tag='Keputusan'),
    dict(id='T', name='Test scenario / skenario pembuktian', question='Bagaimana kita membuktikan fitur bekerja?',
         explanation='T menjelaskan situasi yang harus diuji. T01 adalah kelompok skenario penerimaan, sedangkan T01-11 menunjuk satu skenario di dalamnya.',
         analogy='Seperti mencoba pintu dari dua sisi untuk memastikan kuncinya bekerja.',
         example='T01-11 = dua tab mengubah sesi versi sama: satu 201, satu 409; data tidak tertimpa.',
         scope='T02 memuat resume, perpindahan guest ke akun, dan konsistensi Map/Home. Jumlah tes lulus bukan persentase produk selesai.', source=source('tests'), tag='Pembuktian'),
    dict(id='B', name='Backlog finding / temuan yang belum ditutup', question='Masalah apa yang masih perlu dituntaskan?',
         explanation='B adalah temuan konkret dengan evidence dan acceptance criteria. Pekerjaan independen bisa lanjut, sementara temuan tetap menahan gate yang terdampak.',
         analogy='Seperti catatan pintu kadang macet: ruangan lain boleh dikerjakan, pemeriksaan akhir masih tertahan.',
         example='B-01 = T01-11 pernah mendapat 500. B-02 = model test gagal membaca items. B-03 = runner menyembunyikan exit code gagal.',
         scope='Satu run hijau tidak otomatis menutup masalah yang penyebabnya belum diketahui.', source=source('slice2'), tag='Masalah'),
    dict(id='INV', name='Invariant / aturan yang harus selalu benar', question='Aturan apa yang tidak boleh dilanggar?',
         explanation='INV berlaku di semua alur yang relevan. Satu milestone boleh memiliki banyak test untuk menjaga invariant yang sama.',
         analogy='Seperti aturan bahwa kunci rumah satu orang tidak boleh membuka rumah tetangga.',
         example='INV-01 = ownership; INV-14 = satu idempotency key punya satu hasil; INV-19 = penghapusan data lengkap.',
         scope='Invariant adalah aturan sistem; skenario T adalah cara membuktikannya.', source=source('domain'), tag='Aturan sistem'),
    dict(id='E', name='Event / transisi state yang diizinkan', question='Setelah aksi ini, sesi boleh pindah ke tahap apa?',
         explanation='E-xx menamai baris transisi pada mesin belajar. Server memeriksa state, syarat, dan perubahan yang diizinkan sebelum menyimpan hasil.',
         analogy='Seperti urutan membuka kunci, memutar gagang, lalu membuka pintu.',
         example='E-01 = membuat question loop; E-24 = abandon; E-25 = expiry.',
         scope='Angka E adalah nomor transisi, bukan urutan milestone pengerjaan.', source=source('machine'), tag='Aturan sistem'),
    dict(id='L', name='Legacy call / adapter frontend lama', question='Panggilan frontend lama mana yang sedang disambungkan?',
         explanation='L1–L9 menamai kontrak panggilan frontend yang sudah ada. Facade menerjemahkannya ke service canonical tanpa mengganti bentuk respons lama.',
         analogy='Seperti adaptor colokan yang menyambungkan perangkat lama ke instalasi baru.',
         example='L1 = diagnosis; L3 = answer check; L4 = solution; L6 = tutor; L8 = mapping soal.',
         scope='Huruf L pada kolom Size berarti Large. Itu berbeda dari kode adapter L1/L2/L3.', source=source('api'), tag='Integrasi'),
    dict(id='ADR', name='Architecture Decision Record', question='Kenapa pendekatan teknis ini dipilih?',
         explanation='ADR mencatat konteks, pilihan teknologi, keputusan, konsekuensi, dan jalan untuk mengubahnya. Ini membantu memahami alasan arsitektur.',
         analogy='Seperti catatan alasan memilih jenis fondasi dan bahan bangunan.',
         example='ADR-01 = modular monolith; ADR-04 = Kysely dan SQL migrations; ADR-15 = session server-side.',
         scope='Status ADR dan persetujuan tetap mengikuti dokumen sumber; catatan alasan bukan sertifikat siap produksi.', source=source('adrs'), tag='Keputusan'),
    dict(id='K / A', name='Kode aturan dari blueprint', question='Prinsip produk atau API apa yang dirujuk?',
         explanation='K dan A adalah kode keputusan/prinsip pada blueprint yang ditelusuri oleh arsitektur. Bacalah bersama nama dokumen, karena kode singkat bisa punya konteks berbeda.',
         analogy='Seperti nomor aturan dalam rancangan awal rumah.',
         example='K01 = berbagai cara penyelesaian yang valid; K05 = syarat mastery; A01 = shared diagnosis run.',
         scope='Contoh penting: blueprint D07 (“jangan mengarang gap”) berbeda dari Slice 2/D7 (staff tool).', source=source('domain'), tag='Aturan sistem'),
    dict(id='S / M / L', name='Ukuran estimasi pekerjaan', question='Seberapa besar pekerjaannya relatif terhadap pekerjaan lain?',
         explanation='Jika huruf muncul di kolom Size, S/M/L berarti Small/Medium/Large. Ini ukuran relatif, bukan nomor milestone dan bukan janji tanggal selesai.',
         analogy='Seperti label pekerjaan kecil, sedang, dan besar pada daftar renovasi.',
         example='Baris M5 dapat memiliki Size L: milestone nomor 5, ukurannya Large.',
         scope='M pada kolom Size berbeda dari M5 pada kolom Milestone.', source=source('slice2'), tag='Lingkup pekerjaan'),
]

status2 = {
    'M1': ('partial', 'Sebagian terverifikasi', 'Bagian D1/D2 sudah ada. Materi funnel D3 dan tutor ladder D6 masih menunggu keputusan.'),
    'M2': ('verified', 'Terverifikasi untuk development', 'tower-v1 dan golden tersedia. Dua belas delta serta tiga overlay masih PROPOSED.'),
    'M3': ('verified', 'Sudah di-commit', 'Skema loop, antrean dan erasure tercatat dalam bf02e7f; belum di-push menurut plan.'),
    'M4': ('verified', 'Sudah di-commit', 'Mesin QUESTION_LOOP dan property tests tersedia dalam bf02e7f.'),
    'M5': ('gate', 'Implementasi ada · gate terbuka', 'Loop service tersedia. B-01/B-02 masih menahan verification/release gate. B-03 sudah ditutup di §17.'),
    'M6': ('partial', 'Sisi learner terverifikasi', 'Pelaporan oleh learner tersedia. Staff resolution menunggu D7.'),
    'M7': ('partial', 'Empat adapter terverifikasi', 'L1/L2/L4/L8 tersedia. L3 funnel/check dan retry_original menunggu D3; L6 menunggu D6.'),
    'M8': ('partial', 'Jalur tanpa blocker terverifikasi', '/coba dan /challenge sudah canonical pada jalur yang tersedia (§17). Harness lokal FE/BE tersedia (§18). Materi, tutor, dan copy masih menunggu D3/D6/OD-11.'),
    'M9': ('blocked', 'Gate exit belum terpenuhi', 'Memerlukan milestone terkait selesai, temuan blocker ditutup, dan T01 di remote CI; D8 masih terbuka.'),
}
milestones = []
for scope, key in [(1, 'slice1Plan'), (2, 'slice2')]:
    seen=set()
    for row in rows(texts[key], r'^\| M[1-9] \|'):
        code=row[0]
        if code in seen: continue
        seen.add(code)
        state,label,note = status2[code] if scope==2 else ('verified', 'Engineering dev · laporan tersedia', 'Laporan Slice 1 menyatakan exit engineering terpenuhi pada fixture sintetis; release katalog nyata belum terpenuhi.')
        milestones.append(dict(slice=scope,id=code,title=row[1],size=row[2],dependencies=row[3] if len(row)>3 else '',state=state,label=label,note=note,source=source(key)))

decisions=[]
approved=set(re.findall(r'D[124]', texts['slice2'].splitlines()[2].split('approved')[0]))
for row in rows(texts['slice2'], r'^\| D[1-8] \|'):
    if any(d['id']==row[0] for d in decisions): continue
    decisions.append(dict(id=row[0],title=row[1],proposal=row[2],owner=row[3],approved=row[0] in approved,source=source('slice2')))

slice1_decisions=[]
for row in rows(texts['slice1Plan'], r'^\| D[1-8] \|'):
    if any(d['id']==row[0] for d in slice1_decisions): continue
    status = 'Approved' if row[0] in {'D1','D2','D7'} else 'Default development' if row[0]=='D8' else 'Menunggu review konten'
    slice1_decisions.append(dict(id=row[0],title=row[1],status=status,source=source('slice1Plan')))

backlogs=[]
definitions={
    'B-01': ('Dua tab pernah menghasilkan 500', 'API dua tab seharusnya menghasilkan 201 + 409. Penyebab 500 belum terbukti.', 'Penyebab teridentifikasi, fix teruji, tidak ada partial write, dan uji race/full suite memenuhi acceptance criteria.'),
    'B-02': ('Model test membaca items yang tidak ada', 'PRACTICE model-based test pernah berhenti pada .map atas undefined. Respons sebelumnya harus ditelusuri.', 'Status dan code respons penyebab diketahui, akar masalah diperbaiki tanpa melemahkan tes, property test dan dua full runs lulus.'),
    'B-03': ('Runner menutupi kegagalan Node', 'Pipeline Bash pernah melaporkan exit 0 ketika output menunjukkan tes gagal.', 'Negative-control test membuktikan child gagal membuat keseluruhan runner gagal; exit code tiap pemeriksaan disimpan.'),
}
for code,(title,impact,acceptance) in definitions.items():
    match=re.search(r'^### '+re.escape(code)+r'[^\n]*',texts['slice2'],re.M)
    heading=match.group(0) if match else 'Status belum ditemukan'
    backlogs.append(dict(id=code,title=title,impact=impact,acceptance=acceptance,status='OPEN / NEEDS FIX' if 'OPEN' in heading else 'CLOSED' if 'CLOSED' in heading else 'Periksa sumber',source=source('slice2'),heading=heading))

roadmap = [
    dict(id=0,title='Fondasi, identitas & consent',plain='Login, profil minimum, persetujuan guardian, keamanan dan database.',status='Fondasi development tersedia',state='verified'),
    dict(id=1,title='Katalog & latihan deterministik',plain='Materi dan latihan dinilai oleh server, dengan kunci jawaban terlindungi.',status='Exit engineering pada fixture sintetis',state='verified'),
    dict(id=2,title='Question loop',plain='Soal → diagnosis → materi → quick check → retry → selesai.',status='Fokus saat ini · beberapa bagian dan gate terbuka',state='partial'),
    dict(id=3,title='Progres, mastery & gamifikasi',plain='Map/Home memakai progres server, aturan mastery, XP dan streak.',status='Tahap roadmap berikutnya',state='future'),
    dict(id=4,title='Kelanjutan akun & hak data',plain='Import riwayat perangkat, resume, retensi dan hak atas data.',status='Tahap roadmap berikutnya',state='future'),
    dict(id=5,title='AI diagnosis & tutor',plain='AI masuk setelah gate pilot, consent, review keamanan dan provider.',status='Sesudah gate pilot · AI tetap nonaktif sekarang',state='future'),
    dict(id=6,title='Tanya soal & foto / OCR',plain='Unggah, baca, konfirmasi soal sendiri dengan kontrol privasi.',status='Sesudah Slice 5',state='future'),
]
scenarios=rows(texts['tests'],r'^\| T01-\d+ \|')
test_cases=[dict(id=r[0],title=r[1],proof=r[2],reference=r[3]) for r in scenarios]
global_decisions=[dict(id=r[0],title=r[1],proposal=r[2],owner=r[3],needed=r[4]) for r in rows(texts['roadmap'],r'^\| OD-\d+ \|')]
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
data=dict(generatedAt=now.isoformat(timespec='seconds'),sourceDate='20 Oktober 2026',
          statusQuote=plain(texts['slice2'].splitlines()[2]),glossary=glossary,milestones=milestones,
          decisions=decisions,backlogs=backlogs,roadmap=roadmap,tests=test_cases,globalDecisions=global_decisions,
          slice1Decisions=slice1_decisions,
          sources=[dict(id=k,path=p,href=source(k),sha256=hashlib.sha256((DOCS/p).read_bytes()).hexdigest()) for k,p in FILES.items()],
          context='Snapshot penjelasan dari dokumen lokal. Bukan monitor live, bukan approval, dan tidak menjalankan API atau tes.')
assert len(milestones)==18, 'Expected nine milestones for both Slice 1 and Slice 2'
assert len(decisions)==8 and len(test_cases)==12, 'Planning tables changed; review the parser'
assert approved=={'D1','D2','D4'}, 'Decision approvals changed: review status explanations before updating'
output=HERE/'dist'/'plan-data.js'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text('/* Generated from local planning docs. Do not treat as a live status feed. */\nwindow.INTIBELAJAR_GUIDE_DATA = '+json.dumps(data,ensure_ascii=False,indent=2).replace('<','\\u003c')+';\n',encoding='utf-8')
print(f'Updated {output}: {len(glossary)} terms, {len(milestones)} milestones, {len(test_cases)} acceptance scenarios.')
