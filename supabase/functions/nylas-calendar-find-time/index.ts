import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://app.campaignseat.com",
    "https://www.campaignseat.com",
  ]);

function corsHeaders(
  request: Request,
) {
  const origin =
    request.headers.get(
      "origin",
    ) || "";

  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.has(origin)
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
    JSON.stringify(payload),
    {
      status,

      headers: {
        ...corsHeaders(request),

        "Content-Type":
          "application/json",
      },
    },
  );
}

function cleanEmail(
  value: unknown,
) {
  const email =
    String(
      value ||
      "",
    )
      .trim()
      .toLowerCase();

  if (
    !email ||
    !email.includes("@") ||
    email.length > 320
  ) {
    return "";
  }

  return email;
}

function safeTimezone(
  value: unknown,
) {
  const requested =
    String(
      value ||
      "",
    ).trim();

  if (!requested) {
    return "";
  }

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          requested,
      },
    ).format(
      new Date(),
    );

    return requested;
  } catch {
    return "";
  }
}

function zonedParts(
  epochSeconds: number,
  timezone: string,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      },
    ).formatToParts(
      new Date(
        epochSeconds *
        1000,
      ),
    );

  const map =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  return {
    dateKey:
      `${map.year}-${map.month}-${map.day}`,

    minutes:
      Number(
        map.hour,
      ) *
        60 +
      Number(
        map.minute,
      ),
  };
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return (
    startA < endB &&
    endA > startB
  );
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
            "Campaign Seat Find a Time is not configured.",
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

    const searchStartTime =
      Math.floor(
        Number(
          body.searchStartTime,
        ),
      );

    const searchEndTime =
      Math.floor(
        Number(
          body.searchEndTime,
        ),
      );

    const durationMinutes =
      Math.floor(
        Number(
          body.durationMinutes ||
          30,
        ),
      );

    const intervalMinutes =
      Math.floor(
        Number(
          body.intervalMinutes ||
          15,
        ),
      );

    const dayStartMinutes =
      Math.floor(
        Number(
          body.dayStartMinutes ??
          480,
        ),
      );

    const dayEndMinutes =
      Math.floor(
        Number(
          body.dayEndMinutes ??
          1200,
        ),
      );

    const requestedTimezone =
      safeTimezone(
        body.timezone,
      );

    if (!workspaceId) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A campaign workspace is required.",
        },
      );
    }

    if (
      !Number.isFinite(
        searchStartTime,
      ) ||
      !Number.isFinite(
        searchEndTime,
      ) ||
      searchEndTime <=
        searchStartTime
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A valid availability search window is required.",
        },
      );
    }

    const searchSeconds =
      searchEndTime -
      searchStartTime;

    if (
      searchSeconds >
      14 * 24 * 60 * 60
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Find a Time can search up to 14 days at once.",
        },
      );
    }

    if (
      durationMinutes < 5 ||
      durationMinutes > 240 ||
      durationMinutes % 5 !==
        0
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Meeting duration must be between 5 minutes and 4 hours in five-minute increments.",
        },
      );
    }

    if (
      intervalMinutes < 5 ||
      intervalMinutes > 60 ||
      intervalMinutes % 5 !==
        0
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Availability intervals must use five-minute increments.",
        },
      );
    }

    if (
      dayStartMinutes < 0 ||
      dayEndMinutes > 1440 ||
      dayEndMinutes <=
        dayStartMinutes
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A valid daily search window is required.",
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
            "Active campaign leadership access is required to check Calendar availability.",
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
      runtimeError ||
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
            "A readable connected Calendar is required to find available times.",
        },
      );
    }

    const {
      data:
        integration,
      error:
        integrationError,
    } =
      await adminClient
        .from(
          "workspace_integrations",
        )
        .select(
          "id,display_email,settings",
        )
        .eq(
          "id",
          runtime.integration_id,
        )
        .single();

    if (
      integrationError ||
      !integration
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve the connected Calendar account.",
        },
      );
    }

    const organizerEmail =
      cleanEmail(
        integration
          .display_email,
      );

    if (!organizerEmail) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "The connected Calendar does not have a usable organizer email.",
        },
      );
    }

    const guestEmails =
      Array.isArray(
        body.guestEmails,
      )
        ? body
            .guestEmails
            .map(
              cleanEmail,
            )
            .filter(Boolean)
        : [];

    const emails =
      Array.from(
        new Set([
          organizerEmail,
          ...guestEmails,
        ]),
      );

    /*
     * Microsoft allows up to 20 addresses in one Free/Busy call.
     * We cap every provider at 20 so the same function remains
     * portable between Google and Microsoft.
     */
    if (
      emails.length > 20
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Find a Time currently supports the organizer plus up to 19 guests.",
        },
      );
    }

    const timezone =
      requestedTimezone ||
      safeTimezone(
        integration
          ?.settings
          ?.primary_calendar_timezone,
      ) ||
      "America/New_York";

    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    const freeBusyUrl =
      new URL(
        `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/calendars/free-busy`,
      );

    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          freeBusyUrl,
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${nylasApiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                start_time:
                  searchStartTime,

                end_time:
                  searchEndTime,

                emails,

                tentative_as_busy:
                  true,
              }),
          },
        );
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not reach the Calendar provider.",
        },
      );
    }

    if (
      !providerResponse.ok
    ) {
      const detail =
        await providerResponse
          .text()
          .catch(
            () =>
              "Unable to read provider response.",
          );

      console.error(
        "Nylas Calendar free/busy request failed",
        {
          status:
            providerResponse.status,

          response:
            detail.slice(
              0,
              2000,
            ),
        },
      );

      return jsonResponse(
        request,
        502,
        {
          error:
            `The connected Calendar could not check availability (${providerResponse.status}).`,
        },
      );
    }

    let providerPayload:
      Record<
        string,
        unknown
      >;

    try {
      providerPayload =
        await providerResponse
          .json();
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "The Calendar provider returned an invalid availability response.",
        },
      );
    }

    const entries =
      Array.isArray(
        providerPayload?.data,
      )
        ? providerPayload
            .data as Array<
              Record<
                string,
                unknown
              >
            >
        : [];

    const entryMap =
      new Map<
        string,
        Record<
          string,
          unknown
        >
      >();

    for (
      const entry
      of entries
    ) {
      const email =
        cleanEmail(
          entry?.email,
        );

      if (email) {
        entryMap.set(
          email,
          entry,
        );
      }
    }

    const unresolved:
      Array<{
        email: string;
        error: string;
      }> = [];

    const verifiedEmails:
      string[] = [];

    const busySlots:
      Array<{
        start: number;
        end: number;
        email: string;
      }> = [];

    for (
      const email
      of emails
    ) {
      const entry =
        entryMap.get(
          email,
        );

      if (
        !entry ||
        entry.object ===
          "error" ||
        entry.error
      ) {
        unresolved.push({
          email,

          error:
            String(
              entry?.error ||
              "Availability could not be determined.",
            ),
        });

        continue;
      }

      verifiedEmails.push(
        email,
      );

      const timeSlots =
        Array.isArray(
          entry.time_slots,
        )
          ? entry.time_slots
          : [];

      for (
        const rawSlot
        of timeSlots
      ) {
        if (
          !rawSlot ||
          typeof rawSlot !==
            "object"
        ) {
          continue;
        }

        const slot =
          rawSlot as
            Record<
              string,
              unknown
            >;

        const start =
          Number(
            slot.start_time,
          );

        const end =
          Number(
            slot.end_time,
          );

        if (
          !Number.isFinite(
            start,
          ) ||
          !Number.isFinite(
            end,
          ) ||
          end <= start
        ) {
          continue;
        }

        busySlots.push({
          start,
          end,
          email,
        });
      }
    }

    /*
     * If Campaign Seat cannot check the organizer's calendar,
     * suggestions are unsafe, so fail the request.
     */
    if (
      !verifiedEmails.includes(
        organizerEmail,
      )
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not read the organizer's free/busy schedule.",

          unresolved,
        },
      );
    }

    const durationSeconds =
      durationMinutes *
      60;

    const intervalSeconds =
      intervalMinutes *
      60;

    let candidateStart =
      Math.ceil(
        searchStartTime /
        intervalSeconds,
      ) *
      intervalSeconds;

    const suggestions:
      Array<{
        start_time: number;
        end_time: number;
      }> = [];

    while (
      candidateStart +
      durationSeconds <=
        searchEndTime &&
      suggestions.length < 30
    ) {
      const candidateEnd =
        candidateStart +
        durationSeconds;

      const localStart =
        zonedParts(
          candidateStart,
          timezone,
        );

      const localEnd =
        zonedParts(
          candidateEnd,
          timezone,
        );

      const withinDailyWindow =
        localStart.dateKey ===
          localEnd.dateKey &&
        localStart.minutes >=
          dayStartMinutes &&
        localEnd.minutes <=
          dayEndMinutes;

      if (
        withinDailyWindow
      ) {
        const isBusy =
          busySlots.some(
            (slot) =>
              overlaps(
                candidateStart,
                candidateEnd,
                slot.start,
                slot.end,
              ),
          );

        if (!isBusy) {
          suggestions.push({
            start_time:
              candidateStart,

            end_time:
              candidateEnd,
          });
        }
      }

      candidateStart +=
        intervalSeconds;
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        timezone,

        organizerEmail,

        checkedEmails:
          emails,

        verifiedEmails,

        unresolved,

        complete:
          unresolved.length ===
          0,

        durationMinutes,

        intervalMinutes,

        dayStartMinutes,

        dayEndMinutes,

        suggestions,
      },
    );
  },
);
