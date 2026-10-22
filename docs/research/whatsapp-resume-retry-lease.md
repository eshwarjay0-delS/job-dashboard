# WhatsApp resume retry lease — 22 October 2026

## Owner report

The October 17 WhatsApp resume request could finish below target or fail, and sending the same job description again appeared to do nothing. The required behavior is one visible result per request, no duplicate concurrent generation, and a retry that actually starts after failure.

## Source finding

The direct JD + DOCX path wrote `whatsapp/jobs/<hash>` with `putIfAbsent` before the first AI call. Nothing deleted that key. It was a permanent claim keyed only by sender and JD, so a timeout, provider-capacity failure, successful delivery, or a deliberate retry using another resume could leave every later request for the same JD returning silently.

The Files-based path already used the correct shape: a tokenized in-flight lease, a plain "already making it" response for a concurrent request, stale-lease recovery, and token-checked cleanup in `finally`.

## Repair

The direct path now uses the same bounded lease:

- concurrent duplicate handlers still produce one generation;
- a second handler receives a visible in-progress response instead of silence;
- a lease older than the function ceiling, including a legacy permanent claim, is replaced;
- success, unchanged output, identity rejection, provider failure, and every other return release only the lease owned by that run;
- resending the same pair deliberately can start again after the prior run ends.

This changes request recovery only. It does not weaken resume-quality gates, invent experience, claim a 98% live match, or send a real WhatsApp message during verification.

## Evidence and remaining acceptance

The focused regression runs two concurrent handlers, verifies one generator and one document, verifies the claim is gone, retries successfully, forces a provider timeout, verifies no document is sent and the claim is removed, then retries successfully again. The broader WhatsApp/library/tailor group contains 58 passing tests.

Remaining acceptance is a real owner-side WhatsApp generation and downloadable DOCX inspection. The exact October 17 server trace is not available, so the historical incident is not claimed as reproduced end to end.
