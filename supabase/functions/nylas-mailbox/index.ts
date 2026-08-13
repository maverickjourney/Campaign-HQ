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

        "Cache-Control":
          "no-store",
      },
    },
  );
}

function clean(
  value: unknown,
) {
  return String(
    value || "",
  ).trim();
}

function stripGrantReferences(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      stripGrantReferences,
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const next:
      Record<
        string,
        unknown
      > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      if (
        key ===
          "grant_id" ||
        key ===
          "account_id"
      ) {
        continue;
      }

      next[key] =
        stripGrantReferences(
          item,
        );
    }

    return next;
  }

  return value;
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

    const nylasApiKey =
      Deno.env.get(
        "NYLAS_API_KEY",
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
            "Campaign Seat server configuration is incomplete.",
        },
      );
    }

    if (
      !nylasApiKey ||
      !nylasApiUri
    ) {
      return jsonResponse(
        request,
        503,
        {
          error:
            "Connected email is not configured for this environment yet.",
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
            "A valid mailbox request is required.",
        },
      );
    }

    const workspaceId =
      clean(
        body.workspaceId,
      );

    const action =
      clean(
        body.action,
      );

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

    if (
      userError ||
      !userData
        ?.user
        ?.id
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
        canView,
      error:
        permissionError,
    } =
      await userClient.rpc(
        "can_view_connected_email",
        {
          target_workspace_id:
            workspaceId,
        },
      );

    if (
      permissionError ||
      canView !==
        true
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            "You do not have permission to view the connected campaign mailbox.",
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
        connectionData,
      error:
        connectionError,
    } =
      await adminClient.rpc(
        "get_email_runtime_connection",
        {
          target_workspace_id:
            workspaceId,
        },
      );

    if (
      connectionError
    ) {
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat could not resolve the protected mailbox connection.",
        },
      );
    }

    const connection =
      Array.isArray(
        connectionData,
      )
        ? connectionData[0]
        : connectionData;

    if (
      !connection
        ?.grant_reference ||
      connection
        ?.read_ready !==
        true
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "A verified readable campaign mailbox is not connected yet.",
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
        connection
          .grant_reference,
      );

    let target:
      URL;

    let binaryResponse =
      false;

    if (
      action ===
      "list_folders"
    ) {
      target =
        new URL(
          `${baseUri}/v3/grants/${grant}/folders`,
        );

      target.searchParams.set(
        "limit",
        "50",
      );
    } else if (
      action ===
      "list_threads"
    ) {
      target =
        new URL(
          `${baseUri}/v3/grants/${grant}/threads`,
        );

      const requestedLimit =
        Number(
          body.limit ||
          20,
        );

      const limit =
        Number.isFinite(
          requestedLimit,
        )
          ? Math.max(
              1,
              Math.min(
                20,
                Math.floor(
                  requestedLimit,
                ),
              ),
            )
          : 20;

      target.searchParams.set(
        "limit",
        String(
          limit,
        ),
      );

      const pageToken =
        clean(
          body.pageToken,
        );

      const folderId =
        clean(
          body.folderId,
        );

      const anyEmail =
        clean(
          body.anyEmail,
        );

      if (
        pageToken
      ) {
        target.searchParams.set(
          "page_token",
          pageToken,
        );
      }

      if (
        folderId
      ) {
        target.searchParams.set(
          "in",
          folderId,
        );
      }

      if (
        anyEmail
      ) {
        target.searchParams.set(
          "any_email",
          anyEmail,
        );
      }

      if (
        typeof body.unread ===
          "boolean"
      ) {
        target.searchParams.set(
          "unread",
          String(
            body.unread,
          ),
        );
      }

      if (
        typeof body.hasAttachment ===
          "boolean"
      ) {
        target.searchParams.set(
          "has_attachment",
          String(
            body.hasAttachment,
          ),
        );
      }
    } else if (
      action ===
      "get_thread"
    ) {
      const threadId =
        clean(
          body.threadId,
        );

      if (
        !threadId
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "A thread ID is required.",
          },
        );
      }

      target =
        new URL(
          `${baseUri}/v3/grants/${grant}/threads/${encodeURIComponent(threadId)}`,
        );
    } else if (
      action ===
      "get_message"
    ) {
      const messageId =
        clean(
          body.messageId,
        );

      if (
        !messageId
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "A message ID is required.",
          },
        );
      }

      target =
        new URL(
          `${baseUri}/v3/grants/${grant}/messages/${encodeURIComponent(messageId)}`,
        );
    } else if (
      action ===
      "download_attachment"
    ) {
      const attachmentId =
        clean(
          body.attachmentId,
        );

      const messageId =
        clean(
          body.messageId,
        );

      if (
        !attachmentId ||
        !messageId
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "Attachment and message IDs are required.",
          },
        );
      }

      target =
        new URL(
          `${baseUri}/v3/grants/${grant}/attachments/${encodeURIComponent(attachmentId)}/download`,
        );

      target.searchParams.set(
        "message_id",
        messageId,
      );

      binaryResponse =
        true;
    } else {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Unsupported mailbox action.",
        },
      );
    }

    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          target,
          {
            method:
              "GET",

            headers: {
              "Authorization":
                `Bearer ${nylasApiKey}`,

              "Accept":
                binaryResponse
                  ? "*/*"
                  : "application/json",
            },
          },
        );
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not reach the connected email provider.",
        },
      );
    }

    if (
      !providerResponse.ok
    ) {
      if (
        providerResponse.status ===
          401 ||
        providerResponse.status ===
          403
      ) {
        return jsonResponse(
          request,
          502,
          {
            error:
              "The connected mailbox authorization needs attention.",
          },
        );
      }

      if (
        providerResponse.status ===
        429
      ) {
        return jsonResponse(
          request,
          429,
          {
            error:
              "The mailbox is temporarily rate limited. Try again shortly.",
          },
        );
      }

      return jsonResponse(
        request,
        502,
        {
          error:
            "The email provider could not complete this mailbox request.",
        },
      );
    }

    if (
      binaryResponse
    ) {
      const bytes =
        await providerResponse
          .arrayBuffer();

      return new Response(
        bytes,
        {
          status: 200,
          headers: {
            ...corsHeaders(
              request,
            ),

            "Content-Type":
              providerResponse
                .headers
                .get(
                  "content-type",
                ) ||
              "application/octet-stream",

            "Content-Disposition":
              "attachment",

            "Cache-Control":
              "private, no-store",
          },
        },
      );
    }

    let providerPayload:
      Record<
        string,
        unknown
      >;

    try {
      providerPayload =
        await providerResponse
          .json();
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "The email provider returned an invalid response.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        action,

        connectedEmail:
          connection
            .connected_email ||
          null,

        accountProvider:
          connection
            .account_provider ||
          null,

        data:
          stripGrantReferences(
            providerPayload.data,
          ),

        nextCursor:
          providerPayload.next_cursor ||
          null,
      },
    );
  },
);
