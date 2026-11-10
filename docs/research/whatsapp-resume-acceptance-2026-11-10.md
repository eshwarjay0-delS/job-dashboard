# WhatsApp resume hold and DOCX identity round-trip — 10 November 2026

Method: source and artifact analysis. No model call, no live WhatsApp send, and no private resume or job-description content was copied into this repository.

## Recovered 17 October incident

The ChatGPT Library contains the screenshot artifact `1792276118790.jpeg`, created at `2026-10-17T22:28:39Z` (5:28 PM America/Chicago). It shows the M Fit WhatsApp conversation:

- A job post was sent at about 5:25 PM. The visible portion describes a Security Engineering / Blockchain / Risk & Controls / Cybersecurity role, with NIST, ISO 27001, CIS Controls, COBIT, AWS, Azure and GCP. The JD is truncated in the screenshot.
- A five-page, 28 KB Word file named `Eshwar Cyber resume).docx` was sent at about 5:25 PM.
- At 5:28 PM the bot replied: “The rewrite did not reach your 98% coverage target after automatic repair. I have held the file.” It listed these remaining terms: `ccsp`, `cism`, `crisc`, `cisa`, `canton`, `sol`, `specialty`, `attributes`.

This proves the observed behavior was a 98% coverage hold after automatic repair. It does **not** show the actual measured percentage, the full job description, the contents of the uploaded DOCX, the generated output, or the webhook/run trace. The screenshot alone cannot establish whether all eight terms were mandatory, whether the draft was complete, or whether any of those terms were supported by the source resume. Do not add CCSP, CISM, CRISC, CISA, Canton or SOL as candidate experience or credentials without source evidence; do not discard Canton/SOL as noise without the full JD.

The Library's resume inventory records the same filename and a profile classification, but the actual DOCX bytes were not available as a readable Library file in this run. The connected iZap business has no WhatsApp number configured and returned no matching chat or message history for the incident. The original R2 object, full JD, exported DOCX and delivery receipt therefore remain inaccessible here.

## Current policy — later owner correction, already on production

The old 98% hard WhatsApp hold is superseded by the 6 November 2026 channel-specific delivery policy in `src/lib/whatsapp-resume-acceptance.ts` and `docs/research/whatsapp-scored-rewrite-2026-11-06.md`:

- The website download gate remains strict at 95% raw job-post overlap.
- For WhatsApp, a clean 70–94.9% raw job-post result can be delivered when supported coverage is at least 95%, the document is complete, and the other clean-pass checks hold.
- A finished readable WhatsApp DOCX below 70% is not a clean pass, but it may still be sent with the gaps disclosed. A finished file below the supported-vocabulary floor is also labelled as a shortfall rather than being presented as a clean pass.
- A partial/incomplete, skills-only, unreadable export, failed provider run, or missing finished document uses the already-selected same-account resume fallback. A failed identity round-trip also sends the unchanged selected resume, not the rewritten bytes.
- Unsupported work, certifications, employers, dates, metrics and experience are never invented. Job-post-only terms must remain visibly labelled rather than being asserted as experience.

The current canonical production alias `job-dashboard-fawn.vercel.app` is READY at master `30bd971c97937b9dea8716b945fa3b1219b07544`, so this later policy is present in the deployed source. This is deployment evidence, not proof of an actual WhatsApp delivery on the owner's device.

## Best-match and runtime fallback are different

`chooseResume` selects within the chosen email profile. It uses deterministic `rankFor` ordering and falls back to that code-ranked choice when the optional AI agent returns no valid pick. The webhook's `sendClosest` sends the already-selected profile-safe resume when a rewrite cannot be used. The separate November 4 “baseline v1 runtime fallback” is still not implemented; its definition and confirmation switch remain an explicit owner design decision. Do not conflate that open baseline fallback with the existing offline code-ranked resume selection.

## Separate DOCX identity repair — PR #267

PR #267 changes the round-trip identity check, not the 17 October coverage policy. It reads the DOCX body, section-referenced headers and footers, and external hyperlink relationship targets before comparing identity-bearing facts. It preserves name, all email addresses, phone, profile URL and employment-date checks, and uses accurate identity/contact/date fallback wording. It does not lower coverage thresholds or relax factual-evidence rules.

Final PR head: `48836eed08233dcc532ab4a04299dd74b39475a2`.
- Full CI `42747786078`: SUCCESS.
- WhatsApp resume recovery regression `42747786105`: SUCCESS.
- Kompas baseline `42747785851`: SUCCESS.
- Vercel preview `dpl_422ZDDctJeuAfxZmrR9F5s15hax4`: READY at the exact PR head.
- PR #267 merged as `23ec076b944519e518060f14e2ce530238e8393a`.
- Production deployment `dpl_3wb2CbvvzZ98nqK7QgvnHmjXNwUc`: READY, target production. Independent deployment and alias reads confirm `job-dashboard-fawn.vercel.app` points to that exact deployment and merge SHA.
- The optional `voice-preview-smoke` check failed in the separate voice workflow. This PR did not change Kompas voice behavior or alter any secret; the existing Kompas Continuous Voice Delivery task retains that work.
- No real WhatsApp message or authenticated device test was performed. A public HTTP smoke could not run because external DNS resolution failed in this execution environment.

## Remaining acceptance and exact blockers

1. Exact replay of 17 October is blocked by missing original DOCX bytes, full JD, generated output and per-run trace/Meta receipt. The screenshot is the only recovered incident artifact.
2. The connected iZap account has no WhatsApp number/chat history for this thread. An authorized R2 object/trace retrieval path or the original source bundle is required for exact replay.
3. No live WhatsApp send was performed in this run. Real delivery acceptance remains a separate owner-authorized device test.
4. The 6 November policy is the current production behavior. Do not restore the old 98% hard hold, lower factual evidence gates, or invent any of the listed missing terms.

