import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

const EMPTY_METRICS = {
  roster: 0,
  assignments: 0,
  activeAssignments: 0,
  routes: 0,
  stops: 0,
  recordedStops: 0,
  pendingStops: 0,
};

function cleanRows(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function normalizeAssignments(rows) {
  return cleanRows(rows).map(
    (assignment) => ({
      ...assignment,

      field_routes:
        cleanRows(
          assignment.field_routes,
        )
          .slice()
          .sort(
            (left, right) =>
              Number(
                left.route_order ||
                  0,
              ) -
              Number(
                right.route_order ||
                  0,
              ),
          )
          .map(
            (route) => ({
              ...route,

              field_stops:
                cleanRows(
                  route.field_stops,
                )
                  .slice()
                  .sort(
                    (left, right) =>
                      Number(
                        left.stop_order ||
                          0,
                      ) -
                      Number(
                        right.stop_order ||
                          0,
                      ),
                  ),
            }),
          ),
    }),
  );
}

function buildMetrics({
  volunteers,
  assignments,
}) {
  const routes =
    assignments.flatMap(
      (assignment) =>
        cleanRows(
          assignment.field_routes,
        ),
    );

  const stops =
    routes.flatMap(
      (route) =>
        cleanRows(
          route.field_stops,
        ),
    );

  const activeAssignments =
    assignments.filter(
      (assignment) =>
        ![
          "completed",
          "cancelled",
        ].includes(
          String(
            assignment.status ||
              "",
          ).toLowerCase(),
        ),
    ).length;

  const pendingStops =
    stops.filter(
      (stop) =>
        String(
          stop.status ||
            "pending",
        ).toLowerCase() ===
        "pending",
    ).length;

  return {
    roster:
      volunteers.length,

    assignments:
      assignments.length,

    activeAssignments,

    routes:
      routes.length,

    stops:
      stops.length,

    recordedStops:
      stops.length -
      pendingStops,

    pendingStops,
  };
}

export function useVolunteersWorkspace({
  enabled = true,
  workspaceId,
}) {
  const [
    volunteers,
    setVolunteers,
  ] = useState([]);

  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    metrics,
    setMetrics,
  ] = useState(
    EMPTY_METRICS,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(enabled),
  );

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
      async () => {
        if (!enabled) {
          setLoading(false);
          return true;
        }

        if (!workspaceId) {
          setError(
            "No active campaign workspace is available.",
          );
          setLoading(false);
          return false;
        }

        setLoading(true);
        setError("");

        try {
          const [
            volunteerResult,
            assignmentResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "volunteers",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "full_name",
                    "email",
                    "phone",
                    "team",
                    "status",
                    "interests",
                    "notes",
                    "shifts_completed",
                    "source",
                    "is_sample",
                    "created_at",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .or(
                  "is_sample.is.null,is_sample.eq.false",
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
                  "field_assignments",
                )
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
                    instructions,
                    status,
                    finish_mode,
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
                      status,
                      result_code,
                      completed_at
                    )
                  )
                `)
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  },
                ),
            ]);

          if (
            volunteerResult.error
          ) {
            throw volunteerResult.error;
          }

          if (
            assignmentResult.error
          ) {
            throw assignmentResult.error;
          }

          const nextVolunteers =
            cleanRows(
              volunteerResult.data,
            );

          const nextAssignments =
            normalizeAssignments(
              assignmentResult.data,
            );

          setVolunteers(
            nextVolunteers,
          );

          setAssignments(
            nextAssignments,
          );

          setMetrics(
            buildMetrics({
              volunteers:
                nextVolunteers,
              assignments:
                nextAssignments,
            }),
          );

          setLastUpdated(
            new Date(),
          );

          setLoading(false);

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Volunteers] live workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
              "Unable to load live volunteer operations.",
          );

          setLoading(false);

          return false;
        }
      },
      [
        enabled,
        workspaceId,
      ],
    );

  useEffect(
    () => {
      void refresh();
    },
    [
      refresh,
    ],
  );

  return {
    volunteers,
    assignments,
    metrics,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
