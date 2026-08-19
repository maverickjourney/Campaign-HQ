-- ============================================================
-- CAMPAIGN SEAT
-- ALIGN NYLAS PKCE WITH OFFICIAL NYLAS SDK
--
-- Nylas Hosted OAuth PKCE implementation:
--
--   hex_digest =
--     SHA256(code_verifier) represented as lowercase hex
--
--   code_challenge =
--     Base64(UTF8(hex_digest)) with "=" padding removed
--
-- This intentionally follows Nylas's SDK behavior rather than
-- RFC 7636's raw-digest Base64URL transformation.
--
-- No campaign data, credentials, grants, or onboarding state
-- are modified by this migration.
-- ============================================================

begin;


do $campaign_seat_nylas_pkce$
declare
  function_signature text;
  function_oid oid;

  current_definition text;
  patched_definition text;

  assignment_start integer;
  insert_start integer;

  correct_assignment text :=
    $nylas_pkce_assignment$  encoded_challenge =
    rtrim(
      replace(
        encode(
          convert_to(
            encode(
              extensions.digest(
                raw_code_verifier,
                'sha256'
              ),
              'hex'
            ),
            'UTF8'
          ),
          'base64'
        ),
        chr(10),
        ''
      ),
      '='
    );$nylas_pkce_assignment$;

  test_verifier text :=
    'nylas';

  expected_test_challenge text :=
    'ZTk2YmY2Njg2YTNjMzUxMGU5ZTkyN2RiNzA2OWNiMWNiYTliOTliMDIyZjQ5NDgzYTZjZTMyNzA4MDllNjhhMg';

  calculated_test_challenge text;
begin

  -- ==========================================================
  -- OFFICIAL NYLAS DOCUMENTATION TEST VECTOR
  -- ==========================================================

  calculated_test_challenge =
    rtrim(
      replace(
        encode(
          convert_to(
            encode(
              extensions.digest(
                test_verifier,
                'sha256'
              ),
              'hex'
            ),
            'UTF8'
          ),
          'base64'
        ),
        chr(10),
        ''
      ),
      '='
    );


  if calculated_test_challenge <>
    expected_test_challenge
  then
    raise exception
      'Nylas PKCE implementation failed the official Nylas test vector.';
  end if;


  -- ==========================================================
  -- PATCH INITIAL + REAUTHORIZATION BEGIN FUNCTIONS
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
      or insert_start <= assignment_start
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


    execute
      patched_definition;


    if position(
      'convert_to('
      in pg_get_functiondef(
        to_regprocedure(
          function_signature
        )
      )
    ) = 0
    then
      raise exception
        'Nylas PKCE hex-to-Base64 implementation was not installed in %',
        function_signature;
    end if;


    raise notice
      'Official Nylas PKCE implementation installed: %',
      function_signature;

  end loop;

end;
$campaign_seat_nylas_pkce$;


comment on function
public.begin_email_contacts_oauth(
  uuid,
  text
)
is
  'Begins protected Email & Contacts OAuth using the PKCE challenge transformation implemented by the official Nylas SDK.';


comment on function
public.begin_email_contacts_reauthorization(
  uuid,
  text
)
is
  'Begins protected mailbox reauthorization using the PKCE challenge transformation implemented by the official Nylas SDK.';


commit;
