import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sql } from 'kysely';
import { Store } from '../scripts/backoffice/store.js';
import { buildBackoffice } from '../scripts/backoffice/server.js';
import { readConfig } from '../src/config.js';
import { connect } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { encrypt, hmac, uuid } from '../src/platform/crypto.js';
import { workerTick } from '../src/privacy/erasure.js';
import { consentedLearner } from './fixtures/learner.js';

// Halaman akun (QA) di backoffice: mati tanpa BACKOFFICE_ACCOUNTS, menampilkan email hanya bila tersimpan,
// dan menghapus akun lewat jalur penghapusan BE yang sama dengan DELETE /v1/me, dengan audit atas nama staf.
test('backoffice akun: daftar, konfirmasi, hapus lewat jalur penghapusan BE, dan audit staf', async () => {
  const base = process.env.DATABASE_URL ? process.env : JSON.parse(readFileSync('.local/test-env.json', 'utf8'));
  const config = readConfig(base), db = connect(config.databaseUrl);
  await migrate(db);
  const dir = mkdtempSync(join(tmpdir(), 'ib-backoffice-akun-')), store = new Store(dir); store.init();
  const token = 'c'.repeat(64), local = { host: 'localhost:8010', 'x-backoffice-key': token };
  const post = (app: ReturnType<typeof buildBackoffice>, payload: unknown, headers: Record<string, string> = { ...local, origin: 'http://localhost:8010' }) =>
    app.inject({ method: 'POST', url: '/api/accounts/deletions', headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
  const count = async (q: ReturnType<typeof sql<{ n: number }>>) => (await q.execute(db)).rows[0]!.n;
  try {
    // Tanpa flag: tidak ada data akun dan tidak ada penghapusan.
    const off = buildBackoffice(store, token);
    assert.deepEqual((await off.inject({ url: '/api/accounts', headers: local })).json(), { enabled: false });
    assert.equal((await post(off, { userId: uuid(), confirm: 'x' })).statusCode, 404);

    // Akun Google (tanpa email tersimpan) dan akun tautan email (email terenkripsi).
    const google = await consentedLearner(db, config);
    await sql`update student_profile set display_name='QA Google', grade=10 where learner_id=${google.learnerId}`.execute(db);
    await db.insertInto('auth_identity').values({ id: uuid(), user_id: google.userId, provider: 'GOOGLE', subject: 'sub-' + uuid(), email_verified: true, email_ciphertext: null, last_login_at: new Date() }).execute();
    const viaEmail = await consentedLearner(db, config), address = `qa+${uuid().replaceAll('-', '').slice(-12)}@example.com`; // UUIDv7: awalnya cap waktu, bagian akhirnya acak
    await db.insertInto('auth_identity').values({ id: uuid(), user_id: viaEmail.userId, provider: 'EMAIL', subject: hmac(config.key, 'email:' + address).toString('hex'),
      email_verified: true, email_ciphertext: encrypt(config.key, address), last_login_at: null }).execute();
    const guardianUser = uuid();
    await sql`insert into app_user(id, role, guardian_id, status) values (${guardianUser}, 'GUARDIAN', ${google.guardianId}, 'ACTIVE')`.execute(db);

    const app = buildBackoffice(store, token, 8010, undefined, undefined, { db, config });
    assert.equal((await app.inject({ url: '/api/accounts', headers: { host: 'localhost:8010' } })).statusCode, 401);
    const viewsBefore = await count(sql<{ n: number }>`select count(*)::int as n from audit_event where action='STAFF_VIEWED_ACCOUNTS' and actor_type='STAFF' and actor_ref=${hmac(config.key, 'actor:staff:ssh-lokal')}`);
    const list = await app.inject({ url: '/api/accounts', headers: local });
    assert.equal(list.statusCode, 200, list.body);
    const body = list.json() as { enabled: boolean; staff: string; accounts: Record<string, unknown>[] };
    assert.equal(body.enabled, true); assert.equal(body.staff, 'ssh-lokal');
    const row = (id: string) => body.accounts.find(a => a.userId === id)!;
    assert.equal(row(google.userId).email, null); assert.match(String(row(google.userId).emailNote), /Google/);
    assert.equal(row(google.userId).label, 'QA Google'); assert.deepEqual(row(google.userId).methods, ['Google']); assert.equal(row(google.userId).grade, 10);
    assert.equal(row(viaEmail.userId).email, address); assert.equal(row(viaEmail.userId).label, address); assert.equal(row(viaEmail.userId).deletable, true);
    assert.equal(row(guardianUser).deletable, false);
    assert.equal(await count(sql<{ n: number }>`select count(*)::int as n from audit_event where action='STAFF_VIEWED_ACCOUNTS' and actor_type='STAFF' and actor_ref=${hmac(config.key, 'actor:staff:ssh-lokal')}`), viewsBefore + 1);

    // Penolakan: Origin asing, konfirmasi salah, id tidak valid atau tidak ada, akun wali.
    assert.equal((await post(app, { userId: viaEmail.userId, confirm: address }, { ...local, origin: 'https://evil.example' })).statusCode, 403);
    const wrong = await post(app, { userId: viaEmail.userId, confirm: 'salah' });
    assert.equal(wrong.statusCode, 400); assert.ok(wrong.json().message.includes(address));
    assert.equal((await post(app, { userId: 'bukan-uuid', confirm: address })).statusCode, 400);
    assert.equal((await post(app, { userId: uuid(), confirm: address })).statusCode, 404);
    assert.equal((await post(app, { userId: guardianUser, confirm: 'x' })).statusCode, 422);
    assert.equal((await db.selectFrom('learner').select('status').where('id', '=', viaEmail.learnerId).executeTakeFirstOrThrow()).status, 'ACTIVE');

    // Hapus: status, sesi dicabut, permintaan dan job penghapusan, audit staf. Akun lain tidak tersentuh.
    const done = await post(app, { userId: viaEmail.userId, confirm: ` ${address} ` });
    assert.equal(done.statusCode, 202, done.body); assert.equal(done.json().status, 'DELETION_PENDING');
    assert.equal((await db.selectFrom('learner').select('status').where('id', '=', viaEmail.learnerId).executeTakeFirstOrThrow()).status, 'DELETION_PENDING');
    assert.equal(await count(sql<{ n: number }>`select count(*)::int as n from auth_session where user_id=${viaEmail.userId} and revoked_at is null`), 0);
    const request = await db.selectFrom('deletion_request').select(['id', 'requested_by', 'reason', 'status']).where('learner_id', '=', viaEmail.learnerId).executeTakeFirstOrThrow();
    assert.deepEqual([request.requested_by, request.reason, request.status], ['SYSTEM', 'OTHER', 'QUEUED']);
    assert.equal(await count(sql<{ n: number }>`select count(*)::int as n from job where deletion_request_id=${request.id} and queue='deletion'`), 1);
    assert.equal(await count(sql<{ n: number }>`select count(*)::int as n from audit_event where action='STAFF_DELETION_REQUESTED' and actor_type='STAFF'
      and actor_ref=${hmac(config.key, 'actor:staff:ssh-lokal')} and subject_ref=${hmac(config.key, 'subject:' + viaEmail.learnerId)}`), 1);
    assert.equal((await post(app, { userId: viaEmail.userId, confirm: address })).statusCode, 409);
    assert.equal((await db.selectFrom('learner').select('status').where('id', '=', google.learnerId).executeTakeFirstOrThrow()).status, 'ACTIVE');
    const after = (await app.inject({ url: '/api/accounts', headers: local })).json() as { accounts: Record<string, unknown>[] };
    assert.deepEqual([after.accounts.find(a => a.userId === viaEmail.userId)?.status, after.accounts.find(a => a.userId === viaEmail.userId)?.deletable], ['DELETION_PENDING', false]);

    // Mode domain: pelaku audit adalah user Basic Auth yang diteruskan Nginx.
    const domain = buildBackoffice(store, token, 8010, 'https://intibelajar.com', undefined, { db, config });
    const h = { host: 'intibelajar.com', 'x-forwarded-proto': 'https', 'x-backoffice-user': 'admin-qa', 'x-backoffice-key': token, origin: 'https://intibelajar.com' };
    assert.equal((await domain.inject({ url: '/api/accounts', headers: h })).json().staff, 'admin-qa');
    assert.equal((await post(domain, { userId: google.userId, confirm: 'QA Google' }, h)).statusCode, 202);
    assert.equal(await count(sql<{ n: number }>`select count(*)::int as n from audit_event where action='STAFF_DELETION_REQUESTED' and actor_ref=${hmac(config.key, 'actor:staff:admin-qa')}
      and subject_ref=${hmac(config.key, 'subject:' + google.learnerId)}`), 1);

    // Worker yang sama dengan produksi menuntaskan penghapusan: akun hilang dari daftar dan tidak ada job yang tertinggal
    // di antrean bersama (tes lain di database ini menghitung job penghapusan miliknya sendiri).
    const pending = () => count(sql<{ n: number }>`select count(*)::int as n from job where queue='deletion' and status in ('QUEUED','RUNNING')`);
    for (let i = 0; i < 50 && await pending() > 0; i++) await workerTick(db, config);
    assert.equal(await pending(), 0);
    for (const id of [viaEmail.learnerId, google.learnerId]) assert.equal((await db.selectFrom('learner').select('id').where('id', '=', id).execute()).length, 0);
    const final = (await domain.inject({ url: '/api/accounts', headers: h })).json() as { accounts: { userId: string }[] };
    assert.ok(!final.accounts.some(a => a.userId === viaEmail.userId || a.userId === google.userId));
  } finally { rmSync(dir, { recursive: true, force: true }); await db.destroy(); }
});
