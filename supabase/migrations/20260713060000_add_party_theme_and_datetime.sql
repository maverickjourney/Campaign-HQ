-- CAMPAIGN HQ — PARTY THEME AND WORKSPACE PARTY SETTING
begin;

alter table public.workspaces
add column if not exists political_party text not null
default 'republican';

alter table public.workspaces
drop constraint if exists workspaces_political_party_check;

alter table public.workspaces
add constraint workspaces_political_party_check
check (
  political_party in (
    'republican',
    'democratic',
    'nonpartisan',
    'other'
  )
);

update public.workspaces
set political_party = 'republican'
where id = '11111111-1111-1111-1111-111111111111';

create or replace function
public.manage_workspace_settings_with_party(
  target_workspace_id uuid,
  target_name text,
  target_description text,
  target_location text,
  target_election_date date,
  target_political_party text
)
returns table (
  id uuid,
  name text,
  description text,
  location text,
  election_date date,
  political_party text,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_hq$
declare
  normalized_party text :=
    lower(btrim(coalesce(target_political_party, '')));
  previous_party text;
begin
  if normalized_party not in (
    'republican',
    'democratic',
    'nonpartisan',
    'other'
  ) then
    raise exception 'Choose a valid campaign political party.';
  end if;

  select workspace_record.political_party
  into previous_party
  from public.workspaces as workspace_record
  where workspace_record.id = target_workspace_id;

  perform public.manage_workspace_settings(
    target_workspace_id,
    target_name,
    target_description,
    target_location,
    target_election_date
  );

  update public.workspaces
  set political_party = normalized_party
  where workspaces.id = target_workspace_id;

  if previous_party is distinct from normalized_party then
    insert into public.activity_log (
      workspace_id,
      actor_user_id,
      activity_type,
      title,
      detail,
      entity_type,
      entity_id,
      route,
      metadata,
      occurred_at
    )
    values (
      target_workspace_id,
      auth.uid(),
      'workspace_party_updated',
      'Campaign party updated',
      initcap(normalized_party),
      'workspace',
      target_workspace_id,
      '/workspace/settings',
      jsonb_build_object('political_party', normalized_party),
      now()
    );
  end if;

  return query
  select
    workspace_record.id,
    workspace_record.name,
    workspace_record.description,
    workspace_record.location,
    workspace_record.election_date,
    workspace_record.political_party,
    workspace_record.status
  from public.workspaces as workspace_record
  where workspace_record.id = target_workspace_id;
end
$campaign_hq$;

revoke all
on function public.manage_workspace_settings_with_party(
  uuid, text, text, text, date, text
)
from public;

grant execute
on function public.manage_workspace_settings_with_party(
  uuid, text, text, text, date, text
)
to authenticated;

notify pgrst, 'reload schema';

commit;

select id, name, political_party
from public.workspaces
where id = '11111111-1111-1111-1111-111111111111';
