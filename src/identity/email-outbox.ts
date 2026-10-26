import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import type { Config } from '../config.js';
import { decrypt, encrypt, uuid } from '../platform/crypto.js';
import { EmailSendError, signinUrl, type EmailTransport } from './email-transport.js';

/*
 * Outbox email masuk (migrasi 0010). Request login hanya mencatat email yang perlu dikirim, di transaksi yang sama
 * dengan tautannya, lalu menjawab 202; worker yang mengirim. Jadi:
 * - provider yang lambat atau mati tidak membuat request login gagal, dan tidak mengunci transaksi login;
 * - gagal sementara dicoba lagi dengan jeda (eksponensial + jitter) sampai max_attempts atau tautan kedaluwarsa;
 * - Idempotency-Key tetap ("signin/<transaksi>"), jadi pengiriman ulang setelah lease hilang tidak menggandakan email;
 * - alamat dan tautan terenkripsi, dan dihapus begitu baris selesai.
 */
const LEASE = "interval '30 seconds'";

/** Called inside the transaction that stored the link's hash (identity.sendEmail). One row per login transaction. */
export async function enqueueSignin(tx: Tx, config: Config, transactionId: string, address: string, link: string) {
  await sql`insert into email_outbox(id,auth_transaction_id,kind,delivery_key,payload_ciphertext,expires_at)
    select ${uuid()},t.id,'SIGNIN',${'signin/' + transactionId},${encrypt(config.key, JSON.stringify({ to: address, link }))},t.expires_at
    from auth_transaction t where t.id=${transactionId}
    on conflict (auth_transaction_id) do nothing`.execute(tx);
}

interface Leased { id: string; delivery_key: string; payload_ciphertext: Buffer; attempts: number; max_attempts: number; lease_token: string }
export interface EmailTickResult { sent: number; retrying: number; failed: number }

/** One pass: expire, recover lost leases, clean up, then send what is due (at most `batch`). Never throws for a single email. */
export async function emailTick(db: Connection, config: Config, transport: EmailTransport | null, batch = 10): Promise<EmailTickResult> {
  const result: EmailTickResult = { sent: 0, retrying: 0, failed: 0 };
  await sql`update email_outbox set status='EXPIRED',payload_ciphertext=null,last_error_code='LINK_EXPIRED',updated_at=now()
    where status='QUEUED' and expires_at<=now()`.execute(db);
  // A worker that died mid-send: give the row back (the Idempotency-Key keeps a resend from duplicating the email).
  await sql`update email_outbox set
      status=case when expires_at<=now() then 'EXPIRED' when attempts>=max_attempts then 'FAILED' else 'QUEUED' end,
      payload_ciphertext=case when expires_at<=now() or attempts>=max_attempts then null else payload_ciphertext end,
      lease_token=null,lease_until=null,available_at=now(),last_error_code='LEASE_EXPIRED',updated_at=now()
    where status='SENDING' and lease_until<=now()`.execute(db);
  await sql`delete from email_outbox where status in ('SENT','FAILED','EXPIRED') and updated_at<now()-interval '7 days'`.execute(db);
  if (!transport) return result;
  for (let i = 0; i < batch; i++) {
    const row = (await sql<Leased>`update email_outbox set status='SENDING',lease_token=${uuid()},lease_until=now()+${sql.raw(LEASE)},attempts=attempts+1,updated_at=now()
      where id=(select id from email_outbox where status='QUEUED' and available_at<=now() and expires_at>now() and attempts<max_attempts
        order by available_at limit 1 for update skip locked)
      returning id,delivery_key,payload_ciphertext,attempts,max_attempts,lease_token`.execute(db)).rows[0];
    if (!row) break;
    const outcome = await deliver(config, transport, row);
    if (outcome === 'SENT') {
      await sql`update email_outbox set status='SENT',sent_at=now(),payload_ciphertext=null,lease_token=null,lease_until=null,last_error_code=null,updated_at=now()
        where id=${row.id} and lease_token=${row.lease_token} and status='SENDING'`.execute(db);
      result.sent++;
    } else if (outcome.permanent || row.attempts >= row.max_attempts) {
      await sql`update email_outbox set status='FAILED',payload_ciphertext=null,lease_token=null,lease_until=null,last_error_code=${outcome.code},updated_at=now()
        where id=${row.id} and lease_token=${row.lease_token} and status='SENDING'`.execute(db);
      result.failed++;
      console.error(JSON.stringify({ level: 'error', code: 'EMAIL_DELIVERY_FAILED', outbox: row.id, attempts: row.attempts, cause: outcome.code }));
    } else {
      // 5 s, 10 s, 20 s, … capped at 2 minutes, with jitter so a provider outage is not hit in lockstep.
      await sql`update email_outbox set status='QUEUED',lease_token=null,lease_until=null,last_error_code=${outcome.code},updated_at=now(),
          available_at=now()+make_interval(secs => (0.5 + random() / 2) * least(power(2, ${row.attempts - 1}) * 5, 120))
        where id=${row.id} and lease_token=${row.lease_token} and status='SENDING'`.execute(db);
      result.retrying++;
      console.error(JSON.stringify({ level: 'warn', code: 'EMAIL_DELIVERY_RETRY', outbox: row.id, attempts: row.attempts, cause: outcome.code }));
    }
  }
  return result;
}

async function deliver(config: Config, transport: EmailTransport, row: Leased): Promise<'SENT' | { code: string; permanent: boolean }> {
  let payload: { to: string; link: string };
  try { payload = JSON.parse(decrypt(config.key, row.payload_ciphertext)); } catch { return { code: 'PAYLOAD_UNREADABLE', permanent: true }; }
  try {
    await transport.send({ to: payload.to, url: signinUrl(config.origin, payload.link), deliveryKey: row.delivery_key });
    return 'SENT';
  } catch (error) {
    return error instanceof EmailSendError ? { code: error.code, permanent: error.permanent } : { code: 'TRANSPORT_ERROR', permanent: false };
  }
}
