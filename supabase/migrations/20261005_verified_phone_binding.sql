-- Make phone verification and WhatsApp sender resolution one authoritative transaction.
-- The application already calls this RPC from /api/identity/phone/confirm.

create or replace function public.identity_bind_verified_phone(
  p_user_id uuid,
  p_phone_e164 text,
  p_phone_hash text,
  p_last4 text,
  p_whatsapp_opt_in boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner uuid;
begin
  if p_user_id is null or p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_PHONE_BINDING';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  select user_id into v_owner
  from private.user_phone_bindings
  where phone_e164 = p_phone_e164 or phone_hash = p_phone_hash
  limit 1;

  if v_owner is not null and v_owner <> p_user_id then
    raise exception 'PHONE_ALREADY_BOUND';
  end if;

  insert into private.user_phone_bindings(
    user_id, phone_e164, phone_hash, verified_at, verification_provider,
    whatsapp_address, whatsapp_verified_at, updated_at
  )
  values(
    p_user_id, p_phone_e164, p_phone_hash, now(), 'twilio_verify',
    case when p_whatsapp_opt_in then p_phone_e164 else null end,
    case when p_whatsapp_opt_in then now() else null end,
    now()
  )
  on conflict (user_id) do update set
    phone_e164 = excluded.phone_e164,
    phone_hash = excluded.phone_hash,
    verified_at = excluded.verified_at,
    verification_provider = excluded.verification_provider,
    whatsapp_address = excluded.whatsapp_address,
    whatsapp_verified_at = excluded.whatsapp_verified_at,
    updated_at = now();

  update public.profiles
  set phone = p_phone_e164,
      whatsapp = case when p_whatsapp_opt_in then p_phone_e164 else null end,
      phone_last4 = p_last4,
      phone_verified = true,
      whatsapp_opt_in = p_whatsapp_opt_in,
      updated_at = now()
  where id = p_user_id;

  insert into public.connected_services(
    user_id, service, status, connected_account_label, connected_at, updated_at
  )
  values(
    p_user_id,
    'whatsapp',
    case when p_whatsapp_opt_in then 'connected' else 'disconnected' end,
    case when p_whatsapp_opt_in then '••••' || p_last4 else null end,
    case when p_whatsapp_opt_in then now() else null end,
    now()
  )
  on conflict (user_id, service) do update set
    status = excluded.status,
    connected_account_label = excluded.connected_account_label,
    connected_at = excluded.connected_at,
    updated_at = now();

  insert into public.identity_audit(user_id, actor_user_id, event_type, channel, details)
  values(
    p_user_id,
    p_user_id,
    'verified_phone_bound',
    'system',
    jsonb_build_object('last4', p_last4, 'whatsapp_opt_in', p_whatsapp_opt_in)
  );
end;
$$;

revoke all on function public.identity_bind_verified_phone(uuid,text,text,text,boolean)
from public, anon, authenticated;
grant execute on function public.identity_bind_verified_phone(uuid,text,text,text,boolean)
to service_role;
