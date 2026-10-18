-- Development rollback only; removes dispute reports and diagnosis jobs.
DELETE FROM job WHERE diagnosis_run_id IS NOT NULL;
ALTER TABLE job DROP CONSTRAINT job_one_target;
ALTER TABLE job DROP COLUMN diagnosis_run_id;
ALTER TABLE job ADD CHECK (deletion_request_id IS NOT NULL);
DROP TABLE diagnosis_report;
DROP FUNCTION diagnosis_report_resolve_once();
