import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  tasks: [],
  team: [],
  comments: [],
};

function buildStatusFields(task, nextStatus, userId) {
  if (nextStatus === "in_progress") {
    return {
      status: nextStatus,
      started_at:
        task?.started_at || new Date().toISOString(),
      completed_at: null,
      completed_by: null,
      archived_at: null,
    };
  }

  if (nextStatus === "completed") {
    return {
      status: nextStatus,
      started_at:
        task?.started_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      completed_by: userId,
      archived_at: null,
    };
  }

  if (nextStatus === "archived") {
    return {
      status: nextStatus,
      archived_at: new Date().toISOString(),
    };
  }

  return {
    status: "open",
    completed_at: null,
    completed_by: null,
    archived_at: null,
  };
}

export function useTasksCommandCenter({
  workspaceId,
  userId,
  selectedTaskId,
}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshTimerRef = useRef(null);
  const teamRef = useRef([]);

  const loadTeam = useCallback(async () => {
    if (!workspaceId) {
      return [];
    }

    const { data: memberships, error: membershipError } =
      await supabase
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
        .eq("workspace_id", workspaceId)
        .eq("status", "active");

    if (membershipError) {
      throw membershipError;
    }

    const userIds = (memberships || []).map(
      (membership) => membership.user_id,
    );

    if (!userIds.length) {
      teamRef.current = [];
      return [];
    }

    const { data: profiles, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const team = (memberships || [])
      .map((membership) => {
        const profile = profileMap.get(
          membership.user_id,
        );

        return {
          id: membership.user_id,

          role:
            membership.role_key ||
            membership.role ||
            "campaign_member",

          roleKey:
            membership.role_key ||
            membership.role ||
            "campaign_member",

          roleName:
            membership.display_title ||
            "Campaign Member",

          displayTitle:
            membership.display_title ||
            "Campaign Member",

          dashboardType:
            membership.dashboard_type ||
            "volunteer",

          seatType:
            membership.seat_type ||
            "volunteer",

          fullName:
            profile?.full_name ||
            "Campaign User",

          email:
            profile?.email || "",
        };
      })
      .sort((left, right) => {
        const authorityOrder = {
          campaign_owner: 0,
          campaign_consultant: 1,
          campaign_manager: 2,
          department_lead: 3,
          staff: 4,
          team_captain: 5,
          reviewer: 6,
          volunteer: 7,
        };

        const leftRank =
          authorityOrder[left.roleKey] ?? 99;

        const rightRank =
          authorityOrder[right.roleKey] ?? 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.fullName.localeCompare(
          right.fullName,
        );
      });

    teamRef.current = team;

    return team;
  }, [workspaceId]);

  const loadTasks = useCallback(async () => {
    if (!workspaceId) {
      return [];
    }

    const { data, error: taskError } = await supabase
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
          visibility,
          tags,
          estimated_minutes,
          sort_order,
          due_at,
          assigned_to,
          created_by,
          started_at,
          completed_at,
          completed_by,
          archived_at,
          created_at,
          updated_at
        `,
      )
      .eq("workspace_id", workspaceId)
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", { ascending: false });

    if (taskError) {
      throw taskError;
    }

    return data || [];
  }, [workspaceId]);

  const loadComments = useCallback(
    async (taskId) => {
      if (!taskId) {
        setState((current) => ({
          ...current,
          comments: [],
        }));

        return [];
      }

      const { data, error: commentError } =
        await supabase
          .from("task_comments")
          .select(
            `
              id,
              workspace_id,
              task_id,
              author_id,
              body,
              is_edited,
              created_at,
              updated_at
            `,
          )
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });

      if (commentError) {
        throw commentError;
      }

      const teamMap = new Map(
        teamRef.current.map((member) => [
          member.id,
          member,
        ]),
      );

      const comments = (data || []).map((comment) => {
        const author = teamMap.get(comment.author_id);

        return {
          ...comment,
          authorName:
            author?.fullName || "Campaign User",
          authorRole:
            author?.displayTitle ||
            "Campaign Member",
        };
      });

      setState((current) => ({
        ...current,
        comments,
      }));

      return comments;
    },
    [],
  );

  const loadCommandCenter = useCallback(
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
        const [team, tasks] = await Promise.all([
          loadTeam(),
          loadTasks(),
        ]);

        setState((current) => ({
          ...current,
          team,
          tasks,
        }));

        setError("");
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error(
          "Task Command Center could not load:",
          loadError,
        );

        setError(
          "Campaign tasks could not be refreshed. Check the connection and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loadTasks, loadTeam, workspaceId],
  );

  useEffect(() => {
    loadCommandCenter({ showLoading: true });
  }, [loadCommandCenter]);

  useEffect(() => {
    if (!selectedTaskId) {
      setState((current) => ({
        ...current,
        comments: [],
      }));

      return;
    }

    loadComments(selectedTaskId).catch(
      (commentError) => {
        console.error(
          "Task comments could not load:",
          commentError,
        );
      },
    );
  }, [loadComments, selectedTaskId]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);

      refreshTimerRef.current = window.setTimeout(
        () => {
          loadCommandCenter();

          if (selectedTaskId) {
            loadComments(selectedTaskId);
          }
        },
        300,
      );
    };

    const channel = supabase
      .channel(`task-command-center-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [
    loadCommandCenter,
    loadComments,
    selectedTaskId,
    workspaceId,
  ]);

  const createTask = useCallback(
    async (taskData) => {
      setIsSaving(true);
      setError("");

      try {
        const statusFields = buildStatusFields(
          null,
          taskData.status || "open",
          userId,
        );

        const { data, error: createError } =
          await supabase
            .from("tasks")
            .insert({
              workspace_id: workspaceId,
              created_by: userId,
              title: taskData.title,
              description: taskData.description || null,
              category: taskData.category || "General",
              priority: taskData.priority || "normal",
              visibility:
                taskData.visibility || "workspace",
              tags: taskData.tags || [],
              estimated_minutes:
                taskData.estimated_minutes || null,
              due_at: taskData.due_at || null,
              assigned_to:
                taskData.assigned_to || null,
              is_sample: false,
              ...statusFields,
            })
            .select()
            .single();

        if (createError) {
          throw createError;
        }

        await loadCommandCenter();

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCommandCenter,
      userId,
      workspaceId,
    ],
  );

  const updateTask = useCallback(
    async (taskId, taskData) => {
      setIsSaving(true);
      setError("");

      try {
        const currentTask = state.tasks.find(
          (task) => task.id === taskId,
        );

        const statusFields =
          taskData.status &&
          taskData.status !== currentTask?.status
            ? buildStatusFields(
                currentTask,
                taskData.status,
                userId,
              )
            : {};

        const { data, error: updateError } =
          await supabase
            .from("tasks")
            .update({
              ...taskData,
              ...statusFields,
            })
            .eq("id", taskId)
            .eq("workspace_id", workspaceId)
            .select()
            .single();

        if (updateError) {
          throw updateError;
        }

        await loadCommandCenter();

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCommandCenter,
      state.tasks,
      userId,
      workspaceId,
    ],
  );

  const changeTaskStatus = useCallback(
    async (task, nextStatus) => {
      return updateTask(task.id, {
        ...buildStatusFields(
          task,
          nextStatus,
          userId,
        ),
      });
    },
    [updateTask, userId],
  );

  const addComment = useCallback(
    async (taskId, body) => {
      const trimmedBody = body.trim();

      if (!trimmedBody) {
        return null;
      }

      setIsSaving(true);

      try {
        const { data, error: commentError } =
          await supabase
            .from("task_comments")
            .insert({
              workspace_id: workspaceId,
              task_id: taskId,
              author_id: userId,
              body: trimmedBody,
            })
            .select()
            .single();

        if (commentError) {
          throw commentError;
        }

        await loadComments(taskId);

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadComments,
      userId,
      workspaceId,
    ],
  );

  return {
    tasks: state.tasks,
    team: state.team,
    comments: state.comments,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadCommandCenter({ showLoading: true }),
    createTask,
    updateTask,
    changeTaskStatus,
    addComment,
  };
}
