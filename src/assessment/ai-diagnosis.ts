// Offline, provider-neutral preparation. No fetch, SDK, credentials, database, or runtime flag activation.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Ajv } from 'ajv';
import { InvalidOutput, validateCandidate, type EngineInput, type DiagnosisEngine } from './diagnosis.js';

export const PROMPT_VERSION = 'diagnosis@0.1.0';
export const AI_INTEGRATION_BLOCKERS = Object.freeze([
  'PRODUCTION_AI_PROVIDER_NOT_APPROVED', 'AI_PROVIDER_PRIVACY_APPROVAL_PENDING',
  'AI_GOLD_SET_APPROVAL_PENDING',
]);
const system = readFileSync(new URL('../../ai/prompts/diagnosis/0.1.0.md', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../../ai/schemas/diagnosis-result.v1.json', import.meta.url), 'utf8'));
const shape = new Ajv({ strict: true }).compile(schema);

/** Equal-length masking preserves UTF-16 evidence offsets; heuristic, not full PII detection. */
export function redactAnswer(text: string) {
  return text.replace(/https?:\/\/[^\s]+|www\.[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{16}\b|(?:\+62|\b62|\b0)\d(?:[\s()-]*\d){7,12}/gi,
    match => '█'.repeat(match.length));
}

export function prepareDiagnosis(input: EngineInput) {
  if (input.response.responseType !== 'TEXT' || !input.response.text || input.response.text.length > 10000
      || !input.concepts.length || input.concepts.length > 20) throw new Error('AI_INPUT_NOT_ELIGIBLE');
  const text = redactAnswer(input.response.text);
  const tag = `learner_${randomBytes(16).toString('hex')}`;
  const outputSchema = structuredClone(schema);
  outputSchema.properties.concepts.items.properties.conceptIndex.enum = input.concepts.map((_, i) => i + 1);
  // Stable catalog context is separate from learner text for future cache isolation.
  return {
    promptVersion: PROMPT_VERSION, schemaVersion: 'diagnosis-result.v1', system,
    context: JSON.stringify({ purpose: input.purpose, question: input.prompt, rubric: input.rubric,
      concepts: input.concepts.map((c, i) => ({ conceptIndex: i + 1, ...c })) }),
    learner: `<${tag}>\n${JSON.stringify({ text })}\n</${tag}>`, outputSchema,
    // Private validation context, never send as provider metadata.
    validationInput: { ...input, response: { ...input.response, text } },
  };
}

/** Strict shape first, existing domain evidence validation second. No silent mock fallback. */
export function decodeDiagnosis(raw: unknown, prepared: ReturnType<typeof prepareDiagnosis>) {
  if (typeof raw === 'string') {
    if (raw.length > 64000) throw new InvalidOutput();
    try { raw = JSON.parse(raw); } catch { throw new InvalidOutput(); }
  }
  if (!shape(raw)) throw new InvalidOutput();
  const doc = raw as { schemaVersion: 1; verdict: string; concepts: {
    conceptIndex: number; classification: string; confidence: number; misconceptionCode: string | null;
    rationale: string | null; refs: { kind: 'SPAN'; start: number; end: number; quote: string }[];
  }[] };
  const seen = new Set<number>();
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const keys = prepared.validationInput.rubric.acceptedForms.map(normalize).filter(Boolean);
  const concepts = doc.concepts.map(c => {
    const concept = prepared.validationInput.concepts[c.conceptIndex - 1];
    if (!concept || seen.has(c.conceptIndex) || c.refs.some(r => r.quote.includes('█'))
        || (c.rationale && (keys.some(key => normalize(c.rationale!).includes(key)) || redactAnswer(c.rationale) !== c.rationale))
        || (doc.verdict === 'CORRECT' && c.classification === 'MISCONCEPTION_EVIDENCED')) throw new InvalidOutput();
    seen.add(c.conceptIndex);
    return { ...c, conceptCode: concept.code };
  });
  const result = validateCandidate({ ...doc, concepts }, prepared.validationInput);
  // Malformed claims must not disappear unnoticed and turn a broken response into a success.
  if (result.dropped.length) throw new InvalidOutput();
  return { schemaVersion: 1, verdict: result.verdict, concepts: result.evidence };
}

/** Runs the real prompt/decoder path with a fixture only; existing app test-only guard remains in force. */
export function fixtureDiagnosisEngine(respond: (request: ReturnType<typeof prepareDiagnosis>) => unknown): DiagnosisEngine {
  return { testOnly: true, name: 'offline-prompt-fixture', async diagnose(input, signal) {
    signal.throwIfAborted();
    const prepared = prepareDiagnosis(input);
    const raw = respond(prepared);
    signal.throwIfAborted();
    return decodeDiagnosis(raw, prepared);
  } };
}
