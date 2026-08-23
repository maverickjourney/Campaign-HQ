begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CLIENT ONBOARDING — CAMPAIGN PROFILE
--
-- This stores the Campaign Profile as onboarding draft data.
-- It DOES NOT create a workspace.
--
-- The workspace is created only during the final Activation step.
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
  pg_temp
as $seat_campaign_profile$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  campaign_type_value text :=
    lower(
      btrim(
        coalesce(
          profile ->> 'campaign_type',
          ''
        )
      )
    );

  campaign_name_value text :=
    btrim(
      coalesce(
        profile ->> 'campaign_name',
        ''
      )
    );

  candidate_name_value text :=
    btrim(
      coalesce(
        profile ->> 'candidate_name',
        ''
      )
    );

  legal_committee_name_value text :=
    btrim(
      coalesce(
        profile ->> 'legal_committee_name',
        ''
      )
    );

  office_sought_value text :=
    btrim(
      coalesce(
        profile ->> 'office_sought',
        ''
      )
    );

  office_level_value text :=
    lower(
      btrim(
        coalesce(
          profile ->> 'office_level',
          ''
        )
      )
    );

  district_label_value text :=
    btrim(
      coalesce(
        profile ->> 'district_label',
        ''
      )
    );

  jurisdiction_name_value text :=
    btrim(
      coalesce(
        profile ->> 'jurisdiction_name',
        ''
      )
    );

  jurisdiction_type_value text :=
    lower(
      btrim(
        coalesce(
          profile ->> 'jurisdiction_type',
          ''
        )
      )
    );

  political_party_value text :=
    lower(
      btrim(
        coalesce(
          profile ->> 'political_party',
          ''
        )
      )
    );

  timezone_value text :=
    btrim(
      coalesce(
        profile ->> 'timezone',
        ''
      )
    );

  campaign_email_value text :=
    lower(
      btrim(
        coalesce(
          profile ->> 'campaign_email',
          ''
        )
      )
    );

  campaign_phone_value text :=
    btrim(
      coalesce(
        profile ->> 'campaign_phone',
        ''
      )
    );

  website_url_value text :=
    btrim(
      coalesce(
        profile ->> 'website_url',
        ''
      )
    );

  country_code_value text :=
    upper(
      btrim(
        coalesce(
          profile ->> 'country_code',
          ''
        )
      )
    );

  state_region_value text :=
    btrim(
      coalesce(
        profile ->> 'state_region',
        ''
      )
    );

  county_name_value text :=
    btrim(
      coalesce(
        profile ->> 'county_name',
        ''
      )
    );

  municipality_name_value text :=
    btrim(
      coalesce(
        profile ->> 'municipality_name',
        ''
      )
    );

  postal_code_value text :=
    btrim(
      coalesce(
        profile ->> 'postal_code',
        ''
      )
    );

  disclaimer_text_value text :=
    btrim(
      coalesce(
        profile ->> 'disclaimer_text',
        ''
      )
    );

  primary_date_value date;
  general_date_value date;
  next_date_value date;

  normalized_profile jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  if
    profile is null
    or jsonb_typeof(profile) <> 'object'
  then
    raise exception
      'Campaign Profile data is required.';
  end if;


  select
    contact.customer_id,
    contact.email,
    account.id
      as product_account_id,
    account.account_name,
    onboarding.id
      as onboarding_run_id,
    onboarding.current_step_key,
    onboarding.status
      as onboarding_status
  into onboarding_record
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
  order by
    onboarding.created_at desc
  limit 1
  for update of onboarding;


  if onboarding_record.onboarding_run_id
    is null
  then
    raise exception
      'An active Campaign Seat onboarding run was not found.'
      using errcode = '42501';
  end if;


  if onboarding_record.current_step_key <>
    'product_profile'
  then
    raise exception
      'Campaign Profile is not the current onboarding step.';
  end if;


  if campaign_name_value = '' then
    raise exception
      'Campaign name is required.';
  end if;


  if campaign_type_value not in (
    'candidate_campaign',
    'ballot_measure',
    'pac',
    'party_organization',
    'elected_official',
    'advocacy_organization',
    'other'
  ) then
    raise exception
      'Campaign type is invalid.';
  end if;


  if timezone_value = '' then
    raise exception
      'Campaign timezone is required.';
  end if;


  if not exists (
    select 1
    from pg_timezone_names
    where name =
      timezone_value
  ) then
    raise exception
      'Campaign timezone is invalid.';
  end if;


  if campaign_email_value = '' then
    campaign_email_value :=
      lower(
        btrim(
          onboarding_record.email
        )
      );
  end if;


  if
    campaign_email_value = ''
    or position(
      '@' in campaign_email_value
    ) <= 1
  then
    raise exception
      'Campaign email is invalid.';
  end if;


  if
    website_url_value <> ''
    and website_url_value !~
      '^https?://'
  then
    raise exception
      'Website must begin with http:// or https://.';
  end if;


  if
    country_code_value <> ''
    and country_code_value !~
      '^[A-Z]{2}$'
  then
    raise exception
      'Country code must use two letters.';
  end if;


  if political_party_value <> ''
    and political_party_value not in (
      'republican',
      'democratic',
      'independent',
      'libertarian',
      'green',
      'nonpartisan',
      'other'
    )
  then
    raise exception
      'Political party is invalid.';
  end if;


  if office_level_value <> ''
    and office_level_value not in (
      'federal',
      'state',
      'county',
      'municipal',
      'school_board',
      'special_district',
      'other',
      'not_applicable'
    )
  then
    raise exception
      'Office level is invalid.';
  end if;


  if jurisdiction_type_value <> ''
    and jurisdiction_type_value not in (
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
  then
    raise exception
      'Jurisdiction type is invalid.';
  end if;


  if campaign_type_value =
    'candidate_campaign'
  then
    if candidate_name_value = '' then
      raise exception
        'Candidate name is required.';
    end if;

    if office_sought_value = '' then
      raise exception
        'Office sought is required.';
    end if;

    if office_level_value = '' then
      raise exception
        'Office level is required.';
    end if;

    if jurisdiction_name_value = '' then
      raise exception
        'Jurisdiction is required.';
    end if;

    if political_party_value = '' then
      raise exception
        'Political party is required.';
    end if;
  end if;


  begin
    next_date_value :=
      nullif(
        btrim(
          coalesce(
            profile
              ->> 'next_election_date',
            ''
          )
        ),
        ''
      )::date;

    primary_date_value :=
      nullif(
        btrim(
          coalesce(
            profile
              ->> 'primary_election_date',
            ''
          )
        ),
        ''
      )::date;

    general_date_value :=
      nullif(
        btrim(
          coalesce(
            profile
              ->> 'general_election_date',
            ''
          )
        ),
        ''
      )::date;
  exception
    when others then
      raise exception
        'One or more election dates are invalid.';
  end;


  if
    campaign_type_value =
      'candidate_campaign'
    and next_date_value is null
  then
    raise exception
      'Next election date is required.';
  end if;


  normalized_profile :=
    jsonb_strip_nulls(
      jsonb_build_object(
        'profile_version',
        1,

        'campaign_type',
        campaign_type_value,

        'campaign_name',
        campaign_name_value,

        'candidate_name',
        nullif(
          candidate_name_value,
          ''
        ),

        'legal_committee_name',
        nullif(
          legal_committee_name_value,
          ''
        ),

        'office_sought',
        nullif(
          office_sought_value,
          ''
        ),

        'office_level',
        nullif(
          office_level_value,
          ''
        ),

        'district_label',
        nullif(
          district_label_value,
          ''
        ),

        'jurisdiction_name',
        nullif(
          jurisdiction_name_value,
          ''
        ),

        'jurisdiction_type',
        nullif(
          jurisdiction_type_value,
          ''
        ),

        'political_party',
        nullif(
          political_party_value,
          ''
        ),

        'next_election_date',
        next_date_value,

        'primary_election_date',
        primary_date_value,

        'general_election_date',
        general_date_value,

        'timezone',
        timezone_value,

        'campaign_email',
        campaign_email_value,

        'campaign_phone',
        nullif(
          campaign_phone_value,
          ''
        ),

        'website_url',
        nullif(
          website_url_value,
          ''
        ),

        'country_code',
        nullif(
          country_code_value,
          ''
        ),

        'state_region',
        nullif(
          state_region_value,
          ''
        ),

        'county_name',
        nullif(
          county_name_value,
          ''
        ),

        'municipality_name',
        nullif(
          municipality_name_value,
          ''
        ),

        'postal_code',
        nullif(
          postal_code_value,
          ''
        ),

        'campaign_address',
        jsonb_strip_nulls(
          jsonb_build_object(
            'line1',
            nullif(
              btrim(
                coalesce(
                  profile
                    ->> 'address_line1',
                  ''
                )
              ),
              ''
            ),

            'line2',
            nullif(
              btrim(
                coalesce(
                  profile
                    ->> 'address_line2',
                  ''
                )
              ),
              ''
            ),

            'city',
            nullif(
              btrim(
                coalesce(
                  profile
                    ->> 'address_city',
                  ''
                )
              ),
              ''
            ),

            'state_region',
            nullif(
              state_region_value,
              ''
            ),

            'postal_code',
            nullif(
              postal_code_value,
              ''
            ),

            'country_code',
            nullif(
              country_code_value,
              ''
            )
          )
        ),

        'disclaimer_text',
        nullif(
          disclaimer_text_value,
          ''
        )
      )
    );


  update public.seat_onboarding_run_steps
  set
    step_data =
      normalized_profile,

    status =
      'complete',

    completed_at =
      now(),

    completed_by_user_id =
      actor_user_id,

    updated_at =
      now()
  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id
    and step_key =
      'product_profile';


  update public.seat_onboarding_run_steps
  set
    status =
      'in_progress',

    started_at =
      coalesce(
        started_at,
        now()
      ),

    updated_at =
      now()
  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id
    and step_key =
      'security'
    and status =
      'pending';


  update public.seat_onboarding_runs
  set
    current_step_key =
      'security',

    updated_at =
      now()
  where id =
    onboarding_record.onboarding_run_id;


  insert into
  private.seat_security_events (
    actor_user_id,
    event_type,
    severity,
    customer_id,
    resource_type,
    resource_id,
    metadata,
    occurred_at
  )
  values (
    actor_user_id,
    'seat_campaign_profile_completed',
    'notice',
    onboarding_record.customer_id,
    'seat_product_account',
    onboarding_record.product_account_id::text,
    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,
      'campaign_type',
      campaign_type_value
    ),
    now()
  );


  return jsonb_build_object(
    'ok',
    true,
    'current_step_key',
    'security',
    'campaign_profile',
    normalized_profile
  );
end;
$seat_campaign_profile$;


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


notify pgrst, 'reload schema';

commit;
