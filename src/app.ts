import {guideReply,type GuideInput} from './tutor/context-guide.js';
import {claimTrial} from './learning/trial-claim.js';
import {readTrialProof} from './assessment/trial-proof.js';
import { registerTrialRoutes } from './platform/trial-routes.js';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { readConfig, integrationBlockers, type Config } from './config.js';
import { connect, type DB } from './db.js';
import { uuid, equal, hash, stable } from './platform/crypto.js';
import { ApiError, fail, messages } from './platform/errors.js';
import { command, remember, type Outcome } from './platform/idempotency.js';
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
import {legacyFacade,consentFirst,type LegacyCheck} from './learning/facade.js';
import {legacyLoopFacade,legacyRun,type LegacyContext,type LegacyDiagnosisRequest} from './learning/facade-loop.js';
import {legacyIntakeMap} from './catalog/intake-map.js';
import {currentRelease} from './catalog/interface.js';
import type {DiagnosisEngine} from './assessment/diagnosis.js';
import {fileReport,type ReportReason} from './assessment/disputes.js';
import {registerApiDocs} from './platform/api-docs.js';
import {createGoogleProvider,type GoogleProvider} from './identity/google-provider.js';
import {startGoogle,finishGoogle} from './identity/google.js';
import {rebuildProgress,progressEvents,progressPage,recordDeviceHistory} from './progress/service.js';
import {importDevice,type DeviceHistory}from'./learning/device-import.js';
import{openTutor,tutorConversation,sendTutor,tutorMessage}from'./tutor/service.js';
import{createIntake,intakeView,uploadIntake,discardIntake,confirmIntake}from'./intake/service.js';import{ocrConfiguration}from'./intake/openrouter-ocr.js';
import{privateQuestionView}from'./catalog/intake-interface.js';

declare module 'fastify' { interface FastifyRequest { principal?: identity.Principal; sessionToken?:string; safeSpan?:Span } }
export async function buildApp(config:Config=readConfig(),options:{db?:DB;logStream?:NodeJS.WritableStream;spanProcessors?:SpanProcessor[];diagnosisEngine?:DiagnosisEngine;googleProvider?:GoogleProvider}={}) {
  if(options.googleProvider&&config.mode!=='test')throw new Error('A fake Google provider is test-only');
  let google:GoogleProvider|undefined=options.googleProvider;
  const googleProvider=()=>google??=createGoogleProvider(config);
  // Plan 05 D4: a queued diagnosis engine exists only as a test fake, passed in code. No request, header or setting selects it.
  if(options.diagnosisEngine && !(config.mode==='test' && options.diagnosisEngine.testOnly===true)
    && !(config.mode==='development' && config.synthetic && new URL(config.databaseUrl).pathname==='/intibelajar_local_dev' && options.diagnosisEngine.syntheticOnly===true))
    throw new Error('A diagnosis engine requires tests or the isolated synthetic development database');
  const db=options.db??connect(config.databaseUrl), mailbox:identity.Mailbox=new Map();
  const ocr=ocrConfiguration();
  const traces=telemetry(options.spanProcessors);
  // Pilot: only the local Nginx is trusted, so req.ip is the client (per-IP rate limits) and req.protocol its scheme.
  const app=Fastify({bodyLimit:32768,requestTimeout:10000,connectionTimeout:10000,trustProxy:config.trustProxy,
    disableRequestLogging:true,genReqId:()=>uuid(),logger:{level:'info',
      redact:{paths:['req','res','err','body','headers','email','guardianEmail','token','cookie','authorization','password','displayName'],remove:true},
      serializers:{req:()=>({}),res:()=>({}),err:()=>({type:'Error',message:'Request failed',stack:''})},...(options.logStream?{stream:options.logStream}:{})}});
  app.addHook('onClose',async()=>{mailbox.clear();await traces.close();if(!options.db)await db.destroy();});
  app.removeContentTypeParser('application/json');
  for(const mime of['image/jpeg','image/png','image/webp'])app.addContentTypeParser(mime,{parseAs:'buffer',bodyLimit:5242880},(_req,body,done)=>done(null,body));
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
      // Pilot: a write must arrive over https at Nginx; the Origin check below stays exact.
      if(config.mode==='pilot'&&req.protocol!=='https') fail(403,'CSRF_FAILED');
      if(req.headers.origin!==config.origin || (req.headers['sec-fetch-site']!==undefined&&req.headers['sec-fetch-site']!=='same-origin')) fail(403,'CSRF_FAILED');
      const imageUpload=req.method==='PUT'&&route==='/v1/question-intakes/:intakeId/image'&&['image/jpeg','image/png','image/webp'].includes(req.headers['content-type']??'');
      if(!imageUpload&&req.headers['content-type']?.split(';')[0]?.trim()!=='application/json') fail(415,'UNSUPPORTED_MEDIA_TYPE');
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
  // Legacy calls the facade serves when FEATURE_LEGACY_FACADE is on (09 §6.2). L6 (tutor, D6) and L7 (image) stay closed.
  const FACADE=new Set(['POST /v1/learning/tutor','POST /v1/learning/answers/check','POST /v1/learning/diagnosis','GET /v1/learning/diagnosis/{diagnosisRunId}','POST /v1/learning/solution','POST /v1/learning/intake/map']);
  // Operations of later slices fail closed before any request validation.
  const disabled=new Set<string>();
  const route=(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,access:'public'|'student'|'guardian'|'session',handler:Handler)=>{
    app.route({method,url:path.replace(/\{(\w+)\}/g,':$1'),...(path==='/v1/question-intakes/{intakeId}/image'?{bodyLimit:5242880}:{}),preValidation:async(req)=>{
      if(access!=='public'){
        req.principal=await identity.authenticate(db,config,req.sessionToken);
        if(!req.principal)fail(401,'UNAUTHENTICATED');
        if(access==='student'&&req.principal.role!=='STUDENT'||access==='guardian'&&req.principal.role!=='GUARDIAN')fail(403,'FORBIDDEN');
        if(method!=='GET'&&!equal(hash(String(req.headers['x-csrf-token']??'')),hash(req.principal.csrf)))fail(403,'CSRF_FAILED');
      }
      const facadeOn=config.features.legacyFacade&&FACADE.has(method+' '+path);
      if((path.startsWith('/v1/learning/')&&!facadeOn)||path==='/v1/public/evaluations'||disabled.has(method+' '+path))fail(403,'FEATURE_DISABLED');
      validateRequest(path,method,req);
    },handler:async(req,reply)=>{
      const result=await handler(req,reply);
      if(reply.sent)return result;
      if(reply.statusCode!==204)validateResponse(path,method,reply.statusCode,result);
      return result;
    }});
  };
  // 09 §1: every 201 names the created resource in Location. It is derived from the stored body, so a replay repeats it.
  type Locate=(body:any)=>string;
  const send=(reply:FastifyReply,outcome:Outcome,locate?:Locate)=>{reply.status(outcome.status);if(outcome.replayed)reply.header('Idempotency-Replayed','true');
    if(outcome.status===201){if(!locate)throw new Error('a 201 response needs a Location');reply.header('Location',locate(outcome.body));}
    return outcome.body;};
  const at={session:(b:{id:string})=>'/v1/learning-sessions/'+b.id,attempt:(b:{attempt:{id:string}})=>'/v1/attempts/'+b.attempt.id,
    run:(b:{id:string})=>'/v1/diagnosis-runs/'+b.id,consents:()=>'/v1/me/consents',
    // A report has no resource of its own; the run it disputes shows it (DiagnosisRun.report).
    reportedRun:(b:{diagnosisRunId:string})=>'/v1/diagnosis-runs/'+b.diagnosisRunId} satisfies Record<string,Locate>;
  const key=(req:FastifyRequest)=>req.headers['idempotency-key'] as string|undefined;
  const learnerTransaction=<T,>(req:FastifyRequest,run:(tx:import('./db.js').Tx)=>Promise<T>)=>db.transaction().execute(tx=>privacy.authorizeMutation(tx,req.principal!,()=>run(tx)));
  const learnerCommand=(req:FastifyRequest,operation:string,payload:unknown,run:(tx:import('./db.js').Tx)=>Promise<Outcome>)=>
    db.transaction().execute(tx=>command(tx,'LEARNER',req.principal!.learnerId!,operation,key(req),payload,
      ()=>privacy.authorizeMutation(tx,req.principal!,async()=>{const result=await run(tx);
        if(await privacy.hasConsent(tx,req.principal!.learnerId!,'LEARNING_DATA')){
          const p=await privacy.profile(tx,req.principal!.learnerId!);await rebuildProgress(tx,req.principal!.learnerId!,p.timezone);
        }return result;})));
  const params=(req:FastifyRequest)=>req.params as Record<string,string>;
  const blocked=()=>fail(503,'DEPENDENCY_UNAVAILABLE',{blockers:[...integrationBlockers]});
  registerApiDocs(app);
  app.get('/health/live',async()=>({status:'ok'}));
  app.get('/health/ready',async()=>{
    try {
    const result=await sql<{version:number}>`select current_setting('server_version_num')::int as version`.execute(db);
    const tables=await sql<{count:string}>`select count(*) from information_schema.tables where table_schema='public' and table_name in
      ('learner','guardian','app_user','auth_identity','auth_session','auth_transaction','student_profile','consent_record','deletion_request','erasure_receipt','audit_event','idempotency_record','job')`.execute(db);
    if(result.rows[0]!.version<160000||tables.rows[0]!.count!=='13'||!await verifyMigrations(db)||(await restoredSubjects(db,config)).length)fail(503,'DEPENDENCY_UNAVAILABLE');
    return {status:'ready',environment:config.mode,syntheticOnly:config.mode!=='pilot',features:config.features,blockers:integrationBlockers.filter(b=>(!config.google||b!=='GOOGLE_OIDC_NOT_CONFIGURED')&&(!config.email||b!=='EMAIL_DELIVERY_NOT_CONFIGURED'))};
    }catch{fail(503,'DEPENDENCY_UNAVAILABLE');}
  });
  route('GET','/v1/auth/session','public',async req=>{
    const p=await identity.authenticate(db,config,req.sessionToken);if(!p)return {authenticated:false};
    const learner=p.learnerId?await privacy.profile(db,p.learnerId):undefined;
    // Authentication remains true before consent. Eligibility must use the same
    // expiry/policy-version predicate as protected learning endpoints.
    const learningConsent=p.learnerId?await privacy.hasConsent(db,p.learnerId,'LEARNING_DATA'):false;
    return {authenticated:true,csrfToken:p.csrf,...(await identity.isTrial(db,p.userId)?{guest:true}:{}),user:{id:p.userId,role:p.role},...(learner?{learner:{id:learner.learnerId,status:learner.status,ageBand:learner.ageBand,
      missingPurposes:learningConsent?[]:['LEARNING_DATA'],...('consentDeadlineAt'in learner?{consentDeadlineAt:learner.consentDeadlineAt}:{})}}:{})};
  });
  // /coba for everyone (FEATURE_GUEST_TRIAL): a visitor without a session gets a 24-hour trial account, so the server grades
  // their answers exactly as for a learner (rules, DeepSeek, retry, solution, tutor). A signed-in user or an existing
  // trial is left as it is. Origin checks and the /v1/auth/* rate limit (20 per hour per IP) apply as for every auth call.
  route('POST','/v1/auth/guest','public',async(req,reply)=>{
    if(!config.features.guestTrial)fail(403,'FEATURE_DISABLED');
    const current=await identity.authenticate(db,config,req.sessionToken);
    if(current)return {guest:await identity.isTrial(db,current.userId)};
    const session=await db.transaction().execute(async tx=>identity.startTrial(tx,config,await privacy.createTrialLearner(tx,config),privacy.trialHours));
    reply.header('Set-Cookie',identity.cookie(session.raw,privacy.trialHours*3600));
    return {guest:true};
  });
  route('POST','/v1/auth/start','public',async(req,reply)=>{
    const b=req.body as {provider:string;continuation:{targetPath:string;step:number}};
    if(!privacyRoute(b.continuation.targetPath))fail(400,'VALIDATION_FAILED');
    if(b.provider==='google'){
      const result=await startGoogle(db,config,googleProvider(),{route:b.continuation.targetPath,step:b.continuation.step});
      reply.header('Set-Cookie',identity.cookie(result.session.raw,config.absoluteSeconds));return {redirectUrl:result.redirectUrl};
    }
    const result=await db.transaction().execute(tx=>identity.startEmail(tx,config,{route:b.continuation.targetPath,step:b.continuation.step}));
    reply.header('Set-Cookie',identity.cookie(result.session.raw,config.absoluteSeconds));
    return {redirectUrl:config.origin+'/auth/email?transaction='+encodeURIComponent(result.transaction)};
  });
  route('GET','/v1/auth/callback/{provider}','public',async(req,reply)=>{
    const result=await finishGoogle(db,config,googleProvider(),req.sessionToken,req.query as {state:string;code?:string;error?:string});
    if(!privacyRoute(result.continuation.route.split('?')[0]!))fail(400,'VALIDATION_FAILED');
    if(!result.cancelled)reply.header('Set-Cookie',identity.cookie(result.session.raw,config.absoluteSeconds));
    else reply.header('Set-Cookie',identity.cookie('',0));
    return reply.redirect(result.continuation.route,302);
  });
  route('POST','/v1/auth/email/links','public',async(req,reply)=>{
    const b=req.body as {email:string;transaction:string};
    const addressKey='email:'+hash(b.email.trim().toLowerCase()).toString('hex'),time=Date.now();
    const state=limits.get(addressKey),next=!state||state.until<=time?{count:0,until:time+3600000}:state;
    next.count++;limits.set(addressKey,next);if(next.count>5)fail(429,'RATE_LIMITED');
    const sent=await db.transaction().execute(tx=>identity.sendEmail(tx,config,req.sessionToken,b.transaction,b.email));
    // A real address was queued in that transaction (email_outbox, sent by the worker); only .invalid goes to the synthetic mailbox.
    if(sent&&!identity.deliveredForReal(config,sent.address)){identity.deliver(mailbox,sent.address,{kind:'signin',token:sent.link});saveMailbox(config,mailbox);}
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
  route('POST','/v1/me/device-imports','student',async(req,reply)=>send(reply,await learnerCommand(req,'POST /v1/me/device-imports',req.body,async tx=>{
    await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);const id=await importDevice(tx,req.principal!.learnerId!,req.body as DeviceHistory);
    const session=await learningService(config.key).get(tx,req.principal!.learnerId!,id);await recordDeviceHistory(tx,req.principal!.learnerId!,id,session.focusConceptId,(req.body as DeviceHistory).furthestStep);
    return{status:201,body:{session}};
  }),b=>'/v1/learning-sessions/'+b.session.id));
  const projected=(req:FastifyRequest)=>learnerTransaction(req,async tx=>{
    const id=req.principal!.learnerId!;await privacy.requireConsent(tx,id,['LEARNING_DATA']);const p=await privacy.profile(tx,id);
    return{projection:await rebuildProgress(tx,id,p.timezone),profile:p,events:await progressEvents(tx,id)};
  });
  route('GET','/v1/me/progress','student',async req=>{const{projection:p,profile,events}=await projected(req);
    return{user:{id:req.principal!.userId,displayName:profile.displayName??'Pelajar'},cores:p.views.filter(v=>v.legacyMapId).map(v=>({id:v.legacyMapId,exploration:v.exploration,
      understandingDemonstrated:(p.evidence.filter(e=>e.concept_id===v.conceptId && e.mastery_eligible).sort((a,b)=>new Date(p.attempts.get(b.attempt_id)!.submitted_at).getTime()-new Date(p.attempts.get(a.attempt_id)!.submitted_at).getTime())[0]?.classification==='UNDERSTANDING_DEMONSTRATED'),mastery:v.uiTier<1?'NOT_ASSESSED':v.status,lessonComplete:v.lessonComplete,transferCorrect:v.transferCorrectTotal,...(v.lastPracticedAt?{lastPracticedAt:v.lastPracticedAt}:{})})),activities:events.slice(0,20).map(e=>({id:e.id,title:e.title,at:e.occurredAt})),xp:p.stats.xpTotal,streakDays:p.stats.currentStreakDays};});
  route('GET','/v1/me/stats','student',async req=>(await projected(req)).projection.stats);
  route('GET','/v1/me/mastery','student',async req=>{const{projection:p}=await projected(req),q=req.query as{topicId?:string;cursor?:string;limit?:number};
    return progressPage(p.views.filter(v=>!q.topicId||p.catalog.concepts.find(c=>c.id===v.conceptId)?.topic_id===q.topicId),q.cursor,q.limit??20,config.key,'mastery:'+req.principal!.learnerId+':'+(q.topicId??''));});
  route('GET','/v1/me/mastery/{conceptId}','student',async req=>{const{projection:p}=await projected(req),id=params(req).conceptId!;const mastery=p.views.find(v=>v.conceptId===id);if(!mastery)fail(404,'NOT_FOUND');
    return{mastery,recentEvidence:p.evidence.filter(e=>e.concept_id===id).sort((a,b)=>new Date(p.attempts.get(b.attempt_id)!.submitted_at).getTime()-new Date(p.attempts.get(a.attempt_id)!.submitted_at).getTime()).slice(0,20).map(e=>({attemptId:e.attempt_id,diagnosisRunId:e.diagnosis_run_id,classification:e.classification,source:e.source,masteryEligible:e.mastery_eligible,transferEligible:e.transfer_eligible,submittedAt:new Date(p.attempts.get(e.attempt_id)!.submitted_at).toISOString()}))};});
  route('GET','/v1/me/progress-events','student',async req=>{const{events}=await projected(req),q=req.query as{cursor?:string;limit?:number};return progressPage(events,q.cursor,q.limit??20,config.key,'events:'+req.principal!.learnerId);});
  route('PATCH','/v1/me/profile','student',async req=>learnerTransaction(req,tx=>privacy.updateProfile(tx,req.principal!.learnerId!,req.body as privacy.ProfilePatch,config)));
  route('GET','/v1/me/consents','student',async req=>privacy.consents(db,req.principal!.learnerId!));
  route('POST','/v1/me/consent-requests','student',async(req,reply)=>{
    const p=req.principal!,b=req.body as {guardianEmail:string;purposes:string[]};
    let delivery:{address:string;link:string}|undefined;
    const out=await learnerCommand(req,'POST /v1/me/consent-requests',b,async tx=>{
      const created=await privacy.requestConsent(tx,config,p.learnerId!,b.guardianEmail,b.purposes);delivery=created;return {status:201,body:created.body};
    });
    if(delivery){identity.deliver(mailbox,delivery.address,{kind:'consent',token:delivery.link});saveMailbox(config,mailbox);}
    return send(reply,out,at.consents);
  });
  route('GET','/v1/guardian-consents/{token}','public',async req=>{identity.requireSynthetic(config);return privacy.consentView(db,params(req).token!);});
  route('POST','/v1/guardian-consents/{token}/decision','public',async(req,reply)=>{
    identity.requireSynthetic(config);const link=params(req).token!,rows=await privacy.tokenRecords(db,link),first=rows[0]!;
    const out=await db.transaction().execute(tx=>command(tx,'GUARDIAN',first.guardian_id!,'POST guardian-decision:'+first.learner_id+':'+hash(link).toString('hex'),key(req),req.body,
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
  // Learning sessions: PRACTICE (Slice 1 M6) and QUESTION_LOOP (Slice 2 M5). Commands are idempotent, consent-gated and versioned (04 §7).
  const learning=learningService(config.key,options.diagnosisEngine??null);
  route('POST','/v1/question-intakes','student',async(req,reply)=>send(reply,await learnerCommand(req,'POST intake',req.body,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);return{status:201,body:await createIntake(tx,req.principal!.learnerId!,req.body as{inputMode:'PHOTO'|'TYPED';text?:string},ocr)};}),b=>'/v1/question-intakes/'+b.id));
  route('GET','/v1/question-intakes/{intakeId}','student',async(req,reply)=>learnerTransaction(req,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);const view=await intakeView(tx,params(req).intakeId!,req.principal!.learnerId!);if(view.status==='READING')reply.header('Retry-After','2');return view;}));
  route('DELETE','/v1/question-intakes/{intakeId}','student',async(req,reply)=>{await learnerTransaction(req,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);await discardIntake(tx,req.principal!.learnerId!,params(req).intakeId!);});return reply.code(204).send();});
  route('PUT','/v1/question-intakes/{intakeId}/image','student',async(req,reply)=>{const body=await learnerTransaction(req,tx=>uploadIntake(tx,req.principal!.learnerId!,params(req).intakeId!,req.body as Buffer,req.headers['content-type']!,config.key,ocr));reply.code(202).header('Retry-After','2');return body;});
  route('POST','/v1/question-intakes/{intakeId}/confirmation','student',async(req,reply)=>send(reply,await learnerCommand(req,'POST intake-confirm:'+params(req).intakeId,req.body,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);return{status:201,body:await confirmIntake(tx,req.principal!.learnerId!,params(req).intakeId!,req.body as{text:string;topicId?:string;conceptIds:string[]})};}),b=>'/v1/questions/'+b.questionId));
  route('POST','/v1/tutor-conversations','student',async(req,reply)=>send(reply,await learnerCommand(req,'POST tutor-conversation',req.body,async tx=>{
    await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);return openTutor(tx,req.principal!.learnerId!,req.body as{sessionId:string;conceptId?:string});
  }),b=>'/v1/tutor-conversations/'+b.id));
  route('GET','/v1/tutor-conversations/{conversationId}','student',async req=>learnerTransaction(req,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);return tutorConversation(tx,req.principal!.learnerId!,params(req).conversationId!);}));
  route('POST','/v1/tutor-conversations/{conversationId}/messages','student',async(req,reply)=>{
    reply.header('Retry-After','2');return send(reply,await learnerCommand(req,'POST tutor-message:'+params(req).conversationId,req.body,async tx=>{
      await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);return sendTutor(tx,req.principal!.learnerId!,params(req).conversationId!,req.body as{ text?:string;quickReply?:string;requestFullSolution?:boolean},config.key,config.features.aiTutor);
    }));
  });
  route('GET','/v1/tutor-messages/{messageId}','student',async(req,reply)=>learnerTransaction(req,async tx=>{await privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA']);const m=await tutorMessage(tx,req.principal!.learnerId!,params(req).messageId!);if(m.status==='PENDING')reply.header('Retry-After','2');return m;}));
  // A queued run is polled at GET /v1/diagnosis-runs/{id}; Retry-After says when (09 §8).
  const pollable=(reply:FastifyReply,body:unknown)=>{
    const run=(body as {diagnosisRun?:{status?:string};status?:string}|undefined);const status=run?.diagnosisRun?.status??run?.status;
    if(status==='QUEUED'||status==='RUNNING')reply.header('Retry-After','2');return body;};
  const learnerId=(req:FastifyRequest)=>req.principal!.learnerId!;
  const learnLimit=(req:FastifyRequest)=>{
    const key='learn:'+learnerId(req),time=Date.now(),state=limits.get(key);
    const next=!state||state.until<=time?{count:0,until:time+60000}:state;next.count++;limits.set(key,next);
    if(next.count>120)fail(429,'RATE_LIMITED');
  };
  const sessionCommand=(name:string,run:(tx:import('./db.js').Tx,req:FastifyRequest)=>Promise<Outcome>,locate?:Locate)=>async(req:FastifyRequest,reply:FastifyReply)=>{
    learnLimit(req);
    return send(reply,await learnerCommand(req,`POST ${name}:${params(req).sessionId}`,req.body,tx=>run(tx,req)),locate);
  };
  type Body<T>=T;
  route('POST','/v1/learning-sessions','student',async(req,reply)=>{learnLimit(req);
    return send(reply,await learnerCommand(req,'POST /v1/learning-sessions',req.body,tx=>learning.create(tx,learnerId(req),req.body as Body<Parameters<typeof learning.create>[2]>)),at.session);});
  route('GET','/v1/learning-sessions','student',async req=>{const q=req.query as {status?:'active'|'completed'|'all';cursor?:string;limit?:number};
    return learning.list(db,learnerId(req),q.status??'all',q.cursor,q.limit??20);});
  route('GET','/v1/learning-sessions/{sessionId}','student',async req=>learning.get(db,learnerId(req),params(req).sessionId!));
  route('POST','/v1/learning-sessions/{sessionId}/attempts','student',async(req,reply)=>pollable(reply,await sessionCommand('attempts',(tx,r)=>learning.submitAttempt(tx,learnerId(r),params(r).sessionId!,r.body as Body<Parameters<typeof learning.submitAttempt>[3]>),at.attempt)(req,reply)));
  route('POST','/v1/learning-sessions/{sessionId}/quick-check-answers','student',sessionCommand('quick-check-answers',(tx,req)=>learning.answerQuickCheck(tx,learnerId(req),params(req).sessionId!,req.body as Body<Parameters<typeof learning.answerQuickCheck>[3]>),at.attempt));
  route('POST','/v1/learning-sessions/{sessionId}/actions','student',sessionCommand('actions',(tx,req)=>learning.action(tx,learnerId(req),params(req).sessionId!,req.body as Body<Parameters<typeof learning.action>[3]>)));
  route('POST','/v1/learning-sessions/{sessionId}/hints','student',sessionCommand('hints',(tx,req)=>learning.hint(tx,learnerId(req),params(req).sessionId!,req.body as {step:number})));
  route('PUT','/v1/learning-sessions/{sessionId}/checkpoint','student',async(req,reply)=>{learnLimit(req);
    await learnerTransaction(req,tx=>learning.checkpoint(tx,learnerId(req),params(req).sessionId!,req.body as {route:string;sessionId?:string}));
    return reply.code(204).send();});
  route('POST','/v1/learning-sessions/{sessionId}/solution','student',sessionCommand('solution',(tx,req)=>learning.reviewSolution(tx,learnerId(req),params(req).sessionId!,req.body as {expectedStateVersion:number})));
  route('GET','/v1/learning-sessions/{sessionId}/solution','student',async req=>learning.solution(db,learnerId(req),params(req).sessionId!));
  route('GET','/v1/attempts/{attemptId}','student',async req=>learning.attempt(db,learnerId(req),params(req).attemptId!));
  route('POST','/v1/attempts/{attemptId}/diagnosis','student',async(req,reply)=>{learnLimit(req);const id=params(req).attemptId!;
    return pollable(reply,send(reply,await learnerCommand(req,'POST attempt-diagnosis:'+id,null,tx=>learning.requestDiagnosis(tx,learnerId(req),id)),at.run));});
  route('GET','/v1/diagnosis-runs/{diagnosisRunId}','student',async(req,reply)=>pollable(reply,await learning.diagnosisRun(db,learnerId(req),params(req).diagnosisRunId!)));
  // Disputes, learner side (Slice 2 M6, 06 §9.3). Staff resolution waits for D7.
  route('POST','/v1/diagnosis-runs/{diagnosisRunId}/reports','student',async(req,reply)=>{learnLimit(req);const id=params(req).diagnosisRunId!;
    return send(reply,await learnerCommand(req,'POST diagnosis-report:'+id,req.body,tx=>fileReport(tx,learnerId(req),id,req.body as {reason:ReportReason;note?:string})),at.reportedRun);});
  for(const operation of disabled){const [method,path]=operation.split(' ') as ['GET'|'POST',string];route(method,path,'student',async()=>fail(403,'FEATURE_DISABLED'));}
  // Legacy facade L3 (Slice 1 M7, 09 §6): deprecated, and off unless FEATURE_LEGACY_FACADE=true. The shipped client
  // sends no CSRF token: exact Origin, Sec-Fetch-Site and JSON content type (onRequest) and SameSite cookies compensate.
  // Its idempotency key is derived (the client's attemptId changes on every call): a retry of the same answer replays.
  const facade=legacyFacade(learning);
  if(config.features.legacyFacade) route('POST','/v1/learning/answers/check','public',async(req,reply)=>{
    reply.header('Deprecation','true');
    req.principal=await identity.authenticate(db,config,req.sessionToken);
    if(req.principal?.role!=='STUDENT')fail(403,'FEATURE_DISABLED'); // guests are not served under CONSENT_FIRST
    learnLimit(req);
    const b=req.body as LegacyCheck,payload={sessionId:b.sessionId,kind:b.kind,itemId:b.itemId,answer:b.answer};
    const derived='legacy_'+hash(stable({learnerId:learnerId(req),...payload})).toString('hex');
    try {
      return send(reply,await db.transaction().execute(tx=>command(tx,'LEARNER',learnerId(req),'POST /v1/learning/answers/check',derived,payload,
        ()=>privacy.authorizeMutation(tx,req.principal!,async()=>({status:200,body:await facade(tx,learnerId(req),b)})))));
    } catch(error) { throw consentFirst(error); }
  });
  // Legacy facade L1, L2, L4, L8 (Slice 2 M7), same rules as L3: STUDENT only, CONSENT_FIRST (a learner without
  // consent is treated like a guest: 403 FEATURE_DISABLED), derived idempotency keys, Deprecation header, and
  // Retry-After while a run is pending. Responses are the frozen shapes the shipped adapters validate.
  const loopFacade=legacyLoopFacade(learning);
  if(config.features.legacyFacade) route('POST','/v1/learning/tutor','public',async(req,reply)=>{
    reply.header('Deprecation','true');
    req.principal=await identity.authenticate(db,config,req.sessionToken);
    if(req.principal?.role!=='STUDENT')fail(403,'FEATURE_DISABLED');
    learnLimit(req);
    const body=req.body as {sessionId:string; questionId:string; messages:{from:string;text:string}[]};
    const message=body.messages.at(-1);
    if(message?.from!=='me'||!message.text.trim()||message.text.length>500)fail(400,'VALIDATION_FAILED');
    // Canonical loop id only; caller-supplied history, script, hintsUsed and question text grant no authority.
    const payload={sessionId:body.sessionId,message:message!.text};
    const tutorKey=key(req)??'legacy_'+hash(stable(body)).toString('hex');
    return send(reply,await db.transaction().execute(tx=>command(tx,'LEARNER',learnerId(req),'POST tutor:'+body.sessionId,tutorKey,payload,
      ()=>privacy.authorizeMutation(tx,req.principal!,async()=>{
        const legacy=await learning.legacyLoop(tx,learnerId(req),`${body.sessionId}:loop:${body.questionId}`);
        const sessionId=legacy?.row.id??body.sessionId;
        if(!/^[0-9a-f-]{36}$/i.test(sessionId))fail(409,'CONTENT_UNAVAILABLE');
        return {status:200,body:await learning.tutor(tx,learnerId(req),sessionId,message!.text)};
      }))));
  });
  const legacyStudent=async(req:FastifyRequest,reply:FastifyReply)=>{
    reply.header('Deprecation','true');
    req.principal=await identity.authenticate(db,config,req.sessionToken);
    if(req.principal?.role!=='STUDENT')fail(403,'FEATURE_DISABLED');
    learnLimit(req);
  };
  const legacyPoll=(reply:FastifyReply,body:unknown)=>{const status=(body as {status?:string}).status;if(status==='pending'||status==='running')reply.header('Retry-After','2');return body;};
  // 09 §6.1 rule 5: the derived key includes the version of the loop the command runs in, so the same text sent after the
  // state moved on is a new command. The outcome is also remembered under the version it produced, so a network retry
  // arriving after the commit replays it. (An identical payload sent right after, with nothing in between, is a retry.)
  const legacyCommand=async(req:FastifyRequest,reply:FastifyReply,operation:string,payload:Record<string,unknown>,run:(tx:import('./db.js').Tx)=>Promise<unknown>)=>{
    const context=payload as {sessionId:string;questionId:string};
    const key=(version:number)=>'legacy_'+hash(stable({learnerId:learnerId(req),operation,...payload,version})).toString('hex');
    try {
      return send(reply,await db.transaction().execute(async tx=>{
        const outcome=await command(tx,'LEARNER',learnerId(req),operation,key(await loopFacade.version(tx,learnerId(req),context)),payload,
          ()=>privacy.authorizeMutation(tx,req.principal!,async()=>({status:200,body:await run(tx)})));
        const after=key(await loopFacade.version(tx,learnerId(req),context));
        if(!outcome.replayed)await remember(tx,'LEARNER',learnerId(req),operation,after,payload,outcome);
        return outcome;
      }));
    } catch(error) { throw consentFirst(error); }
  };
  const consentedReader=async(req:FastifyRequest)=>{if(!await privacy.hasConsent(db,learnerId(req),'LEARNING_DATA'))fail(403,'FEATURE_DISABLED');};
  if(config.features.legacyFacade) {
    route('POST','/v1/learning/diagnosis','public',async(req,reply)=>{
      await legacyStudent(req,reply);
      const b=req.body as LegacyDiagnosisRequest;
      const payload={sessionId:b.sessionId,questionId:b.questionId,responseMode:b.responseMode,rawText:b.rawText,hintOpened:b.hintOpened,
        ...(b.questionText!==undefined?{questionText:b.questionText}:{}),...(b.coreIds!==undefined?{coreIds:b.coreIds}:{})};
      return legacyPoll(reply,await legacyCommand(req,reply,'POST /v1/learning/diagnosis',payload,
        async tx=>legacyRun(tx,learning,learnerId(req),await loopFacade.diagnose(tx,learnerId(req),b))));
    });
    route('GET','/v1/learning/diagnosis/{diagnosisRunId}','public',async(req,reply)=>{
      await legacyStudent(req,reply);await consentedReader(req);
      const id=params(req).diagnosisRunId!;
      // Device ids ("demo-…", "eval-…") and anything else that is not a stored run are simply not found.
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))fail(404,'NOT_FOUND');
      return legacyPoll(reply,await legacyRun(db,learning,learnerId(req),await learning.diagnosisRun(db,learnerId(req),id)));
    });
    route('POST','/v1/learning/solution','public',async(req,reply)=>{
      await legacyStudent(req,reply);
      const b=req.body as LegacyContext&{reason:string};
      return legacyCommand(req,reply,'POST /v1/learning/solution',{sessionId:b.sessionId,questionId:b.questionId,reason:b.reason,
        ...(b.questionText!==undefined?{questionText:b.questionText}:{}),...(b.coreIds!==undefined?{coreIds:b.coreIds}:{})},tx=>loopFacade.solution(tx,learnerId(req),b));
    });
    route('POST','/v1/learning/intake/map','public',async(req,reply)=>{
      await legacyStudent(req,reply);await consentedReader(req);
      const release=await currentRelease(db);
      if(!release)fail(409,'CONTENT_UNAVAILABLE');
      return legacyIntakeMap(db,release!,(req.body as {questionText:string}).questionText);
    });
  }
  route('POST','/v1/guide/messages','student',async req=>{
    learnLimit(req);
    await learnerTransaction(req,tx=>privacy.requireConsent(tx,req.principal!.learnerId!,['LEARNING_DATA','AI_PROCESSING']));
    return guideReply(db,config.guide,req.body as GuideInput);
  });
  route('POST','/v1/trial/claim','student',async(req,reply)=>{
    const owner=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>/^inti_trial=[a-f0-9-]{36}$/.test(x))?.slice(11);
    if(!owner)fail(400,'VALIDATION_FAILED');
    const proof=readTrialProof(config.key,(req.body as {proof:string}).proof,owner!);
    return send(reply,await learnerCommand(req,'POST trial-claim', {proofId:proof.id}, async tx=>({status:200,body:await claimTrial(tx,config.key,req.principal!.learnerId!,proof)})));
  });
  registerTrialRoutes(app, db, undefined, config.key);
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
  route('GET','/v1/questions/{questionId}','public',async req=>{const p=await identity.authenticate(db,config,req.sessionToken);if(p?.learnerId&&await privacy.hasConsent(db,p.learnerId,'LEARNING_DATA')){const q=await privateQuestionView(db,params(req).questionId!,p.learnerId);if(q)return q;}return catalog.question(db,params(req).questionId!);});
  route('GET','/v1/lessons/{lessonId}','public',async req=>catalog.lesson(db,params(req).lessonId!));
  // No learning endpoints exist in Slice 0. Legacy learning routes fail closed.
  for(const [path,operations]of Object.entries(contract.paths) as [string,Record<string,unknown>][]) {
    if(!path.startsWith('/v1/learning/')&&path!=='/v1/public/evaluations')continue;
    if(config.features.legacyFacade&&[...FACADE].some(op=>op.endsWith(' '+path)))continue;
    for(const method of Object.keys(operations))if(['get','post'].includes(method))route(method.toUpperCase() as 'GET'|'POST',path,'public',async()=>fail(403,'FEATURE_DISABLED'));
  }
  return {app,db,mailbox,config};
}
export function privacyRoute(route:string) {
  return /^(?:\/(?:|coba|soal-tadi|kenalan|tanya|challenge|latihan\/soal|home|pick|latihan|progress|profile|diagnosis|mastery)|\/core\/[a-z0-9-]{1,64})$/.test(route);
}
