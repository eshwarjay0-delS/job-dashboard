# Confirmed-skill alignment — 20 November 2026

## Owner-approved evidence boundary

This continuation carries forward two owner-authored repository comments:

- [PR #319 comment 6817645128](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6817645128), 12 November 2026: explicitly confirmed JD skills may be written naturally into relevant existing project bullets across roles, including earlier roles, even when the older bullet did not name the tool. The confirmation does not authorize a new employer, project, action, outcome, date, title, location, contact, metric or credential. Houston and Saint Louis profile libraries remain separate.
- [PR #423 comment 6902823074](https://github.com/eshwarjay0-delS/job-dashboard/pull/423#issuecomment-6902823074), 15 November 2026: first-person grammar is not the only accepted confirmation syntax. Accept a positive candidate assertion or a clearly labelled `Confirmed skills:` / `Confirmed experience:` statement. JD text, editing instructions, questions, negations and unlabelled second-person wording are not confirmation.

A confirmation supports only the named skill. It may be placed into a relevant existing project context; it does not create a task, action, result, metric, chronology, credential or employer fact.

## Source changes carried forward

The reviewed source/test changes from draft PR #431 were copied onto a branch based on the current approval-provenance documentation head (PR #464). A GitHub compare confirmed the following source/test files had not changed on canonical master between #431's base `d03f188` and current master `4f503093`, so no intervening source edits were overwritten:

- `src/lib/claude.ts`: the JD is target context, not candidate history; explicitly confirmed skills may be mapped into relevant existing bullets, without mirroring the JD or forcing terms into every role.
- `src/lib/resume-evidence.ts`: accepts explicit confirmation syntax, rejects questions/negations/editing instructions, keeps blanket confirmation exception-safe, and separates role-specific source evidence from a confirmed skill's cross-role permission.
- `src/lib/tailor.ts`: keeps unconfirmed role evidence scoped to its own source role and restores unsupported role edits; confirmed skills can be used only where the existing project context fits.
- `src/lib/resume-quality.ts`: keeps keyword overlap separate from completion and supported coverage. The 98% figure remains a target, not proof of a live match or a universal WhatsApp send threshold.
- Tests: `scripts/tests/resume-confirmation-quality.test.mjs`, `scripts/tests/resume-guards.test.mjs`, and `scripts/tests/whatsapp-resume-acceptance.test.mjs`.

The predecessor #431 head had recorded four green exact-head gates, but those results are not reused for this new branch. Fresh full CI, WhatsApp recovery, Kompas baseline and Plan/REA checks are required on the final head.

## Latest WhatsApp correction retained

Offline fallback may use only a user-explicitly selected, same-account Files/Library resume and must display exactly **Original resume — NOT TAILORED**. No automatic closest-match selection, no silent substitution, and no fresh uploaded original sent as a fallback. If a fresh upload has no explicit library selection, return a text explanation and preserve the conversation. This branch does not implement or alter the WhatsApp fallback path.

## Acceptance and release boundary

This is source/test/documentation work only. No owner resume or JD was processed, no model call or DOCX export occurred, no Gemini score was requested, no WhatsApp or email was sent, and no R2 or production data was written.

The actual 17 October 2026 17:28 Chicago incident remains unverified. The exact WhatsApp media bytes, generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID and signed delivered/read receipt are still missing. This source change is not proof of that incident's root cause or delivery.

Live acceptance still requires an owner-authorized baseline resume, exact JD and explicit per-skill confirmations, followed by inspection of the exported DOCX for identity, chronology, formatting, role relevance and unsupported claims. A 95–100% or 98% live match is not claimed. The expanded automatic Gemini correction/re-export/recheck loop remains proposed, not directly approved; the score-only stage stays separate.

Protected preview and production release are separate gates. The new branch is stacked on PR #464 so the shared approval-provenance documentation is preserved; it must not merge before the parent and Safe Merge Gate sequencing are resolved.
