import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const CACHE_PREFIX =
  "campaign-hq-active-task-count:";

function getCacheKey(workspaceId) {
  return `${CACHE_PREFIX}${workspaceId}`;
}

function readCachedCount(workspaceId) {
  if (
    !workspaceId ||
    typeof window === "undefined"
  ) {
    return null;
  }

  const storedValue =
    window.sessionStorage.getItem(
      getCacheKey(workspaceId),
    );

  if (storedValue === null) {
    return null;
  }

  const parsedValue =
    Number(storedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function saveCachedCount(
  workspaceId,
  count,
) {
  if (
    !workspaceId ||
    typeof window === "undefined"
  ) {
    return;
  }

  window.sessionStorage.setItem(
    getCacheKey(workspaceId),
    String(count),
  );
}

export function useActiveTaskCount(
  workspaceId,
) {
  const [
    count,
    setCount,
  ] = useState(
    () => readCachedCount(workspaceId),
  );

  const refreshCount =
    useCallback(async () => {
      if (!workspaceId) {
        return;
      }

      const {
        count: databaseCount,
        error,
      } = await supabase
        .from("tasks")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .in(
          "status",
          [
            "open",
            "in_progress",
          ],
        );

      if (error) {
        console.error(
          "Active task count could not be loaded:",
          error,
        );

        return;
      }

      const nextCount =
        databaseCount || 0;

      saveCachedCount(
        workspaceId,
        nextCount,
      );

      setCount(nextCount);
    }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          refreshCount();
        },
        0,
      );

    const channel =
      supabase
        .channel(
          `active-task-count-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          () => {
            refreshCount();
          },
        )
        .subscribe();

    return () => {
      window.clearTimeout(
        timeoutId,
      );

      supabase.removeChannel(
        channel,
      );
    };
  }, [
    refreshCount,
    workspaceId,
  ]);

  return {
    count,
    refreshCount,
  };
}
