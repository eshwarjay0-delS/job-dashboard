// A thread and its interview card belong together when the interview names that thread. The inbox pile and the
// links both ways ride on that match, and it must not care how the account was cased in either list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interviewThreadKey, interviewThreadKeys, mailHasInterview, interviewBoardHref } from '../../src/lib/interview-mail-link.ts'

test('a thread and its interview card match on account and thread, whatever the case', () => {
  const keys = interviewThreadKeys([
    { account: 'Jayeshwar44@Gmail.com', threadId: 'abc123' },
    { account: 'eshwarjay05@gmail.com', threadId: undefined },
    { account: 'eshwarjay05@gmail.com' },
  ])
  assert.equal(keys.size, 1, 'threads without an id are not keys')
  assert.ok(mailHasInterview(keys, 'jayeshwar44@gmail.com', 'abc123'))
  assert.ok(!mailHasInterview(keys, 'jayeshwar44@gmail.com', 'other'))
  assert.ok(!mailHasInterview(keys, 'eshwarjay05@gmail.com', 'abc123'))
  assert.equal(interviewThreadKey('A@B.com', 't'), 'a@b.com:t')
})

test('the board link lands on the thread card by anchor', () => {
  assert.equal(interviewBoardHref('abc123'), '/dashboard/calendar#interview-abc123')
})
