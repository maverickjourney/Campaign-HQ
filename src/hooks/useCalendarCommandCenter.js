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
            updated_at
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
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

  const loadTaskDeadlines =
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
            created_by
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .not("due_at", "is", null)
        .neq("status", "archived")
        .order(
          "due_at",
          {
            ascending: true,
          },
        );

      if (tasksError) {
        throw tasksError;
      }

      return data || [];
    }, [workspaceId]);

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
            team,
          ] = await Promise.all([
            loadEvents(),
            loadTaskDeadlines(),
            loadTeam(),
          ]);

          setState({
            events,
            tasks,
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
        loadTaskDeadlines,
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
        capacity:
          values.capacity === ""
            ? null
            : Number(
                values.capacity,
              ),
        rsvp_count:
          values.rsvpCount === ""
            ? 0
            : Number(
                values.rsvpCount,
              ),
      };

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
    cancelEvent,
  };
}
