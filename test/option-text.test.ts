import test from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest } from '../src/catalog/manifest.js';
import { answerFormat, matchOption } from '../src/assessment/evaluators/option-text.js';
import { evaluate } from '../src/assessment/evaluators/index.js';

test('typed answers find the option they mean', () => {
  const mol = ['0,2 mol', '0,5 mol', '2 mol', '162 mol'];
  for (const t of ['0,5 mol', '0.5', '0,5', '1/2 mol', ' 0,5 MOL. ', 'n = 0,5 mol']) assert.equal(matchOption(mol, t).index, 1, t);
  assert.deepEqual(matchOption(mol, '0,3 mol'), { index: -1, how: 'none' });
  const words = ['Rhizobium', 'Azotobacter', 'Nitrosomonas', 'Lactobacillus'];
  assert.equal(matchOption(words, 'bakteri Rhizobium').index, 0);
  assert.equal(matchOption(words, 'Rhizobum').index, 0);
  assert.equal(matchOption(words, 'nitrogen').index, -1);
  const trend = ['makin besar', 'makin kecil', 'tetap', 'naik lalu turun'];
  assert.equal(matchOption(trend, 'kecil').index, 1);
  assert.equal(matchOption(trend, 'tidak makin kecil').index, -1, 'negation never matches a positive option');
  assert.equal(matchOption(trend, 'makin besar makin kecil').how, 'ambiguous');
  const place = ['golongan VA, periode 3', 'golongan VIIA, periode 3', 'golongan VIIA, periode 2', 'golongan IIIA, periode 3'];
  assert.equal(matchOption(place, 'golongan VIIA periode 3').index, 1);
  assert.equal(matchOption(place, 'periode 3, golongan VIIA').index, 1);
  assert.deepEqual(matchOption(place, '   '), { index: -1, how: 'empty' });
  for (const t of ['gatau', 'ga tau', 'nggak tahu', 'bingung', '?']) assert.deepEqual(matchOption(place, t), { index: -1, how: 'empty' }, t);
  const names = ['Oryza sativa', 'oryza sativa', 'Oryza Sativa', 'ORYZA SATIVA'];
  assert.equal(matchOption(names, 'Oryza sativa').index, 0, 'letter case is kept when it is what the question tests');
});

test('answer format hint keeps what all options share and hides what differs', () => {
  assert.equal(answerFormat(['0,2 mol', '0,5 mol', '2 mol', '162 mol']), '… mol');
  assert.equal(answerFormat(['golongan VA, periode 3', 'golongan VIIA, periode 3', 'golongan VIIA, periode 2', 'golongan IIIA, periode 3']), 'golongan …, periode …');
  assert.equal(answerFormat(['Rhizobium', 'Azotobacter']), null);
});

test('every catalog option question accepts its key and each option typed out', () => {
  const m = loadManifest('catalog/manifest');
  const mc = m.questions.filter(q => q.rubric.evaluator === 'option-v1');
  assert.ok(mc.length > 100);
  for (const q of mc) {
    const labels = q.body.options!.map(o => o.label);
    const caseTested = new Set(labels.map(l => l.toLowerCase())).size < labels.length;
    labels.forEach((l, i) => {
      for (const v of caseTested ? [l] : [l, ` ${l.toUpperCase()}. `, `jawabannya ${l}`]) assert.equal(matchOption(labels, v).index, i, `${q.code}: "${v}"`);
    });
    assert.notEqual(matchOption(labels, 'qwerty').index, labels.findIndex((_, i) => q.body.options![i]!.id === q.rubric.answer.optionId), q.code);
  }
});

test('option-v1 grades a typed answer: key = correct, other option or anything else = incorrect, empty = unreadable', () => {
  const m = loadManifest('catalog/manifest');
  const q = m.questions.find(x => x.rubric.evaluator === 'option-v1' && x.body.options!.length >= 3)!;
  const key = q.body.options!.find(o => o.id === q.rubric.answer.optionId)!;
  const other = q.body.options!.find(o => o.id !== key.id)!;
  const run = (text: string) => evaluate({ body: q.body, rubric: q.rubric, concepts: q.concepts.map(c => ({ code: c.concept, assessable: c.assessable })),
    response: { schemaVersion: 1, responseType: 'TEXT', text, inputMode: 'TYPED' } });
  const right = run(key.label);
  assert.equal(right.verdict, 'CORRECT');
  assert.deepEqual(right.revealedAnswer, { optionId: key.id });
  assert.ok(right.evidence.some(e => e.classification === 'UNDERSTANDING_DEMONSTRATED' && e.refs[0]?.kind === 'SPAN'));
  assert.equal(run(other.label).verdict, 'INCORRECT');
  assert.equal(run('qwerty').verdict, 'INCORRECT');
  assert.ok(run('qwerty').evidence.every(e => e.classification !== 'MISCONCEPTION_EVIDENCED'), 'no invented gap');
  assert.equal(run('  ').verdict, 'UNREADABLE');
});
