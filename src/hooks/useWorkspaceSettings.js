import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  saveWorkspace,
} from "../utils/campaignSession";

function normalizeWorkspace(
  workspace = {},
  fallback = {},
) {
  return {
    id:
      workspace.id ||
      fallback.id ||
      "",

    name:
      workspace.name ??
      fallback.name ??
      "",

    description:
      workspace.description ??
      fallback.description ??
      "",

    location:
      workspace.location ??
      fallback.location ??
      "",

    electionDate:
      workspace.election_date ||
      workspace.electionDateRaw ||
      fallback.electionDateRaw ||
      "",

    politicalParty:
      workspace.political_party ||
      workspace.politicalParty ||
      fallback.politicalParty ||
      "republican",

    status:
      workspace.status ||
      fallback.status ||
      "active",
  };
}

function getWorkspaceErrorMessage(
  error,
) {
  const message =
    error?.message ||
    "Workspace settings could not be saved.";

  if (
    error?.code === "PGRST202" ||
    message
      .toLowerCase()
      .includes(
        "manage_workspace_settings",
      )
  ) {
    return "Workspace editing is not activated yet. Run the Workspace Settings database setup SQL, then try again.";
  }

  if (
    error?.code === "42501" ||
    message
      .toLowerCase()
      .includes("permission")
  ) {
    return "Your current campaign role is not authorized to change workspace settings.";
  }

  return message;
}

function workspaceSnapshot(
  workspace,
) {
  return JSON.stringify({
    name:
      workspace.name
        .trim(),
    description:
      workspace.description
        .trim(),
    location:
      workspace.location
        .trim(),
    electionDate:
      workspace.electionDate,
    politicalParty:
      workspace.politicalParty,
  });
}

export function useWorkspaceSettings({
  workspaceId,
  initialWorkspace,
}) {
  const normalizedInitial =
    normalizeWorkspace(
      initialWorkspace,
    );

  const [
    workspace,
    setWorkspace,
  ] = useState(
    normalizedInitial,
  );

  const [
    savedWorkspace,
    setSavedWorkspace,
  ] = useState(
    normalizedInitial,
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    lastSavedAt,
    setLastSavedAt,
  ] = useState(null);

  const loadWorkspace =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "No campaign workspace is selected.",
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
                status
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

          const normalized =
            normalizeWorkspace(
              data,
              initialWorkspace,
            );

          setWorkspace(
            normalized,
          );

          setSavedWorkspace(
            normalized,
          );

          saveWorkspace({
            id:
              normalized.id,
            name:
              normalized.name,
            description:
              normalized.description,
            location:
              normalized.location,
            election_date:
              normalized.electionDate,
            political_party:
              normalized.politicalParty,
            status:
              normalized.status,
          });

          setError("");
          setLastUpdated(
            new Date(),
          );

          return normalized;
        } catch (loadError) {
          setError(
            getWorkspaceErrorMessage(
              loadError,
            ),
          );

          return null;
        } finally {
          setIsLoading(false);
        }
      },
      [
        initialWorkspace,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadWorkspace({
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
  }, [loadWorkspace]);

  const updateField =
    useCallback(
      (field, value) => {
        setWorkspace(
          (current) => ({
            ...current,
            [field]: value,
          }),
        );

        setError("");
      },
      [],
    );

  const resetChanges =
    useCallback(() => {
      setWorkspace(
        savedWorkspace,
      );
      setError("");
    }, [savedWorkspace]);

  const saveWorkspaceSettings =
    useCallback(async () => {
      const name =
        workspace.name.trim();

      const description =
        workspace.description.trim();

      const location =
        workspace.location.trim();

      if (!name) {
        throw new Error(
          "Enter the campaign workspace name.",
        );
      }

      if (!description) {
        throw new Error(
          "Enter the campaign race or office description.",
        );
      }

      if (!location) {
        throw new Error(
          "Enter the campaign location.",
        );
      }

      if (!workspace.electionDate) {
        throw new Error(
          "Choose the election date.",
        );
      }

      if (
        ![
          "republican",
          "democratic",
          "nonpartisan",
          "other",
        ].includes(
          workspace.politicalParty,
        )
      ) {
        throw new Error(
          "Choose the campaign political party.",
        );
      }

      setIsSaving(true);
      setError("");

      try {
        const {
          data,
          error: saveError,
        } = await supabase.rpc(
          "manage_workspace_settings_with_party",
          {
            target_workspace_id:
              workspaceId,
            target_name:
              name,
            target_description:
              description,
            target_location:
              location,
            target_election_date:
              workspace.electionDate,
            target_political_party:
              workspace.politicalParty,
          },
        );

        if (saveError) {
          throw saveError;
        }

        const result =
          Array.isArray(data)
            ? data[0]
            : data;

        if (!result) {
          throw new Error(
            "The workspace was updated, but the saved record was not returned.",
          );
        }

        const normalized =
          normalizeWorkspace(
            result,
            workspace,
          );

        setWorkspace(
          normalized,
        );

        setSavedWorkspace(
          normalized,
        );

        saveWorkspace({
          id:
            normalized.id,
          name:
            normalized.name,
          description:
            normalized.description,
          location:
            normalized.location,
          election_date:
            normalized.electionDate,
          political_party:
            normalized.politicalParty,
          status:
            normalized.status,
        });

        const savedAt =
          new Date();

        setLastUpdated(
          savedAt,
        );

        setLastSavedAt(
          savedAt,
        );

        return normalized;
      } catch (saveError) {
        const message =
          getWorkspaceErrorMessage(
            saveError,
          );

        setError(
          message,
        );

        throw new Error(
          message,
          {
            cause: saveError,
          },
        );
      } finally {
        setIsSaving(false);
      }
    }, [
      workspace,
      workspaceId,
    ]);

  const hasChanges =
    workspaceSnapshot(
      workspace,
    ) !==
    workspaceSnapshot(
      savedWorkspace,
    );

  return {
    workspace,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    lastSavedAt,
    hasChanges,
    refresh: () =>
      loadWorkspace({
        showLoading: true,
      }),
    updateField,
    resetChanges,
    saveWorkspaceSettings,
  };
}
