import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

function normalizeAssignments(records = []) {
  return records
    .map((assignment) => ({
      ...assignment,
      field_routes: (assignment.field_routes || [])
        .map((route) => ({
          ...route,
          field_stops: (route.field_stops || []).sort(
            (left, right) =>
              Number(left.stop_order || 0) -
              Number(right.stop_order || 0),
          ),
        }))
        .sort(
          (left, right) =>
            Number(left.route_order || 0) -
            Number(right.route_order || 0),
        ),
    }))
    .sort((left, right) => {
      const priority = {
        in_progress: 0,
        accepted: 1,
        assigned: 2,
        completed: 3,
      };

      const statusDifference =
        (priority[left.status] ?? 9) -
        (priority[right.status] ?? 9);

      if (statusDifference) {
        return statusDifference;
      }

      const leftTime = new Date(
        left.assignment_date ||
          left.shift_starts_at ||
          left.created_at ||
          0,
      ).getTime();

      const rightTime = new Date(
        right.assignment_date ||
          right.shift_starts_at ||
          right.created_at ||
          0,
      ).getTime();

      return leftTime - rightTime;
    });
}

export function useVolunteerFieldAssignment({
  workspaceId,
  userId,
}) {
  const [assignments, setAssignments] =
    useState([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);
  const [error, setError] =
    useState("");
  const [lastUpdated, setLastUpdated] =
    useState(null);

  const timerRef = useRef(null);

  const loadAssignments = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId || !userId) {
        setAssignments([]);
        setIsLoading(false);
        return [];
      }

      if (showLoading) {
        setIsLoading(true);
      }

      setError("");

      try {
        const { data, error: loadError } =
          await supabase
            .from("field_assignments")
            .select(`
              id,
              workspace_id,
              volunteer_user_id,
              title,
              precinct,
              turf_name,
              assignment_date,
              shift_starts_at,
              shift_ends_at,
              meeting_location,
              instructions,
              status,
              created_at,
              updated_at,
              field_routes (
                id,
                assignment_id,
                route_order,
                name,
                start_location,
                finish_mode,
                instructions,
                status,
                created_at,
                updated_at,
                field_stops (
                  id,
                  route_id,
                  stop_order,
                  location_label,
                  address_line_1,
                  address_line_2,
                  city,
                  state,
                  postal_code,
                  latitude,
                  longitude,
                  instructions,
                  status,
                  result_code,
                  volunteer_notes,
                  completed_at,
                  updated_at
                )
              )
            `)
            .eq("workspace_id", workspaceId)
            .eq("volunteer_user_id", userId)
            .neq("status", "cancelled");

        if (loadError) {
          throw loadError;
        }

        const {
          data: handoffRows,
          error: handoffError,
        } = await supabase
          .from(
            "field_assignment_handoffs",
          )
          .select(`
            id,
            workspace_id,
            assignment_id,
            volunteer_user_id,
            cycle_number,
            status,
            sent_at,
            acknowledged_at,
            invalidated_at,
            invalidation_reason,
            created_at,
            updated_at
          `)
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "volunteer_user_id",
            userId,
          )
          .order(
            "cycle_number",
            {
              ascending: false,
            },
          );

        if (handoffError) {
          throw handoffError;
        }

        const handoffMap =
          new Map();

        (
          handoffRows ||
          []
        ).forEach(
          (handoff) => {
            const current =
              handoffMap.get(
                handoff.assignment_id,
              ) || [];

            current.push(
              handoff,
            );

            handoffMap.set(
              handoff.assignment_id,
              current,
            );
          },
        );

        const normalized =
          normalizeAssignments(
            data || [],
          ).map(
            (assignment) => ({
              ...assignment,
              deployment_handoffs:
                handoffMap.get(
                  assignment.id,
                ) || [],
            }),
          );

        setAssignments(normalized);
        setLastUpdated(new Date());

        return normalized;
      } catch (loadError) {
        console.error(
          "Volunteer field assignment could not be loaded:",
          loadError,
        );

        setError(
          loadError?.message ||
            "Your field assignment could not be refreshed.",
        );

        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [userId, workspaceId],
  );

  useEffect(() => {
    const initialTimer = window.setTimeout(
      () => {
        loadAssignments({
          showLoading: true,
        });
      },
      0,
    );

    return () => {
      window.clearTimeout(initialTimer);
    };
  }, [loadAssignments]);

  useEffect(() => {
    if (!workspaceId || !userId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(
        () => {
          loadAssignments();
        },
        300,
      );
    };

    const channel = supabase
      .channel(
        `volunteer-field-${workspaceId}-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "field_assignments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "field_routes",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "field_stops",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "field_assignment_handoffs",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [
    loadAssignments,
    userId,
    workspaceId,
  ]);

  const updateAssignmentStatus =
    useCallback(
      async (assignmentId, nextStatus) => {
        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: updateError,
          } = await supabase.rpc(
            "update_own_field_assignment_status",
            {
              target_assignment_id:
                assignmentId,
              target_status: nextStatus,
            },
          );

          if (updateError) {
            throw updateError;
          }

          await loadAssignments();

          return Array.isArray(data)
            ? data[0] || null
            : data;
        } catch (updateError) {
          console.error(
            "Field assignment status could not be updated:",
            updateError,
          );

          setError(
            updateError?.message ||
              "The field assignment status could not be updated.",
          );

          throw updateError;
        } finally {
          setIsSaving(false);
        }
      },
      [loadAssignments],
    );

  const acknowledgeDeploymentHandoff =
    useCallback(
      async (assignmentId) => {
        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: handoffError,
          } = await supabase.rpc(
            "acknowledge_own_field_assignment_handoff",
            {
              target_assignment_id:
                assignmentId,
            },
          );

          if (handoffError) {
            throw handoffError;
          }

          await loadAssignments();

          return Array.isArray(
            data,
          )
            ? data[0] || null
            : data;
        } catch (handoffError) {
          console.error(
            "Deployment handoff could not be acknowledged:",
            handoffError,
          );

          setError(
            handoffError?.message ||
              "The deployment handoff could not be acknowledged.",
          );

          throw handoffError;
        } finally {
          setIsSaving(false);
        }
      },
      [loadAssignments],
    );

  const recordStopResult = useCallback(
    async ({
      stopId,
      status,
      resultCode = null,
      notes = "",
    }) => {
      setIsSaving(true);
      setError("");

      try {
        const {
          data,
          error: updateError,
        } = await supabase.rpc(
          "record_own_field_stop_result",
          {
            target_stop_id: stopId,
            target_status: status,
            target_result_code: resultCode,
            target_notes: notes,
          },
        );

        if (updateError) {
          throw updateError;
        }

        await loadAssignments();

        return Array.isArray(data)
          ? data[0] || null
          : data;
      } catch (updateError) {
        console.error(
          "Field stop result could not be recorded:",
          updateError,
        );

        setError(
          updateError?.message ||
            "The field stop result could not be saved.",
        );

        throw updateError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadAssignments],
  );

  return {
    assignments,
    activeAssignment:
      assignments.find(
        (assignment) =>
          assignment.status !== "completed",
      ) ||
      assignments[0] ||
      null,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadAssignments({
        showLoading: true,
      }),
    updateAssignmentStatus,
    acknowledgeDeploymentHandoff,
    recordStopResult,
  };
}

