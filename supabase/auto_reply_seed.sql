-- ============================================================================
--  Auto-Reply — seed + pre-flight
--  Run AFTER supabase/auto_reply_schema.sql, in Supabase → SQL Editor.
--  Run each block separately so you can read its output.
-- ============================================================================

-- ── 1. Which account did you sign in to the app with? ───────────────────────
-- Note the `id` — that is your user_id, and it is also the value the GitHub
-- Actions secret AUTO_REPLY_USER_ID needs later.
select id, email, created_at
from auth.users
order by created_at;


-- ── 2. Is Gmail actually connected for that user? ───────────────────────────
-- gmail_refresh_token MUST be non-null or the loop cannot get an access token.
-- (auth/callback/gmail writes it inside a try/catch that swallows errors, so a
-- missing column or a failed write is silent — this is how you find out.)
select id,
       email,
       (gmail_refresh_token is not null) as gmail_connected,
       gmail_connected_at,
       gmail_granted_scope
from public.profiles
order by gmail_connected_at desc nulls last;


-- ── 3. Seed your settings ───────────────────────────────────────────────────
-- Replace BOTH placeholders:
--   'YOUR_LOGIN_EMAIL'  → the email from step 1 (how you sign in to the app)
--   self_email          → the Gmail account the DRAFTS live in
-- These are often different: you might sign in with one Google account while
-- the recruiter drafts sit in another. self_email must be the DRAFTS one, or
-- the "exclude yourself from recipients" rule silently never fires.
insert into public.auto_reply_settings
  (user_id, self_email, enabled, dry_run, sender_allowlist, min_age_days, lookback_days, cc_middleman)
select id,
       'eshwarjay05@gmail.com',          -- self_email: where the DRAFTS live
       true,                             -- enabled
       true,                             -- dry_run (M1 cannot send regardless)
       array['tekblu','cloudquestit'],
       3,                                -- min_age_days: ignore drafts newer than 3 days
       7,                                -- lookback_days: ignore drafts older than 7 days
       false                             -- cc_middleman: FALSE = recruiter only
from auth.users
where email = 'YOUR_LOGIN_EMAIL'
on conflict (user_id) do update
  set self_email       = excluded.self_email,
      enabled          = excluded.enabled,
      sender_allowlist = excluded.sender_allowlist,
      min_age_days     = excluded.min_age_days,
      lookback_days    = excluded.lookback_days,
      cc_middleman     = excluded.cc_middleman,
      kill_switch      = false,
      updated_at       = now();


-- ── 4. Confirm it landed ────────────────────────────────────────────────────
select user_id, self_email, enabled, dry_run, kill_switch, sender_allowlist, min_age_days, lookback_days, cc_middleman
from public.auto_reply_settings;


-- ── 5. After your first scan, this is the board ─────────────────────────────
select state, count(*)
from public.auto_reply_job
group by state
order by count(*) desc;

-- And the decisions it made, newest first:
select j.state,
       j.middleman_email,
       j.recruiter_to,
       j.recruiter_cc,
       j.halt_code,
       left(j.recruiter_rationale, 160) as why,
       j.subject
from public.auto_reply_job j
order by j.updated_at desc
limit 25;
