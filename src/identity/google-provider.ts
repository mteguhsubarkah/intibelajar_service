import * as oidc from 'openid-client';
import type {Config} from '../config.js';
import {fail,ApiError} from '../platform/errors.js';

export interface GoogleClaims {sub:string;email:string;email_verified:true}
export interface GoogleProvider {
 authorization(state:string,nonce:string,verifier:string):Promise<string>;
 verify(url:URL,state:string,nonce:string,verifier:string):Promise<GoogleClaims>;
}
export function createGoogleProvider(config:Config,http:typeof fetch=fetch):GoogleProvider{
 if(!config.google)fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:['GOOGLE_OIDC_NOT_CONFIGURED']});
 const settings=config.google,redirect=config.origin+'/v1/auth/callback/google';
 let cached:Promise<oidc.Configuration>|undefined;
 const client=()=>cached??=(async()=>{
  try{
   const c=await oidc.discovery(new URL('https://accounts.google.com'),settings.clientId,
    {client_secret:settings.clientSecret,id_token_signed_response_alg:'RS256'},undefined,
    {[oidc.customFetch]:http as oidc.CustomFetch,timeout:10,execute:[oidc.enableNonRepudiationChecks]});
   return c;
  }catch{cached=undefined;fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:['GOOGLE_OIDC_UNAVAILABLE']});}
 })();
 return{
  async authorization(state,nonce,verifier){
   return oidc.buildAuthorizationUrl(await client(),{redirect_uri:redirect,scope:'openid email',response_type:'code',
    state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).href;
  },
  async verify(url,state,nonce,verifier){
   try{
    const tokens=await oidc.authorizationCodeGrant(await client(),url,{expectedState:state,expectedNonce:nonce,pkceCodeVerifier:verifier,idTokenExpected:true});
    const claims=tokens.claims();
    if(!claims||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email.trim()))throw Error();
    if(settings.testEmail && claims.email.trim().toLowerCase()!==settings.testEmail)fail(403,'FORBIDDEN');
    // Access/refresh/ID tokens and email are never persisted or returned to the browser.
    return{sub:claims.sub,email:claims.email.trim().toLowerCase(),email_verified:true};
   }catch(error){if(error instanceof ApiError)throw error;fail(400,'VALIDATION_FAILED');}
  }
 };
}
