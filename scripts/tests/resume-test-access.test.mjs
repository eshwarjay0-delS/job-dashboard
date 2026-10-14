import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasUnlimitedResumeTestAccess } from '../../src/lib/resumeTestAccess.ts'

test('only the explicitly authorized test account receives unlimited resume access', () => {
  assert.equal(hasUnlimitedResumeTestAccess(' Janjiaarya@gmail.com '), true)
  for (const email of [null, undefined, '', 'other@gmail.com', 'janjiaarya@gmail.com.evil.test']) {
    assert.equal(hasUnlimitedResumeTestAccess(email), false)
  }
})
