# Production review — 2026-10-02

## Status

Full checkout now available. Production build, typecheck and173 focused/existing regression assertions pass. Production dependency audit:0 vulnerabilities. Connector writes returned403, but supplied credential authenticated for a direct push. Publication status must be verified from the remote; no production promotion or ownership migration has been performed.

## Fixed in this checkpoint

- Dashboard centers on resumes and job email; secondary tools remain available. Preview inbox/calendar/workflows no longer imply real sending.
- Verified account boundaries replace shared demo fallback in resume-related API routes. Download/PDF are owner scoped. Cross-origin cookie mutations and malformed authorization headers fail closed. Login retains Google and email magic links and restricts return paths.
- Admin sessions expire server-side. Extension authenticated downloads are confined to configured app origin and expected endpoints. ZIP expansion and filename handling are bounded.
- Voice capture drains final data, preserves short answers and request ordering, discards stale sessions, reports transcription failures and invalidates pending permissions on stop. Explicit correction vocabulary is scoped to session usage.
- J1 supplies versioned evidence-only prompts and deterministic structure guards. Optional Jev routing handles narrow edit complexity with validated outputs and bounded timeout fallback. No model grants access to files or approves external actions.

## Release blockers and scope limits

1. **Ownership migration:** Existing shared/demo files are real documents. New owner checks intentionally do not expose them. Map documents to verified owners, back up data, and test two-account isolation before rollout. Never infer ownership from filename alone.
2. **Tailored links:** `/api/tailor/file` still grants indefinite access by capability token. Add owner metadata across generation, cache and every channel; adopt authenticated retrieval or narrowly scoped expiring share links. A login check alone would not provide ownership protection.
3. **Build and integration:** Dependencies installed, typecheck and production build passed; lint has0 errors and existing warnings. OAuth, RLS, browser UI and deployment still require preview validation.
4. **Persistent storage:** Validate production object storage. Filesystem fallback under `/tmp` cannot provide durable cross-instance storage. Health currently indicates reachability, not end-to-end readiness.
5. **Abuse limits:** In-memory rate limits reset across processes and deploys. Production model/admin limits need durable counters and budgets.
6. **Email capabilities:** Four-account Gmail storage, job-only aggregation, calendar sync and scheduled approval-based sending require complete provider/data/workflow integration. Sample screens are not evidence these features work. No emails were sent in this work.
7. **Voice accuracy:** Transcription backend is proxied to the separate perfact deployment; its source and live behavior have not been verified. No Wispr integration, new Whisper backend or continuous model training was implemented. Evaluate word error rate on consented reference audio and actual mic/system capture before accuracy claims.
8. **Jev:** Requires explicit `J1_JEV_ENABLED=true` and server `TYPESAFE_API_KEY`. Mock tests do not prove live provider compatibility, latency or calibration. Keep disabled until deployment configuration and a task-specific evaluation are completed.
9. **Runtime timeout:** Review `vercel.json` API default 30 seconds against the tailoring route's 60-second export and model ladder budget. Confirm effective deployed limit rather than assuming either wins.

## Acceptance checks before release

- Sign in with Google and email link; confirm retry/expired-link/logout behavior on desktop and mobile.
- Test account A cannot list, read, tailor, move, delete or download account B's files, including shared legacy paths and tailored links.
- Compare baseline and tailored DOCX identity, titles, layout and paragraph count; use adversarial JDs and absent skills. Submitted JD skills are user-confirmed knowledge and should be included; missing employer history, metrics and credentials must not be fabricated.
- Record mic and shared audio; stop during permission prompts, rapid-toggle sources, end screen sharing, interrupt network, and switch sessions while requests are pending.
- Run complete install, lint, typecheck, build and high-severity production dependency audit. Test the preview before promoting.
