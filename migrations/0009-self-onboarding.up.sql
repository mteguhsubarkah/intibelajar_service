-- Izin yang diberikan siswa sendiri saat onboarding (tanpa guardian).
-- Hanya dipakai bila SELF_ONBOARDING_CONSENT=true; alur guardian tetap utuh.
ALTER TABLE consent_record DROP CONSTRAINT consent_record_method_check;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_method_check
  CHECK (method IN ('GUARDIAN_EMAIL','GUARDIAN_SIGNIN','SELF_WITH_GUARDIAN_NOTICE','SELF_DECLARED'));
ALTER TABLE consent_record ALTER COLUMN guardian_id DROP NOT NULL;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_guardian_required
  CHECK (guardian_id IS NOT NULL OR method = 'SELF_DECLARED');
