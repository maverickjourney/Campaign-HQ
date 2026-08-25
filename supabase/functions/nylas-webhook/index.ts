import {
  createClient,
} from "npm:@supabase/supabase-js@2";

function textResponse(
  value: string,
  status = 200,
) {
  return new Response(
    value,
    {
      status,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",

        "Cache-Control":
          "no-store",
      },
    },
  );
}

function hexToBytes(
  value: string,
) {
  if (
    !/^[0-9a-f]{64}$/i
      .test(
        value,
      )
  ) {
    return null;
  }

  const bytes =
    new Uint8Array(
      32,
    );

  for (
    let index = 0;
    index < 32;
    index += 1
  ) {
    bytes[index] =
      Number.parseInt(
        value.slice(
          index * 2,
          index * 2 + 2,
        ),
        16,
      );
  }

  return bytes;
}

function constantTimeEqual(
  left:
    Uint8Array,
  right:
    Uint8Array,
) {
  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  let difference =
    0;

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    difference |=
      left[index] ^
      right[index];
  }

  return difference ===
    0;
}

async function hmacSha256(
  secret: string,
  rawBody:
    Uint8Array,
) {
  const key =
    await crypto.subtle
      .importKey(
        "raw",
        new TextEncoder()
          .encode(
            secret,
          ),
        {
          name:
            "HMAC",

          hash:
            "SHA-256",
        },
        false,
        [
          "sign",
        ],
      );

  const digest =
    await crypto.subtle
      .sign(
        "HMAC",
        key,
        rawBody,
      );

  return new Uint8Array(
    digest,
  );
}

function normalizedType(
  value: string,
) {
  return value
    .replace(
      /\.(truncated|transformed)$/,
      "",
    );
}

Deno.serve(
  async (
    request: Request,
  ) => {
    const url =
      new URL(
        request.url,
      );

    if (
      request.method ===
      "GET"
    ) {
      const challenge =
        url.searchParams
          .get(
            "challenge",
          );

      if (
        challenge ===
        null
      ) {
        return textResponse(
          "Missing challenge.",
          400,
        );
      }

      return textResponse(
        challenge,
        200,
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return textResponse(
        "Method not allowed.",
        405,
      );
    }

    const contentEncoding =
      (
        request.headers
          .get(
            "content-encoding",
          ) ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      contentEncoding &&
      contentEncoding !==
        "identity"
    ) {
      return textResponse(
        "Compressed webhook delivery is not enabled for this endpoint.",
        415,
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    const webhookSecret =
      Deno.env.get(
        "NYLAS_WEBHOOK_SECRET",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !webhookSecret
    ) {
      return textResponse(
        "Webhook configuration incomplete.",
        503,
      );
    }

    const signatureText =
      (
        request.headers.get(
          "x-nylas-signature",
        ) ||
        ""
      )
        .trim();

    const signature =
      hexToBytes(
        signatureText,
      );

    if (
      !signature
    ) {
      return textResponse(
        "Invalid signature.",
        401,
      );
    }

    const rawBody =
      new Uint8Array(
        await request
          .arrayBuffer(),
      );

    const expected =
      await hmacSha256(
        webhookSecret,
        rawBody,
      );

    if (
      !constantTimeEqual(
        expected,
        signature,
      )
    ) {
      return textResponse(
        "Invalid signature.",
        401,
      );
    }

    let payload:
      Record<
        string,
        unknown
      >;

    try {
      payload =
        JSON.parse(
          new TextDecoder()
            .decode(
              rawBody,
            ),
        );
    } catch {
      return textResponse(
        "Invalid payload.",
        400,
      );
    }

    const eventType =
      String(
        payload.type ||
        "",
      );

    const baseType =
      normalizedType(
        eventType,
      );

    const supported =
      new Set([
        "message.created",
        "message.updated",
        "message.deleted",
        "message.send_success",
        "message.send_failed",
        "folder.created",
        "folder.updated",
        "folder.deleted",
        "grant.updated",
        "grant.expired",
        "grant.deleted",
      ]);

    if (
      !supported.has(
        baseType,
      )
    ) {
      return textResponse(
        "Ignored.",
        200,
      );
    }

    const data =
      (
        payload.data ||
        {}
      ) as Record<
        string,
        unknown
      >;

    const object =
      (
        data.object ||
        {}
      ) as Record<
        string,
        unknown
      >;

    const grantId =
      String(
        object.grant_id ||
        "",
      ).trim();

    if (
      !grantId
    ) {
      return textResponse(
        "Ignored.",
        200,
      );
    }

    const webhookId =
      String(
        payload.id ||
        "",
      ).trim();

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
      error,
    } =
      await adminClient.rpc(
        "touch_email_runtime_connection",
        {
          target_provider_grant_id:
            grantId,

          target_event_type:
            eventType,

          target_event_id:
            webhookId,
        },
      );

    if (
      error
    ) {
      // A valid Nylas event for a
      // grant not connected to this
      // Campaign Seat environment
      // is safe to ignore.
      return textResponse(
        "Ignored.",
        200,
      );
    }

    return textResponse(
      "OK",
      200,
    );
  },
);
