# Kompas personal-answer streaming integrity — 28 October 2026

## Why this change was approved
The earlier BNY Security Analyst III interview comparison highlighted that unsupported first-person incidents, metrics and authorities sometimes reached the live response. PR #109 improved question precision and factual presentation, but the streaming response still sent raw model words to the live card **before** the complete deterministic grounding and optional fact check. In a live interview the candidate could read an early invented claim before final replacement corrected it.

## New behavior in the canonical MFit Kompas service
- T0 introductions, T1 personal stories, T3 project follow-ups and T4 career facts now use a **guarded-final** response path; named-employer personal-value requests that are classified as general questions also use it. The full answer reaches the card as one final `replace` event after guards, not as unreviewed `delta` events.
- General concept/design/technical questions keep **progressive** streaming to preserve rapid first text. Existing frontend SSE handling accepts both modes without splitting into two engines.
- Source checks use the candidate's resume and original documents, **not** JD requirements or generated background. Interviewer-suggested numbers are not achievement evidence.
- An optional model fact-check does not convert a natural spoken paragraph into a Markdown list.
- Telemetry now differentiates upstream first token `first_ms` from the user's first visible answer `visible_first_ms` for honest latency assessment.

## Evidence and remaining limitations
- A guarded-final response is not automatically independently fact-verified: deterministic guards check known unsupported patterns and figures, and optional fact verification runs only when `KOMPAS_VERIFY=1` with source facts available. This system does not guarantee elimination of all hallucinations, especially detailed events not corroborated in the resume.
- Holding personal text increases time to first **visible** content, while leaving the upstream generation latency unchanged. Measure both before tuning for speed. A progress status may appear while waiting.
- The 21 cumulative policy scenarios and additional regression tests validate deterministic behavior; they are **not** 21 live LLM generations, a live desktop speech run, or proof of word-level meaning. Do not infer production quality solely from their pass results.
- Existing open issue: progressive technical responses may still display provisional text before full-answer correction. Expanding the guarded-final policy to every answer would trade speed for consistency and requires separate measured approval.
- No personal interview transcript or confidential resume is stored in the repository.

## Acceptance checklist
1. Node test suite and baseline must pass; typecheck, adjacent Kompas/WhatsApp/voice tests and Webpack build must be green.
2. Vercel preview READY at exact feature commit; PR merge checks and final production deployment READY at exact merge SHA.
3. Measure actual first-visible and total time for at least 20 approved question/reply pairs, including intro, technical, project story and follow-ups, with the same source resume and JD.
4. Inspect every finished answer for requested subparts, relevant terminology, unsupported personal claims, real technical depth and believable spoken voice.
5. Verify native desktop/hosted web display and any voice playback separately. Do not claim authenticated audio acceptance from CI tests.
