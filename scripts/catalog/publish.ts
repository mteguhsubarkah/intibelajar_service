import { resolve } from 'node:path';
import { readConfig } from '../../src/config.js';
import { connect } from '../../src/db.js';
import { formatFindings, loadManifest } from '../../src/catalog/manifest.js';
import { publish, PublishError } from '../../src/catalog/publisher.js';
// Usage: node --env-file=.env --import tsx scripts/catalog/publish.ts [--manifest catalog/manifest]
// Publishes the reviewed manifest to the configured (loopback, synthetic) database. There is no flag to skip review.
const args = process.argv.slice(2);
const dir = resolve(args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] ?? '' : 'catalog/manifest');
const db = connect(readConfig().databaseUrl);
try {
  const r = await publish(db, loadManifest(dir));
  console.log(r.status === 'UNCHANGED'
    ? `Release ${r.version} is current and identical (sha256 ${r.sha256}); nothing published`
    : `Published release ${r.version} (sha256 ${r.sha256}): questions ${JSON.stringify(r.questions)}, lessons ${JSON.stringify(r.lessons)}, ${r.aliases} aliases`);
} catch (e) {
  if (!(e instanceof PublishError)) throw e;
  console.error(`${e.code}: ${e.message}`);
  if (e.findings.length) console.error(formatFindings(e.findings));
  process.exitCode = 1;
} finally { await db.destroy(); }
