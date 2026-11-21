# WhatsApp hard-hold CI correction — 21 November 2026

## Parent scope and evidence

Parent PR #486, `fix/whatsapp-unverified-jd-hard-hold-20261120`, initially head `1842f7b8fc1021206f5a898b9ba1fca6ebf90ad1`, implements the owner-approved hard hold for unsupported JD-only additions and fail-closed selected-resume email identity. Its exact-head full CI run `44841376214` failed four test contracts; the recovery, Kompas baseline, and Plan/REA checks passed.

## Corrections

- `whatsapp-5fold.test.mjs`: no explicit Files/Library selection means a missing tailored file or identity mismatch cannot send the uploaded/original file. The test now requires a clear no-file outcome and confirms the other profile's email is not surfaced.
- `whatsapp-resume-failsafe.test.mjs`: both drafts include `supplierninja` in `unverified_added_keywords`. The hard hold therefore sends only the explicitly supplied same-account selected Houston source, never the unsupported rewritten draft. The assertions now check original bytes and that it was not rewritten.
- `whatsapp-single-request.test.mjs`: provider failure and unchanged output with only an uploaded source do not send an unselected original. The test now checks a text-only retry outcome, that a deliberate retry can still deliver a finished rewrite, and that an unchanged retry does not send a fallback.

These are test-contract corrections; no runtime code changed.

## Pending

- Exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA must rerun after these test corrections.
- A separate reviewed route change is still required to prove durable explicit same-account Files/Library selection and apply the owner-required exact fallback label **Original resume — NOT TAILORED**. The current `sendClosest` path checks the selected email, but does not carry durable explicit-selection proof; its caption is generic.
- The route change requires the installed Next.js 16.3.8 route-handler guide and a runnable repository environment. This automation runtime has no checkout or `node_modules`; the previous Vercel sandbox could not be resumed (HTTP 402 snapshot-storage quota, reset 1 Dec 2026). Do not bypass the provider gate or claim local tests.
- The 17 Oct 17:28 Chicago attempt remains unverified: exact output DOCX, R2 object/version, request/webhook correlation, Meta message ID and signed delivered/read receipt are missing. No replay or resend was performed.

## Safety

No real WhatsApp/Meta send, model call, DOCX generation, R2 write, production mutation or user-device test was performed.
