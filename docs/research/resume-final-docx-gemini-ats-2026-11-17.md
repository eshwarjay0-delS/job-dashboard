# Final exported-DOCX Gemini ATS review — current-master restack (17 November 2026)

## Owner approval

The owner approved this loop in the 3 November 2026 conversation at 16:20:28 UTC. The required first Gemini instruction after each complete resume DOCX export is exactly:

> Give me an ATS score

The owner also required assistant-side evidence analysis of the returned score and remaining/weak terms, evidence-supported correction only, and a new export/recheck within a bounded retry budget. The source for this approval is recorded in the owner-authored discussion on [PR #395](https://github.com/eshwarjay0-delS/job-dashboard/pull/395). This is not a claim that every prior conversation is accessible.

## Contract and evidence boundaries

- Gemini reviews text extracted from the actual final DOCX buffer, the original JD, and the canonical JD target-term list.
- Gemini's score and missing/weak lists are diagnostic. They do not replace deterministic exported-byte coverage, ATS parseability, supported coverage, or factual evidence gates.
- The JD is target context, not candidate evidence. Corrections may use the selected source resume or an explicit candidate confirmation. The current confirmed-skill rule does not impose a first-person-only phrasing requirement.
- A confirmed skill may map across roles only when the existing project's context fits the skill family. It cannot create an employer, project, action, outcome, date, title, location, contact, metric, credential, or unrelated project detail.
- Unsupported JD terms remain disclosed as gaps; they are never asserted as candidate experience. A model score cannot make an unsupported term eligible.
- The loop is bounded to at most two evidence-only correction rounds. Every accepted correction is regenerated into a DOCX, re-extracted and reviewed again. Refinement requests are preserved rather than automatically rewritten.
- Missing Gemini credentials, invalid responses, unavailable DOCX text, incomplete/skills-only out...[truncated]