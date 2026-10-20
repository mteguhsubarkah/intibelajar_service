import type { Lesson, Manifest } from '../../src/catalog/manifest.js';
// Synthetic loop content for decisions that are still open (plan 05 §2). It exists only in test memory and is
// never written to catalog/: tests use it to exercise shapes a decision would need, not to decide them.
//
// D3 (funnel lesson): StepMateri.vue's lesson is not catalog content and its authoring is not approved. This
// stand-in has the shape D3 proposes (two slides, a required check on slide 1, teaching DEFINISI_SIN_COS_TAN)
// with placeholder text, and it carries its own PROPOSED review so strict lint refuses it like any open decision.

export const SYNTHETIC_FUNNEL_LESSON = 'MAT.TRI.L.SYNTHETIC_FUNNEL_FIXTURE';

export function withSyntheticFunnelLesson(m: Manifest): Manifest {
  const out = structuredClone(m);
  const lesson: Lesson = {
    schemaVersion: 1, code: SYNTHETIC_FUNNEL_LESSON, title: 'Fixture sintetis (bukan konten)', estimatedMinutes: 2, aliases: [],
    concepts: ['MAT.TRI.DEFINISI_SIN_COS_TAN'],
    blocks: [
      { type: 'heading', slide: 0, text: 'Placeholder slide 1' }, { type: 'text', slide: 0, text: 'Synthetic test content; D3 is open.' },
      { type: 'heading', slide: 1, text: 'Placeholder slide 2' }, { type: 'text', slide: 1, text: 'Synthetic test content; D3 is open.' },
    ],
    checks: [{ question: 'MAT.TRI.Q.FUNNEL_C4', ordinal: 1, slideIndex: 1, required: true }],
    review: { status: 'PROPOSED', decision: 'S2-D3', fields: ['whole entry'], evidence: ['Synthetic fixture for tests only; the funnel lesson waits on D3.'] },
  };
  out.lessons.push(lesson);
  const tower = out.questions.find(q => q.code === 'MAT.TRI.Q.SOAL_MENARA')!;
  tower.rubric.lessonFor = { ...tower.rubric.lessonFor, 'MAT.TRI.DEFINISI_SIN_COS_TAN': SYNTHETIC_FUNNEL_LESSON };
  return out;
}
