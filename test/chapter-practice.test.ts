import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { sql } from "kysely";
import { readConfig } from "../src/config.js";
import { connect } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { buildApp } from "../src/app.js";
import { publish } from "../src/catalog/publisher.js";
import { questionSource } from "../src/catalog/projection.js";
import { pickChapterSet } from "../src/progress/practice.js";
import { reviewedFixture } from "./fixtures/catalog.js";
import { client, consentedLearner } from "./fixtures/learner.js";

const item = (id: string, status: string, coreCount = 1, lastAttemptAt?: string) => ({
  question: { id } as any, available: true, coreCount, ready: true, needsReview: false,
  progress: { status, attemptCount: status === "UNTRIED" ? 0 : 1, correctAfterRetry: false, ...(lastAttemptAt ? { lastAttemptAt } : {}) },
}) as any;

test("chapter set: untried first, one combined, one missed, then the oldest practised", () => {
  const set = pickChapterSet([
    item("old-new", "CORRECT", 1, "2026-10-30"), item("old", "CORRECT", 1, "2026-10-01"),
    item("u1", "UNTRIED"), item("u2", "UNTRIED"), item("u3", "UNTRIED"), item("u4", "UNTRIED"),
    item("m1", "UNTRIED", 2), item("r1", "RETRY"),
  ]);
  assert.deepEqual(set.map((i) => i.question.id), ["u1", "u2", "u3", "m1", "r1"]);
  // sedikit soal baru: sisanya soal lama yang paling lama tidak dikerjakan
  assert.deepEqual(pickChapterSet([item("old-new", "CORRECT", 1, "2026-10-30"), item("old", "CORRECT", 1, "2026-10-01"), item("u1", "UNTRIED")]).map((i) => i.question.id), ["u1", "old", "old-new"]);
  assert.deepEqual(pickChapterSet([]), []);
});

test("question source: real exams by name and year, team questions as Soal IntiBelajar with their style", () => {
  assert.deepEqual(questionSource({ source: "x", exam: { name: "UN SMA", year: 2019, number: 14 } }), { kind: "EXAM", label: "UN SMA 2019 · no. 14" });
  assert.deepEqual(questionSource({ source: "authored:pilot", note: "Gaya soal UTBK-SNBT (Tes Skolastik); disusun ulang" }), { kind: "AUTHORED", label: "Soal IntiBelajar", style: "Gaya UTBK-SNBT" });
  assert.deepEqual(questionSource({ source: "authored:pilot", note: "Gaya soal Ujian Nasional SMA (kisi-kisi UN 2015–2019)" }), { kind: "AUTHORED", label: "Soal IntiBelajar", style: "Gaya UN SMA" });
  assert.deepEqual(questionSource(null), { kind: "AUTHORED", label: "Soal IntiBelajar" });
});

test("chapter practice offers only questions whose cores are mastered; a new chapter offers its first core", async () => {
  const config = readConfig(JSON.parse(readFileSync(".local/test-env.json", "utf8")));
  assert.match(new URL(config.databaseUrl).pathname, /_test$/);
  const db = connect(config.databaseUrl);
  await migrate(db);
  const fixture = reviewedFixture();
  fixture.release.version = Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);
  await publish(db, fixture);
  const { app } = await buildApp(config, { db, logStream: new Writable({ write(_c, _e, n) { n(); } }) });
  const learner = await consentedLearner(db, config);
  const as = client(app, config, learner);
  try {
    assert.equal((await app.inject("/v1/me/chapters?subjectCode=MAT")).statusCode, 401);
    assert.equal((await as("GET", "/v1/me/chapters")).status, 400);
    assert.equal((await as("GET", "/v1/me/chapters?subjectCode=NOPE")).status, 404);
    const before = await as("GET", "/v1/me/chapters?subjectCode=MAT");
    assert.equal(before.status, 200, JSON.stringify(before.body));
    const chapter = before.body.items.find((c: any) => c.questions.total > 0 && c.cores.total > 0);
    assert.ok(chapter, "fixture has a chapter with questions");
    assert.deepEqual(chapter.next, []);
    assert.equal(chapter.cores.mastered, 0);
    assert.ok(chapter.nextCore?.conceptId);
    assert.ok(chapter.sources.includes("Soal IntiBelajar"));

    // kuasai semua inti bab ini: soal yang intinya hanya dari bab ini menjadi siap
    const bank = await as("GET", `/v1/me/questions?topicId=${chapter.topicId}&limit=100`);
    const cores = bank.body.topics.find((t: any) => t.id === chapter.topicId).cores.filter((c: any) => c.legacyMapId);
    for (const c of cores) assert.equal((await as("POST", "/v1/me/core-completions", { coreId: c.legacyMapId, score: 1, total: 1 })).status, 200);
    const after = (await as("GET", "/v1/me/chapters?subjectCode=MAT")).body.items.find((c: any) => c.topicId === chapter.topicId);
    assert.equal(after.cores.mastered, cores.length);
    assert.ok(after.next.length > 0 && after.next.length <= 5);
    assert.ok(after.questions.ready >= after.next.length);
    const ready = new Set(bank.body.items.filter((i: any) => i.question.conceptIds.every((id: string) => cores.some((c: any) => c.id === id))).map((i: any) => i.question.id));
    for (const id of after.next) assert.ok(ready.has(id), "every offered question uses only mastered cores");

    // sesi latihan bab memakai soal yang ditawarkan; ringkasan soal membawa sumbernya
    const opened = await as("POST", "/v1/learning-sessions", { kind: "PRACTICE", origin: "BANK", withLesson: false, spec: { questionIds: after.next } });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    const q = await as("GET", `/v1/questions/${after.next[0]}`);
    assert.equal(q.body.source.label, "Soal IntiBelajar");
  } finally {
    await app.close();
    await db.destroy();
  }
});
