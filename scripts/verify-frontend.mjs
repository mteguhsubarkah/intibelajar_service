import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cwd=resolve(process.env.FRONTEND_DIR??'../mockup/intibelajar');
for(const script of ['test','test:backend']) {
  const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',script],{cwd,stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0)process.exit(result.status??1);
}
await import('./check-frontend-local-only.mjs');
