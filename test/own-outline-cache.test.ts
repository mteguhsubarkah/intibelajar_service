import test from 'node:test';import assert from 'node:assert/strict';
import {outlineCache} from '../src/assessment/own-outline-cache.js';
test('outline cache coalesces requests, reuses successful results and expires at TTL',async()=>{
 let time=0,calls=0;let resolve!:(v:string[])=>void;
 const cache=outlineCache<string[]>({ttlMs:100,maxEntries:2,now:()=>time});
 const load=()=>{calls++;return new Promise<string[]>(r=>resolve=r);};
 const a=cache.get('same',load),b=cache.get('same',load);await Promise.resolve();assert.equal(calls,1);resolve(['one']);
 assert.deepEqual(await a,await b);assert.deepEqual(await cache.get('same',async()=>{throw Error('must not run');}),['one']);
 time=100;assert.deepEqual(await cache.get('same',async()=>{calls++;return ['new'];}),['new']);assert.equal(calls,2);
});
test('outline cache is bounded LRU and caches valid no-match but never a failure',async()=>{
 let calls=0;const cache=outlineCache<string[]>({maxEntries:2});const load=async()=>{calls++;return [];};
 await cache.get('a',load);await cache.get('b',load);await cache.get('a',load);await cache.get('c',load);assert.equal(calls,3);
 await cache.get('b',load);assert.equal(calls,4);
 await assert.rejects(cache.get('fail',async()=>{throw Error('provider down');}),/provider down/);
 assert.deepEqual(await cache.get('fail',load),[]);assert.equal(calls,5);
});
test('outline cache caps in-flight work and clear prevents stale completion from repopulating',async()=>{
 let resolve!:(v:number)=>void;const cache=outlineCache<number>({maxInFlight:1});
 const running=cache.get('a',()=>new Promise<number>(r=>resolve=r));await Promise.resolve();
 await assert.rejects(cache.get('b',async()=>2),(e:any)=>e.status===503);
 cache.clear();resolve(1);assert.equal(await running,1);
 assert.equal(await cache.get('a',async()=>3),3);
});
