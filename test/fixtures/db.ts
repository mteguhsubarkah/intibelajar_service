import { sql } from 'kysely';
import type { DB } from '../../src/db.js';
import { migrate } from '../../src/migrate.js';
// Development rollback for tests: revert applied migrations, newest first, until `keep` is the latest one.
export async function rollbackTo(db: DB, keep: string) {
  for (;;) {
    const latest = (await sql<{ name: string }>`select name from schema_migration order by name desc limit 1`.execute(db)).rows[0]?.name;
    if (!latest || latest <= keep) return;
    await migrate(db, 'down');
  }
}
