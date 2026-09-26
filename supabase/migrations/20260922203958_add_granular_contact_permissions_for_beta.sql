
insert into public.campaign_permissions (key,name,description,category)
values
  ('contacts.view','View contacts','View authorized campaign contact records.','Contacts'),
  ('contacts.manage','Manage contacts','Create and update authorized campaign contact records.','Contacts')
on conflict (key) do update
set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category;

insert into public.campaign_role_permissions (role_key,permission_key)
values
  ('beta_tester','contacts.view'),
  ('beta_tester','contacts.manage')
on conflict do nothing;

drop policy if exists "Permission scoped contact visibility" on public.campaign_contacts;
create policy "Permission scoped contact visibility"
on public.campaign_contacts
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(workspace_id,'contacts.view')
);

drop policy if exists "Permission scoped contact creation" on public.campaign_contacts;
create policy "Permission scoped contact creation"
on public.campaign_contacts
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(workspace_id,'contacts.manage')
  and created_by = (select auth.uid())
);

drop policy if exists "Permission scoped contact updates" on public.campaign_contacts;
create policy "Permission scoped contact updates"
on public.campaign_contacts
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(workspace_id,'contacts.manage')
)
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(workspace_id,'contacts.manage')
  and (updated_by is null or updated_by = (select auth.uid()))
);
;
