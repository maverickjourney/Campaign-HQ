import {
  useCallback,
} from "react";

import {
  supabase,
} from "../lib/supabase";


export function useExternalOutreachHandoff({
  workspaceId,
}) {
  const prepareExternalOutreach =
    useCallback(
      async ({
        contactId,
        channel,
        messageBody,
      }) => {
        if (
          !workspaceId ||
          !contactId
        ) {
          throw new Error(
            "Save or select a Campaign Seat contact before preparing Text or WhatsApp outreach.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "prepare_external_outreach",
          {
            target_workspace_id:
              workspaceId,

            target_contact_id:
              contactId,

            target_channel:
              channel,

            target_message_body:
              messageBody,
          },
        );

        if (error) {
          throw error;
        }

        if (
          !data?.outreachId
        ) {
          throw new Error(
            "Campaign Seat prepared the outreach but did not return its tracking ID.",
          );
        }

        return data;
      },
      [
        workspaceId,
      ],
    );


  const markExternalOutreachOpened =
    useCallback(
      async ({
        outreachId,
      }) => {
        if (
          !workspaceId ||
          !outreachId
        ) {
          throw new Error(
            "The prepared outreach could not be opened.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "mark_external_outreach_opened",
          {
            target_workspace_id:
              workspaceId,

            target_outreach_id:
              outreachId,
          },
        );

        if (error) {
          throw error;
        }

        return data;
      },
      [
        workspaceId,
      ],
    );


  const confirmExternalOutreachSent =
    useCallback(
      async ({
        outreachId,
      }) => {
        if (
          !workspaceId ||
          !outreachId
        ) {
          throw new Error(
            "The external outreach could not be confirmed.",
          );
        }

        const {
          data,
          error,
        } = await supabase.rpc(
          "confirm_external_outreach_sent",
          {
            target_workspace_id:
              workspaceId,

            target_outreach_id:
              outreachId,
          },
        );

        if (error) {
          throw error;
        }

        return data;
      },
      [
        workspaceId,
      ],
    );


  return {
    prepareExternalOutreach,
    markExternalOutreachOpened,
    confirmExternalOutreachSent,
  };
}
