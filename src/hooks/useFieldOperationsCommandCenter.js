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
        cancelled: 4,
      };

      const statusDifference =
        (priority[left.status] ?? 9) -
        (priority[right.status] ?? 9);

      if (statusDifference) {
        return statusDifference;
      }

      return (
        new Date(
          right.updated_at ||
            right.created_at ||
            0,
        ).getTime() -
        new Date(
          left.updated_at ||
            left.created_at ||
            0,
        ).getTime()
      );
    });
}


function summarizeFieldAssignment(
  assignment,
) {
  if (!assignment) {
    return null;
  }

  return {
    id:
      assignment.id,
    source_assignment_id:
      assignment.source_assignment_id ||
      null,
    volunteer_user_id:
      assignment.volunteer_user_id ||
      null,
    title:
      assignment.title ||
      "Field assignment",
    precinct:
      assignment.precinct ||
      null,
    turf_name:
      assignment.turf_name ||
      null,
    assignment_date:
      assignment.assignment_date ||
      null,
    shift_starts_at:
      assignment.shift_starts_at ||
      null,
    meeting_location:
      assignment.meeting_location ||
      null,
    status:
      assignment.status ||
      "assigned",
    created_at:
      assignment.created_at ||
      null,
    updated_at:
      assignment.updated_at ||
      null,
    completion_review:
      assignment.completion_review ||
      null,
  };
}

function summarizeFieldStop(
  record,
) {
  if (!record?.stop) {
    return null;
  }

  const {
    assignment,
    route,
    stop,
  } = record;

  return {
    id:
      stop.id,
    source_stop_id:
      stop.source_stop_id ||
      null,
    stop_order:
      stop.stop_order,
    location_label:
      stop.location_label ||
      null,
    address_line_1:
      stop.address_line_1 ||
      null,
    address_line_2:
      stop.address_line_2 ||
      null,
    city:
      stop.city ||
      null,
    state:
      stop.state ||
      null,
    postal_code:
      stop.postal_code ||
      null,
    status:
      stop.status ||
      "pending",
    result_code:
      stop.result_code ||
      null,
    volunteer_notes:
      stop.volunteer_notes ||
      null,
    completed_at:
      stop.completed_at ||
      null,
    route: {
      id:
        route.id,
      route_order:
        route.route_order,
      name:
        route.name ||
        `Route ${route.route_order}`,
    },
    assignment:
      summarizeFieldAssignment(
        assignment,
      ),
  };
}

function enrichFieldLineage(
  records = [],
) {
  const assignmentMap =
    new Map(
      records.map(
        (assignment) => [
          assignment.id,
          assignment,
        ],
      ),
    );

  const stopMap =
    new Map();

  const childAssignments =
    new Map();

  const childStops =
    new Map();

  records.forEach(
    (assignment) => {
      if (
        assignment
          .source_assignment_id
      ) {
        const siblings =
          childAssignments.get(
            assignment
              .source_assignment_id,
          ) ||
          [];

        siblings.push(
          assignment,
        );

        childAssignments.set(
          assignment
            .source_assignment_id,
          siblings,
        );
      }

      (
        assignment
          .field_routes ||
        []
      ).forEach(
        (route) => {
          (
            route
              .field_stops ||
            []
          ).forEach(
            (stop) => {
              const record = {
                assignment,
                route,
                stop,
              };

              stopMap.set(
                stop.id,
                record,
              );

              if (
                stop
                  .source_stop_id
              ) {
                const descendants =
                  childStops.get(
                    stop
                      .source_stop_id,
                  ) ||
                  [];

                descendants.push(
                  record,
                );

                childStops.set(
                  stop
                    .source_stop_id,
                  descendants,
                );
              }
            },
          );
        },
      );
    },
  );

  const sourceAssignmentChain =
    (assignment) => {
      const chain = [];
      const visited =
        new Set([
          assignment.id,
        ]);

      let sourceId =
        assignment
          .source_assignment_id;

      let distance = 1;

      while (
        sourceId &&
        !visited.has(
          sourceId,
        ) &&
        distance <= 25
      ) {
        const source =
          assignmentMap.get(
            sourceId,
          );

        if (!source) {
          break;
        }

        chain.push({
          ...summarizeFieldAssignment(
            source,
          ),
          generation_distance:
            distance,
        });

        visited.add(
          source.id,
        );

        sourceId =
          source
            .source_assignment_id;

        distance += 1;
      }

      return chain;
    };

  const descendantAssignments =
    (assignment) => {
      const result = [];
      const visited =
        new Set([
          assignment.id,
        ]);

      const queue =
        (
          childAssignments.get(
            assignment.id,
          ) ||
          []
        ).map(
          (child) => ({
            child,
            distance: 1,
          }),
        );

      while (queue.length) {
        const next =
          queue.shift();

        if (
          !next?.child ||
          visited.has(
            next.child.id,
          )
        ) {
          continue;
        }

        visited.add(
          next.child.id,
        );

        result.push({
          ...summarizeFieldAssignment(
            next.child,
          ),
          generation_distance:
            next.distance,
        });

        (
          childAssignments.get(
            next.child.id,
          ) ||
          []
        ).forEach(
          (child) => {
            queue.push({
              child,
              distance:
                next.distance +
                1,
            });
          },
        );
      }

      return result;
    };

  const sourceStopChain =
    (stop) => {
      const chain = [];
      const visited =
        new Set([
          stop.id,
        ]);

      let sourceId =
        stop
          .source_stop_id;

      let distance = 1;

      while (
        sourceId &&
        !visited.has(
          sourceId,
        ) &&
        distance <= 25
      ) {
        const source =
          stopMap.get(
            sourceId,
          );

        if (!source) {
          break;
        }

        chain.push({
          ...summarizeFieldStop(
            source,
          ),
          generation_distance:
            distance,
        });

        visited.add(
          source.stop.id,
        );

        sourceId =
          source.stop
            .source_stop_id;

        distance += 1;
      }

      return chain;
    };

  const descendantStops =
    (stop) => {
      const result = [];
      const visited =
        new Set([
          stop.id,
        ]);

      const queue =
        (
          childStops.get(
            stop.id,
          ) ||
          []
        ).map(
          (child) => ({
            child,
            distance: 1,
          }),
        );

      while (queue.length) {
        const next =
          queue.shift();

        if (
          !next?.child ||
          visited.has(
            next.child.stop.id,
          )
        ) {
          continue;
        }

        visited.add(
          next.child.stop.id,
        );

        result.push({
          ...summarizeFieldStop(
            next.child,
          ),
          generation_distance:
            next.distance,
        });

        (
          childStops.get(
            next.child.stop.id,
          ) ||
          []
        ).forEach(
          (child) => {
            queue.push({
              child,
              distance:
                next.distance +
                1,
            });
          },
        );
      }

      return result;
    };

  return records.map(
    (assignment) => {
      const sourceChain =
        sourceAssignmentChain(
          assignment,
        );

      const generatedHistory =
        descendantAssignments(
          assignment,
        );

      return {
        ...assignment,
        source_assignment:
          sourceChain[0] ||
          null,
        source_chain:
          sourceChain,
        generated_follow_ups:
          generatedHistory.filter(
            (followUp) =>
              followUp
                .generation_distance ===
              1,
          ),
        generated_follow_up_history:
          generatedHistory,
        field_routes:
          (
            assignment
              .field_routes ||
            []
          ).map(
            (route) => ({
              ...route,
              field_stops:
                (
                  route
                    .field_stops ||
                  []
                ).map(
                  (stop) => {
                    const stopSourceChain =
                      sourceStopChain(
                        stop,
                      );

                    const generatedStopHistory =
                      descendantStops(
                        stop,
                      );

                    return {
                      ...stop,
                      source_trail:
                        stopSourceChain[
                          0
                        ] ||
                        null,
                      source_chain:
                        stopSourceChain,
                      generated_follow_up_stops:
                        generatedStopHistory.filter(
                          (
                            followUpStop,
                          ) =>
                            followUpStop
                              .generation_distance ===
                            1,
                        ),
                      generated_follow_up_history:
                        generatedStopHistory,
                    };
                  },
                ),
            }),
          ),
      };
    },
  );
}

function fieldError(error, fallback) {
  const message =
    error?.message ||
    fallback;

  if (
    error?.code === "42501" ||
    message
      .toLowerCase()
      .includes("permission")
  ) {
    return (
      "Your current campaign role is not authorized " +
      "to manage Field Operations."
    );
  }

  if (
    error?.code === "42P01" ||
    error?.code === "PGRST205"
  ) {
    return (
      "The Field Assignment database foundation is missing. " +
      "Run the approved Supabase foundation SQL, then refresh."
    );
  }

  return message;
}

export function useFieldOperationsCommandCenter({
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

  const refreshTimerRef =
    useRef(null);

  const loadAssignments = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId || !userId) {
        setAssignments([]);
        setError(
          "The active campaign workspace or user session is missing.",
        );
        setIsLoading(false);
        return [];
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const {
          data: assignmentRows,
          error: loadError,
        } = await supabase
          .from("field_assignments")
          .select(`
            id,
            source_assignment_id,
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
            created_by,
            updated_by,
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
                source_stop_id,
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
                completed_by,
                completed_at,
                created_at,
                updated_at
              )
            )
          `)
          .eq(
            "workspace_id",
            workspaceId,
          );

        if (loadError) {
          throw loadError;
        }

        const {
          data: reviewRows,
          error: reviewError,
        } = await supabase
          .from(
            "field_assignment_reviews",
          )
          .select(`
            assignment_id,
            workspace_id,
            review_status,
            review_notes,
            reviewed_by,
            reviewed_at,
            created_at,
            updated_at
          `)
          .eq(
            "workspace_id",
            workspaceId,
          );

        if (reviewError) {
          throw reviewError;
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
            content_fingerprint,
            sent_by,
            sent_at,
            acknowledged_by,
            acknowledged_at,
            invalidated_by,
            invalidated_at,
            invalidation_reason,
            created_at,
            updated_at
          `)
          .eq(
            "workspace_id",
            workspaceId,
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

        const reviewMap =
          new Map(
            (
              reviewRows ||
              []
            ).map(
              (review) => [
                review.assignment_id,
                review,
              ],
            ),
          );

        const reviewedAssignments =
          normalizeAssignments(
            assignmentRows ||
              [],
          ).map(
            (assignment) => ({
              ...assignment,
              completion_review:
                reviewMap.get(
                  assignment.id,
                ) || {
                  assignment_id:
                    assignment.id,
                  review_status:
                    "pending",
                  review_notes:
                    "",
                  reviewed_by:
                    null,
                  reviewed_at:
                    null,
                  created_at:
                    null,
                  updated_at:
                    null,
                },
              deployment_handoffs:
                handoffMap.get(
                  assignment.id,
                ) || [],
            }),
          );

        const normalized =
          enrichFieldLineage(
            reviewedAssignments,
          );

        setAssignments(normalized);
        setError("");
        setLastUpdated(new Date());

        return normalized;
      } catch (loadError) {
        console.error(
          "Field Operations could not load:",
          loadError,
        );

        setError(
          fieldError(
            loadError,
            "Field Operations could not be refreshed.",
          ),
        );

        return [];
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
    const initialTimer =
      window.setTimeout(
        () => {
          loadAssignments({
            showLoading: true,
          });
        },
        0,
      );

    return () => {
      window.clearTimeout(
        initialTimer,
      );
    };
  }, [loadAssignments]);

  useEffect(() => {
    if (!workspaceId) {
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
              loadAssignments();
            },
            300,
          );
      };

    const channel =
      supabase
        .channel(
          `field-operations-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "field_assignments",
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
              "field_assignment_reviews",
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
              "field_assignment_handoffs",
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
    loadAssignments,
    workspaceId,
  ]);

  const runAction = useCallback(
    async (
      action,
      fallback,
    ) => {
      setIsSaving(true);
      setError("");

      try {
        const result =
          await action();

        await loadAssignments();

        return result;
      } catch (actionError) {
        console.error(
          fallback,
          actionError,
        );

        const message =
          fieldError(
            actionError,
            fallback,
          );

        setError(message);
        throw new Error(
          message,
          {
            cause: actionError,
          },
        );
      } finally {
        setIsSaving(false);
      }
    },
    [loadAssignments],
  );

  const createAssignment =
    useCallback(
      (payload) =>
        runAction(
          async () => {
            const {
              data,
              error: insertError,
            } = await supabase
              .from(
                "field_assignments",
              )
              .insert({
                workspace_id:
                  workspaceId,
                volunteer_user_id:
                  payload.volunteerUserId,
                title:
                  payload.title,
                precinct:
                  payload.precinct ||
                  null,
                turf_name:
                  payload.turfName ||
                  null,
                assignment_date:
                  payload.assignmentDate ||
                  null,
                shift_starts_at:
                  payload.shiftStartsAt ||
                  null,
                shift_ends_at:
                  payload.shiftEndsAt ||
                  null,
                meeting_location:
                  payload.meetingLocation ||
                  null,
                instructions:
                  payload.instructions ||
                  null,
                status:
                  payload.status ||
                  "assigned",
                created_by:
                  userId,
                updated_by:
                  userId,
              })
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            return data;
          },
          "The field assignment could not be created.",
        ),
      [
        runAction,
        userId,
        workspaceId,
      ],
    );

  const updateAssignment =
    useCallback(
      (
        assignmentId,
        payload,
      ) =>
        runAction(
          async () => {
            const {
              data,
              error: updateError,
            } = await supabase
              .from(
                "field_assignments",
              )
              .update({
                volunteer_user_id:
                  payload.volunteerUserId,
                title:
                  payload.title,
                precinct:
                  payload.precinct ||
                  null,
                turf_name:
                  payload.turfName ||
                  null,
                assignment_date:
                  payload.assignmentDate ||
                  null,
                shift_starts_at:
                  payload.shiftStartsAt ||
                  null,
                shift_ends_at:
                  payload.shiftEndsAt ||
                  null,
                meeting_location:
                  payload.meetingLocation ||
                  null,
                instructions:
                  payload.instructions ||
                  null,
                status:
                  payload.status,
                updated_by:
                  userId,
              })
              .eq(
                "id",
                assignmentId,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .select()
              .single();

            if (updateError) {
              throw updateError;
            }

            return data;
          },
          "The field assignment could not be updated.",
        ),
      [
        runAction,
        userId,
        workspaceId,
      ],
    );

  const deleteAssignment =
    useCallback(
      (assignmentId) =>
        runAction(
          async () => {
            const {
              error: deleteError,
            } = await supabase
              .from(
                "field_assignments",
              )
              .delete()
              .eq(
                "id",
                assignmentId,
              )
              .eq(
                "workspace_id",
                workspaceId,
              );

            if (deleteError) {
              throw deleteError;
            }

            return assignmentId;
          },
          "The field assignment could not be deleted.",
        ),
      [
        runAction,
        workspaceId,
      ],
    );

  const createRoute =
    useCallback(
      (
        assignmentId,
        payload,
      ) =>
        runAction(
          async () => {
            const {
              data,
              error: insertError,
            } = await supabase
              .from(
                "field_routes",
              )
              .insert({
                assignment_id:
                  assignmentId,
                route_order:
                  payload.routeOrder,
                name:
                  payload.name,
                start_location:
                  payload.startLocation ||
                  null,
                finish_mode:
                  payload.finishMode ||
                  "final_stop",
                instructions:
                  payload.instructions ||
                  null,
                status:
                  payload.status ||
                  "ready",
              })
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            return data;
          },
          "The route could not be created.",
        ),
      [runAction],
    );

  const updateRoute =
    useCallback(
      (
        routeId,
        payload,
      ) =>
        runAction(
          async () => {
            const {
              data,
              error: updateError,
            } = await supabase
              .from(
                "field_routes",
              )
              .update({
                route_order:
                  payload.routeOrder,
                name:
                  payload.name,
                start_location:
                  payload.startLocation ||
                  null,
                finish_mode:
                  payload.finishMode ||
                  "final_stop",
                instructions:
                  payload.instructions ||
                  null,
                status:
                  payload.status,
              })
              .eq(
                "id",
                routeId,
              )
              .select()
              .single();

            if (updateError) {
              throw updateError;
            }

            return data;
          },
          "The route could not be updated.",
        ),
      [runAction],
    );

  const deleteRoute =
    useCallback(
      (routeId) =>
        runAction(
          async () => {
            const {
              error: deleteError,
            } = await supabase
              .from(
                "field_routes",
              )
              .delete()
              .eq(
                "id",
                routeId,
              );

            if (deleteError) {
              throw deleteError;
            }

            return routeId;
          },
          "The route could not be deleted.",
        ),
      [runAction],
    );

  const createStop =
    useCallback(
      (
        routeId,
        payload,
      ) =>
        runAction(
          async () => {
            const {
              data,
              error: insertError,
            } = await supabase
              .from(
                "field_stops",
              )
              .insert({
                route_id:
                  routeId,
                stop_order:
                  payload.stopOrder,
                location_label:
                  payload.locationLabel ||
                  null,
                address_line_1:
                  payload.addressLine1,
                address_line_2:
                  payload.addressLine2 ||
                  null,
                city:
                  payload.city,
                state:
                  payload.state ||
                  "FL",
                postal_code:
                  payload.postalCode ||
                  null,
                latitude:
                  payload.latitude ||
                  null,
                longitude:
                  payload.longitude ||
                  null,
                instructions:
                  payload.instructions ||
                  null,
                status: "pending",
              })
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            return data;
          },
          "The field stop could not be created.",
        ),
      [runAction],
    );

  const bulkCreateStops =
    useCallback(
      (
        routeId,
        rows,
      ) =>
        runAction(
          async () => {
            if (
              !Array.isArray(rows) ||
              !rows.length
            ) {
              throw new Error(
                "No validated field stops were provided.",
              );
            }

            if (rows.length > 500) {
              throw new Error(
                "Import no more than 500 stops at one time.",
              );
            }

            const records = rows.map(
              (row) => ({
                route_id: routeId,
                stop_order: row.stopOrder,
                location_label: row.locationLabel || null,
                address_line_1: row.addressLine1,
                address_line_2: row.addressLine2 || null,
                city: row.city,
                state: row.state || "FL",
                postal_code: row.postalCode || null,
                latitude: row.latitude ?? null,
                longitude: row.longitude ?? null,
                instructions: row.instructions || null,
                status: "pending",
              }),
            );

            const {
              data,
              error: insertError,
            } = await supabase
              .from("field_stops")
              .insert(records)
              .select();

            if (insertError) {
              throw insertError;
            }

            return data || [];
          },
          "The field stops could not be imported.",
        ),
      [runAction],
    );

  const geocodeRoute =
    useCallback(
      (routeId) =>
        runAction(
          async () => {
            const {
              data,
              error:
                invokeError,
            } =
              await supabase
                .functions
                .invoke(
                  "geocode-field-route",
                  {
                    body: {
                      routeId,
                    },
                  },
                );

            if (invokeError) {
              let detail = "";

              try {
                const payload =
                  await invokeError
                    .context
                    ?.json();

                detail =
                  payload?.error ||
                  payload?.message ||
                  payload?.detail ||
                  "";
              } catch {
                // The SDK message remains the fallback.
              }

              throw new Error(
                detail ||
                  invokeError.message ||
                  "The geocoding function could not be reached.",
                {
                  cause:
                    invokeError,
                },
              );
            }

            if (!data?.ok) {
              throw new Error(
                data?.error ||
                  "The route addresses could not be located.",
              );
            }

            return data;
          },
          "The route addresses could not be located.",
        ),
      [runAction],
    );

  const reorderRouteStops =
    useCallback(
      (
        routeId,
        stopIds,
      ) =>
        runAction(
          async () => {
            if (
              !Array.isArray(
                stopIds,
              ) ||
              !stopIds.length
            ) {
              throw new Error(
                "A complete route order is required.",
              );
            }

            const {
              data,
              error:
                reorderError,
            } =
              await supabase
                .rpc(
                  "reorder_field_route_stops",
                  {
                    target_route_id:
                      routeId,
                    ordered_stop_ids:
                      stopIds,
                  },
                );

            if (reorderError) {
              throw reorderError;
            }

            return data || [];
          },
          "The route order could not be saved.",
        ),
      [runAction],
    );

  const saveAssignmentReview =
    useCallback(
      ({
        assignmentId,
        action,
        notes = "",
      }) =>
        runAction(
          async () => {
            const {
              data,
              error:
                reviewError,
            } =
              await supabase
                .rpc(
                  "save_field_assignment_review",
                  {
                    target_assignment_id:
                      assignmentId,
                    target_action:
                      action,
                    target_review_notes:
                      notes,
                  },
                );

            if (reviewError) {
              throw reviewError;
            }

            return Array.isArray(
              data,
            )
              ? data[0] ||
                  null
              : data;
          },
          "The completion review could not be saved.",
        ),
      [runAction],
    );


  const createFollowUpAssignment =
    useCallback(
      ({
        sourceAssignmentId,
        sourceStopIds,
        title,
        volunteerUserId = null,
        assignmentDate = null,
        meetingLocation = "",
        instructions = "",
        finishMode = "final_stop",
      }) =>
        runAction(
          async () => {
            if (
              !Array.isArray(
                sourceStopIds,
              ) ||
              !sourceStopIds.length
            ) {
              throw new Error(
                "Choose at least one recorded stop for follow-up.",
              );
            }

            const {
              data,
              error:
                followUpError,
            } =
              await supabase
                .rpc(
                  "create_field_follow_up_assignment",
                  {
                    target_source_assignment_id:
                      sourceAssignmentId,
                    target_source_stop_ids:
                      sourceStopIds,
                    target_title:
                      title,
                    target_volunteer_user_id:
                      volunteerUserId ||
                      null,
                    target_assignment_date:
                      assignmentDate ||
                      null,
                    target_meeting_location:
                      meetingLocation ||
                      null,
                    target_instructions:
                      instructions ||
                      null,
                    target_finish_mode:
                      finishMode ||
                      "final_stop",
                  },
                );

            if (followUpError) {
              throw followUpError;
            }

            return Array.isArray(
              data,
            )
              ? data[0] ||
                  null
              : data;
          },
          "The follow-up assignment could not be created.",
        ),
      [runAction],
    );


  const createTurfActionPlan =
    useCallback(
      ({
        groups,
        volunteerUserId = null,
        assignmentDate = null,
        meetingLocation = "",
        instructions = "",
        finishMode = "final_stop",
      }) =>
        runAction(
          async () => {
            if (
              !Array.isArray(
                groups,
              ) ||
              !groups.length
            ) {
              throw new Error(
                "Choose at least one reviewed source stop for the Turf Action Plan.",
              );
            }

            const sourceGroups =
              groups.map(
                (group) => ({
                  source_assignment_id:
                    group.sourceAssignmentId,
                  source_stop_ids:
                    group.sourceStopIds,
                  title:
                    group.title,
                }),
              );

            const {
              data,
              error:
                planError,
            } =
              await supabase
                .rpc(
                  "create_field_turf_action_plan",
                  {
                    target_workspace_id:
                      workspaceId,
                    target_source_groups:
                      sourceGroups,
                    target_volunteer_user_id:
                      volunteerUserId ||
                      null,
                    target_assignment_date:
                      assignmentDate ||
                      null,
                    target_meeting_location:
                      meetingLocation ||
                      null,
                    target_instructions:
                      instructions ||
                      null,
                    target_finish_mode:
                      finishMode ||
                      "final_stop",
                  },
                );

            if (planError) {
              throw planError;
            }

            return data || [];
          },
          "The Turf Action Plan could not be created.",
        ),
      [
        runAction,
        workspaceId,
      ],
    );

  const sendDeploymentHandoff =
    useCallback(
      (assignmentId) =>
        runAction(
          async () => {
            const {
              data,
              error: handoffError,
            } = await supabase.rpc(
              "send_field_assignment_handoff",
              {
                target_assignment_id:
                  assignmentId,
              },
            );

            if (handoffError) {
              throw handoffError;
            }

            return Array.isArray(
              data,
            )
              ? data[0] || null
              : data;
          },
          "The deployment handoff could not be sent.",
        ),
      [runAction],
    );

  const resetDeploymentHandoff =
    useCallback(
      (assignmentId) =>
        runAction(
          async () => {
            const {
              data,
              error: handoffError,
            } = await supabase.rpc(
              "reset_field_assignment_handoff",
              {
                target_assignment_id:
                  assignmentId,
              },
            );

            if (handoffError) {
              throw handoffError;
            }

            return data;
          },
          "The deployment handoff could not be reset.",
        ),
      [runAction],
    );

  const updateStop =
    useCallback(
      (
        stopId,
        payload,
      ) =>
        runAction(
          async () => {
            const {
              data,
              error: updateError,
            } = await supabase
              .from(
                "field_stops",
              )
              .update({
                stop_order:
                  payload.stopOrder,
                location_label:
                  payload.locationLabel ||
                  null,
                address_line_1:
                  payload.addressLine1,
                address_line_2:
                  payload.addressLine2 ||
                  null,
                city:
                  payload.city,
                state:
                  payload.state ||
                  "FL",
                postal_code:
                  payload.postalCode ||
                  null,
                latitude:
                  payload.latitude ||
                  null,
                longitude:
                  payload.longitude ||
                  null,
                instructions:
                  payload.instructions ||
                  null,
              })
              .eq(
                "id",
                stopId,
              )
              .select()
              .single();

            if (updateError) {
              throw updateError;
            }

            return data;
          },
          "The field stop could not be updated.",
        ),
      [runAction],
    );

  const deleteStop =
    useCallback(
      (stopId) =>
        runAction(
          async () => {
            const {
              error: deleteError,
            } = await supabase
              .from(
                "field_stops",
              )
              .delete()
              .eq(
                "id",
                stopId,
              );

            if (deleteError) {
              throw deleteError;
            }

            return stopId;
          },
          "The field stop could not be deleted.",
        ),
      [runAction],
    );

  return {
    assignments,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadAssignments({
        showLoading: true,
      }),
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    bulkCreateStops,
    geocodeRoute,
    reorderRouteStops,
    saveAssignmentReview,
    createFollowUpAssignment,
    createTurfActionPlan,
    sendDeploymentHandoff,
    resetDeploymentHandoff,
    updateStop,
    deleteStop,
  };
}

