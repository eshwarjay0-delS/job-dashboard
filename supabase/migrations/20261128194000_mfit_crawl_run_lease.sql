-- A single service-only lease serializes all manual contract-crawler runs across serverless instances.
-- A quarantined worker keeps the lease until expiry; 15 minutes exceeds the routes' 300-second maximum duration.
create table if not exists public.mfit_crawl_run_leases (
  lease_key text primary key check (lease_key = 'contract-crawler'),
  lease_token uuid not null,
  expires_at timestamptz not null,
  acquired_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.mfit_crawl_run_leases enable row level security;
revoke all on public.mfit_crawl_run_leases from public, anon, authenticated, service_role;

create or replace function public.acquire_mfit_crawl_run_lease(p_lease_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acquired boolean;
begin
  if p_lease_token is null then
    raise exception 'Invalid crawler lease token';
  end if;

  insert into public.mfit_crawl_run_leases as current_lease
    (lease_key, lease_token, expires_at)
  values
    ('contract-crawler', p_lease_token, pg_catalog.clock_timestamp() + interval '15 minutes')
  on conflict (lease_key) do update
    set lease_token = excluded.lease_token,
        expires_at = excluded.expires_at,
        acquired_at = pg_catalog.clock_timestamp()
    where current_lease.expires_at <= pg_catalog.clock_timestamp()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.release_mfit_crawl_run_lease(p_lease_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_token is null then
    return false;
  end if;

  delete from public.mfit_crawl_run_leases
    where lease_key = 'contract-crawler'
      and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.acquire_mfit_crawl_run_lease(uuid) from public, anon, authenticated;
revoke all on function public.release_mfit_crawl_run_lease(uuid) from public, anon, authenticated;
grant execute on function public.acquire_mfit_crawl_run_lease(uuid) to service_role;
grant execute on function public.release_mfit_crawl_run_lease(uuid) to service_role;
