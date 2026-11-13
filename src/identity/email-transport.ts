import type { Config } from '../config.js';

/*
 * Pengirim email masuk sungguhan lewat Resend (HTTP API, tanpa paket tambahan). Ini satu-satunya adapter email;
 * hanya worker outbox (email-outbox.ts) yang memanggilnya, tidak pernah request login secara langsung.
 * - Isinya hanya tautan sekali pakai ke halaman FE /auth/email (masuk) atau /daftar/verifikasi (daftar); tidak ada data belajar.
 * - Token ada di fragment (#token=…): browser tidak mengirim fragment ke server, ke log, atau lewat Referer.
 * - Idempotency-Key tetap per transaksi login, jadi percobaan ulang tidak mengirim email kedua (Resend menyimpan
 *   kunci 24 jam). Respons dan error provider tidak diteruskan: bisa memuat alamat atau token.
 */
export interface SigninMail { to: string; url: string; deliveryKey: string }
export interface EmailTransport { send(mail: SigninMail): Promise<void> }
/** permanent: mencoba lagi tidak akan berhasil (alamat ditolak, input tidak valid). */
export class EmailSendError extends Error {
  constructor(readonly code: string, readonly permanent: boolean) { super(code); }
}
const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The link the learner opens: the app's own /auth/email page with the token in the fragment. */
export const signinUrl = (origin: string, link: string) => `${new URL('/auth/email', origin).href}#token=${link}`;
/** Verifikasi pendaftaran (username + password): halaman FE /daftar/verifikasi, token juga di fragment. */
export const signupUrl = (origin: string, link: string) => `${new URL('/daftar/verifikasi', origin).href}#token=${link}`;

/** Isi email menurut jenisnya; jenisnya dibaca dari delivery key (signin/… atau signup/…). */
function content(signup: boolean, href: string) {
  const button = (label: string) => `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0759d8;color:#ffffff;text-decoration:none;font-weight:700">${label}</a></p>`;
  if (signup) return {
    subject: 'Verifikasi pendaftaran IntiBelajar',
    text: ['Halo!', '', 'Terima kasih sudah mendaftar di IntiBelajar. Klik tautan ini untuk memverifikasi email dan mengaktifkan akunmu:', href, '',
      'Tautan berlaku 24 jam dan hanya bisa dipakai sekali.', 'Kalau kamu tidak mendaftar, abaikan saja email ini; akun tidak akan dibuat.'].join('\n'),
    html: `<p>Halo!</p><p>Terima kasih sudah mendaftar di IntiBelajar. Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akunmu.</p>`
      + button('Verifikasi email')
      + `<p style="color:#667085;font-size:13px">Tautan berlaku 24 jam dan hanya bisa dipakai sekali. Kalau kamu tidak mendaftar, abaikan saja email ini; akun tidak akan dibuat.</p>`,
  };
  return {
    subject: 'Tautan masuk IntiBelajar',
    text: ['Halo!', '', 'Klik tautan ini untuk masuk ke IntiBelajar:', href, '',
      'Buka di browser yang sama dengan tempat kamu meminta masuk. Tautan berlaku 15 menit dan hanya bisa dipakai sekali.',
      'Kalau kamu tidak meminta email ini, abaikan saja.'].join('\n'),
    html: `<p>Halo!</p><p>Klik tombol di bawah untuk masuk ke IntiBelajar.</p>` + button('Masuk ke IntiBelajar')
      + `<p style="color:#667085;font-size:13px">Buka di browser yang sama dengan tempat kamu meminta masuk. Tautan berlaku 15 menit dan hanya bisa dipakai sekali. Kalau kamu tidak meminta email ini, abaikan saja.</p>`,
  };
}

export function resendTransport(sender: NonNullable<Config['email']>, origin: string, http: typeof fetch = fetch): EmailTransport {
  const base = new URL(origin).origin;
  return {
    async send({ to, url, deliveryKey }) {
      let link: URL;
      try { link = new URL(url); } catch { throw new EmailSendError('EMAIL_INPUT_INVALID', true); }
      const signup = /^signup\/[0-9a-f-]{36}$/.test(deliveryKey);
      if (to.length > 254 || !ADDRESS.test(to) || to.endsWith('.invalid') || link.origin !== base || link.pathname !== (signup ? '/daftar/verifikasi' : '/auth/email')
        || link.search || link.username || link.password || !/^#token=[A-Za-z0-9_-]{43}$/.test(link.hash) || !(signup || /^signin\/[0-9a-f-]{36}$/.test(deliveryKey)))
        throw new EmailSendError('EMAIL_INPUT_INVALID', true);
      const { subject, text, html } = content(signup, link.href);
      let response: Response;
      try {
        response = await http('https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Bearer ${sender.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': deliveryKey },
          body: JSON.stringify({ from: sender.from, to: [to], subject, text, html }),
        });
      } catch {
        throw new EmailSendError('PROVIDER_UNREACHABLE', false);
      }
      // Do not read the provider's body: it can echo the address.
      await response.body?.cancel().catch(() => undefined);
      if (response.ok) return;
      if (response.status === 429) throw new EmailSendError('PROVIDER_RATE_LIMITED', false);
      // 409: Resend is still processing the same Idempotency-Key; 408: provider timeout. Both are worth a retry.
      if (response.status === 408 || response.status === 409) throw new EmailSendError('PROVIDER_BUSY', false);
      if (response.status >= 500) throw new EmailSendError('PROVIDER_UNAVAILABLE', false);
      throw new EmailSendError('PROVIDER_REJECTED', true);
    },
  };
}
