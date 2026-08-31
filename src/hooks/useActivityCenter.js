import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  activities: [],
  profiles: {},
  readIds: [],
};


// CAMPAIGN SEAT TARGETED TASK ALERT FEED
const TASK_ALERT_ID_PREFIX =
  "task-alert:";

function getTaskAlertFeedId(
  alertId,
) {
  return `${TASK_ALERT_ID_PREFIX}${alertId}`;
}

function isTaskAlertFeedId(
  value,
) {
  return String(
    value || "",
  ).startsWith(
    TASK_ALERT_ID_PREFIX,
  );
}

function getRawTaskAlertId(
  value,
) {
  return String(
    value || "",
  ).slice(
    TASK_ALERT_ID_PREFIX.length,
  );
}

function normalizeTaskAlert(
  alert,
) {
  return {
    id:
      getTaskAlertFeedId(
        alert.id,
      ),

    source_type:
      "task_alert",

    source_id:
      alert.id,

    workspace_id:
      alert.workspace_id,

    actor_user_id:
      null,

    activity_type:
      alert.alert_type,

    title:
      alert.title,

    detail:
      alert.detail,

    entity_type:
      "task",

    entity_id:
      alert.task_id,

    route:
      alert.route ||
      "/tasks",

    metadata: {
      ...(alert.metadata || {}),

      task_alert_id:
        alert.id,

      reminder_id:
        alert.reminder_id,

      scheduled_for:
        alert.scheduled_for,
    },

    occurred_at:
      alert.delivered_at ||
      alert.scheduled_for,
  };
}

function getActivityErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign activity could not be loaded.";

  if (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes(
      "activity_read_receipts",
    )
  ) {
    return "The Activity Center database setup has not been activated yet. Run the Activity Center SQL, then refresh.";
  }

  return message;
}

export function useActivityCenter({
  workspaceId,
  userId,
}) {
  const [state, setState] =
    useState(EMPTY_STATE);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const refreshTimerRef =
    useRef(null);

  const loadActivity =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (
          !workspaceId ||
          !userId
        ) {
          setState(
            EMPTY_STATE,
          );
          setError(
            "The active campaign workspace or user session is missing.",
          );
          setIsLoading(false);
          return EMPTY_STATE;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const {
            data: activities,
            error: activityError,
          } = await supabase
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
                route,
                metadata,
                occurred_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .order(
              "occurred_at",
              {
                ascending: false,
              },
            )
            .limit(60);

          if (activityError) {
            throw activityError;
          }

          const {
            data: taskAlerts,
            error: taskAlertsError,
          } = await supabase
            .from(
              "task_alerts",
            )
            .select(
              `
                id,
                workspace_id,
                task_id,
                reminder_id,
                recipient_user_id,
                alert_type,
                title,
                detail,
                route,
                scheduled_for,
                delivered_at,
                read_at,
                metadata
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "recipient_user_id",
              userId,
            )
            .order(
              "delivered_at",
              {
                ascending: false,
              },
            )
            .limit(60);

          if (taskAlertsError) {
            throw taskAlertsError;
          }

          const normalizedTaskAlerts =
            (taskAlerts || []).map(
              normalizeTaskAlert,
            );

          /*
           * Deadline updates can arrive through both:
           *
           * 1. activity_log as generic "Task updated"
           * 2. task_alerts as the more useful
           *    "Task deadline updated: ..."
           *
           * Keep the specific deadline alert and suppress only
           * the matching generic duplicate for the same task
           * within the same update window.
           */
          const deadlineTaskAlerts =
            normalizedTaskAlerts.filter(
              (activity) =>
                activity.entity_type ===
                  "task" &&
                String(
                  activity.title ||
                    "",
                )
                  .trim()
                  .toLowerCase()
                  .startsWith(
                    "task deadline updated",
                  ),
            );

          const visibleActivityRows =
            (activities || []).filter(
              (activity) => {
                if (
                  activity.activity_type !==
                    "task_updated" ||
                  activity.entity_type !==
                    "task" ||
                  !activity.entity_id
                ) {
                  return true;
                }

                const activityTime =
                  new Date(
                    activity.occurred_at,
                  ).getTime();

                if (
                  !Number.isFinite(
                    activityTime,
                  )
                ) {
                  return true;
                }

                const genericTaskTitle =
                  String(
                    activity.detail ||
                      "",
                  )
                    .trim()
                    .toLowerCase();

                const matchingDeadlineAlert =
                  deadlineTaskAlerts.some(
                    (alert) => {
                      if (
                        alert.entity_id !==
                        activity.entity_id
                      ) {
                        return false;
                      }

                      const alertTaskTitle =
                        String(
                          alert.title ||
                            "",
                        )
                          .replace(
                            /^task deadline updated:\s*/i,
                            "",
                          )
                          .trim()
                          .toLowerCase();

                      if (
                        !genericTaskTitle ||
                        !alertTaskTitle ||
                        alertTaskTitle !==
                          genericTaskTitle
                      ) {
                        return false;
                      }

                      const alertTime =
                        new Date(
                          alert.occurred_at,
                        ).getTime();

                      if (
                        !Number.isFinite(
                          alertTime,
                        )
                      ) {
                        return false;
                      }

                      return (
                        Math.abs(
                          alertTime -
                            activityTime,
                        ) <=
                        120000
                      );
                    },
                  );

                return (
                  !matchingDeadlineAlert
                );
              },
            );

          const combinedActivities = [
            ...visibleActivityRows,
            ...normalizedTaskAlerts,
          ]
            .sort(
              (left, right) =>
                new Date(
                  right.occurred_at,
                ).getTime() -
                new Date(
                  left.occurred_at,
                ).getTime(),
            )
            .slice(
              0,
              60,
            );

          const actorIds = [
            ...new Set(
              combinedActivities
                .map(
                  (activity) =>
                    activity.actor_user_id,
                )
                .filter(Boolean),
            ),
          ];

          const [
            readsResult,
            profilesResult,
          ] = await Promise.all([
            supabase
              .from(
                "activity_read_receipts",
              )
              .select(
                "activity_id, read_at",
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .eq(
                "user_id",
                userId,
              ),
            actorIds.length
              ? supabase
                  .from("profiles")
                  .select(
                    "id, full_name, email",
                  )
                  .in(
                    "id",
                    actorIds,
                  )
              : Promise.resolve({
                  data: [],
                  error: null,
                }),
          ]);

          if (readsResult.error) {
            throw readsResult.error;
          }

          if (profilesResult.error) {
            throw profilesResult.error;
          }

          const profiles =
            Object.fromEntries(
              (
                profilesResult.data ||
                []
              ).map(
                (profile) => [
                  profile.id,
                  profile,
                ],
              ),
            );

          const nextState = {
            activities:
              combinedActivities,

            profiles,

            readIds: [
              ...(
                readsResult.data ||
                []
              ).map(
                (receipt) =>
                  receipt.activity_id,
              ),

              ...(taskAlerts || [])
                .filter(
                  (alert) =>
                    Boolean(
                      alert.read_at,
                    ),
                )
                .map(
                  (alert) =>
                    getTaskAlertFeedId(
                      alert.id,
                    ),
                ),
            ],
          };

          setState(
            nextState,
          );
          setError("");
          setLastUpdated(
            new Date(),
          );

          return nextState;
        } catch (loadError) {
          setError(
            getActivityErrorMessage(
              loadError,
            ),
          );

          return EMPTY_STATE;
        } finally {
          setIsLoading(false);
        }
      },
      [
        userId,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadActivity({
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
  }, [loadActivity]);

  useEffect(() => {
    if (
      !workspaceId ||
      !userId
    ) {
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
              loadActivity();
            },
            250,
          );
      };

    const handleLocalActivityRefresh =
      (
        event,
      ) => {
        const eventWorkspaceId =
          event?.detail
            ?.workspaceId;

        if (
          eventWorkspaceId &&
          eventWorkspaceId !==
            workspaceId
        ) {
          return;
        }

        scheduleRefresh();
      };

    window.addEventListener(
      "campaign-seat-activity-refresh",
      handleLocalActivityRefresh,
    );

    const channel = supabase
      .channel(
        `campaign-activity-center-${workspaceId}-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_log",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "activity_read_receipts",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "task_alerts",
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

      window.removeEventListener(
        "campaign-seat-activity-refresh",
        handleLocalActivityRefresh,
      );

      supabase.removeChannel(
        channel,
      );
    };
  }, [
    loadActivity,
    userId,
    workspaceId,
  ]);

  const readIdSet =
    useMemo(
      () =>
        new Set(
          state.readIds,
        ),
      [state.readIds],
    );

  const unreadCount =
    useMemo(
      () =>
        state.activities.filter(
          (activity) =>
            !readIdSet.has(
              activity.id,
            ),
        ).length,
      [
        readIdSet,
        state.activities,
      ],
    );

  const markActivityRead =
    useCallback(
      async (activityId) => {
        if (
          !activityId ||
          !workspaceId ||
          !userId ||
          readIdSet.has(
            activityId,
          )
        ) {
          return;
        }

        setIsSaving(true);
        setError("");

        try {
          if (
            isTaskAlertFeedId(
              activityId,
            )
          ) {
            const {
              error: saveError,
            } = await supabase.rpc(
              "mark_task_alert_read",
              {
                target_alert_id:
                  getRawTaskAlertId(
                    activityId,
                  ),
              },
            );

            if (saveError) {
              throw saveError;
            }
          } else {
            const {
              error: saveError,
            } = await supabase
              .from(
                "activity_read_receipts",
              )
              .upsert(
                {
                  workspace_id:
                    workspaceId,

                  activity_id:
                    activityId,

                  user_id:
                    userId,

                  read_at:
                    new Date()
                      .toISOString(),
                },
                {
                  onConflict:
                    "activity_id,user_id",
                },
              );

            if (saveError) {
              throw saveError;
            }
          }

          setState(
            (current) => ({
              ...current,

              readIds: [
                ...new Set([
                  ...current.readIds,
                  activityId,
                ]),
              ],
            }),
          );
        } catch (saveError) {
          setError(
            getActivityErrorMessage(
              saveError,
            ),
          );

          throw saveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        readIdSet,
        userId,
        workspaceId,
      ],
    );

  const markAllRead =
    useCallback(async () => {
      const unreadIds =
        state.activities
          .filter(
            (activity) =>
              !readIdSet.has(
                activity.id,
              ),
          )
          .map(
            (activity) =>
              activity.id,
          );

      if (
        !unreadIds.length ||
        !workspaceId ||
        !userId
      ) {
        return;
      }

      const activityIds =
        unreadIds.filter(
          (activityId) =>
            !isTaskAlertFeedId(
              activityId,
            ),
        );

      const taskAlertIds =
        unreadIds
          .filter(
            (activityId) =>
              isTaskAlertFeedId(
                activityId,
              ),
          )
          .map(
            (activityId) =>
              getRawTaskAlertId(
                activityId,
              ),
          );

      setIsSaving(true);
      setError("");

      try {
        const operations = [];

        if (
          activityIds.length
        ) {
          const readAt =
            new Date()
              .toISOString();

          operations.push(
            supabase
              .from(
                "activity_read_receipts",
              )
              .upsert(
                activityIds.map(
                  (activityId) => ({
                    workspace_id:
                      workspaceId,

                    activity_id:
                      activityId,

                    user_id:
                      userId,

                    read_at:
                      readAt,
                  }),
                ),
                {
                  onConflict:
                    "activity_id,user_id",
                },
              ),
          );
        }

        taskAlertIds.forEach(
          (taskAlertId) => {
            operations.push(
              supabase.rpc(
                "mark_task_alert_read",
                {
                  target_alert_id:
                    taskAlertId,
                },
              ),
            );
          },
        );

        const results =
          await Promise.all(
            operations,
          );

        const failedResult =
          results.find(
            (result) =>
              result?.error,
          );

        if (
          failedResult?.error
        ) {
          throw failedResult.error;
        }

        setState(
          (current) => ({
            ...current,

            readIds: [
              ...new Set([
                ...current.readIds,
                ...unreadIds,
              ]),
            ],
          }),
        );
      } catch (saveError) {
        setError(
          getActivityErrorMessage(
            saveError,
          ),
        );

        throw saveError;
      } finally {
        setIsSaving(false);
      }
    }, [
      readIdSet,
      state.activities,
      userId,
      workspaceId,
    ]);

  return {
    activities:
      state.activities,
    profiles:
      state.profiles,
    readIdSet,
    unreadCount,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadActivity({
        showLoading: true,
      }),
    markActivityRead,
    markAllRead,
  };
}
