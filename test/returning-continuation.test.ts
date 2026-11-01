import test from 'node:test';
import assert from 'node:assert/strict';
import { returningContinuation } from '../src/identity/service.js';
test('existing accounts signing in from the trial land on Beranda, other routes keep their continuation', () => {
  assert.deepEqual(returningContinuation({ route: '/coba', step: 7 }), { route: '/home', returning: true, step: 7 });
  assert.deepEqual(returningContinuation({ route: '/coba?pelajaran=kimia', step: 3 }), { route: '/home', returning: true, step: 3 });
  assert.deepEqual(returningContinuation({ route: '/soal-tadi' }), { route: '/home', returning: true });
  assert.deepEqual(returningContinuation({ route: '/latihan/soal', step: 0 }), { route: '/latihan/soal', step: 0 });
  assert.deepEqual(returningContinuation({ route: '/cobaan' }), { route: '/cobaan' });
});
