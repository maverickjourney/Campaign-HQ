import {
  createClient,
} from "npm:@supabase/supabase-js@2.110.2";

import {
  corsHeaders as supabaseCorsHeaders,
} from "npm:@supabase/supabase-js@2.110.2/cors";

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
): Record<string, string> {
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

const APP_URL =
  Deno.env.get(
    "CAMPAIGN_SEAT_APP_URL",
  ) ||
  "https://campaignseat.com";

const FROM_EMAIL =
  Deno.env.get(
    "CAMPAIGN_SEAT_INVITATION_FROM",
  ) ||
  "Campaign Seat Invitations <invites@mail.campaignseat.com>";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

type InvitationRequest = {
  invitationId?: unknown;
  invitationToken?: unknown;
};

type InvitationRecord = {
  id: string;
  workspace_id: string;
  email: string;
  role_key: string;
  display_title: string | null;
  token_hash: string;
  status: string;
  expires_at: string;
};

function createJsonResponse(
  corsHeaders: Record<string, string>,
) {
  return function jsonResponse(
    body: Record<string, unknown>,
    status = 200,
  ) {
    return new Response(
      JSON.stringify(body),
      {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  };
}

function clean(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}

function escapeHtml(
  value: unknown,
) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRequiredEnvironmentValue(
  names: string[],
) {
  for (
    const name of names
  ) {
    const value =
      Deno.env.get(name);

    if (
      value &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  throw new Error(
    `Missing required environment variable: ${names.join(
      " or ",
    )}`,
  );
}

async function sha256Hex(
  value: string,
) {
  const encoded =
    new TextEncoder()
      .encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

function constantTimeEqual(
  left: string,
  right: string,
) {
  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    difference |=
      left.charCodeAt(index) ^
      right.charCodeAt(index);
  }

  return difference === 0;
}

function formatExpiration(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone:
        "America/New_York",
    },
  ).format(date);
}

function createTextEmail({
  workspaceName,
  roleName,
  invitationLink,
  expiration,
}: {
  workspaceName: string;
  roleName: string;
  invitationLink: string;
  expiration: string;
}) {
  return [
    `You have been invited to join ${workspaceName} on Campaign Seat.`,
    "",
    `Role: ${roleName}`,
    `Invitation expires: ${expiration}`,
    "",
    "Accept your secure invitation:",
    invitationLink,
    "",
    "Only use this invitation if you recognize the campaign and expected to receive it.",
    "",
    "Campaign Seat",
  ].join("\n");
}

function createHtmlEmail({
  workspaceName,
  roleName,
  invitationLink,
  expiration,
}: {
  workspaceName: string;
  roleName: string;
  invitationLink: string;
  expiration: string;
}) {
  const safeWorkspace =
    escapeHtml(
      workspaceName,
    );

  const safeRole =
    escapeHtml(
      roleName,
    );

  const safeLink =
    escapeHtml(
      invitationLink,
    );

  const safeExpiration =
    escapeHtml(
      expiration,
    );

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >
    <title>Campaign Seat Invitation</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #f2f5f9;
      color: #152238;
      font-family: Arial, Helvetica, sans-serif;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        width: 100%;
        background: #f2f5f9;
        padding: 32px 16px;
      "
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width: 100%;
              max-width: 600px;
              overflow: hidden;
              background: #ffffff;
              border: 1px solid #dce3ed;
              border-radius: 18px;
              box-shadow: 0 12px 32px rgba(18, 35, 61, 0.08);
            "
          >
            <tr>
              <td
                style="
                  padding: 26px 32px;
                  background: #13294b;
                  border-bottom: 5px solid #c62828;
                "
              >
                <div
                  style="
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.4px;
                  "
                >
                  Campaign Seat
                </div>

                <div
                  style="
                    margin-top: 5px;
                    color: #d9e4f2;
                    font-size: 13px;
                    letter-spacing: 1.3px;
                    text-transform: uppercase;
                  "
                >
                  Secure Campaign Access
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 38px 32px 18px;
                "
              >
                <div
                  style="
                    color: #c62828;
                    font-size: 13px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                  "
                >
                  Team invitation
                </div>

                <h1
                  style="
                    margin: 12px 0 16px;
                    color: #13294b;
                    font-size: 30px;
                    line-height: 1.18;
                  "
                >
                  You’re invited to join ${safeWorkspace}
                </h1>

                <p
                  style="
                    margin: 0;
                    color: #4b5d74;
                    font-size: 16px;
                    line-height: 1.65;
                  "
                >
                  A campaign leader has invited you to securely join
                  their Campaign Seat workspace.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 8px 32px 24px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width: 100%;
                    background: #f7f9fc;
                    border: 1px solid #e1e7ef;
                    border-radius: 12px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 19px 20px;
                      "
                    >
                      <div
                        style="
                          color: #697a90;
                          font-size: 12px;
                          font-weight: 700;
                          letter-spacing: 0.8px;
                          text-transform: uppercase;
                        "
                      >
                        Assigned role
                      </div>

                      <div
                        style="
                          margin-top: 6px;
                          color: #13294b;
                          font-size: 18px;
                          font-weight: 800;
                        "
                      >
                        ${safeRole}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding: 4px 32px 28px;
                "
              >
                <a
                  href="${safeLink}"
                  style="
                    display: inline-block;
                    padding: 15px 27px;
                    background: #c62828;
                    color: #ffffff;
                    border-radius: 9px;
                    font-size: 16px;
                    font-weight: 800;
                    text-decoration: none;
                  "
                >
                  Accept secure invitation
                </a>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 32px 30px;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #68798e;
                    font-size: 13px;
                    line-height: 1.6;
                    text-align: center;
                  "
                >
                  This secure invitation expires ${safeExpiration}.
                  Do not forward this email or share the invitation link.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 22px 32px;
                  background: #f7f9fc;
                  border-top: 1px solid #e3e8ef;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #728198;
                    font-size: 12px;
                    line-height: 1.6;
                    text-align: center;
                  "
                >
                  If you did not expect this invitation, you may safely
                  ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

Deno.serve(
  async (
    request: Request,
  ) => {
    const corsHeaders =
      getCorsHeaders(request);

    const jsonResponse =
      createJsonResponse(
        corsHeaders,
      );

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
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
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const authorization =
        request.headers.get(
          "Authorization",
        );

      if (
        !authorization ||
        !authorization.startsWith(
          "Bearer ",
        )
      ) {
        return jsonResponse(
          {
            error:
              "Authentication is required.",
          },
          401,
        );
      }

      const supabaseUrl =
        getRequiredEnvironmentValue([
          "SUPABASE_URL",
        ]);

      const supabaseKey =
        getRequiredEnvironmentValue([
          "SUPABASE_ANON_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
        ]);

      const resendApiKey =
        getRequiredEnvironmentValue([
          "RESEND_API_KEY",
        ]);

      const supabase =
        createClient(
          supabaseUrl,
          supabaseKey,
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
            },
          },
        );

      const {
        data: userResult,
        error: userError,
      } =
        await supabase.auth
          .getUser();

      const user =
        userResult?.user;

      if (
        userError ||
        !user
      ) {
        return jsonResponse(
          {
            error:
              "The signed-in session is invalid or expired.",
          },
          401,
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
        await supabase.auth
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
          user.id
      ) {
        return jsonResponse(
          {
            error:
              "The signed-in session claims could not be verified.",
          },
          401,
        );
      }

      if (
        verifiedClaims.aal !==
        "aal2"
      ) {
        return jsonResponse(
          {
            error:
              "Complete two-step verification before sending a campaign invitation.",

            code:
              "MFA_REQUIRED",

            mfaRequired:
              true,
          },
          403,
        );
      }

      let body:
        InvitationRequest;

      try {
        body =
          await request.json();
      } catch {
        return jsonResponse(
          {
            error:
              "A valid JSON request body is required.",
          },
          400,
        );
      }

      const invitationId =
        clean(
          body.invitationId,
        );

      const invitationToken =
        clean(
          body.invitationToken,
        );

      if (
        !UUID_PATTERN.test(
          invitationId,
        )
      ) {
        return jsonResponse(
          {
            error:
              "The invitation identifier is invalid.",
          },
          400,
        );
      }

      if (
        !TOKEN_PATTERN.test(
          invitationToken,
        )
      ) {
        return jsonResponse(
          {
            error:
              "The secure invitation token is invalid.",
          },
          400,
        );
      }

      const {
        data:
          invitationData,
        error:
          invitationError,
      } =
        await supabase
          .from(
            "workspace_invitations",
          )
          .select(
            `
              id,
              workspace_id,
              email,
              role_key,
              display_title,
              token_hash,
              status,
              expires_at
            `,
          )
          .eq(
            "id",
            invitationId,
          )
          .single();

      if (
        invitationError ||
        !invitationData
      ) {
        return jsonResponse(
          {
            error:
              "The invitation could not be found or accessed.",
          },
          404,
        );
      }

      const invitation =
        invitationData as
          InvitationRecord;

      const {
        data:
          hasPermission,
        error:
          permissionError,
      } =
        await supabase.rpc(
          "has_campaign_permission",
          {
            target_workspace_id:
              invitation
                .workspace_id,

            requested_permission:
              "workspace.invite_members",
          },
        );

      if (
        permissionError ||
        hasPermission !==
          true
      ) {
        return jsonResponse(
          {
            error:
              "Your campaign role cannot send this invitation.",
          },
          403,
        );
      }

      if (
        invitation.status !==
        "pending"
      ) {
        return jsonResponse(
          {
            error:
              "Only pending invitations can be emailed.",
          },
          409,
        );
      }

      const expiresAt =
        new Date(
          invitation
            .expires_at,
        );

      if (
        Number.isNaN(
          expiresAt.getTime(),
        ) ||
        expiresAt.getTime() <=
          Date.now()
      ) {
        return jsonResponse(
          {
            error:
              "This invitation has expired.",
          },
          410,
        );
      }

      const suppliedHash =
        await sha256Hex(
          invitationToken,
        );

      if (
        !constantTimeEqual(
          suppliedHash
            .toLowerCase(),
          invitation
            .token_hash
            .toLowerCase(),
        )
      ) {
        return jsonResponse(
          {
            error:
              "The secure invitation token does not match this invitation.",
          },
          403,
        );
      }

      const [
        workspaceResult,
        roleResult,
      ] =
        await Promise.all([
          supabase
            .from(
              "workspaces",
            )
            .select("name")
            .eq(
              "id",
              invitation
                .workspace_id,
            )
            .single(),

          supabase
            .from(
              "campaign_roles",
            )
            .select("name")
            .eq(
              "key",
              invitation
                .role_key,
            )
            .single(),
        ]);

      const workspaceName =
        clean(
          workspaceResult
            .data
            ?.name,
        ) ||
        "your campaign workspace";

      const roleName =
        clean(
          invitation
            .display_title,
        ) ||
        clean(
          roleResult
            .data
            ?.name,
        ) ||
        invitation
          .role_key
          .replaceAll(
            "_",
            " ",
          );

      const invitationLink =
        `${APP_URL.replace(
          /\/+$/,
          "",
        )}/invite?token=${encodeURIComponent(
          invitationToken,
        )}`;

      const expiration =
        formatExpiration(
          invitation
            .expires_at,
        );

      const resendResponse =
        await fetch(
          "https://api.resend.com/emails",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${resendApiKey}`,

              "Content-Type":
                "application/json",

              "User-Agent":
                "Campaign-Seat-Edge-Function/1.0",

              "Idempotency-Key":
                `workspace-invitation-${invitation.id}`,
            },

            body:
              JSON.stringify(
                {
                  from:
                    FROM_EMAIL,

                  to: [
                    invitation
                      .email,
                  ],

                  subject:
                    `You’re invited to join ${workspaceName} on Campaign Seat`,

                  html:
                    createHtmlEmail({
                      workspaceName,
                      roleName,
                      invitationLink,
                      expiration,
                    }),

                  text:
                    createTextEmail({
                      workspaceName,
                      roleName,
                      invitationLink,
                      expiration,
                    }),
                },
              ),
          },
        );

      const resendPayload =
        await resendResponse
          .json()
          .catch(
            () => null,
          );

      if (
        !resendResponse.ok
      ) {
        console.error(
          "Resend invitation delivery failed",
          {
            status:
              resendResponse
                .status,

            invitationId:
              invitation.id,

            workspaceId:
              invitation
                .workspace_id,

            userId:
              user.id,

            providerError:
              resendPayload,
          },
        );

        return jsonResponse(
          {
            error:
              "The invitation was created, but the email provider could not deliver it. Copy and send the secure link manually.",
          },
          502,
        );
      }

      return jsonResponse(
        {
          success: true,

          invitationId:
            invitation.id,

          emailId:
            resendPayload
              ?.id ||
            null,

          recipient:
            invitation
              .email,

          expiresAt:
            invitation
              .expires_at,
        },
      );
    } catch (
      error
    ) {
      console.error(
        "Unexpected invitation email error",
        error,
      );

      return jsonResponse(
        {
          error:
            "Campaign Seat could not send the invitation email.",
        },
        500,
      );
    }
  },
);
