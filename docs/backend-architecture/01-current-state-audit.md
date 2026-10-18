# 01 · Current-state audit

**Backend Architecture Specification v1 · status: proposed (architecture only).** Audit date 2026-10-17. The source code was audited at `d74b52d`; the later commit `efe1a93` adds only the earlier draft of this package, and no source file changed since. Nothing in this package implements a service, runs a migration or changes a frontend contract.

Reading order: this audit → [02 system architecture](02-system-architecture.md) → [03 domain](03-domain-model.md) → [04 ERD](04-postgresql-erd.md) → [05 state machine](05-learning-state-machine.md) → [06 diagnosis & mastery](06-diagnosis-evidence-mastery.md) → [07 AI](07-ai-integration.md) → [08 auth & privacy](08-auth-security-privacy.md) → [09 API](09-api-design.md) + [openapi.yaml](openapi.yaml) → [10 ADRs](10-architecture-decisions.md) → [11 tests](11-test-matrix.md) → [12 roadmap](12-implementation-roadmap.md).

## 1. Bottom line

1. **There is no backend.** The repository is a Vue 3 + TypeScript + Vite SPA. `package.json` has no server framework, database driver, ORM or migration tool. No server entry point, SQL file or schema exists. `VITE_API_BASE_URL=http://127.0.0.1:8000` is a client default, not evidence of a running service.
2. **The frontend already speaks an HTTP contract.** It defines 9 endpoints in 3 adapters (§4) that nothing serves yet. They are consumer-side contracts with runtime shape checks and 29 passing consumer tests. They are not a server design: no idempotency, no CSRF token, client-generated session IDs, and synchronous tutor/OCR calls under a 1.8 s timeout.
3. **All learning state is client-side today**: module memory, `sessionStorage`, `localStorage` and IndexedDB. None of it is trustworthy evidence. The browser ships the answer keys and runs the grading.
4. **Product decisions already exist** in the planning blueprint (`intiverse-backend-blueprint (1).json`, 2026-10-15, 21 decisions) and its review (`review-blueprint-terisi-vs-fe.md`). This specification treats them as requirements (§6). Where it deviates, it says so.
5. **The users are children.** Indonesian law treats under-18s as children (§7). That one fact reorders the roadmap: consent and identity come before any server-side persistence of learner data.

## 2. Classification of every capability

Legend: **Real** = implemented and exercised in the shipped SPA · **Local-only** = works, but state lives in the browser · **Mocked** = labelled demo/fallback behaviour · **Service-pending** = UI and adapter exist, server missing · **Unimplemented** = neither UI logic nor server.

| Capability | Where | Status | Notes for the backend |
|---|---|---|---|
| Routing (`/`, `/coba`, `/soal-tadi`, `/core/:id`, `/kenalan`, `/tanya`, `/challenge`, `/latihan/soal`, `/home`, `/pick`, `/latihan`, `/progress`, `/profile`, `/diagnosis`, `/mastery`) | `src/router/index.ts` | Real | Navigation is not authorization. All routes are public. |
| Canonical question loop (S1–S10) | `views/CobaView.vue`, `composables/useCobaFlow.ts` | Real UI, local state | Module-level singleton. `reset()` on every mount. Numeric steps (3 question, 4 lesson, 7 retry) are UI positions, not domain states. |
| Deterministic diagnosis of the tower question | `services/analysis.ts` (`analyze`, `demoCoreEvidence`) | Mocked (demo fallback) | Seven authored branches. Good seed for a server-side deterministic evaluator. Not a general diagnoser. |
| Deterministic diagnosis of the ladder question (Tanya soal sample) | `services/analysis.ts` (`analyzeTangga`) | Mocked (demo only) | Same as above. |
| Diagnosis transport (one run, POST + GET polling, `Retry-After` clamp 250 ms–10 s, max 8 polls, resume same run) | `services/learningBackend.ts` | Service-pending | Sound async pattern. No `Idempotency-Key`. Accepted runs never fall back to demo. |
| Answer checks / practice / retry verdicts (`correct: true\|false\|null`, `unreadable`) | `learningBackend.ts`, `components/coba/CheckBox.vue`, `StepSoalTadi.vue` | Service-pending (demo fallback in dev) | `null` must not consume a retry. Already tested. |
| Authored solution | `POST /v1/learning/solution` adapter | Service-pending | Must record solution exposure server-side (blueprint A04). |
| Hints (3 authored steps per question) | `components/coba/HintWalk.vue`, `data/coba.ts` `HINT` | Real UI, local | `hint_open` tracked locally only. The server must record exposure. |
| Micro-lessons (2 slides + 1 check), core lessons with practice | `StepMateri.vue`, `CoreSheet.vue`, `CoreView.vue`, `data/coreLessons.ts` | Real UI, local | Lesson checkpoint (slide index) is not persisted. Blueprint T02 requires resume. |
| Practice sets, combined questions (17 items) | `views/PracticeRunView.vue`, `data/bank.ts` | Real UI, local grading | Answer keys ship in the bundle. Practice items must be served without keys. |
| Session XP, levels, tiers, missions, streak | `composables/useSessionProgress.ts`, `useLearnerView.ts`, `data/gamification.ts` | Local-only (memory) | Rules are a good spec, but client-awarded XP is not trustworthy. |
| Account progress snapshot | `composables/useLearnerProgress.ts` → `GET /v1/me/progress` | Service-pending | Rejects the **entire** snapshot if any core ID is unknown to `findCore` (§4). |
| Registration offer, Google/email start | `components/coba/AccountOffer.vue` → `POST /v1/auth/start` | Service-pending | Only obtains a redirect URL. No callback, session, claim, resume or logout exists. |
| Onboarding (grade, subjects) | `views/OnboardingView.vue`, `useStudyPreferences.ts` | Local-only (memory) | Session-only preferences. |
| IntiBot tutor | `components/coba/TutorDialog.vue`, `services/tutor.ts` → `POST /v1/learning/tutor` | Service-pending, scripted demo | Synchronous request/response under 1.8 s. Client sends history and `hintsUsed`, which the server must not trust. No explicit "this is an AI" disclosure in the UI copy yet (§7). |
| Question intake (photo → OCR, typed → concept mapping) | `views/QuestionIntakeView.vue`, `services/intake.ts` | Service-pending, labelled sample | Client downsizes images to JPEG ≤1600 px and sends a data URL. No upload pipeline, quarantine or scanning. |
| Product analytics | `services/track.ts` | Local-only (+ optional `VITE_TRACK_URL` beacon) | Funnel events in `sessionStorage` (max 300). Must not be used as learning evidence. |
| Legacy Pinia learning model | `stores/learningSession.ts`, `types/*.ts`, `services/diagnosis/*`, `services/answer/*`, `data/questions/*`, `data/cores/*`, `data/curriculum/trigonometry.ts` | **Unreachable** | Used only by `QuestionView`, `RetryView`, `TryView` and `FocusLayout`, none of which is routed. Contains valuable ideas (multi-step diagnostic rules, `untested` vs `gap`, numeric answer matching), reused in [06](06-diagnosis-evidence-mastery.md). Do not persist it as a second source of truth. `TryView` imports a missing `summarizeProgress` (type error). |
| Legacy `POST /diagnose` client | `services/diagnosis.ts` | Dead | `diagnoseAnswer` has no callers. `DiagnosisView` imports only its types. Not a required endpoint. |
| Device persistence (Pinia path, results) | `services/persistence/learningSessionStorage.ts`, `sessionArchive.ts` (IndexedDB), `services/progress.ts` (`intibelajar.hasil`) | Local-only | Editable by the user. May be offered as an unverified import, never as evidence. |
| Beta identity (name, class, **WhatsApp number**) | `services/persistence/betaIdentity.ts` (`intibelajar:beta-identity:v1`) | Local-only | Explicitly never transmitted. Must never be bulk-uploaded. |
| Curriculum graph | `data/curriculum.ts` (4 topics, 55 counted concepts, hard/soft edges, units, cross-topic relations) | Real (static) | Static `state` fields are sample data, not learner mastery. Phase D (SMP) content does not exist. |

## 3. Identifier namespaces (must be reconciled before seeding)

| Namespace | Example | Meaning today | Hazard |
|---|---|---|---|
| Map node ID | `tri-d`, `eks-b` | Curriculum concept on the map (`findCore`) | Used as `mapId` and in `/v1/me/progress`. |
| Lesson route slug | `perbandingan-trig` | `/core/:id` lesson | `CORE_ROUTES` maps both `tri-d` and `tri-e` to it. That is many-concepts-to-one-lesson, **not** concept equality. |
| Legacy Pinia concept | `T04`, `T10`, `T13` | Unrouted model | A separate graph. Do not alias to `tri-*` without content review. |
| Funnel check/practice IDs | `c1`–`c4`, `p1`–`p3` | Funnel items | Sent as `itemId` to `/v1/learning/answers/check`. |
| Bank item IDs | `gab-sin30-pangkat`, `sudut-istimewa:0` | Bank/practice items | Lesson-derived IDs encode array positions. Fragile. |
| Client session ID | `crypto.randomUUID()` | Funnel correlation | Regenerated on reset. Not a credential and not ownership proof. |

Decision for seeding: every catalog entity gets a server UUIDv7 plus a reviewed stable `code`. Existing frontend IDs become **explicit aliases** (`legacy_map_id`, `route_slug`, `legacy_item_id`). They are imported from a reviewed manifest, never inferred. Unknown or ambiguous aliases fail closed. See [03 §3](03-domain-model.md#3-identifiers).

## 4. Existing wire contract (consumer side)

These are the only HTTP calls the frontend makes. Every adapter uses `credentials: 'include'`, JSON bodies, a 1.8 s default timeout (`VITE_API_TIMEOUT_MS`), and runtime shape validation. Assessment mode never falls back to demo. Full shapes and the server-side mapping are in [09 §6](09-api-design.md#6-compatibility-with-the-current-frontend).

| # | Method · path | Adapter | Request essentials | Response essentials |
|---|---|---|---|---|
| L1 | `POST /v1/learning/diagnosis` | `diagnosisRunWithBackend` | `FlowContext` + `responseMode` + `rawText` (+ optional `questionText`, `coreIds` for own questions) | `DiagnosisRun {diagnosisRunId, status: pending\|running\|completed\|insufficient_evidence\|failed, assessment?, items?, clarification?}` |
| L2 | `GET /v1/learning/diagnosis/{diagnosisRunId}` | same | — | Same `DiagnosisRun`. `Retry-After` honoured. |
| L3 | `POST /v1/learning/answers/check` | `checkWithBackend` | `FlowContext` + `attemptId` + `kind: check\|practice\|retry_original` + `itemId` + `answer` (string or option index) | `{correct: boolean\|null, feedback?, correctOptionIndex?, unreadable?}` |
| L4 | `POST /v1/learning/solution` | `solutionWithBackend` | `FlowContext` + `reason: requested\|review_steps\|max_tries\|compare` | `{steps:[{title, body}], after: string[]}` |
| L5 | `POST /v1/auth/start` | `startAuthWithBackend` | `FlowContext` + `provider: google\|email` + `continuation {step, targetPath}` | `{redirectUrl}` (https, or http on localhost) |
| L6 | `POST /v1/learning/tutor` | `tutorWithBackend` | `FlowContext` + `coreTitle` + `script` + `messages[{from: me\|bot, text}]` + `hintsUsed` | `{text, quick: string[], hintsUsed, rewrite?}` |
| L7 | `POST /v1/learning/intake/read` | `readPhotoWithBackend` | `FlowContext` + `imageDataUrl` (JPEG ≤1600 px) | `{text, demo?}` |
| L8 | `POST /v1/learning/intake/map` | `mapQuestionWithBackend` | `FlowContext` + `questionText` | `{subject\|null, topicId\|null, cores: string[], demo?}` |
| L9 | `GET /v1/me/progress` | `useLearnerProgress.refresh` | — (cookie) | `{user: null\|{id, displayName}, cores[{id, exploration, mastery, lessonComplete, transferCorrect, lastPracticedAt?}], activities[{id, title, at}], xp?, streakDays?}`. A 401 means guest. |

`FlowContext = {sessionId, questionId, topicId, hintOpened, diagnosisRunId?, questionText?, coreIds?}`. Every field is client-asserted and none is authority.

Contract facts the backend must respect:

- L1 must answer within ~1.8 s. Long work therefore returns `pending` immediately and continues asynchronously. The client polls L2 at most 8 times automatically, then offers a manual "check again" on the same run ID.
- L3's `attemptId` is regenerated on every call, so it cannot deduplicate a lost acknowledgement. A server facade can only offer best-effort deduplication until the client sends a stable key ([09 §6](09-api-design.md#6-compatibility-with-the-current-frontend)).
- L6, L7 and L8 are synchronous under the same timeout. Real AI and OCR latency will exceed it, so v1 migrates them to asynchronous resources ([09](09-api-design.md)).
- L9: one unknown core ID makes the client discard the **whole** snapshot. The server must emit only aliases known to the shipped frontend build.
- No call sends a CSRF token or an `Idempotency-Key`. The compatibility facade must compensate with exact-Origin and Fetch-Metadata checks ([08 §4](08-auth-security-privacy.md#4-session-cookies-csrf-and-cors)).

## 5. Tests and tooling that exist

| Suite | Runs? | What it proves |
|---|---|---|
| `npm test` (bindings, curriculum, graph, analysis, flow, math-input, demo-safety, gamification) | Yes, passes | Frontend logic and demo isolation (demo never writes progress). |
| `npm run test:backend` (`scripts/backend.test.ts`) | Yes, **29 checks passed** on 2026-10-17 (not part of `npm test`) | Consumer contract: nullable verdicts, no demo fallback in assessment mode, shared run resume, run-ID mismatch, stale-session guard, guest/account projection. Uses stubbed `fetch`. Not a server test. |
| `tests/unit`, `tests/component`, `tests/e2e`, `tests/visual` (Vitest/Playwright specs) | **No.** `vitest` and `@playwright/test` are not installed. | Nothing until runners are added. |
| `npm run build` type check | Effectively a no-op | `vue-tsc` runs against a root `tsconfig.json` with `files: []`. A real check with the `@` alias shows pre-existing errors in legacy files. |

## 6. Product decisions this specification treats as requirements

From the blueprint (`D`, `K`, `A`, `T`) and its review. Every row is traceable in later documents.

| ID | Decision (summary) | Consequence in this spec |
|---|---|---|
| D01 | `/challenge` must work like `/coba` | One question-loop engine for funnel, bank and own questions ([05](05-learning-state-machine.md)). |
| D02 | Guests may browse the bank and IntiVerse and try questions, but **their progress is not saved**. The account offer comes after one `/coba` loop. | Guest learning stays on the device or is evaluated statelessly. No server guest learner records in MVP ([08 §2](08-auth-security-privacy.md#2-who-can-do-what)). |
| D03 | Design canonical core IDs | UUIDv7 + stable code + reviewed alias manifest ([03](03-domain-model.md)). |
| D04 | `correct`, `lessonComplete`, `practiced`, `demonstrated` are different things | Separate fields. Mastery is a projection ([06](06-diagnosis-evidence-mastery.md)). |
| D05 | Guest identity and continuation: "BE knows better" | Device-only guest plus verified import ([08](08-auth-security-privacy.md)). Continuation stored server-side for login. |
| D06 | `attemptId`, `diagnosisRunId` are UUIDv7. Evidence refs and uncertainty are explicit. | Adopted ([06 §2](06-diagnosis-evidence-mastery.md#2-diagnosis-contract)). |
| D07 | Timeout → ≤2 technical retries with backoff and jitter. Unavailable → circuit breaker. Invalid schema → reject, optionally one regeneration. **A fallback must never invent a gap.** | One retry layer only, in the job worker ([07 §5](07-ai-integration.md#5-reliability-timeouts-retries-and-failure-handling)). |
| D08 | Idempotency for resubmits, optimistic concurrency for stale tabs | `Idempotency-Key` + `expectedStateVersion` ([05 §5](05-learning-state-machine.md#5-concurrency-idempotency-and-interruption)). |
| D09 | `/home`, `/progress`, `/profile` show the account offer for guests | Guest views need no server data. |
| D10 | 1800 ms is an adapter timeout, not an SLA | Targets set separately ([02 §6](02-system-architecture.md#6-non-functional-targets-provisional)). |
| K01 | Questions have multiple **solution paths**. Each step maps to concepts. A different valid strategy is never a mistake. | `rubric.solutionPaths[]` with per-step concept mapping ([03](03-domain-model.md), [06](06-diagnosis-evidence-mastery.md)). |
| K02 | Exponent × trigonometry in one question is `QUESTION_APPLICATION`, non-directional, not a prerequisite | Derived from question–concept mappings, never written as a prerequisite edge. |
| K03 | Each core has a definition, objectives, misconceptions and prerequisites | Concept fields ([04](04-postgresql-erd.md)). |
| K04 | Gold set: correct diagnosis vs insufficient evidence vs unsupported claim | AI evaluation gates ([07 §8](07-ai-integration.md#8-evaluation-before-launch), [11](11-test-matrix.md)). |
| K05 | DEMONSTRATED = **3/3** independent transfer questions, **no assistance**, **≥2 contexts**, **≥1 in a separate session (ideally ≥24 h later)**. On failure, stay DEVELOPING and remediate. | Mastery policy `mastery-v1` ([06 §6](06-diagnosis-evidence-mastery.md#6-mastery-policy-mastery-v1)). The staged draft's "two families" rule is replaced. |
| A01 | One shared diagnosis run: `POST /v1/attempts/{attemptId}/diagnosis`, `GET /v1/diagnosis-runs/{id}` | Adopted as canonical paths. Attempt submission also enqueues automatically ([09](09-api-design.md)). |
| A03 | Attempt carries `contentVersion`, `kind`, `assistance`, nullable `correct`, `unreadable` | Adopted ([04](04-postgresql-erd.md)). |
| A04 | Record solution exposure when shown. It affects evidence **eligibility**, never correctness. | `assistance_event` table ([04](04-postgresql-erd.md), [06](06-diagnosis-evidence-mastery.md)). |
| A05 | Verified OAuth (PKCE) → atomic claim → resume at the last checkpoint (not `/home`). `409 GUEST_ALREADY_CLAIMED` on a double claim. | Adopted, with a device import instead of a server guest claim ([08 §5](08-auth-security-privacy.md#5-device-guest-to-account-migration)). |
| T01 | 12 acceptance scenarios plus a Go/No-Go rule | Mapped one-to-one in [11 §3](11-test-matrix.md#3-blueprint-acceptance-t01t02-traceability). |
| T02 | Resume, claim and Map/Home consistency | Same. |

Conflict resolved here: D02 (no guest progress saved) vs T02 ("browser reopened → guest session restored"). This spec restores **device-held** guest sessions after a reopen. That satisfies T02 without server storage, and the UI must state that the progress is on this device only ([08](08-auth-security-privacy.md)).

## 7. Legal context that changes the architecture

Reviewed sources, accessed 2026-10-17. Details and limits are in [08 §7](08-auth-security-privacy.md#7-indonesian-legal-baseline-reviewed-sources).

- **UU 27/2022 (PDP):**
  - Children's data is *specific personal data* (Pasal 4(2)(e)).
  - Processing it requires parent/guardian consent (Pasal 25).
  - Breach notification is due within 3 × 24 hours (Pasal 46).
  - Cross-border transfer rules are in Pasal 56.
- **PP 17/2025 ("PP Tunas"):**
  - A child is anyone under 18.
  - Products likely accessed by children must do the following:
    - publish a minimum age and verify age;
    - self-assess risk;
    - obtain parental consent before use;
    - default to high privacy;
    - not profile children, except for features the child requests and in their best interest;
    - complete a DPIA and appoint a data protection officer.
  - The compliance window is 2 years from 27 March 2025. Implementing regulation: Permenkomdigi 9/2026.
- **Anthropic API, products serving minors:**
  - Disclosing that users are talking to an AI is mandatory.
  - Compliance with child-safety and privacy law is mandatory.
  - Age verification, moderation, monitoring and safety education are recommended.

Effect on the design: no learner data persists on the server, and nothing is sent to an AI provider, until the account has verified guardian consent. Consent therefore moves into **Slice 0**, ahead of everything else ([12](12-implementation-roadmap.md)).

## 8. Relationship to the previously staged draft

An earlier draft of this package was committed in `efe1a93` (2026-10-17), so it stays available in git history. It was reviewed and used as input. This version keeps its sound parts:

- module boundaries;
- the four evidence classifications;
- leased PostgreSQL jobs;
- the deferred active-attempt FK;
- the `/v1` compatibility analysis;
- verified-OIDC sessions.

It changes the following:

- (a) **Adopts the blueprint decisions above.** The draft did not reference them. Most visibly, K05 mastery and the A01/A05 API naming.
- (b) **Canonical resources move to `/v1` with new paths instead of a premature `/v2`.** No version of the API has ever been served. The existing adapter endpoints remain as a deprecated `/v1/learning/*` facade.
- (c) **Device-only guests instead of server guest principals,** per D02 and PP 17/2025.
- (d) **Adds the missing entities:** assistance/exposure events (A04), solution paths (K01), guardians, XP/streak projection, practice sessions and intake.
- (e) **Retains minimized evidence summaries** instead of downgrading mastery when raw answers expire.
- (f) **Replaces the generated OpenAPI with a hand-maintained contract and an offline validator** that cross-checks the documents. The draft's `generate-openapi.py` is removed, because running it would overwrite the contract.
