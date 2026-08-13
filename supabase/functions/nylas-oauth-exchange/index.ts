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
      },
    },
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
        "Authorization",
      );

    if (
      !authorization
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
      );

    const anonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    const nylasClientId =
      Deno.env.get(
        "NYLAS_CLIENT_ID",
      );

    const nylasApiKey =
      Deno.env.get(
        "NYLAS_API_KEY",
      );

    const nylasRedirectUri =
      Deno.env.get(
        "NYLAS_REDIRECT_URI",
      );

    const nylasApiUri =
      Deno.env.get(
        "NYLAS_API_URI",
      );

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Supabase function configuration is incomplete.",
        },
      );
    }

    if (
      !nylasClientId ||
      !nylasApiKey ||
      !nylasRedirectUri ||
      !nylasApiUri
    ) {
      return jsonResponse(
        request,
        503,
        {
          error:
            "Nylas has not been configured for this Campaign Seat environment yet.",
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
            "A valid OAuth callback body is required.",
        },
      );
    }

    const code =
      String(
        body.code ||
        "",
      );

    const state =
      String(
        body.state ||
        "",
      );

    if (
      !code ||
      !state
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "The OAuth authorization code and state are required.",
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
        "consume_email_contacts_oauth_state",
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
            "The OAuth authorization session is invalid or expired.",
        },
      );
    }

    const oauthState =
      Array.isArray(
        stateData,
      )
        ? stateData[0]
        : stateData;

    if (
      !oauthState
        ?.workspace_id ||
      !oauthState
        ?.provider ||
      !oauthState
        ?.code_verifier
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "The OAuth authorization session is incomplete.",
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
            "Campaign Seat could not reach the email connection provider.",
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
          await tokenResponse.text();
      } catch {
        providerError =
          "Unable to read Nylas error response.";
      }

      console.error(
        "Nylas OAuth token exchange rejected",
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
            `The email provider rejected the OAuth exchange (${tokenResponse.status}). Restart the connection flow.`,
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
            "The email provider returned an invalid OAuth response.",
        },
      );
    }

    const grantId =
      String(
        tokenData.grant_id ||
        "",
      );

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
      String(
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
            "Nylas did not return a verified grant and email address.",
        },
      );
    }

    if (
      connectedProvider &&
      connectedProvider !==
        oauthState.provider
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "The connected provider does not match the provider that started this OAuth session.",
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
      error:
        finalizeError,
    } =
      await adminClient.rpc(
        "finalize_email_contacts_connection",
        {
          target_workspace_id:
            oauthState
              .workspace_id,

          target_actor_user_id:
            actorUser.id,

          target_provider:
            oauthState.provider,

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
      return jsonResponse(
        request,
        500,
        {
          error:
            "Nylas authorized the mailbox, but Campaign Seat could not finalize the connection. Do not repeat the callback; restart the connection flow after review.",
        },
      );
    }

    const {
      error:
        sendCapabilityError,
    } =
      await adminClient.rpc(
        "activate_email_send_capability",
        {
          target_workspace_id:
            oauthState
              .workspace_id,

          target_provider_grant_id:
            grantId,

          target_provider:
            oauthState.provider,

          target_scope:
            connectedScope,
        },
      );

    if (
      sendCapabilityError
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "The mailbox connected, but Campaign Seat could not verify its send permission. Restart the connection after the provider permissions are reviewed.",
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
          oauthState.provider,

        email:
          connectedEmail,

      },
    );
  },
);
