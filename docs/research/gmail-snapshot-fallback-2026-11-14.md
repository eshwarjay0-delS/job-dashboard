# Gmail snapshot fallback — explicit secret boundary and live-state audit

Updated: 14 November 2026. Method: read-only GitHub, Vercel environment-name metadata and Supabase aggregate review, plus source/test changes on an isolated branch. No secret value was read. No owner-exported snapshot rows were imported. No Gmail API/OAuth request, inbox mutation, email, WhatsApp message, paid service change or production write occurred.

## Owner scope and endpoint correction

Accessible owner context requires the saved-mail fallback to use owner-exported `public.mfit_gmail_threads` and `public.mfit_gmail_sync` rows only when the live Supabase read fails specifically with `exceed_egress_quota`; a working database read must win. Spend must remain zero. No billing or spend-cap change is authorized.

The latest retrieved owner correction references `/api/gmail/notify-rules/export` in the quota-failure context. That endpoint is not the snapshot importer in current source:

- `POST /api/gmail/snapshot-import` accepts snapshot parts using `x-import-secret` and `GMAIL_SNAPSHOT_IMPORT_SECRET`.
- `GET /api/gmail/notify-rules/export` is a separate private compatibility surface for notification rules. It requires `GMAIL_UPDATES_SCHEDULER_ENABLED=true` and a `CRON_SECRET` bearer. It returns owner/account-scoped notification preferences, not mail-thread or sync rows.

Do not silently reinterpret these two endpoints as interchangeable. The owner context retrieved for this run does not establish that the notify-rules export should be repurposed for snapshot import, nor does it contain explicit production deployment/`[ship]` approval for the snapshot fallback.

## Source finding and bounded fix

The existing `sealedPath()` helper used the literal fallback key `gmail-snapshot` when `GMAIL_SNAPSHOT_IMPORT_SECRET` was empty. The import authorization correctly returned 503 without a configured secret, but the read path could still probe a deterministic public Blob path derived from that repository-known key. If private Blob access was unavailable, the write path could also create a public fallback object with that predictable key.

The current change keeps the no-spend public-Blob compatibility path when an explicit secret is configured, but fails closed when it is not:

- `sealedPath()` returns no path without a non-empty deployment secret.
- `readManifest()` skips the public fallback instead of probing a predictable path.
- `backendPut()` returns the existing `SNAPSHOT_PRIVATE_UNAVAILABLE` failure when private access is unsupported and no secret is available; the import returns 503 rather than writing a public object.
- The test backend now exercises the same private-unsupported fallback branch as production.

New regressions cover missing-secret write refusal, no public-path read probe without the secret, successful secret-derived opaque-path write/readback when private Blob access is unavailable, and separation between snapshot import and notify-rules export. A dedicated GitHub Actions workflow runs this offline test without any secret or external service.

This change does not switch the storage tier, raise spend, change the import schema, enable the background worker or alter production environment variables. Production behavior is unchanged when the required secret is present.

## Current production and data evidence

- Canonical production alias: `job-dashboard-fawn.vercel.app`, READY deployment `dpl_5X265CqeobnkUtiEH6xVA6yB5fXn`, source SHA `3e1033687972230de76747e063afe1a0c1cdea61`.
- Canonical master at audit: `3e710d50760b4a757d75ad2858ef508f3d36b388`. GitHub compare shows two commits ahead of production, containing only crawler documentation/tests/comments, Plan/REA and legacy Windows packaging files; no Gmail runtime difference. The snapshot-import route and `gmailSnapshot.ts` exist at both refs.
- Vercel environment-name metadata contains a sensitive production `GMAIL_SNAPSHOT_IMPORT_SECRET` entry. Its value was not read, so this is presence evidence only, not proof that it is non-empty or that authenticated import succeeds.
- Read-only aggregate snapshot: 3 Gmail accounts with thread rows, 2,002 stored thread rows, 3 sync rows, latest recorded sync `2026-11-10T14:44:44Z`, and 0 accounts synced in the preceding 24 hours. No account email or user identifier is recorded here.
- No owner-exported rows, authenticated import/readback, public endpoint response, live Gmail sync or device acceptance was exercised.

## Review and acceptance boundary

Branch: `fix/gmail-snapshot-secret-required-20261114`.

Source commits:
- `e72346e45db578194e57b4218ac9b7049fb4a2fd` — require an explicit secret for sealed paths.
- `98f2a6439ebaa7c06db9b187a7f363e7f4addbf0` — add secret-boundary regressions.
- `07166a7e798247e9b90692bf5f09f9dcf816c08a` — add the dedicated offline test workflow.
- `4883f0512126e55f4cc079e8066d4e340e5ca5bd` — distinguish snapshot import from notify-rules export in tests.

The branch remains unmerged and undeployed pending exact-head full CI, the dedicated workflow, Kompas baseline and Plan/REA validation. The protected Vercel preview still requires the private `KOMPAS_VERCEL_API_TOKEN`; no protection bypass is permitted. No explicit production deployment/`[ship]` approval was recovered for this snapshot task, so no deployment is authorized by this audit.

Next: complete exact-head checks, keep the PR draft, preserve the worker off, and wait for the exact owner-approved endpoint/data procedure plus authenticated import/readback using a verified non-empty secret. No email send or inbox mutation is part of acceptance.
