-- Campaign Seat
-- Platform SMS runtime for Campaign Seat account notifications,
-- onboarding communications, service information, and support.
--
-- IMPORTANT:
-- This runtime is intentionally separate from campaign_external_outreach.
-- The Campaign Seat platform toll-free number is NOT a campaign/voter sender.

begin;

create extension if not exists pgcrypto;

create table if not exists public.platform_sms_subscriptions (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,
  phone_e164 text not null unique,
  status text not null default 'active'
    check (status in ('active','opted_out')),
  consent_source text not null default 'campaign_seat_web_form',
  consent_text_version text not null default '2026-08-20',
  consented_at timestamptz not null default now(),
  opted_out_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sms_subscriptions_phone_check
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create index if not exists platform_sms_subscriptions_status_idx
on public.platform_sms_subscriptions (status, updated_at desc);

create table if not exists public.platform_sms_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  phone_e164 text not null,
  event_type text not null check (event_type in ('opt_in','opt_out','help')),
  source text not null,
  disclosure_version text,
  twilio_message_sid text,
  created_at timestamptz not null default now(),
  constraint platform_sms_consent_events_phone_check
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create index if not exists platform_sms_consent_events_user_created_idx
on public.platform_sms_consent_events (user_id, created_at desc);

create index if not exists platform_sms_consent_events_phone_created_idx
on public.platform_sms_consent_events (phone_e164, created_at desc);

create table if not exists public.platform_sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null default 'sms' check (channel in ('sms','mms')),
  twilio_message_sid text not null unique,
  messaging_service_sid text,
  from_number text,
  to_number text,
  body text,
  status text not null,
  error_code text,
  error_message text,
  opt_out_type text,
  num_media integer not null default 0 check (num_media >= 0 and num_media <= 10),
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_sms_messages_user_created_idx
on public.platform_sms_messages (user_id, created_at desc);

create index if not exists platform_sms_messages_status_created_idx
on public.platform_sms_messages (status, created_at desc);

alter table public.platform_sms_subscriptions enable row level security;
alter table public.platform_sms_consent_events enable row level security;
alter table public.platform_sms_messages enable row level security;

drop policy if exists "Users can view their platform SMS subscription"
on public.platform_sms_subscriptions;
create policy "Users can view their platform SMS subscription"
on public.platform_sms_subscriptions
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can view their platform SMS consent events"
on public.platform_sms_consent_events;
create policy "Users can view their platform SMS consent events"
on public.platform_sms_consent_events
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can view their platform SMS messages"
on public.platform_sms_messages;
create policy "Users can view their platform SMS messages"
on public.platform_sms_messages
for select to authenticated using (user_id = auth.uid());

grant select on public.platform_sms_subscriptions to authenticated;
grant select on public.platform_sms_consent_events to authenticated;
grant select on public.platform_sms_messages to authenticated;

create or replace function public.set_platform_sms_preference(
  target_phone_e164 text,
  target_consented boolean,
  target_source text default 'campaign_seat_web_form'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_phone text := btrim(coalesce(target_phone_e164,''));
  normalized_source text := nullif(btrim(coalesce(target_source,'')),'');
  current_phone text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_source is null then
    normalized_source := 'campaign_seat_web_form';
  end if;

  if target_consented then
    if normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception
        'Enter the mobile number in E.164 format, for example +15555555555.'
        using errcode = '22023';
    end if;

    insert into public.platform_sms_subscriptions (
      user_id, phone_e164, status, consent_source,
      consent_text_version, consented_at, opted_out_at, updated_at
    )
    values (
      current_user_id, normalized_phone, 'active', normalized_source,
      '2026-08-20', now(), null, now()
    )
    on conflict (user_id)
    do update set
      phone_e164 = excluded.phone_e164,
      status = 'active',
      consent_source = excluded.consent_source,
      consent_text_version = excluded.consent_text_version,
      consented_at = now(),
      opted_out_at = null,
      updated_at = now();

    insert into public.platform_sms_consent_events (
      user_id, phone_e164, event_type, source, disclosure_version
    )
    values (
      current_user_id, normalized_phone, 'opt_in',
      normalized_source, '2026-08-20'
    );

    return jsonb_build_object(
      'ok', true, 'status', 'active', 'phone', normalized_phone
    );
  end if;

  select phone_e164 into current_phone
  from public.platform_sms_subscriptions
  where user_id = current_user_id
  limit 1;

  if current_phone is null then
    return jsonb_build_object('ok', true, 'status', 'not_enrolled');
  end if;

  update public.platform_sms_subscriptions
  set status = 'opted_out',
      opted_out_at = now(),
      updated_at = now()
  where user_id = current_user_id;

  insert into public.platform_sms_consent_events (
    user_id, phone_e164, event_type, source, disclosure_version
  )
  values (
    current_user_id, current_phone, 'opt_out',
    normalized_source, '2026-08-20'
  );

  return jsonb_build_object(
    'ok', true, 'status', 'opted_out', 'phone', current_phone
  );
end;
$function$;

revoke all on function public.set_platform_sms_preference(text,boolean,text)
from public;
grant execute on function public.set_platform_sms_preference(text,boolean,text)
to authenticated;

commit;
