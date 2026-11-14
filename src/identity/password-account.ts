import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import type { Config } from '../config.js';
import { token, hash, hmac, uuid, encrypt, decrypt } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { createPendingLearner, checkSigninLearner } from '../privacy/service.js';
import { createSession, deliveredForReal, requireEmailSignin, returningContinuation, signinAddress } from './service.js';
import { enqueueSignup } from './email-outbox.js';
import { USERNAME, dummySecret, hashSecret, normalizeUsername, passwordProblem, verifySecret } from './password.js';

/*
 * Daftar dengan username + password + email (FEATURE_PASSWORD_AUTH), alurnya seperti umumnya:
 * 1. register: cek isian, hash password (scrypt), simpan permintaan terenkripsi, kirim email verifikasi (outbox).
 *    Akun BELUM dibuat; alamat yang sudah terdaftar tidak dibocorkan (selalu 202). Username yang sudah dipakai: 409.
 * 2. verify: tautan di email (sekali pakai, 24 jam) membuat akun dan langsung masuk, lalu ke /kenalan.
 *    Email yang sudah punya akun (tautan email/Google) tetapi belum punya password: password ditambahkan ke akun itu.
 *    Email yang akunnya sudah punya password: 409 ACCOUNT_EXISTS (masuk saja).
 * 3. login: username (atau email) + password. Salah username atau password sama-sama 401 INVALID_CREDENTIALS,
 *    dan waktunya sama (scrypt tetap dijalankan dengan hash pengganti).
 */
const SIGNUP_HOURS = 24;
const usernameSubject = (config: Config, username: string) => hmac(config.key, 'username:' + username).toString('hex');
const emailSubject = (config: Config, address: string) => hmac(config.key, 'email:' + address).toString('hex');

export interface SignupInput { username: string; email: string; password: string; continuation: { route: string; step: number } }
interface SignupPayload { username: string; email: string; secretHash: string }

/** Validasi + hash di luar transaksi (scrypt ±100 ms tidak menahan koneksi DB). */
export async function prepareSignup(config: Config, input: SignupInput) {
  requireEmailSignin(config);
  const username = normalizeUsername(input.username);
  if (!USERNAME.test(username)) fail(400, 'VALIDATION_FAILED', { fields: ['username'] });
  const problem = passwordProblem(input.password, username);
  if (problem) fail(400, 'VALIDATION_FAILED', { fields: ['password'], reason: problem });
  let address: string;
  try { address = signinAddress(config, input.email); } catch { fail(400, 'VALIDATION_FAILED', { fields: ['email'] }); }
  return { username, address, secretHash: await hashSecret(input.password), continuation: input.continuation };
}

export async function register(tx: Tx, config: Config, prepared: Awaited<ReturnType<typeof prepareSignup>>) {
  const { username, address, secretHash, continuation } = prepared;
  const subject = usernameSubject(config, username);
  const taken = await tx.selectFrom('auth_identity').select('id').where('provider', '=', 'PASSWORD').where('subject', '=', subject).executeTakeFirst();
  if (taken) fail(409, 'USERNAME_TAKEN', { fields: ['username'] });
  const id = uuid(), link = token();
  const payload: SignupPayload = { username, email: address, secretHash };
  await sql`insert into signup_request(id,link_hash,username_subject,email_subject,payload_ciphertext,continuation,expires_at)
    values (${id},${hash(link)},${subject},${emailSubject(config, address)},${encrypt(config.key, JSON.stringify(payload))},
      ${JSON.stringify(continuation)}::jsonb,now()+${SIGNUP_HOURS}*interval '1 hour')`.execute(tx);
  // Alamat sungguhan diantrekan di transaksi ini (worker yang mengirim); .invalid ke kotak surat sintetis lokal.
  if (deliveredForReal(config, address)) await enqueueSignup(tx, config, id, address, link);
  return { address, link };
}

export async function verifySignup(tx: Tx, config: Config, link: string) {
  requireEmailSignin(config);
  const request = (await sql<{ id: string; payload_ciphertext: Buffer | null; continuation: { route: string; step?: number } }>`
    select id,payload_ciphertext,continuation from signup_request
    where link_hash=${hash(link)} and consumed_at is null and expires_at>now() for update`.execute(tx)).rows[0];
  if (!request?.payload_ciphertext) fail(410, 'LINK_EXPIRED');
  const payload = JSON.parse(decrypt(config.key, request.payload_ciphertext)) as SignupPayload;
  const nameSubject = usernameSubject(config, payload.username), mailSubject = emailSubject(config, payload.email);
  // Same lock as consumeEmail/googleAccount for this address, plus one for the username.
  await sql`select pg_advisory_xact_lock(hashtextextended(${mailSubject},0))`.execute(tx);
  await sql`select pg_advisory_xact_lock(hashtextextended(${'username:' + nameSubject},0))`.execute(tx);
  const taken = await tx.selectFrom('auth_identity').select('id').where('provider', '=', 'PASSWORD').where('subject', '=', nameSubject).executeTakeFirst();
  if (taken) fail(409, 'USERNAME_TAKEN', { fields: ['username'] });
  const verified = deliveredForReal(config, payload.email);
  const existing = await tx.selectFrom('auth_identity').select(['user_id', 'email_verified']).where('provider', '=', 'EMAIL').where('subject', '=', mailSubject).executeTakeFirst();
  let userId: string, fresh = false;
  if (existing) {
    userId = existing.user_id;
    const hasPassword = await tx.selectFrom('auth_identity').select('id').where('user_id', '=', userId).where('provider', '=', 'PASSWORD').executeTakeFirst();
    if (hasPassword) fail(409, 'ACCOUNT_EXISTS');
    if (verified && !existing.email_verified) await tx.updateTable('auth_identity').set({ email_verified: true }).where('provider', '=', 'EMAIL').where('subject', '=', mailSubject).execute();
  } else {
    userId = uuid(); fresh = true;
    // Self-onboarding: the username just chosen pre-fills the profile name, so /kenalan does not ask for it again (still
    // editable there; the account becomes active only when /kenalan saves name + kelas). With guardian consent nothing
    // personal is stored before consent, so the name stays empty.
    const learner = await createPendingLearner(tx, config.selfConsent ? payload.username : null);
    await tx.insertInto('app_user').values({ id: userId, role: 'STUDENT', learner_id: learner, guardian_id: null, status: 'ACTIVE' }).execute();
    // Synthetic transport never establishes a verified email; a link delivered by the real sender does.
    await tx.insertInto('auth_identity').values({ id: uuid(), user_id: userId, provider: 'EMAIL', subject: mailSubject, email_verified: verified,
      email_ciphertext: encrypt(config.key, payload.email), last_login_at: null }).execute();
  }
  const account = await tx.selectFrom('app_user').selectAll().where('id', '=', userId).executeTakeFirstOrThrow();
  if (account.status !== 'ACTIVE') fail(403, 'ACCOUNT_UNAVAILABLE');
  if (account.learner_id) await checkSigninLearner(tx, account.learner_id);
  await tx.insertInto('auth_identity').values({ id: uuid(), user_id: userId, provider: 'PASSWORD', subject: nameSubject, email_verified: false,
    email_ciphertext: null, secret_hash: payload.secretHash, username_ciphertext: encrypt(config.key, payload.username), last_login_at: sql<Date>`now()` }).execute();
  await sql`update signup_request set consumed_at=now(),payload_ciphertext=null where id=${request.id}`.execute(tx);
  const session = await createSession(tx, config, userId);
  return { session, continuation: fresh ? { route: '/kenalan' } : returningContinuation(request.continuation) };
}

/** Kunci batas percobaan login per akun yang dituju (bukan per IP saja), tanpa menyimpan username terbuka. */
export const loginKey = (identifier: string) => 'password:' + hash(identifier.trim().toLowerCase()).toString('hex');

export async function passwordLogin(db: Connection, config: Config, identifier: string, password: string, continuation: { route: string; step: number }) {
  const value = identifier.trim().toLowerCase();
  let row: { user_id: string; secret_hash: string | null } | undefined;
  if (value.includes('@')) {
    const owner = await db.selectFrom('auth_identity').select('user_id').where('provider', '=', 'EMAIL').where('subject', '=', emailSubject(config, value)).executeTakeFirst();
    if (owner) row = await db.selectFrom('auth_identity').select(['user_id', 'secret_hash']).where('provider', '=', 'PASSWORD').where('user_id', '=', owner.user_id).executeTakeFirst();
  } else if (USERNAME.test(value)) {
    row = await db.selectFrom('auth_identity').select(['user_id', 'secret_hash']).where('provider', '=', 'PASSWORD').where('subject', '=', usernameSubject(config, value)).executeTakeFirst();
  }
  const ok = await verifySecret(password, row?.secret_hash ?? await dummySecret());
  if (!row || !ok) fail(401, 'INVALID_CREDENTIALS');
  return db.transaction().execute(async tx => {
    const account = await tx.selectFrom('app_user').selectAll().where('id', '=', row.user_id).executeTakeFirstOrThrow();
    if (account.status !== 'ACTIVE') fail(403, 'ACCOUNT_UNAVAILABLE');
    if (account.learner_id) await checkSigninLearner(tx, account.learner_id);
    await tx.updateTable('auth_identity').set({ last_login_at: sql<Date>`now()` }).where('provider', '=', 'PASSWORD').where('user_id', '=', account.id).execute();
    const session = await createSession(tx, config, account.id);
    return { session, continuation: returningContinuation(continuation) };
  });
}

