# MFit Completion Watch — Run 24 source review (27 Nov 2026)

## Canonical release
- Production alias `job-dashboard-fawn.vercel.app` independently resolves to READY deployment `dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW`, runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`.
- Master checkpoint `1eb604b33cfe58f3c0f6ad611d346d5921e184ff` is documentation-only relative to that runtime. No production redeploy is warranted; no public HTTP smoke was run.

## Continue: Gmail account-cache race review
- PR #576 current source includes user-key-bound `shared`/`inflight` caches, account-switch generation reset, and stale-load suppression. The earlier comment asserting caches were unbound is stale and corrected in a new PR comment.
- Shared-lint commit `27f096fbb9a687069e18ea389de67b0470682d96` has full CI `45944935727` and Kompas baseline `45944935730` SUCCESS. The PR branch remains DRAFT and diverged 21 ahead/8 behind current master; protected preview and two-inbox/narrow-phone acceptance are absent.
- New source review comment `7218246884`: `refreshGmailDataForCurrentAccount()` publishes the account snapshot after awaiting `snapshotKey()` without re-checking the active account/generation. An isolated async sequence reproduced a stale B snapshot publishing after a B→C switch; this is not a live Gmail/session test. Add a guard and behavioral race test.

## Continue: confirmed-skill resume alignment
- PR #598 latest reviewed head `e06e7b04b0722a32118d94c366e0a6331215f062` has all five exact-head gates SUCCESS: full CI `45967988208`, focused `45967988274`, WhatsApp recovery `45967988296`, Plan/REA schema `45967988200`, Kompas baseline `45967988229`. Compare against current master: 38 ahead, 0 behind; PR remains DRAFT.
- The source now supplies confirmed terms to `roleScopedMissingTerms` through `roleScopedConfirmedSkillTerms`, appearing to address #595's deterministic candidate gap. Existing tests validate helper selection, but not the final weave/edited bullet integration.
- New source-review comment `7218305032` reports six modifier-bearing actor phrases (engineering/SOC/security/IT/operations team and passive “by the engineering team”) that remain unsplit in copied-regex simulation, so a team-only skill can still be attributed to the candidate. Existing unresolved thread `4718073397` covers relative-clause attribution. These are source findings, not local execution.
- Predecessor PR #595 remains DRAFT/diverged with unresolved comments; #598 is the current continuation. No authorized real resume/JD/confirmation bundle, model call, exported DOCX or live match was performed.

## Other approved backlog
- **WhatsApp #591:** exact head `b4b110c48da5d8f260bb183849f0ee27b5f99f18`; full CI fails route assertions 93/94/96/97/98; recovery `45792574886`, baseline `45792574496`, schema `45792574863` pass. Route-level durable explicit same-account Files/Library selection proof is still absent; preserve hard hold and exact `Original resume — NOT TAILORED` fallback policy. The 17 Oct 17:28 Chicago incident remains unverified; the earlier scoped Library/iZap searches did not establish exact source/output/provider delivery evidence. No send/replay.
- **Crawler #590:** five exact-head gates remain green; DRAFT pending protected preview/public API smoke. Location/remote filtering can underfill after the 100-row result, and POST duration 60s is shorter than runner budget 230s. Manual/on-demand only; no crawl.
- **Gmail #580:** owner merge tap still required. Four connected accounts max; no proactive Poke worker/scheduler/notifications/sending.
- **Kompas:** issue #120 actual 50 same-question pairs/human grading and #152 protected-preview acceptance remain open. Native Windows/mobile/WhatsApp speech acceptance is not verified; Kompas Continuous Voice Delivery is disabled.

## Execution wall
No canonical checkout, installed dependencies or Next.js 16.3.8 route-handler guide; GitHub DNS is unavailable from the container. The Vercel sandbox restore returns 402 and is unavailable until 1 Dec 2026 00:00 UTC. Remote GitHub source/CI review and documentation branch updates are available; no local code/tests, DOCX, model, OAuth/inbox, WhatsApp send/replay, R2/DB write, crawl or device acceptance occurred.

## Next
After the compliant checkout/dependencies/guide are restored, fix #598's modifier-bearing attribution and relative-clause cases, add an integration regression proving the confirmed-skill final weave places only a context-fit skill in an existing bullet, and rerun exact-head gates. Then clean-restack the approved #595/#598 source onto current master, keep #591 fail-closed until durable same-account selection provenance is implemented, and preserve protected-preview/owner acceptance gates.

## Run 24 code follow-up (27 Nov 2026, 06:44 CST)

- On approved PR #598 branch `fix/resume-confirmed-skills-attribution-gap-20261127-run21`, commits `f41d654` add the modifier-bearing team actor/passive matcher and `f47f6f8` add six regressions plus the positive `I used AWS and GCP` control. Exact copied-regex simulation split all six team-only clauses and retained the positive control.
- A direct `constructed-jd.ts` test import failed because Node's strip-types runner cannot resolve its extensionless `keyword-targets` dependency. The import/integration attempt was removed in `87ffa22`; existing helper-level role-gap/context and source-path assertions remain. Behavioral final-weave integration is still unverified.
- The subsequent focused run `46000740516` failed due the resume-evidence import and first `for` loop being concatenated during GitHub Contents rewrite. Commit `ec7188a` restores the newline. Latest exact head `ec7188acc98eb4d12d516526bc9edf2712c1192d` has baseline `46001027351` SUCCESS and schema `46001027332` SUCCESS; focused `46001027426`, full CI `46001027344`, and WhatsApp recovery `46001027395` are still IN_PROGRESS. No local test. Do not merge unless all latest-head gates pass and review remains independent.
- Public HTTP smoke was attempted through the web tool for `/kompas/version.json`, `/api/kompas/desktop-version`, `/api/kompas/account-sessions`, `/api/gmail-sync`, and `/api/crawl/jobs?limit=1`; every open returned an internal tool error. This is inconclusive and is not evidence the site is down.
- A fresh scoped Library search and personal-context search did not recover the 17 Oct 17:28 WhatsApp incident's source resume, output DOCX or delivery trace; no conversation matched. This remains an exact evidence blocker.
