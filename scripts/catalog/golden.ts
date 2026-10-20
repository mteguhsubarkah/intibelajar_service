import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadManifest, type Manifest } from '../../src/catalog/manifest.js';
// The shared golden file, catalog/golden/answers.v2.json (Slice 2 M2; v1 stays for history). Its option section
// lists every option-v1 item, by its legacy item ids, with its option count and the index of the key; it is
// generated here. The numeric and tower sections are authored. Both repos grade against it (plan 03 M5, 05 M2).
//   npm run catalog:golden            check that the committed section matches the manifest
//   npm run catalog:golden -- --write regenerate it (the authored numeric section is kept)

export const GOLDEN_FILE = 'catalog/golden/answers.v2.json';
export interface OptionGolden { question: string; items: string[]; optionCount: number; correctIndex: number }
/** One tower-v1 case: the server's expected result, the frontend's recorded analysis.ts output, and the delta label. */
export interface TowerCase {
  id: string; input: { response: 'know' | 'blank' | null; text: string }; source: string;
  expected: { verdict: 'CORRECT' | 'INCORRECT' | 'UNREADABLE' | 'NOT_GRADED'; reason?: string; misconception?: string;
    evidence: Record<string, { classification: string; misconception?: string; quote?: string }> };
  analysisTs: { tone: 'kuat' | 'gap'; gap: string | null; items: Record<string, 'ok' | 'gap' | 'rest'> };
  delta: { label: 'delta from analysis.ts'; status: string; summary: string } | null;
}
export interface Golden {
  schemaVersion: 1 | 2; description: string;
  numeric: { question: string; item: string; cases: { typed: string; verdict: 'CORRECT' | 'INCORRECT' | 'UNREADABLE'; misconception?: string | null; reason?: string }[] }[];
  options: OptionGolden[];
  tower?: { question: string; item: string; inputRule: string; comparison: string; cases: TowerCase[] };
}

export function optionGolden(m: Manifest): OptionGolden[] {
  return m.questions.filter(q => q.rubric.evaluator === 'option-v1' && q.aliases.some(a => a.ns === 'ITEM')).map(q => {
    const order = q.legacyOptionOrder ?? q.body.options!.map(o => o.id);
    return { question: q.code, items: q.aliases.filter(a => a.ns === 'ITEM').map(a => a.value), optionCount: order.length, correctIndex: order.indexOf(q.rubric.answer.optionId!) };
  }).sort((a, b) => a.question < b.question ? -1 : 1);
}

// Invisible characters are written as \u escapes so that an editor cannot silently drop them.
export const serialize = (g: Golden) => JSON.stringify(g, null, 2).replace(/[ ​‌‍﻿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
export const readGolden = (file = GOLDEN_FILE) => JSON.parse(readFileSync(file, 'utf8')) as Golden;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const golden = readGolden(), next = { ...golden, options: optionGolden(loadManifest(resolve('catalog/manifest'))) };
  if (process.argv.includes('--write')) { writeFileSync(GOLDEN_FILE, serialize(next)); console.log(`Wrote ${next.options.length} option items to ${GOLDEN_FILE}`); }
  else if (serialize(next) !== serialize(golden)) { console.error(`${GOLDEN_FILE} options are out of date with the manifest; run npm run catalog:golden -- --write and review the diff`); process.exit(1); }
  else console.log(`${GOLDEN_FILE}: ${golden.options.length} option items in sync, ${golden.numeric.reduce((n, q) => n + q.cases.length, 0)} numeric cases, ${golden.tower?.cases.length ?? 0} tower cases (${golden.tower?.cases.filter(c => c.delta).length ?? 0} labelled deltas from analysis.ts)`);
}
