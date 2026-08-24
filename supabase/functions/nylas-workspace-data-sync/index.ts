import {
  createClient,
} from "npm:@supabase/supabase-js@2";


const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://www.campaignseat.com",
    "http://127.0.0.1:5180",
    "http://localhost:5180",
  ]);


const DAY_SECONDS =
  24 * 60 * 60;

const MAX_CALENDAR_PAGES =
  20;

const MAX_CONTACT_PAGES =
  20;


function corsHeaders(
  request: Request,
) {
  const origin =
    request.headers.get(
      "origin",
    ) || "";

  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.has(
        origin,
      )
        ? origin
        : "",

    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Vary":
      "Origin",
  };
}


function jsonResponse(
  request: Request,
  status: number,
  payload: Record<
    string,
    unknown
  >,
) {
  return new Response(
    JSON.stringify(
      payload,
    ),
    {
      status,

      headers: {
        ...corsHeaders(
          request,
        ),

        "Content-Type":
          "application/json",

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}


async function fetchNylasJson(
  url: URL,
  apiKey: string,
) {
  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },
      },
    );


  if (!response.ok) {
    let detail =
      "";

    try {
      detail =
        await response.text();
    } catch {
      detail =
        "";
    }


    throw new Error(
      `Nylas request failed (${response.status}): ${detail.slice(0, 1000)}`,
    );
  }


  return await response.json();
}


function unixToIso(
  value: unknown,
) {
  const seconds =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      seconds,
    )
  ) {
    return null;
  }


  return new Date(
    seconds * 1000,
  ).toISOString();
}


function dateToNoonUtc(
  value: unknown,
) {
  const date =
    String(
      value ||
      "",
    ).trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      date,
    )
  ) {
    return null;
  }


  const parsed =
    new Date(
      `${date}T12:00:00.000Z`,
    );


  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed.toISOString();
}


function normalizeWhen(
  whenValue: unknown,
) {
  const when =
    (
      whenValue &&
      typeof whenValue ===
        "object"
    )
      ? whenValue as
          Record<
            string,
            unknown
          >
      : {};


  const object =
    String(
      when.object ||
      "",
    )
      .trim()
      .toLowerCase();


  if (
    object ===
      "timespan"
  ) {
    const startsAt =
      unixToIso(
        when.start_time,
      );

    const endsAt =
      unixToIso(
        when.end_time,
      );

    if (!startsAt) {
      return null;
    }

    return {
      startsAt,

      endsAt:
        endsAt ||
        startsAt,

      isAllDay:
        false,
    };
  }


  if (
    object ===
      "time"
  ) {
    const startsAt =
      unixToIso(
        when.time,
      );

    if (!startsAt) {
      return null;
    }

    return {
      startsAt,

      endsAt:
        startsAt,

      isAllDay:
        false,
    };
  }


  if (
    object ===
      "date"
  ) {
    const startsAt =
      dateToNoonUtc(
        when.date,
      );

    if (!startsAt) {
      return null;
    }

    return {
      startsAt,

      endsAt:
        startsAt,

      isAllDay:
        true,
    };
  }


  if (
    object ===
      "datespan"
  ) {
    const startsAt =
      dateToNoonUtc(
        when.start_date,
      );

    const endsAt =
      dateToNoonUtc(
        when.end_date,
      );

    if (!startsAt) {
      return null;
    }

    return {
      startsAt,

      endsAt:
        endsAt ||
        startsAt,

      isAllDay:
        true,
    };
  }


  return null;
}


function normalizeLocation(
  value: unknown,
) {
  if (
    typeof value ===
      "string"
  ) {
    return value;
  }


  if (
    value &&
    typeof value ===
      "object"
  ) {
    const location =
      value as Record<
        string,
        unknown
      >;

    return String(
      location.description ||
      location.address ||
      location.name ||
      "",
    );
  }


  return "";
}


function firstString(
  values: unknown,
  key: string,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return "";
  }


  for (
    const item
    of values
  ) {
    if (
      item &&
      typeof item ===
        "object"
    ) {
      const value =
        String(
          (
            item as
              Record<
                string,
                unknown
              >
          )[key] ||
          "",
        ).trim();

      if (value) {
        return value;
      }
    }
  }


  return "";
}


function contactFullName(
  contact:
    Record<
      string,
      unknown
    >,
) {
  const name =
    [
      String(
        contact.given_name ||
        "",
      ).trim(),

      String(
        contact.middle_name ||
        "",
      ).trim(),

      String(
        contact.surname ||
        "",
      ).trim(),
    ]
      .filter(
        Boolean,
      )
      .join(
        " ",
      )
      .trim();


  if (name) {
    return name;
  }


  return (
    String(
      contact.nickname ||
      "",
    ).trim() ||

    firstString(
      contact.emails,
      "email",
    ) ||

    firstString(
      contact.phone_numbers,
      "number",
    ) ||

    "Provider contact"
  );
}


Deno.serve(
  async (
    request: Request,
  ) => {
    const origin =
      request.headers.get(
        "origin",
      ) || "";


    if (
      origin &&
      !ALLOWED_ORIGINS.has(
        origin,
      )
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            "Origin not allowed.",
        },
      );
    }


    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,

          headers:
            corsHeaders(
              request,
            ),
        },
      );
    }


    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        request,
        405,
        {
          error:
            "Method not allowed.",
        },
      );
    }


    const authorization =
      request.headers.get(
        "authorization",
      ) || "";


    if (
      !authorization
        .toLowerCase()
        .startsWith(
          "bearer ",
        )
    ) {
      return jsonResponse(
        request,
        401,
        {
          error:
            "A signed-in Campaign Seat session is required.",
        },
      );
    }


    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      ) || "";

    const anonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      ) || "";

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    const nylasApiKey =
      Deno.env.get(
        "NYLAS_API_KEY",
      ) || "";

    const nylasApiUri =
      (
        Deno.env.get(
          "NYLAS_API_URI",
        ) ||
        "https://api.us.nylas.com"
      ).replace(
        /\/+$/,
        "",
      );


    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !nylasApiKey
    ) {
      return jsonResponse(
        request,
        503,
        {
          error:
            "Campaign Seat provider synchronization is not configured.",
        },
      );
    }


    let body:
      Record<
        string,
        unknown
      >;


    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A valid request is required.",
        },
      );
    }


    const workspaceId =
      String(
        body.workspaceId ||
        "",
      ).trim();


    if (!workspaceId) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A Campaign Seat workspace is required.",
        },
      );
    }


    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },

          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,

            detectSessionInUrl:
              false,
          },
        },
      );


    const {
      data:
        userData,
      error:
        userError,
    } =
      await userClient.auth
        .getUser();


    const actorUser =
      userData?.user;


    if (
      userError ||
      !actorUser?.id
    ) {
      return jsonResponse(
        request,
        401,
        {
          error:
            "The Campaign Seat session could not be verified.",
        },
      );
    }


    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,

            detectSessionInUrl:
              false,
          },
        },
      );


    const {
      data:
        membership,
      error:
        membershipError,
    } =
      await adminClient
        .from(
          "workspace_members",
        )
        .select(
          "id",
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .eq(
          "user_id",
          actorUser.id,
        )
        .eq(
          "status",
          "active",
        )
        .eq(
          "membership_state",
          "active",
        )
        .in(
          "dashboard_type",
          [
            "command",
            "candidate",
          ],
        )
        .limit(
          1,
        )
        .maybeSingle();


    if (
      membershipError ||
      !membership
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            "Active campaign leadership access is required to synchronize provider data.",
        },
      );
    }


    const {
      data:
        initialSyncJob,
      error:
        initialSyncJobError,
    } =
      await adminClient.rpc(
        "begin_seat_workspace_initial_sync",
        {
          target_workspace_id:
            workspaceId,
        },
      );


    if (initialSyncJobError) {
      console.warn(
        "Campaign Seat initial sync job could not be started",
        initialSyncJobError,
      );
    }


    const {
      data:
        calendarRuntimes,
      error:
        calendarRuntimeError,
    } =
      await adminClient.rpc(
        "get_calendar_runtime_connections_for_service",
        {
          target_workspace_id:
            workspaceId,
        },
      );


    if (calendarRuntimeError) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve connected Calendars.",
        },
      );
    }


    const {
      data:
        contactRuntimes,
      error:
        contactsRuntimeError,
    } =
      await adminClient.rpc(
        "get_contacts_runtime_connections_for_service",
        {
          target_workspace_id:
            workspaceId,
        },
      );


    if (contactsRuntimeError) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve connected Contacts providers.",
        },
      );
    }


    const calendarResults:
      Array<
        Record<
          string,
          unknown
        >
      > = [];


    const contactResults:
      Array<
        Record<
          string,
          unknown
        >
      > = [];


    // ========================================================
    // CALENDAR READ SYNC
    // ========================================================

    for (
      const runtime
      of (
        Array.isArray(
          calendarRuntimes,
        )
          ? calendarRuntimes
          : []
      )
    ) {
      if (
        runtime?.read_ready !==
          true
      ) {
        continue;
      }


      const integrationId =
        String(
          runtime.integration_id ||
          "",
        );

      const grantId =
        String(
          runtime.grant_reference ||
          "",
        );

      const accountProvider =
        String(
          runtime.account_provider ||
          "",
        );


      if (
        !integrationId ||
        !grantId
      ) {
        continue;
      }


      try {
        const calendarsUrl =
          new URL(
            `${nylasApiUri}/v3/grants/${encodeURIComponent(grantId)}/calendars`,
          );

        calendarsUrl
          .searchParams
          .set(
            "limit",
            "50",
          );


        const calendarsPayload =
          await fetchNylasJson(
            calendarsUrl,
            nylasApiKey,
          );


        const calendars =
          Array.isArray(
            calendarsPayload?.data,
          )
            ? calendarsPayload.data
            : [];


        const primaryCalendar =
          calendars.find(
            (
              calendar:
                Record<
                  string,
                  unknown
                >,
            ) =>
              calendar
                ?.is_primary ===
              true,
          );


        if (
          !primaryCalendar
            ?.id
        ) {
          throw new Error(
            "Provider did not return a primary Calendar.",
          );
        }


        const calendarId =
          String(
            primaryCalendar.id,
          );

        const calendarName =
          String(
            primaryCalendar.name ||
            "Primary calendar",
          );

        const calendarTimezone =
          String(
            primaryCalendar.timezone ||
            "",
          );


        const nowSeconds =
          Math.floor(
            Date.now() /
            1000,
          );

        const startSeconds =
          nowSeconds -
          30 *
          DAY_SECONDS;

        const endSeconds =
          nowSeconds +
          120 *
          DAY_SECONDS;


        const providerEvents:
          Array<
            Record<
              string,
              unknown
            >
          > = [];


        let pageToken =
          "";

        let pageCount =
          0;


        do {
          pageCount +=
            1;


          if (
            pageCount >
            MAX_CALENDAR_PAGES
          ) {
            throw new Error(
              "Calendar synchronization exceeded the safe page limit.",
            );
          }


          const eventsUrl =
            new URL(
              `${nylasApiUri}/v3/grants/${encodeURIComponent(grantId)}/events`,
            );


          eventsUrl
            .searchParams
            .set(
              "calendar_id",
              calendarId,
            );

          eventsUrl
            .searchParams
            .set(
              "start",
              String(
                startSeconds,
              ),
            );

          eventsUrl
            .searchParams
            .set(
              "end",
              String(
                endSeconds,
              ),
            );

          eventsUrl
            .searchParams
            .set(
              "limit",
              "50",
            );

          eventsUrl
            .searchParams
            .set(
              "expand_recurring",
              "true",
            );

          eventsUrl
            .searchParams
            .set(
              "show_cancelled",
              "true",
            );


          if (pageToken) {
            eventsUrl
              .searchParams
              .set(
                "page_token",
                pageToken,
              );
          }


          const eventsPayload =
            await fetchNylasJson(
              eventsUrl,
              nylasApiKey,
            );


          const events =
            Array.isArray(
              eventsPayload?.data,
            )
              ? eventsPayload.data
              : [];


          providerEvents.push(
            ...events,
          );


          pageToken =
            String(
              eventsPayload
                ?.next_cursor ||
              "",
            );

        } while (
          pageToken
        );


        let importedCount =
          0;

        let skippedCount =
          0;


        for (
          const providerEvent
          of providerEvents
        ) {
          const externalEventId =
            String(
              providerEvent.id ||
              "",
            ).trim();


          const normalizedTime =
            normalizeWhen(
              providerEvent.when,
            );


          if (
            !externalEventId ||
            !normalizedTime
          ) {
            skippedCount +=
              1;

            continue;
          }


          const externalCalendarId =
            String(
              providerEvent
                .calendar_id ||
              calendarId,
            ).trim();


          const {
            error:
              upsertError,
          } =
            await adminClient.rpc(
              "upsert_nylas_calendar_event_from_integration",
              {
                target_workspace_id:
                  workspaceId,

                target_source_integration_id:
                  integrationId,

                target_external_calendar_id:
                  externalCalendarId,

                target_external_event_id:
                  externalEventId,

                target_external_ical_uid:
                  String(
                    providerEvent
                      .ical_uid ||
                    "",
                  ),

                target_title:
                  String(
                    providerEvent
                      .title ||
                    "",
                  ),

                target_description:
                  String(
                    providerEvent
                      .description ||
                    "",
                  ),

                target_location:
                  normalizeLocation(
                    providerEvent
                      .location,
                  ),

                target_starts_at:
                  normalizedTime
                    .startsAt,

                target_ends_at:
                  normalizedTime
                    .endsAt,

                target_status:
                  String(
                    providerEvent
                      .status ||
                    "",
                  ),

                target_is_all_day:
                  normalizedTime
                    .isAllDay,

                target_external_updated_at:
                  unixToIso(
                    providerEvent
                      .updated_at,
                  ),

                target_sync_metadata: {
                  provider:
                    "nylas",

                  account_provider:
                    accountProvider,

                  source_integration_id:
                    integrationId,

                  calendar_id:
                    externalCalendarId,

                  calendar_name:
                    calendarName,

                  calendar_timezone:
                    calendarTimezone,

                  html_link:
                    providerEvent
                      .html_link ||
                    null,

                  recurrence:
                    providerEvent
                      .recurrence ||
                    null,

                  when:
                    providerEvent
                      .when ||
                    null,
                },
              },
            );


          if (upsertError) {
            throw new Error(
              `Campaign Seat could not save provider event ${externalEventId}: ${upsertError.message}`,
            );
          }


          importedCount +=
            1;
        }


        const {
          error:
            completeError,
        } =
          await adminClient.rpc(
            "complete_nylas_calendar_integration_sync",
            {
              target_workspace_id:
                workspaceId,

              target_source_integration_id:
                integrationId,

              target_calendar_id:
                calendarId,

              target_calendar_name:
                calendarName,

              target_calendar_timezone:
                calendarTimezone,

              target_imported_count:
                importedCount,
            },
          );


        if (completeError) {
          throw new Error(
            completeError.message,
          );
        }


        calendarResults.push({
          integrationId,

          provider:
            accountProvider,

          email:
            runtime.connected_email,

          imported:
            importedCount,

          skipped:
            skippedCount,
        });

      } catch (
        calendarError
      ) {
        calendarResults.push({
          integrationId,

          provider:
            accountProvider,

          email:
            runtime.connected_email,

          error:
            calendarError instanceof
              Error
              ? calendarError.message
              : "Calendar synchronization failed.",
        });
      }
    }


    // ========================================================
    // CONTACTS READ SYNC
    // ========================================================

    for (
      const runtime
      of (
        Array.isArray(
          contactRuntimes,
        )
          ? contactRuntimes
          : []
      )
    ) {
      if (
        runtime?.read_ready !==
          true ||
        runtime?.import_ready !==
          true
      ) {
        continue;
      }


      const integrationId =
        String(
          runtime.integration_id ||
          "",
        );

      const grantId =
        String(
          runtime.grant_reference ||
          "",
        );

      const accountProvider =
        String(
          runtime.account_provider ||
          "",
        );


      if (
        !integrationId ||
        !grantId
      ) {
        continue;
      }


      try {
        const providerContacts:
          Array<
            Record<
              string,
              unknown
            >
          > = [];


        let pageToken =
          "";

        let pageCount =
          0;


        do {
          pageCount +=
            1;


          if (
            pageCount >
            MAX_CONTACT_PAGES
          ) {
            throw new Error(
              "Contacts synchronization exceeded the safe page limit.",
            );
          }


          const contactsUrl =
            new URL(
              `${nylasApiUri}/v3/grants/${encodeURIComponent(grantId)}/contacts`,
            );


          contactsUrl
            .searchParams
            .set(
              "limit",
              "200",
            );

          contactsUrl
            .searchParams
            .set(
              "source",
              "address_book",
            );


          if (pageToken) {
            contactsUrl
              .searchParams
              .set(
                "page_token",
                pageToken,
              );
          }


          const contactsPayload =
            await fetchNylasJson(
              contactsUrl,
              nylasApiKey,
            );


          const contacts =
            Array.isArray(
              contactsPayload?.data,
            )
              ? contactsPayload.data
              : [];


          providerContacts.push(
            ...contacts,
          );


          pageToken =
            String(
              contactsPayload
                ?.next_cursor ||
              "",
            );

        } while (
          pageToken
        );


        let createdCount =
          0;

        let linkedCount =
          0;

        let updatedCount =
          0;

        let skippedCount =
          0;


        for (
          const providerContact
          of providerContacts
        ) {
          const externalContactId =
            String(
              providerContact.id ||
              "",
            ).trim();


          if (!externalContactId) {
            skippedCount +=
              1;

            continue;
          }


          const email =
            firstString(
              providerContact.emails,
              "email",
            );

          const phone =
            firstString(
              providerContact
                .phone_numbers,
              "number",
            );


          const {
            data:
              upsertData,
            error:
              upsertError,
          } =
            await adminClient.rpc(
              "upsert_nylas_campaign_contact_from_integration",
              {
                target_workspace_id:
                  workspaceId,

                target_source_integration_id:
                  integrationId,

                target_actor_user_id:
                  actorUser.id,

                target_external_contact_id:
                  externalContactId,

                target_full_name:
                  contactFullName(
                    providerContact,
                  ),

                target_email:
                  email,

                target_phone:
                  phone,

                target_organization:
                  String(
                    providerContact
                      .company_name ||
                    "",
                  ),

                target_source_metadata: {
                  provider:
                    "nylas",

                  account_provider:
                    accountProvider,

                  source:
                    "address_book",

                  job_title:
                    providerContact
                      .job_title ||
                    null,

                  provider_updated_at:
                    providerContact
                      .updated_at ||
                    null,

                  last_seen_at:
                    new Date()
                      .toISOString(),
                },
              },
            );


          if (upsertError) {
            throw new Error(
              `Campaign Seat could not save provider contact ${externalContactId}: ${upsertError.message}`,
            );
          }


          const action =
            String(
              upsertData?.action ||
              "",
            );


          if (
            action ===
              "created"
          ) {
            createdCount +=
              1;

          } else if (
            action ===
              "linked"
          ) {
            linkedCount +=
              1;

          } else if (
            action ===
              "updated"
          ) {
            updatedCount +=
              1;

          } else {
            skippedCount +=
              1;
          }
        }


        const {
          error:
            completeError,
        } =
          await adminClient.rpc(
            "complete_nylas_contacts_integration_sync",
            {
              target_workspace_id:
                workspaceId,

              target_source_integration_id:
                integrationId,

              target_seen_count:
                providerContacts.length,

              target_created_count:
                createdCount,

              target_linked_count:
                linkedCount,

              target_updated_count:
                updatedCount,

              target_skipped_count:
                skippedCount,
            },
          );


        if (completeError) {
          throw new Error(
            completeError.message,
          );
        }


        contactResults.push({
          integrationId,

          provider:
            accountProvider,

          email:
            runtime.connected_email,

          seen:
            providerContacts.length,

          created:
            createdCount,

          linked:
            linkedCount,

          updated:
            updatedCount,

          skipped:
            skippedCount,
        });

      } catch (
        contactsError
      ) {
        contactResults.push({
          integrationId,

          provider:
            accountProvider,

          email:
            runtime.connected_email,

          error:
            contactsError instanceof
              Error
              ? contactsError.message
              : "Contacts synchronization failed.",
        });
      }
    }


    const calendarFailures =
      calendarResults.filter(
        (item) =>
          Boolean(
            item.error,
          ),
      );


    const contactFailures =
      contactResults.filter(
        (item) =>
          Boolean(
            item.error,
          ),
      );


    const totalResultCount =
      calendarResults.length +
      contactResults.length;


    const totalFailureCount =
      calendarFailures.length +
      contactFailures.length;


    const jobStatus =
      totalResultCount === 0
        ? "failed"
        : totalFailureCount === 0
          ? "complete"
          : totalFailureCount <
              totalResultCount
            ? "partial"
            : "failed";


    const firstFailure =
      String(
        calendarFailures[0]
          ?.error ||
        contactFailures[0]
          ?.error ||
        "",
      );


    const syncResult = {
      workspaceId,

      calendars:
        calendarResults,

      contacts:
        contactResults,

      calendarResultCount:
        calendarResults.length,

      contactsResultCount:
        contactResults.length,

      failureCount:
        totalFailureCount,

      completedAt:
        new Date()
          .toISOString(),
    };


    if (
      initialSyncJob
        ?.found ===
      true
    ) {
      const {
        error:
          finishJobError,
      } =
        await adminClient.rpc(
          "finish_seat_workspace_initial_sync",
          {
            target_workspace_id:
              workspaceId,

            target_status:
              jobStatus,

            target_result:
              syncResult,

            target_error:
              firstFailure,
          },
        );


      if (finishJobError) {
        console.error(
          "Campaign Seat initial sync job could not be finalized",
          finishJobError,
        );
      }
    }


    return jsonResponse(
      request,
      200,
      {
        success:
          jobStatus !==
          "failed",

        workspaceId,

        syncJobId:
          initialSyncJob
            ?.job_id ||
          null,

        syncStatus:
          jobStatus,

        calendars:
          calendarResults,

        contacts:
          contactResults,

        note:
          "Provider synchronization is read-only toward Google and Microsoft. Campaign communication consent remains separate.",
      },
    );
  },
);
