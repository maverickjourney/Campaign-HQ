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

async function getFunctionErrorMessage(
  error,
  fallback,
) {
  let detail = "";

  try {
    const payload =
      await error?.context?.json();

    detail =
      payload?.error ||
      payload?.message ||
      payload?.detail ||
      "";
  } catch {
    // Use the SDK error message below.
  }

  return (
    detail ||
    error?.message ||
    fallback
  );
}

export function useMemberAccessManagement({
  workspaceId,
}) {
  const [isSaving, setIsSaving] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    deletionError,
    setDeletionError,
  ] = useState("");

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

  const permanentlyDeleteMember =
    useCallback(
      async ({
        membershipId,
        confirmationEmail,
      }) => {
        const cleanEmail =
          String(
            confirmationEmail ||
              "",
          )
            .trim()
            .toLowerCase();

        if (
          !workspaceId ||
          !membershipId ||
          !cleanEmail
        ) {
          throw new Error(
            "The workspace, membership and confirmation email are required.",
          );
        }

        setIsDeleting(true);
        setDeletionError("");

        try {
          const {
            data,
            error,
          } =
            await supabase
              .functions
              .invoke(
                "delete-workspace-account",
                {
                  body: {
                    workspaceId,
                    membershipId,
                    confirmationEmail:
                      cleanEmail,
                  },
                },
              );

          if (error) {
            const message =
              await getFunctionErrorMessage(
                error,
                "The account-deletion service could not be reached.",
              );

            throw new Error(
              message,
              {
                cause: error,
              },
            );
          }

          if (
            data?.ok !== true ||
            data?.deleted !== true
          ) {
            throw new Error(
              data?.error ||
                "The account was not permanently deleted.",
            );
          }

          return data;
        } catch (error) {
          const message =
            error?.message ||
            "The account could not be permanently deleted.";

          setDeletionError(
            message,
          );

          throw new Error(
            message,
            {
              cause: error,
            },
          );
        } finally {
          setIsDeleting(false);
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

    isDeleting,
    deletionError,
    clearDeletionError: () =>
      setDeletionError(""),
    permanentlyDeleteMember,
  };
}
