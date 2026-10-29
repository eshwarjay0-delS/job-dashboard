# Kompas: question-first response relevance and spoken precision
Date: 28 October 2026. Evidence scope: owner-approved interview comparison and canonical MarketFit source.

## Original candidate evidence examined
The user-supplied, three-page Security Analyst III candidate profile was consulted but is not committed. It describes bank control-gap reviews and issue tracking, healthcare CRI/NIST assessment and risk registers, and earlier vulnerability/network security governance. It supports independent remediation review, control-owner engagement, risk reporting, and issue evidence. It does not independently prove a dramatic confrontation, CISO approval, specific one-off firewall change, or fabricated improvement percentages.

## Source-level causes of mismatched delivery
1. A generic instruction demanded a fixed 60/40 narration/technical mix, even for a personal-fit or team-culture question.
2. Technical-mode scaffolding forced architecture, a rejected alternative, and bottom-level mechanism detail on short definitions.
3. Word targets encouraged padding instead of stopping after a complete answer.
4. Generated rotating project or bottleneck context could enter broad “what would you bring” answers.
5. Static topic coverage missed many explicitly named technologies; natural alternative phrasing could be marked missing.
6. Earlier 20-fold quality tests did not cover broad conversational intent and soft-question jargon drift.

## Implementation
- src/lib/kompasRelevance.ts: 12 question intents, flexible speaking limits, exact named concept coverage, cautious unasked-jargon diagnostics; requested deep comparisons remain deep.
- src/lib/kompasAnswerService.ts: question-specific scope overrides generic modes, broad asks do not force one random project, concise answers have ceilings, named missing concepts and clear tangent cases can enter targeted repair.
- src/lib/kompasInterviewPrecision.ts: natural business-impact explanations count as coverage rather than requiring a rigid phrase.
- scripts/fixtures/kompas-50fold-intents.json: 50 unique synthetic interview questions, not private data.
- scripts/tests/kompas-50fold-relevance.test.mjs: cumulative folds 1 through 50, checking intent, budget and depth on engineer/director levels; additional jargon and keyword tests.
- scripts/kompas-relevance-review.mjs: accepts actual paired ChatGPT and Kompas answers from a local JSON export and reports diagnostic omissions, jargon, formatting and overlength without falsely claiming semantic accuracy.
- scripts/tests/kompas-relevance-review.test.mjs: illustrative synthetic good/bad answer pairs (not actual model outputs).
- CI also checks original Kompas, desktop, WhatsApp, voice and Webpack build gates.

## Verification limitations
Fifty deterministic folds are not 50 live Kompas completions, 50 verified production builds, or 50 actual ChatGPT-versus-Kompas model comparisons. No authorized, authenticated API output from both models is available in the repo or connected database. Actual desktop and WhatsApp response timing remain untested here. Do not invent response content to fill missing pairs. These limitations are a release acceptance item, not proof that improvements already reached a semantic score.

## Live acceptance
1. Use the identical original resume, JD and original user-approved source documents for both systems.
2. Capture at least 50 actual same-question answer pairs in a local JSON file, never publish private sessions.
3. Human-review every answer for question fit, requested keywords, technical truth, first-person factual source, unnecessary jargon, spoken coherence and directness.
4. Record latency to first visible answer as distinct from upstream first token, total latency and any repair/verification attempts.
5. Iterate on actual failures, add tests, rerun all 50, and verify web/desktop/WhatsApp with a live authorized session.
6. Promote only with CI and READY production deployment evidence at the exact commit SHA.

The target is the meaning and expectations of the actual question, not an artificial percentage or version number. 50/50 static tests is NOT 100% factual or semantic quality.
