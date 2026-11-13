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

PR #373 restored the approved pre-#372 answer path and merged as 026c72968e45314ff0a99f701942c966e79f0a1e. Its exact PR-head full CI, Kompas baseline, cross-device, Plan/REA and Windows packaging checks passed. The Vercel production deployment attempt was canceled by the project's Ignored Build Step because the merge commit lacked [ship]; the canonical alias remains on 024177889d092f30aaeada20fab649aa41c9d1f4. A preview attempt from PR #374 was also canceled by the same ignore gate. The project Git configuration enables deployments only on master; the protected preview workflow still requires the private KOMPAS_VERCEL_API_TOKEN. Do not change the ignore rule, bypass the token, or promote a preview.

## Operational boundaries

No secret or credential was read or exposed. No real email or WhatsApp message was sent. No R2 production write, live crawl, production-row mutation, historical replay, model call, or handset acceptance occurred. Exact approval, source implementation, deployment, and real-user acceptance remain separate states.
