-- Izin percobaan tidak punya padanan di skema lama. Learner percobaan yang tersisa kehilangan izinnya dan
-- ditangguhkan oleh sweep berikutnya.
DELETE FROM consent_record WHERE method = 'GUEST_TRIAL';
UPDATE deletion_request SET reason = 'OTHER' WHERE reason = 'TRIAL_EXPIRED';

ALTER TABLE deletion_request DROP CONSTRAINT deletion_request_reason_check;
ALTER TABLE deletion_request ADD CONSTRAINT deletion_request_reason_check
  CHECK (reason IN ('USER_REQUEST','CONSENT_DECLINED','CONSENT_REVOKED','CONSENT_EXPIRED','INACTIVITY','OTHER'));

ALTER TABLE consent_record DROP CONSTRAINT consent_record_guardian_required;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_guardian_required
  CHECK (guardian_id IS NOT NULL OR method = 'SELF_DECLARED');
ALTER TABLE consent_record DROP CONSTRAINT consent_record_method_check;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_method_check
  CHECK (method IN ('GUARDIAN_EMAIL','GUARDIAN_SIGNIN','SELF_WITH_GUARDIAN_NOTICE','SELF_DECLARED'));

DROP INDEX app_user_trial;
ALTER TABLE app_user DROP COLUMN trial_expires_at;
