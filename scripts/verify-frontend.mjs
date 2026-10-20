import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cwd=resolve(process.env.FRONTEND_DIR??'../mockup/intibelajar');
// test:answer-golden grades the shared golden cases with the Vue checker, against this checkout's file.
const env={...process.env,GOLDEN_FILE:resolve('catalog/golden/answers.v2.json')};
for(const script of ['test','test:backend','test:answer-golden']) {
  const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',script],{cwd,env,stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0)process.exit(result.status??1);
}
await import('./check-frontend-local-only.mjs');
