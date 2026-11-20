// Runs PR #467's answerAside() against clarifier-fixtures.json. Offline, no keys.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const root = process.env.REPO || fileURLToPath(new URL("..", import.meta.url))
const { answerAside } = await import(`${root}/src/lib/kompasAnswerAside.ts`)
const fx = JSON.parse(readFileSync(new URL("./fixtures/clarifier-fixtures.json", import.meta.url), "utf8"))
const rx = (s) => new RegExp(s, "im")
const by = {}; const fails = []
for (const [i, t] of fx.fixtures.entries()) {
  const who = t.category === "candidate_speech" ? "You" : "Them"
  const transcript = [...t.prior_turns, `${who}: ${t.question}`].join("\n")
  const a = answerAside({ question: t.question, transcript, resume: t.resume_snippet })
  const qs = a.questions || []; const say = [...(a.boosters || []), a.sayNow || ""].filter(Boolean)
  const why = []
  if (t.expect === "none" && qs.length) why.push("clarified when it should stay silent")
  if (t.expect === "clarify" && !qs.length) why.push("no clarifier")
  if (qs.length > 2) why.push(">2 clarifiers")
  for (const m of t.must_mention) if (qs.length && !rx(m).test(qs.join(" "))) why.push(`missing /${m}/`)
  const panel = [...qs, ...say].join("\n")
  for (const m of t.must_not) if (m === ".+" ? panel.trim() : rx(m).test(panel)) why.push(m === ".+" ? "panel not empty" : `has /${m}/`)
  for (const m of fx.global_must_not) if (rx(m).test(panel)) why.push(`global /${m}/`)
  const b = (by[t.category] ||= { pass: 0, total: 0 }); b.total++
  if (!why.length) b.pass++; else fails.push({ i, cat: t.category, q: t.question, why, qs, say })
}
let p = 0, n = 0
for (const [k, v] of Object.entries(by)) { console.log(`${k.padEnd(26)} ${v.pass}/${v.total}`); p += v.pass; n += v.total }
console.log(`TOTAL ${p}/${n}`)
writeFileSync(new URL("./clarifier-results.json", import.meta.url), JSON.stringify({ by, fails }, null, 1))
