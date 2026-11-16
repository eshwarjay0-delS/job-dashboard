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

Initial full CI `43871483417` failed Type-check with TS7006 for the two unannotated helper parameters. Explicit types and source extraction were corrected in commits `18d3e542ddfc2bf25fe19f7146a63550ed875c5a` and `928a601504cb628803a66f16aa1951a1514d2dfc`. The next full CI `43872548358` passed lint/typecheck but failed one HTTP-date assertion: `toUTCString()` truncates milliseconds to whole seconds, so the test now expects the correct 45-second header in commit `738bac2e87e648558fce84a6cc6f70dc9dcde2f7`. Plan/REA `43872012037` and Kompas baseline `43872011582` passed only on an intermediate docs head; fresh exact-head checks are required.

## Preserved constraints

- Only the existing user-triggered application-history scan is changed.
- The Poke-style proactive worker remains disabled.
- No scheduler, cron, polling, notifications, inbox writes, OAuth refresh, email sends or WhatsApp sends were added.
- No live Gmail API request, inbox mutation, production DB write or device acceptance occurred.
- Existing cached mail remains stale until a real authorized sync; source tests do not prove refreshed inbox data.

## Release status and next action

The Vercel project metadata currently reports `live:false`; its latest production deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED. Alias metadata still points `job-dashboard-fawn.vercel.app` to older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. No public HTTP smoke or authenticated acceptance was established. PR #432 is DRAFT and not deployed. The legitimate protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run; an owner/authorized admin must also restore the project live state before release. Do not change billing, unpause the project or bypass Vercel protection.

Continue with exact-final-head CI, Kompas baseline, Plan/REA schema and MFit Safe Merge Gate review. After the authorized preview and reviewed merge, deploy the approved master and verify the exact READY production SHA plus canonical alias. Keep two-inbox, selected-From, reconnect and narrow-mobile acceptance separate.


## Exact-head validation refresh — 16 November 2026 15:57 UTC

PR #432 exact current head `6b04a042a59b414d729c5e916ffad66ce6fd2c6b` now has all three source gates completed successfully:

- Full CI `43873587418`: SUCCESS.
- Plan Journal / REA schema `43873587419`: SUCCESS.
- Kompas baseline `43873587424`: SUCCESS.

The exact-head source/test validation supersedes the earlier pending-check statements above. It does not supersede the release blocker: Vercel project metadata reports `live:false`; latest production-targeted deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED; the canonical alias remains on older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3` at SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. SSO protection remains enabled for non-custom domains, and the owner-controlled `KOMPAS_VERCEL_API_TOKEN` is not available to this run.

No protected preview, public HTTP smoke, authenticated Gmail API/OAuth call, inbox mutation, email/WhatsApp send or production deployment occurred. Do not change billing, unpause the project, bypass protection or infer fresh sync from cached rows. An owner/authorized admin must restore project live state and provide protected-preview access through the private channel before Safe Merge Gate review and release.
