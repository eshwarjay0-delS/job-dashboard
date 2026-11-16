import test from "node:test"
import assert from "node:assert/strict"
import {
  buildFinalAtsReviewPrompt,
  parseFinalAtsReview,
  supportedFinalAtsGaps,
  unsupportedFinalAtsGaps,
} from "../../src/lib/resume-final-ats-review.ts"

const TERMS = ["SIEM", "Splunk", "incident response", "IAM", "CyberArk"]

test("prompt starts with the exact approved instruction and contains the original JD and exported DOCX", () => {
  const prompt = buildFinalAtsReviewPrompt({
    jd: "The role requires SIEM, incident response and IAM.",
    docxText: "Experience\\nConfigured Splunk detections.",
    terms: TERMS,
  })
  assert.equal(prompt.split("\\n")[0], "Give me ATS score")
  assert.match(prompt, /JOB DESCRIPTION:/)
  assert.match(prompt, /FINAL EXPORTED DOCX TEXT/)
  assert.match(prompt, /Configured Splunk detections/)
  assert.match(prompt, /SIEM, Splunk, incident response, IAM, CyberArk/)
  assert.match(prompt, /diagnostic only/)
})

test("parser accepts bounded numeric and percent scores and canonical target terms only", () => {
  assert.deepEqual(parseFinalAtsReview('{"score":"86.5%","missing":["SIEM","unknown product"],"weak":["incident response","IAM"]}', TERMS), {
    status: "ok", score: 86.5, missing: ["SIEM"], weak: ["incident response", "IAM"],
  })
  assert.equal(parseFinalAtsReview('{"score":101,"missing":[],"weak":[]}', TERMS).status, "invalid_response")
  assert.equal(parseFinalAtsReview("not json", TERMS).status, "invalid_response")
})

test("malformed score coercions are rejected instead of becoming plausible numbers", () => {
  for (const score of [null, "", "   ", true, false, [], {}, "NaN", "Infinity", -1, 101]) {
    const raw = JSON.stringify({ score, missing: [], weak: [] })
    assert.equal(parseFinalAtsReview(raw, TERMS).status, "invalid_response", String(score))
  }
})

test("canonical term normalization rejects unlisted aliases and deduplicates case variants", () => {
  const review = parseFinalAtsReview('{"score":100,"missing":["INCIDENT-RESPONSE","incident response","cyber-ark"],"weak":["IAM","iam"]}', TERMS)
  assert.deepEqual(review.missing, ["incident response"])
  assert.deepEqual(review.weak, ["IAM"])
})

test("only supported missing/weak gaps can enter the correction pass", () => {
  const review = parseFinalAtsReview('{"score":91,"missing":["SIEM","CyberArk"],"weak":["Splunk","IAM"]}', TERMS)
  assert.deepEqual(supportedFinalAtsGaps(review, ["Splunk", "IAM"], new Set(["SIEM", "Splunk"])), ["Splunk", "IAM"])
  assert.deepEqual(unsupportedFinalAtsGaps(review, ["Splunk", "IAM"]), ["SIEM", "CyberArk"])
})

test("missing terms already covered are ignored while weak terms may be improved in role context", () => {
  const review = parseFinalAtsReview('{"score":95,"missing":["Splunk"],"weak":["incident response"]}', TERMS)
  assert.deepEqual(supportedFinalAtsGaps(review, ["Splunk", "incident response"], ["Splunk"]), ["incident response"])
})
