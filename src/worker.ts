import { readConfig } from './config.js';
import { connect } from './db.js';
import { workerTick } from './privacy/erasure.js';
import { expireSessions } from './learning/service.js';
import { diagnosisTick } from './learning/diagnosis-worker.js';
import { deepseekDevelopment } from './assessment/deepseek-development.js';
import {telemetry} from './platform/telemetry.js';
import {emailTick} from './identity/email-outbox.js';
import {resendTransport} from './identity/email-transport.js';
import{deepseekTutor}from'./tutor/deepseek.js';import{tutorTick}from'./tutor/service.js';
import{ocrConfiguration}from'./intake/openrouter-ocr.js';import{intakeTick}from'./intake/service.js';
import{rebuildProgress}from'./progress/service.js';import{projectionLearners,holdLearner,requireConsent,profile}from'./privacy/service.js';
const config=readConfig(),db=connect(config.databaseUrl);let running=true;
const diagnosisEngine=deepseekDevelopment(config,db);
const tutorEngine=deepseekTutor(db);
const ocr=ocrConfiguration();
const emailTransport=config.email?resendTransport(config.email,config.origin):null;
let nextProjection=0;
const traces=telemetry();
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{running=false;});
try {while(running){
  const span=traces.tracer.startSpan('worker.deletion.tick');
  // No queued diagnosis engine outside tests (plan 05 D4): the tick only recovers leases and ends runs that cannot finish.
  try{await workerTick(db,config);await emailTick(db,config,emailTransport);await expireSessions(db);await diagnosisTick(db,diagnosisEngine);await tutorTick(db,config.key,tutorEngine);await intakeTick(db,config.key,ocr);
   if(Date.now()>=nextProjection){nextProjection=Date.now()+3600000;for(const id of await projectionLearners(db))await db.transaction().execute(async tx=>{await holdLearner(tx,id);await requireConsent(tx,id,['LEARNING_DATA']);await rebuildProgress(tx,id,(await profile(tx,id)).timezone);});}
  }catch{console.error(JSON.stringify({level:'error',code:'WORKER_DEPENDENCY_UNAVAILABLE'}));}
  finally{span.end();}
  await new Promise(r=>setTimeout(r,1000));
}}finally{await traces.close();await db.destroy();}
