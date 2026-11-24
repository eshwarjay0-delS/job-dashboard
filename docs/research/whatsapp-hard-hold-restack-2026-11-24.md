# WhatsApp unsupported-JD hard-hold restack — 24 November 2026

## Owner-approved scope

The 19 November owner correction is authoritative: an incomplete or identity-mismatched WhatsApp resume may fall back only to an explicitly selected same-account Files/Library resume, labeled exactly **Original resume — NOT TAILORED**. Unsupported JD-only experience or credentials must not be sent as candidate claims. A matching profile email is necessary, but does not prove durable explicit selection.

This restack isolates the hard-hold/identity helper fix from the unapproved R2 CAS, lease/fencing, recovery queue, provider-callback, and uploaded-original-after-timeout changes in PR #450. It does not implement route-level durable selection provenance.

## Verified current master and production

- Current canonical master at restack: `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Production Vercel deployment: `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY, exact SHA `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Independent alias lookup maps `job-dashboard-fawn.vercel.app` to that same READY deployment; `marketfit-app.vercel.app` is also assigned. This is deployment evidence, not WhatsApp delivery acceptance.

## Source change on the restack

- Remove `unverified_jd_terms` from the WhatsApp shortfall-delivery allowlist.
- Explicitly fail `whatsappRewriteUsable` when unverified added keywords exist or the cached quality blocker is `unverified_jd_terms`, including an empty detail list.
- Require a nonblank profile email before `chosenResumeMatchesProfile` can return true; the document must contain exactly one matching email. Commit `667bc5568c9d1975f4f5169a251d6d10eb71d469` also aligned the comments and removed the redundant unverified-term shortfall branch.
- Add three synthetic regression cases for unsupported JD-only terms, a stale blocker with empty details, and missing/blank/matching/mismatching profile email.
- Wire the existing acceptance test file into full CI and the WhatsApp resume regression workflow.

The explicit-selection proof and exact fallback caption are deliberately not claimed by this helper. The new restack is based on current master, rather than the old PR #486 base, and preserves current-master code.

## Validation and release state

- Source, tests and CI wiring are committed to branch `fix/whatsapp-hard-hold-restack-20261124`; remote CI is pending.
- No local checkout or installed `node_modules` is available in this scheduled environment. GitHub Actions is the test path; no local test/build is claimed.
- No merge, production deployment, DOCX generation, R2 write, model call, WhatsApp send, historical replay, database mutation, or user-device test occurred.
- Original PR #486 is still a draft and non-mergeable on its stale base. It remains open until this restack has exact-head checks; it should be closed as superseded only after the replacement is validated.

## Historical incident and blockers

The 17 October 2026 17:28 Chicago WhatsApp failure remains unverified: the generated output DOCX, per-run R2 key/version, request/webhook correlation, Meta outbound message ID, and signed delivered/read receipt are missing. No replay or resend is authorized.

The durable explicit-selection route task remains blocked by the absence of a canonical local checkout and installed Next.js 16.3.8 route-handler guide. The prior Vercel sandbox resume returned HTTP 402 for exhausted Hobby snapshot storage, reset 1 December 2026. Do not change billing, bypass access, or substitute upstream docs for the installed guide.

## Next

1. Run exact-head full CI, WhatsApp recovery regression, Kompas baseline and Plan/REA schema on the new restack.
2. Keep the replacement PR DRAFT; review and protected preview/release gates remain separate.
3. Only after the required environment is available, implement durable same-account explicit Files/Library selection and exact fallback caption; preserve the original source and all account isolation.
4. Do not claim the 17 October file was delivered without the missing artifacts and provider receipt.
