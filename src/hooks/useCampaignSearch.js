import { useCallback, useState } from "react";

import { supabase } from "../lib/supabase";

function getSearchErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign HQ search could not be completed.";

  if (
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    message
      .toLowerCase()
      .includes("search_campaign_hq")
  ) {
    return "Campaign Search has not been activated yet. Run the Campaign Search SQL, then refresh.";
  }

  if (
    error?.code === "42501" ||
    message
      .toLowerCase()
      .includes("permission")
  ) {
    return "Your campaign role cannot search this workspace.";
  }

  return message;
}

export function useCampaignSearch({
  workspaceId,
}) {
  const [isSearching, setIsSearching] =
    useState(false);

  const [error, setError] =
    useState("");

  const searchCampaign =
    useCallback(
      async ({
        query,
        limit = 80,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        setIsSearching(true);
        setError("");

        try {
          const {
            data,
            error: searchError,
          } = await supabase.rpc(
            "search_campaign_hq",
            {
              target_workspace_id:
                workspaceId,
              target_query:
                String(
                  query || "",
                ).trim(),
              target_limit:
                Math.min(
                  Math.max(
                    Number(limit) ||
                      80,
                    1,
                  ),
                  100,
                ),
            },
          );

          if (searchError) {
            throw searchError;
          }

          return data || [];
        } catch (searchError) {
          const message =
            getSearchErrorMessage(
              searchError,
            );

          setError(message);

          throw new Error(
            message,
            {
              cause:
                searchError,
            },
          );
        } finally {
          setIsSearching(false);
        }
      },
      [workspaceId],
    );

  return {
    isSearching,
    error,
    clearError: () =>
      setError(""),
    searchCampaign,
  };
}
