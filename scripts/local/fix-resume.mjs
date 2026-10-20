import {readFileSync,writeFileSync} from 'node:fs';
const f='../mockup/intibelajar/src/composables/useCobaFlow.ts';
let s=readFileSync(f,'utf8');
s=s.replace('["MICROLEARNING","QUICK_CHECK"].includes(loop.state)) goTo(3)', '["MICROLEARNING","QUICK_CHECK"].includes(loop.state)) goTo(4)');
s=s.replace('["DIAGNOSING", "CLARIFICATION_NEEDED", "DIAGNOSIS_READY", "EVALUATION_FAILED"].includes(loop.state)', '["DIAGNOSING", "CLARIFICATION_NEEDED", "DIAGNOSIS_READY", "EVALUATION_FAILED", "MICROLEARNING", "QUICK_CHECK"].includes(loop.state)');
writeFileSync(f,s);
