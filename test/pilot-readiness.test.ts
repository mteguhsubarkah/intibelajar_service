import test from 'node:test';import assert from 'node:assert/strict';
import {pilotReadiness} from '../scripts/pilot-readiness.js';
test('pilot check never treats configured credentials or adult test acknowledgment as production approval',()=>{
 const report=pilotReadiness({APP_ORIGIN:'https://intibelajar.com',GOOGLE_CLIENT_ID:'private-client',GOOGLE_CLIENT_SECRET:'secret-google',DEEPSEEK_API_KEY:'secret-deepseek',RESEND_API_KEY:'secret-email',GOOGLE_TEST_ADULT_ACK:'true',EMAIL_PROVIDER:'resend'});
 assert.equal(report.ready,false);assert.equal(report.checks.find(c=>c.id==='PUBLIC_HTTPS_ORIGIN')?.ready,true);
 for(const id of ['PRODUCTION_RUNTIME','REAL_CONSENT_POLICY','ADULT_ENROLLMENT','EMAIL_ENROLLMENT','PRIVACY_OPERATIONS','REAL_AI_DATA'])assert.equal(report.checks.find(c=>c.id===id)?.ready,false);
 const output=JSON.stringify(report);for(const secret of ['private-client','secret-google','secret-deepseek','secret-email'])assert(!output.includes(secret));
 assert.equal(pilotReadiness({APP_ORIGIN:'http://example.com'}).checks[0]?.ready,false);
 assert.equal(pilotReadiness({APP_ORIGIN:'https://user:pass@example.com'}).checks[0]?.ready,false);
});
