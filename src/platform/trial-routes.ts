import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Connection } from '../db.js';
import { trialAssessment, loadTrialItem } from '../assessment/trial.js';
import type { Config } from '../config.js';
import { trialDeepSeek, type TrialAi } from '../assessment/trial-ai.js';
import {sealTrialProof} from '../assessment/trial-proof.js';
import { uuid } from './crypto.js';
import { validateRequest, validateResponse } from './contract.js';

// A browser-bound anonymous trial. Never a login cookie or a learner identity.
// Existing global same-origin, JSON, body size and rate checks still apply.
export function registerTrialRoutes(app: FastifyInstance, db: Connection,
  providedTrial?: ReturnType<typeof trialAssessment>, proofKey?:Buffer, guideConfig?:Config['guide'], ai?:TrialAi) {
  const trial=providedTrial ?? trialAssessment((alias,revision)=>loadTrialItem(db,alias,revision),
    ai ?? trialDeepSeek(db,guideConfig),Date.now,
    input=>proofKey ? sealTrialProof(proofKey,input) : undefined);
  app.addHook('onClose', async () => trial.close());
  const owner = (req: FastifyRequest, reply: any) => {
    const cookies = req.headers.cookie?.split(';').map(x => x.trim()).filter(x => x.startsWith('inti_trial=')) ?? [];
    if (cookies.length === 1 && /^inti_trial=[a-f0-9-]{36}$/.test(cookies[0]!)) return cookies[0]!.slice(11);
    const id = uuid();
    reply.header('Set-Cookie', `inti_trial=${id}; Path=/v1/trial; HttpOnly; SameSite=Strict; Max-Age=7200${req.protocol === 'https' ? '; Secure' : ''}`);
    return id;
  };
  const register = (method: 'GET' | 'POST', suffix: string, run: (id: string, req: FastifyRequest) => unknown) => {
    const path = '/v1/trial/' + suffix;
    app.route({ method, url: path.replace('{diagnosisRunId}', ':diagnosisRunId'),
      preValidation: async req => validateRequest(path, method, req),
      handler: async (req, reply) => {
        const result = await run(owner(req, reply), req);
        validateResponse(path, method, 200, result);
        return result;
      } });
  };
  register('POST', 'diagnosis', (id, req) => trial.diagnose(id, req.body as any));
  register('GET', 'diagnosis/{diagnosisRunId}', (id, req) => trial.run(id, (req.params as any).diagnosisRunId));
  register('POST', 'answers/check', (id, req) => trial.check(id, req.body as any));
  register('POST', 'solution', (id, req) => trial.solution(id, req.body as any));
  register('POST', 'tutor', (id, req) => trial.tutor(id, req.body as any));
}
