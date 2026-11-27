# Kompas answer fallback policy review — 27 November 2026

## Current release

Canonical production alias `job-dashboard-fawn.vercel.app` is independently READY at `dpl_7htkmgeSCGtUV5Jrv65GCo6iJQ8m`, master SHA `df91b5a23618616fc51e69acabe57db72d32b932`. PR #606 (complete-answer reliability) is included. PR #608, head `c2b2b80ddd5564d668e95cd9ded9aed52cf00bc5`, is not merged or live.

## Static review findings

1. **Provider preference is not a provider allow-list.** `provider.order` prioritizes named providers; it does not restrict routing. With `allow_fallbacks: true`, providers outside the list may still be tried. The PR describes gpt-oss as “pinned” to Groq, Fireworks, Cerebras and Together. If that is a strict boundary, use `provider.only` and add a payload regression. If it is only a preference, update the wording. Official reference: https://openrouter.ai/docs/guides/routing/provider-selection
2. **No-resume-match local answer needs an honest relevance guard.** The new generic access-control sentence can be returned for arbitrary questions when no resume line matches. Add a no-match test and frame it explicitly as a general approach or a transparent evidence limitation, not candidate experience.

## Exact-head evidence

- PR #608 full CI `46080095387`, schema `46080095391`, and Kompas baseline `46080095486`: all SUCCESS.
- COMMENT review `6094204045` posted; not approval.
- No live model call, key decryption, production deployment, or native-device acceptance was performed.

## Next gate

Resolve the two review findings, rerun full CI and baseline on the final exact head, independently review, then merge only under the approved ship gate. One no-cookie production answer probe is required after ship. No desktop rebuild is needed for a server-only model-routing change.
