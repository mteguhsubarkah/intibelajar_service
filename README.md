# IntiBelajar — Slice 0 development foundation

Synthetic development/test only. Production startup is deliberately refused. No AI,
external email, Google OIDC, or production guardian verification is configured.
The authoritative design remains `docs/backend-architecture/`; findings and
implementation decisions are in `docs/backend-implementation/01-slice0-report.md`.

Requires Node 22+ (verified with bundled Node 24.19.0), PostgreSQL 16+
(verified with local PostgreSQL 17.5), and npm. Dependencies are pinned in
`package-lock.json`. There is no production deployment configuration.

## Run locally

1. Use a **dedicated synthetic** PostgreSQL database on loopback. Migrations run
   with a development owner role; split migration/API/worker roles before any
   real environment is approved.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL`, an exact `APP_ORIGIN`, and a
   random 32-byte hex `APP_KEY`. Do not put these secrets in frontend `VITE_*` values.
3. On Node 22+, run `node --env-file=.env --import tsx src/migrate.ts up`.
4. Start the API with `node --env-file=.env --import tsx src/main.ts`, and the worker
   in another terminal with `node --env-file=.env --import tsx src/worker.ts`.
   Both bind/use loopback only. Run the worker to enforce seven-day bootstrap
   erasure and consent expiry; API commands also check expiry synchronously.
5. In the existing Vue checkout, set `VITE_SLICE0=true` **only for synthetic account
   development**, retain `VITE_LEARNING_MODE=demo`, and use `http://localhost:5173`.
   Its Vite proxy sends `/v1` to port 8000. Guest learning stays on the device.
   The additional `/auth/email`, `/auth/callback`, `/account/consent`, and
   `/guardian-consents/:token` routes do not replace existing Vue routes.

`SYNTHETIC_FIXTURES=false` is the default. With it, identity and consent-provider
entry points return canonical `503 DEPENDENCY_UNAVAILABLE` errors containing
explicit integration blockers. With `true`, only `.invalid` email addresses are
accepted by the local simulator. Session cookies retain `Secure`, `HttpOnly`,
`SameSite=Lax`, and the `__Host-` prefix on localhost.

## Synthetic identity and guardian walkthrough

Use the new email/account UI, or `node --env-file=.env --import tsx scripts/fixtures.ts`
against a dedicated database ending `_dev` or `_test`. The fixture CLI writes its
pre-auth cookie to ignored `.local/fixture-browser.json`; it cannot authenticate a
real person. A browser-initiated email request is easier because the browser already
holds its pre-auth cookie.

The development server writes an encrypted local mailbox, never sends external mail,
and never exposes mailbox contents over HTTP. Read a requested synthetic link with:

```powershell
node --env-file=.env --import tsx scripts/read-mailbox.ts learner@example.invalid
```

Open the link in the **same browser that started sign-in** and confirm by button
(GET never consumes a sign-in token). Complete grade/birth-year onboarding; birth
year is transformed into an age band and discarded. Request the guardian's
`.invalid` address, read that address's mailbox with the same CLI, and make an
explicit choice for every requested purpose. Policy copy says **SIMULASI DEVELOPMENT**.
After a privilege change or revocation, learner sessions are revoked and a fresh
sign-in is required. No learning endpoint exists in Slice 0.

Mailbox delivery is a local simulator, not a durable email outbox. Request another
link after a process restart/delivery failure. The production transport and its
transactional outbox remain blocked pending provider configuration/review.

## Catalog (Slice 1, in progress)

The catalog comes from the reviewed alias manifest in `catalog/manifest/`. See
`docs/backend-implementation/03-slice1-plan.md`.

- `npm run catalog:lint` lists open review decisions; add `-- --strict` for the publisher's view.
- `npm run catalog:check` confirms every identifier in the Vue checkout still resolves.
- `node --env-file=.env --import tsx scripts/catalog/publish.ts` publishes to the configured
  synthetic database. It refuses any manifest that still has `PROPOSED` decisions, and there is no override.
- `python scripts/extract-migration-catalog.py` regenerates `migrations/0002_catalog.*` from 04 §3.

## Verification

`npm run typecheck`, `npm run validate:contract`, and `npm test` run the backend
checks. Tests require a dedicated database name ending `_test`; they deliberately
execute destructive **test database only** rollback/reapply and failure recovery.
Set the variables from `.env.example` with `NODE_ENV=test`, `SYNTHETIC_FIXTURES=true`,
or use the ignored `.local/test-env.json` prepared by `scripts/prepare-test-db.mjs`
for the local PostgreSQL instance on port 55432.

The isolated test cluster is stopped after verification. On this Windows host,
restart that existing cluster before rerunning the PostgreSQL suite:

```powershell
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D .local/pg17 -l .local/pg17.log -o '-h 127.0.0.1 -p 55432' -w start
```

`npm run db:types` regenerates the committed Kysely types from the migrated schema.
`npm run verify:frontend` runs the existing Vue tests and 29 consumer checks; set
`FRONTEND_DIR` if its checkout is not `../mockup/intibelajar`.

For the unchanged architecture checker, install project-local `PyYAML==6.0.3`, set
`PYTHONPATH=.local/python`, then run:

```powershell
python scripts/verify-architecture.py --self-test --run-consumer-suite
```

This wrapper only points the original validator's frontend source root at the
separate Vue checkout. It never rewrites the authoritative `verification.json`.

CLI down migrations require `ALLOW_DESTRUCTIVE_DEV_ROLLBACK=true`. They are a test
tool; production recovery would use reviewed forward fixes and restore drills.
