#!/usr/bin/env node
// r4 weighting measurement (29 Oct 2026). OFFLINE retrieval only, NOT live answer quality.
// Compares the question-kind boost OFF, ON (r2/r3 strength) and as a tiebreaker (r4), on the r3 28-question fixture and
// a new 64-question fixture. "Right passage first" means the passage a good answer leads on is ranked first.
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const R = await import(pathToFileURL(fileURLToPath(new URL("../src/lib/kompasSourceRetrieval.ts", import.meta.url))).href)
const W3 = await import("./kompas-weighting-r3.mjs")
const S4 = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-weighting-sources-r4.json", import.meta.url), "utf8"))
const S3 = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-weighting-sources.json", import.meta.url), "utf8"))
export const CASES_R4 = [
  ["leadership", "How did you lead a team of nine across time zones?", "group of nine"],
  ["leadership", "How do you hire security engineers?", "Hired four engineers"],
  ["leadership", "How did you build an interview loop?", "structured interview loop"],
  ["leadership", "How do you present security to the board?", "board risk committee"],
  ["leadership", "How did you set the security roadmap?", "yearly security roadmap"],
  ["leadership", "How did you manage the tooling budget?", "tooling budget"],
  ["leadership", "How do you cut vendor spend?", "overlapping vendor contracts"],
  ["leadership", "How do you mentor senior engineers toward staff?", "Mentored two senior engineers"],
  ["leadership", "How did you lead the ransomware response?", "ransomware outbreak"],
  ["leadership", "How do you work with the CTO on priorities?", "roadmap with the CTO"],
  ["leadership", "How did you lead tabletop exercises with legal?", "tabletop exercises"],
  ["leadership", "How do you manage a team across two time zones?", "two time zones"],
  ["leadership", "How did you grow engineers into staff roles?", "staff roles"],
  ["leadership", "How do you influence executives to fund security?", "board risk committee"],
  ["leadership", "How did you manage engineers who clashed over ownership?", "single change owner rule"],
  ["leadership", "How did you handle on-call burnout on your team?", "split the rotation"],
  ["leadership", "How did you lead the MFA rollout?", "FIDO2"],
  ["leadership", "How do you manage vendor risk for SaaS tools?", "vendor risk questionnaire"],
  ["leadership", "How did you lead hiring for four engineers?", "Hired four engineers"],
  ["leadership", "How do you report risk to the board?", "board risk committee"],
  ["behavioral", "Tell me about a time you disagreed with the CTO.", "disagreed with the CTO"],
  ["behavioral", "Tell me about a mistake with a patch deadline.", "missed a patch deadline"],
  ["behavioral", "Describe a conflict between two engineers.", "clashed over who owned"],
  ["behavioral", "Tell me about a time you pushed back on a launch.", "pushed back on launching"],
  ["behavioral", "What is your biggest weakness?", "say yes to every review"],
  ["behavioral", "Why do you want this role?", "build a security program"],
  ["behavioral", "What are you proud of?", "proud of the ransomware recovery"],
  ["behavioral", "Give me an example of a failure and what you learned.", "missed a patch deadline"],
  ["behavioral", "Tell me about a time someone on your team was burning out.", "burning out"],
  ["behavioral", "Tell me about a time you owned a mistake.", "owned it in the incident review"],
  ["behavioral", "Give me an example of standing firm on a deadline.", "kept the date"],
  ["behavioral", "Describe a situation where you mediated a dispute.", "mediated"],
  ["behavioral", "Tell me about a time a store app launch was at risk.", "store app"],
  ["behavioral", "Tell me about a time you delayed a launch for security.", "moved launch by one week"],
  ["behavioral", "What motivates you in security work?", "build a security program"],
  ["behavioral", "Tell me about a time you disagreed about MFA timing.", "delaying the MFA rollout"],
  ["behavioral", "Give me an example of delegating work.", "delegate the routine ones"],
  ["behavioral", "Tell me about a recovery you are proud of.", "warehouses were shipping again"],
  ["behavioral", "Describe a time you missed a deadline.", "missed a patch deadline"],
  ["behavioral", "Tell me about a time you protected someone from burnout.", "added a secondary"],
  ["technical", "How do you block live credentials in commits?", "secrets scanning gate"],
  ["technical", "How do you segment a point-of-sale network?", "network segmentation"],
  ["technical", "How do you roll out phishing-resistant MFA?", "FIDO2"],
  ["technical", "How do you detect lateral movement over SMB?", "Sigma rules"],
  ["technical", "How do you report patch compliance across Windows servers?", "patch compliance reports"],
  ["technical", "How do you manage web application firewall rules as code?", "web application firewall"],
  ["technical", "How do you scan container images in the pipeline?", "Trivy"],
  ["technical", "How do you review SaaS vendor risk?", "vendor risk questionnaire"],
  ["technical", "How do you manage firewall zones for retail stores?", "firewall zones"],
  ["technical", "How do you write detections for WMI abuse?", "WMI"],
  ["technical", "How do you automate reports with PowerShell?", "PowerShell"],
  ["technical", "How do you test WAF rule changes?", "automated tests"],
  ["technical", "How do you stop secrets leaking in GitHub Actions?", "GitHub Actions"],
  ["technical", "How do you use VLANs for segmentation?", "VLANs"],
  ["technical", "How do you protect administrator accounts?", "all administrators"],
  ["technical", "How do you contain ransomware in a warehouse network?", "ransomware outbreak"],
  ["technical", "How do you manage patching for 4,000 servers?", "4,000 Windows servers"],
  ["technical", "How do you add image scanning to a build?", "container image scanning"],
  ["technical", "How do you manage FIDO2 keys for admins?", "FIDO2"],
  ["technical", "How do you run a tabletop exercise?", "tabletop exercises"],
  ["technical", "How do you design firewall zones for point-of-sale devices?", "point-of-sale fleet"],
  ["technical", "How do you write Sigma rules?", "Sigma rules"],
  ["technical", "How do you check a weekly patch status?", "weekly patch check"],
  ["technical", "How do you manage credentials found by scanning?", "live credentials"],
]
export function measure(cases, src, kindBoost) {
  const docs = R.sourceDocs(src)
  const by = { all: { n: 0, top1: 0 } }
  for (const [kind, q, gold] of cases) {
    const r = R.retrievePassages(q, docs, 4, { kindBoost })
    const hit = r.passages[0]?.text.includes(gold) ? 1 : 0
    for (const b of [(by[kind] ||= { n: 0, top1: 0 }), by.all]) { b.n++; b.top1 += hit }
  }
  return by
}
export const labelMisses = (cases) => cases.filter(([k, q]) => R.questionKind(q) !== k).map(([k, q]) => `${k}->${R.questionKind(q)}: ${q}`)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [name, cases, src] of [["r3 28-question", W3.CASES, S3], ["r4 64-question", CASES_R4, S4]]) {
    for (const mode of [false, "full", true]) {
      const by = measure(cases, src, mode)
      console.log(`OFFLINE ${name} weighting ${mode === false ? "OFF" : mode === "full" ? "FULL (r2/r3 strength)" : "TIEBREAKER (r4 default)"}: right passage first ${by.all.top1}/${by.all.n} (` + Object.entries(by).filter(([k]) => k !== "all").map(([k, v]) => `${k} ${v.top1}/${v.n}`).join(", ") + ")")
    }
    const miss = labelMisses(cases)
    console.log(`  question-kind label misses: ${miss.length}/${cases.length}${miss.length ? " " + miss.join("; ") : ""}`)
  }
}
