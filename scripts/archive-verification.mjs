import {readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const directory='docs/backend-implementation/evidence';mkdirSync(directory,{recursive:true});
const evidence=[
  ['test-results.log','backend-tests.txt',/ℹ pass 16[\s\S]*ℹ fail 0/],
  ['frontend-tests.log','frontend-tests.txt',/PASS: 27 gamification, session, tutor, and bank assertions/],
  ['consumer-tests.log','consumer-contracts.txt',/29 backend contract checks passed/],
  ['spec-validation.log','architecture-validation.txt',/summary: \{'pass': 15, 'warn': 0, 'fail': 0\}/],
  ['frontend-build.log','frontend-build.txt',/built in/],
  ['boundaries.log','module-boundaries.txt',/Module table ownership boundaries passed/],
  ['openapi-validation.log','openapi-validation.txt',/OpenAPI 3.1: .* validation passed/],
  ['frontend-local-only.log','frontend-local-only.txt',/PASS: 3 frontend local-event\/beacon isolation scenarios/],
];
for(const [source,target,expected]of evidence){assert.match(readFileSync('.local/'+source,'utf8'),expected,source);copyFileSync('.local/'+source,directory+'/'+target);}
assert.equal(readFileSync('.local/typecheck.log','utf8').trim(),'');
writeFileSync(directory+'/typecheck.txt','PASS: TypeScript --noEmit; exit output empty.\n');
const baseline={};
for(const name of readdirSync('docs/backend-architecture').filter(n=>/^\d\d-.*\.md$/.test(n)||['openapi.yaml','verification.json','validate-spec.py'].includes(n)).sort())
  baseline[name]=createHash('sha256').update(readFileSync('docs/backend-architecture/'+name)).digest('hex');
const env=JSON.parse(readFileSync('.local/test-env.json','utf8'));
const client=new pg.Client({connectionString:env.DATABASE_URL});await client.connect();
try {
  const version=(await client.query('show server_version')).rows[0].server_version;
  const migrations=(await client.query('select name,sha256 from schema_migration order by name')).rows;
  const result={date:'2026-10-18',scope:'Synthetic local development only; no deployment',node:process.version,postgresql:version,
    database:'intibelajar_slice0_test',migrations,backend:{nodeReportedTests:16,namedScenarios:15,failures:0},frontendConsumerChecks:29,
    architecture:{pass:15,warn:0,fail:0},localOnlyTrackingScenarios:3,baselineSha256:baseline,
    notPerformed:['Production deployment','Real identity/guardian verification','Real student data processing','External AI calls','Browser E2E','Managed backup restore drill','Hosted CI execution','Vulnerability audit (registry endpoint 404 NOT_IMPLEMENTED)'],
    productionApproved:false};
  writeFileSync('docs/backend-implementation/verification.json',JSON.stringify(result,null,2)+'\n');
}finally{await client.end();}
console.log('Archived verified evidence and architecture baseline hashes; no credentials copied');
