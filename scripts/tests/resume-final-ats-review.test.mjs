import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFinalAtsReviewPrompt,
  parseFinalAtsReview,
  supportedFinalAtsGaps,
  unsupportedFinalAtsGaps,
} from "../../src/lib/resume-final-ats-review.ts";

const TERMS = ["SIEM", "Splunk", "incident response", "IAM", "CyberArk"];

test("prompt begins with the exact owner-approved instruction and includes the final export", () => {
  const prompt = buildFinalAtsReviewPrompt({
    jd: "The role requires SIEM, incident response and IAM.",
    docxText: "Experience\nConfigured Splunk detections.",
    terms: TERMS,
  });
  assert.equal(prompt.split("\n")[0], "Give me ATS score");
  assert.match(prompt, /FINAL EXPORTED DOCX TEXT/);
  assert.match(prompt, /Configured Splunk detections/);
  assert.match(prompt, /SIEM, Splunk, incident response, IAM, CyberArk/);
  assert.match(prompt, /diagnostic only/);
});

test("parser accepts a bounded score and only canonical target terms", () => {
  const review = parseFinalAtsReview(
    '{"score":"86.5%","missing":["SIEM","unknown product"],"weak":["incident response","IAM"]}',
    TERMS,
  );
  assert.deepEqual(review, {
    status: "ok",
    score: 86.5,
    missing: ["SIEM"],
    weak: ["incident response", "IAM"],
  });
});

test("parser normalizes case and separators but rejects unlisted aliases and malformed scores", () => {
  assert.deepEqual(
    parseFinalAtsReview('{"score":100,"missing":["INCIDENT-RESPONSE"],"weak":[]}', TERMS),
    { status: "ok", score: 100, missing: ["incident response"], weak: [] },
  );
  assert.deepEqual(parseFinalAtsReview('{"score":100,"missing":["cyber-ark"],"weak":[]}', TERMS).missing, []);
  assert.equal(parseFinalAtsReview('{"score":101,"missing":[],"weak":[]}', TERMS).status, "invalid_response");
  assert.equal(parseFinalAtsReview("not json", TERMS).status, "invalid_response");
});

test("supported correction terms exclude JD-only claims and already-covered missing terms", () => {
  const review = parseFinalAtsReview(
    '{"score":91,"missing":["SIEM","CyberArk"],"weak":["Splunk","IAM"]}',
    TERMS,
  );
  const supported = supportedFinalAtsGaps(
    review,
    ["Splunk", "IAM"],
    new Set(["SIEM", "Splunk"]),
  );
  assert.deepEqual(supported, ["Splunk", "IAM"]);
  assert.deepEqual(unsupportedFinalAtsGaps(review, ["Splunk", "IAM"]), ["SIEM", "CyberArk"]);
});

test("missing terms already covered are ignored; weak terms can be reviewed in role context", () => {
  const review = parseFinalAtsReview(
    '{"score":95,"missing":["Splunk"],"weak":["incident response"]}',
    TERMS,
  );
  assert.deepEqual(
    supportedFinalAtsGaps(review, ["Splunk", "incident response"], ["Splunk"]),
    ["incident response"],
  );
});

test("duplicate and unknown model terms never escape the canonical term list", () => {
  const review = parseFinalAtsReview(
    '{"score":80,"missing":["SIEM","siem","invented tool"],"weak":["IAM","iam"]}',
    TERMS,
  );
  assert.deepEqual(review.missing, ["SIEM"]);
  assert.deepEqual(review.weak, ["IAM"]);
});
test('resume plan records the approved current-master final-DOCX restack without claiming live acceptance', () => {
  const plan = readFileSync(new URL('../../src/lib/plan-vision.ts', import.meta.url), 'utf8')
  assert.match(plan, /PLAN_REVISION = "2026-11-14.6"/)
  assert.match(plan, /On 14 Nov, the implementation from stale PR #289 is restacked on the current evidence-bound confirmed-skill branch PR #393 as a dependent draft/)
  assert.match(plan, /protected preview requires an authorized private KOMPAS_VERCEL_API_TOKEN/)
  assert.match(plan, /No personal DOCX export or Gemini model call occurred/)
})
