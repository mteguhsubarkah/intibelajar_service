import { sql } from 'kysely';
import type { Connection, Tx } from '../db.js';
import type { Config } from '../config.js';
import { hmac, uuid } from '../platform/crypto.js';
import { fail } from '../platform/errors.js';
import { audit, deletion } from './service.js';

/* =========================================================
   Bagian privacy dari halaman akun backoffice (BACKOFFICE_ACCOUNTS=true):
   profil dan status siswa, penghapusan akun, dan jejak audit staf.

   Penghapusan memakai jalur yang sama dengan DELETE /v1/me: akun ditandai
   DELETION_PENDING, sesi dicabut, lalu worker menghapus semua datanya dan
   membuat erasure_receipt. Tidak ada DELETE langsung ke tabel dari sini.
   Nama staf hanya disimpan sebagai HMAC, seperti aktor audit lainnya.
========================================================= */

export interface StaffLearner { status: string; displayName: string | null; grade: number | null }

export async function staffLearners(db: Connection, ids: string[]): Promise<Map<string, StaffLearner>> {
  if (!ids.length) return new Map();
  const rows = await db.selectFrom('learner').leftJoin('student_profile', 'student_profile.learner_id', 'learner.id')
    .select(['learner.id as id', 'learner.status as status', 'student_profile.display_name as displayName', 'student_profile.grade as grade'])
    .where('learner.id', 'in', ids).execute();
  return new Map(rows.map(r => [r.id, { status: r.status, displayName: r.displayName ?? null, grade: r.grade ?? null }]));
}

const staffRef = (config: Config, staff: string) => hmac(config.key, 'actor:staff:' + staff);

/** Satu kejadian per kali daftar akun dibuka: siapa (HMAC) dan berapa akun. Tanpa data siswa. */
export async function staffViewedAccounts(db: Connection, config: Config, staff: string, count: number) {
  await sql`insert into audit_event(id,actor_type,actor_ref,action,detail)
    values (${uuid()},'STAFF',${staffRef(config, staff)},'STAFF_VIEWED_ACCOUNTS',${JSON.stringify({ count })})`.execute(db);
}

export async function staffDeletion(tx: Tx, config: Config, learnerId: string, staff: string) {
  const learner = await tx.selectFrom('learner').select('status').where('id', '=', learnerId).forUpdate().executeTakeFirst();
  if (!learner) fail(404, 'NOT_FOUND');
  if (learner.status === 'DELETION_PENDING') fail(409, 'INVALID_STATE_TRANSITION');
  // deletion_request.requested_by hanya LEARNER/GUARDIAN/SYSTEM; pelaku staf dicatat terpisah di audit.
  const result = await deletion(tx, config, learnerId, 'SYSTEM', 'OTHER');
  await audit(tx, config, learnerId, 'STAFF_DELETION_REQUESTED', 'STAFF', 'staff:' + staff);
  return result;
}
