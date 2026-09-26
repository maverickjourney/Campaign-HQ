import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const stripe = new Stripe("sk_test_placeholder", {
  apiVersion: "2024-11-20",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAdminKey() {
  const namedKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (namedKeysRaw) {
    try {
      const namedKeys = JSON.parse(namedKeysRaw);
      if (namedKeys?.default) return namedKeys.default as string;
    } catch (error) {
      console.error("Unable to parse SUPABASE_SECRET_KEYS", error);
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const webhookSecrets = [
    Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET"),
    Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET_TEST"),
  ].filter(Boolean) as string[];

  if (webhookSecrets.length === 0) {
    console.error("No Stripe webhook signing secret is configured");
    return json({ error: "webhook_not_configured" }, 503);
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return json({ error: "missing_stripe_signature" }, 400);
  }

  const body = await req.text();

  let event: Stripe.Event | null = null;
  for (const secret of webhookSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        secret,
        undefined,
        cryptoProvider,
      );
      break;
    } catch {
      // Try the next configured signing secret.
    }
  }

  if (!event) {
    console.error("Stripe signature verification failed for all configured secrets");
    return json({ error: "invalid_signature" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true, ignored: true, event_type: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const expectedPaymentLink = event.livemode
    ? (Deno.env.get("STRIPE_CAMPAIGN_SEAT_PAYMENT_LINK_ID") ||
      "plink_1UItEq2NOWrEval3e2sY8tms")
    : null;

  const acceptedTestPaymentLinks = new Set(
    [
      Deno.env.get("STRIPE_CAMPAIGN_SEAT_TEST_PAYMENT_LINK_ID"),
      "plink_1UItwq2NOWrEval3B27a0f0u",
    ].filter(Boolean) as string[],
  );

  const sessionPaymentLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id ?? null;

  if (
    event.livemode &&
    (!expectedPaymentLink || !sessionPaymentLink || sessionPaymentLink !== expectedPaymentLink)
  ) {
    return json({
      received: true,
      ignored: true,
      reason: "not_campaign_seat_payment_link",
    });
  }

  if (
    !event.livemode &&
    (!sessionPaymentLink || !acceptedTestPaymentLinks.has(sessionPaymentLink))
  ) {
    return json({
      received: true,
      ignored: true,
      reason: "not_campaign_seat_test_payment_link",
    });
  }

  if (session.mode !== "subscription") {
    return json({
      received: true,
      ignored: true,
      reason: "not_subscription_checkout",
    });
  }

  const email =
    session.customer_details?.email ||
    session.customer_email ||
    null;

  if (!email) {
    console.error("Campaign Seat checkout completed without a customer email", {
      event_id: event.id,
      session_id: session.id,
    });
    return json({ error: "customer_email_required" }, 422);
  }

  const customFields = (session.custom_fields || []) as Array<any>;
  const campaignField = customFields.find((field) => {
    const key = String(field?.key || "").toLowerCase();
    const label = String(field?.label?.custom || "").toLowerCase();
    return key.includes("campaign") || label.includes("campaign") || label.includes("committee");
  });

  const campaignName =
    campaignField?.text?.value ||
    session.customer_details?.name ||
    `Campaign Seat customer — ${email}`;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = getAdminKey();

  if (!supabaseUrl || !adminKey) {
    console.error("Supabase admin credentials are unavailable in the Edge Function runtime");
    return json({ error: "backend_not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc(
    "record_campaign_seat_stripe_checkout",
    {
      target_event_id: event.id,
      target_checkout_session_id: session.id,
      target_customer_id: customerId,
      target_subscription_id: subscriptionId,
      target_email: email,
      target_campaign_name: campaignName,
      target_payload: {
        stripe_event_created: event.created,
        stripe_livemode: event.livemode,
        stripe_payment_link_id: sessionPaymentLink,
        stripe_payment_status: session.payment_status,
        stripe_customer_name: session.customer_details?.name ?? null,
        stripe_customer_phone: session.customer_details?.phone ?? null,
        stripe_customer_address: session.customer_details?.address ?? null,
      },
    },
  );

  if (error) {
    console.error("Failed to queue Campaign Seat provisioning", error);
    return json({ error: "provisioning_queue_failed" }, 500);
  }

  console.log("Campaign Seat checkout queued", {
    event_id: event.id,
    session_id: session.id,
    provisioning_request_id: data,
  });

  const { data: provisioned, error: provisionError } = await supabase.rpc(
    "provision_campaign_seat_stripe_request",
    { target_request_id: data },
  );

  if (provisionError) {
    console.error("Campaign Seat automatic provisioning failed", {
      event_id: event.id,
      session_id: session.id,
      provisioning_request_id: data,
      error: provisionError,
    });
    return json({ error: "automatic_provisioning_failed" }, 500);
  }

  console.log("Campaign Seat automatically provisioned", {
    event_id: event.id,
    session_id: session.id,
    provisioning_request_id: data,
    result: provisioned,
  });

  const { data: onboarding, error: onboardingError } = await supabase.rpc(
    "prepare_campaign_seat_stripe_onboarding_invitation",
    {
      target_request_id: data,
      expires_in_hours: 168,
    },
  );

  if (onboardingError) {
    console.error("Campaign Seat onboarding invitation preparation failed", {
      event_id: event.id,
      provisioning_request_id: data,
      error: onboardingError,
    });
    return json({ error: "onboarding_invitation_prepare_failed" }, 500);
  }

  if (onboarding?.email_sent === true) {
    return json({
      received: true,
      provisioning_request_id: data,
      provisioned,
      onboarding_email: "already_sent",
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return json({ error: "onboarding_email_not_configured" }, 503);
  }

  const publicSiteUrl =
    (Deno.env.get("CAMPAIGN_SEAT_PUBLIC_URL") || "https://campaignseat.com")
      .replace(/\/+$/, "");
  const appUrl =
    (Deno.env.get("CAMPAIGN_SEAT_APP_URL") || "https://app.campaignseat.com")
      .replace(/\/+$/, "");
  const fromEmail =
    Deno.env.get("CAMPAIGN_SEAT_INVITATION_FROM") ||
    "Campaign Seat Invitations <invites@mail.campaignseat.com>";

  const recipient = clean(onboarding?.email || email).toLowerCase();
  const accountName = clean(onboarding?.account_name || campaignName) || "your campaign";
  const existingUser = onboarding?.existing_user === true;
  const inviteToken = clean(onboarding?.invitation_token);

  if (!recipient) {
    return json({ error: "onboarding_recipient_missing" }, 500);
  }

  if (!existingUser && !/^[a-f0-9]{64}$/i.test(inviteToken)) {
    console.error("Prepared onboarding invitation did not include a valid token", {
      provisioning_request_id: data,
      invitation_id: onboarding?.invitation_id ?? null,
    });
    return json({ error: "onboarding_token_missing" }, 500);
  }

  const onboardingLink = existingUser
    ? appUrl
    : `${publicSiteUrl}/onboarding?token=${encodeURIComponent(inviteToken)}`;

  const safeAccount = escapeHtml(accountName);
  const safeLink = escapeHtml(onboardingLink);

  const subject = existingUser
    ? `Campaign Seat access is ready for ${accountName}`
    : `Set up your Campaign Seat account for ${accountName}`;

  const textBody = existingUser
    ? [
        `Your Campaign Seat Founding Pilot subscription for ${accountName} is active.`,
        "",
        "Your Campaign HQ workspace is ready.",
        "Sign in to continue setup:",
        onboardingLink,
        "",
        "Campaign Seat",
      ].join("\n")
    : [
        `Welcome to Campaign Seat. Your Founding Pilot subscription for ${accountName} is active.`,
        "",
        "Your Campaign HQ workspace has been prepared.",
        "Create your secure Campaign Seat account using this one-time link:",
        onboardingLink,
        "",
        "This link expires in 7 days and should not be forwarded.",
        "",
        "Campaign Seat",
      ].join("\n");

  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f6f8">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
          <tr><td style="padding:24px 30px;background:#0f1720;color:#fff">
            <div style="font-size:24px;font-weight:800">CAMPAIGN SEAT</div>
            <div style="margin-top:4px;font-size:12px;letter-spacing:2px;color:#cbd5e1">CAMPAIGN HQ</div>
          </td></tr>
          <tr><td style="padding:32px 30px">
            <div style="font-size:13px;font-weight:800;letter-spacing:1.5px;color:#d14b2a;text-transform:uppercase">Founding Pilot active</div>
            <h1 style="margin:12px 0 14px;font-size:28px;line-height:1.2;color:#0f1720">
              ${existingUser ? "Your Campaign HQ access is ready." : "Create your Campaign Seat account."}
            </h1>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#52606d">
              Your $149/month Campaign Seat subscription for <strong>${safeAccount}</strong> is active and the Campaign HQ workspace has been prepared.
            </p>
            <a href="${safeLink}" style="display:inline-block;padding:14px 22px;background:#d14b2a;color:#fff;text-decoration:none;font-weight:800;border-radius:8px">
              ${existingUser ? "Sign in to Campaign HQ" : "Create secure account"}
            </a>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#718096">
              ${existingUser
                ? "Use your existing Campaign Seat account to continue setup."
                : "This one-time account setup link expires in 7 days. Do not forward it."}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const invitationId = clean(onboarding?.invitation_id);
  const idempotencyKey =
    `campaign-seat-paid-onboarding-${invitationId || data}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "User-Agent": "Campaign-Seat-Stripe-Onboarding/1.0",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
      subject,
      html: htmlBody,
      text: textBody,
    }),
  });

  const resendPayload = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    console.error("Campaign Seat paid onboarding email failed", {
      provisioning_request_id: data,
      invitation_id: invitationId || null,
      status: resendResponse.status,
      provider_error: resendPayload,
    });
    return json({ error: "onboarding_email_failed" }, 502);
  }

  const providerMessageId = clean(resendPayload?.id);

  if (invitationId) {
    const { error: markError } = await supabase.rpc(
      "mark_campaign_seat_onboarding_email_sent",
      {
        target_request_id: data,
        target_invitation_id: invitationId,
        target_provider_message_id: providerMessageId || null,
      },
    );

    if (markError) {
      console.error("Campaign Seat onboarding email delivery could not be marked", {
        provisioning_request_id: data,
        invitation_id: invitationId,
        error: markError,
      });
      return json({ error: "onboarding_email_state_failed" }, 500);
    }
  }

  console.log("Campaign Seat paid onboarding email sent", {
    provisioning_request_id: data,
    invitation_id: invitationId || null,
    recipient,
    existing_user: existingUser,
    provider_message_id: providerMessageId || null,
  });

  return json({
    received: true,
    provisioning_request_id: data,
    provisioned,
    onboarding_email: "sent",
    onboarding_existing_user: existingUser,
  });
});
