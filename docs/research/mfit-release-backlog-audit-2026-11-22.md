# MFit release and backlog audit — 22 November 2026

**Audit time:** 2026-11-22 04:09 UTC  
**Canonical repository:** `eshwarjay0-delS/job-dashboard`  
**Verified master:** `361e2101db8ae76c59319d879e6d263bb42be8b2`  
**Verified production:** deployment `dpl_2eQJQ64iq2ZcyRgfE7CwaipFwgg4`, READY, target `production`, aliases `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app`, `aliasError=null`.

This audit uses the current repository, the accessible conversation context, GitHub PR/workflow records, Vercel deployment metadata and the active MFit Safe Merge Gate report. It does not claim access to every conversation. It does not treat a merge, green unit suite or READY deployment as native/user acceptance.

## Owner decisions preserved

- The 17 October 2026 17:28 Chicago WhatsApp resume failure remains unverified historical delivery.
- Latest WhatsApp fallback correction: only an explicitly selected same-account Files/Library item may be used, labelled exactly **Original resume — NOT TAILORED**. No automatic closest match, silent substitution, fresh-upload fallback or partial rewrite as a substitute.
- Web resume tailoring retains the 95% raw JD overlap rule. A completed readable WhatsApp DOCX below 95% may be sent with gaps disclosed; incomplete, skills-only, unreadable, failed or identity-mismatched rewrites may use only the explicitly selected same-account library item. 98% is a target, not a hard send threshold.
- Confirmed skills may be mapped into relevant existing project bullets. They do not authorize a new employer, project, action, outcome, date, title, metric or credential. The JD is not candidate evidence.
- Gmail is capped at four connected accounts. Mobile navigation expands below the sticky header in normal flow; no overlay, scrim, dimming or page inertness. The proactive Poke worker, scheduler, notifications and sending remain disabled.
- Contract crawling is manual/on-demand only; no daily cron. Robert Half remains manual-only pending compliant permission/feed evidence; eTeam remains excluded pending a compliant official feed.
- Kompas Voice Delivery is a separate task and is disabled in the accessible automation inventory. No voice/caption work was duplicated. No separate Bible-Keeper audit automation was found in that inventory.

## WhatsApp resume incident — highest priority, still blocked

The current master still contains the source-level gaps:

- `WHATSAPP_SHORTFALL_REASONS` includes `unverified_jd_terms`, and `whatsappRewriteUsable` still treats allowlisted reasons as deliverable shortfalls.
- `chosenResumeMatchesProfile` does not fail closed when the profile email is absent.
- The WhatsApp session and durable recovery shapes do not carry a dedicated proof that the user explicitly selected the exact same-account Files/Library item for this request.
- `pickAndMake` calls `chooseResume` with an empty default preference and can select a library resume without that explicit selection proof.

The exact 17 October output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivered/read receipt remain unavailable. The original resume is still quarantined pending fact reconciliation. The recruiter-addressed JD is not candidate evidence. No replay, resend, replacement generation, R2 mutation or WhatsApp send was performed.

PR status at this audit:

- [#486 — unsupported JD-only hard hold](https://github.com/eshwarjay0-delS/job-dashboard/pull/486): DRAFT at `1047e638b15c54eda7aeac1bd6313622c140cb04`; full CI `44906385583`, WhatsApp recovery `44906385557`, Kompas baseline `44906385530`, Plan/REA `44906385612` all SUCCESS. It is not merged or deployed.
- [#493 — durable explicit same-account selection](https://github.com/eshwarjay0-delS/job-dashboard/pull/493): DRAFT at `1040343cca65fd2a3b1ec0919365db43076ed00a`; full CI `44934971531` FAILED; WhatsApp recovery `44934971606`, baseline `44934971532`, Plan/REA `44934971609` SUCCESS. Do not merge this head.
- [#450](https://github.com/eshwarjay0-delS/job-dashboard/pull/450) remains DRAFT/conflicting and combines the approved narrow behavior with unapproved R2 ETag-CAS, leases and fencing. Do not merge the mixed branch or write R2.
- [#495](https://github.com/eshwarjay0-delS/job-dashboard/pull/495) has four green exact-head workflows, but Safe Merge Gate found it stale/diverged (9 commits ahead, 18 behind) and overlapping the active #493 Plan/REA/test work. Do not merge or overwrite shared records; let Safe Merge Gate sequence it.
- [#472](https://github.com/eshwarjay0-delS/job-dashboard/pull/472) is the confirmed-skill alignment draft at `e4afb4475e291d367d16c06778930fead3ed08ff`; full CI `44740851727`, WhatsApp recovery `44740851656`, baseline `44740851702`, Plan/REA `44740851769` SUCCESS. It is still non-mergeable on an older base; protected preview and exported-DOCX review with the authenticated source resume, exact JD and explicit confirmations remain missing.

### Exact execution wall

The existing persistent Vercel sandbox `mfit-whatsapp-resume-restack-20261115` and its snapshot were found. Resuming it with `get_named_sandbox(resume=true)` returned Vercel **HTTP 402 payment_required**: Hobby plan Sandbox usage limit exceeded, reset at **2026-12-01T00:00:00.000Z**. The current local container has no Vercel CLI fallback and no canonical repository checkout or installed `node_modules`.

`AGENTS.md` requires the installed Next.js 16.3.8 route-handler guide under `node_modules/next/dist/docs` before route-code changes. That guide cannot be inspected until the sandbox is legitimately resumable or an approved local/cloud environment provides the repository and installed package. Do not change billing, delete snapshots, bypass protection or substitute upstream documentation for the required installed guide.

## Resume / Gmail / crawler

### Resume and confirmed experience

PR #472 is the current candidate for the approved confirmed-skill mapping, but its stale/non-mergeable base, protected-preview gap and missing exported-DOCX acceptance remain. No source resume/JD/confirmation bundle was available in this run. No DOCX was generated and no live 95–100%/98% match is claimed.

### Poke-inspired Gmail/mobile

[#474](https://github.com/eshwarjay0-delS/job-dashboard/pull/474) remains DRAFT/non-mergeable at `56ba9341479854e3e3b8f59dc99814226721209b`. Full CI `44746084731`, Kompas baseline `44746084686` and Plan/REA `44746084809` SUCCESS. Protected preview, two authorized inboxes with colliding thread IDs, selected-From preservation, per-account reconnect and narrow-phone acceptance remain open. The four-account ceiling is authoritative. No Gmail API/OAuth call, inbox mutation or email send occurred.

### Contract job search/crawler

[#479](https://github.com/eshwarjay0-delS/job-dashboard/pull/479) remains DRAFT/non-mergeable at `e15f7dc5aa563a69c59c6d262ac913b71f171782`. Full CI `44805332914`, crawler regression `44805332916`, Kompas baseline `44805332732`, Plan/REA `44805332755` SUCCESS. Protected preview and post-release crawl acceptance remain missing. Current source still uses 600 ms pacing and a 25,000 ms request abort; the active registry has 20 adapters, with Robert Half and eTeam pending. The scheduler contains watchdog, Gmail crawl and WhatsApp recovery only; no contract-crawler cron exists. Last evidenced crawl remains 10 November: 20 portals, 6,818 found/upserted, one error. No crawl or portal request occurred in this run.

## Kompas release reconciliation

The following approved code changes are ancestors of current production SHA `361e2101`:

- `5b06192a74f2e087c7eef702c75906c2dc3a687b`: Start always starts; no auth gate or picker timeout on the Start click.
- `58c4475c3c804570547c6da228f3c754cd632c0e`: transcription now calls `/api/kompas/speech` with the expected headers instead of the nonexistent `/api/transcribe`.
- `3d6682295bc0249e3744bb7f37c7c2d167656666`: two transient answer-lane retries with 2s/4s backoff.
- The latest source also contains the one-retry correction `eeb0bbc2844d8254d27c74fe34ae11cc219559be` and the later two-retry behavior. These code changes are deployed; the user's real browser/Windows/phone listen-through remains unverified.

### Provider-routing decision

PR [#510](https://github.com/eshwarjay0-delS/job-dashboard/pull/510) was merged as `361e2101db8ae76c59319d879e6d263bb42be8b2` and is now READY in production. Exact-head full CI `44982573100`, Kompas baseline `44982573087`, and Plan/REA `44982573123` have since completed SUCCESS. At merge time, full CI was still running. This resolves the incomplete-CI observation, not the owner-approval question.

The fallback calls the shared `callLLM` provider-selection mechanism with the Kompas system prompt. The implementation's actual provider order/policy is not guaranteed to match the PR description's simplified list. The change can route resume/JD/interview context to additional AI providers. Safe Merge Gate flagged this as high-risk and requested an owner keep/revert decision; no review was recorded. Vercel environment-variable names were inventoried without reading values; presence does not establish a usable key or data-handling approval. **Do not send personal interview context through a newly introduced provider path or claim fallback acceptance until the owner decision and provider policy are resolved.** No model call was made in this audit.

The 50 authenticated Kompas/ChatGPT same-question pairs, independent human 0–4 grading, and native Windows/mobile/WhatsApp acceptance remain open.

## Coordination and work performed

- MFit Completion Watch and MFit Safe Merge Gate are enabled. Safe Merge Gate owns PR sequencing; do not parallel-edit #472/#474/#479/#486/#493/#495 or duplicate its review.
- Kompas Continuous Voice Delivery is disabled; no duplicate audio/caption work was started.
- Production alias and exact deployment SHA were independently checked.
- Current PR heads and exact-head workflow results were queried.
- Current WhatsApp acceptance/webhook/recovery, crawler collector/registry, and scheduler source were inspected.
- Existing WhatsApp sandbox snapshot was located; resume was attempted once and blocked by the Vercel 402.
- No source runtime code, tests, production settings, secrets, inboxes, WhatsApp messages, R2 objects, crawler rows or personal sessions were changed/read.

**Continue:** after Vercel Sandbox usage resets on 1 December 2026, or an approved local/cloud environment with the canonical checkout and installed Next.js 16.3.8 package is supplied, resume `mfit-whatsapp-resume-restack-20261115`. Implement only the explicit same-account Files/Library selection proof and unsupported-JD hard hold, add synthetic negative tests, run exact-head CI/recovery/baseline/Plan-REA checks, and let Safe Merge Gate review the resulting branch. Until then, preserve all active PRs and continue independent work without sending real messages or using personal source material.

## 24 November 2026 — current-master restacks and shared CI blocker

- WhatsApp: PR #572 direct-to-master head 6046251 initially passed recovery/baseline/Plan-REA but full CI failed on the shared Round 15 prefer-const lint. The one-token behavior-neutral fix is commit 5ee5fd9. After the docs/Plan/REA update, latest PR head is 089487f4e40c0023b7f1600a126f527af2263c75; exact-head recovery 45306850618, full CI 45306850675, baseline 45306850666 and Plan/REA 45306850606 were the current runs (full CI/recovery were still in progress at this audit update). PR #572 remains DRAFT.
- Resume/JD alignment: PR #570 current-master head b84664ece0d2b3a3cbd09dcd3766faebd528bd2d has confirmed-skill regression 45288928240, WhatsApp recovery 45288927870 and baseline 45288928288 SUCCESS; full CI 45288927923 stopped at the same prefer-const lint. No candidate resume/JD/confirmation bundle or exported DOCX was processed; no 95–100% or 98% live match is claimed.
- Gmail/mobile: PR #571 current-master head 0ccde7e48784b2e845e92b859da70c366e5b9d83 has Gmail/mobile regression 45289419319 (12/12) and baseline 45289419450 SUCCESS; full CI 45289419329 stopped at the same prefer-const lint. Four-account maximum and normal-flow mobile navigation remain. Proactive worker/scheduler/notifications/sending/Calendar targeting remain disabled. No Gmail API/OAuth or email send occurred.
- Contract search/crawler: PR #574 match-any search head 98ba36c2cfac9cf316ad05f1b90805adab35aeba has search regression 45290294629 and baseline 45290294762 SUCCESS; full CI 45290294631 stopped at the same lint. PR #573 crawler abort diagnostics head 2cb83ad60304ccc98e10d70ce12c10e086fe3440 has crawler regression 45289867811 and baseline 45289867654 SUCCESS; full CI 45289867721 stopped at the same lint. Manual/on-demand only, no contract-crawler cron, Robert Half manual-only, eTeam excluded. No crawl or portal request occurred.
- Shared blocker: PR #554 head 4fafd56663bb5ddce064dcebea8802d758bb8259 contains the lint fix, VM fixture initialization and Listening-hold behavior; its full CI, Kompas baseline, cross-device, Plan/REA and Windows gates passed. The only outstanding gate observed is a second authorized reviewer: GitHub rejected self-approval by the repository owner. Do not merge it without independent approval. The dependent focused branches #565/#567/#568/#569 remain stacked behind #554; current-master restacks #570–#574 are blocked by the same shared tests until #554 is reviewed and merged.
- Production remains READY at deployment dpl_2tyBPso5SnCgHCPFCqXewExCJEYp, exact master SHA 794e8cfdbd3103409552857806bab89851d5bfcb, with both job-dashboard-fawn.vercel.app and marketfit-app.vercel.app aliases. No new feature branch is deployed. No live WhatsApp, DOCX, R2, Meta, Gmail, crawler or user-device acceptance occurred.
- No local checkout or installed Next.js 16.3.8 docs are available; further route edits remain blocked until an approved local/cloud environment provides the installed package guide or the Vercel Sandbox quota resets 1 Dec 2026. Protected preview requires the owner-controlled KOMPAS_VERCEL_API_TOKEN; it was not read or bypassed.

## 24 November 2026 — Kompas S5 shared release gate

PR #554 exact head 4fafd56663bb5ddce064dcebea8802d758bb8259 has five SUCCESS gates: full CI 45123770495, Kompas baseline 45123770380, cross-device 45123770446, Plan/REA 45123770546 and Windows x64 executable 45123770398. It includes the prefer-const lint fix, answerCtl/detectedQueue test-harness initialization and the one-press Listening-hold repair. The only review is the owner's COMMENTED note; GitHub rejected self-approval, so a second authorized reviewer is required. No merge or deployment is authorized without that review.

PR #572 reaches the Kompas VM suite after lint/typecheck and fails on answerCtl ReferenceError; its recovery, baseline and Plan/REA gates pass. Direct-master PRs #570/#571/#573/#574 fail earlier at the shared lint error; their focused resume/Gmail/crawler/search gates pass. Stacked branches #565/#567/#568/#569 depend on #554. The separate Kompas Continuous Voice Delivery automation is disabled; no duplicate voice/caption changes were made.
