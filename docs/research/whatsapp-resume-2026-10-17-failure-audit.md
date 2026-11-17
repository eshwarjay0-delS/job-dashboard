# 17 October 2026 WhatsApp resume failure — evidence audit

## Incident scope

The owner asked to continue the WhatsApp resume-tailoring failure observed on 17 October 2026 at 17:28 America/Chicago. Accessible prior-conversation retrieval did not recover the original user message verbatim. Do not infer the missing wording or claim access to every prior chat.

## Recovered evidence (prior read-only reviews)

- A Library screenshot timestamped `2026-10-17T22:28:39Z` (17:28 Chicago) shows the bot holding the resume after automatic repair because it did not reach the then-active 98% coverage target. The visible missing-term list included CCSP, CISM, CRISC, CISA, Canton and SOL-related terms.
- A prior read-only Library review reported a 27,724-byte source DOCX archive member and a matching Risk & Controls JD from the owner's inbox. The 16 Nov review found the archived source master and inventory SHA-256 agreed, but the screenshot's rounded size and filename do not prove that the actual WhatsApp media payload was byte-identical.
- The matching JD variant was the 5+ years Security Engineer – Risk & Controls role in Atlanta. A separate 12+ years recruiter variant was excluded rather than substituted.
- Source chronology, education, tenure and credential facts were materially inconsistent across archived resume versions. They remain quarantined pending owner reconciliation; the JD's preferred tools/credentials are not candidate evidence.
- A later read-only production query was reported in the PR #395 discussion as showing a raw score field of 87 and 34 model calls for the historical request. That field was raw JD overlap, not a Gemini ATS score or supported-experience score; it has not been independently re-queried in this run and is not proof of delivery.

## What is still missing

- Exact generated output DOCX and its SHA-256.
- Per-run R2 object/key/version and stored-output metadata.
- Inbound webhook/request correlation and retry/idempotency trace.
- Meta outbound message ID and signed delivered/read receipt.
- Owner reconciliation of the conflicting source chronology, education, tenure and credential facts.

A later 13 Nov audit reported two separate rejected drafts with raw and supported coverage at 100% but `partial=true`, `incomplete=true`, `needs_review`, and blockers such as `draft_parts_missing` and `roles_unrewritten`. Those later drafts are not proven to be the 17 Oct run and must not substitute for its missing output/correlation trace.

## Current policy boundaries

- The 27 Oct owner request explicitly approved the closest matched resume from the same account's library as the offline best-match fallback. This does not authorize substituting another account's resume or claiming an unverified DOCX was delivered.
- The 6 Nov WhatsApp 70–94.9% raw / 95%-supported clean-pass rule is recorded in the dated research note and was reaffirmed by the owner's 16 Nov provenance correction on PR #431. The primary 6 Nov owner-authored message was not independently re-retrieved in this run; keep that limitation visible.
- The 14 Nov no-fabrication correction remains: unsupported experience, certifications, employers, dates, metrics and work claims are never invented. Explicit candidate confirmations may map into relevant existing project contexts; the unapproved first-person-only restriction is not imposed.
- The final-DOCX Gemini review is a separate approved resume-quality improvement. It does not repair, replay or replace the 17 Oct WhatsApp output and does not prove delivery.

## Unblock requirements

1. Recover the exact generated DOCX and correlate it to the original request.
2. Recover the matching R2 metadata, webhook event, Meta message ID and signed delivery/read receipt.
3. Have the owner reconcile the conflicting source resume facts before using them.
4. Run a consented baseline + JD + explicit-confirmation acceptance without external delivery first; inspect the actual exported DOCX and evidence by role.
5. Keep real WhatsApp delivery blocked until protected preview, verified linked number and owner-authorized device acceptance are available.

No model call, DOCX regeneration, R2 production write, historical replay, real Meta send, email, or handset test occurred in this audit. Do not resend or claim delivery.
