-- ============================================================
-- CAMPAIGN SEAT
-- TEXT / WHATSAPP EXTERNAL HANDOFF ACTIONS
--
-- Purpose:
--
-- 1. Save the exact intended outreach BEFORE Campaign Seat
--    opens an external application/share sheet.
--
-- 2. Record when the external handoff was opened.
--
-- 3. Let the campaign user explicitly confirm that the
--    prepared outreach was sent.
--
-- 4. Preserve message body, recipient and channel as durable
--    Campaign Seat history for later AI/context use.
--
-- These actions DO NOT claim Campaign Seat can read SMS or
-- WhatsApp. They record Campaign Seat's own prepared/confirmed
-- workflow until a real messaging provider is connected.
-- ============================================================


-- ============================================================
-- RECIPIENT SNAPSHOT
--
-- Preserve who the outreach was prepared for even if the
-- contact's profile changes later.
-- ============================================================

alter table
public.campaign_external_outreach
add column if not exists
recipient_name text;


alter table
public.campaign_external_outreach
add column if not exists
recipient_phone text;


create index if not exists
campaign_external_outreach_contact_created_idx
on public.campaign_external_outreach (
  workspace_id,
  contact_id,
  created_at desc
);


-- ============================================================
-- PREPARE EXTERNAL OUTREACH
--
-- Requires:
--   * signed-in user
--   * communications.manage OR workspace leadership
--   * saved contact in the same workspace
--   * contact is not Do Not Contact
--   * SMS consent recorded
--   * usable phone number
--   * non-empty message
--
-- Returns the outreach ID so attachments can be linked before
-- the browser leaves Campaign Seat.
-- ============================================================

create or replace function
public.prepare_external_outreach(
  target_workspace_id uuid,
  target_contact_id uuid,
  target_channel text,
  target_message_body text
)
returns jsonb
language plpgsql
security definer
set search_path =
  'public',
  'pg_temp'
as $function$
declare
  actor_user_id uuid :=
    auth.uid();

  normalized_channel text :=
    lower(
      btrim(
        coalesce(
          target_channel,
          ''
        )
      )
    );

  normalized_body text :=
    btrim(
      coalesce(
        target_message_body,
        ''
      )
    );

  target_name text;
  target_phone text;
  target_sms_consent boolean;
  target_status text;

  normalized_phone text;

  created_outreach_id uuid;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat user is required.'
      using errcode = '42501';
  end if;


  if not (
    public.is_workspace_leadership(
      target_workspace_id
    )
    or
    public.has_campaign_permission(
      target_workspace_id,
      'communications.manage'
    )
  ) then
    raise exception
      'You do not have permission to prepare external campaign outreach.'
      using errcode = '42501';
  end if;


  if normalized_channel not in (
    'text',
    'whatsapp'
  ) then
    raise exception
      'External handoff supports Text or WhatsApp.'
      using errcode = '22023';
  end if;


  if target_contact_id is null then
    raise exception
      'Save this recipient as a campaign contact before Text or WhatsApp outreach.'
      using errcode = '22023';
  end if;


  if normalized_body = ''
    or length(normalized_body) > 200000
  then
    raise exception
      'Enter a valid Text or WhatsApp message.'
      using errcode = '22023';
  end if;


  select
    contact.full_name,
    contact.phone,
    contact.sms_consent,
    contact.status
  into
    target_name,
    target_phone,
    target_sms_consent,
    target_status
  from public.campaign_contacts
    as contact
  where
    contact.id =
      target_contact_id
    and contact.workspace_id =
      target_workspace_id;


  if target_name is null then
    raise exception
      'The selected campaign contact could not be found in this workspace.'
      using errcode = 'P0002';
  end if;


  if target_status = 'do_not_contact' then
    raise exception
      'This contact is marked Do not contact. External outreach is blocked.'
      using errcode = '42501';
  end if;


  if target_sms_consent is not true then
    raise exception
      'Text-message consent is not recorded for this contact.'
      using errcode = '42501';
  end if;


  normalized_phone :=
    regexp_replace(
      coalesce(
        target_phone,
        ''
      ),
      '[^0-9+]',
      '',
      'g'
    );


  if
    regexp_replace(
      normalized_phone,
      '[^0-9]',
      '',
      'g'
    ) !~ '^[0-9]{7,20}$'
  then
    raise exception
      'No usable phone number is recorded for this contact.'
      using errcode = '22023';
  end if;


  insert into public.campaign_external_outreach (
    workspace_id,
    contact_id,
    channel,
    message_body,
    status,
    recipient_name,
    recipient_phone,
    created_by,
    updated_by
  )
  values (
    target_workspace_id,
    target_contact_id,
    normalized_channel,
    normalized_body,
    'prepared',
    target_name,
    normalized_phone,
    actor_user_id,
    actor_user_id
  )
  returning id
  into created_outreach_id;


  return jsonb_build_object(
    'success',
    true,
    'outreachId',
    created_outreach_id,
    'status',
    'prepared',
    'channel',
    normalized_channel,
    'recipientName',
    target_name,
    'recipientPhone',
    normalized_phone,
    'messageBody',
    normalized_body
  );
end;
$function$;


revoke all
on function
public.prepare_external_outreach(
  uuid,
  uuid,
  text,
  text
)
from public;

revoke all
on function
public.prepare_external_outreach(
  uuid,
  uuid,
  text,
  text
)
from anon;

grant execute
on function
public.prepare_external_outreach(
  uuid,
  uuid,
  text,
  text
)
to authenticated;


-- ============================================================
-- MARK HANDOFF OPENED
--
-- Called immediately before/when Campaign Seat launches the
-- external device handoff.
-- ============================================================

create or replace function
public.mark_external_outreach_opened(
  target_workspace_id uuid,
  target_outreach_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  'public',
  'pg_temp'
as $function$
declare
  actor_user_id uuid :=
    auth.uid();

  current_status text;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat user is required.'
      using errcode = '42501';
  end if;


  if not (
    public.is_workspace_leadership(
      target_workspace_id
    )
    or
    public.has_campaign_permission(
      target_workspace_id,
      'communications.manage'
    )
  ) then
    raise exception
      'You do not have permission to update external campaign outreach.'
      using errcode = '42501';
  end if;


  select
    outreach.status
  into
    current_status
  from public.campaign_external_outreach
    as outreach
  where
    outreach.id =
      target_outreach_id
    and outreach.workspace_id =
      target_workspace_id
  for update;


  if current_status is null then
    raise exception
      'The prepared external outreach could not be found.'
      using errcode = 'P0002';
  end if;


  if current_status not in (
    'prepared',
    'opened'
  ) then
    raise exception
      'This outreach can no longer be marked as opened.'
      using errcode = '22023';
  end if;


  update public.campaign_external_outreach
  set
    status = 'opened',
    opened_at =
      coalesce(
        opened_at,
        now()
      ),
    updated_by =
      actor_user_id,
    updated_at =
      now()
  where
    id =
      target_outreach_id
    and workspace_id =
      target_workspace_id;


  return jsonb_build_object(
    'success',
    true,
    'outreachId',
    target_outreach_id,
    'status',
    'opened'
  );
end;
$function$;


revoke all
on function
public.mark_external_outreach_opened(
  uuid,
  uuid
)
from public;

revoke all
on function
public.mark_external_outreach_opened(
  uuid,
  uuid
)
from anon;

grant execute
on function
public.mark_external_outreach_opened(
  uuid,
  uuid
)
to authenticated;


-- ============================================================
-- CONFIRM SENT
--
-- This is a HUMAN confirmation.
--
-- It does not represent provider delivery verification.
-- ============================================================

create or replace function
public.confirm_external_outreach_sent(
  target_workspace_id uuid,
  target_outreach_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  'public',
  'pg_temp'
as $function$
declare
  actor_user_id uuid :=
    auth.uid();

  current_status text;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat user is required.'
      using errcode = '42501';
  end if;


  if not (
    public.is_workspace_leadership(
      target_workspace_id
    )
    or
    public.has_campaign_permission(
      target_workspace_id,
      'communications.manage'
    )
  ) then
    raise exception
      'You do not have permission to confirm external campaign outreach.'
      using errcode = '42501';
  end if;


  select
    outreach.status
  into
    current_status
  from public.campaign_external_outreach
    as outreach
  where
    outreach.id =
      target_outreach_id
    and outreach.workspace_id =
      target_workspace_id
  for update;


  if current_status is null then
    raise exception
      'The external outreach could not be found.'
      using errcode = 'P0002';
  end if;


  if current_status not in (
    'prepared',
    'opened',
    'confirmed_sent'
  ) then
    raise exception
      'This outreach cannot be confirmed as sent from its current status.'
      using errcode = '22023';
  end if;


  update public.campaign_external_outreach
  set
    status =
      'confirmed_sent',

    opened_at =
      coalesce(
        opened_at,
        now()
      ),

    confirmed_sent_at =
      coalesce(
        confirmed_sent_at,
        now()
      ),

    updated_by =
      actor_user_id,

    updated_at =
      now()

  where
    id =
      target_outreach_id
    and workspace_id =
      target_workspace_id;


  return jsonb_build_object(
    'success',
    true,
    'outreachId',
    target_outreach_id,
    'status',
    'confirmed_sent',
    'confirmationSource',
    'campaign_user'
  );
end;
$function$;


revoke all
on function
public.confirm_external_outreach_sent(
  uuid,
  uuid
)
from public;

revoke all
on function
public.confirm_external_outreach_sent(
  uuid,
  uuid
)
from anon;

grant execute
on function
public.confirm_external_outreach_sent(
  uuid,
  uuid
)
to authenticated;


-- ============================================================
-- READ MODEL
--
-- Frontend/AI can read the outreach table under existing RLS.
-- No provider-delivery claim is introduced here.
-- ============================================================

notify pgrst, 'reload schema';
