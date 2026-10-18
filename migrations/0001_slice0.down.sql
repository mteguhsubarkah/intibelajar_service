-- Development rollback only; removes Slice 0 data.
DROP TABLE job;
DROP TABLE idempotency_record;
DROP TABLE audit_event;
DROP TABLE erasure_receipt;
DROP TABLE deletion_request;
DROP TABLE consent_record;
DROP TABLE student_profile;
DROP TABLE auth_transaction;
DROP TABLE auth_session;
DROP TABLE auth_identity;
DROP TABLE app_user;
DROP TABLE guardian;
DROP TABLE learner;
