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


const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];


const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Contacts.Read",
  "https://graph.microsoft.com/Calendars.ReadWrite",
];


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

    const nylasClientId =
      Deno.env.get(
        "NYLAS_CLIENT_ID",
      ) || "";

    const nylasApiUri =
      Deno.env.get(
        "NYLAS_API_URI",
      ) || "";

    const nylasRedirectUri =
      Deno.env.get(
        "NYLAS_REDIRECT_URI",
      ) || "";


    if (
      !supabaseUrl ||
      !anonKey ||
      !nylasClientId ||
      !nylasApiUri ||
      !nylasRedirectUri
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
            "A valid request body is required.",
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


    const supabase =
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
      data,
      error,
    } =
      await supabase.rpc(
        "begin_seat_product_oauth",
        {
          target_integration_key:
            integrationKey,

          target_redirect_uri:
            nylasRedirectUri,
        },
      );


    if (error) {
      return jsonResponse(
        request,
        403,
        {
          error:
            error.message ||
            "Campaign Seat could not begin provider authorization.",
        },
      );
    }


    const state =
      Array.isArray(
        data,
      )
        ? data[0]
        : data;


    if (
      !state?.oauth_state ||
      !state?.code_challenge ||
      !state?.provider
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not create a secure provider authorization session.",
        },
      );
    }


    const provider =
      String(
        state.provider,
      )
        .trim()
        .toLowerCase();


    const scopes =
      provider ===
        "google"
        ? GOOGLE_SCOPES
        : MICROSOFT_SCOPES;


    const baseUri =
      nylasApiUri.replace(
        /\/+$/,
        "",
      );


    const authorizationUrl =
      new URL(
        `${baseUri}/v3/connect/auth`,
      );


    authorizationUrl
      .searchParams
      .set(
        "client_id",
        nylasClientId,
      );

    authorizationUrl
      .searchParams
      .set(
        "redirect_uri",
        nylasRedirectUri,
      );

    authorizationUrl
      .searchParams
      .set(
        "response_type",
        "code",
      );

    authorizationUrl
      .searchParams
      .set(
        "provider",
        provider,
      );

    authorizationUrl
      .searchParams
      .set(
        "state",
        state.oauth_state,
      );

    authorizationUrl
      .searchParams
      .set(
        "code_challenge",
        state.code_challenge,
      );

    authorizationUrl
      .searchParams
      .set(
        "code_challenge_method",
        "s256",
      );

    authorizationUrl
      .searchParams
      .set(
        "access_type",
        "offline",
      );

    authorizationUrl
      .searchParams
      .set(
        "scope",
        scopes.join(" "),
      );


    const loginHint =
      String(
        state.login_hint ||
        "",
      ).trim();


    if (loginHint) {
      authorizationUrl
        .searchParams
        .set(
          "login_hint",
          loginHint,
        );
    }


    return jsonResponse(
      request,
      200,
      {
        authorizationUrl:
          authorizationUrl
            .toString(),

        provider,

        integrationKey:
          state.integration_key,

        expiresAt:
          state.oauth_expires_at ||
          null,
      },
    );
  },
);
