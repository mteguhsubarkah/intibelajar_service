import type { LessonBlock, QuestionBody } from './manifest.js';
// Public catalog projection (Slice 1 M3). Explicit allow-lists from rows to the OpenAPI schemas: a field
// reaches a learner only if it is named here. Inputs never contain rubrics; read.ts does not select them (INV-05).

// Optional strings are omitted, never sent as null (the schemas are additionalProperties: false, no nulls).
const opt = <K extends string>(key: K, value: string | null | undefined) => (value ? { [key]: value } : {}) as Partial<Record<K, string>>;

export interface SubjectRow { id: string; code: string; title: string; availability: string }
export interface TopicRow { id: string; subject_id: string; code: string; legacy_id: string | null; title: string; subtitle: string | null; phase: string; availability: string;
  units: { code: string; title: string; goal?: string; ordinal: number }[] }
export interface ConceptRow { id: string; topic_id: string; code: string; legacy_map_id: string | null; title: string; subtitle: string | null; definition: string | null;
  objectives: string[]; misconceptions: { code: string; description: string }[]; unit_code: string | null; ordinal: number; estimated_minutes: number;
  availability: string; is_hidden: boolean; is_capstone: boolean }
export interface QuestionRow { id: string; code: string; legacy_item_id: string | null; visibility: string; revision_id: string; item_type: string; body: QuestionBody;
  difficulty: number; estimated_minutes: number; concepts: { conceptId: string; topicId: string; role: 'PRIMARY'|'SUPPORTING'; assessable: boolean }[] }
export interface LessonRow { id: string; code: string; route_slug: string | null; practice_set: string | null; revision: number; title: string; estimated_minutes: number; blocks: LessonBlock[];
  conceptIds: string[]; checks: { id: string; ordinal: number; slide_index: number; required: boolean; question_id: string }[] }

export const subjectView = (s: SubjectRow) => ({ id: s.id, code: s.code, title: s.title, availability: s.availability });

export const topicView = (t: TopicRow) => ({
  id: t.id, subjectId: t.subject_id, code: t.code, ...opt('legacyId', t.legacy_id), title: t.title, ...opt('subtitle', t.subtitle), phase: t.phase, availability: t.availability,
});

export const conceptSummary = (c: ConceptRow) => ({
  id: c.id, topicId: c.topic_id, code: c.code, ...opt('legacyMapId', c.legacy_map_id), title: c.title, ...opt('subtitle', c.subtitle), ...opt('unitCode', c.unit_code),
  ordinal: c.ordinal, estimatedMinutes: c.estimated_minutes, availability: c.availability, isHidden: c.is_hidden, isCapstone: c.is_capstone,
});

export const topicDetail = (t: TopicRow, concepts: ConceptRow[], edges: { conceptId: string; prerequisiteId: string; kind: string }[],
  relations: { toTopicId: string; kind: string; label: string }[]) => ({
  ...topicView(t),
  units: t.units.map(u => ({ code: u.code, title: u.title, ...opt('goal', u.goal), ordinal: u.ordinal })),
  concepts: concepts.map(conceptSummary),
  prerequisiteEdges: edges.map(e => ({ conceptId: e.conceptId, prerequisiteId: e.prerequisiteId, kind: e.kind })),
  relations: relations.map(r => ({ toTopicId: r.toTopicId, kind: r.kind, label: r.label })),
});

// Misconceptions expose code and description only: examples and indicators can quote wrong-answer values.
export const conceptView = (c: ConceptRow, prerequisites: { conceptId: string; kind: string }[], lessons: { lessonId: string; routeSlug: string | null; title: string }[], questionCount: number) => ({
  ...conceptSummary(c), ...opt('definition', c.definition), objectives: c.objectives,
  misconceptions: c.misconceptions.map(m => ({ code: m.code, description: m.description })),
  prerequisites: prerequisites.map(p => ({ conceptId: p.conceptId, kind: p.kind })),
  lessons: lessons.map(l => ({ lessonId: l.lessonId, ...opt('routeSlug', l.routeSlug), title: l.title })),
  questionCount,
});

const PREVIEW = 160;
const preview = (prompt: string) => {
  const chars = [...prompt.replace(/\s+/g, ' ').trim()];
  return chars.length <= PREVIEW ? chars.join('') : chars.slice(0, PREVIEW - 1).join('').trimEnd() + '…';
};

export const questionSummary = (q: QuestionRow) => {
  const assessableTopics = new Set(q.concepts.filter(c => c.assessable).map(c => c.topicId));
  return {
    id: q.id, code: q.code, ...opt('legacyItemId', q.legacy_item_id), visibility: q.visibility, itemType: q.item_type, difficulty: q.difficulty, estimatedMinutes: q.estimated_minutes,
    topicIds: [...new Set(q.concepts.map(c => c.topicId))], conceptIds: q.concepts.map(c => c.conceptId),
    isCombined: assessableTopics.size >= 2, promptPreview: preview(q.body.prompt),
  };
};

// Hint text is delivered only by the hint command (it records exposure); here only the count.
export const questionView = (q: QuestionRow) => ({
  id: q.id, revisionId: q.revision_id, code: q.code, ...opt('legacyItemId', q.legacy_item_id), itemType: q.item_type, prompt: q.body.prompt,
  ...opt('figureRef', q.body.figureRef), ...(q.body.options ? { options: q.body.options.map(o => ({ id: o.id, label: o.label })) } : {}),
  answerFormat: q.body.answerFormat, ...opt('answerExample', q.body.answerExample), hintCount: q.body.hints.length,
  difficulty: q.difficulty, estimatedMinutes: q.estimated_minutes, concepts: q.concepts.map(c => ({ conceptId: c.conceptId, role: c.role })),
});

const blockView = (b: LessonBlock) => {
  switch (b.type) {
    case 'math': return { type: b.type, slide: b.slide, name: b.name, expression: b.expression, ...(b.highlight ? { highlight: true } : {}) };
    case 'figure': return { type: b.type, slide: b.slide, figureRef: b.figureRef };
    default: return { type: b.type, slide: b.slide, text: b.text };
  }
};

export const lessonView = (l: LessonRow, question: (id: string) => QuestionRow | undefined) => ({
  id: l.id, code: l.code, ...opt('routeSlug', l.route_slug), ...opt('practiceSetCode', l.practice_set), title: l.title, estimatedMinutes: l.estimated_minutes, contentVersion: l.revision,
  conceptIds: l.conceptIds, slideCount: Math.max(0, ...l.blocks.map(b => b.slide)) + 1, blocks: l.blocks.map(blockView),
  checks: [...l.checks].sort((a, b) => a.ordinal - b.ordinal).flatMap(c => {
    const q = question(c.question_id);
    return q ? [{ microAssessmentId: c.id, ordinal: c.ordinal, slideIndex: c.slide_index, required: c.required, question: questionView(q) }] : [];
  }),
});
