import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  roles: [],
  invitations: [],
  departments: [],
  teams: [],
};

// CAMPAIGN HQ INVITATION DATABASE DIAGNOSTICS
function getSupabaseErrorMessage(
  error,
  fallback,
) {
  if (!error) {
    return fallback;
  }

  const parts = [
    error.message,
    error.details,
    error.hint,
    error.code
      ? `Code: ${error.code}`
      : "",
  ]
    .filter(Boolean)
    .map((part) =>
      String(part).trim(),
    );

  const uniqueParts = [
    ...new Set(parts),
  ];

  return (
    uniqueParts.join(" · ") ||
    fallback
  );
}

function normalizeInvitationResult(data) {
  const result =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!result) {
    return null;
  }

  return {
    invitationId:
      result.invitation_id ||
      result.id ||
      "",

    invitationToken:
      result.invitation_token ||
      "",

    invitationExpiresAt:
      result.invitation_expires_at ||
      result.expires_at ||
      null,
  };
}

export function useInvitationManagement({
  workspaceId,
  canManageInvitations,
}) {
  const [state, setState] =
    useState(EMPTY_STATE);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const refreshTimerRef =
    useRef(null);

  const loadRoles =
    useCallback(async () => {
      const {
        data,
        error: rolesError,
      } = await supabase
        .from("campaign_roles")
        .select(
          `
            key,
            name,
            description,
            dashboard_type,
            seat_type,
            authority_rank,
            default_scope,
            is_active
          `,
        )
        .eq(
          "is_active",
          true,
        )
        .order(
          "authority_rank",
          {
            ascending: true,
          },
        );

      if (rolesError) {
        throw rolesError;
      }

      return (data || []).filter(
        (role) =>
          role.key !==
          "campaign_owner",
      );
    }, []);

  const loadInvitations =
    useCallback(async () => {
      if (
        !workspaceId ||
        !canManageInvitations
      ) {
        return [];
      }

      const {
        data,
        error: invitationsError,
      } = await supabase
        .from("workspace_invitations")
        .select(
          `
            id,
            workspace_id,
            email,
            role_key,
            seat_type,
            display_title,
            department_id,
            campaign_team_id,
            invited_by,
            status,
            expires_at,
            accepted_by,
            accepted_at,
            cancelled_at,
            created_at,
            updated_at
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (invitationsError) {
        throw invitationsError;
      }

      return data || [];
    }, [
      canManageInvitations,
      workspaceId,
    ]);

  const loadDepartments =
    useCallback(async () => {
      if (!workspaceId) {
        return [];
      }

      const {
        data,
        error: departmentsError,
      } = await supabase
        .from("campaign_departments")
        .select(
          `
            id,
            workspace_id,
            key,
            name,
            description,
            status
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .eq(
          "status",
          "active",
        )
        .order(
          "name",
          {
            ascending: true,
          },
        );

      if (departmentsError) {
        throw departmentsError;
      }

      return data || [];
    }, [workspaceId]);

  const loadTeams =
    useCallback(async () => {
      if (!workspaceId) {
        return [];
      }

      const {
        data,
        error: teamsError,
      } = await supabase
        .from("campaign_teams")
        .select(
          `
            id,
            workspace_id,
            department_id,
            key,
            name,
            description,
            status
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .eq(
          "status",
          "active",
        )
        .order(
          "name",
          {
            ascending: true,
          },
        );

      if (teamsError) {
        throw teamsError;
      }

      return data || [];
    }, [workspaceId]);

  const loadInvitationManager =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "No campaign workspace is selected.",
          );

          setIsLoading(false);
          return;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const [
            roles,
            invitations,
            departments,
            teams,
          ] = await Promise.all([
            loadRoles(),
            loadInvitations(),
            loadDepartments(),
            loadTeams(),
          ]);

          setState({
            roles,
            invitations,
            departments,
            teams,
          });

          setError("");
          setLastUpdated(
            new Date(),
          );
        } catch (loadError) {
          console.error(
            "Invitation Manager could not load:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Invitation data could not be loaded.",
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        loadDepartments,
        loadInvitations,
        loadRoles,
        loadTeams,
        workspaceId,
      ],
    );

  const createInvitation =
    useCallback(
      async ({
        email,
        roleKey,
        displayTitle,
        departmentId,
        campaignTeamId,
      }) => {
        if (!canManageInvitations) {
          throw new Error(
            "Your campaign role cannot create invitations.",
          );
        }

        setIsSaving(true);
        setActionError("");

        try {
          const {
            data: databasePermission,
            error: permissionError,
          } = await supabase.rpc(
            "has_campaign_permission",
            {
              target_workspace_id:
                workspaceId,

              requested_permission:
                "workspace.invite_members",
            },
          );

          if (permissionError) {
            throw new Error(
              getSupabaseErrorMessage(
                permissionError,
                "The live database permission check failed.",
              ),
            );
          }

          if (
            databasePermission !==
            true
          ) {
            throw new Error(
              "The live database denied workspace.invite_members for this account. The browser session contains the permission, but the database membership or role-permission record does not authorize the invitation.",
            );
          }

          const {
            data,
            error: invitationError,
          } = await supabase.rpc(
            "create_workspace_invitation",
            {
              target_workspace_id:
                workspaceId,

              target_email:
                email
                  .trim()
                  .toLowerCase(),

              target_role_key:
                roleKey,

              target_display_title:
                displayTitle.trim() ||
                null,

              target_department_id:
                departmentId ||
                null,

              target_campaign_team_id:
                campaignTeamId ||
                null,
            },
          );

          if (invitationError) {
            throw invitationError;
          }

          const result =
            normalizeInvitationResult(
              data,
            );

          if (
            !result ||
            !result.invitationToken
          ) {
            throw new Error(
              "The invitation was created, but the secure acceptance token was not returned.",
            );
          }

          const normalizedRecipient =
            email
              .trim()
              .toLowerCase();

          let emailDelivery = {
            emailSent: false,
            emailRecipient:
              normalizedRecipient,
            emailId: null,
            emailError: "",
          };

          try {
            const {
              data:
                emailData,
              error:
                emailFunctionError,
            } =
              await supabase
                .functions
                .invoke(
                  "send-workspace-invitation",
                  {
                    body: {
                      invitationId:
                        result
                          .invitationId,

                      invitationToken:
                        result
                          .invitationToken,
                    },
                  },
                );

            if (
              emailFunctionError
            ) {
              throw emailFunctionError;
            }

            if (
              emailData?.success !==
              true
            ) {
              throw new Error(
                emailData?.error ||
                  "The invitation email provider did not confirm delivery.",
              );
            }

            emailDelivery = {
              emailSent: true,

              emailRecipient:
                emailData
                  .recipient ||
                normalizedRecipient,

              emailId:
                emailData
                  .emailId ||
                null,

              emailError: "",
            };
          } catch (
            emailFailure
          ) {
            console.error(
              "Invitation email delivery failed:",
              emailFailure,
            );

            emailDelivery = {
              emailSent: false,

              emailRecipient:
                normalizedRecipient,

              emailId: null,

              emailError:
                "The invitation was created, but automatic email delivery did not complete. Copy and send the secure link manually.",
            };
          }

          await loadInvitationManager();

          return {
            ...result,
            ...emailDelivery,
          };
        } catch (createError) {
          console.error(
            "Invitation creation failed:",
            createError,
          );

          const message =
            getSupabaseErrorMessage(
              createError,
              "The invitation could not be created.",
            );

          setActionError(
            message,
          );

          throw createError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        canManageInvitations,
        loadInvitationManager,
        workspaceId,
      ],
    );

  const cancelInvitation =
    useCallback(
      async (invitationId) => {
        if (!canManageInvitations) {
          throw new Error(
            "Your campaign role cannot cancel invitations.",
          );
        }

        setIsSaving(true);
        setActionError("");

        try {
          const {
            data,
            error: cancelError,
          } = await supabase
            .from(
              "workspace_invitations",
            )
            .update({
              status: "cancelled",
              cancelled_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              invitationId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "status",
              "pending",
            )
            .select(
              "id, status",
            )
            .single();

          if (cancelError) {
            throw cancelError;
          }

          await loadInvitationManager();

          return data;
        } catch (cancelFailure) {
          console.error(
            "Invitation cancellation failed:",
            cancelFailure,
          );

          const message =
            getSupabaseErrorMessage(
              cancelFailure,
              "The invitation could not be cancelled.",
            );

          setActionError(
            message,
          );

          throw cancelFailure;
        } finally {
          setIsSaving(false);
        }
      },
      [
        canManageInvitations,
        loadInvitationManager,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadInvitationManager({
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
  }, [loadInvitationManager]);

  useEffect(() => {
    if (
      !workspaceId ||
      !canManageInvitations
    ) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      refreshTimerRef.current =
        window.setTimeout(
          () => {
            loadInvitationManager();
          },
          300,
        );
    };

    const channel = supabase
      .channel(
        `invitation-manager-${workspaceId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "workspace_invitations",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "campaign_departments",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "campaign_teams",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      supabase.removeChannel(
        channel,
      );
    };
  }, [
    canManageInvitations,
    loadInvitationManager,
    workspaceId,
  ]);

  return {
    roles: state.roles,
    invitations:
      state.invitations,
    departments:
      state.departments,
    teams: state.teams,
    isLoading,
    isSaving,
    error,
    actionError,
    lastUpdated,

    refresh: () =>
      loadInvitationManager({
        showLoading: true,
      }),

    createInvitation,
    cancelInvitation,
  };
}
