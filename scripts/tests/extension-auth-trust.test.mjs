// Only the MarketFit dashboard can hand the extension a sign-in or sign it out, and the user's own AI key stays on
// this computer. Runs the real extension/auth.js and extension/claude-key.js against a fake chrome API.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const DASHBOARD = "https://job-dashboard-fawn.vercel.app"
const OUR_ID = "our-extension-id"

function fakeChrome({ appUrl } = {}) {
  const area = (data) => ({
    data,
    get(keys, cb) { const out = {}; for (const k of keys) if (k in data) out[k] = data[k]; return cb ? cb(out) : Promise.resolve(out) },
    set(obj, cb) { Object.assign(data, obj); return cb ? cb() : Promise.resolve() },
    remove(keys, cb) { for (const k of keys) delete data[k]; return cb ? cb() : Promise.resolve() },
  })
  const listeners = []
  return {
    runtime: { id: OUR_ID, onMessage: { addListener: (fn) => listeners.push(fn) } },
    storage: { local: area({ mf_session: { access_token: "mine" } }), sync: area(appUrl ? { appUrl } : {}) },
    send(message, sender) {
      return new Promise((resolve) => { for (const fn of listeners) fn(message, sender, (r) => resolve(JSON.parse(JSON.stringify(r)))) })
    },
  }
}

async function loadAuth(chrome) {
  // auth.js is an ES module with no imports; run it as a script so the normal test run needs no extra Node flags.
  const src = readFileSync(new URL("../../extension/auth.js", import.meta.url), "utf8").replace(/^export /gm, "")
  const ctx = vm.createContext({ chrome, URL, Promise })
  vm.runInContext(src + "\nthis.listenForWebAuth = listenForWebAuth;", ctx)
  return ctx
}

const fromPage = (url, id = OUR_ID) => ({ id, url, tab: { url } })

test("a sign-in from the dashboard is kept", async () => {
  const chrome = fakeChrome()
  ;(await loadAuth(chrome)).listenForWebAuth()
  assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: { access_token: "new" } }, fromPage(DASHBOARD + "/dashboard")), { ok: true })
  assert.equal(chrome.storage.local.data.mf_session.access_token, "new")
})

test("a sign-in or sign-out from any other page, or another extension, changes nothing", async () => {
  const chrome = fakeChrome()
  ;(await loadAuth(chrome)).listenForWebAuth()
  for (const sender of [fromPage("http://localhost:3000/"), fromPage("https://example.com/"), fromPage(DASHBOARD + "/", "someone-else"), {}]) {
    assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: { access_token: "other" } }, sender), { ok: false })
    assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: null }, sender), { ok: false })
    assert.equal(chrome.storage.local.data.mf_session.access_token, "mine")
  }
})

test("signing out on the dashboard clears the session", async () => {
  const chrome = fakeChrome()
  ;(await loadAuth(chrome)).listenForWebAuth()
  assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: null }, fromPage(DASHBOARD + "/login")), { ok: true })
  assert.equal(chrome.storage.local.data.mf_session, undefined)
})

test("a developer's local dashboard is trusted only when it is the configured one", async () => {
  const chrome = fakeChrome({ appUrl: "http://localhost:3000" })
  ;(await loadAuth(chrome)).listenForWebAuth()
  assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: { access_token: "dev" } }, fromPage("http://localhost:3000/dashboard")), { ok: true })
  assert.deepEqual(await chrome.send({ type: "MF_AUTH", session: { access_token: "x" } }, fromPage(DASHBOARD + "/")), { ok: false })
})

test("the published manifest never runs on or reaches a local page", () => {
  const manifest = readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8")
  assert.doesNotMatch(manifest, /localhost|127\.0\.0\.1/)
})

test("the AI key moves off synced storage once and then stays on this computer", async () => {
  const chrome = fakeChrome()
  chrome.storage.sync.data.claudeKey = "old-key"
  const ctx = vm.createContext({})
  vm.runInContext(readFileSync(new URL("../../extension/claude-key.js", import.meta.url), "utf8"), ctx)
  const K = ctx.MarketFitClaudeKey
  assert.equal(await K.readClaudeKey(chrome.storage), "old-key")
  assert.equal("claudeKey" in chrome.storage.sync.data, false)
  assert.equal(chrome.storage.local.data.claudeKey, "old-key")
  assert.equal(await K.moveClaudeKeyToLocal(chrome.storage), false, "nothing left to move")
  await K.saveClaudeKey(chrome.storage, "new-key")
  assert.equal(chrome.storage.local.data.claudeKey, "new-key")
  assert.equal("claudeKey" in chrome.storage.sync.data, false)
})
