import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const hash = (s: string) => createHash('sha256').update(s).digest();
export const hmac = (key: Buffer, s: string) => createHmac('sha256', key).update(s).digest();
export function equal(a: Buffer, b: Buffer) { return a.length === b.length && timingSafeEqual(a, b); }
export function uuid() {
  const b = randomBytes(16); b.writeUIntBE(Date.now(), 0, 6); b[6] = (b[6]! & 15) | 112; b[8] = (b[8]! & 63) | 128;
  const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function encrypt(key: Buffer, text: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', hmac(key, 'encryption'), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}
export function decrypt(key: Buffer, b: Buffer) {
  if (b[0] !== 1) throw new Error('Unknown ciphertext version');
  const cipher = createDecipheriv('aes-256-gcm', hmac(key, 'encryption'), b.subarray(1,13));
  cipher.setAuthTag(b.subarray(13,29));
  return Buffer.concat([cipher.update(b.subarray(29)), cipher.final()]).toString('utf8');
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
