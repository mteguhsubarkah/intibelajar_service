# 09 · API design

The contract itself is [openapi.yaml](openapi.yaml) (OpenAPI 3.1, hand-maintained). This document explains its rules, lists every operation (§7), and maps the shipped frontend's calls onto it (§6).

## 1. Versioning

- **`/v1` is the only version.** No API has ever been served ([01](01-current-state-audit.md)). The canonical resources therefore live under `/v1`, next to the nine paths the frontend already calls. The earlier draft's `/v2` would have versioned a contract that never existed.
- The seven `/v1/learning/*` adapter paths become a **deprecated facade** (§6). `POST /v1/auth/start` and `GET /v1/me/progress` keep their legacy shapes and remain canonical.
- **Compatible changes** within `/v1`: new endpoints, new optional request fields, new response fields. Clients must ignore unknown response fields.
- **Enums:** response enums documented as extensible (`x-extensible-enum: true`) may gain values, and clients must treat unknown values as "other". All other enums, and **every legacy facade shape**, are frozen, because the shipped adapters validate them strictly.
- **Breaking changes** need `/v2` for the affected resources, with both versions served during a migration window.
- Deprecated operations send `Deprecation` and `Sunset` response headers, and are marked `deprecated: true` in the contract.

## 2. Conventions

| Topic | Rule |
|---|---|
| Format | JSON (`application/json`), UTF-8, `camelCase` fields. Uploads are raw image bodies (`image/jpeg`, `image/png`, `image/webp`). |
| IDs | Server UUIDv7 strings. Catalog aliases (`legacyMapId`, `routeSlug`, `legacyItemId`) appear as separate fields, never as IDs ([03 §3](03-domain-model.md#3-identifiers)). |
| Time | RFC 3339 timestamps in UTC, from the server clock (INV-22) |
| Reads | `GET` on resources. Learner data: `Cache-Control: no-store`. Catalog: `ETag` = release version, `Cache-Control: public, max-age=300`, `304` on `If-None-Match`. |
| Commands | `POST` to a command sub-resource (`/attempts`, `/actions`, `/hints`, `/solution`). `PUT` only for the idempotent checkpoint. `DELETE` for the account and intake discards. |
| Status codes | `200` read or command result · `201` created (with `Location`) · `202` accepted for asynchronous work (tutor reply, deletion, image reading) · `204` no body · errors per §3 |
| Polling | Non-terminal resources (diagnosis runs, tutor messages, intakes) return `Retry-After` in seconds. Clients wait at least that long. |
| Authentication | Session cookie `__Host-ib_session`. Mutations also send `X-CSRF-Token` ([08 §4](08-auth-security-privacy.md#4-session-cookies-csrf-and-cors)). |
| Strictness | Request bodies use `additionalProperties: false`. Clients may not send server-owned fields such as `kind`, `verdict`, `state` or `assistance`. |

## 3. Errors

Every error uses one envelope:

```json
{
  "code": "STALE_STATE_VERSION",
  "message": "Sesi ini sudah berubah di tab lain. Muat ulang untuk melanjutkan.",
  "requestId": "0192f6d1-6c1e-7b9a-9f1e-3c1d2b4a5e6f",
  "retryable": false,
  "details": { "currentStateVersion": 5 }
}
```

`message` is safe to show (Indonesian) and never echoes input. `details` is code-specific and machine-readable.

| Code | HTTP | Retryable | Meaning | Client action |
|---|---|---|---|---|
| `VALIDATION_FAILED` | 400 | No | Body, query or header invalid. `details.fields[]` lists paths. | Fix the request |
| `INVALID_CURSOR` | 400 | No | Cursor tampered, expired or from another query | Restart the listing |
| `UNAUTHENTICATED` | 401 | No | No valid session | Sign in. The legacy progress call treats 401 as "guest". |
| `CSRF_FAILED` | 403 | No | Missing or wrong `X-CSRF-Token`, or a bad `Origin` | Refresh `GET /v1/auth/session`, then retry once |
| `CONSENT_REQUIRED` | 403 | No | Learner pending consent, or purpose not granted. `details.missingPurposes[]`. | Show the consent screen |
| `ACCOUNT_UNAVAILABLE` | 403 | No | Learner `SUSPENDED` or `DELETION_PENDING` | Show account status |
| `FEATURE_DISABLED` | 403 | No | Flag off (AI, intake, facade, guest evaluation) | Use the non-AI path |
| `SOLUTION_LOCKED` | 403 | No | The solution has not been revealed in this session | Follow `allowedActions` |
| `FORBIDDEN` | 403 | No | Role not allowed | — |
| `NOT_FOUND` | 404 | No | Missing, or owned by someone else (deliberately indistinguishable) | — |
| `INVALID_STATE_TRANSITION` | 409 | No | Command not legal in the current state. `details.state`, `details.allowedActions`. | Reload the session |
| `STALE_STATE_VERSION` | 409 | No | `expectedStateVersion` is behind. `details.currentStateVersion`. | Reload; let the learner decide |
| `IDEMPOTENCY_KEY_REUSED` | 409 | No | Same key, different payload | Use a new key for a new intent |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Yes | The first request with this key is still running | Retry after `Retry-After` with the **same** key |
| `CONTENT_UNAVAILABLE` | 409 | No | No published lesson or item for the requested concept | Offer another concept |
| `ALREADY_IMPORTED` | 409 | No | Device session already imported. `details.sessionId`. | Open that session |
| `ALREADY_REPORTED` | 409 | No | The run already has a report | Show its status |
| `SESSION_EXPIRED` | 410 | No | Session `EXPIRED` | Start a new session |
| `LINK_EXPIRED` | 410 | No | Consent or sign-in link expired or used | Request a new link |
| `PAYLOAD_TOO_LARGE` | 413 | No | Body or image over the limit | Shrink |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | No | Not JSON, or not an allowed image type | — |
| `RATE_LIMITED` | 429 | Yes | Too many requests. `Retry-After` set. | Wait |
| `AI_BUDGET_EXCEEDED` | 429 | Yes | AI budget exhausted for the learner or globally | Use the non-AI path; retry later |
| `INTERNAL` | 500 | Yes | Unexpected error | Retry with the same `Idempotency-Key` |
| `DEPENDENCY_UNAVAILABLE` | 503 | Yes | Database or AI provider unavailable, or circuit open | Retry after `Retry-After` |

## 4. Idempotency and concurrency

- **`Idempotency-Key` header** on every authenticated `POST` command (except `POST /v1/auth/logout`, which is naturally idempotent) and on the guardian decision. Format: 8–128 characters from `[A-Za-z0-9_-]` (a UUID is recommended). Missing → `400 VALIDATION_FAILED`.
- Scope: principal + operation (method, route template, resource ID). Records live 7 days ([04 §7](04-postgresql-erd.md#7-concurrency-and-idempotency)).
- A replay returns the **stored status code and body** with `Idempotency-Replayed: true`.
- The key on `POST …/attempts` doubles as the blueprint's `clientAttemptId`.
- **`expectedStateVersion`** is required in the body of session commands ([05 §4.1](05-learning-state-machine.md#41-commands-and-their-endpoints)). Every session representation carries `stateVersion` and `allowedActions`.

## 5. Pagination and filtering

- Cursor pagination: `?limit=` (1–100, default 20) and `?cursor=`. Responses are `{ "items": [...], "nextCursor": "…" | null }`.
- Cursors are opaque, HMAC-signed keyset positions (for example `last_activity_at, id`). They are bound to the query's filters, and expire after 24 hours (`400 INVALID_CURSOR`).
- Filters are explicit query parameters (`status`, `topicId`, `conceptId`, `itemType`). There is no generic filter language.

## 6. Compatibility with the current frontend

### 6.1 Rules for the facade

1. The facade is a **translator with no state of its own**. Each legacy call becomes one or more canonical commands, run in one transaction where possible.
2. It is controlled by the flag `legacyFacade.enabled`, sends `Deprecation` headers, and is removed once the frontend uses the canonical API ([12](12-implementation-roadmap.md)).
3. **CSRF:** exact `Origin` match, `Sec-Fetch-Site`, JSON content type and `SameSite=Lax` cookies ([08 §4](08-auth-security-privacy.md#4-session-cookies-csrf-and-cors)).
4. **Who is calling decides the path:**
   - **Learner, `ACTIVE`, with consent:** canonical commands. The client's `FlowContext.sessionId` is stored as `learning_session.legacy_client_session_id`, so one client session maps to one server session.
   - **Guest, or learner without consent:** in `OPEN_TRIAL` mode, stateless deterministic evaluation of public practice items, with nothing stored. In `CONSENT_FIRST` mode, `403 FEATURE_DISABLED` ([08 §2.2](08-auth-security-privacy.md#22-guest-evaluation-mode-guestevaluationmode)).
5. **Idempotency:** legacy calls carry no key. The facade derives one: `legacy:` + SHA-256 of (learner, client session ID, current `stateVersion`, canonicalised payload). A network retry in the same state replays. The same text sent again after the state moved on is a new command. The client-generated `attemptId` of L3 is ignored, because it changes on every call ([01 §4](01-current-state-audit.md#4-existing-wire-contract-consumer-side)).
6. **Implied commands:** the shipped frontend never says "lesson started" or "retry started". The facade issues them explicitly. A `check` call implies `START_LESSON` and `ADVANCE_LESSON` to the check's slide. A `retry_original` call implies `FINISH_LESSON`, `SKIP_LESSON` or `START_RETRY`, as the state requires ([05 §4.5](05-learning-state-machine.md#45-notable-illegal-transitions)). An L1 call for a session already past `QUESTION` (today's "Coba soal tadi lagi" button) implies `START_RETRY` and submits a `RETRY` attempt; its verification run is returned in the legacy diagnosis shape.
7. **Lenient input, frozen output:** facade request schemas accept and ignore unknown fields, because the server does not version the shipped client. Facade response shapes are frozen.
8. **Aliases:** responses contain only aliases from the **frozen legacy alias set**. That set is the aliases present in the shipped frontend's `data/curriculum.ts` when the facade launches, recorded in the alias manifest. Concepts without an alias are left out, because one unknown core ID makes the frontend discard the whole progress snapshot ([01 §4](01-current-state-audit.md#4-existing-wire-contract-consumer-side)).

### 6.2 Call-by-call mapping

| # | Legacy call | Canonical behaviour for a learner with consent | Legacy response produced |
|---|---|---|---|
| L1 | `POST /v1/learning/diagnosis` with `FlowContext`, `responseMode`, `rawText` (and `questionText` + `coreIds` for own questions) | Find or create the `QUESTION_LOOP` session for (`sessionId`, question alias). Own questions: create a confirmed `TYPED` intake and a private question from `questionText`, with `coreIds` validated against the alias set. `hintOpened: true` records a client-reported `HINT_SHOWN` (conservative). `responseMode` `know`/`blank` → `SELF_REPORT` `KNOW`/`DONT_KNOW`; text → `TEXT`. Then `SUBMIT_ATTEMPT`. | `DiagnosisRun` (§6.3) |
| L2 | `GET /v1/learning/diagnosis/{diagnosisRunId}` | `GET /v1/diagnosis-runs/{id}` with the owner check | `DiagnosisRun` + `Retry-After` while pending |
| L3 | `POST /v1/learning/answers/check` with `kind` `check`/`practice`/`retry_original`, `itemId`, `answer` | `check` → implied lesson commands, then `ANSWER_QUICK_CHECK`. `practice` → `SUBMIT_ATTEMPT` in a `PRACTICE` session keyed by `<sessionId>:practice`, created on first use with the item list of that set. `retry_original` → implied commands, then `SUBMIT_ATTEMPT` (`RETRY`). Option answers arrive as an index and are mapped to option IDs through the manifest. | `{correct, feedback?, correctOptionIndex?, unreadable?}`: `CORRECT` → `true`, `INCORRECT` → `false`, `UNREADABLE` → `null` + `unreadable: true` |
| L4 | `POST /v1/learning/solution` with `reason` | `REVIEW_SOLUTION` (allowed in `RETRY`, `EVALUATION_FAILED`, `COMPLETED`). `max_tries`, `review_steps` and `compare` arrive when the session is already `COMPLETED`. | `{steps[{title, body}], after[]}` from the authored worked solution |
| L5 | `POST /v1/auth/start` | Canonical ([08 §3.1](08-auth-security-privacy.md#31-students-and-guardians)). `continuation.targetPath` must be an allow-listed route, otherwise `400`. `FlowContext` fields only inform the continuation. | `{redirectUrl}` |
| L6 | `POST /v1/learning/tutor` with history and `hintsUsed` | **Authored hint ladder, no AI**, server-side: the last learner message picks the branch, the server counts hints, and client history and `hintsUsed` are ignored. Records `HINT_SHOWN`, and `FULL_SOLUTION_SHOWN` after two hints. AI tutoring is available only through the asynchronous canonical API, because real model latency cannot meet the adapter's 1.8 s timeout. | `{text, quick[], hintsUsed, rewrite?}` |
| L7 | `POST /v1/learning/intake/read` with `imageDataUrl` | **Not served:** `403 FEATURE_DISABLED`. Real image reading needs consent, quarantine and asynchronous AI, which the synchronous 1.8 s contract cannot carry. | Error. Demo builds keep their labelled sample; assessment builds show the error. |
| L8 | `POST /v1/learning/intake/map` with `questionText` | Deterministic keyword mapper, a server port of `detectLocally` that never guesses outside mapped topics. AI mapping only through the canonical intake API. | `{subject, topicId, cores[], demo: false}` |
| L9 | `GET /v1/me/progress` | Canonical, legacy shape (§6.4). `401` for guests. | `LearnerSnapshot` |

### 6.3 L1/L2 run mapping

| Legacy field | Source |
|---|---|
| `diagnosisRunId` | `diagnosis_run.id` |
| `status` | `QUEUED` → `pending` · `RUNNING` → `running` · `COMPLETED` + `SUPPORTED` → `completed` · `COMPLETED` + `INSUFFICIENT_EVIDENCE` → `insufficient_evidence` · `FAILED`/`CANCELLED` → `failed` |
| `clarification` | `clarification_prompt` |
| `assessment.tone` | verdict `CORRECT` → `kuat`, otherwise `gap` |
| `assessment.title` | `headline` |
| `assessment.gap` | `null` when `kuat`. Otherwise the first misconception's concept: `{label: "Core belum kuat", name: concept title, reason: rationale, coreId: lesson route slug, mapId: legacy map ID}`. A self-report `KNOW` uses label `"Perlu dipastikan"`. |
| `assessment.okName` | When `kuat`: title of the first demonstrated concept. Otherwise `null`. |
| `assessment.next` | First recommendation: `{core: title, reason, formula: keyFormula or "", coreId: route slug, mapId: legacy map ID}` |
| `items[]` | One per mapped concept with a frozen alias: understanding → `ok`, misconception → `gap`, anything else → `rest`, with the rationale or neutral text as `reason` |

The shipped validator requires `assessment` and a non-empty `items` when `status` is `completed`. A run with no aliased concept is therefore reported as `insufficient_evidence` with a clarification, never as an empty `completed`. In `OPEN_TRIAL`, a guest's stateless evaluation returns a `completed` run with ID prefix `eval-`. It is never stored, so a later `GET` returns `404`, but deterministic evaluation finishes inline, so the client never needs to poll it.

### 6.4 L9 progress mapping

| Legacy field | Source |
|---|---|
| `user` | `{id: learner ID, displayName: nickname or ""}`. `401` for guests. |
| `cores[]` | Concepts with `ui_tier ≥ 0` and a frozen alias |
| `cores[].exploration` | `VISITED` when `ui_tier ≥ 0` |
| `cores[].mastery` | Derived from the tier ([06 §6.5](06-diagnosis-evidence-mastery.md#65-ui-tiers-single-server-rule-for-both-apis)): 3 → `DEMONSTRATED`, 1–2 → `DEVELOPING`, 0 → `NOT_ASSESSED` |
| `cores[].lessonComplete` | `lesson_complete` |
| `cores[].transferCorrect` | `transfer_correct_total` |
| `cores[].lastPracticedAt` | `last_practiced_at` |
| `activities[]` | Latest 20 progress events, as `{id, title, at}` with Indonesian titles from templates |
| `xp`, `streakDays` | `learner_stats.xp_total`, `current_streak_days` |

With this mapping the shipped `tierOf` computes exactly the server's tier. The one lossy case is a concept with only misconception evidence: canonically `DEVELOPING`, tier 0, reported as `NOT_ASSESSED`, so the profile chip says "Belum dinilai".

### 6.5 Known compatibility gaps (explicit, not silent)

| Gap | Effect on the shipped frontend | Resolution (slice, [12](12-implementation-roadmap.md)) |
|---|---|---|
| L7 image reading not served | Photo reading fails in assessment builds | Asynchronous intake API (6) |
| L6 uses authored hints, not AI | Same experience as today's scripted tutor, but server-side | AI tutor through the canonical API (5) |
| "Saya tahu caranya" no longer counts as correct | A clarification appears instead of the comparison and XP | Copy and flow change (2) |
| Misconception-only concepts show "Belum dinilai" | Minor label inaccuracy on the profile | Read `/v1/me/mastery` (3) |
| No `Idempotency-Key` or CSRF token in legacy calls | Derived keys and exact-Origin checks compensate | Frontend sends both (1–2) |
| `CONSENT_FIRST` refuses guest calls | Assessment builds show errors for guests | On-device evaluation for guests, or `OPEN_TRIAL` after legal sign-off (0) |
| Tier rule copy ("≥7 hari", "2 soal berbeda") | Text differs from the server rule | Copy change (3) |
| No AI disclosure in the tutor UI | Legal requirement unmet | Label and first message before any AI is enabled (5) |

## 7. Operation catalogue

Auth column: **public** = no session needed; **session** = any signed-in user; **learner** = student with the consent the row needs; **guardian** = guardian session; **token** = one-time link token; **facade** = the legacy rules in §6.1. Every operation below is in [openapi.yaml](openapi.yaml) with the same method and path; the validator checks this ([verification.json](verification.json)).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/v1/auth/session` | public | Current principal, learner status, missing consents, CSRF token |
| `POST` | `/v1/auth/start` | public | Start Google or email sign-in with a continuation (legacy-compatible) |
| `GET` | `/v1/auth/callback/{provider}` | public | OIDC callback, then redirect to the continuation |
| `POST` | `/v1/auth/email/links` | public | Send a one-time sign-in link |
| `POST` | `/v1/auth/email/verify` | public | Consume a sign-in link token |
| `POST` | `/v1/auth/logout` | session | Revoke this session, or all sessions |
| `GET` | `/v1/me/profile` | session | Read the learner profile |
| `PATCH` | `/v1/me/profile` | session | Onboarding and profile edits (grade, birth year → age band, nickname, subjects) |
| `GET` | `/v1/me/consents` | session | Consent status per purpose |
| `POST` | `/v1/me/consent-requests` | session | Ask a guardian for consent |
| `POST` | `/v1/me/consents/{purpose}/revocation` | learner | Revoke an optional purpose |
| `POST` | `/v1/me/device-imports` | learner | Import device history (never eligible) |
| `DELETE` | `/v1/me` | session | Delete the account |
| `GET` | `/v1/guardian-consents/{token}` | token | Show a consent request to the guardian |
| `POST` | `/v1/guardian-consents/{token}/decision` | token | Grant or decline purposes |
| `GET` | `/v1/guardian/learners` | guardian | Linked learners and consent status |
| `POST` | `/v1/guardian/learners/{learnerId}/consents/{purpose}/revocation` | guardian | Revoke a purpose |
| `POST` | `/v1/guardian/learners/{learnerId}/deletion-requests` | guardian | Request erasure |
| `GET` | `/v1/subjects` | public | Subjects with availability |
| `GET` | `/v1/topics` | public | Topics, filterable by subject |
| `GET` | `/v1/topics/{topicId}` | public | Topic with concepts, units and edges |
| `GET` | `/v1/concepts` | public | Concepts by topic or legacy alias |
| `GET` | `/v1/concepts/{conceptId}` | public | One concept (K03 fields, no rubrics) |
| `GET` | `/v1/questions` | public | Question bank, without keys |
| `GET` | `/v1/questions/{questionId}` | public | One question (published revision) |
| `GET` | `/v1/lessons/{lessonId}` | public | Lesson blocks and check placement, without keys |
| `POST` | `/v1/learning-sessions` | learner | Start a question loop or practice session |
| `GET` | `/v1/learning-sessions` | learner | List sessions (`status=active` for resume) |
| `GET` | `/v1/learning-sessions/{sessionId}` | learner | Session state, `allowedActions`, lesson checkpoint |
| `POST` | `/v1/learning-sessions/{sessionId}/attempts` | learner | Submit an answer (`201`, inline or queued diagnosis) |
| `POST` | `/v1/learning-sessions/{sessionId}/quick-check-answers` | learner | Answer a lesson check |
| `POST` | `/v1/learning-sessions/{sessionId}/actions` | learner | Lesson, retry, skip and abandon commands |
| `POST` | `/v1/learning-sessions/{sessionId}/hints` | learner | Reveal a hint step (records exposure) |
| `POST` | `/v1/learning-sessions/{sessionId}/solution` | learner | Review the worked solution (records exposure) |
| `GET` | `/v1/learning-sessions/{sessionId}/solution` | learner | Re-read a revealed solution |
| `PUT` | `/v1/learning-sessions/{sessionId}/checkpoint` | learner | Store the UI checkpoint |
| `GET` | `/v1/attempts/{attemptId}` | learner | One attempt |
| `POST` | `/v1/attempts/{attemptId}/diagnosis` | learner | Get or re-run the attempt's shared diagnosis (A01) |
| `GET` | `/v1/diagnosis-runs/{diagnosisRunId}` | learner | Poll a diagnosis run |
| `POST` | `/v1/diagnosis-runs/{diagnosisRunId}/reports` | learner | "Hasil keliru? Laporkan" |
| `GET` | `/v1/me/progress` | session | Progress snapshot (legacy shape, canonical) |
| `GET` | `/v1/me/mastery` | learner | Mastery per concept |
| `GET` | `/v1/me/mastery/{conceptId}` | learner | Mastery detail with evidence summary |
| `GET` | `/v1/me/progress-events` | learner | Activity feed |
| `GET` | `/v1/me/stats` | learner | XP, level, streak, today's missions |
| `POST` | `/v1/tutor-conversations` | learner | Open a tutor conversation for a session and concept |
| `GET` | `/v1/tutor-conversations/{conversationId}` | learner | Conversation with messages |
| `POST` | `/v1/tutor-conversations/{conversationId}/messages` | learner | Send a message (`202`, reply pending) |
| `GET` | `/v1/tutor-messages/{messageId}` | learner | Poll a tutor reply |
| `POST` | `/v1/question-intakes` | learner | Start an intake (photo or typed) |
| `GET` | `/v1/question-intakes/{intakeId}` | learner | Intake status, draft text, suggestions |
| `DELETE` | `/v1/question-intakes/{intakeId}` | learner | Discard an intake |
| `PUT` | `/v1/question-intakes/{intakeId}/image` | learner | Upload the photo (`202`, reading queued) |
| `POST` | `/v1/question-intakes/{intakeId}/confirmation` | learner | Confirm text and concepts → private question |
| `POST` | `/v1/public/evaluations` | public | Stateless guest evaluation (`OPEN_TRIAL` only) |
| `POST` | `/v1/learning/diagnosis` | facade | L1 (deprecated) |
| `GET` | `/v1/learning/diagnosis/{diagnosisRunId}` | facade | L2 (deprecated) |
| `POST` | `/v1/learning/answers/check` | facade | L3 (deprecated) |
| `POST` | `/v1/learning/solution` | facade | L4 (deprecated) |
| `POST` | `/v1/learning/tutor` | facade | L6 (deprecated) |
| `POST` | `/v1/learning/intake/read` | facade | L7 (deprecated, not served) |
| `POST` | `/v1/learning/intake/map` | facade | L8 (deprecated) |

## 8. Main representations

Full schemas are in [openapi.yaml](openapi.yaml). The ones the UI depends on most:

- **`LearningSession`:** `id`, `kind`, `origin`, `state`, `stateVersion`, `outcome`, `resumeState`, `unsuccessfulRetries`, `anchorQuestion`, `activeAttemptId`, `activeDiagnosisRunId`, `lesson` (assignment, slide index, checks), `items` (practice), `allowedActions`, `checkpoint`, timestamps.
- **`AttemptResult`** (from `POST …/attempts`): `{attempt, diagnosisRun, session}`. The run is `COMPLETED` when evaluated inline, otherwise `QUEUED` with `Retry-After`.
- **`DiagnosisRun`:** status, verdict, evidence status, headline, lede, clarification prompt, `evidence[]` (concept, classification, misconception label, rationale, quoted references, source, eligibility), `recommendations[]`, `aiAssisted`, `revealedAnswer` (practice keys after grading), and `session` (`state`, `stateVersion`, `allowedActions`) once terminal.
- **`MasteryView`:** status, `uiTier`, transfer streak and total, contexts, `needsReview`, `lessonComplete`, `lastPracticedAt`, legacy alias.
- **`Stats`:** XP total, level (from the shared level table), streak, freezes, today's missions.
