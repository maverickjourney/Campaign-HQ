import {
  createClient,
} from "npm:@supabase/supabase-js@2.110.2";

import {
  corsHeaders as supabaseCorsHeaders,
} from "npm:@supabase/supabase-js@2.110.2/cors";

const ALLOWED_ORIGINS = new Set([
  "https://admin.campaignseat.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

function corsHeaders(request: Request) {
  const origin =
    request.headers.get("origin") || "";

  const allowed =
    ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://admin.campaignseat.com";

  return {
    ...supabaseCorsHeaders,
    "Access-Control-Allow-Origin":
      allowed,
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Cache-Control":
      "no-store",
    "Vary":
      "Origin",
  };
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
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
  async (request) => {
    if (request.method === "OPTIONS") {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders(request),
        },
      );
    }

    if (request.method !== "POST") {
      return json(
        request,
        {
          ok: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    const authorization =
      request.headers.get(
        "Authorization",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      )
    ) {
      return json(
        request,
        {
          ok: false,
          error:
            "Seat Platform Admin authentication is required.",
        },
        401,
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

    if (
      !supabaseUrl ||
      !anonKey
    ) {
      return json(
        request,
        {
          ok: false,
          error:
            "Supabase runtime configuration is missing.",
        },
        500,
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
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );

    const {
      data: userResult,
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !userResult.user
    ) {
      return json(
        request,
        {
          ok: false,
          error:
            "The Admin session could not be verified.",
        },
        401,
      );
    }

    const token =
      authorization
        .slice(
          "Bearer ".length,
        )
        .trim();

    const {
      data: claimsResult,
      error: claimsError,
    } =
      await supabase.auth
        .getClaims(token);

    const claims =
      claimsResult?.claims;

    if (
      claimsError ||
      !claims ||
      claims.sub !==
        userResult.user.id
    ) {
      return json(
        request,
        {
          ok: false,
          error:
            "The Admin session claims could not be verified.",
        },
        401,
      );
    }

    if (claims.aal !== "aal2") {
      return json(
        request,
        {
          ok: false,
          error:
            "Complete MFA verification before deploying production.",
          code:
            "MFA_REQUIRED",
        },
        403,
      );
    }

    const {
      data: authorized,
      error: roleError,
    } =
      await supabase.rpc(
        "has_platform_role",
        {
          required_roles: [
            "platform_owner",
            "platform_admin",
          ],
        },
      );

    if (
      roleError ||
      authorized !== true
    ) {
      return json(
        request,
        {
          ok: false,
          error:
            "This account is not authorized to deploy Campaign Seat.",
        },
        403,
      );
    }

    const deployHook =
      Deno.env.get(
        "CAMPAIGN_SEAT_APP_DEPLOY_HOOK",
      );

    if (!deployHook) {
      return json(
        request,
        {
          ok: false,
          error:
            "The production App release hook is not configured.",
        },
        500,
      );
    }

    const response =
      await fetch(
        deployHook,
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const responseText =
      await response.text();

    if (!response.ok) {
      console.error(
        "Vercel release trigger failed:",
        response.status,
        responseText.slice(0, 500),
      );

      return json(
        request,
        {
          ok: false,
          error:
            "Vercel did not accept the App deployment request.",
        },
        502,
      );
    }

    let deployment:
      Record<string, unknown> | null =
      null;

    try {
      deployment =
        JSON.parse(
          responseText,
        );
    } catch {
      deployment = null;
    }

    console.log(
      "Campaign Seat App deployment requested",
      {
        userId:
          userResult.user.id,
        job:
          deployment?.job ||
          null,
        createdAt:
          new Date()
            .toISOString(),
      },
    );

    return json(
      request,
      {
        ok: true,
        status:
          "deployment_requested",
        job:
          deployment?.job ||
          null,
      },
      202,
    );
  },
);
