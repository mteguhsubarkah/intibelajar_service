import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readConfig} from '../src/config.js';
import {connect} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createPendingLearner,updateProfile,requireConsent,consents} from '../src/privacy/service.js';
const base=JSON.parse(readFileSync('.local/test-env.json','utf8'));
const pilot={DATABASE_URL:base.DATABASE_URL,APP_KEY:base.APP_KEY,NODE_ENV:'production',RUNTIME_MODE:'pilot',APP_ORIGIN:'https://intibelajar.com',TRUST_PROXY:'127.0.0.1'};
test('pilot self-onboarding is explicitly enabled, default remains guardian flow',()=>{
 assert.equal(readConfig(pilot).selfConsent,false);
 const c=readConfig({...pilot,SELF_ONBOARDING_CONSENT:'true'});
 assert.equal(c.selfConsent,true);assert.equal(c.synthetic,false);assert.equal(c.features.guestTrial,false);
});
test('pilot pending accounts activate on completed profile, without fabricated guardian grants',async()=>{
 const c=readConfig({...pilot,SELF_ONBOARDING_CONSENT:'true'});
 assert.match(new URL(c.databaseUrl).pathname,/_test$/);
 const db=connect(c.databaseUrl);const rollback=new Error('ROLLBACK_TEST');
 try{
  await migrate(db);
  await assert.rejects(db.transaction().execute(async tx=>{
   const id=await createPendingLearner(tx);
   assert.equal((await updateProfile(tx,id,{grade:10},c)).status,'PENDING_CONSENT');
   assert.equal((await updateProfile(tx,id,{displayName:'Pilot test'},c)).status,'ACTIVE');
   await requireConsent(tx,id,['LEARNING_DATA','AI_PROCESSING','IMAGE_UPLOAD']);
   await updateProfile(tx,id,{displayName:'Pilot test updated'},c);
   const records=await tx.selectFrom('consent_record').select(['purpose','method','decided_by','guardian_id']).where('learner_id','=',id).execute();
   assert.equal(records.length,3);
   for(const r of records){assert.equal(r.method,'SELF_DECLARED');assert.equal(r.decided_by,'LEARNER');assert.equal(r.guardian_id,null);}
   assert.equal((await consents(tx,id)).items.find(r=>r.purpose==='PRODUCT_ANALYTICS')?.status,'NOT_REQUESTED');
   throw rollback;
  }),e=>e===rollback);
 }finally{await db.destroy();}
});
