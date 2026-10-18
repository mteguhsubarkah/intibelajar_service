# 10 · Architecture decision records

All records are **Proposed** and need review before implementation. Each one states the context, the options considered, the decision, its trade-offs, and how to change course later.

Constraints that drive most decisions:

- a small team and a pilot of at most about 2,000 learners ([02 §6](02-system-architecture.md#6-non-functional-targets-provisional));
- users who are children, with Indonesian consent and data rules ([08 §7](08-auth-security-privacy.md#7-indonesian-legal-baseline-reviewed-sources));
- strong consistency between attempts, evidence, mastery and XP ([04 §7](04-postgresql-erd.md#7-concurrency-and-idempotency));
- an existing Vue + TypeScript frontend with a consumer-side contract ([01](01-current-state-audit.md)).

| ADR | Decision |
|---|---|
| [01](#adr-01--modular-monolith) | Modular monolith with an API role and a worker role |
| [02](#adr-02--typescript-on-nodejs-with-fastify) | TypeScript on Node.js with Fastify |
| [03](#adr-03--postgresql-16-as-the-system-of-record) | PostgreSQL 16+ as the system of record |
| [04](#adr-04--kysely-and-plain-sql-migrations) | Kysely and plain SQL migrations |
| [05](#adr-05--jobs-leased-from-postgresql) | Jobs leased from PostgreSQL |
| [06](#adr-06--ai-gateway-as-a-leaf-adapter-on-the-official-sdk) | AI gateway as a leaf adapter on the official SDK |
| [07](#adr-07--private-object-storage-for-intake-images) | Private object storage for intake images |
| [08](#adr-08--no-cache-store-in-v1) | No cache store in v1 |
| [09](#adr-09--opentelemetry-and-structured-logs-without-personal-data) | OpenTelemetry and structured logs without personal data |
| [10](#adr-10--managed-containers-in-a-jakarta-region) | Managed containers in a Jakarta region |
| [11](#adr-11--canonical-v1-plus-a-deprecated-facade) | Canonical `/v1` plus a deprecated facade |
| [12](#adr-12--mastery-as-a-replayable-rule-based-projection) | Mastery as a replayable, rule-based projection |
| [13](#adr-13--guests-stay-on-the-device) | Guests stay on the device |
| [14](#adr-14--consent-before-persistence) | Consent before persistence |
| [15](#adr-15--opaque-server-side-sessions) | Opaque server-side sessions |
| [16](#adr-16--own-oidc-client-instead-of-a-hosted-identity-service) | Own OIDC client instead of a hosted identity service |

---

## ADR-01 · Modular monolith

**Context.** Learning, assessment and progress must change together: one answer writes an attempt, evidence, mastery and XP in one transaction. There are no independent scaling or team boundaries yet.

**Options.**

- (a) A modular monolith: one codebase, an API process and a worker process.
- (b) Microservices per domain.
- (c) Serverless functions per endpoint.

**Decision.** (a). Modules own their tables and call each other only through typed command and query interfaces ([02 §3](02-system-architecture.md#3-containers-and-modules)).

**Trade-offs.**

- Gains: single transactions instead of sagas; one place to erase a learner's data; one deployment.
- Costs: modules share a release, and boundaries depend on discipline. An import-boundary lint rule in CI enforces "no module touches another module's tables".
- Rejected (b) and (c): distributed transactions and more processors of children's data, with no measured need.

**Migration path.** Split the worker by purpose first. Extract a module behind its existing command interface only with a measured scaling or ownership reason. Move events to a transactional outbox if a module leaves ([02 §10](02-system-architecture.md#10-evolution-path)).

## ADR-02 · TypeScript on Node.js with Fastify

**Context.** The frontend is Vue + TypeScript. The API contract is strict JSON Schema ([openapi.yaml](openapi.yaml)). The bottleneck is AI latency, not CPU.

**Options.**

- (a) TypeScript + Fastify.
- (b) TypeScript + NestJS.
- (c) Python + FastAPI.
- (d) Go.

**Decision.** (a), on the current Node.js LTS.

**Trade-offs.**

- Gains:
  - one language across the stack;
  - request and response types generated from `openapi.yaml` for both sides;
  - Fastify validates and serialises with JSON Schema natively, which matches a contract-first design;
  - a small framework surface.
- Costs: CPU-heavy work (image re-encoding) belongs in the worker, using a native image library.
- Rejected:
  - (b) adds dependency-injection ceremony this team does not need;
  - (c) is strong, but duplicates types in a second language;
  - (d) gains raw speed where speed is not the constraint.

**Migration path.** Business logic lives in framework-free modules, so the HTTP layer is thin and replaceable.

## ADR-03 · PostgreSQL 16+ as the system of record

**Context.** The invariants rely on composite foreign keys, partial unique indexes, deferrable constraints, `CHECK` constraints and row locks ([04](04-postgresql-erd.md)).

**Options.**

- (a) PostgreSQL.
- (b) MySQL.
- (c) A document database (MongoDB, Firestore).

**Decision.** (a), managed, in a Jakarta region.

**Trade-offs.**

- Gains:
  - every constraint in the DDL is native;
  - JSONB for bounded value objects;
  - `FOR UPDATE SKIP LOCKED` for jobs;
  - mature managed offerings.
- Costs: schema changes need discipline (expand → migrate → contract, [04 §9](04-postgresql-erd.md#9-migration-strategy)).
- Rejected:
  - (b) lacks partial unique indexes;
  - (c) cannot enforce cross-document integrity, which this domain depends on.

**Migration path.** A read replica, then monthly partitioning of `progress_event` and `ai_invocation`, both only when measured.

## ADR-04 · Kysely and plain SQL migrations

**Context.** The DDL is written in SQL, and several features (partial and composite constraints, deferrable foreign keys, `ON CONFLICT`, `SKIP LOCKED`) are awkward or impossible in ORM schema languages.

**Options.**

- (a) Prisma.
- (b) TypeORM.
- (c) Drizzle.
- (d) Kysely (typed query builder) with reviewed SQL migration files.
- (e) Raw `pg` only.

**Decision.** (d). The schema is owned by plain SQL migration files. Query types are generated from the migrated database (for example with `kysely-codegen`). The runner is a small, well-known tool (candidates: `dbmate`, `node-pg-migrate` with SQL files), chosen in Slice 0.

**Trade-offs.**

- Gains: SQL stays visible and reviewable while queries stay type-checked.
- Costs: the team writes SQL and reviews `EXPLAIN` plans. There is no automatic migration generation, which is intended.
- Rejected: (a)–(c) hide or fight the constraints; (e) loses type safety.

**Migration path.** Queries are plain SQL underneath, so changing the query builder later is mechanical.

## ADR-05 · Jobs leased from PostgreSQL

**Context.** Diagnosis, tutor replies, image reading, projections and erasure run asynchronously. Volume is small (≤ 10 AI jobs per second at burst). Enqueueing must be atomic with the business write.

**Options.**

- (a) An own `job` table leased with `FOR UPDATE SKIP LOCKED`.
- (b) `pg-boss`.
- (c) Redis + BullMQ.
- (d) A cloud queue (SQS, Pub/Sub, Cloud Tasks).

**Decision.** (a), as specified in [04 §2](04-postgresql-erd.md#2-identity-privacy-and-platform-tables) and [04 §7](04-postgresql-erd.md#7-concurrency-and-idempotency). `LISTEN/NOTIFY` wakes idle workers, and polling with backoff is the fallback.

**Trade-offs.**

- Gains:
  - a job is committed in the same transaction as its attempt, so no outbox is needed;
  - typed foreign keys to the owning row make adoption checks and erasure exact;
  - no second data store holding children's data.
- Costs: polling load and table churn. Finished jobs are deleted after 7 days.
- Rejected:
  - (b) is a good library, but its generic schema loses the typed references;
  - (c) and (d) add infrastructure and a dual-write problem.

**Migration path.** Transactional outbox into a managed queue, when job throughput is measured as a bottleneck.

## ADR-06 · AI gateway as a leaf adapter on the official SDK

**Context.** AI must never be authoritative. Retries must happen in one layer, and children's text must be redacted before it leaves.

**Options.**

- (a) Provider SDK calls inside domain code.
- (b) An in-process gateway leaf on the official `@anthropic-ai/sdk`.
- (c) An LLM framework.
- (d) A hosted multi-provider gateway service.

**Decision.** (b) ([07 §2](07-ai-integration.md#2-gateway-design)), with SDK retries off, structured outputs, and server-side validation.

**Trade-offs.**

- Gains:
  - a fake adapter makes tests deterministic;
  - redaction, budgets, the circuit breaker and validation live in one place;
  - no extra processor of children's data.
- Costs: a second provider means a new adapter and a gold-set run.
- Rejected:
  - (a) spreads provider types and retries across the code;
  - (c) adds abstraction for features not used here (agents, tool loops);
  - (d) adds a processor and a network hop.

**Migration path.** The gateway has no database access, so it can move into its own service unchanged.

## ADR-07 · Private object storage for intake images

**Context.** Photos of questions (≤ 5 MB) must survive between the upload request and the reading job, then disappear.

**Options.**

- (a) An S3-compatible private bucket in-region.
- (b) A temporary `bytea` column in PostgreSQL.
- (c) Streaming straight to the reader without storing.

**Decision.** (a), with:

- a quarantine prefix;
- random object keys;
- short-lived signed reads for the worker only;
- server-side re-encoding, which strips metadata such as GPS;
- a bucket lifecycle rule that deletes objects within 24 hours as a second guarantee beside the application's deletion.

**Trade-offs.**

- Gains: independent, enforceable deletion, and no database bloat.
- Costs: one more service, introduced only in Slice 6.
- Rejected: (b) is workable but loses the lifecycle guarantee; (c) cannot survive a worker restart.

**Migration path.** None needed.

## ADR-08 · No cache store in v1

**Context.** The published catalog is small and immutable per release. Learner data must always be fresh and private.

**Options.**

- (a) No cache store; HTTP caching for the catalog; an in-process cache of the current release snapshot.
- (b) Redis.
- (c) A CDN cache for catalog responses.

**Decision.** (a). Catalog responses carry `ETag` = release version. Learner responses are `no-store`. AI admission limits use `budget_counter` in PostgreSQL, so they hold across replicas. Other limits (sign-in, attempts, public evaluations) are kept in memory per replica, so the effective limit is at most the replica count times the configured value.

**Trade-offs.**

- Gains: one fewer store of personal data, and no cache invalidation bugs on learner state.
- Costs: per-replica limits are approximate (acceptable at pilot scale with 2–3 replicas).
- (c) can be added later for the catalog alone.

**Migration path.** Add Redis only for a measured need, such as exact global rate limits or a hot projection.

## ADR-09 · OpenTelemetry and structured logs without personal data

**Context.** Operators need traces across API → job → gateway. Logs must not contain children's content ([02 §8](02-system-architecture.md#8-observability-without-personal-data)).

**Options.**

- (a) OpenTelemetry for traces and metrics, plus structured JSON logs, exported to a managed backend.
- (b) A vendor-specific agent.
- (c) Logs only.

**Decision.** (a). Span and log attributes come from an allow-list: IDs, route templates, codes, timings. A pseudonymous learner reference (HMAC with a rotating key) replaces learner IDs.

**Trade-offs.**

- Gains: vendor-neutral; changing the vendor is a configuration change.
- Costs: the allow-list needs maintenance.

**Migration path.** Swap the exporter.

## ADR-10 · Managed containers in a Jakarta region

**Context.** There is no operations team. Data locality matters for children's data ([08](08-auth-security-privacy.md)).

**Options.**

- (a) Managed containers (for example Cloud Run in `asia-southeast2`, or ECS Fargate or App Runner in `ap-southeast-3`) with managed PostgreSQL.
- (b) Kubernetes.
- (c) Virtual machines.
- (d) A developer PaaS without a Jakarta region.
- (e) Serverless functions.

**Decision.** (a). One image runs as two roles (API with at least 2 replicas, worker with at least 1). The SPA and `/v1` are served from one origin.

**Trade-offs.**

- Gains: autoscaling and patching without cluster operations, and in-country hosting.
- Costs: less control over networking than (b). Vendor features differ, so infrastructure is kept as code.
- Rejected: (b) is premature, (c) puts patching on the team, (d) misses data locality, (e) suits long AI jobs poorly.

**Migration path.** Containers move between providers. Kubernetes only with several services and an operations owner.

## ADR-11 · Canonical `/v1` plus a deprecated facade

**Context.** The frontend calls nine `/v1` paths that nothing serves. Their shapes have known flaws: client-generated session IDs, synchronous AI calls, no idempotency, no CSRF token ([01 §4](01-current-state-audit.md#4-existing-wire-contract-consumer-side)).

**Options.**

- (a) New canonical resources under `/v1`, with the seven `/v1/learning/*` paths kept as a deprecated facade.
- (b) New canonical resources under `/v2`.
- (c) Keep the legacy shapes as the design.
- (d) Change the legacy shapes in place.

**Decision.** (a) ([09](09-api-design.md)). `POST /v1/auth/start` and `GET /v1/me/progress` stay canonical with their legacy shapes.

**Trade-offs.**

- Gains: no version is wasted on a contract that was never served, and the shipped frontend keeps working where it can.
- Costs: the facade carries derived idempotency keys and compensating CSRF checks until it is removed.
- Rejected: (c) inherits the flaws; (d) silently breaks the shipped frontend.

**Migration path.** Remove the facade per call once the frontend migrates ([12](12-implementation-roadmap.md)).

## ADR-12 · Mastery as a replayable, rule-based projection

**Context.** Blueprint K05 defines mastery as 3/3 independent transfer questions. Learners and guardians must understand why a concept is "Kuasai". The AI must not change mastery.

**Options.**

- (a) A deterministic rule projection over eligible evidence, versioned and rebuildable (`mastery-v1`).
- (b) Mutable counters incremented by events.
- (c) Probabilistic models (knowledge tracing, item response theory).
- (d) AI-judged mastery.

**Decision.** (a) ([06 §6](06-diagnosis-evidence-mastery.md#6-mastery-policy-mastery-v1)).

**Trade-offs.**

- Gains: explainable, auditable and replayable (INV-11).
- Costs: rules are coarse and ignore item difficulty.
- Rejected:
  - (b) drifts and cannot be audited;
  - (c) needs more data than a pilot provides, and a consent basis for model training;
  - (d) violates the core rule.

**Migration path.** Run a probabilistic model in shadow mode later, under its own consent purpose. Adopt it as `mastery-v2` with a rebuild.

## ADR-13 · Guests stay on the device

**Context.** Blueprint D02 says guest progress is not saved. Children's data needs parental consent ([08 §7](08-auth-security-privacy.md#7-indonesian-legal-baseline-reviewed-sources)).

**Options.**

- (a) Device-only guests, with optional stateless server evaluation (`OPEN_TRIAL`).
- (b) Server-side guest principals with cookies (the earlier draft).
- (c) No trial without an account.

**Decision.** (a) ([08 §2.2](08-auth-security-privacy.md#22-guest-evaluation-mode-guestevaluationmode)).

**Trade-offs.**

- Gains: no children's data stored before consent.
- Costs: no cross-device guest continuity, and imported history is unverified and never eligible.
- Rejected: (b) stores children's learning data without consent; (c) loses the "try one question first" funnel.

**Migration path.** If counsel approves a lawful basis, a server guest is a `learner` without an `app_user`. The model already allows it ([03](03-domain-model.md)).

## ADR-14 · Consent before persistence

**Context.** UU 27/2022 Pasal 25 and PP 17/2025 Pasal 9 require parental consent for processing children's data.

**Options.**

- (a) Consent first: nothing is persisted, and no AI is used, until a guardian consents.
- (b) Store first, ask later.
- (c) Adults-only accounts.

**Decision.** (a). This creates Slice 0 ([12](12-implementation-roadmap.md)).

**Trade-offs.**

- Gains: lawful by construction, and trust with parents.
- Costs: friction and drop-off before the first saved progress. This is mitigated by device learning while consent is pending, and should be measured.
- Rejected: (b) is unlawful for children; (c) excludes the audience.

**Migration path.** Enable `SELF_WITH_GUARDIAN_NOTICE` for older age bands if counsel confirms it.

## ADR-15 · Opaque server-side sessions

**Context.** Consent revocation and deletion must cut access immediately. XSS must not expose credentials.

**Options.**

- (a) An opaque cookie with a server-side session row.
- (b) JWTs in `localStorage`.
- (c) JWTs in cookies.

**Decision.** (a) ([08 §3.2](08-auth-security-privacy.md#32-sessions)).

**Trade-offs.**

- Gains: instant revocation, and nothing readable by scripts.
- Costs: one indexed lookup per request.
- Rejected: (b) is exposed to XSS; (c) needs revocation lists, which recreate server state.

**Migration path.** None expected.

## ADR-16 · Own OIDC client instead of a hosted identity service

**Context.** Sign-in needs Google and email links. The guardian–learner consent model is custom.

**Options.**

- (a) A hosted identity service (Firebase Authentication, Auth0, Amazon Cognito, Supabase Auth).
- (b) An own OIDC client on a maintained library (for example `openid-client`), plus email links.

**Decision.** (b).

**Trade-offs.**

- Gains: children's identity data stays in our region and database, with one fewer processor, and the consent flow integrates directly.
- Costs: we own the flow's security. An external penetration test is a launch gate ([08 §8](08-auth-security-privacy.md#8-application-security-controls)).
- Rejected: (a) adds a processor of children's identities, and the consent model would still be custom.

**Migration path.** Identities are keyed by `(provider, subject)` in `auth_identity`, so moving to a hosted service later maps cleanly.
