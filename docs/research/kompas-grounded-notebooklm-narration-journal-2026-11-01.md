# Research journal — grounded, natural Kompas narration
**Date:** 2026-11-01  
**Scope:** Canonical MFit Kompas shared answer engine, web/Windows/WhatsApp callers  
**Status:** Source-informed design + deterministic regression; actual LLM/voice acceptance pending  
**Owner requirement:** Keep NotebookLM's calm, natural explanatory feel, but answer as one experienced, technically credible human. Favor real production bottlenecks, causal reasoning, testable hypotheses and proof. Avoid childish apartment/door/key metaphors, empty charm, forced jokes, and manufactured workplace stories.

## Sources and boundaries (what was actually available)

| Reference | Evidence type | What it can support | What it cannot support |
| --- | --- | --- | --- |
| `Mastering_the_Blast_Radius_of_Privileged_Access.txt` (Library) | Complete annotated text with 389 turns, 10,225 words, pause/F0/speed metrics; earlier uploaded recording was analyzed | Alternating challenge and explanation; early concrete discrepancy; the claim-evidence turn; natural handoffs; progressive disclosure | Candidate biography or accurate clinical/privilege incident facts merely because synthetic hosts narrated them |
| `M4A_Recovered_Transcripts_Combined_5_Matched.txt` (Library) | Five previously recovered timestamped automatic transcripts | Semantically observable: objection -> mechanism -> real production failure -> better engineering decision; example: local simulator success versus physical mobile failure; generated code versus actual authenticated backend | Exact speaker identity, acoustic timing for every recording, or proof the original examples occurred to this candidate |
| `data/kompas/narration/notebooklm_audio_cases_20261005.jsonl` | Five previous acoustic analyses | Measured speech occupancy ~0.863–0.892; median pause ~0.389–0.415 seconds; pause-event rate ~14.87–17.62/min; differing pacing among technical, institutional and business explainers | Semantic assertions about the contents: all five rows explicitly mark `semantic_status:pending_transcript` |
| `data/kompas/evals/narration_maturity_v1.jsonl` | Synthetic evaluation patterns built from user's goals and acoustic data | Useful archetype seeds: architect/engineer/director variants, difficult tradeoffs, and hypothesis challenges | Evidence of a successful live Kompas answer or of transcription-grounded NotebookLM semantics |
| `ULTIMATE_BNY_In_Person_Deep_Learning_Master.pdf` + submitted resume (conversation) | Synthesized study guide and stated candidate experience | BNY control issue questions, IAM, ServiceNow, root-cause vs symptom, evidence validation; source-specific preparation examples | A generated STAR answer is not proof of a distinct real incident or metric |
| `kompas_Security-Analyst-III_2026-10-27_17-21.txt` and ParakeetAI historical interview transcript (conversation) | Historical model answers and other-candidate interviewer questions | Wording, repeated followups, the interviewer asking for actual artifacts, authorization and recurrence prevention | Candidate truth, factual provenance, or proof of directly configured systems |
| `Why_Closed_Vulnerability_Tickets_Are_Dangerous.m4a` + `BNY_Security_Analyst_III_Interview_Guide.m4a` (current conversation) | Original audio without full transcript | Existence, media metadata, a research question about closure vs exposure | **No verbatim semantic analysis**: the linked transcription service was blocked by its media allowance |
| Google Gemini Notebook official help (retrieved Nov 1) | Public product documentation | Deep Dive, Brief, Critique and Debate are pedagogical audio formats grounded in notebook sources, with potential mistakes | Internal Google prompting architecture, a personal Notebook API integration, or guarantee of factual accuracy |

Official source: https://support.google.com/gemininotebook/answer/16212820?hl=en

## New observations from transcript comparison

1. **The engaging part is a contradiction, not an analogy.** The annotated PAM narration opens with conventional confidence in visible evidence before introducing an attacker using a legitimate credential. The useful technical point is that an ordinary-looking login can be unauthorized. For an interview, compress that into the candidate's own voice: *"The account looked normal. What I would need to establish is whether the identity, device, access path and requested privilege matched the approved work."* Do not copy the podcast hosts' stage dialogue, emotional praise, or invented candidate-specific claim.

2. **The best explanation changes the listener's model of the system.** The recovered AI-product transcript contrasts localhost success with a real Android failure, then explains the missing architecture and mobile-device assumptions. Transfer the structure, not the invented facts: **observed result -> plausible assumption -> counterexample -> exact system boundary -> test -> decision**. For an IAM control, compare "provisioning task completed" with actual entitlement in the target application. For vulnerability closure, compare "scanner no longer shows CVE" with scanner coverage and effective patch state.

3. **Technical character emerges through a concrete check.** A useful explanation identifies where a technician looks and what two observations would mean. "I checked the role mapping" is weaker than differentiating the IGA certified entitlement from the target system's effective nested-group grant. But an imagined result must stay hypothetical.

4. **NotebookLM's two-speaker turns are a learning tool, not the interview output format.** The skeptic's challenge should happen silently inside Kompas as a falsification test. The final answer has a single speaker, who calmly anticipates the realistic pushback and addresses it once without banter.

5. **Naturalness is bounded by the question.** A definition should not require a STAR incident, emotional image, fake 'human beat', or rhetorical question. A first-person experience story can carry actual people and obstacles only if the original resume and candidate notes establish them. A follow-up should not restart a long narrative. A director wants the risk decision, not five unrelated low-level log sources.

6. **Charisma is precision delivered without condescension.** Let the technical discrepancy carry interest. Unearned confidence, dramatic "great question" reactions, contrived analogies, hardcoded 'diamond' hooks and repeated slogans weaken credibility.

## Current code review — Cursor/Grokbot-era work preserved

- Latest inspected master SHA `9693bce75014e36af1cdddae171217b38ff4055e` at Nov 1 13:44 UTC. Recent changes introduce document-first dossier lookup (`19489afddc`), owner-bound auth (`a80044fd9b`), session editing (`f5d01af975`), desktop auth renewal, cross-account isolation, and practice-angle rotation (`373554226c`). Keep all of these; none is a narration replacement.
- `src/lib/kompasAudience.ts` contains `CALIBRATION`, `RELEVANCE`, `NARRATION`, `INTERVIEW`, and `STORYTELLER`. The existing `STORYTELLER` asks for a "picture", being "funny" and "charismatic" on **every answer**, and an everyday scene. Those unconditional instructions can defeat question scope and produce the owner's disliked apartment-key comparisons.
- `src/lib/kompasAnswerService.ts` uses the shared audience guidance for the actual answer route; changing that single point reaches all clients of the shared engine, without a second perfACT backend.
- Personal experiences must still obey guarded-final streaming and the existing evidence policy. Existing source flags cannot prove an LLM never invents an incident. Previously saved candidate answers remain unverified.
- Prior user research already includes five acoustic cases and synthetic eval prompts. This change adds **transcript-grounded semantic analysis of the recovered texts**, and does not rebrand the acoustic-only cases as semantically verified.

## Implementation — workbench narration v1

A new small `src/lib/kompasNaturalNarration.ts` runs **after** the original audience/storytelling clauses. It does not throw away their benefits or the engineering/director modes. It gives the highest-recency instruction: question relevance, factual authenticity, and one grounded causal thread take precedence over staged imagery and comedy. It chooses a short behavior based on the **current question shape**, not the employer keyword:

- **Identity:** documented career arc, connected contributions, no made-up pivotal life event.
- **Experience:** genuinely supported incident -> personal responsibility -> mechanism -> actual friction -> testable result. STAR stays invisible.
- **Scenario:** assumption -> possible disproof -> real constraint -> safe action -> validation. Hypothetical tense remains explicit.
- **Follow-up:** same case, exact artifact/field/log/test/approval question, no story restart or rotated employer.
- **Mechanism:** precise cause-and-effect steps, relevant contrast only, technical detail only when asked.
- **Direct:** no forced anecdote for a short definition, comparison, personal fact or logistics.
- **Audience:** engineer sees checks, architect sees boundaries, director sees risk/ownership, mixed audience gets a simple consequence without distortion.

This is a **prompt-calibration change**. It does not create a real NotebookLM service integration, record new candidate incidents, synthesize audio, or provide proof of improved real-model performance.

## Examples of better delivery (illustrative, NOT first-person evidence)

**BNY closed vulnerability ticket (scenario).**  
"Before calling it resolved, I'd distinguish the ticket status from the state of the system. A scanner can go quiet because the device was patched, but also because its credential stopped working or the asset fell outside the scan scope. I'd compare the affected population, authenticated coverage and software state against the original finding. Only then would I say the exposure is closed. Otherwise we closed paperwork, not the weakness."

**CyberArk EPM policy scenario.**  
"A blocked executable is not automatically a bad executable. I'd check the policy decision and the executable's publisher, path, process relationship and elevation requirement, then distinguish a genuine business dependency from a bypass opportunity. If the software is legitimate, I'd test the narrowest rule in a pilot rather than opening a broad exception. The hard part is preserving control without making operations route around it."

**Tech direct fact.**  
"Residual risk is what remains after the controls actually operating are taken into account. A remediation task can finish while that exposure still exists."

These are teaching examples, not claims that the candidate personally experienced the incidents.

## Research questions and real acceptance gates

1. Run 50 diversified **authenticated model answers**, mixed EPM/GRC, definitions, first-person stories, drifted transcripts and follow-up chains; use the exact consented resume/JD source fingerprint per case. Inspect source support for every personal claim, mechanism and metric.
2. Compare old/new answers blind, by case, without the evaluator knowing which version is new. Grade scope, mechanical accuracy, believable workbench voice, clarity, specific grounded bottleneck, invented scene/analogy risk, continuity, non-repetition, and director/engineer usefulness. Keep original text.
3. Measure first-visible and complete-response latency; additional prompt tokens may have a measurable cost. Guarded-final personal answers preserve current privacy/credibility boundary.
4. Run original desktop, web, WhatsApp and phone voice acceptance separately. A 50-case deterministic prompt suite is not native microphone/voice acceptance.
5. Keep source provenance for NotebookLM-style transcripts as teaching-only. New recordings need real transcription before claiming semantic dissection.
6. If the extra instruction increases unasked metaphors, unsupported first-person claims, skipped subparts or latency beyond agreed limits, roll back the isolated narration change without touching current authentication/session work.

## Research conclusion

**The most natural answer is not the one that sounds most like a podcast.** It is the one that spots the real-world contradiction, explains the mechanism well enough to be challenged, admits the operational cost, and ends with evidence that would justify a decision.

The research and deterministic tests establish an implementable narration specification. Whether actual Kompas outputs meet it must be independently measured after deployment.
