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
test('a valid pilot runtime passes only the runtime gate; the consent, enrollment, privacy and AI gates stay closed',()=>{
 const env={NODE_ENV:'production',RUNTIME_MODE:'pilot',APP_ORIGIN:'https://intibelajar.com',TRUST_PROXY:'127.0.0.1',
  DATABASE_URL:'postgresql://u:p@127.0.0.1:5432/intibelajar_pilot',APP_KEY:'a'.repeat(64)};
 const report=pilotReadiness(env);
 assert.equal(report.checks.find(c=>c.id==='PRODUCTION_RUNTIME')?.ready,true);
 assert.equal(report.syntheticRuntimeOnly,false);
 assert.equal(report.ready,false);
 for(const id of ['REAL_CONSENT_POLICY','ADULT_ENROLLMENT','EMAIL_ENROLLMENT','PRIVACY_OPERATIONS','REAL_AI_DATA'])assert.equal(report.checks.find(c=>c.id===id)?.ready,false,id);
 // Automatic consent makes the runtime itself invalid.
 assert.equal(pilotReadiness({...env,SELF_ONBOARDING_CONSENT:'true'}).checks.find(c=>c.id==='PRODUCTION_RUNTIME')?.ready,false);
 assert.equal(pilotReadiness({...env,FEATURE_GUEST_TRIAL:'true'}).checks.find(c=>c.id==='PRODUCTION_RUNTIME')?.ready,false);
});
