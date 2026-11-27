# Kompas Chief Relevance Handoff

**Owner's objective:** Kompas must sound like a strong, attentive, technically capable interview candidate. It must answer the *meaning and expectations* of the question, not mechanically match terms from the resume, job description, earlier replies, or nearby technical topics. The canonical system is MFit Kompas; the hosted web experience, Windows desktop wrapper, and WhatsApp session share the answering service.

This guide is an explicit operating procedure for developers and evaluators, **not** a transfer of hidden model reasoning or evidence that the model has been fine-tuned. It defines observable behavior, reproducible checks, and strict source boundaries.

## The chief's response workflow

**1. Hear the speaker and identify the communication act.** Distinguish a substantive question, a request for a brief acknowledgment, an introduction, a direct comparison, a scenario, a past-experience question, a follow-up, and an invitation to ask the interviewer questions. A manager explaining the team's 27 controls is not asking for a technical architecture lecture.

**2. Find the actual current ask.** Identify the last meaningful request while retaining genuinely connected subquestions. A long setup can describe dozens of tools, owners, and constraints; do not promote every mentioned word into an answer requirement. Only carry setup choices forward when the speaker refers to them with "which of those" or a similar explicit pointer. Preserve hard requirements such as no downtime, a deadline, limited access, or approval boundaries.

**3. Determine what constitutes a successful answer.** Before choosing evidence, reduce the request to a useful observable outcome: a direct yes/no; an accurate definition; a stated preference and reason; a defensible decision; a source-supported work story; an operational plan; or thoughtful questions for the interviewer. Write that answer in the first sentence. Do not first recite frameworks, tools, or vague qualifications.

**4. Set the correct evidence boundary.** The active original resume and original documents support candidate history. The JD describes desired work and relevance but **never proves** that the candidate did it. A previous model answer, generated dossier, conversation transcript, or interviewer suggestion cannot corroborate employer-specific incidents, metrics, certifications, achievements, or past actions. Unverified scenario details must be plainly conditional ("I would..."). Never take ownership of accepting risk or signing off an exception without original support and actual authority.

**5. Select only relevant evidence.** For an introduction or strengths question, synthesize the career and major contributions rather than forcing one random project. For a genuine experience story, pick one supported work area and explain the actual issue, independent review, action, and defensible result. For a concept, do not volunteer unrelated client history. For a detailed technical question, explain relevant mechanisms, failure points, tests, and tradeoffs when asked.

**6. Choose depth by the question, not by job title.** A director asking for the meaning of residual risk should receive the meaning, not six layers of infrastructure. An engineer asking how Kerberos authentication fails deserves technical detail. A question on risk management can be technical without turning into exploitation terminology. No fixed jargon percentage and no rule requiring a rejected alternative for every answer.

**7. Deliver in human speech.** Sentence one answers the question. Later sentences either explain *that same thing*, provide credible source-backed evidence, or address another explicitly requested part. Use natural connected English and only indispensable acronyms. Avoid artificial pauses, formatting, lists, repeated openings, and textbook conclusions. Stop when the answer is complete.

**8. Check the result before delivery.** Inspect the first sentence, requested facets, facts, relevance, necessary technical nouns, overlength, off-topic jargon, and natural spoken rhythm. For supported personal claims, keep provisional streaming guarded until postgeneration checks complete. If a fix is necessary, make a minimal rewrite and confirm it improved the **same** answer. Do not replace it with a different story. Fact verification is configuration dependent; it must never be portrayed as universal.

**9. Measure honestly.** Record latency from user submission to first *visible* words, total response time, and repair outcomes. Distinguish deterministic lexical checks from human semantic assessment and live-model comparisons. A report showing 54/54 unit tests is **not** proof of 54 high-quality live answers.

**10. Learn from failures without poisoning the source of truth.** Store a sanitized regression example: original question, expected intent, exact named facets, evidence boundaries, failure category, and desired answer behavior. Keep personal transcripts and resumes out of public repo fixtures. Test the correction against earlier cases to prevent regression. Promote only on green integration/build checks and a production READY deployment matching the merged commit SHA.

## Observed failures and their proper replacements

| Incoming situation | Wrong Kompas behavior | Correct behavior |
|---|---|---|
| Director: "What questions do you have?" | Explains SIEM, CyberArk, or vulnerability management | Asks one or two specific questions about team priorities, ownership and 90-day success |
| Director explains 27 control areas, no question | Starts an IAM or risk-architecture runbook | Acknowledges naturally if a reply is appropriate, otherwise waits for the next real question |
| "Tell me about a time you challenged a weak remediation plan" | Tool-name stack or fabricated confrontation | Grounded work area, weakness, evidence reviewed, respectful challenge, improved plan, closure test |
| "What would you bring?" | Picks one project and ignores broader work | Current and previous relevant experience, technical judgment, collaboration and risk oversight |
| "Policy deviation versus exception?" | Mentions generic compliance with no difference | Contrasts noncompliance with an approved, scoped, expiring departure, adds only requested context |
| "No downtime; how would you verify remediation?" | Suggests restart or a disruptive scanner | Preserves the constraint, proposes safe evidence and checks, makes a clear decision |
| "Which of those: NIST CSF, CRI or 800-53?" | Loses the compared frameworks or quotes unrelated tools | Compares the three named choices and states actual proficiency supported by the resume |
| "How does TLS validation work?" | Too superficial from a global brevity rule | Technical explanation of certificate chain, name, expiry, trust and failure handling because detail was requested |

## Technical boundaries

- **Canonical server:** `src/lib/kompasAnswerService.ts`.
- **Intent and length routing:** `src/lib/kompasRelevance.ts`.
- **Current-question recovery:** `src/lib/kompasRelevanceRecovery.ts`.
- **Latest question segmentation:** `src/lib/kompasIntentKernel.ts`. Extracts the current ask, immediate constraints, and explicit reference to setup choices; does not claim to be semantic AI.
- **Question facets:** `src/lib/kompasInterviewPrecision.ts`.
- **Personal-answer streaming and original-source separation:** `src/lib/kompasStreamIntegrity.ts`.
- **Regression cases:** `scripts/fixtures/kompas-50fold-intents.json`, `scripts/fixtures/kompas-54-intent-kernel.json`, related node:test suites.
- **Actual paired-response comparison:** `scripts/kompas-relevance-review.mjs`; objective flags only until a human assesses real outputs.
- **Shared channels:** Desktop/web and WhatsApp must route through the MFit answer service. A passing HTTP/contract test does not demonstrate native audio or authenticated delivery.

## Release acceptance

The **minimum code gate** is lint + typecheck + existing 50 cumulative relevance cases + 54 boundary/constraint cases + source/stream integrity tests + desktop/WhatsApp/voice integration suites + Webpack build. Every new defect should become a regression.

The **live quality gate** is a consented set of at least 50 real paired candidate responses from identical source materials and question conditions. Review exact intent, requested terms, evidence support, unnecessary jargon, clarity, spoken delivery, and latency separately. Factual claims not explicitly established by the resume are not "verified" merely because they sound plausible.

A "chief" does not maximize technical verbosity. It learns what the person needs, selects sound evidence, gives the smallest complete answer, and knows precisely when detail is necessary. Preserve that decision priority during every later feature addition.


## 10 November 2026 — current release and acceptance ledger

Production alias `job-dashboard-fawn.vercel.app` is READY at `a66c108bff6175149c4aadd882ab11128445b8cc`. Commit ancestry confirms it includes the merged question-first/relevance chain: PR #113 (50-fold relevance discipline), PR #114 (current ask/constraints kernel), validation-only PR #115, and later answer-shape PRs #252, #253 and #258. This confirms release ancestry only; it does not establish live paired-answer quality.

Open follow-up branches:
- PR #262, “Answer the question on the card, and do not reuse a neighbouring sheet entry”, is OPEN, `mergeable=false`, based on `e93c737` rather than current master `f7f322f`. Its Vercel preview is READY, but no exact-head full CI run was found. Review and restack only after preserving the intervening #258 and master changes; then require exact full CI and the same-question live acceptance below.
- PR #234, “Keep a coherent Kompas question window, not only the last fragment”, is OPEN, `mergeable=false`, based on older `3e2d235`. Its preview is READY, but its recorded suite had 197 pass / 2 fail and no exact-head full CI is verified. Do not treat it as released.
- PR #270 audio-provenance type narrowing is DRAFT and belongs to the active Kompas Continuous Voice Delivery task. Keep voice, microphone, caption and audio changes with that task; do not duplicate its edits.

The live 50-pair benchmark remains a hard acceptance gap. It requires the authorized private `KOMPAS_API_TOKEN`, approved original resume/JD/reference bundles, actual same-question Kompas and ChatGPT responses, and independent human 0–4 scorecards. Synthetic 50/54-fold fixtures, unit tests, source review or a READY preview are not substitutes. No real paired responses or human scores are available in this run.

Issue #152 remains OPEN because the authenticated exact-head preview HTTP gate lacks the private `KOMPAS_VERCEL_PREVIEW_BYPASS`. The separate PR #278 voice preview gate reported `KOMPAS_VERCEL_API_TOKEN` empty. Never print credentials, disable Vercel protection or bypass a failed/skipped gate. Coordinate all voice-gate changes with Kompas Continuous Voice Delivery.

Continue: reconcile PR #262 against current master without discarding #258, obtain exact-head full CI, then run the authorized 50-pair comparison and human review. Only after full shared web/desktop/WhatsApp integration and a READY production alias can this branch be considered released. Native Windows/WhatsApp/mobile voice E2E remains unverified.


## 20 November 2026 — PR #462 approval boundary and current release

The owner-approved evidence rule remains: the job description describes desired work; it never proves that the candidate performed it. A tool named only in the JD must not be stated as personal experience, and conditional “I would” language remains conditional. This is the basis for the JD-only tool filter in PR #462.

The separate capture heuristics in PR #462 are **not directly owner-approved in the accessible prior-conversation context**. Retrieval found owner requests on 1 November 2026 for Windows Live Captions to feed the question/answer path and for negligible latency, plus a 2 November correction rejecting tail truncation and requiring the complete question ending. It did not find direct owner wording approving candidate-side speech suppression, a 30-second duplicate window, dropping pre-Start transcript lines, or the Listening / Question detected / Answering labels. This is a scoped search, not a claim that every conversation was accessible.

PR #462 exact-head CI, Kompas baseline, cross-device, Plan/REA and Windows package gates passed. It was merged by `cursor[bot]` as `4f5030938b6b13b7996fb215e35b8aebad2230b2` and is now behind the canonical production alias. The PR body said “No [ship] on this commit” while the resulting merge commit begins `[ship]`; the Git-linked pipeline deployed it. No PR review was recorded. Treat the new capture heuristics as proposed, not owner-accepted; do not extend or claim their acceptance without a direct owner decision. The JD-only evidence filter remains aligned with the approved Chief Relevance rule.

Actual Windows Live Captions listen-through, complete-tail preservation and native acceptance remain unverified. A synthetic 20/20 suite and a READY deployment are not substitutes. Any rollback must be narrowly scoped to the unapproved capture heuristics and must preserve the JD-only evidence filter; do not change production behavior without a separate owner decision.



## 27 November 2026 — run 28 current cross-platform checkpoint

Production master `1eb604b33cfe58f3c0f6ad611d346d5921e184ff` is docs-only and the canonical Vercel alias remains READY at runtime `a17b3267e271c77cd8887312445271b7fa172bd0`; no runtime release occurred. Production Supabase aggregate read-only: 22 session rows (15 active, 7 tombstones) for one owner; 28 artifacts across 13 sessions, one owner; 0 active payload-ID mismatches. This is persisted-data evidence only, not signed-in two-device or Windows/WhatsApp convergence.

- PR #600 WhatsApp explicit same-account library fallback: exact head `c8a725`, all four CI/recovery/schema/baseline gates SUCCESS; still DRAFT with no protected preview, real Meta send/replay or owner-device acceptance.
- PR #598 resume confirmed-skill alignment: new source commit `c7e3939` plus docs `487f1d6`; exact-head CI/focused/recovery IN_PROGRESS, schema/baseline SUCCESS. The source-derived actor attribution guard passes 13/13 isolated simulation cases. Keep unmerged pending remote CI, protected preview and real resume/JD/confirmation/DOCX acceptance.
- Actual 50-pair Kompas/ChatGPT answer comparison, human 8-axis scoring, native Windows speech and WhatsApp latency/parity remain open (#120). Refresh-token family rotation (#147) and unified web/Windows/WhatsApp session discovery (#148) remain open. No private token, answer bundle, Windows/phone access or authenticated E2E was available.

