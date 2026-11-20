# Kompas clarifying box ("the sitting brain"): spec v1

Owner: Chief. Source: PR #467, branch `cursor/kompas-length-clarify-d579` @ 129aab39.
Code read: `src/lib/kompasConsistency.ts` (`clarifyingFromQuestion`, `speakableLines`), `src/lib/kompasAnswerAside.ts` (`answerAside`), `src/app/api/kompas/aside/route.ts`, `public/kompas/answer-aside.js` (`liveAside`, `acceptFresh`, `accept`, `flushLive`, `brainShown`).
Fixtures: `clarifier-fixtures.json` (47 cases, Houston/eshwarjay05 only, SOC JD). Runner: `node --no-warnings --experimental-strip-types run-clarifier-fixtures.mjs`.

## 0. What the box shows
- **Clarify (0–2):** questions the candidate can ask back. Each is about *this* live ask and names its referent.
- **Say this (0–2):** first-person, speakable lines grounded in a resume sentence.
- **Or nothing.** An empty box is a correct answer. Generic lines are never a fallback.

## 1. Decision table (deterministic, evaluated top to bottom; first match wins)

| # | Signal (rules) | Example | Clarify | Say this |
|---|---|---|---|---|
| 1 | Speaker is the candidate (`You:` turn, mic channel, first person echo of the last Them ask) | "So did I design it alone? Mostly, yes." | none | none (box is frozen, keeps the last Them card) |
| 2 | Chit-chat/logistics: greetings, thanks, audio/camera, "let's get started", < 4 content words, no `?` intent | "Hi, can you hear me okay?" | none | none |
| 3 | Epoch changed since the request was made (`epoch !== window.__kompasAskEpoch`) | new ask arrived mid-fetch | drop | drop |
| 4 | Follow-up with a pronoun ("that/it/this/those/there") whose referent in the last 2 Them+You turns is **ambiguous** (≥2 candidate nouns) | "Can you go deeper on that?" after "SLA monitoring and compliance dashboards" | 1, naming both: "The SLA monitoring side, or the compliance dashboards?" | 1 per option, from the resume |
| 4b | Same, referent **unambiguous** | "Why did you choose that?" after one clear thing | none (resolve the pronoun into the answer prompt instead) | ok |
| 5 | Ownership/scope verbs + `alone/yourself/whole/own/responsible/end to end` | "Did you design it alone?" | 1: overall vs one piece, **piece taken from context** (SD-WAN → failover; SIEM → the parser/connector; KYC → approvals) | ok |
| 6 | Overloaded term in a SOC interview (`incident`, `change`, `access`, `discovery`, `vulnerabilities`, `tickets`, `alerts`) **and** the resume has ≥2 senses | "How do you handle incidents?" | 1: "Security incidents on the SOC side, or IT incidents through ServiceNow?" | ok |
| 7 | Numbers ask (`how many/how much/how big/how large/what % /MTTR/SLA/years`) with an unscoped unit or owner | "How many tickets did you handle a day?" | 1: unit/owner scope ("Just my own queue, or the whole team's?") | never invent a number; bridge to what the resume measures |
| 7b | Numbers ask about a tool not on the resume | "How many years of Splunk?" | none | honest bridge line only |
| 8 | Multi-part: ≥3 asks (`,` / `and` / `also` + interrogatives) | "phishing incident, tools, what you'd do differently?" | 1 ordering offer: "Is it okay if I start with the incident itself, then the tools?" | ok |
| 8b | Two tightly coupled parts | "How did you set up the CMDB and keep it accurate?" | none | ok |
| 9 | Hypothetical with a missing branching fact (`what would you do if` + underspecified trigger) | "...a user reported a suspicious email?" | 1: the branch ("Had they clicked the link, or just reported it?") | ok |
| 9b | Hypothetical fully specified | "...CrowdStrike flagged ransomware on a DC at 2 AM?" | none | ok |
| 10 | Behavioral with no time frame (`tell me about a time`, `example of`) | "Tell me about a time you disagreed..." | none (EVPI is low: the answer is always "any") – pick the most recent resume-backed story | ok |
| 10b | Behavioral whose key term is ambiguous for this resume | "Tell me about a time you led a team." | 1: "Formally as a people lead, or leading the technical work?" | ok |
| 11 | Already clear (definitions, how-to, motivation, specific resume item) | "Difference between an IDS and an IPS?" | none | ok |

Hard limits: max 2 clarifiers, ≤ 16 words each, ends with `?`, contains a content word from the ask or the last 2 turns, never repeats a clarifier shown in the last 3 epochs.

## 2. Wording patterns (warm, speakable, includes the interviewer)
- Choice frame with the referent: "Do you mean **the overall SD-WAN design**, or **a specific piece like failover**?"
- Ownership: "Just so I answer the right part, the whole **{X}**, or my piece of it?"
- Scope: "Is it okay if I start with **{part 1}**, then get to **{part 2}**?"
- Unit: "Just my own queue, or the team's numbers?"
- Branch: "Had they **{action}** already, or just reported it?"
- Banned: "Could you clarify", "Can you elaborate", "What do you mean?", "Great question", "As an AI", "to be honest", any hard-coded noun that is not in the ask/context (today `failover` is hard-coded).
- Read-aloud test: one breath (≤ 16 words), contractions allowed, no jargon not used by the interviewer.

## 3. "Say this" grounding rules
1. Each line maps to exactly one resume sentence (store `source_line_id` in trace). No resume match → no line.
2. Rewrite to first person **properly**: strip resume scaffolding ("Experience in", "Hands-on experience", "Expertise in", "Responsible for", "Tracking of") and convert the head verb ("Tracking of incidents" → "I tracked incidents"). Never prefix "I" onto a noun/gerund (today produces "I tracking of Incidents…", "I hands-on experience…").
3. Names/tools/numbers must already be in the resume or the ask (existing `ungroundedProducts`/`foreignTokens`). JD-only tools (Splunk ES, CrowdStrike, Defender, Qualys) → bridge: "I haven't run Splunk day to day; the closest is {resume sentence}."
4. ≤ 25 words, ends with an inclusive tag only once per card ("happy to go deeper on that").
5. De-dupe by stem: never show "I implemented X" and "Implemented X" together (today both appear).
6. Profile lock: eshwarjay05/Houston text only; `cleanResume` already slices other profiles.
7. Chit-chat, candidate speech, or no question → no Say this.

## 4. Live sync (epoch)
- Every request carries `epoch`; the API echoes it; the client drops any response whose `epoch !== window.__kompasAskEpoch` **and** whose `question` stem differs from the header stem.
- **Bug today:** `flushLive` POSTs `{question, transcript, resume}` with no epoch, the route returns none, and `acceptFresh/accept` only check `if (aside.epoch != null …)`. A slow server response for the previous ask is accepted and pushed into history.
- Local paint (`paintLocal`) runs every transcript tick; the server result only replaces it if the epoch matches. Target: clarifier visible ≤ 150 ms after the question is gated (pure rules, no fetch needed).

## 5. Cheap deterministic-first design
1. **Gate** (rules, 0 ms): speaker, chit-chat, epoch → silent.
2. **Need score 1–4** (rules, ClariQ-style): sum of features – scope verbs, overloaded term with ≥2 resume senses, unscoped numbers, ≥3 parts, underspecified hypothetical, ambiguous pronoun referent. Score ≤2 → silent; 3–4 → clarify.
3. **Candidate set** (templates): each matched rule emits 1–3 templated questions filled from the ask + last 2 turns + resume senses.
4. **Rank by usefulness** (EVPI-lite): prefer the question whose answers would change *which resume sentence* the answer uses (i.e., options map to different resume lines). If both options map to the same line, drop it – the answer won't change.
5. **Model fallback** only when the need score is exactly at the boundary (2.5) or the referent resolver returns >2 candidates: one tiny call (cheap OpenRouter model, 60 tokens out, JSON `{clarify:[...]}`, 300 ms timeout, result discarded if epoch moved). Never on chit-chat/candidate speech. Expected rate < 10% of asks.
6. Telemetry per card: `rule_id`, `need_score`, `epoch`, `latency_ms` → Taskmaster scorecard "Clarifying questions fit".

## 6. Research: top 2 ideas adopted
1. **Separate "need to clarify" from "which question" (ClariQ / ConvAI3, Aliannejadi et al. 2020–21; CLAM, Kuhn et al. 2022).** ClariQ scores clarification need 1–4 and lets the system choose "no question" from the bank; CLAM shows selectively clarifying only ambiguous asks beats always-clarify once unnecessary questions are penalized. → Section 5 step 2: an explicit need score with silence as the default; fixtures penalize false clarifies (already_clear, behavioral, chit-chat). Links: https://github.com/aliannejadi/ClariQ, https://arxiv.org/abs/2212.07769
2. **Rank candidates by expected value of the answer (EVPI; Rao & Daumé III, ACL 2018).** A good clarifying question is one whose likely answers would change the response; too generic or too specific questions score low. → Section 5 step 4: keep a clarifier only if its options route to different resume sentences/answer plans. Link: https://aclanthology.org/P18-1255.pdf

## 7. Baseline (PR #467 @ 129aab39, offline)
See `clarifier-results.json`. 15/47 overall: already_clear 5/5, behavioral 4/5, hypothetical 2/4, multi_part 1/4, ambiguous_scope 1/5, numbers 1/5, followup 1/5, overloaded 0/5, chitchat 0/5, candidate_speech 0/4.
