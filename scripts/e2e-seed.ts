import { readFileSync, writeFileSync } from 'node:fs';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { publish } from '../src/catalog/publisher.js';
import { cookieName } from '../src/identity/service.js';
import { rollbackTo } from '../test/fixtures/db.js';
import { reviewedFixture } from '../test/fixtures/catalog.js';
import { consentedLearner } from '../test/fixtures/learner.js';
// Browser E2E seed (Slice 1 M8). Test databases only: resets the catalog and learning tables, publishes the
// synthetic *reviewed fixture* (never the real draft), and signs in one synthetic, consented learner.
// Writes the session cookie to .local/e2e-learner.json for Playwright; nothing here is a real person.

const env = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
const config = readConfig({ ...env, APP_ORIGIN: process.env.APP_ORIGIN ?? env.APP_ORIGIN });
if (!/_test$/.test(new URL(config.databaseUrl).pathname)) throw new Error('The E2E seed only runs against a dedicated *_test database');
const db = connect(config.databaseUrl);
try {
  await migrate(db);
  await rollbackTo(db, '0001_slice0.up.sql');
  await migrate(db);
  await publish(db, reviewedFixture());
  // One synthetic learner per E2E test that needs its own (the API limits a learner to 120 requests a minute);
  // the first is also written at the top level for the Slice 1 practice spec.
  const learners = [];
  for (let i = 0; i < 10; i++) {
    const learner = await consentedLearner(db, config);
    learners.push({ name: cookieName, value: learner.headers.cookie.slice(cookieName.length + 1), learnerId: learner.learnerId });
  }
  writeFileSync('.local/e2e-learner.json', JSON.stringify({ ...learners[0], learners }, null, 2));
  console.log('E2E seed ready: reviewed fixture published, 10 synthetic consented learners (.local/e2e-learner.json)');
} finally { await db.destroy(); }
