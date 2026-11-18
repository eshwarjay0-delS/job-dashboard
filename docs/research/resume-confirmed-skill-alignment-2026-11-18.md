# Resume confirmed-skill alignment and WhatsApp hold — 18 November 2026

## Request and evidence boundary

Continue the owner-approved resume/JD alignment work and preserve the 17 October WhatsApp incident without inventing candidate history or replaying a message.

- The JD is target context, not evidence that the candidate performed the work.
- An explicitly confirmed skill may be mapped naturally into relevant existing project bullets across roles. Confirmation supports only the named skill. It does not create a new employer, project, action, outcome, date, title, location, contact, metric or credential.
- The 14 November owner correction is authoritative: unsupported JD-only experience must never be delivered. A cached `unverified_jd_terms` blocker is rejected even when its detail list is empty.
- The separately approved offline failsafe is the closest matched resume from the same-account library, labelled **Original resume — NOT TAILORED**. Sending the exact uploaded original after provider timeout remains unapproved.

## Channel policy

The repository-recorded 6 November channel policy keeps web downloads strict at 95% raw JD overlap. WhatsApp may deliver a completed, readable result below 95% with honest gaps disclosed; a clean 70–94.9% result requires at least 95% supported coverage. A finished result below 70% is not a clean pass. A score, keyword count or successful export is not proof of factual deliverability.

## 17 October 2026 17:28 Chicago incident

The private Library screenshot at 2026-10-17T22:28:39Z shows the bot acknowledging a five-page resume upload and, after automatic repair, explicitly holding the rewrite because the then-98% target was not reached. The latest owner correction identifies this as a hard hold, not a successful delivery.

The 10 November research record documents prior recovery of the original input DOCX (27,724 bytes; private digest verified) and the full JD. This run did not re-materialize those private files. The generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID and signed delivered/read receipt remain missing. Do not replay or resend the request.

## Current source candidate

PR [#431](https://github.com/eshwarjay0-delS/job-dashboard/pull/431) restacks confirmed-skill role mapping on current master `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. Exact head `a74319cb87a3aff44e111987c59ce978d2f87c2a` passed:
- Full CI 43972447062.
- WhatsApp recovery 43972447199.
- Kompas baseline 43972447249.
- Plan/REA schema 43972447039.

The PR remains DRAFT. It is not deployed and does not establish a live 95–100% match. Protected preview and owner-authorized source resume + exact JD + explicit confirmation + exported-DOCX review remain necessary.

Dependent PR [#441](https://github.com/eshwarjay0-delS/job-dashboard/pull/441) is stacked on #431. Its focused final-DOCX, WhatsApp and Plan/REA checks passed on exact head `2ab1d89dcc3a65e57a2c4176548dabdb8346515e`; exact-head full CI and Kompas baseline are not verified. No final DOCX or Gemini call occurred in this run.

## Release state and next checks

Canonical production alias `job-dashboard-fawn.vercel.app` remains READY on older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. The Vercel project reports `live:false`; the latest master deployment was CANCELED by the Ignored Build Step because the commit lacked `[ship]`. Protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run.

Next:
1. Keep #431 DRAFT until legitimate protected preview and owner-authorized source/JD/confirmation bundle are available.
2. Inspect the actual exported DOCX for grammar, role/project relevance, identity, format, supported coverage and zero unsupported claims.
3. Keep #411's uploaded-original-after-provider-timeout behavior unapproved.
4. Recover the 17 October output DOCX, R2/version, webhook correlation and signed Meta receipt from the correct owner-authorized systems; never replay or resend.
