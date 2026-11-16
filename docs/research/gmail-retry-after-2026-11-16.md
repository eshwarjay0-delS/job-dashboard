# Gmail Retry-After correction — 16 November 2026

## Production symptom

Issue [#429](https://github.com/eshwarjay0-delS/job-dashboard/issues/429) records five Gmail `403 rateLimitExceeded` errors on `/api/gmail/application-chains` in the prior 24-hour production window, latest 16 November 2026 at 03:48:14 UTC, plus one unreadable history-page error at 03:44:44 UTC.

The API route already maps these Gmail conditions to HTTP 429 and sends `Retry-After: 30`. The Overview client ignored that header and retried after fixed 15, 40 and 65 second delays. Its first retry could therefore happen 15 seconds before the server's requested pause. This mismatch is a plausible contributor, not proof of the sole cause.

## Source change

PR [#432](https://github.com/eshwarjay0-delS/job-dashboard/pull/432) adds `src/lib/gmail-retry-after.ts`:

- Parses RFC delta-seconds and HTTP-date forms.
- Rounds HTTP-date waits upward so the client does not retry early.
- Uses the greater of a valid server delay and the existing fallback.
- Keeps the fallback bounded to the caller's existing 15/40/65-second schedule when the header is absent, invalid or shorter.
- Is stateless; each `readPage` response supplies its own header and no cross-account timer is shared.

The Overview retry loop still retries the same history page and retains its current maximum of three pauses. No pagination cursor, saved snapshot, account identity or cleanup behavior is changed.

## Regression coverage

Added `scripts/tests/gmail-retry-after.test.mjs` for:
- Numeric delta-seconds.
- HTTP-date with upward rounding.
- Missing and invalid headers.
- A server delay shorter than the fallback.
- Interleaved responses from two account identities.

Updated `scripts/tests/mail-overview.test.mjs` to assert that the response header is read in the per-page retry path. The full CI workflow now runs both Gmail tests alongside `gmail-send-account-isolation.test.mjs`.

Initial full CI `43871483417` failed Type-check with TS7006 for the two unannotated helper parameters. The helper now declares explicit TypeScript parameter/return types, and the source test removes those annotations only when extracting the function for its deterministic runtime checks. Corrections are commits `18d3e542ddfc2bf25fe19f7146a63550ed875c5a` and `928a601504cb628803a66f16aa1951a1514d2dfc`. On the intermediate docs head `a7ddebcbc20595797a097449e3728e522c492040`, Plan/REA `43872012037` and Kompas baseline `43872011582` passed; those results do not validate the subsequent code correction. Fresh exact-head full CI, baseline and Plan/REA checks are required.

## Preserved constraints

- Only the existing user-triggered application-history scan is changed.
- The Poke-style proactive worker remains disabled.
- No scheduler, cron, polling, notifications, inbox writes, OAuth refresh, email sends or WhatsApp sends were added.
- No live Gmail API request, inbox mutation, production DB write or device acceptance occurred.
- Existing cached mail remains stale until a real authorized sync; source tests do not prove refreshed inbox data.

## Release status and next action

The canonical production alias remains READY at deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. PR #432 is DRAFT and not deployed. The legitimate protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run. Do not bypass Vercel protection.

Continue with exact-final-head CI, Kompas baseline, Plan/REA schema and MFit Safe Merge Gate review. After the authorized preview and reviewed merge, deploy the approved master and verify the exact READY production SHA plus canonical alias. Keep two-inbox, selected-From, reconnect and narrow-mobile acceptance separate.
