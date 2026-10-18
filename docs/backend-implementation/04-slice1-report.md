# Slice 1 implementation report

Date: **2026-10-18**. Scope: safe, synthetic, local development only.
**No production readiness claim, deployment, real learner data, real identity or guardian verification,
external email, or external AI calls.**

**Exit verdict: the engineering exit criteria are met against a synthetic reviewed catalog. The
Slice 1 exit is not met for the real catalog.** The real draft manifest still has 58 open content
decisions (D3–D6), and the publisher refuses it by design. Details are in §4.

The baseline was architecture documents **01–12**, `openapi.yaml` and `validate-spec.py` in
`docs/backend-architecture/`, plus the Slice 1 plan `03-slice1-plan.md`, which holds the milestone-level
detail (§7–§14). Approved decisions: D1, D2 and D7. Changes to the baseline were made deliberately and
are listed in §7.

Code:
- backend: `main` commits `08af874` through `39ac92b`, M3 follow-ups to M8;
- Vue checkout (`mockup/intibelajar`, branch `master-pre-test-1`): `88f5ed1`, `5c41960` (Slice 0 files)
  and `eafa168`.

Nothing has been pushed.

Reproduce everything below with `npm run verify:slice1`. It needs the isolated PostgreSQL, the Vue
checkout and `PYTHONPATH=.local/python`. It writes `evidence/slice1-exit/*.txt` and
`verification-slice1.json`.

## 1. Implemented modules and endpoints

| Module | Implemented behaviour |
|---|---|
| Catalog | The alias manifest (`catalog/manifest/`, schema, linter, extractor from the Vue `src/data`) maps every one of 150 frontend identifiers, or lists it as unmapped with a reason. The draft holds 11 topics (4 mapped, 7 planned), 61 concepts, 40 questions, 6 lessons and 6 sets. The publisher does an advisory-locked, all-or-nothing publish with a strict lint (no override). Changed content becomes a new revision, and identical content is a no-op. The public read API serves the current release from an in-process per-release cache, through an allow-listed projection that never selects rubrics. ETag/304, and HMAC-signed keyset cursors bound to the filter and release. |
| Assessment | `option-v1` and `numeric-v1` pure evaluators. numeric-v1 is a faithful port of the frontend checker; a shared golden file runs in both repositories. Inline `GRADING` runs, evidence per mapped concept, mastery and transfer eligibility with reason codes (06 §5). `DiagnosisRun` view. |
| Learning | A pure PRACTICE state machine (05 E-02, E-12–E-15, E-22–E-26) and the 04 §7 command protocol: idempotency, then learner lock and consent, then session lock, then expiry, version, legality, and only then a write; refusals write nothing. Also exposure events, hints, checkpoint, the resume list, the E-25 sweeper (worker) and a per-learner command rate limit. Legacy facade L3 sits behind `FEATURE_LEGACY_FACADE`. Erasure covers every learning and assessment table. |
| Platform | Line-ending-neutral migration checksums (legacy raw hashes still verify). Strict query parameters (undeclared ones are rejected; integers coerced only from canonical decimals). `FEATURE_LEGACY_FACADE` is the only feature that can be enabled, in development and test only. |
| Frontend (Vue) | Behind `VITE_SLICE0` + `VITE_CANONICAL_LEARNING`, for a signed-in learner holding `LEARNING_DATA`: PracticeRunView on canonical sessions (resume after refresh, stale second tab), and CoreView checks and practice graded in a canonical lesson session. Everyone else keeps the device flow. A golden runner and a Playwright spec were added. |

| Method | Endpoint | Behaviour |
|---|---|---|
| GET | `/v1/subjects`, `/v1/topics`, `/v1/topics/{id}` | Current release. ETag `"<version>-<sha16>"`, `public, max-age=60`, 304 on match. |
| GET | `/v1/concepts`, `/v1/concepts/{id}` | By topic or legacy alias (an unknown alias gives an empty list). Misconceptions expose only code and description. |
| GET | `/v1/questions`, `/v1/questions/{id}` | No keys, rubrics or hint text. Signed, filter- and release-bound cursors. Private questions are never listed. |
| GET | `/v1/lessons/{id}` | Blocks, checks (QuestionView, no keys), `contentVersion` = revision, `practiceSetCode` |
| POST, GET | `/v1/learning-sessions` | PRACTICE by concept, set or question ids, optionally with its lesson. QUESTION_LOOP gives `403 FEATURE_DISABLED`. The resume list uses signed cursors. |
| GET | `/v1/learning-sessions/{id}` | State, version, items, lesson progress, `allowedActions`, checkpoint |
| POST | `…/attempts`, `…/quick-check-answers`, `…/actions`, `…/hints` | Idempotent and versioned. Inline grading. `ADVANCE`, `FINISH` and `SKIP_LESSON`, `SKIP_ITEM`, `ABANDON` |
| PUT | `…/checkpoint` | Allow-listed routes only. No version bump. |
| GET | `/v1/attempts/{id}`, `/v1/diagnosis-runs/{id}` | Owner only, otherwise 404 |
| POST | `/v1/learning/answers/check` (L3) | Deprecated. Facade over PRACTICE sessions, only with the flag. Funnel checks and `retry_original` wait for Slice 2. |
| — | `…/solution` (POST, GET), `/v1/attempts/{id}/diagnosis`, `/v1/diagnosis-runs/{id}/reports`, `/v1/public/evaluations` | `403 FEATURE_DISABLED` before any validation (Slice 2, OD-01) |

## 2. Database migrations

Both migrations are generated from the authoritative DDL in 04 by `scripts/extract-migration-catalog.py`
(§3) and `scripts/extract-migration-learning.py` (§4, cut before `diagnosis_report`). Regenerating them
reproduces the committed files.

- **`0002_catalog`:** 14 tables, including D1 `micro_lesson_revision` and D2 `catalog_alias`, plus FK and
  §5 indexes, the §6 size caps, and INV-04 triggers. Published or retired revisions and releases accept
  only `PUBLISHED → RETIRED` and the `is_current` flip. Mappings, checks and aliases change only while
  their parent is `DRAFT`. A concept's topic is fixed, misconception codes are append-only, and a
  question's family, visibility and origin are fixed.
- **`0003_learning`:** 7 tables with FK and §5 indexes and size caps. Update guards: INV-07 (an attempt is
  graded once, and the only other change is the exact retention purge), INV-08 (terminal runs are
  frozen), and append-only evidence (only supersession). Deletes stay possible for erasure.
- **Checked on PostgreSQL 17.5** (isolated cluster, `intibelajar_slice0_test`): up and down to each
  earlier migration and back; checksums are stable across CRLF and LF checkouts. The database holds 35
  public tables, including `schema_migration`.
- Down migrations remain development-only (`ALLOW_DESTRUCTIVE_DEV_ROLLBACK`).

## 3. Tests run and results

Final run: `npm run verify:slice1` (Node 24.19.0, PostgreSQL 17.5). Outputs are in `evidence/slice1-exit/`;
counts are in `verification-slice1.json`.

| Check | Result |
|---|---|
| **Overall** | **18 of 19 checks passed, 0 failed, 1 finding** (the Vue dependency audit, §5) |
| Backend suite (`node:test`, 9 files) | **98/98, 0 skipped**; also 98/98 on two consecutive runs in M8 |
| Browser E2E (`npm run e2e:canonical`, Playwright 1.63.0, Chromium 1243) | **2/2**; also 3 of 3 consecutive passes in M8 |
| Vue checkout: `npm test`, 29 consumer checks, 81 + 47 golden cases, local-only check | Pass |
| Architecture checker + self-test | 14/14 |
| OpenAPI 3.1 validation, `tsc`, module-ownership and rubric boundary checks | Pass |
| Manifest | Draft lint: 0 errors, 58 `UNREVIEWED`. Strict lint refuses the draft (exit 1, as intended). Golden sync. Alias coverage: 150 identifiers, 0 unresolved, 0 outside the freeze. |
| Reproducibility | Migrations regenerate unchanged. Re-extracting the draft is byte-identical apart from the recorded frontend commit, and the Vue `src/data` has not changed since that commit. |
| Mutation checks (during M1–M8) | Each check below was mutated and failed as expected: lint rules (20), golden parser rule, persistence of item status, the facade's option-index mapping, the learning-erasure call, rubric-guard canaries, and the bundle-check self-test. |
| Dependency audit (public npm registry) | Backend: 0 vulnerabilities. **Vue checkout: a finding** (see §5). |

Tests by roadmap ID (12 §2 Slice 1):

| Roadmap item | Where |
|---|---|
| E-02, E-11–E-15, E-22–E-26 | `learning-sessions.test.ts`, `learning-machine.test.ts`. E-11 `START_LESSON` and E-16–E-21 are QUESTION_LOOP and only appear as refused commands. |
| INV-04 (immutable, pinned content) | `catalog-publisher.test.ts`: new revisions, the retired revision readable, 12 rejected in-place edits |
| INV-05 (no keys) | `catalog-read.test.ts` (schema walk; response scan), `learning-sessions.test.ts` (no keys before grading), bundle check |
| INV-06 (legal transitions, version +1) | Machine properties (300 × 25 steps) and the **model-based property test over HTTP and PostgreSQL** |
| INV-07 (attempts immutable) | `learning-erasure.test.ts` (database guards) |
| INV-12 (exposure never changes verdicts) | Hint test: same verdict, `HINT_USED` blocks transfer |
| INV-14 (idempotency) | Replay, reuse, missing key, concurrency (Slice 0) and the facade's derived key |
| INV-16 (unreadable never counts) | Evaluators, machine, API and facade |
| INV-17 (hard-edge DAG) | Lint and the publisher's SQL re-check |
| Contract validation | Every 2xx body is validated by the route wrapper; explicit schema checks too |
| Facade passes frontend validators | The shipped `checkWithBackend` and `isCheck`, bundled from the Vue repo, as the oracle |
| Also covered | INV-01 (404 for others), INV-02 (consent gating, zero writes), INV-08, INV-19 (generic coverage of every learner table, erasure and restore replay) |

## 4. Exit gate

| Criterion (12 §2, plan §3 M9) | Status | Evidence |
|---|---|---|
| A practice session survives refresh and a second tab | **Met** | Browser E2E (refresh resumes at the first pending item; the stale tab gets 409, re-reads and moves on), M6 API tests and the model-based test |
| No key appears in a learner response | **Met**, with one content exposure to review | INV-05 scans, the M6 pre-grading scan and the bundle check. One known exposure: the T13 lesson works the tower question itself (plan §9). It is listed in the test and must keep matching. |
| The publisher accepts the seeded catalog (aliases unique, hard edges acyclic) | **Met for the synthetic reviewed fixture. Not met for the real catalog.** | Strict lint and SQL re-checks pass on the fixture. The real draft is refused with 58 `UNREVIEWED` findings until D3–D6 are decided. |
| Facade responses pass the frontend's validators | **Met** | M7 oracle tests |
| Erasure still complete | **Met** | Generic INV-19 coverage, erasure and restore-replay tests |
| Documentation baseline consistent | **Met, with one stale artefact** | The live checker passes 14/14. `docs/backend-architecture/verification.json` still describes the pre-D1/D2 baseline (42 tables), because the Slice 0 wrapper refuses `--write`. |

## 5. Security and privacy controls added in Slice 1

- **Answer keys.** Rubrics are readable only in the publisher, `catalog/grading-source.ts` and
  `src/assessment/` (static rule with canaries). Public projections are allow-lists. Keys are revealed
  only after grading, and revealing one records `FINAL_ANSWER_SHOWN`. `CATALOG` content may not appear
  in the bundle.
- **Learning data.** Learning data is written only for an `ACTIVE` learner holding `LEARNING_DATA`,
  under the learner lock. Revocation or deletion stops the next command with zero writes. Sessions,
  attempts and runs are owner-only (404 otherwise). Composite FKs stop cross-learner attempts.
- **Immutability.** Database triggers make published content, attempts, terminal runs and evidence
  immutable, in addition to the code. Erasure now covers every learning and assessment table, and a
  coverage test fails on any new learner table that is not handled.
- **Request integrity.** Strict bodies and query parameters, idempotency on every command, optimistic
  versions, per-learner rate limits, and a log canary (no answer text in logs).
- **Facade** (off by default): exact `Origin`, `Sec-Fetch-Site` and JSON content type replace the CSRF
  token the shipped client cannot send. Guests and unconsented learners are not served (`CONSENT_FIRST`).
- **Finding: Vue checkout dependencies.** `npm audit` (public registry) reports 3 high and 1 moderate:
  - `brace-expansion` (DoS);
  - `source-map-js` (DoS);
  - `esbuild` ≤ 0.24.2 (a website can send requests to the **dev server**, via `vite` ≤ 6.4.2).

  All of them come through build tooling (Vue's compiler packages, Vite and esbuild). None appears in
  the shipped bundle (`dist` contains no trace of them). `npm audit fix` would resolve the first two;
  `esbuild` needs a breaking Vite 8 upgrade. Nothing was changed: that is the frontend owners' call.
  The backend has 0 vulnerabilities. This replaces the Slice 0 "audit unavailable" status.

## 6. Disabled, deferred and not served

- QUESTION_LOOP: sessions, solution, diagnosis re-run, reports, the funnel's own checks `c1`–`c4` and
  L3 `retry_original` (all Slice 2).
- `/v1/public/evaluations` (OD-01 `CONSENT_FIRST`). Guests keep on-device practice using
  `PUBLIC_PRACTICE` keys (D4).
- Mastery, XP, streaks and progress events (Slice 3). Evidence is written now, eligibility included,
  so Slice 3 can rebuild from it. Client-side XP stays on the device until then.
- AI, intake and private questions (Slices 5–6). The INV-19 coverage test asserts that no private
  question exists.
- Remote CI has not been run. `.github/workflows/slice0.yml` now also runs `catalog:lint` and
  `catalog:golden`, but the browser E2E and the frontend checks need a coordinating job with both repositories.

## 7. Baseline changes, deviations and decisions

| Change | Why |
|---|---|
| 04 §3 DDL: `micro_lesson_revision`, `catalog_alias`, `micro_assessment` per lesson revision; §4 `lesson_assignment.lesson_revision_id`; ERDs, §5, table count 42 → 44; publication rule (D1, D2, approved) | Immutable, pinned lesson content (INV-04), and aliases that cannot be ambiguous |
| 02, 03 entity, alias and LessonBlocks updates | Consistency with the above |
| `openapi.yaml` (additive): `LessonBlock` `heading` + `name`, `expression`, `highlight`; `QuestionView.answerExample`; `Lesson.practiceSetCode` | Lossless lesson content; the typed answer field's format hint; CoreView needs a lesson's practice set |
| `validate-spec.py`: the self-test mutation string for the new table count | The checker otherwise unchanged |
| INV-04 enforced with **triggers instead of grants** | Holds for every role, including the development owner. A migration, API and worker role split is still a production gate. |
| Facade: sessions keyed per screen context; **derived key without the state version** (09 §6.1 rule 5) | One client session spans several screens. A version-based key cannot replay a response lost after commit. Trade-off: an identical repeat within 7 days replays. |
| `QUICK_CHECK` waits for every required check on a slide | The typed lessons put 2–3 required checks on slide 0 |
| numeric-v1 grades typed text only; the server sets `inputMode` | Evidence must quote a span (06 §2.4); provenance is server-side |
| Practice sets live in the release snapshot (no table) | No query needs them relationally yet |
| `node:test` + `fast-check` instead of Vitest (D7) | Consistency with Slice 0 |
| Strict query parameters across all operations | Undeclared query parameters were previously ignored |

## 8. Open decisions and content findings (owners)

| Item | Status |
|---|---|
| D3 code scheme | **Open.** Content lead approves the meaning of each code |
| D4 `PUBLIC_PRACTICE` for every extracted item; may such attempts be transfer evidence? | **Open.** Proposed: no (a `PUBLIC_KEY` reason, which needs a 06 change). Today they are eligible. |
| D5 tower questions: separate questions in one family | **Open** |
| D6 inferred mappings (lesson ↔ concept, question roles, typed T04, T10, T13, context tags, availability) | **Open.** 58 review tags in the draft. |
| T13 lesson works the tower question's solution (found by the INV-05 scan) | **Open:** re-author, accept and record exposure, or withdraw it from the public catalog |
| Typed curriculum graph disagrees with `curriculum.ts` edges | Recorded in the draft's `gaps`; only `curriculum.ts` edges imported |
| Slice 0 production gates (provider, age assurance, consent texts, DPIA, retention, secrets and roles, restore drill, pen test) | **Unchanged and still open.** Slice 1 adds learning data, so these gates matter more now. |

## 9. Not verified

- **The real catalog has never been published.** Every database test and the E2E use the synthetic
  reviewed fixture.
- Load and latency targets (k6), real devices, Safari and Firefox (E2E uses Chromium with a Pixel 5 profile).
- CoreView restoring the learner's picked option after a refresh (server state does survive), and
  E2E of the facade through real screens (the facade is tested through the shipped adapter, not the UI).
- QUESTION_LOOP, mastery projection and XP rules (later slices).
- Remote CI, a managed-backup restore drill, production roles and grants, and HTTPS/HSTS.
- **The Vue repository's own older E2E specs fail.** 57 of 59 target the pre-redesign landing page.
  They are unrelated to Slice 1 (no page errors; the redesigned hero renders) but need updating.

## 10. Slice 2 readiness

The engine, evidence model and command protocol that QUESTION_LOOP extends are in place.

**Slice 2 engineering can start on synthetic data.** It needs:
- `tower-v1` (port `services/analysis.ts` with golden branch tests);
- QUESTION_LOOP transitions in the pure machine, with the same property tests;
- `diagnosis_report` and `job.diagnosis_run_id`;
- facade L1, L2, L4, L6, L8 and `retry_original`;
- the funnel lesson as a catalog lesson;
- OD-11 and OD-16.

**Before any real learner uses Slice 1:**
- content review of D3–D6 and the T13 exposure, then a strict publish of the real draft;
- every Slice 0 production gate;
- the frontend dependency finding;
- a coordinated CI run across both repositories.
