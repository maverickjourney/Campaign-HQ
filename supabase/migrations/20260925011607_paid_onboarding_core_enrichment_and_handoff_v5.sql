
create or replace function public.apply_campaign_seat_paid_setup_enrichment(
  target_workspace_id uuid,
  target_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_payload jsonb := coalesce(target_payload, '{}'::jsonb);
  v_country_code text;
  v_state_region text;
  v_county_name text;
  v_municipality_name text;
  v_postal_code text;
  v_mailing_address text;
  v_disclaimer_text text;
begin
  v_country_code :=
    nullif(upper(btrim(coalesce(v_payload->>'countryCode',''))), '');

  v_state_region :=
    nullif(btrim(coalesce(v_payload->>'stateRegion','')), '');

  v_county_name :=
    nullif(btrim(coalesce(v_payload->>'countyName','')), '');

  v_municipality_name :=
    nullif(btrim(coalesce(v_payload->>'municipalityName','')), '');

  v_postal_code :=
    nullif(btrim(coalesce(v_payload->>'postalCode','')), '');

  v_mailing_address :=
    nullif(btrim(coalesce(v_payload->>'campaignMailingAddress','')), '');

  v_disclaimer_text :=
    nullif(btrim(coalesce(v_payload->>'disclaimerText','')), '');

  if v_country_code is not null and char_length(v_country_code) > 8 then
    raise exception 'Country/region code is too long.';
  end if;

  if v_disclaimer_text is not null and char_length(v_disclaimer_text) > 1000 then
    raise exception 'Campaign disclaimer text is too long.';
  end if;

  update public.workspaces
  set
    country_code =
      case when v_payload ? 'countryCode'
        then coalesce(v_country_code, country_code)
        else country_code
      end,
    state_region =
      case when v_payload ? 'stateRegion'
        then v_state_region
        else state_region
      end,
    county_name =
      case when v_payload ? 'countyName'
        then v_county_name
        else county_name
      end,
    municipality_name =
      case when v_payload ? 'municipalityName'
        then v_municipality_name
        else municipality_name
      end,
    postal_code =
      case when v_payload ? 'postalCode'
        then v_postal_code
        else postal_code
      end,
    campaign_address =
      case when v_payload ? 'campaignMailingAddress'
        then case
          when v_mailing_address is null then '{}'::jsonb
          else jsonb_build_object('formatted', v_mailing_address)
        end
        else campaign_address
      end,
    disclaimer_text =
      case when v_payload ? 'disclaimerText'
        then v_disclaimer_text
        else disclaimer_text
      end,
    location_source =
      case
        when v_payload ? 'stateRegion'
          or v_payload ? 'countyName'
          or v_payload ? 'municipalityName'
          or v_payload ? 'postalCode'
        then 'campaign_setup_wizard'
        else location_source
      end,
    location_context =
      case
        when v_payload ? 'stateRegion'
          or v_payload ? 'countyName'
          or v_payload ? 'municipalityName'
          or v_payload ? 'postalCode'
          or v_payload ? 'countryCode'
        then coalesce(location_context, '{}'::jsonb) ||
          jsonb_strip_nulls(
            jsonb_build_object(
              'countryCode', v_country_code,
              'stateRegion', v_state_region,
              'countyName', v_county_name,
              'municipalityName', v_municipality_name,
              'postalCode', v_postal_code
            )
          )
        else location_context
      end,
    updated_at = now()
  where id = target_workspace_id;

  if not found then
    raise exception 'The selected Campaign Seat workspace was not found.';
  end if;
end;
$$;

revoke all on function public.apply_campaign_seat_paid_setup_enrichment(uuid, jsonb) from public;
revoke all on function public.apply_campaign_seat_paid_setup_enrichment(uuid, jsonb) from anon;
revoke all on function public.apply_campaign_seat_paid_setup_enrichment(uuid, jsonb) from authenticated;
grant execute on function public.apply_campaign_seat_paid_setup_enrichment(uuid, jsonb) to service_role;


create or replace function public.get_campaign_seat_paid_setup_context(
  target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, auth, pg_temp
as $$
declare
  v_token_hash text;
  v_invitation private.seat_onboarding_invitations%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if target_token is null
     or btrim(target_token) !~ '^[A-Fa-f0-9]{64}$'
  then
    return jsonb_build_object('found', false);
  end if;

  v_token_hash :=
    encode(
      extensions.digest(btrim(target_token), 'sha256'),
      'hex'
    );

  select invitation.*
  into v_invitation
  from private.seat_onboarding_invitations invitation
  where invitation.token_hash = v_token_hash
    and coalesce(invitation.metadata->>'source', '') = 'stripe'
  order by invitation.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_invitation.expires_at <= now() then
    return jsonb_build_object('found', false, 'expired', true);
  end if;

  if v_invitation.status <> 'accepted'
     or v_invitation.accepted_by is null
  then
    return jsonb_build_object(
      'found', false,
      'account_setup_required', true
    );
  end if;

  select workspace.*
  into v_workspace
  from public.workspaces workspace
  where workspace.id =
    nullif(v_invitation.metadata->>'workspace_id', '')::uuid;

  if not found then
    raise exception 'The Campaign HQ workspace for this invitation was not found.';
  end if;

  return jsonb_build_object(
    'found', true,
    'setup_complete',
      coalesce(v_invitation.metadata ? 'paid_setup_completed_at', false),
    'email', v_invitation.email,
    'account_name', v_workspace.name,
    'workspace_id', v_workspace.id,
    'current_step', v_workspace.onboarding_current_step,
    'workspace', jsonb_build_object(
      'publicCampaignName', v_workspace.name,
      'campaignType', v_workspace.campaign_type,
      'candidateName', v_workspace.candidate_name,
      'legalCommitteeName', v_workspace.legal_committee_name,
      'officeLevel', v_workspace.office_level,
      'officeSought', v_workspace.office_sought,
      'jurisdictionType', v_workspace.jurisdiction_type,
      'jurisdictionName', v_workspace.jurisdiction_name,
      'districtLabel', v_workspace.district_label,
      'politicalParty', v_workspace.political_party,
      'primaryElectionDate', v_workspace.primary_election_date,
      'generalElectionDate', v_workspace.general_election_date,
      'timezone', v_workspace.timezone,
      'campaignEmail', v_workspace.campaign_email,
      'campaignPhone', v_workspace.campaign_phone,
      'websiteUrl', v_workspace.website_url,
      'activeTheme', v_workspace.active_theme,
      'enabledModules', v_workspace.enabled_modules,
      'countryCode', v_workspace.country_code,
      'stateRegion', v_workspace.state_region,
      'countyName', v_workspace.county_name,
      'municipalityName', v_workspace.municipality_name,
      'postalCode', v_workspace.postal_code,
      'campaignMailingAddress', nullif(v_workspace.campaign_address->>'formatted',''),
      'disclaimerText', v_workspace.disclaimer_text
    )
  );
end;
$$;

revoke all on function public.get_campaign_seat_paid_setup_context(text) from public;
revoke all on function public.get_campaign_seat_paid_setup_context(text) from anon;
revoke all on function public.get_campaign_seat_paid_setup_context(text) from authenticated;
grant execute on function public.get_campaign_seat_paid_setup_context(text) to service_role;


create or replace function public.save_campaign_seat_paid_setup_step(
  target_token text,
  target_payload jsonb,
  target_current_step text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, auth, pg_temp
as $$
declare
  v_token_hash text;
  v_invitation private.seat_onboarding_invitations%rowtype;
  v_workspace_id uuid;
  v_result jsonb;
  v_claims text;
begin
  if target_token is null
     or btrim(target_token) !~ '^[A-Fa-f0-9]{64}$'
  then
    raise exception 'The Campaign Seat setup link is invalid.'
      using errcode = '42501';
  end if;

  v_token_hash :=
    encode(
      extensions.digest(btrim(target_token), 'sha256'),
      'hex'
    );

  select invitation.*
  into v_invitation
  from private.seat_onboarding_invitations invitation
  where invitation.token_hash = v_token_hash
    and coalesce(invitation.metadata->>'source', '') = 'stripe'
    and invitation.status = 'accepted'
    and invitation.accepted_by is not null
    and invitation.expires_at > now()
  for update;

  if not found then
    raise exception 'The Campaign Seat setup link is unavailable or expired.'
      using errcode = '42501';
  end if;

  if v_invitation.metadata ? 'paid_setup_completed_at' then
    raise exception 'Campaign Seat setup is already complete.'
      using errcode = '42501';
  end if;

  v_workspace_id :=
    nullif(v_invitation.metadata->>'workspace_id', '')::uuid;

  if v_workspace_id is null then
    raise exception 'The Campaign Seat setup link is missing its workspace.';
  end if;

  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = v_workspace_id
      and member.user_id = v_invitation.accepted_by
      and member.status = 'active'
      and member.membership_state = 'active'
      and member.role_key = 'campaign_owner'
  ) then
    raise exception 'The invited Campaign Owner no longer has workspace access.'
      using errcode = '42501';
  end if;

  v_claims := jsonb_build_object(
    'sub', v_invitation.accepted_by::text,
    'aal', 'aal2',
    'role', 'authenticated',
    'email', v_invitation.email
  )::text;

  perform set_config('request.jwt.claim.sub', v_invitation.accepted_by::text, true);
  perform set_config('request.jwt.claim', v_claims, true);
  perform set_config('request.jwt.claims', v_claims, true);

  begin
    v_result :=
      public.save_campaign_setup_draft(
        v_workspace_id,
        coalesce(target_payload, '{}'::jsonb),
        target_current_step
      );

    perform public.apply_campaign_seat_paid_setup_enrichment(
      v_workspace_id,
      coalesce(target_payload, '{}'::jsonb)
    );
  exception
    when others then
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('request.jwt.claim', '', true);
      perform set_config('request.jwt.claims', '', true);
      raise;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim', '', true);
  perform set_config('request.jwt.claims', '', true);

  select to_jsonb(workspace_row)
  into v_result
  from public.workspaces workspace_row
  where workspace_row.id = v_workspace_id;

  return v_result;
end;
$$;

revoke all on function public.save_campaign_seat_paid_setup_step(text, jsonb, text) from public;
revoke all on function public.save_campaign_seat_paid_setup_step(text, jsonb, text) from anon;
revoke all on function public.save_campaign_seat_paid_setup_step(text, jsonb, text) from authenticated;
grant execute on function public.save_campaign_seat_paid_setup_step(text, jsonb, text) to service_role;


create or replace function public.activate_campaign_seat_paid_setup(
  target_token text,
  target_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, auth, pg_temp
as $$
declare
  v_token_hash text;
  v_invitation private.seat_onboarding_invitations%rowtype;
  v_workspace_id uuid;
  v_result jsonb;
  v_claims text;
begin
  if target_token is null
     or btrim(target_token) !~ '^[A-Fa-f0-9]{64}$'
  then
    raise exception 'The Campaign Seat setup link is invalid.'
      using errcode = '42501';
  end if;

  v_token_hash :=
    encode(
      extensions.digest(btrim(target_token), 'sha256'),
      'hex'
    );

  select invitation.*
  into v_invitation
  from private.seat_onboarding_invitations invitation
  where invitation.token_hash = v_token_hash
    and coalesce(invitation.metadata->>'source', '') = 'stripe'
    and invitation.status = 'accepted'
    and invitation.accepted_by is not null
    and invitation.expires_at > now()
  for update;

  if not found then
    raise exception 'The Campaign Seat setup link is unavailable or expired.'
      using errcode = '42501';
  end if;

  if v_invitation.metadata ? 'paid_setup_completed_at' then
    return public.get_campaign_seat_paid_setup_context(target_token);
  end if;

  v_workspace_id :=
    nullif(v_invitation.metadata->>'workspace_id', '')::uuid;

  if v_workspace_id is null then
    raise exception 'The Campaign Seat setup link is missing its workspace.';
  end if;

  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = v_workspace_id
      and member.user_id = v_invitation.accepted_by
      and member.status = 'active'
      and member.membership_state = 'active'
      and member.role_key = 'campaign_owner'
  ) then
    raise exception 'The invited Campaign Owner no longer has workspace access.'
      using errcode = '42501';
  end if;

  v_claims := jsonb_build_object(
    'sub', v_invitation.accepted_by::text,
    'aal', 'aal2',
    'role', 'authenticated',
    'email', v_invitation.email
  )::text;

  perform set_config('request.jwt.claim.sub', v_invitation.accepted_by::text, true);
  perform set_config('request.jwt.claim', v_claims, true);
  perform set_config('request.jwt.claims', v_claims, true);

  begin
    v_result :=
      public.activate_campaign_setup(
        v_workspace_id,
        coalesce(target_payload, '{}'::jsonb)
      );

    perform public.apply_campaign_seat_paid_setup_enrichment(
      v_workspace_id,
      coalesce(target_payload, '{}'::jsonb)
    );
  exception
    when others then
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('request.jwt.claim', '', true);
      perform set_config('request.jwt.claims', '', true);
      raise;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim', '', true);
  perform set_config('request.jwt.claims', '', true);

  update private.seat_onboarding_invitations invitation
  set metadata =
        coalesce(invitation.metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'paid_setup_completed_at', now(),
          'paid_setup_completed_by', v_invitation.accepted_by,
          'paid_setup_version', 2
        ),
      updated_at = now()
  where invitation.id = v_invitation.id;

  update public.seat_product_accounts account
  set onboarding_status = 'complete',
      metadata =
        coalesce(account.metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'paid_core_setup_completed_at', now(),
          'paid_core_setup_completed_by', v_invitation.accepted_by
        ),
      updated_at = now()
  where account.id = v_invitation.product_account_id;

  return jsonb_build_object(
    'ok', true,
    'workspace_id', v_workspace_id,
    'setup_complete', true,
    'activation', v_result,
    'next_phase', 'security',
    'sign_in_url', 'https://app.campaignseat.com'
  );
end;
$$;

revoke all on function public.activate_campaign_seat_paid_setup(text, jsonb) from public;
revoke all on function public.activate_campaign_seat_paid_setup(text, jsonb) from anon;
revoke all on function public.activate_campaign_seat_paid_setup(text, jsonb) from authenticated;
grant execute on function public.activate_campaign_seat_paid_setup(text, jsonb) to service_role;
;
