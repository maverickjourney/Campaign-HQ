import { createClient } from "npm:@supabase/supabase-js@2";

import {
  clean,
  parseForm,
  textResponse,
  twimlResponse,
  validTwilioSignature,
} from "../_shared/twilio-platform.ts";

function normalizedKeyword(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return textResponse("Method not allowed.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!supabaseUrl || !serviceRoleKey || !authToken) {
    return textResponse("Webhook configuration incomplete.", 503);
  }

  const rawBody = await request.text();
  const canonicalUrl = `${supabaseUrl}/functions/v1/twilio-inbound`;

  if (
    !await validTwilioSignature(
      request,
      rawBody,
      authToken,
      canonicalUrl,
    )
  ) {
    return textResponse("Invalid signature.", 401);
  }

  const params = parseForm(rawBody);

  const messageSid = clean(params.get("MessageSid"));
  const fromNumber = clean(params.get("From"));
  const toNumber = clean(params.get("To"));
  const body = clean(params.get("Body"));
  const optOutType = clean(params.get("OptOutType"));
  const messagingServiceSid = clean(params.get("MessagingServiceSid"));
  const numMedia = Math.max(
    0,
    Math.min(
      10,
      Number.parseInt(clean(params.get("NumMedia")) || "0", 10) || 0,
    ),
  );

  if (!messageSid || !fromNumber) {
    return textResponse("Invalid message payload.", 400);
  }

  const media: Array<Record<string, string>> = [];

  for (let index = 0; index < numMedia; index += 1) {
    const url = clean(params.get(`MediaUrl${index}`));
    const contentType = clean(params.get(`MediaContentType${index}`));

    if (url) {
      media.push({
        url,
        ...(contentType ? { contentType } : {}),
      });
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: subscription } = await admin
    .from("platform_sms_subscriptions")
    .select("user_id,phone_e164,status")
    .eq("phone_e164", fromNumber)
    .maybeSingle();

  const userId = subscription?.user_id || null;
  const channel = numMedia > 0 ? "mms" : "sms";

  const { error: messageError } = await admin
    .from("platform_sms_messages")
    .upsert(
      {
        user_id: userId,
        direction: "inbound",
        channel,
        twilio_message_sid: messageSid,
        messaging_service_sid: messagingServiceSid || null,
        from_number: fromNumber,
        to_number: toNumber || null,
        body: body || null,
        status: "received",
        opt_out_type: optOutType || null,
        num_media: numMedia,
        media,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "twilio_message_sid",
      },
    );

  if (messageError) {
    console.error("Twilio inbound message insert failed.", messageError);
    return textResponse("Message storage failed.", 500);
  }

  if (userId) {
    await admin
      .from("platform_sms_subscriptions")
      .update({
        last_inbound_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  const keyword = normalizedKeyword(body);
  const normalizedOptOut = optOutType.toUpperCase();

  const isStop =
    normalizedOptOut === "STOP" ||
    ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(
      keyword,
    );

  const isStart =
    normalizedOptOut === "START" ||
    ["START", "UNSTOP", "YES"].includes(keyword);

  const isHelp =
    normalizedOptOut === "HELP" ||
    keyword === "HELP";

  if (userId && isStop) {
    await admin
      .from("platform_sms_subscriptions")
      .update({
        status: "opted_out",
        opted_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await admin.from("platform_sms_consent_events").insert({
      user_id: userId,
      phone_e164: fromNumber,
      event_type: "opt_out",
      source: "twilio_keyword",
      disclosure_version: "2026-08-20",
      twilio_message_sid: messageSid,
    });
  } else if (userId && isStart) {
    await admin
      .from("platform_sms_subscriptions")
      .update({
        status: "active",
        consent_source: "twilio_keyword",
        consented_at: new Date().toISOString(),
        opted_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await admin.from("platform_sms_consent_events").insert({
      user_id: userId,
      phone_e164: fromNumber,
      event_type: "opt_in",
      source: "twilio_keyword",
      disclosure_version: "2026-08-20",
      twilio_message_sid: messageSid,
    });
  } else if (userId && isHelp) {
    await admin.from("platform_sms_consent_events").insert({
      user_id: userId,
      phone_e164: fromNumber,
      event_type: "help",
      source: "twilio_keyword",
      disclosure_version: "2026-08-20",
      twilio_message_sid: messageSid,
    });
  }

  return twimlResponse();
});
