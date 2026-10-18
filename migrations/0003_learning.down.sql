-- Development rollback only; removes all learning data.
ALTER TABLE learning_session DROP CONSTRAINT learning_session_active_attempt_fk;
DROP TABLE concept_evidence;
DROP TABLE diagnosis_run;
DROP TABLE assistance_event;
DROP TABLE question_attempt;
DROP TABLE lesson_assignment;
DROP TABLE session_item;
DROP TABLE learning_session;
DROP FUNCTION concept_evidence_append_only();
DROP FUNCTION diagnosis_run_terminal_immutable();
DROP FUNCTION question_attempt_immutable();
