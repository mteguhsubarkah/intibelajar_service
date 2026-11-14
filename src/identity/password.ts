import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/*
 * Hash password dengan scrypt bawaan Node (tanpa paket tambahan). Format tersimpan: scrypt$N$r$p$salt$hash (base64url),
 * jadi parameternya bisa dinaikkan nanti tanpa membuat hash lama tidak terbaca.
 * Aturan username dan password sama persis dengan FE (src/services/signupRules.ts di repo FE).
 */
const N = 32768, R = 8, P = 1, KEYLEN = 32, MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashSecret(password: string) {
  const salt = randomBytes(16), key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifySecret(password: string, stored: string) {
  const [kind, n, r, p, salt, key] = stored.split('$');
  if (kind !== 'scrypt' || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Hash pengganti: login dengan username yang tidak ada tetap menjalankan scrypt, supaya waktunya tidak membocorkan apa pun. */
let dummy: Promise<string> | undefined;
export const dummySecret = () => (dummy ??= hashSecret('dummy-password-0'));

/** 3–30 karakter: huruf kecil, angka, titik, garis bawah; diawali huruf. Disimpan dan dicocokkan dalam huruf kecil. */
export const USERNAME = /^[a-z][a-z0-9._]{2,29}$/;
export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export type PasswordProblem = 'PASSWORD_LENGTH' | 'PASSWORD_WEAK' | 'PASSWORD_IS_USERNAME';
/** 8–128 karakter, minimal satu huruf dan satu angka, tidak sama dengan username. */
export function passwordProblem(password: string, username: string): PasswordProblem | null {
  if (password.length < 8 || password.length > 128) return 'PASSWORD_LENGTH';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'PASSWORD_WEAK';
  if (password.trim().toLowerCase() === username) return 'PASSWORD_IS_USERNAME';
  return null;
}
