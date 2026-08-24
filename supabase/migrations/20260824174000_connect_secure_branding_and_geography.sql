begin;

-- ============================================================
-- CAMPAIGN SEAT
-- SECURE BRANDING + STRUCTURED GEOGRAPHY
--
-- Existing workspace is updated, never recreated.
-- ============================================================


-- Preserve the existing validated Campaign Profile function as
-- the private implementation behind our secure wrapper.

do $rename_core$
begin

  if to_regprocedure(
    'public.save_my_seat_campaign_profile_core(jsonb)'
  ) is null
  then

    execute
      'alter function public.save_my_seat_campaign_profile(jsonb)
       rename to save_my_seat_campaign_profile_core';

  end if;

end;
$rename_core$;


revoke all
on function
public.save_my_seat_campaign_profile_core(
  jsonb
)
from
  public,
  anon,
  authenticated;



-- ============================================================
-- SECURE WRAPPER
--
-- Derives geography from structured fields and persists the
-- workspace color choice alongside the Campaign Profile.
-- ============================================================

create or replace function
public.save_my_seat_campaign_profile(
  profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $secure_profile$
declare

  actor_user_id uuid :=
    auth.uid();

  onboarding_run_id_value uuid;

  normalized_profile jsonb;

  core_result jsonb;


  party_value text :=
    lower(
      btrim(
        coalesce(
          profile
            ->> 'political_party',
          ''
        )
      )
    );


  jurisdiction_type_value text :=
    lower(
      btrim(
        coalesce(
          profile
            ->> 'jurisdiction_type',
          ''
        )
      )
    );


  jurisdiction_name_value text :=
    btrim(
      coalesce(
        profile
          ->> 'jurisdiction_name',
        ''
      )
    );


  county_name_value text :=
    btrim(
      coalesce(
        profile
          ->> 'county_name',
        ''
      )
    );


  municipality_name_value text :=
    btrim(
      coalesce(
        profile
          ->> 'municipality_name',
        ''
      )
    );


  state_region_value text :=
    btrim(
      coalesce(
        profile
          ->> 'state_region',
        ''
      )
    );


  country_code_value text :=
    upper(
      btrim(
        coalesce(
          profile
            ->> 'country_code',
          ''
        )
      )
    );


  recommended_theme_value text :=
    case
      when party_value =
        'republican'
      then 'red'

      when party_value =
        'democratic'
      then 'blue'

      else 'neutral'
    end;


  active_theme_value text :=
    lower(
      btrim(
        coalesce(
          profile
            ->> 'active_theme',
          ''
        )
      )
    );


  theme_source_value text :=
    lower(
      btrim(
        coalesce(
          profile
            ->> 'theme_source',
          ''
        )
      )
    );


  location_label_value text;

  location_media_query_value text;

  derived_values jsonb;

begin

  if actor_user_id
    is null
  then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  if
    profile is null
    or jsonb_typeof(
      profile
    ) <> 'object'
  then
    raise exception
      'Campaign Profile data is required.';
  end if;


  select
    onboarding.id

  into onboarding_run_id_value

  from public.seat_customer_contacts
    as contact

  join public.seat_product_accounts
    as account
    on account.primary_contact_id =
      contact.id

  join public.seat_products
    as product
    on product.id =
      account.product_id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and product.product_key =
      'campaign'

    and account.status in (
      'pending_onboarding',
      'onboarding'
    )

    and onboarding.status =
      'in_progress'

    and onboarding.current_step_key =
      'product_profile'

  order by
    onboarding.created_at desc

  limit 1;


  if onboarding_run_id_value
    is null
  then
    raise exception
      'An active Campaign Seat Campaign Profile step was not found.'
      using errcode = '42501';
  end if;


  -- Structured geography becomes authoritative.

  if jurisdiction_type_value =
    'county'
  then

    if county_name_value = ''
    then
      raise exception
        'County is required for a county campaign jurisdiction.';
    end if;

    jurisdiction_name_value :=
      county_name_value;


  elsif jurisdiction_type_value in (
    'city',
    'town',
    'village'
  )
  then

    if municipality_name_value = ''
    then
      raise exception
        'Municipality is required for this campaign jurisdiction.';
    end if;

    jurisdiction_name_value :=
      municipality_name_value;


  elsif jurisdiction_type_value =
    'state'
  then

    if state_region_value = ''
    then
      raise exception
        'State or region is required for a state campaign jurisdiction.';
    end if;

    jurisdiction_name_value :=
      state_region_value;


  elsif jurisdiction_type_value =
    'federal'
  then

    jurisdiction_name_value :=
      case
        when country_code_value =
          'US'
        then 'United States'

        else
          jurisdiction_name_value
      end;


  elsif jurisdiction_name_value = ''
  then

    raise exception
      'Jurisdiction name is required for this jurisdiction type.';

  end if;


  -- Workspace branding.

  if active_theme_value = ''
  then
    active_theme_value :=
      recommended_theme_value;

    theme_source_value :=
      'recommended';
  end if;


  if active_theme_value not in (
    'red',
    'blue',
    'purple',
    'neutral'
  )
  then
    raise exception
      'Workspace color choice is invalid.';
  end if;


  if theme_source_value not in (
    'recommended',
    'campaign_branding'
  )
  then

    theme_source_value :=
      case
        when active_theme_value =
          recommended_theme_value
        then 'recommended'
        else 'campaign_branding'
      end;

  end if;


  location_label_value :=
    case
      when
        state_region_value <> ''
        and lower(
          state_region_value
        ) <>
        lower(
          jurisdiction_name_value
        )
      then
        jurisdiction_name_value ||
        ', ' ||
        state_region_value

      else
        jurisdiction_name_value
    end;


  location_media_query_value :=
    location_label_value ||
    case
      when jurisdiction_type_value =
        'county'
      then ' landscape aerial'

      when jurisdiction_type_value in (
        'city',
        'town',
        'village'
      )
      then ' skyline landscape'

      else ' landscape'
    end;


  derived_values :=
    jsonb_build_object(
      'jurisdiction_name',
      jurisdiction_name_value,

      'recommended_theme',
      recommended_theme_value,

      'active_theme',
      active_theme_value,

      'theme_source',
      theme_source_value,

      'location_label',
      location_label_value,

      'location_media_query',
      location_media_query_value
    );


  normalized_profile :=
    profile ||
    derived_values;


  core_result :=
    public
      .save_my_seat_campaign_profile_core(
        normalized_profile
      );


  -- The original validator intentionally knows only the older
  -- profile schema. Add our new derived fields to the completed
  -- secure onboarding record after it succeeds.

  update public.seat_onboarding_run_steps

  set
    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      derived_values,

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_run_id_value

    and step_key =
      'product_profile';


  return
    core_result ||
    jsonb_build_object(
      'campaign_profile',
      coalesce(
        core_result
          -> 'campaign_profile',
        '{}'::jsonb
      ) ||
      derived_values
    );

end;
$secure_profile$;


revoke all
on function
public.save_my_seat_campaign_profile(
  jsonb
)
from
  public,
  anon;


grant execute
on function
public.save_my_seat_campaign_profile(
  jsonb
)
to authenticated;



-- ============================================================
-- PRODUCT ACCOUNT → WORKSPACE PROFILE PRESENTATION BRIDGE
-- ============================================================

create or replace function
private.apply_seat_product_profile_to_workspace(
  target_product_account_id uuid,
  target_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $apply_profile$
declare

  profile_step_id uuid;

  profile_data jsonb;


  jurisdiction_type_value text;

  jurisdiction_name_value text;

  county_name_value text;

  municipality_name_value text;

  state_region_value text;

  country_code_value text;

  party_value text;

  recommended_theme_value text;

  active_theme_value text;

  theme_source_value text;

  location_label_value text;

  location_media_query_value text;

begin

  select
    step.id,
    step.step_data

  into
    profile_step_id,
    profile_data

  from public.seat_onboarding_runs
    as onboarding

  join public.seat_onboarding_run_steps
    as step
    on step.onboarding_run_id =
      onboarding.id

  where
    onboarding.product_account_id =
      target_product_account_id

    and step.step_key =
      'product_profile'

    and step.status =
      'complete'

  order by
    onboarding.created_at desc

  limit 1;


  if profile_data
    is null
  then
    return;
  end if;


  jurisdiction_type_value :=
    lower(
      btrim(
        coalesce(
          profile_data
            ->> 'jurisdiction_type',
          ''
        )
      )
    );


  jurisdiction_name_value :=
    btrim(
      coalesce(
        profile_data
          ->> 'jurisdiction_name',
        ''
      )
    );


  county_name_value :=
    btrim(
      coalesce(
        profile_data
          ->> 'county_name',
        ''
      )
    );


  municipality_name_value :=
    btrim(
      coalesce(
        profile_data
          ->> 'municipality_name',
        ''
      )
    );


  state_region_value :=
    btrim(
      coalesce(
        profile_data
          ->> 'state_region',
        ''
      )
    );


  country_code_value :=
    upper(
      btrim(
        coalesce(
          profile_data
            ->> 'country_code',
          ''
        )
      )
    );


  party_value :=
    lower(
      btrim(
        coalesce(
          profile_data
            ->> 'political_party',
          ''
        )
      )
    );


  recommended_theme_value :=
    coalesce(
      nullif(
        lower(
          btrim(
            profile_data
              ->> 'recommended_theme'
          )
        ),
        ''
      ),

      case
        when party_value =
          'republican'
        then 'red'

        when party_value =
          'democratic'
        then 'blue'

        else 'neutral'
      end
    );


  active_theme_value :=
    coalesce(
      nullif(
        lower(
          btrim(
            profile_data
              ->> 'active_theme'
          )
        ),
        ''
      ),
      recommended_theme_value
    );


  if active_theme_value not in (
    'red',
    'blue',
    'purple',
    'neutral'
  )
  then
    active_theme_value :=
      recommended_theme_value;
  end if;


  theme_source_value :=
    coalesce(
      nullif(
        lower(
          btrim(
            profile_data
              ->> 'theme_source'
          )
        ),
        ''
      ),
      'recommended'
    );


  if theme_source_value not in (
    'recommended',
    'campaign_branding'
  )
  then
    theme_source_value :=
      'recommended';
  end if;


  if
    jurisdiction_type_value =
      'county'
    and county_name_value <> ''
  then

    jurisdiction_name_value :=
      county_name_value;


  elsif
    jurisdiction_type_value in (
      'city',
      'town',
      'village'
    )
    and municipality_name_value <> ''
  then

    jurisdiction_name_value :=
      municipality_name_value;


  elsif
    jurisdiction_type_value =
      'state'
    and state_region_value <> ''
  then

    jurisdiction_name_value :=
      state_region_value;


  elsif
    jurisdiction_type_value =
      'federal'
    and country_code_value =
      'US'
  then

    jurisdiction_name_value :=
      'United States';

  end if;


  location_label_value :=
    case
      when
        state_region_value <> ''
        and lower(
          state_region_value
        ) <>
        lower(
          jurisdiction_name_value
        )
      then
        jurisdiction_name_value ||
        ', ' ||
        state_region_value

      else
        jurisdiction_name_value
    end;


  location_media_query_value :=
    location_label_value ||
    case
      when jurisdiction_type_value =
        'county'
      then ' landscape aerial'

      when jurisdiction_type_value in (
        'city',
        'town',
        'village'
      )
      then ' skyline landscape'

      else ' landscape'
    end;


  update public.workspaces

  set
    political_party =
      coalesce(
        nullif(
          party_value,
          ''
        ),
        political_party
      ),

    jurisdiction_type =
      coalesce(
        nullif(
          jurisdiction_type_value,
          ''
        ),
        jurisdiction_type
      ),

    jurisdiction_name =
      coalesce(
        nullif(
          jurisdiction_name_value,
          ''
        ),
        jurisdiction_name
      ),

    country_code =
      coalesce(
        nullif(
          country_code_value,
          ''
        ),
        country_code
      ),

    state_region =
      coalesce(
        nullif(
          state_region_value,
          ''
        ),
        state_region
      ),

    county_name =
      nullif(
        county_name_value,
        ''
      ),

    municipality_name =
      nullif(
        municipality_name_value,
        ''
      ),

    postal_code =
      coalesce(
        nullif(
          profile_data
            ->> 'postal_code',
          ''
        ),
        postal_code
      ),

    location =
      coalesce(
        nullif(
          location_label_value,
          ''
        ),
        location
      ),

    recommended_theme =
      recommended_theme_value,

    active_theme =
      active_theme_value,

    theme_source =
      theme_source_value,

    location_context =
      coalesce(
        location_context,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'source',
        'seat_secure_onboarding',

        'display_label',
        location_label_value,

        'media_query',
        location_media_query_value,

        'jurisdiction_type',
        jurisdiction_type_value,

        'jurisdiction_name',
        jurisdiction_name_value,

        'county_name',
        county_name_value,

        'municipality_name',
        municipality_name_value,

        'state_region',
        state_region_value,

        'country_code',
        country_code_value
      ),

    setup_metadata =
      coalesce(
        setup_metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'workspace_branding_source',
        'seat_secure_onboarding',

        'location_display_label',
        location_label_value,

        'location_media_query',
        location_media_query_value
      ),

    updated_at =
      now()

  where id =
    target_workspace_id;


  -- Repair/complete the secure onboarding source record with only
  -- derived presentation/geography values.

  update public.seat_onboarding_run_steps

  set
    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'jurisdiction_name',
        jurisdiction_name_value,

        'recommended_theme',
        recommended_theme_value,

        'active_theme',
        active_theme_value,

        'theme_source',
        theme_source_value,

        'location_label',
        location_label_value,

        'location_media_query',
        location_media_query_value
      ),

    updated_at =
      now()

  where id =
    profile_step_id;

end;
$apply_profile$;


revoke all
on function
private.apply_seat_product_profile_to_workspace(
  uuid,
  uuid
)
from
  public,
  anon,
  authenticated;



create or replace function
private.apply_seat_product_profile_binding()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $profile_binding$
begin

  if
    new.relationship_type =
      'primary'

    and new.status =
      'active'
  then

    perform
      private
        .apply_seat_product_profile_to_workspace(
          new.product_account_id,
          new.workspace_id
        );

  end if;


  return new;

end;
$profile_binding$;


revoke all
on function
private.apply_seat_product_profile_binding()
from
  public,
  anon,
  authenticated;


drop trigger if exists
seat_workspace_binding_profile_identity
on public.seat_workspace_bindings;


create trigger
seat_workspace_binding_profile_identity

after insert
or update of
  product_account_id,
  workspace_id,
  relationship_type,
  status

on public.seat_workspace_bindings

for each row

execute function
private.apply_seat_product_profile_binding();



-- ============================================================
-- REPAIR EXISTING ACTIVATED CAMPAIGN SEAT WORKSPACES
--
-- This updates the existing workspace in place.
-- It does NOT create another workspace.
-- ============================================================

do $backfill$
declare
  binding_record record;
begin

  for binding_record in

    select
      product_account_id,
      workspace_id

    from public.seat_workspace_bindings

    where
      relationship_type =
        'primary'

      and status =
        'active'

  loop

    perform
      private
        .apply_seat_product_profile_to_workspace(
          binding_record
            .product_account_id,

          binding_record
            .workspace_id
        );

  end loop;

end;
$backfill$;


notify pgrst, 'reload schema';

commit;
