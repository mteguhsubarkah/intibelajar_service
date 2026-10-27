import {fail} from '../platform/errors.js';
/** Process-local bounded TTL/LRU cache. Coalesces equal in-flight work and never caches failures. */
export function outlineCache<T>(options:{ttlMs?:number;maxEntries?:number;maxInFlight?:number;now?:()=>number}={}){
 const ttl=options.ttlMs??7200000,max=options.maxEntries??500,maxPending=options.maxInFlight??32,now=options.now??Date.now;
 const values=new Map<string,{expires:number;value:T}>();
 const pending=new Map<string,Promise<T>>();let generation=0;
 return {
  async get(key:string,load:()=>Promise<T>):Promise<T>{
   for(const [k,v] of values)if(v.expires<=now())values.delete(k);
   const cached=values.get(key);
   if(cached){values.delete(key);values.set(key,cached);return cached.value;}
   const running=pending.get(key);if(running)return running;
   if(pending.size>=maxPending)return fail(503,'DEPENDENCY_UNAVAILABLE');
   const epoch=generation;
   const work=Promise.resolve().then(load).then(value=>{
    if(epoch===generation){while(values.size>=max)values.delete(values.keys().next().value!);values.set(key,{expires:now()+ttl,value});}
    return value;
   });
   pending.set(key,work);
   try{return await work;}finally{if(pending.get(key)===work)pending.delete(key);}
  },
  clear(){generation++;values.clear();pending.clear();}
 };
}
