# Desktop disappearance and session continuity — 20 October 2026

Owner reports the Windows desktop disappearing after approximately 30 minutes, including 20–40 minutes inactive during meetings. New approved policy: inactivity must not end a session; keep it recoverable until explicit End. This supersedes the 1 October 30-minute stopped-session expiry; existing historical ended records are preserved.

## Evidence and diagnosis

Source analysis of `public/kompas/app.js` found `sweepSessions` finalizes stopped runs after 30 minutes, and treats a missing heartbeat as a stopped run counted from last speech. `continueSession` separately rejects old paused sessions. Both paths now preserve the run, transcript and saved answers. Explicit End and another live window's ownership checks remain.

Accessible prior context reports build `kompas-a73b25e0065a` in a 14 October timeline export and three clock-ended records (Delta Air Lines, Jade Global, Insurance Company). This is retrieved historical context, not a newly inspected crash dump. It does not prove the cause of the native window disappearing. No Windows Application Error event, WER dump or installed executable version for today's failure is available here.

The historical desktop source is `eshwarjay0-delS/parfAct/desktop/main.js`, accessible through GitHub. Direct git clone lacked credentials; connector reads succeeded. Its renderer recovery handler reloads after a non-clean renderer exit, while closing the only window quits the app. Those mechanisms cannot identify which happened on the user's computer. Background throttling is already disabled. Do not claim adding that setting fixes this incident.

MarketFit now serves its own `public/kompas` frontend (shell route and Next rewrites confirm this), despite older launch-contract text describing an upstream canonical frontend. This change targets that live serving path. Do not overwrite it by syncing an older upstream app.js. Native executable changes and Windows smoke tests are separate work.

## REA: public references, not recovered internals

- https://www.parakeet-ai.com/calls — public description of a desktop app alongside calls; no evidence of private crash recovery architecture or indefinite-session guarantee.
- https://www.granola.ai/blog/where-do-meeting-recordings-go-zoom-teams-google-meet-and-what-to-do-when-they-vanish — discusses sleep/network interruptions in recording workflows, not Granola's native lifecycle implementation.
- https://electronjs.org/docs/latest/api/app — renderer and child-process disappearance events expose reason and exit code. These are appropriate diagnostic boundaries.
- https://electronjs.org/docs/latest/api/web-contents — unresponsive/responsive and render-process-gone are distinct events. A temporary hang must not be treated as user intent to end a meeting.

The product referred to as “Triangular” has not been identified reliably; no findings attributed to it. No dedicated REA capture tool was run.

## Verification and next evidence

10 executable lifecycle tests exercise 20/30/40/60-minute and 24-hour pauses, missing heartbeat, background live session, ownership, explicit End and historical ended records. These use a simulated clock and the actual lifecycle functions; they are not a Windows soak test. Five transcript revision tests and one native launch check also pass. Two native-launch assertions fail identically on untouched baseline 67f0186 (old upstream-mount assumptions); they remain separate known failures. Release identifiers in index.html and version.json are updated together; the existing live-session update prompt is preserved instead of forcing reload.

Next: inspect the Windows Reliability Monitor/Application Error event or WER report for the actual disappearance, with executable version and timestamp. Distinguish main-process failure, renderer failure, GPU failure, explicit window close, OS sleep and visibility loss. Add bounded local diagnostic logging if the installed build has no event evidence. Verify on Windows with a 60-minute background session, answer after idle, network interruption, sleep/resume and renderer failure, confirming saved answers and transcript. Do not declare native crash resolution from these web tests or a web deployment.
