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
