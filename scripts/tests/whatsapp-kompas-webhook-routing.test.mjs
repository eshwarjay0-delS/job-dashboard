import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

// Exercise the actual webhook's command routing in isolation, not a hand-copied
// replacement regex. The surrounding Meta delivery and transport are mocked.
const webhook = readFileSync("src/app/api/whatsapp/webhook/route.ts", "utf8")
const from = webhook.indexOf("  const profileCommand =")
const until = webhook.indexOf("  // ── Commands / change requests", from)
assert.ok(from > 0 && until > from, "Keep the Kompas routing block intact")
const source = `async function route(type, msg) {
  const from = "15554441111"
  const userId = "verified-user"
  const verified = true
${webhook.slice(from, until)}
  return "tailor"
}`
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

function makeRoute({ fail = false } = {}) {
  const handled = []
  const sent = []
  const route = runInNewContext(compiled + "\nroute", {
    handleWhatsAppKompas: async args => {
      handled.push(args.msg.text?.body || "")
      if (fail) throw Error("SENSITIVE-EXCEPTION")
      return true
    },
    sendText: async (_to, message) => { sent.push(message); return "sent" },
    resolveWhatsAppUser: async () => ({ who: { own: true, userId: "verified-user" } }),
    console: { error: () => {} },
    String, RegExp,
  })
  return { route, handled, sent }
}
const message = body => ({ type: "text", id: "wamid.test", text: { body } })

test("active Kompas start reaches the interview setup rather than resume help", async () => {
  const ctx = makeRoute()
  assert.equal(await ctx.route("text", message("start")), undefined)
  assert.deepEqual(ctx.handled, ["start"])
})

test("Use 2 stays with the existing resume library selector", async () => {
  const ctx = makeRoute()
  assert.equal(await ctx.route("text", message("Use 2")), "tailor")
  assert.deepEqual(ctx.handled, [])
})

test("kompas and revert do not fall into resume tailoring on channel outage", async () => {
  for (const cmd of ["kompas", "revert", " KOMPAS "]) {
    const ctx = makeRoute({ fail: true })
    assert.equal(await ctx.route("text", message(cmd)), "sent")
    assert.equal(ctx.sent.length, 1)
    assert.match(ctx.sent[0], /Kompas is temporarily unavailable/)
    assert.doesNotMatch(ctx.sent[0], /SENSITIVE-EXCEPTION/)
  }
})

test("ordinary resume job descriptions retain their existing fallback", async () => {
  const ctx = makeRoute({ fail: true })
  const question = "Security Analyst role: review endpoint alerts and manage vulnerabilities"
  assert.equal(await ctx.route("text", message(question)), "tailor")
  assert.deepEqual(ctx.handled, [question])
  assert.deepEqual(ctx.sent, [])
})
