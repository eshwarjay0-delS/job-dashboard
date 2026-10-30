// r10 (29 Oct 2026, OFFLINE): coverage honesty, generic-story pull, heading glue. Cases invented from scratch.
import test from "node:test"
import assert from "node:assert/strict"
import { sourceDocs, retrievePassages, coachingSentence } from "../../src/lib/kompasSourceRetrieval.ts"
import { dossierItems } from "../../src/lib/kompasDossierItems.ts"

const ret = (q, dossier) => retrievePassages(q, sourceDocs({ dossier }))

test("r10: a prohibition line is not proof the topic is covered", () => {
  const d = "Never say which hospital network sponsored the badge pilot until the recruiter confirms it.\nI rebuilt the VPN concentrator configs for three regional offices in one quarter."
  assert.equal(ret("Which hospital network sponsored the badge pilot?", d).matched, false)
})
test("r10: advice to the candidate is not proof (respond based on / ask first)", () => {
  const d = "Ask the recruiter for the shift premium and on-call schedule first, then respond based on the actual on-call terms.\nI wrote the Python job that rotated service account keys every thirty days."
  assert.equal(ret("What is the shift premium and on-call schedule?", d).matched, false)
})
test("r10: a count question needs a count in the covering passage", () => {
  const d = "I designed custom Ansible playbooks for patching Solaris hosts across the trading floor.\nI led the firewall rule review with the network team."
  assert.equal(ret("How many Ansible playbooks did you write for Solaris patching?", d).matched, false)
})
test("r10 control: a real answer with a count still passes the count question", () => {
  const d = "I wrote 14 Ansible playbooks for patching Solaris hosts across the trading floor.\nI led the firewall rule review with the network team."
  assert.equal(ret("How many Ansible playbooks did you write for Solaris patching?", d).matched, true)
})
test("r10 control: a genuine covered answer next to a prohibition still passes", () => {
  const d = "Do not claim you owned the badge vendor contract.\nI ran the badge pilot for the hospital network and cut tailgating alerts by half after the door sensor change."
  assert.equal(ret("Tell me about the hospital badge pilot", d).matched, true)
})
test("r10: coachingSentence recognises prohibition and advice, not first-person work", () => {
  assert.ok(coachingSentence("Do not claim local status or a named client."))
  assert.ok(coachingSentence("Respond based on the actual contract terms."))
  assert.ok(!coachingSentence("I did not claim the finding until I reproduced it twice."))
})

test("r10: a generic story with no shared distinctive term does not outrank a specific answer", () => {
  const d = [
    "I challenged a senior director once: I disagreed with the plan, pushed back with evidence, and we settled on a phased rollout.",
    "When the warehouse scanning team kept slipping its sprint milestones, I split the backlog by dependency and set weekly demo checkpoints.",
  ].join("\n")
  const r = ret("How do you handle a team that keeps slipping its milestones?", d)
  assert.match(r.passages[0].text, /warehouse scanning/)
})
test("r10 control: a story told only in other words is still found for a behavioral ask", () => {
  const d = ["I configured Grafana dashboards for the payments latency SLO.", "I pushed back on the CTO's date, showed the risk in writing, and we agreed to move it two weeks."].join("\n")
  const r = ret("Tell me about a time you disagreed with your boss", d)
  assert.match(r.passages[0].text, /pushed back on the CTO/)
})

test("r10: a heading with no answer does not swallow a later, separate answer", () => {
  const items = dossierItems([
    "What is your notice period?", "", "", "",
    "I keep a running decision log for every audit so evidence requests are answered the same day.",
    "", "How do you scope an access review?", "I start from the systems that hold regulated data and pull every entitlement, not a sample.",
    "", "What is least privilege?", "Each identity gets only the access its current job needs, and nothing standing beyond that.",
    "", "How do you close a finding?", "I re-test the control on the full population and attach the evidence before closing anything.",
  ].join("\n"))
  assert.ok(items)
  const np = items.find((i) => /notice period/.test(i.text))
  assert.ok(!np || !/decision log/.test(np.text), np && np.text)
})

// ---------- item 6 (from Lens r4 notes): premise verbs and quoted figures in first-person result claims ----------
import { falsePremises } from "../../src/lib/kompasSourceRetrieval.ts"
import { applyGuards, allowedNumbers, questionFigures } from "../../src/lib/kompasGuards.ts"
const RES = "I led cloud security operations at Molina Healthcare, moving alert triage into Splunk and tuning detections with the SOC."
const PDOCS = sourceDocs({ resume: RES })
test("r10/6a: result-verb premises are caught (cut, reduced, slashed, lowered, dropped; 'I heard')", () => {
  for (const q of ["I heard you cut incidents 70 percent. How?", "You cut incidents by 70%, right?", "Since you cut incidents by 70% at Molina, how did you do it?",
    "So you reduced alert noise by 40%, walk me through it.", "You slashed false positives by 35%. What changed?", "I understand you lowered MTTR 25 percent?"]) {
    assert.ok(falsePremises(q, PDOCS).length > 0, q)
  }
})
test("r10/6a control: a quoted number that IS in the sources is not a false premise", () => {
  const docs = sourceDocs({ resume: RES + "\nCut incidents 70% at Molina by retiring noisy detections." })
  assert.deepEqual(falsePremises("You cut incidents by 70% at Molina, right?", docs), [])
})
test("r10/6a: a first-person result claim may not reuse the question's unsourced figure", () => {
  const q = "I heard you cut incidents 70 percent. How?"
  const out = applyGuards("I cut incidents 70 percent at Molina.", null, allowedNumbers(RES), questionFigures(q)).text
  assert.doesNotMatch(out, /70/)
})
test("r10/6a control: a sourced figure the question quotes is still spoken", () => {
  const src = RES + " Cut incidents 70% at Molina."
  const out = applyGuards("I cut incidents 70% at Molina.", null, allowedNumbers(src), questionFigures("You cut incidents by 70%, right?")).text
  assert.match(out, /70%/)
})
test("r10/6a control: the interviewer's structural figure still passes ('the 72-hour window')", () => {
  const out = applyGuards("Within the 72-hour window I would notify the regulator first.", null, allowedNumbers(RES), questionFigures("How do you meet the 72-hour window?")).text
  assert.match(out, /72-hour/)
})
