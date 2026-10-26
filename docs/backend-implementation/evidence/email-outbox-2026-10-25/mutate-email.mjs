// Email outbox mutation checks: one mutation at a time, source restored in `finally`, nothing else running.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const O = 'src/identity/email-outbox.ts', T = 'src/identity/email-transport.ts', S = 'src/identity/service.ts';
const mutations = [
  ['login does not queue the email', S, 'if (deliveredForReal(config,address)) await enqueueSignin(tx,config,row.id,address,link);', ''],
  ['a new Idempotency-Key per attempt', O, 'deliveryKey: row.delivery_key', "deliveryKey: 'signin/' + uuid()"],
  ['permanent errors treated as transient', O, '} else if (outcome.permanent || row.attempts >= row.max_attempts) {', '} else if (row.attempts >= row.max_attempts) {'],
  ['retries never stop', O, '} else if (outcome.permanent || row.attempts >= row.max_attempts) {', '} else if (outcome.permanent) {'],
  ['no backoff', O, 'available_at=now()+make_interval(secs => (0.5 + random() / 2) * least(power(2, ${row.attempts - 1}) * 5, 120))', 'available_at=now()'],
  ['stale worker not fenced on failure', O, "last_error_code=${outcome.code},updated_at=now(),\n          available_at", "last_error_code=${outcome.code},updated_at=now(),lease_token=null,\n          available_at"],
  ['payload kept after sending', O, "status='SENT',sent_at=now(),payload_ciphertext=null,", "status='SENT',sent_at=now(),"],
  ['expired rows are not closed', O, "where status='QUEUED' and expires_at<=now()`", "where false`"],
  ['lost leases are not recovered', O, "where status='SENDING' and lease_until<=now()`", "where false`"],
  ['no row locking between workers', O, 'order by available_at limit 1 for update skip locked)', 'order by available_at limit 1)'],
  ['token in the query string', T, "`${new URL('/auth/email', origin).href}#token=${link}`", "`${new URL('/auth/email', origin).href}?token=${link}`"],
  ['adapter forgets the Idempotency-Key header', T, ", 'Idempotency-Key': deliveryKey }", ' }'],
  ['adapter accepts a query-string token', T, 'link.pathname !== \'/auth/email\'\n        || link.search ||', "link.pathname !== '/auth/email'\n        ||"],
  ['429 treated as permanent', T, "if (response.status === 429) throw new EmailSendError('PROVIDER_RATE_LIMITED', false);", "if (response.status === 429) throw new EmailSendError('PROVIDER_RATE_LIMITED', true);"],
];
let survived = 0; const out = [];
for (const [name, file, from, to] of mutations) {
  const original = readFileSync(file, 'utf8');
  try {
    if (!original.includes(from)) throw new Error('anchor: ' + name);
    writeFileSync(file, original.replace(from, to));
    const r = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', '--test-concurrency=1', 'test/email-outbox.test.ts', 'test/self-onboarding.test.ts'], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 240000 });
    const failing = (r.stdout.match(/^ {2}✖ .*$/gm) ?? []).map(l => l.trim().slice(2, 80)).join(' | ') || (r.stdout.match(/^✖ .*$/m) ?? [''])[0].slice(0, 80);
    // A timeout is not a kill: the suite hung instead of failing an assertion.
    if (r.status === 0 || r.status === null) survived++;
    const line = `${r.status === null ? 'TIMEOUT ' : r.status !== 0 ? 'KILLED  ' : 'SURVIVED'} ${name} (exit ${r.status})${failing ? ' — ' + failing : ''}`;
    out.push(line); console.log(line);
  } finally { writeFileSync(file, original); }
}
console.log(`${mutations.length - survived}/${mutations.length} mutations killed`);
process.exit(survived ? 1 : 0);
