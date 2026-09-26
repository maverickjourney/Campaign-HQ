import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const ALLOWED_ORIGINS = new Set([
  "https://campaignseat.com",
  "https://www.campaignseat.com",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://campaignseat.com";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
    },
  });
}

function getAdminKey() {
  const namedKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (namedKeysRaw) {
    try {
      const namedKeys = JSON.parse(namedKeysRaw);
      if (namedKeys?.default) return namedKeys.default as string;
    } catch {
      // Fall through to legacy key.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function strongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = getAdminKey();

  if (!supabaseUrl || !adminKey) {
    console.error("Campaign Seat onboarding admin credentials are unavailable");
    return json(req, { error: "backend_not_configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const token = clean(body.token);
  const password = clean(body.password);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return json(req, { error: "invalid_invitation" }, 400);
  }

  if (!strongPassword(password)) {
    return json(req, {
      error: "weak_password",
      message:
        "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.",
    }, 400);
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: invitation, error: invitationError } = await supabase.rpc(
    "get_seat_onboarding_invitation_by_token",
    { target_token: token },
  );

  if (invitationError) {
    console.error("Paid onboarding invitation lookup failed", invitationError);
    return json(req, { error: "invitation_lookup_failed" }, 500);
  }

  if (!invitation?.found) {
    return json(req, {
      error: invitation?.expired ? "invitation_expired" : "invitation_unavailable",
      used: Boolean(invitation?.used),
      expired: Boolean(invitation?.expired),
    }, invitation?.expired ? 410 : 409);
  }

  if (invitation.source !== "stripe") {
    return json(req, { error: "invalid_invitation_source" }, 403);
  }

  const email = clean(invitation.email).toLowerCase();
  const invitationHash = await sha256Hex(token);

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        seat_onboarding_invitation_hash: invitationHash,
        campaign_seat_onboarding_source: "stripe",
      },
    });

  if (createError || !created?.user) {
    const message = clean(createError?.message).toLowerCase();

    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      return json(req, {
        error: "account_already_exists",
        email,
        sign_in_url: "https://app.campaignseat.com",
      }, 409);
    }

    console.error("Paid Campaign Seat account creation failed", createError);
    return json(req, { error: "account_creation_failed" }, 500);
  }

  console.log("Paid Campaign Seat account created", {
    user_id: created.user.id,
    email,
  });

  return json(req, {
    ok: true,
    email,
    user_id: created.user.id,
    account_name: invitation.account_name,
    app_url: "https://app.campaignseat.com",
  });
});
