// slice 10b: the page never paints a cached answer for a personal-logistics ask, shows the quiet line in the answer pane,
// and a typed compound card shows only the non-logistics part. The page keeps a copy of the server helper
// (src/lib/kompasRelevance.ts); this file proves the copy behaves identically, the same way the cut keeps parity.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { personalLogistics, withoutLogistics } from "../../src/lib/kompasRelevance.ts"
import { CUT_CASES } from "../kompas-cut-stress.mjs"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const server = readFileSync(new URL("../../src/lib/kompasRelevance.ts", import.meta.url), "utf8")
const block = () => {
  const a = app.indexOf("// personal-logistics parity: start"), b = app.indexOf("// personal-logistics parity: end")
  assert.ok(a > 0 && b > a, "app.js carries the parity block"); return app.slice(a, b)
}
const fn = (name, end) => { const a = app.indexOf(name); assert.ok(a > 0, name); return app.slice(a, app.indexOf(end, a)) }
const CORPUS = [
  "Salary?", "U.S. citizen?", "What is your notice period?", "When can you start?", "Why are you relocating?", "Where are you located?",
  "What is your current location?", "Tell me about yourself.", "Where did you work before Citi?", "What was your start date at Citi?",
  "How does rate limiting work?", "Explain the IP address allocation in your VPC design.", "Tell me about the data center relocation.",
  "What is your visa status and tell me about PAM.", "Are you open to relocation and how did you roll out CyberArk?",
  "What is your experience with Okta and your notice period?", "um so what is your experience with okta and um what is your notice period",
  "How do you design for high availability?", "Notice anything odd in the logs?", "Can you relocate the service to us-east?", "", "?",
].concat(CUT_CASES.map((c) => c[0]))

test("parity: the page's personalLogistics/withoutLogistics match the server helper", () => {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(block() + "\nthis.p = personalLogistics; this.w = withoutLogistics;", ctx)
  for (const q of CORPUS) { assert.equal(ctx.p(q), personalLogistics(q), q); assert.equal(ctx.w(q), withoutLogistics(q), q) }
  for (const name of ["PERSONAL_LOGISTICS", "NOT_PERSONAL", "PERSONAL_MOVE", "UNSPLIT_COMPOUND"]) {
    const line = (src) => (src.match(new RegExp("const " + name + " = (.*)")) || [])[1]
    assert.ok(line(server) && line(server) === line(block()), name + " regex is byte-identical")
  }
})
test("#2 the opening book key moves to v2 and the book never serves or builds a logistics answer", () => {
  assert.ok(!app.includes(":book:personal-evidence-v1") && (app.match(/:book:personal-evidence-v2/g) || []).length === 2)
  const ctx = { FSTOP: new Set(), book: { items: [] } }; vm.createContext(ctx)
  vm.runInContext(block() + fn("const bookWords", "async function readAnswerStream") + "\nthis.m = bookMatch; this.setItems = (i) => { book.items = i };", ctx)
  ctx.setItems([{ q: "What is your notice period?", depthKey: "k", text: "Two weeks." }, { q: "How did you roll out CyberArk PAM?", depthKey: "k", text: "PAM." }])
  assert.equal(ctx.m("What is your notice period?", "k"), null, "logistics: no book answer")
  assert.equal(ctx.m("How did you roll out CyberArk PAM?", "k").text, "PAM.", "control: technical still served")
  assert.match(fn("async function buildBook", "\n}\n"), /\.filter\(\(?q\)? => !personalLogistics\(q\)\)/, "prep logistics questions are not pre-answered")
})
test("#2 anchors never paint a cached answer for a logistics ask", () => {
  const ctx = { window: { KompasLevels: { textFor: () => "cached text" }, KompasDiamond: { plan: () => ({ ready: true, otherReady: true }) } },
    desktopResponses: () => false, askingLevel: () => 1, sayAnswer: (t) => t, liveConfig: () => ({ mode: "t" }), cards: [], idx: 0, renderCard() {}, fillAnchor() {} }
  vm.createContext(ctx); vm.runInContext(block() + fn("function paintFromAnchors", "\n// What went wrong") + "\nthis.paint = paintFromAnchors;", ctx)
  assert.equal(ctx.paint({ question: "When can you start?", anchors: {} }), false)
  assert.equal(ctx.paint({ question: "Tell me about PAM", anchorQ: "Why are you relocating?", anchors: {} }), false)
  const ok = { question: "How did you roll out CyberArk?", anchors: {} }
  assert.equal(ctx.paint(ok), true); assert.equal(ok.answer, "cached text")
})
test("#5 the answer pane shows the muted one-line note on a skipped logistics card", () => {
  const r = fn("function renderCard()", "\nfunction wrapWords")
  assert.match(r, /c\.meta === "Personal logistics, not answered" && !lines\.length/)
  assert.match(r, /className = "skipnote"/); assert.match(r, /textContent = "Personal logistics, not answered"/)
})
test("#4 a typed compound card shows only the non-logistics part; the original is kept for logs", () => {
  const press = app.slice(app.indexOf("const spans = splitDistinctAsks(heardOnly"), app.indexOf("if (fromAuto) return;\n    const c = cards[idx];"))
  assert.match(press, /const shown = heardOnly \? span : \(withoutLogistics\(span\) \|\| span\)/)
  assert.match(press, /const shownSaid = heardOnly \? said : \(withoutLogistics\(said\) \|\| said\)/)
  assert.match(press, /card\.original = /)
  assert.match(fn("const logAnswer =", "\n"), /original: card\.original/)
})
