// A thread and its interview card belong together when the interview names that thread. The inbox pile and the
// links both ways ride on that match, and it must not care how the account was cased in either list.
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { interviewThreadKey, interviewThreadKeys, mailHasInterview, interviewBoardAnchor, interviewBoardHref } from '../../src/lib/interview-mail-link.ts'

test('a thread and its interview card match on account and thread, whatever the case', () => {
  const keys = interviewThreadKeys([
    { account: 'one@example.test', threadId: 'abc123' },
    { account: 'two@example.test', threadId: undefined },
    { account: 'two@example.test' },
  ])
  assert.equal(keys.size, 1, 'threads without an id are not keys')
  assert.ok(mailHasInterview(keys, 'one@example.test', 'abc123'))
  assert.ok(!mailHasInterview(keys, 'one@example.test', 'other'))
  assert.ok(!mailHasInterview(keys, 'two@example.test', 'abc123'))
  assert.equal(interviewThreadKey(' A@B.com ', 't'), 'a@b.com:t')
})

test('same provider thread IDs in different inboxes have distinct board anchors and links', () => {
  const one = interviewBoardAnchor('One@example.test', 'abc123')
  const two = interviewBoardAnchor('Two@example.test', 'abc123')
  assert.equal(one, 'interview-one@example.test:abc123')
  assert.equal(two, 'interview-two@example.test:abc123')
  assert.notEqual(one, two)
  assert.equal(interviewBoardHref('abc123', 'ONE@example.test'), '/dashboard/calendar#interview-one@example.test:abc123')
  const board = readFileSync(new URL('../../src/app/dashboard/calendar/_components/interview-board.tsx', import.meta.url), 'utf8')
  const mail = readFileSync(new URL('../../src/app/dashboard/mail/page.tsx', import.meta.url), 'utf8')
  assert.match(board, /id=\{t\.threadId \? interviewBoardAnchor\(t\.account, t\.threadId\) : undefined\}/)
  assert.match(mail, /interviewBoardHref\(x\.id, x\.account\)/)
  assert.match(mail, /interviewBoardHref\(m\.id, m\.account\)/)
})
