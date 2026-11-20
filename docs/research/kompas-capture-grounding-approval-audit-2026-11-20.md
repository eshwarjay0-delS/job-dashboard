# PR #462 capture-grounding approval audit — 20 November 2026

## Scope

Read-only approval-provenance and release audit for canonical MFit PR #462. This note separates source-grounding behavior from the additional speech-capture heuristics. It does not authorize further capture changes or a production rollback.

## Direct owner context retrieved

Accessible prior-conversation retrieval found:

- **1 Nov 2026 21:59:41 UTC:** Windows Live Captions must feed the chatbox/question and trigger answering; Caption Capture should update from that window alone.
- **1 Nov 2026 22:10:23 UTC:** direct Live Captions integration was requested to reduce latency to a negligible level.
- **2 Nov 2026 13:23:13 UTC:** the owner reported that question recognition had cut off the tail, rejected the post-deployment 4–5-line behavior, and required restoring prior accuracy, preserving the complete ending, avoiding unnecessary rewriting and regression testing.

The targeted retrieval did **not** find direct owner approval for the exact PR #462 behaviors:
- suppress candidate-side speech from auto-answer selection;
- suppress the same question for 30 seconds;
- drop transcript lines spoken before Start;
- add the Listening / Question detected / Answering status labels.

This is a scoped search of accessible prior context, not proof that every chat was available or that no such approval exists elsewhere. Do not turn absence of retrieved evidence into an absolute historical claim.

## Separate approved evidence boundary

The PR's JD-only-tool filter is consistent with the existing Chief Relevance rule: the job description expresses desired qualifications and never proves candidate experience. A tool appearing only in the JD must not be spoken as something the candidate has used. Conditional "I would" language remains conditional. This source boundary is already documented in section 4 of `docs/kompas/CHIEF_RELEVANCE_HANDOFF.md`.

## PR and release evidence

- PR: [#462](https://github.com/eshwarjay0-delS/job-dashboard/pull/462)
- Reviewed head: `993997805307c074ba7003038cb2464c1f89d603`
- Merge commit / current master at this audit: `4f5030938b6b13b7996fb215e35b8aebad2230b2`
- Merge actor: `cursor[bot]`; merged 2026-11-20 02:26:42 UTC; no submitted PR reviews were returned.
- Exact-head full CI [44659723801](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44659723801): SUCCESS.
- Kompas baseline [44659723815](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44659723815): SUCCESS.
- Cross-device gate [44659723691](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44659723691): SUCCESS.
- Plan/REA [44659723753](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44659723753): SUCCESS.
- Windows package [44659723721](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44659723721): SUCCESS.
- PR body says "No [ship] on this commit", but the resulting merge commit message starts with `[ship]`. The Git-linked pipeline deployed it.
- Production deployment `dpl_GJVQo9GXA4PyNhLiP3mH2csztkPC` is READY and `job-dashboard-fawn.vercel.app` resolves to it. `/api/health` and `/kompas/version.json` returned 200; version.json reported exact SHA `4f5030938b6b13b7996fb215e35b8aebad2230b2`. No warning/error logs were found for the exact deployment in the 15-minute check.
- Master-push full CI [44660841717](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44660841717) was still IN PROGRESS at 02:33 UTC; keep that post-merge check distinct from the successful PR-head CI.

## Desktop update delivery

The Windows workflow rebuilt the official asset as package version 0.8.8. The current Vercel `KOMPAS_DESKTOP_VERSION` is also 0.8.8. The updater's `chooseDesktopUpdate()` offers only a strictly greater version. Replacing the asset while keeping 0.8.8 therefore does not notify an already-installed 0.8.8 client. A separate reviewed 0.8.9 version/lockfile/manifest rollover is needed; no Vercel environment variable was changed in this audit.

## Decision and limits

- Keep the JD-only evidence filter aligned with the approved source boundary.
- Record the four additional capture heuristics as **proposed / approval not established**, even though the merge is already deployed.
- Do not add more capture heuristics or claim native acceptance.
- Do not automatically revert the live behavior. Any rollback must be narrowly scoped to the unapproved heuristics, preserve the JD-only grounding rule, and follow a separate owner decision.
- No real Windows listen-through, authenticated user interview, WhatsApp send, email send, model call or production data mutation occurred.
