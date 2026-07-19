import {
  useCallback,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

function getMemberAccessErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign member access could not be updated.";

  if (
    error?.code === "PGRST202" ||
    message
      .toLowerCase()
      .includes(
        "manage_workspace_member_access",
      )
  ) {
    return "Member access controls are not activated yet. Run the Team Access database setup SQL, then try again.";
  }

  if (
    error?.code === "42501" ||
    message
      .toLowerCase()
      .includes("permission")
  ) {
    return "Your current campaign role is not authorized to change this member.";
  }

  return message;
}

export function useMemberAccessManagement({
  workspaceId,
}) {
  const [isSaving, setIsSaving] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const updateMemberAccess =
    useCallback(
      async ({
        membershipId,
        roleKey,
        displayTitle,
        status,
      }) => {
        if (
          !workspaceId ||
          !membershipId
        ) {
          throw new Error(
            "The workspace or membership is missing.",
          );
        }

        setIsSaving(true);
        setActionError("");

        try {
          const {
            data,
            error,
          } = await supabase.rpc(
            "manage_workspace_member_access",
            {
              target_workspace_id:
                workspaceId,
              target_membership_id:
                membershipId,
              target_role_key:
                roleKey,
              target_display_title:
                String(
                  displayTitle ||
                    "",
                ).trim() ||
                null,
              target_status:
                status,
            },
          );

          if (error) {
            throw error;
          }

          return Array.isArray(
            data,
          )
            ? data[0] ||
                null
            : data;
        } catch (error) {
          const message =
            getMemberAccessErrorMessage(
              error,
            );

          setActionError(
            message,
          );

          throw new Error(
            message,
            {
              cause: error,
            },
          );
        } finally {
          setIsSaving(false);
        }
      },
      [workspaceId],
    );

  return {
    isSaving,
    actionError,
    clearActionError: () =>
      setActionError(""),
    updateMemberAccess,
  };
}
