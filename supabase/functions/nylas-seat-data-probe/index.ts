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


    /*
     * getUser() above has already asked Supabase Auth to
     * validate the bearer token.
     *
     * Read the AAL claim from that same validated JWT instead
     * of creating a second PostgREST authorization context.
     */
    const bearerToken =
      authorization.replace(
        /^Bearer\\s+/i,
        "",
      );


    let jwtPayload:
      Record<
        string,
        unknown
      > = {};


    try {
      const payloadPart =
        bearerToken
          .split(".")[1] ||
        "";

      const normalized =
        payloadPart
          .replace(
            /-/g,
            "+",
          )
          .replace(
            /_/g,
            "/",
          );

      const padded =
        normalized.padEnd(
          Math.ceil(
            normalized.length /
            4,
          ) * 4,
          "=",
        );

      jwtPayload =
        JSON.parse(
          atob(
            padded,
          ),
        );
    } catch {
      return jsonResponse(
        request,
        401,
        {
          error:
            "The Campaign Seat security token could not be read.",
        },
      );
    }


    if (
      String(
        jwtPayload.sub ||
        "",
      ) !== actorUser.id ||
      String(
        jwtPayload.aal ||
        "",
      ) !== "aal2"
    ) {
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


    /*
     * Probe each connected capability independently.
     *
     * A Google account can have Calendar/Contacts access while
     * Gmail itself is unavailable or not provisioned. One
     * provider-specific failure must not erase valid access to
     * the other provider services.
     */

    let emailRead =
      false;

    let calendarRead =
      false;

    let contactsRead =
      false;

    let mailboxHasVisibleThreads =
      false;

    let contactsHaveVisibleRecords =
      false;

    let visibleCalendarCount =
      0;

    let primaryCalendarName =
      "";

    let primaryCalendarTimezone =
      "";

    const capabilityErrors:
      Record<
        string,
        string
      > = {};


    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    try {
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


      emailRead =
        true;


      mailboxHasVisibleThreads =
        Array.isArray(
          threadsPayload?.data,
        ) &&
        threadsPayload.data.length >
          0;

    } catch (
      emailError
    ) {
      const rawMessage =
        emailError instanceof Error
          ? emailError.message
          : "Email access is unavailable.";


      if (
        /failedprecondition|precondition check failed/i.test(
          rawMessage,
        )
      ) {
        capabilityErrors.email =
          runtime.provider ===
            "google"
            ? "Gmail is not available for this Google account."
            : "Email is not available for this connected account.";
      } else {
        capabilityErrors.email =
          "Campaign Seat could not verify email access.";
      }


      console.warn(
        "Campaign Seat provider email probe did not pass",
        {
          provider:
            runtime.provider,

          integrationKey,

          message:
            rawMessage.slice(
              0,
              600,
            ),
        },
      );
    }


    // --------------------------------------------------------
    // CALENDAR
    // --------------------------------------------------------

    try {
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


      calendarRead =
        true;

      visibleCalendarCount =
        calendars.length;

      primaryCalendarName =
        String(
          primaryCalendar
            ?.name ||
          "",
        );

      primaryCalendarTimezone =
        String(
          primaryCalendar
            ?.timezone ||
          "",
        );

    } catch (
      calendarError
    ) {
      capabilityErrors.calendar =
        "Campaign Seat could not verify calendar access.";


      console.warn(
        "Campaign Seat provider calendar probe did not pass",
        {
          provider:
            runtime.provider,

          integrationKey,

          message:
            calendarError instanceof Error
              ? calendarError.message.slice(
                  0,
                  600,
                )
              : "Unknown calendar error",
        },
      );
    }


    // --------------------------------------------------------
    // CONTACTS
    // --------------------------------------------------------

    try {
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


      contactsRead =
        true;


      contactsHaveVisibleRecords =
        Array.isArray(
          contactsPayload?.data,
        ) &&
        contactsPayload.data.length >
          0;

    } catch (
      contactsError
    ) {
      capabilityErrors.contacts =
        "Campaign Seat could not verify contacts access.";


      console.warn(
        "Campaign Seat provider contacts probe did not pass",
        {
          provider:
            runtime.provider,

          integrationKey,

          message:
            contactsError instanceof Error
              ? contactsError.message.slice(
                  0,
                  600,
                )
              : "Unknown contacts error",
        },
      );
    }


    const verifiedCapabilities =
      [
        emailRead
          ? "email"
          : "",

        calendarRead
          ? "calendar"
          : "",

        contactsRead
          ? "contacts"
          : "",
      ]
        .filter(
          Boolean,
        );


    const unavailableCapabilities =
      [
        !emailRead
          ? "email"
          : "",

        !calendarRead
          ? "calendar"
          : "",

        !contactsRead
          ? "contacts"
          : "",
      ]
        .filter(
          Boolean,
        );


    const anyCapabilityVerified =
      verifiedCapabilities.length >
      0;


    const allCoreCapabilities =
      verifiedCapabilities.length ===
      3;


    if (
      !anyCapabilityVerified
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not verify any connected provider data capability.",

          capabilityErrors,
        },
      );
    }


    const probeResult = {
      verified_at:
        new Date()
          .toISOString(),

      email_read:
        emailRead,

      calendar_read:
        calendarRead,

      contacts_read:
        contactsRead,

      all_core_capabilities:
        allCoreCapabilities,

      partial:
        !allCoreCapabilities,

      verified_capabilities:
        verifiedCapabilities,

      unavailable_capabilities:
        unavailableCapabilities,

      capability_errors:
        capabilityErrors,

      mailbox_has_visible_threads:
        mailboxHasVisibleThreads,

      contacts_have_visible_records:
        contactsHaveVisibleRecords,

      visible_calendar_count:
        visibleCalendarCount,

      primary_calendar_name:
        primaryCalendarName,

      primary_calendar_timezone:
        primaryCalendarTimezone,
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

        emailRead,

        calendarRead,

        contactsRead,

        allCoreCapabilities,

        partial:
          !allCoreCapabilities,

        verifiedCapabilities,

        unavailableCapabilities,

        capabilityErrors,

        mailboxHasVisibleThreads,

        contactsHaveVisibleRecords,

        visibleCalendarCount,

        primaryCalendarName,

        primaryCalendarTimezone,
      },
    );
  },
);
