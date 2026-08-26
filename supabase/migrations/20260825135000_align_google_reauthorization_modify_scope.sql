begin;

do $campaign_seat$
declare
  function_definition text;
begin
  select
    pg_get_functiondef(
      procedure_record.oid
    )
  into
    function_definition
  from pg_proc
    as procedure_record
  join pg_namespace
    as namespace_record
    on namespace_record.oid =
      procedure_record.pronamespace
  where
    namespace_record.nspname =
      'public'
    and procedure_record.proname =
      'finalize_email_contacts_reauthorization'
  limit 1;

  if function_definition is null then
    raise exception
      'finalize_email_contacts_reauthorization was not found.';
  end if;

  if position(
    'gmail.readonly'
    in lower(
      function_definition
    )
  ) > 0 then
    function_definition =
      replace(
        function_definition,
        'gmail.readonly',
        'gmail.modify'
      );

    execute
      function_definition;
  elsif position(
    'gmail.modify'
    in lower(
      function_definition
    )
  ) = 0 then
    raise exception
      'The Google Gmail reauthorization scope validator could not be identified.';
  end if;
end;
$campaign_seat$;

notify pgrst, 'reload schema';

commit;
