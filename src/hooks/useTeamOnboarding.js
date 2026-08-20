import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

function getTeamOnboardingErrorMessage(
  error,
) {
  const message =
    error?.message ||
    "Team & Access onboarding could not be completed.";

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
    return "Complete two-step verification before confirming Team & Access.";
  }

  if (
    error?.code ===
      "PGRST202" ||
    normalized.includes(
      "complete_team_onboarding",
    )
  ) {
    return "The protected Team onboarding transition is not active yet.";
  }

  if (
    error?.code ===
      "42501" ||
    normalized.includes(
      "permission",
    ) ||
    normalized.includes(
      "leadership",
    )
  ) {
    return "Your current campaign access is not authorized to confirm Team & Access.";
  }

  return message;
}

function findStep(
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

export function useTeamOnboarding({
  workspaceId,
}) {
  const [
    workspaceState,
    setWorkspaceState,
  ] = useState(null);

  const [
    teamStep,
    setTeamStep,
  ] = useState(null);

  const [
    communicationsStep,
    setCommunicationsStep,
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
                    "team",
                    "communications",
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

          const currentTeam =
            findStep(
              steps,
              "team",
            );

          const currentCommunications =
            findStep(
              steps,
              "communications",
            );

          setWorkspaceState(
            workspaceResult.data,
          );

          setTeamStep(
            currentTeam,
          );

          setCommunicationsStep(
            currentCommunications,
          );

          setError(
            "",
          );

          return {
            workspace:
              workspaceResult.data,

            teamStep:
              currentTeam,

            communicationsStep:
              currentCommunications,
          };
        } catch (
          loadError
        ) {
          setError(
            getTeamOnboardingErrorMessage(
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

  const completeTeam =
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
              "complete_team_onboarding",
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
            getTeamOnboardingErrorMessage(
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
    teamStep,
    communicationsStep,

    isLoading,
    isCompleting,
    error,

    refresh:
      loadState,

    completeTeam,
  };
}
