# B-03 negative control, first attempt (2026-10-19): FAIL caused by the proof script, kept unchanged

The runner behaved as required: direct call exit 1, `summary.json` recorded the failing check (exit 1, ok false),
and with `set -o pipefail` the pipeline exited 1.

The proof script read `${PIPESTATUS[0]}` on the line after `b=$?`. That assignment is a command of its own and resets
`PIPESTATUS`, so it printed 0 in B and C. The script was fixed to capture `$?` and `PIPESTATUS` in one assignment
(`st=("$?" "${PIPESTATUS[@]}")`) and rerun into `../slice2-m8-b03-negative-control-2/`, which passed.
