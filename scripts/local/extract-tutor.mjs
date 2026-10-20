import{readFileSync,writeFileSync}from'node:fs';
const doc=readFileSync('docs/backend-architecture/04-postgresql-erd.md','utf8');
const blocks=['tutor_conversation','tutor_message'].map(n=>{const m=doc.match(new RegExp('CREATE TABLE '+n+' \\([\\s\\S]*?\\n\\);'));if(!m)throw Error(n);return m[0];});
writeFileSync('migrations/0007-tutor.up.sql',blocks.join('\n\n')+'\nCREATE UNIQUE INDEX tutor_open_session_focus ON tutor_conversation(session_id,coalesce(concept_id,\'00000000-0000-0000-0000-000000000000\'::uuid)) WHERE status=\'OPEN\';\nCREATE UNIQUE INDEX tutor_reply_once ON tutor_message(reply_to_id) WHERE role=\'TUTOR\';\n');
writeFileSync('migrations/0007-tutor.down.sql','DROP TABLE tutor_message;\nDROP TABLE tutor_conversation;\n');
