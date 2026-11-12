import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManifest, type Lesson, type Question } from '../../src/catalog/manifest.js';
import { parseScope, scopeContent, scopeHash, scopeText } from '../../src/catalog/scope.js';
// Usage: npm run catalog:scope-sheet -- --scope MAT:D [--out lembar-MAT-D.md] [--manifest catalog/manifest]
// Lembar tinjauan untuk guru: semua materi (slide demi slide) dan soal (dengan kunci dan pembahasan) dalam satu lingkup.
// Hanya membaca repo; tidak mengubah status review dan tidak menerbitkan apa pun.
const args = process.argv.slice(2);
const arg = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const scope = parseScope(arg('--scope') ?? '');
const repo = loadManifest(resolve(arg('--manifest') ?? 'catalog/manifest'));
const c = scopeContent(repo, [scope]);
if (!c.topics.length) { console.error(`Lingkup ${scopeText(scope)} tidak punya topik di manifest.`); process.exit(1); }

const block = (b: Lesson['blocks'][number]) => {
  if (b.type === 'heading') return `**${b.text}**`;
  if (b.type === 'tip') return `> Tips: ${b.text}`;
  if (b.type === 'math') return `- \`${b.name}\` = \`${b.expression}\``;
  if (b.type === 'text') return b.text;
  return `_[animasi: ${(b as { label?: string }).label ?? b.type}]_`;
};
const key = (q: Question) => q.rubric.evaluator === 'option-v1'
  ? (q.body.options ?? []).find(o => o.id === q.rubric.answer.optionId)?.id.toUpperCase() ?? '?'
  : `${q.rubric.answer.value ?? ''} ${q.rubric.answer.unit ?? ''}`.trim();
const lines = [`# Lembar tinjauan ${scopeText(scope)}`, '',
  `Isi repo saat lembar ini dibuat (hash \`${scopeHash(repo, scope).slice(0, 12)}\`). Centang setelah materi, kunci, pembahasan, dan bahasa diperiksa.`,
  'Jika ada yang diperbaiki, lembar dan hash berubah; tandatangani setelah semua perbaikan masuk.', ''];
for (const t of c.topics) {
  lines.push(`## ${t.title} (${t.code}) · Fase ${t.phase}`, '');
  for (const concept of t.concepts.filter(x => !x.hidden)) {
    lines.push(`### Inti: ${concept.title}${concept.grade ? ` · Kelas ${concept.grade}` : ''}`, '');
    for (const l of c.lessons.filter(x => x.concepts.includes(concept.code))) {
      lines.push(`- [ ] **Materi ${l.code}** — ${l.title}`);
      for (const slide of [...new Set(l.blocks.map(b => b.slide))].sort()) {
        lines.push(`  - Slide ${slide + 1}:`, ...l.blocks.filter(b => b.slide === slide).map(b => '    ' + block(b).replaceAll('\n', '\n    ')));
      }
    }
    for (const q of c.questions.filter(x => x.concepts.some(k => k.concept === concept.code && k.role === 'PRIMARY'))) {
      lines.push(`- [ ] **Soal ${q.code}** — ${q.body.prompt}`);
      if (q.body.options?.length) lines.push(`  ${q.body.options.map(o => `${o.id.toUpperCase()}. ${o.label}`).join(' · ')}`);
      lines.push(`  Kunci: **${key(q)}** · ${q.rubric.feedback?.correct ?? ''}`);
    }
    lines.push('');
  }
}
const out = resolve(arg('--out') ?? `lembar-${scopeText(scope).replace(/[^A-Z0-9]+/g, '-')}.md`);
writeFileSync(out, lines.join('\n') + '\n');
console.log(`Lembar tinjauan ${scopeText(scope)}: ${c.topics.length} topik, ${c.lessons.length} materi, ${c.questions.length} soal → ${out}`);
