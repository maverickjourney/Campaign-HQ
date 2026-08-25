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
      ) || "";


    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !nylasClientId ||
      !nylasApiKey ||
      !nylasApiUri
    ) {
      return jsonResponse(
        request,
        503,
        {
          error:
            "Campaign Seat provider authorization is not configured.",
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
      ).trim();

    const state =
      String(
        body.state ||
        "",
      ).trim();


    if (
      !code ||
      !state ||
      !state.startsWith(
        "seat.",
      )
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "The Campaign Seat OAuth callback is incomplete.",
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
        "consume_seat_product_oauth_state",
        {
          target_state:
            state,
        },
      );


    if (stateError) {
      return jsonResponse(
        request,
        403,
        {
          error:
            stateError.message ||
            "The provider authorization session is invalid or expired.",
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
        ?.product_account_integration_id ||
      !oauthState
        ?.provider ||
      !oauthState
        ?.code_verifier ||
      !oauthState
        ?.redirect_uri
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "The Campaign Seat provider authorization session is incomplete.",
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
                  oauthState
                    .redirect_uri,

                code_verifier:
                  oauthState
                    .code_verifier,
              }),
          },
        );
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not reach the provider authorization service.",
        },
      );
    }


    if (!tokenResponse.ok) {
      let providerError =
        "";

      try {
        providerError =
          await tokenResponse.text();
      } catch {
        providerError =
          "Unable to read provider response.";
      }

      console.error(
        "Seat onboarding Nylas token exchange rejected",
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
            `The provider rejected the OAuth exchange (${tokenResponse.status}). Restart the connection flow.`,
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
        await tokenResponse.json();
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "The provider returned an invalid OAuth response.",
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
              (scope) =>
                String(
                  scope,
                ),
            )
            .join(" ")
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
            "Nylas did not return a verified grant and provider email.",
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
            "The connected provider does not match the provider selected in Campaign Seat.",
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
        "finalize_seat_product_oauth_connection",
        {
          target_connection_id:
            oauthState
              .product_account_integration_id,

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


    if (finalizeError) {
      console.error(
        "Seat onboarding provider finalization rejected",
        finalizeError,
      );

      return jsonResponse(
        request,
        500,
        {
          error:
            finalizeError.message ||
            "The provider authorized successfully, but Campaign Seat could not finalize the connection.",
        },
      );
    }


    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        mode:
          "seat_onboarding",

        provider:
          oauthState.provider,

        integrationKey:
          oauthState.integration_key,

        email:
          connectedEmail,

        integration:
          finalized,
      },
    );
  },
);
