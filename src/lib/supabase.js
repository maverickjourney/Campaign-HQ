import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase environment variables are missing. Check .env.local.",
  );
}

const isInstalledCampaignApp =
  window.matchMedia?.(
    "(display-mode: standalone)",
  )?.matches ||
  window.navigator.standalone ===
    true;

const authStorageKey =
  isInstalledCampaignApp
    ? "campaign-hq-auth-installed-app"
    : "campaign-hq-auth-browser";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storageKey:
        authStorageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
