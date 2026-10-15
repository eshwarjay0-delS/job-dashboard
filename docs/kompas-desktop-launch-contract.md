# MarketFit Kompas desktop launch and continuity contract

This document describes the approved integration; it does not supersede
`ChatGPT.md`, the earlier voice reliability specifications or the original
`eshwarjay0-delS/parfAct/HANDOFF.md`.

## The user's requirement

From **https://job-dashboard-fawn.vercel.app/kompas**, selecting an
interview session and **Desktop app → Connect & start** launches the
installed **MarketFit Kompas** and transfers that exact session.
After the one-time executable registration and the browser's required
external-app permission, the user should not have to open standalone
perfACT, copy a URL, repeat onboarding, or choose another app.

The already working standalone perfACT desktop must continue to work.

## Shared architecture, separate identity

- Maintain the native Electron implementation in the original perfACT
  repository (`desktop/`). Do not create an unrelated desktop product.
- The website always mounts the canonical perfACT copilot release using
  `src/app/api/kompas/shell/route.ts` and
  `src/lib/kompas-shell.ts`, retaining the MarketFit voice/answer
  integrations and user interface.
- MarketFit hands interview data to the installed app via
  `marketfit-kompas://open?d=<base64url JSON>`. Standalone perfACT
  retains `kompas://open?d=...`.
- The installed desktop creates and uses a distinct `Kompas MarketFit`
  user-data profile. Both schemes point to the same Electron build.
- MarketFit requests `/kompas/index.html` within the desktop; the
  standalone app retains its original `/index.html` route. Opening
  `marketfit-kompas://open` without data still opens MarketFit.
- Never launch via a hidden iframe. Launch from a direct, real user
  gesture. Chrome or Windows can require an initial consent prompt;
  neither the website nor the assistant may bypass that security step.
- A downloaded Windows executable is not equivalent to a working
  installation. Building and shipping require the clean-Windows smoke
  test for both scheme registrations and Windows protocol dispatch.

## Preserve everything else

These updates are **additive**. Do not replace or weaken the existing
MarketFit dashboard, account and permissions model, resume tailoring
and file libraries, Gmail integration, interview preparation, credits,
appearance, or mobile experience.

For Kompas, keep the previous research and behavior for live sessions,
mic + computer audio, listening accuracy, technical vocabulary,
speaker distinctions, corrections, turn taking, follow along, question
extraction, interview context, and transcripts. Keep the existing
transcription and humanization routes and their access rules.

Use the resume and job description together. Keep the MarketFit Kompas
answer delivery: clear, engaging, natural and balanced for the person
asking; preserve perfACT's technically deep engine underneath it.
Engineer depth should answer implementation, verification, debugging and
security tradeoffs; director depth should answer risk, ownership,
business outcomes and prioritization. Never invent qualifications,
employers, metrics or personal experiences. Avoid an avalanche of
technical bullet points and unwanted STAR labels.

## Deploy and verify

1. Preserve the prior code and compare changed files, especially
   `src/lib/kompas-shell.ts` and `copilot/api/answer.js`.
2. Run the MarketFit desktop integration regression tests and typecheck.
3. On GitHub Actions, build the original Windows x64 executable using
   `desktop/scripts/package.mjs`; smoke test the actual executable
   with `.github/scripts/check-kompas-windows-protocol.ps1`.
4. Publish the executable to the authorized release host. The current
   GitHub release is private; publicly accessible downloads require
   a separately configured distribution host.
5. Confirm the intended Git commit is on **READY** production deployments
   for both sites, with their correct aliases.
6. Verify a real Windows click-through from the MarketFit website
   before claiming end-to-end browser-to-desktop launch is confirmed.
