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
import { reviewedFixture } from "./fixtures/catalog.js";
import { client, consentedLearner } from "./fixtures/learner.js";
import { attemptStatus } from "../src/progress/practice.js";

test("practice statuses never classify a pending or ungraded attempt as incorrect", () => {
  assert.equal(
    attemptStatus({
      graded_at: null,
      verdict: "INCORRECT",
      assistance: "NONE",
    }),
    "PENDING",
  );
  assert.equal(
    attemptStatus({
      graded_at: new Date(),
      verdict: "UNREADABLE",
      assistance: "NONE",
    }),
    "UNASSESSED",
  );
  assert.equal(
    attemptStatus({
      graded_at: new Date(),
      verdict: "CORRECT",
      assistance: "HINT",
    }),
    "ASSISTED",
  );
});
test("learner question bank filters before paging and keeps owned immutable history", async (t) => {
  const config = readConfig(
    JSON.parse(readFileSync(".local/test-env.json", "utf8")),
  );
  assert.match(new URL(config.databaseUrl).pathname, /_test$/);
  const db = connect(config.databaseUrl);
  await migrate(db);
  const fixture = reviewedFixture();
  fixture.release.version = Number(
    (
      await sql<any>`select coalesce(max(version),0)+1 v from curriculum_release`.execute(
        db,
      )
    ).rows[0].v,
  );
  await publish(db, fixture);
  const { app } = await buildApp(config, {
    db,
    logStream: new Writable({
      write(_c, _e, n) {
        n();
      },
    }),
  });
  const a = await consentedLearner(db, config),
    b = await consentedLearner(db, config),
    pending = await consentedLearner(db, config, { consent: false });
  const as = client(app, config, a),
    bs = client(app, config, b);
  const get = async (url: string) => {
    const r = await as("GET", url);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  try {
    const all = await get("/v1/me/questions?limit=100");
    const multi = all.items.find(
      (i: any) =>
        i.coreCount >= 2 &&
        i.question.itemType === "MCQ" &&
        i.question.conceptIds.every((id: string) =>
          all.topics.some((t: any) =>
            t.cores.some((c: any) => c.id === id && c.legacyMapId),
          ),
        ),
    );
    // Catalog calls the option format MULTIPLE_CHOICE on some authored revisions.
    const candidate =
      multi ??
      all.items.find(
        (i: any) =>
          i.coreCount >= 2 &&
          fixture.questions.find((q) => q.code === i.question.code)?.body
            .options?.length &&
          i.question.conceptIds.every((id: string) =>
            all.topics.some((t: any) =>
              t.cores.some((c: any) => c.id === id && c.legacyMapId),
            ),
          ),
      );
    assert.ok(candidate, "fixture includes a playable multi-core question");
    await t.test("student authentication and consent gates", async () => {
      assert.equal((await app.inject("/v1/me/questions")).statusCode, 401);
      assert.equal(
        (await client(app, config, pending)("GET", "/v1/me/questions")).status,
        403,
      );
      assert.equal((await get("/v1/me/questions?scope=ready")).total, 0);
    });
    await t.test(
      "every required core, including supporting cores, must be ready",
      async () => {
        const aliases = candidate.question.conceptIds.map(
          (id: string) =>
            all.topics
              .flatMap((t: any) => t.cores)
              .find((c: any) => c.id === id).legacyMapId,
        );
        for (let i = 0; i < aliases.length; i++) {
          const r = await as("POST", "/v1/me/core-completions", {
            coreId: aliases[i],
            score: 1,
            total: 1,
          });
          assert.equal(r.status, 200, JSON.stringify(r.body));
          const page = await get("/v1/me/questions?scope=ready&limit=100");
          assert.equal(
            page.items.some(
              (x: any) => x.question.id === candidate.question.id,
            ),
            i === aliases.length - 1,
          );
        }
      },
    );
    await t.test(
      "exact core counts, query and status filters apply before paging",
      async () => {
        for (const count of ["1", "2", "3", "4+"]) {
          const full = await get(
            "/v1/me/questions?topicId=" +
              candidate.question.topicIds[0] +
              "&coreCount=" +
              encodeURIComponent(count) +
              "&limit=100",
          );
          assert.ok(
            full.items.every((i: any) =>
              count === "4+" ? i.coreCount >= 4 : i.coreCount === Number(count),
            ),
          );
          const collected: any[] = [];
          let cursor: string | null = null;
          do {
            const page = await get(
              "/v1/me/questions?topicId=" +
                candidate.question.topicIds[0] +
                "&coreCount=" +
                encodeURIComponent(count) +
                "&limit=7" +
                (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
            );
            collected.push(...page.items);
            cursor = page.nextCursor;
          } while (cursor);
          assert.deepEqual(
            collected.map((i) => i.question.id),
            full.items.map((i: any) => i.question.id),
          );
        }
        const found = await get(
          "/v1/me/questions?q=" +
            encodeURIComponent(candidate.question.promptPreview.slice(0, 15)),
        );
        assert.ok(
          found.items.some((i: any) => i.question.id === candidate.question.id),
        );
        assert.equal(
          (await as("GET", "/v1/me/questions?coreCount=0")).status,
          400,
        );
        assert.equal(
          (await as("GET", "/v1/me/questions?cursor=bad")).status,
          400,
        );
      },
    );
    let sessionId: string;
    const authored = fixture.questions.find(
      (q) => q.code === candidate.question.code,
    )!;
    const wrong = authored.body.options!.find(
      (o) => o.id !== authored.rubric.answer.optionId,
    )!.id;
    const submit = async (optionId: string) => {
      const opened = await as("POST", "/v1/learning-sessions", {
        kind: "PRACTICE",
        origin: "BANK",
        withLesson: false,
        spec: { questionIds: [candidate.question.id] },
      });
      assert.equal(opened.status, 201, JSON.stringify(opened.body));
      sessionId = opened.body.id;
      const r = await as(
        "POST",
        `/v1/learning-sessions/${sessionId}/attempts`,
        {
          expectedStateVersion: opened.body.stateVersion,
          response: { responseType: "OPTION", optionId },
        },
      );
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    await t.test(
      "wrong results persist, owned history has the submitted answer and feedback",
      async () => {
        const result = await submit(wrong);
        assert.equal(result.attempt.verdict, "INCORRECT");
        const page = await get("/v1/me/questions?scope=history");
        const item = page.items.find(
          (i: any) => i.question.id === candidate.question.id,
        );
        assert.equal(item.progress.status, "RETRY");
        assert.equal(page.summary.tried, 1);
        assert.equal(page.summary.retry, 1);
        const history = await get(
          `/v1/me/questions/${candidate.question.id}/history`,
        );
        assert.equal(history.items[0].response.optionId, wrong);
        assert.ok(history.items[0].feedback);
        assert.equal(
          (await bs("GET", `/v1/me/questions/${candidate.question.id}/history`))
            .status,
          404,
        );
        assert.equal(
          (await bs("GET", "/v1/me/questions?scope=history")).body.total,
          0,
        );
      },
    );
    await t.test(
      "a retry adds a new attempt, resolves retry count, preserves wrong attempt and marks assistance",
      async () => {
        await submit(authored.rubric.answer.optionId!);
        const page = await get("/v1/me/questions?scope=history");
        const item = page.items.find(
          (i: any) => i.question.id === candidate.question.id,
        );
        assert.ok(["CORRECT", "ASSISTED"].includes(item.progress.status));
        assert.equal(item.progress.attemptCount, 2);
        assert.equal(item.progress.correctAfterRetry, true);
        assert.equal(page.summary.tried, 1);
        assert.equal(page.summary.retry, 0);
        const history = await get(
          `/v1/me/questions/${candidate.question.id}/history?limit=1`,
        );
        assert.equal(history.items.length, 1);
        assert.equal(history.items[0].verdict, "CORRECT");
        const older = await get(
          `/v1/me/questions/${candidate.question.id}/history?limit=1&cursor=${encodeURIComponent(history.nextCursor)}`,
        );
        assert.equal(older.items[0].verdict, "INCORRECT");
        assert.equal(
          (
            await bs(
              "GET",
              `/v1/me/questions/${candidate.question.id}/history?cursor=${encodeURIComponent(history.nextCursor)}`,
            )
          ).status,
          404,
        );
        const session = await get("/v1/learning-sessions/" + sessionId);
        assert.equal(session.items[0].verdict, "CORRECT");
      },
    );
    await t.test(
      "active question resumes across devices and stale cursors fail closed",
      async () => {
        const opened = await as("POST", "/v1/learning-sessions", {
          kind: "PRACTICE",
          origin: "BANK",
          withLesson: false,
          spec: { questionIds: [candidate.question.id] },
        });
        assert.equal(opened.status, 201);
        const page = await get("/v1/me/questions?limit=1");
        assert.ok(page.nextCursor);
        assert.equal(
          (
            await as(
              "GET",
              "/v1/me/questions?coreCount=1&cursor=" +
                encodeURIComponent(page.nextCursor),
            )
          ).status,
          400,
        );
        const full = await get("/v1/me/questions?scope=history&limit=100");
        assert.equal(
          full.items.find((i: any) => i.question.id === candidate.question.id)
            .progress.resumeSessionId,
          opened.body.id,
        );
        for (const i of full.items)
          assert.equal(new Set(i.question.conceptIds).size, i.coreCount);
      },
    );
  } finally {
    await app.close();
    await db.destroy();
  }
});
