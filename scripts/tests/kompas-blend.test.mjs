import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { BLEND_MOVES, blendPrompt, blendSpoken } from "../../src/lib/kompasBlend.ts"

const route = fs.readFileSync(new URL("../../src/app/api/kompas/answer/route.ts", import.meta.url), "utf8")

test("twenty blend moves are in the prompt the answer hears", () => {
  assert.equal(BLEND_MOVES.length, 20)
  const prompt = blendPrompt()
  for (const move of BLEND_MOVES) assert.ok(prompt.includes(move), move)
  assert.match(route, /blendPrompt\(\)/)
  assert.match(route, /blendSpoken\(/)
})

test("1 praise is not the opening", () => {
  assert.equal(blendSpoken("Great question. The chain is checked at the proxy."), "The chain is checked at the proxy.")
})

test("2 a spoken answer is not a second pile", () => {
  const out = blendSpoken("Certainly, the request is signed. And then the CA issues it. From there the host installs it.")
  assert.match(out, /^The request is signed/)
  assert.match(out, /And then the CA/)
})

test("3 meaning stays ahead of the parts", () => {
  const out = blendSpoken("A certificate is a signed name. The key stays on the host. The CA only sees the request.")
  assert.match(out, /^A certificate is a signed name\. \[breath\]/)
})

test("4 both sides of a comparison survive", () => {
  const out = blendSpoken("V-Cert hides the polling. The direct API shows each call. The host still owns the key.")
  assert.match(out, /direct API/)
  assert.match(out, /host still owns the key/)
})

test("5 an investigation keeps its order", () => {
  const out = blendSpoken("I start at the proxy. Then the sign-in log. Then the pattern. Then I contain it.")
  assert.match(out, /start at the proxy/)
  assert.match(out, /\[beat\] Then I contain it\./)
})

test("6 a name stays attached to what it does", () => {
  const out = blendSpoken("Venafi TPP stores the policy. The policy decides which CA signs.")
  assert.equal(out, "Venafi TPP stores the policy. The policy decides which CA signs.")
})

test("7 numbers and protocol names stay exact", () => {
  const raw = "TLS 1.2 failed on port 443. PKCS#10 took 12 minutes. The fleet is 300 endpoints."
  const out = blendSpoken(raw)
  assert.match(out, /TLS 1\.2/)
  assert.match(out, /port 443/)
  assert.match(out, /PKCS#10/)
  assert.match(out, /12 minutes/)
  assert.match(out, /300 endpoints/)
})

test("8 the reasoning stays, and a long answer gains one breath", () => {
  const out = blendSpoken("I check the name first. The certificate is what the client trusts. The proxy is where I look.")
  assert.equal((out.match(/\[breath\]/g) || []).length, 1)
})

test("9 two pauses collapse, and the answer does not open on one", () => {
  assert.equal(
    blendSpoken("[breath] [beat] The alert was on the wrong field."),
    "The alert was on the wrong field. [beat]",
  )
})

test("10 a third beat becomes a breath", () => {
  const out = blendSpoken("One. [beat] Two. [beat] Three. [beat] Four.")
  assert.equal((out.match(/\[beat\]/g) || []).length, 2)
  assert.match(out, /\[breath\]/)
})

test("11 the clause after the name is kept", () => {
  assert.match(blendSpoken("Luna HSM holds the partition. That partition is the one that signs."), /holds the partition/)
})

test("12 the close does not repeat the opening or start another topic", () => {
  assert.equal(
    blendSpoken("The chain broke at the proxy. I replaced the intermediate. The chain broke at the proxy."),
    "The chain broke at the proxy. I replaced the intermediate.",
  )
  assert.equal(
    blendSpoken("The chain broke at the proxy. On a separate note, we should talk about hiring."),
    "The chain broke at the proxy.",
  )
})

test("13 utilize and leverage become use", () => {
  assert.equal(blendSpoken("I utilize the log and leveraged the field."), "I use the log and used the field.")
})

test("14 right, you know, and basically come out", () => {
  assert.equal(blendSpoken("I check the field, right? You know, it is basically the issuer."), "I check the field, it is the issuer.")
})

test("15 a varied practice is left as said", () => {
  assert.match(blendSpoken("It depends on the setup. I check the issuer next."), /depends on the setup/)
})

test("16 an honest edge is left as said", () => {
  assert.match(blendSpoken("Beyond this there may be more. This is what I have seen."), /what I have seen/)
})

test("17 a short correction stays", () => {
  assert.match(blendSpoken("I looked at the proxy — actually the CDN. That is where the name failed."), /actually the CDN/)
})

test("18 one thread is not given a second mechanism", () => {
  const out = blendSpoken("The proxy checks the name. Another thing, the database password rotation is separate.")
  assert.equal(out, "The proxy checks the name.")
})

test("19 a code sample is not rewritten", () => {
  const raw = "The call is direct.\n```\nconn.retrieve_cert(request)\n```\nThat brings the chain back."
  assert.match(blendSpoken(raw), /```\nconn\.retrieve_cert\(request\)\n```/)
})

test("20 the same answer blended twice does not move again", () => {
  const once = blendSpoken("So the name failed. And then I checked the issuer. From there the chain was the cause. That is the break.")
  assert.equal(blendSpoken(once), once)
  assert.match(once, /\[breath\]/)
  assert.match(once, /\[beat\]/)
})
