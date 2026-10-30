# Mastered-core question browsing and persistent history

Paired FE base: `master-pre-test-1`. The frontend and backend changes must be released together.

- `GET /v1/me/questions`: learner-owned all/ready/history projections, search, exact core counts (1/2/3/4+), topic/concept/status filters and ordering, all applied before cursor pagination. The default page size is ten.
- Every mapped required/supporting core must meet the existing product readiness threshold. Contradictory evidence excludes a core; stale mastery can be refreshed. This does not change mastery-v1, award XP, or manufacture evidence.
- Historical attempts remain immutable. Quick checks, self reports and device imports do not count as bank answers. Distinct questions and attempts are counted separately. Assistance is preserved, failed grading is never labelled incorrect, and later correct answers resolve the retry queue without deleting earlier failures.
- Public retired questions remain in owned history with `available: false`. Keys and hints never appear in the listing. The detail exposes only the learner's submitted response and already released feedback.
- Cursors are learner-, query-, release- and result-bound. A changed result set rejects an old cursor; the FE offers reload from the first page.
- `GET /v1/me/questions/{questionId}/history` is paginated and enforces ownership and LEARNING_DATA consent. Unowned questions return 404.
- Practice session items now include optional server verdicts, allowing the FE to resume across devices without trusting a local result cache. The existing grading API requires numeric input as the original TEXT response to preserve evidence spans.

## Validation

46 PostgreSQL tests passed across catalog reads, learning sessions, account progress, connected progress and new practice-browser cases. TypeScript, OpenAPI and module/rubric boundary checks passed. No migration is required.

For browser QA on a dedicated test database: publish the reviewed synthetic fixture with the existing `scripts/e2e-seed.ts`, run `node --import tsx scripts/e2e-practice-seed.ts`, then start the API. Give the paired FE test `E2E_PRACTICE_LEARNER_FILE=<absolute path to .local/e2e-practice-learner.json>`, with VITE_SLICE0 and VITE_CANONICAL_LEARNING enabled. Never publish that ignored cookie fixture.
