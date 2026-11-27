import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { isDigestSenderMuted, notifyRuleKey, toggleDigestSenderMute, waitingDaysForDigestMail, limitGmailAccounts, enabledGmailAccounts } from "../../src/lib/mail-digest.ts"

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
  assert.match(reply, /setAccountId\(typeof body\.accountId === "string" \? body\.accountId : null\)/)
  assert.match(reply, /\[mail\.id, mail\.account\]/)
})


test("mobile account toggles preserve the four-account ceiling", () => {
  const page = readFileSync(new URL("../../src/app/dashboard/mail/page.tsx", import.meta.url), "utf8")
  const data = readFileSync(new URL("../../src/lib/use-gmail-data.ts", import.meta.url), "utf8")
  assert.match(page, /accounts\.map\(a =>/)
  assert.match(data, /const unique = \[\.\.\.new Set\(emails\)\]\.slice\(0, 4\)/)
  assert.match(data, /return unique\.map\(/)
})



test("the server account limit deduplicates inboxes and caps the first four connected accounts", () => {
  const accounts = [
    { id: "1", google_email: "primary@example.com", gmail_enabled: true, is_primary: true },
    { id: "dup", google_email: "PRIMARY@example.com", gmail_enabled: true },
    { id: "2", google_email: "two@example.com", gmail_enabled: true },
    { id: "3", google_email: "three@example.com", gmail_enabled: true },
    { id: "4", google_email: "four@example.com", gmail_enabled: true },
    { id: "5", google_email: "five@example.com", gmail_enabled: true },
  ]
  assert.deepEqual(limitGmailAccounts(accounts), [accounts[0], accounts[2], accounts[3], accounts[4]])
  assert.deepEqual(enabledGmailAccounts(accounts), [accounts[0], accounts[2], accounts[3], accounts[4]])
  assert.deepEqual(limitGmailAccounts(accounts, 0), [])
})

test("Gmail data cache is account-scoped and cleared before an account switch", () => {
  const data = readFileSync(new URL("../../src/lib/use-gmail-data.ts", import.meta.url), "utf8")
  const sidebar = readFileSync(new URL("../../src/app/dashboard/sidebar-nav.tsx", import.meta.url), "utf8")
  assert.match(data, /shared: \\{ userKey: string; data: Loaded; at: number \\}/)
  assert.match(data, /expectedUserKey/)
  assert.match(data, /currentUserKey === userKey/)
  assert.match(data, /shared\\?\\.userKey === key/)
  assert.match(sidebar, /resetGmailDataForAccountSwitch/)
  assert.match(sidebar, /refreshGmailDataForCurrentAccount/)
  assert.match(sidebar, /window\.setTimeout\(\(\) =>/)
})

test("Gmail routes enforce the four-account ceiling server-side, including requested account IDs", () => {
  const server = readFileSync(new URL("../../src/app/api/gmail/_lib.ts", import.meta.url), "utf8")
  const sync = readFileSync(new URL("../../src/app/api/gmail-sync/route.ts", import.meta.url), "utf8")
  assert.match(server, /limitGmailAccounts/)
  assert.match(server, /enabledGmailAccounts/)
  assert.match(sync, /limitGmailAccounts\\(loaded\\.accounts\\)/)
  assert.match(sync, /enabledGmailAccounts\\(loaded\\.accounts\\)/)
  assert.match(sync, /requestedAccountId && !selectedAccount/)
})
