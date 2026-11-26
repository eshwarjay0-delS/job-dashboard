# WhatsApp resume incident — read-only evidence probe (26 November 2026, 16:19 UTC)

## Scope
Investigated the already-reported 17 October 2026 17:28 America/Chicago resume-delivery incident using the connected iZap WhatsApp history only. No send, replay, pause/resume, attachment download, or other write action was attempted.

## Findings
- The connected iZap account has one business scope, `eshwarjay0`, with no WhatsApp number listed.
- Read-only search for `resume` on 17 October 2026 (America/Chicago) returned 0 messages. An empty-query read for that same day also returned 0 messages.
- Connection status at 2026-11-26 16:19:58 UTC reports disconnected: no number, no inbound ever recorded, and no outbound ever proven to reach Meta.
- **Scope warning:** this iZap business is not proven to be the MarketFit WhatsApp Business number from the incident. Zero messages and the disconnected status do not prove the incident did not occur; they mean this connector cannot provide the incident's evidence.

## Evidence still required
Recover the correct business scope plus the generated DOCX, per-run R2 object/version, webhook request/correlation, Meta outbound message ID (`wamid`), and signed delivery/read receipt or failure status. Until those exist, classify the 17 Oct incident as **unverified**. Do not replay or send.

## Work
Read-only list/search/connection-status calls only. No private message body, phone, or business UUID was copied into this note; no message was sent and no product/runtime change was made.

## Next
Continue: retrieve the historical incident through the correct authorized WhatsApp business and server/provider logs, correlate the R2 object and Meta ID, then determine whether the failure was selection, generation, upload, webhook, send, or delivery. Do not test by sending a real message.

## Follow-up source and database check (26 November 2026, 20:10 UTC)

- Read-only Supabase schema inventory found no dedicated WhatsApp incident/run table in the public schema. `public.resume_documents` has 100 rows total and zero records created on 17 October UTC; `public.resume_import_jobs` has one record created on 12 October and zero on 17 October. This does not rule out R2 objects, Vercel logs, Meta records, or other provider retention; those sources were not accessed by this query.
- The canonical webhook source still routes a quality-rejected draft through `sendClosest`. The current profile-email comparison is not durable explicit Files/Library selection provenance: a remembered or sole-account library choice can supply a matching email without a fresh user selection. No route code was changed.
- PR #591 exact head `b4b110c48da5d8f260bb183849f0ee27b5f99f18` full CI `45792574554` fails five source-executed assertions in `scripts/tests/whatsapp-resume-failsafe.test.mjs`: tests 93, 94, 96, 97 and 98. Each expected zero original-file sends and observed one. Test 95's supported 30.8% role-evidence-gap disclosure passes. These failures are a current fallback/policy defect, not proof of the 17 October incident's root cause. Keep the PR DRAFT and do not weaken the assertions.
- The historical incident remains **unverified**: exact WhatsApp-uploaded source bytes, generated output DOCX, per-run R2 object/version, webhook correlation, Meta `wamid`, and signed delivery/read receipt remain unavailable. The connected iZap scope is not proven to be the incident number. Do not replay or send.

No model call, DOCX generation, WhatsApp send, R2 write, database mutation, or device interaction was performed.
