import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { getPack, learnFromAnswer, listPacks, ownerResumeForPack, packGrounding, OWNER_RESUME } from "../../src/lib/kompasPacks/index.ts"

const ROLE_TITLES = [
  "Senior Cybersecurity Engineer",
  "SOC Analyst",
  "IAM Engineer",
  "Security Architect",
  "Cloud Security Engineer",
  "Security Director",
]
const CATEGORY_TITLES = [
  "IAM (PAM/CyberArk, SailPoint, Okta, Entra ID)",
  "SOC",
  "Incident Response",
  "Endpoint (CrowdStrike, Defender)",
  "Cloud Security (Azure)",
  "AppSec (Fortify)",
  "Vulnerability Mgmt (Qualys, Nessus, Tanium)",
  "GRC",
  "Network Security (Palo Alto)",
  "Leadership",
]

test("seeded roles and categories load with an empty audio slot", () => {
  assert.deepEqual(listPacks("role").map((pack) => pack.title), ROLE_TITLES)
  assert.deepEqual(listPacks("category").map((pack) => pack.title), CATEGORY_TITLES)
  for (const pack of listPacks()) {
    assert.equal(getPack(pack.id)?.id, pack.id)
    assert.equal(pack.notebookLmUrl, "")
    assert.ok(pack.dossier.length > 80, pack.id)
    assert.ok(pack.mustMention.length >= 4, pack.id)
    assert.ok(pack.avoid.length >= 3, pack.id)
    assert.ok(pack.probes.length >= 3, pack.id)
    assert.ok(pack.checklist.length >= 4, pack.id)
    const blob = JSON.stringify(pack)
    assert.doesNotMatch(blob, /jayeshwar44/i, pack.id)
    assert.doesNotMatch(blob, /fortinet|fortigate|fortimanager|fortianalyzer/i, pack.id)
    assert.doesNotMatch(blob, /\bHaving\b/)
    assert.doesNotMatch(blob, /\b(?:I think|maybe|probably|might|happy to|let me know)\b/i, pack.id)
    for (const probe of pack.probes) assert.match(probe.answer, /\bI\b/, pack.id)
  }
})

test("owner resume for a pack replaces a Fortinet fallback and keeps a real resume", () => {
  assert.match(OWNER_RESUME, /eshwarjay05@gmail.com/)
  assert.doesNotMatch(OWNER_RESUME, /jayeshwar44|fortinet|fortigate/i)
  const iam = getPack("iam")
  assert.ok(iam)
  assert.match(ownerResumeForPack("FortiGate-VM on AWS", iam.id), /Citi Bank/)
  assert.match(ownerResumeForPack("", iam.id), /CVS Health/)
  assert.match(ownerResumeForPack("My uploaded resume from Citi", iam.id), /uploaded resume/)
  assert.match(ownerResumeForPack("FortiGate-VM", ""), /FortiGate/)
})

test("learned notes replace the same question and ride along in later grounding", () => {
  const pack = getPack("soc")
  assert.ok(pack)
  const first = learnFromAnswer([], {
    question: "How do you triage an alert?",
    answer: "I open the detection in Splunk, check the host in CrowdStrike, and write the ServiceNow ticket before I escalate.",
    level: "engineer",
    at: 10,
    must: pack.mustMention,
  })
  assert.equal(first.length, 1)
  assert.ok(first[0].missed.includes("Sentinel"))
  const second = learnFromAnswer(first, {
    question: "How do you triage an alert?",
    answer: "I open Splunk and Sentinel, name the host, write ServiceNow, and escalate when the account is still moving.",
    level: "director",
    at: 20,
    must: pack.mustMention,
  })
  assert.equal(second.length, 1)
  assert.equal(second[0].level, "director")
  assert.equal(second[0].missed.includes("Sentinel"), false)
  const grounding = packGrounding(pack, second, "")
  assert.match(grounding, /Learned from earlier drills/)
  assert.match(grounding, /NotebookLM audio slot: empty/)
  assert.match(grounding, /Sentinel/)
  const withAudio = packGrounding(pack, [], "https://notebooklm.google.com/notebook/example")
  assert.match(withAudio, /https:\/\/notebooklm\.google\.com\/notebook\/example/)
})

test("browser note store matches the pack loader", () => {
  const code = readFileSync(new URL("../../public/kompas/pack-notes.js", import.meta.url), "utf8")
  const context = {}
  vm.runInNewContext(code, context)
  const store = new Map()
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  }
  const answer = "I open Splunk and Sentinel, name the host, write ServiceNow, and escalate when triage says the account is still moving."
  const server = learnFromAnswer([], { question: "How do you triage?", answer, level: "engineer", at: 5, must: ["Splunk", "Sentinel", "ServiceNow", "triage", "escalation"] })
  const client = context.KompasPackNotes.learn([], { question: "How do you triage?", answer, level: "engineer", at: 5, must: ["Splunk", "Sentinel", "ServiceNow", "triage", "escalation"] })
  assert.equal(JSON.stringify(client), JSON.stringify(server))
  context.KompasPackNotes.write(storage, "soc", client)
  assert.equal(context.KompasPackNotes.KEY, "perfact.packNotes")
  assert.equal(JSON.stringify(context.KompasPackNotes.read(storage, "soc")), JSON.stringify(client))
})

test("sidebar puts Roles and Categories under Sessions and the feedback tab is pack-only", () => {
  const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
  const nav = html.slice(html.indexOf('id="navSessions"'), html.indexOf('id="navTranscripts"'))
  assert.match(nav, /id="navRoles"/)
  assert.match(nav, /id="navCategories"/)
  assert.ok(nav.indexOf('id="navRoles"') < nav.indexOf('id="navCategories"'))
  assert.match(html, /id="view-roles"/)
  assert.match(html, /id="view-categories"/)
  assert.match(html, /id="newRoleBtn"/)
  assert.match(html, /id="newCategoryBtn"/)
  assert.match(html, /id="liveTabFeedback"/)
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const tab = app.slice(app.indexOf("function setLivePackTab"), app.indexOf("function paintPackFeedback"))
  assert.match(tab, /sessionLane\(current\)/)
  assert.match(tab, /liveTabs/)
  assert.match(app, /packId: current\.packId/)
  assert.match(app, /Continue/)
  assert.match(app, /Edit setup/)
})
