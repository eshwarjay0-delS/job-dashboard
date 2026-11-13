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


## 13 November 2026 — current-master offline fallback and acceptance recheck

The current combined implementation is [PR #368](https://github.com/eshwarjay0-delS/job-dashboard/pull/368). It includes:

- Initial-JD offline fallback only when the provider is unavailable and the exact selected same-account library bytes can be verified. The document is labelled **Original resume — NOT TAILORED**.
- Text-only handling for swipe-reply/refinement failures; no original or partial baseline is sent after a failed refinement.
- Conditional resume/JD pair consumption so newer resumes, newer JDs and newer pairs survive an in-flight send.
- R2 ETag/If-Match conditional writes and serialized local compare-and-swap, with stale writers unable to overwrite a newer session unconditionally.

**Release boundary:** PR #368 head 441874e6b3d1396e22e7bbeeea446c1536c26227 is based on 9032d5bd18854f30aaeada20fab649aa41c9d1f4; canonical production was READY at 024177889d092f30aaeada20fab649aa41c9d1f4. GitHub reports the branch 38 commits ahead, 3 behind, and merge-conflicting. No exact-head workflow runs were found. Earlier parent PR #364 green checks do not validate this head. The protected preview requires the private KOMPAS_VERCEL_API_TOKEN, unavailable to this run. Keep #368 DRAFT; no merge, production deployment, real send, R2 write or model call is claimed.

**Historical 17 Oct 17:28 Chicago boundary:** the two scoped Library searches in this run did not surface the generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID or signed delivery/read receipt. Previously recorded source DOCX and matching JD recovery do not prove which output was sent or received. Do not replay the request. Conflicting source education/employment/credential facts remain quarantined pending owner reconciliation.

The 6 Nov owner correction remains authoritative: web downloads stay strict at 95% raw JD overlap; WhatsApp may send a completed readable file below 95% with gaps disclosed; a clean 70–94.9% pass requires at least 95% supported coverage; a finished result below 70% is not a clean pass but may still be sent with gaps. 98% is an evidence target, not a universal WhatsApp hard hold. Incomplete, skills-only, unreadable, failed or identity-mismatched rewrites use the selected same-account resume under the approved fallback rules; no unsupported experience or qualification may be invented.

**Next:** after the unrelated PR #372 rollback is reconciled, restack #368 on the latest approved master without overwriting concurrent changes; require exact-head full CI, WhatsApp recovery, Kompas baseline, Plan/REA and legitimate protected preview. Historical closure still requires owner fact reconciliation and the exact output plus signed provider evidence. A real handset test is separate and owner-consented. No real WhatsApp message was sent.


### R2 conditional-write source check — 13 November 2026

The current #368 adapter's use of `GetObject` ETag followed by `PutObject` with `If-Match` is supported by Cloudflare's current S3 API documentation. Cloudflare states that `PutObject` accepts `If-Match` and that the condition is evaluated atomically against committed bucket state; competing conditional writes are serialized. References: [Conditional operations](https://developers.cloudflare.com/r2/api/s3/conditional-operations/) and [Consistency model](https://developers.cloudflare.com/r2/reference/consistency/).

The visible PR test suite exercises stale ETag/412 and a concurrent winner, while the implementation also treats 409 and 404 as compare-and-swap failure. Add explicit mocked 409 and 404 cases (or document why they cannot arise on this path) before final acceptance. This is a documentation/source review only; no R2 write or live webhook was run.

## 13 November 2026 — current-master offline fallback and pair-CAS restack (#374)

PR #374 is the current-master restack of the offline original-resume fallback and R2 pair-CAS work. Exact head: 794ba1151f8761720c55936d15bb0eb9a0a37c5c, based on master 026c729.

- Full CI 43503280817, WhatsApp recovery regression 43503280946, Kompas baseline 43503280979, and Plan/REA 43503280606 all completed SUCCESS on that exact head.
- The fallback verifies the selected same-account library path and exact source bytes before sending, labels the file NOT TAILORED, and does not substitute the original resume into a swipe-refinement result. R2 ETag/If-Match and local key serialization protect pair consumption; the pair is consumed only after provider acceptance.
- PR #374 remains DRAFT. An authorized Vercel preview request dpl_6Ejh8tNfxR7pDYNcxWRp2f2thWV7 was CANCELED by the project's Ignored Build Step. The protected preview still requires the private KOMPAS_VERCEL_API_TOKEN. No ignore rule or protection setting was changed.
- No real WhatsApp send, R2 production write, model call, or handset test occurred.

**Historical 17 Oct 17:28 Chicago incident remains separately blocked.** The original 27,724-byte source DOCX and matching JD are recorded as recovered, but the generated output DOCX, per-run R2 object/version, webhook/request correlation ID, Meta message ID, and signed delivery/read receipt remain unavailable. The source's education/employment/credential facts conflict with the owner-confirmed profile and remain quarantined pending owner reconciliation. Do not replay the request or infer delivery from a source file or a mocked test.

**Next:** keep #374 DRAFT until the legitimate protected preview and Safe Merge Gate approval. Historical closure requires the exact generated output plus per-run R2/webhook/Meta evidence and owner fact reconciliation before any authorized replay. Real handset delivery is a separate acceptance gate.
