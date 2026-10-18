import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const frontend=resolve(process.env.FRONTEND_DIR??'../mockup/intibelajar');
const require=createRequire(resolve(frontend,'package.json'));
const {buildSync}=require('esbuild');
let beacons=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{sendBeacon(){beacons++;return true;}}});
const records=new Map();globalThis.sessionStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
const cases=[
  {env:{VITE_LEARNING_MODE:'demo',VITE_TRACK_URL:'https://analytics.example.invalid'},expected:0},
  {env:{VITE_SLICE0:'true',VITE_LEARNING_MODE:'assessment',VITE_TRACK_URL:'https://analytics.example.invalid'},expected:0},
  {env:{VITE_LEARNING_MODE:'assessment',VITE_TRACK_URL:'https://analytics.example.invalid'},expected:1},
];
for(const [index,item]of cases.entries()) {
  beacons=0;records.clear();
  const output=buildSync({entryPoints:[resolve(frontend,'src/services/track.ts')],bundle:true,write:false,format:'esm',define:{'import.meta.env':JSON.stringify(item.env)},logLevel:'silent'}).outputFiles[0].text;
  const module=await import('data:text/javascript;base64,'+Buffer.from(output+'\n// case '+index).toString('base64'));
  module.track('coba_start');assert.equal(beacons,item.expected);assert.equal(module.readEvents().length,1);
}
console.log('PASS: 3 frontend local-event/beacon isolation scenarios (network stubbed; no external calls)');
