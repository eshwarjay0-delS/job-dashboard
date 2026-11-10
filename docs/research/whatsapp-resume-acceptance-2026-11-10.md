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

## 10 November 2026 — role-level evidence boundary audit

The approved writer-only PR #287 was audited beyond its prompt and global keyword list. The gap-fill loop computed each role's source-supported terms, but also appended the global `unseen` JD terms to every role's repair request. A term supported by one employer's original bullets could therefore be requested in another employer's unrelated role. The existing deterministic employer/date/contact guards do not establish that a newly inserted tool or control was actually used in that role.

The PR branch now adds `missingRoleEvidenceTerms(sourceTerms, currentTerms, requiredTerms)`. Each role repair receives only terms found in that role's original bullets and still absent from that role's current bullets. The global `unseen` list remains available to the separate profile/skills repair; it is no longer passed into experience-role requests. Two direct tests use separate Splunk and Okta role evidence and ensure unsupported Canton is excluded.

This is source-code and helper-test evidence only. Exact-final-head CI, protected preview, authenticated original-resume/JD/confirmation generation and exported-DOCX review remain pending. No model call, DOCX write, real email or WhatsApp send occurred. The historical 17 Oct 17:28 incident still lacks its generated DOCX and per-run R2/webhook/Meta trace/receipt, and conflicting source facts remain quarantined pending owner reconciliation.

## 10 November 2026 — read-only Library recheck

A targeted Library search for the 17 Oct 17:28 Chicago WhatsApp request and generated DOCX did not surface the output. A second search restricted to DOCX files created 16–18 Oct returned other candidate resume files, but not the recorded 27,724-byte source or the generated output. The candidates were not substituted: the existing incident record documents conflicting identity, education and employment facts, and the exact source digest was not independently retrieved in this search.

This is a bounded semantic search result, not proof that the file is absent from every Library folder, conversation, WhatsApp account, R2 object store or external archive. No candidate file was opened or modified, and no private document content was copied to GitHub. The exact generated DOCX, R2 object key, webhook/request ID, Meta message ID and signed delivery receipt remain the hard replay blockers.

## 10 November 2026 — final-DOCX Gemini score and evidence-only correction implementation

The user explicitly approved this mandatory loop on 3 Nov 2026 at 16:20:28 UTC: after every resume rewrite/export, ask Gemini exactly "Give me ATS score", ask which keywords/qualifications remain missing or weak, correct supported gaps, regenerate/recheck, and repeat until the highest defensible match or no truthful improvements. The user's 20:53 UTC correction also requires Gemini plus assistant analysis after each generation and 95–100% only where balanced, genuine and evidence-supported.

Implementation is in draft PR #289 on stacked branch feat/final-docx-gemini-ats-review-20261110, based on PR #287 head 21309f44921646d1d89b923cb42c9b988e5faa20. New code adds a strict prompt/parser, pins the review call to Gemini only, reads text from the actual exported DOCX, canonicalizes returned terms against the JD target set, and separates the Gemini score from deterministic exported-byte coverage. The correction pass intersects missing/weak terms with source-resume or explicit first-person evidence, uses the role-scoped gap-fill helper, re-applies unsupported-role/employer/date/contact guards, re-exports and re-reviews, and stops after at most two corrections or the request time budget. The score does not change the resume quality gate or WhatsApp delivery policy. Missing key, invalid response, incomplete export or time-budget exhaustion is recorded rather than represented as a clean score. Refinements are scored but not automatically rewritten.

Code commits: helper 947444f3f5999cd378daffb632241c35e1c0bff8; parser status 3b47d9e20f70e01b51c6301a1a3688f9dc15fc3a; Gemini-only caller a38f94b69146d5850884df58c36063e2e12156cf; tailor integration 3b9dda8dfbaff171fb66ad5ef71de9ab24221760; time reserve 5e74273a1e55446d7edb9973cd5c7f606da85bc0; bounded-review tests ffa34d467b89aedce5ece36d805df94977f633ad and fdbf64f0fb7c4b298c87e52e7c6bc05a986d0d56; metadata-preservation correction b4886c1c238ff05de45c72a95fbeeace680cbffd; original-JD-only review terms 719ea96b7717939dd6e857707781b48097eb5d55; matching source-contract test f677a70eaae39125c1092ab377781ebc79a05284. Six pure helper cases and three source-contract cases were added and all 9 passed in targeted workflow 42918467397 on exact PR head e90d45a58ce0b2425427019fd964895aa11f0f62, including npm ci and TypeScript typecheck. Plan/REA schema workflow 42918467839 passed. WhatsApp recovery regression workflow 42918467287 passed all 49/49 tests. An earlier run 42918173017 failed one outdated post-floor assertion; the test was strengthened to require the final Gemini correction's evidence filter and role guard, then the latest run passed. npm ci reported 30 dependency advisories (1 low, 14 moderate, 13 high, 2 critical); no dependency changes or audit bypass were made. The exact-head workflow list is empty because .github/workflows/ci.yml triggers pull_request only for base branches master/main; #289 intentionally targets the #287 feature branch to preserve its non-approving owner-review gate. The draft PR currently has no CI run; Vercel status on #289 is FAILURE/account deployment blocked; project metadata reports live:false and direct HTTP returned 402 DEPLOYMENT_DISABLED. The full CI workflow is still not run because #289 targets #287's feature branch rather than master/main.

This is implementation evidence only. No Gemini model call, real resume DOCX export, original-resume/JD/confirmation acceptance, WhatsApp send, email send, R2 write or production mutation occurred. PR #287 remains unmerged pending its non-approving owner review and protected preview. The new branch is stacked on #287 and cannot ship independently. The canonical production alias metadata is READY on master 11efbbfe7781592bc2fad1216f67546882a1c3ed, but public HTTP returns 402 DEPLOYMENT_DISABLED; protected preview also requires the private KOMPAS_VERCEL_API_TOKEN. Do not bypass the token, billing or review gates.

The 17 Oct 17:28 Chicago historical WhatsApp replay remains blocked independently: the original source and matching JD were recovered privately, but their education/employment/credential facts conflict with the owner-confirmed profile and remain quarantined. The exact generated output DOCX, per-run R2 object key, webhook/request ID, Meta message ID and signed delivery/read receipt remain unavailable. The final-DOCX loop does not establish what happened to that historical file and does not prove handset delivery.

## 10 November 2026 — read-only artifact correlation audit

A read-only Supabase query against the confirmed MFit project `ruajlrzmxzprmmngluxy` found exactly one matching `public.usage_events` row at **2026-10-17 22:28:27.372685Z (17:28:27 CDT)**:

- `feature_key=resume_tailor`, `source_channel=whatsapp`
- `calls=34`, `score=87`, `input_tokens=205546`, `output_tokens=25331`
- `source_event_key` is null; metadata contains no `r2_key`, `webhook_id`, or `meta_message_id`
- The `score` field is not independently defined as an ATS percentage and is not reported as one

No `public.resume_documents` row was created between 22:20 and 22:40 UTC. This is not proof that no R2 object exists, but it confirms that the Supabase resume library did not record an output in that window.

The historical Vercel runtime-log query for 22:20–22:40 UTC returned HTTP 400: the Hobby plan retains only one hour, so a 24-day-old request cannot be recovered from those logs. Gmail searches for DOCX/resume/MarketFit/WhatsApp on 17 Oct returned no matching threads. A Library DOCX search did not surface a uniquely correlated output. No Cloudflare R2/S3 connector is exposed in this runtime.

**Hard wall:** the generated output DOCX, exact R2 object key, webhook/request ID, Meta message ID and signed delivery/read receipt remain unavailable. The exact source DOCX and matching JD are recovered separately; education/employment/credential conflicts remain quarantined. Do not infer delivery from 34 calls or score 87. Do not replay or send the historical request. The original output/delivery can only be retroactively verified if the owner supplies the artifact or an exact storage/provider correlation record; otherwise mark that historical artifact as irrecoverable and validate only a separately authorized new request.
