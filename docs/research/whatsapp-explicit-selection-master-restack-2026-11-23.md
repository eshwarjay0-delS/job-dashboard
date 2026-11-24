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


## Exact-head CI after shared fixture repair — 23 November

PR #557 full CI 45227734205 now passes lint, type-check, build and all preceding steps; the four VM fixture ReferenceErrors are resolved. Only two real behavior assertions fail: empty second press and candidate-only second press must hold Listening before the subsequent re-ask. WhatsApp recovery 45227734188, Kompas baseline 45227734468 and Plan/REA 45227734178 are SUCCESS. PR #554 contains the separate Listening-hold fix with all five exact-head gates green but awaits independent review. No production release or historical WhatsApp acceptance is claimed.


## 23 November 2026 — clean stacked validation continuation

The WhatsApp source/test/workflow slice is now restacked onto the exact green Kompas PR #554 head `4fafd56663bb5ddce064dcebea8802d758bb8259`, rather than duplicating its Listening-hold runtime or VM fixture fixes. The new dependent PR will validate the explicit-selection hard hold with the shared fixes in its ancestry. The original #557 and #561 branches remain preserved; this restack excludes their overlapping Kompas fixtures, lint correction, Completion Watch, Plan Journal, Plan & Vision and other shared files. Exact-head remote Actions validation is pending. No local build, real send, R2 write, DOCX, replay or device acceptance was performed.


## Completion Watch independent restack correction — 23 November 2026

The original PR #566 is still stacked on Kompas PR #554. This new branch independently copies its exact reviewed code/tests from #566 head `9465113780c59020cfdaf5e041d42dd4e93f93f8` onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`. Original #566 focused recovery and Plan/REA successes are historical; exact-head gates on this new branch must run again. The 17 Oct 17:28 Chicago delivery remains unverified; no real outbound message or replay is performed.

## 24 November 2026 — master restack lint unblock and validation follow-through

The direct-to-master restack is tracked in PR #572. Exact head 6046251fce4d2cdb6a8f4481454b8a468b551132 passed WhatsApp recovery 45289773580, Kompas baseline 45289773937, and Plan/REA schema 45289773611; full CI 45289773784 failed only because the current master Round 15 file had let s = sentence at src/lib/kompasConsistency.ts:1059 and ESLint requires const.

A single behavior-neutral correction was committed to the PR branch as 5ee5fd9c033059c88bd7ff64c5e8a460ac5385c9, changing only that binding from let to const. On exact new head 5ee5fd9, full CI 45305829573 and WhatsApp recovery 45305829533 were in progress when recorded; Kompas baseline 45305829583 and Plan/REA schema 45305829601 were SUCCESS. The previous head's recovery/Plan results are not substituted for the new head.

No local tests ran because this environment has no canonical checkout or installed dependencies. No route code was edited in this lint-only follow-up. The installed Next.js 16.3.8 route-handler guide is still required before further route changes; Vercel Sandbox is unavailable with HTTP 402 until 1 Dec 2026. PR #572 remains DRAFT, unmerged and undeployed; current production remains READY on master 794e8cf. No real WhatsApp/Meta send, DOCX, R2 write, replay or device acceptance occurred. The historical 17 Oct 17:28 Chicago delivery remains unverified.


## 24 November 2026 — exact-head master restack status and shared CI dependency

The current-master restack is PR #572, branch `fix/whatsapp-explicit-selection-master-restack-20261123-continuation`, exact head `084ff85bd14a6012cc7eff67bb8e3ab55993bdb2`, 38 commits ahead of and 0 behind master `794e8cfdbd3103409552857806bab89851d5bfcb` at the time of this audit. The branch retains the owner-approved behavior: only the exact explicitly selected same-account Files/Library item may be sent unchanged; the caption is exactly **Original resume — NOT TAILORED**; fresh uploads and automatic closest matches are text-only on failure; unverified JD-only additions are a hard hold; no R2 CAS/lease/fencing or uploaded-original-after-timeout behavior is included.

Exact-head evidence:
- WhatsApp resume recovery `45308210437`: **SUCCESS**.
- Kompas baseline `45308210436`: **SUCCESS**.
- Plan/REA schema `45308210342`: **SUCCESS**.
- Full CI `45308210433`: **FAILURE** in the shared Kompas question/voice VM suite. Lint, type-check, build and earlier gates passed; 24 VM cases fail with `answerCtl is not defined` in `scripts/tests/kompas-voice.test.mjs` / `pumpDetectedQueue`. No cross-device run was visible for this head.

The dependency is PR #554, exact head `4fafd56663bb5ddce064dcebea8802d758bb8259`, which combines the already-approved current-resume authority, first-press Listening hold and VM fixture initialization. Its full CI `45123770495`, Kompas baseline `45123770380`, cross-device `45123770446`, Plan/REA `45123770546` and Windows executable `45123770398` all passed. Only the owner's self-authored review comment is recorded; GitHub rejected self-approval, so an independent authorized reviewer is required before merge. Do not copy its voice/Listening changes into this WhatsApp branch.

Production remains READY on master `794e8cf` / deployment `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`; PR #572 is not merged or deployed. No local test/build ran because the canonical checkout and installed dependencies are unavailable. The installed Next.js 16.3.8 route-handler guide remains required before additional route edits; the prior Vercel Sandbox snapshot request returned HTTP 402 with the recorded reset on 1 Dec 2026. No real WhatsApp/Meta send, R2 write, DOCX, model call, historical replay, production mutation or device acceptance occurred. The 17 Oct 2026 17:28 Chicago incident remains unverified.

Next: obtain independent review for PR #554; after merge, restack #572 onto the resulting master and rerun full CI, WhatsApp recovery, Kompas baseline, cross-device and Plan/REA on the exact new head. Then require protected preview, production READY/alias and consented acceptance. Never replay the historical attempt to manufacture evidence.


## 24 November 2026 — exact-head fixture repair and remaining shared Listening-hold failure

On PR #572 branch `fix/whatsapp-explicit-selection-master-restack-20261123-continuation`, the prior full CI failure was isolated to four Kompas VM harness states missing `answerCtl` and `detectedQueue`. This follow-up initializes only those test fields in:
- `scripts/tests/kompas-typed-question.test.mjs`
- `scripts/tests/kompas-typed-followup-card.test.mjs`
- `scripts/tests/kompas-voice.test.mjs`
- `scripts/tests/kompas-one-press.test.mjs`

Commits: `720c4f549bfa0cefe72ae599b9ef2b556ff6f143`, `a1b4d33a55c70254d784b8a9471f0f2867ae31c1`, `04661e2595b4ad8dd13ddf8802806a189a32d313`, `061b0bc1296437a056ecad985126d77e8e3e9c9d`.

Exact head `061b0bc1296437a056ecad985126d77e8e3e9c9d`:
- WhatsApp recovery `45349292292`: **SUCCESS**.
- Kompas baseline `45349292298`: **SUCCESS**.
- Plan/REA `45349292294`: **SUCCESS**.
- Full CI `45349292258`: **FAILURE**. The missing fixture references are resolved; 70/72 question/voice tests pass. Only the two first-press Listening-hold assertions remain: silence and already-answered candidate-only speech must not regenerate an answer.

Those two runtime assertions belong to PR #554, exact head `4fafd56663bb5ddce064dcebea8802d758bb8259`, whose full CI, baseline, cross-device, Plan/REA and Windows x64 executable workflows all pass. Its only recorded review is owner-authored, so a second authorized reviewer is required before merge. Do not duplicate the Listening-hold runtime or bypass the independent-review gate. PR #572 remains DRAFT, unmerged and undeployed; production remains master `794e8cf`.

No local checkout or installed dependencies were available. No route code changed in this fixture-only follow-up; the installed Next.js 16.3.8 route-handler guide remains required before any further route edits. No real WhatsApp/Meta send, DOCX, R2 write, model call, database mutation, historical replay or device acceptance occurred. The 17 Oct 17:28 Chicago delivery remains **unverified**; output DOCX, R2 object/version, webhook correlation, Meta message ID and signed delivered/read receipt are missing.

Next: obtain independent authorized review for #554; after approved merge, restack #572 onto the reviewed master and rerun every exact-head gate. Require protected preview, production READY/alias and consented live delivery acceptance before calling it shipped.
