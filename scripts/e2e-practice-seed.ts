// Synthetic browser fixture only. Refuses databases without the _test suffix.
import { readFileSync, writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { sql } from "kysely";
import { readConfig } from "../src/config.js";
import { connect } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { consentedLearner, client } from "../test/fixtures/learner.js";
import { catalogReader } from "../src/catalog/read.js";
const config = readConfig(
    JSON.parse(readFileSync(".local/test-env.json", "utf8")),
  ),
  db = connect(config.databaseUrl);
if (!new URL(config.databaseUrl).pathname.endsWith("_test"))
  throw Error("isolated test DB required");
const learner = await consentedLearner(db, config);
await sql`update student_profile set grade=10,display_name='Alya Uji' where learner_id=${learner.learnerId}`.execute(
  db,
);
const { app } = await buildApp(config, {
    db,
    logStream: new Writable({
      write(_c, _e, n) {
        n();
      },
    }),
  }),
  as = client(app, config, learner),
  c = await catalogReader(config.key).current(db);
if (!c.questions.length)
  throw new Error(
    "Publish the reviewed test fixture first with scripts/e2e-seed.ts.",
  );
const eligible = c.questions
  .filter(
    (q) =>
      q.code.startsWith("MAT.") &&
      q.body.options?.length &&
      q.concepts.every(
        (x) => c.concepts.find((y) => y.id === x.conceptId)?.legacy_map_id,
      ) &&
      q.concepts.some(
        (x) => c.topics.find((t) => t.id === x.topicId)?.phase === "E",
      ),
  )
  .slice(0, 15);
const ids = new Set(
  eligible.flatMap((q) => q.concepts.map((x) => x.conceptId)),
);
for (const id of ids) {
  const core = c.concepts.find((x) => x.id === id)!;
  const r = await as("POST", "/v1/me/core-completions", {
    coreId: core.legacy_map_id,
    score: 1,
    total: 1,
  });
  if (r.status !== 200) throw Error(JSON.stringify(r.body));
}
writeFileSync(
  ".local/e2e-practice-learner.json",
  JSON.stringify({
    cookie: learner.headers.cookie,
    questions: eligible.map((q) => ({
      id: q.id,
      code: q.code,
      prompt: q.body.prompt,
    })),
    learnerId: learner.learnerId,
  }),
);
await app.close();
await db.destroy();
console.log(
  "Synthetic practice learner prepared in .local/e2e-practice-learner.json",
);
