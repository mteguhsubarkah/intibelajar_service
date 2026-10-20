import{readFileSync,writeFileSync}from'node:fs';const f='scripts/local/vite.mjs';let s=readFileSync(f,'utf8');
if(!s.includes("['ocr', 'Masuk sebagai Uji OCR Sintetis'"))s=s.replace("const buttons = [","const buttons = [['ocr', 'Masuk sebagai Uji OCR Sintetis', 'Izin belajar/AI/gambar simulasi; hanya gunakan gambar buatan.'], ");
if(!s.includes('Unduh gambar OCR sintetis'))s=s.replace('<p><a href="/">Beranda</a>', '<p><a href="/__local/ocr-fixture.png" download>Unduh gambar OCR sintetis</a> (buat dengan make-ocr-fixture.mjs).</p><p><a href="/">Beranda</a>');
if(!s.includes("path === '/__local/ocr-fixture.png'")){
 s=s.replace("import { readFileSync, mkdirSync }", "import { readFileSync, mkdirSync, existsSync }");
 s=s.replace("if (path !== '/__local'", "if(req.method==='GET' && path === '/__local/ocr-fixture.png' && existsSync(join(directory,'ocr-synthetic.png'))){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(readFileSync(join(directory,'ocr-synthetic.png')));return;}\n      if (path !== '/__local'");
}
writeFileSync(f,s);
