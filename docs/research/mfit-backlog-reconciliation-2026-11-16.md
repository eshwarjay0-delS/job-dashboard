# MFit backlog reconciliation — 16 November 2026

## Scope and evidence rules

This is a current-master reconciliation of the approved WhatsApp resume, factual resume/JD alignment, Poke-inspired Gmail/mobile, contract crawler and Kompas work. Approval, source implementation, tests, deployment and real user acceptance are separate states. No synthetic or unit-test result is treated as a live 98% resume match, delivered WhatsApp document, working phone UI or completed Kompas voice test.

## Canonical source and production

- Repository: `eshwarjay0-delS/job-dashboard`
- Canonical master: `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`
- Production alias: `job-dashboard-fawn.vercel.app`
- READY production deployment: `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`
- Production SHA: `b94e1629c544048d84a2b048ae83b21b612ab9dd`
- GitHub compare [production SHA → master](https://github.com/eshwarjay0-delS/job-dashboard/compare/b94e1629c544048d84a2b048ae83b21b612ab9dd...8ad319d1092fffa7e6a31a4da1b4dc61ac634934) reports 15 commits ahead, 0 behind. All changed files are CI/workflow, AGENTS, docs, tests and Plan/REA; no runtime source/config files changed. This is a documentation/test lag, not a pending runtime deployment. No new runtime release was created in this continuation.
- PR #416 fixture privacy correction is merged at master SHA `8ad319d`; it replaces identifying fixture names/paths with synthetic candidates and reserved example.test identities.

## WhatsApp resume and 17 October incident

Accessible prior-conversation retrieval recovered the direct owner message at `2026-10-27T15:14:08Z`: “Continue until done; even offline, give the closest matched resume from the user's library as failsafe.” This explicitly approves the closest matched same-account library resume as the offline failsafe. No direct owner wording was recovered approving the exact uploaded DOCX being sent unchanged after a provider timeout; that behavior appears only in assistant-authored implementation notes and remains a separate owner-decision gate. Current master has the source path:

`fromLibrary` → `pickAndMake` → `chooseResume` → `generate` → `sendClosest`

The selection is scoped to the chosen library email; the resume-failsafe path and library-selection tests cover the selected file and profile isolation. This is source/test evidence only, not proof of a real WhatsApp send or delivery.

Do not conflate that library fallback with PR #411's separate behavior of sending an uploaded DOCX unchanged after a provider timeout. PR #414 Oct 17 source/JD evidence is DRAFT on stale base `17f8dada`, non-mergeable and has no exact-head workflow runs; it recovers source/JD but not the generated output or delivery receipt. PR #418 approval-provenance docs is 3/3 green but shares Plan/REA/Completion Watch files with #414/#421 and remains sequenced. PR #421 first-person-only parser is 4/4 green but has unresolved review objections; the universal first-person-only rule is not supported by the recovered owner instruction. PR #411 is DRAFT at head `069707f9e7a48a698f80835bf6cf2a820ebe49b6`, based on stale master `17f8dada`, non-mergeable, and has no exact-head workflow runs. The PR itself records an explicit owner decision as a gate. The 27 October library-fallback approval does not, by itself, authorize this separate uploaded-original timeout behavior.

The 17 October 2026 17:28 Chicago incident remains historically unverified. The screenshot/hold and matching JD are documented, but the generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivered/read receipt remain missing. A date-scoped Library/conversation search in this run did not recover the output artifact. No replay or resend was attempted.

Recent production quality evidence: the selected seven-day WhatsApp runtime aggregation showed 14 quality-gate rejection events across 12 users, last at 2026-11-13 21:45:42 UTC on an older deployment. The selected last-hour error aggregation returned no WhatsApp errors. This does not prove the quality issue is fixed or that a document was delivered.

## Resume/JD/confirmed-experience alignment

The 6 November confirmed-skill correction is supported by owner-authored GitHub comment [#6817645128](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6817645128), which cites the 6 Nov 09:55 CT owner instruction: an explicitly confirmed skill may be mapped naturally into relevant existing project context across roles, including earlier roles. The skill confirmation does not authorize a new employer, project, action, outcome, date, title, location, contact, metric or credential.

PR #423 is DRAFT at exact head `fccf93c1a3377149172d012e1158e5e2cea0a973`, based on current master. Exact-head gates all pass:
- Full CI: `43784557000`
- WhatsApp recovery: `43784556944`
- Kompas baseline: `43784556952`
- Plan/REA schema: `43784556985`

Remaining gates: legitimate protected Vercel preview using the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`; owner-authorized baseline resume, exact JD and explicit confirmation; inspect the actual exported DOCX and record measured raw/weighted coverage. No owner document or model call was used here. Do not claim 95–100%, 98%, or live match success from the source tests.

PR #417 final-DOCX Gemini score-only diagnostic remains DRAFT on a stacked base. No final DOCX was generated or sent to Gemini in this run. The separate automatic correction/re-export/re-review loop remains outside the score-only approval.

The Plan records a 6 November 70%/95% WhatsApp threshold. This run did not independently retrieve the original owner-authored threshold message; preserve the existing repository record and mark primary-source provenance as not re-retrieved rather than presenting this run as new approval.

## Poke-inspired Gmail and mobile

PR #424 is DRAFT at exact head `581d2298f384af36e4f039d4929b8056890694c8`, based on current master. Exact checks:
- Full CI: `43783027558` SUCCESS
- Kompas baseline: `43783027624` SUCCESS
- Plan/REA: `43783027545` SUCCESS
- WhatsApp recovery workflow: no run on this Gmail-only diff; do not invent a result.

Read-only production snapshot:
- `mfit_gmail_sync`: 3 account rows for 1 user
- Latest sync: 2026-11-10 14:44:44 UTC
- All 3 sync rows are older than 24 hours
- `mfit_gmail_threads`: 2,002 cached threads; latest update 2026-11-10 14:46:49 UTC
- Vercel Gmail-route runtime error aggregations returned no errors in the selected 7-day and 1-hour windows.

The daily `/api/gmail/crawl` cron in `vercel.json` is the interview-thread discovery path backed by `private.google_workspace_accounts`; it is not evidence that the Poke-style `mfit_gmail_threads` snapshot is being refreshed. The proactive Poke worker remains disabled. Do not enable it, make Gmail API/OAuth calls, mutate inboxes, or send notifications without the task-specific approval and authenticated acceptance.

PR #424 still requires a legitimate protected preview, two authorized inboxes with colliding provider thread/sender identities, correct receiving-inbox and selected-From behavior, independent reconnect, and a narrow-phone test. No real inbox or phone test occurred.

## Contract job search and crawler

PR #419 Right To Hire / Contract To Perm classifier is DRAFT at exact head `6532435cde0ecebf55c6b87a4b8311f75ff94c86`:
- Full CI `43727608981` SUCCESS
- Plan/REA `43727608983` SUCCESS
- Kompas baseline `43727608927` SUCCESS
- Crawler regression `43727608944` SUCCESS

PR #422 crawler abort diagnostics is DRAFT at exact head `eab1dcde9cad2db0d4b5e6b92739fa802a8bc153`:
- Full CI `43758258759` SUCCESS
- Crawler regression `43758258775` SUCCESS
- Kompas baseline `43758258754` SUCCESS
- Plan/REA `43758258774` SUCCESS

Read-only production snapshot:
- Total jobs: 14,566
- Active jobs: 12,407
- Seen in the last 14 days: 10,509
- Latest seen: 2026-11-10 11:01:11 UTC
- Latest crawl: 2026-11-10 11:00:24–11:01:11 UTC
- Latest run found/upserted 6,818 jobs across 20 portals and recorded one error.

Current `vercel.json` has no contract-crawler cron. Manual/on-demand only remains authoritative; Robert Half remains manual navigation only. No admin-authorized manual crawl, portal request, job-row write or application submission occurred. Both PRs remain DRAFT pending legitimate protected preview and any separately authorized operational acceptance.

## Kompas and task coordination

The canonical Chief Relevance handoff still requires 50 actual authenticated Kompas-versus-ChatGPT answer pairs, independent human grading, and native Windows/WhatsApp/mobile speech latency and continuity evidence. The private `KOMPAS_API_TOKEN` and approved original resume/JD/reference bundles are not available to this run. Synthetic/unit tests are not substitutes.

The separate Kompas Continuous Voice Delivery automation is disabled. No Bible-Keeper automation was visible in the accessible automation inventory. No duplicate voice/caption implementation or test was started.

## Shared hard blockers

1. The owner-controlled private `KOMPAS_VERCEL_API_TOKEN` is not available to this run, so legitimate protected previews for runtime PRs cannot be completed. Do not bypass preview protection or expose secrets.
2. The exact 17 October output DOCX and correlated R2/webhook/Meta delivery identifiers/receipt are missing. Do not replay or resend.
3. The uploaded-original-after-timeout behavior in PR #411 needs an explicit owner decision; the library fallback approval is not interchangeable.
4. Actual owner-authorized resume/JD/confirmation and exported-DOCX acceptance for #423 are missing.
5. Two-inbox and phone acceptance for #424 are missing; Poke proactive worker is not enabled.
6. Contract crawling remains manual/on-demand and needs an authorized admin for any manual run.
7. The real Kompas 50-pair and native voice acceptance evidence is missing.
8. The container could not resolve `github.com`; local clone/tests were unavailable. GitHub Actions exact-head results are the executable source-validation evidence.

## Actions in this continuation

- Read current master, `AGENTS.md`, Plan/Journal/REA, Completion Watch and the Chief Relevance handoff.
- Verified exact PR heads and GitHub Actions runs for #419, #422, #423 and #424; confirmed #416 merged into master.
- Verified current production alias and selected Vercel error windows.
- Queried Supabase using read-only aggregate SQL only; no personal Gmail contents or row-level account identifiers were retrieved.
- Searched Library/conversation surfaces for the 17 October output artifact; no match was returned.
- No real email/WhatsApp send, Gmail API/OAuth request, model call, DOCX generation, R2 mutation, manual crawl, production database write, billing change, secret read or device test occurred.

Continue: keep the exact-head green PRs in DRAFT until their protected-preview and owner/device acceptance gates are met; next highest-priority work is the legitimate protected-preview unblock and the owner-authorized exported-DOCX acceptance for PR #423, while preserving the separate #411 uploaded-original approval gate.


## Documentation change record

The reconciliation is recorded on branch `docs/mfit-backlog-reconciliation-20261116`, created from master `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`. Initial evidence commit: `0b8b744e75403a9e5976a0afe0c495a0ed64c6e6`. This branch changes Plan & Vision, journal, REA, Completion Watch and this research note only; no runtime code or production configuration changed.
