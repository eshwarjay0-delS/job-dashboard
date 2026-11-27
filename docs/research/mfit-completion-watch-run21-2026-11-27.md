# MFit Completion Watch — run 21 (27 November 2026, 20:36 CST)

## Scope and execution boundary

Read the current canonical MFit master, AGENTS.md, Plan & Vision, REA, the Completion Watch, product plans, and the referenced Kompas Chief Relevance handoff. Prior-context retrieval was scoped to the explicit WhatsApp fallback, confirmed-skill, Gemini, Gmail/Poke, and crawler decisions; it does not establish access to every conversation. No code implementation, local test/build, real model call, DOCX generation, email/WhatsApp send, R2/DB/inbox mutation, crawl, deployment, or device acceptance occurred.

## Production and master

- Canonical master: `9c35c4c00be558aaac927df5ba5c1625c540d4ca`.
- Production alias `job-dashboard-fawn.vercel.app` and deployment `dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW` independently report READY at runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`.
- GitHub compare confirms current master is six commits ahead of the runtime SHA, and the intervening files are documentation only. No runtime deployment is needed for this checkpoint.

## WhatsApp resume hard hold and 17 October incident

PR #591 remains DRAFT at `b4b110c48da5d8f260bb183849f0ee27b5f99f18`. Full CI `45792574554` fails tests 93/94/96/97/98; recovery `45792574886`, baseline `45792574496`, and Plan/REA `45792574863` pass. Current route source has no durable explicit same-account Files/Library selection marker; `sendClosest` reads `session.resumePath` and can send it after failed, unchanged or exception paths. `chosenResumeMatchesProfile` returns true without an email, and `unverified_jd_terms` remains in the shortfall allow-list. Do not weaken tests, replay, or send.

The 17 Oct 2026 17:28 Chicago delivery remains unverified. The same-name 27,724-byte archive item/digest is historical only; exact uploaded source bytes are not established. Generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound ID and signed delivery/read receipt remain missing. The current iZap business list still shows one scope with no WhatsApp number; the earlier zero-message/disconnected read is not proven to be the incident business.

The latest owner correction remains explicit same-account Files/Library selection only, exact label **Original resume — NOT TAILORED**, no closest-match/uploaded-original/silent substitution, otherwise explain and preserve the conversation. This supersedes older closest-resume auto-selection guidance for fallback.

## Resume/JD/confirmed-experience alignment

PR #595 exact head `77ebbaac0a05a6458df1736576a944193687982e` has all five exact-head gates SUCCESS:
- Full CI `45900605373`
- Confirmed-skill regression `45900605441`
- WhatsApp recovery `45900605451`
- Kompas baseline `45900605347`
- Plan/REA schema `45900605333`

It remains DRAFT and non-mergeable. The branch is 34 commits ahead and 1 behind current master `9c35c4c`; it must be cleanly restacked, not blindly merged. Existing unresolved review thread `4713559321` identifies a deterministic-repair gap: confirmed skills absent from original bullets are permitted by the prompt but are not included in the role-source gap weave, and no deterministic placement is guaranteed. New COMMENT review `6082791060` identifies a second evidence bug in `confirmedCandidateStatements`: `I used AWS, and my team used GCP` remains one statement because splitting only handles newline, semicolon and sentence punctuation. The entire statement can be treated as the candidate's own evidence, incorrectly confirming team-only GCP. Add regressions for team, colleague, client and organization subjects after first-person clauses; retain only individually attributable candidate claims or reject ambiguity.

The direct owner-approved mapping rule remains: an explicitly confirmed skill may be mapped into relevant existing project bullets across roles, including earlier roles, but it cannot create an employer, project, action, outcome, title, date, location, contact, metric or credential. The JD is not experience evidence. Gemini ATS score/feedback and missing/weak keyword identification are approved; automatic correction/re-export/recheck is not. Web raw overlap remains 95%; 98% is a target, not a live acceptance claim. No owner-authorized resume/JD/confirmation bundle or exported DOCX was used.

## Gmail/Poke and contract crawler

- Gmail PR #576 exact head `1757fb68715081525de0f8c7b8bd3bf531ebff20`: full CI `45401091730` fails stale shared `prefer-const` lint at `src/lib/kompasConsistency.ts:1059`; account-isolation test did not run. Baseline `45401091926` passed. PR #580 remains owner-merge-tap gated. Four connected accounts maximum. Proactive Poke worker, scheduler, notifications and sending remain disabled. No OAuth, inbox mutation, email send or phone acceptance.
- Crawler PR #590 exact head `1de4a3e493380f009d2b14dd35d0451f27392d51`: full CI `45774672289`, freshness `45774672245`, manual-only `45774672193`, baseline `45774672297`, and schema `45774672248` all SUCCESS. It remains DRAFT pending protected preview and public API smoke. Location/remote filtering can underfill after the 100-row page; route duration is 60 seconds versus a 230-second runner budget. Manual/on-demand only; no crawl or DB write.

## Kompas and voice coordination

The Chief Relevance handoff remains authoritative: answer the actual current ask, requested facets and constraints, use only original candidate evidence, preserve spoken naturalness, and distinguish deterministic tests from actual paired-answer quality. PRs #113/#114/#115 are merged and production ancestry is verified. Issue #120 remains open for 50 actual same-question Kompas/ChatGPT responses and independent human 0–4 scorecards; issue #152 remains open for authenticated protected-preview acceptance. Native Windows, WhatsApp and mobile speech acceptance remains unverified. The separate Kompas Continuous Voice Delivery automation is disabled; no voice/caption work was duplicated.

## Environment blocker

The available container has no canonical repository checkout and cannot resolve GitHub; no installed dependencies or Next.js 16.3.8 route-handler guide are available. Vercel persistent sandbox restore remains quota-blocked until `2026-12-01T00:00:00Z`. Unblock only through owner-controlled snapshot-capacity recovery or an approved local/cloud development environment containing the canonical checkout, dependencies and installed guide. Do not change billing, delete snapshots, bypass protection or substitute upstream docs for the required installed copy.

## Next action

Continue: clean-restack #595 on current master, add the candidate-attribution regressions and bounded deterministic role-scoped placement of confirmed skills without inventing project facts, then rerun all exact-head gates. Keep #591 fail-closed until durable same-account Files/Library selection provenance and the exact **Original resume — NOT TAILORED** fallback are implemented in the actual route/session flow. Require protected preview, owner-authorized real source/JD/confirmation, exported-DOCX inspection, and authenticated acceptance before release.


## Run 22 — Library source candidates for the 17 Oct WhatsApp incident (27 Nov 2026)

A title-only Library DOCX search covering 17 Oct 20:00 UTC-18 Oct 04:00 UTC returned zero. Nearby Oct 16 files surfaced: `Eshwar_Resume(1).docx` (19:49:28 UTC, 18,283 bytes, seven-page cybersecurity resume) and `Eshwar_Resume(3).docx` (20:54:43 UTC, 40,609 bytes, Salesforce Development/CPQ content, not the incident resume). They are date-adjacent candidates only; neither is correlated to the exact WhatsApp upload. No original checksum, generated DOCX, R2 version, webhook correlation, Meta outbound ID or signed receipt. Do not replay the failed run; a re-upload is a new evidence bundle.