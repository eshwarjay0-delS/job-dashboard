import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { isDigestSenderMuted, notifyRuleKey, toggleDigestSenderMute, waitingDaysForDigestMail, limitGmailAccounts, enabledGmailAccounts } from "../../src/lib/mail-digest.ts"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"
const require = createRequire(import.meta.url)

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
  assert.match(data, /shared: \{ userKey: string; data: Loaded; at: number \}/)
  assert.match(data, /expectedUserKey/)
  assert.match(data, /currentUserKey === userKey/)
  assert.match(data, /shared\?\.userKey === key/)
  assert.match(sidebar, /resetGmailDataForAccountSwitch/)
  assert.match(sidebar, /refreshGmailDataForCurrentAccount/)
  assert.match(sidebar, /window\.setTimeout\(\(\) =>/)
})

test("Gmail routes enforce the four-account ceiling server-side, including requested account IDs", () => {
  const server = readFileSync(new URL("../../src/app/api/gmail/_lib.ts", import.meta.url), "utf8")
  const sync = readFileSync(new URL("../../src/app/api/gmail-sync/route.ts", import.meta.url), "utf8")
  assert.match(server, /limitGmailAccounts/)
  assert.match(server, /enabledGmailAccounts/)
  assert.match(sync, /limitGmailAccounts\(loaded\.accounts\)/)
  assert.match(sync, /enabledGmailAccounts\(loaded\.accounts\)/)
  assert.match(sync, /requestedAccountId && !selectedAccount/)
})


test("an account-A in-flight Gmail load cannot publish or snapshot after switching to account B", async () => {
  let currentUser = "A"
  const deferredA = []
  let startedA
  const started = new Promise(resolve => { startedA = resolve })
  const snapshots = new Map()
  const localStorage = {
    getItem: key => snapshots.get(key) ?? null,
    setItem: (key, value) => snapshots.set(key, value),
    removeItem: key => snapshots.delete(key),
    key: index => [...snapshots.keys()][index] ?? null,
    get length() { return snapshots.size },
  }
  const response = data => ({ ok: true, json: async () => data })
  const dataFor = (user, url) => {
    if (url.includes("/api/gmail-sync")) return { connected: true }
    if (url.includes("/api/gmail/threads")) return { mails: [{ id: user + "-thread", account: user + "@example.test" }], issues: [] }
    if (url.includes("/api/gmail/tracker")) return { applications: [] }
    if (url.includes("/api/gmail/interviews")) return { interviews: [] }
    if (url.includes("/api/gmail/workflow-steps")) return { steps: [] }
    if (url.includes("/api/gmail/unfollowed")) return { domains: [] }
    if (url.includes("/api/gmail/drafts")) return { drafts: [] }
    if (url.includes("/api/gmail/followup-radar")) return { radar: [] }
    throw new Error("Unexpected Gmail request " + url)
  }
  const fetch = async url => {
    const user = currentUser
    if (user === "A" && !url.includes("/api/gmail-sync")) {
      return new Promise(resolve => {
        deferredA.push(() => resolve(response(dataFor(user, url))))
        if (deferredA.length === 7) startedA()
      })
    }
    return response(dataFor(user, url))
  }
  const react = { useState: value => [value, () => {}], useEffect: () => {}, useCallback: fn => fn }
  const mocks = {
    react,
    "@/lib/supabase/client": {
      createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: currentUser } } } }) } }),
    },
  }
  const module = { exports: {} }
  const source = readFileSync(new URL("../../src/lib/use-gmail-data.ts", import.meta.url), "utf8") + "\nexport { loadShared, listeners, resetGmailDataForAccountSwitch };"
  const compiled = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, {
    module, exports: module.exports, process, console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch, localStorage, window: { addEventListener: () => {}, removeEventListener: () => {} },
    document: { hidden: false, addEventListener: () => {}, removeEventListener: () => {} },
    require: id => id in mocks ? mocks[id] : require(id),
  })
  const { loadShared, listeners, resetGmailDataForAccountSwitch } = module.exports
  const observed = []
  listeners.add(data => observed.push(data))
  const loadA = loadShared(false)
  await started
  currentUser = "B"
  resetGmailDataForAccountSwitch()
  const loadB = loadShared(false)
  const b = await loadB
  assert.equal(b.mails[0].id, "B-thread")
  deferredA.forEach(resolve => resolve())
  await loadA
  assert.equal(observed.some(data => data.mails.some(mail => mail.id === "A-thread")), false)
  assert.equal(observed.filter(data => data.mails.some(mail => mail.id === "B-thread")).length, 1)
  assert.deepEqual([...snapshots.keys()], ["mfit:gmail-snapshot:v2:B"])
})


function makeGmailRefreshHarness(getSession, seeded = []) {
  const snapshots = new Map(seeded)
  const localStorage = {
    getItem: key => snapshots.get(key) ?? null,
    setItem: (key, value) => snapshots.set(key, value),
    removeItem: key => snapshots.delete(key),
    key: index => [...snapshots.keys()][index] ?? null,
    get length() { return snapshots.size },
  }
  const response = data => ({ ok: true, json: async () => data })
  const fetch = async () => response({ connected: false, reason: "not_logged_in" })
  const react = { useState: value => [value, () => {}], useEffect: () => {}, useCallback: fn => fn }
  const mocks = {
    react,
    "@/lib/supabase/client": { createClient: () => ({ auth: { getSession } }) },
  }
  const module = { exports: {} }
  const source = readFileSync(new URL("../../src/lib/use-gmail-data.ts", import.meta.url), "utf8") +
    "\nexport { refreshGmailDataForCurrentAccount, resetGmailDataForAccountSwitch, listeners };"
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptKind.TS },
  }).outputText
  runInNewContext(compiled, {
    module, exports: module.exports, process, console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch, localStorage, window: { addEventListener: () => {}, removeEventListener: () => {} },
    document: { hidden: false, addEventListener: () => {}, removeEventListener: () => {} },
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return { ...module.exports, snapshots }
}

function gmailLocalSnapshot(user) {
  return JSON.stringify({
    mails: [{ id: user + "-local", account: user + "@example.test" }],
    applications: [], interviews: [], steps: [], unfollowed: [], drafts: [], radar: [], issues: [], savedAt: 1,
  })
}

function waitForSnapshot(listeners, id) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for " + id + " local snapshot")), 3000)
    listeners.add(data => {
      if (data.mails.some(mail => mail.id === id)) {
        clearTimeout(timeout)
        resolve(data)
      }
    })
  })
}

test("refresh never publishes account A's local snapshot after switching to B", async () => {
  let currentUser = "A"
  let releaseA
  let delayA = true
  const pendingA = new Promise(resolve => { releaseA = resolve })
  const getSession = async () => {
    if (currentUser === "A" && delayA) {
      delayA = false
      return pendingA
    }
    return { data: { session: currentUser ? { user: { id: currentUser } } : null } }
  }
  const harness = makeGmailRefreshHarness(getSession, [
    ["mfit:gmail-snapshot:v2:A", gmailLocalSnapshot("A")],
    ["mfit:gmail-snapshot:v2:B", gmailLocalSnapshot("B")],
  ])
  const observed = []
  harness.listeners.add(data => observed.push(data))
  const bSnapshot = waitForSnapshot(harness.listeners, "B-local")

  harness.refreshGmailDataForCurrentAccount()
  currentUser = "B"
  harness.resetGmailDataForAccountSwitch()
  harness.refreshGmailDataForCurrentAccount()
  await bSnapshot

  releaseA({ data: { session: { user: { id: "A" } } } })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(observed.some(data => data.mails.some(mail => mail.id === "A-local")), false)
  assert.equal(observed.some(data => data.mails.some(mail => mail.id === "B-local")), true)
  assert.deepEqual([...harness.snapshots.keys()].sort(), [
    "mfit:gmail-snapshot:v2:A", "mfit:gmail-snapshot:v2:B",
  ])
})

test("refresh cannot republish a local snapshot after sign-out, and same-account restore remains available", async () => {
  let currentUser = "A"
  let releaseA
  let delayA = true
  const pendingA = new Promise(resolve => { releaseA = resolve })
  const getSession = async () => {
    if (currentUser === "A" && delayA) {
      delayA = false
      return pendingA
    }
    return { data: { session: currentUser ? { user: { id: currentUser } } : null } }
  }
  const harness = makeGmailRefreshHarness(getSession, [
    ["mfit:gmail-snapshot:v2:A", gmailLocalSnapshot("A")],
  ])
  const observed = []
  harness.listeners.add(data => observed.push(data))
  harness.refreshGmailDataForCurrentAccount()
  currentUser = null
  harness.resetGmailDataForAccountSwitch()
  releaseA({ data: { session: { user: { id: "A" } } } })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(observed.some(data => data.mails.some(mail => mail.id === "A-local")), false)

  let activeUser = "A"
  const positive = makeGmailRefreshHarness(async () => ({
    data: { session: { user: { id: activeUser } } },
  }), [["mfit:gmail-snapshot:v2:A", gmailLocalSnapshot("A")]])
  const sameAccountRestore = waitForSnapshot(positive.listeners, "A-local")
  positive.refreshGmailDataForCurrentAccount()
  await sameAccountRestore
  assert.equal(positive.snapshots.has("mfit:gmail-snapshot:v2:A"), true)
})
