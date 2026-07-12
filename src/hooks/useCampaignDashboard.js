import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_DASHBOARD_DATA = {
  tasks: [],
  events: [],
  approvals: [],
  activity: [],
  metrics: [],
  volunteerCount: 0,
};

export function useCampaignDashboard(workspaceId) {
  const [data, setData] = useState(EMPTY_DASHBOARD_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshTimerRef = useRef(null);

  const loadDashboard = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId) {
        setError("No campaign workspace is selected.");
        setIsLoading(false);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const beginningOfToday = new Date();
        beginningOfToday.setHours(0, 0, 0, 0);

        const [
          tasksResult,
          eventsResult,
          approvalsResult,
          activityResult,
          metricsResult,
          volunteersResult,
        ] = await Promise.all([
          supabase
            .from("tasks")
            .select(
              `
                id,
                workspace_id,
                title,
                description,
                category,
                priority,
                status,
                due_at,
                assigned_to,
                created_by,
                completed_at,
                created_at,
                updated_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .neq("status", "archived")
            .order("due_at", {
              ascending: true,
              nullsFirst: false,
            })
            .limit(50),

          supabase
            .from("events")
            .select(
              `
                id,
                workspace_id,
                title,
                description,
                event_type,
                location,
                starts_at,
                ends_at,
                status,
                capacity,
                rsvp_count,
                created_at,
                updated_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .eq("status", "scheduled")
            .gte(
              "starts_at",
              beginningOfToday.toISOString(),
            )
            .order("starts_at", { ascending: true })
            .limit(20),

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
                created_at,
                updated_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .in("status", [
              "draft",
              "pending",
              "changes_requested",
            ])
            .order("due_at", {
              ascending: true,
              nullsFirst: false,
            })
            .limit(30),

          supabase
            .from("activity_log")
            .select(
              `
                id,
                workspace_id,
                actor_user_id,
                activity_type,
                title,
                detail,
                entity_type,
                entity_id,
                occurred_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .order("occurred_at", { ascending: false })
            .limit(12),

          supabase
            .from("campaign_metrics")
            .select(
              `
                id,
                workspace_id,
                metric_date,
                volunteer_shifts_filled,
                volunteer_shifts_goal,
                event_rsvps,
                doors_knocked,
                contacts_total,
                messages_sent,
                messages_opened,
                campaign_readiness,
                campaign_health,
                field_health,
                events_health,
                communications_health,
                volunteers_health
              `,
            )
            .eq("workspace_id", workspaceId)
            .order("metric_date", { ascending: false })
            .limit(14),

          supabase
            .from("volunteers")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("workspace_id", workspaceId)
            .in("status", ["new", "active"]),
        ]);

        const results = [
          tasksResult,
          eventsResult,
          approvalsResult,
          activityResult,
          metricsResult,
          volunteersResult,
        ];

        const failedResult = results.find(
          (result) => result.error,
        );

        if (failedResult?.error) {
          throw failedResult.error;
        }

        setData({
          tasks: tasksResult.data || [],
          events: eventsResult.data || [],
          approvals: approvalsResult.data || [],
          activity: activityResult.data || [],
          metrics: [...(metricsResult.data || [])].reverse(),
          volunteerCount: volunteersResult.count || 0,
        });

        setError("");
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error(
          "Campaign dashboard could not be loaded:",
          loadError,
        );

        setError(
          "Campaign data could not be refreshed. Your last available information is still displayed.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId],
  );

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimerRef.current);

    refreshTimerRef.current = window.setTimeout(() => {
      loadDashboard();
    }, 350);
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard({ showLoading: true });

    if (!workspaceId) {
      return undefined;
    }

    const tables = [
      "tasks",
      "events",
      "approvals",
      "volunteers",
      "activity_log",
      "campaign_metrics",
    ];

    let channel = supabase.channel(
      `campaign-dashboard-${workspaceId}`,
    );

    tables.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      );
    });

    channel.subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadDashboard, scheduleRefresh, workspaceId]);

  const updateTaskStatus = useCallback(
    async (taskId, nextStatus) => {
      const completedAt =
        nextStatus === "completed"
          ? new Date().toISOString()
          : null;

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: nextStatus,
          completed_at: completedAt,
        })
        .eq("id", taskId)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        throw updateError;
      }

      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: nextStatus,
                completed_at: completedAt,
              }
            : task,
        ),
      }));

      await loadDashboard();
    },
    [loadDashboard, workspaceId],
  );

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh: () => loadDashboard({ showLoading: true }),
    updateTaskStatus,
  };
}
