# Skip-login on the live site, 12 November 2026

Method: source analysis, one read of the live static flag, and one read-only Supabase request that returned HTTP 402. No email, no WhatsApp, no model resume, and no production data write.

## What put login back

Superseded 13 Nov 2026: owner mode stays on unless the flag is exactly `off-confirmed-by-eshwar`. The observation below is what production served on 12 Nov, not the current rule.

Production `https://job-dashboard-fawn.vercel.app/kompas/auth-flag.js` served `window.KOMPAS_AUTH_DISABLED = false`. `/kompas/version.json` named build `kompas-20261112-reauth`, commit `e8ce442051c1cbee1fbbeb6a26aa75200a1ddf97` (PR #326). That commit's message says `AUTH_DISABLED` stays off, and its page sends a signed-out start to `/login?next=/kompas/index.html`. The 11 November skip-login commit `65bdf2f8` is still in the tree. The flag file is stamped at build time and is `false` unless `AUTH_DISABLED` or `NEXT_PUBLIC_AUTH_DISABLED` is exactly `true`. Draft PR #324, which would ignore those flags in production, was not merged.

## Why sessions and MarketFit failed while skip-login was on

Supabase project `ruajlrzmxzprmmngluxy` answers HTTP 402 `exceed_egress_quota` for both Auth and the data API. With skip-login on, a leftover cookie or bearer still called `getUser()` before the synthetic owner was used, so Start waited on Auth and the answer preflight never became ready. A 401 after that sent the page to `/login`.

MarketFit's onboarding status skipped the owner bypass for the synthetic user, then treated a missing profile as incomplete. A 402-softened profile read is an empty row, so the dashboard sent the owner to setup. Setup then asked for a sign-in the server would bounce away from.

The Houston auth user id is not in the repository. The live profile lookup also returned HTTP 402, so this session did not record an id.

## What this change does

When the flag is exactly `true`, server and browser auth clients do not call Supabase Auth. `POST /api/auth/refresh` returns success without Auth. Kompas Start treats 401 and Auth 402 as allowed to start, and does not open `/login`. The onboarding status is complete for that synthetic owner, so MarketFit opens. Admin routes still reject the synthetic owner. An answer-service failure that is not an auth wall still says the session is not ready.

The installed Kompas.exe changes only after the existing Windows workflow publishes it.
