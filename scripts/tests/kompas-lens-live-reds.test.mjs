// The 9 Nov live check, pinned after the fold. Offline. No model.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { PEER_VOICE, REALISM, unsourcedIncident } from "../../src/lib/kompasAudience.ts"
import { EXPLAIN_MODES, desktopResponsePolicy } from "../../src/lib/kompasDesktopResponse.ts"
import { PIVOT_RULES, MOVES, pivotBlock } from "../../src/lib/kompasPivot.ts"
import { withoutLogistics as voiceStrip, personalLogistics } from "../../src/lib/kompasRelevance.ts"
import { withoutLogistics, logisticsBackstop } from "../../src/lib/kompasLogistics.ts"
import { spokenVoice } from "../../src/lib/kompasSpokenVoice.ts"

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length
const RESUME = "Designed identity-first security models using Azure AD, RBAC, Conditional Access, and PIM."

test("a time story uses the closest resume project and does not refuse", () => {
  const q = "Tell me about a time a Conditional Access rollout locked out executives and how you fixed it."
  const lead = unsourcedIncident(q, [RESUME])
  assert.match(lead, /closest work I can speak to/i)
  assert.match(lead, /Conditional Access/)
  assert.doesNotMatch(lead, /I would want to confirm/)
  assert.match(PEER_VOICE, /closest real resume project/)
  assert.doesNotMatch(PEER_VOICE, /would want to confirm/)
  assert.ok(words(PEER_VOICE) <= 160)
  const invented = "I once rolled out a policy that blocked executives. The audit logs showed Event ID 50020. I set an expiry for 48 hours."
  const out = spokenVoice(invented, q, RESUME)
  assert.doesNotMatch(out, /50020|48 hours|I would want to confirm/)
})

test("a number the question quotes is not a source, and fractions are not seeded", () => {
  assert.match(REALISM, /a number the question quotes is not a source/)
  assert.ok(words(REALISM) <= 180)
  assert.match(PIVOT_RULES("that"), /no number, fraction or share/)
  const move = MOVES.find((m) => m.angle === "quarter_scope")
  assert.doesNotMatch(move.say, /\bquarter/)
  const t = pivotBlock("What's the bottleneck when you roll out MFA?", "director", [])
  assert.doesNotMatch(t, /three-quarters|\ba quarter\b/)
  const out = spokenVoice("Our last hire cut access-review time by 40% in 3 months. A quarter of the effort was policy.", "What did your certification campaigns save?", RESUME)
  assert.doesNotMatch(out, /40%|a quarter/)
})

test("JIT elevation and CI/CD integration are dropped unless the resume says them", () => {
  const q = "What is privileged access management?"
  const invented = "In my work I integrated PIM with just-in-time elevation. I integrated those scripts into the CI/CD pipeline."
  const bare = spokenVoice(invented, q, RESUME)
  assert.doesNotMatch(bare, /just-in-time elevation|CI\/CD/)
  const sourced = spokenVoice(invented, q, RESUME + " just-in-time elevation and CI/CD pipeline.")
  assert.match(sourced, /just-in-time elevation/)
  assert.match(sourced, /CI\/CD/)
})

test("move to Texas and a two-week onsite start never reach the model", () => {
  const texas = "Would you be willing to move to Texas for this role?"
  const start = "Can you start in two weeks and work onsite three days a week?"
  assert.equal(voiceStrip(texas), "")
  assert.equal(personalLogistics(texas), true)
  assert.equal(logisticsBackstop(voiceStrip(start)), "")
  assert.equal(withoutLogistics(start), "")
  assert.equal(logisticsBackstop(voiceStrip(texas)), "")
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const at = service.indexOf("const skipped = question && !stripLogistics")
  const ret = service.indexOf("I'd rather keep relocation", at)
  const key = service.indexOf("const keysPromise = keysFor", at)
  assert.ok(at > 0 && ret > at && ret < key, "the deferral returns before the key read")
  assert.doesNotMatch(service.slice(ret, ret + 280), /I(?:'m| am) a U\.S\. citizen|authorized to work in the United States/)
})

test("the desktop card asks for flowing sentences, not nine lines", () => {
  const card = desktopResponsePolicy("engineer", "What's the bottleneck when you roll out MFA?").guidance
  assert.match(card, /connected sentences that flow/)
  assert.match(card, /not how many lines to write/)
  assert.doesNotMatch(card, /one sentence a line/)
  assert.doesNotMatch(card, /Write at least nine/)
})

test("MFA alone and an announced takeaway stay only when they belong", () => {
  assert.doesNotMatch(EXPLAIN_MODES, /MFA alone/)
  assert.match(EXPLAIN_MODES, /never announced/)
  const off = spokenVoice("You might say MFA alone fixes this. The takeaway is that roles should be narrow.", "What's the biggest mistake teams make with cloud IAM roles?", RESUME)
  assert.doesNotMatch(off, /MFA alone|The takeaway is/)
  assert.match(off, /roles should be narrow/i)
  const on = spokenVoice("MFA alone does not cover the legacy apps.", "What's the bottleneck when you roll out MFA?", RESUME)
  assert.match(on, /MFA alone/)
})
