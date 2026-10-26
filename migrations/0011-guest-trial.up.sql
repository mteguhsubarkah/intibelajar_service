-- Akun percobaan tamu untuk /coba (GUEST_TRY=true). Tamu yang mengecek jawaban mendapat learner sementara supaya
-- dinilai server dengan jalur yang sama seperti siswa yang masuk (aturan, DeepSeek, retry, solusi, tutor).
-- Berlaku 24 jam, lalu dihapus lewat erasure biasa (alasan TRIAL_EXPIRED).
ALTER TABLE app_user ADD COLUMN trial_expires_at timestamptz;
CREATE INDEX app_user_trial ON app_user (trial_expires_at) WHERE trial_expires_at IS NOT NULL;

ALTER TABLE consent_record DROP CONSTRAINT consent_record_method_check;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_method_check
  CHECK (method IN ('GUARDIAN_EMAIL','GUARDIAN_SIGNIN','SELF_WITH_GUARDIAN_NOTICE','SELF_DECLARED','GUEST_TRIAL'));
ALTER TABLE consent_record DROP CONSTRAINT consent_record_guardian_required;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_guardian_required
  CHECK (guardian_id IS NOT NULL OR method IN ('SELF_DECLARED','GUEST_TRIAL'));

ALTER TABLE deletion_request DROP CONSTRAINT deletion_request_reason_check;
ALTER TABLE deletion_request ADD CONSTRAINT deletion_request_reason_check
  CHECK (reason IN ('USER_REQUEST','CONSENT_DECLINED','CONSENT_REVOKED','CONSENT_EXPIRED','INACTIVITY','OTHER','TRIAL_EXPIRED'));
