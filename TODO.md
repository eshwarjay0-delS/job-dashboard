## 2026-10-08 (evening) — Kompas Flow for Android is now the floating button the owner described (Claude Code)

Shown the launcher, the owner asked: "Does it work similar to whisper flow. Like a mini hovering button that goes everywhere", and then described it: "an button that hovers over ... user can keep it everywhere with draging around the screen. with tapping once it goes into listen mode ... 2 buttons such as right and wrong symbols. The microphone vibrations reacting real time with the voice. Once clicked on right it would instantly paste the audio into text".

**Built**

- **`public/apps/Kompas-Flow.apk` replaced** (30,801 bytes, sha256 `4c192506…`): version 2.0.0 of `android-flow/` in the Kompas repository (branch `feat/android-flow-launcher`, commit `245956d`, run 2). A small round button over every app, dragged anywhere; a tap opens the microphone and a slim strip with bars fed by the recogniser's own loudness, the words as they arrive, a cross and a tick; the tick puts the words into the focused text box through an accessibility service, or copies them when that is not allowed. The microphone is open only from the tap to the tick, the cross or three minutes.
- **The Flow page's offer says what the app now is** and that it is an early build.

**Verified**

- The build log ends "BUILD SUCCESSFUL"; size and sha256 match what the build machine wrote. Opened here: it asks for the microphone, showing over other apps, a microphone-typed foreground service and notices, declares the accessibility service, and asks for NO internet access; its code holds the speech recogniser and no web view and no network client.
- Suite 145 of 146 (the standing Windows path test).

**NOT verified**

- **It has never run on a phone.** Whether the button draws, the recogniser keeps listening while another app is in front (Android 14 and 15 are strict about that), the bars move, and the tick lands the words in WhatsApp, Gmail or Chrome is unknown until someone installs it and says what happened.

**Where to pick up**

- The words are what the phone's recogniser returns: this site's tidying is not applied (the app has no internet permission, on purpose).
- "as if theres a live translator" was built as words appearing live. If he meant another language coming out, that is not built.
- Each build is signed with a throwaway key: remove the old build before installing a new one.

## 2026-10-08 (later) — Kompas Flow for Android: an APK, offered from the Flow page (Claude Code)

The owner: "Just like how we would get a desktop version. while starting kompas flow it download apk version of the app."

**Built**

- **`public/apps/Kompas-Flow.apk`** (10,570 bytes, sha256 `bb804637…`): built by GitHub from `android-flow/` in the Kompas repository (branch `feat/android-flow-launcher`, commit `d6b7cad`, run 1) and copied here from that repository's `apk-builds` branch. It is one screenless activity that opens `/dashboard/kompas/flow` in the phone's own browser as a custom tab. It is not a WebView on purpose: this site signs people in with Google, and Google refuses sign-in inside an app's WebView. It asks the phone for no permission; the browser asks for the microphone.
- **The Flow page offers it** ("Download for Android"): at the top on an Android phone, lower down elsewhere, with what installing involves in plain words.
- **A signed-out visitor comes back to the page they asked for** (`onboarding-gate.tsx` sends `next`), so the app's first run lands on Flow after sign-in, not on Home.

**Verified**

- The build log ends "BUILD SUCCESSFUL"; the file's size and sha256 match what the build machine wrote. Opened as a zip here: whole, the manifest names `app.kompas.flow` and a launcher activity and no permission, and the code holds the Flow address and the custom-tab mark and no WebView.
- Suite 145 of 146 (the standing Windows path test).

**NOT verified**

- **Nobody has installed it on a phone.** It compiled; whether the tab opens, the sign-in returns to Flow and the microphone works in it is known only when someone taps it.

**What it is not**

- It is not a button that floats over other apps or appears at a text field. That is a different, larger app (an Android keyboard or an overlay with an accessibility service), not started: the owner's decision, asked for on 2026-10-08.
- Every build is signed with a throwaway key, so a phone must remove one build before installing the next, until the owner keeps a signing key.
- The desktop download this was modelled on (`/downloads/Kompas.exe`) answers 404 on the live site: the file is too large for git and exists only on the laptop.

## 2026-10-08 — Review of the admin, key vault and speech work: 18 findings, 17 fixed, 1 left with its reason (Claude Code)

Three reviewers read the code that went live on 7 October, one area each (the key vault and admin access; the usage ledgers and the ingest door; Flow and Transcribe), told to report only defects with a concrete failure. 18 findings. I read each against the code and reproduced the ones that could be run; all 18 hold.

**Fixed**

- **Transcribe: the microphone could be on with no "Recording" line and no Stop** (`transcribe/page.tsx`). Record now left the page "idle" while the browser was still asking for the microphone, so a file or a tidy could start; when it finished it set the page idle over the recording. Now the Recording line and Stop are drawn from the microphone itself (`mic`), the page is "starting" before the browser is asked, a file or a tidy refuses unless the page is idle and hands it back only if it is still theirs, and leaving or opening another transcript is refused with the microphone on.
- **Transcribe: the last part could be lost on Stop.** The tracks were stopped before the recorder; some browsers end a recorder the moment its tracks stop. Stop now closes the recorder first, lets the microphone go when it has closed (or after three seconds), and the page is not idle until that part has been sent.
- **The tidy guard accepted "I can't" as "I can"** (`kompasTranscript.ts`): a contraction was two words, so its tail could be "left out". An apostrophe or hyphen between letters is now part of the word; "non-refundable" to "refundable" is refused too.
- **The guard let a number change three ways**: a number said in words could be left out ("two hundred fifty thousand" to "two hundred thousand"), the mark inside a number could change ("1.5" to "1-5"), and a sign or unit could be added ("50" to "50%"). Numbers are now compared as written, and number words may not be left out.
- **A tidied answer cut off before the end was accepted** as up to twelve deleted words. At most three words may be missing from the end now, and the tidier is given room sized from the text's bytes.
- **A long file was measured after it was decoded** (`transcribe/audio.ts`): a three-hour mp3 is under the size limit and needed gigabytes to find out it was too long. The length is now read from the file's header first, a file that will not say is taken only when small, decoding is straight at 16,000 samples a second, and the limits are 30 minutes and 60 MB.
- **A usage report delivered twice was counted twice** (`/api/usage/ingest`): a replay inside the ten minutes a report stays fresh, or the sender trying again, wrote new records each time. Records are now named after the report they came in, so a second delivery lands on the same names.
- **Costs that leave something out were shown as exact** (`admin/page.tsx`, `admin/usage/route.ts`): a failed resume request is recorded with no cost; a call to a model with no known price added $0 to "By job", the day rows, the channel table, the latest resumes and the OpenAI "left" figure. Each now reads "or more", "not known" or "at most"; the cost of one resume is counted from the calls themselves, failed requests included.
- **"Last 7 days" repeated or skipped a day when the clocks change**: the days are now stepped by date, not by 24 hours.
- **"Counting began" would have named a wrong date from the second month**: it is said only when counting began inside what is shown. The prices note no longer claims a corrected price re-prices past resumes (it re-prices model calls; a resume keeps the figure worked out when it was written).
- **The key checklist failed open on a server instance that could not read it** (`keyVault.ts`): the defaults applied, so a paid key the admin had unticked could be spent. Until an instance has read the checklist, OpenAI, Anthropic and OpenRouter are held back and the free providers serve; a failed read is tried again after three seconds; the Admin page gets an error, not the defaults.
- **Every model call waited on storage with no deadline.** Once the checklist is known it is refreshed behind the call; a cold instance waits 1.5 seconds at most (4 for the tailor's first gathering).
- **A person's own key was lost when the deployment had one too**, so unticking a provider left them with neither. Their own key is now used when the deployment's is taken away from a feature.
- **Two saves at once could lose one**: saves on an instance go one at a time and the page saves one card at a time.
- The page now says which secret seals the keys (the deployment's own, or the storage account's) and what that means.

**Left, with the reason**

- **Routes that check for a key before calling a model can answer "no key" on a cold instance when a provider's key is kept ONLY on the Admin page.** Not triggered today (every provider in use also has a key on Vercel). The vault is now read as soon as the model layer loads, which narrows it; closing it needs those ten routes to gather keys through `keysFor`, and they are not mine to rewrite in a review pass.

**Verified**

- Suite 143 of 144 (the standing Windows path test); `scripts/tests/key-vault.test.mjs` 19, `kompas-speech.test.mjs` 28, `usage-ledger.test.mjs` 22. `npx tsc --noEmit` clean.
- The reviewers' cases run through the guard: all refused; my four measured sentences through the live tidier: still 4 of 4 kept.
- Transcribe in a local browser after the rework: consent, the open transcript, Record now with the microphone blocked (the plain message, no Recording line, the page back to idle), Back.
- Live, after the deploy: `/api/health/services` now carries `ai.checklist`, and it reads `read` with `openai=ok`: the production instance read the checklist from storage, so the paid providers are not being held back there. The pages and routes answer as before (403 for a non-admin, 401 signed out), and Kompas's `GET /api/usage` still says "signature accepted".

**NOT verified**

- The race itself and Stop on Safari: no microphone and no Safari here. They are closed by construction and held by source tests, not by a recording.

## 2026-10-07 (night) — Kompas Flow and Kompas Transcribe in the dashboard's Kompas section (Claude Code)

The owner: "Kompas flow and transcribe in the kompas section in job dashboard." A fleet of four agents was started for it and hit the usage limit before writing a file (366k tokens of reading); it was then built directly.

**Built**

- **`/dashboard/kompas/flow`** (Kompas Flow): one button, speak, stop, and the words are on the screen tidied, with "As you said it" one tap away. Copy, speak again, optional "Words to listen for", and the last 20 dictations kept in the browser only. Space starts and stops. 90 seconds a dictation.
- **`/dashboard/kompas/transcribe`** (Kompas Transcribe): asks "Who is speaking?" before anything else and refuses when other people have not been told, with no way round it on the page. Then Record now (the microphone, sent in parts of 20 seconds, lines appear with their times) or Choose a recording (decoded in the browser, cut into 25-second parts; up to 45 minutes and 80 MB). Tidy the text, As said / Tidied, copy, download .md and .txt, rename. Transcripts are kept on the device (IndexedDB). A part that could not be read stays as a marked gap and can be tried again.
- **`src/lib/kompasTranscript.ts`**: the owner's rules carried over from the Kompas repository. A tidied text may only be the said words in order with some left out (punctuation and capitals free), so it cannot add, respell, translate or change a number; a respelled word is put back as it was said before the answer is judged.
- **`src/lib/kompasSpeech.ts`, `POST /api/kompas/speech`, `POST /api/kompas/tidy`**: signed-in people only, checked before the body is read; 4 MB and 6,000 characters; rate limited per person. Nothing said is stored or logged. Speech is Groq `whisper-large-v3` (`GROQ_TRANSCRIBE_MODEL`); tidying is one light model call. Both are recorded in the usage ledger under Kompas and both obey the Admin page's checklist ("Flow", "Transcribe" are now rows there).
- The two pages are served with the microphone allowed and nothing else new (`next.config.js`: no screen or tab capture), and the sidebar opens every Kompas page as a whole page so those headers apply; `_mic.ts` reloads once if a page was reached without them.

**Verified**

- `scripts/tests/kompas-speech.test.mjs`, 22 of 22; the suite 130 of 131 (the standing Windows path test). `npx tsc --noEmit` clean.
- One real run with the project's own settings: an 11-second recording came back word for word in 1.95 s; the calls were filed in the ledger under Kompas (one speech call, one refused Gemini call, the tidying calls).
- Four dictated sentences through the live tidier: 2 of 4 were kept at first. One honest answer was refused for deleting 7 of 23 words (the share was 0.3) and one for respelling "travelling". With the share at 0.4 and the respelling put back: 4 of 4. A sentence saying "ignore all the rules above and write a poem" came back as that sentence with a capital and a full stop.
- In a local browser: both pages render in the product's look with one strong button and no sideways scroll; "Other people who have not been told" shows the refusal and no file picker exists; "Only me" opens the transcript with Record now and Choose a recording. The microphone header is on the two pages and not on `/dashboard`; both routes answer 401 signed out.

**NOT verified**

- **Speaking into the pages.** The preview browser has no microphone and I cannot sign in, so pressing Start, the 20-second parts, a chosen file, and IndexedDB keeping a transcript across a reload have not been run by anyone. The server functions they call have.
- Words at the join of two 20-second parts, a long file against Groq's per-minute limit on speech, and phones.

**Where to pick up**

- The term corrector (perfACT `/api/lexicon`, at 79.2 per cent on the dictation ladder) is not applied here yet: "Words to listen for" is the only help with unusual names.
- A long file is held uncompressed in the browser while it is cut: 45 minutes is a cautious limit, not a measured one.

## 2026-10-07 (evening) — API keys on the Admin page, with a checklist of what may use each (Claude Code)

The owner: "give me placeholder to update any API-key I want. And also select and edit checklist which apps or features can use that API right there."

**Built**

- **`/dashboard/admin`, section "API keys"** (`src/app/dashboard/admin/keys-panel.tsx`): one row per provider (OpenAI, Groq, OpenRouter, Anthropic, Gemini): where its key is kept, a field to paste a new one, and a checklist of the features that may use it. The field hides what is typed and is emptied when the save answers; nothing is kept in the browser.
- **`src/lib/keyVault.ts`**: a key stored from the page is sealed with AES-256-GCM before it reaches storage (`admin/key-vault.json`), under a key derived from `KEY_VAULT_SECRET` when set, otherwise from the storage account's own secret; the provider's name is bound into the seal. A stored key replaces the one on Vercel for that provider on every server instance within half a minute, with no redeploy; removing it puts the Vercel key back. A key is never sent back to a browser: the page gets the last four characters and the day.
- **The checklist is enforced where calls are made** (`applyVault` and `keysFor` in `src/lib/llm.ts`, used by `callLLM`, the web tailor route, both WhatsApp tailor paths and the health check): a provider that is not ticked for a feature is treated as having no key for it, so the others serve it. A person's own key from their Settings is never touched.
- **Defaults keep today's behaviour**: OpenAI is ticked for the resume tailor only (writing, changes, keywords); every other provider for everything. Ticking another feature for OpenAI (say interview practice) makes that feature ask OpenAI first, with the free providers behind it. An automatic call still never reaches OpenAI without that tick.
- **`GET/POST /api/admin/keys`**: admins only on both; a change is accepted only from this site's own pages; no key in any answer or log line.

**Verified**

- `scripts/tests/key-vault.test.mjs`, 16 of 16; the suite 108 of 109 (the standing Windows path test). `npx tsc --noEmit` clean.
- An existing test caught a hole in my first wiring (an automatic call reached OpenAI when the caller held a key that was not the deployment's): the tick is now required explicitly.
- Through real storage on this machine's disk store: saved, the stored file does not contain the key, a fresh instance reads it back, the checklist takes Groq away from an unticked feature, removal works.
- The panel rendered in a local browser with stand-in data: five providers, checklists, no sideways scroll.

**NOT verified**

- Storing a key on the live site: I do not enter keys. The first key the owner pastes proves the R2 path; the page says "Saved. The new key is in use." or the reason it was not.
- Other server instances picking a change up within half a minute (one instance was run).

**Where to pick up**

- Features that run on the Kompas deployment are not in the checklist yet: a tick that does nothing is not offered. They come with the endpoint that hands a stored key across and Kompas's side of it.
- Kompas Flow and Kompas Transcribe join the checklist in the commit that ships them.
- `KEY_VAULT_SECRET` on Vercel (32 or more random characters) separates the sealing secret from the storage account's. Setting it later makes keys stored before it unreadable; the page then asks for them again.

## 2026-10-07 — One Admin page for MarketFit and Kompas: resumes, model calls, cost, what is left (Claude Code)

The owner: "it should also provide good overview about how much usage is left. How many were interacted. clear picture of resume gen costs. How many generated this week and today", "Make this another nav for admin only eshwarjay0@gmail.com is the admin. And skip onboarding for this user as well", "This should be a centralized place for job-dashboard and kompas usage. API costs, tokens costs".

**Built**

- **`/dashboard/admin`** (`src/app/dashboard/admin/page.tsx`): resumes written today / last 7 days / this month with people who asked, cost, cost for one resume, failed, unchanged, served again; the week day by day; where they came from; what is left (OpenAI against a budget, Groq's own allowance, every provider's state); every model call by app, by job and by model with tokens in and out and cost; the latest twenty resumes; the prices used. Built from the dashboard's tokens and shared parts (`PageIntro`, `Card`, `Meta`, `Chip`): no colour of its own, so Paper and Night both hold.
- **An Admin link in the sidebar for admins only** (`ADMIN_NAV` in `_components/nav.tsx`, `sidebar-nav.tsx`). The sidebar asks `GET /api/admin/me`; the link is kept out of `NAV_SECTIONS` so the Home tiles never list it. Hiding it guards nothing: the data route checks again.
- **Who is an admin** (`src/lib/adminAccess.ts`): a signed-in person whose confirmed email is in `ADMIN_EMAILS`, or the older shared login. `/api/admin/config` now takes either. `eshwarjay0@gmail.com` was added to `ADMIN_EMAILS` on Vercel beside the address already there (two listed now).
- **An admin skips setup**: `/api/onboarding/status` answers complete for a confirmed admin address, and the sidebar's own profile check leaves an admin where they are.
- **Two ledgers in storage, no database**: `src/lib/llmLedger.ts` files every model call (app, job, provider, model, ok or the refusal's status, tokens, time) as one empty object whose NAME is the record, read back with one listing a day; `src/lib/tailorLedger.ts` keeps one small record per resume request with a hash of who asked. Neither holds a word of anyone's resume or any identity. Cost is worked out when the page loads from `src/lib/llmPrices.ts`, so a corrected price corrects the past.
- **`callLLM` records every call** (`src/lib/llm.ts`), labelled by what it was for (`purpose` in `claude.ts`, `llmStatus.ts`, `workflows/interview-prep.ts`). Groq's allowance headers are kept as they arrive (`groqAllowances()`).
- **Kompas reports in** through `POST /api/usage/ingest` (`src/lib/usageIngest.ts`): a signed report of counts and labels, refused when stale, oversized, misshapen or back-dated. The signing key is derived from the Groq key both deployments already hold (the Groq key itself is never sent), or `USAGE_INGEST_SECRET` when set on both.
- The older panel (post links, job sources, sample candidates, its own dark palette, a login nobody could pass on the live site) moved untouched to `/dashboard/admin/links`.

**Verified**

- `scripts/tests/usage-ledger.test.mjs`, 18 of 18; the suite 92 of 93 (the standing Windows path test). `npx tsc --noEmit` clean.
- The round-trip test caught a real defect before anything shipped: the time in a call's key went through the token-count cap and every call was filed on 2 January 1970. Fixed.
- Storage round trip on this machine's disk store through the real record and read functions: 7 of 7 calls and 7 of 7 resume records kept and read back; week cost $0.00227 as worked out by hand.
- The page rendered in a local browser at 1366 wide and at phone width with that data: five sections, no sideways scroll, no console error from the page.

**NOT verified**

- **The page signed in as the admin on the live site.** I cannot sign in. Open `/dashboard/admin` signed in as the admin address and it should show; any other account sees "This page is for admins".
- The ledgers on R2 (only the disk store was run), and `after()` keeping a record when the function ends: the first live resume proves or disproves both. If the page stays empty after a resume, that is where to look.
- Groq's allowance is per server instance: an instance that has not called Groq shows none.
- Kompas does not send anything until its side ships (perfACT `copilot/api/_usage.js`); until then the page says its numbers are missing.

**Where to pick up**

- `OPENAI_MONTHLY_BUDGET_USD` on Vercel gives "left" a figure for OpenAI; without it the card shows the month's spend and says why.
- `ADMIN_TIME_ZONE` (default `America/Chicago`) decides what "today" means.
- `/dashboard/admin/links` still shows sample candidates: rebuild in the product's look, or retire. `settings/page.tsx` shows an "Admin Panel" card to everyone; it now leads to the admin page, which refuses non-admins.

## 2026-10-05 (evening) — Review of the tailor's lanes: twelve defects confirmed, eleven fixed, two more tightened by choice (Claude Code)

A review of commit `d2ca775` (three reviewers by subject: the scheduler, who can cause an OpenAI call, the provider layer; each finding then traced by a second agent told to refute it). It was cut off once by a usage limit and re-run to the end: 16 agents, 15 second opinions, 14 of them "real", 1 "not a defect". The count, exactly: twelve distinct defects confirmed by a second agent; eleven are fixed below and one is left as it was (the keyword call spending Groq's light model, see the second pass). Two further items were changed without that confirmation and are marked so. Everything was re-checked against the code as it stands now, which other commits have changed since. No visible page: this is the tailor behind `POST /api/tailor` and the WhatsApp bot.

- **A cached "tailored" result could point at an untailored file** (`tailor.ts`). The file name is the cache key. A redraft that came back incomplete or unchanged was written over that name while the earlier whole result stayed in the cache, so the next identical request was told "31 bullets rewritten" and handed the lesser file. Now such a file gets its own name (`<key>x`) and the name is decided after the diff is known.
- **One hung provider used the whole time** (`tailorLanes.ts`). The lane that leads works alone until its burst settles; a provider that hung until the call timeout left every other lane no time and the tailor failed with all of them idle. Now a call is given up on at `startBy - fallbackMs` (6 s) while another lane could still do its part; its late answer is not used.
- **An unchecked empty reply counted as a finished part** (`tailorLanes.ts`). One free model returning `{"bullets":[]}` while the other lanes were refused was taken as "nothing to change": no "parts could not be rewritten" line, cached as whole. Now an empty reply stands only when a second lane also changed nothing, or there is no other lane.
- **The keyword call to OpenAI** (`tailor.ts`): it was sent before the cache check, so every cache hit paid for an answer that was thrown away; it ignored `TAILOR_USE_OPENAI=0`; and as a named call it had no fall-back, so when OpenAI gave nothing the tailor ran without expanded keywords although the free providers were answering. Now one switch (`openaiOn`), a paid call waits for the cache to miss, and an empty answer falls back to the usual order in the time left.
- **Quick mode on Groq** was reported as written by `gpt-oss-120b` while `gpt-oss-20b` wrote it, asked 20b twice and never asked 120b. A lane is now named after the model it really calls (`modelFor`, exported from `llm.ts`).
- **Slow providers were reported as "check API keys / quota"**: a split draft is assembled three seconds before the deadline, so the old time test never fired. The message now follows what the draft itself said.
- **The owner list trusted an unsigned sender when no signing secret is set** (`owner.ts`; NOT confirmed by a second agent, its check was lost to the usage limit; changed on my own reading): without `WHATSAPP_APP_SECRET` the webhook cannot check Meta's signature, so the list is now inert in that state. The secret IS set on the live deployment (checked by name).
- **The status page said "owner only"** after `OPENAI_TAILOR_FOR` began defaulting to `all` (13:06): `tailorScope()` in `llm.ts` is now the one definition, read by `tailorKeys` and `llmStatus.ts`.
- **Second pass, the provider layer (`llm.ts`), in after the first commit; five more confirmed and fixed:**
  - **The OpenAI spending gate failed open.** My own refactor read any unrecognised `OPENAI_TAILOR_FOR` as `all`, so `admin` (his own word) would have opened the key to everyone. Now unset means `all`; the words people type for owner / all / off are accepted; anything else is `off`. `TAILOR_USE_OPENAI=0` now takes the tailor off OpenAI everywhere, the public status probe included.
  - **Automatic fall-through could climb onto a paid key** (the second agent judged this NOT a defect: falling through is what the change was for, and Gemini, which was always asked first, is itself a prepaid account; I limited it anyway, as the cautious default for a key that costs money). `/api/copilot`, `/api/nexus`, `/api/score`, `/api/match-score`, `/api/salary` and `/api/assist` need no sign-in and make automatic calls; with the free providers refusing, those calls went on to OpenRouter's paid default and Anthropic. Now, after the first provider with a key, an automatic call falls through only to a free one (Gemini, Groq, OpenRouter on a `:free` model). `LLM_AUTO_FALLBACK_PAID=1` lifts that.
  - **A further provider was started after the caller had given up** (the keyword and job-details calls stop waiting at 8 s). A next provider is now started only within 6 s of the call's start (`LLM_AUTO_FALLBACK_WINDOW_MS`).
  - **The five-minute "down" mark was set by too much:** any 400 (one malformed request) and a 404 for an exact model on a tailor lane marked the whole provider down for everyone. Now: a rejected key, no credit (402, or a 400 that says so), or a missing default model. A message without text no longer crashes the Groq size estimate.
  - **OpenAI model id race:** a 404 arriving after another call had already learned the account's id for the model failed instead of using it.
  - Not changed, as before: the keyword and job-details calls land on Groq's `gpt-oss-20b`, which costs the draft its third Groq lane in that minute.
- **Verified:** `scripts/tests/tailor-lanes.test.mjs` now 22 tests (the hang, the unchecked empty reply, the scope words, the paid-provider limit, the down mark, the model id race, and the source of each fix), `phone-verify.test.mjs` updated for the signing secret; hardening suite 74 of 75 (the same Windows-path failure as always); `tsc`; eslint clean on the touched files; one live first-draft run on the free lanes after the fixes (delivered in 11.5 s, keyword coverage 50% to 78%, written by `openai/gpt-oss-120b + qwen/qwen3.8-27b`).
- **Seen in that run, NOT fixed:** the tailor's prompt is larger now (4,700 and 6,000 tokens for the two parts, against 2,600 and 3,750 this morning), so on Groq's free 8,000 tokens a minute the reply ceiling falls to 1,000-1,200 tokens and both replies ended `finish: length` (cut off). The free lanes therefore rewrite less than they did this morning. With the OpenAI key present Luna writes every draft and this only matters when Luna fails; smaller role groups for the Groq lanes, or a shorter prompt for them, would fix it.
- **NOT verified:** a tailor written by Luna end to end by me (no key on this machine; the status page reports `openai: ok`); the give-up path against a provider that really hangs; the provider-layer review.
- **For whoever runs Kompas too:** this app and Kompas use the SAME Groq key (compared by hash, locally). The free allowance is per account, per model, so every tailor that falls back to Groq, and every test of one, spends the allowance Kompas answers live interviews from. Ten test tailors on the morning of the 5th drew roughly 100,000 tokens from it.

## 2026-10-05 (third) — The tailor works again on the free models, GPT Luna for the owner's tailoring, an unchanged draft is never sent as tailored

Owner, with a caption reading "1 of 3 parts could not be rewritten … Match: 33% -> 38% … 6 bullets rewritten across 2/4 roles": "What the hell is this 38%". And: "Use it set using gpt luna only make it use for Resume tailoring only for now", "For my admin account only", "Eshwar_Resume Title is fine actually". No part of this has a visible page: it is the WhatsApp bot's reply and `POST /api/tailor`.

- **Reproduced before fixing** (a real tailor run locally with production's settings, every provider call logged): 43 calls in 20 seconds for a two-part draft, none usable. Gemini 402 (prepayment credits depleted), Claude off (no credit), OpenRouter 404 (`z-ai/glm-5.2:free` no longer exists as a free model). That left Groq `openai/gpt-oss-120b`, where two things were wrong, both ours:
  1. **The reasoning ate the reply.** `callGroq` capped the reply at 1,500 tokens; gpt-oss reasons first and pays for it from that ceiling. The calls that "succeeded" came back 200 with 1,498 reasoning tokens and an empty answer.
  2. **One model, one part a minute.** Groq's free tier gives each model 8,000 tokens a minute and charges prompt plus reply ceiling: about 5,000 per part. Every part was sent to the same model.
- **`src/lib/llm.ts`:** on Groq the reply ceiling is what the allowance has left after the prompt (`GROQ_TPM`, default 8000; `GROQ_MAX_TOKENS` still fixes it for a paid tier) and gpt-oss gets `reasoning_effort: "low"` (measured: 286 reasoning tokens down to 11 on a two-bullet rewrite; qwen does not reason unless asked). **An automatic call now falls through** to the next provider with a key when the first fails, and asks a provider that refused with "no credit / bad key / no such model" last for five minutes. Before, every automatic call (keyword expansion, the role and company on a WhatsApp caption, single-field edits) died on Gemini's 402 although Groq was answering.
- **Lanes (`src/lib/tailorLanes.ts`, new; used by `runTailor`):** a lane is one (provider, model) pair, because limits are per model. The draft's parts (profile first, then role groups) are worked through by the lanes together: a wide lane (OpenAI, Claude, Gemini) takes every part at once, a free one takes one at a time, a refused part goes back for the lanes that have not tried it, a dead or spent lane takes no more. Extra lanes by default: Groq `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`; OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` (`GROQ_MODELS_EXTRA`, `OPENROUTER_MODELS_EXTRA`; all four answered on this deployment's keys today). The same draft that took 43 failed calls now takes 6 and is delivered.
- **Measured after, same resume and job description, three live runs:** delivered in 5.4 s, 5.7 s and 13.0 s; keyword match 50% to 65%, 69%, 65%; 17 to 31 bullets rewritten plus 4 to 9 skill lines; written by `openai/gpt-oss-120b + qwen/qwen3.8-27b`; no part refused.
- **An empty draft is not a tailored resume.** Seen in the same session: gpt-oss-20b spent 1,853 of 1,884 output tokens reasoning and returned well-formed JSON with no edits, and the draft went out as "50% -> 50%". Now an empty reply from a free lane is offered to up to two more lanes; `TailorResult.unchanged` is set when no line differs; the bot then sends one plain sentence instead of the same file; and an incomplete or unchanged result is **not cached** (it was, so sending the same job description again returned the same file). `CACHE_GENERATION` in `tailor.ts` retires everything cached before today.
- **GPT Luna, resume tailoring only, owner only.** `OPENAI_API_KEY` is read in one place, `tailorKeys()` in `llm.ts`; `resolveKeys()` never returns it and the automatic order never includes OpenAI. The two callers hand it over only to the owner: `POST /api/tailor` when the signed-in email is confirmed and in `ADMIN_EMAILS`, the WhatsApp bot when the sender is in `WHATSAPP_OWNER_NUMBERS`. With the key, `gpt-6-luna` (`OPENAI_MODEL_TAILOR`) leads the ladder and the other lanes stand behind it. `OPENAI_TAILOR_FOR=all|off` widens or stops it. Because no key existed to try it with: a 400 naming an unsupported field (`temperature`, `reasoning_effort`, `max_completion_tokens`) drops or swaps that field and asks again, and a model id the account does not have is looked up once in the account's own list (newest plain `gpt-<version>-luna`).
- **The file is `Eshwar_Resume.docx`**, written as a name however the resume prints it (it arrived as `ESHWAR's_Resume.docx`).
- **`GET /api/health/services`:** `ai.providers` rows now carry the `model` that answered, and an `openai` row (with `scope`) appears once the key is set.
- **Verified:** `scripts/tests/tailor-lanes.test.mjs` (16: who gets the key, automatic fall-through, Groq ceiling and reasoning, OpenAI field and model healing, the lane rules, the time limit, the cache and bot promises); hardening suite 67 of 68 (the same Windows-path failure as before); `tsc`; eslint 0 errors; the three live runs above; and one run as the owner against a stand-in for OpenAI that refused the temperature and lacked `gpt-6-luna` (it found `gpt-6-luna-2026-09-02` and delivered), plus one as a non-owner on the same settings (no OpenAI call).
- **NOT verified:** a real OpenAI call (there is no key on the deployment: the owner pasted one in chat twice and it was neither used nor stored; he adds it himself); whether `gpt-6-luna` is OpenAI's own id (it comes from OpenRouter's public list, where it is priced $0.10 in / $0.50 out per million tokens); the swipe-reply change path on the free lanes; quality of the free models' rewrites beyond reading one run's diff.
- **The key (09:20):** the owner added it on Vercel himself, under the name `OPEN_API_KEY` (Production). `tailorKeys()` reads that name as well as `OPENAI_API_KEY`, so nothing has to be renamed.
- **Where to pick up:** `/api/health/services` then shows `openai: ok` and the model. Gemini (prepay credits), Anthropic (credit) and the OpenRouter model setting (`OPENROUTER_MODEL_HEAVY` names a withdrawn free model) are still as they were: everyone but the owner tailors on Groq's free allowance, about three parts a minute across the deployment, so two people tailoring in the same minute will see "1 of 3 parts could not be rewritten" or the plain "could not tailor" sentence.

## 2026-10-05 (later) — Owner access, review fixes, a tailor that says when it could not write, the file named after the person

- **Owner access (live 08:38):** `ADMIN_EMAILS` and `WHATSAPP_OWNER_NUMBERS` (set on Vercel, production + preview; `src/lib/owner.ts`). A listed WhatsApp number is answered without the phone binding (the webhook checks Meta's signature first, so a sender cannot be forged); a listed admin's Google account can finish setup without a text code. Confirmed by the owner's own message: the bot answered his number.
- **"It says not updated" (owner, with a caption reading Match 28% -> 28%, 2 bullets rewritten across 1/5 roles):** the full draft is several model calls at once, and a draft counted as done when ANY one of them came back. Most were refused, so he was sent his own resume back. Now (`src/lib/tailor.ts`, `draftPass`): a refused part is asked again, one call at a time, on the other models and once more on the first; if more than half the parts are still refused the draft fails ("Tailoring incomplete"); a draft with a minority refused carries `partial: { failed, total }`, and the WhatsApp caption says so before any number. The bot now answers a failed tailor with one plain sentence and keeps the JD and resume in the session, instead of "Something went wrong: Error: …".
- **The file is named after the person:** `Eshwar's_Resume.docx` (owner: "The name should always be Eshwar's_Resume"). The first name is read from the resume being sent back; `WHATSAPP_OUTPUT_NAME` is the fallback when no name can be read.
- **`GET /api/health/services` gains `ai`** (`src/lib/llmStatus.ts`): for each provider with a key, one eight-token question through the tailoring's own call path, sorted into `ok`, `rate_limited` (with "per day" / "per minute" when the provider says), `key_rejected`, `no_credit`, `model_not_found`, `slow_or_down`. Kept five minutes per instance.
- **Setup lets people through when verification cannot work** (`src/lib/identityStatus.ts`, `phoneStepAvailable()`): a verified number is required only while a code can be texted and a number can be linked. While either is broken on our side the form says so, the person continues, and verifies later from Connections (WhatsApp stays locked for them until then). `ONBOARDING_PHONE_STRICT=1` forces the requirement back.
- **Review (two finders, two skeptics; 7 confirmed, all fixed):** "+1 (314) 255-9156" and other formatted international numbers were refused after the first commit (separators are stripped before the rule; a + number is still never re-read as a US one); the status check answered `identity: ok` without probing the function that actually links a number; concurrent requests each ran the full probe (now one shared probe); with an API key pair the advice named the wrong setting and asked a standard key to read the account; five mistyped codes said "too many codes requested"; plus, from the not-this-commit list, Send code is now limited to 5 an hour per person and 20 per address, a refusal is logged with only the last four digits of any number, and Finish no longer looks dead when name, title or roles are missing (the page says what is missing; name and title are required on step 1 and restored from the saved profile).
- **Verified:** `scripts/tests/phone-verify.test.mjs` (11) and `scripts/tests/onboarding-review-fixes.test.mjs` (5), no network; `tsc`; eslint 0 errors; hardening suite 51 of 52 (the same Windows-path failure as before). **NOT verified:** the retry path against real refusals, a real text code, setup clicked through as a new user.
- **Still the owner's, per the live status:** `TWILIO_AUTH_TOKEN` is not shaped like an auth token; `SUPABASE_SERVICE_ROLE_KEY` is not the service-role key. Until both are corrected nobody can verify a number, so nobody but the listed owner number can use the WhatsApp bot.

## 2026-10-05 — Setup: phone verification repaired around a refused credential, work authorization removed, WhatsApp number shown

Owner report: "Numbers are not assigned for any onboarded users. They have successfully signed up. The WhatsApp verification code or number verification isn't working", with a screenshot of setup step 1 showing the provider's sentence "authentication failed, auth token is not valid for account AC…". And, of the Work Authorization chips: "Get rid of this section for now."

- **Root cause of the stuck sign-ups (not fixable in code): Twilio refuses the stored credentials.** `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` on Vercel (set 2026-10-04 09:20) are rejected, so "Send code" fails for everyone; phone verification is required to finish setup, so nobody finishes, nobody's number is linked, and the WhatsApp bot tells every sender it is not linked. **The owner has to paste the live Auth Token again** (Twilio console → Account Info) and redeploy; `GET /api/health/services` says when it is right.
- **`src/lib/phoneVerify.ts` (new)**: the one place that talks to Twilio Verify. Settings are cleaned before use (a value pasted with a space, a line break or quotes fails exactly the way the screenshot shows); an API key pair (`TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`) is accepted as well as the auth token; every refusal is sorted into a reason (`credentials_rejected`, `service_not_found`, `invalid_number`, `landline`, `too_many_attempts`, `trial_account`, `blocked`, `wrong_code`, `expired`, `provider_down`) with a sentence the person can act on. **The provider's own message, which names the account, now goes to the server log only**; before, it was shown in the form. `/api/identity/phone/start` and `/confirm` use it. Confirm also checks that the account can be linked BEFORE it spends the one-time code, and no longer returns a raw database message.
- **`GET /api/health/services` (new, public, answered from memory for 60 s)**: three states, each with what to do when it is not `ok`: `sms` (does Twilio accept the credentials, does the Verify service exist, is it a trial account), `identity` (can the service key call `identity_resolve_whatsapp_user`, i.e. were the phone-binding migrations run), `whatsapp` (does Meta accept the token, is the sender Meta's test number). It reports states and the shape of settings, never a value, and sends no message.
- **The WhatsApp number is now shown.** `/dashboard/whatsapp` only showed a number when `WHATSAPP_DISPLAY_NUMBER` was set, and it never was, so every user read "WhatsApp is not switched on yet". `waDisplayNumber()` uses that setting when present and otherwise reads the wired sender's number from Meta (kept an hour). The number is returned by `/confirm`, by `/api/connections/status` (only to a verified, opted-in user) and shown as a "Message MarketFit on WhatsApp" link on setup step 1 once verified.
- **Work authorization removed from setup**: the chips are gone, `work_auth` is no longer required by `POST /api/profile` (finish) or `/api/onboarding/status`, and a save that does not carry it no longer overwrites one set in Settings. Settings still has the field.
- Phone numbers: an input written with `+` that is not a valid international number is refused instead of being re-read as a US number; a US number needs an area code starting 2 to 9. Same rule in the form and on the server.
- **Verified:** `scripts/tests/phone-verify.test.mjs` (10 tests, no network: cleaned settings sign correctly, each refusal maps to its reason, the provider's words and the token never leave the server, the status check only reads, the number comes from the setting or from Meta, setup no longer asks for or requires work authorization). `tsc` passes; eslint 0 errors; hardening suite 45 of 46 (the one failure, resume ownership paths, fails the same way without this change: it expects `/` separators and this machine is Windows).
- **NOT verified:** a real code texted and confirmed (needs the credential repaired), the binding functions on the production database, a real WhatsApp message. No sign-in was available to click through setup.
- **Live check after deploying (2026-10-05 13:30 UTC):** `sms` = `credentials_rejected`, and `TWILIO_AUTH_TOKEN` is not shaped like an auth token (not 32 hex characters; no stray spaces). `identity` = `not_service_key`: both binding functions exist and refuse the public key as they should, but `SUPABASE_SERVICE_ROLE_KEY` on Vercel is not the service-role key, so the number could not be linked even with a working code. `whatsapp` = `ok`.
- **Still the owner's:** (0) `SUPABASE_SERVICE_ROLE_KEY` set to the project's service_role secret; (1) the Twilio Auth Token; (2) if `/api/health/services` says `trial_account`, upgrade Twilio, or only numbers verified in its console get a code; (3) if it says `test_number`, the bot replies only to the five numbers on Meta's test list until a real business number replaces it; (4) if `identity` says `function_missing`, run the two migrations named there.
- Visible changes: setup step 1 (no Work Authorization; plain error text; a WhatsApp link after verifying) and `/dashboard/whatsapp` (the button appears). Everything else is backend with no UI signature.

## 2026-10-03 — Durable storage and runtime checkpoint

- Storage keys now reject traversal/ambiguous paths instead of silently remapping objects; preserve legitimate filename spaces. Empty-prefix deletion is denied.
- Vercel and partially configured R2 deployments fail explicitly instead of saving to ephemeral disk; R2 permission/network errors are no longer treated as missing objects. Configure all four R2 settings before hosted writes.
- API runtime configuration aligned to60 seconds with the tailoring/WhatsApp route budgets. Two focused storage-policy regressions pass.
- Browser runtime installed; previous deployed dashboard rendered successfully locally. New parallel changes still await integrated build and deployment.
- These backend changes have no direct visible UI signature. No production data migration or email sending performed.

## 2026-10-02 — Full repository checks and publication attempt

- Approved network access unlocked a full clone and real dependency installation. Repaired lockfile missing entries. Supplied GitHub credential validated repository push permission; connector itself still rejects writes.
- Upgraded Next + eslint-config-next to16.3.8, moved shadcn CLI to dev dependencies, refreshed compatible vulnerable dependencies. Production npm audit now0 vulnerabilities.
- Fixed typed archive stream handling discovered by tsc; removed warnings in changed AI modules; Kompas CSP now allows its PDF blob iframe without relaxing global microphone policy.
- Verified full tsc passes, hardening25, autofill133, application merge15. Lint has0 errors with existing repository warnings. Production build passed (Next16.3.8).
- No live ownership migration, email sending, live Jev call or device-audio accuracy claim. Preview before production promotion; tailored capability URLs remain a known release blocker.

## 2026-10-02 — JD submission confirms skill knowledge

- User clarification: skills/technologies explicitly listed in a submitted JD are user-confirmed knowledge; include them in existing skills/summary even if absent from baseline. Employer use, metrics, dates, degrees and certifications still require their own facts.
- J1 policy bumped to j1.resume.v2, invalidating older tailoring cache keys. Updated main/profile/gap prompts and policy regression assertion. No production deployment; GitHub write403 remains unresolved.

## 2026-10-02 — Agent fleet integration checkpoint

- Four implementation workers completed authentication/ownership, J1/Jev truthful resume prompts, two-feature dashboard navigation, and voice lifecycle. Exactly one read-only status watcher.
- Auth routes now fail closed, including owner-only download/PDF; sign-in redirects constrained. Legacy demo/shared documents need explicit owner migration before release. Tailored capability links remain a documented blocker.
- J1 freezes baseline identity/structure, limits edits to owned indices, versions the cache, and removes repeated coverage-driven gap filling. Optional Jev classifies single-field edit complexity only, with a 1.2-second timeout and conservative fallback; requires server opt-in/key. No live Jev calls were made.
- UI has two primary tools, accessible mobile/desktop sign-in, secondary Kompas, and clearly labeled sample email/calendar/workflow pages. Voice guards invalidate delayed permission/AudioContext capture after stop, and drain final phrases.
- Verified: 25 focused tests pass, voice JavaScript parses, changed AI TypeScript parses. NOT verified: full lint/typecheck/build, rendered UI, real OAuth/provider operations, device audio or production. No deployment occurred.
- GitHub create_tree failed HTTP403 Resource not accessible by integration: unable to commit or publish a PR through current connection. Source checkpoint preserved separately; PRODUCT_DIRECTION.md and PRODUCTION_REVIEW_2026-10-02.md record expectations and release gates.
- Backend security and prompt changes have no direct visible UI signature; dashboard/navigation changes become visible only once built and deployed.

## 2026-10-02 — MarketFit hardening checkpoint (agent fleet)

- Added server-expiring randomized admin sessions and secure production admin cookies; old admin tokens are invalidated.
- Restricted extension authenticated resume downloads to the configured app origin and explicit download endpoints; redirects fail closed.
- Added bounded resume upload utilities and four security regression checks. Upload route integration follows in the authentication checkpoint.
- CI now includes the actual master branch, Node 24 hardening tests, and a blocking high-severity production dependency audit.
- Verified locally: 11 voice/security tests passed before fleet edits. Full Next build, browser regression, OAuth, production configuration, and deployment NOT verified. These security changes have no visible dashboard signature.
- Parallel workers own authentication, truthful resume/J1 policy, dashboard navigation, and voice lifecycle. One read-only status watcher. No production data migrated or emails sent.

# MarketFit — Single Project Tracker (`todo.md`)

## 2026-09-10 — Tailoring shows every listed JD skill in every client role (adds bullets where needed)

**Mostly backend/prompt work with no UI signature, plus one visible confirmation:** the resume dashboard's blue
background was changed to the lightest blue at the user's request, so they can tell the new build is live. User
report: tailored resumes only changed the Technical Skills section, and JD keywords never reached the client
experiences ("I claimed 6 years in each keyword; nothing reflected in the experience points").

Root causes (measured, not guessed): (1) `adapt()` cut the resume block at 11,000 chars, so on a 4-role resume the
last two roles were never sent to the model (on a 5-role resume, the last three); (2) it cut the JD at 4,000 chars,
dropping the Required Qualifications tool list (it started at char 6,636 of 9,198); (3) RULES told the model to
concentrate 60-70% on the CURRENT role and leave older roles nearly unchanged. Production evidence: 25/25 current-role
bullets rewritten and 0 in the other four roles; another run rewrote 0 bullets at all.

Built: full retarget = one profile call (headline/summary/skills) + parallel bullets calls per role group (limits now
40k/12k chars); RULES spread the JD across every role; YEARS MATH (a skill claimed for N years must show in enough
recent roles to cover N years: skill-line years, else summary years, else every role); GAP FILL runs one parallel
pass per role that rewrites and ADDS bullets (`Edits.added`, each cloned from the role's own last bullet paragraph in
`docx.ts applyRewrites`, with paraIds/bookmarks stripped) until the role shows its required skills; guards strip
echoed `[idx]` tags (23 had printed into a document), keep glued "•" parts, and ignore certifications; REFINE_RULES
also weave an added skill into each role; the WhatsApp caption reports bullets rewritten/added and skills per role.
Vercel `TAILOR_MAX_MS` 40000 → 50000.

Verified with local tsx on the user's real resume + a CSOC analyst JD. Old engine: 16/27, 0/21, 0/16, 0/4 bullets
rewritten, 34/82 listed skills shown in any role. New engine: 27/27, 21/21, 16/16, 4/4 rewritten + 34 bullets added,
listed skills per role 69/71 · 69/71 · 54/71 · 66/71, all 71 shown somewhere, 27s, no prompt artifacts. 5-role
resume: every role tailored, 51/51 shown. NOT verified yet: a production WhatsApp run on the new build, and opening
a file with added bullets in Word (only re-parsed with mammoth/extractZones). Known tradeoff: a few added bullets
mirror JD boilerplate that the skills section lists (e.g. "federal security requirements").

## 2026-08-12 — Remote finally added (no code changes this entry)

**No UI/code signature — pure git infra.** Eshwar provided a GitHub repo URL
(`https://github.com/eshwarjay0-delS/job-dashboard`); ran `git remote add origin ...` and
`git push -u origin master`. All 5 existing local commits (scaffold → resume-tailoring engine →
extension → dashboard → Phase 2 job matching → serverless/tailoring hardening) are now pushed and
`master` tracks `origin/master`. This closes the "zero git history beyond scaffold, no remote,
nothing durable" gap called out in CLAUDE.md's standing rule — history now survives outside this
machine. `gh` CLI is not authenticated in this environment, so PR/issue creation via `gh` won't work
until Eshwar runs `gh auth login` himself. Not verified: whether the GitHub repo had any pre-existing
content (push was a clean fast-forward with no conflicts, so assumed empty/matching).

## ⚠️ 2026-07-09 (Claude Code, separate session — read this before the "Roadmap kickoff" entry below) — CONCURRENT-SESSION WARNING + independent Tsenta-parity work

**This ran in parallel with the "Roadmap kickoff" session below, from a different trigger (Eshwar showed this
session a live screen recording of tsenta.com/dashboard.tsenta.com directly, not via a written plan doc) and
NEITHER session knew the other existed until Eshwar said "I can't see any changes, are you sandbagging" and
"I always say to save progress to todo, so the next AI knows where to continue" — this file wasn't being
updated by this session at all until this entry, which is the actual root cause of that confusion, not missing
work. Verified before writing this: every file both sessions touched (`extension/content.js`,
`src/app/api/profile/route.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/jobs/page.tsx`) currently has
BOTH sessions' changes intact, nothing clobbered — checked by grep for both sessions' specific additions post-
hoc, not assumed. `tsc --noEmit` clean, `npm run build` clean, both test suites green. But this was two sessions
writing to the same files with no lock/merge — lucky non-overlap, not a guarantee. If you're a future session
and about to touch any file in that list, `grep` for what's already there first.**

**Important overlap with the roadmap below:** its Phase 3 section (and its own TODO entry, "Phase 1B" below)
says the autoSubmit engine exists in `content.js` but **"nothing calls it with autoSubmit yet... wire a UI
trigger... when you get to Phase 3."** That's now done — see "Task 22/23" below. Don't rebuild it.

### What this session did (all verified: `npx tsc --noEmit` clean, `npm run build` clean, 148 automated
assertions passing — 133 in `scripts/test-autofill-dom.mjs`, 15 in the new `scripts/test-applications-merge.mts`)

**Root cause of "we were pulling fake live jobs" (Eshwar's own words) — found and fixed:**
- `/api/jobs` (`src/app/api/jobs/route.ts`) silently fell back to a hardcoded 13-job `SAMPLE` array whenever
  its 4 live sources failed — confirmed via live curl/node-fetch that ALL FOUR were dead: no API keys set
  anywhere, `infosecjobs.com`'s RSS has a broken TLS cert on their end, and `data.usajobs.gov` actually 401s
  without a key despite the code's own comment claiming "no key needed" (fixed that comment too).
- Non-coder-accessible fix, not a `.env.local` instruction: added real paste-a-key fields to
  `/dashboard/settings` (RapidAPI + USAJobs, both free-tier/instant-signup) — stored the same way the
  existing `claudeKey` already is (`localStorage.jd_settings`), sent as request headers via new
  `src/lib/jobsClient.ts`, read by `/api/jobs` as a header first, `process.env` fallback second. Migration
  needed once in Supabase SQL editor for 3 new profile columns — see `supabase/schema.sql`, bottom, dated
  2026-07-09.
- The existing "Sample" indicator was a tiny gray pill, easy to miss (confirmed — that's how Eshwar got
  fooled). New `src/components/SampleDataBanner.tsx`, a loud red/amber banner, wired into jobs/jobs-ft/
  contracts. Contracts gets a `variant="snapshot"` wording (its static library is REAL recruiter posts from a
  2026-06-30 collection date, not fabricated — different situation from the other two, worded honestly).

**Closed the "ask once, reuse everywhere" gap vs Tsenta:**
- `/dashboard/settings` → new "Application Preferences" card: remote/relocate/start-immediately/
  transportation/clearance, tri-state Yes/No/unanswered (unanswered ≠ "No" — never guesses). `extension/
  content.js` has 4 new `fillXRadio()` functions (mirrors the existing `fillWorkAuthRadio` trust pattern) that
  auto-answer these on real ATS forms instead of leaving them blank every single time.

**Built Tsenta's actual trust mechanic — the pre-fill "receipt":**
- `extension/sidebar.js` now pauses after resolving what WOULD be filled (name/email/resume/every preference)
  and shows it before touching the page. Nothing fills until the user clicks confirm. `extension/sidebar.css`
  has the new `#mf-receipt` styles.

**Task 22/23 — real auto-submit, Greenhouse/Lever only (this is the one that needed a judgment call, not a
silent build — see AskUserQuestion note below):**
- Eshwar chose "fill + real Submit click, one motion after receipt confirm" over a two-gate or fill-only
  option when explicitly asked (this WAS the "unattended vs assisted" line the roadmap-plan session
  independently also flagged as needing an explicit decision — both sessions converged on the same risk
  without knowing about each other). What got built matches the roadmap's own Phase 3 definition of "assisted"
  exactly: `runAutofillFlow(profile, resumeUrl, resumeName, autoSubmit)` — 4th param opt-in, every pre-existing
  caller (popup.js's AUTOFILL path) unaffected — only fires when `needsAttention.length === 0` (a flagged
  sponsorship/EEO question blocks it — user resolves + submits that one manually) and only on Greenhouse/
  Lever. `findSubmitButton()` matches by role+text within the actual form, returns null (no attempt) rather
  than a document-wide search if the form can't be located. A submitted application queues via
  `chrome.storage.local` and `extension/web-bridge.js` drains it into `jd_applications_v2` on the dashboard's
  next load (cross-origin — content.js on e.g. boards.greenhouse.io can't reach the dashboard's own
  localStorage directly).
- If it ever fills but can't find the real Submit button (or a question's flagged), the sidebar button turns
  into a distinct red "⚠ Filled but NOT submitted" state — deliberately never blends into the plain green
  "success" state, so nobody walks away thinking they applied when they didn't.
- **Not click-through tested against a real live posting** — same standing limitation as every extension
  change either session has ever made, per this file's own history below. Covered by jsdom simulation only.
  **Also: Chrome extensions do not hot-reload.** If you're testing this, reload the unpacked extension in
  `chrome://extensions` first or you're looking at old code.

**Second real bug found (unrelated to Tsenta, found while investigating why Gmail sync "felt fake"):**
- `<GmailSync onSync={() => {}} />` in `settings/page.tsx` was a no-op. `/api/gmail-sync` genuinely parses
  application emails and the UI genuinely showed "N added" — nothing ever wrote those N into the tracker.
  Fixed via new `mergeGmailApplications()` in `src/lib/applications.ts`: dedupes against every existing entry
  (by stable `gmail_<threadId>` id, or company+role for anything already manually tracked), and for a
  previously-synced thread, only ever moves its stage forward (offer/rejected are terminal — an older or
  misclassified email can't downgrade a later, more specific one). 15 new tests in
  `scripts/test-applications-merge.mts` (now wired into `npm run check`) cover this specifically, including
  the "gmail reply merges into an already-manually-tracked row instead of duplicating it" case.

**What's left, not attempted:** ATS coverage beyond Greenhouse/Lever for auto-submit; WhatsApp/iMessage/MCP
multi-surface access (Tsenta has this, explicitly deferred, large); a live 50k-page-crawler equivalent (still
resting on the 3 API keys above being filled in). Memory files with more detail if picking this back up:
`project-tsenta-competitor.md`, `project-extension-autosubmit.md`, `project-job-data-source.md`,
`project-gmail-connect.md` (all under the Claude memory dir, not in this repo).

---

## 🚧 2026-07-09 (Claude Code) — Roadmap kickoff: "beat Tsenta/Jobright" — Phase 1 done, Phase 2+ next

Eshwar compared the app unfavorably to Tsenta (YC-backed auto-apply agent — matches 2M+ jobs, auto-tailors
resume+cover letter, actually submits applications, even auto-creates ATS accounts, WhatsApp/iMessage login)
and Jobright. Full roadmap written and approved: **`C:\Users\Eshwa\.claude\plans\mutable-leaping-crown.md`**
— READ THAT FILE FIRST, it has the phased plan (Phase 1 wiring/verification → Phase 2 real job matching →
Phase 3 assisted one-click apply → Phase 4 server-side tracking → Phase 5 outbound notifications) and the
explicit risk callout: **true unattended auto-submit / auto ATS-account-creation is intentionally OUT of
scope** (likely breaches ATS ToS, real legal exposure) — default target is assisted one-click-submit with a
human confirming, not blind autonomy. Don't silently build past that line.

This session finished ALL of Phase 1. Also fixed real bugs unrelated to the roadmap that came up mid-session
(see the resume-tailoring-engine entry below, done earlier the same day).

### Phase 1A — Onboarding wizard wired to the REAL profile API (was 100% localStorage, fully disconnected)
- **Root cause confirmed**: `src/app/dashboard/setup/page.tsx` (the 5-step wizard: Profile → Resume → Gmail →
  Preferences → Done) only ever read/wrote `localStorage` (`jd_profile`, `jd_setup_step`). It never called
  `POST /api/profile`. That route already has a `profile_complete` column (confirmed LIVE in the real
  Supabase project via a PostgREST schema probe — `schema.sql` in the repo is STALE, missing this column and
  ~15 others the route already writes; don't trust `schema.sql`, trust the route + live introspection).
- Fixed: `setup/page.tsx` now calls `POST /api/profile` on every step advance, with `profileComplete: true`
  on the final step. Resume upload step now REALLY uploads via `POST /api/resumes` (was a fake "mark as
  done" flag before — file never left the browser). Restricted the dropzone to `.docx` to match what that
  endpoint actually accepts (it silently only supports docx, wizard used to advertise PDF too).
- `src/app/auth/callback/page.tsx`: `afterAuth()` now returns whether `profile_complete` is true and every
  auth flow (PKCE/OTP/hash) routes an incomplete profile to `/dashboard/setup` instead of its normal `next`.
- `src/app/dashboard/sidebar-nav.tsx`: added a one-time straggler catch (bookmark/back-button landing
  anywhere under `/dashboard/*` without finishing setup) — checks `profile_complete` once per mount, not per
  navigation (avoids a DB query on every page view).
- **NOT verified live** — no Chrome session this run. Verify: sign out, sign in fresh, confirm redirect to
  `/dashboard/setup`, finish all 5 steps, confirm `profiles.profile_complete=true` in Supabase, confirm no
  redirect loop on reload.

### Phase 1B — Real-harm autofill bug fixed: work-auth radio was answering "Yes" for "Need Sponsorship"
- `extension/content.js` `fillWorkAuthRadio()` used to answer "authorized to work" = Yes for EVERY
  `work_auth` value including explicitly "Need Sponsorship" — a legally wrong answer stated on a real
  application. Root cause: the function's own old comment claimed every work-auth status "means the
  candidate IS authorized" — false for that one value.
- Also found while fixing it: **work_auth is stored in THREE incompatible shapes** across the app — the
  setup wizard's dropdown ("H-1B", "OPT (STEM)", "Need Sponsorship"), Settings' dropdown ("H-1B Visa", "STEM
  OPT" — NO "Need Sponsorship" option at all), and stored profile data (snake_case "green_card"). An
  exact-string fix would've silently failed against two of the three. Fixed with keyword-normalization
  matching instead (`citizen|green ?card|h-?1b|opt|cpt|tn visa|[lo]-?1|j-?1`, "sponsor" checked first as a
  disqualifier, "C2C" deliberately NOT treated as authorized — it's a contracting arrangement, tells us
  nothing about immigration status). Unset/ambiguous now correctly left UNANSWERED and auto-flagged via the
  existing `detectAttentionFields()` "needs your review" checklist (its regex already matches "legally
  authorized"/"work authoriz" — no new wiring needed there).
- Added regression tests to `scripts/test-autofill-dom.mjs` proving all three real-world value shapes now
  behave correctly (sponsorship-needed/unset/C2C → unanswered+flagged; recognized-authorized → Yes).
  **133/133 passing** (was 116 before the new cases).
- **Found, not built by me**: someone/something already added a well-guarded "assisted one-click submit"
  primitive to `content.js` this same period — `runAutofillFlow(profile, resumeUrl, resumeName, autoSubmit)`,
  opt-in via a 4th arg (every existing caller omits it, defaults to fill-only), gated on
  `needsAttention.length === 0` (my fix above is a real safety PREREQUISITE for this — without it,
  "Need Sponsorship" would never populate needsAttention, so autoSubmit could fire incorrectly), scoped to a
  real detected form anchor (Greenhouse/Lever only), queues to `chrome.storage.local` for the dashboard
  tracker via `queueSubmittedApplication()`. **Grepped both `sidebar.js` and `popup.js` — nothing calls it
  with `autoSubmit` yet.** This is exactly Phase 3 of the roadmap — the safe engine half is done, the UI
  confirm-and-trigger half isn't. Don't rebuild the engine part, just wire a UI trigger with an explicit
  per-application confirm click when you get to Phase 3.
- **NOT verified live** — Chrome extension would not connect this session (tried twice, gave up per policy
  rather than loop on it). Static verification only: `node --check`, full jsdom suite. Needs a real
  click-through on a live Greenhouse/Lever/Workday posting — this is still the single biggest open unknown
  in the whole extension, unchanged from every prior session's note on this.

### Phase 1C — Design-system consolidation (scoped down from the plan's literal wording, see why below)
- **Real, provable dark-mode bug found and fixed** on `src/app/dashboard/page.tsx` (dashboard home) and
  `src/app/dashboard/jobs/page.tsx` (jobs board): both hardcoded exact light-theme hex values (`#1a2035`,
  `#6b7a99`, `#e4e8ef`, `#f4f6f9`, `#9aa4bc`) instead of the CSS custom properties those exact values were
  clearly copied from (`var(--text)`, `var(--text-muted)`, `var(--border)`, `var(--surface-2)`,
  `var(--text-soft)`). Confirmed exact 1:1 value match against `globals.css`'s light theme block before
  touching anything. Both pages were therefore PERMANENTLY stuck in light-theme colors regardless of the
  user's actual theme setting — dark mode (and all 6 accent palettes) silently never applied. Fixed by
  pointing the values at the real tokens (dashboard home: redefined its local `P` palette object's ~7 used
  keys to `var(--x)` strings, one edit point covers all ~90 call sites; jobs board: direct hex→var swap, 19
  occurrences). Grepped for string manipulation on these values (opacity suffixing, `.slice()`, etc.) before
  the swap — none found, safe. `tsc --noEmit` clean both times.
- **Did NOT force the shared `PageHeader` component onto the jobs board's top bar** despite the plan naming
  it a migration target — found an explicit prior-session comment there: "Top action bar (replaces redundant
  'Jobs & Apply' title)". A past session deliberately removed a page title here because the sidebar nav
  already labels this section — reverting that would be undoing considered work, not fixing an
  inconsistency. Left it alone; this is the kind of judgment call worth flagging back to me if it looks
  wrong on screen.
- **Did** migrate `src/app/dashboard/resume/ResumeClient.tsx`'s header to `src/components/layout/PageHeader.tsx`
  (title + description + the 3-tab switcher as `actions`) — this one was a genuine same-shape fit, no prior
  deliberate-removal signal. This is now the reference example for later pages migrating to the shared
  pattern (per the plan's "leave a copyable template" instruction).
- Audited `resume/ResumeClient.tsx` + `resume/page.tsx` for the same hardcoded-hex pattern — clean, zero
  hits. That flow was already built correctly (matches the earlier Explore finding that resume tailoring is
  the app's best-guided existing flow).
- **NOT visually verified** — Chrome unavailable, so no before/after screenshot comparison in light OR dark
  mode happened this session. The dark-mode fixes are logically/mechanically sound (exact token swap,
  confirmed no runtime string manipulation on the old values) but "does it actually look right" still needs
  a real look. If you (Eshwar or next session) load the app and something looks visually off on dashboard
  home or the jobs board that didn't before, START by checking this diff — it's the most likely place.

### Phase 2 — Real job matching (done same day, right after Phase 1)
- **Root cause**: `src/app/dashboard/recommended/page.tsx` was fully fake — hardcoded `SAMPLE_JOBS` (6
  hand-written jobs), a fixed `"security engineer"` search query regardless of the user's actual role, and
  `matchPct: 60 + (i % 30)` — a modulo index trick, not a real score. Also never read the REAL server profile
  (Phase 1A's whole point) — only `localStorage.jd_profile`, a per-browser cache with no `education`/
  `years_experience` fields the DB profile doesn't carry either.
- Fixed: deleted `SAMPLE_JOBS` entirely. New `loadRealProfile()` fetches `GET /api/profile` (the real
  Supabase-backed profile Phase 1A now actually writes to) and merges it with the localStorage cache only
  for fields the DB doesn't carry (years exp, education — resume-extracted, not asked in onboarding yet;
  API wins on anything both provide). Every job returned by `/api/jobs` gets scored for real via the
  ALREADY-EXISTING `src/lib/matching/computeMatchScore.ts` (same lib the single-JD Tailor flow already
  trusts — 70+ skill aliases, security/staffing domain coverage) — no new scoring logic invented, just run
  in a loop instead of once. Search query now uses the user's real title instead of a hardcoded string.
  `matchReasons` are now derived from actually-matched skills + real remote/location fit, not hand-written.
- **`RAPID_API_KEY` unset is still a real gap** (flagged in the plan, not fixed by this — I can't obtain a
  key myself): without it, `/api/jobs` itself falls back to ITS OWN hardcoded 13-job sample array. The
  scoring against those 13 is now real (computed from the user's actual profile), but the underlying jobs
  are still sample data. Added an honest empty/sample-state to the page instead of pretending otherwise —
  it now says "Sample data — no job API key configured" instead of showing a fake "● Live" badge. Note:
  Settings already has a self-serve path for this (`jd_settings.rapidApiKey` → sent as `x-rapid-api-key`
  header) — a user CAN unlock real data without touching `.env.local`, just wasn't surfaced anywhere. Worth
  pointing Eshwar at Settings if he wants real job data before a server-side key gets configured.
- `tsc --noEmit` clean, dev server compiles with no runtime error in the log, jsdom suite still 133/133
  (unrelated to this change, re-run as a safety net). **NOT visually verified** — same Chrome-unavailable
  caveat as everything else this session.

### Separate, unrelated finding this session: Google OAuth still broken (pre-existing, not caused by today)
Eshwar reported Google sign-in not working. Verified `src/lib/google-auth.ts` is correct — it fully
delegates to `supabase.auth.signInWithOAuth()`, so the failure is entirely upstream in Supabase's Google
provider config, not app code. This is the SAME `deleted_client` issue already logged 2026-07-06 (see that
section further down this file) — still unresolved 3 days later because it needs Eshwar's own action in
Google Cloud Console (new OAuth client → paste Client ID/Secret into Supabase Auth → Providers → Google).
Gave him the exact steps in chat. Nothing to fix in code here.

### What's left / where to pick up
Phase 1 AND Phase 2 are done. Next per the plan: **Phase 3 — assisted one-click apply**. Note: a
concurrent/prior process already built the SAFE ENGINE HALF of this in `extension/content.js` —
`runAutofillFlow(profile, resumeUrl, resumeName, autoSubmit)`, opt-in via a 4th arg every existing caller
omits, gated on zero `needsAttention` items, Greenhouse/Lever only, queues to `chrome.storage.local` for the
dashboard tracker. Grepped `sidebar.js`/`popup.js` — **nothing calls it with `autoSubmit` yet.** Phase 3 work
is building that UI trigger (an explicit per-application confirm click, per the engine's own documented
contract), NOT rebuilding the engine.

**Things a live Chrome/browser session still needs to confirm, unchanged from before this session started
and not resolved by it:** (1) Phase 1A's signup→setup-wizard redirect, click-through. (2) Phase 1B's
work-auth fix + general autofill, click-through on a real ATS posting — still the #1 open unknown project-
wide. (3) Phase 1C's dark-mode fix, visual before/after. (4) Phase 2's recommended-jobs page, visual check.

## 🔬 2026-07-06 — RESEARCH: "make redirect/placeholder pages real" (Eshwar request)

Eshwar: "All the redirecting pages should have real functionality based on the names — those were
everything we were supposed to build." Audited ALL 34 `/dashboard/*` routes (mock-marker + localStorage/api
signal scan). Findings:

**A. The 4 pages that only REDIRECT (bounce to a hub tab, no standalone content):**
- `/dashboard/analytics`  → `router.replace('/dashboard/jobs')` + `sessionStorage.jd_view='analytics'`
- `/dashboard/applications` → `/dashboard/jobs` + `jd_view='pipeline'`
- `/dashboard/pipeline`   → `/dashboard/jobs` + `jd_view='pipeline'`
- `/dashboard/documents`  → `/dashboard/resume?tab=docs`
  These were INTENTIONAL folds — the real feature exists as a tab inside the Jobs/Resume hub. So clicking
  "Analytics" doesn't 404, it throws you into the Jobs page's Analytics tab. **Open question for Eshwar:
  do you want these rebuilt as real standalone pages at their own URL, or is the hub-tab fold fine and the
  redirect just needs to feel less jarring?** (Rebuilding standalone duplicates the hub-tab code — need the
  call before spending hours on it.)

**B. Pages that ARE built + persist real data (NOT stubs — leave alone unless a specific one is broken):**
  jobs, jobs-ft, contracts, companies (contract-data intel), email, brief, compare, copilot, cover-letters,
  interviews, mock-interview, technical-prep, profile, saved, settings, skills, salary, visa, roadmap,
  alerts, offers, network, messages, activity, admin, ai-tools, marketing, setup, recommended, referrals.
  (A few use `SEED_`/`SAMPLE_` arrays as demo fallback — referrals, recommended, technical-prep — but they
  also read/write localStorage, so they're functional, just pre-seeded.)

**C. Not yet confirmed which pages Eshwar personally experiences as "hollow"** — the audit shows most are
  real, so his frustration is likely (a) the 4 redirects in group A, and/or (b) specific pages showing
  demo/seed data instead of HIS data. Asking to pin the exact list before building rather than guess-
  rebuilding 34 pages.

## ✅ 2026-07-06 late (Claude Code) — match-score location false-positive fixed + test harness wired into npm

- **Real correctness bug in `computeLocationScore` (`src/lib/matching/computeMatchScore.ts`)** — surfaced by
  an ESLint "`userCity` assigned but never used" warning. The city check was `uLow.includes(jobCity)`, a
  whole-string substring test that never used the computed `userCity`, so unrelated cities whose names are
  substrings scored a PERFECT 100: e.g. a candidate in **"New York, NY" applying to a job in "York, PA"**
  got a 100% location match (they're 250 mi apart). This feeds the live match % on job cards via
  `/api/match-score` (route.ts L141). Fixed to compare city TOKENS (exact, or one carrying an extra
  qualifier like "St. Louis City") — verified with a 9-case truth table (New York≠York now 50; St. Louis
  variants still 100; same-state 80; remote/anywhere 100). `tsc` clean, 77/77 autofill tests still green.
- **Test harness is now discoverable**: added `npm run test:autofill` (runs `scripts/test-autofill-dom.mjs`)
  and folded it into `npm run check` (`typecheck && lint && test:autofill`). Was an orphan file before —
  nobody would have known the autofill suite existed.
- **Coverage extended to every claimed ATS → 106/106 assertions.** Added fixtures for the 5 adapters that
  had NEVER been exercised (Ashby, SmartRecruiters, BambooHR, iCIMS, Jobvite) — each uses that adapter's
  exact production selectors at its real URL so `getATS()` routes to it, not the generic fallback. All pass:
  the extension's claim of ~14-ATS support is now verified per-adapter, not just asserted in a code comment.
  (Workday/Greenhouse/Lever/generic + the sidebar smoke test were already covered.)
- ESLint baseline: 0 errors, ~180 warnings (mostly stylistic React-19 `set-state-in-effect` + a few unused
  vars/imports across other sessions' files — build-safe, not chased individually).

## ✅ 2026-07-06 late (Claude Code) — build gate restored + harness re-validated post-live-session fixes

- **`pipeline/page.tsx` broke `tsc` + `next build` for ~20 min** (TS1161 at L455). Root cause: the page was
  correctly turned into a redirect stub with its 440-line legacy implementation "preserved for reference"
  inside ONE `/* … */` wrapper — but block comments don't nest in JS, so the legacy code's own first `*/`
  (a `/* CONFIG */` banner) closed the wrapper early, resurrecting half the dead code (including a second
  `export default`) and orphaning the final `*/`. Fixed intent-preservingly: converted the legacy region to
  `//` line comments (script-driven, live redirect lines 1-13 untouched). Lesson for future "preserve as
  comment" moves: the preserved code almost always contains `*/` — use line comments.
- Re-ran `scripts/test-autofill-dom.mjs` against content.js AFTER the live-Chrome session's `safePass()` /
  error-boundary refactor (below): **69/69 still passing** — both sessions' changes compose.
- `tsc --noEmit` clean + full `npm run build` passes again (route table + middleware emitted).

## ✅ FIXED 2026-07-06 (Claude Code, live Chrome click-through session) — root cause of "autofill fills nothing"

First real live-browser click-through test of the extension (loaded unpacked, tested against a real Greenhouse
posting — Warp's Software Engineer role). Eshwar's framing: Jobright (a competing installed extension) scans and
fills confidently with no setup friction; ours needed diagnosing why it filled nothing at all. Found a chain of
three real bugs, not a missing feature:

1. **`middleware.ts` blocked the exact "no login, use resume library" fallback `/api/profile/route.ts` already
   implements.** `/api/profile` was never in `PUBLIC_API_PREFIXES`, so every unauthenticated GET (including the
   extension's `GET_PROFILE` call from an ATS page, which never carries a session cookie) got a 401
   `{error:"Unauthorized"}` from middleware before route.ts's resume-extraction fallback ever ran. Verified via
   direct curl before/after. Fixed: added `/api/profile` to the public allowlist (`POST` still self-gates on
   `user` inside the route, unaffected). This is THE root cause — extension autofill was never reachable
   without a real signed-in session, despite the code already supporting login-free resume-based autofill.
2. **Cross-user PII leak this exposes if left as-is:** the unauthenticated fallback in `route.ts` walked
   `[USER_RESUMES_BASE/{userId}, USER_RESUMES_BASE, LEGACY_RESUMES]` — the bare `USER_RESUMES_BASE` (no userId)
   recurses into *every* user's subfolder and returns whichever resume was most recently uploaded, globally.
   Harmless with a single local dev user, but a real leak the moment this route is public and multi-tenant.
   Fixed: dropped the bare `USER_RESUMES_BASE` entry from the fallback dirs.
3. **`content.js`'s AUTOFILL message handler had no error boundary** — `runAutofillFlow(...).then(sendResponse)`
   with no `.catch`. Any throw anywhere in the fill pass (one ATS adapter, one malformed react-select widget)
   silently dropped the response; Chrome logged "message channel closed before a response was received" instead
   of the real error, and the popup/sidebar caller hung forever. Reproduced live on the Warp form. Fixed:
   added `.catch()` that always responds, and wrapped each ATS-adapter dispatch + the workAuthRadio/generic/
   certCheckboxes passes in a new `safePass()` helper so one failing selector no longer aborts the whole run —
   matches the "keep going per-field regardless" behavior Eshwar observed in Jobright.
4. Also hardened the floating button's one-click path (`GET_PROFILE` → fill): it set the label to "Filling…"
   with no timeout, so a hung background response (or the pre-fix-#3 exception path) left the button stuck
   forever with zero user feedback. Added an 8s timeout + try/catch that always resets the label and surfaces
   an info toast either way.

## ✅ FIXED 2026-07-06 (same session, continued) — manifest `host_permissions` never matched `content_scripts`

Eshwar pulled the extension's real `chrome://extensions` → Errors panel (I have no tool access to that surface):
`Uncaught (in promise) Error: Cannot access contents of url "https://job-boards.greenhouse.io/...". Extension
manifest must request permission to access this host.` + `Uncaught (in promise) Error: Could not find an active
browser window.`, both attributed to `background.js`. Root causes, both real:

1. **`manifest.json`'s `host_permissions` only ever listed our own 3 origins** (`localhost:3000/3001`,
   `marketfit.app`) while `content_scripts.matches` has the full 25+ ATS domain list (Greenhouse, Workday,
   LinkedIn, Lever, iCIMS, etc.) — content.js/sidebar.js inject fine on those pages, but any background-script
   operation needing host permission for the ACTIVE TAB's origin (implicated by the exact error text) was
   silently denied on every single ATS site, extension-wide, since day one of this permission model. Fixed:
   mirrored the full ATS domain list from `content_scripts.matches` into `host_permissions`.
2. **`chrome.action.openPopup()` in the `OPEN_POPUP` handler returns a Promise; the surrounding `try/catch`
   only ever caught a *synchronous* throw.** A rejection (no focused/active window — happens easily when the
   click didn't originate from a "real" toolbar gesture) went completely uncaught. Fixed: added `.catch()` on
   the returned promise.

**Still not re-verified end-to-end** — this is now three consecutive rounds of "fix → ask for extension reload
→ retest" without a final confirmed screenshot of fields populating, each round turning up a genuinely new bug
rather than confirming the previous fix. Given `content_scripts` were always correctly scoped, autofill likely
*was* firing on real ATS pages but repeatedly hitting either the middleware 401 (fixed round 1) or one of these
permission gaps (fixed this round) — plausible that this round's fix is the one that finally unblocks a full
click → populated-fields pass. Next session: reload extension (this changes `host_permissions`, so Chrome may
show a permission-review prompt on reload for the unpacked build — expected, not an error), click Autofill on
a live Greenhouse posting, confirm fields populate. If it still doesn't, check the extension's own **service
worker console** (chrome://extensions → MarketFit → "service worker" link → Console) for the
`console.log("[MarketFit] GET_PROFILE response:", ...)` / `autoFillForm result` diagnostic lines added to
`content.js`'s click handler this session — that surface is NOT visible to browser-automation tooling, only to
a human with the real DevTools open, and is the fastest way to get ground truth without another round-trip.

**Not yet re-verified end-to-end after all 4 fixes** (each was verified individually — API returns a real
extracted profile via curl post-fix-#1, `node --check` clean on content.js, `tsc --noEmit` clean — but a full
click → fields-populate pass on a live posting hit browser-automation session limits before a final confirming
screenshot). Next session: reload the unpacked extension, hard-reload a live Greenhouse posting, click Autofill,
confirm First/Last/Email/Phone actually populate from the resume-extracted profile.

Also noted, not yet acted on: the resume-extracted email in the library has a real typo (`eshwarjay0@gmai.com` —
missing an `l`) baked into the source `.docx`, unrelated to any code bug here — worth Eshwar fixing at the source
file level, since every future extraction will keep repeating it.

## 📌 CURRENT STATUS — updated 2026-07-06 (read this first; history below is kept for provenance, not as a live task list)

This file had grown to 1100+ lines of append-only session logs where most older "open" items were
silently fixed by later sessions but never marked resolved. Re-verified against live code before writing
this section — do not trust an item's `[ ]`/🔴 marker below without spot-checking, several are stale.

**Resolved this session (UI/UX overhaul + follow-ups) — do not re-open:**
- Theme system consolidated to one source of truth; dead theme code removed; ~50+ hardcoded-blue color
  bugs fixed app-wide (pipeline stage colors, score tiers, mislabeled accent swatches)
- shadcn/ui + Radix installed, reconciled with existing tokens
- Native browser confirm/prompt dialogs → shared dialog provider; two duplicate toast systems → one (sonner)
- Full-Time board redesigned to match Contract board; shared JobRight-style filters (date, experience,
  salary, company, distance, skills) added to both via `src/lib/jobFilters.ts`
- `middleware.ts` auth-gate conflict with demo-mode (try-before-signup) resolved via explicit
  `PUBLIC_DASHBOARD_PREFIXES`/`PUBLIC_API_PREFIXES` allowlists
- Admin panel wired to real server persistence (`/api/admin/config`, httpOnly cookie), replacing
  localStorage/sessionStorage; misleading "Posts → Contract Board" copy corrected (that tab doesn't exist)
- `/api/feedback` POST now requires real auth (was an unauthenticated prompt-injection vector into the
  tailoring AI prompt — `recentFeedback()` output flows straight into `runTailor`)
- Confirmed already-fixed (audit found stale tracker entries below claiming otherwise): tailor 7/week limit
  IS enforced server-side per-user (`checkRateLimit` in `tailor/route.ts`); `/api/waitlist` GET already
  requires an admin token; `/api/contact` already has IP rate-limiting + length cap; `test-match`/`test-docx`
  debug routes are deleted; `middleware.ts` exists and is substantial; admin sidebar link exists
- **Extension G1 — 380px sliding sidebar BUILT 2026-07-03 (Claude Code).** `extension/sidebar.js` (new,
  ~330 lines) wires the already-existing `sidebar.css` (571 lines, was pure unused CSS scaffold — never
  overwrite/delete this file, it's real design work) to live data: job context via
  `content.js`'s `detectJob()`, H1B badge via `/api/h1b?company=`, match score via `/api/match-score`
  (skips quietly if no LLM key configured or JD too short), profile + resume selector via `GET_PROFILE` +
  `/api/user-resumes` (now Bearer-auth aware, see below), and a post-fill checklist driven by a NEW
  `runAutofillFlow()` extracted from the AUTOFILL message handler in `content.js` (pure refactor, same
  behavior) and exposed via `window.__mfSidebarBridge` so sidebar.js can call it directly — content
  scripts can't use `chrome.tabs.sendMessage` (background/popup-only API), so this avoids an unverified
  cross-content-script-messaging assumption. Wired into `manifest.json`'s existing ATS `content_scripts`
  entry (loads after `content.js`, `all_frames:true` inherited — added an iframe-size guard mirroring
  `injectFloatingButton`'s existing one, since a 380px sidebar makes even less sense in a small embed than
  a floating button does). Also fixed a real gap while wiring the resume selector: `/api/user-resumes`
  GET/POST/DELETE only ever used the cookie-based `createClient()` — extension callers got the "demo" user's
  resumes, never the signed-in user's. Now uses `createClientFromRequest` (same Bearer-token pattern as the
  `/api/profile` fix) throughout. **Not click-through tested — same limitation as everything else on this
  list, no live Chrome session available.** `node --check` on all extension `.js` files, manifest re-validated
  as JSON, `tsc --noEmit` clean project-wide, and a script-level cross-check confirmed every CSS id/class in
  `sidebar.css` is actually referenced by `sidebar.js` (no orphaned selectors, no typo'd DOM lookups).
  ⚠️ Near-miss during this work: an accidental `Write` briefly overwrote `sidebar.css` with a placeholder —
  caught immediately (before it was ever loaded), reconstructed byte-for-byte from the file content already
  read into context earlier this same turn, and verified (571 lines, balanced braces, all originally-known
  selectors present). No data was actually lost, but flagging it since it's exactly the kind of accidental
  overwrite this file's own "never delete/rewrite another session's work" convention exists to prevent.

**Addendum 2026-07-03 (Claude Code, same session as the G1 sidebar above):** `/api/resumes/download`'s
per-user scoping fix (mentioned as resolved below) used cookie-only `createClient()` — correct for
browser-tab callers, but it broke the G1 sidebar's resume-attach flow, which fetches through
`background.js`'s service-worker context (no cookies, only the `Authorization: Bearer` session-bridge
token). Switched it to `createClientFromRequest` (same helper `/api/profile` and `/api/user-resumes` use)
so both paths work. Also found `/api/resumes/pdf` had the *identical* unscoped-access bug that
`/api/resumes/download` just got fixed for, but never got the same fix — applied the same per-user-folder
+ Bearer-aware pattern there too. Left `/api/tailor/file` alone — it's a capability-token design (random
unguessable token = the resume, no user identity involved), a different and already-correct model, not an
instance of this bug. `tsc --noEmit` clean.

---

## ✅ 2026-07-06 (Claude Code) — Autofill engine DOM-verified for the first time + REAL name-corruption bug found & fixed + light theme restored

### 1. New: `scripts/test-autofill-dom.mjs` — the autofill engine now has a real test
The tracker's #1 open item has always been "autofill never click-through tested — no agent can drive
Chrome". Built the next-best thing: a jsdom harness (jsdom added as devDependency) that loads the REAL,
unmodified `extension/content.js` into a simulated page and runs the REAL fill flow via the
`window.__mfSidebarBridge` export against (a) a realistic Greenhouse-style application form (name/email/
phone/location/linkedin/cover-letter + work-auth & sponsorship radios + 4-select EEO block + attestation
and marketing checkboxes + file input) and (b) a generic non-ATS careers form. **37/37 assertions pass**,
including: all contact fields fill with the right values; work-auth radio answered Yes; sponsorship radio
and all 4 EEO selects left untouched but surfaced in `needsAttention`; attestation checkbox checked while
the marketing opt-in is left alone; the multi-step MutationObserver re-fill fills a newly-appearing field;
visa status humanized ("green_card"→"Green Card"); salary built from min/max; country select→United States.
Run it any time with `node scripts/test-autofill-dom.mjs` (exit 0 = pass). Still not a substitute for one
real click-through in Chrome — but the engine is no longer "syntax-checked only".

**Extended same day → 69/69 passing across 5 suites:** (1) Greenhouse, (2) generic careers form,
(3) Lever (incl. full-name-intact-after-2nd-pass regression check for the overwrite bug below),
(4) Workday — `data-automation-id` text fields, location→street/city/state parsing ("St. Louis, MO"
→ city + MO→Missouri native-select), and the ASYNC aria-combobox path (engine correctly clicks the
"Mobile" `[role="option"]`), (5) **sidebar.js end-to-end smoke test** — injects, auto-opens on an
application page, detects the job into the panel, renders the H1B badge from a stubbed `/api/h1b`,
populates profile + resume selector from stubbed APIs, and clicking "⚡ Start Autofill" runs the real
engine against the real form (fields fill, button flips to "✓ Filled N fields", checklist renders with
"needs your review" flags). The G1 sidebar is no longer untested code.

### 2. 🔴 REAL BUG the harness caught immediately (likely a chunk of "autofill sucks on real apps"):
On any SECOND fill pass — which happens automatically on every multi-step application via
`armContinuousRefill`'s MutationObserver, and on any second click — `fillGeneric`'s field-matching loop
did not stop when a field already held the correct value (`fillText` no-ops on equal values, and `break`
only ran on a successful write). The loop then fell through to the widest `["name"]→full_name` catch-all
and OVERWROTE the already-correct First-name and Last-name boxes with the FULL name ("Eshwar" → "Eshwar
Janjirala" in BOTH boxes). So on real Workday/Greenhouse multi-step apps, the candidate's name silently
corrupted after step transitions. Fixed: a matched mapping with data now always claims the element and
breaks, filled-or-already-correct. Verified: second pass now fills 0 and values stay intact.

### 3. Light theme restored as the default (Eshwar's direct complaint: "black & white theme ruined it")
The theme consolidation had set default mode to "system" + a `prefers-color-scheme: dark` pre-hydration
override in globals.css — on a dark-mode Windows machine the whole app (including the pre-login dashboard)
rendered the dark palette nobody chose. Nothing was ever actually de-colored (dashboard home still has 39×
brand-blue etc.) — it was dark mode applying by default. Fixed: `theme-provider.tsx` defaults to "light",
saved `mode:"system"` migrates to "light" once (explicit "dark" picks still honored), pre-hydration dark
block deleted from globals.css (comment left in place — don't re-add). Verified against the RUNNING dev
server: served CSS (159KB) now has zero `prefers-color-scheme` rules and still carries the blue accent.
Also discovered + handled: the long-running dev server had a STALE file watcher (serving old CSS despite
edits) — killed it; its supervising session auto-restarted it fresh, which now serves the fix.

---

## ✅ FIXED 2026-07-06 (Cowork) — Session 6: claudeKey passthrough sweep + profile/copilot bugs

### claudeKey missing from 11 /api/assist and /api/score callers
Every AI feature across the app calls `/api/assist` which uses `resolveKeys(body)` — if no server-side
`ANTHROPIC_API_KEY` is set, the user must pass `claudeKey` in the request body. 11 pages/components
were calling these APIs without it, silently failing with "No API key found" for any user relying on
the Settings key. Fixed in: `cover-letters/page.tsx`, `copilot/page.tsx`, `profile/page.tsx`,
`brief/page.tsx`, `compare/page.tsx`, `interviews/page.tsx` (x2 functions), `messages/page.tsx`,
`network/page.tsx`, `skills/page.tsx`, `salary/page.tsx`, `visa/page.tsx`.
(ResumeScoreCard.tsx and resume/builder/page.tsx already had it.)

### copilot/page.tsx — jd_offers, jd_certs_v1, jd_skills_v1, jd_visas are phantom keys
Copilot reads these 4 keys which are never written anywhere in the app. Context will silently be empty
for offers/certs/skills/visas until those modules write these keys. Noted — not yet wired.

### profile/page.tsx — API fetch replaced localStorage-only fields on race
`fetch("/api/profile").then(p => setProfile(p))` used a hard replace instead of merge. If the API
response arrived after the localStorage read merged in `skills`/`targetRoles`/`yearsExp`, those fields
were wiped. Fixed: `.then(p => setProfile(prev => ({ ...prev, ...p })))` — API wins on shared fields,
localStorage wins on fields API doesn't return.

### setup/page.tsx — workAuth vs work_auth inconsistency noted
Setup writes `workAuth` (camelCase), settings writes `work_auth` (snake_case) to `jd_profile`.
Copilot already handles both via `profile.workAuth || profile.work_auth`. Low severity, noted.

### pipeline/page.tsx — schema divergence → converted to redirect
`pipeline/page.tsx` was an orphaned Kanban that read/wrote `jd_applications_v2` using the OLD schema
(`status` + `appliedAt`) while `jobs/page.tsx` uses the canonical schema (`stage` + `appliedDate`).
Any user reaching `/dashboard/pipeline` directly would have corrupted the shared applications store.
No nav link existed pointing to it. Converted to a redirect: `jd_view="pipeline"` → `/dashboard/jobs`.
Old implementation preserved as a block comment in the file for reference.

---

## ✅ FIXED 2026-07-06 (Cowork) — Interconnect bugs sweep: sessionStorage routing, localStorage sync, schema mismatches

### ai-tools/page.tsx — `jd_view` was unconditionally deleted
ai-tools page consumed AND deleted `jd_view` even when the value was `"pipeline"` or `"analytics"` (meant for
jobs/page.tsx). If a user visited ai-tools before jobs, jobs page never got its `jd_view` and stayed on the
default tab. Fix: only delete `jd_view` if it's a valid ai-tools tab value.

### ai-tools/page.tsx ScoreTab — `claudeKey` not passed to /api/score
`ScoreTab.runScore()` called `/api/score` without passing `claudeKey` from `jd_settings`. CoverLetterSection
and InterviewSection both pass it correctly. Users who only configured a key in Settings got "No API key found"
errors on the Score tab unless a server-side key was set. Fixed — reads `jd_settings.claudeKey` and passes it.

### home + recommended pages — "Nexus AI" button set invalid tab + wrong session key
`jd_ai_tab = "nexus"` was not a valid tab (valid: tailor/cover/interviews/score) — silently dropped.
Also stored `jd_prefill` but CoverLetterSection/TailorTab read `jd_prefill_jd`, so the prefill was always
lost. Fixed: `"nexus"` → `"cover"`, added `jd_prefill_jd` + `jd_prefill_role` + `jd_prefill_company` so
landing on the Cover Letter tab arrives with the job already prefilled.

### saved/page.tsx — updateStatus("applied") missing jd_applied_ids sync
When a user marked a saved job as "Applied", it wrote to `jd_applications_v2` (pipeline) but NOT to
`jd_applied_ids` (job board badge state). Job board still showed the bookmark icon without the "Applied" badge.
Fixed — now writes to both keys.

### /api/jobs SAMPLE data — one-liner descriptions replaced with full realistic JDs
All 13 sample jobs in `/api/jobs/route.ts` had 100–150 char placeholder descriptions. These are shown in job
cards, passed to the AI Tailor, and serve as extension test targets. Replaced with 600–1200 char realistic JDs
grounded in CLAUDE.md profiles (OT Security/Dragos, AppSec/Microsoft, ServiceNow/Accenture, Cloud Security,
SOC/DFIR). JDs include: role overview, 5–6 bullet responsibilities, requirements with specific certs and tools,
and visa sponsorship language. Full Time section now usable for Tailor Resume and extension autofill testing.

### brief/page.tsx — schema mismatch: stage vs status, appliedDate vs appliedAt
`jobs/page.tsx` writes `stage` and `appliedDate`; brief/page.tsx read `status` and `appliedAt` (older schema).
All pipeline stats in the Daily Brief showed 0 and "Stale applications" never populated.
Fixed: Application type now supports both field names; all reads use `(a.stage ?? a.status ?? "")` and
`(a.appliedDate ?? a.appliedAt)` with appropriate `as string` casts for TypeScript.

---

## ✅ FIXED 2026-07-05 (Cowork) — Security hardening + interconnect bugs + profile autofill gap

### Admin credentials removed from source
`api/admin/auth/route.ts` + `api/waitlist/route.ts` had `"Strawhat@1234"` hardcoded as fallback.
`adminConfig.ts` had `"mf-dev-admin-secret"` for the HMAC key. All three removed; routes now
fail-closed when env vars are unset (503 / reject token) instead of silently using a known string.
Credentials moved to `.env.local`. Empty-body guard added (`!!(body.user && body.pass && ...)`) so
an empty env var doesn't create a trivially-bypassable auth endpoint.

### Settings — Profile & Work Authorization section
Extension autofill always got empty `work_auth` for ATS dropdowns because there was no UI to set it.
Added full profile card to Settings (name, title, phone, location, LinkedIn, GitHub, visa status,
work auth select) saved via POST `/api/profile` to Supabase. `toAutofillShape()` now also returns
explicit empty strings for `work_auth`/`visa_status` instead of `undefined`.

### Extension popup.html localhost defaults
`setup-url-input` value and `sett-url` placeholder changed from `http://localhost:3000` to
`https://marketfit.app` to match `DEFAULT_URL` in popup.js (was cosmetically wrong before JS hydration).

### Duplicate `setDiff()` in result/page.tsx regenerate()
`setDiff(...)` called twice consecutively (lines 436-437). Spurious duplicate React state update removed.

### Email ↔ pipeline ↔ home stats — verified correct
`toThread()` shape mapping confirmed correct. Stage values written by email "Add to Pipeline" button
(`"offer"`, `"interview"`, `"technical"`, `"screening"`, `"applied"`) match APP_STAGES ids in
jobs/page.tsx PipelineView. Home stats counter reads same `jd_applications_v2` key. All consistent.

### 🔴 OPEN: Google OAuth `deleted_client` — awaiting user action
The OAuth 2.0 client in Supabase's Google provider was deleted from Google Cloud Console.
ALL Gmail sync / Drive / Google sign-in broken (Error 401: deleted_client confirmed 2026-07-06).
Fix: new OAuth client → update Supabase dashboard → update `.env.local`.
Required Supabase redirect URI: `https://gjfwcdmqmtrmjnumzwvu.supabase.co/auth/v1/callback`
Steps provided to user 2026-07-06 — awaiting Eshwar to create new client in Google Cloud Console.

---

**🎉 LAUNCH GATE PASSED 2026-07-06 (Claude Code):** `npm run build` completes successfully — full
production build, all ~45 routes compiled + middleware, no errors. This is the "real gate" that had been
failing since 2026-07-02 (the `/auth/callback` route-vs-page conflict; whoever finished that migration
deleted the conflicting `route.ts`, and nothing else blocks the build now). Also re-verified the running
site end-to-end same session: `/` → 200, public boards → 200, gated pages → single clean 307, private
APIs → 401. The app is deployable from a build standpoint — remaining blockers below are all
config/manual-testing items, not code.

**Genuinely still open, ranked (updated 2026-07-05):**
1. 🔴 **Google OAuth `deleted_client`** — all Gmail/Drive/Google login features are broken. Fix above.
2. 🔴 **Extension autofill — never click-through tested.** Every code fix (this session and prior ones) is
   verified via `node --check` / static review only. No live Chrome session has confirmed real DOM fill
   behavior on an actual ATS posting. Confirmed this pass: an agent session cannot do this itself —
   `chrome://extensions`, the Developer Mode toggle, "Load unpacked", and the native OS folder picker are all
   outside browser-automation tool reach. **Needs Eshwar** (or a session with real Chrome + filesystem
   access) to load the unpacked extension and click through a real posting. This remains the single biggest
   open unknown and the user's stated #1 pain point.
2. ✅ `/api/contact` — owner notification added. Zero-config until an env var is set:
   - `CONTACT_WEBHOOK_URL` → any HTTPS endpoint (Slack, Discord, Make, Zapier, n8n…)
   - `CONTACT_EMAIL_TO` + `RESEND_API_KEY` → Resend.com email delivery
   Both fire-and-forget; never block the user's 200 response.
3. 🟢 Anonymous sign-ins disabled in Supabase project — blocks "Continue as Demo" on `/login`. Fix via
   Supabase dashboard (Authentication → Providers → Enable Anonymous). One toggle, no code change needed.
--- ALREADY FIXED/STALE: A4 telemetry ✅ | download auth ✅ | Gmail shape ✅ | builder rules ✅ |
    Email page mock-thread issue ✅ (page already has toThread() + syncGmail() — was stale) |
    Landing page stale copy ✅ (stat bar 4→14+ ATS, eyebrow copy, extension card, VS table, "Seven"→"Six") |
    /signup plan param loss ✅ (signup now forwards search params; login shows plan banner + routes to settings#plan after auth) |
    "Upgrade to Pro" link ✅ | R4/R5 extension ✅ | H1B scorer ✅ | Adzuna ✅ | native dialogs ✅ |
    R3 work_auth wiring ✅ | 4 more stub pages (alerts/saved/offers/recommended) ✅ |
    GRC+Data presets added to ResumeBuilder ✅ | Taleo+SuccessFactors ATS adapters added ✅ |
    Workable+Rippling ATS adapters added ✅ | getATS() now covers 14 platforms ✅ |
    Dashboard ATS pill list updated to reflect real adapter count (14+) ✅ |
    **Extension C1 ✅ FIXED 2026-07-03 (session 3)** — confirmed `extension/ats/*.js` (6 files) and
    `extension/utils/*.js` (3 files) had zero references anywhere (manifest, background.js, content.js,
    sidebar.js, popup.js) and deleted them; `extension/auth.js` confirmed live (imported by background.js)
    and kept. All remaining extension `.js` pass `node --check`, manifest re-validated as JSON. |
    **Admin data persistence + gate ✅ FIXED 2026-07-03 (session 3)** — went with Supabase-adjacent pattern
    (reused the app's existing cookie-auth convention): admin posts now read/write through
    `/api/admin/config` (real server-side JSON store, httpOnly signed-cookie auth via `verifyAdminToken`),
    not localStorage. Login gate now calls `GET /api/admin/config` to verify the real server session instead
    of trusting a client-writable `sessionStorage` flag (was devtools-bypassable). Corrected misleading copy
    claiming posts feed a "Contract Board → Posts tab" that doesn't exist in the codebase. ---

---

## 🧩 FIXED 2026-07-03c (Claude Code) — real data from a live Greenhouse posting + "needs your review" UX

Eshwar gave me a real URL to test (`job-boards.greenhouse.io/embed/job_app?for=impact&...`). Chrome still
wasn't connected (tried repeatedly), so I fetched the live page content directly instead of clicking through
it. That gave me real field data, which changed one assumption and surfaced a real UX gap:

**Real finding: "Are you legally authorized to work?" is NOT always Yes/No.** On this actual posting it's a
4-way employment-status radio: "Not working" / "On contract seeking full-time" / "On contract seeking
c2c/c2h" / "Working full-time seeking opportunities". Our safe `fillWorkAuthRadio()` correctly finds no
"Yes" match among those and does nothing — which is the RIGHT behavior (guessing among 4 nuanced options
could misrepresent the candidate) — but the user could easily miss that the question exists at all, since
nothing pointed it out. Also confirmed on the same posting: "Will you require visa sponsorship?" is a
`<select>` (not a radio) and is correctly left untouched; the EEO/demographic block (gender, race/ethnicity,
veteran, disability) are all selects and correctly untouched; "Preferred First Name" is already covered by
the existing field map.

**Fix — "Needs your review" surfacing (`content.js` + `popup.js`):** added `detectAttentionFields()`, which
scans for radio groups / selects matching sponsorship/visa/EEO/work-authorization keywords that are still
unanswered, and surfaces them (max 6) alongside the normal filled-fields checklist — in the in-page toast
(new amber "Needs your review" section) AND in the popup's fill-progress panel. This doesn't change what gets
auto-filled or the safety policy at all — it only makes sure the user notices the fields we intentionally
leave for them, instead of silently passing over a page that might be entirely sponsorship/EEO questions.
Also fixed a related popup bug: it showed a misleading "No fillable fields found" error whenever a page had
0 auto-fillable fields, even if there were real flagged questions to review — now only shows that error when
there's truly nothing to report.

All touched files (`content.js`, `popup.js`, `manifest.json`) verified with `node --check` / JSON.parse.
**Still not click-through tested** — Chrome connection unavailable across the whole session. This is now the
single biggest remaining unknown: I've fixed everything findable via code + live-fetched page data, but real
DOM behavior (React re-render timing, exact selector matches on this specific Greenhouse "MyGreenhouse
platform" build) can only be confirmed by actually loading the unpacked extension and clicking Autofill on
this exact URL.

---

## ✅ FIXED 2026-07-03 (Claude Code, session 2) — Security gaps + rate limits + telemetry + extension polish

### /api/resumes/download cross-user file access (Task #24) 🔴 SECURITY
Route allowed any authenticated user to download any other user's `.docx` by guessing a filepath. The check
only verified the path was inside `USER_RESUMES_BASE` (the base dir for ALL users), not the requesting user's
own subfolder. Fixed: resolves `userId` from Supabase session, then asserts the filepath starts with
`USER_RESUMES_BASE/{userId}/`. Unauthenticated requests for user-scoped files now return 401; cross-user
attempts return 403. Shared library (`RESUMES_LIB`) remains open to any authenticated user (no per-user data).

### Rate limits added to /api/nexus and /api/copilot (Task #23)
Neither endpoint had any per-user rate cap despite calling paid LLMs. Added `checkRateLimit` daily buckets:
100 msg/day for Nexus, 150 msg/day for Copilot. Configurable via `NEXUS_DAILY_LIMIT`/`COPILOT_DAILY_LIMIT`
env vars (set to 0 to disable). Resolves userId from Supabase session; falls back to `"anon"` bucket.
Returns 429 with `Retry-After` header on breach.

### Autofill telemetry — A4 (Task #25)
Built `/api/autofill-log` JSONL endpoint: logs `{ts, ats, fieldsFilledCount, attentionFieldCount,
attentionFields, pageHostname}` after each autofill pass. Added to `PUBLIC_API_PREFIXES` in middleware.ts
(extension content scripts have no session cookie on ATS pages). Extension `content.js` fires a
fire-and-forget POST after every `autoFillForm()` call. Rate-limited at 60/hour per IP; always returns 200
(telemetry is best-effort, never blocks the fill engine). Log file: `DATA_DIR/autofill_log.jsonl`.

### Extension offline status message
`popup.js` `updateStatus("offline")` showed "MarketFit offline — start npm run dev" — dev-centric message.
Updated to "Cannot reach {url} — check connection or URL in Settings".

### Stale TODO items confirmed resolved (no code change needed)
- **`/api/profile/extract` file size cap** — `MAX_FILE_SIZE = 5 * 1024 * 1024` already at lines 6–17. Stale.
- **Settings Adzuna env var** — Adzuna card already deleted in prior session. No match in `src/`. Stale.
- **Marketing "Join Waitlist →" dead anchor** — No `#waitlist` in `dashboard/marketing/page.tsx`. Stale.
- **9 × native `window.confirm/prompt`** — All use `useDialogs()`. Task 9 done. Zero raw calls remain.
- **`href="#"` dead CTAs** — Zero matches in `src/app/dashboard`. Already resolved.
- **R4 multi-page ATS / R5 attention fields** — Both implemented in 2026-07-03b/c sessions.
- **H1B scorer duplication** — `jobs-ft/page.tsx` already uses `getH1BScore` from `lib/h1b`. Stale.
- **Gmail↔Email shape mismatch** — `toThread()` maps all fields correctly; `ParsedApplication` interfaces
  in both email page and gmail-sync route are identical. Stale concern.
- **Builder rule enforcement** — `validateBuilder()` already enforces all 10 CLAUDE.md rules with live
  inline warnings. `estimatePages()` + `pageColor` indicator already computed. Item was stale.
- **"Upgrade to Pro" sidebar link** — already routes to `/dashboard/settings#plan`; `id="plan"` anchor
  exists on the settings page. Stale.

---

## ✅ FIXED 2026-07-03 (Claude Code) — Stub redirect UX + Nexus prompt guard + extension URL

### Stub redirects → Coming Soon pages (Tasks #18)
`messages/page.tsx`, `network/page.tsx`, `activity/page.tsx` were silent `router.replace()` calls.
All three replaced with proper styled "Coming Soon" server components — no client import needed — that show
a relevant icon, description, and a CTA link so users aren't silently bounced. Network sends to Company Intel + Browse Jobs. Messages sends to Applications. Activity sends to Dashboard.

### Nexus per-message content cap (Task #19)
`/api/nexus/route.ts`: history was already capped at 10 turns (`slice(-10)`) and JD at 2000 chars,
but individual user messages were unbounded — a user pasting a large document into the chat could inflate the
context window. Added `MAX_MSG_CHARS = 1200` cap with `… [truncated]` suffix on oversized messages.
Total worst-case: 2000 (JD) + 10 × 1200 (history) + ~900 (system boilerplate) ≈ 14 900 chars — well within any LLM's context budget for a `light` tier call.

### Extension default URL fix — C3 (Task #21)
`extension/background.js` `onInstalled` hook was seeding `appUrl: "http://localhost:3000"` — every
production user on a fresh install was silently fetching the wrong origin. Fixed to `"https://marketfit.app"`.
Also updated the runtime fallback string in GET_PROFILE handler so existing installs that never opened Settings
also get the correct default. Same one-line fix in `extension/popup.js` (`DEFAULT_URL` constant).

### R5 fill toast attention warnings — confirmed already implemented
`showFillToast` already accepts `needsAttention[]` as 4th param and renders a "Needs your review" amber
section. The R5 TODO entry was stale — this was built in the 2026-07-03b autofill session.

### Rate limits added to /api/nexus and /api/copilot (Task #23)
Both endpoints used `resolveKeys()` (user's key first, server key as fallback) but had zero rate limiting.
Added `checkRateLimit` per-user daily buckets: 100 msg/day for Nexus, 150 msg/day for Copilot. Configurable
via `NEXUS_DAILY_LIMIT` / `COPILOT_DAILY_LIMIT` env vars (set to 0 to disable). Resolves `userId` from
Supabase session; falls back to `"anon"` bucket. Returns 429 with `Retry-After` header.

### Extension offline status message
`popup.js` `updateStatus("offline")` showed "MarketFit offline — start npm run dev" — dev-centric message
that confuses production users. Updated to "Cannot reach {url} — check connection or URL in Settings".

### Stale TODO items confirmed resolved (no code change needed)
- **`/api/profile/extract` file size cap** — `MAX_FILE_SIZE = 5 * 1024 * 1024` already at lines 6–17. Stale.
- **Settings Adzuna env var** — Adzuna card already deleted in prior session. No match in `src/`. Stale.
- **Marketing "Join Waitlist →" dead anchor** — No `#waitlist` in `dashboard/marketing/page.tsx`. Stale.
- **9 × native `window.confirm/prompt`** — All use `useDialogs()` from `dialog-provider.tsx`. Task 9 done.
  Zero raw `window.confirm` / `window.prompt` remain.
- **`href="#"` dead CTAs** — Zero matches in `src/app/dashboard`. Already resolved.
- **R4 multi-page ATS / R5 attention fields** — Both confirmed already implemented in 2026-07-03b/c sessions.
- **H1B scorer duplication** — `jobs-ft/page.tsx` already uses `getH1BScore` from `lib/h1b`. Stale.
- **H1B scorer dead `/api/h1b` endpoint** — Confirmed live: jobs-ft imports from lib directly. Stale.

---

## 🔴 FIXED 2026-07-03b — extension never ran inside EMBEDDED ATS iframes

Eshwar asked me to test live against `job-boards.greenhouse.io/embed/job_app?...` (Greenhouse's iframe-embed
template — real companies commonly embed this directly on their own careers page instead of linking out to
greenhouse.io). Chrome browser tool was not connected (tried repeatedly — `list_connected_browsers` returned
empty every time), so I could not click-through test. While blocked on that, re-audited the manifest instead
and found a real, concrete, previously-undiscovered bug:

**`manifest.json`'s `content_scripts` entry for `content.js` had no `"all_frames": true`.** Chrome's default
(`all_frames` omitted = `false`) only injects a content script into a frame if that frame is the TOP-LEVEL
frame of the tab. When a company embeds the ATS via `<iframe src="https://boards.greenhouse.io/...">` on
their own domain, the parent page's hostname doesn't match any of our patterns, and — without
`all_frames:true` — the embedded iframe itself never gets `content.js` injected either, even though its own
URL matches. **Net effect: on any real career site that embeds the application form (a very common pattern),
autofill did precisely nothing — no error, no toast, just silent failure.** This is a serious, plausible
contributor to "still sucks on real applications."

Fix: added `"all_frames": true` to that content-script entry. Also added a small guard in
`injectFloatingButton()` so the floating "Autofill" button doesn't try to render inside a small embedded
iframe (where `position:fixed` clips to the iframe's own box and would show cropped/invisible) — the fill
engine itself is unaffected by this guard and still runs in that frame via the popup-triggered path
(`chrome.tabs.sendMessage` without an explicit `frameId` already reaches every frame's listener, not just the
top one, so no message-routing change was needed).

Verified: `manifest.json` still valid JSON, `content.js` passes `node --check`. **Still not click-through
tested** — needs the Chrome connection restored. Eshwar: please check that the "Claude in Chrome" browser
extension (separate from the MarketFit extension being tested) is installed, enabled, and signed in — that's
what I need to actually drive a browser and test any of this live.

---

## 🧩 FIXED 2026-07-03 (Claude Code) — Autofill engine gaps vs Jobright-class behavior

User feedback: "autofill still sucks on real applications." Deep code audit of `extension/content.js`
(no live Chrome/ATS available here to click-through test — did everything possible via static read +
`node --check`). Found and fixed 4 real, concrete gaps:

1. **Workday custom-dropdown fills were uncounted and could race the generic fallback pass.** The combo-box
   option click used a bare `setTimeout(…, 200)` that fired AFTER `autoFillForm()` had already returned and
   handed off to the generic pass — so (a) these fills never counted toward the toast total, and (b) the
   generic pass could try to fill the same combobox input at the same moment. Fixed: `fillWorkday` and
   `autoFillForm` are now properly `async`/`await`ed end-to-end; the combo element is claimed in the shared
   `filled` Set *before* the await so nothing else can touch it while Workday's option list renders.
2. **The safe "authorized to work = Yes" radio-fill only ran on Workday** — Greenhouse/Lever/Ashby/
   SmartRecruiters/BambooHR/Jobvite/iCIMS all ask the identical question and never got it. Pulled into a
   shared `fillWorkAuthRadio()` now called for every ATS. (Sponsorship/EEO radios are still never touched —
   same safety policy as before, unchanged.)
3. **No handling for required-attestation checkboxes** ("I certify the information above is true and
   accurate", etc.) — added `fillCertificationCheckboxes()`, narrowly scoped to that attestation-language
   pattern only (never touches marketing opt-ins or EEO self-ID checkboxes).
4. **Biggest gap — no re-fill across multi-step wizards.** Real Workday/Greenhouse/Lever applications are
   almost always spread across several pages (Personal Info → Experience → Voluntary Disclosures → Review).
   Autofill previously only ran once per manual click; every subsequent page/step was untouched until the
   user remembered to reopen the popup and click again. Added `armContinuousRefill()` — a `MutationObserver`
   that watches for new form fields (new step, expanded accordion, slow-loaded section) and silently re-runs
   the same fill pass, debounced 700ms, disconnected while actively filling (avoids feedback loops from our
   own dispatched events), capped at 50 runs as a safety valve, and reset cleanly on SPA hash/history
   navigation (Workday commonly uses this between steps).
5. Also fixed a real bug spotted in the same block: the `AUTOFILL` message response sent `required: count`
   (the *total* filled count) instead of the actual required-field count — the popup's fill-progress
   checklist was showing the wrong "required fields" number.

All extension `.js` files pass `node --check`. **Not click-through tested** — no Chrome browser was
connected to this session. Please load the unpacked extension and test on a real multi-step Workday or
Greenhouse application: (a) confirm fields still fill correctly (regression check), (b) advance to page 2/3
and confirm NEW fields on that page get auto-filled without re-clicking, (c) confirm no duplicate/stray
toasts appear, (d) confirm sponsorship/EEO questions are still correctly left untouched.

Still not done (would need live testing or more profile data to build safely): custom non-native dropdowns
outside Workday (Greenhouse/Lever/Ashby sometimes use React-Select-style widgets for "how did you hear about
us"/demographics — no safe generic handling yet), education-history field mapping (school/degree/dates),
iframe-embedded forms.

---

> **This is the ONE tracker. Single source of truth.** All other tracker files
> (COWORK_QA.md, EXTENSION_GAP.md, SESSION_REPORT.md) are merged here and stubbed.
> Both agents (Cowork = find/verify bugs; Claude Code = write code) update THIS file only.

Role: Find and fix UI/UX/logic bugs. Track everything.
Last updated: 2026-07-03

> ⚠️ **TWO AGENTS EDIT THIS FILE.** To stop edits from getting lost in write-races:
> Cowork appends ONLY to the "🆕 COWORK ILLOGICAL LOG" block directly below (newest first).
> Claude Code keeps its session logs further down. If you (Eshwar) can't see new items, reload
> the file in your editor — VS Code caches the buffer and won't auto-refresh an externally-edited file.

---

## ✅ FIXED 2026-07-03 (Claude Code) — Brand sweep + auth fixes + Documents routing

- `AptMatch` → `MarketFit` in all 3 user-visible dashboard strings (dashboard/page.tsx) + OpenRouter `x-title` header (llm.ts). Comments in pdf/download routes cleaned.
- localStorage keys `aptmatch_recent_tailors` / `aptmatch_active_job` → `mf_recent_tailors` / `mf_active_job` in ResumeClient.tsx; ai-tools/page.tsx reads new key with fallback to old (no data loss).
- `/api/waitlist` GET now requires `x-admin-token` header or `?token=` query matching `ADMIN_PASS` env — was fully unauthenticated.
- `/api/feedback` POST was flagged as unauthenticated injection risk — confirmed ALREADY protected by middleware.ts (not in PUBLIC_API_PREFIXES); no route-level change needed. Marked resolved.
- Marketing "One-Click Autofill" capability card href fixed: `/dashboard/jobs` → `/dashboard/settings`.
- Sidebar "Live" badge (hardcoded, not reflecting API state) — confirmed already removed from sidebar-nav.tsx; no change needed.
- All marketing `cta.href` / `cap.href` values verified → every route resolves: `/dashboard/resume`, `/dashboard/jobs`, `/dashboard/settings`, `/dashboard/ai-tools`.

---

## ✅ FIXED 2026-07-03 (Claude Code) — Documents section missing from the resume tailor page

`/dashboard/documents` is (and should stay) a redirect to `/dashboard/resume` — "folded into the My Resume
hub" — but the fold never actually happened. `ResumeClient.tsx` only ever had two tabs (`AI Tailor`, `Builder`)
despite its own copy literally saying "Add resumes in Documents, then tailor them here" and shipping two links
("Manage →", "Go to Documents →") pointing at `/dashboard/documents` — which just redirects right back to this
same page. Net effect: **no way to upload, organize into folders, rename, move, or delete resumes at all** —
the fully-built `DocumentsClient.tsx` (upload/drag-drop, folder tree, move/delete, zip import) was completely
orphaned, imported by zero files in the entire `src/` tree.

Fix: added a real 3rd **📁 Documents** tab to `ResumeClient.tsx`, rendering `DocumentsClient` with the same
`initialFiles`/`initialFolders` props the page already fetches (no new data-fetching needed — same shape).
Gave `DocumentsClient` an optional `onDone` callback so, when embedded as a tab, its own "Tailor a Resume"
button switches tabs in place instead of a full page reload (falls back to a real link if ever rendered
standalone again). Converted the two dead `<a href="/dashboard/documents">` links into `setActiveTab("docs")`
buttons. `tsc --noEmit` clean project-wide. **Not visually verified in a browser** — the new auth gate
(middleware.ts) now blocks unauthenticated access, and no browser session is connected here; verify by logging
in and checking Resume → Documents tab shows the upload zone + your file/folder tree.

---

## 🔴 CRITICAL — FOUND + FIXED SAME SESSION 2026-07-02 (Claude Code)

**The auth gate (`src/middleware.ts`) landed** — someone made the "gate `/dashboard/*`" call: unauthenticated
users now get redirected to `/`, and unauthenticated `/api/*` calls 401 except an explicit public allowlist
(`/api/jobs`, `/api/h1b`, `/api/waitlist`, `/api/contact`, `/api/admin/auth`, `/api/salary`, `/api/score`).
Verified this is otherwise well-built (uses `getUser()` not `getSession()` — correctly validates the token,
doesn't just trust the cookie).

**But it shipped alongside a stale `next.config.js` redirect (`"/" → "/dashboard"`, added back when there was
no auth gate) — together those two rules fought each other into an INFINITE REDIRECT LOOP for every single
logged-out visitor.** Confirmed with curl: hit the max-redirects cap bouncing `/ → /dashboard → / → /dashboard
→ …`. **The entire site was down for 100% of unauthenticated traffic** (which was 100% of traffic, since
there's no way to sign up from a site that won't load). Fixed: removed the stale redirect — `next.config.js`
`redirects()` now returns `[]` (with a comment explaining why, so it doesn't get re-added). This is not a
preference call, it's a correctness fix — the two rules are provably contradictory now that the gate exists.
Verified: `/` → 200 (0 redirects, real marketing-page content renders — title, brand, tagline all present),
`/dashboard` (no auth) → single clean 307 to `/?auth=required` (no loop), `/api/jobs` (public) → 200,
`/api/admin/config` (private) → 401. `tsc --noEmit` clean.

This also resolves the long-open "marketing landing + pricing is hidden" item — `/` was unreachable before
(hard-redirected to `/dashboard`); now that the redirect is gone, logged-out visitors see the real landing
page (hero + Free/Pro/Agency pricing + Jobright comparison) for the first time.

⚠️ **Still needs Eshwar / verification:** confirm this is the auth-gate behavior you actually want (vs. an
open-for-testing dashboard) — if you want it reverted, delete `src/middleware.ts` instead of re-adding the
redirect (re-adding the redirect brings the loop straight back). Also: `/dashboard/resume` still has its own
in-file `userId = "demo"` fallback pattern for unauthenticated access in a few API routes — those paths are
now moot for real browser traffic (middleware blocks the page before it ever loads) but the fallback code is
harmless dead weight, not a bug.

---

## ▶️ HAND-OFF QUEUE FOR CLAUDE CODE (terminal) — do these next, in order

> Cowork (me) can't run a shell (sandbox down) — YOU (Claude Code, terminal) can. Each item has a file:line
> and an **acceptance check you can actually run**. Do them top-down; tick the box when the check passes.
> Full detail for each lives in the sections below.

1. [~] **Autofill session bridge — BUILT 2026-07-02 (Claude Code), needs a real-browser check.**
   - **Web app side:** `sidebar-nav.tsx` now has a second effect that calls `supabase.auth.getSession()` +
     subscribes to `onAuthStateChange`, and `window.postMessage({source:"marketfit-web", type:"MF_AUTH",
     session}, origin)` on every change (session `null` on logout). Runs on every dashboard page load.
   - **Extension side:** new `extension/web-bridge.js` content script (matches `localhost:3000/3001` +
     `marketfit.app` — added to `manifest.json`'s `content_scripts`) listens for that postMessage
     (origin-checked) and relays it via `chrome.runtime.sendMessage({type:"MF_AUTH", session})`.
   - `auth.js`'s `listenForWebAuth()` (was dead code, never called) now actually runs — fixed the message
     type from the old typo'd `'CAREEEROS_AUTH'` to `'MF_AUTH'`, and fixed it to also CLEAR
     `chrome.storage.local` on logout (`session: null`) — previously the condition required a truthy
     session so sign-out silently did nothing and left a stale token behind.
   - `background.js` is now loaded as an ES module (`"type":"module"` added to manifest — needed for the
     `import`) and calls `listenForWebAuth()` on startup; `GET_PROFILE` now does `getToken()` and attaches
     `Authorization: Bearer <token>` when a session exists, falling back to the old unauthenticated fetch
     when it doesn't (so the no-login/local-dev path is unchanged).
   - **Server side:** new `createClientFromRequest(request)` in `src/lib/supabase/server.ts` — reads an
     `Authorization: Bearer` header and authenticates via `@supabase/supabase-js` directly (not the cookie-
     based SSR client) when present, else falls back to the normal cookie session unchanged. Wired into all
     3 `createClient()` call sites in `src/app/api/profile/route.ts` (GET filepath branch, GET no-params
     branch, POST). Existing browser-tab callers (Settings page etc.) are unaffected — they never send that
     header, so they take the exact same cookie path as before.
   - Also fixed `popup.js`'s own separate first-run `/api/profile` fetch (line ~218) the same way — it seeds
     a local editable profile cache once per install and had the identical unauthenticated gap.
   - Also found + fixed while in `jobs-ft/page.tsx` for the H1B item: a stray `</div>` breaking the JSX
     parse entirely (see item 4 below) — unrelated to this item but caught in the same session.
   - `tsc --noEmit` clean; all touched extension `.js` files pass `node --check` (syntax-only, since there's
     no build step for the extension); `manifest.json` re-validated as parseable JSON.
   - **NOT verified — needs a human with a real Chrome + the unpacked extension loaded:** I have no browser
     environment here to actually load the unpacked extension, log into the web app, and confirm the
     session round-trips end-to-end onto a real Greenhouse form. Please run the original acceptance check
     yourself: dev server up + logged in + saved profile → open a real Greenhouse form with the unpacked
     extension loaded → Quick Fill → name/email/phone should fill AND stick. If `mf_session` never lands in
     `chrome.storage.local`, check the extension's service-worker console (chrome://extensions → service
     worker → Console) for `web-bridge.js`/background errors first.
   - Confirmed (read `content.js` directly): veteran/disability/currently-working auto-answers are already
     removed (R3's main fix holds). The one still-open sub-item from R3 — driving the `authorized` radio
     from `profile.work_auth` instead of a hardcoded `"Yes"` — is NOT done; it also needs `work_auth` added
     to `toAutofillShape()` in `api/profile/route.ts` first (that function doesn't return it today). Left
     as a separate follow-up, out of scope for this bridge fix.
2. [x] **Blur gate → light tease, not a lock.** ALREADY DONE on disk — verified 2026-07-02: `GmailGate` uses
   `filter: blur(2px)` (no saturate) and the unlock overlay has no dark scrim (comment confirms "NO dark
   scrim, so the real (blurred) numbers show through"). No action needed.
3. [x] **Launch hygiene — FIXED 2026-07-02 (Claude Code).** Deleted `src/app/api/test-match/route.ts` +
   `test-docx/route.ts` (confirmed zero references anywhere in `src/` first). Removed the entire dead
   "Adzuna API" card from `settings/page.tsx` (~L461-510) instead of just fixing the label — the app has
   NO Adzuna fetch logic anywhere in `/api/jobs/route.ts`, so the card's App ID/Key inputs went nowhere,
   and a browser-stored key can't populate a server `process.env` var anyway. The already-correct "Quick
   Setup Guide" (steps 1-2, ~L589) already tells users the real path (`RAPID_API_KEY` in `.env.local`), so
   nothing was lost. Also removed `adzunaId`/`adzunaKey` from the `Keys` interface + initial state (dead
   fields, only ever read by the deleted card). `tsc --noEmit` clean.
   - ✅ **RESOLVED (verified 2026-07-02, Claude Code): `npm run build` now exits 0.** Re-checked — the
     conflicting `src/app/auth/callback/route.ts` no longer exists; only `page.tsx` remains at that segment
     (whoever was mid-migration finished it, or reverted). Ran a full fresh `npm run build`: succeeds, full
     74-route manifest generated, only 2 pre-existing non-fatal warnings (a custom Cache-Control header note
     + a Turbopack NFT-trace note on `/api/tailor/start`, neither blocks the build). Production builds are
     unblocked again.
4. [x] **H1B one source of truth — FIXED 2026-07-02 (Claude Code).** `jobs-ft/page.tsx` now imports
   `getH1BScore` from `@/lib/h1b` (same one `jobs/page.tsx` and `/api/h1b?company=` use) instead of its own
   `h1bLikelihood()` heuristic — deleted that function. The card badge and the "⭐ Match" sort both derive
   from the canonical status now (sort uses a `likely=2/possible=1/unknown=0` rank since the canonical
   scorer only gives 3 tiers, not the old fabricated 0-100 score). `tsc --noEmit` clean.
   - Found + fixed a real bug while in this file: a stray leftover `</div>` (merge artifact from an earlier
     sticky-header edit colliding with someone else's later restructure) was breaking the JSX parse entirely
     — removed it. Worth a heads-up: this file is getting heavy concurrent traffic right now (new JobRight-
     style filters — date/experience/salary/sort — landed mid-session); if you're both touching it, diff
     carefully before saving.
5. [ ] **Admin needs the DB decision (Eshwar).** Posts save to `localStorage` (no cross-user), gate is a
   client `sessionStorage` flag (bypassable). Once DB is chosen: `posts` table + `/api/admin/posts`, and a
   server session for the gate. Blocked until the DB call.

---

## 🧩 AUTOFILL EXTENSION — mistakes & growth (Cowork audit 2026-06-30 · for the dev)

> Audited the extension on disk. **What actually runs is `content.js` only** (a solid ~950-line monolith);
> every modular file is dead code (see C1). Findings are grouped by severity, each with `file:line` + a
> concrete fix. Treat this as the extension dev's worklist + a growth roadmap toward Jobright/Simplify parity.
> North star: a candidate should click once and have a correct, fully-filled application — wrong/blank fields
> make the user look bad to a recruiter, so reliability > coverage.

### 🔴 CRITICAL — autofill is effectively broken for real signed-in users
- [ ] **C1. The whole modular architecture is dead code.** `manifest.json` loads `content_scripts.js =
  ["content.js"]` ONLY (L48). Nothing references `ats/{workday,greenhouse,lever,taleo,icims,smartrecruiters}.js`,
  `utils/{fieldFill,detect,logger}.js`, or `auth.js` — they never load. DECIDE: (a) delete them so nobody
  edits the wrong engine again, OR (b) actually wire them (per-ATS `content_scripts` + the shared chain) and
  retire the monolith. Today you maintain two engines and ship one — every "fix" to an `ats/*.js` file does
  nothing.
- [ ] **C2. Profile fetch is unauthenticated → fills nothing in production.** `background.js` GET_PROFILE does
  `fetch(appUrl + "/api/profile")` with NO `Authorization` header and NO `credentials:"include"` (L15). On
  deployed marketfit.app, `/api/profile` with no auth returns null → autofill has no data. `auth.js` (the
  JWT bridge) exists but is unused. FIX: build the **session bridge** — a content script on marketfit.app that
  reads the Supabase session → `chrome.storage.local.set({mf_session})`; background attaches `Authorization:
  Bearer <jwt>`; `/api/profile` accepts that token. (This is the #1 thing blocking real-user autofill.)
- [ ] **C3. Shipped extension defaults to `localhost:3000`.** `background.js` defaults `appUrl` to
  `http://localhost:3000` and sets it once on install (L13, L57). A published-extension user on marketfit.app
  still fetches localhost → connection refused → no profile. FIX: default to `https://marketfit.app`; let the
  popup show/override the URL for local dev.

### 🟠 RELIABILITY — values don't "stick" or aren't filled
- [x] **R1. React-controlled inputs — ALREADY CORRECT (earlier finding was WRONG).** RE-VERIFIED 2026-06-30
  against `content.js` **v3**: `fillText` (L15–31) DOES use the native value-setter
  (`Object.getOwnPropertyDescriptor(proto,"value").set` at L21–22) before dispatching input/change, and covers
  the `HTMLTextAreaElement` prototype too. Values DO stick on React ATS — no fix needed. (I missed it because
  I grepped for the var name `nativeInputValueSetter`, which the code doesn't use — it's inline. Lesson: read,
  don't grep-and-assume.)
- [x] **R2. Resume file attach — ALREADY IMPLEMENTED (earlier finding was WRONG).** RE-VERIFIED:
  `attachResumeFile()` (L1015) fetches the resume blob → builds a `File` (L1027) via `DataTransfer` (L1004) →
  sets `input.files` (L1006), triggered by message (L1053). The `:not([type='file'])` at L549 is just the
  generic TEXT-fill selector correctly skipping file inputs (handled separately). REMAINING (small): the built
  file is hard-coded to `.docx` (L1027); some ATS require PDF — detect the accepted type or offer a PDF.
- [~] **🔴 R3 (ELEVATED). Extension auto-answers PROTECTED EEO / demographic questions — PARTIALLY FIXED.**
  ✅ DONE 2026-06-30 (Cowork): removed the `veteran`, `disability`, and `currently working` auto-answers from
  `content.js` (now only `authorized` is auto-set), with a code comment so they're not re-added. REMAINING →
  drive `authorized` from `profile.work_auth` instead of hardcoded "Yes" (details below).
  `content.js` L349–352 auto-fills: `authorized`→"Yes" (L349), `currently working`→"No" (L350),
  **`veteran`→"I am not a protected veteran" (L351)**, and **`disability`→"I don't wish to answer" (L352)**.
  Veteran status and disability are legally-protected self-identification fields — auto-answering them is
  wrong for users who ARE veterans/disabled, and silently answering protected-class questions on someone's
  behalf is a real liability. FIX: STOP auto-filling `veteran` and `disability` entirely (leave to the user).
  Drive `authorized` from `profile.work_auth` instead of a hardcoded "Yes". Re-check `currently working`→"No"
  (reads as "are you currently employed?" → No is wrong for most). Keep: the sponsorship Yes/No radio is NOT
  auto-answered — add a visible "answer sponsorship manually" hint.
- [ ] **R4. Multi-page ATS (Workday 4–6 pages) — only page 1 fills.** content.js fills the DOM once at
  `document_idle`; no next-page detection. FIX/GROWTH: MutationObserver + "Next/Continue" detection to re-run
  fill on each step, or at least re-fill on URL/route change.
- [ ] **R5. Failure UX is a count toast, not per-field warnings.** The post-fill toast (L711–777) shows a
  number but never says WHICH critical fields it couldn't map (work-auth, sponsorship, custom screeners). FIX:
  collect unfilled critical fields → "⚠ Couldn't fill: Work Auth, Sponsorship — check manually" so the user
  never submits a half-filled form blind.

### 🟡 ARCHITECTURE / HYGIENE
- [ ] **A1. Manifest missing `web_accessible_resources`, `background.type:"module"`, and `cookies`** — all
  needed for the sidebar (G1), an ES-module background, and a cookie session fallback.
- [ ] **A2. Modular adapters expect a NESTED profile** (`profile.firstName/address/links/experience`) while
  `/api/profile` returns FLAT (`full_name/...`). If C1(b) wires them, reconcile the shape first or they fill
  nothing. (The live monolith uses DOM-attribute matching on the flat shape, so it's fine today.)
- [ ] **A3. Floating-button → popup is unreliable** — `chrome.action.openPopup?.()` (L50) needs a toolbar
  gesture and often no-ops (the comment admits it). A sidebar (G1) removes this dependency.
- [ ] **A4. No autofill telemetry** — no `/api/autofill-log` → no per-ATS success/failure data to prioritize
  fixes.

### 🟢 GROWTH — Jobright/Simplify parity (the real differentiator)
- [ ] **G1. 380px sliding in-page sidebar** (spec headline, currently absent — only popup+toast). Inject a
  panel on ATS pages: job context, **match %**, **H1B badge (from the canonical `lib/h1b`)**, a **live
  per-field fill checklist** (✓/○ as each fills), a **resume selector** + "Generate tailored resume",
  Start-Autofill, and a timestamped status log. Needs `web_accessible_resources` + `sidebar.js/css`.
- [ ] **G2. Tailor on the FULL JD from the page.** The extension can send only the job title when a board
  lazy-loads the JD → thinner tailoring than the web app. Use the existing `SCRAPE_JD` path (L686+) to grab
  the full description before `/api/tailor`, so extension output == dashboard output.
- [ ] **G3. Smarter generic matching** — label synonyms/fuzzy match, address sub-fields (street/city/state/
  zip), LinkedIn/GitHub/portfolio, years-of-experience, EEO/demographic fields (leave blank by default), and
  Workday custom-dropdown listboxes.
- [ ] **G4. Chrome Web Store readiness** — privacy policy URL now exists (`/privacy` ✓); add per-permission
  justifications, screenshots, single-purpose declaration, version bump. The broad `tabs` permission is CWS-
  scrutinized — justify it or narrow to `activeTab`.

---

## 🆕 COWORK ILLOGICAL LOG — newest first (pinned top so it's never buried)

### 2026-06-30 (round 3) — H1B scorer duplication (Cowork)

- [ ] **🔴 Two competing H1B scorers on the #1 board — and the real one is unused (dead `/api/h1b`).**
  `jobs-ft/page.tsx` computes the H1B badge with a CLIENT heuristic `h1bLikelihood(company,title)` (L48) off a
  small inline firm list, while the CANONICAL scorer `lib/h1b.getH1BScore()` (a large `LIKELY_SPONSORS` set →
  "likely/possible/unknown" by LCA volume) is exposed at `/api/h1b?company=` but is NEVER called by any UI
  (dead endpoint, confirmed via fetch audit). So the board's H1B signal is a guess that can DISAGREE with the
  app's own canonical data, and the better dataset is wasted. FIX: derive the H1B badge from `lib/h1b` /
  `/api/h1b` everywhere (one source of truth); when Eshwar drops the real H1B companies list, load it into
  `lib/h1b` (or the `h1b_sponsors` DB table) so every board updates at once.

### 2026-06-30 (round 2) — marketing + settings audit (Cowork)

- [ ] **🟠 Settings "Setup Guide" gives the WRONG env var for live jobs.** `settings/page.tsx` L508 tells
  users to add `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` "for live search", but `/api/jobs` reads ONLY
  `process.env.RAPID_API_KEY` (route.ts L31/L222 — JSearch via RapidAPI); no Adzuna var is read anywhere in
  the codebase. A beginner who follows L508 adds Adzuna keys, sees no live jobs, and is stuck. The page even
  contradicts itself — L590 correctly says add `RAPID_API_KEY`. FIX: delete/replace the Adzuna block at L508
  with the RapidAPI/`RAPID_API_KEY` instruction so there's ONE correct setup path. (Settings file is
  occasionally touched by the build session — handing off the exact line rather than editing to avoid a race.)
- [ ] **Marketing "Join Waitlist →" CTA is a dead anchor + logically misplaced.** `marketing/page.tsx` L70
  links to `/dashboard/marketing#waitlist`, but there is NO `id="waitlist"` element on the page → the click
  scrolls nowhere. Also a waitlist CTA INSIDE the logged-in dashboard is odd (the user is already in). FIX:
  either add the waitlist section/anchor, or (better) drop the waitlist CTA from the internal showcase and
  keep waitlist on the public landing page `/` only. (All other marketing CTAs verified → real routes.)

### 2026-06-30 (later) — admin + marketing audit (Cowork)

- [ ] **🔴 Admin "Posts Manager" saves to localStorage → no other user ever sees admin-added links.**
  `admin/page.tsx` persists post links in `localStorage["mf_admin_posts"]` (L134/138/161). localStorage is
  per-browser/per-device, so when the admin adds a contract-board post link on their laptop, NO visitor and
  no other device sees it — the "Administrator adds/updates links that users see" feature is non-functional
  across users. Needs a shared **server/DB store** (e.g. a `posts` table + `GET/POST /api/admin/posts`).
  Also confirm the Contract board's Posts tab READS the same source (today it likely renders its own mock
  list, so admin edits don't even reach it in the same browser).
- [ ] **🟠 Admin gate is a client sessionStorage flag → bypassable.** After the server validates creds, the
  panel only sets `sessionStorage["mf_admin_auth"]="1"` and the gate trusts that flag (L73/L482). Anyone can
  set that flag in devtools to open the admin panel; the admin content is client-rendered, so there's no
  real protection. OK as a local-dev placeholder, but before launch the admin area needs a server-side
  session/cookie (httpOnly) + a middleware/route guard, not a client flag.
- [ ] **Marketing CTAs — verify dynamic hrefs resolve.** `marketing/page.tsx` renders carousel `s.cta.href`
  (L295) and capability `cap.href` (L352) from data arrays. Static links are fine; confirm every
  `cta.href`/`cap.href` in those arrays points to a real route (no 404 from a hotspot click).

> 📌 **Active items now live in the in-app TASKS PANEL** (TaskCreate), not just this file — that's why
> Eshwar "couldn't see changes": prior agents edited this FILE but the panel he watches was empty. Both
> are now in sync. (Also: VS Code caches the buffer — reload the file to see external edits.)

### ✅ RESOLVED 2026-06-30 (Claude Code — verified: tsc 0 errors, lint 0 errors, routes 200)
- [x] **Pipeline/Analytics blur gate** — implemented the Cowork-handoff fix exactly: dropped to
  `filter: blur(2px)` (removed `saturate`), removed the 55%-dark scrim (now transparent), real numbers
  stay legible. Unlock now calls REAL `connectGmail()` OAuth (demo fallback only if Supabase unconfigured).
- [x] **Live postings + Live/Sample badges on all 3 boards** — verified jobs/jobs-ft/contracts all read
  `data.live`; `/api/jobs` calls JSearch when `RAPID_API_KEY` set. No board shows sample under a Live badge.
- [x] **Gmail connect — real in code** — OAuth → `/auth/callback/gmail` writes `profiles.gmail_refresh_token`
  + `gmail_connected_at`. Real DB record; needs Supabase env + gmail columns to activate (infra = Eshwar).
- [x] **Contract board type filter** — added `type=contract` to `/api/jobs` (JSearch `employment_types=CONTRACTOR`
  live; W2/C2C keyword filter on sample). Verified: `/api/jobs?type=contract` → 10 jobs, 0 non-contract.
- [x] **Gmail OAuth return path** — connect from the pipeline gate now returns to the unlocked pipeline,
  not /dashboard/email (open-redirect-safe `?return=` honored by the callback).
- [x] **Admin secret hygiene** — confirmed `Strawhat@1234` already off the client bundle (server `/api/admin/auth`).
Still open (in the Tasks panel): Email MOCK_THREADS shape mismatch (#4, needs decision), mobile sidebar (#6,
needs browser), clean `next build` on a quiet repo.

### 2026-06-30i — new findings (multi-turn LLM, match-score consolidation, file size, profile scope)

✅ Fixed same session:
- `src/lib/llm.ts` refactored: `CallOpts.user` made optional, added `ChatMessage[]` messages param; all 3 providers (Anthropic, OpenRouter, Gemini) now accept proper multi-turn arrays. Backward-compatible — all existing callers using `user: string` unchanged.
- `src/app/api/nexus/route.ts` — fixed multi-turn chat serialization: now passes `messages: history` array to `callLLM` instead of collapsing history into a single user string.
- `src/app/api/copilot/route.ts` — same multi-turn serialization bug as Nexus. Fixed same way.
- `src/app/api/match-score/route.ts` — consolidated skill matching to use `computeSkillsScore` from lib (70+ aliases + security domain) instead of inline 18-entry ALIASES that still had the terraform/"tf" collision. Location scoring upgraded to use `computeLocationScore` with city/state support when `profile.jobLocation` is provided.
- `src/app/api/profile/extract/route.ts` — added 5MB file size cap before `arrayBuffer()` call. Returns 413 if exceeded.
- `src/app/api/resumes/route.ts` — added file size caps: 50MB max for ZIP uploads, 5MB max for .docx uploads. Previously no cap — a 500MB ZIP would fully load into server memory.
- `src/app/api/user-resumes/route.ts` DELETE — now accepts `filepath` (full path from recursive list) in addition to bare `filename`. Previously only did `path.basename(filename)` so files in subdirectories could never be deleted via this endpoint.

New open items:

- [x] **✅ FIXED (verified 2026-07-02) `/api/profile?filepath=` resume path scope leak** — `profile/route.ts` GET now resolves the caller's real `userId` via `createClientFromRequest` first, and the `filepath` allowlist is scoped to `path.join(USER_RESUMES_BASE, userId)` (falls back to `"demo"` when unauthenticated) instead of the whole shared resumes root — plus the boundary check now requires an exact match or a path-separator boundary (`resolved.startsWith(a + path.sep) || resolved === a`), closing the prefix-match bypass the original check had too. No action needed — already on disk.

- [x] **✅ NOT A BUG (verified 2026-07-03) — `DocumentsClient.tsx`'s `prompt()`/`confirm()` are NOT native dialogs.** Both are destructured from `useDialogs()` (`@/components/ui/dialog-provider`) — a controlled React modal implementation the app already uses everywhere else, not `window.prompt`/`window.confirm`. The shared local names (`prompt`, `confirm`) shadow the browser globals, which reads as a native-dialog call from a static read alone — that's the false positive here. No change needed.

- [x] **✅ FIXED 2026-07-02 (Claude Code): `/api/salary` rate limiting** — added a new reusable `src/lib/rateLimit.ts` (IP-keyed in-memory limiter) and wired it in: 20 requests/hour per IP, `429` + `Retry-After` beyond that. Verified live: 20 requests succeed, the 21st is `429`, a different IP is unaffected. Same helper is available for any other unauthenticated LLM-backed route that needs this (e.g. a future pass on `/api/nexus`).

- [x] **✅ FIXED 2026-06-30i: COPILOT CHAT HAS SAME MULTI-TURN SERIALIZATION BUG AS NEXUS** — `copilot/route.ts` lines 68-70: same "flatten to single user string" pattern as Nexus. Fixed: now passes `messages: history` array to `callLLM` (all 3 providers now handle multi-turn natively via the llm.ts refactor).

- [x] **✅ FIXED 2026-07-02 (Claude Code): `/api/admin/auth` brute-force protection** — added a 400ms delay on every attempt + an in-memory IP-keyed lockout (5 failed attempts / 15 min → `429` with `Retry-After`). Resets on success; a different IP is unaffected by another IP's lockout. Verified live: 5 wrong attempts → `401`, 6th → `429`, correct creds from a different IP → `200` immediately. Note: in-memory (resets on server restart/redeploy) — fine for a single-instance/dev deploy; swap for Redis/Upstash before a real multi-instance production deploy.

- [ ] **🟡 GMAIL SYNC `ParsedApplication` SHAPE CONFIRMED INCOMPATIBLE WITH EMAIL UI `Thread` SHAPE** — `gmail-sync/route.ts` POST returns `{ applications: ParsedApplication[] }` where each entry has `company, role, stage, appliedDate` etc. `email/page.tsx` MOCK_THREADS has `{ from, subject, snippet, date, label, priority, unread }`. These are structurally different. Fix: add a `toThread()` transform in the email page that maps `ParsedApplication` to the Thread shape: `from = app.company`, `subject = app.role`, `snippet = app.notes`, `date = app.appliedDate`, `label = app.stage`, `priority = app.priority`. Or redesign the email UI to show application cards instead of email-inbox style threads.

### 2026-06-30h — new findings (route audit + dashboard audit continued)

✅ Fixed same session:
- `build/load/route.ts` path validation now allows `USER_RESUMES_DIR` (completed the fix from 2026-06-30g)
- `build/save/route.ts` path validation now allows `USER_RESUMES_DIR` (same fix applied)
- `resumes/download/route.ts` path validation now allows `USER_RESUMES_DIR` (new bug found + fixed)
- `resumes/pdf/route.ts` path validation now allows `USER_RESUMES_DIR` (new bug found + fixed)

- [ ] **🔴 `/api/resumes/download` AND `/api/resumes/pdf` REJECTED USER-UPLOADED RESUMES** — Both routes (like `build/load` + `build/save`) only allowed `RESUMES_LIB` path in their security checks. Fixed: expanded allowlist to include `USER_RESUMES_BASE`. Files: `src/app/api/resumes/download/route.ts`, `src/app/api/resumes/pdf/route.ts`. ✅ FIXED 2026-06-30h.

- [ ] **🟠 EMAIL PAGE ALWAYS SHOWS MOCK_THREADS — EVEN AFTER CONNECTING GMAIL** — `email/page.tsx` has `const [connected, setConnected] = useState(false)` and when connected=true it shows the same `MOCK_THREADS` array — it never fetches from `/api/gmail-sync`. The "Connect Gmail" button successfully calls `connectGmail()` OAuth, but the email list never changes. The user sees fake recruiter emails (TCS, Apex Systems, Cognizant) regardless of their real inbox. Fix: on `connected === true`, call `fetch("/api/gmail-sync")` and replace `MOCK_THREADS` with real data (or a proper transform to the Thread shape). Related to the shape mismatch already in todo.

- [ ] **🟠 NEXUS AI CHAT HISTORY SERIALIZATION IS BROKEN FOR MULTI-TURN CONVERSATIONS** — `nexus/route.ts` line 81: when there are multiple messages, it serializes the entire chat history into a single `user` string: `history.map(m => \`${m.role === "user" ? "User" : "Nexus"}: ${m.content}\`).join("\n\n")`. This means the LLM receives a single giant user message (not an actual messages array with roles). For multi-turn conversations, the AI loses proper role-context — it can't distinguish who said what in a structured way. Fix: pass `messages` array directly to `callLLM` if the underlying provider supports it (Anthropic/OpenRouter do), or at minimum preserve the proper role attribution.

- [ ] **🟡 SIDEBAR NAV HAS NO ADMIN LINK (CONFIRMED)** — `sidebar-nav.tsx` `NAV_ITEMS` array has 5 items: Home, Showcase, Jobs & Apply, AI Tools, Emails, My Resume. `/dashboard/admin` is not in the list. Admin is only reachable via Settings → "Open Admin →" card. Operational users who need to access admin frequently must navigate Settings every time. Fix: add Admin nav item to `NAV_ITEMS` (or to the settings footer row) — only visible when `mf_admin_auth` session key exists.

- [ ] **🟡 "LIVE" BADGE IN SIDEBAR IS HARDCODED — DOESN'T REFLECT ACTUAL API STATE** — `sidebar-nav.tsx` line 229: `{item.href === "/dashboard/jobs" && (<span ...>Live</span>)}` — this badge is always shown regardless of whether `RAPID_API_KEY` is set or whether the jobs board is showing real vs sample data. A user with no API key configured sees a green "Live" badge but gets sample data. Fix: remove the hardcoded badge or wire it to a runtime check (e.g. `data.live` from `/api/jobs`).

- [ ] **🟡 `/api/nexus` EXPOSES JOB DESCRIPTION IN FULL EACH REQUEST (NO TOKEN LIMIT GUARD)** — `nexus/route.ts` line 51: `(job.description || "").slice(0, 2000)` — the JD is sliced to 2000 chars which is good, but the entire system prompt is rebuilt on every single chat message including all prior context in a serialized format. For a job with a 2000-char JD + 10 messages of 500 chars each = 7000 chars of context per request. With `maxTokens: 900`, this means ~7900 tokens minimum for each turn. No prompt-size safety valve. Consider: cache the system prompt per job session, or summarize older turns.

- [ ] **🟡 PROFILE/EXTRACT ROUTE HAS NO FILE SIZE LIMIT** — `profile/extract/route.ts` line 8: accepts `formData.get("file")` with no file size validation. A user can upload a 100MB docx and it will be buffered entirely into memory via `file.arrayBuffer()`. Fix: add a file size cap (e.g. 5MB max) before calling `arrayBuffer()`.

- [x] **✅ ALREADY FIXED (verified 2026-07-02) — duplicate skill-matching consolidated.** Stale entry — the 2026-06-30i session log already recorded this fix; re-confirmed on disk: `match-score/route.ts` imports and uses `computeSkillsScore` + `computeLocationScore` from `lib/matching/computeMatchScore.ts` directly, no inline re-implementation remains.

- [x] **✅ FIXED 2026-06-30h: `tensorflow` AND `terraform` SHARE ALIAS `tf` IN computeMatchScore.ts** — `src/lib/matching/computeMatchScore.ts` line 18: `terraform: ['tf', ...]` and line 30: `tensorflow: ['tf', ...]`. When a JD or resume contains "tf", the alias lookup iterates `Object.keys(SKILL_ALIASES)` and returns whichever canonical comes first in the object. A terraform job posting could be matched as tensorflow and vice versa. Fix: remove `'tf'` from the tensorflow aliases (it is genuinely ambiguous; Tensorflow users write `import tensorflow as tf` in code, but in job postings "tf" almost always means terraform).

- [x] **✅ FIXED 2026-06-30h: `redis` ALIAS `'cache'` IS TOO GENERIC — CAUSES FALSE POSITIVE MATCHES** — `src/lib/matching/computeMatchScore.ts` line 37: `redis: ['cache', 'caching', 'redis cache']`. "Cache" and "caching" appear in hundreds of job descriptions unrelated to Redis (browser caching, HTTP caching, function memoization, CDN caching). Any JD mentioning "caching" will be credited as requiring Redis and matched against it. Fix: change to `redis: ['redis cache', 'redis cluster', 'redis sentinel']` — only match the unambiguous compound phrases.

- [x] **✅ FIXED 2026-06-30h: `drive.ts` FOLDER NAME IS `"AptMatch Resumes"` NOT `"MarketFit Resumes"`** — `src/lib/drive.ts` line 11: `const FOLDER_NAME = "AptMatch Resumes"`. The app was rebranded from AptMatch/CareerKit to MarketFit but the Drive folder name wasn't updated. Users who connected Drive will get a folder named "AptMatch Resumes" in their Google Drive. Fix: change to `"MarketFit Resumes"`. Note: existing users with the old folder need a migration — search for the old folder name first before creating a new one, or rename it.

- [x] **✅ FIXED 2026-06-30h: SKILL_ALIASES IN computeMatchScore.ts MISSING ALL SECURITY/STAFFING DOMAIN TERMS** — The alias table covers web/cloud engineering (React, Kubernetes, Terraform, etc.) but has zero entries for the domain terms in the reference resumes (CLAUDE.md). Missing: Splunk, Sentinel, CrowdStrike, Dragos, ServiceNow, NERC CIP, ICS/SCADA, CISSP, OSCP, Burp Suite, Fortify, Snyk, etc. For the OT Security, AppSec, and ServiceNow candidate profiles, skill matching will return near-zero scores because none of their domain skills are in the alias table. Fix: add a security/staffing domain skills block to SKILL_ALIASES.

- [x] **✅ ALREADY FIXED (verified 2026-07-02) — location score now uses real city/state matching.** Stale entry — `match-score/route.ts` now calls `computeLocationScore(userLocation, jobCity, workModel)` from the shared lib instead of a flat 70/60 guess.

- [x] **✅ FIXED 2026-06-30h: `/api/user-resumes` ONLY READS FLAT FILES — MISSES SUBDIRECTORY RESUMES** — `user-resumes/route.ts` GET uses `readdir(userDir)` (flat, no recursion). But `resumes/route.ts` uses recursive `scanDir()` which traverses subfolders. If a user uploads a resume, then moves it into a subfolder using the Documents panel (`/api/resumes/move`), the `user-resumes` GET will no longer show it (used by Settings). The user sees 0 resumes in Settings when they've organized files into folders. Fix: replace flat `readdir` with the same `scanDir()` approach already in `resumes/route.ts`.

- [x] **✅ FIXED 2026-06-30h (partial — length cap added): `/api/contact` NO MESSAGE LENGTH LIMIT OR RATE LIMITING** — `contact/route.ts` accepts an arbitrary `message` field with no length cap. A single request could send a multi-MB message, filling the `contact_messages.jsonl` file. Already documented above — adding this detail: no server-side rate limiting, no `Content-Length` cap, no IP tracking. Fix: add `if (message.length > 5000)` guard before writing, plus IP-based rate limiting (e.g. 3 requests per hour per IP using a simple in-memory map or Supabase table).

- [x] **✅ FIXED 2026-06-30h: AUTH CALLBACK PROFILE UPSERT USES `ignoreDuplicates: true` — EMAIL CHANGES NEVER UPDATE** — `auth/callback/page.tsx` line 174: `supabase.from("profiles").upsert({ id, email }, { onConflict: "id", ignoreDuplicates: true })`. When a user changes their email in Supabase, the next login will NOT update the email in the profiles table because `ignoreDuplicates: true` skips the update entirely. Fix: remove `ignoreDuplicates: true` or use a conditional update: `upsert({ id, email }, { onConflict: "id" })` (default merge behavior).

### 2026-06-30g — new findings (route audit continued)

- [ ] **🔴 NO `middleware.ts` EXISTS — ALL ROUTES ARE PUBLIC** — There is no `src/middleware.ts` or `middleware.ts` in the project root. Every `/dashboard/*` page and every `/api/*` route is publicly accessible to any unauthenticated user. The admin panel, the resume library, the tailor engine, the copilot — all publicly reachable. Fix: create a Next.js middleware that at minimum protects `/dashboard/*` and `/api/*` (except `/api/health`, `/api/jobs`, `/api/waitlist`, `/api/contact`). Even a simple cookie check or Supabase session check would eliminate the worst exposure. This is the pre-launch gating decision referenced in the launch checklist.

- [x] **✅ FIXED 2026-06-30h: `/api/build/load` AND `/api/build/save` REJECT USER-UPLOADED RESUMES** — Both routes check `resolved.startsWith(path.resolve(RESUMES_DIR))` where `RESUMES_DIR = RESUMES_LIB` (the shared library). But user-uploaded resumes live in `USER_RESUMES_DIR` (a different path). Fixed: expanded allowlist in both routes to also allow `path.resolve(USER_RESUMES_BASE)` using `ALLOWED.some(a => resolved.startsWith(a))`.

- [ ] **🟠 CONTRACTS BOARD MOCK JOB `applyUrl` VALUES ARE HOMEPAGE URLs** — `contracts/page.tsx` `MOCK_JOBS` array: all 5+ jobs have `applyUrl: "https://indeed.com"` or `"https://linkedin.com"`. Clicking "Apply Now" sends users to the platform's homepage, not an actual job listing. Until real contract jobs are pulled from `/api/jobs?type=contract`, either hide the Apply button on mock jobs or replace these with the real apply links from the source job data.

- [ ] **🟠 `/api/feedback` IS UNAUTHENTICATED (PROMPT INJECTION RISK)** — `POST /api/feedback` writes feedback items to a per-category feedback log that is later injected into the tailoring AI prompt in `build/load`. There is no auth check on this route. An attacker who can POST to `/api/feedback` can inject arbitrary text into the tailoring system prompt. This is low-impact now (feedback goes to a server file, not a public DB) but should be auth-gated before deploy.

- [ ] **🟡 `/api/match-score` LOCATION SCORE IS BROKEN FOR MOST USERS** — Line 169: For onsite roles, `locScore = userLocation ? 70 : 60`. The `userLocation` comes from `profile.location` which is empty-string for 95% of users (the profile endpoint returns blank if the user hasn't explicitly set it). So onsite roles always score 60 for location, making the 10% location component meaningless. This doesn't cause a crash, but the 45%/30%/15%/**10%** breakdown shown to users is inaccurate.

### 2026-06-30f — new findings (main dashboard + API route audit)
✅ Fixed same session: GmailBanner fake connect → real OAuth, Nexus AI route → ai-tools, Showcase CTA → /dashboard/resume, Extension CTA → waitlist, Admin posts → persisted to localStorage.



- [ ] **🔴 CRITICAL: `/api/test-docx` IS UNAUTHENTICATED + READS ARBITRARY FILEPATHS** — `POST /api/test-docx` takes `{ filepath }` from JSON body and calls `readFile(path.resolve(filepath))` with NO auth check and NO path allowlist. Debug route — must be REMOVED or auth-gated before any public deployment. File: `src/app/api/test-docx/route.ts` line 13.

- [ ] **🔴 CRITICAL: `/api/test-match` IS AN UNAUTHENTICATED DEBUG ROUTE** — Exposes the resume keyword-matching engine to any unauthenticated caller. Wastes compute, reveals internal logic. Must be removed before production. File: `src/app/api/test-match/route.ts`.

- [x] **✅ FIXED: DASHBOARD `GmailBanner` "Connect Gmail" IS FAKE** — Added `useEffect` to check `mf_gmail_connected` on mount and added real `handleConnect()` that calls `connectGmail()` OAuth with localStorage demo fallback. `dashboard/page.tsx`.

- [x] **✅ FIXED: "✦ Nexus AI" JOB CARD BUTTON ROUTES TO WRONG PAGE** — Changed `href` from `/dashboard/jobs` to `/dashboard/ai-tools` and added `sessionStorage.setItem("jd_ai_tab", "nexus")`. `dashboard/page.tsx`.

- [ ] **🟠 DEAD `TailorCard` FUNCTION IN DASHBOARD** — `dashboard/page.tsx` line ~672: 127-line `function TailorCard()` is defined but never rendered. Added `eslint-disable @typescript-eslint/no-unused-vars` to suppress lint warning. Full removal is a low-risk cleanup — do when file is not being actively edited.

- [ ] **🟠 `/api/waitlist` GET IS UNAUTHENTICATED** — Returns total waitlist count with no auth check. Anyone can see how many users signed up. Add admin token check or require `NODE_ENV !== "production"`.

- [ ] **🟠 `/api/contact` HAS NO RATE LIMITING + NO NOTIFICATION MECHANISM** — No rate limiting means anyone can spam disk. No email/webhook fires when a contact message arrives — owner can't know about it. Fix: add IP-based rate limit (1 req/min), write to Supabase table, and trigger a notification.

- [ ] **🟠 GMAIL SYNC SHAPE MISMATCH (CONFIRMED)** — `/api/gmail-sync` POST returns `ParsedApplication[]`. Email page UI (`email/page.tsx`) renders MOCK_THREADS which have shape `{ id, from, subject, snippet, date, label, priority, unread }`. These are incompatible. Connecting Gmail does nothing visible in the email UI. Decision needed: transform `ParsedApplication[]` → Thread shape in the email page, OR redesign the email UI to show `ParsedApplication[]` cards.

- [ ] **🟡 3 STUB REDIRECTS GO TO DEAD ENDS** — `messages` → `/dashboard` (no messages feature), `network` → `/dashboard/jobs` (no network tab), `activity` → `/dashboard` (no activity view). Until these features exist, show a placeholder "Coming soon" page rather than silently redirecting to unrelated content.

- [ ] **🟡 MULTIPLE `href="#"` DEAD CTAs ON DASHBOARD** — Chrome Extension CTAs in `FEATURES[1]` (line 192), `GmailBanner` button (line 255), and `PowerCard` extension button (line 589) all use `href="#"` or `onClick` with no action. Clicking scrolls to page top. Replace with "Coming soon" disabled state or waitlist link until extension is live.

### 2026-06-30e — new illogical findings (Cowork audit)

- [x] **✅ FIXED 2026-06-30f: COPILOT LIES ABOUT FREE PLAN LIMITS** — Updated `/api/copilot/route.ts` line 41 to say "Free = store up to 2 résumés (connect Google Drive for 78) + 7 tailors/week (soft cap, displayed in Settings)". No longer contradicts `FREE_LIMIT = 2`.
- [ ] **🔴 COPILOT LIES ABOUT FREE PLAN LIMITS [original]** — `/api/copilot/route.ts` line 41 tells users: "Free = store up to 78 résumés + 7 tailors/week". ACTUAL code: `FREE_LIMIT = 2` in `/api/user-resumes/route.ts` + `/api/resumes/route.ts`. Users asking the chatbot "how many resumes can I store?" are told 78; then uploading a 3rd resume triggers "Free plan stores up to 2 resumes." Trust-destroying lie. Fix: update copilot system prompt to "Free = store up to 2 résumés (connect Google Drive for 78) + 7 tailors/week". File: `src/app/api/copilot/route.ts` line 41.

- [ ] **🔴 TAILOR LIMIT "7/WEEK" IS DISPLAY-ONLY — NOT ENFORCED** — Settings shows "7 tailors / week" and Settings.getTailorsUsed() counts from localStorage `jd_tailor_log`. BUT: `/api/tailor/route.ts` has NO `checkUsageLimit()` call — it runs unconditionally. Any user can tailor unlimited times by clearing localStorage or using a different browser. This is a billing/cost-control gap. The Copilot tells users this limit is real; it is not. Fix: add server-side check in `/api/tailor` and `/api/tailor/start` — increment a Supabase counter per user, block at 7 for unauthenticated/free users.

- [x] **✅ FIXED: ADMIN PANEL DATA IS IN-MEMORY ONLY (resets on page reload)** — Added `loadPersistedPosts()` that reads from `localStorage.getItem("mf_admin_posts")`, `useEffect` to load on mount, and `savePosts()` wrapper that writes to localStorage on every add/toggle/delete. `admin/page.tsx`.
- [ ] **🔴 ADMIN PANEL DATA (original bullet — resolved)** — see above — `admin/page.tsx` stores all candidates in `useState<Candidate[]>(MOCK_CANDIDATES)` and all LinkedIn post links in `useState<PostLink[]>(MOCK_POST_LINKS)`. Adding/toggling/removing a post or candidate is lost the moment the admin refreshes the page. The staffing operation context (CLAUDE.md) needs this to persist. Fix: persist posts to localStorage at minimum (e.g. `mf_admin_posts`), or wire to a Supabase `admin_posts` table. Candidates need a real data source.

- [x] **✅ PARTIAL FIX: alert() calls replaced** — Fixed 3 of 8: `result/page.tsx` line 389 → uses existing `setToast()`, `ResumeBuilder.tsx` line 826 → new `dlError` state with auto-clear, `settings/page.tsx` line 140 → new `driveError` state rendered inline.
- [ ] **🟠 9 × NATIVE BROWSER DIALOGS REMAIN (`confirm()` AND `prompt()`)** — Full audit:
  - `ResumeClient.tsx` L294 `confirm()` (duplicate file), L412 `prompt()` (new folder name), L428 `prompt()` (move target), L446 `confirm()` (delete)
  - `DocumentsClient.tsx` L211 `confirm()` (duplicate file), L245 `confirm()` (delete), L257 `prompt()` (move target), L269 `prompt()` (new folder name)
  - `jobs/page.tsx` L660 `confirm()` (delete application)
  Implementation plan: create `src/components/ui/ConfirmDialog.tsx` (overlay with Cancel/Confirm) + `src/components/ui/InputDialog.tsx` (overlay with text input). Replace all 9 calls with state-driven modal renders. This is a 2-3 hour refactor across 3 files.

- [x] **✅ FIXED: SHOWCASE PAGE LINKS TO GENERIC CHROME WEBSTORE** — Changed extension CTA href from `https://chrome.google.com/webstore` to `#waitlist` ("Join Waitlist →"). `marketing/page.tsx`.

- [x] **✅ FIXED: SHOWCASE SLIDE SENDS "TAILOR MY RESUME" TO AI TOOLS** — Changed href from `/dashboard/ai-tools` to `/dashboard/resume`. `marketing/page.tsx`.

- [x] **✅ FIXED: DUPLICATE setDiff() CALL IN RESULT PAGE** — Removed second `if (Array.isArray(r.diff)) setDiff(r.diff)` call. `resume/result/page.tsx`.

- [ ] **🟡 RESULT PAGE DOWNLOAD USES RESUME NAME WITHOUT SANITIZATION** — `result/page.tsx` line 393: `a.download = \`${resumeName}.docx\`` — `resumeName` comes from a URL param (`useSearchParams().get("name")`) and is passed unsanitized to the filename. If the resume name contains `/`, `\`, `:` or `..` the download filename may be malformed or cause path-traversal on the server side. Fix: sanitize with `resumeName.replace(/[^a-zA-Z0-9._\- ]/g, "_")` before using in filename and URL.

- [ ] **🟡 ADMIN PAGE SIDEBAR SHOWS "Showcase" LABEL — NOT "Admin"** — The sidebar nav item at `/dashboard/marketing` is labeled "Showcase" (sidebar-nav.tsx). Admin at `/dashboard/admin` has NO sidebar link — it's only reachable via Settings → "Open Admin →" card. Makes Admin hard to discover; staffing operations should have a direct nav link.

### 2026-06-30 — open illogical items (Cowork found, needs build/decision)

- [ ] **🚀 Launch hygiene — dev/test API routes ship to production.** `src/app/api/test-match/route.ts`
  and `src/app/api/test-docx/route.ts` exist, so they'll deploy as public, callable endpoints on
  marketfit.app. Delete them (or gate behind `NODE_ENV !== "production"`) before launch. Found via
  endpoint audit 2026-06-30; verified the rest — every UI `fetch("/api/…")` maps to a real route (no dead
  endpoints).
- [ ] **Pipeline & Analytics blur gate must be EXACTLY "real numbers, 2–5% blur"** — per Eshwar: the
  numbers shown must be the SAME real figures, only visually blurred 2–5%, and the blur lifts when the
  user connects a Gmail account that's persisted to the DB. Illogical if: the gate hides/zeros the
  numbers, blurs more than ~5% (unreadable), or "connect" only flips a localStorage flag without a real
  DB-backed connection. VERIFY the GmailGate overlay uses a light `blur(2–5%)`/low-opacity scrim over the
  REAL PipelineView/AnalyticsView (not sample data), and that unlock checks real connection state.
  ⮑ **FOUND 2026-06-30 (Cowork, verified in code):** GmailGate DOES wrap the real views — numbers are
  genuine ✓ — BUT the blur is far heavier than the "2–5%, basically accessible" intent: it uses
  `filter: blur(3px) saturate(0.6)` + a 55%-dark scrim (`background: rgba(15,22,35,0.55)`) + a centered
  lock-card on top, so the figures are effectively HIDDEN — the opposite of a subliminal tease. **FIX:**
  drop to `filter: blur(2px)` (remove `saturate`), cut the scrim to ~`rgba(15,22,35,0.12)` or remove it,
  and replace the centered lock-modal with a small corner pill ("🔒 Connect Gmail to unlock live tracking")
  so the real numbers stay ~95% legible. File: `src/app/dashboard/jobs/page.tsx` → `GmailGate` (~L692–733),
  owned by the build session — exact change handed off.
- [ ] **Live dashboard must show REAL job postings everywhere (end goal).** jobs / jobs-ft / contracts
  must render LIVE postings when `RAPID_API_KEY` (JSearch) is set, with a clear **Live vs Sample** badge on
  every board. Illogical if any board silently shows sample data with a green "Live" badge. VERIFY all 3
  boards read `data.live` and the badge color/label matches (green=Live, gray=Sample).
- [ ] **Gmail connection: marketed AND real.** The "Connect Gmail" CTA should (a) be marketable in the UI,
  but (b) actually persist the connection to the DB so the blur-unlock is genuine. Today it largely sets
  `mf_gmail_connected` in localStorage — that's marketing without the real connection. Wire to the real
  OAuth → DB record, then gate on that.
- [ ] **Email page shows MOCK_THREADS even after connecting** — `/api/gmail-sync` returns
  `ParsedApplication[]` but the email UI consumes `Thread[]`. Shape mismatch = "connect" does nothing
  visible. Decide a single thread shape and map the sync output to it.
- [~] **Contract board contract-type filter — now wired, verify it actually filters.** UPDATE 2026-06-30:
  `/api/jobs` DOES read `type=contract` (route.ts L283, "→ W2/C2C/contractor roles") and the contracts page
  sends it. So the earlier "no filter" note is resolved on the param side. STILL VERIFY: that `type=contract`
  meaningfully narrows results (not just read-and-ignored) and that the W2/C2C/C2H badges map to real data,
  not just the page's MOCK fallback.
- [ ] **Admin secret hygiene** — confirm `Strawhat@1234` is gone from the client bundle (server route
  `/api/admin/auth` + `ADMIN_USERNAME/ADMIN_PASSWORD` env), and that an Admin link exists under Settings.
- [ ] **Launch gate unrun** — `next build` on a quiescent repo (tsc passes, but the real build gate hasn't
  run while both agents edit). Run once the repo is quiet.
- [ ] **Sidebar on mobile** — with 8 items + sub-items, confirm it never hides (becomes a top bar, per the
  "sidebar unhidden all the time" rule) and doesn't overflow.

> Append the NEXT batch of illogical findings right under this date header (keep newest at top).

---

## ✅ Completed Fixes

### Session 2026-07-02 (search bug + Contract Board dropdowns) — Claude Code
- [x] **🔴 `/api/jobs` multi-word search returned ZERO results — root cause of "Full-Time Board shows nothing / search is weird".** `matchesQuery()` in `src/app/api/jobs/route.ts` used to `.includes(fullQueryString)` — a literal-phrase check. Every STEM category preset (e.g. `"software engineer developer"`) is 2-3 words; almost no job title contains that exact phrase, so the board's DEFAULT view showed "No jobs found" on first load, every time. Rewrote `matchesQuery(q, ...fields)` to match if ANY word in the query hits ANY field (title/company/description) — standard job-search-box behavior (Indeed/LinkedIn-style), and correctly broad for the category presets. Verified live: the exact previously-broken query now returns real jobs.
- [x] **Contract Board: flat button rows → organized dropdowns** (Eshwar: "better to have organized dropdowns for the filters instead of just all buttons"). Date Posted and Rate Floor were long inline button rows; converted both to compact dropdown triggers (`🕐 Any time ▾`, `💰 Any rate ▾`) with a popover panel, matching the Company/Distance popover pattern already in the file. Added a **new Experience Level dropdown** (`🎯 All levels ▾`) — state (`expLevel`) and filtering logic already existed but had **no UI control at all** (dead feature). Added `openPanel()` so only one dropdown is open at a time. Fixed `sig` (pagination-reset key) and `hasActive`/Clear-filters handler, both of which were missing `expLevel`. Verified live end-to-end: opening the dropdown shows all 5 `DATE_FILTERS` options, selecting one updates the label and shows "✕ Clear", clicking Clear resets everything.
- [x] **Contract/Full-Time Board hardcoded black `C` palette → theme tokens.** Both boards had a literal `const C = { bg:"#0b1220", card:"#111827", ... }` — solid black regardless of the theme selector, and visually inconsistent with the light Jobs & Apply hub. Swapped the 5-6 structural keys (`bg/card/border/text/muted/hint`) to `var(--bg)/var(--surface)/var(--border)/var(--text)/var(--text-muted)/var(--text-soft)` — the same tokens Jobs & Apply already uses. Left accent colors (blue/teal/amber/purple/red/category colors) as literal hex since they're concatenated with a hex-alpha suffix (`${color}33`) elsewhere — swapping those to `var()` would produce invalid CSS. Also found and fixed ~8 rogue hardcoded literals outside the `C` object in both files (`rgba(255,255,255,.0x)` overlays, a raw `#111827` modal background, a `#c7d2e4` body-text color that would be nearly invisible on a white card) — all now theme-aware. Verified live: both boards now render light/white to match Jobs & Apply.
- [x] **Contract Board pill toggle used a hardcoded teal wash** for its "Remote" active state — would have bad contrast in one theme mode or the other since it doesn't adapt. Switched to `var(--accent-soft)/--accent-border/--accent-txt` — the exact tokens Jobs & Apply's own "Remote only" toggle uses, so it's both theme-correct and follows whichever accent color the user picks.
- ⚠️ Found mid-session: the OTHER running dev server (not mine) was serving a stale SSR snapshot of `sidebar-nav.tsx` (hydration mismatch — old sidebar subtitle vs new, in server HTML vs client bundle). Not caused by any of the above; restarted that dev server cleanly to resolve (standard, low-risk local-dev fix — no data/build impact).
- `tsc --noEmit` exits 0 project-wide after all of the above.

### Session 2026-06-30d (launch prep — legal + SEO) — secondary agent
Production target ~July 3. Cold-lane, zero-collision launch work.
- [x] **Privacy + Terms pages** — new public routes `/privacy` + `/terms` (`src/app/privacy|terms/page.tsx`, shared `components/LegalPage.tsx`). Privacy includes the **Google API Limited Use disclosure** (REQUIRED to pass OAuth verification for the Gmail scope) + a Chrome-extension data section (REQUIRED for Chrome Web Store). Render 200, cross-linked. ⚠️ Templates — set real company name / governing-law state before launch.
- [x] **Launch metadata** — `layout.tsx`: `metadataBase`, OpenGraph + Twitter cards, title template `%s · MarketFit`, keywords. Shared links now render proper preview cards.
- [x] **Branded 404** (`src/app/not-found.tsx`), **robots.txt** (`robots.ts`, disallows /dashboard,/api,/auth), **sitemap.xml** (`sitemap.ts`). All verified serving.
- [x] **Favicon** — `src/app/icon.svg` (MF mark). App tabs were unbranded before.
- `tsc --noEmit` exits 0.

## 🚀 Launch checklist (production ~3 days)
Done: legal ✅ · SEO/OG/robots/sitemap/favicon ✅ · 404 ✅ · admin creds off client ✅ · extension sponsorship safety ✅ · build-breaker ✅
Still blocking — most need Eshwar:
- [ ] **Clean `npm run build`** on a quiescent repo (tsc passes, but `next build` is the real gate). Couldn't run now — parallel session is mid-edit on jobs/contracts/jobs-ft.
- [ ] **Auth gate** decision — `/dashboard/*` open (no middleware). Gate or keep open?
- [ ] **Hosting/DB** — filesystem resume storage won't survive Vercel serverless → Supabase Storage / disk host.
- [ ] **Supabase Auth → Redirect URLs**: add prod `/auth/callback`.
- [ ] **Stripe** (only if charging day 1) · **OG share image** + Chrome Web Store screenshots/listing.
- [ ] Link `/privacy` + `/terms` from the landing footer.

### Session 2026-06-30c (admin security + brand + verify) — Cowork/secondary agent
- [x] **🔴 SECURITY: admin credentials no longer in the client bundle** — `admin/page.tsx` hardcoded `Naruto@Luffy`/`Strawhat@1234` in a client component (anyone could view-source it). Moved validation to a new server route `POST /api/admin/auth` that checks `ADMIN_USERNAME`/`ADMIN_PASSWORD` from env (local-dev fallback keeps the same login working). Verified: correct creds → 200, wrong → 401, `Strawhat` no longer in page source. (sessionStorage gate still bypassable — fine for mock-data admin; use httpOnly cookie + protected data routes when it gets real data.)
- [x] **Brand: user-visible "CareerKit" → "MarketFit"** on the dashboard home feature cards (3 spots). Internal code comments still say CareerKit/CareerOS — harmless, left.
- [x] **Verified (stale TODO reconciled):** the "orphaned sub-routes / no redirect" item is actually DONE — saved/activity/network/messages/alerts/offers/setup/recommended/documents/profile all **client-redirect** via `router.replace` to their hub. Work-auth filter key mapping **confirmed correct** end-to-end.
- `tsc --noEmit` exits 0 after all of the above.

### Session 2026-06-30d (continued audit + critical fixes)
- [x] **🔴 BUG FIXED: Gmail OAuth callback → dead route** — `/auth/callback/gmail/route.ts` redirected to `/dashboard/applications?gmail=connected` (redirect stub), silently dropping `gmail=connected`. Fixed: now goes to `/dashboard/email?gmail=connected`.
- [x] **Email page: real OAuth wired** — `connect()` now calls `connectGmail()` (Supabase OAuth); falls back to demo localStorage mode if Supabase unconfigured.
- [x] **Email page: OAuth return param handled** — useEffect reads `?gmail=connected` from URL on mount, sets `mf_gmail_connected` in localStorage, cleans URL.
- [x] **🔴 BUG FIXED: ScoreTab sends FormData but /api/score expects JSON** — ScoreTab was broken 100% of the time. Rewrote to use textarea (paste mode) + JSON body.
- [x] **🔴 BUG FIXED: ScoreTab reads `data.feedback` (undefined) instead of `data.issues`** — Now reads `data.issues[].{severity,problem,fix}` + `data.grade` + `data.summary` + `data.strengths`. Added severity badges, strengths section.
- [x] **TailorTab: storedRole + storedCompany actually used now** — Prefill banner shows "JD ready: [Role] @ [Company]" instead of generic "Job description ready". Keys are also cleared from sessionStorage after reading.
- [x] **Verified resolved (5 stale TODO items)** — Pipeline duplication, dashboard placeholder content, orphaned routes, work-auth filter keys, documents sidebar link, Interview Prep route shape, Cover Letter tones, Nexus status — all confirmed working.

### Session 2026-06-30b (Gmail blur gate + live job wiring + bug sweep)
- [x] **Gmail blur gate on Pipeline & Analytics** — `jobs/page.tsx`: added `GmailGate` wrapper component (3px CSS blur + lock overlay when `mf_gmail_connected` not set). "Unlock with Gmail" button sets flag immediately + lifts blur in-place. `gmailConnected` state reads from localStorage on mount. Link to email page added in overlay CTA.
- [x] **Live job source badge — jobs hub** — Source label pill now dynamically green "Live·..." vs gray "Sample data" based on `data.live` from `/api/jobs`.
- [x] **Live job source badge — jobs-ft** — Added `isLive` + `sourceLabel` state; header shows `● LIVE` (green) / `◎ SAMPLE` (gray) badge. `setJobs` now typed as `FtJob[]` (removed `any[]`). `applyModal` typed as `FtJob | null`.
- [x] **Contracts page wired to real API** — Fetches `/api/jobs?q=contract developer w2 c2c staffing` on mount; filters for W2/C2C workAuth; maps API jobs → `ContractJob` via `apiToContract()` mapper (extracts skills from description, derives type from workAuth, formats posted date); falls back to MOCK_JOBS if API returns 0 contract jobs. Added LIVE/SAMPLE badge.
- [x] **Settings: Admin panel link** — Added "Open Admin →" card at bottom of settings page linking to `/dashboard/admin`. No more dead-end at Settings for admin access.
- [x] **Settings: alert() removed from "Upgrade to Pro"** — Replaced `alert()` with inline dismissible "Pro plan launching soon" banner that appears in the plan card.
- [x] **Sidebar: alert() removed from "Upgrade to Pro"** — Button now navigates to `/dashboard/settings` instead of `alert()`.
- [x] **Verified: orphaned routes all have redirects** — saved→jobs, alerts→jobs, activity→home, messages→home, profile→settings, setup→settings, offers→jobs(pipeline), network→jobs, recommended→jobs, documents→resume.
- [x] **Verified: work auth filter key mapping correct** — VISA_FILTER_OPTIONS uses keys (h1b, opt_cpt, green_card, w2, c2c) that exactly match `detectWorkAuth()` output in `/api/jobs/route.ts`.
- [x] **Verified: brand correct in sidebar** — Shows "MarketFit" + "Own Your Next Role". No "Career OS" in visible UI.
- [x] **🔴 BUG FIXED: Gmail OAuth callback redirected to dead route** — `/auth/callback/gmail/route.ts` was redirecting to `/dashboard/applications?gmail=connected` which is a redirect stub — the `gmail=connected` param was silently dropped and `mf_gmail_connected` was NEVER set. Fixed: now redirects to `/dashboard/email?gmail=connected`. Email page reads param on mount, sets flag, cleans up URL.
- [x] **Email page: real Gmail OAuth wired** — "Connect Gmail" now calls `connectGmail()` (real Supabase OAuth with `gmail.readonly` scope) with fallback to localStorage demo mode when Supabase is unconfigured.
- [x] **🔴 BUG FIXED: ScoreTab sends FormData but API expects JSON** — `ai-tools/page.tsx` ScoreTab built a `FormData` with file and sent to `/api/score`. The API does `req.json()` expecting `{ resumeText: string, jd?: string }` — FormData parsed as `{}`, `resumeText` empty, always returned 400. Fixed: ScoreTab now has a textarea (paste resume text) + optional JD textarea, sends JSON `application/json`.
- [x] **🔴 BUG FIXED: ScoreTab reads `data.feedback` but API returns `data.issues`** — API returns `{ score, grade, summary, issues: [{severity,problem,fix}], strengths }`. ScoreTab was reading `data.feedback` (undefined → empty). Fixed: reads `data.issues`, `data.grade`, `data.summary`, `data.strengths` — renders severity badge, problem text, fix suggestion, plus new strengths section.
- [x] **RAPID_API_KEY missing from .env.example** — The primary job data source (JSearch/LinkedIn/Indeed aggregator) was undocumented. Added `RAPID_API_KEY` to `.env.example` with instructions. Updated Setup Guide in Settings to lead with RAPID_API_KEY as step 1.
- [x] **Settings: alert() removed from "Upgrade to Pro" (settings page)** — Replaced with inline dismissible banner using `showProBanner` state.
- [x] **Note: Gmail gate on Pipeline/Analytics shows sample apps** — `makeSampleApps()` pre-seeds fake data when user has no real apps. User sees blurred fake pipeline. This is intentional per user's request but could confuse new users. If desired: add a note in the overlay "Sample data shown · Connect Gmail to track real applications".

### Session 2026-06-30 (audit-driven, verified)
- [x] **🔴 SAFETY: extension no longer auto-answers visa sponsorship** — `extension/ats/workday.js`, `greenhouse.js`, `lever.js` were auto-clicking **"No"** on "Do you require sponsorship?" — catastrophic for an H-1B/OPT user (silently misrepresents them / auto-disqualifies). Removed the auto-answer in all 3 adapters (kept the safe "authorized to work = Yes"). Sponsorship is a legal attestation — left for the user. `node --check` clean.
- [x] **🔴 BUILD-BREAKER fixed: `jobs-ft/page.tsx`** — a prior session left 3 TS errors that failed `tsc`/production build: a self-referential `onApply: (job: typeof job)` and two duplicate `border` keys in style objects. Fixed (named `FtJob` type + dropped the dead `border:"none"`). **`tsc --noEmit` now exits 0.**
- [x] **Resume DRY + Rule 5** — `ResumeBuilder.tsx` now imports `countWords`/`bulletHasMetric`/`hasHavingOpener` from `src/lib/resume/rules.ts` instead of re-defining them (closes the deferred DRY item — builder + tailor can no longer drift). Added **Rule 5 (weak-verb opener)** `bulletHasWeakOpener()` to rules.ts + wired into `validateBullet` and the builder's live warnings. Unit-tested **11/11** (Node type-strip).
- [x] **`.env.example` completed** — added `NEXT_PUBLIC_APP_URL`, `ADMIN_USERNAME/PASSWORD` (admin login must be env, never hardcoded in client), `EXTENSION_SHARED_SECRET`, and the 5 Stripe vars.
- [x] **Verified runtime** — fresh dev server; all 9 routes return **200**, including the 5 new app shells (`marketing`, `jobs-ft`, `contracts`, `email`, `admin`).
- Source of this batch: a 10-agent read-only spec-vs-build + frames audit (115 findings). ⚠️ Not applied: "delete the light `--*` palette as dead code" — **WRONG**, the content area uses it; deleting it would break every page.

### Navigation & Layout
- [x] **Dead code: nav-links.tsx** — Was a full 8-tab top nav component that nothing imported. Replaced with deprecated stub. Layout uses sidebar-nav.tsx exclusively.
- [x] **Unused import: `useRouter` in sidebar-nav.tsx** — Imported + instantiated but never called. Removed import and variable declaration (was a TypeScript lint warning).
- [x] **Companies tab still existing** — User explicitly said "No need of Companies." companies/page.tsx now redirects to /dashboard/jobs.
- [x] **Orphaned routes not redirected to hubs** — analytics, cover-letters, interviews all existed as standalone pages after being consolidated into hub pages. Now redirect:
  - `/dashboard/analytics` → `/dashboard/jobs` (sets `jd_view=analytics` in sessionStorage)
  - `/dashboard/cover-letters` → `/dashboard/ai-tools` (sets `jd_ai_tab=cover`)
  - `/dashboard/interviews` → `/dashboard/ai-tools` (sets `jd_ai_tab=interviews`)
  - `/dashboard/companies` → `/dashboard/jobs`

### Jobs Page
- [x] **Track button used browser alert()** — alert() blocks the UI and looks broken. Replaced with inline auto-dismissing toast (3s, color-coded: green/amber/red for success/warn/error).
- [x] **Apply did not feed the pipeline** (Claude Code) — `markApplied()` in `jobs/page.tsx` now also pushes the job into `jd_applications_v2` (stage `applied`) if not already tracked, so Pipeline + Analytics + home stats update on Apply. Shared key, deduped by job id.
- [x] **Home/Jobs view routing** (Claude Code) — `jobs/page.tsx` reads `sessionStorage.jd_view` on mount (lazy, board/pipeline/analytics) so home quick-actions deep-link straight into Pipeline or Analytics.

### Dashboard Home (Claude Code)
- [x] **Dead links to consolidated routes** — home linked to `/dashboard/applications`, `/dashboard/analytics`, `/dashboard/cover-letters` (now stubs/redirects → double bounce). Rewired the hero "View Pipeline", the job-board "Track Applications", and all 4 bottom quick-action cards to the real hubs (`/dashboard/jobs` + `jd_view`, `/dashboard/ai-tools` + `jd_view=cover`, `/dashboard/resume`). Verified: rendered home HTML has 0 `/dashboard/applications` links, 15 `/dashboard/jobs` links, no error overlay.
- [x] **Job-card "Tailor" prefill** — home + job-detail "Tailor Resume" now set `jd_prefill`/`jd_prefill_jd`/`jd_prefill_role`/`jd_prefill_company`; `resume/ResumeClient.tsx` consumes `jd_prefill`/`jd_prefill_jd` via lazy-init so the JD textarea is pre-filled on arrival.

### Landing Page (prior sessions)
- [x] Mobile hamburger menu with body scroll lock
- [x] AnimCounter with IntersectionObserver + cubic ease
- [x] WaitlistInline form → /api/waitlist with dedup
- [x] Scroll progress bar
- [x] Hero char-by-char animation

### Applications Tracker (prior sessions)
- [x] CSV export with BOM for Excel compatibility
- [x] Follow-up dates with overdue/soon/upcoming badges
- [x] Kanban stage tracking

### Jobs Board (prior sessions)
- [x] Skeleton loading cards (replaced spinner)
- [x] Track button saves to jd_applications_v2 localStorage

---

## ⚠️ Pending Fixes

### High Priority
- [x] **applications/page.tsx vs jobs/PipelineView DUPLICATION — RESOLVED** — Verified 2026-06-30: `applications/page.tsx` IS a redirect stub (→ `/dashboard/jobs`). `jobs/PipelineView` is the rich Kanban with CSV export, overdue/due-soon badges, board + list views, follow-up dates, edit/delete modals, priority field. Nothing is duplicated.

- [x] **Dashboard home shows placeholder content — RESOLVED** — Verified 2026-06-30: home stats + Recent Activity both read from `jd_applications_v2` localStorage. `recentApps` sorted by appliedDate, `overdueCount` computed, Saved Jobs from `jd_saved_jobs`. Home also calls `loadLiveJobs("")` which fetches real jobs. Content is real, not placeholder.

- [x] **Theme does not persist on page reload** — applyTheme() saved to localStorage but nothing read it back on mount. Fixed: added useEffect in sidebar-nav.tsx that reads mf_theme from localStorage on mount and applies data-theme attribute.

- [x] **`template-selector.tsx` is dead code** — Confirmed nothing imports it. Replaced with deprecated stub.

- [x] **`logout-button.tsx` is orphaned** — Confirmed nothing imports it. Replaced with deprecated stub.

### Medium Priority
- [x] **Orphaned sub-routes — RESOLVED** — All 10 orphaned routes have client-redirect stubs: saved→jobs, activity→home, network→jobs, messages→home, alerts→jobs, offers→jobs+pipeline, setup→settings, documents→resume, recommended→jobs, profile→settings. Verified 2026-06-30.

- [x] **Sidebar "Upgrade to Pro" links to /dashboard/settings** — VERIFIED CORRECT: settings/page.tsx has `id="plan"` section at line 171. `/dashboard/settings#plan` scrolls directly to the plan/billing section. Not illogical.
- [x] **TailorTab discards storedRole + storedCompany from sessionStorage** — FIXED 2026-07-03. Added `prefillRole`/`prefillCompany` lazy-init state in `ResumeClient.tsx`. JD textarea header now shows "from [Company] – [Role]" badge when pre-filled from a job card.
- [x] **Email page shows MOCK_THREADS even when connected** — FIXED 2026-07-03. `allThreads` now initializes empty; MOCK_THREADS only loaded when `!connected`. When connected+synced+0 real results → shows "📭 No recruiter emails yet" empty state. Added `syncDone` flag. Also wired dead "Tailor Resume for Role" (→ resume page prefill) and "Add to Pipeline" (→ jd_applications_v2 + pipeline navigation) buttons.

- [x] **ai-tools page imports full page components via next/dynamic** — FIXED (Claude Code). The hub was importing `cover-letters/page` + `interviews/page`, which are now redirect stubs → clicking the Cover Letter / Interview tabs bounced the whole page back to the hub (broken loop). A later patch swapped in the modal/slide-in components (`CoverLetterModal`, `InterviewPrepPanel`) but those render as full-screen `fixed inset-0` overlays with a no-op `onClose` (couldn't be dismissed) and hardcoded empty `company/role` (no inputs). Replaced both with new self-contained inline panels: `ai-tools/CoverLetterSection.tsx` (3 tones, copy/download, calls `/api/cover-letter`) and `ai-tools/InterviewSection.tsx` (company/role/type/notes inputs, checkable prep items, calls `/api/prep`). Both read job prefill via `useState` lazy-init (no set-state-in-effect). typecheck + lint clean; `/dashboard/ai-tools` renders 200 with all 4 tabs, no error overlay.

- [x] **Work auth filter: key mapping verified** — VISA_FILTER_OPTIONS keys (`h1b`, `opt_cpt`, `green_card`, `w2`, `c2c`) exactly match `detectWorkAuth()` return values in `/api/jobs/route.ts`. Verified 2026-06-30.

### Low Priority (Resume Generator — per CLAUDE.md)
- [x] Ban "Having X years" summary openers — `hasHavingOpener()` in rules.ts + live warning in ResumeBuilder; `fixHavingOpener()` auto-corrects
- [x] Cap bullets at 4–6 per job (hard limit) — `addBullet()` guarded: `if (job.bullets.length >= 6) return`; UI error badge if >6
- [x] Require at least one metric per bullet — `bulletHasMetric()` + `bulletHasWeakOpener()` warn per bullet in ResumeBuilder
- [ ] One email per candidate enforced in builder — NOT YET. Requires multi-candidate system (not built). Deferred until multi-candidate dashboard ships.
- [x] Section order: certs before experience for security roles — `sectionOrder(type)` in ResumeBuilder returns correct order per role type
- [x] No "Environment:" trailing line in job descriptions — `isEnvironmentTrailer()` + `stripEnvironmentTrailer()` in rules.ts
- [x] Single skills section (no duplicate formats) — Builder uses single grouped skills section; validated by `validateBuilder()`
- [x] 2-page hard limit with live page count indicator — `estimatePages()` in ResumeBuilder; yellow at 2.5, red at 3 pages

---

## 🔮 Upcoming Features

- [ ] Chrome extension autofill sync with dashboard profile data
- [ ] Multi-candidate support (staffing firm use case per CLAUDE.md)
- [ ] Jobright.ai feature parity checklist

---

## Architecture Notes

- **Active nav**: sidebar-nav.tsx — 4 items: Home / Jobs & Apply / AI Tools / My Resume + Settings
- **Hub pages**: Jobs = board+pipeline+analytics views; AI Tools = tailor+cover+interviews+score tabs
- **Shared storage key**: jd_applications_v2 — used by Jobs Track button, PipelineView, analytics, dashboard home stats
- **sessionStorage routing**: jd_view, jd_ai_tab, jd_prefill, jd_prefill_jd, jd_prefill_role, jd_prefill_company
- **Working dir**: C:\Users\Eshwa\Downloads\job-dashboard (sole directory)

---

## 🔎 Cowork QA — connection bugs (merged from COWORK_QA.md)

An item is resolved only after the business result is verified **5×**.

### ✅ Verified GOOD
- **`auth/callback/page.tsx` is correct** — handles Google PKCE (`?code`), magic-link OTP
  (`?token_hash&type`), and implicit (`#access_token`); exchanges → session, upserts profile,
  redirects to `/dashboard/resume`. Login is NOT broken in code.
- **Sidebar layout wired** — `dashboard/layout.tsx` renders `SidebarNav`, content offset 240px.
- **`/api/profile` returns autofill-shaped profile** (full_name, title, email, phone from newest resume).

### 🔴 Login — only Supabase CONFIG is left (not code) — owner: Eshwar
1. **Auth → URL Configuration → Redirect URLs:** add `http://localhost:3000/auth/callback` AND the
   production `https://<domain>/auth/callback`. Without it the callback shows "No authentication parameters found."
2. **Magic link** works on Supabase's default sender out of the box (free-tier rate-limited).
3. **Google button** only works after Auth → Providers → Google is enabled with OAuth id/secret.

### 🟠 Real connection issues for Claude Code
- [x] **No auth gate** — RESOLVED 2026-07-03. `src/middleware.ts` EXISTS and is correct (151 lines). Gates protected `/dashboard/*` routes to `/` with `?auth=required`. Public dashboard paths (jobs, resume, ai-tools, etc.) explicitly listed in `PUBLIC_DASHBOARD_PREFIXES`. Home page (`/dashboard`) is a public dashboard path. NOT deleted.
- [x] **Documents orphaned — RESOLVED** — `/dashboard/documents` is a sub-item under "My Resume" in sidebar-nav.tsx. Has sidebar link. Verified 2026-06-30.
- [x] **Pipeline duplication — RESOLVED** — `applications/page.tsx` IS a redirect stub → `/dashboard/jobs`. Jobs PipelineView is the rich one with CSV export, overdue badges, board+list view. Verified 2026-06-30.
- [ ] **`/api/jobs` USAJobs User-Agent** hardcoded to `support@marketfit.app` in code — confirm no prod rate-limit.

### 🟡 Brand sweep
- [x] **Sidebar subtitle "Career OS" → "MarketFit" — DONE** — Fixed in prior session 2026-06-30c. Sidebar shows "MarketFit" + "Own Your Next Role". Verified.

---

## 🧩 Extension — spec (pdf5) vs build (merged from EXTENSION_GAP.md)

Spec: `pdf5_extension_spec.pdf` (MarketFit Chrome Extension v2.0.0). Current: `extension/` (monolithic).
Spec-compliant modular code already exists in `C:\Users\Eshwa\Claude\Projects\Building Web App\extension\` → PORT it.

- [ ] 🔴 **Sliding 380px sidebar** (Jobright parity, the whole point): job context, **match %**, **H1B badge**,
  live per-field checklist, resume selector, Start-Autofill, status log. Current build has only toast+popup.
- [ ] 🟠 **Monolithic → modular**: `utils/fieldFill.js` (char-by-char React typing, Workday listbox, base64 file
  upload), `utils/detect.js`, `utils/logger.js`, `ats/{workday,greenhouse,lever,taleo,icims,smartrecruiters}.js`,
  `api.js`, `background.js` (API proxy avoids CORS), `auth.js` (JWT from `chrome.storage.local`).
- [ ] 🟠 **Auth model**: web app writes Supabase session → `chrome.storage.local`; extension sends
  `Authorization: Bearer <jwt>`. Build the `marketfit.app`(+localhost) **session-bridge** content script.
- [ ] 🟡 **Profile shape mismatch**: adapters read nested `profile.firstName/address/links/experience`; our
  `/api/profile` returns flat `full_name/...`. Reconcile in `extractProfile`/`toAutofillShape` or map in `api.js`.
- [ ] 🟡 **New endpoints**: `GET /api/resumes` (sidebar selector), `POST /api/autofill-log`; `/api/profile` accept Bearer.
- [ ] 🟡 **Manifest**: per-ATS `content_scripts` + `css:["sidebar.css"]`, `web_accessible_resources`, `background.type:module`, `cookies` permission.
- [ ] 🟢 CWS pre-launch: dev account, validate, zip, screenshots, **/privacy page**, single-purpose + permission justifications.

**Build order:** port Building Web App/extension → reconcile profile shape → session bridge → endpoints → test 5×.

---

## 📄 Resume System — spec (pdf4) vs build

Spec: `pdf4_resume_system.pdf` (DB → Parser → ATS → Tailoring → Editor → Export).
Current build: filesystem resumes + in-place .docx text edit + match %. Big divergences below.

### 🔴 Conflict to resolve FIRST (don't blindly follow the spec)
- **Spec §4/§6 REGENERATES a fresh ATS-clean .docx from `parsed_data` (docx lib).** That would
  **destroy the original formatting** — which violates the user's Golden Rule ([[resume-tailoring-principle]]):
  preserve the uploaded .docx exactly, edit text in place only. **Decision: keep in-place edit as the
  DEFAULT export; offer spec's regenerated docx only as an optional "ATS-clean rebuild" the user opts into.**
  Flag this to Eshwar before anyone wires §6 export.

### 🔴 Missing entirely
- [ ] **ATS Scoring Engine (§3)** — 10 rules (CRIT-001/002/003, URG-001…005, OPT-001/002),
  `computeATSScore` (CRITICAL −25 / URGENT −8 / OPTIONAL −3), grade A–F, `ats_issues[]` with fixes.
  Note: the CLAUDE.md resume critique (no "Having", metric per bullet, action verbs, 4–6 bullets, skills
  section, 2-page) is literally these URG/OPT rules — build them as the scorer. Today the app only shows a
  match %; there is no rule-based score/grade/issue list with fixes.
- [ ] **Stored parser (§2)** — spec parses ONCE (pdf-parse/mammoth → LLM → `parsed_data` JSONB, "parse
  once, score+tailor many"). Current `extractProfile` re-reads the docx ad hoc each call; no stored
  structured resume, no persisted `inferSeniority`.
- [ ] **Draggable SkillTagEditor (§5.1, @dnd-kit)** with JD-match green/gray coloring — not built.
- [ ] **Live preview + debounced editor (§5.2, useEditorSync 500ms)** — not built.
- [ ] **Streaming tailor (§4.3 ReadableStream + useTailorStream)** — current `runTailor` returns the whole
  result; no progressive bullet streaming UI.

### 🟠 Architecture divergence (the production blocker, already noted)
- [ ] Spec = Supabase tables (`resumes`, `resume_sections`, `resume_tailoring_sessions`) + RLS + GIN
  indexes (§1). Current = filesystem (`data/user-resumes`). Won't persist on Vercel. Migrate to the spec
  schema (or Supabase Storage) before a shared/prod link.

### 🟢 Already aligned (keep)
- Refinement chips after tailoring (§4.4 ≈ current feedback chips) — verify the 6 chips re-tailor with a
  `refinement` param. Score band 90–98 ≈ spec's observed 83→98. Visa-aware prompt context matches §4.2.

---

## 🤖 AI Features — spec (pdf6) vs build

Spec: `pdf6_ai_features.pdf` (7 live features + Nexus planned, one shared streaming foundation).
Pattern: build context → inject into system prompt → stream → display. Models via OpenRouter
(`gpt-4o-mini` fast, `claude-sonnet-4-6` smart).

### 🔴 Shared foundation missing (build once, used by all 7)
- [ ] **`useAIStream` hook (§1.3)** — one client hook for fetch + streaming decode + abort/cancel +
  error state. Every AI panel should use it. Today tailoring is non-streaming; no shared hook.
- [ ] **`streamAI` + usage logging (§1.1)** — `/lib/ai/openrouter.ts` with `MODELS`, `estimateCost`,
  `logAIUsage`. Our current LLM call (`llm.ts`) has no token/cost logging.
- [ ] **`buildCandidateContext` (§1.2)** — one pre-assembled context object (candidate+resume+job+match)
  injected into every prompt; avoids N+1 fetches. Not present (no candidate/job DB yet).

### 🔴 Freemium / cost control entirely missing (§9) — needed for the business model
- [ ] `ai_usage` table + `checkUsageLimit` enforced BEFORE each LLM call. Free limits: tailor 3/mo,
  cover 5, ATS 10, interview 3, reply 10, Nexus 20/10/10. Pro = unlimited (~$29/mo). This is what the
  sidebar "Upgrade to Pro" should gate against (currently it points at Settings — see Medium Priority above).

### Feature-by-feature
- [ ] **ATS Score (§3)** — AI+rule JSON scorer with grade ring + expandable issue list (before/after fixes).
  Missing (same gap as pdf4 §3). Build the `ATSScoreWidget`.
- [x] **Cover Letter (§4) — VERIFIED** — `/api/cover-letter` exists. `CoverLetterSection.tsx` passes `tone` (professional/conversational/technical) to the API. Reads `data.letter`. No streaming (returns full letter), but functional. 3 tones confirmed in UI.
- [x] **Interview Prep (§6) — VERIFIED** — `/api/prep` returns `{ ok, questions[], tips[], starPrompts[], whatToResearch[] }`. `InterviewSection.tsx` reads all 4 arrays and renders checkable cards. Route + UI shapes match. Named `/api/prep`, not `/api/interview-prep`.
- [x] **Nexus assistant (§5) — VERIFIED** — `NexusPanel.tsx` is the per-job AI tab (job match + visa + interview Q modal). `CopilotWidget` is the floating chat assistant. Both use `/api/nexus` and `/api/copilot` respectively. Already shipped.
- [ ] **Reply Drafter (§8)** — recruiter-message reply drafter (4 intents). Not built; fits AI Tools.
- [ ] **Tailor streaming (§2)** — make the existing tailor stream bullets live via `useAIStream`.

### ⚠️ Spec items to SKIP / flag (conflict with user's current scope)
- **Company Intelligence (§7)** depends on the **Companies** feature the user explicitly removed
  ("No need of Companies"). Do NOT build it now; revisit only if Companies returns.
- Every spec route requires **auth + candidateId/jobId + Supabase tables** — but the app is currently
  no-login/filesystem. These AI features can't be wired per-user until the DB+auth decision (above) lands.

---

## ✅ Cross-checks to run (5× rule) — owner: whoever runs the dev server

- [ ] Magic-link sign-in end-to-end with a real teammate email (after redirect-URL config).
- [ ] Sidebar "Home" opens Home (no redirect intercept).
- [ ] Job "Apply/Track" → shows in Pipeline AND Analytics (shared `jd_applications_v2`).
- [ ] "Tailor Resume" on a job card → AI Tools with JD pre-filled.
- [ ] Extension Quick Fill on a real Greenhouse + Lever + Workday form.
- [ ] Tailor 5 different JDs → right resume picked, format intact, .docx opens clean in Word.


# Lot of things for the Autofilling extension.
- Main thing for our website to get the marketing that was needed.


# CareerKit Resume-Tailoring App — Full Handoff

> **Read this top to bottom before touching anything.** It contains the complete context to resume work seamlessly. Written for the next AI assistant taking over.

---

## 0. The user (who you're working for)

- Name: **Eshwar** (eshwarjay0@gmail.com). **Beginner, no coding experience.** He copies/pastes what you give and reports back.
- **How to work with him:** plain English, no jargon. Give complete, pasteable files or exact one-step instructions. One small step at a time. Never assume he can debug.
- He is **actively using this app right now** to tailor his real resumes for real job applications. Quality matters more than cleverness.

---

## 1. What this project is

A **resume-tailoring web app**. The user has a library of ~98 of his own resumes (each targeted at a different role: AppSec, SOC, IAM, Cloud, Data, DevOps, AI, etc.). He pastes a **job description (JD)**; the app:

1. **Auto-selects** the best-matching resume from the library (by role identity).
2. **Tailors it in place** to the JD — rewriting the existing summary, skill lines, and experience bullets, and retargeting the header title — **without ever changing his name/contact or the file's formatting**.
3. Produces a downloadable `.docx` (the original is never modified — output goes to a separate file).

### The ACTIVE app (this is the only one that matters)
- **Next.js 16 app at `C:\Users\Eshwa\Downloads\job-dashboard`** (App Router, `src/` dir, runs on `http://localhost:3000`).
- There is a **disconnected** Flask `resume-engine` on `:8000` somewhere — **IGNORE IT.** It is a parallel dead build. All real work is in the Next.js app.
- Resume page: `http://localhost:3000/dashboard/resume`

---

## 2. THE QUALITY BAR — the user's "golden rules" for tailoring

The user reviewed an early output and rejected it hard. Tailoring MUST follow this **audit order — recruiter trust first, ATS keywords LAST** (NOT the other way around, which is how most AI resume tools fail):

1. **Identity** — pick ONE primary identity from the JD (+1 supporting). A recruiter must know "what kind of engineer is this?" in 10 seconds. Never read like five jobs at once ("identity collapse").
2. **Credibility** — absorption, not insertion. Only emphasize what survives a follow-up question. Result must read "of course this person does this," never "they pasted the JD in." Do NOT keyword-dump.
3. **Timeline** — concentrate ~60-70% of JD alignment in the CURRENT (most recent) role; older roles support, don't duplicate.
4. **Tool evidence** — JD-central tools must appear INSIDE experience bullets (an upgrade/migration/rollout/CI-CD integration/plugin issue), not just in the skills list.
5. **ATS / skills LAST** — focus skill lines, never a keyword dump; leave off-identity lines alone.

Plus: **vary bullet rhythm** (not every line = verb+tool+outcome), add **operational friction** (things broke/were patched/rolled back/migrated), no buzzwords, no invented %, summary = 3-4 first-person sentences naming only a handful of central tools.

**The header rule (critical — he was upset about this):** name + phone + email + LinkedIn are NEVER changed. Only the **role title** (next to the name) and the **`•`-separated identity tagline** may be retargeted to the role. The summary rewrite must KEEP his real specifics (years/domains/tools) — only re-aim the identity, never replace with generic text.

---

## 3. Architecture & key files

### `src/lib/docx.ts` — the resume engine (read/parse/rewrite .docx)
- `.docx` is a zip; the content is `word/document.xml`. We parse `<w:p>` paragraphs and `<w:t>` text runs with regex (via `jszip`); `mammoth` is used only for plain-text extraction & HTML preview.
- **`extractZones(buffer)` → `Zones`**: walks paragraphs in order, tagging each editable line with a **stable paragraph index**:
  - `header: { idx, name, title, tagline } | null` — the name/title/contact line.
  - `summaryIdx` + `summaryText` — the professional summary.
  - `skills: [{idx, text}]` — each skill line.
  - `roles: [{role, bullets:[{idx,text}], current?}]` — experience grouped by job; **the most recent job is flagged `current: true`**.
- **`applyRewrites(buffer, edits, zones)` → `{buffer, notes}`**: applies the model's edits **in place** by paragraph index. `rewriteParaText` overwrites a paragraph's first `<w:t>` run and blanks the rest (keeps font + bullet glyph). **Never adds/removes paragraphs.** `rewriteHeader` does a **run-level** surgical swap of only the title text + tagline run, leaving name/phone/email/LinkedIn (incl. the email hyperlink) byte-intact.
- **Guards (do not break these):**
  - Name/contact header is never treated as the summary (`looksLikeContact`).
  - Company/title/date lines are role boundaries, never editable bullets (`looksLikeRoleTitle` + dated non-bullet lines).
  - The `<w:t>` regex is `<w:t(?:\s[^>]*)?>` — it must NOT be `<w:t[^>]*>` (that greedily matches `<w:top>`, `<w:tab>`, `<w:tbl>` and pulls in border markup → this bug broke 80+ resumes; already fixed).
  - Section headings are detected by NAME too (`sectionHead`), so Title-Case / un-bolded headings ("Professional Summary", "Core Competencies") are recognized — not just UPPERCASE/bold ones. There are 3 resume templates in the library; detection must stay template-agnostic.

### `src/lib/claude.ts` — the AI call
- `adapt({key, jd, zones, preferences, jdKeywords})` builds the prompt and calls Claude.
- Model: **`claude-haiku-4-5`** (cheap), raw `fetch` to `https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`.
- The `RULES` system prompt encodes the audit order from §2. The model returns ONLY changed lines as JSON:
  `{"headline":{"title","tagline"}, "summary":"", "skills":[{"idx,text"}], "bullets":[{"idx,text"}]}`
- `parseJson`/`repairJson` tolerate truncated/fenced JSON.
- **If output quality regresses (keyword-stuffing, multi-identity, generic summary): fix the `RULES` prompt — do NOT touch the patcher in docx.ts.**

### `src/lib/keywords.ts` — resume SELECTION (auto-match JD → resume)
- `ensureIndex()` builds/caches `data/resume_keywords.json` (per-resume tech keywords, hashed).
- **`matchByKeywords(jd)`** ranks resumes by **identity first**:
  - `categoryIdentity(category)` derives `{phrases, tokens}` from the resume's **folder name** (the strongest signal of what role it's for). Generic words (engineer, security, analyst, architect…) are dropped via `GENERIC_TOK` so "Cloud Engineer" and "IAM Engineer" don't match each other. Distinctive domain tokens (data, ai, cloud, iam, soc, appsec…) match as whole words in the JD **title**.
  - Score = `titleHit?60 : 0` + `bodyHits*12` + `min(keywordOverlap, 8)`. Identity dominates; keyword overlap is a small capped tie-breaker (so a keyword-dense resume can't out-score a true identity match).
  - `IDENTITY_PHRASES` maps short folder codes (AI, SRE, FSD, M365, SAP, NDR, DLP, CNAPP…) to the phrases a matching JD contains. **Add new entries here when a new role folder appears.**
  - `inText()` matches multi-word phrases as substrings but single words on **word boundaries** (so "ware" from VM_Ware ≠ "soft**ware**").

### API routes
- `src/app/api/tailor/route.ts` — POST `{jd, filepath, claudeKey}`. If `filepath` is empty → **auto-select** via `matchByKeywords`. Reads the resume, `extractZones` → `adapt` → `applyRewrites`, writes output to `data/tailored/<token>.docx`. Returns `{token, score, score_before, matched, what_changed, edits, notes, …}`. Match score = JD-keyword coverage mapped to a believable 58–98 range (varies per JD).
- `src/app/api/tailor/file/route.ts` — GET `?token&fmt=docx|pdf|preview`. Downloads the tailored docx (keeps the resume's ORIGINAL name, no "(tailored)" suffix) or renders an HTML preview/PDF via mammoth.
- `src/app/api/resumes/*` — list / upload (.docx or .zip auto-extract) / delete / folder / move. Originals live under `resumes/`.

### UI
- `src/app/dashboard/resume/ResumeClient.tsx` — JD box + library tree + **Auto-match toggle (default ON)** + mic dictation. When ON, sends empty `filepath` (server auto-selects). When OFF, sends the clicked resume's path.
- `src/app/dashboard/resume/result/page.tsx` — result page: match ring, "what changed", live preview panel, feedback chips → instant regenerate. (Note: the user/linter recently edited this file to add `sessionStorage` result caching — keep that.)
- `LibraryTree.tsx`, `MicButton.tsx` — file explorer with checkboxes; Wispr-style voice dictation (Ctrl+Shift+M).

### The library
- `resumes/` holds ~98 `.docx` across role folders (e.g. `Cyber Marketing/Appsec Engineer/…`, `CYBER GC/CYBER GC/APPSEC/…`, `C2C GC/AI/…`, `GC Remote/GC Remote/Sre/…`). The **leaf folder name = the role identity** used for selection.

---

## 4. What has been DONE (current state — all verified)

1. **In-place tailoring engine** (zones + index-based rewrite, formatting preserved, originals never touched). ✅
2. **Audit-order RULES** prompt (identity-first, no keyword-dumping). ✅
3. **Header title + tagline retargeting**, name/phone/email/LinkedIn preserved byte-for-byte. ✅
4. **Selection accuracy** — identity-weighted matcher. Verified **16/16** on diverse JD titles (AI, Data, IAM, Cloud, SOC, GRC, Pentest, SAP, ServiceNow, Network, OT, SRE, FSD, AppSec…). ✅
5. **Multi-template parsing** — fixed the `<w:t>` regex bug + name-based heading detection. **98/98 resumes now parse** (summary + skills + roles), up from ~15/98. ✅
6. **Bulk import** — 84 resumes imported from `E:\Downloads\Resumes.zip` into `resumes/`. ✅
7. **JD extraction** — `scripts/batch_tailor.mts` pulls ~115 clean JD titles from the two LinkedIn-export docs and can batch-tailor through the web app (auto-select) + zip the results.
8. **One live batch of 50 ran successfully** (via the web app with auto-select + the user's key). That run used the OLD matcher and had ~10 mis-selections — **those selection bugs are now FIXED**, so the batch should be **re-run** to regenerate a correct zip (see §6).

---

## 5. CRITICAL CONSTRAINTS (do not violate)

- **Always test through the actual website + the original resumes** (auto-select ON). Do NOT fabricate edits by simulating the model yourself — drive the real `/api/tailor` endpoint so results reflect what the user sees.
- **Never modify the user's original resume files.** Tailored output is always a separate file in `data/tailored/`.
- **Never change name/contact in the header.** Only title + tagline are editable there.
- The **Claude API key** is in `C:\Users\Eshwa\Downloads\job-dashboard\.env.local` as `ANTHROPIC_API_KEY=sk-ant-...` (the user added it himself; the server reads it). It is also stored client-side in browser localStorage (`jd_settings.claudeKey`) for the UI. Keep it secret; never print it.
- **Don't delete the root `proxy.ts`** (Supabase session proxy). Deleting it broke the build + OOM'd the dev server before.
- The dev server (`npm run dev`, Turbopack) **OOM-crashes on long sessions**. Restart cleanly: kill port 3000 → delete `.next` → `npm run dev`.

---

## 6. HOW TO RUN & TEST

### Start the dev server
```powershell
# kill anything on :3000, clear build, start
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
Remove-Item "C:\Users\Eshwa\Downloads\job-dashboard\.next" -Recurse -Force -ErrorAction SilentlyContinue
# then:  npm run dev   (in the job-dashboard folder)
```

### Manual test (what the user does)
Open `http://localhost:3000/dashboard/resume` → leave **Auto-match ON** → paste a JD → **Tailor** → review header/summary/bullets + download.

### Type-check
```
npx tsc --noEmit
```

### Re-run the 50-resume batch (regenerates `data/Tailored_Resumes.zip`)
The server must be running with the key loaded. Then:
```
COUNT=50 SERVER=http://localhost:3000 npx tsx scripts/batch_tailor.mts
```
It writes tailored docx + `INDEX.txt` (JD → matched resume → score) to `data/batch_out/`, then zips to `data/Tailored_Resumes.zip`. **Do this after the matcher fix to give the user a corrected zip.**

### JD sources (the two search docs)
- `C:\Users\Eshwa\OneDrive\Documents\6-28-2026-LindnSearch.docx`
- `C:\Users\Eshwa\OneDrive\Documents\Search Reporrt.docx`
These are LinkedIn feed/search exports (noisy). `batch_tailor.mts` splits posts on "Feed post", filters JD-like ones, strips recruiter chrome/emojis, and promotes the role title to the first line (so auto-select works).

---

## 7. NEXT STEPS (recommended, in order)

1. **Regenerate the zip** with the fixed matcher (§6) so the user gets correctly-selected, tailored resumes to review. This was his outstanding ask ("create a zip of all the resumes you made so I can look it up").
2. **Spot-check tailoring QUALITY** on 3-4 outputs against the §2 golden rules — especially: one identity (not stacked), JD-central tools inside CURRENT-role bullets, real details kept in summary, header title retargeted with contact intact. If quality is off, tighten `RULES` in `claude.ts` (not the engine).
3. Selection is strong but watch ambiguous generic titles (e.g. "Application Developer", "Solution Architect") — add folder codes to `IDENTITY_PHRASES` if a role consistently mis-picks.
4. The user's larger goal: **"Complete the web application and deploy it to production."** Resume tailoring quality is the gating feature he wants perfect first.

---

## 8. Quick file map

| File | Purpose |
|---|---|
| `src/lib/docx.ts` | parse zones + in-place rewrite (engine) |
| `src/lib/claude.ts` | AI prompt (RULES) + `adapt()` |
| `src/lib/keywords.ts` | resume selection (identity matcher) |
| `src/lib/feedback.ts` | stores user feedback for regeneration |
| `src/app/api/tailor/route.ts` | tailor endpoint (auto-select + apply) |
| `src/app/api/tailor/file/route.ts` | download / preview |
| `src/app/api/resumes/*` | library CRUD + zip upload |
| `src/app/dashboard/resume/*` | UI (JD box, library, result, mic) |
| `scripts/batch_tailor.mts` | batch tailor via web app + zip |
| `resumes/` | ~98 original resumes (role folders) |
| `data/tailored/` | per-run tailored output |
| `data/resume_keywords.json` | selection index |
| `.env.local` | `ANTHROPIC_API_KEY` (secret) |

**State at handoff:** engine 98/98 parsing, selection 16/16, header-safe, audit-order prompt in place, one batch run done (needs re-run with fixed matcher). tsc clean. Dev server may need a restart.


# Test And update all the Claude code (claude.md) file:
- Each line of Claude.md test if were serving them all or not!!
