// Offline: shows the exact messages the diagnosis engine would send to DeepSeek for a learner's latest attempt.
// No network call, no budget reservation, nothing written to the database. Local synthetic database only.
//   npx tsx scripts/local/ai-prompt-preview.ts            (latest TEXT attempt in intibelajar_local_dev)
// Writes .local/local-dev/ai-prompt-preview.json (ignored by Git). The raw model reply is never stored by the app;
// only scripts/local/deepseek-probe.ts writes one, and only for an authored synthetic answer.
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'kysely';
import { connect } from '../../src/db.js';
import { engineInput } from '../../src/assessment/diagnosis.js';
import { prepareDiagnosis } from '../../src/assessment/ai-diagnosis.js';
import { syntheticAiAnswer } from '../../src/assessment/deepseek-development.js';

const env = JSON.parse(readFileSync('.local/local-dev/env.json', 'utf8'));
if (new URL(env.DATABASE_URL).pathname !== '/intibelajar_local_dev') throw new Error('Synthetic local database required');
const db = connect(env.DATABASE_URL);
try {
  const a = (await sql<{ question_revision_id: string; response: { responseType: string; text?: string } }>`select question_revision_id, response
    from question_attempt where response->>'responseType' = 'TEXT' order by id desc limit 1`.execute(db)).rows[0]; // UUIDv7: newest first
  if (!a) throw new Error('No TEXT attempt yet');
  const input = await engineInput(db, a.question_revision_id, 'DIAGNOSIS', a.response as Parameters<typeof engineInput>[3]);
  const prepared = prepareDiagnosis(input);
  const messages = [
    { role: 'system', content: prepared.system + '\nJSON schema:\n' + JSON.stringify(prepared.outputSchema) + '\nContext:\n' + prepared.context },
    { role: 'user', content: prepared.learner },
  ];
  const out = { promptVersion: prepared.promptVersion, schemaVersion: prepared.schemaVersion, model: 'deepseek-flash',
    wouldBeSentByLocalEngine: syntheticAiAnswer(a.response.text ?? ''), messages };
  writeFileSync('.local/local-dev/ai-prompt-preview.json', JSON.stringify(out, null, 2));
  console.log(`Wrote .local/local-dev/ai-prompt-preview.json (${Buffer.byteLength(JSON.stringify(messages))} bytes).`);
  console.log(out.wouldBeSentByLocalEngine ? 'This answer is one of the authored synthetic answers: the local engine would send it.'
    : 'This answer is NOT one of the authored synthetic answers: the local engine never sends it to DeepSeek.');
} finally { await db.destroy(); }
