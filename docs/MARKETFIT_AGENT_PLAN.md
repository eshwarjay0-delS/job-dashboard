# MarketFit Agent — build plan (prepared 2026-10-09 night)

User request (main chat, ~9:38 PM CDT Oct 9): "build a chat in our web app which
basically uses suggestions like this ... an agent with the intelligence ...
background running, analyzing, breaking down things ... push notifications when
something is going wrong."

Assistant proposed: agent chat at /dashboard/agent + watchdog monitors +
web-push/in-app notifications, his rules baked in. Notification-channel pick
went to him via widget — STILL PENDING. Build everything except the push
transport now; add the transport after his pick.

## Reuse (verified in repo tonight)

- `src/app/api/copilot/route.ts` + `src/lib/llm.ts` — LLM chat backend, keys
  already configured, per-user daily rate limit. Agent API follows this pattern.
- `src/app/dashboard/copilot/page.tsx` — chat UI pattern (chips, messages).
  Agent page is separate: operations agent, not generic career advice.
- `src/app/api/gmail/*` (`_lib.ts`, `threads`, `tracker`, `suggest-reply`) —
  Gmail context source for the agent.
- `src/lib/email-classifier.ts` (11-category classifier) + `src/lib/followup-engine.ts`
  (follow-up/escalation logic) — signal extraction for watchdogs.
- `supabase/migrations/20261008_gmail_dashboard.sql`,
  `20261009_candidate_profiles.sql` — tracker + profile tables.
- `src/app/dashboard/alerts/page.tsx` — existing alerts UI to extend.

## Build order

1. `src/lib/agent-rules.ts` — his standing rules as code, shared by chat +
   watchdogs: vendor→partner→client tiers; marketing firms
   (tekblu.us, cloudquestit.com, teksolveit.com) hard-excluded from follow-ups;
   consent-before-send; never store passport/SSN/DOB; 24–48h recency;
   two profiles kept separate (eshwarjay05 ↔ jayeshwar44); WI-style
   duplicate-submission detection.
2. `src/app/api/agent/route.ts` — POST chat endpoint. Builds a context pack per
   request: recent classified threads (classifier), submissions/rates/RTRs
   (tracker tables), candidate profile (per-account), then calls `callLLM`
   from `@/lib/llm` with the rules as system prompt. Per-user rate limit like
   copilot. No PII persisted in chat history.
3. `src/app/dashboard/agent/page.tsx` — chat UI (fork copilot page pattern),
   quick chips for his top analyses: "any duplicate submissions?", "which
   vendors went quiet?", "rate check this week".
4. `src/lib/watchdogs/` — five monitors, exactly what he named:
   - `duplicate-submission.ts` — same posting # across ≥2 vendor chains
   - `conflicting-rtr.ts` — exclusive RTR signed while another chain live
   - `vendor-silence.ts` — submitted, no reply in N days (uses followup-engine)
   - `rate-drop.ts` — RC below band or below confirmed rate for same role
   - `interview-no-followup.ts` — interview done, no follow-up drafted
   Each returns findings {severity, title, detail, evidence, suggestedAction};
   never drafts or sends without his approve.
5. `supabase/migrations/20261010_agent_findings.sql` — `agent_findings` table
   (per-user, severity, status: new/acked/dismissed).
6. `src/app/api/agent/watchdogs/run/route.ts` — runs all monitors, writes
   findings; triggered by Vercel Cron (`vercel.json` crons entry, e.g. every
   6h) or Supabase pg_cron.
7. Feed UI — extend `dashboard/alerts` or new `dashboard/agent/activity` reading
   `agent_findings`.

## Gated on his pick

Push transport: VAPID keys + service worker + `push_subscriptions` table if he
picks web push; in-app feed + (his chat, already his push channel) otherwise.
Nothing above depends on this choice.

## Constraints carried over

- Evaluator rule: agent works for any connected Gmail user, empty state at
  start, per-user reply profiles — same as Smart Reply.
- Consent-before-send absolute; watchdogs only surface, never send.
- Phone paste limit (~100 lines) applies to any SQL handed to him — keep the
  findings migration small or split.
- Repo AGENTS.md: this Next.js version has breaking changes vs training data —
  read node_modules/next/dist/docs/ before writing any code; follow the
  existing copilot/API-route patterns in this repo, not generic Next.js idioms.
