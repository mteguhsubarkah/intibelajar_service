# Slice 1 implementation plan: catalog and deterministic practice

Date: **2026-10-18**. Status: **D1, D2 and D7 approved. M1 (§7) and M2 (§8) implemented against a synthetic reviewed fixture. M3–M9 not started.**
Scope stays the same as Slice 0: synthetic learners and local development only.
No real learner data, deployment or AI.

Normative sources: [12 §2 Slice 1](../backend-architecture/12-implementation-roadmap.md),
[03 §3](../backend-architecture/03-domain-model.md#3-identifiers),
[04 §3 and §9](../backend-architecture/04-postgresql-erd.md#3-catalog-tables),
[05](../backend-architecture/05-learning-state-machine.md), [06 §5](../backend-architecture/06-diagnosis-evidence-mastery.md#5-eligibility-and-exposure),
[09 §6–7](../backend-architecture/09-api-design.md#6-compatibility-with-the-current-frontend) and
[11](../backend-architecture/11-test-matrix.md).
Frontend checkout: `C:/Users/User/Documents/teguh/learningJourney/mockup/intibelajar`.

## 0. Summary

Slice 1 is mostly a **content-identity problem**. The server and database work
is not the hard part. The frontend currently has four overlapping ways to name
content, and some of its IDs are based on array positions. Until one reviewed
manifest maps all of them, every later step depends on guesses. The plan therefore puts the
**alias manifest and publisher first**. These two steps need no learner data and
no HTTP endpoints, and every later milestone depends on them.

| # | Milestone | Size | Depends on |
|---|---|---|---|
| M1 | Alias manifest: schema, extractor, reviewed manifest, linter | L | — |
| M2 | Catalog migration and publisher | M | M1 |
| M3 | Public catalog read API | M | M2 |
| M4 | Learning migration and erasure extension | M | M2 |
| M5 | Deterministic evaluators `option-v1` and `numeric-v1` | S | M1 |
| M6 | `PRACTICE` session engine and canonical endpoints | L | M3, M4, M5 |
| M7 | Legacy facade L3 (`practice`, `check`) | M | M6 |
| M8 | Frontend integration and Playwright | L | M6, M7 |
| M9 | Exit verification and report | S | all |

M3, M4 and M5 can run in parallel once M2 lands.
Sizes are relative: S is about two days, M about one week and L about two weeks
for one engineer. They are not commitments, because doc 12 deliberately gives
no dates.

## 1. What the frontend actually contains (findings that shape the plan)

These findings come from reading `src/data/**` in the frontend checkout on 2026-10-18.

### 1.1 Four identifier namespaces for content

| Namespace | Where | Examples | Used by |
|---|---|---|---|
| Map concept IDs | `data/curriculum.ts` (4 mapped topics, about 60 concepts plus about 20 `*-uN` unit IDs) | `tri-d`, `eks-a`, `vek-q` | Map, L9 progress snapshot, `/coba` funnel |
| Typed concept IDs | `data/curriculum/trigonometry.ts`, `data/cores/*` | `T04`, `T10`, `T13` | `QuestionView`, `TryView`, `RetryView`, learning-session store |
| Lesson route slugs | `data/coreLessons.ts`, `coba.ts CORE_ROUTES` | `perbandingan-trig`, `sudut-istimewa`, `sudut-depresi-elevasi` | `/core/:id`, recommendations (`coreId` in L1) |
| Item IDs | `coba.ts`, `bank.ts`, `questions/`, `cores/` | `soal-menara`, `trig-depression-01`, `c1`–`c4`, `p1`–`p3`, `perbandingan-trig:0`, `core:<route>:c0`, `check-1` | Funnel, bank, practice run, L3 `itemId` |

Doc 03 expects three alias namespaces (`legacy_map_id`, `route_slug`,
`legacy_item_id`). The **`Txx` concept namespace is a fourth** and the DDL has
no column for it.

### 1.2 Conflicts that need human decisions

1. **Lesson ↔ concept mismatch.** `CORE_LESSONS["perbandingan-trig"].coreId` is
   `tri-e`. `CORE_ROUTES` maps both `tri-d` and `tri-e` to it. `bank.ts`
   `LESSON_CORES` says that its practice items test `tri-d`. All three are plausible,
   and `lesson_concept` can represent "teaches both". However, someone must decide which
   concepts its practice items **assess** (`question_concept.assessable`).
2. **`sudut-depresi-elevasi` serves `tri-c` and `tri-p`.** This is the same question as item 1.
3. **The tower question exists twice.** `soal-menara` (`coba.ts`/`bank.ts`, with map IDs)
   and `trig-depression-01` (`questions/`, with `Txx` IDs, numeric value and option
   misconceptions). Are they one question with two aliases, or two questions in one
   family? This matters for INV-13 and transfer freshness.
4. **Positional item IDs.** `${route}:${i}`, `core:${route}:c${i}` and `q${i}`
   change if someone reorders an array. They cannot become frozen aliases as they are.
   The manifest freezes today's values once and records them explicitly. After that,
   reordering the frontend array must not change identity.
5. **Option identity is an index.** L3 sends `answer` as an option index. Options
   need stable IDs in the manifest. The facade maps the index to an ID per revision.
6. **Answer keys ship in the bundle.** These are `CheckOption.ok`, `answer` indexes and
   numeric `value`s. Keys that have already shipped cannot be made secret again (see D4).

### 1.3 Gaps in the normative design

- **Catalog rows are not release-scoped.** Only `question_revision` carries
  `release_id`. `concept`, `topic`, `micro_lesson` and `micro_assessment` are single
  rows. A republish would mutate in place, so a session pinned to release N would
  then read content from release N+1. `lesson_assignment.lesson_content_version`
  records a version, but nothing stores the old blocks. This conflicts with INV-04
  for lessons. See D1.
- **Single alias column per entity.** `question.legacy_item_id` is one `UNIQUE`
  column, but finding 1.2.3 needs two aliases for one question. See D2.
- **Playwright is already present.** It appears in the frontend (`playwright.config.ts`, `tests/e2e`). Doc 11 says
  it is "not installed". Slice 1 extends the existing setup.
- **Erasure covers only Slice 0 tables.** Every learner-owned table added
  in M4 must join the erasure order, the `information_schema` completeness test
  (INV-19.1) and restore replay **in the same migration PR**.

## 2. Decisions to settle before M1 (recommendations included)

| ID | Decision | Recommendation | Owner |
|---|---|---|---|
| D1 | How published lessons and concepts stay immutable without release-scoped rows | **Slice 1: the publisher refuses in-place edits.** A change to a published lesson's blocks or checks, or to a concept's misconceptions, fails the publish unless it uses a new `code` or a bumped `content_version`, together with a new `micro_lesson_revision` table. Recommendation: add `micro_lesson_revision` now (same pattern as `question_revision`), because lessons will change. Concept and topic metadata stay as the current projection, and the release snapshot is the audit record. | Engineering (architecture change: update 03/04 and `validate-spec.py`) |
| D2 | Where secondary aliases live | Add **`catalog_alias (release_id, namespace, alias, entity_type, entity_id)`** with `UNIQUE (release_id, namespace, alias)`. Namespaces as implemented in M1: `SUBJECT`, `TOPIC`, `MAP`, `TYPED_MAP` (the `Txx` IDs and typed-map nodes), `ROUTE`, `TYPED_LESSON`, `ITEM`. Option indexes are mapped by a per-question `legacyOptionOrder` rather than an `OPTION` namespace. Keep the existing DDL columns as the primary alias for compatibility, generated from this table. This makes "unique per release, ambiguous → publish fails" a constraint instead of code. | Engineering |
| D3 | Content-code scheme and who approves it | `MAT.<TOPIC>.<CONCEPT>` / `MAT.<TOPIC>.Q.<NAME>_<NN>` / `MAT.<TOPIC>.L.<NAME>`, per 03 §3. Engineering drafts, and the content lead signs off on the meaning of each code. | Content lead |
| D4 | Visibility of items whose keys already shipped | Every item that exists in today's bundle becomes **`PUBLIC_PRACTICE`**, because its key is already public. Only newly authored items become `CATALOG`, with keys on the server only. Open sub-question: should `PUBLIC_PRACTICE` attempts be **transfer-eligible**? Recommendation: mastery-eligible yes, transfer-eligible no until private items exist. That needs a new reason code, `PUBLIC_KEY`, which is a 06 §5.2 change. | Content lead + product |
| D5 | Tower question identity (finding 1.2.3) | *Revised after extraction:* the two prompts are worded differently, so one revision cannot hold both. Proposal: **separate questions** `MAT.TRI.Q.SOAL_MENARA`, `…TRIG_DEPRESSION_01` and `…_RETRY`, all with **one `family_code`** `MAT.TRI.F.TOWER_DEPRESSION_30`. It is published in Slice 1 and only used by `QUESTION_LOOP` in Slice 2. | Content lead |
| D6 | Lesson ↔ assessed-concept mapping (findings 1.2.1–2) | The extractor proposes. Then a reviewer confirms every `lesson_concept` and every `question_concept (role, assessable)` row in the manifest diff. Nothing is inferred from shared route slugs (03 §3). | Content lead |
| D7 | Test tooling | Keep `node:test` for consistency with Slice 0, and add `fast-check` for the INV-06 model-based test. Split `test/slice0.test.ts` into a per-module layout before it grows. Record the deviation from Vitest instead of migrating. | Engineering |

**Approved 2026-10-18:** D1, D2 and D7. D3–D6 stay open: they appear as `PROPOSED` review tags in the manifest, and as `PROPOSED` decisions in `release.yaml`. `fast-check` is added in M6, when it is first used.
| D8 | OD-01 for this slice | Keep `CONSENT_FIRST`. `POST /v1/public/evaluations` returns `403 FEATURE_DISABLED`. Guests keep on-device practice using the `PUBLIC_PRACTICE` keys in the bundle. | Already the default |

## 3. Milestones

### M1 · Alias manifest (first deliverable)

**Goal:** one reviewed, versioned, machine-checked file that names every piece of
content and maps every legacy identifier to it explicitly.

Layout in the backend repo:

```
catalog/
  manifest.schema.json        JSON Schema (draft 2020-12) for the manifest
  manifest/
    release.yaml              version, notes, reviewer sign-off block
    subjects.yaml
    topics/MAT.TRI.yaml       topic, units, concepts, prerequisites, aliases
    questions/MAT.TRI.Q.*.yaml  body, rubric, concept mappings, aliases, option IDs
    lessons/MAT.TRI.L.*.yaml  blocks, checks, lesson_concept, aliases
  legacy-alias-freeze.json    generated: the frozen legacy alias set (09 §6.1 rule 8)
scripts/catalog/
  extract-from-frontend.ts    one-time extractor (bundles frontend data with esbuild)
  lint-manifest.ts            pure validation, no DB
```

Steps:

1. **Write the schema.** Encode the `QuestionBody`, `Rubric` and `LessonBlocks` value objects from 03 §7,
   with `schemaVersion` and the size caps from 04 §6. Each option has a stable `id` and,
   for legacy items, a `legacyIndex`.
2. **Build the extractor.** Bundle `data/curriculum.ts`, `curriculum/trigonometry.ts`,
   `coba.ts`, `coreLessons.ts`, `bank.ts`, `questions/*` and `cores/*` with
   esbuild, using the same technique as the frontend's `scripts/*.test.ts`. It emits a **draft**
   manifest. Every inferred mapping is tagged `review: PROPOSED` with the
   evidence it was inferred from. **Static `state` values are not imported** (04 §9).
   The extractor runs once. After the review, the manifest is the source of truth.
3. **Review.** A content reviewer resolves every `PROPOSED` tag (D3, D5 and D6). Any
   remaining tag fails the lint.
4. **Build the linter.** These rules are also reused by the publisher:
   - schema validity and size caps;
   - aliases unique per namespace, with any ambiguity reported as an error that names both entities;
   - hard prerequisite edges acyclic per topic and across topics (INV-17);
   - every `question_concept` concept exists;
   - every rubric step concept is mapped on the same question;
   - every misconception code exists on its concept;
   - every `PRACTICE`-usable item uses `option-v1` or `numeric-v1` (05 §2);
   - every lesson check is a deterministic item;
   - option IDs unique per question, and `legacyIndex` covers 0…n−1 without gaps;
   - no key fields inside `body` (INV-05 at authoring time).
5. **Freeze the legacy aliases.** `legacy-alias-freeze.json` records exactly the aliases in
   today's shipped `curriculum.ts` and item sets. A CI check in the frontend repo fails if
   the shipped frontend references an alias that is missing from the freeze.

**Acceptance:**
- The manifest round-trips: a re-run of the extractor on unchanged frontend data produces no
  diff apart from review annotations.
- The lint passes on the reviewed manifest.
- Mutation tests each make one targeted rule fail: duplicate alias, cycle, unmapped step concept, unknown
  misconception, key in body, option index gap. This follows the pattern of `validate-spec.py --self-test`.
- Every `tri-*`, `Txx`, route slug and item ID that the frontend uses resolves to exactly
  one entity, or is listed as intentionally unmapped with a reason.

### M2 · Catalog migration and publisher

**Migration `0002_catalog`:** the doc 04 §3 catalog tables, plus D1 (`micro_lesson_revision`) and
D2 (`catalog_alias`), with their indexes (`question_concept(concept_id)`,
`concept(topic_id, ordinal)`). Down migration for development only, as in Slice 0.
Regenerate the Kysely types. Update architecture docs 03 and 04, plus the
`validate-spec.py` ERD/DDL cross-check, **in the same change**, so the baseline
stays consistent.

**Publisher** (`src/catalog/publisher.ts`, CLI `npm run catalog:publish -- --manifest catalog/manifest`):

1. Run the M1 linter. Stop on the first error class and report all errors in that class.
2. In one transaction:
   - `pg_advisory_xact_lock(catalog)`;
   - compute the canonical JSON snapshot and its `snapshot_sha256`;
   - if it equals the current release's hash, **no-op** (idempotent re-publish);
   - upsert entities by `code`;
   - for published questions and lessons, an unchanged body is reused, a changed body
     creates a new revision, and an in-place edit is rejected (INV-04, D1);
   - retire revisions that were removed from the manifest (never delete them: attempts reference them);
   - write `catalog_alias` rows for the new release;
   - re-run the cross-entity checks against the database: DAG via a recursive CTE, and
     step concepts mapped;
   - insert `curriculum_release` with status `PUBLISHED` and the snapshot, then flip `is_current`.
3. Write an `audit_event` with the release version and hash only.

**Tests (PostgreSQL integration):**
- Publish the seed. Publish it again → no-op.
- Edit a published question → new revision, and the old one stays readable.
- Cycle, ambiguous alias, unmapped step concept, unknown misconception code and an oversized
  rubric each fail with **zero writes** (INV-17.1).
- Concurrent publishes serialize on the lock.
- A combined item (`gabungan`) creates no `concept_prerequisite` row (INV-17.2).
- The application role has no `UPDATE` grant on published revisions (INV-04.2). This needs
  the first split between migration role and API role, which Slice 0 deferred, so
  introduce `intibelajar_api` with explicit grants here.

### M3 · Public catalog read API

Endpoints: `/v1/subjects`, `/v1/topics`, `/v1/topics/{topicId}`, `/v1/concepts`
(including `?legacyMapId=`), `/v1/concepts/{conceptId}`, `/v1/questions`,
`/v1/questions/{questionId}` and `/v1/lessons/{lessonId}`. All are public and read only from the
current release.

- **Projection layer** (`src/catalog/projection.ts`): explicit allow-list mappers
  from rows to the OpenAPI schemas. Rubric columns are never selected by
  public queries. The boundary checker in `scripts/check-boundaries.mjs` gains a rule:
  `rubric` may be read only inside `assessment`.
- **In-process snapshot cache** keyed by release ID (ADR option a), and `ETag` = release
  hash with `Cache-Control: public, max-age=60`. The cache is invalidated by a release change
  detected per request (cheap `is_current` lookup) or by `LISTEN/NOTIFY`.
- Keyset pagination per 09 §5.

**Tests:**
- INV-05.1: a schema scan finds no rubric fields in any public schema.
- INV-05.2: every catalog response is scanned for every item's `acceptedForms` and
  answer values.
- Contract validation of every response.
- Unknown and other-release IDs return `404`.
- `PUBLIC_PRACTICE` items expose options without the `ok` flag.

### M4 · Learning migration and erasure extension

**Migration `0003_learning`:** `learning_session`, `session_item`,
`lesson_assignment`, `question_attempt`, `assistance_event`, `diagnosis_run` and
`concept_evidence` exactly as in 04 §4, plus the 04 §5 indexes for these tables.
`job.diagnosis_run_id` stays in Slice 2 (04 §9). Practice grading is inline, so Slice 1
needs no diagnosis jobs. It does need an **expiry sweeper** job kind (E-25). Add it as a
queue name that needs no FK column.

**Erasure, in the same PR:**
- Extend the deletion worker with the 04 §8 step 3 order for these tables:
  `concept_evidence` → `diagnosis_run` → clear `active_attempt_id` → `question_attempt` →
  `assistance_event` → `lesson_assignment` → `session_item` → `learning_session`.
- Extend restore replay to these tables.
- Make the INV-19.1 test generic: seed one row in **every** table with a
  `learner_id` column (from `information_schema`), erase, then assert zero rows.
  New tables can then never silently escape erasure.

### M5 · Deterministic evaluators

`src/assessment/evaluators/option-v1.ts` and `numeric-v1.ts` are pure functions from
`(rubric, response)` to `{verdict, evidence[], revealedAnswer?}`.

- **`numeric-v1`:** Indonesian decimal comma, thousands separators, `√` and `akar`,
  units ignored or required per rubric, tolerance, and `acceptedForms` (for example `20√3 ≈ 34,64`).
  Port the parsing from the frontend's `services/answer/answerChecker.ts` and
  `optionMatcher.ts`, and **share golden cases**: one JSON fixture file that both
  repositories run, so guest grading on the device and server grading cannot drift.
- An unparseable answer → `UNREADABLE`, never `INCORRECT` (INV-16).
- **Evidence:** for `CORRECT`, write `UNDERSTANDING_DEMONSTRATED` for `finalAnswerEvidence` concepts.
  For `INCORRECT`, write `MISCONCEPTION_EVIDENCED` when a `misconceptionMap` pattern matches (for example
  the tower's cos and sin distractors). Otherwise write `INSUFFICIENT_EVIDENCE`. Never invent a gap.

### M6 · `PRACTICE` session engine

**Structure:** keep the logic pure and the I/O thin.

- `src/learning/machine.ts`: a pure `(state, command, context) → {next, effects} | Illegal`
  for the `PRACTICE` subset. It also produces `allowedActions`. `QUESTION_LOOP` transitions
  are written as `Illegal` stubs, so Slice 2 only fills in the table.
- `src/learning/commands.ts`: the 04 §7 protocol in one transaction. It claims idempotency, then
  locks the learner (status and `LEARNING_DATA` consent, INV-02), then locks the session (`expectedStateVersion`),
  checks the machine, applies the effects and stores the response. Follow the lock order strictly.
- Session creation (E-02): resolves items **server-side** from `{conceptId}`, `{setCode}`
  or `{questionIds}`. Every resolved item must be deterministic. Roles are assigned per 06 §5.2
  (`TRANSFER` if the family is fresh and the item is `PRIMARY` + assessable for the focus concept),
  with a fixed order. An optional `lesson_assignment` pins the checks.

**Endpoints:**
- `POST`/`GET /v1/learning-sessions` (`status=active` for resume), `GET …/{id}`
- `…/attempts` (E-22), `…/quick-check-answers` (E-13), `…/actions`
  (E-11/12/14/15, `SKIP_ITEM`, `ABANDON`), `…/hints` (E-23), `PUT …/checkpoint` (E-26)
- `GET /v1/attempts/{id}`, `GET /v1/diagnosis-runs/{id}`
- Every practice attempt creates a `DETERMINISTIC` run that completes inline in the same
  transaction, so the response always carries a `COMPLETED` run.
- `revealedAnswer` appears only after grading and records `FINAL_ANSWER_SHOWN` for the family (06 §5.3).

**Evidence without a projection:** write `concept_evidence` with full
eligibility and reasons. **Do not** compute `mastery_state` or XP. Those belong to Slice 3, which
rebuilds them from this evidence. Slice 1 evidence must therefore be correct the first time.

**Sweeper:** expire `PRACTICE` sessions 24 hours after the last activity (E-25), using the existing job lease
machinery.

**Tests:**
- One integration test per E-02, E-11–E-15 and E-22–E-26, each also checking `state_version`.
- Every 05 §4.5 illegal transition that applies to `PRACTICE` → `409` and zero writes.
- **INV-06.1 model-based property test** (`fast-check`): random command sequences against the
  reference machine, checking the database state, version and row counts after each step.
- INV-07 (no update path, and the application role cannot `UPDATE` attempt columns), INV-12 (hint before
  versus after: same verdict, different eligibility), INV-14 (replay, conflict, concurrency,
  crash) and INV-16.
- INV-01 generated from `openapi.yaml` for every new learner endpoint.
- Consent revoked mid-session → next command `403`, zero rows (INV-02.3).
- **Exit scenarios:** refresh (new client, `GET` active, resume at the slide checkpoint); a **second
  tab** with a stale `expectedStateVersion` → `409 STALE_STATE_VERSION`, after which the tab
  re-reads and continues; and a key scan of every learner response.
- Log and trace canary in answer text.

### M7 · Legacy facade L3

`POST /v1/learning/answers/check`, behind `legacyFacade.enabled` (default off) with
`Deprecation` headers. It follows the 09 §6.1 rules:

- `practice` → a `PRACTICE` session keyed `<FlowContext.sessionId>:practice`,
  created on first use with that set's items, then `SUBMIT_ATTEMPT`.
- `check` → implied `START_LESSON` and `ADVANCE_LESSON`, then `ANSWER_QUICK_CHECK`.
  This needs a session context. In Slice 1 it is valid only inside a `PRACTICE` session with a lesson.
  The funnel's `/coba` checks wait for `QUESTION_LOOP` in Slice 2, and the facade returns
  `409 INVALID_STATE_TRANSITION` with a documented gap until then.
- `retry_original` → `403 FEATURE_DISABLED` until Slice 2.
- **Derived idempotency key:** `legacy:` + SHA-256 of (learner, client session, `stateVersion`,
  canonical payload). The client `attemptId` is ignored.
- Option index → option ID through `catalog_alias` (`OPTION` namespace) per revision.
- Response `{correct, feedback?, correctOptionIndex?, unreadable?}`. Only frozen aliases ever appear.

**Tests:** the frontend's own `isCheck` validator used as the oracle (run from
the frontend checkout, as `verify-frontend.mjs` already does); `npm run test:backend` pointed at a
live facade for L3; and a guest or a learner without consent → `403`.

### M8 · Frontend integration and Playwright

These are frontend repo changes, opt-in behind a flag. Recommendation: rename `VITE_SLICE0`
to `VITE_CANONICAL_API` before it spreads.

- `PracticeRunView` and `CoreView` call the canonical API for **signed-in learners with
  consent**. Guests keep the on-device path unchanged.
- A session client in `canonicalApi.ts` handles: create or resume (`GET ?status=active`),
  `Idempotency-Key` per user action (kept across retries of that action),
  `expectedStateVersion` from the last response, `409 STALE_STATE_VERSION` → re-read and
  re-render, and `allowedActions` driving which buttons are enabled.
- **Keys leave the bundle for `CATALOG` items.** A build check fails if any `CATALOG`
  item's key appears in `dist/`. `PUBLIC_PRACTICE` keys stay for guests (D4).
- **Playwright** (extend the existing `tests/e2e`): a synthetic learner with a fixture consent does
  lesson → check → practice → refresh mid-practice → resume at the same item → finish.
  A second-tab scenario. A network drop after commit → retry replays.

### M9 · Exit verification

The doc 12 exit gate, plus this plan's additions:

| Exit criterion | Evidence |
|---|---|
| A practice session survives refresh and a second tab | M6 integration tests and M8 Playwright |
| No key appears in a learner response | INV-05.1/.2 scans, M6 response scan, M8 bundle check |
| The publisher accepts the seeded catalog: aliases unique, hard edges acyclic | M2 publish of the reviewed manifest, plus mutation tests |
| Facade responses pass the frontend's validators | M7 oracle tests |
| Erasure still complete | Generic INV-19.1 over all `learner_id` tables |
| Doc baseline consistent | `validate-spec.py` and `--self-test` pass after the 03/04/09 updates for D1/D2 |

Write `04-slice1-report.md` in the same format as the Slice 0 report, including the
exit-gate table above and an explicit list of what was **not** verified.

## 4. Cross-cutting rules for this slice

- **Synthetic only.** Learning endpoints are consent-gated, and in development consent is the
  synthetic `synthetic-dev-v1` policy. Nothing here permits real learner data.
- **Contract first.** If any endpoint differs from `openapi.yaml`, change the contract (and
  `validate-spec.py`) in the same PR. Never add silent drift. Also close the Slice 0
  report §7.7 gap for the new operations: list `401`, `403`, `409` and `410` per operation.
- **Rate limits** on attempts and hints per learner (doc 11 §7).
- **Lock order** (04 §7): learner → session → attempt/run. The model test runs with
  concurrency to catch deadlocks.
- **Boundary checker:** `learning` must not import `catalog` internals, only its
  interface. Only `assessment` reads `rubric`. `progress` does not exist yet, so nothing
  computes mastery.

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Manifest review stalls on content decisions (D3–D6) | Blocks everything | Start the review in week 1 in parallel with schema work. Ship the trigonometry topic first. Other topics can be `PLANNED` with no items. |
| D1 changes the normative DDL | Doc and validator churn | Do it once, in M2, with the doc updates in the same change |
| On-device and server grading drift | Guests and learners see different verdicts | Shared golden fixture file run in both repos (M5) |
| Slice 1 evidence is wrong and Slice 3 rebuilds mastery from it | Silent bad mastery later | Eligibility unit tests over every rule in 06 §5. Evidence rows store reasons. |
| Positional legacy IDs change in the frontend | L3 resolves the wrong item | Freeze file plus a frontend CI check against it (M1 step 5) |
| A single test file and flat `src/` grow past readability | Slower reviews | D7 split before M6 |
| The backend workspace still has no version control | Work in M1–M8 has no history or review | Outside this plan's scope by request. Recommended before M1 merges anything. |

## 6. Approvals needed before or during M1

1. D1 and D2 (engineering): schema additions `micro_lesson_revision` and `catalog_alias`.
2. D3, D5 and D6 (content lead): code scheme, tower identity, and lesson and assessed-concept mappings.
3. D4 (content lead + product): `PUBLIC_PRACTICE` for every item that has already shipped, and whether those
   items can be transfer evidence.
4. D7 (engineering): stay on `node:test` and add `fast-check`.

## 7. M1 status (2026-10-18)

M1 is implemented as a **draft**. The manifest is complete and lints clean, but every content
decision (D3–D6) is still `PROPOSED`. The publisher in M2 will refuse it until review.

### What was built

| Path | Purpose |
|---|---|
| `catalog/manifest.schema.json` | JSON Schema (draft 2020-12), one `$defs` entry per file kind. Covers the value objects from 03 §7, the size caps from 04 §6, and strict learner-facing bodies. |
| `src/catalog/manifest.ts` | Types, deterministic load and write, alias index, and `lintManifest(m, {strict})`. Pure, with no DB access; the publisher reuses it in M2. |
| `scripts/catalog/extract-from-frontend.ts` | Bundles the frontend's `src/data` with esbuild (pinned devDependency `0.28.2`), then writes the draft, coverage and freeze. Proposal tables are at the top of the file. |
| `scripts/catalog/lint-manifest.ts` | `npm run catalog:lint` (draft: review tags are warnings) and `-- --strict` (the publisher's mode, which exits 1) |
| `catalog/manifest/` | The draft: release, subjects, topic relations, sets, unmapped, 11 topics (4 mapped, 7 planned), 61 concepts, 40 questions and 6 lessons |
| `catalog/legacy-alias-freeze.json` | Frozen legacy alias set from frontend commit `efe1a93` (`src/data` was clean) |
| `test/catalog-manifest.test.ts` | `npm run test:catalog`: 23 tests |

Layout deviations from §3 M1:
- `topic-relations.yaml`, `sets.yaml` and `unmapped.yaml` are added.
- Practice sets have no DDL table yet; M2 decides.
- Freeze-drift detection runs from the backend (`npm run catalog:check`) against the frontend
  checkout, in the same way as `verify-frontend.mjs`. No frontend-repo CI change was made.

### Verification (Node 24.19.0)

| Check | Result |
|---|---|
| Draft lint | 0 errors, 58 `UNREVIEWED` warnings |
| Strict lint | 58 errors, all `UNREVIEWED`, exit 1. This is the expected refusal. |
| Coverage (`catalog:check`) | 150 frontend identifiers: 0 unresolved, 0 outside the freeze |
| Mutation tests | 20 rules. Each targeted defect triggers exactly its rule (`SCHEMA`, `KEY_IN_BODY`, `SIZE`, `CODE_DUPLICATE`, `REF_UNKNOWN`, `ALIAS_AMBIGUOUS`, `ALIAS_UNMAPPED_CONFLICT`, `PREREQ_CYCLE`, `PREREQ_SELF`, `TOPIC_CYCLE`, `UNIT_UNKNOWN`, `QUESTION_NO_PRIMARY`, `STEP_CONCEPT_UNMAPPED`, `MISCONCEPTION_UNKNOWN`, `EVALUATOR_SHAPE`, `OPTION_IDS`, `PRACTICE_NOT_DETERMINISTIC`, `CHECK_NOT_DETERMINISTIC`, `CHECK_PLACEMENT`, `FILE_NAME`) |
| Determinism / round-trip | Two builds are equal. A fresh extraction to a temporary directory is byte-identical to the committed draft and freeze. Write followed by load is lossless. |
| `tsc --noEmit`, boundary check | Pass |
| Slice 0 PostgreSQL suite | **Not re-run.** No Slice 0 file changed, and the isolated cluster is stopped. |

### For the reviewers (D3–D6)

- Run `npm run catalog:lint` to list every open tag. Each tag names its decision, the fields
  that were inferred, and the evidence.
- Resolve a tag by editing the entry and then either deleting `review` or setting it to `REVIEWED`.
  Approve the release-level decisions in `release.yaml`, and add reviewers to `signOff`.
- Main points to confirm:
  - T04 → `tri-c`, T10 → `tri-d`, and the new concept for T13.
  - `perbandingan-trig` teaches `tri-e` and `tri-d`.
  - `sudut-depresi-elevasi` teaches `tri-p` and `tri-c`.
  - Every multi-concept item maps all of its concepts as `PRIMARY` and assessable.
  - The tower family (D5).
  - `PUBLIC_PRACTICE` for every extracted item (D4).
- After review, **do not re-run the extractor without `--force`**, because it refuses to overwrite.
  The manifest is now the source of truth. `catalog:check` keeps guarding the frontend's identifiers.

### Found during extraction (recorded in `release.yaml` → `gaps`)

1. `curriculum/trigonometry.ts` has its own prerequisite graph, which disagrees with `curriculum.ts`.
   Only the `curriculum.ts` edges and the T13 edges were imported.
2. The diagnostic follow-up steps of `trig-depression-01` have no value object in 03 §7. Decide this in Slice 2.
3. The `/coba` funnel lesson lives in a Vue component, not in `src/data`.
4. `Rubric.feedback` and `QuestionBody.answerExample` extend the 03 §7 value objects. Update 03
   together with the M2 doc changes.

## 8. M2 status (2026-10-18)

The catalog migration and the publisher are implemented and tested on PostgreSQL 17.5. The **real
draft stays unreviewed**, and the publisher refuses it. Every database test uses a reviewed
fixture that `test/fixtures/catalog.ts` derives from the draft at runtime: it marks every proposal
`REVIEWED` with a synthetic reviewer, in memory only. That fixture is not a content decision.

### What changed

| Area | Change |
|---|---|
| Architecture 04 | §3 DDL: `micro_lesson` is now identity only, `micro_lesson_revision` is new (D1), `micro_assessment` belongs to a lesson revision, and `catalog_alias` is new (D2). There is a one-of-five FK to the entity, and its primary key makes an ambiguous alias unpublishable. §4 `lesson_assignment` pins `lesson_revision_id` instead of `lesson_content_version`. ERDs, the §5 index table, the publication rule and the table count (42 → 44) are updated. |
| Architecture 02, 03 | Catalog module table list, entity table, alias namespaces, and the location of `LessonBlocks` |
| `validate-spec.py` | Only the self-test mutation string for the new table count. All 14 checks and the self-test pass against the Vue checkout. |
| `migrations/0002_catalog.*` | Generated by `scripts/extract-migration-catalog.py` from the 04 §3 block, plus the §5 indexes, the §6 size caps and the INV-04 triggers |
| `src/catalog/publisher.ts` | `publish(db, manifest)`, plus the CLI `scripts/catalog/publish.ts` |
| `src/privacy/service.ts` | `auditSystem()` for subject-less events. `audit_event` stays owned by `privacy`, and the boundary checker now has a `catalog` group. |
| Manifest | `contentVersion` is removed from lessons, because the server numbers revisions (`Lesson.contentVersion` = `micro_lesson_revision.revision`). The draft was otherwise untouched, and re-extraction is still byte-identical. |
| `test/slice0.test.ts` | The migration test rolls back **all** applied migrations, since `down` reverts only the latest. No assertion changed. |

### How a publish works

1. It runs a strict lint with no override, so open `PROPOSED` tags fail with `MANIFEST_INVALID`.
2. It takes a transaction-scoped advisory lock (`89164002`).
3. If the key-sorted manifest has the same SHA-256 as the current release, the publish is a **no-op**.
   Otherwise the manifest's release version must exceed every existing version.
4. Subjects, topics and concepts are upserted by code as the current projection. The concept's
   topic is fixed, and misconception codes are append-only.
5. Prerequisites, topic relations and `lesson_concept` are replaced.
6. For each question and lesson, the publisher compares canonical content with the live revision.
   Equal content reuses that revision. Different content retires it and inserts revision n+1 as `DRAFT`.
   Removed entries only retire their live revision.
7. `catalog_alias` rows are written for the new release, and the legacy alias columns are re-derived.
8. The publisher checks the hard-edge DAG (recursive CTE) and the step-concept mappings again in SQL.
9. It freezes the result: the new revisions and the release flip to `PUBLISHED`, the release
   becomes current, and an `audit_event` (`CATALOG_PUBLISHED`, version and hash only) is written.

**INV-04 is enforced by triggers, not grants.**
- A published or retired revision or release accepts only `PUBLISHED → RETIRED` and the
  `is_current` flip.
- Mappings, checks and aliases change only while their parent is `DRAFT`.
- Deletes are rejected, except for private intake revisions (`release_id IS NULL`), which Slice 6
  erasure must remove.

This replaces the plan's "no `UPDATE` grant" approach (§3 M2). Triggers hold for every role,
including the development owner. Splitting migration, API and worker roles is still an
open production gate.

### Verification (Node 24.19.0, PostgreSQL 17.5 on 127.0.0.1:55432, `intibelajar_slice0_test`)

| Check | Result |
|---|---|
| Full backend suite (`test/*.test.ts`) | **50/50 pass, on two consecutive runs** against the same database. Evidence: `evidence/slice1-m2-tests.txt`. |
| Publisher suite (11) | Covers all of the following. |
| | 0002 rolls back alone and keeps Slice 0. |
| | The draft is refused with `UNREVIEWED` findings only. |
| | Lint failures (cycle, ambiguous alias, unmapped step concept, unknown misconception, oversized rubric) publish nothing. |
| | A full publish writes 40 questions, 6 lessons and every alias, all frozen, with T04 resolving to the `tri-c` concept. |
| | An identical republish is a no-op. |
| | Edits create revision 2, while revision 1 is retired and keeps its original content. |
| | Version, family, topic-move and misconception-removal rules each publish nothing. |
| | An alias can move to another entity in a later release while older releases keep their mapping. |
| | Concurrent publishes serialize. |
| | 12 direct in-place SQL edits are rejected. |
| | Zero writes is checked by comparing row count and content digest across all 14 catalog tables and `audit_event`. |
| Slice 0 suite | Passes unchanged, apart from the multi-migration rollback helper |
| `tsc --noEmit`, boundary check, OpenAPI validation | Pass |
| Architecture checker + self-test | 14/14 pass |
| CLI against the test database with the real draft | `MANIFEST_INVALID`, 58 `UNREVIEWED`, exit 1 |

**Not verified or not done:**
- The SQL defence-in-depth checks (cycle, step concepts) cannot be reached through `publish`,
  because the strict lint catches those defects first. There is no bypass to test them with.
- `docs/backend-architecture/verification.json` still records 42 tables. The Slice 0 wrapper
  deliberately refuses `--write`, so the stored evidence was not regenerated. The live checker passes.
- The Vue repository has its own copy of `docs/backend-architecture/`, which now differs from this one.
- The isolated cluster was stopped after verification.

### Decisions recorded in M2

- **Practice sets** stay in the release snapshot (`curriculum_release.snapshot`); there is no
  table yet. M6 resolves sets from the cached snapshot. Revisit this if sets need FKs.
- **A release version is part of the snapshot.** Bumping only the version therefore publishes a
  new release that reuses every revision.
- Removed topics, concepts and questions are never deleted, because attempts and evidence reference them.
  Their live revisions retire. The release snapshot and `catalog_alias` define what a release contains.
