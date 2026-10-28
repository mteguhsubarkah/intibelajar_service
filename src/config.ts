export interface Config {
  guide?: {apiKey:string;model:string;visionModel:string};
  google?: {clientId:string;clientSecret:string;testEmail?:string};
  /** 'pilot': the private adult pilot on a public HTTPS origin behind the local Nginx (RUNTIME_MODE=pilot, NODE_ENV=production). */
  mode: 'development' | 'test' | 'pilot'; databaseUrl: string; origin: string; host: string; port: number;
  /** The proxy whose X-Forwarded-For/-Proto is believed: the local Nginx in pilot mode, nobody otherwise. */
  trustProxy: string | false;
  key: Buffer; synthetic: boolean; idleSeconds: number; absoluteSeconds: number;
  /** SELF_ONBOARDING_CONSENT=true: siswa memberi izin sendiri saat onboarding, tanpa guardian. */
  selfConsent: boolean;
  /** Pengirim email masuk sungguhan (Resend). Tanpa ini hanya kotak surat sintetis lokal. */
  email?: {provider:'resend';apiKey:string;from:string};
  features: Readonly<Record<keyof typeof features, boolean>>;
}
export const integrationBlockers = [
  'GOOGLE_OIDC_NOT_CONFIGURED', 'EMAIL_DELIVERY_NOT_CONFIGURED',
  'GUARDIAN_VERIFICATION_NOT_CONFIGURED', 'CONSENT_TEXT_NOT_APPROVED',
  'AGE_ASSURANCE_NOT_APPROVED', 'DPIA_AND_PRIVACY_REVIEW_PENDING',
] as const;
export const features = Object.freeze({ aiDiagnosis: false, aiTutor: false, intake: false,
  legacyFacade: false, productAnalytics: false, streakFreeze: false, guestEvaluation: false,
  /** FEATURE_GUEST_TRIAL=true: a visitor of /coba gets a 24-hour trial account so the server grades them like a learner. */
  guestTrial: false });
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
export function readConfig(env = process.env): Config {
  // Pilot: an explicit pair, NODE_ENV=production and RUNTIME_MODE=pilot. Every development-only integration keys on
  // NODE_ENV=development (local Google, DeepSeek, OCR, the synthetic mailbox, the grading log), so all of them stay off.
  const pilot = env.RUNTIME_MODE === 'pilot';
  if (env.RUNTIME_MODE !== undefined && !pilot) throw new Error('RUNTIME_MODE supports pilot only');
  if (pilot ? env.NODE_ENV !== 'production' : !['development', 'test'].includes(env.NODE_ENV ?? 'development'))
    throw new Error(pilot ? 'RUNTIME_MODE=pilot requires NODE_ENV=production'
      : 'Production is disabled: use RUNTIME_MODE=pilot for the private pilot, otherwise development/test only');
  const safeUrl=(value:string)=>{try{return new URL(value);}catch{throw new Error('Invalid URL configuration');}};
  const url = safeUrl(env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('A loopback PostgreSQL DATABASE_URL is required');
  const origin = safeUrl(env.APP_ORIGIN ?? (pilot ? '' : 'http://localhost:5173'));
  if (pilot) {
    // Exactly one public HTTPS origin, written as an origin (no path, port defaults, credentials or IP address).
    if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || origin.username || origin.password
        || LOOPBACK.includes(origin.hostname) || /^[\d.]+$|^\[/.test(origin.hostname) || !origin.hostname.includes('.'))
      throw new Error('Pilot APP_ORIGIN must be an exact public https origin such as https://intibelajar.com');
    // No synthetic identities or automatic guest consent. Explicit self-onboarding remains opt-in.
    if (env.SYNTHETIC_FIXTURES === 'true') throw new Error('SYNTHETIC_FIXTURES must be off in pilot mode');
    if (env.FEATURE_GUEST_TRIAL === 'true') throw new Error('FEATURE_GUEST_TRIAL grants consent automatically; refused in pilot mode');
    // Only the local Nginx may speak for the client (real IP for rate limits, https for writes).
    if (!['127.0.0.1', '::1'].includes(env.TRUST_PROXY ?? '')) throw new Error('Pilot mode requires TRUST_PROXY=127.0.0.1 (the local Nginx)');
  } else {
    if (!LOOPBACK.includes(origin.hostname) || origin.origin !== (env.APP_ORIGIN ?? origin.origin))
      throw new Error('APP_ORIGIN must be an exact loopback origin');
    if (env.TRUST_PROXY !== undefined) throw new Error('TRUST_PROXY is for pilot mode only');
  }
  const key = Buffer.from(env.APP_KEY ?? '', 'hex');
  if (key.length !== 32 || !/^[a-f0-9]{64}$/i.test(env.APP_KEY ?? '')) throw new Error('APP_KEY must be 32 random bytes encoded as hex');
  const integer = (name: string, fallback: number, max: number) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
    return value;
  };
  // Only the legacy facade (Slice 1 M7, synthetic data) and the /coba guest trial can be switched on; every other
  // feature fails closed.
  const switchable = ['FEATURE_LEGACY_FACADE', 'FEATURE_GUEST_TRIAL'];
  for (const [name, value] of Object.entries(env)) if (/^FEATURE_/.test(name) && value !== 'false' && !(switchable.includes(name) && value === 'true'))
    throw new Error('Features cannot be enabled in this development foundation');
  if (env.HOST && env.HOST !== '127.0.0.1') throw new Error('Only loopback binding is supported');
  const localAi=env.LOCAL_DEEPSEEK==='true',localTutor=env.LOCAL_DEEPSEEK_TUTOR==='true',localOcr=env.LOCAL_OPENROUTER_OCR==='true';
  let google:Config['google'];
  if(env.LOCAL_GOOGLE_OIDC==='true'){
    if((env.NODE_ENV??'development')!=='development'||env.SYNTHETIC_FIXTURES!=='true'||url.pathname!=='/intibelajar_local_dev')
      throw new Error('Google test sign-in requires the isolated local development database');
    if(!env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com')||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TEST_EMAIL
       ||env.GOOGLE_TEST_ADULT_ACK!=='true'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.GOOGLE_TEST_EMAIL))
      throw new Error('Google client credentials and an explicitly acknowledged adult test account are required');
    google={clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,testEmail:env.GOOGLE_TEST_EMAIL.trim().toLowerCase()};
  }
  // Public server OIDC uses separate credentials from the isolated local test account.
  if (env.GOOGLE_OIDC_ENABLED !== undefined && !['true', 'false'].includes(env.GOOGLE_OIDC_ENABLED))
    throw new Error('GOOGLE_OIDC_ENABLED must be true or false');
  if (env.GOOGLE_OIDC_ENABLED === 'true') {
    if (!pilot || env.LOCAL_GOOGLE_OIDC === 'true')
      throw new Error('GOOGLE_OIDC_ENABLED requires pilot mode without LOCAL_GOOGLE_OIDC');
    if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID ?? '')
        || !env.GOOGLE_CLIENT_SECRET?.trim() || /[\r\n]/.test(env.GOOGLE_CLIENT_SECRET))
      throw new Error('Google server sign-in requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    google = {clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET};
  }
  let guide:Config['guide'];
  if(env.INTIGUIDE_PROVIDER){
    if(env.INTIGUIDE_PROVIDER!=='deepseek'||!env.DEEPSEEK_API_KEY?.trim())throw new Error('IntiGuide requires INTIGUIDE_PROVIDER=deepseek and DEEPSEEK_API_KEY');
    const model=env.INTIGUIDE_MODEL??'deepseek-flash';
    if(!['deepseek-flash','deepseek-v4-pro'].includes(model))throw new Error('Unsupported INTIGUIDE_MODEL');
    // Foto soal needs a DeepSeek model that accepts image input; the text models reject images.
    const visionModel=env.INTIGUIDE_VISION_MODEL??'deepseek-v4-flash-vision-exp';
    if(!/^deepseek-[a-z0-9.-]{1,60}$/.test(visionModel))throw new Error('Unsupported INTIGUIDE_VISION_MODEL');
    guide={apiKey:env.DEEPSEEK_API_KEY,model,visionModel};
  }
  let email:Config['email'];
  if(env.EMAIL_PROVIDER){
    if(env.EMAIL_PROVIDER!=='resend')throw new Error('EMAIL_PROVIDER supports resend only');
    const from=(env.EMAIL_FROM??'').trim();
    if(!/^re_[A-Za-z0-9_]+$/.test(env.RESEND_API_KEY??'')||/[\r\n]/.test(from)||!/^(?:[^<>@]*<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(from))
      throw new Error('Resend requires RESEND_API_KEY and a valid EMAIL_FROM');
    email={provider:'resend',apiKey:env.RESEND_API_KEY!,from};
  }
  if((localAi||localTutor||localOcr) && ((env.NODE_ENV??'development')!=='development'||env.SYNTHETIC_FIXTURES!=='true'||url.pathname!=='/intibelajar_local_dev'))
    throw new Error('DeepSeek requires the isolated synthetic development database');
  return { mode: pilot ? 'pilot' : (env.NODE_ENV ?? 'development') as Config['mode'], databaseUrl: url.href, trustProxy: pilot ? env.TRUST_PROXY! : false,
    origin: origin.origin, host: '127.0.0.1', port: integer('PORT', 8000, 65535), key,...(google?{google}:{}),...(guide?{guide}:{}),
    synthetic: env.SYNTHETIC_FIXTURES === 'true', selfConsent: env.SELF_ONBOARDING_CONSENT === 'true',...(email?{email}:{}), idleSeconds: integer('SESSION_IDLE_SECONDS', 604800, 604800),
    absoluteSeconds: integer('SESSION_ABSOLUTE_SECONDS', 2592000, 2592000),
    features: Object.freeze({ ...features, aiDiagnosis:localAi,aiTutor:localTutor,intake:localOcr, legacyFacade: env.FEATURE_LEGACY_FACADE === 'true', guestTrial: env.FEATURE_GUEST_TRIAL === 'true' }) };
}
