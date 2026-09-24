-- ============================================================
-- CAMPAIGN SEAT
-- TEXT + UPLOADED EMAIL SIGNATURES
-- ============================================================

begin;


alter table
public.workspace_email_signature_settings
add column if not exists
signature_mode text
not null
default 'text';


alter table
public.workspace_email_signature_settings
add column if not exists
signature_image_path text;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'workspace_email_signature_mode_valid'
      and conrelid =
        'public.workspace_email_signature_settings'::regclass
  ) then

    alter table
    public.workspace_email_signature_settings
    add constraint
    workspace_email_signature_mode_valid
    check (
      signature_mode in (
        'text',
        'image'
      )
    );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'workspace_email_signature_image_path_workspace'
      and conrelid =
        'public.workspace_email_signature_settings'::regclass
  ) then

    alter table
    public.workspace_email_signature_settings
    add constraint
    workspace_email_signature_image_path_workspace
    check (
      signature_image_path is null
      or split_part(
        signature_image_path,
        '/',
        1
      ) =
        workspace_id::text
    );

  end if;

end
$$;


comment on column
public.workspace_email_signature_settings.signature_mode
is
  'Campaign signature rendering mode: text or image.';


comment on column
public.workspace_email_signature_settings.signature_image_path
is
  'Storage object path for an uploaded Campaign Seat email signature image.';


insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-email-signatures',
  'campaign-email-signatures',
  true,
  2097152,
  array[
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id)
do update set
  public =
    excluded.public,
  file_size_limit =
    excluded.file_size_limit,
  allowed_mime_types =
    excluded.allowed_mime_types;


drop policy if exists
  "Campaign leadership can upload email signatures"
on storage.objects;


create policy
  "Campaign leadership can upload email signatures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'campaign-email-signatures'

  and exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id::text =
        split_part(
          storage.objects.name,
          '/',
          1
        )

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


drop policy if exists
  "Campaign leadership can delete email signatures"
on storage.objects;


create policy
  "Campaign leadership can delete email signatures"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'campaign-email-signatures'

  and exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id::text =
        split_part(
          storage.objects.name,
          '/',
          1
        )

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


notify pgrst, 'reload schema';


commit;
