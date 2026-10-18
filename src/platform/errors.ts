export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: Record<string, unknown>) { super(code); }
}
export function fail(status: number, code: string, details?: Record<string, unknown>): never { throw new ApiError(status, code, details); }
export const messages: Record<string, string> = {
  VALIDATION_FAILED: 'Permintaan tidak valid.', UNAUTHENTICATED: 'Silakan masuk kembali.',
  CSRF_FAILED: 'Permintaan tidak dapat diverifikasi.', CONSENT_REQUIRED: 'Persetujuan orang tua diperlukan.',
  ACCOUNT_UNAVAILABLE: 'Akun belum tersedia.', FORBIDDEN: 'Akses tidak diizinkan.', NOT_FOUND: 'Data tidak ditemukan.',
  LINK_EXPIRED: 'Tautan sudah kedaluwarsa atau digunakan.', FEATURE_DISABLED: 'Fitur belum diaktifkan.',
  DEPENDENCY_UNAVAILABLE: 'Integrasi belum tersedia.', IDEMPOTENCY_KEY_REUSED: 'Kunci permintaan sudah digunakan.',
  IDEMPOTENCY_IN_PROGRESS: 'Permintaan sedang diproses.', RATE_LIMITED: 'Terlalu banyak permintaan.',
  INTERNAL_ERROR: 'Terjadi kesalahan. Silakan coba kembali.',
};
