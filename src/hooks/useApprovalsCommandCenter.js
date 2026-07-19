import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  approvals: [],
  team: [],
};

function getApprovalsErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign approvals could not be loaded.";

  if (
    error?.code === "42P01" ||
    message.includes("approvals")
  ) {
    return "The campaign approvals table is unavailable. Confirm the original Campaign HQ database setup was run, then refresh this page.";
  }

  if (
    error?.code === "42501" ||
    message
      .toLowerCase()
      .includes("row-level security")
  ) {
    return "Your campaign role does not allow that approval action.";
  }

  return message;
}

async function loadWorkspaceTeam(workspaceId) {
  const {
    data: memberships,
    error: membershipError,
  } = await supabase
    .from("workspace_members")
    .select(
      `
        user_id,
        role,
        role_key,
        display_title,
        dashboard_type,
        seat_type,
        status
      `,
    )
    .eq(
      "workspace_id",
      workspaceId,
    )
    .eq("status", "active");

  if (membershipError) {
    throw membershipError;
  }

  const userIds = [
    ...new Set(
      (memberships || [])
        .map(
          (membership) =>
            membership.user_id,
        )
        .filter(Boolean),
    ),
  ];

  if (!userIds.length) {
    return [];
  }

  const {
    data: profiles,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email",
    )
    .in("id", userIds);

  if (profileError) {
    throw profileError;
  }

  const profileMap =
    new Map(
      (profiles || []).map(
        (profile) => [
          profile.id,
          profile,
        ],
      ),
    );

  return (memberships || [])
    .map((membership) => {
      const profile =
        profileMap.get(
          membership.user_id,
        );

      return {
        id:
          membership.user_id,
        fullName:
          profile?.full_name ||
          "Campaign User",
        email:
          profile?.email || "",
        roleKey:
          membership.role_key ||
          membership.role ||
          "campaign_member",
        displayTitle:
          membership.display_title ||
          "Campaign Member",
        dashboardType:
          membership.dashboard_type ||
          "volunteer",
        seatType:
          membership.seat_type ||
          "volunteer",
      };
    })
    .sort((left, right) =>
      left.fullName.localeCompare(
        right.fullName,
      ),
    );
}

export function useApprovalsCommandCenter({
  workspaceId,
  userId,
}) {
  const [state, setState] =
    useState(EMPTY_STATE);

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

  const refreshTimerRef =
    useRef(null);

  const loadApprovals =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setState(
            EMPTY_STATE,
          );
          setError(
            "No campaign workspace is selected.",
          );
          setIsLoading(false);
          return EMPTY_STATE;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const [
            approvalsResult,
            team,
          ] = await Promise.all([
            supabase
              .from("approvals")
              .select(
                `
                  id,
                  workspace_id,
                  title,
                  description,
                  approval_type,
                  status,
                  due_at,
                  submitted_by,
                  assigned_to,
                  reviewed_by,
                  reviewed_at,
                  review_notes,
                  is_sample,
                  created_at,
                  updated_at
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .order(
                "due_at",
                {
                  ascending: true,
                  nullsFirst: false,
                },
              )
              .order(
                "updated_at",
                {
                  ascending: false,
                },
              ),
            loadWorkspaceTeam(
              workspaceId,
            ),
          ]);

          if (
            approvalsResult.error
          ) {
            throw approvalsResult.error;
          }

          const nextState = {
            approvals:
              approvalsResult.data ||
              [],
            team,
          };

          setState(nextState);
          setError("");
          setLastUpdated(
            new Date(),
          );

          return nextState;
        } catch (loadError) {
          setError(
            getApprovalsErrorMessage(
              loadError,
            ),
          );

          return EMPTY_STATE;
        } finally {
          setIsLoading(false);
        }
      },
      [workspaceId],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadApprovals({
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
  }, [loadApprovals]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh =
      () => {
        window.clearTimeout(
          refreshTimerRef.current,
        );

        refreshTimerRef.current =
          window.setTimeout(
            () => {
              loadApprovals();
            },
            300,
          );
      };

    const channel = supabase
      .channel(
        `campaign-approvals-${workspaceId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approvals",
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
            "workspace_members",
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
    loadApprovals,
    workspaceId,
  ]);

  const saveApproval =
    useCallback(
      async ({
        id,
        title,
        description,
        approvalType,
        status,
        dueAt,
        assignedTo,
      }) => {
        if (
          !workspaceId ||
          !userId
        ) {
          throw new Error(
            "The active campaign workspace or user session is missing.",
          );
        }

        const cleanTitle =
          String(title || "")
            .trim();

        if (!cleanTitle) {
          throw new Error(
            "Enter an approval title.",
          );
        }

        const payload = {
          workspace_id:
            workspaceId,
          title:
            cleanTitle,
          description:
            String(
              description || "",
            ).trim() ||
            null,
          approval_type:
            approvalType ||
            "general",
          status:
            status ||
            "pending",
          due_at:
            dueAt || null,
          assigned_to:
            assignedTo ||
            null,
        };

        setIsSaving(true);
        setError("");

        try {
          let result;

          if (id) {
            result = await supabase
              .from("approvals")
              .update({
                ...payload,
                reviewed_by:
                  null,
                reviewed_at:
                  null,
                review_notes:
                  null,
              })
              .eq("id", id)
              .eq(
                "workspace_id",
                workspaceId,
              )
              .select()
              .single();
          } else {
            result = await supabase
              .from("approvals")
              .insert({
                ...payload,
                submitted_by:
                  userId,
                is_sample:
                  false,
              })
              .select()
              .single();
          }

          if (result.error) {
            throw result.error;
          }

          await loadApprovals();

          return result.data;
        } catch (saveError) {
          setError(
            getApprovalsErrorMessage(
              saveError,
            ),
          );

          throw saveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadApprovals,
        userId,
        workspaceId,
      ],
    );

  const reviewApproval =
    useCallback(
      async ({
        approvalId,
        status,
        reviewNotes,
      }) => {
        if (
          !workspaceId ||
          !userId
        ) {
          throw new Error(
            "The active campaign workspace or user session is missing.",
          );
        }

        const notes =
          String(
            reviewNotes || "",
          ).trim();

        if (
          [
            "changes_requested",
            "rejected",
          ].includes(status) &&
          !notes
        ) {
          throw new Error(
            "Add review notes explaining the requested changes or rejection.",
          );
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error:
              reviewError,
          } = await supabase
            .from("approvals")
            .update({
              status,
              review_notes:
                notes || null,
              reviewed_by:
                userId,
              reviewed_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              approvalId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();

          if (reviewError) {
            throw reviewError;
          }

          await loadApprovals();

          return data;
        } catch (reviewError) {
          setError(
            getApprovalsErrorMessage(
              reviewError,
            ),
          );

          throw reviewError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadApprovals,
        userId,
        workspaceId,
      ],
    );

  const deleteApproval =
    useCallback(
      async (approvalId) => {
        if (!workspaceId) {
          return;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            error:
              deleteError,
          } = await supabase
            .from("approvals")
            .delete()
            .eq(
              "id",
              approvalId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (deleteError) {
            throw deleteError;
          }

          await loadApprovals();
        } catch (deleteError) {
          setError(
            getApprovalsErrorMessage(
              deleteError,
            ),
          );

          throw deleteError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadApprovals,
        workspaceId,
      ],
    );

  return {
    approvals:
      state.approvals,
    team:
      state.team,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadApprovals({
        showLoading: true,
      }),
    saveApproval,
    reviewApproval,
    deleteApproval,
  };
}
