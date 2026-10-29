import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { lintManifest, loadManifest, writeManifest, type Manifest, type Rule } from '../src/catalog/manifest.js';
import { withSyntheticFunnelLesson, SYNTHETIC_FUNNEL_LESSON } from './fixtures/loop-content.js';
import { reviewedFixture } from './fixtures/catalog.js';
import { buildManifest, collectLegacyIds, coverageGaps, freezeOf, loadFrontend } from '../scripts/catalog/extract-from-frontend.js';
// Slice 1 M1: the manifest linter (pure, no database) and the frontend extractor.
// Mutation tests follow validate-spec.py --self-test: each applies one targeted defect and expects exactly that rule.

const DIR = resolve('catalog/manifest');
const base = loadManifest(DIR);
// The extractor's files alone: what writeManifest and the round-trip own (overlays live in catalog/authored/).
const extracted = loadManifest(DIR, { authored: false });
const rulesOf = (m: Manifest, strict = false) => new Set(lintManifest(m, { strict }).filter(f => f.rule !== 'UNREVIEWED').map(f => f.rule));
const q = (m: Manifest, code: string) => m.questions.find(x => x.code === code)!;
const concept = (m: Manifest, code: string) => m.topics.flatMap(t => t.concepts).find(c => c.code === code)!;
const tri = (m: Manifest) => m.topics.find(t => t.code === 'MAT.TRI')!;

test('committed draft manifest lints clean apart from open review decisions', () => {
  const draft = lintManifest(base);
  assert.deepEqual(draft.filter(f => f.severity === 'error'), []);
  assert.ok(draft.every(f => f.rule === 'UNREVIEWED' && f.severity === 'warning'));
  const strict = lintManifest(base, { strict: true });
  // Setelah sign-off manusia (npm run catalog:signoff) manifest yang dikomit boleh lolos strict; sebelum itu publisher wajib menolak.
  if (base.release.signOff.status === 'REVIEWED') assert.deepEqual(strict, []);
  else assert.ok(strict.length > 0 && strict.every(f => f.rule === 'UNREVIEWED' && f.severity === 'error'), 'the publisher must refuse an unreviewed manifest');
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
  // Slice 2 M1.
  ['PATTERN', m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.solutionPaths[0]!.steps[1]!.patterns = ['?!']; }],
  ['PATTERN', m => { delete q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.solutionPaths[0]!.steps[2]!.patterns; }],
  ['PATTERN', m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.misconceptionMap[0]!.pattern = { kind: 'NUMERIC', value: 40 }; }],
  ['PATTERN', m => { q(m, 'MAT.TRI.Q.TRIG_DEPRESSION_01').rubric.solutionPaths[0]!.steps[0]!.patterns = ['tan 30']; }],
  ['LESSON_LINK', m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.lessonFor!['MAT.TRI.SUDUT_ISTIMEWA'] = 'MAT.TRI.L.PERBANDINGAN_TRIG'; }],
  ['LESSON_LINK', m => { delete q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.lessonFor!['MAT.TRI.SEGITIGA_SIKU_SIKU']; }],
  ['RECOMMEND', m => { q(m, 'MAT.TRI.Q.SOAL_MENARA').rubric.recommend![0]!.misconceptionCode = 'MEMAKAI_TABEL'; }],
  ['AUTHORED_TARGET', m => { m.authored![0]!.target = 'MAT.TRI.Q.TIDAK_ADA'; }],
];
for (const [i, [rule, mutate]] of mutations.entries()) test(`mutation ${i + 1}: ${rule} is detected, and only it`, () => {
  const m = structuredClone(base);
  mutate(m);
  assert.deepEqual([...rulesOf(m)], [rule]);
});

test('mutation: FILE_NAME is detected when a file does not match its code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ib-manifest-'));
  try {
    writeManifest(dir, extracted);
    renameSync(join(dir, 'questions/MAT.TRI.Q.TAN60_SIN30.yaml'), join(dir, 'questions/renamed.yaml'));
    // Without its overlays the tower question lacks its authored patterns and lesson links; only FILE_NAME is new.
    assert.deepEqual([...rulesOf(loadManifest(dir))].sort(), [...rulesOf(extracted), 'FILE_NAME'].sort());
    assert.deepEqual([...rulesOf(extracted)].sort(), ['LESSON_LINK', 'PATTERN']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('writeManifest and loadManifest round-trip without loss', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ib-manifest-'));
  try {
    writeManifest(dir, extracted);
    assert.deepEqual(structuredClone(loadManifest(dir)), structuredClone(extracted));
    assert.throws(() => writeManifest(dir, base), /authored overlays applied/, 'overlays are never baked into extractor files');
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

test('Slice 2 overlays: applied over the extracted tower question, reviewed on their own, extractor files untouched', () => {
  const tower = q(base, 'MAT.TRI.Q.SOAL_MENARA'), raw = q(extracted, 'MAT.TRI.Q.SOAL_MENARA');
  assert.deepEqual(raw.rubric.misconceptionMap, [], 'the extracted rubric is unchanged on disk');
  assert.ok(raw.rubric.solutionPaths[0]!.steps.every(s => s.patterns === undefined));
  assert.equal(tower.rubric.misconceptionMap.length, 4);
  assert.ok(tower.rubric.solutionPaths[0]!.steps.every(s => s.patterns && s.patterns.length > 0));
  assert.deepEqual(Object.keys(tower.rubric.lessonFor!).sort(), ['MAT.TRI.DEFINISI_SIN_COS_TAN', 'MAT.TRI.SEGITIGA_SIKU_SIKU', 'MAT.TRI.SUDUT_ISTIMEWA']);
  assert.ok(concept(base, 'MAT.TRI.SUDUT_ISTIMEWA').misconceptions.some(m => m.code === 'TAN30_BUKAN_SETENGAH'));
  assert.ok(!concept(extracted, 'MAT.TRI.SUDUT_ISTIMEWA').misconceptions.some(m => m.code === 'TAN30_BUKAN_SETENGAH'));
  // Every overlay is an open proposal: the draft lints clean, strict lint refuses each one by name.
  assert.ok(base.authored!.length === 3 && base.authored!.every(a => a.review.status === 'PROPOSED' && a.provenance.source === 'authored'));
  const strict = lintManifest(base, { strict: true }).filter(f => f.file.startsWith('authored/'));
  assert.deepEqual(strict.map(f => f.rule), ['UNREVIEWED', 'UNREVIEWED', 'UNREVIEWED']);
});

test('D3 stays open: the synthetic funnel lesson exercises lessonFor in memory only and is refused by strict lint', () => {
  const m = withSyntheticFunnelLesson(base);
  assert.deepEqual([...rulesOf(m)], [], 'the shape D3 proposes is valid');
  assert.ok(lintManifest(m, { strict: true }).some(f => f.rule === 'UNREVIEWED' && f.message.includes(SYNTHETIC_FUNNEL_LESSON)));
  assert.ok(!base.lessons.some(l => l.code === SYNTHETIC_FUNNEL_LESSON), 'never part of the committed draft');
  assert.ok(!readFileSync(resolve('catalog/authored/MAT.TRI.Q.SOAL_MENARA.rubric.yaml'), 'utf8').includes('SYNTHETIC'));
  // Even a synthetically reviewed copy (test memory only) publishes nothing the draft lacks except the stand-in.
  const reviewed = reviewedFixture(m);
  assert.deepEqual(lintManifest(reviewed, { strict: true }), []);
});
