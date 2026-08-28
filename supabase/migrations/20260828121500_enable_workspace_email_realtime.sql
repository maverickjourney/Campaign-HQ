do $$
begin
  if not exists (
    select
      1

    from pg_publication_tables

    where pubname =
      'supabase_realtime'

      and schemaname =
        'public'

      and tablename =
        'workspace_integrations'
  )
  then
    alter publication
      supabase_realtime

      add table
        public.workspace_integrations;
  end if;
end;
$$;


drop policy if exists
  "Email viewers can observe email integration state"
on public.workspace_integrations;


create policy
  "Email viewers can observe email integration state"

on public.workspace_integrations

for select

to authenticated

using (
  integration_type =
    'email'

  and provider =
    'nylas'

  and public.can_view_connected_email(
    workspace_id
  )
);


notify pgrst,
  'reload schema';
