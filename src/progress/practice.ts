import { practiceFeedback } from "../assessment/practice-feedback.js";
import type { Catalog } from "../catalog/read.js";
import { questionSummary } from "../catalog/projection.js";
import {
  practiceFacts,
  type PracticeAttempt,
} from "../learning/practice-facts.js";
import { practiceRevisions } from "../catalog/practice-facts.js";
import type { Connection } from "../db.js";
import { fail } from "../platform/errors.js";
import { hash, stable } from "../platform/crypto.js";
import { progressPage, type rebuildProgress } from "./service.js";

type Projection = Awaited<ReturnType<typeof rebuildProgress>>;
export type QuestionStatus =
  | "UNTRIED"
  | "IN_PROGRESS"
  | "PENDING"
  | "RETRY"
  | "ASSISTED"
  | "CORRECT"
  | "UNASSESSED";
export interface PracticeFilter {
  subjectCode?: string;
  phase?: string;
  topicId?: string;
  conceptId?: string;
  coreCount?: string;
  status?: QuestionStatus;
  scope?: "all" | "ready" | "history";
  q?: string;
  sort?: "recommended" | "easy" | "hard" | "short";
  cursor?: string;
  limit?: number;
}
export function attemptStatus(
  a: Pick<PracticeAttempt, "graded_at" | "verdict" | "assistance">,
): QuestionStatus {
  if (!a.graded_at) return "PENDING";
  if (a.verdict === "CORRECT")
    return a.assistance === "NONE" ? "CORRECT" : "ASSISTED";
  return a.verdict === "INCORRECT" ? "RETRY" : "UNASSESSED";
}
const counted = (p: Projection, id: string) => {
  const v = p.views.find((v) => v.conceptId === id);
  // Same product threshold as the map, with contradictions fenced out. Stale mastery remains reviewable.
  const latest = p.evidence
    .filter((e) => e.concept_id === id && e.mastery_eligible)
    .sort(
      (a, b) =>
        new Date(p.attempts.get(b.attempt_id)!.submitted_at).getTime() -
        new Date(p.attempts.get(a.attempt_id)!.submitted_at).getTime(),
    )[0];
  return (
    !!v &&
    v.needsReviewReason !== "CONTRADICTION" &&
    latest?.classification !== "MISCONCEPTION_EVIDENCED" &&
    (v.uiTier >= 2 ||
      p.completed.has(id) ||
      latest?.classification === "UNDERSTANDING_DEMONSTRATED")
  );
};
export async function practiceData(
  db: Connection,
  learnerId: string,
  catalog: Catalog,
  projection: Projection,
) {
  const facts = await practiceFacts(db, learnerId);
  const revisions = await practiceRevisions(db, [
    ...new Set([
      ...facts.attempts.map((a) => a.question_revision_id),
      ...facts.pending.map((a) => a.question_revision_id),
    ]),
  ]);
  const revisionMap = new Map(revisions.map((q) => [q.revision_id, q]));
  const attempts = new Map<string, PracticeAttempt[]>();
  for (const a of facts.attempts) {
    const q = revisionMap.get(a.question_revision_id);
    if (q) attempts.set(q.id, [...(attempts.get(q.id) ?? []), a]);
  }
  const questions = new Map(catalog.questions.map((q) => [q.id, q]));
  for (const q of revisions) if (!questions.has(q.id)) questions.set(q.id, q);
  const items = [...questions.values()].map((q) => {
    const history = attempts.get(q.id) ?? [],
      latest = history[0];
    const pending = facts.pending.find(
      (i) => revisionMap.get(i.question_revision_id)?.id === q.id,
    );
    const status = latest
      ? attemptStatus(latest)
      : pending
        ? "IN_PROGRESS"
        : "UNTRIED";
    const ids = [...new Set(q.concepts.map((c) => c.conceptId))];
    return {
      question: questionSummary(q),
      available: catalog.questions.some((c) => c.id === q.id),
      coreCount: ids.length,
      ready: ids.length > 0 && ids.every((id) => counted(projection, id)),
      needsReview: ids.some(
        (id) =>
          projection.views.find((v) => v.conceptId === id)?.needsReview ===
          true,
      ),
      progress: {
        status,
        attemptCount: history.length,
        correctAfterRetry:
          !!latest &&
          latest.verdict === "CORRECT" &&
          history.slice(1).some((a) => a.verdict === "INCORRECT"),
        ...(latest
          ? { lastAttemptAt: new Date(latest.submitted_at).toISOString() }
          : {}),
        ...(pending ? { resumeSessionId: pending.session_id } : {}),
      },
    };
  });
  return {
    items,
    attempts,
    revisionMap,
    feedback: await practiceFeedback(db, learnerId),
  };
}
export function practiceList(
  data: Awaited<ReturnType<typeof practiceData>>,
  c: Catalog,
  p: Projection,
  f: PracticeFilter,
  key: Buffer,
  learnerId: string,
) {
  const subject = c.subjects.find((s) => s.code === f.subjectCode);
  const topics = c.topics.filter(
    (t) =>
      (!f.subjectCode || t.subject_id === subject?.id) &&
      (!f.phase || t.phase === f.phase),
  );
  const topicIds = new Set(topics.map((t) => t.id));
  const scoped = data.items.filter((i) =>
    i.question.topicIds.some((id) => topicIds.has(id)),
  );
  const attempted = scoped.filter((i) => i.progress.attemptCount > 0);
  const summary = {
    tried: attempted.length,
    correct: attempted.filter((i) => i.progress.status === "CORRECT").length,
    retry: attempted.filter((i) => i.progress.status === "RETRY").length,
    assisted: attempted.filter((i) => i.progress.status === "ASSISTED").length,
  };
  const query = f.q?.trim().toLocaleLowerCase("id-ID");
  const matched = scoped.filter(
    (i) =>
      (f.scope !== "ready" || (i.available && i.ready)) &&
      (f.scope !== "history" ||
        i.progress.attemptCount > 0 ||
        i.progress.status === "IN_PROGRESS") &&
      (!f.topicId || i.question.topicIds.includes(f.topicId)) &&
      (!f.conceptId || i.question.conceptIds.includes(f.conceptId)) &&
      (!f.status || i.progress.status === f.status) &&
      (!f.coreCount ||
        (f.coreCount === "4+"
          ? i.coreCount >= 4
          : i.coreCount === Number(f.coreCount))) &&
      (!query ||
        [
          i.question.promptPreview,
          ...i.question.conceptIds.map(
            (id) => c.concepts.find((x) => x.id === id)?.title ?? "",
          ),
          ...i.question.topicIds.map(
            (id) => c.topics.find((t) => t.id === id)?.title ?? "",
          ),
        ]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(query)),
  );
  const rank = (i: (typeof matched)[number]) =>
    i.progress.status === "RETRY"
      ? 0
      : i.needsReview
        ? 1
        : i.progress.status === "UNTRIED"
          ? 2
          : 3;
  matched.sort((a, b) =>
    f.scope === "history"
      ? (b.progress.lastAttemptAt ?? "").localeCompare(
          a.progress.lastAttemptAt ?? "",
        ) || a.question.id.localeCompare(b.question.id)
      : (f.sort === "easy"
          ? a.question.difficulty - b.question.difficulty
          : f.sort === "hard"
            ? b.question.difficulty - a.question.difficulty
            : f.sort === "short"
              ? a.question.estimatedMinutes - b.question.estimatedMinutes
              : rank(a) - rank(b)) ||
        a.question.code.localeCompare(b.question.code),
  );
  const { cursor, limit, ...filters } = f;
  // Bind the offset cursor to both query and data, so a new result cannot silently shift pages.
  const binding =
    "practice:" +
    learnerId +
    ":" +
    hash(stable({ filters, release: c.releaseId, items: matched })).toString(
      "hex",
    );
  const page = progressPage(matched, cursor, limit ?? 10, key, binding);
  const overview = topics.map((t) => {
    const cores = c.concepts.filter(
      (x) => x.topic_id === t.id && !x.is_hidden && !x.is_capstone,
    );
    return {
      id: t.id,
      title: t.title,
      total: cores.length,
      mastered: cores.filter((x) => counted(p, x.id)).length,
      cores: cores.map((x) => ({
        id: x.id,
        title: x.title,
        ...(x.legacy_map_id ? { legacyMapId: x.legacy_map_id } : {}),
        mastered: counted(p, x.id),
        needsReview:
          p.views.find((v) => v.conceptId === x.id)?.needsReview === true,
      })),
    };
  });
  return { ...page, total: matched.length, summary, topics: overview };
}
export function questionHistory(
  data: Awaited<ReturnType<typeof practiceData>>,
  questionId: string,
  cursor: string | undefined,
  limit: number,
  key: Buffer,
  learnerId: string,
) {
  if (
    !data.items.some(
      (i) =>
        i.question.id === questionId &&
        (i.progress.attemptCount > 0 || i.progress.status === "IN_PROGRESS"),
    )
  )
    fail(404, "NOT_FOUND");
  const rows = (data.attempts.get(questionId) ?? []).map((a) => ({
    attemptId: a.id,
    sessionId: a.session_id,
    submittedAt: new Date(a.submitted_at).toISOString(),
    verdict: a.verdict,
    assistance: a.assistance,
    status: attemptStatus(a),
    ...(() => {
      const f = data.feedback.find((f) => f.attempt_id === a.id);
      return f
        ? {
            feedback: [f.headline, f.lede].filter(Boolean).join(" "),
            recommendedConceptIds: (f.recommendations ?? []).flatMap((r) =>
              r.conceptId ? [r.conceptId] : [],
            ),
          }
        : {};
    })(),
    response: {
      responseType: a.response.responseType,
      ...(a.response.text !== undefined ? { text: a.response.text } : {}),
      ...(a.response.numeric !== undefined
        ? { numeric: String(a.response.numeric) }
        : {}),
      ...(a.response.optionId ? { optionId: a.response.optionId } : {}),
      purged: a.response.purged === true,
    },
  }));
  return progressPage(
    rows,
    cursor,
    limit,
    key,
    "question-history:" +
      learnerId +
      ":" +
      questionId +
      ":" +
      hash(stable(rows)).toString("hex"),
  );
}

/*
 * Latihan per bab (halaman Latihan): satu ringkasan per bab pelajaran, dan 5 soal berikutnya untuk sesi bab.
 * Soal yang ditawarkan hanya soal yang semua intinya sudah dikuasai ("ready"), supaya latihan bab menguji ulang
 * yang sudah dipelajari (retrieval practice), bukan soal di luar jangkauan. Urutan pilihan: soal yang belum pernah
 * dicoba, satu soal gabungan, satu soal yang pernah meleset, lalu soal lama yang paling lama tidak dikerjakan.
 * Bab tanpa inti dikuasai tidak punya soal siap: aplikasi menawarkan materi inti pertamanya dulu.
 */
export const CHAPTER_SET = 5;
type PracticeItem = Awaited<ReturnType<typeof practiceData>>["items"][number];
export function pickChapterSet(ready: PracticeItem[], size = CHAPTER_SET): PracticeItem[] {
  const untried = ready.filter((i) => i.progress.status === "UNTRIED");
  const single = untried.filter((i) => i.coreCount === 1), multi = untried.filter((i) => i.coreCount > 1);
  const missed = ready.filter((i) => i.progress.status === "RETRY");
  const old = ready
    .filter((i) => i.progress.attemptCount > 0 && i.progress.status !== "RETRY")
    .sort((a, b) => (a.progress.lastAttemptAt ?? "").localeCompare(b.progress.lastAttemptAt ?? ""));
  const picked: PracticeItem[] = [];
  const take = (list: PracticeItem[], n: number) => { for (const i of list) { if (picked.length >= size || n <= 0) break; if (!picked.includes(i)) { picked.push(i); n--; } } };
  take(single, 3); take(multi, 1); take(missed, 1); take(old, size);
  take([...single, ...multi, ...missed], size);
  return picked;
}
export function chapterPractice(data: Awaited<ReturnType<typeof practiceData>>, c: Catalog, p: Projection, subjectCode: string) {
  const subject = c.subjects.find((s) => s.code === subjectCode);
  if (!subject) fail(404, "NOT_FOUND");
  const order = ["D", "E", "F", "F+"];
  const topics = c.topics
    .filter((t) => t.subject_id === subject!.id && t.availability === "MAPPED")
    .sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || a.code.localeCompare(b.code));
  const items = topics.map((t) => {
    const cores = c.concepts.filter((x) => x.topic_id === t.id && !x.is_hidden && !x.is_capstone).sort((a, b) => a.ordinal - b.ordinal);
    const mastered = cores.filter((x) => counted(p, x.id));
    const questions = data.items.filter((i) => i.available && i.question.topicIds.includes(t.id));
    const ready = questions.filter((i) => i.ready);
    const tried = questions.filter((i) => i.progress.attemptCount > 0);
    const correct = tried.filter((i) => i.progress.status === "CORRECT" || i.progress.status === "ASSISTED");
    const last = tried.map((i) => i.progress.lastAttemptAt ?? "").sort().at(-1);
    const next = pickChapterSet(ready);
    const firstCore = cores.find((x) => !counted(p, x.id)) ?? null;
    return {
      topicId: t.id, code: t.code, title: t.title, phase: t.phase,
      cores: { total: cores.length, mastered: mastered.length },
      questions: { total: questions.length, ready: ready.length, tried: tried.length, correct: correct.length, untriedReady: ready.filter((i) => i.progress.status === "UNTRIED").length },
      ...(last ? { lastAttemptAt: last } : {}),
      sources: [...new Set(questions.map((i) => i.question.source.label))],
      next: next.map((i) => i.question.id),
      ...(firstCore ? { nextCore: { conceptId: firstCore.id, title: firstCore.title, ...(firstCore.legacy_map_id ? { legacyMapId: firstCore.legacy_map_id } : {}) } } : {}),
    };
  });
  return { subjectCode, items };
}
