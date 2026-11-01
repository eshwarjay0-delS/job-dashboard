-- Desktop handoff tickets (browser -> desktop app): one-use capability links.
-- Minted by POST /api/kompas/desktop-handoff: 256 random bits, SHA-256 digest
-- at rest, five-minute TTL. Claimed by POST /api/kompas/desktop-handoff/redeem
-- via claim_kompas_desktop_handoff. No migration defined this table or function
-- before: mint inserted into a table that only existed if created out-of-band,
-- and the claim RPC existed by name only. This migration makes both real.
-- Applying it is a Supabase-dashboard (or CLI) step; Vercel builds do not run
-- migrations. If the table was already created out-of-band with a different
-- shape, create table if not exists leaves it alone — the function below is
-- the part that must exist, and it assumes the columns as defined here.
create table if not exists public.kompas_desktop_handoffs (
  ticket_hash text not null primary key check (ticket_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists kompas_desktop_handoffs_expires_idx on public.kompas_desktop_handoffs (expires_at);
alter table public.kompas_desktop_handoffs enable row level security;
revoke all on public.kompas_desktop_handoffs from public, anon, authenticated;
grant select, insert, update, delete on public.kompas_desktop_handoffs to service_role;

-- Atomic one-use claim. DELETE ... RETURNING runs as a single statement, so
-- two concurrent redeems serialize on the row lock and only one wins; the
-- loser finds the row gone and gets NULL. The payload is returned only when
-- the ticket is still fresh — an expired, used, or unknown ticket returns
-- NULL, which the redeem route answers with 410. The row is deleted even
-- when expired, so dead tickets do not linger for the mint cleanup.
-- Returns jsonb (the payload object itself), not a table: the redeem route
-- reads data.site and data.id straight off the returned value.
create or replace function public.claim_kompas_desktop_handoff(p_ticket_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_expires timestamptz;
begin
  delete from public.kompas_desktop_handoffs
  where ticket_hash = p_ticket_hash
  returning payload, expires_at into v_payload, v_expires;
  if v_payload is not null and v_expires > clock_timestamp() then
    return v_payload;
  end if;
  return null;
end;
$$;
revoke all on function public.claim_kompas_desktop_handoff(text) from public, anon, authenticated;
grant execute on function public.claim_kompas_desktop_handoff(text) to service_role;
