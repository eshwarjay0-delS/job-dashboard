// Hand-off kit (Chief, 29 Oct 2026 11:50 PM CT): (a) the dossier's logistics list matches the logistics-removal
// helper kompasLogistics.ts (a9b91ccc), with our false-positive protections kept; (b) the AQ honesty rule
// (README section 2, r12 slot gate 2172d70) checks sourced facts in dossier items, next to the number check.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { bannedLogistics, KOMPAS_LOGISTICS_TERMS, KOMPAS_LOGISTICS_UNAMBIGUOUS, gateItem } from "../../src/lib/dossierBlueprint.ts"
import { SLOT_ASK, SLOT_VALUE, askedSlot, slotFilled, honestyCheck } from "../../src/lib/dossierHonesty.ts"

const fx = (f) => readFileSync(new URL(`./fixtures/handoff/${f}`, import.meta.url), "utf8")

test("logistics term list mirrors kompasLogistics.ts exactly", () => {
  const src = fx("kompasLogistics.a9b91ccc.ts.txt")
  const theirs = [...src.matchAll(/String\.raw`([^`]*)`/g)].map((m) => m[1])
  assert.deepEqual(KOMPAS_LOGISTICS_TERMS, theirs)
  assert.ok(src.includes(KOMPAS_LOGISTICS_UNAMBIGUOUS.source))
})

test("handoff phrases are caught as dossier text; our protections still pass", () => {
  for (const s of ["Are you willing to travel?", "Two weeks notice.", "Are you comfortable with hybrid work?", "Where do you live?",
    "Do you hold an active security clearance?", "I'm on a C2C basis.", "Green card holder.", "Contract"]) assert.ok(bannedLogistics(s).length, s)
  for (const s of ["Remediation must address the root cause.", "I relocated the log pipeline to a new bucket.", "The executive sponsor signed the exception.",
    "Citizen services stayed up during the change.", "A compensating control covers the gap.", "Travel and expense systems were in audit scope."]) assert.deepEqual(bannedLogistics(s), [], s)
})

test("slot rule mirrors the r12 honesty gate", () => {
  const src = fx("kompasSlots.2172d70.ts.txt")
  for (const [slot, re] of SLOT_ASK) assert.ok(src.includes(`["${slot}", /${re.source}/i]`), slot)
  for (const [slot, re] of Object.entries(SLOT_VALUE)) assert.ok(src.includes(`${slot}: /${re.source}/`), slot)
  assert.equal(askedSlot("Who was your manager at Citi?"), "person")
  assert.equal(askedSlot("Walk me through an IAM issue."), null)
})

test("an asked value the sources do not state near a question word becomes 'not in your sources'", () => {
  const sources = ["Citi: ran access reviews in SailPoint for privileged accounts.", "City of San Diego: firewall rule cleanup."]
  const r = honestyCheck({ q: "How many firewall rules did you remove at San Diego?", a: ["I removed 412 rules."] }, sources)
  assert.equal(r.slot, "count"); assert.equal(r.filled, false)
  const ok = honestyCheck({ q: "What tool did you use for access reviews at Citi?", a: ["SailPoint."] }, ["Citi: ran access reviews in SailPoint for privileged accounts."])
  assert.equal(ok.slot, null) // no specific-value ask by r12's rule -> untouched
  const tech = honestyCheck({ q: "What SIEM did you use at Citi?", a: ["Splunk."] }, ["Citi: tuned Splunk correlation searches."])
  assert.equal(tech.slot, "tech"); assert.equal(tech.filled, true)
  assert.ok(slotFilled("count", "At San Diego I cleaned up 40 firewall rules.", ["firewall"]))
})

test("gateItem applies the honesty rule next to the number check", () => {
  const sources = ["City of San Diego: firewall rule cleanup with operations sign-off."]
  const { item, blocked } = gateItem({ q: "How many firewall rules did you remove at San Diego?", a: ["I removed a lot of them, about forty."], opener: "Forty rules." }, sources)
  assert.match(item.a.join(" "), /not in your sources/i)
  assert.match(item.a.join(" "), /\[ ___ confirm/)
  assert.ok(blocked.some((b) => b.startsWith("honesty:count")))
  const fine = gateItem({ q: "How do you challenge a root cause?", a: ["I ask for the causal chain."] }, sources)
  assert.deepEqual(fine.item.a, ["I ask for the causal chain."]); assert.deepEqual(fine.blocked, [])
})
