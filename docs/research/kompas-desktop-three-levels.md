# Desktop answer depth and real-time audience switching

Owner request: three levels for Kompas desktop responses. Recruiter + Engineer communicates accessible technical substance; Architect + Developer explains requested construction and integration; Director communicates technical reasoning through business/operational decisions. A definition of CSRF or comparison with IDOR must not automatically become an incident walkthrough. Deep personal examples use actual supplied experience, bottlenecks and impact.

Source audit found two concrete causes: the live UI offered four levels (five in coding), and the answer generator mapped Architect to a Director anchor. Cached derived prose could therefore remain the same explanation. The audience handler also deferred switches and waited behind an existing anchor flight.

Desktop now offers three options, migrates old values, generates each audience directly, uses a separate versioned per-card cache and cancels the previous request immediately on a level switch. The server applies a desktop-specific question-shape policy and matching length budget to that marked request. Desktop definitions/comparisons receive direct guidance without the old mandatory narrative sequence. Introductions and explicitly requested code retain their established handling. Source history, identity and numerical-evidence guards remain authoritative.

Concurrent workstream 6f16111 already shipped three labels, questionRegister, levelGuidance and per-request config.level. This change was rebased onto that release and preserves it. The additional desktop path fixes immediate cancellation and audience-cache reuse; the existing web/prep behavior is retained.

Focused validation: 34 audience, three-level policy, desktop, focus, continuity and journal/REA checks passed; TypeScript and the production build passed; lint has one existing unused-argument warning and zero errors. Three broader answer-format source tests fail on historical renderer/style assertions: the original app already lacks the expected measurable-improvement placeholder phrase and head tag; styles are unchanged. These failures are retained separately. Deployment is pending. Real Windows UI and live provider output acceptance remain separate.

## Release evidence

Commit `c6559b93cf8a2f8e4d2f9e35a7131111e45e7265` reported Vercel success. Production `/kompas/version.json` returns `kompas-20261022-desktop-three-levels`. The cloud browser refused direct viewing of the JavaScript asset with ERR_BLOCKED_BY_CLIENT; no Windows UI or live model-output acceptance is claimed. The installed MarketFit desktop loads these hosted assets, so this response change does not require a native executable rebuild.


## Technical HR and engineering clarification — 22 October 2026

Owner correction: the first of the three levels is Technical HR + Engineer. Technical HR knows the foundational JD keywords, their uses, operational context and why each requirement matters, without necessarily understanding implementation internals. Engineering questions require methodical problem solving, hypotheses, research, alternatives and pivots, system dependencies, troubleshooting, patching, testing, monitoring, accountable on-call ownership, peer communication and mentoring where relevant. Select the emphasis from the question; do not flatten engineers into recruiter answers or force every topic through the same checklist. Definitions and comparisons stay concise; focused practical questions receive the reasoning they need. Levels two and three remain Architect + Developer and Director. Metrics and personal achievements require source evidence.

This supersedes the earlier generic recruiter wording and historical two-depth default for the current desktop selector. Every task must update Plan & Vision in the same change; source/research work also updates its REA session and evidence document. Retain superseded decisions as history. Runtime guidance, visible labels and the desktop response cache revision are updated together. Automated checks verify policy and switching; real Windows/model-output acceptance remains pending.
