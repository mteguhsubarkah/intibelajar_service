// One local component per terminal. Same configuration as local-dev; no database resets or fixture grants.
import {readFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
const name=process.argv[2];
const commands={api:['--import','tsx','src/main.ts'],worker:['--import','tsx','src/worker.ts'],frontend:['scripts/local/vite.mjs'],prepare:['--import','tsx','scripts/local/prepare.ts']};
if(!commands[name])throw Error('Usage: node scripts/local/component.mjs api|worker|frontend (from backend root)');
const local=JSON.parse(readFileSync('.local/local-dev/env.json','utf8'));
if(name!=='frontend')for(const file of ['.local/local-dev/deepseek.env','.local/local-dev/google.env','.local/local-dev/ocr.env'])if(existsSync(file))process.loadEnvFile(file);
const env={...process.env,...local};
if(name==='frontend')for(const key of ['DEEPSEEK_API_KEY','GOOGLE_CLIENT_SECRET','GOOGLE_CLIENT_ID','GOOGLE_TEST_EMAIL','OPENROUTER_API_KEY'])delete env[key];
const child=spawn(process.execPath,commands[name],{env,stdio:'inherit',windowsHide:true});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('error',()=>{console.error('Local component could not start');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??0;});
