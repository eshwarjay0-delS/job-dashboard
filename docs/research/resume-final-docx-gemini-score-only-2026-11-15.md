# Final exported-DOCX Gemini ATS review — score-only scope

**Approval source:** the owner's 6 November correction, reiterated in owner-authored [PR #319 comment 6817645128](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6817645128), requires the final exported DOCX to receive the exact Gemini diagnostic prompt **“Give me ATS score”** and actual measured coverage. The score and suggestions are diagnostics, never candidate-experience evidence.

## Scope implemented in this branch

- After the document has been exported and the normal deterministic checks have run, extract text from the actual DOCX bytes with `docxText(best.buffer)`.
- Make one Gemini-only, bounded review call with the full JD, the exported DOCX text, and the canonical JD target terms.
- Require a bounded numeric score and accept missing/weak terms only when they normalize to an exact canonical target term.
- Return the review status, score, missing terms and weak terms in the tailor result and its notes.
- Reserve a bounded time window for the call. If there is no Gemini key, the document is incomplete/skills-only, time is exhausted, export extraction fails, or Gemini returns invalid/unavailable output, record the corresponding skipped/unavailable status.
- Keep deterministic exported-document coverage, identity checks, role evidence, WhatsApp delivery policy, and the existing 95% web / 98% evidence target unchanged.

## Explicit exclusion

The separate automatic correction/re-export/re-review loop present in the draft PR #395 is **not included**. Accessible owner-authored context confirms the diagnostic review, but does not confirm automatic Gemini-driven edits. Gemini must not rewrite the resume, add qualifications, assign skills to employers, or alter the delivery gate.

## Validation and release status

- New helper tests cover the exact prompt, real-export input contract, score bounds, malformed responses, canonical-term filtering, normalization and deduplication.
- Source-contract tests require one diagnostic call on the actual exported bytes and prohibit a Gemini-driven correction loop.
- The tests are wired into the package prebuild and full CI.
- No personal resume/JD was processed, no Gemini model call was made, and no DOCX was generated in this scheduled run.
- This is source code on a draft branch, not a deployed or accepted feature. The protected Vercel preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run. Actual acceptance also requires an owner-authorized baseline resume, full JD, explicit first-person confirmations where needed, and inspection of the resulting exported DOCX.

## Next

Run the exact-head full CI, Kompas baseline and Plan/REA schema checks; obtain the legitimate protected preview; then run the authorized source/JD/confirmation through the real export and verify the actual Gemini review and deterministic coverage. Do not claim a 98% live match from these source tests.
