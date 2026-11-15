import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalAtsReviewPrompt,
  parseFinalAtsReview,
} from "../../src/lib/resume-final-ats-review.ts";

const TERMS = ["SIEM", "Splunk", "incident response", "IAM", "CyberArk"];

test("prompt starts with the exact approved phrase and contains the actual exported DOCX and JD", () => {
  const prompt = buildFinalAtsReviewPrompt({
    jd: "The role requires SIEM, incident response and IAM.",
    docxText: "Experience\nConfigured Splunk detections.",
    terms: TERMS,
  });
  assert.equal(prompt.split("\n")[0], "Give me ATS score");
  assert.match(prompt, /JOB DESCRIPTION:/);
  assert.match(prompt, /FINAL EXPORTED DOCX TEXT/);
  assert.match(prompt, /Configured Splunk detections/);
  assert.match(prompt, /SIEM, Splunk, incident response, IAM, CyberArk/);
  assert.match(prompt, /diagnostic only/);
  assert.match(prompt, /Do not rewrite the resume/);
});

test("parser accepts a bounded score and only canonical target terms", () => {
  assert.deepEqual(
    parseFinalAtsReview(
      '{"score":"86.5%","missing":["SIEM","unknown product"],"weak":["incident response","IAM"]}',
      TERMS,
    ),
    {
      status: "ok",
      score: 86.5,
      missing: ["SIEM"],
      weak: ["incident response", "IAM"],
    },
  );
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

test("duplicate and unknown model terms never escape the canonical term list", () => {
  const review = parseFinalAtsReview(
    '{"score":80,"missing":["SIEM","siem","invented tool"],"weak":["IAM","iam"]}',
    TERMS,
  );
  assert.deepEqual(review.missing, ["SIEM"]);
  assert.deepEqual(review.weak, ["IAM"]);
});

test("missing and weak arrays tolerate non-string or malformed list values", () => {
  const review = parseFinalAtsReview(
    '{"score":91.24,"missing":["Splunk",7,null],"weak":"IAM"}',
    TERMS,
  );
  assert.deepEqual(review, { status: "ok", score: 91.2, missing: ["Splunk"], weak: [] });
});

test("parser rejects null, empty, boolean, array, and object scores instead of coercing them", () => {
  for (const score of [null, "", "   ", true, false, [], {}]) {
    const review = parseFinalAtsReview(JSON.stringify({ score, missing: [], weak: [] }), TERMS);
    assert.equal(review.status, "invalid_response", `score ${JSON.stringify(score)} must be rejected`);
    assert.equal(review.score, null);
  }
});
