import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { isDigestSenderMuted, notifyRuleKey, toggleDigestSenderMute, waitingDaysForDigestMail } from "../../src/lib/mail-digest.ts"
import { readReplyDraft, replyDraftKey, saveReplyDraft } from "../../src/lib/mail-reply-draft.ts"

// Provider thread IDs may collide across inboxes; sender mutes must remain account-scoped.
test("digest sender mute is scoped to the receiving inbox", () => {
  const rules = [
    { account: "one@example.com", email: "recruiter@example.com", mode: "never" },
    { account: "two@example.com", email: "recruiter@example.com", mode: "always" },
  ]
  assert.equal(isDigestSenderMuted(rules, { account: "one@example.com", id: "same-thread", fromEmail: "recruiter@example.com" }), true)
  assert.equal(isDigestSenderMuted(rules, { account: "two@example.com", id: "same-thread", fromEmail: "recruiter@example.com" }), false)
  assert.equal(isDigestSenderMuted(rules, { account: "three@example.com", id: "same-thread", fromEmail: "recruiter@example.com" }), false)
})

test("toggling a mute changes only the matching account and sender", () => {
  const rules = [
    { account: "one@example.com", email: "recruiter@example.com", mode: "never" },
    { account: "two@example.com", email: "recruiter@example.com", mode: "always" },
    { account: "two@example.com", email: "other@example.com", mode: "never" },
  ]
  const unmutedOne = toggleDigestSenderMute(rules, " ONE@example.com ", " RECRUITER@example.com ")
  assert.deepEqual(unmutedOne, [rules[1], rules[2]])
  const mutedTwo = toggleDigestSenderMute(unmutedOne, "two@example.com", "recruiter@example.com")
  assert.deepEqual(mutedTwo, [rules[2], { account: "two@example.com", email: "recruiter@example.com", mode: "never" }])
  assert.equal(notifyRuleKey(" TWO@EXAMPLE.COM ", " Recruiter@Example.com "), "two@example.com:recruiter@example.com")
  assert.equal(notifyRuleKey("a2", "recruiter@example.com"), "")
  assert.deepEqual(toggleDigestSenderMute(rules, "a2", "recruiter@example.com"), rules)
})

test("waiting-on-them radar matches account plus thread ID", () => {
  const radar = [
    { account: "one@example.com", threadId: "same-thread", daysWaiting: 2 },
    { account: "two@example.com", threadId: "same-thread", daysWaiting: 11 },
  ]
  assert.equal(waitingDaysForDigestMail(radar, { account: "one@example.com", id: "same-thread" }), 2)
  assert.equal(waitingDaysForDigestMail(radar, { account: "two@example.com", id: "same-thread" }), 11)
  assert.equal(waitingDaysForDigestMail(radar, { account: "three@example.com", id: "same-thread" }), 0)
})

test("digest actions pass the receiving account and use account+thread React keys", () => {
  const digest = readFileSync(new URL("../../src/app/dashboard/mail/_components/digest.tsx", import.meta.url), "utf8")
  const page = readFileSync(new URL("../../src/app/dashboard/mail/page.tsx", import.meta.url), "utf8")
  assert.equal([...digest.matchAll(/onOpen\(m\.id, m\.account\)/g)].length, 3)
  assert.equal([...digest.matchAll(/key=\{interviewThreadKey\(m\.account, m\.id\)\}/g)].length, 4)
  assert.match(digest, /isDigestSenderMuted\(rules, m\)/)
  assert.match(digest, /waitingDaysForDigestMail\(radar, m\)/)
  assert.doesNotMatch(digest, /new Set\(rules\.filter/)
  assert.match(page, /function RoleCard[\s\S]*onOpen: \(id: string, account: string\) => void/)
  assert.match(page, /onClick=\{\(\) => onOpen\(m\.id, m\.account\)\}/)
  assert.match(page, /setSelectedInbox\(inbox\)/)
  assert.match(page, /key=\{interviewThreadKey\(r\.account, r\.threadId\)\}/)
  assert.match(page, /openMail\(r\.threadId, r\.account\)/)
})


test("reply identity and saved drafts stay bound to the receiving inbox when digest threads switch accounts", () => {
  const page = readFileSync(new URL("../../src/app/dashboard/mail/page.tsx", import.meta.url), "utf8")
  const reply = readFileSync(new URL("../../src/app/dashboard/mail/_components/smart-reply.tsx", import.meta.url), "utf8")
  assert.ok(page.includes('key={`${m.account}:${m.id}`}'), "switching account/thread remounts the reply composer instead of carrying stale recipient or sender state")
  assert.match(reply, /replyDraftKey\(data\.user\.id, mail\.account, mail\.id\)/)
  assert.match(reply, /accountEmail: mail\.account, threadId: mail\.id/)
  assert.match(reply, /From: <strong>\{mail\.account\}<\/strong>/, "the visible From identity stays bound to the receiving inbox")
  assert.match(reply, /setAccountId\(typeof body\.accountId === "string" \? body\.accountId : null\)/)
  assert.match(reply, /\[mail\.id, mail\.account\]/)
})

test("reply drafts are isolated by user, receiving inbox and provider thread ID", () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const firstInbox = replyDraftKey("user-a", "one@example.com", "same-provider-thread")
  const normalizedFirstInbox = replyDraftKey("user-a", " ONE@example.com ", "same-provider-thread")
  const secondInbox = replyDraftKey("user-a", "two@example.com", "same-provider-thread")
  const otherUser = replyDraftKey("user-b", "one@example.com", "same-provider-thread")
  const otherThread = replyDraftKey("user-a", "one@example.com", "different-thread")
  const draft = { to: "recruiter@example.com", cc: "", bcc: "", subject: "Re: role", body: "Inbox one draft", files: [] }

  saveReplyDraft(storage, firstInbox, draft)
  assert.equal(firstInbox, normalizedFirstInbox, "account casing and surrounding whitespace normalize")
  assert.equal(readReplyDraft(storage, firstInbox)?.body, "Inbox one draft")
  assert.equal(readReplyDraft(storage, secondInbox), null, "same provider thread ID in another inbox cannot read this draft")
  assert.equal(readReplyDraft(storage, otherUser), null, "another signed-in user cannot read this draft")
  assert.equal(readReplyDraft(storage, otherThread), null, "another thread cannot read this draft")
})


test("mobile inbox toggles show server-authorized accounts and the RPC enforces the four-account maximum", () => {
  const page = readFileSync(new URL("../../src/app/dashboard/mail/page.tsx", import.meta.url), "utf8")
  const data = readFileSync(new URL("../../src/lib/use-gmail-data.ts", import.meta.url), "utf8")
  const migration = readFileSync(new URL("../../supabase/migrations/20261004_multi_google_workspace_accounts.sql", import.meta.url), "utf8")
  assert.match(page, /accounts\.map\(a =>/)
  assert.match(data, /const unique = \[\.\.\.new Set\(emails\)\]/)
  assert.match(data, /return unique\.map\(/)
  assert.doesNotMatch(data, /(?:emails|unique)\.slice\(\s*0\s*,\s*4\s*\)/)
  assert.match(migration, /order by a\.is_primary desc, a\.connected_at asc\s+limit 4/i)
})
