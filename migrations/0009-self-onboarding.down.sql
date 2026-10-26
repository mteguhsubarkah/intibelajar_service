-- Izin mandiri tidak punya guardian, jadi tidak bisa dipertahankan di skema lama.
DELETE FROM consent_record WHERE method = 'SELF_DECLARED';
ALTER TABLE consent_record DROP CONSTRAINT consent_record_guardian_required;
ALTER TABLE consent_record ALTER COLUMN guardian_id SET NOT NULL;
ALTER TABLE consent_record DROP CONSTRAINT consent_record_method_check;
ALTER TABLE consent_record ADD CONSTRAINT consent_record_method_check
  CHECK (method IN ('GUARDIAN_EMAIL','GUARDIAN_SIGNIN','SELF_WITH_GUARDIAN_NOTICE'));
