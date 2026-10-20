> Pembaruan 20 Oktober 2026: lihat [status alur lokal D3/D6 dan DeepSeek](09-local-full-flow.md). Catatan awal di bawah bersifat historis.

# Diagnosis prompt foundation — 20 October 2026

The local frontend still receives deterministic tower-v1 diagnoses. No external AI is connected or called. The existing worker and app test-only engine guard are unchanged.

The supplied Python example informed the grounding and Indonesian feedback style. Its `correct/gaps` response is not introduced into `/v1`: the new offline TypeScript adapter returns candidates in the existing assessment shape. It deliberately does not copy hardcoded keys, automatic key-based activation, tool calls, substring mock grading, or silent provider-error fallback to invented gaps.

## Implemented

- `ai/prompts/diagnosis/0.1.0.md`: draft versioned Indonesian system prompt, alternate valid paths, distinction between arithmetic and concept mistakes, insufficient evidence, no answer disclosure, untrusted learner input, and concise feedback.
- `ai/schemas/diagnosis-result.v1.json`: bounded strict candidate schema; provider-facing local concept indices map to internal concept codes.
- `src/assessment/ai-diagnosis.ts`: stable catalog context, random learner delimiter, heuristic contact/NIK redaction preserving UTF-16 offsets, strict schema decoding and existing domain validation. Rejects unknown/duplicate indices, unsupported references, incorrect misconception codes, contradictory correct/misconception results, literal accepted-answer forms in rationale, and contact details in rationale. Low-confidence evidence is downgraded.
- Fixture-only engine exercises the preparation and decoder through the existing `DiagnosisEngine` interface. No database access, network adapter, SDK, provider credentials, new endpoints, or FE changes.
- Explicit integration blockers exported as `AI_INTEGRATION_BLOCKERS`; these are development module metadata, not an added API response field.

## Verification

Seven offline tests pass: grounded fixture, injection context isolation, schema/index rejection, unsupported claims, low confidence/contradiction, redaction/key leakage, input type/abort. Tests check prompt construction and malicious output validation; they do not establish that an actual model resists injection or diagnoses accurately. Initial sandbox tsx startup failed at Windows user-info lookup; the approved outside-sandbox test run passed 7/7.

## Remaining before connecting real AI

The example uses DeepSeek despite its Claude naming; the architecture proposes Anthropic. Provider/model selection and privacy/retention/transfer decisions remain open, not implicitly approved by this implementation. External AI remains disabled.

An approved provider adapter still needs worker invocation accounting, budgets, circuit breaker, failure classification, provider contract tests, reviewed synthetic gold-set evaluation, disclosure, and end-to-end consent/revocation tests. Existing consent and adoption fences must remain in force. No API key alone should enable this path.

Redaction is heuristic: names, schools and novel identifiers are not comprehensively detected. Literal answer matching does not catch paraphrases or all equivalent mathematical forms. The prompt is a development draft, not a verified safety filter. These limitations block real-data/provider activation. No production readiness or new content approvals are claimed.

Run offline checks: `node node_modules/tsx/dist/cli.mjs --test test/ai-diagnosis.test.ts`.
