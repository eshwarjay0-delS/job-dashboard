import test from 'node:test';
import assert from 'node:assert/strict';
import { edits, termCounts, percentile, words } from '../kompas-voice-metrics-core.mjs';

test('separates substitutions, deletions and insertions for WER', () => {
  assert.deepEqual(edits('one two three four five six', 'one new three five six extra'), {
    referenceWords: 6, substitutions: 1, deletions: 1, insertions: 1,
  });
});
test('silence is not given an invented reference denominator', () => {
  assert.deepEqual(edits('', 'hallucinated text'), {
    referenceWords: 0, substitutions: 0, deletions: 0, insertions: 2,
  });
});
test('technical terms count repeated occurrences without double-counting labels', () => {
  assert.deepEqual(termCounts('Azure Sentinel and Azure Sentinel', 'Azure Sentinel', ['Azure Sentinel', 'Azure Sentinel']), {
    expected: 2, recognized: 1,
  });
});
test('preserves Unicode script and technical punctuation', () => {
  assert.deepEqual(words('C++ AS-REP నా పని'), ['c++', 'as-rep', 'నా', 'పని']);
  assert.deepEqual(termCounts('C++ AS-REP నా పని', 'C++ AS-REP నా పని', ['C++', 'AS-REP', 'నా పని']), {
    expected: 3, recognized: 3,
  });
});
test('nearest rank P50 and P95 do not mutate inputs', () => {
  const latencies = [100, 400, 200, 300];
  assert.equal(percentile(latencies, 0.5), 200);
  assert.equal(percentile(latencies, 0.95), 400);
  assert.deepEqual(latencies, [100, 400, 200, 300]);
  assert.equal(percentile([], 0.95), null);
});
test('bounds quadratic alignment to 500 words per clip', () => {
  assert.throws(() => edits(Array(501).fill('word').join(' '), 'word'), /500 words/);
});
