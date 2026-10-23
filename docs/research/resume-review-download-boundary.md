# Resume review → downloaded-file boundary

Updated: 23 October 2026  
Method: source and artifact analysis; no live WhatsApp message, email, job application, or candidate file was sent.

## Approved behavior

The owner approved the competitor-derived resume ideas on 23 October: show every tailoring change before it is used, apply only changes the candidate keeps, reveal what the parser read, and never invent experience or numbers. The candidate's explicit experience confirmations are evidence; a job description by itself is not.

## Failure found on current master

The private run record, review API, accepted-edit reducer, and reviewed-DOCX builder existed. The result page did not call them. Both Word and PDF buttons still sent the original tailoring token directly to `/api/tailor/file`, so the downloaded file carried every generated change regardless of any review. The server implementation and the actual user path therefore disagreed.

## Repair

- The result page now loads the server-owned review for the signed-in user's run.
- A change is initially kept only when it introduces neither an unconfirmed JD term nor a new number. Explicit candidate confirmations are part of the evidence set, so confirmed skills do not receive that warning.
- The candidate can keep or undo each title, summary, skills, and role change, including added and removed lines.
- The preview and both download formats are rebuilt server-side from the original DOCX and the selected change IDs. Page text is never trusted as resume content.
- The review POST response returns keyword coverage measured from the rebuilt file, so undoing a keyword does not leave the page claiming the full generated draft's coverage.
- If the private run record or original source cannot be read, downloading is blocked with a concrete re-tailor message instead of falling back to the unreviewed file.

## Evidence

- `scripts/tests/tailor-review-approval.test.mjs`: confirmed versus unsupported evidence, accepted-edit reduction, and download-token boundary — 3/3.
- Focused resume set: 42/42 across keyword targets, candidate evidence, repair preservation, quality/precision, and review approval.
- TypeScript: pass.
- Scoped ESLint: 0 errors; four warnings already present in the result page before this slice.
- Production build: 157 routes, pass, with the same nine existing dynamic-filesystem tracing warnings.
- PR #51 preview: success — `6g7LeriMXF463s77CZcF6GeGJHzn`.
- Merge commit: `8cf1e75ef1b530d1a2fc6bec9458db4bcf2cc3c4`.
- Exact merge commit production deployment: success — `CLiCAJHaWa8PK2tkzoVRqsENZ6mU`.

## Limits and next acceptance

Unit tests prove the code boundary, not a 95–100% live match. Authenticated browser acceptance still needs a real candidate-owned baseline and explicit confirmations: tailor, inspect a risky change, leave it unchecked, download the DOCX, and verify that exact line is absent while a checked confirmed-experience line remains. The October 17 17:28 WhatsApp incident remains independently blocked by the missing exact JD, generated DOCX, and server trace.
