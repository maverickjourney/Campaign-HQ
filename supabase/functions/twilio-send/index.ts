import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://campaignseat.com",
  "https://www.campaignseat.com",
  "http://127.0.0.1:5180",
  "http://localhost:5180",
]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  request: Request,
  status: number,
  payload: Record<string, unknown>,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, 405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !accountSid ||
    !apiKeySid ||
    !apiKeySecret ||
    !messagingServiceSid
  ) {
    return jsonResponse(request, 503, {
      error: "SMS configuration is incomplete.",
    });
  }

  const authorization = clean(request.headers.get("authorization"));

  if (!authorization) {
    return jsonResponse(request, 401, {
      error: "Authentication is required.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    return jsonResponse(request, 401, {
      error: "The Campaign Seat session is invalid.",
    });
  }

  let payload: Record<string, unknown> = {};

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, 400, {
      error: "A JSON request body is required.",
    });
  }

  const body = clean(payload.body);

  if (!body) {
    return jsonResponse(request, 400, { error: "Enter a message." });
  }

  if (body.length > 1500) {
    return jsonResponse(request, 400, {
      error: "The SMS message is too long.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: subscription, error: subscriptionError } = await admin
    .from("platform_sms_subscriptions")
    .select("user_id,phone_e164,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscriptionError) {
    return jsonResponse(request, 500, {
      error: "Campaign Seat could not load your SMS preference.",
    });
  }

  if (!subscription || subscription.status !== "active") {
    return jsonResponse(request, 409, {
      error: "SMS notifications are not currently enabled for this account.",
    });
  }

  const twilioBody = new URLSearchParams();
  twilioBody.set("To", subscription.phone_e164);
  twilioBody.set("MessagingServiceSid", messagingServiceSid);
  twilioBody.set("Body", body);

  const twilioResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    },
  );

  const twilioResult = await twilioResponse
    .json()
    .catch(() => ({})) as Record<string, unknown>;

  if (!twilioResponse.ok) {
    console.error("Twilio message send failed.", twilioResult);

    return jsonResponse(request, 502, {
      error: clean(twilioResult.message) || "Twilio could not send the message.",
      code: clean(twilioResult.code) || null,
    });
  }

  const messageSid = clean(twilioResult.sid);
  const status = clean(twilioResult.status) || "queued";

  if (!messageSid) {
    return jsonResponse(request, 502, {
      error: "Twilio did not return a message identifier.",
    });
  }

  const { error: insertError } = await admin
    .from("platform_sms_messages")
    .upsert(
      {
        user_id: user.id,
        direction: "outbound",
        channel: "sms",
        twilio_message_sid: messageSid,
        messaging_service_sid: messagingServiceSid,
        from_number: clean(twilioResult.from) || null,
        to_number: subscription.phone_e164,
        body,
        status,
        error_code: clean(twilioResult.error_code) || null,
        error_message: clean(twilioResult.error_message) || null,
        num_media: 0,
        media: [],
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "twilio_message_sid",
      },
    );

  if (insertError) {
    console.error("Campaign Seat SMS message log failed.", insertError);
  }

  await admin
    .from("platform_sms_subscriptions")
    .update({
      last_outbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return jsonResponse(request, 200, {
    ok: true,
    messageSid,
    status,
  });
});
