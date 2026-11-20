# WhatsApp offline fallback exact-label correction — 19 November 2026

## Latest direct owner correction

Accessible prior-context retrieval found a later owner-authored correction at **2026-11-19 23:22:42 UTC**. Its binding requirements are:

- Only an explicitly selected same-account Files/Library resume may be used as the offline fallback.
- The exact label is **“Original resume — NOT TAILORED”**.
- A fresh upload without explicit library selection must not be sent unchanged.
- No automatic closest-match selection, silent substitution, partial rewrite or JD-only claims.

This supersedes the earlier 19 Nov 16:38 correction's shorter label wording and further narrows the historical 27 Oct closest-match offline failsafe. It does not approve the distinct uploaded-original-after-timeout behavior or the R2 ETag-CAS/lease/fencing architecture.

## Current master source gap

Current master at `4f5030938b6b13b7996fb215e35b8aebad2230b2` still does not carry explicit-selection provenance:
- The WhatsApp `Session` type has `resumePath`, `resumeName` and timestamps but no explicit-library-selection marker.
- The `sendClosest` fallback reads `session.resumePath` and checks profile identity; that does not prove the user explicitly selected the file from Files/Library.
- The acceptance helper contains no explicit-selection check.

The missing implementation is the narrow provenance guard on the **offline fallback only**. Normal initial library selection must remain unchanged.

## Historical incident and limits

The 17 Oct 17:28 Chicago screenshot still establishes a held/undelivered result, not successful DOCX delivery. The generated output DOCX, per-run R2 object/version, webhook correlation, Meta outbound message ID and signed delivery/read receipt remain missing. No resend, replay, real WhatsApp send, production R2 write or personal-data mutation occurred.

The scheduled container has no canonical repository checkout and no installed `node_modules/next/dist/docs` copy required by AGENTS.md. The last recorded Vercel sandbox creation attempt returned HTTP 402 due exhausted snapshot-storage quota. Code implementation remains blocked until a runnable canonical checkout with the installed Next.js 16.3.8 route-handler documentation is available.

## Next step

Implement only the explicit-selection provenance guard and synthetic regression cases after the environment blocker clears. Preserve normal initial library selection. Keep uploaded-original-after-timeout and R2 CAS/lease/fencing out of scope unless separately approved.
