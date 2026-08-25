import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://app.campaignseat.com",
    "https://www.campaignseat.com",
  ]);

const DAY_SECONDS =
  24 * 60 * 60;

const MAX_EVENT_PAGES =
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
        : "https://campaignseat.com",

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
      },
    },
  );
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

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return parsed.toISOString();
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
      value as
        Record<
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

  if (
    !response.ok
  ) {
    let detail =
      "";

    try {
      detail =
        await response.text();
    } catch {
      detail =
        "Unable to read provider response.";
    }

    throw new Error(
      `Nylas Calendar request failed (${response.status}): ${detail.slice(0, 1200)}`,
    );
  }

  return await response.json();
}

Deno.serve(
  async (
    request: Request,
  ) => {
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
      Deno.env.get(
        "NYLAS_API_URI",
      ) ||
      "https://api.us.nylas.com";

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !nylasApiKey
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat Calendar sync is not configured.",
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
            "A valid request body is required.",
        },
      );
    }

    const workspaceId =
      String(
        body.workspaceId ||
        "",
      ).trim();

    if (
      !workspaceId
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A campaign workspace is required.",
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
      await userClient
        .auth
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
            "Active campaign leadership access is required to sync Calendar.",
        },
      );
    }

    const {
      data:
        runtimeData,
      error:
        runtimeError,
    } =
      await adminClient.rpc(
        "get_calendar_runtime_connection",
        {
          target_workspace_id:
            workspaceId,
        },
      );

    if (
      runtimeError
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve the protected Calendar connection.",
        },
      );
    }

    const runtime =
      Array.isArray(
        runtimeData,
      )
        ? runtimeData[0]
        : runtimeData;

    const grantId =
      String(
        runtime
          ?.grant_reference ||
        "",
      ).trim();

    if (
      !grantId ||
      runtime
        ?.read_ready !==
        true
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "Connect Calendar before syncing provider events.",
        },
      );
    }

    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    try {
      const calendarsUrl =
        new URL(
          `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/calendars`,
        );

      calendarsUrl
        .searchParams
        .set(
          "limit",
          "50",
        );

      const calendarsResponse =
        await fetchNylasJson(
          calendarsUrl,
          nylasApiKey,
        );

      const calendars =
        Array.isArray(
          calendarsResponse
            ?.data,
        )
          ? calendarsResponse.data
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
        return jsonResponse(
          request,
          502,
          {
            error:
              "Nylas did not return a primary Calendar for this account.",
          },
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
          MAX_EVENT_PAGES
        ) {
          throw new Error(
            "Calendar sync stopped because the provider returned too many event pages for one request.",
          );
        }

        const eventsUrl =
          new URL(
            `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/events`,
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

        if (
          pageToken
        ) {
          eventsUrl
            .searchParams
            .set(
              "page_token",
              pageToken,
            );
        }

        const eventsResponse =
          await fetchNylasJson(
            eventsUrl,
            nylasApiKey,
          );

        const pageEvents =
          Array.isArray(
            eventsResponse
              ?.data,
          )
            ? eventsResponse.data
            : [];

        providerEvents.push(
          ...pageEvents,
        );

        pageToken =
          String(
            eventsResponse
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

        const updatedAt =
          unixToIso(
            providerEvent
              .updated_at,
          );

        const {
          error:
            upsertError,
        } =
          await adminClient.rpc(
            "upsert_nylas_calendar_event",
            {
              target_workspace_id:
                workspaceId,

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
                updatedAt,

              target_sync_metadata: {
                provider:
                  "nylas",

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

        if (
          upsertError
        ) {
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
          "complete_nylas_calendar_sync",
          {
            target_workspace_id:
              workspaceId,

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

      if (
        completeError
      ) {
        throw new Error(
          completeError.message,
        );
      }

      return jsonResponse(
        request,
        200,
        {
          success:
            true,

          calendar: {
            id:
              calendarId,

            name:
              calendarName,

            timezone:
              calendarTimezone,
          },

          importedCount,

          skippedCount,

          providerEventCount:
            providerEvents.length,

          window: {
            start:
              new Date(
                startSeconds *
                1000,
              )
                .toISOString(),

            end:
              new Date(
                endSeconds *
                1000,
              )
                .toISOString(),
          },
        },
      );
    } catch (
      syncError
    ) {
      console.error(
        "Nylas Calendar sync failed",
        syncError,
      );

      return jsonResponse(
        request,
        502,
        {
          error:
            syncError instanceof
              Error
              ? syncError.message
              : "Campaign Seat could not sync the provider Calendar.",
        },
      );
    }
  },
);
