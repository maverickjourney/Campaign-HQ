-- ============================================================
-- SEAT PLATFORM
-- FIX SECURE PROPOSAL PGCRYPTO FUNCTION RESOLUTION
--
-- The proposal SECURITY DEFINER functions intentionally use a
-- restricted search_path.
--
-- Supabase normally installs pgcrypto in the extensions schema.
-- Include that trusted schema so gen_random_bytes() and digest()
-- resolve without broadening access to user-controlled schemas.
-- ============================================================

begin;

create schema if not exists extensions;

create extension if not exists pgcrypto
with schema extensions;


do $proposal_crypto_preflight$
begin
  if to_regprocedure(
    'public.send_seat_proposal(uuid,integer)'
  ) is null then
    raise exception
      'Required send_seat_proposal function is missing.';
  end if;

  if to_regprocedure(
    'public.get_seat_proposal_by_token(text)'
  ) is null then
    raise exception
      'Required get_seat_proposal_by_token function is missing.';
  end if;

  if to_regprocedure(
    'public.respond_to_seat_proposal(text,text,text)'
  ) is null then
    raise exception
      'Required respond_to_seat_proposal function is missing.';
  end if;
end
$proposal_crypto_preflight$;


alter function
public.send_seat_proposal(
  uuid,
  integer
)
set search_path
to
  public,
  private,
  extensions,
  pg_temp;


alter function
public.get_seat_proposal_by_token(
  text
)
set search_path
to
  public,
  private,
  extensions,
  pg_temp;


alter function
public.respond_to_seat_proposal(
  text,
  text,
  text
)
set search_path
to
  public,
  private,
  extensions,
  pg_temp;


notify pgrst, 'reload schema';

commit;
