# Local FE–BE connection verification, 20 October 2026

- `browser-summary.json`: nine checks against the running Vite/API/PostgreSQL development stack; exit 0. `diagnosis.png` shows a synthetic account's server diagnosis.
- `frontend-verification.txt`: raw `npm run verify:frontend` output; the process returned exit 0. Includes existing frontend suites, 29 consumer checks, golden v2, and event isolation.
- Backend `tsc --noEmit` returned exit 0; `scripts/check-boundaries.mjs` returned exit 0. No application source code changed in this task.
- Two initial browser failure summaries are retained: the original localhost:5173 resolved to an unrelated IPv6 Vite, then the local form's no-referrer policy produced Origin null. The launcher uses 5180 and same-origin referrer policy; Origin null is still refused. These failed runs are not counted as passes.
- One launcher restart hit a PostgreSQL connection timeout before starting the API/FE. A later startup worked. This does not identify or close B-01/B-02, and the application's 2-second connection timeout was not changed.
- Direct requests for the backend harness `env.json` and `personas.json` through Vite's filesystem URL returned 403. No keys or fixture cookies are included in this evidence.

This is development connection evidence, not the full M5/M8/M9 exit suite or production approval. Existing data/catalog approval gates remain in effect.
