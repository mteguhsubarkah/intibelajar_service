import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import { connect, type DB } from './db.js';
const directory = new URL('../migrations/', import.meta.url);
// Checksums ignore line endings: a Windows checkout (core.autocrlf) and a Linux CI checkout of the same
// commit must agree. Rows recorded before this rule hold the raw-bytes hash, which still verifies.
const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const checksum = (data: Buffer) => sha256(data.toString('utf8').replaceAll('\r\n', '\n'));
const matches = (data: Buffer, recorded: string) => recorded === checksum(data) || recorded === sha256(data);
export async function verifyMigrations(db:DB) {
  const files=(await readdir(directory)).filter(f=>f.endsWith('.up.sql')).sort();
  const rows=(await sql<{name:string;sha256:string}>`select name,sha256 from schema_migration order by name`.execute(db)).rows;
  if(rows.length!==files.length)return false;
  for(const row of rows) {
    if(!files.includes(row.name))return false;
    if(!matches(await readFile(new URL(row.name,directory)),row.sha256))return false;
  }return true;
}
export async function migrate(db: DB, direction: 'up' | 'down' = 'up') {
  await db.connection().execute(async connection => {
    await sql`select pg_advisory_lock(89164001)`.execute(connection);
    try {
      await sql`create table if not exists schema_migration (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`.execute(connection);
      const files = (await readdir(directory)).filter(f => f.endsWith('.up.sql')).sort();
      const applied = (await sql<{name:string;sha256:string}>`select name, sha256 from schema_migration order by name`.execute(connection)).rows;
      for (const row of applied) {
        if (!files.includes(row.name)) throw new Error('Applied migration missing');
        if (!matches(await readFile(new URL(row.name, directory)), row.sha256)) throw new Error('Migration checksum mismatch');
      }
      const pending = direction === 'up' ? files.filter(f=>!applied.some(a=>a.name===f)) : applied.slice(-1).map(a=>a.name);
      for (const name of pending) await connection.transaction().execute(async tx => {
        const data = await readFile(new URL(name.replace('.up.', `.${direction}.`), directory));
        await sql.raw(data.toString('utf8')).execute(tx);
        if (direction === 'up') await sql`insert into schema_migration(name,sha256) values (${name},${checksum(data)})`.execute(tx);
        else await sql`delete from schema_migration where name=${name}`.execute(tx);
      });
    } finally { await sql`select pg_advisory_unlock(89164001)`.execute(connection); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readConfig } = await import('./config.js'); const db = connect(readConfig().databaseUrl);
  try { const d = process.argv[2] ?? 'up'; if (!['up','down'].includes(d)) throw new Error('Expected up/down');
    if(d==='down'&&process.env.ALLOW_DESTRUCTIVE_DEV_ROLLBACK!=='true')throw new Error('Development rollback deletes data; explicitly set ALLOW_DESTRUCTIVE_DEV_ROLLBACK=true');
    await migrate(db, d as 'up'|'down'); }
  finally { await db.destroy(); }
}
