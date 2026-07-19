-- CAMPAIGN HQ — ROUTE FINISH OPTIONS
-- Run once in the campaign Supabase SQL Editor before running the app installer.
--
-- Existing routes remain "End at final stop."
-- Allowed values:
--   final_stop
--   return_start
--   meeting_point

begin;

alter table public.field_routes
  add column if not exists finish_mode text;

update public.field_routes
set finish_mode = 'final_stop'
where finish_mode is null
   or finish_mode not in (
     'final_stop',
     'return_start',
     'meeting_point'
   );

alter table public.field_routes
  alter column finish_mode
  set default 'final_stop';

alter table public.field_routes
  alter column finish_mode
  set not null;

alter table public.field_routes
  drop constraint if exists field_routes_finish_mode_check;

alter table public.field_routes
  add constraint field_routes_finish_mode_check
  check (
    finish_mode in (
      'final_stop',
      'return_start',
      'meeting_point'
    )
  );

comment on column public.field_routes.finish_mode
is
  'Controls whether the field route ends at its last stop, returns to Stop 1, or returns to the assignment meeting point.';

notify pgrst, 'reload schema';

commit;
