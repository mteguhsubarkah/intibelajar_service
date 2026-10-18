import { readConfig } from './config.js';
import { connect } from './db.js';
import { workerTick } from './privacy/erasure.js';
import {telemetry} from './platform/telemetry.js';
const config=readConfig(),db=connect(config.databaseUrl);let running=true;
const traces=telemetry();
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{running=false;});
try {while(running){
  const span=traces.tracer.startSpan('worker.deletion.tick');
  try{await workerTick(db,config);}catch{console.error(JSON.stringify({level:'error',code:'WORKER_DEPENDENCY_UNAVAILABLE'}));}
  finally{span.end();}
  await new Promise(r=>setTimeout(r,1000));
}}finally{await traces.close();await db.destroy();}
