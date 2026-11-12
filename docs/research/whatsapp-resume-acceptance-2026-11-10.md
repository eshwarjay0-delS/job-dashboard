# WhatsApp resume hold — exact source recovery and evidence boundary

Updated: 10 November 2026. Method: read-only Library, Gmail, GitHub and database review plus local DOCX metadata/text inspection. No model call, real email, WhatsApp send, R2 write, or production mutation was performed.

## Recovered 17 October incident

The archived Library screenshot was created at `2026-10-17T22:28:39Z` (5:28 PM America/Chicago). It shows the M Fit WhatsApp thread:

- At about 5:25 PM, a Security Engineer – Risk & Controls job post and a five-page, 28 KB Word resume were submitted.
- At 5:28 PM, the bot replied: “The rewrite did not reach your 98% coverage target after automatic repair. I have held the file.”
- The visible missing-term list was `ccsp`, `cism`, `crisc`, `cisa`, `canton`, `sol`, `specialty`, `attributes`.

### Original resume bytes recovered

The exact input DOCX was recovered from a private Library archive. It is 27,724 bytes; its digest was verified locally and is retained with the private artifact, not published in this repository. This is the original source file, not a generated output.

### Full job description recovered

The complete JD was recovered from the matching forwarded message in the user's private inbox. Its title, location, contract type and opening requirements match the screenshot.

The JD requires a bachelor's degree; 5+ years in cybersecurity, technology risk, information security, risk management or controls governance; risk assessments and control evaluations; remediation through closure; NIST, ISO 27001, CIS Controls or COBIT; AWS/Azure/GCP; IAM, secrets, encryption and key management; audit/compliance support; and analytical, problem-solving and communication skills.

Preferred items include blockchain, smart contracts, cryptography and DLT platforms (Ethereum, Hyperledger Besu, Canton, Solana, Polygon); SSDLC/DevSecOps; vulnerability management/security testing; Archer, ServiceNow GRC and MetricStream; risk metrics/dashboards/executive reporting; CI/CD and cloud-native controls; CISSP/CISM/CRISC/CISA/CCSP; and AWS Security Specialty.

## Evidence classification of the eight screenshot terms

- `CCSP`, `CISM`, `CRISC`, `CISA`, and `AWS Security Specialty` are certifications. The current canonical keyword pipeline intentionally excludes certifications from match targets and removes certifications absent from the source. Do not add them to raise coverage.
- `Canton` and `Solana` are preferred blockchain platforms. The recovered source resume does not show them; they remain unsupported and must not be written as candidate experience.
- `sol` is not a separate JD skill. The full JD says `Solana`; do not count the truncated fragment separately.
- `attributes` does not appear in the recovered JD as a skill or qualification. It is generic extraction noise and must not hold a resume below its target.

A source-backed regression in this PR adds `sol` and `attributes` to the generic/non-skill filter and tests the incident's certification and preferred-platform boundaries. It does not lower evidence gates or add unsupported skills.

## Important source conflict — owner reconciliation required

The recovered source DOCX contains education, employment-date and credential claims that conflict with the owner-confirmed profile already available in prior conversations. The conflict affects the JD's required 5+ years and some credentials. Do not count the conflicting dates, tenure or credentials as confirmed experience, merge the two timelines, or rewrite them until the owner reconciles the source. The file is evidence of what was uploaded, not proof that every claim is current and verified.

A separate Library resume artifact is not accepted as the incident output: its document fingerprint differs, its core document timestamps predate the incident, and there is no request ID, R2 key or Meta receipt linking it to this run.

## Current policy and release state

The old 98% hard WhatsApp hold is superseded by the owner-approved 6 November channel policy in `src/lib/whatsapp-resume-acceptance.ts` and `docs/research/whatsapp-scored-rewrite-2026-11-06.md`:

- Web downloads retain the strict 95% raw-JD-overlap gate.
- WhatsApp may send a completed, readable 70–94.9% raw-overlap DOCX with disclosed gaps when supported coverage is at least 95% and all clean-pass checks hold.
- A finished readable result below 70% may be sent with gaps disclosed, but is not a clean pass.
- Incomplete, skills-only, unreadable, failed or identity-mismatched rewrites use the selected same-account resume fallback.
- Unsupported experience, credentials, employers, dates and metrics are never invented.

PR #267's DOCX body/header/footer/hyperlink identity repair is already merged in master. The current canonical production alias `job-dashboard-fawn.vercel.app` is READY at `a66c108bff6175149c4aadd882ab11128445b8cc` on deployment `dpl_7gjdfRFeLjqcPdVC52NkaEatugKA`. Master has since advanced to `48ca317b0c59215fd112d854f61dc71828f29d69` with PR #276's contract classifier and PR #282's evidence-separated resume gap report, but that newer master is not in production because Vercel reports `build-rate-limit`. The deployed alias proves the source-boundary fix is live, not that the historical WhatsApp run succeeded.

## Remaining blockers and acceptance

1. The original DOCX and full JD are now recovered, but the generated output for this exact run is still missing.
2. The per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivery/read receipt are unavailable.
3. iZap currently has no connected WhatsApp number and returns no matching chat/message history for the incident. The original thread cannot be replayed through iZap.
4. The source DOCX conflicts with previously confirmed profile facts. Owner reconciliation is required before any experience/tenure claim is used.
5. No live WhatsApp send or authenticated device test was performed. Historical delivery remains unverified.

Next: keep the conflicting source facts quarantined until owner reconciliation; obtain the exact generated output and per-run R2/webhook/Meta trace plus signed delivery/read receipt before an authorized exact-source replay. Report raw overlap, supported coverage, unsupported requirements and document integrity separately. Do not restore the old 98% hard hold or send a real WhatsApp test without explicit authorization.


## 10 November 2026 — source-boundary regression released

PR #273 merged from exact head `5b6ad44a2f0bdea15678ecc9ea5b6469a6212463` as `a66c108bff6175149c4aadd882ab11128445b8cc`. The full CI run 42761112788 and Kompas baseline 42761112810 both completed SUCCESS. Production deployment `dpl_7gjdfRFeLjqcPdVC52NkaEatugKA` is READY at the exact merge SHA and independently confirmed on the canonical alias `job-dashboard-fawn.vercel.app`.

The deployed change excludes the screenshot-only `sol` and `specialty` fragments and generic `attributes` noise from match targets. It preserves supported NIST/ISO/AWS/Azure terms, keeps certifications and unsupported preferred Canton/Solana platforms out of candidate claims, and adds explicit source-fact conflict rules: conflicting education, employment dates, tenure or credential status stay unresolved until the candidate corrects them; JD requirements and years of experience are never candidate evidence.

This is source-backed code and deployment evidence only. It does not prove a 98% live match, exact historical replay, DOCX delivery or Meta handset delivery. The generated output, R2 key, webhook correlation ID, Meta message ID and signed delivery/read receipt remain unavailable. The source DOCX conflicts with owner-confirmed profile facts and requires reconciliation before any affected claim is used. No model call, real email, WhatsApp send, R2 write or production mutation was performed. The old 98% hard hold remains superseded by the 6 Nov channel-specific policy.

Next: reconcile the source facts and obtain the exact output/trace before an authorized replay; then verify document integrity and delivery separately. Do not send a live WhatsApp test without explicit authorization.


## 10 November 2026 — separate recovery-root error under repair

A separate 9 November runtime error reported by PR #278 is `That file is outside your resume library` from the authenticated recovery route. This is not evidence that the original 17 October request reached this recovery path. Source review found a plausible root mismatch: an uploaded DOCX is first held in the sender's inbox and copied to that user's durable Files library; a later retry can switch to the durable path while `generate()` still defaults to the inbox root when the original job has no `Files` selection context.

PR #278 adds `resolveRecoveryResumeContext` and passes the validated root into `generate()`. It accepts only the authenticated user's library root or that sender's inbox root, replaces stale serialized Files roots with the current user root, validates the selected email folder when Files metadata exists, and fails closed for invalid user IDs, sibling-account paths, wrong email folders, stale Files metadata on inbox paths and arbitrary paths. It does not bypass the tailor's path-containment checks.

The first full-CI attempt on head `a67659e11f45edcb5f717bddc639ca36336e9fc7` failed because `scripts/tests/whatsapp-recovery-durability.test.mjs` still asserted the former `job.files` argument. The assertion was corrected in commit `3782c97dea69a8632135586bdb8296ad1790c781` to verify that path resolution occurs before a fail-closed `source_outside_account` rejection and that the validated Files context/root are passed into the tailor.

Current exact-head evidence for PR #278: full CI `42773757901`, WhatsApp recovery regression `42773757620`, and Kompas baseline `42773757574` all completed SUCCESS. Preview deployment `dpl_Hp9we2LBxgp9bNqup8rMVEdgoM8a` is READY at the exact head, target preview only. The separate Kompas voice preview HTTP gate `42773754013` failed and remains owned by the Voice Delivery task. PR #274's identity-sensitive owner-review gate remains open; no production deployment, real model generation, R2 write or WhatsApp send occurred.

Release is held: PR #274's unconditional identity guard is security/identity-sensitive, has green CI/recovery/baseline checks, but no user-authored approval for that exact behavior was found in accessible prior context. PR #278 must not ship alone before that owner-review gate is resolved. No actual handset delivery is claimed; a signed Meta delivered/read callback is required.


## 10 November 2026 — recovery-root exact-head gates completed

PR #278 head `3782c97dea69a8632135586bdb8296ad1790c781` now passes full CI `42773757901`, WhatsApp recovery regression `42773757620`, and Kompas baseline `42773757574`. The exact-head preview `dpl_Hp9we2LBxgp9bNqup8rMVEdgoM8a` is READY. This confirms source tests and preview build only.

The canonical production alias remains on `a66c108bff6175149c4aadd882ab11128445b8cc`; no production deployment or authenticated recovery smoke was performed. The PR remains held because PR #274's stricter identity verification is security-sensitive and has no retrieved user-authored approval. The separate voice preview HTTP gate is owned by Kompas Continuous Voice Delivery. Do not ship the recovery fix alone or treat a preview build as production.

The historical 17 Oct 17:28 incident remains separately blocked by the missing generated DOCX and per-run R2/webhook/Meta trace, plus owner reconciliation of conflicting source facts. No real WhatsApp send, model generation or R2 write was performed.


## 10 November 2026 — evidence-bound send-safety proposal

A separate source audit found that `tailor.ts` still instructed the writer to place every JD term into experience and to treat the candidate as claiming the full JD, despite the existing evidence-bound keyword list. The final experience-weaving pass also used all scored JD keywords, and the Gemini-related pass did not require generated terms to appear in the source resume or explicit candidate confirmations.

The WhatsApp gate also treated `unverified_jd_terms` as an allowed shortfall. That created a mismatch: `acceptableWhatsAppResume` rejected the draft, but `whatsappRewriteUsable` could still consider it sendable. PR #279 is a DRAFT fix that:
- makes the writer prompt evidence-bound;
- limits experience weaving to source-supported `jdKwsPrompt` terms and filters Gemini-related terms against the source plus explicit first-person confirmations;
- keeps the separately labelled `Job-post terms` line, but removes unverified experience claims from the WhatsApp shortfall allow-list so the generated DOCX falls back to the same-account selected resume.

PR #279 head `cc7e4ea675d808a89f4b4ea1f22711b0be7141b7` has Kompas baseline `42775486253`, full CI `42775486431` and WhatsApp recovery regression `42775486380` in progress. This changes WhatsApp external-send behavior and remains subject to explicit owner review. No live model generation, resume write, WhatsApp send or R2 write occurred.


## 10 November 2026 — exact source archive verification and final-DOCX Gemini requirement

The original 17 Oct source DOCX was independently verified in a private Library archive (27,724 bytes; exact digest retained privately and not published). The matching JD was recovered from the user's private inbox. The source's education, employer chronology, experience length and credentials materially conflict with the owner-confirmed profile; keep those claims quarantined until reconciled. The generated output DOCX, per-run R2 object key, Meta message ID and signed delivery/read receipt remain unavailable, so no exact replay or delivery claim is made.

The owner-approved 3 Nov requirement (recorded in PR #275 at 07:46 UTC) is to ask Gemini exactly `Give me ATS score` after every final DOCX export, identify missing/weak JD keywords, correct only gaps supported by the source resume or explicit first-person confirmations, re-export and recheck until the highest truthful match. The score and suggestions are diagnostics only, never experience evidence. Current `src/lib/tailor.ts` has two pre-generation Gemini keyword passes, deterministic ATS parsing of the exported DOCX, and Gemini final-document gap feedback, but it does not perform the final-DOCX ATS-score review or bounded correction/re-export/recheck loop.

PR #279 exact head `073dd98465ac81426dcc6ec1c9ae9b4f80120e61` has full CI 42795044313, Kompas baseline 42795044640, and WhatsApp recovery regression 42795044615 all SUCCESS; it remains DRAFT and requires owner review for WhatsApp external-send behavior. Its Vercel status remains build-rate-limit. No real model call, resume write, WhatsApp send, R2 write or email send was performed.


## 11 November 2026 — current access and delivery check

The 17 October 17:28 Chicago incident remains open. The exact original input DOCX is still verified in the private archive, and the matching Security Engineer – Risk & Controls JD was recovered from the owner's inbox. The source's education, employer chronology, experience length and credential claims remain quarantined because they conflict with owner-confirmed profile facts. Do not copy disputed facts into a new output.

A targeted current Library search for the generated DOCX, the incident-specific WhatsApp output, and R2/Meta delivery references did not surface the generated output. This is a bounded search result, not proof that the file is absent from every Library folder, chat, R2 bucket or external archive. The output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read callback remain unavailable.

A read-only iZap check on 11 November 2026 at 08:14:16 UTC found one business and no linked WhatsApp number. Connection state is disconnected; there is no phone number, live inbound history, Coexistence history backfill or proven outbound send. No real message was sent. This connector cannot currently retrieve the historical bot conversation or a signed delivery receipt.

The canonical MFit master is 11efbbfe7781592bc2fad1216f67546882a1c3ed. Vercel alias metadata is READY at dpl_7uEfjq1XprC48DoTFfFuiBoShPne on that SHA, but the project reports live=false; public health and Kompas version requests return HTTP 402 DEPLOYMENT_DISABLED. The source is current in deployment metadata, but the runtime is unavailable for authenticated replay or delivery verification.

PR #287 contains the approved writer-only JD/evidence boundary fix. Its exact-head full CI, Plan/REA schema, Kompas baseline and resume regression pass; the shared voice-preview gate fails and the Vercel account is blocked. The PR is open and not production-live. PR #293 is an explicitly unapproved draft for narrower employer/role-scoped confirmations. PR #289 is a draft implementation of the owner-approved 3 November final-DOCX Gemini review loop, stacked on #287, with no exact-head validation or live model call. None of these branches proves the historical output or delivery.

The 6 November WhatsApp policy remains authoritative and supersedes the older 98% hard hold. No replay, new model generation, DOCX write, R2 write, email send or WhatsApp send was performed.



## 11 November 2026 — 09:13 UTC WhatsApp history recheck

Gmail retrieval reconfirmed the matching Security Engineer – Risk & Controls JD as a 5+ year Atlanta onsite contract role; Solana is listed among preferred DLT platforms. This is employer target context only, not proof of candidate experience or credentials.

The connected iZap workspace has one business but no linked WhatsApp number, zero chats, and zero message-search hits for “Risk & Controls” on 17 October. This connector therefore cannot recover the historical bot exchange or a delivery callback. The exact source DOCX remains privately verified, but its disputed education/employer chronology/tenure/credential facts remain quarantined. The generated output DOCX, R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain missing. No replay or outbound test was sent. A zero-result iZap search is evidence about this connected workspace only, not proof that the records do not exist in every external store.


## 11 Nov 2026 — route-level fallback boundary review

The current webhook source separates the initial JD generate path from reply-to swipe refinement. The initial no-provider fallback is reachable only when a library selection is present; it verifies the authenticated user's library root, selected relative path, exact library/session bytes and selected profile email, then labels the attachment NOT TAILORED. The swipe reply routes to refine, which checks the same account, returns text only when the provider is unavailable or the rewrite is unusable, and requires sameResumeFacts before delivering a new document. It contains no sendClosest or sendOfflineOriginal fallback.

PR #303 head fcee3fb6c46bd3d69bcc1565ed7fd1d5adb244cb adds two source-contract tests for these boundaries. Exact-head recovery regression 43097475896, full CI 43097475873 and Kompas baseline 43097475962 are queued. No real WhatsApp message or live model call was made. The 17 Oct generated DOCX, R2 object key, Meta correlation and signed delivery receipt remain missing.


## 12 November 2026 — bounded Library and WhatsApp-connector recheck

A fresh semantic search of the accessible Library used the 17 Oct 17:28 Chicago WhatsApp failure, the Risk & Controls JD, the original source DOCX and the generated output as separate query anchors. It returned related BNY preparation documents and the resume-tailoring research paper, but did not surface a uniquely correlated generated output DOCX. This is a bounded search result, not proof that no copy exists in every Library folder, conversation, WhatsApp account or R2 bucket.

A read-only iZap `list_businesses` check returned one business (`eshwarjay0`) with **zero linked WhatsApp numbers**. There is therefore no connected iZap conversation source from which to retrieve the historical thread or signed message status in this runtime. No message was sent and no connection was changed.

The historical case remains open: generated output DOCX, exact per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain missing. The recovered source/JD relationship does not establish which bytes were sent or whether Meta delivered them. Do not replay or resend the historical request; if the artifact and provider correlation cannot be recovered, record the historical delivery as irrecoverable rather than guessing.


## 12 November 2026 — durable refinement approval boundary

The owner clarified that durable recovery/replay for swipe-reply refinements remains unapproved. This is separate from the approved initial no-provider fallback and the approved no-baseline failure behavior (text-only; preserve the last delivered version). PR #277 was converted to DRAFT and retitled with an explicit owner-approval requirement at head `c5cb99a45262d30ff1621e0673d6300115da689a`. Issue #201 documents a design gap but is not authorization to implement or ship it. No durable replay was performed, no real WhatsApp message was sent, and no historical 17 Oct request was replayed.


## 12 November 2026 — bounded historical-artifact retrieval recheck

The prior recovery recorded above remains the accepted evidence: the original 27,724-byte source DOCX and matching full JD were recovered in the earlier audit. This run did not re-open those private artifacts and does not downgrade that prior finding. Fresh Library semantic searches for the 17 October 17:28 incident, the exact Security Engineer — Risk & Controls title, and the visible missing terms did not surface a uniquely correlated generated output DOCX. Search results included unrelated resume artifacts; none was treated as the incident output without a request ID, R2 key or provider receipt. A personal-context search for the original 17 October conversation returned no matching conversation, so no additional chat wording is inferred.

Read-only iZap inspection found one business (`eshwarjay0`) with zero linked WhatsApp numbers. Searching that business for `resume` on 17 October 2026 in `America/Chicago` returned zero messages. This connector therefore cannot provide the original thread or a delivery status. A read-only Supabase metadata query also found zero rows in `resume_documents` and zero rows in `resume_import_jobs` created during 17 October 2026 22:20–22:40 UTC (the screenshot window). Those tables do not prove that no R2-only object or Meta-side record exists; the query only rules out a matching row in those two public tables.

The historical output DOCX, exact per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt remain unavailable. The recovered source DOCX still contains education, employment-date and credential conflicts against the owner-confirmed profile; keep those facts quarantined until the owner reconciles them. The next unblock is read-only access to the correct R2/Meta logs or a user-provided export containing the request and provider identifiers. No replay, model call, R2 write, WhatsApp send or production mutation was performed.


## 12 November 2026 — exact-head and retrieval recheck (06:53 UTC) <!-- wa-acceptance-exact-gates-0653z -->

The approved no-provider initial-JD fallback remains separate from swipe-refinement failure behavior. PR #303 exact head `344ed47061ae475a42e9695d08ca2dba91bf3fc2` now has full CI `43138216531`, WhatsApp recovery `43138216521` and Kompas baseline `43138216526` all SUCCESS. The protected preview `43138214326` fails because the private `KOMPAS_VERCEL_API_TOKEN` is missing; keep the PR DRAFT and do not bypass Vercel protection.

Dependent PR #316 exact head `4af7d8bed8f51ef56d1b05156af430c74758fd92` passes WhatsApp recovery `43163655905`; full CI and baseline remain deferred until parent acceptance. It consumes the JD/resume pair only after Meta returns a document message ID, only when both fields still match the run, and preserves a newer mixed pair or the old pair after a rejected send. No real Meta send or R2 write occurred.

Resume/JD/confirmed-experience PR #317 exact head `f3182de28fb229401e30893d7687805e55c846e7` passes full CI `43164222540`, WhatsApp recovery `43164222577` and Kompas baseline `43164222576`. Its protected preview remains blocked by the same private token prerequisite. The code preserves employer-scoped evidence, treats general confirmations as profile/skills evidence only, and does not lower identity, date, unsupported-claim or delivery gates. No live model call, personal DOCX generation or 98% live-match result is claimed.

The historical 17 Oct 17:28 Chicago output DOCX, per-run R2 object key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain unavailable. The recovered original source and JD do not establish which bytes were sent or whether Meta delivered them. Fresh Library search did not surface a uniquely correlated output; iZap has one business with zero linked WhatsApp numbers and a targeted 17 Oct `resume` search returned zero messages. Do not replay or resend the historical request. If the exact artifact and provider correlation cannot be recovered, record the historical delivery as irrecoverable rather than guessing.

**Continue:** obtain the exact artifact and correlated R2/webhook/Meta export through owner-authorized storage or a user-provided export; separately wait for the protected preview prerequisite before any code merge/deploy.

## 12 November 2026 — screenshot and inbox source rechecked; owner-confirmed skill rule reconciled

A read-only Library listing found the incident screenshot at `2026-10-17T22:28:39Z` (5:28 PM America/Chicago). It shows the 5:25 PM Risk & Controls JD plus a five-page, approximately 28 KB Word resume, followed by the 5:28 PM bot reply that the rewrite had not reached its 98% target after automatic repair and the file was held. A read-only Gmail search and message retrieval reconfirmed the matching full JD forwarded on 16 October 2026, subject `Job Opportunity - Cyber Security Engineer- Risk & Controls with Blockchain`; its title, Atlanta onsite contract context and preferred Solana platform match the screenshot. This confirms the source pair, not the generated output or delivery. No email was sent.

The owner’s 6 Nov 2026 9:55 AM CT correction is authoritative and supersedes the later same-role-only prompt interpretation that appeared in the PR #317 restack. An explicit first-person confirmation of a JD skill is sufficient to map that skill naturally into relevant existing project bullets across roles, including earlier roles, even when the original bullet does not name the tool. Employer-source verification is not an additional prerequisite for that confirmed skill. This exception is limited to the confirmed skill and the selected account/resume/JD; it does not authorize a new employer, project, title, location, date, contact, metric, credential or unrelated project detail. JD wording, a target score and editing instructions alone are not confirmation. The original source DOCX’s conflicting education, employer chronology, tenure and credential claims remain quarantined pending owner reconciliation.

PR #317 branch `fix/resume-role-evidence-restack-da1db145-20261112` now reflects that decision in the writer prompt, candidate-evidence context, role-alignment measurement and final deterministic guard (commits `dfcd2b4`, `14ac764`, `216581d`, `2214469`). Explicitly confirmed skills may survive cross-role placement; unconfirmed terms borrowed from another employer remain blocked. Exact-head full CI, WhatsApp recovery and Kompas baseline must pass on the updated head, and the protected preview still requires the private `KOMPAS_VERCEL_API_TOKEN`. The PR remains DRAFT, unmerged and undeployed.

The historical generated output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt remain unavailable. The bounded search is not proof that no copy exists in every Library folder, chat, R2 bucket or Meta export. No replay, live model call, DOCX generation, R2 write, WhatsApp send, email send or handset test occurred.


### 12 November 2026 — targeted Library output recheck

A recursive, metadata-only Library listing filtered to DOCX files created from `2026-10-17T22:20:00Z` through `2026-10-17T23:00:00Z` returned zero items. A targeted semantic Library search for the Security Engineer — Risk & Controls generated output also returned no uniquely correlated DOCX. This narrows the accessible Library only; it does not prove that no browser-local/temp copy, other-chat attachment, R2 object or Meta record exists. The generated output DOCX, per-run R2 object key, webhook/request ID, Meta message ID and signed delivered/read receipt remain missing. No replay, file generation, R2 write or outbound message occurred.


### 12 November 2026 — approved WhatsApp fallback restacked on current master

The 6 November owner-approved distinction is now isolated in current-master PR #321 (`ac38ffde34709a04664fc6b2b3b92fab9515fa7e`): initial JD/no-provider may send only the exact selected same-account library original after authenticated root, safe relative-path, byte-equality and selected-profile email checks, with the exact NOT TAILORED caption. Swipe-refinement provider failure, timeout, partial/incomplete output, unreadable/missing DOCX or identity/contact/date failure is text-only and preserves the last delivered version. Before restacking, all six PR #303 changed files were byte-identical between old base `65bdf2f` and current master `da1db145`; only the intended six files were copied. Full CI 43191231356, WhatsApp recovery 43191231421, Kompas baseline 43191231296 and protected preview 43191231435 are in progress. No merge, deployment, model call, real send, R2 write or Meta callback occurred. Dependent pair-consumption PR #316 remains stacked on the old parent and must be restacked only after #321 is accepted.
