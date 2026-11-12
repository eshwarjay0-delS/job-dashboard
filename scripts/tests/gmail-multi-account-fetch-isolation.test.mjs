import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const nodeRequire = createRequire(import.meta.url)
const source = readFileSync(new URL("../../src/app/api/gmail/_lib.ts", import.meta.url), "utf8")

function harness() {
  const calls = { tokens: [], fetch: [] }
  const module = { exports: {} }
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const accounts = [
    { id: "acct-one", google_email: "one@example.com", gmail_enabled: true },
    { id: "acct-two", google_email: "two@example.com", gmail_enabled: true },
  ]
  const mocks = {
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: () => ({ select: () => ({ limit: async () => ({ error: new Error("cache unavailable") }) }) }),
      }),
    },
    "@/lib/googleWorkspace": {
      listGoogleWorkspaceAccounts: async () => accounts,
      getGoogleWorkspaceAccessToken: async (userId, accountId) => {
        calls.tokens.push({ userId, accountId })
        return accountId === "acct-one" ? "token-one" : null
      },
    },
    "@/lib/email-classifier": {
      classifyEmail: () => ({ category: "General Correspondence", confidence: "high", jobTitle: "", rate: "", vendor: "", vendorDomain: "" }),
    },
    "@/lib/application-evidence": {
      emailAddress: value => value,
      authoredText: value => value,
      submissionEvidence: () => ({}),
      calendarEvidence: () => [],
      linkReferencedThreads: value => value,
    },
    "@/lib/mail-reading": {
      turnOf: () => "them",
      saysWaitForUs: () => false,
    },
  }
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: id => mocks[id] ?? nodeRequire(id),
    fetch: async (url, init) => {
      calls.fetch.push({ url: String(url), authorization: init?.headers?.Authorization })
      if (String(url).includes("/threads?q=")) {
        return { ok: true, json: async () => ({ threads: [{ id: "thread-one" }] }) }
      }
      if (String(url).includes("/threads/thread-one?format=full")) {
        return {
          ok: true,
          json: async () => ({
            id: "thread-one",
            messages: [{
              id: "message-one",
              threadId: "thread-one",
              snippet: "Security analyst opening",
              labelIds: ["INBOX"],
              internalDate: "1794470000000",
              payload: { headers: [
                { name: "From", value: "Recruiter <recruiter@example.com>" },
                { name: "Subject", value: "Security Analyst" },
                { name: "To", value: "me@example.com" },
              ] },
            }],
          }),
        }
      }
      throw new Error("Unexpected Gmail request: " + url)
    },
    Buffer,
    Date,
    URLSearchParams,
    setTimeout,
    console,
  })
  return { fetchClassifiedThreads: module.exports.fetchClassifiedThreads, calls }
}

test("one disconnected inbox reports its own issue without dropping the healthy inbox", async () => {
  const h = harness()
  const result = await h.fetchClassifiedThreads("user-1")
  assert.equal(result.threads.length, 1)
  assert.equal(result.threads[0].threadId, "thread-one")
  assert.equal(result.threads[0].accountEmail, "one@example.com")
  assert.deepEqual(JSON.parse(JSON.stringify(result.issues)), [{
    account: "two@example.com",
    reason: "Google didn't return an access token — reconnect this account.",
  }])
  assert.deepEqual(h.calls.tokens, [
    { userId: "user-1", accountId: "acct-one" },
    { userId: "user-1", accountId: "acct-two" },
  ])
  assert.equal(h.calls.fetch.length, 2, "only the healthy account should call Gmail")
  assert.ok(h.calls.fetch.every(call => call.authorization === "Bearer token-one"))
})

test("the account filter never scans a different connected inbox", async () => {
  const h = harness()
  const result = await h.fetchClassifiedThreads("user-1", { account: "TWO@example.com" })
  assert.equal(result.threads.length, 0)
  assert.equal(result.issues.length, 1)
  assert.deepEqual(h.calls.tokens, [{ userId: "user-1", accountId: "acct-two" }])
  assert.equal(h.calls.fetch.length, 0)
})
