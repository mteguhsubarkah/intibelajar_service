import {readFileSync,existsSync} from 'node:fs';
import {connect} from '../../src/db.js';
import {sql} from 'kysely';
if(existsSync('.local/local-dev/deepseek.env'))process.loadEnvFile('.local/local-dev/deepseek.env');
const env=JSON.parse(readFileSync('.local/local-dev/env.json','utf8'));
if(new URL(env.DATABASE_URL).pathname!=='/intibelajar_local_dev')throw new Error('Synthetic database required');
const db=connect(env.DATABASE_URL);
try{
 const row=(await sql<{calls:number;reserved:number}>`select count(*)::int calls, coalesce(sum(reserved_idr),0)::int reserved from development_ai_call`.execute(db)).rows[0]!;
 console.log(JSON.stringify({keyConfigured:!!process.env.DEEPSEEK_API_KEY,enabled:process.env.LOCAL_DEEPSEEK==='true',pricingReviewed:process.env.DEEPSEEK_PRICE_CEILING_CONFIRMED==='true',
  model:'deepseek-flash',budgetIdr:80000,reservedIdr:row.reserved,remainingIdr:80000-row.reserved,calls:row.calls,
  note:'Reserved amount is a conservative ceiling, not the provider invoice. Failed/uncertain calls retain their reservation.'},null,2));
}finally{await db.destroy();}
