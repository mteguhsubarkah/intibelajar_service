// B-03 negative control: a real node:test file whose assertion fails on purpose. It touches no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('negative control: this check fails on purpose', () => {
  assert.equal(1 + 1, 3, 'deliberate failure: the runner must report it and exit non-zero');
});
