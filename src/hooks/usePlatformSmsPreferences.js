import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

export function usePlatformSmsPreferences({
  userId,
}) {
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async () => {
      if (!userId) {
        setSubscription(null);
        setIsLoading(false);
        return null;
      }

      setIsLoading(true);

      try {
        const { data, error: loadError } =
          await supabase
            .from("platform_sms_subscriptions")
            .select(
              "user_id,phone_e164,status,consent_source,consented_at,opted_out_at,last_inbound_at,last_outbound_at,updated_at",
            )
            .eq("user_id", userId)
            .maybeSingle();

        if (loadError) {
          throw loadError;
        }

        setSubscription(data || null);
        setError("");
        return data || null;
      } catch (loadError) {
        setError(
          loadError?.message ||
            "Campaign Seat could not load SMS preferences.",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPreference = useCallback(
    async ({
      phoneE164,
      consented,
      source = "campaign_seat_settings",
    }) => {
      const { data, error: preferenceError } =
        await supabase.rpc(
          "set_platform_sms_preference",
          {
            target_phone_e164: phoneE164 || "",
            target_consented: Boolean(consented),
            target_source: source,
          },
        );

      if (preferenceError) {
        throw preferenceError;
      }

      await refresh();
      return data;
    },
    [refresh],
  );

  const sendTestMessage = useCallback(
    async (body) => {
      const { data, error: functionError } =
        await supabase.functions.invoke(
          "twilio-send",
          {
            body: {
              body,
            },
          },
        );

      if (functionError) {
        throw functionError;
      }

      return data;
    },
    [],
  );

  return {
    subscription,
    isLoading,
    error,
    refresh,
    setPreference,
    sendTestMessage,
  };
}
