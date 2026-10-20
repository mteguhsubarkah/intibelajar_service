import{readFileSync,writeFileSync}from'node:fs';const doc=readFileSync('docs/backend-architecture/04-postgresql-erd.md','utf8');
const blocks=['private_asset','question_intake'].map(n=>{const m=doc.match(new RegExp('CREATE TABLE '+n+' \\([\\s\\S]*?\\n\\);'));if(!m)throw Error(n);return m[0];});
writeFileSync('migrations/0008-intake.up.sql',blocks.join('\n\n')+`\n-- Development-only encrypted image quarantine; no public image URL.\nCREATE TABLE development_intake_image(asset_id uuid PRIMARY KEY REFERENCES private_asset(id),ciphertext bytea NOT NULL,lease text,lease_until timestamptz);\n`);
writeFileSync('migrations/0008-intake.down.sql','DROP TABLE development_intake_image;\nDROP TABLE question_intake;\nDROP TABLE private_asset;\n');
