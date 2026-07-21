-- ============================================================
-- CAMPAIGN SEAT
-- REQUIRE A VALID CAMPAIGN INVITATION BEFORE USER CREATION
--
-- Supabase Auth calls this function before inserting auth.users.
-- New accounts are allowed only when the email has a pending,
-- unexpired Campaign Seat workspace invitation.
-- ============================================================

begin;

-- Allow the internal Supabase Auth role to reach the hook and
-- inspect invitation records. Browser roles receive no access.
grant usage
on schema public
to supabase_auth_admin;

grant select
on table public.workspace_invitations
to supabase_auth_admin;


-- RLS policy used only by the internal Supabase Auth hook.
drop policy if exists
  "Auth hook may inspect workspace invitations"
on public.workspace_invitations;

create policy
  "Auth hook may inspect workspace invitations"
on public.workspace_invitations
as permissive
for select
to supabase_auth_admin
using (true);


create or replace function
public.hook_require_workspace_invitation(
  event jsonb
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $campaign_seat_invitation_hook$
declare
  candidate_email text :=
    lower(
      btrim(
        coalesce(
          event
            -> 'user'
            ->> 'email',
          ''
        )
      )
    );

  signup_provider text :=
    lower(
      coalesce(
        event
          -> 'user'
          -> 'app_metadata'
          ->> 'provider',
        ''
      )
    );

  valid_invitation_exists boolean :=
    false;
begin
  if signup_provider <> 'email' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        403,

        'message',
        'Campaign Seat accounts can only be created through a campaign email invitation.'
      )
    );
  end if;

  if candidate_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        400,

        'message',
        'A valid invited email address is required.'
      )
    );
  end if;

  select exists (
    select 1
    from public.workspace_invitations
      as invitation
    where
      lower(
        btrim(
          invitation.email
        )
      ) =
        candidate_email

      and invitation.status =
        'pending'

      and invitation.expires_at >
        now()

      and invitation.accepted_at
        is null

      and invitation.cancelled_at
        is null
  )
  into valid_invitation_exists;

  if not valid_invitation_exists then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        403,

        'message',
        'A valid pending Campaign Seat invitation is required to create this account.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$campaign_seat_invitation_hook$;


revoke all
on function
public.hook_require_workspace_invitation(
  jsonb
)
from
  public,
  anon,
  authenticated;

grant execute
on function
public.hook_require_workspace_invitation(
  jsonb
)
to supabase_auth_admin;

comment on function
public.hook_require_workspace_invitation(
  jsonb
)
is
  'Supabase Before User Created hook allowing account creation only for pending, unexpired Campaign Seat invitations.';


-- Verify that an unrelated email is rejected.
do $campaign_seat_verify$
declare
  result jsonb;
begin
  result :=
    public.hook_require_workspace_invitation(
      jsonb_build_object(
        'user',
        jsonb_build_object(
          'email',
          'uninvited-verification@example.invalid',

          'app_metadata',
          jsonb_build_object(
            'provider',
            'email'
          )
        )
      )
    );

  if result
    -> 'error'
    ->> 'http_code'
    is distinct from
      '403'
  then
    raise exception
      'Invitation-only signup hook verification failed.';
  end if;
end;
$campaign_seat_verify$;

commit;
