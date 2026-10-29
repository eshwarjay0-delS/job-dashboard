# Chief Engineering Handoff — Kompas Relevance & Interview Answer Quality
Date: 28 October 2026
Canonical system: **MFit Kompas**. The Windows desktop shell and WhatsApp channel call the shared MFit answer route. Do not create a separate legacy perfACT answer engine.

## Mission and working standard
A capable interview candidate answers the **meaning of the latest actual question**, preserves exactly named subjects and constraints, gives the smallest amount of useful evidence, and ends when the question is answered. Technical vocabulary is not proof of expertise. Detailed mechanisms matter when the interviewer asks for them; they make a short conversation worse when unasked. An engineer's answer must be mechanically correct, a director's answer must make ownership/risk/trade-offs understandable, and both must be conversational.

**Leadership acceptance:** a candidate should be able to speak the full answer in one paragraph without translating jargon, removing invented accomplishments, or explaining why it is relevant.

## The reproducible decision process (not hidden reasoning)
1. **Get the actual current ask.** Respect a pinned question if present. In messy ASR, isolate the last meaningful interviewer request. Treat a non-question manager statement as information, not permission to give an architecture lecture. Do not blend two unrelated turns.
2. **Identify its action.** Is the interviewer asking the candidate to confirm, describe experience, compare, explain a concept, solve a situation, demonstrate past work, or ask the interviewer something? Use the question's wording; do not infer a project because a word resembles a resume keyword.
3. **Extract explicit requirements only.** Preserve named controls, risk components, frameworks, tools, numbers, constraints, and subparts actually requested. Do not copy unrelated setup vocabulary into compulsory coverage.
4. **Bound prior context.** Pull a specific prior interviewer subject only when the question is elliptical ("How did you verify that?"). Keep session history as context, not a second task. Never use previous AI output as independently verified personal evidence.
5. **Choose answer shape and length.** A definition should define; a preference should decide; a broad strengths question should synthesize the career; a manager statement needs concise acknowledgement; a requested technical deep dive can follow mechanisms, failure modes and checks.
6. **Choose source evidence.** The current original resume and genuinely original attached documents ground personal names, dates, roles, responsibilities, results, project incidents and metrics. The JD sets relevance, never proof of a personal claim. An illustrative response must be conditional if the specific event is not substantiated.
7. **Draft in spoken first person.** Sentence one makes the requested point. Following sentences connect each requested part to an observable check, relevant experience or decision. Do not insert a novelty term just to sound intelligent. Avoid forced STAR/owner/KPI frameworks when unasked.
8. **Check response fit.** Ask whether all explicit parts were addressed, whether there are off-topic mechanisms, whether it implies unsupported personal ownership, and whether a natural speaker would say it comfortably. Automated checks are warning signs, not semantic judges.
9. **Repair narrowly.** If a named part is absent, request a rewrite only for that part. If an irrelevant technical tangent appears on a soft question, remove it without replacing it with a different tangent. Preserve other validated detail. Never "repair" by fabricating a time, metric or incident.
10. **Release and measure.** Hold personal-history text until final deterministic safeguards; record both upstream-first-token and first-visible-response time. Technical content may still stream provisionally and can be corrected. Assess the deployed UI and actual speech separately.

## Strong answers vs failure patterns
- "What would you bring to BNY?" → technical understanding + independent challenge + clear business-risk communication across source-supported roles. **Not:** 12 offensive tooling names or a single unrelated exploit.
- "What questions do you have?" → one or two thoughtful questions on real team priorities, autonomy and success. **Not:** answer your own question or present another biography.
- "How do you assess business impact, root cause, compensating controls and residual risk?" → explicitly address all four with concrete checks. **Not:** a generic SIEM dashboard.
- "Tell me about a time you challenged a weak remediation plan." → supported work area, challenge, actual evidence, fix criteria and verification; do not promote a resume duty into a fabricated conflict meeting.
- "What is NLA?" → definition and purpose. **Not:** an unrelated pen-testing or governance story.
- "How exactly does Kerberos work?" → protocol flow, parties, tickets, assumptions, where it fails, and what evidence tests the hypothesis.
- "The first ninety days are for independence across 27 control teams." → acknowledge the expectation and connect to the same issue-management role; don't invent a new deliverable.

## System integration
- Shared engine: src/lib/kompasAnswerService.ts
- Question-level rediscovery: src/lib/kompasRelevanceRecovery.ts
- Intent/length/terminology relevance: src/lib/kompasRelevance.ts
- Known explicit risk facets: src/lib/kompasInterviewPrecision.ts
- Original-source grounded stream: src/lib/kompasStreamIntegrity.ts and src/lib/kompasGuards.ts
- Web/desktop shell sends requests to /api/kompas/answer; do not maintain a duplicate answer prompt in the Electron wrapper.
- WhatsApp Kompas uses the same verified shared-turn function; a cross-channel response must not bypass the original-source controls.
- Regression fixtures: scripts/fixtures/kompas-50fold-intents.json
- Tests: scripts/tests/kompas-50fold-relevance.test.mjs and scripts/tests/kompas-relevance-recovery.test.mjs
- Side-by-side comparator: scripts/kompas-relevance-review.mjs

## Known bottlenecks, non-negotiable cautions
- **Keyword heuristics are weak evidence of meaning.** A regex missing a synonym can create an unnecessary rewrite. Keyword presence can also appear in nonsense. Human-judged paired outputs are the actual acceptance standard.
- **Old prompts were conflicting.** "60/40 technical" and "show a rejected option on every answer" caused needless jargon. New question-level intent has priority; never re-add global detail quotas.
- **Prior generated prep may contain fabricated moments.** Never promote them into first-person memories. Original resume may still contain unverified claims; do not announce them as audited truth.
- **Story rotation should not run on general questions.** Reserve bottleneck/project rotation for genuine experience stories and targeted follow-ups.
- **A follow-up must stay anchored.** Recover only the most recent interviewer subject, never scrape arbitrary candidate speech.
- **Holding personal deltas can increase time to first visible answer.** Report the difference; do not claim instantaneous results from upstream token timing.
- **Model-level verification remains optional/config-dependent.** Phrase "source-backed" as a goal rather than a guarantee. Never claim 100% hallucination prevention.
- **CI deterministic cases are not actual AI trials.** The 50-fold loops are cumulative synthetic regressions, not 50 live generations or 50 deployment versions.
- **One canonical route.** Every platform must share prompt and source checks; desktop/WhatsApp require independent authenticated integration and voice tests.
- **Build parity.** Vercel and GitHub Actions use Next.js Webpack mode; previous Turbopack font resolver caused production failure.

## Acceptance scorecard — measure real output, do not game a synthetic number
For each of at least 50 same-question pairs capture: exact question; original source resume/JD fingerprint; intended topics/constraints; ChatGPT benchmark answer; actual Kompas answer; engine commit; active model; question intent; directness; required facet coverage; irrelevant technical material; unsupported personal claims; technical accuracy; naturalness; word count; time to first visible answer; total time; repair count; speech playback errors. Human reviewers should record a short rationale for every failed item and the minimal corrective change.

Evaluate in the user's actual configuration on web, desktop, and WhatsApp. Batch suites for reproducibility; commit substantive fixes with clear test evidence, rerun the entire suite after every change, and promote only with green CI and an exact READY production SHA. Do not create meaningless commits just to reach a nominal version count.

## Release status (update with evidence)
The current branch adds deterministic fifty-question intent and rediscovery tests. Actual authenticated model generations, desktop/WhatsApp user-session comparisons, full live quality acceptance and post-release speech metrics remain **pending** until proven by outputs. Update this section only from real CI/deployment/model evidence.
