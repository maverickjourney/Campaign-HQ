import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

function getSetupErrorMessage(
  error,
) {
  const message =
    error?.message ||
    "Campaign Seat could not complete this Setup action.";

  const normalized =
    message.toLowerCase();

  if (
    normalized.includes(
      "two-step verification",
    ) ||
    normalized.includes(
      "aal2",
    ) ||
    normalized.includes(
      "mfa",
    )
  ) {
    return "Complete two-step verification before saving Campaign Seat setup.";
  }

  if (
    error?.code === "42501" ||
    normalized.includes(
      "not authorized",
    ) ||
    normalized.includes(
      "permission",
    )
  ) {
    return "Your current campaign role is not authorized to change Campaign Seat setup.";
  }

  return message;
}

export function useCampaignSetup({
  workspaceId,
}) {
  const [
    setupWorkspace,
    setSetupWorkspace,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isActivating,
    setIsActivating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastLoadedAt,
    setLastLoadedAt,
  ] = useState(null);

  const [
    lastSavedAt,
    setLastSavedAt,
  ] = useState(null);

  const loadSetup =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "No Campaign Seat workspace is selected.",
          );

          setIsLoading(false);
          return null;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const {
            data,
            error: loadError,
          } = await supabase
            .from("workspaces")
            .select(
              `
                id,
                name,
                description,
                location,
                election_date,
                political_party,
                status,
                campaign_type,
                candidate_name,
                legal_committee_name,
                office_sought,
                office_level,
                district_label,
                jurisdiction_name,
                jurisdiction_type,
                primary_election_date,
                general_election_date,
                timezone,
                campaign_email,
                campaign_phone,
                website_url,
                recommended_theme,
                active_theme,
                theme_source,
                onboarding_status,
                onboarding_current_step,
                onboarding_started_at,
                onboarding_completed_at,
                setup_version,
                enabled_modules,
                setup_metadata
              `,
            )
            .eq(
              "id",
              workspaceId,
            )
            .single();

          if (loadError) {
            throw loadError;
          }

          setSetupWorkspace(
            data,
          );

          setError("");

          setLastLoadedAt(
            new Date(),
          );

          return data;
        } catch (loadError) {
          setError(
            getSetupErrorMessage(
              loadError,
            ),
          );

          return null;
        } finally {
          setIsLoading(false);
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
          loadSetup({
            showLoading: true,
          });
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadSetup,
  ]);

  const saveDraft =
    useCallback(
      async ({
        form,
        currentStep,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No Campaign Seat workspace is selected.",
          );
        }

        if (!form) {
          throw new Error(
            "Campaign Setup form data is missing.",
          );
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: saveError,
          } = await supabase.rpc(
            "save_campaign_setup_draft",
            {
              target_workspace_id:
                workspaceId,

              target_payload:
                form,

              target_current_step:
                currentStep,
            },
          );

          if (saveError) {
            throw saveError;
          }

          if (!data) {
            throw new Error(
              "Campaign Seat saved the draft but did not return the updated workspace.",
            );
          }

          setSetupWorkspace(
            data,
          );

          const savedAt =
            new Date();

          setLastSavedAt(
            savedAt,
          );

          setLastLoadedAt(
            savedAt,
          );

          return data;
        } catch (saveError) {
          const message =
            getSetupErrorMessage(
              saveError,
            );

          setError(
            message,
          );

          throw new Error(
            message,
            {
              cause:
                saveError,
            },
          );
        } finally {
          setIsSaving(false);
        }
      },
      [
        workspaceId,
      ],
    );

  const activateWorkspace =
    useCallback(
      async ({
        form,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No Campaign Seat workspace is selected.",
          );
        }

        if (!form) {
          throw new Error(
            "Campaign Setup form data is missing.",
          );
        }

        setIsActivating(true);
        setError("");

        try {
          const {
            error: activationError,
          } = await supabase.rpc(
            "activate_campaign_setup",
            {
              target_workspace_id:
                workspaceId,

              target_payload:
                form,
            },
          );

          if (activationError) {
            throw activationError;
          }

          const refreshed =
            await loadSetup();

          if (!refreshed) {
            throw new Error(
              "Campaign Seat activated the workspace but could not refresh its protected Setup state.",
            );
          }

          const activatedAt =
            new Date();

          setLastSavedAt(
            activatedAt,
          );

          setLastLoadedAt(
            activatedAt,
          );

          return refreshed;
        } catch (activationError) {
          const baseMessage =
            getSetupErrorMessage(
              activationError,
            );

          const message =
            baseMessage.replace(
              "before saving Campaign Seat setup.",
              "before activating this Campaign Seat workspace.",
            );

          setError(
            message,
          );

          throw new Error(
            message,
            {
              cause:
                activationError,
            },
          );
        } finally {
          setIsActivating(false);
        }
      },
      [
        workspaceId,
        loadSetup,
      ],
    );



  return {
    setupWorkspace,
    isLoading,
    isSaving,
    isActivating,
    error,
    lastLoadedAt,
    lastSavedAt,

    refresh:
      () =>
        loadSetup({
          showLoading: true,
        }),

    saveDraft,
    activateWorkspace,
  };
}
