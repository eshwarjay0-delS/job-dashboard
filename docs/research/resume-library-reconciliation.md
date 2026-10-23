# Resume library reconciliation: original-file collision

Request: continue the approved resume-library commitments while preserving originals, identity separation, My Files visibility, and later WhatsApp selection corrections.

Method: source and artifact analysis on 23 October 2026. This is not a production-library inspection and did not read or move a private resume.

## Finding

The ordinary upload path already content-addresses source files, but the privileged reviewed-archive import wrote each original as `<email>/<specialty>/<visible filename>`. Two different documents with the same filename, email, and specialty therefore resolved to the same target; the later write could overwrite the first before each hash was indexed. That contradicted the standing requirement to preserve originals.

The rest of the inspected path already separates libraries by the verified email found in each document, creates specialty folders, verifies the original checksum after storage, indexes the document, and recovers the stored bytes before marking the import complete. My Files and My Resume use the same scanner and expose email folders and View actions. The stable WhatsApp path retains the later correction that it must not silently cache a received original or restore the superseded no-agent selection behavior.

## Implementation

Imported originals now keep a recognizable filename plus the first 16 characters of their verified SHA-256 digest. An identical retry is idempotent; different bytes with the same visible filename use different paths. Path segments are removed and an already content-addressed name is normalized before the verified digest is appended.

## Verification

The focused library and board suite passed 32/32. TypeScript and scoped lint passed. The complete production build generated 154 pages successfully, with nine existing dynamic-filesystem tracing warnings. The wider `whatsapp-library` harness currently fails while loading a new master dependency that it does not mock; none of its scenarios reached the modified import code, so it is recorded as a separate harness gap rather than product evidence.

## Verification limits

The regression proves deterministic collision separation and route wiring. No authenticated import job, private archive, My Files screen, WhatsApp message, deployment, or cross-device acceptance is claimed here. Production import acceptance still requires a service-created expiring job containing two controlled same-name fixtures, followed by checksum recovery and authenticated UI verification.
