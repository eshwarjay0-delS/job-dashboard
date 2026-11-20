# Kompas 10-fold delivery — 20 November 2026

Jay asked for a 10-fold run on the live MarketFit app, 100 delivered answers, Long at 120–180 words, no invented claims, honest bridges on gaps, and the same core facts across the ten runs.

## Page and APIs

The page is `https://marketfit-app.vercel.app/dashboard/kompas`. It is the Kompas shell. The browser calls `POST /api/answer`. The shell rewrites that to `POST /api/kompas/answer` before the request leaves the page. Screen analyze on the shared tab sends `screenImage` on that same answer call. The older capture button calls `POST /api/screen`, which the shell rewrites to `POST /api/kompas/screen`. Clarifiers are `POST /api/kompas/aside`.

The answer route does not insert an account-session row. The live script sends one id, `s-kompas-10fold-houston`, on every call and does not POST `/api/kompas/account-sessions`. Create & Start and Start reuse an open interview with the same setup instead of minting another row.

## Resume

Houston `eshwarjay05` Fortinet summary in `src/lib/kompas-houston-resume.txt`. Not the Saint Louis profile.

## What changed

A timeout, 429, 5xx, or empty stream retries the paid lane, then `openai/gpt-oss-20b`, then a cached resume answer. Length Long is forced into 120–180 words. A gap (Terraform, Graviton, a cutover the resume does not name) keeps an honest bridge. A trailing "right?" does not open with yes. The first word is streamed when Long is selected and the stream policy is not holding every token for the final guard.

## Limits

The before numbers are the production build at master `3a1b0bb7`, read-only, one session id, no new account-session rows. The after numbers are the same script after the ship deploy. Offline 10-fold does not call a model.
