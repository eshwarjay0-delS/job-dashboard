# WhatsApp incomplete-draft diagnostics — 17 November 2026

## Production evidence (read-only)

The 7-day grouped runtime-error query returned 15 WhatsApp tailoring quality-gate rejections across 13 users, latest at 2026-11-16T15:02:15Z. A sampled record reports:

- `partial=true`
- `quality.incomplete=true`
- `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable`, `role_evidence_gaps`
- zero unverified additions and zero JD terms placed

These fields do not prove a 100% factual match, a complete export or a delivered DOCX. No source text or user identity is reproduced here.

## Source diagnosis

Current source intentionally fails closed. The tailor divides the draft into a profile part and experience-role parts. Parts that have not returned by the assembly deadline remain pending; the result includes `partial.failed`, `partial.total`, `pendingRoles` and `pendingProfile`. The WhatsApp gate rejects incomplete output. This is correct safety behavior and is not relaxed.

The existing webhook rejection log reports a boolean `partial` but omits the available counts and pending-section flags. Consequently, the current logs cannot distinguish whether one profile part or several role parts were missing. They also do not expose a safe provider failure category. Do not infer a provider timeout or rate limit from the current aggregate.

## Narrow diagnostic change

The stacked draft branch `fix/whatsapp-partial-diagnostics-20261117` adds `whatsappPartialDiagnostics`, which returns only:

- `partialFailed` — validated non-negative integer
- `partialTotal` — validated non-negative integer
- `pendingRoleCount` — array length only
- `pendingProfile` — boolean only

The webhook logs those four values on a rejected draft. It does not log raw pending role indexes, provider errors, resume/JD text, contact details, account identifiers, file paths or tokens. Tests cover sanitization and the route's use of counts only. No delivery decision, quality threshold, provider routing, fallback, R2 write or Meta send behavior changes.

## Release and acceptance

This branch is stacked on PR #433 head `a693cef8f33a72501c769315311aa48e43b037c2` to avoid racing its webhook route edits. Exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA are pending. Keep it DRAFT until all applicable gates pass and Safe Merge Gate reviews it.

Vercel currently reports project `live:false`; protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`. Do not unpause the project, change billing or bypass protection.

The separate 17 Oct 17:28 Chicago incident remains unverified: exact generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta message ID and signed delivered/read receipt are still missing. No replay, model call, R2 write, real WhatsApp send or device acceptance occurred.
