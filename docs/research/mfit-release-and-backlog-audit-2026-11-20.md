# MFit source, release and backlog audit — 20 November 2026

## Scope and method

This is a source-and-artifact audit of the canonical `eshwarjay0-delS/job-dashboard` master branch, its current PR metadata and GitHub Actions runs, the Plan & Vision / Completion Watch records, and the linked Vercel production deployment. It records only accessible evidence. It does not claim access to every prior conversation or infer instructions that were not recovered.

No local repository checkout or installed Next.js package tree was available in this scheduled environment. No local code execution was performed. GitHub Actions results are reported by exact commit/run ID; they are not represented as local tests.

## Current production release: Kompas S5

- PR [#482](https://github.com/eshwarjay0-delS/job-dashboard/pull/482) is merged from head `fa4d97367eb5e22b224f1b45f39a9f1a56289b52`.
- Canonical master is `3a1b0bb718874f8fca5adc5f78362d3009a11281`.
- Vercel deployment `dpl_EZce7dEERrv1eVUFf64YoAzwoicb` is READY for production; `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` resolve to that deployment; aliasError is null and the GitHub Vercel status is SUCCESS.
- Five exact-head workflows completed SUCCESS: full CI `44771227117`, Kompas baseline `44771227102`, cross-device sync `44771227084`, Plan/REA `44771227156`, and Windows Caption Capture executable `44771227100`.
- The S5 feature scope is recorded as approved, but the preceding journal entry and PR body preserve a pre-release “no ship / do not merge” hold. A separate owner-authored ship approval is not established in the accessible record. The merge and deployment are recorded as observed facts, not proof of an unseen approval.
- Deployment is not live-session acceptance. No authenticated model call, shared-tab click-through, native Windows listen, real vision first-token measurement, 50-pair Kompas/ChatGPT comparison or human grading was performed. The Fortinet Houston summary is a default fixture only; it must not replace an actual loaded resume or be treated as confirmed candidate experience.

## WhatsApp resume incident and current source gap

The 17 October 2026 17:28 Chicago attempt remains a visible hold, not verified delivery. The screenshot, source-resume archive reference and a matching JD reference were recovered in earlier read-only work. The source resume remains quarantined because its facts are not reconciled with owner-confirmed facts. The generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound ID and signed delivered/read receipt remain missing. The JD reference was retrieved from a recruiter-addressed message and is not candidate evidence. No replay, resend, replacement document, R2 write or Meta send is authorized by this audit.

Current master source inspection found:

- `src/lib/whatsapp-resume-acceptance.ts` still places `unverified_jd_terms` in `WHATSAPP_SHORTFALL_REASONS`; `whatsappRewriteUsable` treats reasons in that allowlist as deliverable shortfalls. The approved unsupported-JD hard hold is therefore not yet in canonical master.
- `chosenResumeMatchesProfile` returns true when no email is supplied.
- The WhatsApp `Session` and `ResumeRecoveryJob.files` shapes have no dedicated durable explicit-selection boolean. `pickAndMake` calls `chooseResume` with an empty default preference and can auto-select a library item. A path and same-account email do not prove that the user explicitly selected that Files/Library item.
- The latest owner correction requires only an explicitly selected same-account Files/Library resume as fallback, labelled exactly **Original resume — NOT TAILORED**. Automatic closest-match, fresh upload without explicit library selection, silent substitution and partial rewrite are not permitted. The separate uploaded-original-after-provider-timeout behavior remains unapproved.
- PR [#450](https://github.com/eshwarjay0-delS/job-dashboard/pull/450) contains the intended narrow fallback/hard-hold changes but also unapproved R2 ETag-CAS/conditional-write and worker lease/fencing behavior. It remains DRAFT/conflicting at `05c19ec2012479d1c78e7a5ad7b8e77ee1f24e58`; no exact-head Actions runs were found. Do not merge the mixed branch or mutate R2.

**Exact implementation blocker:** AGENTS.md requires reading the installed Next.js 16.3.8 route-handler guide under `node_modules/next/dist/docs` before route-code changes. This environment has no repository checkout or installed package tree. The prior Vercel sandbox attempt was refused with HTTP 402 because snapshot-storage quota was exceeded. The work can resume when the owner-controlled snapshot capacity is released or an approved local/cloud environment supplies the canonical repository and installed Next.js 16.3.8 package. Do not change billing, delete snapshots, bypass protection or substitute upstream documentation for the installed guide.

## Resume, Gmail/mobile and contract crawler

### Resume/JD/confirmed experience

The 14 November owner approval allows explicitly confirmed skills to map into relevant existing project bullets across roles. It does not authorize new employers, projects, actions, outcomes, dates, metrics, titles or credentials. PR [#472](https://github.com/eshwarjay0-delS/job-dashboard/pull/472) is DRAFT/non-mergeable at `e4afb4475e291d367d16c06778930fead3ed08ff`, based on older master `2da44026c0ab58ab2966b9371992efaf93427de4`. Exact-head gates and exported-DOCX acceptance are not established here. An authenticated source resume, exact JD and explicit candidate confirmations are required for real role-by-role output review. Direct user approval for the final-DOCX Gemini score → evidence-only correction → re-export → bounded recheck loop was retrieved at 2026-11-15T22:06:43Z. The later 2026-11-19T19:29:41Z user message says the loop remains unfinished, not revoked. A targeted 20 Nov search found no direct user-authored 19 Nov 14:02 Chicago revocation; the contrary wording appeared only in assistant summaries. The loop is approved but unimplemented. Do not equate synthetic tests or keyword overlap with a 95–100% or 98% live match.

### Poke-inspired Gmail/mobile

PR [#474](https://github.com/eshwarjay0-delS/job-dashboard/pull/474) is DRAFT/non-mergeable at `56ba9341479854e3e3b8f59dc99814226721209b`, based on older master `2da44026c0ab58ab2966b9371992efaf93427de4`. The owner confirmed four connected accounts maximum in PR #452 comment 7033546581. Mobile navigation must expand below the sticky header in normal flow, without overlay, scrim, dimming or page inertness. Keep the proactive Poke worker, scheduler, notifications and sending disabled. Protected preview, two authorized inboxes with colliding thread IDs, selected-From preservation, per-account reconnect and narrow-phone acceptance remain open. No live Gmail API/OAuth call, inbox mutation or email send was performed.

### Contract crawler

Current `vercel.json` schedules `/api/agent/watchdog`, `/api/gmail/crawl` and `/api/whatsapp/recover`; it does not schedule `/api/crawl/run` or a contract-crawler endpoint. The current active adapter registry has 20 adapters; Robert Half and eTeam are in `PENDING_PORTALS`, not `ADAPTERS`. The collector still uses 600 ms pacing and a hard-coded 25,000 ms request abort. PR [#479](https://github.com/eshwarjay0-delS/job-dashboard/pull/479) is DRAFT/non-mergeable at `671a3732105111a8d8fdf91678359fb74f7b5332`, based on older master `25b6046c0e3a80f48d020f8220d33f60b54df10c`; it proposes only local-timeout/upstream-abort diagnostics and malformed-URL cleanup. Crawling remains manual/on-demand only. Robert Half remains manual-only; eTeam remains excluded pending a compliant official feed. The last evidenced crawl was 10 November: 20 portals, 6,818 found/upserted, one error. No live crawl was run.

## Kompas items still open

- PR [#483](https://github.com/eshwarjay0-delS/job-dashboard/pull/483) remains open; exact-head full CI `44776961595` failed at the release-stamp assertion (expected `20261119-latest`, received `20261120-10fold`). Other recorded gates passed, but the full-CI failure blocks merge. The PR also changes provider fallback, cached Houston answers, Long-answer shaping and session reuse; those need separate source and session-boundary review.
- PR #480 remains conflicting with an unresolved desktop visibility/product decision. PR #476 must preserve both stalled-answer watchdog and failed-request regression coverage. MFit Safe Merge Gate owns sequencing; do not create parallel edits.
- The 50 authenticated Kompas/ChatGPT answer pairs, independent human grading, and real Windows/mobile/WhatsApp acceptance remain unverified. Kompas Continuous Voice Delivery is disabled; no duplicate voice/caption work was performed.

## Work completed in this audit

- Independently verified the exact PR #482 merge SHA, five successful exact-head workflows, READY Vercel production deployment and canonical aliases.
- Audited current WhatsApp fallback/acceptance source, session and recovery shapes, and the exact blocker to implementing the approved selection-provenance guard.
- Audited the contract-crawler cron list, active/pending adapter registry and current request pacing/timeout.
- Updated the Plan Journal, Plan & Vision product baselines and Completion Watch in the documentation-only PR [#484](https://github.com/eshwarjay0-delS/job-dashboard/pull/484). No runtime behavior changed and no production deployment is requested by that PR.

## Limitations and next action

No local code execution, real model call, real Gmail/WhatsApp operation, R2 mutation, live crawl, personal-session read or device test occurred. Approval evidence is limited to the accessible conversation context and repository records.

Continue: once the installed Next.js 16.3.8 documentation and a runnable canonical repository environment are available, implement only the explicit same-account Files/Library selection provenance and unsupported-JD hard hold, with synthetic tests for explicit selection, automatic-match rejection, wrong-account/path rejection and text-only hold. Keep R2 CAS/lease/fencing, uploaded-original-after-timeout, proactive Poke behavior and unapproved Kompas changes out of scope.
