import {
  useCallback,
} from "react";

import {
  supabase,
} from "../lib/supabase";

export function useCampaignAi({
  workspaceId,
}) {
  const askCampaignAi =
    useCallback(
      async ({
        question,
        retrievalQuery,
      }) => {
        if (!workspaceId) {
          throw new Error(
            "No campaign workspace is selected.",
          );
        }

        const cleanQuestion =
          String(
            question || "",
          ).trim();

        if (!cleanQuestion) {
          throw new Error(
            "Ask Campaign HQ a question first.",
          );
        }

        const cleanRetrievalQuery =
          String(
            retrievalQuery || "",
          ).trim();

        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "campaign-ai",
              {
                body: {
                  workspaceId,

                  question:
                    cleanQuestion,

                  retrievalQuery:
                    cleanRetrievalQuery ||
                    cleanQuestion,
                },
              },
            );

        if (error) {
          throw error;
        }

        if (
          !data ||
          typeof data.answer !==
            "string" ||
          !data.answer.trim()
        ) {
          throw new Error(
            "Campaign Seat AI returned no usable answer.",
          );
        }

        return data;
      },
      [workspaceId],
    );

  return {
    askCampaignAi,
  };
}
