# Owner approval provenance — 13 November 2026

## Direct owner instructions recovered

- The current Completion Watch instruction directly requests Poke-inspired multi-account Gmail/mobile updates.
- The current Completion Watch instruction directly requests contract job search/crawler work.
- A direct owner correction on 12 November 2026 at 03:15:32 UTC says the daily contract-crawler cron was deliberately removed; crawling is manual/on-demand only; a PR restoring the daily schedule is unapproved; Robert Half remains manual-only; no manual crawl or production-row mutation was performed.
- The 13 November owner instruction says latest explicit corrections are authoritative and missing instructions must not be inferred.

## Details not confirmed by accessible owner-authored history

### Gmail/mobile

The historical owner-vision document docs/gmail.md, labelled as captured 17 October 2026, records 3–4 connected accounts, four mobile account toggles, per-account identity/From, inbox digest and Poke-style proactive mail. Preserve that as historical product direction; do not turn the range into a hard cap. The current 13 Nov owner instruction directly reaffirms Poke-inspired multi-account Gmail/mobile updates. Accessible prior-conversation retrieval did not recover a direct owner message specifying per-account Calendar targeting, exact waiting-on-them radar semantics or the exact hamburger interaction/layout; those details remain proposed. Keep PR #375 DRAFT.

PR #375 head 8b4a480313504240c5f5ad69596074c7ecedf549 passed full CI 43494969062, Kompas baseline 43494968954, and Plan/REA schema 43494969251. There is no protected preview, two-inbox acceptance, real Gmail API call, inbox mutation, outbound email, or narrow-phone test.

### Contract crawler / C2H

The manual/on-demand cadence, removal of daily cron, and Robert Half manual-only restriction are direct owner constraints. Prior conversation retrieval did not find a direct owner message approving the classifier details in PR #376: Right To Hire / Contract To Perm → C2H, negation rules, or the W2/C2C/1099 distinctions. Keep those classifier semantics proposed and PR #376 DRAFT. Do not restore cron, run a live crawl, or automate Robert Half.

PR #376 head 6f566197d763b6137c8608c2db3cd670a2278c5b passed full CI 43494635050, crawler regression 43494635586, Kompas baseline 43494635138, and Plan/REA schema 43494635014. No protected preview, live portal crawl, external API request, application submission, or production-row mutation occurred.

## Separate Kompas rollback release status

PR #373 restored the approved pre-#372 answer path and merged as 026c72968e45314ff0a99f701942c966e79f0a1e. Its exact PR-head full CI, Kompas baseline, cross-device, Plan/REA and Windows packaging checks passed. The runtime rollback code is already deployed in READY production deployment dpl_Gpo7bWY56cZDoTyjUJ6f1D5ducAb at ancestor SHA 024177889d092f30aaeada20fab649aa41c9d1f4. GitHub compare 024177..026c729 shows only documentation/Plan/REA files differ; the redundant deployment request for 026c729 was canceled by the Ignored Build Step, so only the exact merge SHA's documentation is not live. A preview attempt from PR #374 was also canceled by the same ignore gate. The project Git configuration enables deployments only on master; the protected preview workflow still requires the private KOMPAS_VERCEL_API_TOKEN. Do not change the ignore rule, bypass the token, or promote a preview.

## Operational boundaries

No secret or credential was read or exposed. No real email or WhatsApp message was sent. No R2 production write, live crawl, production-row mutation, historical replay, model call, or handset acceptance occurred. Exact approval, source implementation, deployment, and real-user acceptance remain separate states.

## WhatsApp and confirmed-experience restacks — 13 November 2026

PR #374 is the current-master WhatsApp offline fallback / pair-CAS restack at 794ba1151f8761720c55936d15bb0eb9a0a37c5c. Full CI 43503280817, WhatsApp recovery 43503280946, Kompas baseline 43503280979 and Plan/REA 43503280606 passed. Its authorized Vercel preview attempt dpl_6Ejh8tNfxR7pDYNcxWRp2f2thWV7 was canceled by the Ignored Build Step; the protected preview still needs the private KOMPAS_VERCEL_API_TOKEN. No send or R2 write occurred.

PR #377 is the current-master confirmed-skill role-evidence restack at 20b1abf8cde16448900ed594d6f62366666097e4. Full CI 43503531707, WhatsApp recovery 43503532020, Kompas baseline 43503531666 and Plan/REA 43503531853 passed. Protected preview and exported-DOCX acceptance remain missing; no real model call or live ATS score is claimed.

The historical 17 Oct 17:28 output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID and signed delivery/read receipt remain unavailable. The original source and JD recovery do not establish which file was generated or delivered. Do not replay or claim delivery.


## 14 November 2026 — read-only WhatsApp incident correlation recheck

A read-only production query for 2026-10-17 22:20–22:40 UTC found one `whatsapp:resume_tailor` usage event at 22:28:27.372685 UTC. No `resume_documents` or `resume_import_jobs` row existed in that window. The usage event has no `source_event_key`; its metadata keys are only `calls`, `input_tokens`, `output_tokens` and `score`, with no request ID, resume/document ID, R2 key/version, Meta message ID or delivery status. This is not proof that no R2 object or Meta message exists; it is proof that the available usage row cannot correlate them. Library searches did not return the generated output DOCX. The exact output, R2 version, webhook correlation, Meta wamid, signed delivered/read receipt and owner fact reconciliation remain missing. No historical replay or real send occurred.
