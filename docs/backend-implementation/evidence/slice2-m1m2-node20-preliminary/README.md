# Slice 2 M1/M2: preliminary run on Node 20.19.4 (not the verification evidence)

Recorded 2026-10-19. The required M1/M2 verification is on **Node 24**, which is not installed on this
machine (nvm has v16.17.1 and v20.19.4). These files are kept as a record of what a Node 20 run showed.
They are **not** the M1/M2 verification evidence.

- `summary.json` says 17/19, but its `backend-tests-run-1/2` entries come from the first attempt. That attempt
  failed because Node 20's `--test` does not expand `test/*.test.ts`.
- The `backend-tests-run-1.txt` and `backend-tests-run-2.txt` files are a second attempt with the glob expanded
  by bash. Each run: 127 tests, 125 pass, **2 fail**. Both failures are `catalog-publisher` "version and
  identity rules publish nothing": the test removed `MEMAKAI_COS` from the misconception maps but not from
  the new `recommend` list, so lint refused the publish before the publisher's own rule could. The test was
  corrected afterwards; on Node 20 the publisher file alone then passes 11/11. **The full suite was not rerun on
  Node 20 after that fix**; it was run on Node 24 instead (below).
- The other files (static checks, round-trip, frontend suite with golden v2, browser E2E 2/2) passed on
  Node 20 before the test fix. None of them is Node 24 evidence.

The Node 24.19.0 verification was run afterwards; its evidence is in `../slice2-m1m2/`.
