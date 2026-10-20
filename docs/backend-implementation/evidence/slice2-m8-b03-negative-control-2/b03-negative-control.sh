#!/usr/bin/env bash
# B-03 negative control. Run from intibelajar_service with Node 24.19.0 first on PATH:
#   bash b03-negative-control.sh <new evidence dir>
# Proves, with a deliberately failing check run through the same runner as the real verification:
#   A. the runner records the failing check's own exit code in summary.json and exits 1 itself;
#   B. with `set -o pipefail`, a pipeline around the runner exits non-zero (PIPESTATUS[0] also recorded);
#   C. (the original hazard, for contrast) without pipefail the same pipeline reports 0.
# Exits 0 only when A and B hold and C reproduces the hazard.
set -u
out="$1"; here="$(cd "$(dirname "$0")" && pwd)"
[ -e "$out" ] && { echo "$out exists; refusing to overwrite evidence"; exit 2; }
mkdir -p "$out"
fail=0; log="$out/negative-control.txt"
{ echo "date: $(date -u +%FT%TZ)"; echo "node: $(node -v)"; echo "bash: $BASH_VERSION"; } > "$log"

# A. direct call, output to a file (no pipe); $? is the runner's own exit code
node "$here/verify-m8.mjs" "$out/A-direct" --negative-control > "$out/A-direct-output.txt" 2>&1
a=$?
echo "A direct: runner exit $a (expected 1)" >> "$log"
[ "$a" -eq 1 ] || fail=1
s=$(node -e "const s=require('./$out/A-direct/summary.json');const f=s.results.find(r=>r.name==='negative-control-deliberately-failing-test');const p=s.results.find(r=>r.name==='typecheck');console.log([s.runnerExit,f.exit,f.ok,p.exit,p.ok].join(' '))")
echo "A summary.json: runnerExit, failing check exit, failing ok, passing check exit, passing ok = $s (expected 1 1 false 0 true)" >> "$log"
[ "$s" = "1 1 false 0 true" ] || fail=1

# B. pipeline with pipefail
set -o pipefail
node "$here/verify-m8.mjs" "$out/B-pipefail" --negative-control 2>&1 | tail -n 2 > "$out/B-pipefail-tail.txt"
st=("$?" "${PIPESTATUS[@]}"); b=${st[0]}; b0=${st[1]}  # one assignment: $? and PIPESTATUS of the same pipeline
echo "B pipefail: pipeline exit $b, PIPESTATUS[0] $b0 (expected 1 1)" >> "$log"
[ "$b" -eq 1 ] && [ "$b0" -eq 1 ] || fail=1
set +o pipefail

# C. the hazard: the same pipeline without pipefail reports tail's 0
node "$here/verify-m8.mjs" "$out/C-no-pipefail" --negative-control 2>&1 | tail -n 2 > "$out/C-no-pipefail-tail.txt"
st=("$?" "${PIPESTATUS[@]}"); c=${st[0]}; c0=${st[1]}
echo "C no pipefail: pipeline exit $c, PIPESTATUS[0] $c0 (expected 0 1: the masking B-03 reported)" >> "$log"
[ "$c" -eq 0 ] && [ "$c0" -eq 1 ] || fail=1

echo "negative control result: $([ $fail -eq 0 ] && echo PASS || echo FAIL)" >> "$log"
cat "$log"
exit $fail
