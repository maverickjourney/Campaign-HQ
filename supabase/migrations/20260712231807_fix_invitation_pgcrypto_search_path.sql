-- ============================================================
-- CAMPAIGN HQ
-- FIX INVITATION PGCRYPTO SEARCH PATH
--
-- Repairs:
--   function gen_random_bytes(integer) does not exist
--   PostgreSQL error 42883
--
-- The invitation functions are SECURITY DEFINER functions.
-- Their restricted search path currently cannot locate the
-- pgcrypto extension functions used for secure invite tokens.
-- ============================================================

begin;

-- Supabase normally installs pgcrypto in the extensions schema.
-- These statements are safe when the schema and extension
-- already exist.
create schema if not exists extensions;

create extension if not exists pgcrypto
  with schema extensions;

do $campaign_hq$
declare
  crypto_schema text;

  function_signature text;
begin
  -- Locate the real schema containing gen_random_bytes(integer).
  select
    namespace.nspname
  into
    crypto_schema
  from pg_proc as procedure_record
  join pg_namespace as namespace
    on namespace.oid =
      procedure_record.pronamespace
  where procedure_record.proname =
      'gen_random_bytes'
    and pg_get_function_identity_arguments(
      procedure_record.oid
    ) = 'integer'
  order by
    case namespace.nspname
      when 'extensions' then 0
      when 'public' then 1
      else 2
    end
  limit 1;

  if crypto_schema is null then
    raise exception
      'pgcrypto function gen_random_bytes(integer) could not be located after extension verification.';
  end if;

  -- Only the known invitation functions are modified.
  foreach function_signature in array array[
    'public.create_workspace_invitation(uuid,text,text,text,uuid,uuid)',
    'public.prepare_workspace_invitation()',
    'public.accept_workspace_invitation(text)'
  ]
  loop
    if to_regprocedure(
      function_signature
    ) is null then
      raise exception
        'Required invitation function is missing: %',
        function_signature;
    end if;

    execute format(
      'alter function %s set search_path = public, %I, pg_temp',
      function_signature,
      crypto_schema
    );
  end loop;

  raise notice
    'Invitation functions now include crypto schema: %',
    crypto_schema;
end
$campaign_hq$;

-- Ask PostgREST to refresh its function metadata.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- VERIFICATION RESULT
-- This should return three rows.
-- Each proconfig value should include the crypto schema.
-- ============================================================

select
  procedure_record.oid::regprocedure
    as function_signature,

  procedure_record.prosecdef
    as security_definer,

  procedure_record.proconfig
    as function_configuration

from pg_proc as procedure_record

join pg_namespace as namespace
  on namespace.oid =
    procedure_record.pronamespace

where namespace.nspname = 'public'
  and procedure_record.proname in (
    'create_workspace_invitation',
    'prepare_workspace_invitation',
    'accept_workspace_invitation'
  )

order by
  procedure_record.proname;
