-- Campaign Seat rich Calendar event editor contract.
-- Additive only: preserves all existing Calendar/event behavior.

alter table public.events
  add column if not exists event_timezone text,
  add column if not exists participants jsonb not null default '[]'::jsonb,
  add column if not exists recurrence_rules text[] not null default '{}'::text[],
  add column if not exists reminders jsonb not null default '{}'::jsonb,
  add column if not exists busy boolean not null default true,
  add column if not exists visibility text,
  add column if not exists conferencing jsonb not null default '{}'::jsonb,
  add column if not exists hide_participants boolean not null default false,
  add column if not exists notify_participants boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_participants_array_check'
  ) then
    alter table public.events
      add constraint events_participants_array_check
      check (
        jsonb_typeof(participants) = 'array'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_reminders_object_check'
  ) then
    alter table public.events
      add constraint events_reminders_object_check
      check (
        jsonb_typeof(reminders) = 'object'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_conferencing_object_check'
  ) then
    alter table public.events
      add constraint events_conferencing_object_check
      check (
        jsonb_typeof(conferencing) = 'object'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_visibility_check'
  ) then
    alter table public.events
      add constraint events_visibility_check
      check (
        visibility is null
        or visibility in (
          'default',
          'public',
          'private'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_timezone_nonempty_check'
  ) then
    alter table public.events
      add constraint events_timezone_nonempty_check
      check (
        event_timezone is null
        or btrim(event_timezone) <> ''
      );
  end if;
end
$$;

comment on column public.events.event_timezone is
  'IANA timezone used when editing or writing the event to its calendar provider.';

comment on column public.events.participants is
  'Calendar participants/guests, stored as a JSON array compatible with provider synchronization.';

comment on column public.events.recurrence_rules is
  'Provider recurrence RRULE/EXDATE strings.';

comment on column public.events.reminders is
  'Calendar reminder configuration.';

comment on column public.events.busy is
  'Whether the event blocks availability.';

comment on column public.events.visibility is
  'Calendar visibility preference: default, public, private, or null/provider default.';

comment on column public.events.conferencing is
  'Provider conferencing information such as Google Meet or Microsoft Teams.';

comment on column public.events.hide_participants is
  'Whether the provider should hide the event participant list.';

comment on column public.events.notify_participants is
  'Whether Campaign Seat should request participant notifications when supported.';
