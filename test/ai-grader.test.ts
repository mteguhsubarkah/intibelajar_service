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
import type { AiGrade, AiGrader } from "../src/assessment/ai-grader.js";
import { reviewedFixture } from "./fixtures/catalog.js";
import { client, consentedLearner } from "./fixtures/learner.js";

/*
 * Penilaian berjenjang di latihan akun: soal 1 inti yang benar pasti → aturan tanpa AI; salah / esai tidak cocok /
 * multi-inti → AI (penilai tiruan di sini); tanpa izin AI_PROCESSING → aturan saja.
 */
test("tiered grading: rule for a sure single-core correct answer, AI for the rest, rule only without AI consent", async () => {
  const config = readConfig(JSON.parse(readFileSync(".local/test-env.json", "utf8")));
  assert.match(new URL(config.databaseUrl).pathname, /_test$/);
  const db = connect(config.databaseUrl);
  await migrate(db);
  const fixture = reviewedFixture();
  fixture.release.version = Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);
  await publish(db, fixture);
  const calls: string[] = [];
  let reply: (codes: string[]) => AiGrade = (codes) => ({ correct: false, items: codes.map((code) => ({ code, state: "gap", reason: "Kamu sudah menemukan bedanya, coba cek lagi berapa kali beda itu ditambahkan, ya.", quote: "" })) });
  const fake: AiGrader = { async grade(source, response) { calls.push(response.text ?? ""); return reply(source.concepts.filter((c) => c.assessable).map((c) => c.code)); } };
  const { app } = await buildApp(config, { db, aiGrader: fake, logStream: new Writable({ write(_c, _e, n) { n(); } }) });
  try {
    const learner = await consentedLearner(db, config, { purposes: ["LEARNING_DATA", "AI_PROCESSING"] });
    const as = client(app, config, learner);
    const bar = (await sql<{ id: string }>`select id from question where code = 'MAT.BAR.Q.BARISAN_ARITMETIKA_2'`.execute(db)).rows[0];
    assert.ok(bar, "fixture has the barisan question");
    const run = async (text: string, as2 = as) => {
      const s = await as2("POST", "/v1/learning-sessions", { kind: "PRACTICE", origin: "BANK", withLesson: false, spec: { questionIds: [bar.id] } });
      assert.equal(s.status, 201, JSON.stringify(s.body));
      const r = await as2("POST", `/v1/learning-sessions/${s.body.id}/attempts`, { expectedStateVersion: s.body.stateVersion, sessionItemId: s.body.items[0].id, response: { responseType: "TEXT", text } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };

    // 1. 1 inti, jawaban akhir pasti benar → aturan, AI tidak dipanggil, bukti menambah penguasaan
    const right = await run("U15 = 5 + 14 × 4 = 61\nJadi suku ke-15 adalah 61.");
    assert.equal(right.attempt.verdict, "CORRECT");
    assert.equal(right.diagnosisRun.engine, "DETERMINISTIC");
    assert.equal(calls.length, 0);
    assert.ok(right.diagnosisRun.evidence.every((e: any) => e.source === "DETERMINISTIC"));

    // 2. 1 inti, salah → AI: tetap SALAH (kunci memutuskan), alasan gap dari AI
    const wrong = await run("Un = a + n × b\nU15 = 5 + 15 × 4 = 65");
    assert.equal(calls.length, 1);
    assert.equal(wrong.attempt.verdict, "INCORRECT");
    assert.equal(wrong.diagnosisRun.engine, "AI_ASSISTED");
    const gap = wrong.diagnosisRun.evidence.find((e: any) => e.classification === "MISCONCEPTION_EVIDENCED");
    assert.ok(gap?.rationale?.startsWith("Kamu sudah"), JSON.stringify(wrong.diagnosisRun.evidence));
    assert.equal(gap.source, "AI");

    // 3. esai yang tidak cocok dengan pilihan mana pun → benar/salah dari AI; tanpa tambahan penguasaan (AI_ONLY)
    reply = (codes) => ({ correct: true, items: codes.map((code) => ({ code, state: "ok", reason: "Kamu menambahkan beda sebanyak 14 kali dengan tepat.", quote: "ditambah 14 kali" })) });
    const essay = await run("Suku pertama 5, bedanya 4 ditambah 14 kali, hasilnya enam puluh satu.");
    assert.equal(calls.length, 2);
    assert.equal(essay.attempt.verdict, "CORRECT");
    const ok = essay.diagnosisRun.evidence.find((e: any) => e.classification === "UNDERSTANDING_DEMONSTRATED");
    assert.equal(ok.source, "AI");
    assert.equal(ok.eligibility.mastery, false);
    assert.ok(ok.refs.some((r: any) => r.quote === "ditambah 14 kali"));

    // 3b. "gatau ah bingung" → dirangkul AI: tidak terbaca (soal tetap terbuka), kalimat rangkul + inti untuk mulai
    reply = (codes) => ({ correct: null, support: "Nggak apa-apa. Kita mulai dari bedanya dulu.", items: codes.map((code) => ({ code, state: "rest", reason: "Dari jawabanmu, belum terlihat beda antarsuku yang kamu cari.", quote: "" })) });
    const confused = await run("gatau ah bingung bang");
    assert.equal(calls.length, 3);
    assert.equal(confused.attempt.verdict, "UNREADABLE");
    assert.equal(confused.session.items[0].status, "PENDING");
    assert.equal(confused.diagnosisRun.lede, "Nggak apa-apa. Kita mulai dari bedanya dulu.");
    assert.ok(confused.diagnosisRun.evidence.some((e: any) => e.rationale?.startsWith("Dari jawabanmu")));

    // 3c. ketikan acak → tidak nyambung: tanpa AI
    const mash = await run("asdfgh wkwkwk");
    assert.equal(mash.attempt.verdict, "UNREADABLE");
    assert.equal(calls.length, 3);

    // 4. tanpa izin AI_PROCESSING → aturan saja, AI tidak dipanggil
    const plain = client(app, config, await consentedLearner(db, config));
    const noAi = await run("Un = a + n × b\nU15 = 65", plain);
    assert.equal(noAi.attempt.verdict, "INCORRECT");
    assert.equal(noAi.diagnosisRun.engine, "DETERMINISTIC");
    assert.equal(calls.length, 3);
  } finally {
    await app.close();
    await db.destroy();
  }
});
