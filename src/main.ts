import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { connect } from './db.js';
import { deepseekDevelopment } from './assessment/deepseek-development.js';
const settings=readConfig(), db=connect(settings.databaseUrl);
const engine=deepseekDevelopment(settings,db);
const {app,config}=await buildApp(settings,{db,...(engine?{diagnosisEngine:engine}:{})});
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void app.close();});
await app.listen({host:config.host,port:config.port});
