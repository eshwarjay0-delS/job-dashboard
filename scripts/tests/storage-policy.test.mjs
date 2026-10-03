import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageSegments, storageMode } from '../../src/lib/storagePolicy.ts';

test('object keys reject traversal and ambiguous paths instead of aliasing another file', () => {
  for (const key of ['../secret', 'a/../b', '/absolute', 'C:\\data', 'a//b', 'a/./b', 'a\u0000b']) {
    assert.throws(() => storageSegments(key), /Invalid storage key/);
  }
  assert.deepEqual(storageSegments('user-resumes/account/My Resume.docx'), ['user-resumes', 'account', 'My Resume.docx']);
  assert.deepEqual(storageSegments('folder/ spaced filename .docx'), ['folder', ' spaced filename .docx']);
  assert.deepEqual(storageSegments(''), []);
});

test('serverless and partial storage configuration never fall back to ephemeral disk', () => {
  assert.equal(storageMode({}), 'filesystem');
  assert.equal(storageMode({ VERCEL: '1' }), 'unavailable');
  assert.equal(storageMode({ R2_BUCKET: 'bucket' }), 'unavailable');
  const complete = { VERCEL: '1', R2_BUCKET: 'bucket', R2_ACCOUNT_ID: 'account', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' };
  assert.equal(storageMode(complete), 'r2');
  assert.equal(storageMode({ ...complete, R2_SECRET_ACCESS_KEY: '  ' }), 'unavailable');
});
