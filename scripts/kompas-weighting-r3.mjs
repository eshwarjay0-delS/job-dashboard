#!/usr/bin/env node
// r3 weighting measurement (29 Oct 2026). OFFLINE retrieval only, NOT live answer quality. Does the behavior 7
// question-kind boost put the right passage first more often? Each question names the passage a good answer leads on.
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const R = await import(pathToFileURL(fileURLToPath(new URL("../src/lib/kompasSourceRetrieval.ts", import.meta.url))).href)
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-weighting-sources.json", import.meta.url), "utf8"))
const DOCS = R.sourceDocs(S)
export const CASES = [
  ["leadership", "How did you lead the team on vulnerability management?", "Led a team of six engineers"],
  ["leadership", "How do you grow a team of analysts?", "Mentored three analysts"],
  ["leadership", "How did you manage the security budget and hiring?", "Managed the security budget"],
  ["leadership", "How do you work with executives on risk?", "weekly risk review with the CISO"],
  ["leadership", "Tell me how you led the firewall migration.", "migration of firewall rules into Terraform"],
  ["leadership", "How did you lead key rotation?", "cloud key rotation program"],
  ["leadership", "How do you influence product owners on risk?", "weekly risk review"],
  ["leadership", "How did you manage on-call for analysts?", "Mentored three analysts into on-call"],
  ["leadership", "How did you lead the vulnerability scanner work?", "Led a team of six engineers"],
  ["leadership", "How did you mentor someone struggling on on-call?", "paired with them for a month"],
  ["behavioral", "Tell me about a time you disagreed with a product lead.", "disagreed with the product lead"],
  ["behavioral", "Tell me about a mistake you made in a firewall change.", "made a mistake in a firewall change"],
  ["behavioral", "Give me an example of work you are proud of.", "proud of the vulnerability management pipeline"],
  ["behavioral", "Describe a situation with a conflict over a critical finding.", "disagreed"],
  ["behavioral", "Tell me about a time an analyst struggled on on-call.", "paired with them for a month"],
  ["behavioral", "Tell me about a time a change blocked payroll traffic.", "blocked payroll traffic"],
  ["behavioral", "Give me an example of a failure and what you learned.", "made a mistake"],
  ["behavioral", "Tell me about a time you pushed back on shipping.", "feature flag"],
  ["technical", "How do you deduplicate scanner findings?", "deduplicate scanner findings"],
  ["technical", "How did you integrate the vulnerability scanner with Jira?", "scanner integration with Jira"],
  ["technical", "How do you detect suspicious OAuth consent grants?", "OAuth consent grants"],
  ["technical", "How do you reduce EDR false positives?", "Tuned EDR alerts"],
  ["technical", "How do you harden a CI pipeline?", "signed builds and secret scanning"],
  ["technical", "How do you review IAM policy changes?", "IAM policy changes"],
  ["technical", "How do you rotate cloud keys across AWS accounts?", "cloud key rotation program"],
  ["technical", "How do you manage firewall rules in Terraform?", "firewall rules into Terraform"],
  ["technical", "How do you write breach notification runbooks?", "breach notification runbooks"],
  ["technical", "How do you route findings to owners?", "scanner integration with Jira"],
]
export function measure(kindBoost) {
  const by = {}
  for (const [kind, q, gold] of CASES) {
    const r = R.retrievePassages(q, DOCS, 4, { kindBoost })
    const b = (by[kind] ||= { n: 0, top1: 0, top4: 0 })
    b.n++; b.top1 += r.passages[0]?.text.includes(gold) ? 1 : 0; b.top4 += r.passages.some((p) => p.text.includes(gold)) ? 1 : 0
  }
  return by
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const on of [false, true]) {
    const by = measure(on)
    console.log(`OFFLINE weighting ${on ? "ON (as shipped in r2)" : "OFF"}: ` + Object.entries(by).map(([k, v]) => `${k} right passage first ${v.top1}/${v.n}, in top 4 ${v.top4}/${v.n}`).join("; "))
  }
  const kinds = CASES.map(([k, q]) => `${k}->${R.questionKind(q)}`).filter((x) => { const [a, b] = x.split("->"); return a !== b })
  console.log(`question-kind label disagreements with the fixture's labels: ${kinds.length}/${CASES.length} ${kinds.join(", ")}`)
}
