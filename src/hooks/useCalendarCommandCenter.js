import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

// CAMPAIGN HQ CALENDAR LINT COMPLETION

const EMPTY_STATE = {
  events: [],
  tasks: [],
  taskDependencies: [],
  team: [],
};

export function useCalendarCommandCenter({
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

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const refreshTimerRef =
    useRef(null);

  const loadTeam = useCallback(async () => {
    if (!workspaceId) {
      return [];
    }

    const {
      data: memberships,
      error: membershipError,
    } = await supabase
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

    const userIds = (
      memberships || []
    ).map(
      (membership) =>
        membership.user_id,
    );

    if (!userIds.length) {
      return [];
    }

    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email",
      )
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(
      (profiles || []).map(
        (profile) => [
          profile.id,
          profile,
        ],
      ),
    );

    return (memberships || [])
      .map((membership) => {
        const profile =
          profileMap.get(
            membership.user_id,
          );

        return {
          id: membership.user_id,
          fullName:
            profile?.full_name ||
            "Campaign User",
          email:
            profile?.email || "",
          roleKey:
            membership.role_key ||
            membership.role ||
            "campaign_member",
          displayTitle:
            membership.display_title ||
            "Campaign Member",
          dashboardType:
            membership.dashboard_type ||
            "volunteer",
          seatType:
            membership.seat_type ||
            "volunteer",
        };
      })
      .sort((left, right) =>
        left.fullName.localeCompare(
          right.fullName,
        ),
      );
  }, [workspaceId]);

  const loadEvents =
    useCallback(async () => {
      if (!workspaceId) {
        return [];
      }

      const {
        data,
        error: eventsError,
      } = await supabase
        .from("events")
        .select(
          `
            id,
            workspace_id,
            title,
            description,
            event_type,
            location,
            starts_at,
            ends_at,
            status,
            capacity,
            rsvp_count,
            created_by,
            is_sample,
            created_at,
            updated_at,
            is_all_day,
            event_timezone,
            participants,
            recurrence_rules,
            reminders,
            busy,
            visibility,
            conferencing,
            hide_participants,
            notify_participants,
            source_provider,
            external_calendar_id,
            external_event_id,
            external_ical_uid,
            external_updated_at,
            sync_metadata
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .neq(
          "status",
          "cancelled",
        )
        .order(
          "starts_at",
          {
            ascending: true,
          },
        );

      if (eventsError) {
        throw eventsError;
      }

      return data || [];
    }, [workspaceId]);

  const loadCalendarTasks =
    useCallback(async () => {
      if (!workspaceId) {
        return [];
      }

      const {
        data,
        error: tasksError,
      } = await supabase
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
            due_at,
            assigned_to,
            created_by,
            created_at,
            updated_at
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .neq("status", "archived")
        .order(
          "due_at",
          {
            ascending: true,
            nullsFirst: false,
          },
        );

      if (tasksError) {
        throw tasksError;
      }

      return data || [];
    }, [workspaceId]);

  const loadTaskDependencies =
    useCallback(
      async () => {
        if (!workspaceId) {
          return [];
        }

        const {
          data,
          error:
            dependenciesError,
        } = await supabase
          .from(
            "task_dependencies",
          )
          .select(
            `
              id,
              workspace_id,
              task_id,
              depends_on_task_id,
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

        if (
          dependenciesError
        ) {
          throw (
            dependenciesError
          );
        }

        const dependencies =
          data || [];

        const prerequisiteIds = [
          ...new Set(
            dependencies.map(
              (dependency) =>
                dependency
                  .depends_on_task_id,
            ),
          ),
        ];

        if (
          !prerequisiteIds.length
        ) {
          return dependencies;
        }

        const {
          data:
            prerequisiteTasks,
          error:
            prerequisiteError,
        } = await supabase
          .from("tasks")
          .select(
            "id,status",
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .in(
            "id",
            prerequisiteIds,
          );

        if (
          prerequisiteError
        ) {
          throw (
            prerequisiteError
          );
        }

        const statusByTaskId =
          new Map(
            (
              prerequisiteTasks ||
              []
            ).map(
              (task) => [
                task.id,
                task.status ||
                  "",
              ],
            ),
          );

        return dependencies.map(
          (dependency) => ({
            ...dependency,

            prerequisite_status:
              statusByTaskId.get(
                dependency
                  .depends_on_task_id,
              ) ||
              "",
          }),
        );
      },
      [
        workspaceId,
      ],
    );

  const loadCalendar =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "No campaign workspace is selected.",
          );
          setIsLoading(false);
          return;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const [
            events,
            tasks,
            taskDependencies,
            team,
          ] = await Promise.all([
            loadEvents(),
            loadCalendarTasks(),
            loadTaskDependencies(),
            loadTeam(),
          ]);

          setState({
            events,
            tasks,
            taskDependencies,
            team,
          });

          setError("");
          setLastUpdated(
            new Date(),
          );
        } catch (loadError) {
          console.error(
            "Calendar could not load:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Campaign calendar could not be refreshed.",
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        loadEvents,
        loadCalendarTasks,
        loadTaskDependencies,
        loadTeam,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        loadCalendar({
          showLoading: true,
        });
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadCalendar]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      refreshTimerRef.current =
        window.setTimeout(
          () => {
            loadCalendar();
          },
          300,
        );
    };

    const channel = supabase
      .channel(
        `calendar-command-center-${workspaceId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
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
          table: "tasks",
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
    loadCalendar,
    workspaceId,
  ]);

  const saveEvent = useCallback(
    async ({
      eventId,
      values,
    }) => {
      setIsSaving(true);
      setError("");

      const payload = {
        title:
          values.title.trim(),
        description:
          values.description.trim() ||
          null,
        event_type:
          values.eventType,
        location:
          values.location.trim() ||
          null,
        starts_at:
          values.startsAt,
        ends_at:
          values.endsAt || null,
        status:
          values.status,
      };

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "capacity",
        )
      ) {
        payload.capacity =
          values.capacity === ""
            ? null
            : Number(
                values.capacity,
              );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "rsvpCount",
        )
      ) {
        payload.rsvp_count =
          values.rsvpCount === ""
            ? 0
            : Number(
                values.rsvpCount,
              );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "eventTimezone",
        )
      ) {
        payload.event_timezone =
          String(
            values.eventTimezone ||
            "",
          ).trim() ||
          null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "participants",
        )
      ) {
        payload.participants =
          Array.isArray(
            values.participants,
          )
            ? values.participants
            : [];
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "recurrenceRules",
        )
      ) {
        payload.recurrence_rules =
          Array.isArray(
            values.recurrenceRules,
          )
            ? values.recurrenceRules
            : [];
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "reminders",
        )
      ) {
        payload.reminders =
          values.reminders &&
          typeof values.reminders ===
            "object"
            ? values.reminders
            : {};
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "busy",
        )
      ) {
        payload.busy =
          values.busy !==
          false;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "visibility",
        )
      ) {
        const requestedVisibility =
          String(
            values.visibility ||
            "",
          )
            .trim()
            .toLowerCase();

        payload.visibility =
          [
            "default",
            "public",
            "private",
          ].includes(
            requestedVisibility,
          )
            ? requestedVisibility
            : null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "conferencing",
        )
      ) {
        payload.conferencing =
          values.conferencing &&
          typeof values.conferencing ===
            "object"
            ? values.conferencing
            : {};
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "hideParticipants",
        )
      ) {
        payload.hide_participants =
          values.hideParticipants ===
          true;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "notifyParticipants",
        )
      ) {
        payload.notify_participants =
          values.notifyParticipants !==
          false;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          values,
          "isAllDay",
        )
      ) {
        payload.is_all_day =
          values.isAllDay ===
          true;
      }

      try {
        let result;

        if (eventId) {
          result = await supabase
            .from("events")
            .update(payload)
            .eq("id", eventId)
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();
        } else {
          result = await supabase
            .from("events")
            .insert({
              ...payload,
              workspace_id:
                workspaceId,
              created_by:
                userId,
              is_sample: false,
            })
            .select()
            .single();
        }

        if (result.error) {
          throw result.error;
        }

        await loadCalendar();

        return result.data;
      } catch (saveError) {
        console.error(
          "Calendar event could not be saved:",
          saveError,
        );

        setError(
          saveError instanceof Error
            ? saveError.message
            : "The event could not be saved.",
        );

        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCalendar,
      userId,
      workspaceId,
    ],
  );

  const setTaskDeadline =
    useCallback(
      async (
        taskId,
        dueAt,
      ) => {
        if (
          !taskId ||
          !workspaceId
        ) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error:
              taskUpdateError,
          } = await supabase
            .from("tasks")
            .update({
              due_at:
                dueAt ||
                null,
            })
            .eq(
              "id",
              taskId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();

          if (
            taskUpdateError
          ) {
            throw (
              taskUpdateError
            );
          }

          await loadCalendar();

          return data;
        } catch (
          taskUpdateError
        ) {
          console.error(
            "Calendar task deadline could not be updated:",
            taskUpdateError,
          );

          setError(
            taskUpdateError
              instanceof Error
              ? taskUpdateError
                  .message
              : "The task deadline could not be updated.",
          );

          throw (
            taskUpdateError
          );
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadCalendar,
        workspaceId,
      ],
    );

  const cancelEvent = useCallback(
    async (eventId) => {
      setIsSaving(true);
      setError("");

      try {
        const {
          data,
          error: cancelError,
        } = await supabase
          .from("events")
          .update({
            status: "cancelled",
          })
          .eq("id", eventId)
          .eq(
            "workspace_id",
            workspaceId,
          )
          .select()
          .single();

        if (cancelError) {
          throw cancelError;
        }

        await loadCalendar();

        return data;
      } catch (cancelError) {
        console.error(
          "Calendar event could not be cancelled:",
          cancelError,
        );

        setError(
          cancelError instanceof Error
            ? cancelError.message
            : "The event could not be cancelled.",
        );

        throw cancelError;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCalendar,
      workspaceId,
    ],
  );

  return {
    events: state.events,
    tasks: state.tasks,
    taskDependencies:
      state.taskDependencies,
    team: state.team,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadCalendar({
        showLoading: true,
      }),
    saveEvent,
    setTaskDeadline,
    cancelEvent,
  };
}
