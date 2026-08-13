import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

function errorMessage(
  error,
  fallback,
) {
  return (
    error?.message ||
    fallback
  );
}

export function useEmailContactsOnboarding({
  workspaceId,
}) {
  const [
    workspaceState,
    setWorkspaceState,
  ] = useState(null);

  const [
    communicationsStep,
    setCommunicationsStep,
  ] = useState(null);

  const [
    calendarStep,
    setCalendarStep,
  ] = useState(null);

  const [
    integrations,
    setIntegrations,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isConnecting,
    setIsConnecting,
  ] = useState(false);

  const [
    isCompleting,
    setIsCompleting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const loadState =
    useCallback(
      async () => {
        if (!workspaceId) {
          setError(
            "No campaign workspace is selected.",
          );

          setIsLoading(
            false,
          );

          return null;
        }

        setIsLoading(
          true,
        );

        try {
          const [
            workspaceResult,
            onboardingResult,
            integrationResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "workspaces",
                )
                .select(
                  `
                    id,
                    onboarding_status,
                    onboarding_current_step
                  `,
                )
                .eq(
                  "id",
                  workspaceId,
                )
                .single(),

              supabase
                .from(
                  "workspace_onboarding_steps",
                )
                .select(
                  `
                    step_key,
                    status,
                    completed_at,
                    completed_by,
                    updated_at
                  `,
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "step_key",
                  [
                    "communications",
                    "calendar",
                  ],
                ),

              supabase
                .from(
                  "workspace_integrations",
                )
                .select(
                  `
                    id,
                    workspace_id,
                    provider,
                    integration_type,
                    connection_key,
                    status,
                    display_name,
                    display_email,
                    capabilities,
                    settings,
                    last_sync_at,
                    last_success_at,
                    connected_at,
                    disconnected_at,
                    last_error_code,
                    last_error_summary
                  `,
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "provider",
                  "nylas",
                )
                .in(
                  "integration_type",
                  [
                    "email",
                    "contacts",
                  ],
                ),
            ]);

          if (
            workspaceResult.error
          ) {
            throw (
              workspaceResult.error
            );
          }

          if (
            onboardingResult.error
          ) {
            throw (
              onboardingResult.error
            );
          }

          if (
            integrationResult.error
          ) {
            throw (
              integrationResult.error
            );
          }

          const steps =
            onboardingResult.data ||
            [];

          const communications =
            steps.find(
              (step) =>
                step.step_key ===
                "communications",
            ) ||
            null;

          const calendar =
            steps.find(
              (step) =>
                step.step_key ===
                "calendar",
            ) ||
            null;

          setWorkspaceState(
            workspaceResult.data,
          );

          setCommunicationsStep(
            communications,
          );

          setCalendarStep(
            calendar,
          );

          setIntegrations(
            integrationResult.data ||
            [],
          );

          setError(
            "",
          );

          return {
            workspace:
              workspaceResult.data,

            communicationsStep:
              communications,

            calendarStep:
              calendar,

            integrations:
              integrationResult.data ||
              [],
          };
        } catch (
          loadError
        ) {
          setError(
            errorMessage(
              loadError,
              "Email & Contacts connection status could not be loaded.",
            ),
          );

          return null;
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadState();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadState,
  ]);

  const startConnection =
    useCallback(
      async (
        provider,
      ) => {
        if (!workspaceId) {
          return;
        }

        setIsConnecting(
          true,
        );

        setError(
          "",
        );

        try {
          const {
            data,
            error:
              functionError,
          } =
            await supabase
              .functions
              .invoke(
                "nylas-oauth-start",
                {
                  body: {
                    workspaceId,
                    provider,
                  },
                },
              );

          if (
            functionError
          ) {
            throw (
              functionError
            );
          }

          if (
            !data
              ?.authorizationUrl
          ) {
            throw new Error(
              data?.error ||
              "Campaign Seat did not receive an OAuth authorization URL.",
            );
          }

          window.location.assign(
            data
              .authorizationUrl,
          );
        } catch (
          connectionError
        ) {
          setError(
            errorMessage(
              connectionError,
              "Campaign Seat could not start the email connection.",
            ),
          );

          setIsConnecting(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );

  const completeOnboarding =
    useCallback(
      async () => {
        setIsCompleting(
          true,
        );

        setError(
          "",
        );

        try {
          const {
            data,
            error:
              completionError,
          } =
            await supabase.rpc(
              "complete_email_contacts_onboarding",
              {
                target_workspace_id:
                  workspaceId,
              },
            );

          if (
            completionError
          ) {
            throw (
              completionError
            );
          }

          await loadState();

          return data;
        } catch (
          completionFailure
        ) {
          const message =
            errorMessage(
              completionFailure,
              "Email & Contacts onboarding could not be completed.",
            );

          setError(
            message,
          );

          throw new Error(
            message,
            {
              cause:
                completionFailure,
            },
          );
        } finally {
          setIsCompleting(
            false,
          );
        }
      },
      [
        loadState,
        workspaceId,
      ],
    );

  return {
    workspaceState,
    communicationsStep,
    calendarStep,
    integrations,

    isLoading,
    isConnecting,
    isCompleting,
    error,

    refresh:
      loadState,

    startConnection,
    completeOnboarding,
  };
}
