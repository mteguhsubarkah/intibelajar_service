import { buildApp } from './app.js';
const {app,config}=await buildApp();
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void app.close();});
await app.listen({host:config.host,port:config.port});
