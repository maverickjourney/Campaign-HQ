-- ============================================================
-- CAMPAIGN SEAT
-- CANDIDATE PROFILE MANAGEMENT
--
-- Purpose:
--   Allow authorized campaign leadership to manage the public
--   candidate/campaign identity after onboarding without
--   modifying the authenticated user's personal account.
--
-- Security:
--   * authenticated session required
--   * AAL2 required
--   * active workspace membership required
--   * leadership role required
--   * candidate authentication/password/MFA are untouched
-- ============================================================

begin;


-- ============================================================
-- EXTEND THE EXISTING WORKSPACE CANDIDATE PROFILE
-- ============================================================

alter table public.workspaces
add column if not exists
  candidate_bio text;

alter table public.workspaces
add column if not exists
  candidate_photo_path text;

alter table public.workspaces
add column if not exists
  candidate_public_email text;

alter table public.workspaces
add column if not exists
  candidate_public_phone text;


-- ============================================================
-- PROTECTED CANDIDATE PROFILE MANAGEMENT RPC
-- ============================================================

create or replace function
public.manage_candidate_campaign_profile(
  target_workspace_id uuid,
  target_candidate_name text,
  target_candidate_bio text default null,
  target_candidate_photo_path text default null,
  target_candidate_public_email text default null,
  target_candidate_public_phone text default null,
  target_public_campaign_name text default null,
  target_legal_committee_name text default null,
  target_office_sought text default null,
  target_office_level text default null,
  target_district_label text default null,
  target_jurisdiction_name text default null,
  target_jurisdiction_type text default null,
  target_primary_election_date date default null,
  target_general_election_date date default null,
  target_timezone text default null,
  target_campaign_email text default null,
  target_campaign_phone text default null,
  target_website_url text default null,
  target_disclaimer_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $campaign_seat$
declare
  actor_user_id uuid :=
    auth.uid();

  actor_role_key text;

  clean_candidate_name text :=
    btrim(
      coalesce(
        target_candidate_name,
        ''
      )
    );

  clean_public_name text :=
    nullif(
      btrim(
        coalesce(
          target_public_campaign_name,
          ''
        )
      ),
      ''
    );

  clean_bio text :=
    nullif(
      btrim(
        coalesce(
          target_candidate_bio,
          ''
        )
      ),
      ''
    );

  clean_photo_path text :=
    nullif(
      btrim(
        coalesce(
          target_candidate_photo_path,
          ''
        )
      ),
      ''
    );

  saved_workspace public.workspaces%rowtype;
begin
  perform public.require_aal2();

  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  select
    member.role_key
  into
    actor_role_key
  from public.workspace_members
    as member
  where
    member.workspace_id =
      target_workspace_id
    and member.user_id =
      actor_user_id
    and member.status =
      'active'
    and member.membership_state =
      'active'
  limit 1;

  if actor_role_key is null then
    raise exception
      'You do not have active access to this campaign workspace.'
      using errcode = '42501';
  end if;

  if actor_role_key not in (
    'campaign_owner',
    'candidate',
    'campaign_consultant',
    'campaign_manager',
    'campaign_administrator'
  ) then
    raise exception
      'Your campaign role cannot manage the candidate profile.'
      using errcode = '42501';
  end if;

  if char_length(clean_candidate_name)
    not between 1 and 160 then
    raise exception
      'Candidate name must be between 1 and 160 characters.';
  end if;

  if clean_bio is not null
    and char_length(clean_bio) > 4000 then
    raise exception
      'Candidate biography must be 4000 characters or fewer.';
  end if;

  if clean_public_name is not null
    and char_length(clean_public_name) > 120 then
    raise exception
      'Public campaign name must be 120 characters or fewer.';
  end if;

  if target_office_level is not null
    and target_office_level not in (
      'federal',
      'state',
      'county',
      'municipal',
      'school_board',
      'special_district',
      'other',
      'not_applicable'
    ) then
    raise exception
      'Choose a valid level of office.';
  end if;

  if target_jurisdiction_type is not null
    and target_jurisdiction_type not in (
      'federal',
      'state',
      'county',
      'city',
      'town',
      'village',
      'district',
      'school_district',
      'special_district',
      'other'
    ) then
    raise exception
      'Choose a valid jurisdiction type.';
  end if;

  update public.workspaces
  set
    candidate_name =
      clean_candidate_name,

    candidate_bio =
      clean_bio,

    candidate_photo_path =
      clean_photo_path,

    candidate_public_email =
      nullif(
        btrim(
          coalesce(
            target_candidate_public_email,
            ''
          )
        ),
        ''
      ),

    candidate_public_phone =
      nullif(
        btrim(
          coalesce(
            target_candidate_public_phone,
            ''
          )
        ),
        ''
      ),

    name =
      coalesce(
        clean_public_name,
        workspaces.name
      ),

    legal_committee_name =
      nullif(
        btrim(
          coalesce(
            target_legal_committee_name,
            ''
          )
        ),
        ''
      ),

    office_sought =
      nullif(
        btrim(
          coalesce(
            target_office_sought,
            ''
          )
        ),
        ''
      ),

    office_level =
      nullif(
        lower(
          btrim(
            coalesce(
              target_office_level,
              ''
            )
          )
        ),
        ''
      ),

    district_label =
      nullif(
        btrim(
          coalesce(
            target_district_label,
            ''
          )
        ),
        ''
      ),

    jurisdiction_name =
      nullif(
        btrim(
          coalesce(
            target_jurisdiction_name,
            ''
          )
        ),
        ''
      ),

    jurisdiction_type =
      nullif(
        lower(
          btrim(
            coalesce(
              target_jurisdiction_type,
              ''
            )
          )
        ),
        ''
      ),

    primary_election_date =
      target_primary_election_date,

    general_election_date =
      target_general_election_date,

    timezone =
      nullif(
        btrim(
          coalesce(
            target_timezone,
            ''
          )
        ),
        ''
      ),

    campaign_email =
      nullif(
        btrim(
          coalesce(
            target_campaign_email,
            ''
          )
        ),
        ''
      ),

    campaign_phone =
      nullif(
        btrim(
          coalesce(
            target_campaign_phone,
            ''
          )
        ),
        ''
      ),

    website_url =
      nullif(
        btrim(
          coalesce(
            target_website_url,
            ''
          )
        ),
        ''
      ),

    disclaimer_text =
      nullif(
        btrim(
          coalesce(
            target_disclaimer_text,
            ''
          )
        ),
        ''
      ),

    description =
      case
        when nullif(
          btrim(
            coalesce(
              target_office_sought,
              ''
            )
          ),
          ''
        ) is not null
        then concat_ws(
          ', ',
          nullif(
            btrim(
              target_office_sought
            ),
            ''
          ),
          nullif(
            btrim(
              target_district_label
            ),
            ''
          )
        )
        else
          workspaces.description
      end,

    location =
      coalesce(
        nullif(
          btrim(
            coalesce(
              target_jurisdiction_name,
              ''
            )
          ),
          ''
        ),
        workspaces.location
      )

  where
    workspaces.id =
      target_workspace_id

  returning *
  into saved_workspace;

  if not found then
    raise exception
      'The selected campaign workspace was not found.';
  end if;

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
    actor_user_id,
    'candidate_profile_updated',
    'Candidate profile updated',
    clean_candidate_name,
    'workspace',
    target_workspace_id,
    '/workspace/candidate-profile',
    jsonb_build_object(
      'candidate_name',
      clean_candidate_name,
      'managed_by_role',
      actor_role_key
    ),
    now()
  );

  return jsonb_build_object(
    'id',
      saved_workspace.id,

    'name',
      saved_workspace.name,

    'candidate_name',
      saved_workspace.candidate_name,

    'candidate_bio',
      saved_workspace.candidate_bio,

    'candidate_photo_path',
      saved_workspace.candidate_photo_path,

    'candidate_public_email',
      saved_workspace.candidate_public_email,

    'candidate_public_phone',
      saved_workspace.candidate_public_phone,

    'legal_committee_name',
      saved_workspace.legal_committee_name,

    'office_sought',
      saved_workspace.office_sought,

    'office_level',
      saved_workspace.office_level,

    'district_label',
      saved_workspace.district_label,

    'jurisdiction_name',
      saved_workspace.jurisdiction_name,

    'jurisdiction_type',
      saved_workspace.jurisdiction_type,

    'primary_election_date',
      saved_workspace.primary_election_date,

    'general_election_date',
      saved_workspace.general_election_date,

    'timezone',
      saved_workspace.timezone,

    'campaign_email',
      saved_workspace.campaign_email,

    'campaign_phone',
      saved_workspace.campaign_phone,

    'website_url',
      saved_workspace.website_url,

    'disclaimer_text',
      saved_workspace.disclaimer_text
  );
end
$campaign_seat$;


revoke all
on function
public.manage_candidate_campaign_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function
public.manage_candidate_campaign_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text
)
to authenticated;


comment on function
public.manage_candidate_campaign_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text
)
is
'Allows AAL2-authenticated campaign leadership to manage the public candidate/campaign profile without changing candidate authentication credentials.';


notify pgrst, 'reload schema';

commit;
