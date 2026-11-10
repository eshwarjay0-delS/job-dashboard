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

PR #267 changes the round-trip identity check, not the coverage policy above. It reads the DOCX body, section-referenced headers and footers, and external hyperlink relationship targets before comparing identity-bearing facts. It preserves name, email, phone, profile URL and employment-date checks, and changes the fallback copy to name identity/contact/date verification accurately. It does not lower coverage thresholds or relax factual-evidence rules.

At head `2e3aef1e27aad56e338de301abc33b2e7179a911`:
- Full CI `42746339652`: SUCCESS.
- Kompas baseline `42746339783`: SUCCESS.
- WhatsApp resume recovery regression `42746339632`: SUCCESS.
- Vercel preview `dpl_FAmjqn4ZrZLXeQDCHs7YwTtwKPps`: READY at that exact head.
- PR #267 is still open; no production deployment and no Meta send have been performed.

## Remaining acceptance and exact blockers

1. Exact replay of 17 October is blocked by missing original DOCX bytes, full JD, generated output and per-run trace/Meta receipt. The screenshot is the only recovered incident artifact.
2. The connected iZap account has no WhatsApp number/chat history for this thread. An authorized R2 object/trace retrieval path or the original source bundle is required for exact replay.
3. The owner explicitly prohibited real WhatsApp tests in this run. No live delivery claim is made.
4. PR #267 must be revalidated on its final documentation-inclusive head, merged only with all required checks green, then deployed from reviewed master. Production acceptance still needs a real owner-authorized device run; this automation cannot claim that interaction.

Continue with the current 6 November delivery policy. Do not restore the old 98% hard hold, lower factual evidence gates, or invent any of the listed missing terms.
