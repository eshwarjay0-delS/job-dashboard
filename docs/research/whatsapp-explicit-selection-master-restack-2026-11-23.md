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


## 23 November 2026 — two-line JD + named-resume parser repair

Static review of the clean restack found the route-level acceptance case in `scripts/tests/whatsapp-library.test.mjs`: a one-line JD followed by `use the SOC resume`. The existing `parseInstruction` rejects the combined message over 120 characters, then `splitTailInstruction` still rejected two-line input (`lines.length < 3`), losing the hint and silently choosing by relevance instead. The earlier PR #495 correction described this exact shape.

Committed to this same draft branch as `416522b5e27cefc1284fb5dcc76736007c2e5e45`:
- `splitTailInstruction` now accepts exactly two lines only when the JD line has an existing job-post signature; three-or-more-line behavior remains unchanged.
- Added a unit regression for the two-line JD/named resume and a negative short-chat case.
- The dedicated WhatsApp recovery workflow now runs `role-match.test.mjs` and the route-level `whatsapp-library.test.mjs`, and triggers on those paths.

At 23 Nov 2026 05:52 CDT, exact head `416522b5...` had WhatsApp recovery and full CI **in progress**, Kompas baseline and Plan/REA **success**; no cross-device run was visible. The prior exact head's full CI failed at the unrelated master lint error `prefer-const` in `src/lib/kompasConsistency.ts:1059`, before type-check/tests. No local tests ran; remote GitHub Actions is the available execution path. The Vercel sandbox quota is still 402 until 1 Dec 2026.

No production deploy, protected preview, real WhatsApp send, DOCX, R2/Meta receipt or historical 17 Oct 17:28 replay. The incident remains unverified. Keep PR #557 DRAFT; require exact-new-head CI/recovery/baseline/cross-device/Plan-REA, independent review, protected preview, production READY/alias and consented acceptance. Shared Plan Journal/REA/Completion Watch files were not edited in this continuation because their existing draft branches (#543/#386/#387) overlap and the Safe Merge Gate automation is disabled; this research file records the source-level continuation.


## 23 Nov 2026 — exact-head correction and remote evidence

The first recovery run after the parser/workflow change (`45170734760`) exposed a test-flow mismatch: the fixture had two resume emails, but the test asserted generation before answering the bot's required “Which email?” prompt. The product must not guess an account. Corrected the test to assert no generation, verify the pending `SOC` hint, then send the explicit `1` reply before asserting the exact SOC file, same account and durable `explicitlySelected` marker. Commit: `16d8ccd1282c61b8b8543a1f3e2a46fc3b62e5d7`.


Exact head `16d8ccd` remote evidence:
- WhatsApp resume recovery: **SUCCESS**, run `45171343240` (including parser and route-level `whatsapp-library.test.mjs`).
- Kompas baseline: **SUCCESS**, `45171342996`.
- Plan Journal/REA schema: **SUCCESS**, `45171342986`.
- Full CI: **FAILURE**, `45171343055`, still stops at the existing `prefer-const` lint error in `src/lib/kompasConsistency.ts:1059`; type-check/tests are skipped.
- No cross-device gate was visible for this head.


The separate behavior-neutral lint PR #556 is still DRAFT and its full CI fails two Kompas typed-question/one-press regressions (70/72 pass); the Voice Delivery task owns that behavior and I did not duplicate or merge it. PR #557 remains DRAFT and no protected preview/production deploy/device acceptance occurred. The historical 17 Oct 17:28 Chicago failure is still unverified. No real WhatsApp send, DOCX, R2 write, Meta receipt or replay was performed.

## 23 November continuation — durable-record mismatch regression

The VM fail-safe suite now iterates tampered durable recovery records for sender, verified account, JD, resume path, job ID, status, missing/false explicit-selection marker, selected absolute/relative path, account root, profile email, and missing file metadata. Every case must produce **zero document sends** and a text-only “could not be verified for this account” outcome. This test-only commit does not modify the webhook route or relax the existing hard-hold behavior.

Execution boundary: the local canonical checkout and dependencies remain unavailable in this runtime; GitHub Actions is the executable validation path. Exact-head focused recovery, full CI, baseline, cross-device and Plan/REA results must be checked after this commit. The historical 17 Oct send remains unverified.



## 23 November — shared Kompas VM harness follow-up

The root PR #557 CI run `45221590086` failed in 24 VM scenarios with `ReferenceError` because four test harness states lacked the newly used `answerCtl` and `detectedQueue` fields. This follow-up stacks on #557 and initializes only those two test fields in one-press, typed-follow-up-card, typed-question and voice VM fixtures. It does not change runtime code or WhatsApp authorization/delivery behavior. Focused WhatsApp recovery `45221589969`, Plan/REA `45221590156`, and Kompas baseline `45221590317` on the parent head were SUCCESS; exact-head full CI is pending for the fixture repair. Local checkout/dependencies are unavailable; GitHub Actions is used for execution. Historical 17 Oct send remains unverified.
