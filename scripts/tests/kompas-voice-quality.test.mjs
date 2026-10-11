import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../kompas-voice-quality.mjs';
test('measures deletions', () => {
  const r = score([{consented:true,reference:'hello hello',hypothesis:'hello'}]);
  assert.equal(r.deletionRate,0.5);
});
