import { sql } from 'kysely';
import { readConfig } from '../../src/config.js';
import { connect } from '../../src/db.js';
// Usage: node --env-file=.env --import tsx scripts/catalog/status.ts
// Shows which catalog release the database serves: version, per-subject availability and content counts.
// Building the code changes none of this; only `scripts/catalog/publish.ts` does.
const db = connect(readConfig().databaseUrl);
try {
  const release = (await sql<{ version: number; published_at: Date | null }>`select version, published_at from curriculum_release where is_current`.execute(db)).rows[0];
  if (!release) { console.log('Belum ada rilis katalog yang aktif. Jalankan sign-off lalu scripts/catalog/publish.ts.'); process.exit(1); }
  console.log(`Rilis katalog aktif: versi ${release.version}${release.published_at ? ` (${release.published_at.toISOString()})` : ''}`);
  const rows = (await sql<{ code: string; availability: string; topics: number; concepts: number; questions: number; lessons: number }>`
    select s.code, s.availability,
      (select count(*)::int from topic t where t.subject_id = s.id) as topics,
      (select count(*)::int from concept c join topic t on t.id = c.topic_id where t.subject_id = s.id) as concepts,
      (select count(distinct r.question_id)::int from question_revision r join question_concept qc on qc.question_revision_id = r.id
         join concept c on c.id = qc.concept_id join topic t on t.id = c.topic_id where t.subject_id = s.id and r.status = 'PUBLISHED') as questions,
      (select count(distinct lc.lesson_id)::int from lesson_concept lc join concept c on c.id = lc.concept_id join topic t on t.id = c.topic_id where t.subject_id = s.id) as lessons
    from subject s order by s.code`.execute(db)).rows;
  console.table(rows);
} finally { await db.destroy(); }
