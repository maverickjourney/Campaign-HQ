-- ============================================================
-- CAMPAIGN HQ — PERMISSION-SAFE CAMPAIGN SEARCH
--
-- Searches the active workspace across campaign records.
-- Uses SECURITY INVOKER so existing RLS remains authoritative.
-- No external AI key is stored in the browser or database.
-- ============================================================

begin;

create or replace function
public.search_campaign_hq(
  target_workspace_id uuid,
  target_query text default '',
  target_limit integer default 80
)
returns table (
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  detail text,
  status text,
  route text,
  result_date timestamptz,
  relevance numeric,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $campaign_hq$
with search_input as (
  select
    trim(
      regexp_replace(
        lower(
          coalesce(
            target_query,
            ''
          )
        ),
        '[^a-z0-9@._ -]+',
        ' ',
        'g'
      )
    ) as clean_query
),
tokens as (
  select
    coalesce(
      array_agg(
        distinct token
      )
      filter (
        where
          char_length(token) >= 2
          and token not in (
            'all',
            'and',
            'are',
            'ask',
            'campaign',
            'can',
            'could',
            'find',
            'for',
            'from',
            'give',
            'have',
            'hq',
            'into',
            'latest',
            'list',
            'most',
            'our',
            'please',
            'recent',
            'show',
            'that',
            'the',
            'their',
            'this',
            'what',
            'where',
            'which',
            'who',
            'with'
          )
      ),
      '{}'::text[]
    ) as words
  from search_input,
  lateral regexp_split_to_table(
    clean_query,
    '\s+'
  ) as token
),
documents as (
  select
    'task'::text
      as result_type,
    task.id
      as result_id,
    task.title
      as title,
    concat_ws(
      ' · ',
      task.category,
      assigned_profile.full_name
    ) as subtitle,
    task.description
      as detail,
    task.status
      as status,
    '/tasks'::text
      as route,
    coalesce(
      task.due_at,
      task.updated_at,
      task.created_at
    ) as result_date,
    concat_ws(
      ' ',
      'task tasks assignment',
      task.title,
      task.description,
      task.category,
      task.priority,
      task.status,
      array_to_string(
        task.tags,
        ' '
      ),
      assigned_profile.full_name,
      assigned_profile.email
    ) as search_text,
    jsonb_build_object(
      'assignee_id',
      task.assigned_to,
      'assignee_name',
      assigned_profile.full_name,
      'priority',
      task.priority,
      'due_at',
      task.due_at
    ) as metadata
  from public.tasks
    as task
  left join public.profiles
    as assigned_profile
    on assigned_profile.id =
      task.assigned_to
  where
    task.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'event'::text,
    event.id,
    event.title,
    concat_ws(
      ' · ',
      event.event_type,
      event.location
    ),
    event.description,
    event.status,
    '/calendar'::text,
    coalesce(
      event.starts_at,
      event.updated_at,
      event.created_at
    ),
    concat_ws(
      ' ',
      'event events calendar meeting',
      event.title,
      event.description,
      event.event_type,
      event.location,
      event.status
    ),
    jsonb_build_object(
      'starts_at',
      event.starts_at,
      'ends_at',
      event.ends_at,
      'location',
      event.location
    )
  from public.events
    as event
  where
    event.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'approval'::text,
    approval.id,
    approval.title,
    concat_ws(
      ' · ',
      approval.approval_type,
      assigned_profile.full_name
    ),
    concat_ws(
      ' ',
      approval.description,
      approval.review_notes
    ),
    approval.status,
    '/approvals'::text,
    coalesce(
      approval.due_at,
      approval.updated_at,
      approval.created_at
    ),
    concat_ws(
      ' ',
      'approval approvals review',
      approval.title,
      approval.description,
      approval.approval_type,
      approval.status,
      approval.review_notes,
      assigned_profile.full_name,
      assigned_profile.email
    ),
    jsonb_build_object(
      'assignee_id',
      approval.assigned_to,
      'assignee_name',
      assigned_profile.full_name,
      'due_at',
      approval.due_at,
      'reviewed_at',
      approval.reviewed_at
    )
  from public.approvals
    as approval
  left join public.profiles
    as assigned_profile
    on assigned_profile.id =
      approval.assigned_to
  where
    approval.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'file'::text,
    campaign_file.id,
    campaign_file.file_name,
    concat_ws(
      ' · ',
      campaign_file.category,
      uploader.full_name
    ),
    concat_ws(
      ' ',
      campaign_file.mime_type,
      pg_size_pretty(
        campaign_file.size_bytes
      )
    ),
    'available'::text,
    '/files'::text,
    campaign_file.created_at,
    concat_ws(
      ' ',
      'file files document documents material materials',
      campaign_file.file_name,
      campaign_file.category,
      campaign_file.mime_type,
      uploader.full_name,
      uploader.email
    ),
    jsonb_build_object(
      'category',
      campaign_file.category,
      'mime_type',
      campaign_file.mime_type,
      'size_bytes',
      campaign_file.size_bytes,
      'uploaded_by',
      campaign_file.uploaded_by
    )
  from public.campaign_files
    as campaign_file
  left join public.profiles
    as uploader
    on uploader.id =
      campaign_file.uploaded_by
  where
    campaign_file.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'contact'::text,
    contact.id,
    contact.full_name,
    concat_ws(
      ' · ',
      replace(
        contact.contact_type,
        '_',
        ' '
      ),
      contact.organization,
      assigned_profile.full_name
    ),
    concat_ws(
      ' · ',
      contact.email,
      contact.phone,
      contact.precinct,
      contact.source,
      contact.notes
    ),
    contact.status,
    '/contacts'::text,
    coalesce(
      contact.next_follow_up_at,
      contact.updated_at,
      contact.created_at
    ),
    concat_ws(
      ' ',
      'contact contacts supporter volunteer donor vendor media endorser',
      contact.full_name,
      contact.email,
      contact.phone,
      contact.organization,
      contact.contact_type,
      contact.precinct,
      contact.source,
      contact.status,
      contact.notes,
      array_to_string(
        contact.tags,
        ' '
      ),
      assigned_profile.full_name,
      assigned_profile.email
    ),
    jsonb_build_object(
      'assignee_id',
      contact.assigned_to,
      'assignee_name',
      assigned_profile.full_name,
      'contact_type',
      contact.contact_type,
      'next_follow_up_at',
      contact.next_follow_up_at,
      'email_consent',
      contact.email_consent,
      'sms_consent',
      contact.sms_consent
    )
  from public.campaign_contacts
    as contact
  left join public.profiles
    as assigned_profile
    on assigned_profile.id =
      contact.assigned_to
  where
    contact.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'communication'::text,
    communication.id,
    communication.title,
    concat_ws(
      ' · ',
      communication.channel,
      communication.audience
    ),
    concat_ws(
      ' ',
      communication.subject,
      communication.message_body
    ),
    communication.status,
    '/communications'::text,
    coalesce(
      communication.scheduled_at,
      communication.updated_at,
      communication.created_at
    ),
    concat_ws(
      ' ',
      'communication communications message messages email text social',
      communication.title,
      communication.channel,
      communication.audience,
      communication.subject,
      communication.message_body,
      communication.status
    ),
    jsonb_build_object(
      'channel',
      communication.channel,
      'audience',
      communication.audience,
      'scheduled_at',
      communication.scheduled_at
    )
  from public.campaign_communications
    as communication
  where
    communication.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'member'::text,
    member.id,
    coalesce(
      profile.full_name,
      'Campaign member'
    ),
    member.display_title,
    profile.email,
    member.status,
    '/team/access'::text,
    null::timestamptz,
    concat_ws(
      ' ',
      'team member staff campaign member',
      profile.full_name,
      profile.email,
      member.role,
      member.role_key,
      member.display_title,
      member.dashboard_type,
      member.seat_type,
      member.status
    ),
    jsonb_build_object(
      'user_id',
      member.user_id,
      'role_key',
      member.role_key,
      'display_title',
      member.display_title,
      'dashboard_type',
      member.dashboard_type,
      'seat_type',
      member.seat_type
    )
  from public.workspace_members
    as member
  left join public.profiles
    as profile
    on profile.id =
      member.user_id
  where
    member.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'activity'::text,
    activity.id,
    activity.title,
    concat_ws(
      ' · ',
      activity.activity_type,
      actor.full_name
    ),
    activity.detail,
    'recorded'::text,
    coalesce(
      activity.route,
      '/dashboard'
    ),
    activity.occurred_at,
    concat_ws(
      ' ',
      'activity update changed recent',
      activity.title,
      activity.detail,
      activity.activity_type,
      activity.entity_type,
      actor.full_name,
      actor.email
    ),
    jsonb_build_object(
      'actor_user_id',
      activity.actor_user_id,
      'entity_type',
      activity.entity_type,
      'entity_id',
      activity.entity_id
    )
  from public.activity_log
    as activity
  left join public.profiles
    as actor
    on actor.id =
      activity.actor_user_id
  where
    activity.workspace_id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )

  union all

  select
    'workspace'::text,
    workspace.id,
    workspace.name,
    workspace.description,
    concat_ws(
      ' · ',
      workspace.location,
      workspace.election_date::text
    ),
    workspace.status,
    '/workspace/settings'::text,
    workspace.election_date::timestamptz,
    concat_ws(
      ' ',
      'workspace campaign election',
      workspace.name,
      workspace.description,
      workspace.location,
      workspace.status,
      workspace.election_date::text
    ),
    jsonb_build_object(
      'location',
      workspace.location,
      'election_date',
      workspace.election_date
    )
  from public.workspaces
    as workspace
  where
    workspace.id =
      target_workspace_id
    and public.is_workspace_member(
      target_workspace_id
    )
),
scored as (
  select
    document.*,
    (
      case
        when input.clean_query = ''
          then 1
        else
          case
            when lower(
              document.search_text
            ) like
              '%' ||
              input.clean_query ||
              '%'
              then 20
            else 0
          end
          +
          coalesce(
            (
              select
                count(*) * 4
              from unnest(
                token_set.words
              ) as word
              where lower(
                document.search_text
              ) like
                '%' ||
                word ||
                '%'
            ),
            0
          )
      end
    )::numeric as relevance
  from documents
    as document
  cross join search_input
    as input
  cross join tokens
    as token_set
)
select
  scored.result_type,
  scored.result_id,
  scored.title,
  scored.subtitle,
  scored.detail,
  scored.status,
  scored.route,
  scored.result_date,
  scored.relevance,
  scored.metadata
from scored
cross join search_input
  as input
where
  input.clean_query = ''
  or scored.relevance > 0
order by
  scored.relevance desc,
  scored.result_date desc
    nulls last,
  scored.title
limit least(
  greatest(
    coalesce(
      target_limit,
      80
    ),
    1
  ),
  100
);
$campaign_hq$;

revoke all
on function
public.search_campaign_hq(
  uuid,
  text,
  integer
)
from public;

grant execute
on function
public.search_campaign_hq(
  uuid,
  text,
  integer
)
to authenticated;

comment on function
public.search_campaign_hq(
  uuid,
  text,
  integer
)
is
'Permission-safe unified Campaign HQ search. Existing table RLS remains authoritative.';

notify pgrst, 'reload schema';

commit;

select
  routine_name,
  security_type
from information_schema.routines
where
  routine_schema =
    'public'
  and routine_name =
    'search_campaign_hq';
