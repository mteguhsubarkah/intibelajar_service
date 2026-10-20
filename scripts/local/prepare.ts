import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'kysely';
import { readConfig } from '../../src/config.js';
import { connect } from '../../src/db.js';
import { migrate } from '../../src/migrate.js';
import { publish, snapshotOf } from '../../src/catalog/publisher.js';
import { createSession, cookieName } from '../../src/identity/service.js';
import { reviewedFixture } from '../../test/fixtures/catalog.js';
import { consentedLearner } from '../../test/fixtures/learner.js';

// CLI only. Explicitly fake identities/consents, in a marked, dedicated development database.
const config = readConfig();
if (config.mode !== 'development' || !config.synthetic || new URL(config.databaseUrl).pathname !== '/intibelajar_local_dev') throw new Error('Only the explicit local synthetic development database is supported');
const db = connect(config.databaseUrl);
const directory = resolve('.local/local-dev');
type Identity = { learnerId: string; userId: string };
type Role = 'student' | 'studentB' | 'pending' | 'ai' | 'ocr';
const identitiesFile = resolve(directory, 'identities.json');
const saved: Partial<Record<Role, Identity>> = existsSync(identitiesFile) ? JSON.parse(readFileSync(identitiesFile, 'utf8')) : {};
try {
  const mark = (await sql<{ marker: string }>`select shobj_description(oid, 'pg_database') as marker from pg_database where datname=current_database()`.execute(db)).rows[0]?.marker;
  if (mark !== 'IntiBelajar local-dev harness: SYNTHETIC ONLY') throw new Error('Database marker missing; no fixtures were written');
  await migrate(db); // Up only: no rollback, truncation, or test seed reset.
  const manifest = reviewedFixture();
  const current = await db.selectFrom('curriculum_release').select(['version', 'snapshot_sha256']).where('is_current', '=', true).executeTakeFirst();
  manifest.release.version = current?.version ?? 1;
  if (current && !current.snapshot_sha256?.equals(snapshotOf(manifest).sha256)) manifest.release.version++;
  const result = await publish(db, manifest);
  const personas: Record<string, { name: string; value: string; learnerId: string }> = {};
  for (const [role, displayName, consent] of [['student', 'Uji Lokal A', true], ['studentB', 'Uji Lokal B', true], ['pending', 'Uji Tanpa Izin', false], ['ai','Uji AI Sintetis',true],['ocr','Uji OCR Sintetis',true]] as const) {
    let identity = saved[role];
    if (identity) {
      const found = await db.selectFrom('app_user').innerJoin('student_profile', 'student_profile.learner_id', 'app_user.learner_id')
        .select('app_user.id').where('app_user.id', '=', identity.userId).where('student_profile.learner_id', '=', identity.learnerId).where('student_profile.display_name', '=', displayName).executeTakeFirst();
      if (!found) identity = undefined;
    }
    if (!identity) {
      const created = await consentedLearner(db, config, { consent, purposes:role==='ocr'?['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD']:role==='ai'?['LEARNING_DATA','AI_PROCESSING']:['LEARNING_DATA'] });
      identity = { learnerId: created.learnerId, userId: created.userId };
      await db.updateTable('student_profile').set({ display_name: displayName, grade: 9 }).where('learner_id', '=', identity.learnerId).execute();
      saved[role] = identity;
    }
    // Never grant/renew consent on an existing identity: a local revocation remains a revocation.
    const session = await createSession(db, config, identity.userId);
    personas[role] = { name: cookieName, value: session.raw, learnerId: identity.learnerId };
  }
  writeFileSync(identitiesFile, JSON.stringify(saved, null, 2), { mode: 0o600 });
  writeFileSync(resolve(directory, 'personas.json'), JSON.stringify({ syntheticOnly: true, personas }, null, 2), { mode: 0o600 });
  console.log(`Local synthetic catalog ${result.status}; 5 fixture accounts ready. Existing progress and consent decisions retained.`);
} finally { await db.destroy(); }
