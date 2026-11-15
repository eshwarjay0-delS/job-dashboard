# Confirmed-skill resume alignment — 15 November 2026

## Owner approval and scope

The owner-authored 6 November correction is recorded in [PR #319 comment 6817645128](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6817645128). It approves mapping an explicitly first-person-confirmed skill naturally into relevant existing project bullets across roles, including earlier roles, without requiring the original bullet in that same role to name the tool.

A confirmation supports the named skill only. It does not authorize a new employer, project, action, outcome, date, title, location, contact detail, metric, credential or unsupported project fact. JD wording, target scores and editing instructions are not candidate evidence. Keep the Houston and Saint Louis profile libraries separate.

## Current-master source finding

Canonical master at the start of this restack was `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`. Its `src/lib/claude.ts` still contained contradictory legacy instructions: treat the JD as the skill set to represent, say the candidate claims the JD skill set, do not refuse terms omitted from the source, and spread JD tools across every role. Other sections of the same prompt said not to invent experience. That contradiction undermined the approved evidence boundary.

The source-only correction already existed in PR #400, but that branch was based on older master `46043ec6ca926b2ab82424d255367426685f294d`. It was restacked onto current master rather than copied over the newer WhatsApp fixture-privacy changes.

## Implementation on the current-master restack

Branch: `fix/resume-confirmed-skill-alignment-master-8ad319-20261115`

- `src/lib/claude.ts` now treats the JD as target requirements, not candidate history. It permits only source-supported or explicitly confirmed skills and allows cross-role mapping only into relevant existing project context.
- The prompt explicitly prevents the JD, a formatting instruction or a target score from confirming experience. A confirmed skill does not create an employer, project, action, outcome, date, title, location, contact, metric or credential.
- `src/lib/resume-evidence.ts` separates candidate confirmations from JD requirements, retains positive candidate statements, and scopes missing terms to relevant role context.
- `src/lib/tailor.ts` applies role-scoped gap repair and a deterministic restoration guard for unsupported role edits.
- Existing positive/negative evidence tests were carried forward. A new prompt-contract regression reads the actual writer prompt, asserts the approved boundary, and rejects the contradictory legacy instructions.

Source commits: `4eba406347ae25a22a544a123759a9a37dcc3894`, `d7c99275834c9de5fd9af7b670e3c83e040e9415`, `23b0fd0c077379b760f3b59bc2f9ed1d657fa01c`, `856894210dcc22366e7a2ee1c7979c8ba151be5d`, `2036d6886cdb3ea466bc1f87eee98e1f144f668e`.

## Validation and limitations

The previous PR #400 head `a58cf550a1c21137db24e10a3bbe50d7c683b6ea` passed full CI `43629917653`, WhatsApp recovery `43629917630`, Kompas baseline `43629917579`, and Plan/REA schema `43629917580`. Those runs do not validate this new restack. The new branch starts from master `8ad319d`; its exact-head gates must run again.

A local clone attempt failed because the execution container could not resolve `github.com`. No local test execution is claimed. GitHub Actions is the available executable validation path. No Next.js APIs or runtime framework interfaces were changed.

No owner resume/JD/confirmation was processed, no model call was made, no DOCX was generated or inspected, no Gemini score was requested, no email or WhatsApp message was sent, no R2 data was written, and no production deployment occurred. This is not evidence of a live 95–100% or 98% match.

## Acceptance still required

1. Run full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema on the exact final PR head.
2. Keep the PR in draft until the legitimate protected preview is available through the authorized private `KOMPAS_VERCEL_API_TOKEN`. This run cannot access that credential and does not bypass protection.
3. After preview, use an owner-authorized source resume, exact JD and explicit candidate confirmations. Inspect the actual exported DOCX for structure and unsupported facts, then record raw and weighted coverage without rounding.
4. Run the separately approved final-DOCX Gemini review using the exact instruction **Give me an ATS score**. The expanded automatic correction/re-export/recheck loop remains unverified and is not included.
5. Deploy only after the task-specific gates pass; verify production SHA and alias separately from source tests.
