-- ============================================================
-- CAMPAIGN SEAT
-- REQUIRE AAL2 FOR SENSITIVE LEADERSHIP ACTIONS
--
-- Protects sensitive RPC calls and direct PostgREST mutations.
-- ============================================================

begin;

-- ============================================================
-- INTERNAL AAL2 ASSERTION
-- ============================================================

create or replace function
public.require_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $campaign_seat_aal2$
declare
  current_user_id uuid :=
    auth.uid();

  current_aal text :=
    coalesce(
      auth.jwt()->>'aal',
      'aal1'
    );
begin
  if current_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using
        errcode = '42501';
  end if;

  if current_aal <> 'aal2' then
    raise exception
      'Two-step verification is required for this protected campaign action.'
      using
        errcode = '42501',
        hint =
          'Complete the Campaign Seat authenticator challenge and try again.';
  end if;
end;
$campaign_seat_aal2$;

revoke all
on function public.require_aal2()
from public, anon, authenticated;

comment on function
public.require_aal2()
is
  'Internal assertion requiring a verified aal2 Campaign Seat user JWT.';


-- ============================================================
-- PATCH THE CURRENTLY DEPLOYED SECURITY-DEFINER FUNCTIONS
-- ============================================================

do $campaign_seat_patch$
declare
  function_signature text;
  function_oid oid;

  current_definition text;
  patched_definition text;

  begin_marker text :=
    E'\nbegin\n';

  begin_position integer;
begin
  foreach function_signature in array array[
    'public.create_workspace_invitation(uuid,text,text,text,uuid,uuid)',
    'public.manage_workspace_member_access(uuid,uuid,text,text,text)',
    'public.manage_workspace_settings(uuid,text,text,text,date)',
    'public.manage_workspace_settings_with_party(uuid,text,text,text,date,text)',
    'public.prepare_workspace_account_deletion(uuid,uuid,text)'
  ]
  loop
    function_oid :=
      to_regprocedure(
        function_signature
      );

    if function_oid is null then
      raise exception
        'Required protected function is missing: %',
        function_signature;
    end if;

    current_definition :=
      pg_get_functiondef(
        function_oid
      );

    if strpos(
      lower(
        current_definition
      ),
      'perform public.require_aal2();'
    ) > 0
    then
      raise notice
        'AAL2 protection already exists: %',
        function_signature;

      continue;
    end if;

    begin_position :=
      strpos(
        lower(
          current_definition
        ),
        begin_marker
      );

    if begin_position = 0 then
      raise exception
        'The main function body could not be located safely: %',
        function_signature;
    end if;

    patched_definition :=
      overlay(
        current_definition

        placing
          E'\nbegin\n  perform public.require_aal2();\n'

        from begin_position

        for char_length(
          begin_marker
        )
      );

    execute patched_definition;

    raise notice
      'AAL2 protection added: %',
      function_signature;
  end loop;
end;
$campaign_seat_patch$;


-- ============================================================
-- DIRECT WORKSPACE-MEMBER MUTATIONS
-- ============================================================

drop policy if exists
  "AAL2 required for workspace member inserts"
on public.workspace_members;

create policy
  "AAL2 required for workspace member inserts"
on public.workspace_members
as restrictive
for insert
to authenticated
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for workspace member updates"
on public.workspace_members;

create policy
  "AAL2 required for workspace member updates"
on public.workspace_members
as restrictive
for update
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
)
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for workspace member deletes"
on public.workspace_members;

create policy
  "AAL2 required for workspace member deletes"
on public.workspace_members
as restrictive
for delete
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


-- ============================================================
-- DIRECT INVITATION MUTATIONS
-- ============================================================

drop policy if exists
  "AAL2 required for invitation inserts"
on public.workspace_invitations;

create policy
  "AAL2 required for invitation inserts"
on public.workspace_invitations
as restrictive
for insert
to authenticated
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for invitation updates"
on public.workspace_invitations;

create policy
  "AAL2 required for invitation updates"
on public.workspace_invitations
as restrictive
for update
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
)
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for invitation deletes"
on public.workspace_invitations;

create policy
  "AAL2 required for invitation deletes"
on public.workspace_invitations
as restrictive
for delete
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


-- ============================================================
-- DIRECT PERMISSION-OVERRIDE MUTATIONS
-- ============================================================

drop policy if exists
  "AAL2 required for permission override inserts"
on public.member_permission_overrides;

create policy
  "AAL2 required for permission override inserts"
on public.member_permission_overrides
as restrictive
for insert
to authenticated
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for permission override updates"
on public.member_permission_overrides;

create policy
  "AAL2 required for permission override updates"
on public.member_permission_overrides
as restrictive
for update
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
)
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for permission override deletes"
on public.member_permission_overrides;

create policy
  "AAL2 required for permission override deletes"
on public.member_permission_overrides
as restrictive
for delete
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


-- ============================================================
-- FUTURE DIRECT WORKSPACE MUTATIONS
-- Existing security-definer RPCs remain protected separately.
-- ============================================================

drop policy if exists
  "AAL2 required for direct workspace inserts"
on public.workspaces;

create policy
  "AAL2 required for direct workspace inserts"
on public.workspaces
as restrictive
for insert
to authenticated
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for direct workspace updates"
on public.workspaces;

create policy
  "AAL2 required for direct workspace updates"
on public.workspaces
as restrictive
for update
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
)
with check (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


drop policy if exists
  "AAL2 required for direct workspace deletes"
on public.workspaces;

create policy
  "AAL2 required for direct workspace deletes"
on public.workspaces
as restrictive
for delete
to authenticated
using (
  coalesce(
    (
      select auth.jwt()->>'aal'
    ),
    'aal1'
  ) = 'aal2'
);


-- ============================================================
-- VERIFY PATCHED FUNCTION DEFINITIONS
-- ============================================================

do $campaign_seat_verify$
declare
  function_signature text;
  function_oid oid;
  current_definition text;
begin
  foreach function_signature in array array[
    'public.create_workspace_invitation(uuid,text,text,text,uuid,uuid)',
    'public.manage_workspace_member_access(uuid,uuid,text,text,text)',
    'public.manage_workspace_settings(uuid,text,text,text,date)',
    'public.manage_workspace_settings_with_party(uuid,text,text,text,date,text)',
    'public.prepare_workspace_account_deletion(uuid,uuid,text)'
  ]
  loop
    function_oid :=
      to_regprocedure(
        function_signature
      );

    if function_oid is null then
      raise exception
        'Protected function verification failed because the function is missing: %',
        function_signature;
    end if;

    current_definition :=
      pg_get_functiondef(
        function_oid
      );

    if strpos(
      lower(
        current_definition
      ),
      'perform public.require_aal2();'
    ) = 0
    then
      raise exception
        'AAL2 verification failed for: %',
        function_signature;
    end if;
  end loop;
end;
$campaign_seat_verify$;

notify pgrst, 'reload schema';

commit;
