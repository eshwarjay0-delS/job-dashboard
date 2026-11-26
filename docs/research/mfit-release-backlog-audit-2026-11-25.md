# MFit release and backlog audit — 25 November 2026

**Audit time:** 2026-11-25 19:38 UTC  
**Canonical repository:** `eshwarjay0-delS/job-dashboard`  
**Verified master:** `a17b3267e271c77cd8887312445271b7fa172bd0`  
**Verified production:** deployment `dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW`, READY, target production, exact SHA above; canonical alias `job-dashboard-fawn.vercel.app` resolves to that deployment.

This audit uses current GitHub source, PRs, Actions, Vercel deployment metadata, the accessible Library search and accessible prior conversation context. It does not claim access to every chat or every external artifact. Approval, implementation, deployment and user/device acceptance are kept separate.

## Current production release

PR [#582](https://github.com/eshwarjay0-delS/job-dashboard/pull/582) merged at 2026-11-25 16:54:25 UTC as `a17b3267e271c77cd8887312445271b7fa172bd0`. It fixes the overlay P0:
- Start is no longer disabled by a long answer-service preflight; the readiness probe is short and failure-tolerant.
- Check again re-probes.
- Minimize and Close are real title-bar controls outside the drag region.
- The clarifier is a sibling popup that follows the live question.
- Opacity fades paper only.
- B cycles 700, 600 and 400; normal weight is default and persisted.

Exact PR-head checks passed: full CI 45657099297, schema 45657099464, Kompas baseline 45657099238, account-sync 45657099207, Windows build 45657099213. Exact master checks passed: full CI 45658988293, schema 45658988359, baseline 45658988373, Vercel status 45658988350, Windows build 45658988221. Vercel deployment `dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW` is READY at the exact SHA and the alias lookup confirms `job-dashboard-fawn.vercel.app`. The official [Kompas.exe release](https://github.com/eshwarjay0-delS/job-dashboard/releases/tag/kompas-desktop-latest) asset updated at 2026-11-25T16:55:57Z, size 162,265,943 bytes, SHA256 `b8532183d34294f100f5dbf721e8fcd682d7c9529f949fb768dd96b9088e31c1`. A two-hour production runtime-error query returned no grouped errors; this is not proof of feature usage.

A prior review comment raised a possible Saint Louis/Houston source substitution. Current master source resolves that concern: `honestySource` returns every non-empty loaded resume unchanged and uses the Houston fixture only when the supplied resume is empty. `scripts/tests/kompas-s5-gate.test.mjs` asserts both paths and includes a loaded-resume allow-list test. The old PR #582 body text is stale on that point; the current source and test are the evidence. This is not a substitute for authenticated user-device acceptance.

## WhatsApp — highest-priority unresolved work

The 17 October 2026 17:28 Chicago incident remains an unverified historical delivery. The source DOCX and matching JD reference were previously recovered, but the source resume remains quarantined against owner-confirmed facts. The generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound ID and signed delivered/read receipt remain missing. Do not replay, resend, generate a replacement and call it historical, or treat the recruiter-addressed JD as candidate evidence.

The latest owner correction remains authoritative: unsupported JD-only claims must never be delivered as candidate experience; an incomplete/identity-mismatched fallback may use only an explicitly selected same-account Files/Library item, labelled exactly **Original resume — NOT TAILORED**. Automatic closest-match, silent substitution, fresh-upload fallback without explicit selection and partial rewrite are prohibited. The earlier 27 Oct closest-library failsafe is preserved as history but narrowed by the 19 Nov correction.

### New helper-only restack

PR [#583](https://github.com/eshwarjay0-delS/job-dashboard/pull/583) is a draft clean restack from current master. Current head: `a4f96d39b58024e090cdac250c4fa293a9177856`.
- Removes `unverified_jd_terms` from the shortfall-delivery allowlist.
- Blocks nonempty `unverified_added_keywords` and a cached `quality_blockers: ["unverified_jd_terms"]`, including an empty detail list.
- Keeps an honest completed 70–94.9% raw-overlap gap separately disclosable only when supported coverage and all completion checks pass and no unsupported addition exists.
- Requires a nonblank profile email that exactly matches the sole email in the resume. This is an identity check, not proof of explicit Files/Library selection.
- Adds a control regression for the 30 Oct 100%-coverage, incomplete `role_evidence_gaps` shape.
- Wires the suite into full CI and WhatsApp recovery.

Commits: helper `7c82f0e32f23a4f010f18f58d98912282c36b36c`; initial acceptance tests `b8a8ab0ff7983364dc81f204b88e6b49d207ce01`; full-CI wiring `7131e27c6243499d16a5ee81a0a8435048a3b18b`; recovery-workflow wiring `05e130d941f4bc8fe090b7ca18fc318234643d37`; newline fixture correction `a4f96d39b58024e090cdac250c4fa293a9177856`; test-policy corrections `f70529de50d08303d3343c7ee17738570010f1bf`, `b03169d0f0433162d34aba8fd53dbeb88f379037`, `b1c28eae8a362614a8118e1008f3ea08ec293eef`. The first recovery run failed one literal-backslash-n fixture; the next exact-head full CI 45686440622 then exposed four stale tests that expected an unverified original fallback or delivery of an unsupported JD-only term. The three follow-up commits now assert fail-closed behavior without profile identity, hard-hold the unsupported `supplierninja` generated file, preserve a supported role-evidence-gap control with no unsupported additions, and keep retry/claim-release behavior. New exact head is `b1c28eae8a362614a8118e1008f3ea08ec293eef`; Kompas baseline 45692952593 is SUCCESS; full CI 45692952469 and WhatsApp recovery 45692953138 are IN PROGRESS. No local test run was possible because the container has no canonical checkout or dependencies. PR #583 remains DRAFT, not merged/deployed; no route/session runtime code, real Meta send, model call, DOCX generation, R2 write, replay or device acceptance occurred. The profile-email match still does not prove durable explicit Files/Library selection.

The route-level durable explicit-selection proof remains separate in [PR #572](https://github.com/eshwarjay0-delS/job-dashboard/pull/572), head `741f8eeb284b2faeb5223c80162cc5f7d1344705`. Its full CI 45460461747 fails two shared Listening-hold assertions; WhatsApp recovery 45460461642, baseline 45460461650 and schema 45460461660 pass. It remains DRAFT/non-mergeable. Shared PR [#554](https://github.com/eshwarjay0-delS/job-dashboard/pull/554), head `4fafd56663bb5ddce064dcebea8802d758bb8259`, has six successful checks but is non-mergeable and still needs a second authorized reviewer. Do not self-approve or bypass that gate.

## Resume / JD / confirmed experience

The owner-approved mapping rule remains: explicit candidate-confirmed skills may be mapped into relevant existing project bullets, but the JD alone cannot create an employer, project, action, outcome, date, title, metric or credential. Web raw JD overlap remains 95%; WhatsApp may disclose a completed readable 70–94.9% result only with supported coverage at the approved floor; 98% remains a target, not a hard send threshold.

PR [#570](https://github.com/eshwarjay0-delS/job-dashboard/pull/570), latest branch head `0b0af88b82ff2f6bcd89f5384ac59c398f73cb66`, remains DRAFT. Focused confirmation 45682847187 passed 54/54 on prior head `100b64d`. Full CI 45682847235 and WhatsApp recovery 45682847248 stopped at typecheck because the PR's own REA entry omitted required `commits`; I added the missing exact source/test/final-head commit list in 0b0af88. No fresh exact-head workflow has appeared while the PR remains draft. Schema 45682847656 and baseline 45682847151 passed on the prior head. No candidate resume/JD/confirmation bundle was processed and no DOCX or live 95–100%/98% match is claimed.

## Poke-inspired Gmail/mobile

The four-account maximum is authoritative. Mobile navigation must expand below the sticky header in normal flow, pushing content down without overlay, scrim, dimming or page inertness. The Poke worker, scheduler, notifications and automatic sending remain disabled.

PR [#580](https://github.com/eshwarjay0-delS/job-dashboard/pull/580), head `f783adb36d9332589028b1717eb40b0a8da07a51`, has four successful checks (Gmail regression 45678959016, full CI 45678959016, schema 45678959010, baseline 45678958981) and is non-draft/mergeable. Its description explicitly says merge is gated on the owner's tap; do not merge without it. No live Gmail API/OAuth call, inbox mutation, email send or two-inbox/mobile acceptance occurred.

PR #571 head `0ccde7e48784b2e845e92b859da70c366e5b9d83` has Gmail-mobile and baseline checks successful but full CI 45289419329 failed. PR #576 head `1757fb68715081525de0f8c7b8bd3bf531ebff20` has baseline 45401091926 successful and full CI 45401091730 failed. Both remain DRAFT.

## Contract job search/crawler

PR [#575](https://github.com/eshwarjay0-delS/job-dashboard/pull/575), head `31aeaf67011b0c12a4c736f054fed5b17004af42`, now has all five exact-head checks SUCCESS: full CI 45682807511, manual-only 45682807661, crawler freshness 45682807558, Kompas baseline 45682807483 and schema 45682807522. It replaces mutable offset paging with one ordered bounded snapshot and preserves the manual/on-demand policy. It remains DRAFT because:
- Apply still filters location/remote after the 100-row API result, so those searches can underfill.
- `/api/crawl/jobs` has `maxDuration=60`, while the runner budget can exceed that; do not change route duration without the installed Next.js guide and Vercel-plan confirmation.
- Protected preview requires the owner-controlled credential; it is unavailable in this environment.

No crawl, portal request, DB mutation or application submission was performed. PR #581's one-line prefer-const cleanup is superseded: current master a17b3267 already has the const declaration and its full CI passed. Do not merge the duplicate draft. PR #574 contract search, head `3d4bfd58cd746088ee0147e6aab79d5b37abaf47`, has regression/schema/baseline checks green but full CI 45602990382 failed and remains DRAFT/non-mergeable.

## Execution environment and coordination

The current container is at `/` with no canonical repository checkout, no `package.json`, and no `node_modules/next/dist/docs`. AGENTS.md requires the installed Next.js 16.3.8 guide before route-code edits. The prior persistent WhatsApp sandbox resume was blocked by HTTP 402 snapshot-storage quota with recorded reset at 2026-12-01T00:00:00Z; it was not retried in this audit. An approved local/cloud development environment containing the canonical checkout and installed package is the alternative unblock.

MFit Completion Watch is enabled. MFit Safe Merge Gate and Kompas Continuous Voice Delivery are disabled. No separate Bible-Keeper automation was found in the accessible automation inventory. No duplicate voice/caption work was started. No billing/access bypass, secret-value read, email/WhatsApp send, model call, R2 mutation, inbox mutation, live crawl or user-device test occurred.

## Continue

**Continue:** validate the corrected exact-head PR #583 (full CI and WhatsApp recovery), keep it draft until independent review, then continue the durable same-account Files/Library selection route when the installed Next.js environment is available. Preserve the historical 17 Oct incident as unverified until its original output and signed delivery evidence are recovered. In parallel, keep Gmail #580 behind its owner tap and crawler #575 behind protected preview plus the documented search/duration acceptance gaps.


## 25 November 2026 16:48 CDT — hard-hold policy and CI correction

Canonical master a17b3267e271c77cd8887312445271b7fa172bd0 and Vercel READY production dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW are exact; both aliases resolve. Aggregate WhatsApp webhook/recovery errors showed none in the last 24 hours; last 30 minutes had no function logs. Direct public HTTP smoke via web retrieval was inaccessible.

- Resume/JD PR #585 exact head 2e3d6f41b89694567992e45c73426f5add474141: CI 45712144382, resume 45712144296, recovery 45712144329, baseline 45712144568, Plan/REA 45712144317 SUCCESS. DRAFT; no protected preview, real resume/JD/confirmation or DOCX acceptance. Source review found no obvious defect this pass.
- WhatsApp PR #587 current head 1e2a1bf9a508f3d5b7dc175ca865b7f70182d202: full CI 45715458709 FAILED four assertions; recovery 45715458683, baseline 45715458615 and schema 45715458626 SUCCESS. Previous head b669456 failed the same four expectations: two expected unsupported supplierninja-tailored delivery and two expected fallback without explicit same-account Files/Library selection. The 20/24 Nov owner correction forbids closest-match/upload substitution; those are unsafe expectations, not route bugs to rewrite tests for. Test-only edits were briefly attempted and reverted; current failsafe test blob SHA matches the predecessor, so net assertions are unchanged. Durable explicit selection provenance and the unchanged Original resume — NOT TAILORED fallback remain unimplemented.
- PR #583 predecessor 7e00a7: full CI 45698027675 and recovery 45698027739 FAILED; baseline 45698027687 SUCCESS. Malformed test syntax is on that predecessor.
- Gmail #580 three checks SUCCESS; owner tap remains. Gmail/mobile #474 three checks SUCCESS; DRAFT/non-mergeable, two-inbox/selected-From/reconnect/narrow-phone acceptance missing. Poke worker, scheduler, notifications and sending remain disabled.
- Contract crawler #575 five checks SUCCESS; DRAFT. Location/remote filtering can underfill after the bounded server page; protected preview, duration and API acceptance missing. No crawl.
- Kompas #554 five checks SUCCESS; DRAFT/non-mergeable; second authorized reviewer required. No voice/caption duplication.
- PR #584 current docs head 7fb9b2df8470ebda05e1f31b3a67d15678fd7505 has no workflow runs visible. Prior head 0d4c54 had no runs; previous head 294ebdc full CI 45715731602 and schema 45715731673 FAILED due missing journal separator, baseline 45715731679 SUCCESS. The separator is corrected in the latest journal commit; exact-head validation is pending. PR #585 also carries Plan files, so keep both open until overlap is reconciled and exact CI completes.

No local checkout, installed dependencies or installed Next.js 16.3.8 route guide; sandbox restore remains quota-blocked until 1 Dec. No route edit, local tests/build, model, DOCX, email/WhatsApp, R2/DB/inbox, crawl or device acceptance.

**Continue:** finish exact-head #587 CI/recovery without weakening hard-hold assertions; implement explicit same-account Files/Library selection and the unchanged Original resume — NOT TAILORED fallback only in the required environment. Keep #585 DRAFT until real source/JD/confirmation and DOCX acceptance. Reconcile #584/#585 Plan overlap before merge.
