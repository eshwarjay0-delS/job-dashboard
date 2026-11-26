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


---

## 2026-11-22 02:17 CST continuation addendum — current source, PRs and production

This addendum supersedes earlier status statements in this audit where the source, PR heads, deployment, provider test or automation state has since changed. Historical evidence above is retained.

### Canonical source and production

- GitHub master: `db32d9f3e5680fdd63e8cb4a728f38c0bd8a9a71`.
- Its parent/product-code SHA: `b6c7f542641b96b7392710c25f1a6a803f71fd62`.
- Production alias `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app`: READY deployment `dpl_GCED4HQBdCgX7dsmiwB6RW7mzknk`, exact runtime SHA `b6c7f542641b96b7392710c25f1a6a803f71fd62`, aliasError null. The master commit after that SHA is journal-only; no duplicate product deployment was requested.
- Last-hour Vercel runtime-error query returned no grouped errors. This is not a claim that the application is error-free or accepted on a real device.
- Direct OpenAI fallback is now recorded as deployed in the Plan Journal. The journal reports two live rounds, 10/10 answers HTTP 200 via `meta.provider=openai`, model `gpt-6-luna`, approximately 8–11 seconds each. This verifies the direct OpenAI lane, not the full Windows/phone/WhatsApp experience.
- The separate additional-provider path introduced by PR #510 still has an unresolved owner keep/revert decision. Do not test personal resume/JD/interview material through that path until its data-handling approval is explicit.

### WhatsApp — 17 October delivery remains unverified

Current master still contains the material gaps that the open WhatsApp branches are intended to close:

- `src/lib/role-match.ts` uses the current labelled/first-line title extraction; it does not yet include PR #495's named-resume preservation for a two-line JD.
- `src/lib/whatsapp-resume-acceptance.ts` still places `unverified_jd_terms` in the shortfall set, and its comments describe the old below-70% send behavior. PR #486 changes this to a hard hold.
- The webhook still calls `chosenResumeMatchesProfile(text, files?.email)` without a durable `explicitlySelected` marker on its current `FromFiles` type. PR #493 adds the durable same-account Files/Library selection proof and removes implicit unchanged-baseline delivery.
- No original output DOCX, exact R2 object/version, webhook correlation, Meta message ID, or signed delivery/read receipt was available. The 17 Oct 17:28 Chicago delivery is **not verified**.

Exact PR state checked against GitHub on this run:

| PR | Exact head | Checks | State / blocker |
|---|---|---|---|
| [#486](https://github.com/eshwarjay0-delS/job-dashboard/pull/486) | `1047e638b15c54eda7aeac1bd6313622c140cb04` | Full CI, recovery, baseline, Plan/REA all SUCCESS | DRAFT, nonmergeable; still requires sequencing and source-backed route acceptance |
| [#493](https://github.com/eshwarjay0-delS/job-dashboard/pull/493) | `1040343cca65fd2a3b1ec0919365db43076ed00a` | Recovery, baseline, Plan/REA SUCCESS; full CI `44934971531` FAILURE | DRAFT, nonmergeable; no merge |
| [#495](https://github.com/eshwarjay0-delS/job-dashboard/pull/495) | `4522a4ed9612a22fa304eb52f3772b02eb8ba44a` | 4/4 exact-head workflows SUCCESS | Open, non-draft, mergeable, but Safe Merge Gate's 07:23Z review withheld it because the branch was stale/diverged and overlapped #493's external-delivery/Plan/REA/test work |

The Vercel sandbox `mfit-whatsapp-resume-restack-20261115` and snapshot `snap_hGkcvPIR7Vw016qcK7dK8s4eQo3f` still exist. The recorded Hobby Sandbox 402 reset is **2026-12-01T00:00:00Z**. The current local container has no canonical checkout, Vercel CLI, installed dependencies or Next.js 16.3.8 route-handler guide. No retry was made before the stated reset, no billing/protection was bypassed, and no real WhatsApp message was sent.

### Resume/JD/confirmed experience

- [#472](https://github.com/eshwarjay0-delS/job-dashboard/pull/472), head `e4afb4475e291d367d16c06778930fead3ed08ff`: full CI `44740851727`, recovery `44740851656`, baseline `44740851702`, Plan/REA `44740851769` all SUCCESS. It remains DRAFT/nonmergeable on an older base. No authenticated original resume + exact JD + explicit candidate confirmations or exported-DOCX acceptance bundle was available. No new skill/employer/project claim was invented.
- The source-level confirmation helpers are present in current master, but the full approved alignment branch is not integrated. No 95–100% or 98% live match claim is made.

### Poke-inspired Gmail/mobile

- [#474](https://github.com/eshwarjay0-delS/job-dashboard/pull/474), head `56ba9341479854e3e3b8f59dc99814226721209b`: full CI `44746084731`, baseline `44746084686`, Plan/REA `44746084809` SUCCESS. It remains DRAFT/nonmergeable.
- Four-account ceiling remains authoritative. Protected preview, two authorized inboxes with colliding thread IDs, selected-From preservation, per-account reconnect and narrow-phone acceptance are still unverified. Proactive sending remains disabled; no Gmail OAuth/inbox mutation or real email occurred.

### Contract job search/crawler

- [#479](https://github.com/eshwarjay0-delS/job-dashboard/pull/479), head `e15f7dc5aa563a69c59c6d262ac913b71f171782`: full CI `44805332914`, crawler regression `44805332916`, baseline `44805332732`, Plan/REA `44805332755` SUCCESS; DRAFT/nonmergeable, protected preview and live crawl acceptance missing.
- [#488](https://github.com/eshwarjay0-delS/job-dashboard/pull/488), head `371ee1ee5cc58c305de67b15f7728ed8185b9466`: full CI `44872890121` and baseline `44872890091` SUCCESS; DRAFT/mergeable, Plan/REA and preview incomplete.
- [#489](https://github.com/eshwarjay0-delS/job-dashboard/pull/489), head `2dd7525f8a5d1d416e1a0d21a4b6bb5c1b121b82`: manual-only regression `44872487790`, crawler regression `44872487754`, baseline `44872487757`, full CI `44872487789` SUCCESS; DRAFT/mergeable, protected preview and authenticated API smoke missing.
- Contract crawling remains manual/on-demand only; no cron was added. No crawl or portal request was made in this run.

### Independent Kompas test continuation

- Created [PR #514](https://github.com/eshwarjay0-delS/job-dashboard/pull/514), current head `667e17b1459a0289f17b401d8524a9ab946bc11f`, a current-master restack of test-only PR #500. It fixes the unclosed mocked response object in `scripts/tests/kompas-brain-ui.test.mjs`, installs the local fetch stub before browser-script evaluation, and asserts two exact question-scoped calls to `/api/kompas/bridge`.
- Added a focused GitHub Actions workflow so this test runs independently even if an earlier unrelated CI step stops the main suite.
- Focused bridge workflow `45001879757`: SUCCESS. Kompas baseline `45001879854`: SUCCESS.
- Full CI `45001879775`: FAILURE at the separate question-framing/voice step; 24/72 tests fail with `ReferenceError: answerCtl is not defined` in `pumpDetectedQueue` from `scripts/tests/kompas-voice.test.mjs`. This PR does not edit voice code or suppress the failures. It remains DRAFT; no merge or deployment.
- Original #500 full CI `44964170569` was confirmed to fail at `kompas-brain-ui.test.mjs:73` with `SyntaxError: Unexpected token ')'`; PR #514 corrects that exact defect.

### Coordination and documentation boundary

- MFit Completion Watch: ENABLED.
- MFit Safe Merge Gate: DISABLED after its completed 07:23Z review; that review merged zero PRs and withheld #495. Do not assume automated review/merge is currently active or re-enable it from this run.
- Kompas Continuous Voice Delivery: DISABLED. No voice/caption source edits were made; the current full-CI failure is recorded, not repaired here.
- No Bible-Keeper audit automation was present in the accessible automation inventory.
- PR [#491](https://github.com/eshwarjay0-delS/job-dashboard/pull/491) remains open, DRAFT and nonmergeable, and edits shared Plan Journal, Plan & Vision, REA and Completion Watch files. This addendum records the new source/test/deployment evidence without editing those shared files. Append the corresponding Plan Journal/REA entry only after #491 is sequenced, to avoid conflicting edits.

No user email, WhatsApp message, external send, Gmail API/OAuth request, crawler request, R2 mutation, production session/data mutation, secret read or billing/protection change was performed in this continuation.
