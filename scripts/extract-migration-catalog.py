"""Reproducible extraction of the Slice 1 catalog migration (M2) from the authoritative DDL in 04 §3.

The tables come verbatim from the §3 sql block. Supporting indexes (04 §5), JSONB size caps (04 §6)
and the immutability triggers that enforce INV-04 (04 §3, publication rule) are appended here.
"""
from pathlib import Path
import re

source = Path('docs/backend-architecture/04-postgresql-erd.md').read_text(encoding='utf8')
block = next(b for b in re.findall(r'```sql\n(.*?)```', source, re.S) if 'CREATE TABLE curriculum_release' in b)
tables = re.findall(r'CREATE TABLE (\w+)', block)
assert tables[0] == 'curriculum_release' and 'catalog_alias' in tables and 'micro_lesson_revision' in tables, tables

support = r'''
-- 04 §5: FK lookups and catalog reads.
CREATE INDEX topic_subject ON topic(subject_id);
CREATE INDEX topic_relation_to ON topic_relation(to_topic_id);
CREATE INDEX concept_topic_ordinal ON concept(topic_id, ordinal);
CREATE INDEX concept_prerequisite_prerequisite ON concept_prerequisite(prerequisite_id);
CREATE INDEX question_owner ON question(owner_learner_id) WHERE owner_learner_id IS NOT NULL;
CREATE INDEX question_family ON question(family_code);
CREATE INDEX question_revision_release ON question_revision(release_id);
CREATE INDEX question_concept_concept ON question_concept(concept_id);
CREATE INDEX lesson_concept_concept ON lesson_concept(concept_id);
CREATE INDEX lesson_revision_release ON micro_lesson_revision(release_id);
CREATE INDEX micro_assessment_question ON micro_assessment(question_id);
CREATE INDEX catalog_alias_subject ON catalog_alias(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX catalog_alias_topic ON catalog_alias(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX catalog_alias_concept ON catalog_alias(concept_id) WHERE concept_id IS NOT NULL;
CREATE INDEX catalog_alias_question ON catalog_alias(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX catalog_alias_lesson ON catalog_alias(lesson_id) WHERE lesson_id IS NOT NULL;

-- 04 §6: bounded value objects.
ALTER TABLE curriculum_release ADD CHECK (snapshot IS NULL OR octet_length(snapshot::text) <= 20971520);
ALTER TABLE question_revision ADD CHECK (octet_length(rubric::text) <= 65536);
ALTER TABLE question_revision ADD CHECK (octet_length(body::text) <= 65536);
ALTER TABLE micro_lesson_revision ADD CHECK (octet_length(blocks::text) <= 65536);
ALTER TABLE topic ADD CHECK (octet_length(units::text) <= 16384);
ALTER TABLE concept ADD CHECK (octet_length(objectives::text) <= 16384 AND octet_length(misconceptions::text) <= 32768);

-- INV-04: published content is immutable. Rows are written as DRAFT and frozen by the publish.
-- A published or retired revision accepts only PUBLISHED -> RETIRED; it is never deleted, except a
-- private intake revision (release_id IS NULL), which erasure must be able to remove (Slice 6).
CREATE FUNCTION catalog_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' AND (to_jsonb(OLD) ->> 'release_id') IS NOT NULL THEN
      RAISE EXCEPTION 'INV-04: published % % cannot be deleted', TG_TABLE_NAME, OLD.id USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'DRAFT' THEN RETURN NEW; END IF;
  IF OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'INV-04: published % % is immutable; publish a new revision', TG_TABLE_NAME, OLD.id USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER question_revision_immutable BEFORE UPDATE OR DELETE ON question_revision FOR EACH ROW EXECUTE FUNCTION catalog_revision_immutable();
CREATE TRIGGER micro_lesson_revision_immutable BEFORE UPDATE OR DELETE ON micro_lesson_revision FOR EACH ROW EXECUTE FUNCTION catalog_revision_immutable();

-- A release is frozen once published: only is_current may flip, and status may move PUBLISHED -> RETIRED.
CREATE FUNCTION curriculum_release_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'INV-04: published release % cannot be deleted', OLD.version USING ERRCODE = 'integrity_constraint_violation'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'DRAFT' THEN RETURN NEW; END IF;
  IF (NEW.status = OLD.status OR (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED'))
     AND (to_jsonb(NEW) - 'status' - 'is_current') = (to_jsonb(OLD) - 'status' - 'is_current') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'INV-04: published release % is immutable', OLD.version USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER curriculum_release_immutable BEFORE UPDATE OR DELETE ON curriculum_release FOR EACH ROW EXECUTE FUNCTION curriculum_release_immutable();

-- Rows that belong to a revision or release (mappings, checks, aliases) change only while their parent is DRAFT.
-- TG_ARGV: parent table, parent key column in this table.
CREATE FUNCTION catalog_child_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_id uuid := (to_jsonb(CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END) ->> TG_ARGV[1])::uuid;
  parent record;
BEGIN
  EXECUTE format('SELECT status, to_jsonb(p) ->> ''release_id'' AS release_id FROM %I p WHERE id = $1', TG_ARGV[0]) INTO parent USING parent_id;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) ->> TG_ARGV[1]) IS DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[1]) THEN
    RAISE EXCEPTION 'INV-04: % rows cannot move to another %', TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF parent.status IS NULL OR parent.status = 'DRAFT' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' AND TG_ARGV[0] = 'question_revision' AND parent.release_id IS NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'INV-04: % of published % % is immutable', TG_TABLE_NAME, TG_ARGV[0], parent_id USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER question_concept_immutable BEFORE INSERT OR UPDATE OR DELETE ON question_concept FOR EACH ROW EXECUTE FUNCTION catalog_child_immutable('question_revision', 'question_revision_id');
CREATE TRIGGER micro_assessment_immutable BEFORE INSERT OR UPDATE OR DELETE ON micro_assessment FOR EACH ROW EXECUTE FUNCTION catalog_child_immutable('micro_lesson_revision', 'lesson_revision_id');
CREATE TRIGGER catalog_alias_immutable BEFORE INSERT OR UPDATE OR DELETE ON catalog_alias FOR EACH ROW EXECUTE FUNCTION catalog_child_immutable('curriculum_release', 'release_id');

-- Evidence cites misconception codes and is scoped by concept and family: those never change under it.
CREATE FUNCTION catalog_identity_stable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'concept' THEN
    IF NEW.topic_id <> OLD.topic_id THEN RAISE EXCEPTION 'concept % cannot move to another topic', OLD.code USING ERRCODE = 'integrity_constraint_violation'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.misconceptions) o
               WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.misconceptions) n WHERE n ->> 'code' = o ->> 'code')) THEN
      RAISE EXCEPTION 'concept % misconception codes are append-only', OLD.code USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  ELSIF NEW.family_code <> OLD.family_code OR NEW.visibility <> OLD.visibility OR NEW.origin <> OLD.origin THEN
    RAISE EXCEPTION 'question % family, visibility and origin are fixed', OLD.code USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER concept_identity_stable BEFORE UPDATE ON concept FOR EACH ROW EXECUTE FUNCTION catalog_identity_stable();
CREATE TRIGGER question_identity_stable BEFORE UPDATE ON question FOR EACH ROW EXECUTE FUNCTION catalog_identity_stable();
'''

Path('migrations/0002_catalog.up.sql').write_text(
    '-- Slice 1 M2: catalog tables extracted from architecture 04 §3 (D1 micro_lesson_revision, D2 catalog_alias).\n'
    '-- Generated by scripts/extract-migration-catalog.py; do not edit by hand.\n' + block + support, encoding='utf8', newline='\n')
functions = ['catalog_identity_stable', 'catalog_child_immutable', 'curriculum_release_immutable', 'catalog_revision_immutable']
Path('migrations/0002_catalog.down.sql').write_text(
    '-- Development rollback only; removes the catalog.\n' + ''.join(f'DROP TABLE {t};\n' for t in reversed(tables))
    + ''.join(f'DROP FUNCTION {f}();\n' for f in functions), encoding='utf8', newline='\n')
print('wrote 0002_catalog (%d tables)' % len(tables))
