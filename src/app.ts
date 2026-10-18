import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { readConfig, features, integrationBlockers, type Config } from './config.js';
import { connect, type DB } from './db.js';
import { uuid, equal, hash } from './platform/crypto.js';
import { ApiError, fail, messages } from './platform/errors.js';
import { command, type Outcome } from './platform/idempotency.js';
import { validateRequest, validateResponse, contract } from './platform/contract.js';
import { telemetry } from './platform/telemetry.js';
import type { Span } from '@opentelemetry/api';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as identity from './identity/service.js';
import * as privacy from './privacy/service.js';
import {saveMailbox} from './development/mailbox.js';
import {verifyMigrations} from './migrate.js';
import {restoredSubjects} from './privacy/recovery.js';
import {catalogReader} from './catalog/read.js';
import {learningService} from './learning/service.js';

declare module 'fastify' { interface FastifyRequest { principal?: identity.Principal; sessionToken?:string; safeSpan?:Span } }
export async function buildApp(config:Config=readConfig(),options:{db?:DB;logStream?:NodeJS.WritableStream;spanProcessors?:SpanProcessor[]}={}) {
  const db=options.db??connect(config.databaseUrl), mailbox:identity.Mailbox=new Map();
  const traces=telemetry(options.spanProcessors);
  const app=Fastify({bodyLimit:32768,requestTimeout:10000,connectionTimeout:10000,trustProxy:false,
    disableRequestLogging:true,genReqId:()=>uuid(),logger:{level:'info',
      redact:{paths:['req','res','err','body','headers','email','guardianEmail','token','cookie','authorization','password','displayName'],remove:true},
      serializers:{req:()=>({}),res:()=>({}),err:()=>({type:'Error',message:'Request failed',stack:''})},...(options.logStream?{stream:options.logStream}:{})}});
  app.addHook('onClose',async()=>{mailbox.clear();await traces.close();if(!options.db)await db.destroy();});
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json',{parseAs:'string'},(_req,body,done)=>{
    try {done(null,String(body).trim()?JSON.parse(String(body)):undefined);} catch {done(new ApiError(400,'VALIDATION_FAILED'));}
  });
  const limits=new Map<string,{count:number;until:number}>();
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer')
      .header('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; object-src 'none'")
      .header('X-Frame-Options','DENY');
    // Never trust or log raw URLs, incoming request IDs, headers, or body.
    const raw=req.headers.cookie?.split(';').map(s=>s.trim()).filter(s=>s.startsWith(identity.cookieName+'='));
    req.sessionToken=raw?.length===1?raw[0]!.slice(identity.cookieName.length+1):undefined;
    const route=req.routeOptions.url??'unmatched';
    req.safeSpan=traces.tracer.startSpan(req.method+' '+route,{attributes:{'http.request.method':req.method,'http.route':route,'request.id':req.id}});
    if(route.startsWith('/v1/')&&(await restoredSubjects(db,config)).length)fail(503,'DEPENDENCY_UNAVAILABLE');
    if(route.startsWith('/v1/auth/')||route.startsWith('/v1/guardian-consents/')) {
      const key=req.ip+':'+route, time=Date.now();
      if(limits.size>10000) for(const[k,v]of limits)if(v.until<=time)limits.delete(k);
      if(limits.size>=10000&&!limits.has(key))fail(429,'RATE_LIMITED');
      const authCommand=req.method==='POST'&&route.startsWith('/v1/auth/')&&route!=='/v1/auth/logout';
      const state=limits.get(key);const next=!state||state.until<=time?{count:0,until:time+(authCommand?3600000:60000)}:state;
      next.count++;limits.set(key,next);if(next.count>(authCommand?20:60))fail(429,'RATE_LIMITED');
    }
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if(req.headers.origin!==config.origin || (req.headers['sec-fetch-site']!==undefined&&req.headers['sec-fetch-site']!=='same-origin')) fail(403,'CSRF_FAILED');
      if(req.headers['content-type']?.split(';')[0]?.trim()!=='application/json') fail(415,'UNSUPPORTED_MEDIA_TYPE');
    }
    if(req.method==='OPTIONS') fail(403,'CSRF_FAILED');
  });
  app.addHook('onResponse',async(req,reply)=>{
    req.safeSpan?.setAttribute('http.response.status_code',reply.statusCode);req.safeSpan?.end();
    app.log.info({requestId:req.id,route:req.routeOptions.url??'unmatched',method:req.method,status:reply.statusCode,durationMs:reply.elapsedTime},'request');
  });
  app.setErrorHandler((error,req,reply)=>{
    const e=error as Error & {code?:string;statusCode?:number};
    let status=error instanceof ApiError?error.status:500,code=error instanceof ApiError?error.code:'INTERNAL';
    if(e.code==='FST_ERR_CTP_BODY_TOO_LARGE'){status=413;code='PAYLOAD_TOO_LARGE';}
    else if(e.code==='FST_ERR_CTP_INVALID_MEDIA_TYPE'){status=415;code='UNSUPPORTED_MEDIA_TYPE';}
    else if(e.code==='FST_ERR_CTP_INVALID_JSON_BODY'||e.code==='FST_ERR_CTP_EMPTY_JSON_BODY'||e instanceof SyntaxError){status=400;code='VALIDATION_FAILED';}
    else if(!(error instanceof ApiError)&& (e.code?.startsWith('08')||['ECONNREFUSED','ECONNRESET','57P01','57P02','57P03','53300'].includes(e.code??''))){status=503;code='DEPENDENCY_UNAVAILABLE';}
    if([429,503].includes(status)||code==='IDEMPOTENCY_IN_PROGRESS')reply.header('Retry-After','1');
    const body={code,message:messages[code]??'Permintaan belum dapat diproses.',requestId:req.id,retryable:status>=500||status===429||code==='IDEMPOTENCY_IN_PROGRESS',
      ...(error instanceof ApiError&&error.details?{details:error.details}:{})};
    reply.status(status).send(body);
  });
  app.setNotFoundHandler(()=>fail(404,'NOT_FOUND'));
  type Handler=(req:FastifyRequest,reply:FastifyReply)=>Promise<unknown>;
  // Operations of later slices fail closed before any request validation.
  const disabled=new Set(['POST /v1/learning-sessions/{sessionId}/solution','GET /v1/learning-sessions/{sessionId}/solution','POST /v1/attempts/{attemptId}/diagnosis','POST /v1/diagnosis-runs/{diagnosisRunId}/reports']);
  const route=(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,access:'public'|'student'|'guardian'|'session',handler:Handler)=>{
    app.route({method,url:path.replace(/\{(\w+)\}/g,':$1'),preValidation:async(req)=>{
      if(access!=='public'){
        req.principal=await identity.authenticate(db,config,req.sessionToken);
        if(!req.principal)fail(401,'UNAUTHENTICATED');
        if(access==='student'&&req.principal.role!=='STUDENT'||access==='guardian'&&req.principal.role!=='GUARDIAN')fail(403,'FORBIDDEN');
        if(method!=='GET'&&!equal(hash(String(req.headers['x-csrf-token']??'')),hash(req.principal.csrf)))fail(403,'CSRF_FAILED');
      }
      if(path.startsWith('/v1/learning/')||path==='/v1/public/evaluations'||disabled.has(method+' '+path))fail(403,'FEATURE_DISABLED');
      validateRequest(path,method,req);
    },handler:async(req,reply)=>{
      const result=await handler(req,reply);
      if(reply.sent)return result;
      if(reply.statusCode!==204)validateResponse(path,method,reply.statusCode,result);
      return result;
    }});
  };
  const send=(reply:FastifyReply,outcome:Outcome)=>{reply.status(outcome.status);if(outcome.replayed)reply.header('Idempotency-Replayed','true');return outcome.body;};
  const key=(req:FastifyRequest)=>req.headers['idempotency-key'] as string|undefined;
  const learnerTransaction=<T,>(req:FastifyRequest,run:(tx:import('./db.js').Tx)=>Promise<T>)=>db.transaction().execute(tx=>privacy.authorizeMutation(tx,req.principal!,()=>run(tx)));
  const learnerCommand=(req:FastifyRequest,operation:string,payload:unknown,run:(tx:import('./db.js').Tx)=>Promise<Outcome>)=>
    db.transaction().execute(tx=>command(tx,'LEARNER',req.principal!.learnerId!,operation,key(req),payload,
      ()=>privacy.authorizeMutation(tx,req.principal!,()=>run(tx))));
  const params=(req:FastifyRequest)=>req.params as Record<string,string>;
  const blocked=()=>fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:[...integrationBlockers]});
  app.get('/health/live',async()=>({status:'ok'}));
  app.get('/health/ready',async()=>{
    try {
    const result=await sql<{version:number}>`select current_setting('server_version_num')::int as version`.execute(db);
    const tables=await sql<{count:string}>`select count(*) from information_schema.tables where table_schema='public' and table_name in
      ('learner','guardian','app_user','auth_identity','auth_session','auth_transaction','student_profile','consent_record','deletion_request','erasure_receipt','audit_event','idempotency_record','job')`.execute(db);
    if(result.rows[0]!.version<160000||tables.rows[0]!.count!=='13'||!await verifyMigrations(db)||(await restoredSubjects(db,config)).length)fail(503,'DEPENDENCY_UNAVAILABLE');
    return {status:'ready',environment:config.mode,syntheticOnly:true,features,blockers:integrationBlockers};
    }catch{fail(503,'DEPENDENCY_UNAVAILABLE');}
  });
  route('GET','/v1/auth/session','public',async req=>{
    const p=await identity.authenticate(db,config,req.sessionToken);if(!p)return {authenticated:false};
    const learner=p.learnerId?await privacy.profile(db,p.learnerId):undefined;
    const c=p.learnerId?await privacy.consents(db,p.learnerId):undefined;
    return {authenticated:true,csrfToken:p.csrf,user:{id:p.userId,role:p.role},...(learner?{learner:{id:learner.learnerId,status:learner.status,ageBand:learner.ageBand,
      missingPurposes:c!.items.find(i=>i.purpose==='LEARNING_DATA')?.status==='GRANTED'?[]:['LEARNING_DATA'],...('consentDeadlineAt'in learner?{consentDeadlineAt:learner.consentDeadlineAt}:{})}}:{})};
  });
  route('POST','/v1/auth/start','public',async(req,reply)=>{
    const b=req.body as {provider:string;continuation:{targetPath:string;step:number}};
    if(!privacyRoute(b.continuation.targetPath))fail(400,'VALIDATION_FAILED');
    if(b.provider!=='email')blocked();
    const result=await db.transaction().execute(tx=>identity.startEmail(tx,config,{route:b.continuation.targetPath,step:b.continuation.step}));
    reply.header('Set-Cookie',identity.cookie(result.session.raw,config.absoluteSeconds));
    return {redirectUrl:config.origin+'/auth/email?transaction='+encodeURIComponent(result.transaction)};
  });
  route('GET','/v1/auth/callback/{provider}','public',async()=>blocked());
  route('POST','/v1/auth/email/links','public',async(req,reply)=>{
    const b=req.body as {email:string;transaction:string};
    const addressKey='email:'+hash(b.email.trim().toLowerCase()).toString('hex'),time=Date.now();
    const state=limits.get(addressKey),next=!state||state.until<=time?{count:0,until:time+3600000}:state;
    next.count++;limits.set(addressKey,next);if(next.count>5)fail(429,'RATE_LIMITED');
    const sent=await db.transaction().execute(tx=>identity.sendEmail(tx,config,req.sessionToken,b.transaction,b.email));
    if(sent){identity.deliver(mailbox,sent.address,{kind:'signin',token:sent.link});saveMailbox(config,mailbox);}
    reply.status(202);return {accepted:true};
  });
  // Accepted is 202, even for unknown/expired transactions; account enumeration stays impossible.
  route('POST','/v1/auth/email/verify','public',async(req,reply)=>{
    const result=await db.transaction().execute(tx=>identity.consumeEmail(tx,config,req.sessionToken,(req.body as {token:string}).token));
    reply.header('Set-Cookie',identity.cookie(result.session.raw,config.absoluteSeconds));return {continuation:result.continuation};
  });
  route('POST','/v1/auth/logout','session',async(req,reply)=>{
    await identity.logout(db,req.principal!,(req.query as {scope?:string}).scope==='all');
    reply.header('Set-Cookie',identity.cookie('',0));reply.status(204);return undefined;
  });
  route('GET','/v1/me/profile','student',async req=>privacy.profile(db,req.principal!.learnerId!));
  route('PATCH','/v1/me/profile','student',async req=>learnerTransaction(req,tx=>privacy.updateProfile(tx,req.principal!.learnerId!,req.body as privacy.ProfilePatch)));
  route('GET','/v1/me/consents','student',async req=>privacy.consents(db,req.principal!.learnerId!));
  route('POST','/v1/me/consent-requests','student',async(req,reply)=>{
    const p=req.principal!,b=req.body as {guardianEmail:string;purposes:string[]};
    let delivery:{address:string;link:string}|undefined;
    const out=await learnerCommand(req,'POST /v1/me/consent-requests',b,async tx=>{
      const created=await privacy.requestConsent(tx,config,p.learnerId!,b.guardianEmail,b.purposes);delivery=created;return {status:201,body:created.body};
    });
    if(delivery){identity.deliver(mailbox,delivery.address,{kind:'consent',token:delivery.link});saveMailbox(config,mailbox);}
    return send(reply,out);
  });
  route('GET','/v1/guardian-consents/{token}','public',async req=>{identity.requireSynthetic(config);return privacy.consentView(db,params(req).token!);});
  route('POST','/v1/guardian-consents/{token}/decision','public',async(req,reply)=>{
    identity.requireSynthetic(config);const link=params(req).token!,rows=await privacy.tokenRecords(db,link),first=rows[0]!;
    const out=await db.transaction().execute(tx=>command(tx,'GUARDIAN',first.guardian_id,'POST guardian-decision:'+first.learner_id+':'+hash(link).toString('hex'),key(req),req.body,
      async()=>({status:200,body:await privacy.decide(tx,config,link,req.body as privacy.Decision)})));
    return send(reply,out);
  });
  route('POST','/v1/me/consents/{purpose}/revocation','student',async(req,reply)=>{
    const p=req.principal!,purpose=params(req).purpose!;
    return send(reply,await learnerCommand(req,'POST my-revocation:'+purpose,null,
      async tx=>({status:200,body:await privacy.revoke(tx,config,p.learnerId!,purpose)})));
  });
  route('DELETE','/v1/me','student',async(req,reply)=>{
    const body=await learnerTransaction(req,tx=>privacy.deletion(tx,config,req.principal!.learnerId!));reply.status(202);return body;
  });
  route('GET','/v1/guardian/learners','guardian',async req=>privacy.guardianLearners(db,req.principal!.guardianId!));
  route('POST','/v1/guardian/learners/{learnerId}/consents/{purpose}/revocation','guardian',async(req,reply)=>{
    const p=req.principal!,{learnerId:id,purpose}=params(req);
    return send(reply,await db.transaction().execute(async tx=>{
      await privacy.linked(tx,p.guardianId!,id!);
      return command(tx,'GUARDIAN',p.guardianId!,'POST guardian-revocation:'+id+':'+purpose,key(req),null,
        async()=>({status:200,body:await privacy.revoke(tx,config,id!,purpose!,p.guardianId!)}));
    }));
  });
  route('POST','/v1/guardian/learners/{learnerId}/deletion-requests','guardian',async(req,reply)=>{
    const p=req.principal!,id=params(req).learnerId!;
    return send(reply,await db.transaction().execute(async tx=>{
      await privacy.linked(tx,p.guardianId!,id);
      return command(tx,'GUARDIAN',p.guardianId!,'POST guardian-deletion:'+id,key(req),null,async()=>({status:202,body:await privacy.deletion(tx,config,id,'GUARDIAN')}));
    }));
  });
  // Learning sessions (Slice 1 M6): PRACTICE only. Commands are idempotent, consent-gated and versioned (04 §7).
  const learning=learningService(config.key);
  const learnerId=(req:FastifyRequest)=>req.principal!.learnerId!;
  const learnLimit=(req:FastifyRequest)=>{
    const key='learn:'+learnerId(req),time=Date.now(),state=limits.get(key);
    const next=!state||state.until<=time?{count:0,until:time+60000}:state;next.count++;limits.set(key,next);
    if(next.count>120)fail(429,'RATE_LIMITED');
  };
  const sessionCommand=(name:string,run:(tx:import('./db.js').Tx,req:FastifyRequest)=>Promise<Outcome>)=>async(req:FastifyRequest,reply:FastifyReply)=>{
    learnLimit(req);
    return send(reply,await learnerCommand(req,`POST ${name}:${params(req).sessionId}`,req.body,tx=>run(tx,req)));
  };
  type Body<T>=T;
  route('POST','/v1/learning-sessions','student',async(req,reply)=>{learnLimit(req);
    return send(reply,await learnerCommand(req,'POST /v1/learning-sessions',req.body,tx=>learning.create(tx,learnerId(req),req.body as Body<Parameters<typeof learning.create>[2]>)));});
  route('GET','/v1/learning-sessions','student',async req=>{const q=req.query as {status?:'active'|'completed'|'all';cursor?:string;limit?:number};
    return learning.list(db,learnerId(req),q.status??'all',q.cursor,q.limit??20);});
  route('GET','/v1/learning-sessions/{sessionId}','student',async req=>learning.get(db,learnerId(req),params(req).sessionId!));
  route('POST','/v1/learning-sessions/{sessionId}/attempts','student',sessionCommand('attempts',(tx,req)=>learning.submitAttempt(tx,learnerId(req),params(req).sessionId!,req.body as Body<Parameters<typeof learning.submitAttempt>[3]>)));
  route('POST','/v1/learning-sessions/{sessionId}/quick-check-answers','student',sessionCommand('quick-check-answers',(tx,req)=>learning.answerQuickCheck(tx,learnerId(req),params(req).sessionId!,req.body as Body<Parameters<typeof learning.answerQuickCheck>[3]>)));
  route('POST','/v1/learning-sessions/{sessionId}/actions','student',sessionCommand('actions',(tx,req)=>learning.action(tx,learnerId(req),params(req).sessionId!,req.body as Body<Parameters<typeof learning.action>[3]>)));
  route('POST','/v1/learning-sessions/{sessionId}/hints','student',sessionCommand('hints',(tx,req)=>learning.hint(tx,learnerId(req),params(req).sessionId!,req.body as {step:number})));
  route('PUT','/v1/learning-sessions/{sessionId}/checkpoint','student',async(req,reply)=>{learnLimit(req);
    await learnerTransaction(req,tx=>learning.checkpoint(tx,learnerId(req),params(req).sessionId!,req.body as {route:string;sessionId?:string}));
    return reply.code(204).send();});
  route('GET','/v1/attempts/{attemptId}','student',async req=>learning.attempt(db,learnerId(req),params(req).attemptId!));
  route('GET','/v1/diagnosis-runs/{diagnosisRunId}','student',async req=>learning.diagnosisRun(db,learnerId(req),params(req).diagnosisRunId!));
  // Question-loop operations arrive with Slice 2; until then they fail closed.
  for(const operation of disabled){const [method,path]=operation.split(' ') as ['GET'|'POST',string];route(method,path,'student',async()=>fail(403,'FEATURE_DISABLED'));}
  // Public catalog (Slice 1 M3): current release only, never rubrics or keys (INV-05).
  const catalog=catalogReader(config.key);
  const query=(req:FastifyRequest)=>req.query as Record<string,string|undefined>;
  const revalidated=(req:FastifyRequest,reply:FastifyReply,{etag,body}:{etag:string;body:unknown})=>{
    reply.header('ETag',etag).header('Cache-Control','public, max-age=60');
    const tags=String(req.headers['if-none-match']??'').split(',').map(t=>t.trim().replace(/^W\//,''));
    if(tags.includes(etag)||tags.includes('*'))return reply.code(304).send();
    return body;
  };
  route('GET','/v1/subjects','public',async(req,reply)=>revalidated(req,reply,await catalog.subjects(db)));
  route('GET','/v1/topics','public',async(req,reply)=>revalidated(req,reply,await catalog.topics(db,query(req).subjectCode)));
  route('GET','/v1/topics/{topicId}','public',async(req,reply)=>revalidated(req,reply,await catalog.topic(db,params(req).topicId!)));
  route('GET','/v1/concepts','public',async req=>catalog.concepts(db,{topicId:query(req).topicId,legacyMapId:query(req).legacyMapId}));
  route('GET','/v1/concepts/{conceptId}','public',async req=>catalog.concept(db,params(req).conceptId!));
  route('GET','/v1/questions','public',async req=>{
    const q=query(req),filter=Object.fromEntries(Object.entries({topicId:q.topicId,conceptId:q.conceptId,itemType:q.itemType}).filter(([,v])=>v!==undefined));
    return catalog.questions(db,filter,q.cursor,(req.query as {limit?:number}).limit??20);
  });
  route('GET','/v1/questions/{questionId}','public',async req=>catalog.question(db,params(req).questionId!));
  route('GET','/v1/lessons/{lessonId}','public',async req=>catalog.lesson(db,params(req).lessonId!));
  // No learning endpoints exist in Slice 0. Legacy learning routes fail closed.
  for(const [path,operations]of Object.entries(contract.paths) as [string,Record<string,unknown>][]) {
    if(!path.startsWith('/v1/learning/')&&path!=='/v1/public/evaluations')continue;
    for(const method of Object.keys(operations))if(['get','post'].includes(method))route(method.toUpperCase() as 'GET'|'POST',path,'public',async()=>fail(403,'FEATURE_DISABLED'));
  }
  return {app,db,mailbox,config};
}
export function privacyRoute(route:string) {
  return /^(?:\/(?:|coba|soal-tadi|kenalan|tanya|challenge|latihan\/soal|home|pick|latihan|progress|profile|diagnosis|mastery)|\/core\/[a-z0-9-]{1,64})$/.test(route);
}
