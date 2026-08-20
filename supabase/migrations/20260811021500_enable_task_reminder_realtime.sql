-- ============================================================
-- CAMPAIGN SEAT
-- Task reminder / task alert Supabase Realtime publication
-- Additive and duplicate-safe.
-- ============================================================

do $$
begin

  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname =
      'supabase_realtime'
  ) then
    raise exception
      'supabase_realtime publication does not exist.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where
      pubname =
        'supabase_realtime'
      and schemaname =
        'public'
      and tablename =
        'task_reminders'
  ) then
    execute
      'alter publication supabase_realtime add table public.task_reminders';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where
      pubname =
        'supabase_realtime'
      and schemaname =
        'public'
      and tablename =
        'task_alerts'
  ) then
    execute
      'alter publication supabase_realtime add table public.task_alerts';
  end if;

end;
$$;
