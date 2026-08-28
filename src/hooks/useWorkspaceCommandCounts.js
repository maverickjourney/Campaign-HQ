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
  inbox: 0,
  tasks: 0,
  waiting_on: 0,
  approvals: 0,
};


/*
 * Realtime webhook events now update Inbox unread state.
 * This provider request is only a missed-event safety net.
 */
const INBOX_BADGE_REFRESH_MS =
  10 * 60 * 1000;

const INBOX_BADGE_REFRESH_COOLDOWN_MS =
  2 * 60 * 1000;


function inboxUnreadFromFolders(
  folders,
) {
  const rows =
    Array.isArray(
      folders,
    )
      ? folders
      : [];

  const inbox =
    rows.find(
      (folder) => {
        const values = [
          folder?.id,
          folder?.name,
          folder?.display_name,
          folder?.system_folder,
          ...(
            Array.isArray(
              folder?.attributes,
            )
              ? folder.attributes
              : []
          ),
        ]
          .map(
            (value) =>
              String(
                value ||
                "",
              )
                .trim()
                .toLowerCase(),
          )
          .filter(Boolean);

        return values.some(
          (value) =>
            value ===
              "inbox" ||
            value ===
              "\\inbox" ||
            value.endsWith(
              "/inbox",
            ),
        );
      },
    );

  const count =
    Number(
      inbox?.unread_count,
    );

  return (
    Number.isFinite(
      count,
    ) &&
    count >=
      0
      ? Math.floor(
          count,
        )
      : null
  );
}


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


  const inboxRefreshTimerRef =
    useRef(null);

  const lastInboxProviderRefreshAtRef =
    useRef(0);


  const setInboxCount =
    useCallback(
      (
        nextCount,
      ) => {
        const numeric =
          Number(
            nextCount,
          );

        if (
          !Number.isFinite(
            numeric,
          )
        ) {
          return;
        }

        const safeCount =
          Math.max(
            0,
            Math.floor(
              numeric,
            ),
          );

        setCounts(
          (current) => ({
            ...current,
            inbox:
              safeCount,
          }),
        );

        if (
          workspaceId
        ) {
          try {
            window.localStorage
              .setItem(
                `campaign-seat:inbox-unread:${workspaceId}`,
                String(
                  safeCount,
                ),
              );
          } catch {
            // Local badge persistence is optional.
          }
        }
      },
      [
        workspaceId,
      ],
    );


  const loadInboxUnread =
    useCallback(
      async () => {
        if (
          !workspaceId ||
          typeof document ===
            "undefined" ||
          document
            .visibilityState ===
            "hidden"
        ) {
          return;
        }

        /*
         * Inbox owns its own webhook-driven mailbox refresh.
         * Never duplicate provider traffic from the shell.
         */
        if (
          window.location
            .pathname ===
          "/inbox"
        ) {
          return;
        }

        try {
          const authorityUntil =
            Number(
              window.localStorage
                .getItem(
                  `campaign-seat:inbox-unread-authority:${workspaceId}`,
                ) ||
                0,
            );

          if (
            Number.isFinite(
              authorityUntil,
            ) &&
            Date.now() <
              authorityUntil
          ) {
            return;
          }
        } catch {
          // Local read authority is optional.
        }


        const now =
          Date.now();

        if (
          now -
            lastInboxProviderRefreshAtRef.current <
          INBOX_BADGE_REFRESH_COOLDOWN_MS
        ) {
          return;
        }

        lastInboxProviderRefreshAtRef.current =
          now;

        try {
          const {
            data,
            error:
              mailboxError,
          } =
            await supabase
              .functions
              .invoke(
                "nylas-mailbox",
                {
                  body: {
                    workspaceId,
                    action:
                      "list_folders",
                  },
                },
              );

          if (
            mailboxError ||
            data?.success !==
              true
          ) {
            return;
          }

          const unread =
            inboxUnreadFromFolders(
              data?.data,
            );

          if (
            unread !==
              null
          ) {
            /*
             * The shared shell already performs this mailbox
             * check outside Inbox. Reuse the trustworthy provider
             * unread count to bridge missed Nylas webhooks into
             * the normal Campaign Seat Activity Center.
             *
             * This adds no additional provider request.
             */
            try {
              const {
                data:
                  reconciliation,

                error:
                  reconciliationError,
              } =
                await supabase.rpc(
                  "reconcile_email_unread_activity",
                  {
                    target_workspace_id:
                      workspaceId,

                    target_unread_count:
                      unread,
                  },
                );

              if (
                reconciliationError
              ) {
                console.warn(
                  "Campaign Seat email Activity Center reconciliation failed:",
                  reconciliationError,
                );
              }

              /*
               * Supabase Realtime remains the primary Activity
               * Center transport. This local event guarantees
               * that the same browser refreshes its bell even if
               * the realtime socket briefly reconnects.
               */
              if (
                !reconciliationError &&
                reconciliation
                  ?.notified ===
                  true
              ) {
                window.dispatchEvent(
                  new CustomEvent(
                    "campaign-seat-activity-refresh",
                    {
                      detail: {
                        workspaceId,
                        source:
                          "email",
                      },
                    },
                  ),
                );
              }
            } catch (
              reconciliationError
            ) {
              console.warn(
                "Campaign Seat email Activity Center reconciliation failed:",
                reconciliationError,
              );
            }

            setInboxCount(
              unread,
            );
          }
        } catch {
          /*
           * Sidebar unread is supplemental.
           * Keep the last trustworthy number on transient
           * provider errors instead of flashing back to zero.
           */
        }
      },
      [
        setInboxCount,
        workspaceId,
      ],
    );


  const loadCounts =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setCounts(
            (current) => ({
              ...EMPTY_COUNTS,
              inbox:
                current.inbox ||
                0,
            }),
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


          setCounts(
            (current) => ({
              ...current,

              tasks:
                tasksResult.count ||
                0,

              waiting_on:
                waitingResult.count ||
                0,

              approvals:
                approvalsResult.count ||
                0,
            }),
          );


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


  useEffect(
    () => {
      if (
        !workspaceId
      ) {
        return undefined;
      }

      try {
        const cached =
          Number(
            window.localStorage
              .getItem(
                `campaign-seat:inbox-unread:${workspaceId}`,
              ),
          );

        if (
          Number.isFinite(
            cached,
          )
        ) {
          setInboxCount(
            cached,
          );
        }
      } catch {
        // Cached badge is optional.
      }

      const handleInboxUnread =
        (
          event,
        ) => {
          if (
            event?.detail
              ?.workspaceId !==
            workspaceId
          ) {
            return;
          }

          setInboxCount(
            event?.detail
              ?.count,
          );
        };

      const handleVisibility =
        () => {
          if (
            document
              .visibilityState ===
              "visible"
          ) {
            void loadInboxUnread();
          }
        };

      const handleFocus =
        () => {
          void loadInboxUnread();
        };

      window.addEventListener(
        "campaign-seat-inbox-unread-count",
        handleInboxUnread,
      );

      document.addEventListener(
        "visibilitychange",
        handleVisibility,
      );

      window.addEventListener(
        "focus",
        handleFocus,
      );

      void loadInboxUnread();

      inboxRefreshTimerRef.current =
        window.setInterval(
          () => {
            void loadInboxUnread();
          },
          INBOX_BADGE_REFRESH_MS,
        );

      return () => {
        window.clearInterval(
          inboxRefreshTimerRef.current,
        );

        window.removeEventListener(
          "campaign-seat-inbox-unread-count",
          handleInboxUnread,
        );

        document.removeEventListener(
          "visibilitychange",
          handleVisibility,
        );

        window.removeEventListener(
          "focus",
          handleFocus,
        );
      };
    },
    [
      loadInboxUnread,
      setInboxCount,
      workspaceId,
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
