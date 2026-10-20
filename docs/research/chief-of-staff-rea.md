# REA: AI Chief of Staff — "A Chief Who Takes Care of the Whole Work in My Absence"

**Target:** Viktor (viktor.com) — the "AI employee" from the Argona0x thread  
**Date:** 19 Oct 2026  
**Method:** Public reference review + procedure reconstruction  
**Owner directive:** "Update this to REA — a Chief who takes care of the whole work in my absence"

---

## 1. What Viktor Actually Is (Not Marketing)

Viktor is not a chatbot. It's a **persistent worker with chat as its interface**:

| Layer | What it does |
|-------|--------------|
| **Chat surface** | Lives in Slack/Teams. You @mention it in plain language. No workflow builder, no canvas. |
| **Tool access** | 27 native integrations + 9,800+ via managed connectors (OAuth). If a tool is missing, it writes a custom integration. |
| **Job execution** | Receives a task → picks tools → does the work on its own cloud computer → posts the finished file back in the thread. |
| **Scheduled Tasks** | "Every Monday at 9am, pull pipeline from HubSpot..." — cron-like recurring jobs, set in plain language. |
| **Heartbeat** | System task that runs 2x daily (~9am and 3pm workspace time). Checks recent activity, follows up on blockers. Can be paused. |
| **Approval gates** | Sensitive actions (send email, move money, post publicly) → prepares a draft + posts an Approve/Reject card. Nothing runs until a human clicks. Admins can require approval per-tool. |
| **Memory** | Two tiers: **personal skill** (remembers "keep summaries to short bullets" from a correction) + **team skill** (shared facts like "who owns what"). |
| **Scoping** | Invited, not omnipresent. Only sees channels it's added to. Finance stays private until invited. |

**Pricing:** Usage-based (credits per job), $100 free to start. Not per-seat.

**Scale:** 72,000+ teams. 4.9 on G2.

---

## 2. The Actual Procedure (Step by Step)

### 2.1 Onboarding (10 minutes, per the thread)

```
1. Add Viktor to Slack/Teams from the app directory
2. Open Integrations → connect tools (OAuth, one-click for most)
   - New workspace gets bonus credits per app connected
3. Brief it like a new hire, in plain words:
   "Me: [name], [what I do]
    My customers: [who buys from me]
    My voice: [two lines I wrote]
    Never: [contact anyone, post or pay without my yes]"
4. Give it the first job: "@Viktor find me 25 dental clinics in Austin..."
5. It works → posts a spreadsheet back in the thread
```

**Key insight:** No configuration UI. The "setup" is a conversation. The four-line brief becomes its system prompt.

### 2.2 Job Execution Loop

```
User: "@Viktor [plain-language task]"
  ↓
Viktor parses intent → selects tools → plans steps
  ↓
Executes on its cloud computer (browser, API calls, file generation)
  ↓
If sensitive step encountered → posts Approve/Reject card → WAITS
  ↓
Posts finished deliverable (spreadsheet, PDF, doc) in the thread
  ↓
Records corrections as preferences ("keep summaries short" → personal skill)
```

**Key insight:** The loop is **synchronous in chat, asynchronous in execution**. The user doesn't watch it work. It goes away and comes back with the file.

### 2.3 Scheduled Tasks (The "Chief" Behavior)

```
User: "[Task]. Every Monday at 9:00."
  ↓
Viktor creates a recurring Task with cron schedule
  ↓
Each run: executes → posts result in the designated channel
  ↓
User can Pause from the Tasks page
```

**Example from Viktor's own company:**
> "Every Monday, Viktor pulls revenue from Stripe, signups from PostHog, ad spend from Meta — posts the summary before the growth meeting. The first 15 minutes aren't spent assembling data anymore."

### 2.4 Heartbeat (Proactive, Not Reactive)

```
Twice daily (~9:00 and ~15:00 workspace time):
  1. Scan recent workspace activity (Slack messages, task updates)
  2. Identify blockers ("X was waiting on Y for 3 days")
  3. Follow up in the relevant thread ("Hey @Y, still blocked on X?")
  4. Propose new recurring Tasks based on observed patterns
```

**Key insight:** This is what makes it a "Chief" not an "assistant." It doesn't wait to be asked. It watches and acts.

### 2.5 Approval Architecture

```
Sensitive action detected (send, pay, post, delete)
  ↓
Viktor prepares the action as a DRAFT (does not execute)
  ↓
Posts approval card: [Approve] [Reject] with the draft visible
  ↓
Human clicks → action executes (or is discarded)
```

**Admin control:** Per-integration approval requirements. "Gmail send always requires approval" is a policy, not a per-action decision.

---

## 3. What We Already Have (MarketFit)

| Viktor component | MarketFit equivalent | Status |
|------------------|---------------------|--------|
| Chat surface (Slack) | WhatsApp webhook | ✅ Live, being simplified |
| Scheduled Tasks | Cron jobs (inbox watcher, follow-ups, bible-keeper) | ✅ Live |
| Heartbeat (2x daily) | Inbox watcher (every 30 min) | ✅ Live, more frequent |
| Approval gates | Drafts-only (never auto-send) | ✅ Live, hard rule |
| Personal skill (memory) | MEMORY.md + daily logs | ✅ Live |
| Job execution (tailor) | Resume tailor via WhatsApp | ✅ Live |
| Tool integrations | Gmail, Vercel | ✅ Live |
| Team skill (shared) | Plan & Vision journal | ✅ Live |

**We have all the pieces.** What's missing is the **unified "Chief" identity** — right now they're separate automations, not one agent the user talks to.

---

## 4. The Gap: From Automations to Chief

### What the user experiences now:
- WhatsApp bot: rigid, asks "which email", confusing
- Cron jobs: silent background workers, he doesn't talk to them
- Each automation is separate; no single "Chief" to brief

### What "a Chief in my absence" means:
When he's asleep, in a meeting, or on a call, the Chief:
1. **Watches** the inbox (already does — watcher)
2. **Decides** what needs action (partially does — triage)
3. **Acts** within bounds (drafts follow-ups, flags double-submits)
4. **Reports** concisely when he's back ("While you were out: 3 things happened, I handled 2, need your call on 1")
5. **Takes briefs** in plain language ("Watch the Richmond req, stand down anyone who files twice")

### The missing piece: a conversational agent loop
Not a state machine. An agent that:
- Receives a brief: "Handle my job hunt while I'm in meetings today"
- Has tools: check_gmail, draft_followup, check_double_submit, tailor_resume, etc.
- Works autonomously within approval bounds
- Reports back in plain language

---

## 5. Build Plan: MarketFit Chief

### Phase 1: Unified WhatsApp Agent (in progress)
- [x] Remove "which email" interrogation (done 19 Oct)
- [x] Remove AI resume picking, use deterministic routine (done 19 Oct)
- [x] Fast ack ("On it — tailoring now") (done 19 Oct)
- [ ] Conversational intent routing (reverted — rebuild carefully)
- [ ] Natural profile switching ("use my Houston resume")

### Phase 2: The "While You Were Out" Report
- New cron: every morning at 7am, compile overnight activity
- Format: "While you were out (10pm–7am): X new emails, Y need your action, Z handled automatically"
- This is the Heartbeat equivalent, but for a solo user

### Phase 3: Briefable Chief
- WhatsApp command: "Chief, watch [req] today" → creates a watch task
- WhatsApp command: "Chief, what's pending?" → summarizes all open threads
- The Chief becomes addressable, not just a collection of crons

### Phase 4: Approval Cards in WhatsApp
- When the Chief drafts a follow-up, send it as a WhatsApp message with "Send" / "Edit" / "Skip" quick-reply buttons
- Mirrors Viktor's Approve/Reject cards, but in WhatsApp (where he lives)

---

## 6. What NOT to Copy

1. **Slack/Teams as surface** — Our user lives on WhatsApp and phone. Don't build for Slack.
2. **Per-seat pricing** — He's a solo user. Usage-based is fine, but the model is different.
3. **Team skill** — He has no team. The "team skill" is his journal + memory.
4. **27 native integrations** — He needs Gmail, WhatsApp, and his resume. Don't over-build.

---

## 7. The One-Line Summary

**Viktor's procedure:** Brief in plain words → agent picks tools → works on cloud computer → posts finished file → heartbeat watches proactively → approvals gate sensitive actions.

**Our version:** The pieces exist (watcher, tailor, drafts, memory). The work is unifying them behind a conversational WhatsApp agent that he can brief like a Chief, that acts in his absence within his rules, and reports back plainly.

**Owner's words:** "a Chief who takes care of the whole work in my absence"

---

## 8. Second Post: The Overnight Run (Owner-provided, 19 Oct)

A second thread from the same author documents a single overnight execution:

```
Goal given (one rule): "find me $50,000 a month of new business.
                         public data only. contact nobody without my yes"

9:00 PM  Chief breaks the goal into 4 sub-jobs, assigns each a day/time.
         (User wrote none of the sub-jobs.)
11:00 PM Pulls 240 dental clinics in Austin from Google Maps; cuts every chain.
1:00 AM  Reads every remaining site; keeps 25. Each kept clinic has:
         one specific thing noticed + where he saw it.
2:00 AM  Writes an opener for each of the 25. Sends ZERO.
3:00 AM  Builds the one-page offer. No invented results.
         PRICE LEFT BLANK — the human fills it.
8:00 AM  User wakes up, types $2,000/mo → 25 × $2,000 = $50,000/mo on the table.
Then: repeats every Monday. 100 new clinics/month. Never forgets to start.
```

**Funnel:** 240 → 25 worth it → 1 offer → $50,000/mo on table → 0 sent without approval.

### Recovered principles (not in the first post)

1. **Goal decomposition by the agent.** The human gave ONE goal and ONE rule. The Chief created the 4 sub-jobs and their schedules itself. The human wrote none of them.
2. **The blank-price guardrail.** The agent prepares everything up to the decision point, then stops. It does not guess the price. The author's words: "an AI that guesses your price loses you the deal." This is the SAME rule as MarketFit's J1 guardrail (never invent metrics/certs/prices) applied to sales.
3. **Overnight autonomy.** Work happens while the owner sleeps, on the agent's own cloud computer, with the owner's laptop shut. Deliverable is waiting in the morning.
4. **Self-perpetuating schedule.** The run ends by installing its own recurrence ("every Monday"). The agent doesn't just do the job once — it makes the job repeat.
5. **Funnel transparency.** Every stage is countable: 240 pulled, 25 kept, 1 offer, $50K on table, 0 sent. The owner can audit the funnel, not just admire the output.

### Mapping to MarketFit

| Overnight run stage | MarketFit equivalent |
|---|---|
| Goal + one rule | His standing directives (e.g. "watch for double-submits, never email marketing firms") |
| Agent decomposes into sub-jobs | Bible-keeper / journal next-steps (partial — still human-shaped) |
| Filter 240 → 25 with reasons | Apply match scoring with cert overlap + freshness (shipped) |
| Openers written, zero sent | Follow-up drafts, never auto-send (shipped, hard rule) |
| Offer with blank price | Tailor output with honest gaps named, not filled (shipped — gaps listed, never invented) |
| Repeats every Monday | Cron automations (shipped) |
| Funnel numbers on the desk | Daily briefing digest (shipped) |

**The one stage we do NOT have:** the agent decomposing a fresh goal into its own sub-jobs. Our crons run fixed jobs he (or I) designed. The Chief designs the jobs from the goal. That is the Phase 3 "briefable Chief" work in §5.
