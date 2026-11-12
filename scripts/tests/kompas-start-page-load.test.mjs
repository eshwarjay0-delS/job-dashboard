// Page-load regression: session-reauth.js and output-audio.js both used to
// declare a top-level `const api`, and account-sync.js called an unbound
// setTimeout. Either throw stopped app.js before CONNECT_STEPS initialized.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const read = (name) => readFileSync(new URL("../../public/kompas/" + name, import.meta.url), "utf8")
const html = read("index.html")

function element() {
  const children = []
  const classes = new Set()
  return {
    style: { setProperty() {}, getPropertyValue() { return "" } },
    dataset: {},
    classList: {
      add(...names) { names.forEach(name => classes.add(name)) },
      remove(...names) { names.forEach(name => classes.delete(name)) },
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : !!force
        if (on) classes.add(name)
        else classes.delete(name)
        return on
      },
      contains(name) { return classes.has(name) },
    },
    children,
    className: "",
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    disabled: false,
    title: "",
    id: "",
    open: false,
    scrollTop: 0,
    files: [],
    selectedOptions: [{ textContent: "Engineer" }],
    options: [],
    append(...nodes) { children.push(...nodes) },
    appendChild(node) { children.push(node); return node },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes) },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null },
    removeAttribute() {},
    querySelector() { return element() },
    querySelectorAll() { return [] },
    closest() { return null },
    focus() {},
    click() {},
    contains() { return false },
  }
}

test("boot scripts share one page and do not throw before Start can render", async () => {
  const warnings = []
  const scheduled = []
  const store = new Map()
  const document = {
    hidden: false,
    visibilityState: "visible",
    cookie: "",
    readyState: "complete",
    activeElement: null,
    documentElement: element(),
    body: element(),
    head: element(),
    getElementById() { return element() },
    querySelector() { return null },
    querySelectorAll() { return [] },
    createElement() { return element() },
    addEventListener() {},
    removeEventListener() {},
  }
  const sandbox = {
    console: {
      log() {},
      info() {},
      debug() {},
      error(...args) { warnings.push(args.map(String).join(" ")) },
      warn(...args) { warnings.push(args.map(String).join(" ")) },
    },
    document,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(key),
      key: (index) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
    location: { protocol: "https:", href: "https://job-dashboard-fawn.vercel.app/kompas/", reload() {} },
    navigator: { userAgent: "kompas-test" },
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    performance: { now: () => 0 },
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true, userId: "user-1", records: [] }),
    }),
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  sandbox.top = sandbox
  sandbox.parent = sandbox
  vm.createContext(sandbox)
  function hostCall(name, record) {
    return function hostTimer(fn, ms) {
      // Chrome throws when setTimeout is detached from window. A bare call in
      // this vm has `this` unset; a `{ setTimeout }` method call does not.
      if (this != null && this !== sandbox) throw new TypeError("Illegal invocation")
      if (record) scheduled.push({ name, ms: Number(ms) || 0 })
      return scheduled.length + 1
    }
  }
  sandbox.setTimeout = hostCall("setTimeout", true)
  sandbox.clearTimeout = hostCall("clearTimeout", false)
  sandbox.setInterval = hostCall("setInterval", true)
  sandbox.clearInterval = hostCall("clearInterval", false)
  sandbox.scrollTo = () => {}
  sandbox.addEventListener = () => {}
  sandbox.removeEventListener = () => {}
  sandbox.requestAnimationFrame = () => 1
  sandbox.cancelAnimationFrame = () => {}
  sandbox.queueMicrotask = queueMicrotask

  const order = ["session-reauth.js", "output-audio.js", "account-sync.js", "app.js"]
  const tags = order.map(name => html.indexOf('src="' + name + '?v=20261112-startfix"'))
  assert.ok(tags.every((at, i) => at > (i === 0 ? 0 : tags[i - 1])))
  for (const name of order) vm.runInContext(read(name), sandbox, { filename: name })

  assert.equal(vm.runInContext("typeof api", sandbox), "undefined")
  assert.equal(typeof sandbox.KompasSessionReauth.decideSessionStart, "function")
  assert.equal(typeof sandbox.KompasOutputAudio.recordGainFor, "function")
  assert.equal(typeof sandbox.KompasSessionCloud.create, "function")
  assert.equal(vm.runInContext("Array.isArray(CONNECT_STEPS.web) && CONNECT_STEPS.web.length >= 3", sandbox), true)
  assert.doesNotThrow(() => vm.runInContext("renderConnect()", sandbox))
  await Promise.resolve()
  await Promise.resolve()
  assert.ok(scheduled.some(timer => timer.name === "setTimeout" && timer.ms === 60_000))
  assert.equal(warnings.some(line => line.includes("Kompas session sync could not start")), false)
})
