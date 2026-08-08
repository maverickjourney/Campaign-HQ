-- ============================================================
-- CAMPAIGN SEAT
-- CORRECT CAMPAIGN SETUP ONBOARDING PROGRESSION
--
-- The Setup Wizard can preload legacy workspace data before the
-- user reaches later onboarding screens.
--
-- Step completion therefore follows the user's confirmed
-- progression rather than simply the presence of preloaded data.
-- ============================================================

begin;

create or replace function
public.save_campaign_setup_draft(
  target_workspace_id uuid,
  target_payload jsonb,
  target_current_step text
    default 'campaign_identity'
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

  actor_is_authorized boolean;

  payload jsonb :=
    coalesce(
      target_payload,
      '{}'::jsonb
    );

  normalized_current_step text :=
    lower(
      btrim(
        coalesce(
          target_current_step,
          'campaign_identity'
        )
      )
    );

  normalized_campaign_type text :=
    lower(
      btrim(
        coalesce(
          target_payload->>'campaignType',
          ''
        )
      )
    );

  normalized_candidate_name text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'candidateName',
          ''
        )
      ),
      ''
    );

  normalized_public_name text :=
    btrim(
      coalesce(
        target_payload->>'publicCampaignName',
        ''
      )
    );

  normalized_legal_committee text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'legalCommitteeName',
          ''
        )
      ),
      ''
    );

  normalized_office_level text :=
    nullif(
      lower(
        btrim(
          coalesce(
            target_payload->>'officeLevel',
            ''
          )
        )
      ),
      ''
    );

  normalized_office_sought text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'officeSought',
          ''
        )
      ),
      ''
    );

  normalized_jurisdiction_type text :=
    nullif(
      lower(
        btrim(
          coalesce(
            target_payload->>'jurisdictionType',
            ''
          )
        )
      ),
      ''
    );

  normalized_jurisdiction_name text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'jurisdictionName',
          ''
        )
      ),
      ''
    );

  normalized_district_label text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'districtLabel',
          ''
        )
      ),
      ''
    );

  normalized_party text :=
    lower(
      btrim(
        coalesce(
          target_payload->>'politicalParty',
          ''
        )
      )
    );

  normalized_active_theme text :=
    lower(
      btrim(
        coalesce(
          target_payload->>'activeTheme',
          ''
        )
      )
    );

  normalized_timezone text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'timezone',
          ''
        )
      ),
      ''
    );

  normalized_campaign_email text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'campaignEmail',
          ''
        )
      ),
      ''
    );

  normalized_campaign_phone text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'campaignPhone',
          ''
        )
      ),
      ''
    );

  normalized_website_url text :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'websiteUrl',
          ''
        )
      ),
      ''
    );

  normalized_primary_election_date date :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'primaryElectionDate',
          ''
        )
      ),
      ''
    )::date;

  normalized_general_election_date date :=
    nullif(
      btrim(
        coalesce(
          target_payload->>'generalElectionDate',
          ''
        )
      ),
      ''
    )::date;

  normalized_enabled_modules jsonb :=
    coalesce(
      target_payload->'enabledModules',
      '[]'::jsonb
    );

  saved_workspace jsonb;
begin
  perform public.require_aal2();

  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception
      'Campaign Setup payload must be a JSON object.';
  end if;

  select exists (
    select 1
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
      and member.role_key in (
        'campaign_owner',
        'candidate',
        'campaign_consultant',
        'campaign_manager',
        'campaign_administrator'
      )
  )
  into actor_is_authorized;

  if not actor_is_authorized then
    raise exception
      'Your campaign role is not authorized to change Campaign Seat setup.'
      using errcode = '42501';
  end if;

  if normalized_public_name = '' then
    raise exception
      'Enter the public campaign or organization name.';
  end if;

  if char_length(
    normalized_public_name
  ) > 120 then
    raise exception
      'The public campaign name is too long.';
  end if;

  if normalized_campaign_type not in (
    'candidate_campaign',
    'ballot_measure',
    'pac',
    'party_organization',
    'elected_official',
    'advocacy_organization',
    'other'
  ) then
    raise exception
      'Choose a valid Campaign Seat workspace type.';
  end if;

  if (
    normalized_campaign_type =
      'candidate_campaign'
    and normalized_candidate_name is null
  ) then
    raise exception
      'Enter the candidate name.';
  end if;

  if normalized_party not in (
    'republican',
    'democratic',
    'independent',
    'libertarian',
    'green',
    'nonpartisan',
    'other'
  ) then
    raise exception
      'Choose a valid political affiliation.';
  end if;

  if normalized_active_theme not in (
    'red',
    'blue',
    'purple',
    'neutral',
    'custom'
  ) then
    raise exception
      'Choose a Campaign Seat workspace color.';
  end if;

  if (
    normalized_office_level is not null
    and normalized_office_level not in (
      'federal',
      'state',
      'county',
      'municipal',
      'school_board',
      'special_district',
      'other',
      'not_applicable'
    )
  ) then
    raise exception
      'Choose a valid level of office.';
  end if;

  if (
    normalized_jurisdiction_type is not null
    and normalized_jurisdiction_type not in (
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
    )
  ) then
    raise exception
      'Choose a valid jurisdiction type.';
  end if;

  if normalized_current_step not in (
    'campaign_identity',
    'race',
    'election_details',
    'command_center',
    'review'
  ) then
    raise exception
      'Campaign Setup step is invalid.';
  end if;

  if jsonb_typeof(
    normalized_enabled_modules
  ) <> 'array' then
    raise exception
      'Campaign Seat tools must be stored as an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(
      normalized_enabled_modules
    ) as module(value)
    where module.value not in (
      'dashboard',
      'inbox',
      'calendar',
      'tasks',
      'commitments',
      'waiting_on',
      'contacts',
      'documents',
      'approvals',
      'team',
      'volunteers',
      'fundraising',
      'events',
      'social_media',
      'media_center',
      'reports_analytics'
    )
  ) then
    raise exception
      'One or more Campaign Seat tools are invalid.';
  end if;

  update public.workspaces
  set
    name =
      normalized_public_name,

    campaign_type =
      normalized_campaign_type,

    candidate_name =
      normalized_candidate_name,

    legal_committee_name =
      normalized_legal_committee,

    office_level =
      normalized_office_level,

    office_sought =
      normalized_office_sought,

    jurisdiction_type =
      normalized_jurisdiction_type,

    jurisdiction_name =
      normalized_jurisdiction_name,

    district_label =
      normalized_district_label,

    political_party =
      normalized_party,

    primary_election_date =
      normalized_primary_election_date,

    general_election_date =
      normalized_general_election_date,

    timezone =
      normalized_timezone,

    campaign_email =
      normalized_campaign_email,

    campaign_phone =
      normalized_campaign_phone,

    website_url =
      normalized_website_url,

    active_theme =
      normalized_active_theme,

    theme_source =
      'campaign_branding',

    enabled_modules =
      normalized_enabled_modules,

    description =
      case
        when normalized_office_sought
          is not null
        then concat_ws(
          ', ',
          normalized_office_sought,
          normalized_district_label
        )
        else workspaces.description
      end,

    location =
      coalesce(
        normalized_jurisdiction_name,
        workspaces.location
      ),

    election_date =
      coalesce(
        normalized_primary_election_date,
        normalized_general_election_date,
        workspaces.election_date
      ),

    onboarding_status =
      case
        when workspaces.onboarding_status =
          'active'
        then 'active'
        else 'in_progress'
      end,

    onboarding_current_step =
      normalized_current_step,

    onboarding_started_at =
      coalesce(
        workspaces.onboarding_started_at,
        now()
      ),

    setup_metadata =
      workspaces.setup_metadata ||
      jsonb_build_object(
        'last_draft_saved_at',
        now(),
        'last_setup_step',
        normalized_current_step,
        'setup_source',
        'campaign_setup_wizard'
      )

  where
    workspaces.id =
      target_workspace_id;

  if not found then
    raise exception
      'The selected Campaign Seat workspace was not found.';
  end if;


  -- ----------------------------------------------------------
  -- STEP COMPLETION FOLLOWS CONFIRMED WIZARD PROGRESSION.
  --
  -- race:
  --   the Workspace screen has been confirmed.
  --
  -- election_details:
  --   Workspace + Race have been confirmed.
  --
  -- command_center:
  --   Workspace + Race + Election have been confirmed.
  --
  -- review:
  --   Core data has been reviewed, but final Review itself
  --   remains pending until Activate Workspace.
  -- ----------------------------------------------------------

  if normalized_current_step in (
    'race',
    'election_details',
    'command_center',
    'review'
  ) then
    update
    public.workspace_onboarding_steps
    set
      status =
        'complete',

      completed_at =
        coalesce(
          completed_at,
          now()
        ),

      completed_by =
        coalesce(
          completed_by,
          actor_user_id
        ),

      updated_at =
        now()

    where
      workspace_id =
        target_workspace_id
      and step_key =
        'branding';
  end if;


  if normalized_current_step in (
    'election_details',
    'command_center',
    'review'
  ) then
    update
    public.workspace_onboarding_steps
    set
      status =
        'complete',

      completed_at =
        coalesce(
          completed_at,
          now()
        ),

      completed_by =
        coalesce(
          completed_by,
          actor_user_id
        ),

      updated_at =
        now()

    where
      workspace_id =
        target_workspace_id
      and step_key =
        'campaign_identity';
  end if;


  if normalized_current_step in (
    'command_center',
    'review'
  ) then
    update
    public.workspace_onboarding_steps
    set
      status =
        'complete',

      completed_at =
        coalesce(
          completed_at,
          now()
        ),

      completed_by =
        coalesce(
          completed_by,
          actor_user_id
        ),

      updated_at =
        now()

    where
      workspace_id =
        target_workspace_id
      and step_key =
        'election_details';
  end if;


  select
    to_jsonb(
      workspace_record
    )
  into
    saved_workspace
  from
    public.workspaces
      as workspace_record
  where
    workspace_record.id =
      target_workspace_id;

  return saved_workspace;
end;
$campaign_seat$;


revoke all
on function
public.save_campaign_setup_draft(
  uuid,
  jsonb,
  text
)
from
  public,
  anon,
  authenticated;

grant execute
on function
public.save_campaign_setup_draft(
  uuid,
  jsonb,
  text
)
to authenticated;


comment on function
public.save_campaign_setup_draft(
  uuid,
  jsonb,
  text
)
is
  'AAL2-protected Campaign Seat leadership action that saves onboarding progress and completes steps only after their wizard screens are confirmed.';


notify pgrst, 'reload schema';

commit;
