-- ============================================================
-- CAMPAIGN SEAT
-- FINAL PLATFORM ADMIN CONTROL SAFETY
-- ============================================================


-- ============================================================
-- 1. WORKSPACE REVISION HISTORY
-- ============================================================

create or replace function
public.get_platform_workspace_revision_history(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  result jsonb;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            revision.id,

          'revision_number',
            revision.revision_number,

          'status',
            revision.status,

          'payload',
            revision.payload,

          'created_by',
            revision.created_by,

          'updated_by',
            revision.updated_by,

          'published_by',
            revision.published_by,

          'created_at',
            revision.created_at,

          'updated_at',
            revision.updated_at,

          'published_at',
            revision.published_at
        )
        order by
          revision.revision_number desc
      ),
      '[]'::jsonb
    )
  into result

  from private.platform_workspace_revisions
    as revision

  where revision.workspace_id =
    target_workspace_id;


  return result;
end;
$$;


-- ============================================================
-- 2. DISCARD CURRENT DRAFT
-- ============================================================

create or replace function
public.discard_platform_workspace_draft(
  target_workspace_id uuid,
  target_revision_id uuid,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  revision_row
    private.platform_workspace_revisions%rowtype;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required to discard a draft.'
      using errcode = '42501';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_reason,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'Enter an internal reason for discarding this draft.';
  end if;


  select *
  into revision_row
  from private.platform_workspace_revisions
  where
    id =
      target_revision_id

    and workspace_id =
      target_workspace_id

    and status =
      'draft'
  for update;


  if not found then
    raise exception
      'The selected draft is no longer available.';
  end if;


  update
    private.platform_workspace_revisions
  set
    status =
      'superseded',

    updated_by =
      auth.uid(),

    updated_at =
      now()

  where id =
    revision_row.id;


  insert into
  private.platform_audit_log (
    actor_user_id,
    workspace_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_workspace_id,
    'workspace_draft_discarded',
    'platform_workspace_revision',
    revision_row.id::text,
    target_reason,
    jsonb_build_object(
      'revision_number',
        revision_row.revision_number,

      'discarded_payload',
        revision_row.payload
    )
  );


  return
    public.get_platform_workspace_editor(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- 3. PLATFORM ADMIN TEAM ACCESS MANAGEMENT
-- ============================================================

create or replace function
public.set_platform_customer_member_access(
  target_workspace_id uuid,
  target_membership_id uuid,
  target_role_key text,
  target_display_title text,
  target_status text,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  member_row
    public.workspace_members%rowtype;

  selected_role record;

  normalized_status text :=
    lower(
      btrim(
        coalesce(
          target_status,
          ''
        )
      )
    );

  normalized_role text :=
    lower(
      btrim(
        coalesce(
          target_role_key,
          ''
        )
      )
    );

  normalized_title text;

  active_owner_count integer;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required to change team access.'
      using errcode = '42501';
  end if;


  if normalized_status
    <> all(
      array[
        'active',
        'inactive'
      ]::text[]
    )
  then
    raise exception
      'Member status must be active or inactive.';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_reason,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'An internal reason is required for team access changes.';
  end if;


  select *
  into member_row
  from public.workspace_members
  where
    id =
      target_membership_id

    and workspace_id =
      target_workspace_id
  for update;


  if not found then
    raise exception
      'Campaign member could not be found.';
  end if;


  select
    role_record.key,
    role_record.name,
    role_record.dashboard_type,
    role_record.seat_type

  into selected_role

  from public.campaign_roles
    as role_record

  where
    role_record.key =
      normalized_role

    and role_record.is_active =
      true;


  if selected_role.key
    is null
  then
    raise exception
      'Selected campaign role is unavailable.';
  end if;


  -- Campaign owner role cannot be newly assigned
  -- from the general Team & Access manager.
  if
    normalized_role =
      'campaign_owner'

    and member_row.role_key <>
      'campaign_owner'
  then
    raise exception
      'Campaign owner access requires a separate ownership-transfer workflow.';
  end if;


  -- Never remove/demote the final active campaign owner.
  if
    member_row.role_key =
      'campaign_owner'

    and (
      normalized_status <>
        'active'

      or normalized_role <>
        'campaign_owner'
    )
  then

    select count(*)
    into active_owner_count

    from public.workspace_members

    where
      workspace_id =
        target_workspace_id

      and role_key =
        'campaign_owner'

      and status =
        'active'

      and membership_state =
        'active';


    if active_owner_count <= 1
    then
      raise exception
        'The final active Campaign Owner cannot be removed or demoted.';
    end if;

  end if;


  normalized_title :=
    coalesce(
      nullif(
        btrim(
          target_display_title
        ),
        ''
      ),
      selected_role.name
    );


  update public.workspace_members
  set
    role_key =
      selected_role.key,

    display_title =
      normalized_title,

    dashboard_type =
      selected_role.dashboard_type,

    seat_type =
      selected_role.seat_type,

    status =
      normalized_status,

    membership_state =
      case
        when normalized_status =
          'active'
        then 'active'
        else 'removed'
      end,

    suspended_at =
      case
        when normalized_status =
          'inactive'
        then now()
        else null
      end,

    removed_at =
      case
        when normalized_status =
          'inactive'
        then now()
        else null
      end,

    access_version =
      coalesce(
        access_version,
        0
      ) + 1,

    updated_at =
      now()

  where id =
    member_row.id;


  insert into
  private.platform_audit_log (
    actor_user_id,
    workspace_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_workspace_id,
    'customer_member_access_changed',
    'workspace_member',
    member_row.id::text,
    target_reason,
    jsonb_build_object(
      'user_id',
        member_row.user_id,

      'old_role_key',
        member_row.role_key,

      'new_role_key',
        normalized_role,

      'old_status',
        member_row.status,

      'new_status',
        normalized_status,

      'old_display_title',
        member_row.display_title,

      'new_display_title',
        normalized_title
    )
  );


  return
    public.get_platform_customer_control_center(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- 4. PUBLISH MUST REQUIRE FRESH AUTHENTICATOR
--
-- Inject a fresh-TOTP guard into the existing publish function.
-- ============================================================

create or replace function
public.platform_admin_publish_recent_totp_required()
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required before publishing.'
      using errcode = '42501';
  end if;

end;
$$;


revoke all
on function
public.platform_admin_publish_recent_totp_required()
from public, anon, authenticated;


grant execute
on function
public.platform_admin_publish_recent_totp_required()
to authenticated;


-- Existing publish function source is modified here by replacing
-- its standard Admin authorization block with the stronger
-- recent-TOTP helper.

do $$
declare
  publish_oid oid;

  publish_source text;
begin

  select
    p.oid
  into publish_oid

  from pg_proc as p

  join pg_namespace as n
    on n.oid =
      p.pronamespace

  where
    n.nspname =
      'public'

    and p.proname =
      'publish_platform_workspace_draft'

    and pg_get_function_identity_arguments(
      p.oid
    ) =
      'target_workspace_id uuid, target_revision_id uuid';


  if publish_oid is null
  then
    raise exception
      'Existing publish_platform_workspace_draft function was not found.';
  end if;


  select
    pg_get_functiondef(
      publish_oid
    )
  into publish_source;


  if position(
    'public.platform_admin_publish_recent_totp_required()'
    in publish_source
  ) = 0
  then

    publish_source :=
      replace(
        publish_source,

        E'  if not public.seat_platform_admin_authorized() then\n    raise exception\n      ''Seat Platform Admin authorization with MFA is required.'';\n  end if;\n',

        E'  perform public.platform_admin_publish_recent_totp_required();\n'
      );


    if position(
      'public.platform_admin_publish_recent_totp_required()'
      in publish_source
    ) = 0
    then
      raise exception
        'Publish authorization block could not be upgraded safely.';
    end if;


    execute publish_source;

  end if;

end;
$$;


-- ============================================================
-- 5. RPC PERMISSIONS
-- ============================================================

revoke all
on function
public.get_platform_workspace_revision_history(uuid)
from public, anon, authenticated;

revoke all
on function
public.discard_platform_workspace_draft(uuid, uuid, text)
from public, anon, authenticated;

revoke all
on function
public.set_platform_customer_member_access(uuid, uuid, text, text, text, text)
from public, anon, authenticated;


grant execute
on function
public.get_platform_workspace_revision_history(uuid)
to authenticated;

grant execute
on function
public.discard_platform_workspace_draft(uuid, uuid, text)
to authenticated;

grant execute
on function
public.set_platform_customer_member_access(uuid, uuid, text, text, text, text)
to authenticated;


comment on function
public.get_platform_workspace_revision_history(uuid)
is
'Seat Platform Admin workspace revision history loader.';

comment on function
public.discard_platform_workspace_draft(uuid, uuid, text)
is
'Seat Platform Admin draft discard. Requires fresh TOTP, reason, and audit event.';

comment on function
public.set_platform_customer_member_access(uuid, uuid, text, text, text, text)
is
'Seat Platform Admin team/access management. Requires fresh TOTP, reason, campaign-owner safety, and audit event.';
