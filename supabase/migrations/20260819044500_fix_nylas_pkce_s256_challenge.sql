-- ============================================================
-- CAMPAIGN SEAT
-- FIX NYLAS PKCE S256 CODE CHALLENGE
--
-- RFC 7636 S256:
--
--   BASE64URL(
--     SHA256(
--       ASCII(code_verifier)
--     )
--   )
--
-- The previous implementation hex-encoded the SHA-256 digest
-- before Base64 encoding it. That encoded the textual hex
-- representation rather than the raw SHA-256 bytes and caused:
--
--   invalid_grant
--   Code verifier challenge failed
--
-- This migration patches both:
-- - initial Email & Contacts OAuth
-- - post-onboarding Email & Contacts reauthorization
--
-- It does not alter OAuth state records, credentials,
-- integrations, or onboarding state.
-- ============================================================

begin;


do $campaign_seat_fix_pkce$
declare
  function_signature text;
  function_oid oid;

  current_definition text;
  patched_definition text;

  assignment_start integer;
  insert_start integer;

  correct_assignment text :=
    $pkce_assignment$  encoded_challenge =
    rtrim(
      translate(
        replace(
          encode(
            digest(
              raw_code_verifier,
              'sha256'
            ),
            'base64'
          ),
          E'\n',
          ''
        ),
        '+/',
        '-_'
      ),
      '='
    );$pkce_assignment$;

  test_verifier text :=
    'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

  expected_test_challenge text :=
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  calculated_test_challenge text;
begin

  -- ==========================================================
  -- RFC 7636 TEST VECTOR
  -- ==========================================================

  calculated_test_challenge =
    rtrim(
      translate(
        replace(
          encode(
            digest(
              test_verifier,
              'sha256'
            ),
            'base64'
          ),
          E'\n',
          ''
        ),
        '+/',
        '-_'
      ),
      '='
    );


  if calculated_test_challenge <>
    expected_test_challenge
  then
    raise exception
      'PKCE S256 implementation failed the RFC 7636 test vector.';
  end if;


  -- ==========================================================
  -- PATCH BOTH BEGIN-OAUTH FUNCTIONS
  -- ==========================================================

  foreach function_signature
  in array array[
    'public.begin_email_contacts_oauth(uuid,text)',
    'public.begin_email_contacts_reauthorization(uuid,text)'
  ]
  loop

    function_oid =
      to_regprocedure(
        function_signature
      );


    if function_oid is null then
      raise exception
        'Required OAuth function is missing: %',
        function_signature;
    end if;


    current_definition =
      pg_get_functiondef(
        function_oid
      );


    assignment_start =
      strpos(
        current_definition,
        '  encoded_challenge ='
      );


    insert_start =
      strpos(
        current_definition,
        E'\n\n\n  insert into\n  private.workspace_oauth_states'
      );


    if assignment_start = 0 then
      raise exception
        'PKCE assignment could not be located in %',
        function_signature;
    end if;


    if insert_start = 0
      or insert_start <=
        assignment_start
    then
      raise exception
        'OAuth state insertion boundary could not be located in %',
        function_signature;
    end if;


    patched_definition =
      overlay(
        current_definition

        placing
          correct_assignment

        from
          assignment_start

        for
          insert_start -
          assignment_start
      );


    if strpos(
      patched_definition,
      E'encode(\n                digest('
    ) > 0
    then
      raise exception
        'Unexpected legacy PKCE digest structure remains in %',
        function_signature;
    end if;


    execute
      patched_definition;


    raise notice
      'Correct RFC 7636 S256 challenge installed: %',
      function_signature;

  end loop;

end;
$campaign_seat_fix_pkce$;


comment on function
public.begin_email_contacts_oauth(
  uuid,
  text
)
is
  'Begins AAL2-protected Email & Contacts OAuth using RFC 7636 S256 PKCE over the raw SHA-256 verifier digest.';


comment on function
public.begin_email_contacts_reauthorization(
  uuid,
  text
)
is
  'Begins AAL2-protected post-onboarding mailbox reauthorization using RFC 7636 S256 PKCE over the raw SHA-256 verifier digest.';


commit;
