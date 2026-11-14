# Production Kompas account-session snapshot — 13 November 2026

## Method and safety boundary

Read-only SQL against the production-linked Supabase project, plus GitHub source and Vercel deployment metadata. No database write, session creation, transcript content read, user-device access, model call, or external message was performed.

## Persisted account-session data

Read-only aggregate results from `public.kompas_account_sessions` and `public.kompas_account_session_artifacts`:

- 22 session rows total.
- 15 rows are not deleted; 7 are tombstones.
- Among the 15 not-deleted rows, 9 have no `endedAt` value and 6 have an `endedAt` value.
- 28 session-artifact rows.
- All session and artifact rows belong to one owner.
- Latest session update: 2026-11-09 21:47:34 UTC.
- Latest artifact update: 2026-11-09 21:47:35 UTC.
- All 15 not-deleted session payloads contain the keys `resume`, `jd` and `instructions`; 13 contain a `transcripts` key. Only key presence was counted; payload values and personal content were not read.
- Both tables report RLS enabled in the schema inventory.

This is evidence that the account-session backend contains persisted owner-scoped records. It is not proof that the same session is visible on a second browser, Windows desktop, phone or WhatsApp. A database row count cannot establish that a particular user's devices imported, refreshed or resumed the same session.

## Production release and Kompas source stamp

Vercel independently reports deployment `dpl_Gpo7bWY56cZDoTyjUJ6f1D5ducAb` READY at production SHA `024177889d092f30aaeada20fab649aa41c9d1f4`, with both `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` assigned to it.

At that exact GitHub SHA:

- `public/kompas/version.json` contains build stamp `kompas-20261112-output`.
- `public/kompas/app.js` includes the restored answer path markers `AI Answer`, `endSegment`, `requestData`, `cleanHeardQuestion` and `plainIntroAnswer`.
- The deployment commit message is the approved PR #350 main-answer-path restoration from `01ceb1dc`.

The current master rollback merge `026c72968e45314ff0a99f701942c966e79f0a1e` is two commits ahead of production, but GitHub compare shows only five Plan/REA/completion documentation files differ. The canceled #372 build never received the production aliases. The live runtime therefore remains the restored pre-#372 behavior.

These are source and deployment-metadata checks, not a live HTTP route smoke or native Windows acceptance. The public endpoint could not be fetched through the available web runtime, and this execution cannot operate the owner's browser, Windows installer, phone or WhatsApp client.

## Acceptance still required

1. On two authenticated devices using the same intended MarketFit account, create or import one session on device A and confirm device B sees the same session ID, resume, JD, instructions and transcript artifacts.
2. Confirm a transcript update made on B is visible on A without manual refresh and that a tombstone/deletion does not resurrect stale local state.
3. Verify sign-out/account switching does not leak the session to another account.
4. Repeat the owner-consented browser-to-installed-Windows handoff and separately test phone/WhatsApp discovery if those channels are in scope.

Do not infer these outcomes from the persisted row counts. No owner device test occurred in this run.
