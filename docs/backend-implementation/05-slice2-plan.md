# Slice 2 implementation plan: the question loop

Date: **2026-10-18**. Status: **D1, D2 and D4 approved (2026-10-19); D3, D5–D8 open. M3 and M4 in progress.**
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
