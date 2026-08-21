import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

const DEFAULT_PREFERENCES = {
  campaignUpdates: false,
  taskReminders: false,
  approvals: false,
  fieldAlerts: false,
  weeklySummary: false,
};

const FIELD_TO_CATEGORY = {
  campaignUpdates:
    "campaign_updates",
  taskReminders:
    "task_reminders",
  approvals:
    "approvals",
  fieldAlerts:
    "field_alerts",
  weeklySummary:
    "weekly_summary",
};

function fromServer(
  value,
) {
  return {
    campaignUpdates:
      Boolean(
        value
          ?.campaign_updates,
      ),

    taskReminders:
      Boolean(
        value
          ?.task_reminders,
      ),

    approvals:
      Boolean(
        value
          ?.approvals,
      ),

    fieldAlerts:
      Boolean(
        value
          ?.field_alerts,
      ),

    weeklySummary:
      Boolean(
        value
          ?.weekly_summary,
      ),
  };
}

export function usePlatformNotificationPreferences({
  userId,
}) {
  const [
    preferences,
    setPreferences,
  ] =
    useState(
      DEFAULT_PREFERENCES,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const refresh =
    useCallback(
      async () => {
        if (!userId) {
          setPreferences(
            DEFAULT_PREFERENCES,
          );

          setIsLoading(
            false,
          );

          return DEFAULT_PREFERENCES;
        }

        setIsLoading(
          true,
        );

        try {
          const {
            data,
            error:
              loadError,
          } =
            await supabase.rpc(
              "get_platform_notification_preferences",
            );

          if (
            loadError
          ) {
            throw loadError;
          }

          const next =
            fromServer(
              data,
            );

          setPreferences(
            next,
          );

          setError(
            "",
          );

          return next;
        } catch (
          loadError
        ) {
          setError(
            loadError
              ?.message ||
              "Campaign Seat could not load notification preferences.",
          );

          return null;
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        userId,
      ],
    );

  useEffect(
    () => {
      void refresh();
    },
    [
      refresh,
    ],
  );

  const updatePreference =
    useCallback(
      async (
        field,
        enabled,
      ) => {
        const category =
          FIELD_TO_CATEGORY[
            field
          ];

        if (
          !category
        ) {
          throw new Error(
            "Unsupported notification preference.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          "",
        );

        try {
          const {
            error:
              saveError,
          } =
            await supabase.rpc(
              "set_platform_notification_preference",
              {
                target_category:
                  category,

                target_enabled:
                  Boolean(
                    enabled,
                  ),
              },
            );

          if (
            saveError
          ) {
            throw saveError;
          }

          setPreferences(
            (
              current,
            ) => ({
              ...current,

              [field]:
                Boolean(
                  enabled,
                ),
            }),
          );

          return {
            field,
            enabled:
              Boolean(
                enabled,
              ),
          };
        } catch (
          saveError
        ) {
          setError(
            saveError
              ?.message ||
              "Campaign Seat could not save the notification preference.",
          );

          throw saveError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [],
    );

  return {
    preferences,
    isLoading,
    isSaving,
    error,
    refresh,
    updatePreference,
  };
}
