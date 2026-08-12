# Resume Tailoring Engine — Iteration Log

Each real JD you run is an iteration. Record the JD/domain, what coverage came back,
what was missing, and the fix. Bump the version when the *method* changes (not per-JD).

## How the engine works (v1 — generalizing method)
- **JD keywords are extracted from the JD itself** (`extractJdKeywords` in `src/lib/keywords.ts`)
  — curated vocab hits + acronyms/tech tokens (S2S, FSR, CJI, PAN-OS, IPsec…) +
  parenthetical abbreviations `(FSRs)/(RTM)/(EOL)`. No per-domain hand-coding.
- **Coverage = literal presence** of those terms in the resume (`present`/`coveredJdKeywords`).
- **Cost-ordered ladder** (`src/lib/tailor.ts`): Gemini→Haiku→Sonnet→Opus. Start cheap;
  redraft on the next model with the exact missing terms injected, ONLY while under
  `TAILOR_COVERAGE_TARGET` (0.97). Domain-matched resumes finish on Haiku (pennies);
  hard pivots climb to Opus.
- **Format preserved exactly**: only existing lines are rewritten in place; no paragraph
  is ever deleted (except explicit one-page mode). Verified byte-level: paragraph count,
  bullet count, and fonts unchanged.

## Iterations
### v1 — 2026-08-09 — baseline generalizing method
- Network Security Admin JD + Network resume → **100%** coverage, Haiku (cheap), format OK.
- GRC BA JD + Cyber resume (off-domain) → **97%**, climbed to Opus, format OK.
- Verified: works for any JD without adding domain vocab.

### v1.1 — 2026-08-09 — speed + hydration
- Reported: tailoring slow + a red hydration console error.
- Cause 1: escalation ladder climbed to Opus at a 0.97 target (up to 3 full redrafts, ~60-80s).
  Fix: lowered `TAILOR_COVERAGE_TARGET` to **0.90** — domain-matched resumes clear it on Haiku
  in one pass. Senior IT Compliance JD + GRC resume: **61→100% on Haiku, 20s wall time.**
- Cause 2: hydration mismatch from the **JobRight extension** injecting `jf-observer-attached`
  on `<body>`. Fix: `suppressHydrationWarning` on `<html>`+`<body>` in `layout.tsx` (not an app bug).
- Trade-off: 0.90 favors speed; bump `TAILOR_COVERAGE_TARGET` (env) toward 0.97 for a specific
  hard JD if you want it to grind for the last few % via Sonnet/Opus.

### v1.2 — 2026-08-09 — recall + front-load + plateau (Senior IT Compliance & Audit Analyst)
- JD: dense IAM/IGA (ITGC, ITAC, SailPoint, Saviynt, SAML/OAuth/LDAP/IGA/MFA/PAM, CISA/CRISC/CISSP, COBIT/COSO).
- Gaps found in the run you sent: phrase keywords the extractor couldn't see ("information
  security", "access governance", "identity governance", "directory services", "incident
  response", "secrets management") — all now covered by three method upgrades:
  1. **Domain-noun phrase extraction** (`extractJdKeywords` layer 4): `<noun> + <suffix>`
     where suffix ∈ management/security/governance/services/training/response/testing/…
     — high precision (verb prefixes filtered), generalizes to any JD.
  2. **Front-load the gap into the FIRST pass**: the missing terms (computed with no LLM
     from what the resume already covers) are injected into pass 1, so cheap Haiku lands
     high coverage in ONE pass — fast (~25s) and complete.
  3. **Plateau stop**: stop climbing when a stronger model doesn't raise coverage — the
     rest is honestly un-addable (e.g. Saviynt you don't use), so no wasted Opus passes.
- Result: 98% app coverage on Haiku, ~25s, format byte-preserved (173 paras / 132 bullets /
  Arial+Times New Roman). Residual: variants (risk management, certificate), "Microsoft
  Excel" (low-signal, occasionally skipped), generic soft skills, and honest tool omissions.
- Target now **0.96** (`TAILOR_COVERAGE_TARGET`); plateau-stop makes it safe to raise.

### v1.2 validated — 2026-08-10 — IAM/Identity Governance BA (no code change needed)
- JD: Cybersecurity Business Analyst – IAM & Identity Governance (IGA, PAM, RBAC, conditional
  access, Microsoft Entra, BRD/FRD, KPI/KRI, entitlement models, agentic identity, audit readiness).
- Resume: IAM/Eshwar_Resume.docx (domain-matched).
- Result: **64/66 exact phrases (97%)**, format byte-preserved (214 paras / 170 bullets / Arial).
  The 2 "misses" are adjacency artifacts — concepts present: "reporting requirements"
  (executive reporting/reporting/requirements all present); "cloud devops" (DevOps, DevSecOps,
  cloud security, cloud identity all present). Effectively 66/66.
- KEY: needed NO new fixes — the v1.2 method generalized to a 3rd distinct domain unaided.
  Three domains now: Network 100%, IT Compliance 98%, IAM 97% — all format-preserved, one cheap pass.

### v1.3 — 2026-08-10 — consistency (honest variance finding) + defaults
- Challenged "are you sure?": re-ran IAM 3x on IDENTICAL input → **88–98% coverage, 24–73s**.
  So the engine is NOT deterministic (LLM sampling), and NOT reliably fast. Prior "97-100%,
  fast" claims were over-generalized from single lucky runs. Format preservation IS reliable.
- Fixes:
  1. **temperature 0.2** on tailoring calls (was default/high) — modest consistency gain.
  2. **Best-of-3 on Haiku, run in PARALLEL** (`TAILOR_BEST_OF=3`): take the highest-coverage
     of 3 draws → floor rose 88%→~94-97% (mostly 97%), ~22-30s, cheap. Sonnet is now a
     FALLBACK only if best-of-3 is still short.
  3. **Opus opt-in** (`TAILOR_USE_OPUS=1`): measured Opus running a ~45s redraft after Sonnet
     and adding ZERO coverage → removed from default ladder (saves ~45s on hard JDs).
  4. **Default refine-prefs** applied on EVERY run (incl. first): "more specific/less generic",
     "add JD keywords", "more technical detail" — so first output already reads tailored.
- Recurring env issue (NOT code): Turbopack panics on globals.css (0xc0000142, process-spawn)
  after many dev restarts. Fix: stop server, `rm -rf .next`, restart once.
- Residual honesty: still ~94-97% (not a fixed 100%), ~22-30s typical (spikes when a weak
  batch triggers Sonnet fallback). Knobs: TAILOR_BEST_OF, TAILOR_COVERAGE_TARGET, TAILOR_USE_OPUS.

### 2026-08-11 — STORAGE MIGRATION (Vercel/R2 deploy-ready) + tailor fixes
- **Tailor fix:** Gemini free tier (20 req) exhausted → 429; a dead base model threw instead
  of falling back. Now: Gemini is opt-in (`TAILOR_USE_GEMINI=1`, needs a PAID key), base is
  reliable Haiku, and any model that errors out falls through to the next (graceful).
- **Storage migration (all 21 fs files → `src/lib/storage.ts`):** one `blob` interface
  (put/get/getText/exists/stat/delete/deletePrefix/list) with two adapters — FsStorage
  (default, local/VPS) and R2Storage (S3-compatible; activates when `R2_BUCKET`,
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` are set). Path helpers
  (`readPath/writePath/statPath/listFiles/movePath/deleteDir/keyOf`) route absolute paths
  to R2 when under DATA_DIR, else fs (committed RESUMES_LIB templates). Empty folders use a
  `.keep` marker (object stores have no dirs); move = copy+delete.
- **Verified LOCAL (fs adapter):** build EXIT=0, page 200, resume list, tailor 14s/100%,
  tailored `.docx` download valid. R2 path is code-complete but **NOT live-tested** (needs a
  real bucket + creds).
- **Remaining for deploy (user account steps):** create R2 bucket + API token → set the four
  R2_* env vars in Vercel → push repo to GitHub → connect Vercel + set all env (Anthropic/
  OpenRouter/Supabase/R2). Then it's always-on, no laptop.

<!-- Add each new run below: date · domain · resume · coverage · model · gaps · fix -->
