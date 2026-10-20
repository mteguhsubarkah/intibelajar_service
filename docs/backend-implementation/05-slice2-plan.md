# Slice 2 implementation plan: the question loop

Date: **2026-10-18**. Status: **D1, D2 and D4 approved (2026-10-19); D3, D5–D8 and OD-11 open. M3 and M4 committed as `bf02e7f`, not pushed. M1 (the parts D1/D2 support) and M2 verified on Node 24.19.0 (§11). M5 implementation is available, but its verification gate is not closed: two open findings (§14, B-01 and B-02) block it and the release gate. M6 learner side implemented and verified (§15); M6 staff side waits for D7. M7 L1, L2, L4, L8 implemented and verified (§16), but M7 as a whole is partial: L3 funnel checks and `retry_original` wait for D3, L6 for D6. M8: `/coba` and `/challenge` on the canonical QUESTION_LOOP implemented and verified for the paths that need no open decision (§17); in-flow lesson, L6 and OD-11 copy blocked. B-03 closed by a negative control (§17); B-01 and B-02 stay OPEN. Nothing committed.**
Scope stays as in Slices 0–1: synthetic learners and local development only. No real learner data,
no deployment, and **no AI**. AI diagnosis and the tutor arrive in Slice 5. This slice is deterministic
end to end.

Normative sources:
- [12 §2 Slice 2](../backend-architecture/12-implementation-roadmap.md);
- [05 §3–§6](../backend-architecture/05-learning-state-machine.md) (E-01, E-03–E-21);
- [06 §1–§3, §8–§10](../backend-architecture/06-diagnosis-evidence-mastery.md);
- [09 §6](../backend-architecture/09-api-design.md#6-compatibility-with-the-current-frontend) (L1, L2, L4, L6, L8);
- [11 §3.1](../backend-architecture/11-test-matrix.md#31-t01-the-12-mandatory-backend-scenarios-and-gono-go) (T01);
- [04 §2, §4](../backend-architecture/04-postgresql-erd.md) (`diagnosis_report`, `job`).

Builds on the Slice 1 exit report, [04-slice1-report.md](04-slice1-report.md).
Frontend checkout: `C:/Users/User/Documents/teguh/learningJourney/mockup/intibelajar`.

## 0. Summary

Slice 2 turns the `/coba` funnel and `/challenge` into the server-authoritative question loop:
question → diagnosis → micro-lesson → quick check → retry → verification → completion. It also adds
disputes ("Hasil keliru? Laporkan") and the remaining legacy facade calls.

Slice 1 already built the expensive parts this slice extends:
- the command protocol (idempotency, locks, versions, zero-write refusals);
- the pure machine with property tests and the model-based HTTP test;
- inline grading with evidence and eligibility;
- the catalog with pinned revisions;
- the facade pattern with the shipped adapter as oracle;
- erasure coverage that fails on new tables.

The new work is mostly **one evaluator** (`tower-v1`), **the QUESTION_LOOP half of the machine**, the
**diagnosis-run lifecycle** (inline and queued, with leases), and **content**: the loop's rubric, its
lesson and its tutor ladder.

| # | Milestone | Size | Depends on |
|---|---|---|---|
| M1 | Loop content in the manifest: tower rubric, funnel lesson, lesson links, tutor ladder | M | decisions D1–D3, D6 |
| M2 | `tower-v1` evaluator + golden branch cases (both repos) | M | M1 |
| M3 | Migration `0004`, `diagnosis_report`, `job.diagnosis_run_id`; generic job queue; erasure | S | — |
| M4 | QUESTION_LOOP in the pure machine + property tests | M | — |
| M5 | Loop service and endpoints: runs (inline and queued), retry, verification, solution | L | M2, M3, M4 |
| M6 | Disputes: reports, staff resolution CLI, `EDUCATOR` regrade | M | M5 |
| M7 | Facade L1, L2, L4, L6, L8 (+ L3 funnel checks and `retry_original`) | L | M5 |
| M8 | Frontend `/coba` and `/challenge` on canonical sessions + Playwright | L | M5, M7 |
| M9 | Exit: T01 scenarios in **remote CI** against PostgreSQL, report | M | all; CI access (§6) |

M3 and M4 can start immediately and in parallel. M1 is content work that can run alongside them;
M2 needs it. Sizes are relative and are not commitments (12 gives no dates). S is about two days,
M about one week, L about two weeks for one engineer.

## 1. What the code and content actually contain (findings that shape the plan)

From reading the Vue checkout and the Slice 1 catalog on 2026-10-18.

### 1.1 Two question loops in the frontend, one of them dead

| Flow | Where | Status |
|---|---|---|
| **Funnel loop** | `/coba`, `/soal-tadi`, `/challenge` → `CobaView` + `useCobaFlow` (12 steps). Diagnosis by `services/analysis.ts` (7 keyword branches) through L1 and L2. Lesson `StepMateri.vue`. Retry `StepSoalTadi.vue` through L3 `retry_original`. Solution through L4. IntiBot through L6. | **Live.** This is the loop Slice 2 makes authoritative. |
| **Typed loop** | `TryView`, `QuestionView`, `RetryView`, `stores/learningSession.ts`, `services/diagnosis/*`, `data/questions/trigDepression01.ts` (diagnostic steps), `data/cores/*` (T04, T10, T13), `LandingHero.vue` | **Unrouted.** No route or mounted component reaches it. |

Consequences:
1. **The tower question that matters is `soal-menara`** (`MAT.TRI.Q.SOAL_MENARA`, `tower-v1`, published
   in Slice 1 but unused). The typed `trig-depression-01` and its retry are published `numeric-v1`
   items used only in practice.
2. The typed flow's diagnostic steps (a gap recorded in the Slice 1 report) only matter if that flow is
   revived. See D5.
3. The T13 content exposure (Slice 1 report §8) sits in unrouted content. It still reaches learners
   through the catalog API and through practice-by-concept sessions.

### 1.2 `analysis.ts` is the seed for `tower-v1`, with known false positives

Its seven branches, in order:
1. `sin` → gap `tri-d`;
2. `cos` → gap `tri-d`;
3. `tan` + `1/2`, `0,5` or `0.5` → gap `tri-f`;
4. `tan` + (`20` or `x` or `√3`), **or** `20` + `√3`, **or** `34,6` → **kuat**;
5. `blank` self-report;
6. `know` with nothing written → "show it first";
7. anything else → gap `tri-c` ("hubungan antara sudut dan sisi belum terbaca jelas").

Measured against 06 §1–§2 and §10, a faithful port is wrong in places:

| Input | `analysis.ts` | 06 §10 / honest outcome |
|---|---|---|
| `tan 30 = x/20` (inverted equation) | **kuat** | `INCORRECT`; the equation is set up wrong (an equation-setup misconception, T13-like) |
| `tan x` (no working) | **kuat** | Not enough shown: `INSUFFICIENT_EVIDENCE`, clarification |
| `40` (wrong value, no working) | gap `tri-c` (branch 7) | `INSUFFICIENT_EVIDENCE` for every concept (T01-3). A wrong number does not show which concept failed. |
| Anything unmatched | gap `tri-c` | `INSUFFICIENT_EVIDENCE` or a manual concept choice (E-06). **Never an invented gap** (D07). |
| `sin 30 = 20/x` | gap `tri-d` | Same (misconception on `tri-d`, span `sin 30`) ✓ |
| `tan 30 = 1/2` | gap `tri-f` | `tri-d` understanding **and** `tri-f` misconception ✓ (more evidence than today) |

So the port keeps the branch structure and the Indonesian copy, but replaces the "kuat by keyword" and
"else blame `tri-c`" rules with the rubric's solution path and span checks. See D1.

### 1.3 The funnel lesson is not catalog content

`StepMateri.vue` hard-codes a two-slide lesson for `tri-d` whose only check is `c4` (`MATERI_CHECK`).
Checks `c1`–`c3` exist in `coba.ts` but no screen uses them. E-11 `START_LESSON {conceptId}` needs
"a published lesson that teaches it". Today three published lessons teach `tri-d`
(`PERBANDINGAN_TRIG`, the typed `MEMILIH_TAN_DARI_DIAGRAM`, and the funnel's lesson once authored),
and Slice 1's `lessonFor` picks the first by code. That is not a product decision. See D2 and D3.

### 1.4 Diagnosis is synchronous today; the queue exists only for deletion

Deterministic runs complete inline, and AI is off until Slice 5. Even so, E-09/E-10
(`EVALUATION_FAILED`, `REQUEST_DIAGNOSIS`), T01-4 (failures produce no fake diagnosis) and "lease
recovery" are Slice 2 tests, and `job.diagnosis_run_id` is a Slice 2 migration. `platform/jobs.ts` leases
only deletion jobs. See D4.

### 1.5 Contract and facade facts

- **L1/L2:** the frontend accepts `status ∈ {pending, running, completed, insufficient_evidence, failed}`.
  `completed` requires a non-empty `items` and a full `assessment`
  (`tone`, `title`, `gap`, `okName`, `next{core, reason, formula, coreId, mapId}`).
  Polling follows `Retry-After`, gives up after 8 polls, and never replaces an accepted run with a demo.
  09 §6.3 maps every field.
- **L4:** the response is `{steps[{title, body}], after[]}` from the rubric's `workedSolution`. The
  soal-menara rubric already carries it.
- **L6:** `tutor.ts` holds three authored scripts (`menara`, `tangga`, `umum`) as a node tree with
  `MAX_HINTS = 2`, and a "full solution" node after two hints. The response is
  `{text, quick[], hintsUsed, rewrite?}`. The 1.8 s adapter timeout rules out AI here (09 §6.2).
- **L8:** `detectLocally` is a keyword mapper (trigonometry and exponent words → map ids). The
  server port returns only frozen aliases with `demo: false`.
- **Own questions** (`questionId: own:<id>` with `questionText`) need intake (Slice 6). L1 for them
  stays `403 FEATURE_DISABLED`.

## 2. Decisions to settle before or during M1

| ID | Decision | Recommendation | Owner |
|---|---|---|---|
| D1 | `tower-v1` fidelity to `analysis.ts` | **Port the structure and copy; fix the evidence rules.** A concept counts as `UNDERSTANDING_DEMONSTRATED` only when a rubric step matches a span (or a correct final value, through `finalAnswerEvidence`). A misconception requires a catalogued pattern. Everything else is `INSUFFICIENT_EVIDENCE`. Each changed branch is an explicit golden case labelled "delta from analysis.ts", for review. | Content lead + engineering |
| D2 | Which lesson `START_LESSON {conceptId}` assigns in a question loop | An **authored link** on the question: `rubric.lessonFor: {conceptCode: lessonCode}`. The linter requires it for every concept that can be recommended. Recommendations (06 `Recommendations` VO) carry that lesson. `lessonFor(concept)` "first by code" is used only when a question has no link (practice). | Content lead (links), engineering (lint) |
| D3 | The funnel lesson | Author `StepMateri.vue`'s two slides as a catalog lesson (`MAT.TRI.L.FUNNEL_RATIO_CHOICE` or similar) with `c4` as its required check on slide 1. This is manual extraction, not the extractor, because the content lives in a template. Retire `c1`–`c3` as unused (a manifest note; they stay published for practice). | Content lead |
| D4 | Async diagnosis in Slice 2 (AI is off) | **Build the queued path now**, with a **test-only fake engine**: `job` gains `diagnosis_run_id`; a `diagnosis` queue; leases, heartbeat, recovery and adoption fencing (04 §7); E-09 and E-10. In production configuration nothing is ever queued, because deterministic coverage completes inline and there is no AI. The fake engine exists only in tests (`NODE_ENV=test` and an explicit flag). This makes T01-4, E-09, E-10 and lease recovery real tests now, and Slice 5 only adds the AI gateway. | Engineering |
| D5 | The unrouted typed loop (§1.1) | **Out of Slice 2.** Product decides: revive it as a second loop (its diagnostic steps then need a value object, see the Slice 1 report §7), or retire it. Until then its items stay practice-only. Recommendation: retire, and keep `trig-depression-01` and its retry as practice items. | Product |
| D6 | The L6 tutor ladder | Port `tutor.ts`'s `menara` and `umum` scripts into the manifest as private rubric content (`rubric.tutorLadder`). Its last node is the worked solution, so it never ships in public projections. The server counts hints; client `hintsUsed` and history are ignored (09 §6.2). `tangga` belongs to the intake demo (Slice 6). | Content lead |
| D7 | Dispute resolution tooling | A **staff CLI** (`npm run reports -- list|uphold|reject`), audited, synthetic only. A staff UI waits for OD-16 staffing. | Engineering; OD-16 product |
| OD-11 | "Saya tahu caranya" | Already the default in 05 §4.4: ask for proof (E-05), no XP for a claim. The frontend copy changes in M8. | Product (approve the copy) |
| D8 | Remote CI for the exit | The Slice 2 exit is "T01 scenarios pass **in CI** against PostgreSQL". This needs the repositories pushed and a GitHub Actions run with both checkouts. Recommendation: push the Slice 1 commits and add a coordinating workflow before M9. | Owner (push and CI access) |

**Approved 2026-10-19:** D1 (port the structure, fix the evidence rules, label every delta), D2 (authored `rubric.lessonFor` links) and D4 (the queued path with a test-only fake engine). D3, D5, D6, D7, D8 and OD-11 stay open.

## 3. Milestones

### M1 · Loop content in the manifest

- **Manifest schema v1 additions** (additive; lint rules and mutation tests in the M1 style):
  - `rubric.lessonFor: {conceptCode: lessonCode}` (D2). Lint: every key is a mapped concept, and every
    lesson exists and teaches that concept.
  - `rubric.recommend`: per misconception code, the recommended concept and `keyFormula` (feeds
    `next.formula`). Lint: codes exist on the concept.
  - `rubric.tutorLadder` (D6): nodes `{id, text, quick[], next{choice → node}, hint: bool}`, plus a
    `full` node. Lint: the graph is closed, at most 2 hint nodes on any path to `full`, and `full` equals
    or derives from `workedSolution`.
  - `rubric.solutionPaths` for soal-menara, rewritten as span patterns (§M2). Step concepts are already
    mapped.
- **Content to author or review:**
  - the tower rubric: paths `TAN` (and `COT`, if content agrees alternative paths count, K01);
    misconception patterns (`sin`/`cos` ratio choice on `tri-d`; special values on `tri-f`; inverted
    equation on the T13 concept, or `tri-d` if T13 stays unrouted);
  - the funnel lesson (D3);
  - `lessonFor` for the tower question;
  - the `menara` and `umum` ladders.
- **Golden file v2** (`catalog/golden/answers.v2.json`): adds `tower` cases. The numeric and option
  sections stay; v1 stays for history.
- **Acceptance:** draft lint clean (new tags are `PROPOSED` like the others). The extractor and
  round-trip are unchanged for extractor-owned content. Hand-authored entries are marked
  `provenance.source: authored`, so the extractor never overwrites them.

### M2 · `tower-v1`

`src/assessment/evaluators/tower-v1.ts`: pure, `(rubric, mapped concepts, response)` → verdict, evidence
and recommendations.

- **Responses:**
  - `TEXT` working: span-based step matching;
  - `SELF_REPORT`: `NOT_GRADED`, with `KNOW` → clarification (E-05) and `DONT_KNOW` → manual concept
    choice (E-06).
- **Matching:**
  - a step matches when its pattern (token runs, as `optionMatcher`'s whole-token rule, never
    substrings; `tan` must not match `tanpa`) appears. The quote is the exact substring
    (06 §2.4).
  - the final value goes through `numeric-v1`'s parser and tolerance;
  - `finalAnswerEvidence` applies when only a correct final value is written (06 §10 row 2).
- **Verdict:** `CORRECT` if the final value is correct, or if the full path matches with the right
  equation orientation. `INCORRECT` on a misconception pattern or a wrong final value **with** working.
  A wrong value without working is `INCORRECT` verdict with `INSUFFICIENT_EVIDENCE` for every concept
  → clarification (T01-3).
- **Golden:**
  - every `analysis.ts` branch becomes a case;
  - every D1 delta is labelled;
  - the 06 §10 table rows become cases.

  The Vue runner gains a `tower` section that compares `analysis.ts` and **lists the delta cases as
  expected differences**, so the frontend's demo stays honest about what changed.
- **Tests:** evaluator unit tests, INV-09 (only mapped concepts, only real spans), and determinism.

### M3 · Migration `0004` and the job queue

- **`0004_question_loop`:**
  - `diagnosis_report` from 04 §4, verbatim;
  - `job.diagnosis_run_id uuid UNIQUE REFERENCES diagnosis_run(id)`, with the `num_nonnulls` check
    replaced (04 §9 expand step);
  - indexes from 04 §5 (`diagnosis_report` open queue, learner, resolution run);
  - a size cap on `note`;
  - **a guard:** a report's `status` moves only `OPEN → UPHELD | REJECTED`, once.
- **Erasure:** add `diagnosis_report` before `diagnosis_run` (04 §8). The generic INV-19 coverage test
  fails until this is done, which is the point. Note retention (`note` → NULL after resolution + 30 days)
  is a retention job for Slice 4; record it.
- **Queue:** generalise `platform/jobs.ts` from deletion-only to queues (`deletion`, `diagnosis`):
  lease, heartbeat, recovery with backoff, `max_attempts`, `deadline_at`. Existing deletion tests must
  still pass unchanged.

### M4 · QUESTION_LOOP in the pure machine

Extend `src/learning/machine.ts`:
- **States:** `QUESTION`, `DIAGNOSING`, `CLARIFICATION_NEEDED`, `DIAGNOSIS_READY`, `RETRY`, `VERIFYING`,
  `EVALUATION_FAILED`.
- **Context:** clarification rounds, `unsuccessfulRetries`, active attempt, `resumeState`, active run
  status and generation.
- **Commands:**
  - E-01, E-03/E-04 (submit `INITIAL` or `CLARIFICATION`);
  - run outcomes as commands (`RUN_INSUFFICIENT`, `RUN_DIAGNOSED`, `RUN_CORRECT`, `RUN_EXHAUSTED`)
    for E-05–E-09 and E-17–E-20;
  - E-10 `REQUEST_DIAGNOSIS`;
  - E-11 `START_LESSON` from `DIAGNOSIS_READY`, `CLARIFICATION_NEEDED` or `RETRY`;
  - E-15 `START_RETRY`;
  - E-16 submit `RETRY`;
  - E-21 `REVIEW_SOLUTION`, including from `COMPLETED` without a version bump.

  `FINISH_LESSON` and `SKIP_LESSON` go to `RETRY` in a loop and to `PRACTICING` in practice.
- **Properties:** extend the Slice 1 generators and invariants. The version rule, terminal absorption
  and `allowedActions` ⇔ legality all carry over. New invariants:
  - a clarification round count ≤ 2;
  - `unsuccessful_retries` ≤ 2, never incremented by unreadable or insufficient results (INV-16);
  - `SOLUTION_REVIEWED` only after retry exhaustion or `REVIEW_SOLUTION`;
  - a self-report never yields a verdict other than `NOT_GRADED`.

### M5 · Loop service and endpoints

- **`POST /v1/learning-sessions` `QUESTION_LOOP`** (E-01): `{questionId, origin}`, a published question
  in the current release (private questions: Slice 6). The question's primary concepts emit
  `CONCEPT_VISITED` (a progress event, Slice 3; recorded as a deferral).
- **Attempts:**
  - Attempts in `QUESTION` (`INITIAL`), `CLARIFICATION_NEEDED` (`CLARIFICATION`), `RETRY` (`RETRY`).
  - The kind is derived from the state (05 §4.1). The parent is the latest `INITIAL`.
  - Purpose: `DIAGNOSIS` (initial and clarification) or `VERIFICATION` (retry).
- **Runs:**
  - Inline when the deterministic evaluator covers the response. The 201 carries a `COMPLETED` run, and
    the transaction falls through E-05…E-08 or E-17…E-20.
  - Otherwise queued (only the test-only fake engine queues in Slice 2, D4). The 201 carries `QUEUED`
    plus `Retry-After`, and the worker adopts the result under the 04 §7 fencing:
    - run `RUNNING`;
    - generation matches;
    - lease token matches;
    - the active attempt is the run's;
    - the learner is `ACTIVE`.
  - `EVALUATION_FAILED` on exhaustion. `POST /v1/attempts/{id}/diagnosis` (E-10) returns the existing
    run unless the session is in `EVALUATION_FAILED` and the generation is below 3.
- **Recommendations** (06 `Recommendations` VO): misconception → concept → `lessonFor` (D2), with
  `keyFormula`.
  - Insufficient evidence after the rounds, or `DONT_KNOW`, gives the primary concepts with the most
    basic first: hard-prerequisite order, then ordinal.
  - Never an invented gap (D07).
- **Lessons:** `START_LESSON` from a recommendation (E-11), with `LESSON_VIEWED` and pinned checks.
  Quick checks and finishing reuse Slice 1. `FINISH_LESSON` and `SKIP_LESSON` lead to `RETRY`.
- **Verification** (E-16–E-20):
  - First incorrect: `unsuccessful_retries` 1, one hint in the run.
  - Second incorrect: `COMPLETED` (`SOLUTION_REVIEWED`), and the solution becomes readable.
  - Unreadable or insufficient: back to `RETRY` with no allowance used.
  - Retry evidence is never transfer-eligible (INV-13, reason `ANCHOR_OR_RETRY`).
- **Solution** (E-21):
  - `POST …/solution` from `RETRY`, `EVALUATION_FAILED` or `COMPLETED`. It records `FULL_SOLUTION_SHOWN`
    for the family, deduplicated per session.
  - `GET …/solution` is readable once revealed; otherwise `403 SOLUTION_LOCKED`.
- **Sweeper:** QUESTION_LOOP expires 14 days after the last activity (E-25).
- **Tests:**
  - E-01, E-03–E-10, E-16–E-21 one by one;
  - T01-1 to T01-7, T01-9, T01-11, T01-12, T01-GO (a random sample of runs links attempt → run →
    evidence references → revision);
  - INV-08 (concurrent `REQUEST_DIAGNOSIS` → one run), INV-09, INV-13, INV-16, INV-22 (client
    timestamps change nothing);
  - lease expiry, recovery and late-result discard after abandon, expiry, a new generation, revocation
    and deletion;
  - the **model-based HTTP test** extended to QUESTION_LOOP, with run outcomes driven by the fake engine.

### M6 · Disputes

- `POST /v1/diagnosis-runs/{id}/reports`: `{reason, note?}`, idempotent, one per run
  (`409 ALREADY_REPORTED`), owner only (404), consent-gated. The run view gains `report{id, status}`.
- Staff CLI (D7): list `OPEN` reports; `reject`; `uphold` with an optional regrade.
  - A regrade writes an `EDUCATOR` run (generation +1) whose evidence rows `supersede` the disputed ones.
    This uses the one evidence update the Slice 1 trigger allows.
  - The report records `resolution_run_id`.
  - Every action writes an `audit_event` (staff actor, subject reference only).
  - Mastery and XP recomputation is Slice 3, recorded as a deferral.
- The note is learner free text (class C3). It never reaches logs, and it is erased with the learner.
  Its retention purge is a Slice 4 job.
- **Tests:** owner and consent gating, one per run, an `OPEN` report does not change eligibility
  (06 §9.3 rule 5), a regrade supersedes, erasure removes reports, audit rows exist, and the log canary on
  `note`.

### M7 · Facade L1, L2, L4, L6, L8 (+ L3)

All behind `FEATURE_LEGACY_FACADE`, with the same rules and the derived-key design as L3 (Slice 1 M7).
The oracle is again the shipped adapter bundled from the Vue repo.

| Call | Behaviour | Oracle |
|---|---|---|
| L1 `POST /v1/learning/diagnosis` | Find or create the QUESTION_LOOP for (`sessionId`, question alias) with key `<sid>:loop:<item>`. `responseMode` `know`/`blank` → `SELF_REPORT`; text → `TEXT`. `hintOpened: true` → a client-reported `HINT_SHOWN` (conservative). In `RETRY` (a "Coba soal tadi lagi" press), an implied `START_RETRY` and a `RETRY` attempt (09 §6.1 rule 6). Own questions → `403 FEATURE_DISABLED` (Slice 6). | `diagnosisRunWithBackend` + `isRun`, polling included |
| L2 `GET /v1/learning/diagnosis/{id}` | Owner check, the 09 §6.3 mapping, and `Retry-After` while pending. A run with no aliased concept is reported as `insufficient_evidence` with a clarification, never an empty `completed`. | same |
| L3 `check` `c1`–`c4` | Inside the loop's lesson: implied `START_LESSON` (the recommended lesson) and `ADVANCE_LESSON`, then the answer. `retry_original` → the implied finish, skip or start retry, then a `RETRY` attempt. | `checkWithBackend` |
| L4 `POST /v1/learning/solution` | `REVIEW_SOLUTION` (allowed in `RETRY`, `EVALUATION_FAILED`, `COMPLETED`); `{steps, after}` from `workedSolution` | `solutionWithBackend` + `isSolution` |
| L6 `POST /v1/learning/tutor` | The authored ladder, server-side (D6). The last learner message picks the branch, and hints are counted from `HINT_SHOWN` events. Two hints open `full` and record `FULL_SOLUTION_SHOWN`, making the solution readable. **No AI.** | `isTutorReply` |
| L8 `POST /v1/learning/intake/map` | A port of `detectLocally`. It returns only frozen aliases, `demo: false`, and never guesses outside mapped topics. | `isMap` |
| L7 | Remains `403 FEATURE_DISABLED` | — |

### M8 · Frontend `/coba` and `/challenge` on canonical sessions

Behind `VITE_CANONICAL_LEARNING`, for consented learners. Guests keep the device funnel (`analysis.ts`,
demo-labelled).

- `useCobaFlow` steps follow server state: a session per funnel run, its pointer resumed, and diagnosis
  polling on the canonical run.
- `StepMateri` renders the catalog lesson (D3). Retry and solution follow `allowedActions`.
- OD-11 copy: "Saya tahu caranya" leads to a clarification ("Tulis rumus atau langkah pertamamu"),
  with no comparison screen and no XP.
- "Hasil keliru? Laporkan" opens a small reason sheet → `POST …/reports`.
- **Playwright** (extends `canonical-practice.spec.ts`):
  - submit with working → diagnosis → lesson → refresh on slide 2 (T01-6) → check → retry → verified;
  - `sin` working → gap `tri-d`;
  - a wrong value without working → clarification (T01-3);
  - two stale tabs (T01-11);
  - report a run;
  - the solution after two unsuccessful retries.
- Update the Vue repo's stale landing specs **only if the owner asks**. They are unrelated (Slice 1 §9).

### M9 · Exit

- T01-1 to T01-7, T01-9, T01-11, T01-12 and T01-GO pass **in remote CI against PostgreSQL** (D8).
  This needs the coordinating workflow with both checkouts and the browser E2E.
- `npm run verify:slice2` (the `verify:slice1` pattern): every check, evidence,
  `verification-slice2.json`.
- `06-slice2-report.md` in the Slice 1 report's format, including what was not verified.

## 4. Cross-cutting rules for this slice

- **No AI, no queue in production paths.** Anything queued in Slice 2 comes from the test-only fake
  engine. Readiness keeps reporting AI as disabled.
- **Never an invented gap** (D07, 06 §2.3). Every evaluator path that cannot show a concept failing
  returns `INSUFFICIENT_EVIDENCE` or a learner choice. Golden cases pin this.
- **Contract first.** New fields (report on `DiagnosisRun`, `SOLUTION_LOCKED`, recommendations content)
  are checked against `openapi.yaml`. Any change goes in the same commit as `validate-spec.py` updates.
- **Lock order** (04 §7): learner → session → attempt/run → (Slice 3: mastery). Job adoption takes the
  same order.
- **Boundaries:** `tower-v1` and the ladder live in `assessment` and read rubrics through
  `grading-source`. The facade stays a translator (state only in canonical sessions). Staff tooling
  writes `audit_event` only through `privacy`.
- Each milestone ends with tests twice in a row, mutation checks on its key guards, and a status section
  in this plan. Commits follow the Slice 1 cadence.

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Content decisions (D1–D3, D6) stall, as D3–D6 did in Slice 1 | M2, M5 and M8 blocked for the real catalog | Engineering proceeds on the synthetic reviewed fixture, as in Slice 1. Content review starts in week 1. |
| `tower-v1` disagrees with the device demo | Guests and learners see different diagnoses | Golden v2 runs in both repos; deltas are explicit and reviewed |
| The async path is built but only exercised by a fake engine | Slice 5 surprises | The fake engine has realistic latency, failures and late results; adoption fencing is tested |
| Remote CI is required for the exit and has never run | Exit blocked | D8 early: push, add the coordinating workflow during M3 |
| The staff dispute flow becomes product scope | Slip | CLI only (D7); UI after OD-16 |
| Facade complexity (implied commands across lesson and retry) | Hidden state bugs | The model-based HTTP test drives the facade too, and the shipped adapters stay the oracle |

## 6. Approvals needed

1. **D1:** `tower-v1` evidence rules over keyword "kuat", with labelled deltas (content lead + engineering).
2. **D2, D3:** authored lesson links, and the funnel lesson in the catalog (content lead).
3. **D4:** the queued path with a test-only fake engine in Slice 2 (engineering).
4. **D5:** the fate of the unrouted typed loop (product).
5. **D6:** the tutor ladder as private rubric content (content lead).
6. **D7:** the staff CLI for disputes; OD-16 staffing (product).
7. **OD-11:** "Saya tahu caranya" copy (product).
8. **D8:** push and remote CI access for the exit (owner).
9. Carried from Slice 1: D3–D6 content review, the T13 exposure, the Vue dependency finding.

## 7. M3 status (2026-10-19)

The schema and the queue for the question loop exist. **No endpoint writes them yet** (M5, M6).

### What was built

**`migrations/0004_question_loop.*`**, generated by `scripts/extract-migration-question-loop.py`:
- `diagnosis_report`, verbatim from 04 §4: one report per run, bound to the run's learner by a composite FK,
  `note` capped at 500 characters, `resolved_at` exactly when resolved, a regrade run only when `UPHELD`.
- `job.diagnosis_run_id uuid UNIQUE REFERENCES diagnosis_run(id)`. The unnamed Slice 0 check
  (`deletion_request_id IS NOT NULL`) is found by its definition and replaced by
  `job_one_target CHECK (num_nonnulls(diagnosis_run_id, deletion_request_id) = 1)` (04 §9). Down restores it.
- The 04 §5 indexes: open reports, by learner, by resolution run.
- **Guard** (trigger `diagnosis_report_resolve_once`): a report moves `OPEN → UPHELD | REJECTED` once, changing
  only status, resolution code, resolution run and `resolved_at`. Clearing `note` is allowed at any time
  (04 §8 retention). Everything else is refused; deletes stay possible for erasure.

**Queue** (`src/platform/jobs.ts`), now for `deletion` and `diagnosis`:
- `lease(db, queue)`; `leaseDeletion` is kept as a wrapper, so Slice 0 behaviour and tests are unchanged.
- `enqueueDiagnosis` (one job per run, the run's deadline, `max_attempts`), `heartbeat`, `completeLease`
  (adoption closes the job in the applying transaction), `cancelRunJobs` (E-24/E-25), `removeRunJobs` (erasure).
- `retryLease`: deletion still retries after 1 s with `ERASURE_FAILED`; other queues back off exponentially with
  full jitter (≤ 2^attempts s, capped at 60 s). Past `max_attempts` or the deadline, a job fails.
- `recoverLeases` fails rather than requeues a job past its deadline. Cancelled jobs are never resurrected.

**Erasure:** `assessment/erasure.ts` deletes the learner's reports and the jobs of their runs before evidence
and runs. The boundary checker puts `diagnosis_report` in the `assessment` group. `src/database.generated.ts`
is regenerated (36 tables).

**Deferred:** note retention (`note → NULL` 30 days after resolution, at most 180 days) is a Slice 4 retention job.

### Verification (Node 20.19.4, PostgreSQL 17.5)

| Check | Result |
|---|---|
| Full backend suite | **111/111 pass, on two consecutive runs.** Evidence: `evidence/slice2-m3-m4-tests.txt`. |
| `question-loop-schema` (5) | 0004 rolls back to the Slice 0 check and re-applies; the check is replaced, not kept beside. |
| | `job_one_target` refuses no target and two targets; enqueue is idempotent per run; unknown runs fail the FK. |
| | Reports: one per run, own run only, the status/`resolved_at`/regrade checks, the guard (OPEN edits, a second resolution, re-opening, a note change during resolution are refused; clearing the note is allowed). |
| | Queue: separate queues, no double lease, heartbeat by holder only, backoff ≤ 2 s on attempt 1, a stale holder learns it lost, lease-expiry recovery, `max_attempts`, deadlines (never leased; failed on recovery). |
| | Fencing: completion once under a valid lease; a duplicate adopts nothing; cancellation of queued and running jobs, after which heartbeat, `validLease` and completion fail and recovery leaves them cancelled. |
| `learning-erasure` | INV-19 coverage now lists `diagnosis_report`; the seed adds a report and a run job; erasure removes both. 0004's down runs inside the rollback-to-0002 step. |
| `tsc`, boundary and rubric checks, OpenAPI validation, architecture self-test 14/14 | Pass |
| Migration reproducibility | Re-running the extractor writes the same 0004 |

**Not covered:** no API path writes reports or diagnosis jobs; the staff CLI (D7) is M6.

## 8. M4 status (2026-10-19)

`src/learning/machine.ts` now runs both session kinds. **The service does not use the loop yet**: `ctx.loop` is
absent for every persisted session, and `QUESTION_LOOP` creation still returns `FEATURE_DISABLED` (M5).

### What was built

- **States:** `QUESTION`, `DIAGNOSING`, `CLARIFICATION_NEEDED`, `DIAGNOSIS_READY`, `RETRY`, `VERIFYING`,
  `EVALUATION_FAILED`, beside the PRACTICE states. Outcomes `SOLVED_FIRST_TRY`, `SOLVED_AFTER_LEARNING`,
  `SOLUTION_REVIEWED`.
- **Context** `loop` (present exactly for QUESTION_LOOP): clarification rounds, unsuccessful retries, the active
  attempt (kind and self-report), the active run (generation, `PENDING`/`COMPLETED`/`FAILED`/`CANCELLED`,
  verdict), `resumeState`, the anchor's hint count, whether the solution is revealed.
- **Commands:**
  - `SUBMIT_ATTEMPT` derives the kind from the state (E-03, E-04, E-16) and may carry an `inline` run outcome,
    which falls through E-05…E-08 or E-17…E-20 in the same command, so the version moves once.
  - Run outcomes `RUN_INSUFFICIENT`, `RUN_DIAGNOSED`, `RUN_CORRECT`, `RUN_EXHAUSTED` with a `generation`. They
    are refused unless the run is pending with that generation; the service adds the lease and attempt fences.
  - `REQUEST_DIAGNOSIS` (E-10, generation < 3, back to `resumeState`), `START_LESSON {lesson}` (E-11, the
    service resolves and pins the lesson), `START_RETRY`, `REVIEW_SOLUTION` (E-21; from `COMPLETED` it
    reveals without a state change or version step), `REQUEST_HINT` on the anchor.
  - `FINISH_LESSON` / `SKIP_LESSON` lead to `RETRY` in a loop and to `PRACTICING` in practice.
  - `ABANDON` / `EXPIRE` cancel a pending run, so a late result is refused.
- **Self-reports** (05 §4.4): `DONT_KNOW` goes straight to E-06; `KNOW` asks for proof (E-05). A self-report
  attempt accepts only `RUN_INSUFFICIENT` with `NOT_GRADED`, or exhaustion.
- `allowedActions` adds `START_LESSON`, `START_RETRY`, `REVIEW_SOLUTION`, `REQUEST_DIAGNOSIS`; a completed loop
  allows only `REVIEW_SOLUTION`.

### Verification

| Check | Result |
|---|---|
| `learning-machine` (13) | Random walks from both kinds (400 runs × 40 steps per property). |
| | Carried over: INV-06 version rule, terminal absorption (except E-21 from `COMPLETED`), `allowedActions` ⇔ legality, the practice and lesson invariants. |
| | New: kinds never mix states; rounds ≤ 2, unsuccessful retries ≤ 2, generations ≤ 3; INV-16 (only an incorrect verification consumes a retry); `SOLUTION_REVIEWED` only by exhaustion or `REVIEW_SOLUTION`; a self-report never yields a verdict other than `NOT_GRADED`; runs are pending exactly in `DIAGNOSING`/`VERIFYING`, fenced by generation and status, and cancelled on leaving. |
| | Example paths for every row group E-03–E-21, including queued E-17/E-18/E-19 and a retry exhaustion resuming into `VERIFYING`. |
| Walk coverage | Measured: every QUESTION_LOOP transition in the 05 §3 diagram is reached by the random walks. Queued verification completions are rare, so they also have examples. |
| Mutation check | Letting E-20 consume a retry fails the INV-16 property. Accepting a graded verdict on a self-report fails the self-report property and the example paths. |

**Not covered:** the machine is pure; persistence, the lease fences, content guards and the HTTP model test of
the loop are M5.

### Repository state

**Committed as `bf02e7f`** on backend `main` ("feat(slice2): M3 question-loop schema and job queues, M4
QUESTION_LOOP machine"), together with the M3 evidence file.

**Not pushed:** `main` is 9 commits ahead of `origin/main` (checked 2026-10-19). Pushing waits on the
owner (D8).

The verification in §7–§8 ran on Node 20.19.4 before the M1/M2 changes; it has not been repeated on Node 24.

## 9. M1 status (2026-10-19): implemented for what D1 and D2 support

**Status: implemented and verified on Node 24.19.0 (§11), not committed.** Every new content entry is `PROPOSED`; nothing here is reviewed or approved content. The publisher still
refuses the draft.

### What was built

**Hand-authored overlays: `catalog/authored/`.** The tower question and the TRI topic are extractor-owned files,
and the extraction round-trip must stay byte-identical. Authored content therefore lives beside the manifest
and is applied at load time (`applyAuthored`).
- Each overlay has `provenance.source: authored` and its own `review`.
- `writeManifest` refuses a manifest with overlays applied.
- `loadManifest(dir, { authored: false })` gives the extractor's files alone.

Three overlays, all `PROPOSED` (decision `S2-D1`):

| File | Content |
|---|---|
| `MAT.TRI.Q.SOAL_MENARA.rubric.yaml` | Step `patterns` for TAN S1–S3. Four TEXT misconception patterns: `MEMAKAI_SIN`, `MEMAKAI_COS` (existing codes), `TAN30_BUKAN_SETENGAH`, `PERSAMAAN_TERBALIK`. `recommend` with `keyFormula` copied from `analysis.ts` `next.formula`. `lessonFor` for the three primary concepts (D2), following the `coreId` each `analysis.ts` branch routes to. |
| `MAT.TRI.SUDUT_ISTIMEWA.misconceptions.yaml` | `TAN30_BUKAN_SETENGAH` (analysis.ts branch 3) |
| `MAT.TRI.DEFINISI_SIN_COS_TAN.misconceptions.yaml` | `PERSAMAAN_TERBALIK` (§1.2). It sits on `tri-d` because T13 is not mapped on the tower question (D5 open). |

**Schema v1 additions (additive):**
- step `patterns`, misconception `pattern.tokens`;
- `rubric.lessonFor` and `rubric.recommend`;
- the `authored` overlay definition;
- review `decision` may be `S<slice>-D<n>`.

**Token runs (`src/catalog/text-pattern.ts`).** Matching is by whole tokens only (`tan` never matches
`tanpa`). Matches keep offsets into the original text, so quotes are exact substrings (06 §2.4).

**Lint rules:**
- `PATTERN`, `LESSON_LINK` (D2), `RECOMMEND`, `AUTHORED_TARGET`;
- overlay reviews count as `UNREVIEWED`;
- `EVALUATOR_SHAPE` for `tower-v1` requires a numeric answer with tolerance.

**D3 stand-in (test memory only):** `test/fixtures/loop-content.ts` adds
`MAT.TRI.L.SYNTHETIC_FUNNEL_FIXTURE`. It has placeholder slides, a required check on slide 1 and a `PROPOSED`
`S2-D3` review. Tests assert that strict lint refuses it and that it never appears under `catalog/`.

**Also changed:** `test/catalog-publisher.test.ts`. Its "misconception removed" case now also removes the
code from `recommend`, so the publisher's own rule is what refuses the publish. The guarantee it tests is
unchanged.

**Not done, waiting on decisions:**
- the funnel lesson content and `c1`–`c3` retirement (D3);
- the tutor ladder: no schema, no content (D6);
- the typed loop (D5);
- the "Saya tahu caranya" copy (OD-11).

## 10. M2 status (2026-10-19): `tower-v1`

**Status: implemented and verified on Node 24.19.0 (§11), not committed.** The 12 deltas from `analysis.ts`
are proposals awaiting content review, not approved behaviour.

### What was built

**`src/assessment/evaluators/tower-v1.ts`.** A pure function, registered in `EVALUATORS`. Practice still
excludes `FREE_RESPONSE` items, so no endpoint grades with it yet (M5).
- **Self-reports:** `NOT_GRADED`, no evidence, nothing revealed.
- **Final value:** the whole response when it is only a value, or each side of an `x = …` clause. It goes
  through the `numeric-v1` parser and tolerance.
- **Verdict:**
  - `CORRECT` when the final value is correct, or every step matches with no misconception;
  - `INCORRECT` on a catalogued misconception, or a wrong final value;
  - otherwise `UNREADABLE` with reason `insufficient-working`. M5 maps this to `RUN_INSUFFICIENT`, so no
    retry is consumed (INV-16).
- **Evidence (D1):**
  - understanding only from a matched step span before the first error, or a correct final value through
    `finalAnswerEvidence`;
  - misconceptions only from catalogued patterns, and never against a correct result (K01);
  - a bare wrong value is `INSUFFICIENT_EVIDENCE` everywhere (T01-3);
  - steps after the first error are `NOT_ASSESSED`; everything else is `INSUFFICIENT_EVIDENCE`.

**Golden v2: `catalog/golden/answers.v2.json`.** v1 is unchanged and kept for history.
- The numeric and option sections are carried over unchanged.
- The `tower` section has 21 cases. Each records the server's expected result and the shipped
  `analysis.ts` output.
- 12 cases are labelled **"delta from analysis.ts"**, with status `PROPOSED — awaiting content review (not
  approved)`. The labels were authored before comparison; the builder refused to write the file unless the
  labelled cases were exactly the differing ones.

| Case | Delta (summary) |
|---|---|
| T03 `cos 30 = 20/x` | `tri-c` is credited from the span `20/x`; the demo credits it only next to sin. |
| T04 `tan 30 = 1/2` | `tri-c` is not credited without a span. |
| T06 `tan 30 = 20/x` | The set-up alone is `UNREADABLE` (clarification), not "kuat". **Review question:** `acceptedForms` lists this equation. |
| T07 `tan x` | Insufficient, not "kuat". |
| T08 `tan 30 = x/20`, T09 `x = 20 tan 30` | Inverted equation: `INCORRECT`, `PERSAMAAN_TERBALIK`. |
| T10 `… x = 20/√3` | Wrong result with working: `INCORRECT`. |
| T16 sin → hypotenuse → cos path | A correct result by another valid path: `CORRECT` (K01). |
| T17 `jaraknya 20√3 m` | A value inside a sentence is not read as final. **Review question.** |
| T18 "belum tahu" | No `tri-d` gap evidence; the route to `tri-d` stays as the E-06 recommendation. |
| T20 `saya bingung`, T21 `40` | No invented `tri-c` gap (D07, T01-3). |

**Vue runner** (`scripts/answerGolden.test.ts`, uncommitted on the Vue branch):
- defaults to v2, and still accepts v1;
- checks that `analysis.ts` still produces each recorded output;
- checks that exactly the labelled cases differ, and that every label is `PROPOSED`.

`analysis.ts` and the funnel screens are not changed.

## 11. M1/M2 verification (2026-10-19, Node 24.19.0, PostgreSQL 17.5)

Evidence: `evidence/slice2-m1m2/`, one file per check plus `summary.json`.
- **Runtime:** Node v24.19.0, installed through nvm at the owner's request. The runner refuses to start unless
  both the runner and the child processes report v24.19.0; both did.
- **Database:** the isolated cluster at 127.0.0.1:55432, `intibelajar_slice0_test`.
- **Date:** `summary.json` shows 2026-10-18 because the date is recorded in UTC. The run was on 2026-10-19
  local time (+07).

| Check | Result (Node 24.19.0) |
|---|---|
| `tsc`, module and rubric boundaries, OpenAPI validation | Pass |
| Manifest lint, draft | 0 errors, 61 warnings (all UNREVIEWED: 58 carried from Slice 1, plus the three `S2-D1` overlays) |
| Manifest lint, strict | Refuses the draft as expected: 61 errors |
| Golden v2 sync | 37 option items, 81 numeric cases, 21 tower cases (12 labelled deltas) |
| Alias coverage and freeze; frontend `src/data` unchanged since extraction | Pass |
| Manifest round-trip | Re-extraction is byte-identical to `catalog/manifest` (overlays live outside it) |
| Migration reproducibility | Re-running the three extractors leaves `migrations/` unchanged |
| **Full backend suite, run 1** | **127 tests, 127 pass, 0 fail** (81.4 s) |
| **Full backend suite, run 2** (consecutive) | **127 tests, 127 pass, 0 fail** (76.9 s) |
| Architecture self-test | 14 pass, 0 warn, 0 fail |
| Frontend suite (`verify:frontend`) | Pass: Vue unit tests, 7 math insertion checks, 29 backend contract checks, golden v2 (81 numeric, 47 multiple-choice, 21 tower; 12 labelled deltas) |
| Browser E2E (canonical practice) | 2 passed |
| Code mutation checks | **10/10 killed** (`mutation-checks.txt`). Every mutated source was restored afterwards: the anchors were checked. |

**What the passes cover, and what they do not:**
- The backend suite includes the corrected `catalog-publisher` case. The two failures seen on Node 20 before
  that correction are recorded in `evidence/slice2-m1m2-node20-preliminary/`.
- These are engineering checks. The tower content (three overlays) and the 12 deltas remain `PROPOSED`; a
  passing run does not approve them.
- `tower-v1` has no endpoint yet (M5).

**Process notes:**
- **A second session ran in parallel.** A forked session ran the same verification on its own Node 24.19.0
  runtime (`.cache/codex-runtimes`) shortly before this run and reported 21/21. Starting this run deleted
  that session's evidence folder, so the evidence here is this run's alone. The fork reports that its npx
  check downloaded `node@26.12.0` into the npx cache; no repository file changed.
- **The nvm symlink was not created.** `nvm use 24.19.0` printed success, but `C:\nvm4w\nodejs` was not
  created; the symlink needs administrator rights. This run therefore called Node 24 by its install path.

### Blockers and open items

| Item | Blocks | Owner |
|---|---|---|
| The nvm symlink `C:\nvm4w\nodejs` is missing, so a plain `node` is not on PATH in new terminals | The owner's local shell; switching back to 20.19.4 | Owner: run `nvm use 20.19.4` from an administrator terminal |
| Content review of the 12 tower deltas and the three `S2-D1` overlays (T06, T17, `PERSAMAAN_TERBALIK` on `tri-d`) | Publishing the tower rubric; the Slice 2 real-catalog exit | Content lead |
| D3 funnel lesson (only a synthetic stand-in exists) | M1 completion; `lessonFor tri-d` may change | Content lead |
| D6 tutor ladder (no schema, no content) | Facade L6 (M7) | Content lead |
| D5 typed loop | Possibly where `PERSAMAAN_TERBALIK` belongs | Product |
| D7 dispute staff CLI | M6 | Engineering; OD-16 product |
| OD-11 "Saya tahu caranya" copy | M8 copy | Product |
| D8 push and remote CI: `bf02e7f` and 8 earlier commits are local only | The Slice 2 exit (T01 in CI) | Owner |
| Carried from Slice 1: 58 UNREVIEWED draft tags (D3–D6), the T13 exposure, the Vue dependency audit | The real-catalog release | Content lead; engineering |
| Uncommitted: the M1/M2 backend work and the Vue golden runner change | Waits for a commit instruction | Owner |

## 12. M5 status (2026-10-19): loop service and endpoints

**Status: implemented and verified on Node 24.19.0, not committed.**
- Every test runs against the reviewed fixture, whose review marks are synthetic and exist in test memory only.
  The committed draft is still `PROPOSED`, and the publisher still refuses it (strict lint: 61 errors).
- No content was approved.
- No AI is called. The queued engine is a test-only fake.

### What was built

**Endpoints (contract `/v1` unchanged; FEATURE_DISABLED removed only for the loop):**
- `POST /v1/learning-sessions` `QUESTION_LOOP` (E-01): `origin` FUNNEL, BANK or CHALLENGE; INTAKE stays `403
  FEATURE_DISABLED` (Slice 6). The anchor is a published, non-private question of the current release whose
  rubric evaluator is deterministic, otherwise `409 CONTENT_UNAVAILABLE`. The TTL is 14 days after the last
  activity (E-25).
- `POST …/attempts` in `QUESTION`, `CLARIFICATION_NEEDED` and `RETRY` (E-03, E-04, E-16). The kind is derived
  from the state, and the parent is the latest `INITIAL`.
- `POST …/actions` `START_LESSON {conceptId}` (E-11): the concept must be mapped on the anchor; the lesson is
  `rubric.lessonFor` (D2), else the concept's lesson, else `409 CONTENT_UNAVAILABLE` with no writes.
  `START_RETRY` (E-15); `FINISH_LESSON` / `SKIP_LESSON` lead to `RETRY`.
- `POST …/solution` (E-21) and `GET …/solution`. GET returns `403 SOLUTION_LOCKED` until E-19 or E-21 revealed
  the solution. `FULL_SOLUTION_SHOWN` is recorded for the family, once per session.
- `POST /v1/attempts/{id}/diagnosis` (E-10, A01): 201 with a new generation only from `EVALUATION_FAILED` for
  the active attempt below generation 3; otherwise 200 with the latest run, unchanged.
- `POST …/hints` on the anchor (E-23).
- `Retry-After` on queued or running runs.
- The dispute endpoint stays disabled (M6).

**Runs (`src/assessment/diagnosis.ts`), following 06 §2.3:**
- **Inline** when the deterministic evaluator covers the response: CORRECT, INCORRECT or a self-report. The command
  falls through E-05…E-08 or E-17…E-20 in one transaction, with one version step.
- **Queued** only when it does not cover the response, an engine exists, and the learner granted `AI_PROCESSING`.
  Otherwise the run completes inline as insufficient evidence.
- **Run results are mapped like this:**
  - verification judges the answer: INCORRECT uses a retry (E-18/E-19);
  - diagnosis judges the evidence: unsupported results ask for working (E-05), including a bare wrong value
    (T01-3);
  - the machine's `RUN_INSUFFICIENT` may now carry INCORRECT in diagnosis only.
- **Evidence eligibility:** loop attempts are never transfer-eligible (INV-13, `ANCHOR_OR_RETRY`); queued-engine
  evidence has source AI and is never mastery-eligible (INV-10, `AI_ONLY`, also the DB check).
- **Recommendations** are stored on the run:
  - a catalogued misconception points to its `rubric.recommend` concept and key formula, with lesson
    `lessonFor`;
  - otherwise the primary concepts not shown, most basic first (hard prerequisites, then ordinal);
  - "belum tahu" gets every primary concept that way.
- **`revealedAnswer`** is now shown only for practice `GRADING` runs. A loop never reveals the key in a run
  (06 §2.4 rule 7).

**Queued path (`src/learning/diagnosis-worker.ts`), D4:**
- The fake engine is passed in code through `buildApp(…, { diagnosisEngine })`, which refuses it unless
  `NODE_ENV=test` and the engine is marked `testOnly`. No parameter, header or environment setting selects it.
- The production worker runs `diagnosisTick(db, null)`: it only recovers leases and ends runs that cannot
  finish.
- The engine gets the item and response, never the learner (06 §2.1).
- Output is validated as an AI candidate (06 §2.4): schema, concept scope, assessable, catalogued misconception,
  real spans, support, confidence floor 0.7.
- **Adoption fences (04 §7 order):** learner lock and consent (LEARNING_DATA + AI_PROCESSING), valid lease,
  session lock, active attempt, pending run of that generation, run RUNNING.
  - A late result is discarded with no evidence and its run cancelled.
  - A revoked consent ends the run with `CONSENT_REVOKED` and `EVALUATION_FAILED`, which can be resumed.
  - Deletion drops the result.
- **Exhaustion (E-09):** a run past its deadline, or whose job gave up after 3 calls (backoff from M3), fails with
  `DEADLINE_EXCEEDED`, `INVALID_OUTPUT` or `DEPENDENCY_UNAVAILABLE`, writes no evidence, and moves the loop to
  `EVALUATION_FAILED`.
- `ABANDON` (E-24) and the sweeper (E-25) cancel the waiting run and its job.

**Other changes:**
- `persist` writes `resume_state` only in `EVALUATION_FAILED`, as the DB check requires.
- `LESSON_VIEWED` is deduplicated per assignment, so a loop may view two lessons.
- `privacy.hasConsent` and `holdLearner`, `platform` run-job helpers, and `catalog` `loopAnchor`,
  `mappedConcepts`, `basicFirst` and `lessonFor` by code. Module boundaries pass.
- Tests changed:
  - `learning-sessions.test.ts`: its Slice 1 pins ("loop and solution disabled") now expect the Slice 2
    behaviour on a practice session (solution 409, GET 404, A01 200 unchanged);
  - the learner fixture accepts consent `purposes`.

### Verification (Node 24.19.0, PostgreSQL 17.5; evidence `evidence/slice2-m5/`)

| Check | Result |
|---|---|
| Static: `tsc`, module and rubric boundaries, OpenAPI | Pass |
| Manifest lint | Draft: 0 errors, 61 UNREVIEWED. Strict refuses the draft: 61 errors. |
| Golden v2 sync; alias coverage and freeze; round-trip; migration reproducibility | Pass |
| `question-loop` suite | **20/20** (168 s) |
| **Full backend suite, run 1** | **147 tests, 147 pass, 0 fail** (549.5 s) |
| **Full backend suite, run 2** (consecutive) | **147 tests, 147 pass, 0 fail** (110.5 s) |
| Architecture self-test | 14 pass |
| Frontend suite with golden v2 (`verify:frontend`) | Pass: 29 contract checks; 81 numeric, 47 multiple-choice and 21 tower golden checks; 12 labelled deltas |
| Browser E2E (canonical practice) | 2 passed: PRACTICE and the demo are unchanged |
| Code mutation checks | **17/17 killed** (`mutation-checks.txt`). Sources restored after each. |

**Mutation checks in detail:**
- The first round killed 14/17. The three adoption fences (generation, active attempt, lease) overlap, so each
  survived alone. A test isolating each fence was added, then all 17 were run again.
- In the batch rerun, mutation 1 was recorded as failing `setup`/`E-01`. Rerun alone, it is caught by the
  intended assertion "another generation is fenced out" (`mutation-1-rerun-alone.txt`). The batch attribution
  was incidental.
- Mutation runs skip only the model-based test (about 5 minutes a run). Each mutation has a dedicated subtest;
  the model test runs in full in both backend runs.

**Run times vary a lot:** 549 s versus 110 s, almost all of it the model-based test. Not investigated beyond that;
both runs pass.

**Test IDs covered:**
- E-01, E-03 to E-21, E-23, E-24, E-25;
- T01-1, T01-3, T01-4, T01-5, T01-6, T01-7, T01-9, T01-11, T01-GO;
- INV-01, INV-02.1, INV-04, INV-06 (model-based HTTP, 25 random sequences against the pure machine, refusals
  write nothing), INV-08.1, INV-10, INV-13, INV-16.1 and .3, INV-19 (erasure after a late result), INV-22;
- lease expiry and recovery, and late-result discard after abandon, expiry, a new generation, revocation and
  deletion.

### Deferrals (recorded, not done)

| Item | Where |
|---|---|
| `CONCEPT_VISITED` progress event on E-01 | Slice 3 (progress) |
| XP, mastery and T01-8 | Slice 3 |
| E-18's "one hint in the run" feedback; hints stay available through E-23 | Copy, with OD-11 / content review |
| `anchorQuestion` (optional `QuestionView`) in `LearningSession`. The frontend can read `GET /v1/questions/{id}`. (Location on 201 is no longer deferred; it is done in §13, as 09 requires.) | M8, if the frontend needs it |
| The tutor gate ("pembahasan lengkap") | D6 / Slice 5 |
| A real AI engine | Slice 5. The Slice 2 engine is a test fake only. |
| The model-based test takes about 2–9 minutes | Engineering follow-up |

### Blockers and open items (after M5)

| Item | Blocks | Owner |
|---|---|---|
| Content review: the 12 tower deltas, the three `S2-D1` overlays, and the new loop copy (run headlines, clarification prompts, recommendation reasons) | Publishing the tower rubric and the loop copy; the real-catalog exit | Content lead |
| D3 funnel lesson (synthetic stand-in only) | `lessonFor tri-d`; M7 L3 funnel checks | Content lead |
| D6 tutor ladder | M7 L6 | Content lead |
| D5 typed loop; D7 dispute CLI (M6); OD-11 copy (M8) | As listed | Product; engineering |
| D8 push and remote CI. `bf02e7f` and 8 earlier commits are local only (`main` 9 ahead of `origin/main`). | The Slice 2 exit | Owner |
| The nvm symlink `C:\nvm4w\nodejs` is still missing; verification calls Node 24 by its install path | The owner's shell | Owner (`nvm use` from an administrator terminal) |
| Uncommitted: M1/M2/M5 backend work and the Vue golden runner change | Waits for a commit instruction | Owner |

## 13. M5 follow-up (2026-10-19): Location on every 201, and an open reliability finding

### Location (09 §1: "201 created (with Location)")

- `send()` now sets `Location` on every 201 and throws if a 201 has none, so the gap cannot reappear.
  Location is derived from the stored body, so an idempotent replay repeats it. A 200 carries none.

| Operation | Location |
|---|---|
| `POST /v1/learning-sessions` | `/v1/learning-sessions/{id}` |
| `POST …/attempts`, `POST …/quick-check-answers` | `/v1/attempts/{attemptId}` |
| `POST /v1/attempts/{id}/diagnosis` (201: new generation) | `/v1/diagnosis-runs/{runId}` |
| `POST /v1/me/consent-requests` (Slice 0) | `/v1/me/consents` |

- **Tests:** the loop, practice and Slice 0 suites check that every 201 has a Location that reads back (GET 200
  with the same id), that a replay repeats it, and that a 200 has none.
- **Mutation checks: 3/3 killed** (`evidence/slice2-m5-location/mutation-checks-location.txt`): Location
  dropped, Location naming the wrong resource, Location missing on the consent request.
- **Contract finding (not changed):** `openapi.yaml` declares Location for 201 on device imports, sessions,
  attempts, quick checks, diagnosis, tutor conversations and intakes, but **not** on
  `POST /v1/me/consent-requests`, `POST /v1/diagnosis-runs/{id}/reports` or
  `POST /v1/question-intakes/{id}/confirmation`. That is inconsistent with 09 §1. The server sends Location on
  the consent request (additive). Updating the contract is an owner decision.

### Verification after the Location fix (Node 24.19.0; evidence `evidence/slice2-m5-location/`)

| Check | Result |
|---|---|
| Static checks, manifest lint (strict still refuses the draft), golden v2, round-trip, migrations | Pass |
| `question-loop` suite | 21/21 |
| Frontend suite with golden v2; browser E2E | Pass; 2 passed |
| Full backend, first pair | Run 1: **138/140, 2 failed**: `catalog-read` "Connection terminated due to connection timeout", and a follow-on failure. Run 2: 149/149. |
| Full backend, second pair | Rerun 1: **147/149, 2 failed**: the PRACTICE model-based test (Slice 1), whose session creation returned no session. Rerun 2: 149/149. |
| Full backend, final pair | Final 1: 149/149. Final 2: **147/149, 2 failed**: T01-11 (two tabs) got 201 + 500 instead of 201 + 409. |

**Result: two consecutive green full runs were not achieved. M5 verification is not complete.**

### Open finding: intermittent 500 when a new database connection is slow

- **Observed:** T01-11 got 201 + 500 twice (once before and once after the Location change). `catalog-read` hit a
  connection timeout once.
- **Evidence:** at each failure PostgreSQL logged an aborted client connection ("could not receive data from
  client: … aborted by the software in your host machine") at the matching time (13:34:56, 14:26:08).
- **Not reproduced in isolation:** 40 isolated two-tab races and several full runs gave the correct 201 + 409.
- **Likely mechanism:** `src/db.ts` sets `connectionTimeoutMillis: 2000` and `idleTimeoutMillis: 10000`. Under
  full-suite load on this Windows machine, opening a new connection sometimes takes longer than 2 s, and pg
  cuts it. That error has no SQLSTATE code, so the error handler answers 500, not 503 DEPENDENCY_UNAVAILABLE
  (retryable). No partial writes were seen; the transaction rolls back.
- **Not proven:** the handler logs no cause for a 500, so the link to a specific request is a timing correlation.
- **Proposed fix (needs an owner decision; not applied):**
  1. map pg connection errors without SQLSTATE ("Connection terminated", "timeout exceeded when trying to
     connect") to 503 DEPENDENCY_UNAVAILABLE with Retry-After;
  2. raise the connect timeout (e.g. 10 s, within the 10 s request timeout) and keep idle connections longer;
  3. log the error class and SQLSTATE (no content) for any 500;
  4. then repeat the two consecutive full runs.
- **The PRACTICE model-based failure:**
  - The test used one learner for every run, and the per-learner limit is 120 requests a minute.
  - The test now uses one learner per run and asserts that creation returns 201, so a recurrence shows its
    status.
  - A probe with the old single-learner form passed, so rate limiting is **not confirmed** as the cause; a
    connection timeout fits the evidence as well.

## 14. Open backlog from the M5 verification (2026-10-19)

These findings keep the **M5 verification gate open** and **block the Slice 2 release gate**.
- The last two full backend runs did **not** pass consecutively: final run 1 was 149/149, final run 2 was
  147/149.
- Failing and passing evidence are kept in separate files. None is overwritten.
- The final verification must run the model-based tests in full; skipping them is allowed only in mutation runs.

### B-01 · T01-11 returned 500 under full-suite load: OPEN / NEEDS FIX (still open after M8, §17)

- **Impact:** two tabs on one version must give one 201 and one `409 STALE_STATE_VERSION`. A 500 breaks T01-11 and
  the Go/No-Go rule "data consistent after parallel requests", and is not a retryable error for the client. No
  partial write was observed (the transaction rolls back), but that is not proven for every case.
- **Root cause: unknown.** The error handler logs no cause for a 500.
  - PostgreSQL logged an aborted client connection at the times of both failures (13:34:56 and 14:26:08).
  - The pool's `connectionTimeoutMillis: 2000` could cut a slow new connection, and a cut connection has no
    SQLSTATE, so it falls through to 500.
  - These are hypotheses consistent with the timing, not a diagnosis.
- **Evidence:**
  - `evidence/slice2-m5-location/backend-tests-final-2.txt`: the second occurrence, 147/149.
  - `evidence/slice2-m5-location/backend-tests-final-1.txt`: the passing run before it.
  - `.local/pg17.log`: aborted connections at 13:34:56 and 14:26:08. Local only, not committed.
  - The first occurrence was in a combined run of slice0, learning-sessions and question-loop with the model
    test skipped: `.local/m5-location.log`, local only.
  - `evidence/slice2-m5-location/backend-tests-run-1.txt`: a related connection timeout in `catalog-read`.
- **Reproduction available:**
  - Run the full backend suite on Node 24.19.0 against the local cluster:
    `node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 'test/*.test.ts'`. It failed in 1 of 6 full
    runs after M5.
  - Not reproduced in isolation: 40 two-tab races with the catalog published gave 201 + 409 every time, and 2
    combined runs passed.
- **Acceptance criteria:**
  1. Every 500 records its error class and SQLSTATE in the log, without request content.
  2. The cause of the T01-11 500 is identified from that record.
  3. A fix keeps T01-11 at 201 + 409. If the cause is a dependency failure, the API answers 503
     DEPENDENCY_UNAVAILABLE with Retry-After instead of 500, and a test covers that mapping.
  4. A repeated two-tab race under full-suite load shows no 500, and a check proves no partial write after a
     failed request.
  5. Two consecutive full backend runs pass on Node 24.19.0, model-based tests included, with their exit codes
     recorded (B-03).

### B-02 · PRACTICE model-based test (INV-06.1) failed on `.map` of undefined: OPEN / NEEDS FIX (still open after M8, §17)

- **Impact:** INV-06.1 compares every HTTP step of a PRACTICE session with the pure machine. One run failed in
  `toContext` because a session response had no `items`. Until it is explained, INV-06.1 is not reliable
  evidence, and a hidden API error (429, 500 or another) cannot be excluded.
- **Root cause: unknown.**
  - **Rate limiting:** the test used one learner for every run, against the per-learner limit of 120 requests a
    minute, which would return 429 without a session body. A probe with that single-learner form
    (`.local/probe-429.log`, local) **passed**, so this is not confirmed.
  - **Connection failure:** a connection timeout as in B-01 is equally consistent with the evidence.
- **Evidence:**
  - `evidence/slice2-m5-location/backend-tests-rerun-1.txt`: the failure, "Property failed after 14 tests …
    reading 'map'".
  - `evidence/slice2-m5-location/backend-tests-rerun-2.txt`: the passing run after it.
- **State of the test (working tree, not committed):** it now creates one learner per run and asserts that
  session creation returns 201, printing the response body otherwise. The assertion is stricter and no check
  was removed. The failure happened with the earlier single-learner form, and the change has not yet been
  shown to address it.
- **Reproduction available:** the full suite as in B-01 (1 failure in 6 full runs). Not reproduced alone.
- **Acceptance criteria:**
  1. The response that lacked `items` is identified (status and code, from the new assertion or server logging).
  2. Its cause is fixed in the API, or in the test if the test misused the API. The fix is documented, with no
     weakened assertion and no skipped run.
  3. INV-06.1 passes in two consecutive full runs, plus a dedicated repeat of the property under load.

### B-03 · The Bash runner reported exit 0 although Node failed: CLOSED (2026-10-19, negative control in §17)

- **Impact:** commands of the form `node … | grep …` or `node … | tail` return the exit code of the last
  pipeline stage. Background tasks therefore reported "exited with code 0" while their output showed failures.
  A failing verification can look green to anyone who reads only the exit status.
- **Root cause: known.** Without `set -o pipefail` or a `PIPESTATUS` check, a pipeline's status is its last
  command's. The Node runner `verify-m5.mjs` itself exits 1 on any failed check (its `summary.json` records each
  exit code), but its caller piped it into `tail`.
- **Evidence:**
  - `evidence/slice2-m5-location/summary.json` and `backend-tests-run-1.txt` (19/20, run 1 failed), while the
    task that ran them reported exit 0.
  - `backend-tests-rerun-1.txt` and `backend-tests-final-2.txt` (fail 2), likewise reported exit 0 by their
    loops.
- **Reproduction available:** `bash -c 'false | tail -1; echo $?'` prints 0.
- **Acceptance criteria:**
  1. Every verification command is run with `set -o pipefail`, or writes Node's own exit code to the evidence.
  2. The overall verification exits non-zero when any check fails.
  3. A deliberately failing check proves both.
  4. Evidence summaries state the exit code of each run.

## 15. M6 status (2026-10-19): learner side done; staff side blocked by D7

### Choosing the next milestone

| Candidate | Depends on | Decision status | Taken |
|---|---|---|---|
| **M6, learner side**: `POST …/reports`, `DiagnosisRun.report` | M5 (implementation available) | No open decision: D7 covers only the staff tool | **Yes** |
| M6, staff side: CLI, uphold/reject, EDUCATOR regrade, audit | M6 learner side | **D7 open**, OD-16 staffing | No |
| M7: L1, L2, L4, L8 | M5 | Not blocked; behind `FEATURE_LEGACY_FACADE` | Next candidate |
| M7: L3 funnel checks `c1`–`c4` and `retry_original` | M5 | **D3 open** (funnel lesson) | No |
| M7: L6 tutor | M5 | **D6 open** (tutor ladder) | No |
| M8 | M7 | **OD-11 open** (copy); D3 for `StepMateri` | No |
| M9 | everything | **D8 open** (push, remote CI) | No |

### What was built (learner side)

- **Endpoint:** `POST /v1/diagnosis-runs/{id}/reports` with body `{reason, note?}`, implemented in
  `src/assessment/disputes.ts` (06 §9.3 rule 1).
  - It is idempotent (`Idempotency-Key`, learner lock), consent-gated (LEARNING_DATA), and owner only (another
    learner's run gives 404).
  - Only a `COMPLETED` run can be reported: a queued, running, failed or cancelled run has no diagnosis to dispute,
    so it gets `409 INVALID_STATE_TRANSITION`. **This is a design choice; 06 does not say.**
  - One report per run: `409 ALREADY_REPORTED` with the existing report's `{id, status}`. Every refusal writes
    nothing.
- **Response:** 201 `DiagnosisReport` (the note is never returned), with `Location: /v1/diagnosis-runs/{id}`. A
  report has no resource of its own; the run shows it (09 §1, §13).
- **Run view:** `DiagnosisRun.report: {id, status}` for the learner's own run.
- **Rule 5:** filing changes no evidence and no eligibility.
- **The note:** C3 text, stored. It never reaches the logs (redaction; tested with a canary), and it is erased with
  the learner (M3 erasure; covered by `learning-erasure`). Its retention purge is a Slice 4 job.
- The dispute route is no longer disabled; no operation remains in the disabled set.

### Verification (Node 24.19.0, PostgreSQL 17.5; evidence `evidence/slice2-m6-learner/`)

| Check | Result |
|---|---|
| Static checks, manifest lint (strict refuses the draft: 61), golden v2, round-trip, migrations | Pass |
| `disputes` suite (5) | 5/5: rule 1 with idempotency, Location and the run view; the guards (consent, ownership, schema, completed runs only, zero writes); rule 5 on a practice grading with mastery-eligible evidence; the note canary |
| `question-loop` suite | 21/21 |
| Full backend, run 1 | **154/154** (283.5 s) |
| Full backend, run 2 (consecutive) | **154/154** (206.7 s), model-based tests included |
| Frontend suite with golden v2; browser E2E | Pass; 2 passed |
| Runner exit code | 0, recorded directly, without a pipe (`runner-output.txt`, `summary.json`) |
| Mutation checks | **7/7 killed** (`mutation-checks.txt`) |

**Mutation check details:**
- The first round killed 6/7. Rule 5 survived because the test reported an unreadable practice answer, which has
  no evidence rows. The test now uses the correct answer and asserts that mastery-eligible evidence exists before
  comparing.
- "Ownership not checked" also listed a slow `setup` in the batch. Rerun alone, setup passed and the intended
  assertion caught it.

**This green pair does not close B-01 or B-02.** Their causes are still unknown, and their acceptance criteria
require the cause to be identified, not one passing pair. The M5 verification gate and the release gate stay
blocked (§14).

### Not done (blocked)

- **Staff resolution (D7):** listing OPEN reports, reject, uphold, the EDUCATOR regrade that supersedes evidence,
  `resolution_run_id`, and staff audit events.
- **Learner-visible outcome:** the learner already sees `report.status` on the run. Mastery and XP recomputation
  after an upheld report is Slice 3.

## 16. M7 status (2026-10-19): facade L1, L2, L4, L8 done; L3 funnel and L6 blocked

All four calls are behind `FEATURE_LEGACY_FACADE` (off by default) and follow the same rules as L3 (Slice 1 M7):
- STUDENT only;
- CONSENT_FIRST: a guest or a learner without consent gets `403 FEATURE_DISABLED`, with zero writes;
- the `Deprecation` header;
- derived idempotency keys without the state version (the Slice 1 M7 decision; 09 rule 5 deviation recorded there). **Superseded for L1 and L4 in M8 (§17):** their key now includes the loop version;
- lenient input and frozen output.

The tests use the reviewed fixture (synthetic review marks in test memory only). The draft stays `PROPOSED`.

### What was built (`src/learning/facade-loop.ts`, `src/catalog/intake-map.ts`)

| Call | Behaviour |
|---|---|
| **L1** `POST /v1/learning/diagnosis` | The loop for (`sessionId`, question alias) under legacy key `<sid>:loop:<item>`, created on first use (origin FUNNEL). A finished loop gives the key up at the next call. |
| | `know`/`blank` without text become self-reports; any text is working; nothing at all is 400. |
| | `hintOpened: true` records one client-reported `HINT_SHOWN` per session (conservative). |
| | Rule 6: in DIAGNOSIS_READY the facade implies `START_RETRY`; in a lesson, `FINISH_LESSON` or `SKIP_LESSON`; then a RETRY attempt. A loop that is waiting or failed returns its existing run; nothing new is submitted. |
| | Own questions (`own:…`, `questionText`, `coreIds`) are `403 FEATURE_DISABLED` (Slice 6). |
| **L2** `GET /v1/learning/diagnosis/{id}` | Owner only. Ids that are not stored runs (`demo-…`, `eval-…`) are 404. `Retry-After` is sent while pending or running. |
| **09 §6.3 mapping** (L1, L2) | The status mapping from the table, and `clarification`. |
| | `assessment`: `tone`; `title` from `headline`; `gap` from the first misconception's concept; `okName`; `next` from the first recommendation. |
| | `items` cover only concepts with a frozen MAP alias, in curriculum order. A completed run with no aliased concept is reported as `insufficient_evidence`. |
| **L4** `POST /v1/learning/solution` | `REVIEW_SOLUTION` on the context's loop, found without releasing its key, so `max_tries` reads a COMPLETED loop. It is refused before the retry phase (409); without a loop it is 404. |
| **L8** `POST /v1/learning/intake/map` | A verbatim port of `detectLocally`, then every id is checked against the current release's SUBJECT, TOPIC and MAP aliases (rule 8). It returns `demo: false`, stores nothing, and never logs the question text. |

**Design choices and compatibility notes:**
- **`next` for a correct run.** A correct run has no recommendation, so `next` names the concept it just showed, with an empty formula and `coreId`. The shipped client's map computes what follows, as `analysis.ts` does.
- **`okName`** is the first demonstrated concept in curriculum order. For the tower that is "Segitiga Siku-siku", where `analysis.ts` says "Definisi sin, cos, tan". This is a copy difference for content review.
- **`gap` for a supported wrong answer without a misconception** uses the first recommendation's concept.
- **The facade loop's origin is FUNNEL.** `FlowContext` carries no route, so `/challenge` cannot be told apart yet (M8).

### Verification (Node 24.19.0, PostgreSQL 17.5; evidence `evidence/slice2-m7-facade/`)

| Check | Result |
|---|---|
| `legacy-loop-facade` suite (10), with the oracle: the shipped `diagnosisRunWithBackend`, `solutionWithBackend`, `mapQuestionWithBackend` bundled from the Vue checkout; the oracle ran, not skipped | **10/10** |
| | Off by default; L6/L7 closed; guests, consent and own questions refused with zero writes; `Deprecation`. |
| | L1 misconception mapping and network-retry replay (one attempt). L1 correct, T01-3, self-reports, and an empty answer (400). |
| | Rule 6 and `hintOpened`. The §6.3 unit test with synthetic variations of a real run. |
| | L4 in RETRY, after `max_tries`, and refused before the retry phase. L2 polling a queued run with `Retry-After` until adopted; owner and device ids. |
| | L8 parity with `detectLocally` (2,000 random texts), through `isMap`; the frozen-alias filter (a release without `tri-p`). |
| L3 regression (`legacy-facade`) | 6/6 |
| Full backend, run 1 | **164/164**, 0 skipped (550.0 s) |
| Full backend, run 2 (consecutive) | **164/164**, 0 skipped (288.1 s), model-based tests included |
| Static checks, manifest lint (strict refuses the draft), golden v2, round-trip, migrations, architecture self-test, frontend suite with golden v2, browser E2E | Pass |
| Runner | 23/23 checks, exit code 0, recorded without a pipe (`runner-output.txt`, `summary.json`) |
| Mutation checks | **11/11 killed** (`mutation-checks.txt`) |

**Mutation check details:** the first round killed 9/11. Two mutations were equivalent for the current content:
- the gap from the first recommendation (every tower misconception's recommendation points at the same concept);
- storage order (UUIDv7 concept ids follow ordinal order).

The `legacyRun` unit test with synthetic variations now kills both.

**This green pair does not close B-01, B-02 or B-03 (§14).** Their causes are unknown or not yet fixed, and their acceptance
criteria ask for more than one passing pair. The M5 verification gate and the release gate stay blocked.

### Still blocked

| Part | Waits for |
|---|---|
| L3 `check` `c1`–`c4` inside the loop's lesson, and `retry_original` | **D3** (the funnel lesson). L3 still refuses `retry_original` with `403 FEATURE_DISABLED`. |
| L6 tutor | **D6** (the tutor ladder) |
| L7 image reading | Slice 6 (stays `403`) |
| M8 frontend on canonical sessions | M7 complete (D3, D6) and **OD-11** |

### Decisions that would unblock the next work

| Decision | Unblocks |
|---|---|
| **D3:** author the funnel lesson (two slides, `c4` required on slide 1) and retire `c1`–`c3` | L3 funnel checks and `retry_original`; `StepMateri` in M8; possibly `lessonFor tri-d` |
| **D6:** the tutor ladder as private rubric content | L6 |
| **D7:** the staff dispute CLI | M6 staff side (uphold/reject, EDUCATOR regrade) |
| **OD-11:** "Saya tahu caranya" copy | M8 copy |
| **Content review:** the 12 tower deltas, the three overlays, and the new loop and facade copy (including the `okName` difference) | Publishing the real tower rubric |
| **D8:** push and remote CI | The Slice 2 exit |
| **Engineering backlog:** B-01 to B-03 (§14) | The M5 verification gate and the release gate; needs no product decision |

## 17. M8 status (2026-10-19): `/coba` and `/challenge` on the canonical QUESTION_LOOP, unblocked parts

### Before implementation

- **M7:** L1, L2, L4 and L8 are verified (§16). **M7 as a whole is partial.**
- **L3 funnel checks `c1`–`c4`: BLOCKED by D3.** They answer `409 CONTENT_UNAVAILABLE`: the funnel lesson is not authored.
- **`retry_original` through L3: BLOCKED by D3.** It answers `403 FEATURE_DISABLED`. The canonical client below does not use it; it
  submits the retry as a RETRY attempt on the loop (E-16).
- **Idempotency check (09 §6.1 rule 5) found a gap and fixed it.** The L1/L4 derived key had no state version, so the same text sent
  again after the loop moved on (for example a second wrong retry with the same words) replayed the old outcome instead of acting.
  - **Fix** (`src/app.ts` `legacyCommand`, `src/platform/idempotency.ts` `remember`): the key is
    `hash(learner, operation, payload, loop version before the command)`; the outcome is also stored under the version the command
    produced, so a network retry that arrives after the commit still replays.
  - **Limit:** an identical payload sent right after, with nothing in between, is treated as a retry. This is the intended reading of a
    retry without a client key.
  - **Regression test:** "09 §6.1 rule 5: a network retry replays, but the same text after the state moved on is a new command"
    (`test/legacy-loop-facade.test.ts`). It failed before the fix and passes after (11/11). L3 (PRACTICE) is unchanged.
  - The canonical client sends its own `Idempotency-Key` (one per action, reused on a network retry), so it does not depend on derived keys.

### What was built (Vue checkout, behind `VITE_SLICE0` + `VITE_CANONICAL_LEARNING`)

| Part | Behaviour |
|---|---|
| `src/services/canonicalLoop.ts` | QUESTION_LOOP client on `/v1`. One loop pointer per channel in localStorage (`intibelajar.loop.coba`, `.challenge`); `/challenge` creates origin `CHALLENGE`, `/coba` origin `FUNNEL`. |
| | Every write sends CSRF and one `Idempotency-Key` per action, reused when the network drops. `STALE_STATE_VERSION` / `INVALID_STATE_TRANSITION` re-read the loop instead of retrying. |
| | Polling follows `Retry-After` (first wait 1 s, bounded 0.25–10 s, at most 8 polls, then "pending", never a result). |
| | The solution opens only when the server lists `REVIEW_SOLUTION` in `allowedActions`; otherwise `SOLUTION_LOCKED` without a request. |
| | Checkpoint (E-26): `PUT …/checkpoint {route, sessionId, step}` for the result and retry steps. |
| `src/composables/useCobaFlow.ts` | A consented learner's answer goes to the server loop; guests and demo mode keep the device flow unchanged. |
| | A failed run or request is shown as "Layanan belum bisa memeriksa…", **never** as a device/demo result. E-10: a failed evaluation is re-requested on the same attempt. |
| | A loop already past the question (refresh or another tab) shows the server's run; the new text is not submitted. |
| | Retry (E-15, E-16…E-20) counts tries from the server; two unsuccessful retries show the server's worked solution. |
| | On mount (`CobaView`) the channel's loop resumes: answer text, run, and the retry step from the checkpoint. |
| PRACTICE (Slice 1) | Unchanged; its E2E spec runs alongside as regression. |

**A typecheck gap found on the way (Vue checkout, pre-existing):** `npm run build` runs `vue-tsc` against `tsconfig.json`, which has
`"files": []`, so it typechecks nothing; and `tsconfig.app.json` has no `@/*` path, so checking it directly fails every `@/` import.
This hid a real bug in M8 (an imported `openLoop` shadowed by the composable's own `openLoop` computed), found by the E2E and fixed by
renaming the import. Verification now runs `vue-tsc` with the alias mapped (`tsconfig.m8check.json` in the evidence) and requires
**0 errors in the files M8 changed**; the checkout's other errors (40, mostly missing Node types in test scripts and older components)
are recorded, not judged. Fixing the checkout's typecheck setup is a separate frontend task.

### Playwright (`tests/e2e/canonical-loop.spec.ts`, synthetic seed of 10 consented learners, one per test)

| Test | Proves |
|---|---|
| diagnosis + refresh | the server's diagnosis; after reload the same loop, version 2, same attempt, answer text restored |
| two tabs | the second tab's answer is not submitted; notice + the first tab's result; one loop |
| retry, solution gate | `GET …/solution` is 403 `SOLUTION_LOCKED` before the retry phase; two wrong retries → COMPLETED / SOLUTION_REVIEWED, solution 200 |
| correct retry | COMPLETED / SOLVED_AFTER_LEARNING |
| `/challenge` | origin CHALLENGE, its own pointer, SOLVED_FIRST_TRY |
| backend failure | 503 on attempts → failure shown, no `.r-filled`, nothing submitted (QUESTION v1); retry once back; 500 on the run after reload → failure, no result |
| guest | no `/v1/learning-sessions` request, no pointer |

The retry tests reach the retry step through the server checkpoint and a reload, not by walking result → lesson → retry: the funnel
lesson needs **D3**. The two-tab test brings each tab to the front before using it: Chromium throttles timers in hidden tabs and the
check's step animation waits on them. A real person uses the tab in front, so this is an environment fact, not a weakened assertion.

### Verification (Node 24.19.0, PostgreSQL 17.5, exclusive and sequential; evidence `evidence/slice2-m8-canonical-funnel/`)

| Check | Result |
|---|---|
| Runner (`verify-m8.mjs`): 25 checks, each exit code in `summary.json`, runtime versions recorded | **25/25, runner exit 0**, recorded without a pipe |
| Full backend, run 1 / run 2 (consecutive, model-based tests included) | **165/165, 0 skipped** (235.6 s) / **165/165, 0 skipped** (158.8 s) |
| M5, M6, M7+M8 facade (with the regression), L3 suites | Pass |
| Static checks, lint (strict refuses the draft), golden v2, round-trip, migrations, architecture self-test | Pass |
| Vue suite (`npm test`, includes 10 canonical-loop client checks), consumer, golden v2 (`verify:frontend`) | Pass |
| Vue typecheck of the M8 files (alias mapped) | 0 errors |
| Browser E2E: canonical-practice (2) + canonical-loop (7) | **9/9** in the runner, and 9/9 in three separate repeats (`e2e-repeat-1..3.txt`) |
| Mutation checks (`mutate-m8.mjs`): facade key version and remember; client key reuse, stale handling, solution gate, Retry-After, checkpoint route; demo-on-failure, two-tab notice, checkpoint resume, guest isolation | **11/11 killed**; sources restored (checksums OK) and the Vue checkout rebuilt with default flags |

The first E2E runs failed honestly before the fixes above (the shadowed import; a test that refilled a collapsed field instead of using
"Coba periksa lagi"; the hidden-tab timer). Those logs were local (`.local/`) and overwritten by later runs; they are not in the evidence.

### B-03 closed by a negative control

`evidence/slice2-m8-b03-negative-control-2/` (the scripts are copied there). A real `node:test` file that fails on purpose runs through
the same `run()` as every check:
- **A.** Direct call: runner exit **1**; `summary.json`: runnerExit 1, the failing check exit 1 / ok false, the passing check exit 0 / ok true.
- **B.** With `set -o pipefail`, `runner | tail`: pipeline exit **1**, `PIPESTATUS[0]` 1.
- **C.** Without pipefail (the original hazard): pipeline exit 0 while `PIPESTATUS[0]` is 1, reproducing B-03.

All four acceptance criteria hold: the runner records Node's own exit code, exits non-zero on any failure, the deliberate failure proves
it, and the summary states each exit code. The first attempt (`slice2-m8-b03-negative-control/`, kept with a README) failed because the
**proof script** read `PIPESTATUS` after `b=$?` had reset it. The runner was correct there too.

### B-01 and B-02 stay OPEN

This green pair is one more data point, not a proof. Neither cause has been identified, and their acceptance criteria (500 logging
with SQLSTATE, identified causes, a load repeat) are not met. The M5 verification gate and the release gate stay blocked.

### Blocked and deferred

| Part | Status |
|---|---|
| In-flow result → lesson (`StepMateri`) → quick check → retry on the server | **Blocked: D3** (funnel lesson). The UI path still opens the device lesson; the canonical retry is reachable after the checkpoint resume. |
| L3 funnel checks `c1`–`c4`, `retry_original` | **Blocked: D3** |
| Tutor (L6) in the funnel | **Blocked: D6**; M8 does not change the funnel tutor |
| "Saya tahu caranya" (`SELF_REPORT KNOW`) on the canonical path | **Blocked: OD-11** (copy). The current UI does not send it; the client supports the response type. |
| New dev copy: the two-tab notice, `SOLUTION_LOCKED` message, failure and pending messages | **Not approved**; needs content review |
| Disputes UI ("Hasil keliru? Laporkan") on the canonical run | Deferred: not part of this M8 change |
| The Vue checkout's typecheck setup | Deferred to a frontend task (above) |
| M9 (remote CI) | **Blocked: D8** |

## 18. Connected local development harness (2026-10-20)

The user requested that development continue here until FE and BE can be tested together locally,
with deployment deferred. This authorizes the local harness, not content/privacy approvals or a push.

- `scripts/dev-local.ps1` / `npm run local:dev`: starts Vue from `../mockup/intibelajar` on
  `http://localhost:5180`, the API on loopback 8000, and the worker. The unrelated Vite on 5173 is left alone.
- `http://localhost:5180/__local` selects explicitly synthetic fixture accounts through a same-origin,
  CSRF-protected development form. This middleware is not part of `/v1`, Vue source routes, or production builds.
- `intibelajar_local_dev` is a separate marked database. Only up migrations are used. Catalog fixture review
  marks are synthetic and do not alter the draft or approve D3/D6; existing local consent revocations are retained.
- Local browser checks: **9/9** against real FE/API/PostgreSQL, including persisted diagnosis/practice,
  refresh, second-tab resume, CSRF/ownership/consent refusals, failure/recovery, and guest isolation.
- Existing `verify:frontend`: passed, including **29 consumer checks**, golden v2, and event isolation.
- Backend TypeScript and module boundaries passed. No application API/response-shape changes were made.
- The setup encountered one database connection timeout before startup; its cause remains unknown.
  Backend timeouts were not changed. **B-01/B-02 and the M5/release gates remain open.**
- In-flow lesson and tutor remain blocked on D3/D6; remote CI/deployment are not part of this work.

Walkthrough and limitations: [07-local-development.md](07-local-development.md).
Evidence: `evidence/local-connection-2026-10-20/`. Initial browser failures are preserved there.


## Local continuation — 2026-10-20

D3/D6 implemented and verified for synthetic local development only, per user authorization. Authored content remains PROPOSED. See [local full-flow report](09-local-full-flow.md). B-01/B-02 remain open backlog. DeepSeek adapter/budget implemented, but live smoke failed with provider HTTP 402 (insufficient balance); live calls disabled pending top-up. Tutor is server-scripted; AI tutor prompt prepared, external chatbot disabled. No production/legal/privacy approval inferred.


## Swagger + Google development continuation — 2026-10-20

Swagger UI available at /docs using the authoritative contract. Google OIDC adapter and frontend entry prepared, disabled pending credentials/adult test account configuration. No live Google verification claimed. See [setup, compatibility review and connection inventory](10-swagger-google-and-connection-status.md). 22 targeted Google/Swagger checks and frontend 29 consumer checks passed. Progress/mastery projections, report UI, device import, AI tutor/intake and provider gates remain tracked there; B-01/B-02 remain backlog. No production approval inferred.


## Progress/tutor/OCR connection continuation — 2026-10-20

User authorized connecting remaining local FE/BE paths, DeepSeek chatbot and free OCR using the supplied OpenRouter reference. Migrations 0006–0008 applied to isolated test/local-dev databases; rollback/recovery tested in a separate disposable database. See [implementation, provider setup and remaining gates](11-connected-fe-be-progress-tutor-ocr.md). Progress/mastery/stats, report UI, explicit device import, canonical tutor and intake transports are implemented. Live Google/email/OpenRouter credentials and DeepSeek balance remain external blockers; no live model success claimed. General private-question grading and unrestricted generative tutor remain disabled. 13 targeted checks, 25 loop/report regressions (model stress excluded), frontend 29 consumer checks and browser checks passed. B-01/B-02 remain open. No production deployment, push or legal/privacy approval.
