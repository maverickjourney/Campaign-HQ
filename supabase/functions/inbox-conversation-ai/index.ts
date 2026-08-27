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


const MAX_TRANSCRIPT_CHARACTERS =
  28000;


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
  payload:
    Record<
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


function boundedText(
  value: unknown,
  maximum: number,
) {
  const text =
    clean(value);

  if (
    text.length <=
    maximum
  ) {
    return text;
  }

  return text.slice(
    0,
    maximum,
  );
}


function extractResponseText(
  payload:
    Record<
      string,
      unknown
    >,
) {
  if (
    typeof payload
      .output_text ===
      "string" &&
    payload
      .output_text
      .trim()
  ) {
    return payload
      .output_text
      .trim();
  }

  const output =
    Array.isArray(
      payload.output,
    )
      ? payload.output
      : [];

  const parts:
    string[] = [];

  for (
    const item
    of output
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const content =
      Array.isArray(
        (
          item as
            Record<
              string,
              unknown
            >
        ).content,
      )
        ? (
            (
              item as
                Record<
                  string,
                  unknown
                >
            ).content as
              unknown[]
          )
        : [];

    for (
      const part
      of content
    ) {
      if (
        !part ||
        typeof part !==
          "object"
      ) {
        continue;
      }

      const record =
        part as
          Record<
            string,
            unknown
          >;

      if (
        record.type ===
          "output_text" &&
        typeof record.text ===
          "string"
      ) {
        parts.push(
          record.text,
        );
      }
    }
  }

  return parts
    .join(
      "\n",
    )
    .trim();
}


function parseBrief(
  value: string,
) {
  let text =
    clean(value);

  text =
    text.replace(
      /^```(?:json)?\s*/i,
      "",
    );

  text =
    text.replace(
      /\s*```$/,
      "",
    );

  let parsed:
    Record<
      string,
      unknown
    >;

  try {
    parsed =
      JSON.parse(
        text,
      );
  } catch {
    const firstBrace =
      text.indexOf(
        "{",
      );

    const lastBrace =
      text.lastIndexOf(
        "}",
      );

    if (
      firstBrace < 0 ||
      lastBrace <=
        firstBrace
    ) {
      throw new Error(
        "The AI provider returned an unreadable brief.",
      );
    }

    parsed =
      JSON.parse(
        text.slice(
          firstBrace,
          lastBrace + 1,
        ),
      );
  }

  const allowedUrgency =
    new Set([
      "low",
      "normal",
      "high",
      "critical",
    ]);

  const urgency =
    clean(
      parsed.urgency,
    )
      .toLowerCase();

  return {
    summary:
      boundedText(
        parsed.summary,
        1200,
      ) ||
      "No summary available.",

    request:
      boundedText(
        parsed.request,
        1000,
      ) ||
      "No explicit request identified.",

    urgency:
      allowedUrgency.has(
        urgency,
      )
        ? urgency
        : "normal",

    last_commitment:
      boundedText(
        parsed.last_commitment,
        1000,
      ) ||
      "No explicit campaign commitment found.",

    recommended_action:
      boundedText(
        parsed.recommended_action,
        1000,
      ) ||
      "Review the conversation and determine the next action.",

    draft_reply:
      boundedText(
        parsed.draft_reply,
        5000,
      ),

    draft_blocked_reason:
      boundedText(
        parsed.draft_blocked_reason,
        1200,
      ),
  };
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
          status:
            204,

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
            "A valid conversation request is required.",
        },
      );
    }

    const workspaceId =
      clean(
        body.workspaceId,
      );

    const conversation =
      (
        body.conversation &&
        typeof body
          .conversation ===
          "object"
      )
        ? body
            .conversation as
              Record<
                string,
                unknown
              >
        : {};

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
      return jsonResponse(
        request,
        500,
        {
          error:
            "Campaign Seat server configuration is incomplete.",
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
      await userClient
        .rpc(
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
            "You do not have permission to analyze Inbox conversations.",
        },
      );
    }

    const messages =
      Array.isArray(
        conversation.messages,
      )
        ? conversation.messages
        : [];

    if (
      !messages.length
    ) {
      return jsonResponse(
        request,
        409,
        {
          error:
            "Open the conversation before generating a Campaign Seat Brief.",
        },
      );
    }

    const safeMessages =
      messages
        .slice(
          -24,
        )
        .map(
          (
            item,
            index,
          ) => {
            const message =
              (
                item &&
                typeof item ===
                  "object"
              )
                ? item as
                    Record<
                      string,
                      unknown
                    >
                : {};

            return {
              number:
                index + 1,

              direction:
                boundedText(
                  message.direction,
                  40,
                ),

              author:
                boundedText(
                  message.author,
                  180,
                ),

              channel:
                boundedText(
                  message.channel,
                  80,
                ),

              time:
                boundedText(
                  message.time,
                  120,
                ),

              body:
                boundedText(
                  message.body,
                  3500,
                ),
            };
          },
        );

    const safeConversation = {
      sender:
        boundedText(
          conversation.sender,
          240,
        ),

      email:
        boundedText(
          conversation.email,
          320,
        ),

      channel:
        boundedText(
          conversation.channel,
          80,
        ),

      subject:
        boundedText(
          conversation.subject,
          998,
        ),

      contact:
        (
          conversation.contact &&
          typeof conversation
            .contact ===
            "object"
        )
          ? conversation.contact
          : null,

      workflow:
        (
          conversation.workflow &&
          typeof conversation
            .workflow ===
            "object"
        )
          ? conversation.workflow
          : null,

      messages:
        safeMessages,
    };

    let serialized =
      JSON.stringify(
        safeConversation,
      );

    if (
      serialized.length >
      MAX_TRANSCRIPT_CHARACTERS
    ) {
      serialized =
        serialized.slice(
          0,
          MAX_TRANSCRIPT_CHARACTERS,
        );
    }

    const openaiApiKey =
      Deno.env.get(
        "OPENAI_API_KEY",
      );

    if (
      !openaiApiKey
    ) {
      return jsonResponse(
        request,
        503,
        {
          error:
            "Campaign Seat AI is not configured yet.",
        },
      );
    }

    const model =
      clean(
        Deno.env.get(
          "CAMPAIGN_AI_MODEL",
        ),
      ) ||
      "gpt-5.6";

    const instructions = `
You are Campaign Seat Brief, an operational Inbox assistant for authorized campaign staff.

Analyze ONLY the conversation and context supplied by Campaign Seat.
Do not invent facts, deadlines, promises, names, positions, or campaign commitments.
If something is not present, explicitly say it was not found.

Return VALID JSON ONLY with exactly these keys:
summary
request
urgency
last_commitment
recommended_action
draft_reply
draft_blocked_reason

Definitions:
- summary: 1-3 concise sentences explaining the conversation.
- request: what the sender is asking the campaign to do. If no explicit request exists, say "No explicit request identified."
- urgency: exactly one of low, normal, high, critical.
- last_commitment: the latest explicit commitment or promise made by the campaign in an outbound message. If none exists, say "No explicit campaign commitment found."
- recommended_action: one concise operational next step.
- draft_reply: a concise draft response ONLY when an administrative, logistical, customer-service, scheduling, acknowledgement, or other non-persuasive reply is appropriate.
- draft_blocked_reason: explain why draft_reply is empty, if applicable.

Safety requirements for draft_reply:
- Never create targeted political persuasion.
- Never tailor ideological or electoral persuasion to a specific recipient.
- Never create voter-targeted persuasion or a fundraising appeal.
- Never fabricate policy positions, endorsements, facts, promises, deadlines, or commitments.
- If the appropriate reply would require political persuasion, advocacy, fundraising solicitation, or unsupported campaign claims, leave draft_reply empty and explain that manual campaign review is required.
- Never include a signature; Campaign Seat handles the saved signature separately.
- Never imply that the draft has been sent.

Keep all fields concise and useful for campaign operations.
`.trim();

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        30000,
      );

    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method:
              "POST",

            headers: {
              "Authorization":
                `Bearer ${openaiApiKey}`,

              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify({
                model,

                instructions,

                input:
                  serialized,

                max_output_tokens:
                  1400,

                store:
                  false,
              }),
          },
        );
    } catch (
      error
    ) {
      clearTimeout(
        timeout,
      );

      return jsonResponse(
        request,
        504,
        {
          error:
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
              ? "Campaign Seat Brief took too long. Try again."
              : "Campaign Seat could not reach the AI provider.",
        },
      );
    }

    clearTimeout(
      timeout,
    );

    let providerPayload:
      Record<
        string,
        unknown
      > = {};

    try {
      providerPayload =
        await providerResponse
          .json();
    } catch {
      providerPayload =
        {};
    }

    if (
      !providerResponse.ok
    ) {
      return jsonResponse(
        request,
        providerResponse.status ===
          429
          ? 429
          : 502,
        {
          error:
            providerResponse.status ===
              429
              ? "Campaign Seat AI is temporarily busy. Try again shortly."
              : "Campaign Seat could not generate this conversation brief.",
        },
      );
    }

    const responseText =
      extractResponseText(
        providerPayload,
      );

    if (
      !responseText
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            "Campaign Seat AI returned an empty conversation brief.",
        },
      );
    }

    let brief;

    try {
      brief =
        parseBrief(
          responseText,
        );
    } catch (
      parseError
    ) {
      return jsonResponse(
        request,
        502,
        {
          error:
            parseError instanceof
              Error
              ? parseError.message
              : "Campaign Seat could not read the conversation brief.",
        },
      );
    }

    return jsonResponse(
      request,
      200,
      {
        success:
          true,

        brief,

        model,
      },
    );
  },
);
