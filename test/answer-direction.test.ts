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
import { catalogReader } from "../src/catalog/read.js";
import { answerDirection } from "../src/assessment/answer-direction.js";
import { reviewedFixture } from "./fixtures/catalog.js";
import { client, consentedLearner } from "./fixtures/learner.js";

const guide = { apiKey: "synthetic-key", model: "deepseek-flash", visionModel: "deepseek-v4-flash-vision-exp" };
const reply = (content: unknown) => (async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] })) as unknown as typeof fetch;

test("wrong practice answer: one core and one friendly sentence, never the right answer", async () => {
  const config = readConfig(JSON.parse(readFileSync(".local/test-env.json", "utf8")));
  assert.match(new URL(config.databaseUrl).pathname, /_test$/);
  const db = connect(config.databaseUrl);
  await migrate(db);
  const fixture = reviewedFixture();
  fixture.release.version = Number((await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(db)).rows[0].v);
  await publish(db, fixture);
  const { app } = await buildApp(config, { db, logStream: new Writable({ write(_c, _e, n) { n(); } }) });
  try {
    const catalog = await catalogReader(config.key).current(db);
    const q = catalog.questions.find((x) => x.body.options?.length && x.concepts.length >= 1 && x.concepts.every((c) => catalog.concepts.find((k) => k.id === c.conceptId)?.legacy_map_id))!;
    assert.ok(q, "fixture has an option question with mapped cores");
    const authored = fixture.questions.find((x) => x.code === q.code)!;
    const right = authored.rubric.answer.optionId!;
    const wrong = q.body.options!.find((o) => o.id !== right)!;
    const core = catalog.concepts.find((k) => k.id === q.concepts[0]!.conceptId)!;

    let sent: any;
    const http = (async (_u: unknown, o?: RequestInit) => { sent = JSON.parse(String(o?.body)); return Response.json({ choices: [{ message: { content: JSON.stringify({ code: core.code, reason: "Siswa sudah memakai rumus yang tepat. Coba cek lagi satuannya, ya." }) } }] }); }) as typeof fetch;
    const got = await answerDirection(db, catalog, guide, { questionId: q.id, optionId: wrong.id }, http);
    assert.deepEqual(got, { coreId: core.legacy_map_id, title: core.title, reason: "Kamu sudah memakai rumus yang tepat. Coba cek lagi satuannya, ya." });
    const system = sent.messages[0].content;
    for (const rule of [/kata "kamu"/, /bukan guru yang memeriksa/, /DILARANG menyebut jawaban benar/, /Dari jawabanmu/]) assert.match(system, rule);

    // jawaban yang sama: dari simpanan, tanpa memanggil AI lagi
    let calls = 0;
    await answerDirection(db, catalog, guide, { questionId: q.id, optionId: wrong.id }, (async () => { calls++; return new Response("", { status: 500 }); }) as typeof fetch);
    assert.equal(calls, 0);

    // kalimat yang membocorkan jawaban benar tidak dikirim
    const rightLabel = q.body.options!.find((o) => o.id === right)!.label;
    const other = q.body.options!.filter((o) => o.id !== right)[1] ?? wrong;
    if (other.id !== wrong.id) await assert.rejects(answerDirection(db, catalog, guide, { questionId: q.id, optionId: other.id }, reply({ code: core.code, reason: `Jawabannya ${rightLabel}.` })), (e: any) => e.status === 503);
    await assert.rejects(answerDirection(db, catalog, guide, { questionId: q.id, optionId: right }, reply({})), (e: any) => e.status === 409);
    await assert.rejects(answerDirection(db, catalog, guide, { questionId: "01a19a29-0000-7000-8000-000000000000", optionId: "a" }, reply({})), (e: any) => e.status === 404);
    await assert.rejects(answerDirection(db, catalog, guide, { questionId: q.id }, reply({})), (e: any) => e.status === 400);

    // rute: siswa dengan izin; tamu ditolak
    assert.ok([401, 403].includes((await app.inject({ method: "POST", url: "/v1/practice/answer-direction", payload: { questionId: q.id, optionId: wrong.id } })).statusCode));
    const learner = await consentedLearner(db, config);
    const r = await client(app, config, learner)("POST", "/v1/practice/answer-direction", { questionId: q.id });
    assert.ok([400, 403].includes(r.status), JSON.stringify(r.body));
  } finally {
    await app.close();
    await db.destroy();
  }
});
