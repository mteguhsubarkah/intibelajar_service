import type { Connection } from '../db.js';
import { decrypt } from '../platform/crypto.js';

/* =========================================================
   Daftar akun untuk backoffice (hanya bila BACKOFFICE_ACCOUNTS=true).
   Modul ini membaca tabel milik identity saja; profil, status belajar,
   dan penghapusan ada di privacy/staff.ts.

   Email hanya ada untuk identitas EMAIL dari tautan email (terenkripsi
   AES-GCM). Identitas Google sengaja hanya menyimpan "sub" Google, tanpa
   email; login Google juga menambah identitas EMAIL terverifikasi yang
   hanya berisi HMAC alamatnya (email null), supaya tautan email ke alamat
   yang sama masuk ke akun yang sama.
========================================================= */

export interface StaffIdentity { provider: 'GOOGLE' | 'EMAIL'; email: string | null; emailVerified: boolean; lastLoginAt: string | null }
export interface StaffAccount {
  userId: string; role: 'STUDENT' | 'GUARDIAN'; status: string; learnerId: string | null;
  createdAt: string; trial: boolean; identities: StaffIdentity[];
}

/* Kunci yang sudah dirotasi atau data rusak tidak boleh menjatuhkan seluruh daftar. */
function readEmail(key: Buffer, value: Buffer | null) {
  if (!value) return null;
  try { return decrypt(key, value); } catch { return null; }
}

export async function staffAccounts(db: Connection, key: Buffer, { userId, limit = 500 }: { userId?: string; limit?: number } = {}): Promise<StaffAccount[]> {
  let query = db.selectFrom('app_user').select(['id', 'role', 'status', 'learner_id', 'created_at', 'trial_expires_at']).orderBy('created_at', 'desc').limit(limit);
  if (userId) query = query.where('id', '=', userId);
  const users = await query.execute();
  if (!users.length) return [];
  const identities = await db.selectFrom('auth_identity').select(['user_id', 'provider', 'email_verified', 'email_ciphertext', 'last_login_at'])
    .where('user_id', 'in', users.map(u => u.id)).execute();
  return users.map(u => ({
    userId: u.id, role: u.role as StaffAccount['role'], status: u.status, learnerId: u.learner_id,
    createdAt: u.created_at.toISOString(), trial: u.trial_expires_at !== null,
    identities: identities.filter(i => i.user_id === u.id).map(i => ({
      provider: i.provider as StaffIdentity['provider'], email: readEmail(key, i.email_ciphertext), emailVerified: i.email_verified,
      lastLoginAt: i.last_login_at ? i.last_login_at.toISOString() : null,
    })),
  }));
}
