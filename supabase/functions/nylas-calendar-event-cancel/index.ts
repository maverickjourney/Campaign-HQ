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
            "Campaign Seat Calendar cancellation is not configured.",
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
            "Active campaign leadership access is required to cancel provider Calendar events.",
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
        localEvent,
      error:
        eventError,
    } =
      await adminClient
        .from(
          "events",
        )
        .select(
          "id,workspace_id,title,status,source_provider,external_calendar_id,external_event_id,notify_participants,sync_metadata",
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
      localEvent.status ===
      "cancelled"
    ) {
      return jsonResponse(
        request,
        200,
        {
          success:
            true,

          alreadyCancelled:
            true,

          event:
            localEvent,
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
            "This event is not linked to a provider Calendar event.",
        },
      );
    }

    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    const deleteUrl =
      new URL(
        `${baseUri}/v3/grants/${encodeURIComponent(grantId)}/events/${encodeURIComponent(providerEventId)}`,
      );

    deleteUrl
      .searchParams
      .set(
        "calendar_id",
        providerCalendarId,
      );

    /*
     * Cancellation should notify attendees.
     * We deliberately use true here for a real cancellation.
     */
    deleteUrl
      .searchParams
      .set(
        "notify_participants",
        "true",
      );

    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          deleteUrl,
          {
            method:
              "DELETE",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${nylasApiKey}`,

              "Content-Type":
                "application/json",
            },
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

    /*
     * A 404 is treated as idempotent success:
     * the provider event is already gone, so Campaign Seat
     * should still move to cancelled.
     */
    if (
      !providerResponse.ok &&
      providerResponse.status !==
        404
    ) {
      const detail =
        await providerResponse
          .text()
          .catch(
            () =>
              "Unable to read provider response.",
          );

      console.error(
        "Nylas Calendar event cancellation rejected",
        {
          status:
            providerResponse.status,

          eventId:
            providerEventId,

          calendarId:
            providerCalendarId,

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
              "delete",

            provider_write_error:
              `Nylas delete returned ${providerResponse.status}`,

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
            `Campaign Seat did not cancel the event because the connected Calendar rejected the cancellation (${providerResponse.status}).`,
        },
      );
    }

    const cancelledAt =
      new Date()
        .toISOString();

    const {
      data:
        cancelledEvent,
      error:
        cancelError,
    } =
      await adminClient
        .from(
          "events",
        )
        .update({
          status:
            "cancelled",

          sync_metadata: {
            ...(
              localEvent
                .sync_metadata ||
              {}
            ),

            provider_write_status:
              "synced",

            provider_write_operation:
              "delete",

            provider_deleted:
              true,

            provider_deleted_at:
              cancelledAt,

            provider_delete_was_already_missing:
              providerResponse.status ===
              404,
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
      cancelError ||
      !cancelledEvent
    ) {
      console.error(
        "Provider event deleted but Campaign Seat could not mark the local event cancelled",
        cancelError,
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            "The connected Calendar event was removed, but Campaign Seat could not finish the local cancellation.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        alreadyCancelled:
          false,

        providerAlreadyMissing:
          providerResponse.status ===
          404,

        providerEventId,

        calendarId:
          providerCalendarId,

        event:
          cancelledEvent,
      },
    );
  },
);
