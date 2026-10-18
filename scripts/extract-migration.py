"""One-time, reproducible extraction of Slice 0 from the authoritative DDL."""
from pathlib import Path
import re
source = Path('docs/backend-architecture/04-postgresql-erd.md').read_text(encoding='utf8')
block = re.findall(r'```sql\n(.*?)```', source, re.S)[0]
block = block.split('CREATE TABLE ai_invocation')[0]
for table in ['diagnosis_run', 'tutor_message', 'question_intake']:
    block = re.sub(r'^  '+table+r'_id\s+uuid UNIQUE REFERENCES '+table+r'\(id\),\n', '', block, flags=re.M)
block = block.replace('num_nonnulls(diagnosis_run_id, tutor_message_id, question_intake_id, deletion_request_id) = 1', 'deletion_request_id IS NOT NULL')
indexes = '''
CREATE INDEX identity_user ON auth_identity(user_id);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE INDEX session_expiry ON auth_session(idle_expires_at);
CREATE INDEX transaction_session ON auth_transaction(session_id);
CREATE INDEX consent_guardian ON consent_record(guardian_id);
CREATE INDEX consent_expiry ON consent_record(expires_at) WHERE status = 'PENDING';
CREATE INDEX idempotency_expiry ON idempotency_record(expires_at);
CREATE INDEX job_queued ON job(queue, priority DESC, available_at) WHERE status = 'QUEUED';
CREATE INDEX job_lease ON job(lease_until) WHERE status = 'RUNNING';
CREATE INDEX audit_subject ON audit_event(subject_ref);
CREATE INDEX audit_time ON audit_event(occurred_at);
ALTER TABLE auth_transaction ADD CHECK (octet_length(continuation::text) <= 4096);
ALTER TABLE audit_event ADD CHECK (octet_length(detail::text) <= 2048);
ALTER TABLE idempotency_record ADD CHECK (octet_length(response_body::text) <= 16384);
'''
Path('migrations').mkdir(exist_ok=True)
Path('migrations/0001_slice0.up.sql').write_text('-- Extracted from architecture 04; future job references deferred to their slices.\n'+block+indexes, encoding='utf8')
tables = re.findall(r'CREATE TABLE (\w+)', block)
Path('migrations/0001_slice0.down.sql').write_text('-- Development rollback only; removes Slice 0 data.\n'+'\n'.join('DROP TABLE '+t+';' for t in reversed(tables))+'\n', encoding='utf8')
