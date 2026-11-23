# WhatsApp PR #493 test corrections — 22 November 2026

## Exact CI evidence

Full CI 44934971531, job 136939503840, failed eight tests. Six failures were stale expectations:

- fold 5 expected obsolete 'updated Word file could not be opened' wording; current text says the Word file could not be opened.
- The 30.8% rewrite tests expected a tailored document. Their harness calls filesFor(HOUSTON_PATH) with explicitlySelected=true, so the authorized fallback is the exact original, labeled Original resume — NOT TAILORED, with no tailored claim.
- Fallback verification text and unsupported-JD explanation assertions did not match current wording.
- The duplicate-job test searched the accumulated documents for candidate5@example.test, which was already present in earlier successful documents; it should snapshot document count before the failed attempt and assert no new document.
- Swipe-reply hold wording now says 'I did not send another file' and that the version already in chat remains unchanged.

## Test-only corrections

Commits e7e0ffe04191cb1ab4a4490e4ab972f9bbd99dec, 6a17ed5ec48f9d29db6da7f273aeb13effb2ddc8, and b9c1c8f2fe3645903a9a07f4afdc4117339441ec. These changes preserve the quality floor, exact-original fallback, and no-duplicate-send assertions; they do not change route behavior.

## Remaining real blocker

The explicit-selection integration test still fails: the normal webhook's named SOC resume is not persisted into recovery files.explicitlySelected. Do not weaken this test. Route source repair is blocked because this runtime has no canonical checkout or installed Next.js 16.3.8 route-handler guide and the existing Vercel Sandbox quota is 402 until 2026-12-01. PR #493 remains draft/stale, exact-head CI after these test corrections is not visible, and the 17 Oct 17:28 Chicago delivery is unverified. No send, replay, DOCX, R2 write, Meta receipt, or production deployment occurred.


## 23 November follow-up — route docs retrieved; current restack

The installed Next.js 16.3.8 Route Handlers guide and route-file-convention guide were retrieved and read from successful GitHub Actions audit run 44842752926, job 136654945477. This supersedes the earlier missing-guide blocker. The local environment still has no checkout or installed dependencies; exact-head GitHub Actions remains the execution gate.

PR #557 restacks the approved route/helper/test changes on the current Kompas base. Its code commit is bcc7cc8659e61a4f493ef4b04c355e422f616aad. Exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA are pending. The Vercel Sandbox quota remains 402, but GitHub file APIs and Actions can perform source work. No live message, DOCX, R2 write, Meta receipt or historical replay occurred.


## 23 November policy-preservation correction

The 19 November owner correction narrows only the unchanged fallback source: it must be an explicitly selected same-account Files/Library resume with the exact **Original resume — NOT TAILORED** label. It does not authorize a new below-70% raw-overlap hold. Preserve the existing behavior: below 70% is not a clean pass, but a completed readable rewrite may still be sent with gaps disclosed. Incomplete, failed, skills-only, unreadable or identity-mismatched output remains subject to the explicit same-account fallback rule. Unsupported JD-only additions remain a hard hold. The helper and acceptance tests are corrected on PR #557; this is source/test evidence only, not a real WhatsApp send or historical delivery proof.
