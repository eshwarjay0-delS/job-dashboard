# MFit continuation audit — 25 November 2026, 08:55 UTC

This is a documentation-only evidence supplement to the open draft backlog PR #579. It does not change runtime code, merge any PR, deploy, send email/WhatsApp, mutate production records, or run a live crawler.

## Canonical source and release

- Master: `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Vercel production: `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY, production target, exact master SHA; the `job-dashboard-fawn.vercel.app` alias metadata maps to it.
- Direct public `/version.json` and `/api/health` smoke attempts were inaccessible (DNS/network resolution). Deployment metadata is verified, public HTTP is not.
- The Kompas Round 15 JSON-answer shaping correction is in that release. Round 16 real same-question acceptance is not established.

## Exact CI blockers found

- **PR #580 Gmail skip-login connections status** — head `c3704793311af6ece6d3f9b23b906c21bc872fc0`. The dedicated Gmail regression job passed, as did Plan/REA and Kompas baseline. Full CI `45556039693` failed in the shared Kompas question-framing/one-press/typed/voice gate (24 failures). The retrieved log includes `ReferenceError: answerCtl is not defined` in `scripts/tests/kompas-typed-question.test.mjs` at lines 156/165 and `scripts/tests/kompas-voice.test.mjs` at line 166. This is a test-harness failure, not evidence of Gmail runtime failure. The PR body explicitly requires the owner's tap; no merge/deploy is authorized by the checks.
- **PR #578 WhatsApp unsupported-JD hard-hold helper** — head `1b3d3cb57e22eacd88bf3f2b9006f33a67a512f9`. Recovery, baseline and Plan/REA passed. Full CI `45518227134` fails Lint at `src/lib/kompasConsistency.ts:1059`: `'s' is never reassigned; use const`. PR #556 carries that one-line const correction but its full CI fails two Kompas one-press/typed-question assertions. Do not copy the voice fix in parallel.
- **PR #572 WhatsApp route-level explicit same-account Files/Library fallback** — head `741f8eeb284b2faeb5223c80162cc5f7d1344705`. Recovery, baseline and Plan/REA pass. Full CI `45460461747` fails two Listening-hold assertions: no-new-ask first press and candidate-only speech. Route-level durable selection proof remains separate from #578's helper hard hold; neither is live.
- **PR #570 confirmed-skill resume alignment** — head `7f249f5a0f52ecdac6e902dc7909497506c145f7`. Focused confirmed-skill regression 53/53, recovery, baseline and Plan/REA passed; full CI `45386097754` fails the shared Kompas gate. Exported DOCX and live ATS acceptance are not verified.
- **PR #575 clearance-safe crawler pagination** — head `b665c9a1cd8bdba2158bc35bca2b0262dc7dd5aa`. Crawler/manual-only/freshness/baseline/Plan-REA focused gates passed; full CI `45485435272` fails shared Lint. Existing review comment `6053398344` also identified the offset-pagination race when `last_seen_at` changes during concurrent crawl and requests keyset/snapshot semantics plus a moving-row regression. No live crawl.
- **PR #554 shared Kompas test-harness/Listening-hold correction** — exact head `4fafd56663bb5ddce064dcebea8802d758bb8259`; full CI, baseline, cross-device, Plan/REA and Windows checks are green. Only a COMMENTED review from the same account is present; a second authorized reviewer is required. Safe Merge Gate is disabled and Kompas Continuous Voice Delivery is disabled in the accessible automation inventory. No self-approval.

## Environment and release walls

- No canonical checkout or installed dependency tree. A shallow clone attempt failed because this runtime could not resolve `github.com`; local tests/build were not run.
- Protected Vercel preview still needs private `KOMPAS_VERCEL_API_TOKEN`. The prior Sandbox resume was rejected for exhausted Hobby snapshot-storage quota, reset 1 December 2026. No billing, access or protection bypass.
- No owner Windows/browser/phone access. No real WhatsApp output, R2 version, Meta outbound ID or signed delivery/read receipt for the 17 October 17:28 Chicago incident was found; do not replay/resend.

## Next

Continue: obtain the required independent review of #554 through the normal process; then rerun full CI on the latest #578/#572 heads and integrate the explicit-selection route proof with the hard hold only after the shared gates pass. Keep #580 behind the owner's tap, and preserve the resume/JD, Gmail/mobile, crawler, Kompas 50-pair and native-device acceptance backlog.

## 25 November 2026, 14:21 UTC — exact-head recheck

- Production alias metadata remains READY on `794e8cfdbd3103409552857806bab89851d5bfcb`; public HTTP smoke is inaccessible from this environment. No new release.
- PR #554 head `4fafd56663bb5ddce064dcebea8802d758bb8259`: full CI, baseline, account-sync, Plan/REA and Windows executable checks all SUCCESS. Only the owner's COMMENTED review is recorded; independent authorized review is the merge blocker.
- Combined WhatsApp PR #566 head `9465113780c59020cfdaf5e041d42dd4e93f93f8` has focused recovery `45283495328` and Plan/REA `45283495210` SUCCESS, but full CI/baseline/cross-device are not run because it is stacked on #554. Source review confirms durable explicit selection, account-root/email/path checks, owner/sender/JD/source binding, byte equality and unique profile-email checks before unchanged fallback.
- WhatsApp #578 head `61c45c91092fb4411428499d5c89a7efb71ec4cb`: recovery `45603013099`, baseline `45603012986`, Plan/REA `45603012994` SUCCESS; full CI `45603012948` fails 24 shared Kompas VM fixture cases (`answerCtl is not defined`). #572 head `741f8eeb284b2faeb5223c80162cc5f7d1344705` has recovery/baseline/Plan-REA SUCCESS and full CI `45460461747` fails two Listening-hold assertions. Neither is merged/deployed.
- Resume #570, Gmail #571/#577, contract search #574 and crawler #479 remain draft with focused gates green where reported but full CI blocked by shared Kompas failures. No real resume/JD, Gmail account, crawler, or device acceptance.
- Local checkout/test unavailable: DNS failure for GitHub in container; public HTTP smoke also inaccessible. No source code was changed; this is a documentation/evidence continuation.

**Next:** the #554 independent review must be completed through the normal gate. Then restack #566 to master and run exact-head full CI plus focused gates before preview/deployment/device acceptance. Historical WhatsApp delivery remains unverified; no resend/replay.
