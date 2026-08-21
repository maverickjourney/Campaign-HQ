import { createClient } from "npm:@supabase/supabase-js@2";

import {
  clean,
  parseForm,
  textResponse,
  validTwilioSignature,
} from "../_shared/twilio-platform.ts";

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
  const canonicalUrl = `${supabaseUrl}/functions/v1/twilio-status`;

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
  const status = clean(params.get("MessageStatus")) || clean(params.get("SmsStatus"));

  if (!messageSid || !status) {
    return textResponse("Invalid status payload.", 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await admin
    .from("platform_sms_messages")
    .update({
      status,
      error_code: clean(params.get("ErrorCode")) || null,
      error_message: clean(params.get("ErrorMessage")) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("twilio_message_sid", messageSid);

  if (error) {
    console.error("Twilio delivery status update failed.", error);
    return textResponse("Status storage failed.", 500);
  }

  return new Response(null, { status: 204 });
});
