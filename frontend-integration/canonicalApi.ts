/** Slice 0 only. Existing learning adapters and guest data remain local. */
export const slice0Enabled = import.meta.env.VITE_SLICE0 === 'true';
export interface AuthState { authenticated:boolean; csrfToken?:string; learner?:{id:string;status:string;missingPurposes:string[]} }
export interface ConsentView {learner:{displayName?:string;grade?:number};purposes:{purpose:string;title:string;description:string}[];policyVersion:string;policyText:string;policyTextSha256:string;expiresAt:string}
export class ApiFailure extends Error {constructor(public code:string,message:string,public retryable:boolean){super(message);}}
let csrf: string | undefined;
export function operationKey(){return crypto.randomUUID();}
export async function canonicalApi<T>(path:string,options:{method?:string;body?:unknown;key?:string;public?:boolean}={}):Promise<T>{
  if(!slice0Enabled)throw new ApiFailure('FEATURE_DISABLED','Integrasi akun development belum diaktifkan.',false);
  if(!path.startsWith('/v1/')||path.includes('://'))throw new Error('Invalid API path');
  const method=options.method??'GET';
  if(method!=='GET'&&!options.public&&!csrf)await readSession();
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{
    ...(method==='GET'?{}:{'Content-Type':'application/json'}),...(csrf&&!options.public?{'X-CSRF-Token':csrf}:{}),
    ...(options.key?{'Idempotency-Key':options.key}:{})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  if(response.status===204)return undefined as T;
  const data=await response.json();
  if(!response.ok){if(response.status===401)csrf=undefined;throw new ApiFailure(data.code??'INTERNAL',data.message??'Permintaan belum dapat diproses.',Boolean(data.retryable));}
  return data as T;
}
export async function readSession(){const state=await canonicalApi<AuthState>('/v1/auth/session');csrf=state.csrfToken;return state;}
export function startSyntheticSignin(provider:'email'|'google',route='/profile',step=0){
  return canonicalApi<{redirectUrl:string}>('/v1/auth/start',{method:'POST',public:true,body:{provider,continuation:{targetPath:route,step}}});
}
