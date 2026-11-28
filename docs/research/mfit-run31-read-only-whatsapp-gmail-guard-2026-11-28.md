# MFit Run 31 — read-only WhatsApp incident and Gmail guard review

**Date:** 28 November 2026 07:34 UTC  
**Method:** Read-only iZap connector inspection, GitHub source/CI review, Vercel deployment metadata.  
**No send/replay, inbox mutation, OAuth, R2 write, production DB write, live crawl, model call, or device interaction.**

## WhatsApp resume incident — 17 October 17:28 America/Chicago

- iZap `list_businesses` returned one business and **zero linked WhatsApp numbers**.
- `get_whatsapp_connection_status` returned disconnected. It reports no live inbound webhook, history backfill, or outbound delivery proven, and no provider error.
- Read-only `search_messages` for `resume` on 17 October 2026, timezone `America/Chicago`, returned **0**.
- This is evidence about the currently connected iZap business only. It does **not** prove the historical R2 object, webhook logs, or Meta records are absent.

### Still required

Original input DOCX and generated output DOCX; per-run R2 object/version; webhook/request correlation; Meta outbound message ID; signed delivery/read receipt; owner fact reconciliation. The current iZap account must have an owner-authorized WhatsApp number connected, or the incident evidence must be recovered from another authorized read-only source. No message replay.

## Gmail account-switch guard — PR #637

Exact head `518e08999e4206dbb7b71bcf37d522e32d9a7ace` has full CI `46118344354`, Plan/REA `46118344368`, Kompas baseline `46118344383`, and confirmed-skill `46118344353` SUCCESS. The generation guard, second verified-account lookup, and checks before snapshot publication/shared load are present; deferred A→B, sign-out and same-account restore tests exercise the race. Source review COMMENT `6096552394` is favorable.

PR #637 remains DRAFT: protected preview needs the private `KOMPAS_VERCEL_API_TOKEN`, which was not available. No live OAuth, two-inbox/account-switch or phone acceptance was run.

## Approval boundaries

- PR #633's two-line JD/named-resume parser is not directly owner-approved per comment `7235500274`; keep DRAFT/unmerged.
- PR #636's exact server-side location/remote-filter scope lacks recovered direct approval per comment `7235500545`; keep unmerged and do not crawl.
- Broad contract search remains manual/on-demand only; no cron.
- Poke workers, scheduler, notifications and automatic email sending remain disabled; four connected Gmail accounts is the confirmed maximum.

## Release evidence

Canonical master: `f36d90befb473fccc8ec8fcb84ae840e452f3035`. Production alias `job-dashboard-fawn.vercel.app` maps to READY deployment `dpl_74creuAK4D5snFmtUeecpkZwM86y`, exact ship SHA `3362f20d3bd1707b14cba1d13a62d3a33117f0ea` (PR #634). Master #635 is test/REA validation only. This run did not create a deployment.

## Next

Continue through approved, read-only access. Reconnect the WhatsApp business/number and obtain the incident artifacts and delivery trace; then reconcile the source facts without replay. For PR #637, secure protected-preview access and run two-inbox and phone acceptance before any merge.
