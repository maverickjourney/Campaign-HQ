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
];

const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Contacts.Read",
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

    const nylasClientId =
      Deno.env.get(
        "NYLAS_CLIENT_ID",
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
      !anonKey
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
            "A valid request body is required.",
        },
      );
    }

    const workspaceId =
      String(
        body.workspaceId ||
        "",
      );

    const provider =
      String(
        body.provider ||
        "",
      ).toLowerCase();

    const mode =
      String(
        body.mode ||
        "connect",
      )
        .trim()
        .toLowerCase();

    if (
      !workspaceId
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A Campaign Seat workspace is required.",
        },
      );
    }

    if (
      provider !==
        "google" &&
      provider !==
        "microsoft"
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Choose Google or Microsoft.",
        },
      );
    }


    if (
      mode !==
        "connect" &&
      mode !==
        "reauthorize"
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Choose a valid provider connection mode.",
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
        mode ===
          "reauthorize"
          ? "begin_email_contacts_reauthorization"
          : "begin_email_contacts_oauth",
        {
          target_workspace_id:
            workspaceId,

          target_provider:
            provider,
        },
      );

    if (
      error
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            error.message ||
            "Campaign Seat could not authorize this provider connection.",
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
      !state
        ?.oauth_state ||
      !state
        ?.code_challenge
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not create a secure OAuth session.",
        },
      );
    }

    const loginHint =
      String(
        state
          ?.login_hint ||
        "",
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


    if (
      mode ===
        "reauthorize" &&
      loginHint
    ) {
      authorizationUrl
        .searchParams
        .set(
          "login_hint",
          loginHint,
        );
    }

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
        "S256",
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

    return jsonResponse(
      request,
      200,
      {
        mode,

        authorizationUrl:
          authorizationUrl
            .toString(),

        expiresAt:
          state
            .oauth_expires_at ||
          null,
      },
    );
  },
);
