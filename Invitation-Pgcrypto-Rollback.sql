-- ============================================================
-- CAMPAIGN HQ
-- INVITATION PGCRYPTO SEARCH-PATH ROLLBACK
--
-- This restores the previous restrictive path that omitted the
-- Supabase extension schema. Running this rollback will likely
-- restore the original gen_random_bytes error.
-- ============================================================

begin;

alter function
  public.create_workspace_invitation(
    uuid,
    text,
    text,
    text,
    uuid,
    uuid
  )
  set search_path =
    public,
    pg_temp;

alter function
  public.prepare_workspace_invitation()
  set search_path =
    public,
    pg_temp;

alter function
  public.accept_workspace_invitation(text)
  set search_path =
    public,
    pg_temp;

notify pgrst, 'reload schema';

commit;
