import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

function getSecurityOnboardingErrorMessage(
  error,
) {
  const message =
    error?.message ||
    "Security onboarding could not be completed.";

  const normalized =
    message
      .toLowerCase();

  if (
    normalized.includes(
      "two-step",
    ) ||
    normalized.includes(
      "aal2",
    ) ||
    normalized.includes(
      "mfa",
    )
  ) {
    return "Complete authenticator verification before continuing to Team & Access.";
  }

  if (
    error?.code ===
      "PGRST202" ||
    normalized.includes(
      "complete_security_onboarding",
    )
  ) {
    return "The protected Security transition is not active yet.";
  }

  if (
    error?.code ===
      "42501" ||
    normalized.includes(
      "not authorized",
    ) ||
    normalized.includes(
      "permission",
    )
  ) {
    return "Your current campaign role is not authorized to complete Security onboarding.";
  }

  return message;
}

function getStep(
  steps,
  key,
) {
  return (
    steps.find(
      (step) =>
        step.step_key ===
        key,
    ) ||
    null
  );
}

export function useSecurityOnboarding({
  workspaceId,
}) {
  const [
    workspaceState,
    setWorkspaceState,
  ] = useState(null);

  const [
    securityStep,
    setSecurityStep,
  ] = useState(null);

  const [
    teamStep,
    setTeamStep,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

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
          setIsLoading(
            false,
          );

          setError(
            "No campaign workspace is selected.",
          );

          return null;
        }

        setIsLoading(
          true,
        );

        try {
          const [
            workspaceResult,
            stepsResult,
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
                    is_required,
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
                    "security",
                    "team",
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
            stepsResult.error
          ) {
            throw (
              stepsResult.error
            );
          }

          const steps =
            stepsResult.data ||
            [];

          setWorkspaceState(
            workspaceResult.data,
          );

          setSecurityStep(
            getStep(
              steps,
              "security",
            ),
          );

          setTeamStep(
            getStep(
              steps,
              "team",
            ),
          );

          setError(
            "",
          );

          return {
            workspace:
              workspaceResult.data,

            securityStep:
              getStep(
                steps,
                "security",
              ),

            teamStep:
              getStep(
                steps,
                "team",
              ),
          };
        } catch (
          loadError
        ) {
          setError(
            getSecurityOnboardingErrorMessage(
              loadError,
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

  const completeSecurity =
    useCallback(
      async () => {
        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

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
              completeError,
          } =
            await supabase.rpc(
              "complete_security_onboarding",
              {
                target_workspace_id:
                  workspaceId,
              },
            );

          if (
            completeError
          ) {
            throw (
              completeError
            );
          }

          await loadState();

          return data;
        } catch (
          completeError
        ) {
          const message =
            getSecurityOnboardingErrorMessage(
              completeError,
            );

          setError(
            message,
          );

          throw new Error(
            message,
            {
              cause:
                completeError,
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
    securityStep,
    teamStep,

    isLoading,
    isCompleting,
    error,

    refresh:
      loadState,

    completeSecurity,
  };
}
