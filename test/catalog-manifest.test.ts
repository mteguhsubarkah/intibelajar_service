import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { lintManifest, loadManifest, writeManifest, type Manifest, type Rule } from '../src/catalog/manifest.js';
import { buildManifest, collectLegacyIds, coverageGaps, freezeOf, loadFrontend } from '../scripts/catalog/extract-from-frontend.js';
// Slice 1 M1: the manifest linter (pure, no database) and the frontend extractor.
// Mutation tests follow validate-spec.py --self-test: each applies one targeted defect and expects exactly that rule.

const DIR = resolve('catalog/manifest');
const base = loadManifest(DIR);
const rulesOf = (m: Manifest, strict = false) => new Set(lintManifest(m, { strict }).filter(f => f.rule !== 'UNREVIEWED').map(f => f.rule));
const q = (m: Manifest, code: string) => m.questions.find(x => x.code === code)!;
const concept = (m: Manifest, code: string) => m.topics.flatMap(t => t.concepts).find(c => c.code === code)!;
const tri = (m: Manifest) => m.topics.find(t => t.code === 'MAT.TRI')!;

test('committed draft manifest lints clean apart from open review decisions', () => {
  const draft = lintManifest(base);
  assert.deepEqual(draft.filter(f => f.severity === 'error'), []);
  assert.ok(draft.every(f => f.rule === 'UNREVIEWED' && f.severity === 'warning'));
  const strict = lintManifest(base, { strict: true });
  assert.ok(strict.length > 0 && strict.every(f => f.rule === 'UNREVIEWED' && f.severity === 'error'), 'the publisher must refuse an unreviewed manifest');
});

const mutations: [Rule, (m: Manifest) => void][] = [
  ['SCHEMA', m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').difficulty = 5; }],
  ['KEY_IN_BODY', m => { (q(m, 'MAT.TRI.Q.TAN60_SIN30').body as unknown as Record<string, unknown>).answer = 'a'; }],
  ['SIZE', m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').rubric.acceptedForms = Array.from({ length: 400 }, (_, i) => `${i}`.padEnd(200, 'x')); }],
  ['CODE_DUPLICATE', m => { m.questions.push({ ...structuredClone(q(m, 'MAT.TRI.Q.TAN60_SIN30')), aliases: [] }); }],
  ['REF_UNKNOWN', m => { m.lessons[0]!.concepts.push('MAT.TRI.DOES_NOT_EXIST'); }],
  ['ALIAS_AMBIGUOUS', m => { concept(m, 'MAT.TRI.RADIAN').aliases.push({ ns: 'MAP', value: 'tri-c' }); }],
  ['ALIAS_UNMAPPED_CONFLICT', m => { m.unmapped.entries.push({ ns: 'ITEM', value: 'c1', reason: 'test' }); }],
  ['PREREQ_CYCLE', m => { tri(m).prerequisites.push({ concept: 'MAT.TRI.SEGITIGA_SIKU_SIKU', requires: 'MAT.TRI.DEFINISI_SIN_COS_TAN', kind: 'HARD' }); }],
  ['PREREQ_SELF', m => { tri(m).prerequisites.push({ concept: 'MAT.TRI.RADIAN', requires: 'MAT.TRI.RADIAN', kind: 'SOFT' }); }],
  ['TOPIC_CYCLE', m => { m.topicRelations.relations.push({ from: 'MAT.BAR', to: 'MAT.EKS', kind: 'REQUIRES', label: 'test', source: 'MATHEMATICAL' }); }],
  ['UNIT_UNKNOWN', m => { concept(m, 'MAT.TRI.RADIAN').unit = 'MAT.EKS.U1'; }],
  ['QUESTION_NO_PRIMARY', m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').concepts[0]!.role = 'SUPPORTING'; }],
  ['STEP_CONCEPT_UNMAPPED', m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.solutionPaths[0]!.steps[0]!.concepts[0]!.code = 'MAT.TRI.RADIAN'; }],
  ['MISCONCEPTION_UNKNOWN', m => { q(m, 'MAT.TRI.Q.TRIG_DEPRESSION_01').rubric.misconceptionMap[0]!.misconceptionCode = 'TIDAK_ADA'; }],
  ['EVALUATOR_SHAPE', m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').rubric.evaluator = 'numeric-v1'; }],
  ['OPTION_IDS', m => { q(m, 'MAT.TRI.Q.TAN60_SIN30').legacyOptionOrder!.pop(); }],
  ['PRACTICE_NOT_DETERMINISTIC', m => { m.sets.sets.find(s => s.code === 'MAT.S.BANK')!.items.push('MAT.TRI.Q.SOAL_MENARA'); }],
  ['CHECK_NOT_DETERMINISTIC', m => { m.lessons.find(l => l.code === 'MAT.TRI.L.SUDUT_ISTIMEWA')!.checks[0]!.question = 'MAT.TRI.Q.SOAL_MENARA'; }],
  ['CHECK_PLACEMENT', m => { m.lessons.find(l => l.code === 'MAT.TRI.L.SUDUT_ISTIMEWA')!.checks[0]!.slideIndex = 9; }],
];
for (const [rule, mutate] of mutations) test(`mutation: ${rule} is detected, and only it`, () => {
  const m = structuredClone(base);
  mutate(m);
  assert.deepEqual([...rulesOf(m)], [rule]);
});

test('mutation: FILE_NAME is detected when a file does not match its code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ib-manifest-'));
  try {
    writeManifest(dir, base);
    renameSync(join(dir, 'questions/MAT.TRI.Q.TAN60_SIN30.yaml'), join(dir, 'questions/renamed.yaml'));
    assert.deepEqual([...rulesOf(loadManifest(dir))], ['FILE_NAME']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('writeManifest and loadManifest round-trip without loss', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ib-manifest-'));
  try {
    writeManifest(dir, base);
    assert.deepEqual(structuredClone(loadManifest(dir)), structuredClone(base));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const FRONTEND = resolve(process.env.FRONTEND_DIR ?? '../mockup/intibelajar');
test('extractor is deterministic and every frontend identifier resolves', { skip: !existsSync(join(FRONTEND, 'src/data/curriculum.ts')) && `no frontend checkout at ${FRONTEND}` }, async () => {
  const { fe, source } = await loadFrontend(FRONTEND);
  assert.deepEqual(buildManifest(fe, source), buildManifest(fe, source));
  const legacy = collectLegacyIds(fe);
  assert.deepEqual(coverageGaps(base, legacy), [], 'frontend ids must be aliased or listed in unmapped.yaml');
  const frozen = JSON.parse(readFileSync(resolve('catalog/legacy-alias-freeze.json'), 'utf8'));
  assert.deepEqual(freezeOf(base, legacy).namespaces, frozen.namespaces, 'frontend references drifted from the frozen legacy alias set');
});
