import pg from 'pg';
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import type { Database } from './database.generated.js';
export type { Database } from './database.generated.js';
export type DB = Kysely<Database>;
export type Tx = Transaction<Database>;
export type Connection = DB | Tx;
export function connect(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000,
    statement_timeout: 5000, application_name: 'intibelajar-synthetic-slice0' });
  pool.on('error', () => { /* checked by readiness; never emit credentials or SQL */ });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
export async function now(db: Connection) { return (await sql<{ now: Date }>`select now() as now`.execute(db)).rows[0]!.now; }
