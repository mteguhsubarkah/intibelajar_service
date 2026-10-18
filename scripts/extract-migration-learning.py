"""Reproducible extraction of the Slice 1 learning migration (M4) from the authoritative DDL in 04 §4.

Slice 1 tables are the §4 block up to diagnosis_report (04 §9 order); later tables belong to Slices 2-6.
Appended here: 04 §5 indexes plus FK lookup indexes (04 conventions), 04 §6 size caps, and update guards
for INV-07 (attempts), INV-08 (terminal runs) and append-only evidence. Guards cover UPDATE only:
erasure must always be able to delete (INV-19).
"""
from pathlib import Path
import re

source = Path('docs/backend-architecture/04-postgresql-erd.md').read_text(encoding='utf8')
block = next(b for b in re.findall(r'```sql\n(.*?)```', source, re.S) if 'CREATE TABLE learning_session' in b)
block = block.split('CREATE TABLE diagnosis_report')[0].rstrip() + '\n'
tables = re.findall(r'CREATE TABLE (\w+)', block)
assert tables == ['learning_session', 'session_item', 'lesson_assignment', 'question_attempt', 'assistance_event', 'diagnosis_run', 'concept_evidence'], tables

support = r'''
-- 04 §5 query indexes.
CREATE INDEX learning_session_resume ON learning_session(learner_id, last_activity_at DESC, id DESC);
CREATE INDEX learning_session_active ON learning_session(learner_id) WHERE state NOT IN ('COMPLETED','ABANDONED','EXPIRED');
CREATE INDEX learning_session_expiry ON learning_session(expires_at) WHERE state NOT IN ('COMPLETED','ABANDONED','EXPIRED');
CREATE INDEX question_attempt_history ON question_attempt(learner_id, submitted_at DESC);
CREATE INDEX question_attempt_revision ON question_attempt(question_revision_id);
CREATE INDEX assistance_event_family ON assistance_event(learner_id, question_family_code, occurred_at);
CREATE INDEX assistance_event_session ON assistance_event(session_id);
CREATE INDEX diagnosis_run_owner ON diagnosis_run(learner_id, created_at DESC);
CREATE INDEX diagnosis_run_stuck ON diagnosis_run(status, deadline_at) WHERE status IN ('QUEUED','RUNNING');
CREATE INDEX concept_evidence_mastery ON concept_evidence(learner_id, concept_id, created_at);
CREATE INDEX concept_evidence_attempt ON concept_evidence(attempt_id);
-- 04 conventions: every FK column that does not lead another index gets its own.
CREATE INDEX learning_session_release ON learning_session(release_id);
CREATE INDEX learning_session_anchor ON learning_session(anchor_question_revision_id) WHERE anchor_question_revision_id IS NOT NULL;
CREATE INDEX learning_session_focus ON learning_session(focus_concept_id) WHERE focus_concept_id IS NOT NULL;
CREATE INDEX learning_session_active_attempt ON learning_session(active_attempt_id) WHERE active_attempt_id IS NOT NULL;
CREATE INDEX session_item_revision ON session_item(question_revision_id);
CREATE INDEX lesson_assignment_session ON lesson_assignment(session_id);
CREATE INDEX lesson_assignment_lesson ON lesson_assignment(lesson_id);
CREATE INDEX lesson_assignment_revision ON lesson_assignment(lesson_revision_id);
CREATE INDEX lesson_assignment_concept ON lesson_assignment(concept_id);
CREATE INDEX question_attempt_item ON question_attempt(session_item_id) WHERE session_item_id IS NOT NULL;
CREATE INDEX question_attempt_assignment ON question_attempt(assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX question_attempt_check ON question_attempt(micro_assessment_id) WHERE micro_assessment_id IS NOT NULL;
CREATE INDEX question_attempt_parent ON question_attempt(parent_attempt_id) WHERE parent_attempt_id IS NOT NULL;
CREATE INDEX assistance_event_concept ON assistance_event(concept_id) WHERE concept_id IS NOT NULL;
CREATE INDEX concept_evidence_concept ON concept_evidence(concept_id);
CREATE INDEX concept_evidence_supersedes ON concept_evidence(supersedes_id) WHERE supersedes_id IS NOT NULL;

-- 04 §6: bounded value objects (response 4 KB; the others are small, server-written shapes).
ALTER TABLE question_attempt ADD CHECK (octet_length(response::text) <= 4096);
ALTER TABLE learning_session ADD CHECK (octet_length(checkpoint::text) <= 4096);
ALTER TABLE lesson_assignment ADD CHECK (octet_length(pinned_checks::text) <= 4096);
ALTER TABLE assistance_event ADD CHECK (octet_length(detail::text) <= 2048);
ALTER TABLE diagnosis_run ADD CHECK (octet_length(recommendations::text) <= 16384 AND octet_length(provenance::text) <= 4096);
ALTER TABLE concept_evidence ADD CHECK (octet_length(refs::text) <= 16384);

-- INV-07: a stored attempt is immutable. Grading sets verdict and graded_at once; the 180-day retention
-- purge (04 §8) replaces the response with {schemaVersion, responseType, purged: true}. Nothing else changes.
CREATE FUNCTION question_attempt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  graded boolean := OLD.verdict = 'PENDING' AND NEW.verdict <> 'PENDING' AND OLD.graded_at IS NULL AND NEW.graded_at IS NOT NULL;
  purged boolean := OLD.response_purged_at IS NULL AND NEW.response_purged_at IS NOT NULL
    AND NEW.response = jsonb_build_object('schemaVersion', OLD.response -> 'schemaVersion', 'responseType', OLD.response -> 'responseType', 'purged', true);
BEGIN
  IF (to_jsonb(NEW) - 'verdict' - 'graded_at' - 'response' - 'response_purged_at') <> (to_jsonb(OLD) - 'verdict' - 'graded_at' - 'response' - 'response_purged_at')
     OR ((NEW.verdict, NEW.graded_at) IS DISTINCT FROM (OLD.verdict, OLD.graded_at) AND NOT graded)
     OR ((NEW.response, NEW.response_purged_at) IS DISTINCT FROM (OLD.response, OLD.response_purged_at) AND NOT purged) THEN
    RAISE EXCEPTION 'INV-07: attempt % is immutable', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_attempt_immutable BEFORE UPDATE ON question_attempt FOR EACH ROW EXECUTE FUNCTION question_attempt_immutable();

-- INV-08: terminal diagnosis runs are immutable; a re-run is a new generation.
CREATE FUNCTION diagnosis_run_terminal_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('COMPLETED','FAILED','CANCELLED') THEN
    RAISE EXCEPTION 'INV-08: diagnosis run % is terminal', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER diagnosis_run_terminal_immutable BEFORE UPDATE ON diagnosis_run FOR EACH ROW EXECUTE FUNCTION diagnosis_run_terminal_immutable();

-- Evidence is append-only (03 §6). The one permitted change marks a row superseded by a regrade (06 §5.1 rule 7):
-- it loses mastery and transfer eligibility and gains the SUPERSEDED reason.
CREATE FUNCTION concept_evidence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'mastery_eligible' - 'transfer_eligible' - 'eligibility_reasons') = (to_jsonb(OLD) - 'mastery_eligible' - 'transfer_eligible' - 'eligibility_reasons')
     AND NOT NEW.mastery_eligible AND NOT NEW.transfer_eligible
     AND NEW.eligibility_reasons = array_append(array_remove(OLD.eligibility_reasons, 'SUPERSEDED'), 'SUPERSEDED') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'evidence % is append-only; correct it with a superseding row', OLD.id USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER concept_evidence_append_only BEFORE UPDATE ON concept_evidence FOR EACH ROW EXECUTE FUNCTION concept_evidence_append_only();
'''

Path('migrations/0003_learning.up.sql').write_text(
    '-- Slice 1 M4: learning and assessment tables extracted from architecture 04 §4 (up to diagnosis_report).\n'
    '-- Generated by scripts/extract-migration-learning.py; do not edit by hand.\n' + block + support, encoding='utf8', newline='\n')
functions = ['concept_evidence_append_only', 'diagnosis_run_terminal_immutable', 'question_attempt_immutable']
Path('migrations/0003_learning.down.sql').write_text(
    '-- Development rollback only; removes all learning data.\n'
    'ALTER TABLE learning_session DROP CONSTRAINT learning_session_active_attempt_fk;\n'
    + ''.join(f'DROP TABLE {t};\n' for t in reversed(tables)) + ''.join(f'DROP FUNCTION {f}();\n' for f in functions), encoding='utf8', newline='\n')
print('wrote 0003_learning (%d tables)' % len(tables))
