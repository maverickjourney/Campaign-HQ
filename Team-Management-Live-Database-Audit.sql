-- ============================================================
-- CAMPAIGN HQ — LIVE TEAM MANAGEMENT DATABASE AUDIT
-- Non-destructive: creates only a temporary audit table.
-- No permanent tables, policies, roles or data are changed.
-- ============================================================

drop table if exists pg_temp.team_management_audit_sections;

create temporary table team_management_audit_sections (
  section text primary key,
  payload jsonb not null
);

-- ============================================================
-- AUDIT CONTEXT
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
values (
  '00_context',
  jsonb_build_object(
    'generated_at', now(),
    'database', current_database(),
    'database_user', current_user,
    'workspace_id',
      '11111111-1111-1111-1111-111111111111',
    'purpose',
      'Verify the live schema before adding invitations, role editing, departments, deactivation and access audit history.'
  )
);

-- ============================================================
-- RELEVANT TABLE INVENTORY
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '01_table_inventory',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', namespace.nspname,
        'table', class.relname,
        'kind',
          case class.relkind
            when 'r' then 'table'
            when 'p' then 'partitioned_table'
            when 'v' then 'view'
            when 'm' then 'materialized_view'
            else class.relkind::text
          end,
        'estimated_rows',
          greatest(class.reltuples::bigint, 0),
        'rls_enabled',
          class.relrowsecurity,
        'rls_forced',
          class.relforcerowsecurity
      )
      order by class.relname
    ),
    '[]'::jsonb
  )
from pg_class as class
join pg_namespace as namespace
  on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relkind in ('r', 'p', 'v', 'm')
  and (
    class.relname = any(
      array[
        'workspaces',
        'profiles',
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'platform_staff',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or class.relname ilike '%invit%'
    or class.relname ilike '%department%'
    or class.relname ilike '%permission%'
    or class.relname ilike '%authority%'
    or class.relname ilike '%member%'
  );

-- ============================================================
-- COLUMNS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '02_columns',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', columns.table_name,
        'position', columns.ordinal_position,
        'column', columns.column_name,
        'data_type', columns.data_type,
        'udt_name', columns.udt_name,
        'nullable', columns.is_nullable,
        'default', columns.column_default
      )
      order by
        columns.table_name,
        columns.ordinal_position
    ),
    '[]'::jsonb
  )
from information_schema.columns as columns
where columns.table_schema = 'public'
  and (
    columns.table_name = any(
      array[
        'workspaces',
        'profiles',
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'platform_staff',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or columns.table_name ilike '%invit%'
    or columns.table_name ilike '%department%'
    or columns.table_name ilike '%permission%'
    or columns.table_name ilike '%authority%'
    or columns.table_name ilike '%member%'
  );

-- ============================================================
-- RLS POLICIES
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '03_rls_policies',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', policies.tablename,
        'policy', policies.policyname,
        'permissive', policies.permissive,
        'roles', policies.roles,
        'command', policies.cmd,
        'using_expression', policies.qual,
        'check_expression', policies.with_check
      )
      order by
        policies.tablename,
        policies.policyname
    ),
    '[]'::jsonb
  )
from pg_policies as policies
where policies.schemaname = 'public'
  and (
    policies.tablename = any(
      array[
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'platform_staff',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or policies.tablename ilike '%invit%'
    or policies.tablename ilike '%department%'
    or policies.tablename ilike '%permission%'
    or policies.tablename ilike '%authority%'
    or policies.tablename ilike '%member%'
  );

-- ============================================================
-- INDEXES
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '04_indexes',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', indexes.tablename,
        'index', indexes.indexname,
        'definition', indexes.indexdef
      )
      order by
        indexes.tablename,
        indexes.indexname
    ),
    '[]'::jsonb
  )
from pg_indexes as indexes
where indexes.schemaname = 'public'
  and (
    indexes.tablename = any(
      array[
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or indexes.tablename ilike '%invit%'
    or indexes.tablename ilike '%department%'
    or indexes.tablename ilike '%permission%'
    or indexes.tablename ilike '%authority%'
    or indexes.tablename ilike '%member%'
  );

-- ============================================================
-- CONSTRAINTS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '05_constraints',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', class.relname,
        'constraint', constraint_record.conname,
        'type',
          case constraint_record.contype
            when 'p' then 'primary_key'
            when 'f' then 'foreign_key'
            when 'u' then 'unique'
            when 'c' then 'check'
            when 'x' then 'exclusion'
            else constraint_record.contype::text
          end,
        'definition',
          pg_get_constraintdef(
            constraint_record.oid,
            true
          )
      )
      order by
        class.relname,
        constraint_record.conname
    ),
    '[]'::jsonb
  )
from pg_constraint as constraint_record
join pg_class as class
  on class.oid = constraint_record.conrelid
join pg_namespace as namespace
  on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and (
    class.relname = any(
      array[
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or class.relname ilike '%invit%'
    or class.relname ilike '%department%'
    or class.relname ilike '%permission%'
    or class.relname ilike '%authority%'
    or class.relname ilike '%member%'
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '06_triggers',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', triggers.event_object_table,
        'trigger', triggers.trigger_name,
        'timing', triggers.action_timing,
        'event', triggers.event_manipulation,
        'statement', triggers.action_statement
      )
      order by
        triggers.event_object_table,
        triggers.trigger_name,
        triggers.event_manipulation
    ),
    '[]'::jsonb
  )
from information_schema.triggers as triggers
where triggers.trigger_schema = 'public'
  and (
    triggers.event_object_table = any(
      array[
        'workspace_members',
        'campaign_roles',
        'campaign_permissions',
        'campaign_role_permissions',
        'campaign_member_permission_overrides',
        'workspace_member_permission_overrides',
        'campaign_permission_overrides',
        'campaign_departments',
        'campaign_teams',
        'campaign_authorities',
        'campaign_invitations',
        'workspace_invitations',
        'team_invitations',
        'activity_log'
      ]
    )
    or triggers.event_object_table ilike '%invit%'
    or triggers.event_object_table ilike '%department%'
    or triggers.event_object_table ilike '%permission%'
    or triggers.event_object_table ilike '%authority%'
    or triggers.event_object_table ilike '%member%'
  );

-- ============================================================
-- RELEVANT DATABASE FUNCTIONS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '07_functions',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'function', procedures.proname,
        'arguments',
          pg_get_function_identity_arguments(
            procedures.oid
          ),
        'returns',
          pg_get_function_result(
            procedures.oid
          ),
        'security_definer',
          procedures.prosecdef,
        'volatility',
          procedures.provolatile
      )
      order by procedures.proname
    ),
    '[]'::jsonb
  )
from pg_proc as procedures
join pg_namespace as namespace
  on namespace.oid = procedures.pronamespace
where namespace.nspname = 'public'
  and (
    procedures.proname = any(
      array[
        'is_workspace_member',
        'is_workspace_admin',
        'set_campaign_updated_at'
      ]
    )
    or procedures.proname ilike '%membership%'
    or procedures.proname ilike '%permission%'
    or procedures.proname ilike '%invitation%'
    or procedures.proname ilike '%department%'
  );

-- ============================================================
-- CURRENT WORKSPACE MEMBERS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '08_workspace_members',
  coalesce(
    jsonb_agg(
      to_jsonb(membership)
      order by
        membership.role_key,
        membership.user_id
    ),
    '[]'::jsonb
  )
from public.workspace_members as membership
where membership.workspace_id =
  '11111111-1111-1111-1111-111111111111'::uuid;

-- ============================================================
-- CAMPAIGN ROLES
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '09_campaign_roles',
  coalesce(
    jsonb_agg(
      to_jsonb(role_record)
    ),
    '[]'::jsonb
  )
from public.campaign_roles as role_record;

-- ============================================================
-- CAMPAIGN PERMISSIONS
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '10_campaign_permissions',
  coalesce(
    jsonb_agg(
      to_jsonb(permission_record)
    ),
    '[]'::jsonb
  )
from public.campaign_permissions as permission_record;

-- ============================================================
-- ROLE-PERMISSION MATRIX
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
select
  '11_campaign_role_permissions',
  coalesce(
    jsonb_agg(
      to_jsonb(role_permission)
    ),
    '[]'::jsonb
  )
from public.campaign_role_permissions as role_permission;

-- ============================================================
-- REQUIRED TEAM-MANAGEMENT CAPABILITIES
-- ============================================================

insert into team_management_audit_sections (
  section,
  payload
)
values (
  '12_required_management_capabilities',
  jsonb_build_array(
    jsonb_build_object(
      'capability', 'invite_member',
      'requires',
      jsonb_build_array(
        'invitation table',
        'unique active invitation constraint',
        'authorized insert policy',
        'expiration and acceptance workflow',
        'audit entry'
      )
    ),
    jsonb_build_object(
      'capability', 'change_member_role',
      'requires',
      jsonb_build_array(
        'authorized workspace_members update policy',
        'role-key validation',
        'candidate-owner protection',
        'audit entry'
      )
    ),
    jsonb_build_object(
      'capability', 'deactivate_member',
      'requires',
      jsonb_build_array(
        'authorized status update policy',
        'self-lockout prevention',
        'last-owner protection',
        'audit entry'
      )
    ),
    jsonb_build_object(
      'capability', 'manage_departments',
      'requires',
      jsonb_build_array(
        'department table',
        'department membership relation',
        'lead assignment',
        'workspace-scoped RLS'
      )
    )
  )
);

-- ============================================================
-- RETURN ONE DOWNLOADABLE JSON RESULT
-- ============================================================

select
  jsonb_pretty(
    jsonb_object_agg(
      section,
      payload
      order by section
    )
  ) as team_management_database_audit
from team_management_audit_sections;
