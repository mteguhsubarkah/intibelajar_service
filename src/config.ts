export interface Config {
  mode: 'development' | 'test'; databaseUrl: string; origin: string; host: string; port: number;
  key: Buffer; synthetic: boolean; idleSeconds: number; absoluteSeconds: number;
  features: Readonly<Record<keyof typeof features, boolean>>;
}
export const integrationBlockers = [
  'GOOGLE_OIDC_NOT_CONFIGURED', 'EMAIL_DELIVERY_NOT_CONFIGURED',
  'GUARDIAN_VERIFICATION_NOT_CONFIGURED', 'CONSENT_TEXT_NOT_APPROVED',
  'AGE_ASSURANCE_NOT_APPROVED', 'DPIA_AND_PRIVACY_REVIEW_PENDING',
] as const;
export const features = Object.freeze({ aiDiagnosis: false, aiTutor: false, intake: false,
  legacyFacade: false, productAnalytics: false, streakFreeze: false, guestEvaluation: false });
export function readConfig(env = process.env): Config {
  if (!['development', 'test'].includes(env.NODE_ENV ?? 'development'))
    throw new Error('Production is disabled: Slice 0 supports synthetic development/test only');
  const safeUrl=(value:string)=>{try{return new URL(value);}catch{throw new Error('Invalid URL configuration');}};
  const url = safeUrl(env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('A loopback PostgreSQL DATABASE_URL is required');
  const origin = safeUrl(env.APP_ORIGIN ?? 'http://localhost:5173');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.origin !== (env.APP_ORIGIN ?? origin.origin))
    throw new Error('APP_ORIGIN must be an exact loopback origin');
  const key = Buffer.from(env.APP_KEY ?? '', 'hex');
  if (key.length !== 32 || !/^[a-f0-9]{64}$/i.test(env.APP_KEY ?? '')) throw new Error('APP_KEY must be 32 random bytes encoded as hex');
  const integer = (name: string, fallback: number, max: number) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
    return value;
  };
  // Only the legacy facade (Slice 1 M7, synthetic data) can be switched on; every other feature fails closed.
  for (const [name, value] of Object.entries(env)) if (/^FEATURE_/.test(name) && value !== 'false' && !(name === 'FEATURE_LEGACY_FACADE' && value === 'true'))
    throw new Error('Features cannot be enabled in this development foundation');
  if (env.HOST && env.HOST !== '127.0.0.1') throw new Error('Only loopback binding is supported');
  return { mode: (env.NODE_ENV ?? 'development') as Config['mode'], databaseUrl: url.href,
    origin: origin.origin, host: '127.0.0.1', port: integer('PORT', 8000, 65535), key,
    synthetic: env.SYNTHETIC_FIXTURES === 'true', idleSeconds: integer('SESSION_IDLE_SECONDS', 604800, 604800),
    absoluteSeconds: integer('SESSION_ABSOLUTE_SECONDS', 2592000, 2592000),
    features: Object.freeze({ ...features, legacyFacade: env.FEATURE_LEGACY_FACADE === 'true' }) };
}
