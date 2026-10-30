// Lens ships OFF: with KOMPAS_DESKTOP_LENS unset the live prompts carry no Lens block and no explain modes (30 Oct 2026).
import { test } from "node:test"
import assert from "node:assert/strict"
delete process.env.KOMPAS_DESKTOP_LENS
const A = await import("../../src/lib/kompasAudience.ts")
const D = await import("../../src/lib/kompasDesktopResponse.ts")
const QS = ["Explain how SAML works", "What is Okta?", "Why does MFA matter?", "Tell me about a time you led a team", "So, explain zero trust", "What's the difference between OAuth and OIDC?"]
const LEVELS = ["engineer", "architect", "director", "hiring_manager", "hr"]
test("switch is off by default", () => { assert.equal(A.lensSwitchOn(), false) })
test("off: audience guidance has no LENS, REALISM or OWN THE ROOM block", () => {
  for (const l of LEVELS) for (const q of QS) assert.doesNotMatch(A.audienceGuidance(l, q), /\bLENS |REALISM \(|OWN THE ROOM/, `${l}: ${q}`)
})
test("off: desktop guidance has no EXPLAIN MODES and desktopDelivery keeps today's slots", () => {
  for (const l of LEVELS) for (const q of QS) {
    const p = D.desktopResponsePolicy(l, q)
    assert.doesNotMatch(p.guidance, /EXPLAIN MODES/, `${l}: ${q}`)
    const w = D.desktopDelivery(p, l, q)
    assert.equal(w.on, false); assert.equal(w.delivery, p.guidance); assert.equal(w.tail, p.guidance)
  }
})
test("on only when set to on or 1", () => {
  for (const v of ["on", "1", " ON "]) { process.env.KOMPAS_DESKTOP_LENS = v; assert.equal(A.lensSwitchOn(), true, v) }
  for (const v of ["", "off", "0", "true"]) { process.env.KOMPAS_DESKTOP_LENS = v; assert.equal(A.lensSwitchOn(), false, v) }
  delete process.env.KOMPAS_DESKTOP_LENS
})
