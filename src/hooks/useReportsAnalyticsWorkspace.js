
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


const EMPTY_REPORT = {
  tasksTotal: 0,
  tasksCompleted: 0,
  tasksOpen: 0,
  tasksInProgress: 0,
  tasksOverdue: 0,
  taskCompletionRate: 0,

  eventsTotal: 0,
  upcomingEvents: 0,
  eventRsvps: 0,

  contactsTotal: 0,
  volunteersTotal: 0,
  communicationsTotal: 0,
  fundraisingGoals: 0,

  snapshotCount: 0,
  latestSnapshot: null,

  taskStatuses: {
    open: 0,
    in_progress: 0,
    completed: 0,
    other: 0,
  },

  eventStatuses: {
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    other: 0,
  },
};


function validDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}


export function useReportsAnalyticsWorkspace({
  workspaceId,
}) {
  const [
    report,
    setReport,
  ] = useState(
    EMPTY_REPORT,
  );

  const [
    snapshots,
    setSnapshots,
  ] = useState([]);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    events,
    setEvents,
  ] = useState([]);

  const [
    goals,
    setGoals,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);


  const refresh =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setReport(
            EMPTY_REPORT,
          );

          setSnapshots([]);
          setTasks([]);
          setEvents([]);
          setGoals([]);

          setLoading(false);

          setError(
            "No campaign workspace is selected.",
          );

          return false;
        }

        if (showLoading) {
          setLoading(true);
        }

        try {
          const [
            snapshotsResult,
            tasksResult,
            eventsResult,
            contactsResult,
            volunteersResult,
            communicationsResult,
            goalsResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "campaign_metrics",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "metric_date",
                    "volunteer_shifts_filled",
                    "volunteer_shifts_goal",
                    "event_rsvps",
                    "doors_knocked",
                    "contacts_total",
                    "messages_sent",
                    "messages_opened",
                    "campaign_readiness",
                    "campaign_health",
                    "field_health",
                    "events_health",
                    "communications_health",
                    "volunteers_health",
                    "is_sample",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "is_sample",
                  false,
                )
                .order(
                  "metric_date",
                  {
                    ascending:
                      false,
                  },
                ),

              supabase
                .from(
                  "tasks",
                )
                .select(
                  [
                    "id",
                    "title",
                    "status",
                    "priority",
                    "due_at",
                    "completed_at",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "is_sample",
                  false,
                )
                .is(
                  "archived_at",
                  null,
                )
                .order(
                  "updated_at",
                  {
                    ascending:
                      false,
                  },
                ),

              supabase
                .from(
                  "events",
                )
                .select(
                  [
                    "id",
                    "title",
                    "event_type",
                    "status",
                    "starts_at",
                    "ends_at",
                    "rsvp_count",
                    "location",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "is_sample",
                  false,
                )
                .order(
                  "starts_at",
                  {
                    ascending:
                      true,
                  },
                ),

              supabase
                .from(
                  "campaign_contacts",
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  },
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                ),

              supabase
                .from(
                  "volunteers",
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  },
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "is_sample",
                  false,
                ),

              supabase
                .from(
                  "campaign_communications",
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  },
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                ),

              supabase
                .from(
                  "campaign_fundraising_goals",
                )
                .select(
                  [
                    "id",
                    "name",
                    "status",
                    "goal_amount_cents",
                    "currency",
                    "starts_on",
                    "ends_on",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .order(
                  "sort_order",
                  {
                    ascending:
                      true,
                  },
                ),
            ]);


          const results = [
            snapshotsResult,
            tasksResult,
            eventsResult,
            contactsResult,
            volunteersResult,
            communicationsResult,
            goalsResult,
          ];

          const failed =
            results.find(
              (result) =>
                result.error,
            );

          if (failed?.error) {
            throw failed.error;
          }


          const rawSnapshots =
            Array.isArray(
              snapshotsResult.data,
            )
              ? snapshotsResult.data
              : [];

          const rawTasks =
            Array.isArray(
              tasksResult.data,
            )
              ? tasksResult.data
              : [];

          const rawEvents =
            Array.isArray(
              eventsResult.data,
            )
              ? eventsResult.data
              : [];

          const rawGoals =
            Array.isArray(
              goalsResult.data,
            )
              ? goalsResult.data
              : [];

          const now =
            Date.now();


          const completedTasks =
            rawTasks.filter(
              (task) =>
                task.status ===
                "completed",
            );

          const openTasks =
            rawTasks.filter(
              (task) =>
                task.status ===
                "open",
            );

          const inProgressTasks =
            rawTasks.filter(
              (task) =>
                task.status ===
                "in_progress",
            );

          const overdueTasks =
            rawTasks.filter(
              (task) => {
                if (
                  task.status ===
                  "completed"
                ) {
                  return false;
                }

                const due =
                  validDate(
                    task.due_at,
                  );

                return (
                  due &&
                  due.getTime() <
                    now
                );
              },
            );


          const upcomingEvents =
            rawEvents.filter(
              (event) => {
                if (
                  event.status !==
                  "scheduled"
                ) {
                  return false;
                }

                const start =
                  validDate(
                    event.starts_at,
                  );

                return (
                  start &&
                  start.getTime() >=
                    now
                );
              },
            );


          const taskStatuses = {
            open:
              openTasks.length,

            in_progress:
              inProgressTasks.length,

            completed:
              completedTasks.length,

            other:
              rawTasks.filter(
                (task) =>
                  ![
                    "open",
                    "in_progress",
                    "completed",
                  ].includes(
                    task.status,
                  ),
              ).length,
          };


          const eventStatuses = {
            scheduled:
              rawEvents.filter(
                (event) =>
                  event.status ===
                  "scheduled",
              ).length,

            completed:
              rawEvents.filter(
                (event) =>
                  event.status ===
                  "completed",
              ).length,

            cancelled:
              rawEvents.filter(
                (event) =>
                  event.status ===
                  "cancelled",
              ).length,

            other:
              rawEvents.filter(
                (event) =>
                  ![
                    "scheduled",
                    "completed",
                    "cancelled",
                  ].includes(
                    event.status,
                  ),
              ).length,
          };


          const tasksTotal =
            rawTasks.length;

          const nextReport = {
            tasksTotal,

            tasksCompleted:
              completedTasks.length,

            tasksOpen:
              openTasks.length,

            tasksInProgress:
              inProgressTasks.length,

            tasksOverdue:
              overdueTasks.length,

            taskCompletionRate:
              tasksTotal
                ? Math.round(
                    (
                      completedTasks.length /
                      tasksTotal
                    ) *
                      100,
                  )
                : 0,

            eventsTotal:
              rawEvents.length,

            upcomingEvents:
              upcomingEvents.length,

            eventRsvps:
              rawEvents.reduce(
                (
                  total,
                  event,
                ) =>
                  total +
                  Number(
                    event.rsvp_count ||
                    0,
                  ),
                0,
              ),

            contactsTotal:
              Number(
                contactsResult.count ||
                0,
              ),

            volunteersTotal:
              Number(
                volunteersResult.count ||
                0,
              ),

            communicationsTotal:
              Number(
                communicationsResult.count ||
                0,
              ),

            fundraisingGoals:
              rawGoals.length,

            snapshotCount:
              rawSnapshots.length,

            latestSnapshot:
              rawSnapshots[0] ||
              null,

            taskStatuses,
            eventStatuses,
          };


          setReport(
            nextReport,
          );

          setSnapshots(
            rawSnapshots,
          );

          setTasks(
            rawTasks,
          );

          setEvents(
            rawEvents,
          );

          setGoals(
            rawGoals,
          );

          setError("");

          setLastUpdated(
            new Date(),
          );

          setLoading(false);

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Reports & Analytics] workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Unable to load live reporting sources.",
          );

          setLoading(false);

          return false;
        }
      },
      [
        workspaceId,
      ],
    );


  useEffect(
    () => {
      const timeout =
        window.setTimeout(
          () => {
            void refresh({
              showLoading:
                true,
            });
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timeout,
        );
    },
    [
      refresh,
    ],
  );


  return {
    report,
    snapshots,
    tasks,
    events,
    goals,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
