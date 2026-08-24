import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const EMPTY_COUNTS = {
  tasks: 0,
  waiting_on: 0,
  approvals: 0,
};


export function useWorkspaceCommandCounts(
  workspaceId,
) {
  const [
    counts,
    setCounts,
  ] = useState(
    EMPTY_COUNTS,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const refreshTimerRef =
    useRef(null);


  const loadCounts =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setCounts(
            EMPTY_COUNTS,
          );

          setIsLoading(false);
          setError("");

          return;
        }


        if (showLoading) {
          setIsLoading(true);
        }


        try {
          const [
            tasksResult,
            waitingResult,
            approvalsResult,
          ] =
            await Promise.all([
              supabase
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
                ),


              supabase
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
                )
                .contains(
                  "tags",
                  [
                    "waiting-on",
                  ],
                ),


              supabase
                .from(
                  "approvals",
                )
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
                    "pending",
                    "changes_requested",
                  ],
                ),
            ]);


          const failed =
            [
              tasksResult,
              waitingResult,
              approvalsResult,
            ].find(
              (result) =>
                result.error,
            );


          if (failed?.error) {
            throw failed.error;
          }


          setCounts({
            tasks:
              tasksResult.count ||
              0,

            waiting_on:
              waitingResult.count ||
              0,

            approvals:
              approvalsResult.count ||
              0,
          });


          setError("");
        } catch (
          loadError
        ) {
          console.error(
            "Campaign Seat command counts could not be loaded:",
            loadError,
          );


          /*
           * Never substitute demonstration numbers if live
           * data is unavailable.
           */
          setCounts(
            EMPTY_COUNTS,
          );

          setError(
            "Live workspace counts are temporarily unavailable.",
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        workspaceId,
      ],
    );


  const scheduleRefresh =
    useCallback(
      () => {
        window.clearTimeout(
          refreshTimerRef.current,
        );


        refreshTimerRef.current =
          window.setTimeout(
            () => {
              void loadCounts();
            },
            250,
          );
      },
      [
        loadCounts,
      ],
    );


  useEffect(() => {
    void loadCounts({
      showLoading: true,
    });


    if (!workspaceId) {
      return undefined;
    }


    let channel =
      supabase.channel(
        `workspace-command-counts-${workspaceId}`,
      );


    [
      "tasks",
      "approvals",
    ].forEach(
      (table) => {
        channel =
          channel.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter:
                `workspace_id=eq.${workspaceId}`,
            },
            scheduleRefresh,
          );
      },
    );


    channel.subscribe();


    return () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      supabase.removeChannel(
        channel,
      );
    };
  }, [
    loadCounts,
    scheduleRefresh,
    workspaceId,
  ]);


  return {
    counts,
    isLoading,
    error,

    refresh:
      () =>
        loadCounts({
          showLoading: true,
        }),
  };
}
