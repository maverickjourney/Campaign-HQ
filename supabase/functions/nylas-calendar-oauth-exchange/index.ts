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

    const nylasClientId =
      Deno.env.get(
        "NYLAS_CLIENT_ID",
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

    const nylasRedirectUri =
      Deno.env.get(
        "NYLAS_CALENDAR_REDIRECT_URI",
      ) || "";

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !nylasClientId ||
      !nylasApiKey ||
      !nylasRedirectUri
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat Calendar OAuth is not configured.",
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

    const code =
      String(
        body.code ||
        "",
      ).trim();

    const state =
      String(
        body.state ||
        "",
      ).trim();

    if (
      !code ||
      !state
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "The Calendar authorization callback is incomplete.",
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
      data:
        stateData,
      error:
        stateError,
    } =
      await userClient.rpc(
        "consume_calendar_oauth_state",
        {
          target_state:
            state,
        },
      );

    if (
      stateError
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            stateError.message ||
            "The Calendar authorization session is invalid or expired.",
        },
      );
    }

    const oauthState =
      Array.isArray(
        stateData,
      )
        ? stateData[0]
        : stateData;

    const expectedEmail =
      String(
        oauthState
          ?.connected_email ||
        "",
      )
        .trim()
        .toLowerCase();

    const expectedProvider =
      String(
        oauthState
          ?.provider ||
        "",
      )
        .trim()
        .toLowerCase();

    if (
      !oauthState
        ?.workspace_id ||
      !expectedProvider ||
      !expectedEmail
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "The Calendar authorization session is incomplete.",
        },
      );
    }

    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );

    let tokenResponse:
      Response;

    try {
      tokenResponse =
        await fetch(
          `${baseUri}/v3/connect/token`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                client_id:
                  nylasClientId,

                client_secret:
                  nylasApiKey,

                grant_type:
                  "authorization_code",

                code,

                redirect_uri:
                  nylasRedirectUri,
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
      !tokenResponse.ok
    ) {
      let providerError =
        "";

      try {
        providerError =
          await tokenResponse
            .text();
      } catch {
        providerError =
          "Unable to read Nylas error response.";
      }

      console.error(
        "Nylas Calendar OAuth token exchange rejected",
        {
          status:
            tokenResponse.status,

          response:
            providerError.slice(
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
            `The Calendar provider rejected the OAuth exchange (${tokenResponse.status}). Restart the Calendar connection flow.`,
        },
      );
    }

    let tokenData:
      Record<
        string,
        unknown
      >;

    try {
      tokenData =
        await tokenResponse
          .json();
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "The Calendar provider returned an invalid OAuth response.",
        },
      );
    }

    const grantId =
      String(
        tokenData.grant_id ||
        "",
      ).trim();

    const connectedEmail =
      String(
        tokenData.email ||
        "",
      )
        .trim()
        .toLowerCase();

    const connectedProvider =
      String(
        tokenData.provider ||
        "",
      )
        .trim()
        .toLowerCase();

    const connectedScope =
      Array.isArray(
        tokenData.scope,
      )
        ? tokenData.scope
            .map(
              (value) =>
                String(
                  value,
                ),
            )
            .join(
              " ",
            )
        : String(
            tokenData.scope ||
            "",
          );

    if (
      !grantId ||
      !connectedEmail
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Nylas did not return a verified Calendar grant and email address.",
        },
      );
    }

    if (
      connectedEmail !==
      expectedEmail
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "Calendar authorization used a different account. Reconnect using the campaign mailbox.",
        },
      );
    }

    if (
      connectedProvider &&
      connectedProvider !==
        expectedProvider
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "The Calendar provider does not match the connected campaign mailbox.",
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
        finalized,
      error:
        finalizeError,
    } =
      await adminClient.rpc(
        "finalize_calendar_connection",
        {
          target_workspace_id:
            oauthState
              .workspace_id,

          target_actor_user_id:
            actorUser.id,

          target_provider:
            expectedProvider,

          target_provider_grant_id:
            grantId,

          target_email:
            connectedEmail,

          target_scope:
            connectedScope,
        },
      );

    if (
      finalizeError
    ) {
      console.error(
        "Campaign Seat Calendar finalization rejected",
        {
          message:
            finalizeError.message,
        },
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            finalizeError.message ||
            "Nylas authorized Calendar, but Campaign Seat could not finalize the connection.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        workspaceId:
          oauthState
            .workspace_id,

        provider:
          expectedProvider,

        email:
          connectedEmail,

        integration:
          finalized,
      },
    );
  },
);
