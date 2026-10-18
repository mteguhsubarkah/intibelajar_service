# Slice 0 implementation report

Date: **2026-10-18**. Scope: safe, synthetic, local development only.
**No production readiness claim, deployment, real student data, external email,
real identity/guardian verification, or external AI calls.**

The authoritative baseline was architecture documents **01–12**, `openapi.yaml`,
`verification.json`, and `validate-spec.py` in `docs/backend-architecture/`.
Superseded drafts were not used. Those baseline files were not rewritten.
The Vue checkout used was `C:/Users/User/Documents/teguh/learningJourney/mockup/intibelajar`.

## 1. Implemented modules and endpoints

| Module | Implemented behavior |
|---|---|
| Application/platform | Fastify bootstrap; loopback-only validated configuration; PostgreSQL pool; migration checksums/advisory locking; strict OpenAPI-derived request validation; canonical safe errors; body limits; structured allow-listed request logs; local OpenTelemetry spans; disabled feature registry; graceful connection shutdown |
| Identity | Hash-only opaque sessions, CSRF derivation/verification, idle/absolute expiry, rotation at sign-in, logout current/all, server-held route continuation, transaction-bound one-time email-link simulation |
| Privacy | Minimum onboarding, derived age bands without storing birth year, per-purpose consent requests/decisions/revocation, exact synthetic policy hash, linked-guardian ownership, transaction-local eligibility checks and session revalidation, immediate processing stop, deletion requests/audit |
| Jobs/erasure | PostgreSQL deletion jobs, `SKIP LOCKED` leasing, expiry recovery and lease-token fencing, atomic child-to-parent Slice 0 erasure, digest-only receipts, pending-bootstrap expiry, restored-subject detection and receipt replay |
| Development | `.invalid` identities only for simulated email; encrypted local mailbox; explicit fixture CLI; no public fixture/login bypass endpoint |

Implemented canonical operations retain the baseline success schemas:

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/v1/auth/session` | Visitor or authenticated principal, missing consent, CSRF token |
| POST | `/v1/auth/start` | Existing `{redirectUrl}` shape; synthetic email only when opted in; Google blocked |
| GET | `/v1/auth/callback/{provider}` | Explicit unconfigured-provider blocker; no simulated Google verification |
| POST | `/v1/auth/email/links` | Synthetic mailbox transport or integration blocker; accepted response does not enumerate accounts |
| POST | `/v1/auth/email/verify` | POST consumes one transaction/session-bound token; rotates cookie |
| POST | `/v1/auth/logout` | Current/all session revocation, 204 |
| GET, PATCH | `/v1/me/profile` | Own profile; minimum pending onboarding; strict field validation |
| GET | `/v1/me/consents` | All four purposes, including `NOT_REQUESTED` |
| POST | `/v1/me/consent-requests` | Idempotent, one pending record per requested purpose |
| POST | `/v1/me/consents/{purpose}/revocation` | Optional purposes only; learner uses DELETE account for learning-data withdrawal |
| DELETE | `/v1/me` | Immediate processing stop/session revocation, asynchronous erasure |
| GET | `/v1/guardian-consents/{token}` | Exact synthetic policy and requested purposes; GET consumes nothing |
| POST | `/v1/guardian-consents/{token}/decision` | Explicit choice for every requested purpose; attestation; policy version/hash validation; idempotent replay |
| GET | `/v1/guardian/learners` | Linked learners and consent status only |
| POST | `/v1/guardian/learners/{learnerId}/consents/{purpose}/revocation` | Linked ownership required; learning-data withdrawal schedules erasure |
| POST | `/v1/guardian/learners/{learnerId}/deletion-requests` | Linked ownership and idempotency required |
| GET | `/health/live`, `/health/ready` | Liveness; DB version, all 13 tables, migration checksums, restore-replay gate, feature/integration blockers |

The seven legacy learning operations and public evaluation return
`403 FEATURE_DISABLED`. No learning-session, catalog, progress, mastery, AI or
intake capability is implemented ahead of its slice. In particular, no empty
progress result is fabricated to suggest that learning has been synchronized.

Frontend changes are additive and opt-in through `VITE_SLICE0=true`: shared
same-origin fetch wrapper with CSRF/idempotency headers, email/callback pages,
account/pending-consent page, public guardian decision page, and a signed-in
onboarding branch on the existing `/kenalan` route. Existing Vue routes remain.
Vite proxies `/v1` locally. The guest copy now reads “Progres ini tersimpan di
perangkat ini saja.” Existing learning adapters and their response validators
were not changed. Default guest/demo learning remains local and available.
The existing optional analytics beacon is explicitly disabled in demo and
Slice 0 modes, even if `VITE_TRACK_URL` is set; local event storage still works.

## 2. Actual database migrations executed

Tests used the installed **PostgreSQL 17.5**, satisfying 16+, in an isolated
project-local cluster `.local/pg17`, bound to **127.0.0.1:55432**, with a dedicated
database **`intibelajar_slice0_test`** and SCRAM authentication. No shared database
or production service was used. Docker was unavailable; no database installation
was necessary.
The isolated cluster was stopped after verification; no API, worker or database
service created for this task was left running.

Executed `migrations/0001_slice0.up.sql`: `learner`, `guardian`, `app_user`,
`auth_identity`, `auth_session`, `auth_transaction`, `student_profile`,
`consent_record`, `deletion_request`, `erasure_receipt`, `audit_event`,
`idempotency_record`, and `job`, with their constraints/indexes. The runner also
creates `schema_migration` (14 tables including this bookkeeping table).

The migration is reproducibly extracted from architecture 04. As 04 §9 requires,
Slice 0 `job` has only `deletion_request_id`; later-slice references and their
combined check are deferred. FK lookup/expiry/lease indexes and bounded platform
JSON columns were added. No catalog or learning seed was imported.

Executed the matching down migration on the isolated test database, then up
again; repeated up was harmless. An intentionally failing temporary migration
(`CREATE TABLE rollback_canary; SELECT missing_column`) rolled back completely,
leaving neither its table nor a migration record. It was removed after the test.
Checksums detect edits to applied migrations. Committed Kysely types were generated
from the migrated PostgreSQL schema. No previous backend release exists to upgrade.

Down migrations are explicitly development/test only. The CLI requires
`ALLOW_DESTRUCTIVE_DEV_ROLLBACK=true`; production recovery is still a reviewed
forward-fix/backup-restore concern.

## 3. Tests run and results

Verification used **Node 24.19.0**; the installed Fastify dependency tree requires
Node 22+. The system Node 20 was not used as the verified service runtime.

| Check | Actual result |
|---|---|
| Established OpenAPI 3.1 validation | PASS — user-approved project-local `@apidevtools/swagger-parser` 12.1.0 |
| Backend TypeScript | PASS — `tsc --noEmit`, including generated database types and integration tests |
| Module table ownership check | PASS — TypeScript AST/query-template boundary check |
| PostgreSQL integration/security suite | PASS — 15 named scenarios; Node reports **16 tests including the parent**, zero failures |
| Unchanged architecture checker, frontend-aware wrapper | PASS — **15 checks, 0 warnings, 0 failures**, including consumer suite and mutation self-tests |
| Existing frontend `npm test` | PASS — bindings, curriculum, graph, analysis, flow, math input, demo safety, gamification |
| Existing frontend `npm run test:backend` | PASS — **29 consumer contract checks** |
| Frontend analytics isolation | PASS — 3 scenarios preserve local events and suppress the beacon in demo/Slice 0, with network stubbed |
| Frontend build with `VITE_SLICE0=true` | PASS — 82 components pass binding checks; Vite build succeeds |
| Dependency vulnerability audit | **Unavailable** — configured registry's npm security endpoint returns 404 `NOT_IMPLEMENTED`; no clean-audit claim |

The PostgreSQL tests exercise migration up/down/reapply and atomic failure;
hash-only session creation, cookie flags, rotation, link reuse and continuation;
idle/absolute expiration; authenticated mutation CSRF/Origin/Fetch-Metadata
rejections; strict fields and pending-data minimization; adult declarations
still requiring guardian consent; cross-user/guardian authorization; missing
idempotency keys; independent consent purposes and exact policy attribution;
revocation and immediate session invalidation; declined/expired-bootstrap
erasure; idempotent payload replay/conflict/concurrent admission and crash
rollback; stale lease rejection and recovered erasure; complete Slice 0 row
removal; current/all logout; explicit disabled-provider failures; rate limits;
unavailable-database readiness/recovery; and log/trace canaries.

Every exercised canonical success/error body is checked against the baseline
schema (global errors use its `Error` schema). Restore recovery is tested by
reintroducing synthetic erased rows in PostgreSQL while retaining receipts:
readiness/normal API traffic is blocked until the worker erases the rows again.
This is **not** a managed-backup `pg_dump`/`pg_restore` disaster-recovery drill.

Frontend consumer checks remain consumer-side mocked-fetch tests, not proof that
the future learning facade is implemented. New UI pages were build-verified;
browser E2E/Playwright and real-provider flows were not run. The build warns that
the account view is both statically and dynamically imported; this only affects
chunk splitting. Fastify emits a deprecation warning for its supported
`disableRequestLogging` option; request redaction/canary tests pass.

Evidence copies are under `docs/backend-implementation/evidence/`. The original
architecture checker initially warned because this backend workspace has no Vue
sources. `scripts/verify-architecture.py` points its existing `REPO` source root to
the separate frontend checkout; it does not alter or weaken the checker. The final
run includes all frontend and self-test cases, rather than accepting skipped checks.

## 4. Security controls implemented

- Production configuration, remote DB/origin configuration, non-loopback binding,
  malformed keys and feature enablement fail closed. Synthetic fixture access
  is off unless explicitly enabled. Provider addresses must end in `.invalid`.
- Session tokens use 256 random bits; only SHA-256 is stored. Cookies retain
  `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`. Sign-in consumes a
  pre-auth transaction and rotates/revokes the old cookie. Idle and absolute
  deadlines use the database clock.
- CSRF tokens are HMAC-derived from the opaque session token under the local
  application key and their hashes are stored/checked with constant-time equality.
  Canonical authenticated mutations require them. Auth-start/public link
  mutations additionally require exact Origin, JSON and same-origin Fetch Metadata
  when present. CORS preflight is denied; the frontend uses the same-origin proxy.
- Ownership derives from the session. Guardian operations filter through linked
  consent records. Other learners and missing learners share the same safe 404
  error (with independently generated request IDs). Client ownership fields are
  rejected by strict requests; legacy FlowContext is never authority or retained.
- Consent eligibility is checked under a learner row lock with status, current
  policy and unexpired `GRANTED` purpose. Profile/identity/consent bootstrap stores
  no learning responses. Revocation/deletion blocks further processing and revokes
  learner sessions in the same transaction. A stale authenticated mutation
  revalidates its session after locking the subject.
- Idempotency uses principal/operation/resource scope, canonicalized payload
  hashes, advisory admission locking, stored business responses and transaction
  rollback. Records contain no cookie, raw link or CSRF secret.
- Guardian and identity addresses use AES-256-GCM with versioned ciphertext and
  HMAC lookups. This is local-key development encryption; managed envelope
  encryption/rotation is still a production gate.
- Logs and spans allow only generated request IDs, route templates, method,
  status and timing. No raw request URL, token, body, email, name, cookie,
  authorization header, provider payload or exception text is logged. Tests
  include malformed-input/token-URL/header canaries. No trace exporter is configured.
- Strict input bounds, route allow-list, safe Indonesian errors, no-store,
  no-referrer, CSP/frame denial, MIME protection, and auth/address rate limits are
  implemented. HTTPS termination/HSTS belong to a future approved deployment.
- Deletion workers fence adoption by lease token and expiry, retry safely, remove
  all Slice 0 subject rows, clean unused guardian identities, and leave only a
  digest receipt. Restore receipts must be preserved independently across a real
  restore; readiness and API traffic stay closed for matching resurrected subjects.

## 5. Production-disabled integrations

Readiness exposes `GOOGLE_OIDC_NOT_CONFIGURED`, `EMAIL_DELIVERY_NOT_CONFIGURED`,
`GUARDIAN_VERIFICATION_NOT_CONFIGURED`, `CONSENT_TEXT_NOT_APPROVED`,
`AGE_ASSURANCE_NOT_APPROVED`, and `DPIA_AND_PRIVACY_REVIEW_PENDING`.
Unconfigured identity entry points return `503 DEPENDENCY_UNAVAILABLE` with
explicit blocker details. No production capability can be enabled by toggling a
feature flag or granting synthetic consent.

Google OIDC/PKCE/token verification, external email delivery, verified guardian
sign-in/relationship checks and production deletion notifications remain disabled.
The local email simulator sets `auth_identity.email_verified=false` and never
sets `guardian.verified_at`; guardian sessions in tests are explicit synthetic
fixtures. A synthetic decision does not verify an age band.

AI diagnosis/tutor, image intake, product analytics, public server evaluation,
streak freezes and the learning facade are all off. There is no AI SDK/provider
connection, remote telemetry exporter, object store, production hosting, managed
backup system, KMS, or real data-rights support integration.

## 6. Open decisions and classification

**Every value below is either a provisional development default or an outstanding
production approval gate. None is recorded as legal/product approval.**

| Decision | Development default used | Production approval gate / owner |
|---|---|---|
| OD-01 guest evaluation | `CONSENT_FIRST`; guest learning local | Any `OPEN_TRIAL` requires counsel/product approval |
| OD-02 minimum age/assurance | Derive synthetic age band; keep `SELF_DECLARED`; no verified-age claim | Published minimum, exact age verification and regulatory review: counsel/product |
| OD-03 self-consent | Off; guardian required for everyone, including `ADULT` declaration | Counsel must approve any exception |
| OD-04 retention | Bootstrap/link 7 days; synthetic grant 30 days; other future periods not activated | Counsel approves real retention, audit proofs, receipts and notification handling |
| OD-05 DPIA/DPO/risk assessment | Engineering inventory drafted separately; no approval assumed | Management/counsel assign owners and complete assessments |
| OD-06–10 AI/privacy/model/budget/safety/evaluation | All AI off; synthetic fixtures only | Provider terms, transfer basis, models, budgets, escalation and real evaluation data remain separately gated |
| OD-11 question self-report | No learning endpoints in Slice 0 | Product approval before Slice 2 |
| OD-12 streak freezes | Off | Product approval before activation |
| OD-13 guardian visibility | Linked consent status only; no answers or progress summaries | Counsel/product approval of supervision/summary scope |
| OD-14 hosting/region | Isolated local PostgreSQL 17.5; no deployment | Engineering/finance/provider/privacy approval |
| OD-15 migration runner | Small transactional SQL runner with checksum/advisory lock | Review custom-runner deviation before any real deployment |
| OD-16 dispute staffing | No dispute capability in Slice 0 | Product/staffing before Slice 2 |
| OD-17 shared-device sessions | 7-day idle, 30-day absolute; configurable shorter | Product/security approval of real device policy |
| OD-18 mastery thresholds | Not implemented or changed in Slice 0 | Content/product gate for later slices |
| OD-19 launch/compliance timing | No launch scheduled or compliance claim | Management/counsel verify current authoritative rules and timing |
| Stack/query/storage | TypeScript/Fastify, Kysely, PostgreSQL, plain SQL, PG jobs; no Redis/Kafka/Kubernetes/microservices | User-authorized engineering defaults; production capacity/security review remains |
| Consent policy/expiry | Immutable `synthetic-dev-v1`, visibly simulated; 30-day synthetic grants | Reviewed texts, approved grant validity, immutable policy archive and change/re-consent procedure |
| Identity/guardian transport | `.invalid` local simulator and encrypted local mailbox | Verified providers, role selection/linking, guardian relationship assurance and durable delivery/outbox |
| Secrets/roles/crypto | One random local root key with purpose-separated derivations; dedicated local DB owner | KMS/envelope encryption, rotation/replay-key retention, TLS, separate migration/API/worker grants |
| Sessions/CSRF/errors | Opaque cookie, HMAC CSRF derivation, exact Origin, existing error envelope | Security review and external penetration test; enumerate global error responses per operation |
| Observability/supply chain/CI | Local spans/logs; pinned packages; workflow added | Exporter/retention/access approval, functioning vulnerability scan, actual hosted CI and coordinated frontend checkout |

The engineering DPIA inventory is in `02-dpia-engineering-inventory.md`. It does
not settle legal basis, approve policy wording, select a DPO, certify age assurance,
or complete the legal review.

## 7. Architecture gaps, deviations and compatibility review

1. **Consent link grouping:** one request can contain several purposes, but
   `request_token_hash` is unique per row. The implementation uses a distinct
   SHA-256(token + purpose) per purpose and resolves the same bearer link against
   those hashes. No schema/response shape was changed. Decision purpose coverage
   is exact; duplicates, omissions, altered policy hashes and expired/used links
   fail. A production policy/request archive is still missing from the design.
2. **Age confirmation is underspecified:** architecture 08 describes guardian
   confirmation, but `GuardianConsentDecision` has no confirmed age-band field.
   The implementation keeps `SELF_DECLARED` and blocks production assurance;
   it does not manufacture a `GUARDIAN_CONFIRMED` result from a generic attestation.
3. **Request expiry versus grant validity:** the schema has only `expires_at`,
   while the flow specifies a seven-day request. Synthetic decisions explicitly
   assign a development-only thirty-day grant lifetime. Real grant validity and
   renewal need privacy/legal approval; no permanent consent was inferred.
4. **CSRF reconstruction:** a hashed CSRF secret alone does not specify how GET
   session reproduces the token. The HMAC derivation above is the recorded
   development implementation; no plaintext CSRF token is stored in PostgreSQL.
5. **Migration tooling:** ADR-04/OD-15 proposes dbmate or node-pg-migrate. This
   implementation uses a small project SQL runner instead. It is tested but this
   is an explicit engineering deviation, not an approved production selection.
6. **Command rule wording:** 04 describes keys on every mutation, whereas the
   normative OpenAPI/09 requires them on POST commands except logout, not profile
   PATCH/account DELETE. The implementation follows the operation contract;
   ordinary PATCH/DELETE semantics are preserved.
7. **Global errors:** several individual auth/link operations omit responses such
   as 403/503 even though 09 defines CSRF/dependency failures globally. Blocked
   integrations use that existing canonical `Error` and `DEPENDENCY_UNAVAILABLE`.
   Success shapes, legacy `{redirectUrl}`, enums and consumer validators were not
   changed. Explicitly listing these global responses in each operation is an
   outstanding contract-documentation review, not a silent schema rewrite.
8. **Guardian identity/lifecycle:** role selection for guardian sign-in and verified
   guardian relationship assurance are absent from sign-in request contracts.
   Tests use privileged synthetic fixtures; real guardian sign-in stays blocked.
   Erasure explicitly removes orphan guardian account references before deleting
   guardian rows, addressing the `app_user.guardian_id` FK dependency.
9. **Erasure receipts:** “restricted schema” is only a comment in the normative
   DDL; the development migration uses public tables. Local receipt replay is
   implemented, but a restricted independently preserved ledger, key rotation,
   notifications and an actual managed-backup restore drill are production gates.
10. **Other baseline defects:** two entity descriptions in 03 contain an accidental
    recommendations snippet in place of `PRACTICE`; normative state machine and
    OpenAPI were used. INV-01's literally “byte-identical” errors cannot include
    distinct mandatory request IDs; status/code/message are intentionally the
    same. Published legal/provider statements in 07/08 were not treated as freshly
    verified legal approval; they remain counsel/provider review inputs.
11. **Development simplifications:** local application-key encryption instead of
    managed envelope encryption; one isolated development DB owner instead of
    production grants; no telemetry exporter/HSTS edge; local mailbox instead of
    durable email delivery. These are disabled-production boundaries, not weaker
    consent rules. Node's test runner is used instead of the proposed Vitest;
    browser E2E remains a Slice 1 dependency.

## 8. Slice 1 readiness

**Safe synthetic Slice 1 engineering can build on this foundation. Slice 0's real
release/production exit gate is not met.** The local synthetic guardian flow,
consent enforcement, schema foundation and automated database tests exist.

Before real identities or learning persistence are enabled, resolve the provider,
age assurance, counsel-reviewed consent, DPIA/risk/DPO, retention, notification,
secrets/role, audit/restore and security gates above. A simulated grant is never
permission to introduce real learner data. No production-capable runtime was added.

Slice 1 additionally needs the reviewed catalog alias manifest/publisher, catalog
and learning migrations, deterministic practice/evaluators and consent-gated
learning endpoints, real facade integration tests, frontend canonical learning
integration and Playwright. Backend CI configuration is supplied, but no remote CI
run is claimed; the separate Vue repository must be provided to its coordinating
consumer-check job. Existing mocked-fetch consumer tests are not a substitute for
that future server/facade verification.
