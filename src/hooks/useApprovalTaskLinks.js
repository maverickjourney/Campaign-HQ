import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

export function useApprovalTaskLinks({
  workspaceId,
  userId,
}) {
  const [
    links,
    setLinks,
  ] = useState([]);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const refreshTimerRef =
    useRef(null);

  const loadData =
    useCallback(
      async () => {
        if (!workspaceId) {
          setLinks([]);
          setTasks([]);
          setIsLoading(false);
          return {
            links: [],
            tasks: [],
          };
        }

        try {
          const [
            linksResult,
            tasksResult,
          ] = await Promise.all([
            supabase
              .from(
                "approval_task_links",
              )
              .select(
                `
                  id,
                  workspace_id,
                  approval_id,
                  task_id,
                  created_by,
                  created_at
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                },
              ),

            supabase
              .from("tasks")
              .select(
                `
                  id,
                  workspace_id,
                  title,
                  category,
                  priority,
                  status,
                  due_at,
                  assigned_to,
                  created_by,
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
                  ascending:
                    true,
                  nullsFirst:
                    false,
                },
              )
              .order(
                "updated_at",
                {
                  ascending:
                    false,
                },
              ),
          ]);

          /*
           * Keep the source pass backward compatible before
           * the V59 migration is applied to the live project.
           */
          if (
            linksResult.error &&
            linksResult.error.code !==
              "42P01"
          ) {
            throw linksResult.error;
          }

          if (tasksResult.error) {
            throw tasksResult.error;
          }

          const nextLinks =
            linksResult.error
              ? []
              : linksResult.data ||
                [];

          const nextTasks =
            tasksResult.data ||
            [];

          setLinks(
            nextLinks,
          );

          setTasks(
            nextTasks,
          );

          setError("");

          return {
            links:
              nextLinks,
            tasks:
              nextTasks,
          };
        } catch (loadError) {
          console.error(
            "Approval task links could not load:",
            loadError,
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Approval task links could not be loaded.",
          );

          return {
            links: [],
            tasks: [],
          };
        } finally {
          setIsLoading(false);
        }
      },
      [
        workspaceId,
      ],
    );

  useEffect(() => {
    loadData();
  }, [
    loadData,
  ]);

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
              loadData();
            },
            250,
          );
      };

    const channel =
      supabase
        .channel(
          `approval-task-links-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "approval_task_links",
            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "tasks",
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
    loadData,
    workspaceId,
  ]);

  const linkTask =
    useCallback(
      async (
        approvalId,
        taskId,
      ) => {
        if (
          !workspaceId ||
          !userId ||
          !approvalId ||
          !taskId
        ) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error:
              insertError,
          } = await supabase
            .from(
              "approval_task_links",
            )
            .insert({
              workspace_id:
                workspaceId,

              approval_id:
                approvalId,

              task_id:
                taskId,

              created_by:
                userId,
            })
            .select()
            .single();

          if (insertError) {
            if (
              insertError.code ===
              "23505"
            ) {
              await loadData();
              return null;
            }

            throw insertError;
          }

          await loadData();

          return data;
        } catch (linkError) {
          console.error(
            "Task could not be linked to approval:",
            linkError,
          );

          setError(
            linkError instanceof
              Error
              ? linkError.message
              : "The task could not be linked to this approval.",
          );

          throw linkError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadData,
        userId,
        workspaceId,
      ],
    );

  const unlinkTask =
    useCallback(
      async (
        linkId,
      ) => {
        if (
          !workspaceId ||
          !linkId
        ) {
          return;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            error:
              deleteError,
          } = await supabase
            .from(
              "approval_task_links",
            )
            .delete()
            .eq(
              "id",
              linkId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (deleteError) {
            throw deleteError;
          }

          await loadData();
        } catch (
          unlinkError
        ) {
          console.error(
            "Task could not be unlinked from approval:",
            unlinkError,
          );

          setError(
            unlinkError instanceof
              Error
              ? unlinkError.message
              : "The task could not be removed from this approval.",
          );

          throw unlinkError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadData,
        workspaceId,
      ],
    );

  return {
    links,
    tasks,
    isLoading,
    isSaving,
    error,
    refresh:
      loadData,
    linkTask,
    unlinkTask,
  };
}
