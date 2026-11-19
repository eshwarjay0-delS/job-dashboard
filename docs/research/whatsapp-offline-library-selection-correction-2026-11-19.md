# WhatsApp offline library selection — owner correction, 19 November 2026

## Historical approval retained

The accessible prior conversation records the direct 27 October 2026 15:14:08Z owner instruction: “Continue until done; even offline, give the closest matched resume from the user's library as failsafe.” Preserve that historical decision; do not erase it.

## Latest correction narrows the behavior

The latest owner correction retrieved from accessible prior context at 19 November 2026 16:38:41Z requires:

- Only a Files/Library resume that the user explicitly selected for the current request and that belongs to the same account may be used as the offline fallback.
- Any such fallback must be clearly labeled **NOT TAILORED**.
- Do not auto-select the closest library item and do not silently substitute another file.
- If a fresh upload arrives without an explicit library selection, return a text explanation and preserve the conversation. Do not send the uploaded original or another library file as a substitute.
- The separate uploaded-original-after-provider-timeout behavior remains unapproved.

This is a correction to the implementation scope, not a deletion of the historical 27 October message. The 17 October 17:28 Chicago delivery incident remains unverified: the generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID and signed delivered/read receipt are still missing. Do not replay or resend.

## Current implementation boundary

PR [#450](https://github.com/eshwarjay0-delS/job-dashboard/pull/450) and child [#453](https://github.com/eshwarjay0-delS/job-dashboard/pull/453) remain DRAFT. The active Safe Merge Gate identified unapproved R2 ETag-CAS/conditional-write and worker lease/fencing architecture in the parent. No direct owner approval for that architecture was recovered. Do not merge it or perform R2 writes. The latest #450 head still requires exact-head validation; #453 is stacked and does not independently authorize the parent architecture.

A narrow explicit-selection guard may be implemented separately after current route-handler guidance and source review are available. The scheduled environment has no local repository checkout or installed `node_modules/next/dist/docs`; the Next.js v16.3.8 upstream route-handler guide can be read, but it is not a substitute for the installed copy required by AGENTS.md. No code change, DOCX generation, R2 write, model call, WhatsApp send, historical replay or handset delivery test was made in this correction.

## Required evidence before delivery claims

Reconcile the original upload and generated output; record the per-run R2 object/version, webhook/request correlation and Meta message ID; obtain a signed delivered/read receipt; and keep owner fact discrepancies quarantined. A model-use event alone is not proof of a generated DOCX or a delivered WhatsApp document.
