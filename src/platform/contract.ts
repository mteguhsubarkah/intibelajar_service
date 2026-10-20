import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { FastifyRequest } from 'fastify';
import { fail } from './errors.js';
// One source for strict requests and integration response checks: authoritative OpenAPI 3.1.
export const contract = parse(readFileSync(new URL('../../docs/backend-architecture/openapi.yaml', import.meta.url),'utf8'));
const ajv = new (Ajv2020 as unknown as typeof import('ajv').Ajv)({strict:false,allErrors:true,validateFormats:true});
(addFormats as unknown as (a: typeof ajv)=>void)(ajv);
ajv.addSchema({$id:'ib',...contract, $schema:'https://json-schema.org/draft/2020-12/schema'});
const cache=new Map<string, ReturnType<typeof ajv.compile>>();
export function validateSchema(schema: object,value: unknown) {
  const key=JSON.stringify(schema);
  let check=cache.get(key);
  if(!check){check=ajv.compile({...schema,components:contract.components});cache.set(key,check);}
  return check(value);
}
export function validateRequest(path:string,method:string,request:FastifyRequest) {
  const op=contract.paths[path]?.[method.toLowerCase()];
  if(!op) return;
  const schema=op.requestBody?.content?.['application/json']?.schema;
  if(schema && !validateSchema(schema,request.body)) fail(400,'VALIDATION_FAILED');
  if(!schema && request.body!==undefined && !(Buffer.isBuffer(request.body)&&op.requestBody?.content?.[request.headers['content-type']??''])) fail(400,'VALIDATION_FAILED');
  const params=[...(contract.paths[path].parameters??[]),...(op.parameters??[])].map(p=>p.$ref?contract.components.parameters[p.$ref.split('/').pop()]:p);
  // Strict queries: undeclared parameters are rejected like unknown body fields.
  const query=(request.query??{}) as Record<string,unknown>;
  for(const name of Object.keys(query)) if(!params.some(p=>p.in==='query'&&p.name===name)) fail(400,'VALIDATION_FAILED');
  for(const p of params) {
    const source=p.in==='path'?request.params:p.in==='query'?request.query:request.headers;
    let value=(source as Record<string,unknown>)?.[p.in==='header'?p.name.toLowerCase():p.name];
    // Query strings carry text; an integer parameter is coerced only from a canonical decimal.
    if(p.in==='query'&&p.schema?.type==='integer'&&typeof value==='string'&&/^(0|[1-9]\d{0,8})$/.test(value)) query[p.name]=value=Number(value);
    if(value===undefined){if(p.required) fail(400,'VALIDATION_FAILED');}
    else if(!validateSchema(p.schema,value)) fail(400,'VALIDATION_FAILED');
  }
}
export function validateResponse(path:string,method:string,status:number,value:unknown) {
  const op=contract.paths[path]?.[method.toLowerCase()];
  let response=op?.responses?.[String(status)];
  if(response?.$ref) response=contract.components.responses[response.$ref.split('/').pop()];
  // Contract omits some global platform failures on individual operations; Error still applies.
  const schema=response?.content?.['application/json']?.schema ?? (status>=400?{$ref:'#/components/schemas/Error'}:undefined);
  if(schema && !validateSchema(schema,value)) throw new Error(`Contract response failed: ${method} ${path} ${status}`);
  if(!response && status<400) throw new Error(`Undocumented success: ${method} ${path} ${status}`);
}
