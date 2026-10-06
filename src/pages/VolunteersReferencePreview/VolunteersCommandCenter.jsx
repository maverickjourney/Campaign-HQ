import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Footprints,
  MapPinned,
  RefreshCw,
  Route,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useVolunteersWorkspace,
} from "../../hooks/useVolunteersWorkspace";

import {
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./VolunteersCommandCenter.module.css";

const VIEW_IDS = new Set([
  "overview",
  "roster",
  "assignments",
  "routes",
]);

function labelStatus(value) {
  const clean =
    String(
      value ||
        "Not set",
    )
      .trim()
      .replaceAll(
        "_",
        " ",
      );

  return clean.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase(),
  );
}

function initials(name) {
  const parts =
    String(
      name ||
        "",
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return "V";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[
      parts.length - 1
    ][0]
  }`.toUpperCase();
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function readLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view: "overview",
      volunteerId: null,
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const volunteerId =
    url.searchParams.get(
      "volunteer",
    );

  const requestedView =
    url.searchParams.get(
      "volunteers-view",
    );

  return {
    view:
      volunteerId
        ? "roster"
        : VIEW_IDS.has(
              requestedView,
            )
          ? requestedView
          : "overview",

    volunteerId,
  };
}

function buildUrl({
  view,
  volunteerId = null,
}) {
  const url =
    new URL(
      window.location.href,
    );

  if (
    view &&
    view !== "overview"
  ) {
    url.searchParams.set(
      "volunteers-view",
      view,
    );
  } else {
    url.searchParams.delete(
      "volunteers-view",
    );
  }

  if (volunteerId) {
    url.searchParams.set(
      "volunteer",
      volunteerId,
    );
  } else {
    url.searchParams.delete(
      "volunteer",
    );
  }

  return (
    `${url.pathname}` +
    `${url.search}` +
    `${url.hash}`
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy,
}) {
  return (
    <div
      className={
        styles.emptyState
      }
    >
      <span>
        <Icon size={23} />
      </span>

      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
}

export default function VolunteersCommandCenter() {
  const workspace =
    getCurrentWorkspace();

  const {
    volunteers,
    assignments,
    metrics,
    loading,
    error,
    lastUpdated,
    refresh,
  } =
    useVolunteersWorkspace({
      workspaceId:
        workspace?.id ||
        "",
    });

  const [
    activeView,
    setActiveView,
  ] = useState(
    () =>
      readLocation().view,
  );

  const [
    selectedVolunteerId,
    setSelectedVolunteerId,
  ] = useState(
    () =>
      readLocation()
        .volunteerId,
  );

  const routes =
    useMemo(
      () =>
        assignments.flatMap(
          (assignment) =>
            (
              assignment
                .field_routes ||
              []
            ).map(
              (route) => ({
                ...route,
                assignment,
              }),
            ),
        ),
      [
        assignments,
      ],
    );

  const selectedVolunteer =
    volunteers.find(
      (volunteer) =>
        volunteer.id ===
        selectedVolunteerId,
    ) ||
    null;

  const incompleteProfiles =
    volunteers.filter(
      (volunteer) =>
        !volunteer.email ||
        !volunteer.phone,
    ).length;

  const applyLocation = (
    view,
    volunteerId = null,
    {
      replace = false,
    } = {},
  ) => {
    const nextUrl =
      buildUrl({
        view,
        volunteerId,
      });

    window.history[
      replace
        ? "replaceState"
        : "pushState"
    ](
      {},
      "",
      nextUrl,
    );

    setActiveView(view);
    setSelectedVolunteerId(
      volunteerId,
    );
  };

  useEffect(
    () => {
      const sync =
        () => {
          const next =
            readLocation();

          const matched =
            next.volunteerId
              ? volunteers.find(
                  (volunteer) =>
                    volunteer.id ===
                    next.volunteerId,
                )
              : null;

          const view =
            matched
              ? "roster"
              : next.view;

          const volunteerId =
            matched?.id ||
            null;

          setActiveView(view);
          setSelectedVolunteerId(
            volunteerId,
          );

          const canonical =
            buildUrl({
              view,
              volunteerId,
            });

          const current =
            `${window.location.pathname}` +
            `${window.location.search}` +
            `${window.location.hash}`;

          if (
            canonical !== current
          ) {
            window.history.replaceState(
              {},
              "",
              canonical,
            );
          }
        };

      sync();

      window.addEventListener(
        "popstate",
        sync,
      );

      return () =>
        window.removeEventListener(
          "popstate",
          sync,
        );
    },
    [
      volunteers,
    ],
  );

  const openView =
    (view) =>
      applyLocation(
        view,
        null,
      );

  const openVolunteer =
    (volunteer) =>
      applyLocation(
        "roster",
        volunteer.id,
      );

  return (
    <CampaignWorkspaceShell
      activeItem="Volunteers"
    >
      <main
        className={styles.main}
        data-volunteers-command-center="true"
        data-volunteers-storage="live"
        data-volunteers-navigation="canonical"
      >
        <div
          className={
            styles.canvas
          }
        >
          <section
            className={
              styles.hero
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Volunteer operations
              </span>

              <h1>
                Volunteers Command Center
              </h1>

              <p>
                Review the live volunteer roster,
                field assignments, routes, and
                recorded stop activity for this
                campaign workspace.
              </p>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              <button
                type="button"
                onClick={() =>
                  void refresh()
                }
                disabled={
                  loading
                }
              >
                <RefreshCw
                  size={17}
                  className={
                    loading
                      ? styles.spinning
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={() =>
                  window.location.assign(
                    "/field-operations",
                  )
                }
              >
                <MapPinned
                  size={17}
                />
                Field Operations
              </button>
            </div>
          </section>

          <section
            className={
              styles.connectionBanner
            }
            data-state={
              error
                ? "error"
                : loading
                  ? "loading"
                  : "ready"
            }
          >
            {error ? (
              <AlertTriangle
                size={17}
              />
            ) : loading ? (
              <RefreshCw
                className={
                  styles.spinning
                }
                size={17}
              />
            ) : (
              <CheckCircle2
                size={17}
              />
            )}

            <span>
              {error
                ? error
                : loading
                  ? "Loading live volunteer operations…"
                  : "Live Campaign Seat volunteer and field-operation sources connected"}
            </span>
          </section>

          <section
            className={
              styles.metrics
            }
            aria-label="Volunteer operations summary"
          >
            <button
              type="button"
              onClick={() =>
                openView(
                  "roster",
                )
              }
            >
              <span>
                <Users size={21} />
              </span>

              <div>
                <small>
                  Volunteer roster
                </small>

                <strong>
                  {metrics.roster}
                </strong>

                <p>
                  Live non-sample records
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                openView(
                  "assignments",
                )
              }
            >
              <span>
                <ClipboardCheck
                  size={21}
                />
              </span>

              <div>
                <small>
                  Assignments
                </small>

                <strong>
                  {metrics.assignments}
                </strong>

                <p>
                  {metrics.activeAssignments} active
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                openView(
                  "routes",
                )
              }
            >
              <span>
                <Route size={21} />
              </span>

              <div>
                <small>
                  Saved routes
                </small>

                <strong>
                  {metrics.routes}
                </strong>

                <p>
                  Live field routes
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                openView(
                  "overview",
                )
              }
            >
              <span>
                <Footprints
                  size={21}
                />
              </span>

              <div>
                <small>
                  Recorded stops
                </small>

                <strong>
                  {
                    metrics.recordedStops
                  }
                </strong>

                <p>
                  {metrics.pendingStops} pending
                </p>
              </div>
            </button>
          </section>

          <nav
            className={
              styles.tabs
            }
            aria-label="Volunteer views"
          >
            {[
              [
                "overview",
                "Overview",
              ],
              [
                "roster",
                "Roster",
              ],
              [
                "assignments",
                "Assignments",
              ],
              [
                "routes",
                "Routes",
              ],
            ].map(
              ([
                id,
                label,
              ]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    activeView ===
                    id
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    openView(id)
                  }
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          {activeView ===
          "overview" ? (
            <div
              className={
                styles.overviewGrid
              }
            >
              <div
                className={
                  styles.primaryColumn
                }
              >
                <section
                  className={
                    styles.panel
                  }
                >
                  <header
                    className={
                      styles.panelHeader
                    }
                  >
                    <div>
                      <span>
                        <Users
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Volunteer roster
                        </h2>

                        <p>
                          Live people available
                          to campaign volunteer
                          operations.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openView(
                          "roster",
                        )
                      }
                    >
                      View roster
                      <ChevronRight
                        size={15}
                      />
                    </button>
                  </header>

                  {volunteers.length ? (
                    <div
                      className={
                        styles.previewList
                      }
                    >
                      {volunteers
                        .slice(
                          0,
                          5,
                        )
                        .map(
                          (
                            volunteer,
                          ) => (
                            <button
                              key={
                                volunteer.id
                              }
                              type="button"
                              onClick={() =>
                                openVolunteer(
                                  volunteer,
                                )
                              }
                            >
                              <span
                                className={
                                  styles.avatar
                                }
                              >
                                {initials(
                                  volunteer.full_name,
                                )}
                              </span>

                              <div>
                                <strong>
                                  {
                                    volunteer.full_name
                                  }
                                </strong>

                                <small>
                                  {volunteer.team ||
                                    "General volunteer"}{" "}
                                  ·{" "}
                                  {labelStatus(
                                    volunteer.status,
                                  )}
                                </small>
                              </div>

                              <ChevronRight
                                size={16}
                              />
                            </button>
                          ),
                        )}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="No live volunteers yet"
                      copy="The volunteer roster is empty. Sample volunteer records are not substituted into the live workspace."
                    />
                  )}
                </section>

                <section
                  className={
                    styles.panel
                  }
                >
                  <header
                    className={
                      styles.panelHeader
                    }
                  >
                    <div>
                      <span>
                        <ClipboardCheck
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Field execution
                        </h2>

                        <p>
                          Assignments, routes,
                          and stop completion
                          from the live field
                          tables.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openView(
                          "assignments",
                        )
                      }
                    >
                      View assignments
                      <ChevronRight
                        size={15}
                      />
                    </button>
                  </header>

                  {assignments.length ? (
                    <div
                      className={
                        styles.assignmentPreview
                      }
                    >
                      {assignments
                        .slice(
                          0,
                          5,
                        )
                        .map(
                          (
                            assignment,
                          ) => (
                            <article
                              key={
                                assignment.id
                              }
                            >
                              <div>
                                <strong>
                                  {
                                    assignment.title
                                  }
                                </strong>

                                <small>
                                  {assignment.turf_name ||
                                    assignment.precinct ||
                                    "No turf label"}{" "}
                                  ·{" "}
                                  {formatDate(
                                    assignment.assignment_date,
                                  )}
                                </small>
                              </div>

                              <em>
                                {labelStatus(
                                  assignment.status,
                                )}
                              </em>
                            </article>
                          ),
                        )}
                    </div>
                  ) : (
                    <EmptyState
                      icon={
                        ClipboardCheck
                      }
                      title="No field assignments yet"
                      copy="There are no live field assignments, routes, or door-stop records in this workspace."
                    />
                  )}
                </section>
              </div>

              <aside
                className={
                  styles.sideColumn
                }
              >
                <section
                  className={
                    styles.attentionPanel
                  }
                >
                  <header>
                    <AlertTriangle
                      size={18}
                    />

                    <div>
                      <small>
                        Needs attention
                      </small>

                      <h2>
                        Volunteer readiness
                      </h2>
                    </div>
                  </header>

                  <div>
                    <article>
                      <span>
                        Active assignments
                      </span>
                      <strong>
                        {
                          metrics.activeAssignments
                        }
                      </strong>
                    </article>

                    <article>
                      <span>
                        Pending stops
                      </span>
                      <strong>
                        {
                          metrics.pendingStops
                        }
                      </strong>
                    </article>

                    <article>
                      <span>
                        Incomplete contact profiles
                      </span>
                      <strong>
                        {
                          incompleteProfiles
                        }
                      </strong>
                    </article>
                  </div>
                </section>

                <section
                  className={
                    styles.sourcePanel
                  }
                >
                  <ShieldCheck
                    size={19}
                  />

                  <div>
                    <strong>
                      Live reporting source
                    </strong>

                    <p>
                      Roster data comes from
                      <code>
                        volunteers
                      </code>
                      . Field execution comes
                      from assignments, routes,
                      and stops under existing
                      workspace RLS.
                    </p>

                    <small>
                      V93 is read-only. Use
                      Field Operations for
                      existing assignment
                      management workflows.
                    </small>
                  </div>
                </section>

                <div
                  className={
                    styles.updated
                  }
                >
                  {lastUpdated
                    ? `Refreshed ${lastUpdated.toLocaleTimeString(
                        [],
                        {
                          hour:
                            "numeric",
                          minute:
                            "2-digit",
                        },
                      )}`
                    : "Waiting for live refresh"}
                </div>
              </aside>
            </div>
          ) : null}

          {activeView ===
          "roster" ? (
            <section
              className={
                styles.panel
              }
            >
              <header
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    <Users
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Volunteer roster
                    </h2>

                    <p>
                      Live non-sample
                      volunteer records for
                      this workspace.
                    </p>
                  </div>
                </div>

                <strong
                  className={
                    styles.countPill
                  }
                >
                  {volunteers.length}
                </strong>
              </header>

              {volunteers.length ? (
                <div
                  className={
                    styles.table
                  }
                >
                  <div
                    className={
                      styles.tableHeader
                    }
                  >
                    <span>
                      Volunteer
                    </span>
                    <span>Team</span>
                    <span>Status</span>
                    <span>
                      Shifts
                    </span>
                  </div>

                  {volunteers.map(
                    (
                      volunteer,
                    ) => (
                      <button
                        key={
                          volunteer.id
                        }
                        type="button"
                        onClick={() =>
                          openVolunteer(
                            volunteer,
                          )
                        }
                      >
                        <div
                          className={
                            styles.nameCell
                          }
                        >
                          <span
                            className={
                              styles.avatar
                            }
                          >
                            {initials(
                              volunteer.full_name,
                            )}
                          </span>

                          <span>
                            <strong>
                              {
                                volunteer.full_name
                              }
                            </strong>

                            <small>
                              {volunteer.email ||
                                "No email"}
                            </small>
                          </span>
                        </div>

                        <span>
                          {volunteer.team ||
                            "General"}
                        </span>

                        <span>
                          {labelStatus(
                            volunteer.status,
                          )}
                        </span>

                        <span>
                          {Number(
                            volunteer.shifts_completed ||
                              0,
                          )}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No live volunteer records"
                  copy="The real volunteer table is empty for this workspace."
                />
              )}
            </section>
          ) : null}

          {activeView ===
          "assignments" ? (
            <section
              className={
                styles.panel
              }
            >
              <header
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    <ClipboardCheck
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Field assignments
                    </h2>

                    <p>
                      Live leadership field
                      assignments for this
                      workspace.
                    </p>
                  </div>
                </div>

                <strong
                  className={
                    styles.countPill
                  }
                >
                  {
                    assignments.length
                  }
                </strong>
              </header>

              {assignments.length ? (
                <div
                  className={
                    styles.cardGrid
                  }
                >
                  {assignments.map(
                    (
                      assignment,
                    ) => {
                      const assignmentRoutes =
                        assignment.field_routes ||
                        [];

                      const assignmentStops =
                        assignmentRoutes.flatMap(
                          (
                            route,
                          ) =>
                            route.field_stops ||
                            [],
                        );

                      return (
                        <article
                          key={
                            assignment.id
                          }
                        >
                          <header>
                            <div>
                              <small>
                                {assignment.precinct ||
                                  "Field assignment"}
                              </small>

                              <h3>
                                {
                                  assignment.title
                                }
                              </h3>
                            </div>

                            <em>
                              {labelStatus(
                                assignment.status,
                              )}
                            </em>
                          </header>

                          <p>
                            {assignment.turf_name ||
                              assignment.meeting_location ||
                              "No field location set"}
                          </p>

                          <footer>
                            <span>
                              {assignmentRoutes.length} routes
                            </span>

                            <span>
                              {assignmentStops.length} stops
                            </span>

                            <span>
                              {formatDate(
                                assignment.assignment_date,
                              )}
                            </span>
                          </footer>
                        </article>
                      );
                    },
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={
                    ClipboardCheck
                  }
                  title="No field assignments"
                  copy="No live leadership assignments exist for this workspace."
                />
              )}
            </section>
          ) : null}

          {activeView ===
          "routes" ? (
            <section
              className={
                styles.panel
              }
            >
              <header
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    <Route
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Routes &amp; stops
                    </h2>

                    <p>
                      Live routes nested under
                      campaign field
                      assignments.
                    </p>
                  </div>
                </div>

                <strong
                  className={
                    styles.countPill
                  }
                >
                  {routes.length}
                </strong>
              </header>

              {routes.length ? (
                <div
                  className={
                    styles.cardGrid
                  }
                >
                  {routes.map(
                    (route) => {
                      const stops =
                        route.field_stops ||
                        [];

                      const recorded =
                        stops.filter(
                          (stop) =>
                            String(
                              stop.status ||
                                "pending",
                            ).toLowerCase() !==
                            "pending",
                        ).length;

                      return (
                        <article
                          key={
                            route.id
                          }
                        >
                          <header>
                            <div>
                              <small>
                                {route.assignment
                                  ?.title ||
                                  "Field assignment"}
                              </small>

                              <h3>
                                {route.name ||
                                  `Route ${route.route_order}`}
                              </h3>
                            </div>

                            <em>
                              {labelStatus(
                                route.status,
                              )}
                            </em>
                          </header>

                          <p>
                            {route.start_location ||
                              "No start location set"}
                          </p>

                          <footer>
                            <span>
                              {stops.length} stops
                            </span>

                            <span>
                              {recorded} recorded
                            </span>

                            <span>
                              {
                                stops.length -
                                recorded
                              }{" "}
                              pending
                            </span>
                          </footer>
                        </article>
                      );
                    },
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Route}
                  title="No live routes"
                  copy="No routes or stop lists exist in the field-operation tables for this workspace."
                />
              )}
            </section>
          ) : null}
        </div>

        {selectedVolunteer ? (
          <div
            className={
              styles.drawerScrim
            }
            role="presentation"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                applyLocation(
                  "roster",
                );
              }
            }}
          >
            <aside
              className={
                styles.drawer
              }
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedVolunteer.full_name} volunteer details`}
            >
              <header>
                <div>
                  <span
                    className={
                      styles.drawerAvatar
                    }
                  >
                    {initials(
                      selectedVolunteer.full_name,
                    )}
                  </span>

                  <div>
                    <small>
                      Volunteer record
                    </small>

                    <h2>
                      {
                        selectedVolunteer.full_name
                      }
                    </h2>

                    <p>
                      {selectedVolunteer.team ||
                        "General volunteer"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close volunteer details"
                  onClick={() =>
                    applyLocation(
                      "roster",
                    )
                  }
                >
                  <X size={18} />
                </button>
              </header>

              <div
                className={
                  styles.drawerBody
                }
              >
                <article>
                  <small>Status</small>
                  <strong>
                    {labelStatus(
                      selectedVolunteer.status,
                    )}
                  </strong>
                </article>

                <article>
                  <small>Email</small>
                  <strong>
                    {selectedVolunteer.email ||
                      "Not recorded"}
                  </strong>
                </article>

                <article>
                  <small>Phone</small>
                  <strong>
                    {selectedVolunteer.phone ||
                      "Not recorded"}
                  </strong>
                </article>

                <article>
                  <small>
                    Shifts completed
                  </small>
                  <strong>
                    {Number(
                      selectedVolunteer.shifts_completed ||
                        0,
                    )}
                  </strong>
                </article>

                <section>
                  <small>
                    Interests
                  </small>

                  <div
                    className={
                      styles.interests
                    }
                  >
                    {Array.isArray(
                      selectedVolunteer.interests,
                    ) &&
                    selectedVolunteer
                      .interests
                      .length ? (
                      selectedVolunteer
                        .interests
                        .map(
                          (
                            interest,
                          ) => (
                            <span
                              key={
                                interest
                              }
                            >
                              {
                                interest
                              }
                            </span>
                          ),
                        )
                    ) : (
                      <span>
                        No interests
                        recorded
                      </span>
                    )}
                  </div>
                </section>

                <section>
                  <small>Notes</small>

                  <p>
                    {selectedVolunteer.notes ||
                      "No volunteer notes recorded."}
                  </p>
                </section>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}
