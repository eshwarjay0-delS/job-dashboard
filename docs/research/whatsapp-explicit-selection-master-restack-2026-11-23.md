# WhatsApp explicit-selection fallback — current-master restack (23 November 2026)

## Approval and scope

Continue the owner's 19 November correction: only an explicitly named same-account Files/Library resume can be sent unchanged, with the exact label **Original resume — NOT TAILORED**. Fresh uploads and automatic closest matches are not fallback. Unsupported JD-only additions remain a hard hold. The existing behavior for completed, readable rewrites below 70% remains disclosed shortfall delivery; this restack does not introduce a new below-70% hold. Unapproved R2 CAS/leases/fencing and uploaded-original-after-timeout behavior are excluded.

## Work carried out

PR #557 was previously stacked on the separate Kompas S5/Listening PR #554, which is draft pending independent review. I restacked the WhatsApp-only code, tests, workflow and resume/research docs onto current canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`, preserving PR #554 as a separate branch. Source/test commit: `a3096d79d6e9bfd761c72199a9fa407806799dc6` (15 files). The PR was retargeted to `master`; it remains DRAFT.

The reviewed boundary requires:
- explicit-selection marker carried in the recovery record;
- account-owned Files root, selected path and email folder checks;
- durable pending record binding sender, verified user, JD, resume path, selected path, relative path and email;
- byte-for-byte equality between selected Library item and run input;
- unique matching profile email before unchanged delivery;
- exact **Original resume — NOT TAILORED** caption;
- automatic matches and fresh uploads remain text-only on failure;
- identity/contact/date verification failure never resends a prior baseline;
- unverified JD-only additions are never shortfall delivery.

## Test evidence

Prior stacked head `8ea94f5f9429695a020b334a3f89003d01e9d9a9` had WhatsApp recovery workflow `45139687389` and Plan/REA workflow `45139687402` SUCCESS. Full CI was absent because the PR targeted the non-master Kompas branch. The clean restack exact head `a3096d79d6e9bfd761c72199a9fa407806799dc6` initially returned zero GitHub check-runs after retarget; exact-head full CI, recovery, Kompas baseline, cross-device and Plan/REA remain pending. No local checkout or installed dependencies are available, so no local execution is claimed.

## Production and historical limits

No production deployment, real WhatsApp or Meta message, DOCX, R2 write, model call, database mutation, native device acceptance or historical replay occurred. The 17 Oct 2026 17:28 Chicago incident remains **unverified**. Missing evidence is the exact generated DOCX, per-run R2 object/version, webhook correlation, Meta outbound ID and signed delivered/read receipt. The current master production alias remains on `794e8cf`; this PR is not live.

## Next gates

1. Exact-head full CI, WhatsApp recovery, Kompas baseline, cross-device and Plan/REA.
2. Independent source review; keep draft until the merge gate is satisfied.
3. Protected preview and production READY deployment with canonical alias verified.
4. Consented live acceptance with no duplicate/unsafe fallback; verify delivery evidence.
5. Keep historical 17 Oct delivery separate from any newly generated file; never replay or resend to manufacture evidence.
