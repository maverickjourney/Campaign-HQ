import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const REALTIME_DEBOUNCE_MS =
  300;


function clean(value) {
  return String(
    value ||
    "",
  ).trim();
}


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
              clean(value)
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


export function useWorkspaceEmailRealtime({
  workspaceId,
  enabled = true,
}) {
  const [
    notification,
    setNotification,
  ] = useState(null);

  const lastUnreadRef =
    useRef(null);

  const lastEventKeyRef =
    useRef("");

  const refreshTimerRef =
    useRef(null);


  const refreshEmailState =
    useCallback(
      async ({
        eventType = "",
        eventId = "",
        notify = false,
      } = {}) => {
        if (
          !enabled ||
          !workspaceId
        ) {
          return;
        }

        /*
         * CAMPAIGN SEAT LOCAL EMAIL UPDATE ECHO GUARD V1
         *
         * Marking an email read/unread inside Campaign Seat can
         * produce a Nylas message.updated webhook a moment later.
         *
         * The local Inbox has already updated its unread state,
         * so treating that webhook echo as a new provider change
         * creates unnecessary folder/thread refreshes and can
         * push Microsoft into rate limiting.
         *
         * External message.updated events still reconcile normally
         * because they do not have this local authority window.
         */
        if (
          eventType ===
            "message.updated"
        ) {
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
            // Local authority is only an optimization layer.
          }
        }

        try {
          const {
            data,
            error,
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
            error ||
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
            unread ===
              null
          ) {
            return;
          }

          let previous =
            lastUnreadRef
              .current;

          if (
            previous ===
              null
          ) {
            try {
              const cached =
                Number(
                  window.localStorage
                    .getItem(
                      `campaign-seat:inbox-unread:${workspaceId}`,
                    ),
                );

              previous =
                Number.isFinite(
                  cached,
                )
                  ? cached
                  : 0;
            } catch {
              previous =
                0;
            }
          }

          lastUnreadRef.current =
            unread;

          try {
            window.localStorage
              .setItem(
                `campaign-seat:inbox-unread:${workspaceId}`,
                String(
                  unread,
                ),
              );

            window.localStorage
              .removeItem(
                `campaign-seat:inbox-unread-authority:${workspaceId}`,
              );
          } catch {
            // Local synchronization is supplemental.
          }

          window.dispatchEvent(
            new CustomEvent(
              "campaign-seat-inbox-unread-count",
              {
                detail: {
                  workspaceId,
                  count:
                    unread,
                  source:
                    "provider-realtime",
                },
              },
            ),
          );

          window.dispatchEvent(
            new CustomEvent(
              "campaign-seat-email-provider-change",
              {
                detail: {
                  workspaceId,
                  eventType,
                  eventId,
                  unreadCount:
                    unread,
                },
              },
            ),
          );

          if (
            notify &&
            unread >
              Number(
                previous ||
                0,
              )
          ) {
            const message =
              unread ===
                1
                ? "You have 1 unread campaign email."
                : `You have ${unread} unread campaign emails.`;

            setNotification({
              id:
                eventId ||
                `${Date.now()}`,
              title:
                "New campaign email",
              message,
            });

            if (
              typeof Notification !==
                "undefined" &&
              Notification.permission ===
                "granted"
            ) {
              try {
                new Notification(
                  "New campaign email",
                  {
                    body:
                      message,
                  },
                );
              } catch {
                // In-app notification remains available.
              }
            }
          }
        } catch {
          /*
           * Existing timed refresh remains the safety
           * fallback when realtime reconciliation fails.
           */
        }
      },
      [
        enabled,
        workspaceId,
      ],
    );


  useEffect(
    () => {
      if (
        !enabled ||
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
          lastUnreadRef.current =
            cached;
        }
      } catch {
        lastUnreadRef.current =
          null;
      }

      const channel =
        supabase
          .channel(
            `workspace-email-realtime-${workspaceId}`,
          )
          .on(
            "postgres_changes",
            {
              event:
                "UPDATE",
              schema:
                "public",
              table:
                "workspace_integrations",
              filter:
                `workspace_id=eq.${workspaceId}`,
            },
            (
              payload,
            ) => {
              const row =
                payload?.new ||
                {};

              if (
                row
                  ?.integration_type !==
                  "email" ||
                row
                  ?.provider !==
                  "nylas"
              ) {
                return;
              }

              const settings =
                row?.settings ||
                {};

              const eventType =
                clean(
                  settings
                    ?.last_mailbox_event_type,
                );

              const eventId =
                clean(
                  settings
                    ?.last_mailbox_event_id,
                );

              const eventAt =
                clean(
                  settings
                    ?.last_mailbox_event_at,
                );

              if (
                !eventType ||
                (
                  !eventType
                    .startsWith(
                      "message.",
                    ) &&
                  eventType !==
                    "campaign_seat.send_success"
                )
              ) {
                return;
              }

              const eventKey =
                [
                  eventType,
                  eventId ||
                    eventAt,
                ].join(
                  ":",
                );

              if (
                eventKey &&
                eventKey ===
                  lastEventKeyRef
                    .current
              ) {
                return;
              }

              lastEventKeyRef.current =
                eventKey;

              window.clearTimeout(
                refreshTimerRef
                  .current,
              );

              refreshTimerRef.current =
                window.setTimeout(
                  () => {
                    void refreshEmailState({
                      eventType,
                      eventId,
                      notify:
                        eventType
                          .startsWith(
                            "message.created",
                          ),
                    });
                  },
                  REALTIME_DEBOUNCE_MS,
                );
            },
          )
          .subscribe();

      return () => {
        window.clearTimeout(
          refreshTimerRef
            .current,
        );

        supabase.removeChannel(
          channel,
        );
      };
    },
    [
      enabled,
      refreshEmailState,
      workspaceId,
    ],
  );


  useEffect(
    () => {
      if (
        !notification
      ) {
        return undefined;
      }

      const timeoutId =
        window.setTimeout(
          () => {
            setNotification(
              null,
            );
          },
          9000,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      notification,
    ],
  );


  return {
    notification,

    dismissNotification:
      () =>
        setNotification(
          null,
        ),
  };
}
