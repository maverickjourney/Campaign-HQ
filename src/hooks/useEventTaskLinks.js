import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

export function useEventTaskLinks({
  workspaceId,
  userId,
}) {
  const [
    links,
    setLinks,
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

  const loadLinks =
    useCallback(
      async () => {
        if (!workspaceId) {
          setLinks([]);
          setIsLoading(false);

          return [];
        }

        try {
          const {
            data,
            error:
              linksError,
          } = await supabase
            .from(
              "event_task_links",
            )
            .select(
              `
                id,
                workspace_id,
                event_id,
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
                ascending: true,
              },
            );

          if (linksError) {
            throw linksError;
          }

          const nextLinks =
            data || [];

          setLinks(
            nextLinks,
          );

          setError("");

          return nextLinks;
        } catch (
          loadError
        ) {
          console.error(
            "Event task links could not load:",
            loadError,
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Linked event tasks could not be loaded.",
          );

          return [];
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );

  useEffect(() => {
    loadLinks();
  }, [
    loadLinks,
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
              loadLinks();
            },
            250,
          );
      };

    const channel =
      supabase
        .channel(
          `event-task-links-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "event_task_links",
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
    loadLinks,
    workspaceId,
  ]);

  const linkTask =
    useCallback(
      async (
        eventId,
        taskId,
      ) => {
        if (
          !workspaceId ||
          !userId ||
          !eventId ||
          !taskId
        ) {
          return null;
        }

        setIsSaving(
          true,
        );

        setError("");

        try {
          const {
            data,
            error:
              insertError,
          } = await supabase
            .from(
              "event_task_links",
            )
            .insert({
              workspace_id:
                workspaceId,

              event_id:
                eventId,

              task_id:
                taskId,

              created_by:
                userId,
            })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          await loadLinks();

          return data;
        } catch (
          linkError
        ) {
          console.error(
            "Task could not be linked to event:",
            linkError,
          );

          setError(
            linkError instanceof
              Error
              ? linkError.message
              : "The task could not be linked to this event.",
          );

          throw linkError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        loadLinks,
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

        setIsSaving(
          true,
        );

        setError("");

        try {
          const {
            error:
              deleteError,
          } = await supabase
            .from(
              "event_task_links",
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

          await loadLinks();
        } catch (
          unlinkError
        ) {
          console.error(
            "Task could not be unlinked from event:",
            unlinkError,
          );

          setError(
            unlinkError instanceof
              Error
              ? unlinkError.message
              : "The task could not be removed from this event.",
          );

          throw unlinkError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        loadLinks,
        workspaceId,
      ],
    );

  return {
    links,
    isLoading,
    isSaving,
    error,
    refresh:
      loadLinks,
    linkTask,
    unlinkTask,
  };
}
