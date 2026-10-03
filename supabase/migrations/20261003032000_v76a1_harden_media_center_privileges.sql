
begin;

revoke all privileges
on table public.campaign_media_items
from anon, authenticated;

revoke all privileges
on table public.campaign_media_item_contacts
from anon, authenticated;

revoke all privileges
on table public.campaign_media_item_assets
from anon, authenticated;


grant select, insert, update
on table public.campaign_media_items
to authenticated;

grant select, insert, update
on table public.campaign_media_item_contacts
to authenticated;

grant select, insert, update
on table public.campaign_media_item_assets
to authenticated;

commit;
