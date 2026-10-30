// Lens logistics (29 Oct 2026, owner rule 11:26 PM CT): the opener and the lens prompt layer never offer, speak or add
// logistics (visa, work authorization, citizenship, pay, relocation, address, current location, start date, notice,
// availability). Reuses Answer Quality's question helper (kompasLogistics.ts, a9b91ccc) and Dossier's phrase list
// (bannedLogistics, dossier-engine-master 79f91b38). Offline. Written before the code.
import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import * as O from "../../src/lib/kompasOpener.ts"
import * as A from "../../src/lib/kompasAudience.ts"
import * as D from "../../src/lib/kompasDesktopResponse.ts"

const BULLET = "Led SailPoint access certification campaigns, including quarterly and ad-hoc reviews, remediation tracking, and audit evidence generation."
const table = (texts) => O.buildOpenerTable(texts.map((text, i) => ({ id: "r" + i, sourceDoc: "resume", category: "experience-story", text, status: "sourced" })), { resume: texts.join("\n") })
const pick = (t, q) => O.pickOpener(t, q, { passages: [{ id: "r0", proves: "experience" }] }, undefined, () => true)

const LOGISTICS_QS = [
  "Tell me about a time you led a review, and are you authorized to work in the US?",
  "Tell me about your experience and when can you start?",
  "Walk me through a project you led. Also, what are your salary expectations?",
  "Tell me about yourself. Where are you based?",
  "Have you led certification campaigns? Do you need visa sponsorship?",
  "Tell me about a time you led a team. Are you open to relocation?",
  "Tell me about your last role and what is your notice period?",
  "Tell me about yourself and your current location.",
  "Describe a project you led, and are you a U.S. citizen?",
  "Tell me about a time you led an audit. When would you be available to start?",
]
const TECH_QS = [
  "Tell me about a time you led work to address the root cause of a recurring access issue.",
  "Tell me about a time you had to address audit findings in a certification campaign.",
  "Walk me through how you led reviews when data location rules applied.",
  "Tell me about a time you led access certification campaigns.",
]

test("a question with any logistics ask gets no opener, even with a matched, approved passage", () => {
  const { table: t } = table([BULLET])
  for (const q of LOGISTICS_QS) assert.equal(pick(t, q), null, q)
})
test("technical questions that merely contain 'address' or 'location' still get the opener", () => {
  const { table: t } = table([BULLET])
  for (const q of TECH_QS) assert.ok(pick(t, q), q)
})
test("a resume bullet carrying logistics words is never an opener (refused when the table is built)", () => {
  const bad = ["Relocated to Dallas and supported SOC operations on-site.", "Sponsored on an H-1B visa while leading SOC triage.", "Negotiated salary and supported IAM reviews."]
  const { table: t, refused } = table(bad)
  assert.equal(t["experience-story"].length, 0)
  assert.equal(refused.length, bad.length)
  for (const r of refused) assert.match(r.reason, /logistics/)
})
test("technical uses stay allowed: 'address the root cause' and 'relocated the pipeline' bullets are kept", () => {
  const ok = ["Worked with engineers to address the root cause of repeat IAM incidents.", "Relocated the log pipeline to a dedicated Splunk index.",
    "Administer Azure Entra ID and support hybrid identity integrations with Active Directory.", "Lead and support cloud security monitoring and incident response across AWS, Azure, and hybrid environments."]
  assert.equal(table(ok).table["experience-story"].length, 4)
  assert.deepEqual(O.logisticsPhrases("Are you open to a hybrid schedule?"), ["hybrid"])
})
test("no lead-in carries logistics", () => {
  for (const l of O.LEAD_INS) assert.deepEqual(O.logisticsPhrases(l), [], l)
})
test("no lens prompt block mentions logistics, for any audience or depth", () => {
  const blocks = [A.REALISM, A.OWN_THE_ROOM, A.DOSSIER_NUMBERS, D.EXPLAIN_MODES, ...A.RUNGS, ...Object.values(A.LENS).flatMap((l) => [l.label, l.opens, l.goes, l.avoids])]
  for (const aud of ["hr", "technical_hr", "engineer", "practitioner", "architect", "developer", "director", "lead", "hiring_manager"])
    for (const q of ["Tell me about yourself.", "Explain this simply.", "Go deeper on that."]) blocks.push(A.lensBlock(aud, q))
  for (const b of blocks) assert.deepEqual(O.logisticsPhrases(b), [], b.slice(0, 80))
})
test("the lens adds nothing to a logistics ask: lensBlock is empty (the service's quiet reply stands)", () => {
  for (const q of ["When can you start?", "What are your salary expectations?", "Where are you based?"]) assert.equal(A.lensBlock("director", q), "", q)
  assert.notEqual(A.lensBlock("director", "Tell me about yourself."), "")
})
// Same phrase list as Dossier's bannedLogistics (79f91b38). Read from Dossier's repo, no hand comparison.
const DOSSIER = process.env.KOMPAS_DOSSIER_REPO || "/workspace/dossier-work"
const dossierList = existsSync(DOSSIER) ? (() => { try { return execFileSync("git", ["-C", DOSSIER, "show", "79f91b38:src/lib/dossierBlueprint.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) } catch { return null } })() : null
test("the phrase list is Dossier's bannedLogistics list, unchanged", { skip: dossierList ? false : `SKIPPED (not a pass): ${DOSSIER} at 79f91b38 absent` }, () => {
  const grab = (s) => s.slice(s.indexOf("const LOGISTICS: RegExp[] = ["), s.indexOf("]\n", s.indexOf("const LOGISTICS: RegExp[] = [")) + 1)
  assert.equal(grab(readFileSync(new URL("../../src/lib/kompasLogisticsPhrases.ts", import.meta.url), "utf8")), grab(dossierList))
})
