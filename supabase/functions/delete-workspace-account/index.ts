import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders as supabaseCorsHeaders,
} from "npm:@supabase/supabase-js@2/cors";

type DeleteAccountRequest = {
  workspaceId?: string;
  membershipId?: string;
  confirmationEmail?: string;
};

type PreparedDeletion = {
  target_user_id: string;
  target_email: string;
  revoked_membership_id: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://campaignseat.com",
  "https://www.campaignseat.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

function isAllowedOrigin(
  origin: string,
): boolean {
  if (
    ALLOWED_ORIGINS.has(
      origin,
    )
  ) {
    return true;
  }

  try {
    const parsedOrigin =
      new URL(origin);

    return (
      parsedOrigin.protocol ===
        "http:" &&
      [
        "localhost",
        "127.0.0.1",
        "[::1]",
      ].includes(
        parsedOrigin.hostname,
      )
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(
  request: Request,
) {
  const requestOrigin =
    request.headers.get(
      "origin",
    ) || "";

  const allowedOrigin =
    isAllowedOrigin(
      requestOrigin,
    )
      ? requestOrigin
      : "https://campaignseat.com";

  return {
    ...supabaseCorsHeaders,

    "Access-Control-Allow-Origin":
      allowedOrigin,

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Access-Control-Max-Age":
      "86400",

    "Cache-Control":
      "no-store",

    "Vary":
      "Origin",
  };
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function firstString(
  value: unknown,
): string {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result =
        firstString(item);

      if (result) {
        return result;
      }
    }
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const item of
      Object.values(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      const result =
        firstString(item);

      if (result) {
        return result;
      }
    }
  }

  return "";
}

function readEnvironmentKey(
  legacyName: string,
  modernName: string,
): string {
  const legacyValue =
    Deno.env.get(legacyName);

  if (legacyValue?.trim()) {
    return legacyValue.trim();
  }

  const modernValue =
    Deno.env.get(modernName);

  if (!modernValue) {
    return "";
  }

  try {
    return firstString(
      JSON.parse(modernValue),
    );
  } catch {
    return modernValue.trim();
  }
}

function getRpcStatus(
  code?: string,
  message?: string,
): number {
  if (code === "42501") {
    return 403;
  }

  if (code === "P0002") {
    return 404;
  }

  if (code === "23503") {
    return 409;
  }

  if (code === "22023") {
    return 400;
  }

  if (
    message
      ?.toLowerCase()
      .includes("permission")
  ) {
    return 403;
  }

  return 400;
}

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    const corsHeaders =
      getCorsHeaders(request);

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Only POST requests are allowed.",
        },
        405,
        corsHeaders,
      );
    }

    const authorization =
      request.headers.get(
        "Authorization",
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer ",
        )
    ) {
      return jsonResponse(
        {
          error:
            "A signed-in Campaign Seat session is required.",
        },
        401,
        corsHeaders,
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const publicKey =
      readEnvironmentKey(
        "SUPABASE_ANON_KEY",
        "SUPABASE_PUBLISHABLE_KEYS",
      );

    const secretKey =
      readEnvironmentKey(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SECRET_KEYS",
      );

    if (
      !supabaseUrl ||
      !publicKey ||
      !secretKey
    ) {
      console.error(
        "Required Supabase Edge Function environment variables are unavailable.",
      );

      return jsonResponse(
        {
          error:
            "The secure account-deletion service is not configured.",
        },
        500,
        corsHeaders,
      );
    }

    let requestBody:
      DeleteAccountRequest;

    try {
      requestBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          error:
            "The deletion request must contain valid JSON.",
        },
        400,
        corsHeaders,
      );
    }

    const workspaceId =
      String(
        requestBody
          ?.workspaceId ||
          "",
      ).trim();

    const membershipId =
      String(
        requestBody
          ?.membershipId ||
          "",
      ).trim();

    const confirmationEmail =
      String(
        requestBody
          ?.confirmationEmail ||
          "",
      )
        .trim()
        .toLowerCase();

    if (
      !workspaceId ||
      !membershipId ||
      !confirmationEmail
    ) {
      return jsonResponse(
        {
          error:
            "Workspace, membership and confirmation email are required.",
        },
        400,
        corsHeaders,
      );
    }

    const userClient =
      createClient(
        supabaseUrl,
        publicKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
            detectSessionInUrl:
              false,
          },
        },
      );

    const {
      data: {
        user:
          authenticatedUser,
      },
      error:
        authenticationError,
    } =
      await userClient
        .auth
        .getUser();

    if (
      authenticationError ||
      !authenticatedUser
    ) {
      return jsonResponse(
        {
          error:
            "Your Campaign Seat session could not be verified.",
        },
        401,
        corsHeaders,
      );
    }

    const accessToken =
      authorization
        .slice(
          "Bearer ".length,
        )
        .trim();

    const {
      data:
        verifiedClaimsResult,
      error:
        verifiedClaimsError,
    } =
      await userClient.auth
        .getClaims(
          accessToken,
        );

    const verifiedClaims =
      verifiedClaimsResult
        ?.claims;

    if (
      verifiedClaimsError ||
      !verifiedClaims ||
      verifiedClaims.sub !==
        authenticatedUser.id
    ) {
      return jsonResponse(
        {
          error:
            "Your Campaign Seat session claims could not be verified.",
        },
        401,
        corsHeaders,
      );
    }

    if (
      verifiedClaims.aal !==
        "aal2"
    ) {
      return jsonResponse(
        {
          error:
            "Complete two-step verification before permanently deleting a Campaign Seat account.",

          code:
            "MFA_REQUIRED",

          mfaRequired:
            true,
        },
        403,
        corsHeaders,
      );
    }

    const {
      data:
        preparationData,
      error:
        preparationError,
    } =
      await userClient.rpc(
        "prepare_workspace_account_deletion",
        {
          target_workspace_id:
            workspaceId,
          target_membership_id:
            membershipId,
          confirmation_email:
            confirmationEmail,
        },
      );

    if (preparationError) {
      return jsonResponse(
        {
          error:
            preparationError.message ||
            "The account could not be prepared for deletion.",
        },
        getRpcStatus(
          preparationError.code,
          preparationError.message,
        ),
        corsHeaders,
      );
    }

    const preparedDeletion =
      (
        Array.isArray(
          preparationData,
        )
          ? preparationData[0]
          : preparationData
      ) as
        | PreparedDeletion
        | undefined;

    if (
      !preparedDeletion
        ?.target_user_id
    ) {
      return jsonResponse(
        {
          error:
            "The deletion service did not return a valid user account.",
        },
        500,
        corsHeaders,
      );
    }

    const adminClient =
      createClient(
        supabaseUrl,
        secretKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
            detectSessionInUrl:
              false,
          },
        },
      );

    /*
     * false means a permanent hard deletion,
     * not Supabase soft deletion.
     */
    const {
      error:
        deletionError,
    } =
      await adminClient
        .auth
        .admin
        .deleteUser(
          preparedDeletion
            .target_user_id,
          false,
        );

    if (deletionError) {
      console.error(
        "Supabase Auth deletion failed after access revocation:",
        deletionError,
      );

      return jsonResponse(
        {
          error:
            "The login could not be permanently deleted. Campaign access has already been removed. Resolve any remaining linked records and retry.",
          accessRevoked:
            true,
        },
        409,
        corsHeaders,
      );
    }

    const {
      error:
        auditError,
    } =
      await adminClient
        .from(
          "activity_log",
        )
        .insert({
          workspace_id:
            workspaceId,

          actor_user_id:
            authenticatedUser.id,

          activity_type:
            "member_account_deleted",

          title:
            "Member account permanently deleted",

          detail:
            preparedDeletion
              .target_email,

          entity_type:
            "member",

          entity_id:
            preparedDeletion
              .revoked_membership_id,

          route:
            "/team/access",

          metadata: {
            operation:
              "DELETE_AUTH_USER",

            target_user_id:
              preparedDeletion
                .target_user_id,

            target_email:
              preparedDeletion
                .target_email,

            access_revoked:
              true,
          },

          occurred_at:
            new Date()
              .toISOString(),
        });

    if (auditError) {
      console.error(
        "Permanent deletion succeeded but its Activity Center record could not be created:",
        auditError,
      );
    }

    return jsonResponse(
      {
        ok:
          true,
        deleted:
          true,
        accessRevoked:
          true,
        auditRecorded:
          !auditError,
        message:
          "The Campaign Seat account and workspace access were permanently deleted.",
      },
      200,
      corsHeaders,
    );
  },
);
