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


async function fetchNylas(
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
      `Nylas request failed (${response.status})${
        detail
          ? `: ${detail.slice(0, 500)}`
          : ""
      }`,
    );
  }


  try {
    return await response.json();
  } catch {
    throw new Error(
      "Nylas returned an invalid response.",
    );
  }
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
        "Authorization",
      ) || "";


    if (!authorization) {
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
        503,
        {
          error:
            "Campaign Seat provider verification is not configured.",
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
            "A valid provider request is required.",
        },
      );
    }


    const integrationKey =
      String(
        body.integrationKey ||
        "",
      )
        .trim()
        .toLowerCase();


    if (
      ![
        "google_workspace",
        "microsoft_365",
      ].includes(
        integrationKey,
      )
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Choose Google Workspace or Microsoft 365.",
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


    const {
      error:
        aalError,
    } =
      await userClient.rpc(
        "require_aal2",
      );


    if (aalError) {
      return jsonResponse(
        request,
        403,
        {
          error:
            "Two-step verification is required to verify connected provider data.",
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
        runtimeData,
      error:
        runtimeError,
    } =
      await adminClient.rpc(
        "get_seat_product_provider_probe_runtime",
        {
          target_integration_key:
            integrationKey,

          target_actor_user_id:
            actorUser.id,
        },
      );


    if (runtimeError) {
      console.error(
        "Provider probe runtime error",
        runtimeError,
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve the protected provider connection.",
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
      !runtime
        ?.connection_id ||
      !grantId
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "The connected provider grant is unavailable.",
        },
      );
    }


    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    const grant =
      encodeURIComponent(
        grantId,
      );


    try {
      // ------------------------------------------------------
      // EMAIL
      //
      // Verify thread access only. We intentionally do not
      // return subject lines, senders or message content.
      // ------------------------------------------------------

      const threadsUrl =
        new URL(
          `${baseUri}/v3/grants/${grant}/threads`,
        );

      threadsUrl
        .searchParams
        .set(
          "limit",
          "1",
        );


      const threadsPayload =
        await fetchNylas(
          threadsUrl,
          nylasApiKey,
        );


      // ------------------------------------------------------
      // CALENDAR
      //
      // We may return only sanitized calendar metadata.
      // ------------------------------------------------------

      const calendarsUrl =
        new URL(
          `${baseUri}/v3/grants/${grant}/calendars`,
        );

      calendarsUrl
        .searchParams
        .set(
          "limit",
          "50",
        );


      const calendarsPayload =
        await fetchNylas(
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


      // ------------------------------------------------------
      // CONTACTS
      //
      // Verify endpoint access. No contact identity is returned.
      // ------------------------------------------------------

      const contactsUrl =
        new URL(
          `${baseUri}/v3/grants/${grant}/contacts`,
        );

      contactsUrl
        .searchParams
        .set(
          "limit",
          "1",
        );


      const contactsPayload =
        await fetchNylas(
          contactsUrl,
          nylasApiKey,
        );


      const threadVisible =
        Array.isArray(
          threadsPayload?.data,
        ) &&
        threadsPayload.data.length >
          0;


      const contactVisible =
        Array.isArray(
          contactsPayload?.data,
        ) &&
        contactsPayload.data.length >
          0;


      const probeResult = {
        verified_at:
          new Date()
            .toISOString(),

        email_read:
          true,

        calendar_read:
          true,

        contacts_read:
          true,

        mailbox_has_visible_threads:
          threadVisible,

        contacts_have_visible_records:
          contactVisible,

        visible_calendar_count:
          calendars.length,

        primary_calendar_name:
          String(
            primaryCalendar
              ?.name ||
            "",
          ),

        primary_calendar_timezone:
          String(
            primaryCalendar
              ?.timezone ||
            "",
          ),
      };


      const {
        data:
          connectionRow,
        error:
          connectionReadError,
      } =
        await adminClient
          .from(
            "seat_product_account_integrations",
          )
          .select(
            "connection_metadata",
          )
          .eq(
            "id",
            runtime.connection_id,
          )
          .maybeSingle();


      if (connectionReadError) {
        console.error(
          "Provider probe metadata read failed",
          connectionReadError,
        );
      }


      const existingMetadata =
        (
          connectionRow
            ?.connection_metadata &&
          typeof connectionRow
            .connection_metadata ===
            "object"
        )
          ? connectionRow
              .connection_metadata
          : {};


      const {
        error:
          metadataError,
      } =
        await adminClient
          .from(
            "seat_product_account_integrations",
          )
          .update({
            connection_metadata: {
              ...existingMetadata,

              data_probe:
                probeResult,
            },

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            runtime.connection_id,
          );


      if (metadataError) {
        console.error(
          "Provider probe metadata update failed",
          metadataError,
        );
      }


      return jsonResponse(
        request,
        200,
        {
          success:
            true,

          integrationKey,

          provider:
            runtime.provider,

          connectedEmail:
            runtime.connected_email,

          emailRead:
            true,

          calendarRead:
            true,

          contactsRead:
            true,

          mailboxHasVisibleThreads:
            threadVisible,

          contactsHaveVisibleRecords:
            contactVisible,

          visibleCalendarCount:
            calendars.length,

          primaryCalendarName:
            String(
              primaryCalendar
                ?.name ||
              "",
            ),

          primaryCalendarTimezone:
            String(
              primaryCalendar
                ?.timezone ||
              "",
            ),
        },
      );
    } catch (
      providerError
    ) {
      console.error(
        "Campaign Seat provider data probe failed",
        providerError,
      );

      return jsonResponse(
        request,
        502,
        {
          error:
            providerError instanceof
              Error
              ? providerError.message
              : "The provider data connection could not be verified.",
        },
      );
    }
  },
);
