# 11 · Test matrix

Every invariant ([03 §8](03-domain-model.md#8-domain-invariants)), every transition ([05 §4.2](05-learning-state-machine.md#42-transition-table)) and every blueprint acceptance scenario (T01, T02) maps to at least one automated test. **None of these tests exist yet**: this is the plan the implementation must satisfy. The only backend-related tests that run today are the 29 consumer-contract checks in `npm run test:backend` ([01 §5](01-current-state-audit.md#5-tests-and-tooling-that-exist)).

## 1. Levels and tooling

| Level | Tooling (proposed) | Runs |
|---|---|---|
| Unit | Vitest | Every commit |
| Property-based | `fast-check`: model-based state machine tests, projection replay | Every commit |
| Integration | Fastify `inject` against a real PostgreSQL 16 (CI service container); the fake AI adapter | Every commit |
| Contract | Every integration response validated against [openapi.yaml](openapi.yaml). The **frontend's own validators** (`isRun`, `isCheck`, `isSolution`, `isTutorReply` in `src/services/learningBackend.ts`, and the snapshot check in `useLearnerProgress.ts`) used as oracles for facade responses. `npm run test:backend` pointed at a running facade. | Every commit |
| Migration | Empty database → head; previous release snapshot → head; `validate-spec.py` cross-checks of the documents | Every commit |
| End-to-end | Playwright (not installed today; added in Slice 1) | Before merge to main |
| AI evaluation | Gold set through the Batch API ([07 §8](07-ai-integration.md#8-evaluation-before-launch)) | On every prompt, schema or model change |
| Load and resilience | k6 plus fault injection | Before the pilot and before each release candidate |
| Security | Authorization and CSRF matrix (automated), external penetration test | Every commit / before launch |

Test IDs below (`INV-xx.n`, `E-xx`, `T01-n`) are the names the implementation should use, so failures trace back to this document.

## 2. Invariants → tests

| Invariant | Tests |
|---|---|
| INV-01 ownership, `404` for others | **.1** For every learner-scoped endpoint in the contract, a second learner's resource IDs return `404`, byte-identical to a non-existent ID. **.2** Generated from `openapi.yaml`, so new endpoints are covered automatically. **.3** Guardian sees only linked learners. |
| INV-02 persistence needs `ACTIVE` + `LEARNING_DATA` | **.1** Commands from `PENDING_CONSENT` → `403 CONSENT_REQUIRED`, zero rows written. **.2** The pending bootstrap is erased after 7 days (controlled clock). **.3** A command after revocation → `403`, zero rows. |
| INV-03 AI only with `AI_PROCESSING`, redacted | **.1** Consent revoked between enqueue and call → the fake adapter receives no call; the run fails with `CONSENT_REVOKED`. **.2** Redaction unit tests: Indonesian phone formats, emails, URLs, 16-digit numbers. **.3** No C2 field appears in any gateway input (schema of the gateway input). |
| INV-04 immutable content, pinning | **.1** Editing a published question creates a new revision; the old session resumes with the old revision (T02 resume row 5). **.2** The application role has no `UPDATE` grant on published revisions. |
| INV-05 no keys in learner responses | **.1** Schema check: no learner-facing schema contains rubric fields. **.2** Scan every catalog response for the item's final-answer forms. **.3** `OPEN_TRIAL` exception only on `public/evaluations`, and only for `PUBLIC_PRACTICE` items. |
| INV-06 legal transitions, version +1 | **.1** Model-based property test: random command sequences against a reference model of [05](05-learning-state-machine.md). Illegal → `409`, zero writes, version unchanged. Legal → version + 1 exactly when the state changes or an attempt is stored. **.2** Job completions follow the same rule. |
| INV-07 attempts immutable | **.1** No update path in the API. **.2** The application role cannot update `response`, `kind`, `question_revision_id` or `assistance`. |
| INV-08 one active run per attempt | **.1** Concurrent `REQUEST_DIAGNOSIS` calls create at most one run (partial unique index). **.2** Terminal runs reject updates. |
| INV-09 evidence cites only real spans and mapped concepts | **.1** Validator unit tests with crafted candidates: invented span, wrong quote, unmapped concept, unknown misconception code, missing rationale → rejected. **.2** Composite foreign keys reject cross-learner evidence. |
| INV-10 AI-only evidence not mastery-eligible | **.1** Eligibility unit tests. **.2** The database `CHECK (NOT mastery_eligible OR source <> 'AI')` rejects violations. |
| INV-11 replayable projections | **.1** Property test: shuffled insertion orders → identical `mastery_state` and `learner_stats`. **.2** Incremental projection equals a full rebuild. |
| INV-12 exposure never changes verdicts | **.1** The same response graded before and after hint and solution exposure → same verdict, different eligibility. |
| INV-13 anchor and retries never transfer | **.1** `INITIAL`, `CLARIFICATION`, `RETRY` and `QUICK_CHECK` evidence always has `transfer_eligible = false` with a reason code. |
| INV-14 idempotency | **.1** Same key and payload → same status and body, plus `Idempotency-Replayed`. **.2** Different payload → `409 IDEMPOTENCY_KEY_REUSED`. **.3** Concurrent same key → one wins, the other `409 IDEMPOTENCY_IN_PROGRESS`. **.4** A crash injected before commit → the retry executes once. |
| INV-15 XP only from server rules, once | **.1** No endpoint accepts XP (contract scan). **.2** Replays and concurrent completions award once (unique `event_key`). **.3** Rule table tests for all six XP rules, including "no XP after the solution was seen" and "no XP for AI-graded verdicts". |
| INV-16 `UNREADABLE` never counts | **.1** E-20 keeps `unsuccessful_retries`. **.2** An unreadable quick check does not complete it. **.3** No negative evidence is written. |
| INV-17 hard edges form a DAG; applications never lock | **.1** Publishing a cycle fails. **.2** A combined item creates no `concept_prerequisite` row. |
| INV-18 no final answer from the tutor before the gate | **.1** Filter unit tests with each rubric's answer forms. **.2** Gold-set leak suite = 0. **.3** The gate requires the server's `hints_used ≥ 2`; the client's `hintsUsed` is ignored. |
| INV-19 erasure is complete | **.1** Seed one learner in every learner-owned table and object store, erase, then query every column named `learner_id` (from `information_schema`) plus guardian, identity and object rows → zero rows; one receipt. **.2** Restore drill: receipts replayed before traffic. |
| INV-20 consent attributable, revocation immediate | **.1** A decision stores who, when, policy version and text hash. **.2** After revocation, the next command fails, and a late job result is discarded. |
| INV-21 imported history never eligible | **.1** An imported session's attempts have no runs or evidence. **.2** `REQUEST_DIAGNOSIS` on an imported attempt → `409`. **.3** Mastery after import is unchanged. |
| INV-22 server time | **.1** Skewed client clocks change nothing. **.2** Streak days follow the learner's timezone. |

## 3. Blueprint acceptance (T01/T02) traceability

### 3.1 T01: the 12 mandatory backend scenarios and Go/No-Go

From blueprint decision T01 ("Uji vertical slice dan failure modes").

| # | Scenario (blueprint) | Test | Design reference |
|---|---|---|---|
| T01-1 | Submit answer: stored as an attempt with a unique ID and the right question version | `POST …/attempts` → `201` with a UUIDv7 attempt that pins the session's revision. A second identical request is a replay. | E-03, INV-04, INV-07 |
| T01-2 | Correct diagnosis: the 2³ = 6 error leads to the exponent concept, not automatically to trigonometry | Bank item `gab-pangkat-cos60`: the option produced by 2³ = 6 → misconception on `eks-b` (blueprint EXP-01), `tri-f` `NOT_ASSESSED` | [06 §10](06-diagnosis-evidence-mastery.md#10-worked-example-the-tower-question) |
| T01-3 | Insufficient evidence: a wrong final answer without working → `INSUFFICIENT_EVIDENCE`, not a definite misconception | Tower item, response `40` → every concept `INSUFFICIENT_EVIDENCE`, state `CLARIFICATION_NEEDED` | E-05, 06 §10 |
| T01-4 | Diagnosis failure: timeout, provider down or invalid schema produce no fake diagnosis; the learner gets a fallback | Fake adapter: 3 timeouts; 529s until the circuit opens; invalid output twice; a refusal. Each → no evidence rows, run `FAILED` or insufficient, session `EVALUATION_FAILED` or `CLARIFICATION_NEEDED`, resumable. | [05 §5.4](05-learning-state-machine.md#54-partial-ai-failures-blueprint-d07), [07 §5](07-ai-integration.md#5-reliability-timeouts-retries-and-failure-handling) |
| T01-5 | Retry after timeout: the same `clientAttemptId` creates no duplicate | Same `Idempotency-Key` after a dropped response → one attempt, one run | INV-14 |
| T01-6 | Microlearning checkpoint survives a refresh | `ADVANCE_LESSON` to slide 2, new client → `GET` session shows slide 2 | E-12 |
| T01-7 | Correct grading: a wrong answer stays wrong; no demo bypass | Strict schemas reject client verdict fields; the facade ignores demo flags; a wrong answer → `INCORRECT` in every mode | §5, INV-12 |
| T01-8 | Mastery: lesson complete plus a correct retry does not make `DEMONSTRATED` | After E-14 and E-17: status `DEVELOPING`, tier ≤ 1 | [06 §6](06-diagnosis-evidence-mastery.md#6-mastery-policy-mastery-v1) |
| T01-9 | Solution exposure: a retry after seeing the solution is not independent transfer | After E-21 or the tutor gate: later attempts in the family → not mastery-eligible (`SOLUTION_SEEN`), no XP | [06 §5](06-diagnosis-evidence-mastery.md#5-eligibility-and-exposure) |
| T01-10 | Guest to account: verified login, idempotent claim, nothing lost or duplicated | Device import replayed with the same key → same session. Re-import by key or by another account → `409 ALREADY_IMPORTED`. The device copy stays until marked. | [05 §5.5](05-learning-state-machine.md#55-login-in-the-middle-of-a-loop-guest--account), [08 §5](08-auth-security-privacy.md#5-device-guest-to-account-migration) |
| T01-11 | Two stale tabs: an old `stateVersion` gets `409`; nothing is overwritten | Two clients, same version, different keys → one `201`, one `409 STALE_STATE_VERSION` | INV-06 |
| T01-12 | Unknown core ID → `404`; the exponent–trigonometry link on the sample is `QUESTION_APPLICATION`, not a prerequisite | `GET /v1/concepts/{unknown}` → `404`; `GET /v1/concepts?legacyMapId=unknown` → empty list; no prerequisite edge from the combined item | INV-17, K02 |

**Go/No-Go** (blueprint): GO only if all 12 pass reproducibly in CI against a real PostgreSQL, with no bypass of verdicts, diagnosis, authentication or mastery, with data consistent after timeouts, refreshes, retries and parallel requests, and with every diagnosis traceable to `attemptId`, `diagnosisRunId`, evidence references and content version. One extra test (**T01-GO**) queries a random sample of runs and asserts that all four links exist. Any failure in diagnosis-without-evidence, false mastery, lost progress or duplicate attempts is NO-GO.

### 3.2 T02: resume, guest claim and Map/Home consistency

From blueprint decision T02.

| Group | Scenario | Test | Notes |
|---|---|---|---|
| Resume | Lesson at step 3, refresh → back at step 3 | T01-6 for core lessons (`PRACTICE` with lesson) | — |
| Resume | Browser closed and reopened → valid guest session restored | Frontend E2E: device storage restores the guest loop | Device-held, per [01 §6](01-current-state-audit.md#6-product-decisions-this-specification-treats-as-requirements) |
| Resume | Diagnosis pending at refresh → same `diagnosisRunId` | `GET` session returns `activeDiagnosisRunId`; polling continues the same run | §5.3 of 05 |
| Resume | Two tabs → old version rejected, newer checkpoint kept | T01-11 plus `ADVANCE_LESSON` races | — |
| Resume | Question edited after the session started → resume uses the original version | INV-04.1 | — |
| Claim | Guest learns, then signs in with Google → progress linked to the right account | Sign-in → consent → import → session at the device's step | Imported history is never evidence (INV-21) |
| Claim | Sign-in cancelled → guest progress still available | Cancel at the provider → device state untouched; the pre-auth transaction expires | — |
| Claim | Callback or claim sent twice → no duplicates | Second callback → transaction already consumed, no new session; import replay → same session | — |
| Claim | Account already has progress → merge; old evidence kept | Import adds sessions and deletes nothing | — |
| Claim | Guest already claimed by another account → `409` | `409 ALREADY_IMPORTED` (the blueprint's `GUEST_ALREADY_CLAIMED` role) | Deviation in code name: there is no server guest to claim ([08 §5](08-auth-security-privacy.md#5-device-guest-to-account-migration)) |
| Claim | Sign-in while a lesson sheet is open → back at the checkpoint, not `/home` | Continuation route + session checkpoint restored after the callback | Blueprint A05 |
| Map/Home | Map and Home read one source | `/v1/me/progress` and `/v1/me/mastery` both derive from `mastery_state`; compare for 1,000 random evidence histories | [06 §6.5](06-diagnosis-evidence-mastery.md#65-ui-tiers-single-server-rule-for-both-apis) |
| Map/Home | `VISITED` ≠ `DEMONSTRATED`; `lessonComplete` does not raise mastery | Projection tests | — |
| Map/Home | Home counts unique concepts with valid evidence, not clicks or static nodes | The seed imports no static `state` values ([04 §9](04-postgresql-erd.md#9-migration-strategy)); counts come from `mastery_state` | Blueprint T02 acceptance: no sample mastery in real progress |
| Map/Home | Unknown core ID → `404`, never a fallback lesson | T01-12 | — |
| Map/Home | After the claim, Map and Home still agree | Run the comparison test after an import | — |

**The mandatory end-to-end test (T02-E2E)**, adapted to device-only guests and consent first. Each adaptation is deliberate and explained in [08](08-auth-security-privacy.md):

1. A guest answers the combined exponent × trigonometry item on the device (or through `OPEN_TRIAL`). The **deterministic** evaluator finds the exponent misconception. AI is not used for guests (INV-03).
2. The guest opens the micro-lesson and reaches step 3. After a refresh, the device restores step 3.
3. The guest finishes the lesson. Mastery is not `DEMONSTRATED`.
4. The guest signs in with Google; the guardian consents; the device history is imported. The session resumes at the same checkpoint.
5. **Adaptation:** imported history makes `eks-b` `VISITED` with `lessonComplete = true` (tier 0, Dicoba), not `DEVELOPING`, because device grading is not evidence. The learner then answers one question on the server, and that server-graded evidence makes `eks-b` `DEVELOPING`.
6. Map and Home show the same tier for `eks-b`.
7. Sign out and in again: progress is unchanged.

### 3.3 Handoff scenarios T01–T14 (`handoff-flow-fe-be-sa.md`)

| Handoff | Covered by |
|---|---|
| T01 wrong answer → popup → fix | E-07, E-15–E-17. "Original text kept" is a frontend draft test. The completion event payload records the engine. |
| T02 server says `correct=false` while the demo bypass is on | T01-7 and the existing `demoSafety` tests |
| T03 server not responding | Consumer suite (strict mode shows error or pending; no silent success) |
| T04 unreadable and solution | INV-16, E-19, E-21, T01-9 |
| T05 gate result → chosen core | Continuation allow-list test: sign-in from a core returns to that core |
| T06 second core gate | `PRACTICE` resume at the next pending item; the lesson is not repeated (E-22) |
| T07 auth callback and claim | T02 Claim rows |
| T08 refresh and two tabs | T01-11, 05 §5.3 |
| T09 map click and parameter change | Alias resolution `legacyMapId` → concept → `routeSlug`; unknown → `404` |
| T10 progress consistent across pages | T02 Map/Home rows |
| T11 topics other than trigonometry | Creating a session for a `PLANNED` topic → `409 CONTENT_UNAVAILABLE`; catalog availability flags |
| T12 `/diagnosis` URL without data | `GET` unknown run → `404`; frontend shows recovery, never a "kuat" claim |
| T13 direct URL as guest | `401` / `404` per INV-01; no other learner's data |
| T14 timeout after commit | T01-5 |

## 4. State machine

| Transition IDs | Test |
|---|---|
| E-01–E-02 | Creation guards: consent, published or owned revision, server-chosen practice items, `TRANSFER` role assignment |
| E-03–E-09 | Each job outcome from `DIAGNOSING` and `VERIFYING`, inline and queued, with lease, generation and active-attempt fencing |
| E-10 | Re-run only from `EVALUATION_FAILED`, at most 3 generations, otherwise the existing run is returned |
| E-11–E-15 | Lesson assignment, slide checkpoint, required checks, "answer once" rule, skip paths for both session kinds |
| E-16–E-21 | Retry allowance (2), unreadable retries, automatic `SOLUTION_REVIEWED` on the second failure, review from `COMPLETED` without a version bump |
| E-22 | Practice order, skip, last item completion, unreadable keeps the item pending |
| E-23–E-26 | Hint idempotency per step, abandon, expiry sweeper, checkpoint without a version bump |
| §4.5 of 05 | Every listed illegal transition → its error code and zero writes |

The model-based property test (INV-06.1) covers sequences; the table above covers each transition's effects.

## 5. API contract and compatibility

- Every integration test validates the response against `openapi.yaml` (status, headers, body).
- **Per endpoint** (generated from the contract): unauthenticated → `401`; missing CSRF token → `403`; missing `Idempotency-Key` on commands → `400`; unknown body field → `400`; error envelope shape.
- **Facade (L1–L9):** responses pass the frontend's own runtime validators; `npm run test:backend` passes against the facade; alias rule: no alias outside the frozen set ever appears; L7 returns `403 FEATURE_DISABLED`; L6 never calls the AI gateway.
- **Gaps** in [09 §6.5](09-api-design.md#65-known-compatibility-gaps-explicit-not-silent) each have a test that pins the documented behaviour, so a change is visible.

## 6. Concurrency and idempotency

- Lease expiry and recovery; a recovered job keeps its call budget.
- Adoption fencing: late results after `ABANDON`, expiry, a new generation, consent revocation and deletion are discarded.
- Deadlock freedom: concurrent commands across sessions, projections and budgets follow the lock order ([04 §7](04-postgresql-erd.md#7-concurrency-and-idempotency)); stress test with randomised timing.
- Budget reservation races never exceed the cap.

## 7. Security and privacy

- CSRF and `Origin` matrix, including the facade's compensating checks.
- Session cookie flags, rotation on sign-in, revocation on logout, deletion and consent revocation.
- Open-redirect tests on the continuation (`targetPath` outside the allow-list → `400`).
- Rate limits on sign-in, email links, attempts, tutor and public evaluations.
- Uploads: wrong magic bytes, oversized images, images with GPS metadata (stripped after re-encoding).
- **Log canary:** requests carrying a unique canary string in answers and tutor messages; the test fails if the canary appears in any log or trace.
- Consent flows: link expiry, reuse (`410 LINK_EXPIRED`), decline → erasure, revocation per purpose.
- Staff access writes `audit_event`.

## 8. AI evaluation

The launch gates in [07 §8](07-ai-integration.md#8-evaluation-before-launch). In CI, every AI path runs against fixture-driven fake adapters, so integration results are deterministic (the blueprint's own recommendation). Real-model quality is measured separately on the reviewer-labelled gold set.

## 9. Data, migration and erasure

- Migrations: empty → head and previous snapshot → head, then all integration tests.
- Document cross-checks by `validate-spec.py`: ERD relationships vs DDL foreign keys, state names in 05 vs the DDL `CHECK` vs the contract, endpoint table in 09 vs the contract, error codes, links ([verification.json](verification.json)). Its `--self-test` mode applies one targeted mutation per check to a temporary copy and expects exactly that check to fail, so a passing run is not a vacuous one.
- Erasure completeness (INV-19.1) and restore drill (INV-19.2).
- Retention jobs: answer-text purge at 180 days keeps evidence and mastery unchanged; tutor-message purge; image deletion within 24 hours.

## 10. Performance and resilience

- k6 at 150 concurrent learners: read p95 < 250 ms, command p95 < 400 ms, inline deterministic diagnosis p95 < 300 ms ([02 §6](02-system-architecture.md#6-non-functional-targets-provisional)).
- AI under load with the fake adapter adding realistic latency: 95 % of runs terminal within 30 s, none after 90 s.
- Faults: kill the worker mid-call, fail over the database, provider outage (circuit opens, deterministic learning continues).

## 11. Release gates

Each slice in [12](12-implementation-roadmap.md) lists the tests that must pass to exit it. The pilot release additionally requires T01 Go, the T02 end-to-end test, the AI gates (if AI is enabled), and the privacy launch gates in [08 §6.5](08-auth-security-privacy.md#65-accountability-launch-gates).
