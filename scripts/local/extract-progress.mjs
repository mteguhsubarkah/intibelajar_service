import{readFileSync,writeFileSync}from'node:fs';
const doc=readFileSync('docs/backend-architecture/04-postgresql-erd.md','utf8');
const names=['mastery_state','progress_event','learner_stats'];
const blocks=names.map(n=>{const m=doc.match(new RegExp('CREATE TABLE '+n+' \\([\\s\\S]*?\\n\\);'));if(!m)throw Error(n);return m[0];});
writeFileSync('migrations/0006-progress.up.sql','-- Extracted from authoritative 04; development projection tables.\n'+blocks.join('\n\n')+'\nCREATE INDEX progress_events_learner_time ON progress_event(learner_id,occurred_at,id);\n');
writeFileSync('migrations/0006-progress.down.sql','DROP TABLE learner_stats;\nDROP TABLE progress_event;\nDROP TABLE mastery_state;\n');
