# Kompas: cross-domain 50-fold generalization
Date: 28 October 2026. Product: canonical MFit Kompas shared engine.

## Owner requirement
Fix the **general decision process**, not just a BNY control-risk answer or one keyword. A 50-fold evaluation must include varied work domains, question shapes, adversarial setup, elliptical follow-ups, and role-appropriate depth. Passing fifty deterministic fixtures does not prove live semantic quality.

## This change
- Adds an independent fifty-question cross-domain fixture covering security, GRC, Salesforce, software engineering, QA, validation/MES, analytics, network, cloud and delivery.
- Pins 12 distinct answer intents and input-to-ask extraction, including spoken setup before the actual question.
- Extends action-based routing for common unscripted interview wording: overview/summarize introduction, motivation, project stories, short follow-up, technical 'explain how', closing questions, and start-date logistics.
- Corrects a general tier-zero word-budget defect: a short definition's minimum length could exceed its maximum, causing forced padding. Preserve short definitions and soft turns.
- Preserves explicit comparison intent when the question says 'explain how X and Y differ'.
- Tests both engineer/director framing and tier 0/2/3, plus scoped follow-up evidence and soft-question tangent diagnostics.

## Verification levels and limits
Static fixtures are checked by node:test through `npm run test:hardening`. This is **not** fifty authenticated live outputs, independent truth assessment, proof of voice delivery, or proof of WhatsApp/desktop parity. Before production promotion, run actual paired ChatGPT/Kompas completions for fifty diverse questions against the same consented original resume/JD and assess semantic correctness, factual claims, natural speech, timing, continuity and platform behavior. Record each original output, model version and exact commit privately. Do not commit private resumes or chat exports.

## Priority
Run CI on the PR; investigate any baseline regressions. Do not merge on a claim of 50/50 unless the full applicable CI is green. Request actual model-answer capture in an authenticated session, then rerun after each relevant engine fix.


## Actual model-capture pathway (not yet executed)
The guarded live runner now accepts `crossdomain-50` as its fourth argument. It sends all fifty distinct role scenarios (including varied spoken prefaces) to the shared authenticated Kompas answer API, with engineer/architect/director audience rotation. Supply an approved `SOURCES.json` keyed by case id (`crossdomain-01` through `crossdomain-50`), each containing its own original resume and JD text. Cases categorized `follow-up` additionally require reviewed history; every other case rejects history and ledger leakage across candidates. Run only in an authorized private environment with `KOMPAS_API_TOKEN` configured securely, for example:

```bash
node scripts/kompas-live-evaluate.mjs /private/sources.json /private/kompas-results 1 crossdomain-50
```

The runner records raw model answers, timing, provenance and pending human review. It does **not** capture ChatGPT comparison responses or certify semantic truth by itself. Require a reviewer and separate same-question reference outputs before declaring a quality pass. No live token or candidate source bundle has been available in this agent session.


## Strict side-by-side evidence report (29 October follow-up)
The answer-capture runner and static jargon diagnostics cannot certify a 50-response ChatGPT-versus-Kompas comparison: loose text lists can be incomplete, misaligned or sourced from a different resume/JD. The private-only `scripts/kompas-paired-review.mjs` requires the capture JSON, its completion manifest and an independent reference JSON with the **same** `sourcesSha256` value.

Reference export shape is illustrative only; never invent responses:
```json
{"sourcesSha256":"<exact 64-character digest from manifest>","responses":[{"id":"crossdomain-01","question":"<exact original utterance>","text":"<actual reference response>","model":"<reported model>"}]}
```

Run with real private files, outside the repository:
```bash
node scripts/kompas-paired-review.mjs /private/round-1.json /private/round-1.manifest.json /private/reference.json /private/paired.md
```

The pairing gate rejects duplicate/missing case IDs, incomplete or failed captures, mismatched exact questions, mismatched source digests, changed capture IDs, missing provider/model fields and synthetic-provider metadata. It emits a row-by-row Markdown comparison only when all fifty raw response pairs are present. The output is created with restricted file permissions and never written inside the source repository.

The report intentionally reads **human-reviewed quality: NOT VERIFIED**. Matching strings/IDs or a self-reported reference model cannot independently authenticate model provenance, technical truth, natural delivery or user preference. Human review must grade every answer with cited reasons. Native speech and WhatsApp timing remain separate checks. This change has not captured fifty genuine response pairs.


## Canonical question integrity and manually scored 50-fold acceptance (29 Oct)
An audit found that two different question texts could be changed together in the reference and Kompas captures yet still pass the original pair matching. The pairing utility now additionally loads the exact repository-authorized benchmark fixture, checks its SHA-256 against manifest, capture and reference records, rejects unknown case IDs, and confirms each original question matches the canonical case. Only allowlisted fixture names are accepted. This repairs a general evidence-integrity defect, not one question.

The independent assessment script `scripts/kompas-score-review.mjs` accepts a privately saved paired-report JSON and a separate manually completed review JSON. For all 50 cases, the reviewer must score each original answer separately on eight axes (direct relevance, explicit coverage, factual grounding, technical correctness, context continuity, natural delivery, unnecessary detail, audience depth), use 0–4 integer scores with a concrete rationale for each, and explicitly record hard failures such as fabrication, contradictory facts, unsafe advice, privacy or answering the wrong question. Evidence quotes, where supplied, must occur in the original answer. No average can override a hard failure. Missing/duplicate cases, mismatched questions/fingerprints, invalid scores or unsigned review are rejected.

Example review format (illustrative only; never treat this as a real result):
```json
{ "reviewerId":"human-reviewer", "reviewedAt":"2026-10-29T12:00:00Z", "signedOff":true, "sourceSha256":"<from paired file>", "fixtureSha256":"<from paired file>", "cases":[{"id":"crossdomain-01","question":"<exact fixture question>","domain":"security","hardFailures":[],"kompas":{"directRelevance":{"score":4,"reason":"Concrete supporting assessment with explicit original evidence."}},"reference":{"directRelevance":{"score":4,"reason":"Concrete supporting assessment with explicit original evidence."}}}] }
```
All eight rating categories for both answers and all 50 cases are mandatory; the abbreviated example is not executable as a complete review.

```bash
node scripts/kompas-score-review.mjs /private/paired.json /private/human-review.json /private/scorecard.json
```

Scores are *self-attested human review*, not externally authenticated independent correctness or proof of model origin. The reported output explicitly labels that limitation. No model calls or scores have been fabricated. This closes evaluation tooling and leaves genuine authenticated capture, human scoring, desktop speech and WhatsApp parity as separate release acceptance tasks.
