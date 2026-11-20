// Offline adversarial clarifier cases. Does not change the clarifier.
// REPO points at the tree whose answerAside should be judged (default: this repo).
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = process.env.REPO || fileURLToPath(new URL("..", import.meta.url))
const { answerAside } = await import(`${root}/src/lib/kompasAnswerAside.ts`)
const fx = JSON.parse(readFileSync(new URL("./fixtures/clarifier-adversarial.json", import.meta.url), "utf8"))
const resume = fx.resume_snippet
const rx = (s) => new RegExp(s, "im")
const by = {}
const fails = []
const rows = []

for (const [i, t] of fx.fixtures.entries()) {
  const who = t.category === "candidate_speech" ? "You" : "Them"
  const transcript = [...(t.prior_turns || []), `${who}: ${t.question}`].join("\n")
  const a = answerAside({ question: t.question, transcript, resume: t.resume_snippet || resume, jd: fx.jd })
  const qs = a.questions || []
  const say = [...(a.boosters || []), a.sayNow || ""].filter(Boolean)
  const why = []
  if (t.expect === "none" && qs.length) why.push("clarified when the live question does not support one")
  if (t.expect === "clarify" && !qs.length) why.push("no clarifier")
  if (qs.length > 2) why.push(">2 clarifiers")
  for (const m of t.must_mention || []) if (qs.length && !rx(m).test(qs.join(" "))) why.push(`missing /${m}/`)
  const panel = [...qs, ...say].join("\n")
  // ".+" means the whole box. Other must_not patterns judge the clarifier only.
  // A Say-this line may quote the resume; that is not a clarifier.
  for (const m of t.must_not || []) {
    if (m === ".+") { if (panel.trim()) why.push("panel not empty"); continue }
    if (rx(m).test(qs.join(" "))) why.push(`has /${m}/`)
  }
  for (const m of fx.global_must_not || []) if (rx(m).test(panel)) why.push(`global /${m}/`)
  const b = (by[t.category] ||= { pass: 0, total: 0 })
  b.total++
  const pass = !why.length
  if (pass) b.pass++
  else fails.push({ i, cat: t.category, q: t.question, why, qs, say })
  rows.push({ i, cat: t.category, expect: t.expect, pass, why, qs })
}

let p = 0
let n = 0
for (const [k, v] of Object.entries(by)) {
  console.log(`${k.padEnd(26)} ${v.pass}/${v.total}`)
  p += v.pass
  n += v.total
}
console.log(`TOTAL ${p}/${n}`)
for (const f of fails) console.log(`FAIL ${f.i} [${f.cat}] ${f.q}\n  ${f.why.join("; ")}\n  qs: ${JSON.stringify(f.qs)}`)
const out = process.env.OUT
if (out) writeFileSync(out, JSON.stringify({ total: `${p}/${n}`, by, fails, rows }, null, 1))
