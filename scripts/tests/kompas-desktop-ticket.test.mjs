import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"

const app = fs.readFileSync(path.resolve("public/kompas/app.js"), "utf8")
const issue = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/route.ts"), "utf8")
const redeem = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/redeem/route.ts"), "utf8")

test("loaded resume and JD are never placed in the Windows launcher URL", () => {
  const code = app.slice(app.indexOf("function packSession(s) {"), app.indexOf("let lastDesktopHandoff ="))
  assert.ok(code.includes("function prepareDesktopSession(s)"), "ticket issue route must exist")
  assert.ok(code.includes('fetch("/api/kompas/desktop-handoff"'), "full session must go to same-origin HTTPS route")
  assert.ok(code.includes('window.location.assign(url)'), "short protocol link must use browser navigation")
  assert.ok(code.includes('"marketfit-kompas://open?ticket=" + ticket'), "short protocol ticket only")
  assert.ok(!code.includes('window.location.assign(packSession(s))'), "never launch the old oversized URL")
  const globals = {
    location: { pathname: "/kompas" },
    supabaseAccessToken: () => "a".repeat(600),
    supabaseSession: () => ({ refresh_token: "b".repeat(600), expires_at: 100 }),
    btoa: s => Buffer.from(s, "binary").toString("base64"), unescape, encodeURIComponent,
    Date, fetch() { throw Error("not called") }, window: {}, atob: s => Buffer.from(s, "base64").toString("binary"),
  }
  vm.runInNewContext(code + "\nthis.getPack = packSession;", globals)
  const big = globals.getPack({ id: "saved", role: "Security Engineer", resume: "R".repeat(8000), jd: "J".repeat(6000) })
  assert.ok(big.length > 2046, "reproduce Windows protocol length bug")
  assert.ok(("marketfit-kompas://open?ticket=" + "A".repeat(43)).length < 200)
})

test("only a signed-in user can issue a short-lived ticket", () => {
  assert.match(issue, /authenticatedUser\(request\)/)
  assert.match(issue, /randomBytes\(32\)/)
  assert.match(issue, /createHash\("sha256"\)/)
  assert.match(issue, /Date\.now\(\) \+ 300_000/)
  assert.match(issue, /session\.site !== "marketfit"/)
  assert.ok(!issue.includes("console.log"))
})

test("ticket redeem is atomic, single-use and not client-readable", () => {
  assert.match(redeem, /claim_kompas_desktop_handoff/)
  assert.match(redeem, /createServiceClient/)
  assert.match(redeem, /status: 410/)
  assert.match(redeem, /Cache-Control.*no-store/)
})

test("ten representative instruction formats survive the desktop issue route", () => {
  const start = issue.indexOf("function instructionText(value: unknown): string | null {")
  const end = issue.indexOf("// Browser-local session details", start)
  assert.ok(start >= 0 && end > start, "normalization helper must exist")
  const code = issue.slice(start, end).replace(
    "function instructionText(value: unknown): string | null {",
    "function instructionText(value) {",
  )
  const ctx = vm.createContext({ JSON, String, Number, Object, Array })
  vm.runInContext(code + "\nthis.normalize = instructionText;", ctx)
  const cases = [
    ["natural spoken response", "natural spoken response"],
    [null, ""],
    [undefined, ""],
    [false, "false"],
    [0, "0"],
    [["natural", "grounded"], '["natural","grounded"]'],
    [{ voice: "natural", level: "engineer" }, '{"voice":"natural","level":"engineer"}'],
    [{ rules: ["keep evidence", "cover trade-offs"] }, '{"rules":["keep evidence","cover trade-offs"]}'],
    [{ nested: { sections: ["intro", "technical"] } }, '{"nested":{"sections":["intro","technical"]}}'],
    ["🛡️ résumé: ".repeat(22000), "🛡️ résumé: ".repeat(22000)],
  ]
  for (const [input, expected] of cases) {
    ctx.input = input
    assert.equal(vm.runInContext("normalize(input)", ctx), expected)
  }
  ctx.input = Infinity
  assert.equal(vm.runInContext("normalize(input)", ctx), null)
})

test("desktop preserves unrestricted long text up to the overall platform envelope", () => {
  assert.match(issue, /const MAX_BYTES = 4_000_000/)
  assert.match(issue, /const LARGE_TEXT_FIELDS = \["resume", "jd", "documents", "instructions"\]/)
  assert.match(issue, /const allowed = new Set\(\[\.\.\.Object\.keys\(FIELD_LIMITS\), \.\.\.LARGE_TEXT_FIELDS/)
  assert.match(issue, /for \(const field of LARGE_TEXT_FIELDS\)/)
  assert.match(issue, /field === "instructions" \? instructionText\(session\[field\]\) : session\[field\]/)
  assert.ok(!/instructions:\s*(?:20000|120000)/.test(issue), "old 20k/120k instruction limits are removed")
  assert.ok(!/jd:\s*120000|resume:\s*120000|documents:\s*120000/.test(issue), "web text fields are not independently capped")
  assert.match(issue, /Buffer\.byteLength\(raw, "utf8"\) > MAX_BYTES/, "overall byte safeguard remains")
  assert.match(issue, /session\.site !== "marketfit"/, "session origin check remains")
})


test("a redeemed desktop ticket is never reused on relaunch or as a retry link", async () => {
  const start = app.indexOf("let desktopTicketCache =")
  const end = app.indexOf("let lastDesktopHandoff =", start)
  assert.ok(start > 0 && end > start)
  const issued = [], launched = [], links = []
  const status = { classList: { remove() {} }, appendChild(node) { links.push(node) }, textContent: "" }
  const ctx = {
    packSession: s => "marketfit-kompas://open?d=" + Buffer.from(JSON.stringify({id:s.id,site:"marketfit"}),"utf8").toString("base64url"),
    atob: s => Buffer.from(s,"base64url").toString("binary"), escape, decodeURIComponent,
    Date, JSON, String, Promise,
    fetch: async (_url, opts) => {
      issued.push(JSON.parse(opts.body).session)
      return {ok:true,json:async()=>({ok:true,ticket:String(issued.length).padStart(43,"A")})}
    },
    window: {location:{assign(url) {launched.push(url)}}},
    document: {createElement(){return {style:{},onclick:null,href:"",textContent:""}},createTextNode(t){return {textContent:t}}},
    $: id => id === "cnDeskMiss" ? status : {classList:{remove(){}}},
  }
  vm.runInNewContext(app.slice(start,end)+"\nthis.preview = prepareDesktopSession; this.launch = launchInstalled;", ctx)
  const s = {id:"s123",role:"Security Engineer",resume:"full resume",instructions:"long instructions"}
  await ctx.preview(s)
  ctx.launch(s)
  assert.equal(launched.length,1)
  assert.ok(launched[0].endsWith(String(1).padStart(43,"A")))
  // A second Connect must request another ticket, never use the already-redeemed one.
  ctx.launch(s)
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(issued.length,2)
  assert.ok(launched[1].endsWith(String(2).padStart(43,"A")))
  const retry = links.filter(x=>x&&typeof x.onclick==="function").at(-1)
  assert.ok(retry)
  assert.equal(retry.href,"#","a previously attempted ticket must not be left in a clickable link")
  await retry.onclick({preventDefault(){}})
  await new Promise(resolve=>setImmediate(resolve))
  assert.ok(retry.href.endsWith(String(3).padStart(43,"A")),"retry prepares another unused ticket")
})

test("desktop handoff updates existing account session without losing transcript or persisting tokens", async () => {
  const start = app.indexOf("let lastDesktopHandoff =")
  const end = app.indexOf("window.kompasDesktop?.takeSession?.()",start)
  assert.ok(start>0 && end>start)
  const existing={id:"s777",resume:"old resume",jd:"old JD",instructions:"old rules",transcripts:[{key:"s777:tx:1",at:100}],endedAt:101,token:"stale-secret"}
  let stored=[existing], opened=null
  const ctx={
    Date:{now:()=>10000},
    window:{kompasDesktop:{}},
    accountSessionSync:{refresh:async()=>true},
    LS:{get:()=>stored,set(_key,v){stored=v}},
    sessions:stored,
    launchCopilot:s=>{opened=s},
    $:()=>({classList:{add(){},contains(){return false}},click(){}}),
  }
  vm.runInNewContext(app.slice(start,end)+"\nthis.openHandoff=openHandedSession;",ctx)
  await ctx.openHandoff({id:"s777",resume:"new resume",jd:"new JD",instructions:"all new rules",transcripts:[{key:"s777:tx:2",at:102}],token:"bearer-secret",refreshToken:"refresh-secret",tokenExp:1234})
  assert.equal(stored.length,1)
  assert.equal(stored[0].resume,"new resume")
  assert.equal(stored[0].jd,"new JD")
  assert.equal(stored[0].instructions,"all new rules")
  assert.deepEqual(Array.from(stored[0].transcripts,t=>t.key),["s777:tx:1","s777:tx:2"])
  assert.equal(stored[0].endedAt,101)
  for (const key of ["token","refreshToken","tokenExp"]) {
    assert.equal(Object.hasOwn(stored[0],key),false,key+" must never enter device session storage")
  }
  assert.equal(opened.instructions,"all new rules")
});
