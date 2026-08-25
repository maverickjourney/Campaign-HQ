import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS =
  new Set([
    "https://campaignseat.com",
    "https://app.campaignseat.com",
    "https://www.campaignseat.com",
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
  "Mail.ReadWrite",
  "Mail.Send",
  "Contacts.Read",
  "Calendars.ReadWrite",
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

    const nylasClientId =
      Deno.env.get(
        "NYLAS_CLIENT_ID",
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
      !nylasClientId ||
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

    const workspaceId =
      String(
        body.workspaceId ||
        "",
      ).trim();

    if (
      !workspaceId
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A campaign workspace is required.",
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
        "begin_calendar_oauth",
        {
          target_workspace_id:
            workspaceId,
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
            "Campaign Seat could not start Calendar authorization.",
        },
      );
    }

    const state =
      Array.isArray(
        data,
      )
        ? data[0]
        : data;

    const provider =
      String(
        state
          ?.account_provider ||
        "",
      )
        .trim()
        .toLowerCase();

    const connectedEmail =
      String(
        state
          ?.connected_email ||
        "",
      )
        .trim()
        .toLowerCase();

    if (
      !state
        ?.oauth_state ||
      !connectedEmail ||
      ![
        "google",
        "microsoft",
      ].includes(
        provider,
      )
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not create a secure Calendar authorization session.",
        },
      );
    }

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
        "access_type",
        "offline",
      );

    authorizationUrl
      .searchParams
      .set(
        "scope",
        scopes.join(
          " ",
        ),
      );

    authorizationUrl
      .searchParams
      .set(
        "login_hint",
        connectedEmail,
      );

    return jsonResponse(
      request,
      200,
      {
        authorizationUrl:
          authorizationUrl
            .toString(),

        expiresAt:
          state
            .oauth_expires_at ||
          null,

        provider,

        email:
          connectedEmail,
      },
    );
  },
);
