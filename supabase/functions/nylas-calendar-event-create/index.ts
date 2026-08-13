import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
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
          "id,workspace_id,title,description,location,starts_at,ends_at,status,source_provider,external_calendar_id,external_event_id,sync_metadata",
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
              JSON.stringify({
                title:
                  localEvent.title ||
                  "Campaign Seat event",

                description:
                  localEvent.description ||
                  "",

                location:
                  localEvent.location ||
                  "",

                busy:
                  true,

                when: {
                  start_time:
                    startTime,

                  end_time:
                    endTime,
                },
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
            `The Campaign Seat event was saved, but Google Calendar creation failed (${providerResponse.status}).`,
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
            "Google Calendar created the event but returned an invalid response.",
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
            "Google Calendar created the event but Campaign Seat did not receive its provider ID.",
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

          sync_metadata: {
            ...(
              localEvent
                .sync_metadata ||
              {}
            ),

            provider:
              "nylas",

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
            "Google Calendar created the event, but Campaign Seat could not link it safely. The provider event was rolled back.",
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

        providerEventId,

        calendarId:
          providerCalendarId,

        event:
          linkedEvent,
      },
    );
  },
);
