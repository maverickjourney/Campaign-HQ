import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  House,
  LoaderCircle,
  MapPin,
  Menu,
  Navigation,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import {
  CampaignDateTime,
} from "../../components/CampaignDateTime/CampaignDateTime";
import {
  FieldRouteMap,
} from "../../components/FieldRouteMap/FieldRouteMap";
import {
  useVolunteerFieldAssignment,
} from "../../hooks/useVolunteerFieldAssignment";
import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./VolunteerFieldAssignment.module.css";

const RESULTS = [
  ["Contacted", "contacted", "completed"],
  ["Not home", "not_home", "completed"],
  ["Refused", "refused", "completed"],
  ["Inaccessible", "inaccessible", "inaccessible"],
  ["Moved", "moved", "completed"],
  ["Other", "other", "completed"],
];

function labelStatus(value) {
  const labels = {
    assigned: "Assigned",
    accepted: "Accepted",
    in_progress: "In progress",
    completed: "Completed",
    pending: "Pending",
    skipped: "Skipped",
    inaccessible: "Inaccessible",
  };

  return (
    labels[value] ||
    String(value || "Pending")
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (character) => character.toUpperCase(),
      )
  );
}

function formatDate(value) {
  if (!value) {
    return "Date pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function formatShiftTime(startsAt, endsAt) {
  if (!startsAt) {
    return "Time pending";
  }

  return [
    formatTime(startsAt),
    formatTime(endsAt),
  ]
    .filter(Boolean)
    .join(" – ");
}

function latestDeploymentHandoff(
  assignment,
) {
  return (
    (
      assignment
        ?.deployment_handoffs ||
      []
    )
      .slice()
      .sort(
        (left, right) =>
          Number(
            right.cycle_number ||
              0,
          ) -
            Number(
              left.cycle_number ||
                0,
            ) ||
          new Date(
            right.sent_at ||
              right.created_at ||
              0,
          ).getTime() -
            new Date(
              left.sent_at ||
                left.created_at ||
                0,
            ).getTime(),
      )[0] ||
    null
  );
}

function deploymentHandoffState(
  handoff,
) {
  if (!handoff) {
    return "not_sent";
  }

  if (
    handoff.invalidated_at ||
    handoff.status ===
      "invalidated"
  ) {
    return "changed";
  }

  if (
    handoff.acknowledged_at ||
    handoff.status ===
      "acknowledged"
  ) {
    return "acknowledged";
  }

  return "awaiting";
}

function getAddress(stop) {
  return [
    stop.address_line_1,
    stop.address_line_2,
    [
      stop.city,
      stop.state,
      stop.postal_code,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function routeFinishText(
  route,
  meetingLocation = "",
) {
  if (
    route.finish_mode ===
    "return_start"
  ) {
    return "After the final visit, return to the starting stop.";
  }

  if (
    route.finish_mode ===
    "meeting_point"
  ) {
    return meetingLocation
      ? `After the final visit, return to the meeting point at ${meetingLocation}.`
      : "After the final visit, return to the campaign meeting point.";
  }

  return "The route ends after the final stop.";
}

function directionsUrl(stop) {
  return (
    "https://www.google.com/maps/search/" +
    `?api=1&query=${encodeURIComponent(
      getAddress(stop),
    )}`
  );
}

export default function VolunteerFieldAssignment() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    expandedStopId,
    setExpandedStopId,
  ] = useState("");

  const [
    noteDrafts,
    setNoteDrafts,
  ] = useState({});

  const {
    activeAssignment: assignment,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    updateAssignmentStatus,
    acknowledgeDeploymentHandoff,
    recordStopResult,
  } = useVolunteerFieldAssignment({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const handoff =
    latestDeploymentHandoff(
      assignment,
    );

  const handoffState =
    deploymentHandoffState(
      handoff,
    );

  const routes =
    assignment?.field_routes || [];

  const stops = routes.flatMap(
    (route) => route.field_stops || [],
  );

  const pendingStops = stops.filter(
    (stop) => stop.status === "pending",
  );

  const finishedStops = stops.filter(
    (stop) => stop.status !== "pending",
  );

  const progress = stops.length
    ? Math.round(
        (finishedStops.length /
          stops.length) *
          100,
      )
    : 0;

  const changeAssignmentStatus =
    async (nextStatus) => {
      try {
        await updateAssignmentStatus(
          assignment.id,
          nextStatus,
        );
      } catch {
        // The hook displays the secure database error.
      }
    };

  const acknowledgeHandoff =
    async () => {
      if (!assignment?.id) {
        return;
      }

      try {
        await acknowledgeDeploymentHandoff(
          assignment.id,
        );
      } catch {
        // The hook displays the secure database error.
      }
    };

  const saveStop = async (
    stop,
    status,
    resultCode = null,
  ) => {
    try {
      await recordStopResult({
        stopId: stop.id,
        status,
        resultCode,
        notes:
          noteDrafts[stop.id] ??
          stop.volunteer_notes ??
          "",
      });

      setExpandedStopId("");
    } catch {
      // The hook displays the secure database error.
    }
  };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="My field assignment"
        sidebarOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={shellStyles}
        showLeadership={false}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span>
                Campaign HQ
                <ChevronRight size={13} />
                Volunteer
              </span>

              <strong>
                My Field Assignment
              </strong>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <CampaignDateTime />

            <span className={styles.secureBadge}>
              <ShieldCheck size={15} />
              Assigned route only
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span>Field operations</span>

              <h1>
                My Field Assignment
              </h1>

              <p>
                Review your assigned
                precinct, route and stops.
                Only work assigned directly
                to your account appears
                here.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle
                  className={styles.spinning}
                  size={17}
                />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh
            </button>
          </section>

          {error && (
            <div
              className={styles.error}
              role="alert"
            >
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {!isLoading &&
          assignment &&
          handoff && (
            <section
              className={
                styles.deploymentHandoffCard
              }
              data-state={
                handoffState
              }
            >
              <div
                className={
                  styles.deploymentHandoffIcon
                }
              >
                {handoffState ===
                "acknowledged" ? (
                  <CheckCircle2
                    size={22}
                  />
                ) : handoffState ===
                  "changed" ? (
                  <AlertTriangle
                    size={22}
                  />
                ) : (
                  <ShieldCheck
                    size={22}
                  />
                )}
              </div>

              <div
                className={
                  styles.deploymentHandoffCopy
                }
              >
                <span>
                  Private deployment handoff
                </span>

                <strong>
                  {handoffState ===
                  "acknowledged"
                    ? "Assignment received"
                    : handoffState ===
                        "changed"
                      ? "Assignment changed"
                      : "Leadership is requesting acknowledgment"}
                </strong>

                <p>
                  {handoffState ===
                  "acknowledged"
                    ? `You acknowledged this assignment ${formatDate(
                        handoff
                          .acknowledged_at,
                      )} at ${formatTime(
                        handoff
                          .acknowledged_at,
                      )}.`
                    : handoffState ===
                        "changed"
                      ? handoff
                          .invalidation_reason ||
                        "Leadership updated the assignment. Wait for a new handoff before acknowledging."
                      : `Review the date, shift, meeting point, route and instructions below. Sent ${formatDate(
                          handoff.sent_at,
                        )} at ${formatTime(
                          handoff.sent_at,
                        )}.`}
                </p>

                <small>
                  Acknowledgment confirms
                  receipt only. It does not
                  start the route or record
                  any field result.
                </small>
              </div>

              {handoffState ===
                "awaiting" && (
                <button
                  type="button"
                  disabled={
                    isSaving
                  }
                  onClick={
                    acknowledgeHandoff
                  }
                >
                  <CheckCircle2
                    size={17}
                  />
                  {isSaving
                    ? "Acknowledging..."
                    : "I received this assignment"}
                </button>
              )}
            </section>
          )}


          {isLoading ? (
            <section className={styles.loading}>
              <LoaderCircle
                className={styles.spinning}
                size={32}
              />

              <strong>
                Loading your secure field
                assignment
              </strong>
            </section>
          ) : !assignment ? (
            <section className={styles.empty}>
              <div>
                <MapPin size={34} />
              </div>

              <span>
                No field assignment yet
              </span>

              <h2>
                Your precinct and route
                will appear here
              </h2>

              <p>
                A campaign manager must
                assign a precinct, turf,
                shift and route directly
                to your Volunteer account.
              </p>
            </section>
          ) : (
            <>
              <section className={styles.assignmentOverview}>
                <div className={styles.overviewPrimary}>
                  <div className={styles.overviewHeading}>
                    <div>
                      <span className={styles.overviewStatus}>
                        <Route size={16} />
                        {labelStatus(
                          assignment.status,
                        )}
                      </span>

                      <h2>
                        {assignment.title ||
                          "Field assignment"}
                      </h2>
                    </div>

                    <div className={styles.overviewActions}>
                      {assignment.status ===
                        "assigned" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            changeAssignmentStatus(
                              "accepted",
                            )
                          }
                        >
                          <CheckCircle2 size={17} />
                          Accept assignment
                        </button>
                      )}

                      {assignment.status ===
                        "accepted" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            changeAssignmentStatus(
                              "in_progress",
                            )
                          }
                        >
                          <Play size={17} />
                          Start route
                        </button>
                      )}

                      {assignment.status ===
                        "completed" && (
                        <span className={styles.completedAction}>
                          <CheckCircle2 size={17} />
                          Assignment completed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={styles.overviewInstructions}>
                    {assignment.instructions ||
                      "Follow the route in order and record a result for every assigned stop."}
                  </p>

                  <div className={styles.overviewFacts}>
                    <div>
                      <span>Assignment date</span>
                      <strong>
                        {formatDate(
                          assignment.assignment_date,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Shift</span>
                      <strong>
                        {formatShiftTime(
                          assignment.shift_starts_at,
                          assignment.shift_ends_at,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Precinct</span>
                      <strong>
                        {assignment.precinct ||
                          "Pending"}
                      </strong>
                    </div>

                    <div>
                      <span>Turf</span>
                      <strong>
                        {assignment.turf_name ||
                          "Pending"}
                      </strong>
                    </div>

                    <div>
                      <span>Meeting point</span>
                      <strong>
                        {assignment.meeting_location ||
                          "Pending"}
                      </strong>
                    </div>
                  </div>
                </div>

                <aside className={styles.overviewProgress}>
                  <div className={styles.progressHeading}>
                    <span>Route progress</span>
                    <strong>{progress}%</strong>
                  </div>

                  <div className={styles.progressTrack}>
                    <span
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <p>
                    {finishedStops.length} of{" "}
                    {stops.length} stops recorded
                  </p>

                  <div className={styles.progressStats}>
                    <div>
                      <small>Remaining</small>
                      <strong>
                        {pendingStops.length}
                      </strong>
                    </div>

                    <div>
                      <small>Routes</small>
                      <strong>
                        {routes.length}
                      </strong>
                    </div>
                  </div>
                </aside>
              </section>

              {routes.length ? (
                <section className={styles.routes}>
                  {routes.map(
                    (route, routeIndex) => {
                      const routeStops =
                        route.field_stops ||
                        [];

                      const recorded =
                        routeStops.filter(
                          (stop) =>
                            stop.status !==
                            "pending",
                        ).length;

                      return (
                        <article
                          className={styles.routeCard}
                          key={route.id}
                        >
                          <header>
                            <div className={styles.routeNumber}>
                              {routeIndex + 1}
                            </div>

                            <div>
                              <span>
                                Route{" "}
                                {route.route_order}
                              </span>
                              <h2>{route.name}</h2>
                              <p>
                                {route.start_location ||
                                  route.instructions ||
                                  "Follow the assigned stops in order."}
                              </p>
                            </div>

                            <small>
                              {recorded} of{" "}
                              {routeStops.length}{" "}
                              recorded
                            </small>
                          </header>

                          <div className={styles.routeMapWrap}>
                            <FieldRouteMap
                              eyebrow="My route map"
                              title={`${route.name || `Route ${route.route_order}`} map`}
                              routes={[route]}
                              meetingLocation={
                                assignment.meeting_location ||
                                ""
                              }
                              privacyLabel="Assigned stops only"
                            />
                          </div>

                          <div className={styles.routeFinishNotice}>
                            <Navigation
                              size={17}
                            />

                            <div>
                              <span>
                                Route finish
                              </span>

                              <strong>
                                {routeFinishText(
                                  route,
                                  assignment.meeting_location ||
                                    "",
                                )}
                              </strong>
                            </div>
                          </div>

                          {routeStops.length ? (
                            <div className={styles.stopList}>
                              {routeStops.map(
                                (stop) => {
                                  const expanded =
                                    expandedStopId ===
                                    stop.id;

                                  return (
                                    <div
                                      className={[
                                        styles.stopCard,
                                        stop.status !==
                                        "pending"
                                          ? styles.finishedStop
                                          : "",
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      key={stop.id}
                                    >
                                      <div className={styles.stopMain}>
                                        <div className={styles.stopOrder}>
                                          {stop.status ===
                                          "pending" ? (
                                            <Circle
                                              size={19}
                                            />
                                          ) : (
                                            <CheckCircle2
                                              size={19}
                                            />
                                          )}
                                          <span>
                                            {stop.stop_order}
                                          </span>
                                        </div>

                                        <div className={styles.stopCopy}>
                                          <div className={styles.stopHeading}>
                                            <div>
                                              <span>
                                                {stop.location_label ||
                                                  `Stop ${stop.stop_order}`}
                                              </span>
                                              <h3>
                                                {getAddress(
                                                  stop,
                                                )}
                                              </h3>
                                            </div>

                                            <small>
                                              {labelStatus(
                                                stop.status,
                                              )}
                                              {stop.result_code
                                                ? ` · ${labelStatus(
                                                    stop.result_code,
                                                  )}`
                                                : ""}
                                            </small>
                                          </div>

                                          {stop.instructions && (
                                            <p>
                                              {stop.instructions}
                                            </p>
                                          )}

                                          {stop.volunteer_notes && (
                                            <blockquote>
                                              {stop.volunteer_notes}
                                            </blockquote>
                                          )}

                                          <div className={styles.stopActions}>
                                            <a
                                              href={directionsUrl(
                                                stop,
                                              )}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              <Navigation
                                                size={15}
                                              />
                                              Directions
                                            </a>

                                            {assignment.status !==
                                              "completed" && (
                                              <button
                                                className={
                                                  stop.status ===
                                                  "pending"
                                                    ? styles.primaryStopAction
                                                    : styles.secondaryStopAction
                                                }
                                                type="button"
                                                onClick={() => {
                                                  setExpandedStopId(
                                                    expanded
                                                      ? ""
                                                      : stop.id,
                                                  );

                                                  setNoteDrafts(
                                                    (current) => ({
                                                      ...current,
                                                      [stop.id]:
                                                        current[
                                                          stop.id
                                                        ] ??
                                                        stop.volunteer_notes ??
                                                        "",
                                                    }),
                                                  );
                                                }}
                                              >
                                                <House
                                                  size={15}
                                                />
                                                {expanded
                                                  ? "Close"
                                                  : stop.status ===
                                                      "pending"
                                                    ? "Record result"
                                                    : "Edit result"}
                                              </button>
                                            )}

                                            {stop.status !==
                                              "pending" &&
                                              assignment.status !==
                                                "completed" && (
                                              <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() =>
                                                  saveStop(
                                                    stop,
                                                    "pending",
                                                  )
                                                }
                                              >
                                                <RotateCcw
                                                  size={15}
                                                />
                                                Reset
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {expanded && (
                                        <div className={styles.resultPanel}>
                                          <label>
                                            <span>
                                              Optional field note
                                            </span>

                                            <textarea
                                              value={
                                                noteDrafts[
                                                  stop.id
                                                ] ?? ""
                                              }
                                              onChange={(event) =>
                                                setNoteDrafts(
                                                  (current) => ({
                                                    ...current,
                                                    [stop.id]:
                                                      event.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder="Add a brief note for campaign leadership."
                                            />
                                          </label>

                                          <div className={styles.resultButtons}>
                                            {RESULTS.map(
                                              ([
                                                label,
                                                resultCode,
                                                status,
                                              ]) => (
                                                <button
                                                  key={resultCode}
                                                  type="button"
                                                  disabled={isSaving}
                                                  onClick={() =>
                                                    saveStop(
                                                      stop,
                                                      status,
                                                      resultCode,
                                                    )
                                                  }
                                                >
                                                  {label}
                                                </button>
                                              ),
                                            )}

                                            <button
                                              className={styles.skipButton}
                                              type="button"
                                              disabled={isSaving}
                                              onClick={() =>
                                                saveStop(
                                                  stop,
                                                  "skipped",
                                                )
                                              }
                                            >
                                              Skip stop
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <div className={styles.routeEmpty}>
                              No stops have
                              been added to
                              this route yet.
                            </div>
                          )}
                        </article>
                      );
                    },
                  )}
                </section>
              ) : (
                <section className={styles.routePending}>
                  <Route size={32} />
                  <strong>
                    Route details are
                    pending
                  </strong>
                  <p>
                    Campaign leadership
                    assigned the shift but
                    has not added a route
                    or stops yet.
                  </p>
                </section>
              )}

              {assignment.status ===
                "in_progress" && (
                <section
                  className={styles.completionCard}
                  data-ready={
                    pendingStops.length
                      ? "false"
                      : "true"
                  }
                >
                  <div>
                    <span>Finish field work</span>

                    <strong>
                      {pendingStops.length
                        ? `${pendingStops.length} ${
                            pendingStops.length === 1
                              ? "stop remains"
                              : "stops remain"
                          }`
                        : "Every stop is recorded"}
                    </strong>

                    <p>
                      {pendingStops.length
                        ? "Record or skip every remaining stop before completing this assignment."
                        : "Review the route once more, then complete the assignment for leadership review."}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      isSaving ||
                      pendingStops.length > 0
                    }
                    onClick={() =>
                      changeAssignmentStatus(
                        "completed",
                      )
                    }
                    title={
                      pendingStops.length
                        ? "Complete or skip every remaining stop first."
                        : "Complete this assignment."
                    }
                  >
                    <CheckCircle2 size={18} />
                    Complete assignment
                  </button>
                </section>
              )}

              {assignment.status ===
                "completed" && (
                <section
                  className={[
                    styles.completionCard,
                    styles.completionCardDone,
                  ].join(" ")}
                >
                  <div>
                    <span>Field work complete</span>
                    <strong>Assignment completed</strong>
                    <p>
                      Every stop has a saved result and this assignment is ready for leadership review.
                    </p>
                  </div>

                  <span className={styles.completedAction}>
                    <CheckCircle2 size={18} />
                    Completed
                  </span>
                </section>
              )}

            </>
          )}

          <footer className={styles.footer}>
            <span>
              <ShieldCheck size={14} />
              Private assigned field data
            </span>

            <small>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString(
                    [],
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}`
                : "Waiting for secure sync"}
            </small>
          </footer>
        </main>
      </div>
    </div>
  );
}

