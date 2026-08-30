import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://app.campaignseat.com",
    "https://www.campaignseat.com",
      "http://127.0.0.1:5180",
    "http://localhost:5180",
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

function unixToIso(
  value: unknown,
) {
  const seconds =
    Number(value);

  if (
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  return new Date(
    seconds * 1000,
  ).toISOString();
}

function dateInTimezone(
  value: unknown,
  timezone: string,
) {
  const date =
    new Date(
      String(
        value ||
        "",
      ),
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

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
      },
    ).formatToParts(
      date,
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

  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysToDateKey(
  dateKey: string,
  days: number,
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

  return [
    date
      .getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function sanitizeParticipants(
  value: unknown,
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .map(
      (
        participant:
          Record<
            string,
            unknown
          >,
      ) => {
        const email =
          String(
            participant
              ?.email ||
            "",
          )
            .trim()
            .toLowerCase();

        if (
          !email ||
          !email.includes("@")
        ) {
          return null;
        }

        const clean:
          Record<
            string,
            string
          > = {
            email,
          };

        const name =
          String(
            participant
              ?.name ||
            "",
          ).trim();

        if (name) {
          clean.name =
            name.slice(
              0,
              255,
            );
        }

        const comment =
          String(
            participant
              ?.comment ||
            "",
          ).trim();

        if (comment) {
          clean.comment =
            comment.slice(
              0,
              1000,
            );
        }

        return clean;
      },
    )
    .filter(Boolean);
}

function sanitizeRecurrence(
  value: unknown,
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .map(
      (item) =>
        String(
          item ||
          "",
        ).trim(),
    )
    .filter(
      (item) =>
        item.startsWith(
          "RRULE:",
        ) ||
        item.startsWith(
          "EXDATE:",
        ),
    )
    .slice(
      0,
      50,
    );
}

function sanitizeReminders(
  value: unknown,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  const reminders =
    value as
      Record<
        string,
        unknown
      >;

  if (
    reminders.use_default ===
    true
  ) {
    return {
      use_default:
        true,
    };
  }

  const overrides =
    Array.isArray(
      reminders.overrides,
    )
      ? reminders
          .overrides
          .map(
            (
              reminder:
                Record<
                  string,
                  unknown
                >,
            ) => {
              const minutes =
                Number(
                  reminder
                    ?.reminder_minutes,
                );

              const method =
                String(
                  reminder
                    ?.reminder_method ||
                  "popup",
                )
                  .trim()
                  .toLowerCase();

              if (
                !Number.isFinite(
                  minutes,
                ) ||
                minutes < 0
              ) {
                return null;
              }

              if (
                ![
                  "popup",
                  "email",
                ].includes(
                  method,
                )
              ) {
                return null;
              }

              return {
                reminder_minutes:
                  Math.round(
                    minutes,
                  ),

                reminder_method:
                  method,
              };
            },
          )
          .filter(Boolean)
          .slice(
            0,
            5,
          )
      : [];

  if (
    overrides.length ===
    0
  ) {
    return {};
  }

  return {
    use_default:
      false,

    overrides,
  };
}

function sanitizeConferencing(
  value: unknown,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  const conference =
    value as
      Record<
        string,
        unknown
      >;

  const provider =
    String(
      conference.provider ||
      "",
    ).trim();

  if (!provider) {
    return {};
  }

  if (
    conference.autocreate &&
    typeof conference.autocreate ===
      "object"
  ) {
    if (
      ![
        "Google Meet",
        "Microsoft Teams",
      ].includes(
        provider,
      )
    ) {
      return {};
    }

    return {
      provider,

      autocreate:
        {},
    };
  }

  if (
    conference.details &&
    typeof conference.details ===
      "object"
  ) {
    const details =
      conference.details as
        Record<
          string,
          unknown
        >;

    const url =
      String(
        details.url ||
        "",
      ).trim();

    if (!url) {
      return {};
    }

    return {
      provider,

      details: {
        url,
      },
    };
  }

  return {};
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
            "Campaign Seat Calendar event updates are not configured.",
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

    const eventId =
      String(
        body.eventId ||
        "",
      ).trim();

    if (
      !workspaceId ||
      !eventId
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A campaign workspace and event are required.",
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
            "Active campaign leadership access is required to update provider Calendar events.",
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
        ?.write_ready !==
        true
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "A writable Calendar connection is required.",
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
          "id,settings",
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
            "Campaign Seat could not resolve the Calendar provider.",
        },
      );
    }

    const accountProvider =
      String(
        integration
          ?.settings
          ?.account_provider ||
        "",
      )
        .trim()
        .toLowerCase();

    const {
      data:
        localEvent,
      error:
        eventError,
    } =
      await adminClient
        .from(
          "events",
        )
        .select(
          "id,workspace_id,title,description,location,starts_at,ends_at,status,is_all_day,event_timezone,participants,recurrence_rules,reminders,busy,visibility,conferencing,hide_participants,notify_participants,source_provider,external_calendar_id,external_event_id,external_ical_uid,sync_metadata",
        )
        .eq(
          "id",
          eventId,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .single();

    if (
      eventError ||
      !localEvent
    ) {
      return jsonResponse(
        request,
        404,
        {
          error:
            "The Campaign Seat event could not be found.",
        },
      );
    }

    const providerEventId =
      String(
        localEvent
          .external_event_id ||
        "",
      ).trim();

    const providerCalendarId =
      String(
        localEvent
          .external_calendar_id ||
        "",
      ).trim();

    if (
      localEvent
        .source_provider !==
        "nylas" ||
      !providerEventId ||
      !providerCalendarId
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "This Campaign Seat event is not linked to a writable provider event.",
        },
      );
    }

    const timezone =
      String(
        localEvent
          .event_timezone ||
        "America/New_York",
      ).trim();

    const start =
      new Date(
        localEvent.starts_at,
      );

    const end =
      localEvent.ends_at
        ? new Date(
            localEvent.ends_at,
          )
        : new Date(
            start.getTime() +
            60 * 60 * 1000,
          );

    if (
      Number.isNaN(
        start.getTime(),
      ) ||
      Number.isNaN(
        end.getTime(),
      )
    ) {
      return jsonResponse(
        request,
        422,
        {
          error:
            "The Campaign Seat event has invalid date or time values.",
        },
      );
    }

    let when:
      Record<
        string,
        unknown
      >;

    if (
      localEvent.is_all_day ===
      true
    ) {
      const startDate =
        dateInTimezone(
          start,
          timezone,
        );

      let endDate =
        dateInTimezone(
          end,
          timezone,
        );

      if (
        !startDate
      ) {
        return jsonResponse(
          request,
          422,
          {
            error:
              "Campaign Seat could not resolve the all-day event date.",
          },
        );
      }

      if (
        !endDate ||
        endDate <=
          startDate
      ) {
        endDate =
          addDaysToDateKey(
            startDate,
            1,
          );
      }

      when = {
        start_date:
          startDate,

        end_date:
          endDate,
      };
    } else {
      when = {
        start_time:
          Math.floor(
            start.getTime() /
            1000,
          ),

        end_time:
          Math.floor(
            end.getTime() /
            1000,
          ),

        start_timezone:
          timezone,

        end_timezone:
          timezone,
      };
    }

    const providerBody:
      Record<
        string,
        unknown
      > = {
      title:
        String(
          localEvent.title ||
          "Campaign Seat event",
        ).slice(
          0,
          1024,
        ),

      description:
        String(
          localEvent.description ||
          "",
        ),

      location:
        String(
          localEvent.location ||
          "",
        ).slice(
          0,
          255,
        ),

      busy:
        localEvent.busy !==
        false,

      hide_participants:
        localEvent
          .hide_participants ===
        true,

      participants:
        sanitizeParticipants(
          localEvent.participants,
        ),

      reminders:
        sanitizeReminders(
          localEvent.reminders,
        ),

      conferencing:
        sanitizeConferencing(
          localEvent.conferencing,
        ),

      when,
    };

    const sanitizedRecurrence =
      sanitizeRecurrence(
        localEvent
          .recurrence_rules,
      );

    if (
      sanitizedRecurrence.length >
      0
    ) {
      providerBody.recurrence =
        sanitizedRecurrence;
    }

    const visibility =
      String(
        localEvent.visibility ||
        "",
      )
        .trim()
        .toLowerCase();

    if (
      [
        "public",
        "private",
      ].includes(
        visibility,
      )
    ) {
      providerBody.visibility =
        visibility;
    } else if (
      visibility ===
        "default" &&
      accountProvider ===
        "google"
    ) {
      providerBody.visibility =
        "default";
    }

    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    const updateUrl =
      new URL(
        `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/events/${encodeURIComponent(providerEventId)}`,
      );

    updateUrl
      .searchParams
      .set(
        "calendar_id",
        providerCalendarId,
      );

    updateUrl
      .searchParams
      .set(
        "notify_participants",
        localEvent
          .notify_participants !==
        false
          ? "true"
          : "false",
      );

    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          updateUrl,
          {
            method:
              "PUT",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${nylasApiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                providerBody,
              ),
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
        "Nylas Calendar event update rejected",
        {
          status:
            providerResponse.status,

          eventId:
            providerEventId,

          response:
            detail.slice(
              0,
              2000,
            ),
        },
      );

      await adminClient
        .from(
          "events",
        )
        .update({
          sync_metadata: {
            ...(
              localEvent
                .sync_metadata ||
              {}
            ),

            provider_write_status:
              "failed",

            provider_write_operation:
              "update",

            provider_write_error:
              `Nylas update returned ${providerResponse.status}`,

            provider_write_attempted_at:
              new Date()
                .toISOString(),
          },
        })
        .eq(
          "id",
          eventId,
        )
        .eq(
          "workspace_id",
          workspaceId,
        );

      return jsonResponse(
        request,
        502,
        {
          error:
            `The Campaign Seat changes were saved, but the connected Calendar update failed (${providerResponse.status}).`,
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
            "The Calendar provider updated the event but returned an invalid response.",
        },
      );
    }

    const providerEvent =
      (
        providerPayload
          ?.data &&
        typeof providerPayload
          .data ===
          "object"
      )
        ? providerPayload
            .data as
              Record<
                string,
                unknown
              >
        : {};

    const {
      data:
        linkedEvent,
      error:
        linkError,
    } =
      await adminClient
        .from(
          "events",
        )
        .update({
          external_updated_at:
            unixToIso(
              providerEvent
                .updated_at,
            ),

          external_ical_uid:
            String(
              providerEvent
                .ical_uid ||
              localEvent
                .external_ical_uid ||
              "",
            ) ||
            null,

          participants:
            Array.isArray(
              providerEvent
                .participants,
            )
              ? providerEvent
                  .participants
              : localEvent
                  .participants,

          recurrence_rules:
            Array.isArray(
              providerEvent
                .recurrence,
            )
              ? providerEvent
                  .recurrence
              : localEvent
                  .recurrence_rules,

          reminders:
            providerEvent
              .reminders &&
            typeof providerEvent
              .reminders ===
              "object"
              ? providerEvent
                  .reminders
              : localEvent
                  .reminders,

          conferencing:
            providerEvent
              .conferencing &&
            typeof providerEvent
              .conferencing ===
              "object"
              ? providerEvent
                  .conferencing
              : localEvent
                  .conferencing,

          busy:
            typeof providerEvent
              .busy ===
              "boolean"
              ? providerEvent
                  .busy
              : localEvent
                  .busy,

          visibility:
            String(
              providerEvent
                .visibility ||
              localEvent
                .visibility ||
              "",
            ) ||
            null,

          sync_metadata: {
            ...(
              localEvent
                .sync_metadata ||
              {}
            ),

            provider_write_status:
              "synced",

            provider_write_operation:
              "update",

            provider_write_synced_at:
              new Date()
                .toISOString(),
          },
        })
        .eq(
          "id",
          eventId,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .select()
        .single();

    if (
      linkError ||
      !linkedEvent
    ) {
      console.error(
        "Provider event updated but local provider metadata could not be refreshed",
        linkError,
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            "The connected Calendar was updated, but Campaign Seat could not refresh the provider metadata.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        providerEventId,

        calendarId:
          providerCalendarId,

        event:
          linkedEvent,
      },
    );
  },
);
