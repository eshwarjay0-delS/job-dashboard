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
