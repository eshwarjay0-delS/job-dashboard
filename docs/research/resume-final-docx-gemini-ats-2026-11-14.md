# Final exported-DOCX Gemini ATS review — 14 November 2026

## Owner approval

The owner approved this loop on 3 November 2026 at 16:20:28 UTC. After each complete resume DOCX export, the first Gemini instruction must be exactly:

> Give me ATS score

The review receives the original job description, the canonical JD target-term list, and text extracted from the actual exported DOCX. The owner's follow-up also requires assistant-side evidence analysis after Gemini's review and a 95–100% target only where genuinely supported.

## Decision and evidence boundaries

- Gemini's 0–100 score and missing/weak term lists are diagnostic. They do not change deterministic exported-byte coverage, ATS parseability, supported coverage, or the quality gate.
- The JD is target context, not candidate evidence. A correction may use only the selected source resume or an explicit first-person candidate confirmation.
- A confirmed skill may be mapped across roles only when the original bullet's project context fits that skill family. It cannot create an employer, project, action, outcome, date, title, location, contact, metric, credential, or unrelated project detail.
- A weak term may be rewritten in an existing role only when the source or confirmation supports it in that role's context. A missing term already present in the final document is not blindly rewritten.
- The loop permits at most two evidence-only correction rounds, bounded by the request time budget. Every accepted correction is re-exported and reviewed again.
- Missing Gemini credentials, invalid responses, unavailable DOCX text, incomplete/skills-only output, or exhausted time budget are recorded as skipped/unavailable. They do not create a clean ATS pass.
- User-requested refinements are preserved; the ATS loop does not automatically rewrite a refinement.
- The 6 November WhatsApp gap-disclosure and same-account fallback policy is unchanged.

## Current implementation slice

The prior implementation in PR #289 was stacked on superseded writer PR #287 and could not be merged independently. This continuation carries the final-DOCX review onto the current evidence-bound confirmed-skill branch fix/resume-confirmed-skill-current-3e710-20261114-run13 without copying unrelated WhatsApp runtime changes.

The code adds:
- A strict Gemini-only reviewer with the exact owner-approved first instruction and a parser that accepts only canonical JD terms.
- Review of the actual generated DOCX buffer through the existing DOCX text extractor.
- Separate gemini_ats_review diagnostics in the result, leaving deterministic coverage as the authority.
- Bounded, evidence-filtered corrections and re-export/re-review.
- Explicit propagation of the latest confirmed-skill set into role gap-fill and the final role-context guard, including weak-term rewrites only in relevant existing project frames.
- Helper, source-contract, cross-role confirmation and WhatsApp policy regression tests.

## Validation and release status

- Parent PR #393 is a DRAFT current-master restack at 9cd81927b095289de0e4a39da74a8af2265cbc43; its exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA checks passed. It remains blocked on legitimate protected preview and owner-authorized baseline/JD/confirmation DOCX acceptance.
- The new Gemini branch is stacked on that parent. Exact head `6cb3a8896772ac90758662a533260cf34a7ed99c` passed final-DOCX ATS review workflow `43599223875` (including `npm run check` and focused tests), WhatsApp recovery `43599223815`, and Plan/REA schema `43599223837`. These exact-head source gates supersede the earlier pending-at-creation status. Full master-targeted CI remains deferred until the parent is accepted and the stack is retargeted.
- The protected preview requires an authorized administrator to configure the private KOMPAS_VERCEL_API_TOKEN. Do not bypass deployment protection or change ignore rules.
- After the parent is accepted and the stack can target master, run full CI on the exact final head. Then use an owner-authorized original resume, JD and explicit first-person confirmations; inspect the actual exported DOCX bytes and role-by-role evidence; verify Gemini's diagnostic review and supported-only corrections.
- No personal resume/JD was processed, no Gemini model call was made, no DOCX was exported, no production deployment occurred, and no live 98% match is claimed.

## Historical WhatsApp incident remains separate

The 17 October 2026 17:28 Chicago WhatsApp resume incident remains unresolved. The exact generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID, and signed delivered/read receipt are missing. Conflicting source facts remain quarantined. Do not replay, resend, substitute another DOCX, or claim delivery.
