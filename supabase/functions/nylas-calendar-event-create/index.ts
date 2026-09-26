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

function isoToUnixSeconds(
  value: unknown,
) {
  const parsed =
    new Date(
      String(
        value ||
        "",
      ),
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return Math.floor(
    parsed.getTime() /
    1000,
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

function sanitizeParticipants(
  value: unknown,
) {
  if (
    !Array.isArray(
      value,
    )
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
          !email.includes(
            "@",
          )
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
    !Array.isArray(
      value,
    )
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


async function deleteCreatedProviderEvent(
  baseUri: string,
  apiKey: string,
  grantId: string,
  calendarId: string,
  eventId: string,
) {
  try {
    const rollbackUrl =
      new URL(
        `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/events/${encodeURIComponent(eventId)}`,
      );

    rollbackUrl
      .searchParams
      .set(
        "calendar_id",
        calendarId,
      );

    const rollbackResponse =
      await fetch(
        rollbackUrl,
        {
          method:
            "DELETE",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },
        },
      );

    if (
      !rollbackResponse.ok
    ) {
      console.error(
        "Provider event rollback failed",
        {
          status:
            rollbackResponse.status,

          eventId,
          calendarId,
        },
      );
    }
  } catch (
    rollbackError
  ) {
    console.error(
      "Provider event rollback threw",
      rollbackError,
    );
  }
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
            "Campaign Seat Calendar event write-back is not configured.",
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
            "Active campaign leadership access is required to create provider Calendar events.",
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
            "A writable provider Calendar connection is required.",
        },
      );
    }

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
          "id,workspace_id,title,description,location,starts_at,ends_at,status,event_timezone,participants,recurrence_rules,reminders,busy,visibility,conferencing,hide_participants,notify_participants,source_provider,external_calendar_id,external_event_id,sync_metadata",
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

    if (
      localEvent
        .source_provider ===
        "nylas" &&
      localEvent
        .external_event_id
    ) {
      return jsonResponse(
        request,
        200,
        {
          success:
            true,

          alreadySynced:
            true,

          event:
            localEvent,
        },
      );
    }

    if (
      localEvent.status ===
      "cancelled"
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "A cancelled Campaign Seat event cannot be created in the provider Calendar.",
        },
      );
    }

    const startTime =
      isoToUnixSeconds(
        localEvent.starts_at,
      );

    let endTime =
      isoToUnixSeconds(
        localEvent.ends_at,
      );

    if (
      startTime ===
      null
    ) {
      return jsonResponse(
        request,
        422,
        {
          error:
            "The Campaign Seat event has an invalid start time.",
        },
      );
    }

    if (
      endTime === null ||
      endTime < startTime
    ) {
      endTime =
        startTime +
        3600;
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
      integrationError
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve the Calendar destination.",
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


    const configuredCalendarId =
      String(
        integration
          ?.settings
          ?.primary_calendar_id ||
        "",
      ).trim();

    const requestedCalendarId =
      configuredCalendarId ||
      "primary";

    const timezone =
      String(
        localEvent
          .event_timezone ||
        "America/New_York",
      ).trim();

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

      when: {
        start_time:
          startTime,

        end_time:
          endTime,

        start_timezone:
          timezone,

        end_timezone:
          timezone,
      },
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

    /*
     * Microsoft rejected reminder_method in the V51 test.
     * The current create form intentionally uses Microsoft
     * provider defaults, so omit reminder payloads entirely
     * for Microsoft until its dedicated reminder editor ships.
     */
    if (
      accountProvider !==
      "microsoft"
    ) {
      const sanitizedReminders =
        sanitizeReminders(
          localEvent.reminders,
        );

      if (
        Object.keys(
          sanitizedReminders,
        ).length >
        0
      ) {
        providerBody.reminders =
          sanitizedReminders;
      }
    }

    const sanitizedConferencing =
      sanitizeConferencing(
        localEvent.conferencing,
      );

    if (
      Object.keys(
        sanitizedConferencing,
      ).length >
      0
    ) {
      providerBody.conferencing =
        sanitizedConferencing;
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

    const createUrl =
      new URL(
        `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/events`,
      );

    createUrl
      .searchParams
      .set(
        "calendar_id",
        requestedCalendarId,
      );


    createUrl
      .searchParams
      .set(
        "notify_participants",
        accountProvider ===
        "microsoft"
          ? "true"
          : localEvent
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
          createUrl,
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
      let detail =
        "";

      try {
        detail =
          await providerResponse
            .text();
      } catch {
        detail =
          "Unable to read provider response.";
      }

      console.error(
        "Nylas Calendar event creation rejected",
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

            provider_write_error:
              `Nylas create returned ${providerResponse.status}`,

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
            `The Campaign Seat event was saved, but connected Calendar creation failed (${providerResponse.status}).`,
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
            "The connected Calendar created the event but returned an invalid response.",
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

    const providerEventId =
      String(
        providerEvent.id ||
        "",
      ).trim();

    const providerCalendarId =
      String(
        providerEvent
          .calendar_id ||
        requestedCalendarId,
      ).trim();

    if (
      !providerEventId
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            "The connected Calendar created the event but Campaign Seat did not receive its provider ID.",
        },
      );
    }

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
          source_provider:
            "nylas",

          /*
           * Provider-created events must use the same
           * integration-scoped identity as workspace sync.
           * Without this field, the later multi-account sync
           * treats this event as a separate legacy identity
           * and can import a duplicate row.
           */
          source_integration_id:
            runtime.integration_id,

          external_calendar_id:
            providerCalendarId,

          external_event_id:
            providerEventId,

          external_ical_uid:
            String(
              providerEvent
                .ical_uid ||
              "",
            ) ||
            null,

          external_updated_at:
            unixToIso(
              providerEvent
                .updated_at,
            ),

          conferencing:
            (
              providerEvent
                .conferencing &&
              typeof providerEvent
                .conferencing ===
                "object"
            )
              ? providerEvent
                  .conferencing
              : localEvent
                  .conferencing,

          sync_metadata: {
            ...(
              localEvent
                .sync_metadata ||
              {}
            ),

            provider:
              "nylas",

            account_provider:
              accountProvider,

            source_integration_id:
              runtime.integration_id,

            calendar_id:
              providerCalendarId,

            provider_write_status:
              "synced",

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
      await deleteCreatedProviderEvent(
        baseUri,
        nylasApiKey,
        grantId,
        providerCalendarId,
        providerEventId,
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            "The connected Calendar created the event, but Campaign Seat could not link it safely. The provider event was rolled back.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        alreadySynced:
          false,

        richCreate:
          true,

        providerEventId,

        calendarId:
          providerCalendarId,

        event:
          linkedEvent,
      },
    );
  },
);\n