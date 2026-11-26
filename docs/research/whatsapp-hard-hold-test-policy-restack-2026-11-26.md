# WhatsApp hard-hold policy test restack — 26 November 2026

## Approval and scope

The owner-approved 19 November correction is authoritative: an original resume fallback requires a durable explicit same-account Files/Library selection and the exact label **Original resume — NOT TAILORED**. Unsupported JD-only candidate claims are a hard hold. This slice is helper/test/CI/docs only; it does not implement route-level selection provenance, upload substitution, R2 leases/CAS/fencing, or provider delivery changes.

## Exact-head failure evidence

PR #587 at `1e2a1bf9a508f3d5b7dc175ca865b7f70182d202` full CI `45715458709` failed tests 18, 93, 95 and 102 (job `139560242380`). WhatsApp recovery `45715458683`, Kompas baseline `45715458615`, and Plan/REA `45715458626` passed. The failed assertions expected:
- a missing tailored document or identity mismatch to send an original resume without durable selection;
- a 30.8% rewrite with an unverified JD-only term (`supplierninja`) to be delivered;
- a provider failure to send the unselected original.

These are policy-conflicting expectations, not grounds to weaken the hard hold. The supported 30.8% role-evidence-gap control is retained only after its unsupported additions are removed, and the below-floor disclosure path remains separately tested.

## Restack contents

- Helper-level rejection of unverified additions and the cached `unverified_jd_terms` blocker.
- Profile email must be nonblank and match exactly one resume email; this identity check is not durable explicit-selection proof.
- New acceptance regressions from PR #587.
- Corrected `whatsapp-5fold`, `whatsapp-resume-failsafe`, and `whatsapp-single-request` tests inspected from PR #583 to assert no unselected-original fallback, hold unsupported additions, preserve the supported role-gap control, and retain retry/claim-release behavior.
- CI and WhatsApp recovery workflow wiring.
- Plan & Vision, REA, Completion Watch and this research note.

## Verification boundaries

The clean branch is based on the run-11 Plan & Vision checkpoint `e8247967fc32f83942ebf0bf6b80f9f5d9e3c515`. The GitHub blob preparation succeeded; no local checkout, package.json, node_modules, or installed Next.js 16.3.8 route guide is available, so no local tests/build were run. Remote exact-head CI is pending.

Protected preview needs the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`; it is unavailable and must not be bypassed. No production deployment, DOCX generation, model call, Meta send, R2 write, historical replay, database mutation, or user-device acceptance occurred.

## Historical incident

The 17 October 2026 17:28 Chicago WhatsApp delivery remains unverified. The generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound ID and signed delivered/read receipt are still missing. Do not replay or resend.

## Next gate

Run exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema on the clean restack. Keep it DRAFT until independent review and legitimate protected preview. Durable same-account Files/Library selection provenance and the exact fallback route implementation require a compliant checkout with installed Next.js 16.3.8 docs; keep them blocked rather than substituting a matching email or synthetic test.