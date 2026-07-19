import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

export function useVolunteerTasks({
  workspaceId,
  userId,
}) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const loadTasks = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId || !userId) {
        setTasks([]);
        setIsLoading(false);
        return [];
      }

      if (showLoading) {
        setIsLoading(true);
      }

      setError("");

      try {
        const { data, error: loadError } = await supabase
          .from("tasks")
          .select(
            "id, workspace_id, title, description, category, priority, status, due_at, assigned_to, created_at, updated_at",
          )
          .eq("workspace_id", workspaceId)
          .eq("assigned_to", userId)
          .neq("status", "archived")
          .order("due_at", {
            ascending: true,
            nullsFirst: false,
          });

        if (loadError) {
          throw loadError;
        }

        setTasks(data || []);
        setLastUpdated(new Date());
        return data || [];
      } catch (loadError) {
        console.error(
          "Volunteer assignments could not be loaded:",
          loadError,
        );
        setError("Your assigned work could not be refreshed.");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [userId, workspaceId],
  );

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      loadTasks({ showLoading: true });
    }, 0);

    return () => {
      window.clearTimeout(initialLoadTimer);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!workspaceId || !userId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        loadTasks();
      }, 300);
    };

    const channel = supabase
      .channel(`volunteer-tasks-${workspaceId}-${userId}`)
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
      .subscribe();

    return () => {
      window.clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadTasks, userId, workspaceId]);

  const updateStatus = useCallback(
    async (taskId, nextStatus) => {
      setIsSaving(true);
      setError("");

      try {
        const { data, error: updateError } = await supabase.rpc(
          "update_assigned_task_status",
          {
            target_task_id: taskId,
            target_status: nextStatus,
          },
        );

        if (updateError) {
          throw updateError;
        }

        await loadTasks();
        return Array.isArray(data) ? data[0] || null : data;
      } catch (updateError) {
        console.error(
          "Volunteer task status could not be updated:",
          updateError,
        );
        setError(
          updateError?.message ||
            "The task status could not be updated.",
        );
        throw updateError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadTasks],
  );

  return {
    tasks,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () => loadTasks({ showLoading: true }),
    updateStatus,
  };
}
