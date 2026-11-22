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


## Current-master source audit and execution blocker — 19 November 2026 23:35 UTC

Canonical master at this review is `e035b4131ea34a62ba31e51dca198d77b3d0057e`. In `src/app/api/whatsapp/webhook/route.ts` (blob `7ec8dd7727ca454bde76ad794f921b2206efae82`), the `Session` type carries resume path/name/time and preferred email but no explicit library-selection provenance; `FromFiles` also has no explicit-selection flag. The `sendClosest` fallback reads `session.resumePath`, extracts the resume, and checks `chosenResumeMatchesProfile(text, files?.email)`, but does not distinguish a user-explicitly selected same-account library item from an automatically chosen item. The helper returns true when no email is supplied, so an uploaded resume can pass this profile check. This is a source-level fallback path, not proof that the historical 17 Oct incident used it or that a document was delivered. The narrow guard still missing is explicit library-selection provenance on the fallback path only; normal initial selection is outside this correction. Normal initial library selection remains outside the correction.

Vercel sandbox creation was refused with HTTP 402 `payment_required`: the Hobby plan snapshot-storage usage limit is exceeded. No sandbox was created. The current container has no repository checkout, and the installed Next.js 16.3.8 route-handler guide under `node_modules/next/dist/docs` is unavailable. The helper blob reviewed for the no-email behavior is `8b7781b8b2aa9dedf67641e68e083d5b3d73632b`. No code or tests were changed. The exact unblocking requirement is an owner-controlled release of Vercel snapshot capacity or an approved local/cloud development environment with this repository and its installed Next.js package. Do not change billing, delete snapshots, bypass access controls or use the unapproved R2 architecture.

PR #450 current head `05c19ec2012479d1c78e7a5ad7b8e77ee1f24e58` has no exact-head Actions runs. Child PR #453 head `b71006e5037d5247e24485f620b0556843fa1624` has WhatsApp recovery 44505879487 and Plan/REA 44505879476 SUCCESS, but no full CI or Kompas baseline on the stacked base. Keep both DRAFT. Once the environment is available, read the installed route-handler guide and implement only the explicit-selection provenance guard with synthetic regressions for explicit same-account selection, automatic closest-match rejection, uploaded-original rejection, wrong-account rejection, text-only hold and the exact NOT TAILORED label. Require full CI, recovery, Kompas baseline, Plan/REA, legitimate protected preview and Safe Merge Gate review. No real send or historical replay.

## 22 November 2026 — named-resume parser prerequisite

PR [#515](https://github.com/eshwarjay0-delS/job-dashboard/pull/515) restacks the approved two-line JD + named Files resume parser correction onto current master. It preserves the selection hint, asks the user to choose the account email, and only then uses the exact named path in the synthetic integration test. It does not implement the durable explicit-selection marker or unsupported-JD hard hold described above, and it does not prove the historical 17 Oct delivery. Exact-head CI/recovery/baseline/Plan-REA checks are pending; no live WhatsApp send, R2 write or DOCX generation occurred.