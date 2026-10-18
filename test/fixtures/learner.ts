import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../src/config.js';
import type { DB } from '../../src/db.js';
import { createSession, cookieName } from '../../src/identity/service.js';
import { uuid } from '../../src/platform/crypto.js';
import { policyHash, policyVersion } from '../../src/privacy/service.js';
// A synthetic learner with a granted LEARNING_DATA consent (synthetic-dev-v1) and a signed-in session.
// Inserted directly: the consent flow itself is covered by the Slice 0 suite.

export async function consentedLearner(db: DB, config: Config, { consent = true } = {}) {
  const learnerId = uuid(), userId = uuid(), guardianId = uuid();
  await sql`insert into learner(id, status, age_band, age_band_source, consent_deadline_at) values (${learnerId}, ${consent ? 'ACTIVE' : 'PENDING_CONSENT'}, 'AGE_13_15', 'SELF_DECLARED',
    ${consent ? null : sql`now() + interval '7 days'`})`.execute(db);
  await sql`insert into app_user(id, role, learner_id, status) values (${userId}, 'STUDENT', ${learnerId}, 'ACTIVE')`.execute(db);
  await sql`insert into guardian(id, email_hash, email_ciphertext) values (${guardianId}, ${randomBytes(32)}, ${randomBytes(48)})`.execute(db);
  if (consent) await sql`insert into consent_record(id, learner_id, guardian_id, purpose, status, method, policy_version, policy_text_sha256, decided_by, decided_at, expires_at)
    values (${uuid()}, ${learnerId}, ${guardianId}, 'LEARNING_DATA', 'GRANTED', 'GUARDIAN_EMAIL', ${policyVersion}, ${policyHash}, 'GUARDIAN', now(), now() + interval '30 days')`.execute(db);
  const session = await createSession(db, config, userId);
  return { learnerId, userId, guardianId, headers: { cookie: `${cookieName}=${session.raw}`, 'x-csrf-token': session.csrf } };
}
export type Learner = Awaited<ReturnType<typeof consentedLearner>>;

/** An HTTP client for one learner: same-origin JSON, CSRF token, and a fresh Idempotency-Key unless one is given. */
export function client(app: FastifyInstance, config: Config, learner: Learner) {
  return async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, extra: Record<string, string> = {}) => {
    const write = method !== 'GET';
    const r = await app.inject({ method, url, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }), headers: {
      ...learner.headers, ...(write ? { origin: config.origin, 'content-type': 'application/json', ...(method === 'POST' ? { 'idempotency-key': 'k' + uuid().replaceAll('-', '') } : {}) } : {}), ...extra } });
    return { status: r.statusCode, headers: r.headers, body: r.body ? JSON.parse(r.body) : undefined };
  };
}
