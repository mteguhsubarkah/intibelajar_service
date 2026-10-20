import { sql } from 'kysely';
import type { DB } from '../db.js';
import { uuid } from './crypto.js';

/** Development ledger: no learner IDs, prompts or output. Reservations survive restart/failure. */
export async function reserveAiBudget(db: DB, rupiah: number) {
  if (!Number.isSafeInteger(rupiah) || rupiah < 1 || rupiah > 80000) throw new Error('AI_BUDGET_EXCEEDED');
  return db.transaction().execute(async tx => {
    await sql`select pg_advisory_xact_lock(89164009)`.execute(tx);
    const used = Number((await sql<{ n: string }>`select coalesce(sum(reserved_idr),0)::text n from development_ai_call`.execute(tx)).rows[0]!.n);
    if (used + rupiah > 80000) throw new Error('AI_BUDGET_EXCEEDED');
    const id = uuid();
    await sql`insert into development_ai_call(id,reserved_idr,status) values (${id},${rupiah},'RESERVED')`.execute(tx);
    return id;
  });
}
export async function finishAiBudget(db: DB, id: string, status: 'SUCCEEDED'|'FAILED', inputTokens = 0, outputTokens = 0) {
  await sql`update development_ai_call set status=${status}, input_tokens=${inputTokens}, output_tokens=${outputTokens}, completed_at=now() where id=${id}`.execute(db);
}
