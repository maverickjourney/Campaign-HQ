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

type Recipient = {
  name?: string;
  email: string;
};

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

function validEmail(
  value: string,
) {
  return (
    value.length <=
      320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        value,
      )
  );
}

function normalizeRecipients(
  value: unknown,
): Recipient[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  const seen =
    new Set<string>();

  const recipients:
    Recipient[] = [];

  for (
    const item of value
      .slice(
        0,
        50,
      )
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const row =
      item as Record<
        string,
        unknown
      >;

    const email =
      clean(
        row.email,
      ).toLowerCase();

    const name =
      clean(
        row.name,
      );

    if (
      !validEmail(
        email,
      ) ||
      seen.has(
        email,
      )
    ) {
      continue;
    }

    seen.add(
      email,
    );

    recipients.push({
      email,
      ...(name
        ? {
            name:
              name.slice(
                0,
                200,
              ),
          }
        : {}),
    });
  }

  return recipients;
}

function withoutEmail(
  recipients:
    Recipient[],
  excluded:
    string,
) {
  const normalized =
    excluded
      .trim()
      .toLowerCase();

  return recipients.filter(
    (recipient) =>
      recipient.email
        .toLowerCase() !==
      normalized,
  );
}

function mergeRecipients(
  groups:
    Recipient[][],
  excluded:
    string,
) {
  const seen =
    new Set<string>();

  const result:
    Recipient[] = [];

  for (
    const group of groups
  ) {
    for (
      const recipient
        of withoutEmail(
          group,
          excluded,
        )
    ) {
      const key =
        recipient.email
          .toLowerCase();

      if (
        seen.has(
          key,
        )
      ) {
        continue;
      }

      seen.add(
        key,
      );

      result.push(
        recipient,
      );
    }
  }

  return result;
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

const NYLAS_SEND_TIMEOUT_MS =
  20000;


async function fetchProvider(
  input: string | URL,
  init: RequestInit = {},
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      NYLAS_SEND_TIMEOUT_MS,
    );

  try {
    return await fetch(
      input,
      {
        ...init,
        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
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

    let incomingAttachments:
      File[] = [];

    const requestContentType =
      (
        request.headers.get(
          "content-type",
        ) || ""
      ).toLowerCase();

    if (
      requestContentType
        .includes(
          "multipart/form-data",
        )
    ) {
      let form:
        FormData;

      try {
        form =
          await request
            .formData();
      } catch {
        return jsonResponse(
          request,
          400,
          {
            error:
              "The email attachment upload could not be read.",
          },
        );
      }

      const rawPayload =
        form.get(
          "payload",
        );

      if (
        typeof rawPayload !==
          "string"
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "The email request is missing its message payload.",
          },
        );
      }

      try {
        body =
          JSON.parse(
            rawPayload,
          );
      } catch {
        return jsonResponse(
          request,
          400,
          {
            error:
              "A valid email request is required.",
          },
        );
      }

      incomingAttachments =
        form
          .getAll(
            "attachment",
          )
          .filter(
            (
              item,
            ): item is File =>
              item instanceof File &&
              item.size > 0,
          );
    } else {
      try {
        body =
          await request.json();
      } catch {
        return jsonResponse(
          request,
          400,
          {
            error:
              "A valid email request is required.",
          },
        );
      }
    }

    const workspaceId =
      clean(
        body.workspaceId,
      );

    const mode =
      clean(
        body.mode,
      );

    const messageBody =
      clean(
        body.body,
      );

    const idempotencyKey =
      clean(
        body.idempotencyKey,
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

    if (
      ![
        "compose",
        "reply",
      ].includes(
        mode,
      )
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Choose compose or reply.",
        },
      );
    }

    if (
      !messageBody ||
      messageBody.length >
        200000
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Enter an email message within the supported size.",
        },
      );
    }

    if (
      !idempotencyKey ||
      idempotencyKey.length >
        256
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "A unique send identifier is required.",
        },
      );
    }

    if (
      incomingAttachments.length >
      10
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Attach up to 10 files per email.",
        },
      );
    }

    const attachmentBytes =
      incomingAttachments
        .reduce(
          (
            total,
            attachment,
          ) =>
            total +
            attachment.size,
          0,
        );

    if (
      attachmentBytes >
      20 * 1024 * 1024
    ) {
      return jsonResponse(
        request,
        400,
        {
          error:
            "Attachments can total up to 20 MB per email.",
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

    /*
     * The permission RPC itself is authenticated with the
     * caller's JWT and uses Campaign Seat authorization.
     * A separate auth.getUser() network round-trip here was
     * redundant and added latency to every send.
     *
     * Resolve permission and protected mailbox metadata in
     * parallel before contacting Nylas.
     */
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

    const [
      {
        data:
          canSend,
        error:
          permissionError,
      },
      {
        data:
          connectionData,
        error:
          connectionError,
      },
    ] =
      await Promise.all([
        userClient.rpc(
          "can_send_connected_email",
          {
            target_workspace_id:
              workspaceId,
          },
        ),

        adminClient.rpc(
          "get_email_runtime_connection",
          {
            target_workspace_id:
              workspaceId,
          },
        ),
      ]);

    if (
      permissionError ||
      canSend !==
        true
    ) {
      return jsonResponse(
        request,
        403,
        {
          error:
            "You do not have permission to send from the connected campaign mailbox.",
        },
      );
    }

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
        true ||
      connection
        ?.send_ready !==
        true
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "The campaign mailbox has not completed read/send verification.",
        },
      );
    }

    const connectedEmail =
      clean(
        connection
          .connected_email,
      ).toLowerCase();

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

    const providerHeaders = {
      "Authorization":
        `Bearer ${nylasApiKey}`,

      "Content-Type":
        "application/json",

      "Accept":
        "application/json",
    };

    let sendPayload:
      Record<
        string,
        unknown
      >;

    if (
      mode ===
      "compose"
    ) {
      const subject =
        clean(
          body.subject,
        );

      const to =
        normalizeRecipients(
          body.to,
        );

      const cc =
        normalizeRecipients(
          body.cc,
        );

      const bcc =
        normalizeRecipients(
          body.bcc,
        );

      if (
        !subject ||
        subject.length >
          998
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "Enter a valid email subject.",
          },
        );
      }

      if (
        to.length ===
        0
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "Choose at least one valid email recipient.",
          },
        );
      }

      sendPayload = {
        to,
        cc,
        bcc,
        subject,
        body:
          messageBody,

        is_plaintext:
          true,
      };
    } else {
      const replyToMessageId =
        clean(
          body.replyToMessageId,
        );

      if (
        !replyToMessageId
      ) {
        return jsonResponse(
          request,
          400,
          {
            error:
              "The source email message is required for a reply.",
          },
        );
      }

      let sourceResponse:
        Response;

      try {
        sourceResponse =
          await fetchProvider(
            `${baseUri}/v3/grants/${grant}/messages/${encodeURIComponent(replyToMessageId)}`,
            {
              method:
                "GET",

              headers:
                providerHeaders,
            },
          );
      } catch {
        return jsonResponse(
          request,
          502,
          {
            error:
              "Campaign Seat could not retrieve the source email before replying.",
          },
        );
      }

      if (
        !sourceResponse.ok
      ) {
        return jsonResponse(
          request,
          502,
          {
            error:
              "The source email could not be verified before replying.",
          },
        );
      }

      let sourcePayload:
        Record<
          string,
          unknown
        >;

      try {
        sourcePayload =
          await sourceResponse
            .json();
      } catch {
        return jsonResponse(
          request,
          502,
          {
            error:
              "The source email returned an invalid response.",
          },
        );
      }

      const source =
        (
          sourcePayload.data ||
          {}
        ) as Record<
          string,
          unknown
        >;

      const sourceFrom =
        normalizeRecipients(
          source.from,
        );

      const sourceTo =
        normalizeRecipients(
          source.to,
        );

      const sourceCc =
        normalizeRecipients(
          source.cc,
        );

      const sourceReplyTo =
        normalizeRecipients(
          source.reply_to,
        );

      let to =
        sourceReplyTo.length
          ? withoutEmail(
              sourceReplyTo,
              connectedEmail,
            )
          : withoutEmail(
              sourceFrom,
              connectedEmail,
            );

      if (
        to.length ===
        0
      ) {
        to =
          withoutEmail(
            sourceTo,
            connectedEmail,
          );
      }

      let cc:
        Recipient[] = [];

      if (
        body.replyAll ===
        true
      ) {
        const everybody =
          mergeRecipients(
            [
              sourceFrom,
              sourceTo,
              sourceCc,
            ],
            connectedEmail,
          );

        const primary =
          to[0]
            ?.email
            ?.toLowerCase() ||
          "";

        cc =
          everybody.filter(
            (recipient) =>
              recipient.email
                .toLowerCase() !==
              primary,
          );
      }

      if (
        to.length ===
        0
      ) {
        return jsonResponse(
          request,
          409,
          {
            error:
              "Campaign Seat could not determine a safe reply recipient.",
          },
        );
      }

      const sourceSubject =
        clean(
          source.subject,
        );

      const requestedSubject =
        clean(
          body.subject,
        );

      const subject =
        requestedSubject ||
        (
          /^re:/i.test(
            sourceSubject,
          )
            ? sourceSubject
            : `Re: ${sourceSubject}`
        );

      sendPayload = {
        reply_to_message_id:
          replyToMessageId,

        to,
        cc,
        subject:
          subject.slice(
            0,
            998,
          ),

        body:
          messageBody,

        is_plaintext:
          true,
      };
    }

    let sendResponse:
      Response;

    try {
      if (
        incomingAttachments.length
      ) {
        const providerForm =
          new FormData();

        providerForm.append(
          "message",
          JSON.stringify(
            sendPayload,
          ),
        );

        incomingAttachments
          .forEach(
            (
              attachment,
              index,
            ) => {
              const filename =
                clean(
                  attachment.name,
                ) ||
                `attachment-${index + 1}`;

              providerForm.append(
                filename,
                attachment,
                filename,
              );
            },
          );

        sendResponse =
          await fetchProvider(
            `${baseUri}/v3/grants/${grant}/messages/send?fields=include_basic_headers`,
            {
              method:
                "POST",

              headers: {
                "Authorization":
                  `Bearer ${nylasApiKey}`,

                "Accept":
                  "application/json",

                "Idempotency-Key":
                  idempotencyKey,
              },

              body:
                providerForm,
            },
          );
      } else {
        sendResponse =
          await fetchProvider(
            `${baseUri}/v3/grants/${grant}/messages/send?fields=include_basic_headers`,
            {
              method:
                "POST",

              headers: {
                ...providerHeaders,

                "Idempotency-Key":
                  idempotencyKey,
              },

              body:
                JSON.stringify(
                  sendPayload,
                ),
            },
          );
      }
    } catch {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat could not confirm whether the email provider received the send request. Retry using the same send identifier.",
        },
      );
    }

    let sendResult:
      Record<
        string,
        unknown
      > = {};

    try {
      sendResult =
        await sendResponse
          .json();
    } catch {
      // Keep the generic
      // provider result below.
    }

    if (
      !sendResponse.ok
    ) {
      if (
        sendResponse.status ===
        409
      ) {
        return jsonResponse(
          request,
          409,
          {
            error:
              "This send identifier is already in use. Keep the same identifier only when retrying the exact same email.",
          },
        );
      }

      if (
        sendResponse.status ===
        429
      ) {
        return jsonResponse(
          request,
          429,
          {
            error:
              "Email sending is temporarily rate limited. Retry this same message with the same send identifier.",
          },
        );
      }

      return jsonResponse(
        request,
        502,
        {
          error:
            "The connected email provider did not accept this message.",
        },
      );
    }

    try {
      await Promise.race([
        adminClient.rpc(
          "touch_email_runtime_connection",
          {
            target_provider_grant_id:
              connection
                .grant_reference,

            target_event_type:
              "campaign_seat.send_success",

            target_event_id:
              clean(
                (
                  sendResult.data as
                    | Record<
                        string,
                        unknown
                      >
                    | undefined
                )?.id,
              ),
          },
        ),

        new Promise(
          (resolve) =>
            setTimeout(
              () =>
                resolve(
                  null,
                ),
              1500,
            ),
        ),
      ]);
    } catch (
      touchError
    ) {
      console.warn(
        "Email provider accepted the send, but the runtime metadata touch did not finish:",
        touchError,
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        mode,

        idempotentResponse:
          sendResponse
            .headers
            .get(
              "idempotent-response",
            ) ===
          "true",

        data:
          stripGrantReferences(
            sendResult.data,
          ),
      },
    );
  },
);
