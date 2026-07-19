import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  members: [],
};

function getAuthorityRank(roleKey) {
  const order = {
    campaign_owner: 0,
    candidate: 0,
    campaign_consultant: 1,
    campaign_manager: 2,
    department_lead: 3,
    staff: 4,
    team_captain: 5,
    reviewer: 6,
    volunteer: 7,
  };

  return order[roleKey] ?? 99;
}

export function useTeamAccessCommandCenter({
  workspaceId,
}) {
  const [state, setState] =
    useState(EMPTY_STATE);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const refreshTimerRef =
    useRef(null);

  const loadMembers =
    useCallback(async () => {
      if (!workspaceId) {
        return [];
      }

      const {
        data: memberships,
        error: membershipError,
      } = await supabase
        .from("workspace_members")
        .select(
          `
            id,
            workspace_id,
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
        );

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

      let profiles = [];

      if (userIds.length) {
        const {
          data,
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

        profiles = data || [];
      }

      const profileMap =
        new Map(
          profiles.map(
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

          const roleKey =
            membership.role_key ||
            membership.role ||
            "campaign_member";

          return {
            membershipId:
              membership.id,

            userId:
              membership.user_id,

            fullName:
              profile?.full_name ||
              "Campaign User",

            email:
              profile?.email || "",

            roleKey,

            displayTitle:
              membership.display_title ||
              "Campaign Member",

            dashboardType:
              membership.dashboard_type ||
              "volunteer",

            seatType:
              membership.seat_type ||
              "volunteer",

            status:
              membership.status ||
              "active",
          };
        })
        .sort((left, right) => {
          const rankDifference =
            getAuthorityRank(
              left.roleKey,
            ) -
            getAuthorityRank(
              right.roleKey,
            );

          if (rankDifference) {
            return rankDifference;
          }

          return left.fullName.localeCompare(
            right.fullName,
          );
        });
    }, [workspaceId]);

  const loadTeam =
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
          const members =
            await loadMembers();

          setState({
            members,
          });

          setError("");
          setLastUpdated(
            new Date(),
          );
        } catch (loadError) {
          console.error(
            "Team & Access could not load:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Campaign members could not be refreshed.",
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        loadMembers,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadTeam({
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
  }, [loadTeam]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      refreshTimerRef.current =
        window.setTimeout(
          () => {
            loadTeam();
          },
          300,
        );
    };

    const channel = supabase
      .channel(
        `team-access-${workspaceId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
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
    loadTeam,
    workspaceId,
  ]);

  return {
    members: state.members,
    isLoading,
    error,
    lastUpdated,
    refresh: () =>
      loadTeam({
        showLoading: true,
      }),
  };
}
