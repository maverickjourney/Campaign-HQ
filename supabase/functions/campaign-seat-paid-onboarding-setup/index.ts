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
      // fall through
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function validToken(token: string) {
  return /^[a-f0-9]{64}$/i.test(token);
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
    return json(req, { error: "backend_not_configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const token = clean(body.token);
  const action = clean(body.action).toLowerCase();

  if (!validToken(token)) {
    return json(req, { error: "invalid_invitation" }, 400);
  }

  if (!["load", "save", "activate"].includes(action)) {
    return json(req, { error: "invalid_action" }, 400);
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  if (action === "load") {
    const { data, error } = await supabase.rpc(
      "get_campaign_seat_paid_setup_context",
      { target_token: token },
    );

    if (error) {
      console.error("Paid setup context failed", error);
      return json(req, { error: "setup_context_failed" }, 500);
    }

    if (!data?.found) {
      return json(req, {
        error: data?.expired ? "invitation_expired" : "setup_unavailable",
        account_setup_required: Boolean(data?.account_setup_required),
      }, data?.expired ? 410 : 409);
    }

    return json(req, { ok: true, ...data });
  }

  const payload =
    body.payload && typeof body.payload === "object"
      ? body.payload
      : {};

  if (action === "save") {
    const currentStep = clean(body.currentStep) || "campaign_identity";

    const { data, error } = await supabase.rpc(
      "save_campaign_seat_paid_setup_step",
      {
        target_token: token,
        target_payload: payload,
        target_current_step: currentStep,
      },
    );

    if (error) {
      console.error("Paid setup save failed", {
        current_step: currentStep,
        error,
      });
      return json(req, {
        error: "setup_save_failed",
        message: error.message || "Could not save Campaign Seat setup.",
      }, 400);
    }

    return json(req, { ok: true, workspace: data });
  }

  const { data, error } = await supabase.rpc(
    "activate_campaign_seat_paid_setup",
    {
      target_token: token,
      target_payload: payload,
    },
  );

  if (error) {
    console.error("Paid setup activation failed", error);
    return json(req, {
      error: "setup_activation_failed",
      message: error.message || "Could not activate Campaign Seat setup.",
    }, 400);
  }

  return json(req, { ok: true, ...data });
});
