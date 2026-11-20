// Offline adversarial clarifier cases. Does not change the clarifier.
// Points at PR #467 when REPO is that checkout. Otherwise uses this tree.
// A failure is a finding. Exit 0 so the report can be read either way.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = process.env.REPO || fileURLToPath(new URL("..", import.meta.url))
const { answerAside } = await import(`${root}/src/lib/kompasAnswerAside.ts`)
const fx = JSON.parse(readFileSync(new URL("./fixtures/clarifier-adversarial.json", import.meta.url), "utf8"))
const rx = (s) => new RegExp(s, "im")
const STOP = new Set("do you mean just okay start with then about would should answer first specific piece like overall whole part side this that they them have been were your what when where which there from into over also only more most some than tell walk right sorry wait hold actually never mind give second camera froze the and for how who did does can could not but its it's yes one".split(" "))

function contentWords(text) {
  return String(text || "").toLowerCase().match(/[a-z][a-z0-9+#-]{3,}/g) || []
}

function fromQuestion(clarifier, question) {
  const bag = new Set(contentWords(question))
  const missing = []
  for (const word of contentWords(clarifier)) {
    if (STOP.has(word)) continue
    const stem = word.endsWith("s") && word.length > 4 ? word.slice(0, -1) : word
    if (![...bag].some((have) => have === word || have === stem || have.startsWith(stem) || stem.startsWith(have))) missing.push(word)
  }
  return missing
}

const by = {}
const fails = []
for (const [i, t] of fx.fixtures.entries()) {
  const who = t.category === "candidate_speech" ? "You" : "Them"
  const transcript = [...t.prior_turns, `${who}: ${t.question}`].join("\n")
  const a = answerAside({ question: t.question, transcript, resume: t.resume_snippet })
  const qs = a.questions || []
  const say = [...(a.boosters || []), a.sayNow || ""].filter(Boolean)
  const why = []
  const clarifier = qs.join(" ")
  if (t.expect === "none" && qs.length) why.push("clarified when it should stay silent")
  if (t.expect === "clarify" && !qs.length) why.push("no clarifier")
  if (qs.length > 2) why.push(">2 clarifiers")
  for (const m of t.must_mention) if (qs.length && !rx(m).test(clarifier)) why.push(`missing /${m}/`)
  // The parent suite checks must_not on clarifier plus Say this. This rule is about the clarifier.
  // A resume line in Say this is not a clarifier. global_must_not still covers the whole panel.
  for (const m of t.must_not) if (m === ".+" ? clarifier.trim() : rx(m).test(clarifier)) why.push(m === ".+" ? "clarifier not empty" : `clarifier has /${m}/`)
  const panel = [...qs, ...say].join("\n")
  for (const m of fx.global_must_not) if (rx(m).test(panel)) why.push(`global /${m}/`)
  if (t.from_question && qs.length) {
    const missing = fromQuestion(qs.join(" "), t.question)
    if (missing.length) why.push(`not from live question: ${missing.join(", ")}`)
  }
  const b = (by[t.category] ||= { pass: 0, total: 0 })
  b.total++
  const pass = !why.length
  if (pass) b.pass++
  else fails.push({ i, cat: t.category, q: t.question, expect: t.expect, why, qs, say })
  console.log(`${pass ? "PASS" : "FAIL"} ${String(i).padStart(2, "0")} ${t.category.padEnd(18)} ${t.expect.padEnd(8)} ${t.question}`)
  if (!pass) {
    console.log(`     why: ${why.join("; ")}`)
    if (qs.length) console.log(`     clarifier: ${qs.join(" | ")}`)
  }
}
let p = 0, n = 0
console.log("")
for (const [k, v] of Object.entries(by)) {
  console.log(`${k.padEnd(22)} ${v.pass}/${v.total}`)
  p += v.pass
  n += v.total
}
console.log(`TOTAL ${p}/${n}`)
const out = { head: process.env.CLARIFIER_HEAD || process.env.REPO || "this-tree", by, pass: p, total: n, fails }
try { writeFileSync(new URL("../ops/brain/clarifier-adversarial-results.json", import.meta.url), JSON.stringify(out, null, 1) + "\n") } catch {}
