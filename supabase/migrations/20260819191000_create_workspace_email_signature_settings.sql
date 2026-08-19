-- ============================================================
-- CAMPAIGN SEAT
-- CAMPAIGN MAILBOX EMAIL SIGNATURE SETTINGS
--
-- One protected workspace-level default signature.
--
-- Read:
--   Active workspace members.
--
-- Write:
--   Active command/candidate leadership.
--
-- This migration does not modify:
-- - mailbox credentials
-- - Nylas grants
-- - onboarding state
-- - existing integrations
-- - email messages
-- ============================================================

begin;


-- ============================================================
-- TABLE
-- ============================================================

create table
public.workspace_email_signature_settings (
  workspace_id uuid
    primary key
    references public.workspaces(id)
    on delete cascade,

  signature_name text
    not null
    default 'Campaign signature',

  signature_text text
    not null
    default '',

  enabled boolean
    not null
    default false,

  include_on_new boolean
    not null
    default true,

  include_on_reply boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  created_by uuid,

  updated_at timestamptz
    not null
    default now(),

  updated_by uuid,

  constraint
    workspace_email_signature_name_length
    check (
      char_length(
        signature_name
      ) between 1 and 120
    ),

  constraint
    workspace_email_signature_text_length
    check (
      char_length(
        signature_text
      ) <= 10000
    )
);


comment on table
public.workspace_email_signature_settings
is
  'Protected Campaign Seat workspace-level outbound email signature configuration.';


comment on column
public.workspace_email_signature_settings.signature_text
is
  'Plain-text outbound campaign email signature. Rich HTML signatures can be layered separately without changing the protected settings model.';


comment on column
public.workspace_email_signature_settings.include_on_new
is
  'Whether the configured signature is available by default for newly composed external email.';


comment on column
public.workspace_email_signature_settings.include_on_reply
is
  'Whether the configured signature is available by default for replies to connected mailbox email.';


-- ============================================================
-- AUDIT STAMP
-- ============================================================

create or replace function
private.stamp_workspace_email_signature_settings()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $campaign_seat_email_signature_stamp$
declare
  actor_user_id uuid :=
    auth.uid();
begin
  new.updated_at =
    now();

  new.updated_by =
    actor_user_id;

  if tg_op =
    'INSERT'
  then
    new.created_at =
      now();

    new.created_by =
      actor_user_id;
  end if;

  return new;
end;
$campaign_seat_email_signature_stamp$;


revoke all
on function
private.stamp_workspace_email_signature_settings()
from public, anon, authenticated;


create trigger
workspace_email_signature_settings_stamp
before insert or update
on public.workspace_email_signature_settings
for each row
execute function
private.stamp_workspace_email_signature_settings();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
public.workspace_email_signature_settings
enable row level security;


-- Active members may read the campaign mailbox signature so
-- the Inbox composer can apply it consistently across devices.

create policy
workspace_email_signature_settings_select
on public.workspace_email_signature_settings
for select
to authenticated
using (
  exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        workspace_email_signature_settings.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'
  )
);


-- Only campaign leadership may create the workspace default.

create policy
workspace_email_signature_settings_insert
on public.workspace_email_signature_settings
for insert
to authenticated
with check (
  exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        workspace_email_signature_settings.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


-- Only campaign leadership may change it.

create policy
workspace_email_signature_settings_update
on public.workspace_email_signature_settings
for update
to authenticated
using (
  exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        workspace_email_signature_settings.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
)
with check (
  exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        workspace_email_signature_settings.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


-- Leadership can remove/reset the signature configuration.

create policy
workspace_email_signature_settings_delete
on public.workspace_email_signature_settings
for delete
to authenticated
using (
  exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        workspace_email_signature_settings.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


revoke all
on table
public.workspace_email_signature_settings
from anon;


grant
  select,
  insert,
  update,
  delete
on table
public.workspace_email_signature_settings
to authenticated;


commit;
