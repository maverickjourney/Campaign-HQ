
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  RefreshCw,
  Sparkles,
  Target,
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
  useReportsAnalyticsWorkspace,
} from "../../hooks/useReportsAnalyticsWorkspace";

import {
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./ReportsAnalyticsReferencePreview.module.css";


const REPORT_VIEWS =
  new Set([
    "overview",
    "operations",
    "history",
  ]);


function safeDate(value) {
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


function formatDate(
  value,
  timezone,
) {
  const date =
    safeDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function formatDateTime(
  value,
  timezone,
) {
  const date =
    safeDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function formatTime(
  value,
  timezone,
) {
  const date =
    value instanceof Date
      ? value
      : safeDate(
          value,
        );

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function readReportsLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      snapshotId:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requestedView =
    url.searchParams.get(
      "reports-view",
    );

  return {
    view:
      REPORT_VIEWS.has(
        requestedView,
      )
        ? requestedView
        : "overview",

    snapshotId:
      url.searchParams.get(
        "snapshot",
      ) ||
      "",
  };
}


function healthLabel(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Not measured";
  }

  return `${value}%`;
}


export default function ReportsAnalyticsReferencePreview() {
  const workspace =
    getCurrentWorkspace();

  const timezone =
    workspace?.timezone ||
    "America/New_York";

  const {
    report,
    snapshots,
    tasks,
    events,
    goals,
    loading,
    error,
    lastUpdated,
    refresh,
  } =
    useReportsAnalyticsWorkspace({
      workspaceId:
        workspace?.id ||
        "",
    });


  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readReportsLocation()
          .view,
    );

  const [
    selectedSnapshotId,
    setSelectedSnapshotId,
  ] =
    useState(
      () =>
        readReportsLocation()
          .snapshotId,
    );

  const [
    notice,
    setNotice,
  ] =
    useState("");


  const selectedSnapshot =
    selectedSnapshotId
      ? snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId,
        ) ||
        null
      : null;


  const recentTasks =
    useMemo(
      () =>
        tasks.slice(
          0,
          8,
        ),
      [
        tasks,
      ],
    );

  const upcomingEvents =
    useMemo(
      () => {
        const now =
          Date.now();

        return events
          .filter(
            (event) => {
              const start =
                safeDate(
                  event.starts_at,
                );

              return (
                event.status ===
                  "scheduled" &&
                start &&
                start.getTime() >=
                  now
              );
            },
          )
          .slice(
            0,
            8,
          );
      },
      [
        events,
      ],
    );


  const applyLocation =
    (
      nextView,
      nextSnapshotId = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "reports-view",
        nextView,
      );

      if (
        nextSnapshotId
      ) {
        url.searchParams.set(
          "snapshot",
          nextSnapshotId,
        );
      } else {
        url.searchParams.delete(
          "snapshot",
        );
      }

      const nextUrl =
        `${url.pathname}${url.search}${url.hash}`;

      window.history[
        replace
          ? "replaceState"
          : "pushState"
      ](
        {},
        "",
        nextUrl,
      );

      setActiveView(
        nextView,
      );

      setSelectedSnapshotId(
        nextSnapshotId,
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          const next =
            readReportsLocation();

          setActiveView(
            next.view,
          );

          setSelectedSnapshotId(
            next.snapshotId,
          );
        };

      window.addEventListener(
        "popstate",
        syncHistory,
      );

      return () => {
        window.removeEventListener(
          "popstate",
          syncHistory,
        );
      };
    },
    [],
  );


  return (
    <CampaignWorkspaceShell
      activeItem="Reports & Analytics"
    >
      <main
        className={
          styles.main
        }
        data-reports-command-center="true"
        data-reports-live-storage="true"
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
                Campaign operations intelligence
              </span>

              <h1>
                Reports &amp; Analytics Command Center
              </h1>

              <p>
                See the campaign&apos;s current operational
                picture from live Campaign Seat data without
                inventing performance, trend, or attribution
                metrics that have not been recorded.
              </p>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={async () => {
                  const result =
                    await refresh({
                      showLoading:
                        true,
                    });

                  setNotice(
                    result
                      ? "Live reporting sources refreshed."
                      : "Unable to refresh live reporting sources.",
                  );
                }}
              >
                <RefreshCw
                  size={18}
                />
                Refresh
              </button>
            </div>
          </section>


          <div
            className={
              [
                styles.liveStatus,
                error
                  ? styles.liveStatusError
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {error ? (
              <X
                size={16}
              />
            ) : (
              <CheckCircle2
                size={16}
              />
            )}

            <span>
              {error
                ? error
                : loading
                  ? "Loading live Campaign Seat reporting sources…"
                  : "Live Campaign Seat reporting sources connected"}
            </span>

            {lastUpdated ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdated,
                  timezone,
                )}
              </small>
            ) : null}
          </div>


          {notice ? (
            <div
              className={
                styles.notice
              }
              role="status"
            >
              <CheckCircle2
                size={16}
              />

              <span>
                {notice}
              </span>

              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() =>
                  setNotice(
                    "",
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            </div>
          ) : null}


          <section
            className={
              styles.metrics
            }
            aria-label="Reports and Analytics summary"
          >
            <button
              type="button"
              className={
                activeView ===
                "operations"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "operations",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <ClipboardCheck
                  size={22}
                />
              </span>

              <span>
                <small>
                  Tasks completed
                </small>

                <strong>
                  {report.tasksCompleted}
                  <b>
                    /{report.tasksTotal}
                  </b>
                </strong>

                <em>
                  {report.taskCompletionRate}% completion
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "operations"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "operations",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <CalendarDays
                  size={22}
                />
              </span>

              <span>
                <small>
                  Upcoming events
                </small>

                <strong>
                  {report.upcomingEvents}
                </strong>

                <em>
                  {report.eventsTotal} live events tracked
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyLocation(
                  "overview",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Users
                  size={22}
                />
              </span>

              <span>
                <small>
                  Contacts
                </small>

                <strong>
                  {report.contactsTotal}
                </strong>

                <em>
                  Live Campaign Seat contacts
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "history"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "history",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <BarChart3
                  size={22}
                />
              </span>

              <span>
                <small>
                  Metric snapshots
                </small>

                <strong>
                  {report.snapshotCount}
                </strong>

                <em>
                  Historical trend records
                </em>
              </span>
            </button>
          </section>


          <section
            className={
              styles.workspace
            }
          >
            <div
              className={
                styles.primaryColumn
              }
            >
              <nav
                className={
                  styles.tabs
                }
                aria-label="Reports and Analytics views"
              >
                <button
                  type="button"
                  className={
                    activeView ===
                    "overview"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "overview",
                    )
                  }
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "operations"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "operations",
                    )
                  }
                >
                  Operations
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "history"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "history",
                    )
                  }
                >
                  Trend history
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <>
                  <section
                    className={
                      styles.nextCard
                    }
                  >
                    <header>
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        <BarChart3
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Historical metric snapshot
                        </h2>

                        <p>
                          Most recent recorded campaign_metrics
                          snapshot, when one exists.
                        </p>
                      </div>
                    </header>

                    {report.latestSnapshot ? (
                      <button
                        type="button"
                        className={
                          styles.nextPostButton
                        }
                        onClick={() =>
                          applyLocation(
                            "history",
                            report
                              .latestSnapshot
                              .id,
                          )
                        }
                      >
                        <div>
                          <strong>
                            Snapshot{" "}
                            {formatDate(
                              report
                                .latestSnapshot
                                .metric_date,
                              timezone,
                            )}
                          </strong>

                          <span>
                            Campaign health{" "}
                            {healthLabel(
                              report
                                .latestSnapshot
                                .campaign_health,
                            )}
                          </span>
                        </div>

                        <div
                          className={
                            styles.platformStack
                          }
                        >
                          <i>
                            KPI
                          </i>
                        </div>

                        <em>
                          Recorded
                        </em>
                      </button>
                    ) : (
                      <div
                        className={
                          styles.emptyState
                        }
                      >
                        <BarChart3
                          size={28}
                        />

                        <strong>
                          No historical metric snapshots yet
                        </strong>

                        <span>
                          Current operational totals below are live.
                          Trend lines and health scores will remain
                          unavailable until real campaign_metrics
                          snapshots are recorded.
                        </span>
                      </div>
                    )}
                  </section>


                  <section
                    className={
                      styles.secondaryMetrics
                    }
                    aria-label="Additional live reporting totals"
                  >
                    <article>
                      <span>
                        <Users
                          size={18}
                        />
                      </span>

                      <div>
                        <small>
                          Volunteers
                        </small>

                        <strong>
                          {report.volunteersTotal}
                        </strong>

                        <em>
                          Live non-sample volunteers
                        </em>
                      </div>
                    </article>

                    <article>
                      <span>
                        <FileText
                          size={18}
                        />
                      </span>

                      <div>
                        <small>
                          Communications
                        </small>

                        <strong>
                          {report.communicationsTotal}
                        </strong>

                        <em>
                          Campaign communication records
                        </em>
                      </div>
                    </article>

                    <article>
                      <span>
                        <CircleDollarSign
                          size={18}
                        />
                      </span>

                      <div>
                        <small>
                          Fundraising goals
                        </small>

                        <strong>
                          {report.fundraisingGoals}
                        </strong>

                        <em>
                          Configured fundraising goals
                        </em>
                      </div>
                    </article>

                    <article>
                      <span>
                        <Target
                          size={18}
                        />
                      </span>

                      <div>
                        <small>
                          Event RSVPs
                        </small>

                        <strong>
                          {report.eventRsvps}
                        </strong>

                        <em>
                          Sum of live event RSVP counts
                        </em>
                      </div>
                    </article>
                  </section>
                </>
              ) : null}


              {activeView ===
              "operations" ? (
                <section
                  className={
                    styles.opsGrid
                  }
                >
                  <article
                    className={
                      styles.opsCard
                    }
                  >
                    <header>
                      <ClipboardCheck
                        size={19}
                      />

                      <div>
                        <h2>
                          Task operations
                        </h2>

                        <p>
                          Live non-sample task state.
                        </p>
                      </div>
                    </header>

                    <StatusRow
                      label="Open"
                      value={
                        report.taskStatuses.open
                      }
                      total={
                        report.tasksTotal
                      }
                    />

                    <StatusRow
                      label="In progress"
                      value={
                        report
                          .taskStatuses
                          .in_progress
                      }
                      total={
                        report.tasksTotal
                      }
                    />

                    <StatusRow
                      label="Completed"
                      value={
                        report
                          .taskStatuses
                          .completed
                      }
                      total={
                        report.tasksTotal
                      }
                    />

                    <StatusRow
                      label="Other"
                      value={
                        report.taskStatuses.other
                      }
                      total={
                        report.tasksTotal
                      }
                    />
                  </article>


                  <article
                    className={
                      styles.opsCard
                    }
                  >
                    <header>
                      <CalendarDays
                        size={19}
                      />

                      <div>
                        <h2>
                          Event operations
                        </h2>

                        <p>
                          Live non-sample event state.
                        </p>
                      </div>
                    </header>

                    <StatusRow
                      label="Scheduled"
                      value={
                        report
                          .eventStatuses
                          .scheduled
                      }
                      total={
                        report.eventsTotal
                      }
                    />

                    <StatusRow
                      label="Completed"
                      value={
                        report
                          .eventStatuses
                          .completed
                      }
                      total={
                        report.eventsTotal
                      }
                    />

                    <StatusRow
                      label="Cancelled"
                      value={
                        report
                          .eventStatuses
                          .cancelled
                      }
                      total={
                        report.eventsTotal
                      }
                    />

                    <StatusRow
                      label="Other"
                      value={
                        report
                          .eventStatuses
                          .other
                      }
                      total={
                        report.eventsTotal
                      }
                    />
                  </article>


                  <article
                    className={
                      [
                        styles.opsCard,
                        styles.wideCard,
                      ].join(" ")
                    }
                  >
                    <header>
                      <Clock3
                        size={19}
                      />

                      <div>
                        <h2>
                          Recent task activity
                        </h2>

                        <p>
                          Most recently updated live tasks.
                        </p>
                      </div>
                    </header>

                    {!recentTasks.length ? (
                      <div
                        className={
                          styles.compactEmpty
                        }
                      >
                        No live tasks available.
                      </div>
                    ) : (
                      <div
                        className={
                          styles.activityRows
                        }
                      >
                        {recentTasks.map(
                          (task) => (
                            <div
                              key={
                                task.id
                              }
                            >
                              <strong>
                                {task.title}
                              </strong>

                              <span>
                                {String(
                                  task.status ||
                                  "open",
                                ).replace(
                                  /_/g,
                                  " ",
                                )}
                              </span>

                              <small>
                                Due{" "}
                                {formatDateTime(
                                  task.due_at,
                                  timezone,
                                )}
                              </small>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </article>


                  <article
                    className={
                      [
                        styles.opsCard,
                        styles.wideCard,
                      ].join(" ")
                    }
                  >
                    <header>
                      <CalendarDays
                        size={19}
                      />

                      <div>
                        <h2>
                          Upcoming event activity
                        </h2>

                        <p>
                          Next scheduled live events.
                        </p>
                      </div>
                    </header>

                    {!upcomingEvents.length ? (
                      <div
                        className={
                          styles.compactEmpty
                        }
                      >
                        No upcoming live events.
                      </div>
                    ) : (
                      <div
                        className={
                          styles.activityRows
                        }
                      >
                        {upcomingEvents.map(
                          (event) => (
                            <div
                              key={
                                event.id
                              }
                            >
                              <strong>
                                {event.title}
                              </strong>

                              <span>
                                {event.event_type ||
                                  "Event"}
                              </span>

                              <small>
                                {formatDateTime(
                                  event.starts_at,
                                  timezone,
                                )}
                              </small>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                </section>
              ) : null}


              {activeView ===
              "history" ? (
                <SnapshotHistory
                  snapshots={
                    snapshots
                  }
                  timezone={
                    timezone
                  }
                  selectedSnapshotId={
                    selectedSnapshotId
                  }
                  onSelect={(
                    snapshot,
                  ) =>
                    applyLocation(
                      "history",
                      snapshot.id,
                    )
                  }
                />
              ) : null}
            </div>


            <aside
              className={
                styles.rightRail
              }
            >
              <section
                className={
                  styles.attentionCard
                }
              >
                <header>
                  <span>
                    <Sparkles
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Needs attention
                    </h2>

                    <p>
                      Live operational conditions worth reviewing.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "operations",
                    )
                  }
                >
                  <div>
                    <strong>
                      {report.tasksOverdue} overdue tasks
                    </strong>

                    <span>
                      Incomplete tasks past their due time
                    </span>
                  </div>

                  <em>
                    {report.tasksOverdue}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "operations",
                    )
                  }
                >
                  <div>
                    <strong>
                      {report.tasksOpen} open tasks
                    </strong>

                    <span>
                      Work not yet marked in progress
                    </span>
                  </div>

                  <em>
                    {report.tasksOpen}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "history",
                    )
                  }
                >
                  <div>
                    <strong>
                      {report.snapshotCount} metric snapshots
                    </strong>

                    <span>
                      Historical analytics coverage
                    </span>
                  </div>

                  <em>
                    {report.snapshotCount}
                  </em>
                </button>
              </section>


              <section
                className={
                  styles.quickCard
                }
              >
                <header>
                  <h2>
                    Quick actions
                  </h2>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "overview",
                    )
                  }
                >
                  <BarChart3
                    size={16}
                  />
                  View summary
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "operations",
                    )
                  }
                >
                  <ClipboardCheck
                    size={16}
                  />
                  Review operations
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "history",
                    )
                  }
                >
                  <Clock3
                    size={16}
                  />
                  View metric history
                </button>
              </section>


              <section
                className={
                  styles.connectionCard
                }
              >
                <span>
                  <BarChart3
                    size={21}
                  />
                </span>

                <div>
                  <strong>
                    Reporting source status
                  </strong>

                  <p>
                    Current totals are calculated from live
                    Campaign Seat workspace records.
                  </p>

                  <small>
                    Tasks · Events · Contacts · Volunteers ·
                    Communications · Fundraising goals ·
                    campaign_metrics
                  </small>

                  <small>
                    External analytics warehouse, ad attribution,
                    polling, and third-party performance feeds:
                    Not connected
                  </small>
                </div>
              </section>
            </aside>
          </section>


          <div
            className={
              styles.footerNote
            }
          >
            <CheckCircle2
              size={16}
            />

            <span>
              V77 is read-only. Current totals come from live
              Campaign Seat records. Historical trends and health
              scores appear only when real campaign_metrics
              snapshots exist; no sample analytics are substituted.
            </span>
          </div>
        </div>


        {selectedSnapshotId ? (
          <SnapshotDrawer
            snapshot={
              selectedSnapshot
            }
            loading={
              loading
            }
            timezone={
              timezone
            }
            onClose={() =>
              applyLocation(
                "history",
                "",
                {
                  replace:
                    true,
                },
              )
            }
          />
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function StatusRow({
  label,
  value,
  total,
}) {
  const percentage =
    total
      ? Math.round(
          (
            value /
            total
          ) *
            100,
        )
      : 0;

  return (
    <div
      className={
        styles.statusRow
      }
    >
      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>

      <div
        className={
          styles.statusBar
        }
      >
        <span
          style={{
            width:
              `${percentage}%`,
          }}
        />
      </div>

      <small>
        {percentage}%
      </small>
    </div>
  );
}


function SnapshotHistory({
  snapshots,
  timezone,
  selectedSnapshotId,
  onSelect,
}) {
  return (
    <section
      className={
        styles.tablePanel
      }
    >
      <header
        className={
          styles.tableHeader
        }
      >
        <div>
          <h2>
            Metric snapshot history
          </h2>

          <p>
            Recorded non-sample campaign_metrics rows only.
          </p>
        </div>
      </header>

      {!snapshots.length ? (
        <div
          className={
            styles.tableEmpty
          }
        >
          <BarChart3
            size={27}
          />

          <strong>
            No historical analytics recorded yet
          </strong>

          <span>
            Campaign Seat will not manufacture a trend line.
            This table will populate only when genuine
            campaign_metrics snapshots exist.
          </span>
        </div>
      ) : (
        <>
          <div
            className={
              styles.historyHeading
            }
          >
            <span>
              Date
            </span>

            <span>
              Campaign
            </span>

            <span>
              Field
            </span>

            <span>
              Events
            </span>

            <span>
              Comms
            </span>

            <span>
              Volunteers
            </span>
          </div>

          <div
            className={
              styles.historyTable
            }
          >
            {snapshots.map(
              (snapshot) => (
                <article
                  key={
                    snapshot.id
                  }
                  role="button"
                  tabIndex={0}
                  className={
                    selectedSnapshotId ===
                    snapshot.id
                      ? styles.rowSelected
                      : styles.clickableRow
                  }
                  onClick={() =>
                    onSelect(
                      snapshot,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                        "Enter" ||
                      event.key ===
                        " "
                    ) {
                      event.preventDefault();

                      onSelect(
                        snapshot,
                      );
                    }
                  }}
                >
                  <strong>
                    {formatDate(
                      snapshot.metric_date,
                      timezone,
                    )}
                  </strong>

                  <span>
                    {healthLabel(
                      snapshot
                        .campaign_health,
                    )}
                  </span>

                  <span>
                    {healthLabel(
                      snapshot
                        .field_health,
                    )}
                  </span>

                  <span>
                    {healthLabel(
                      snapshot
                        .events_health,
                    )}
                  </span>

                  <span>
                    {healthLabel(
                      snapshot
                        .communications_health,
                    )}
                  </span>

                  <span>
                    {healthLabel(
                      snapshot
                        .volunteers_health,
                    )}
                  </span>
                </article>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}


function SnapshotDrawer({
  snapshot,
  loading,
  timezone,
  onClose,
}) {
  return (
    <div
      className={
        styles.detailScrim
      }
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className={
          styles.detailDrawer
        }
        aria-label="Metric snapshot details"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Reports &amp; Analytics
            </span>

            <h2>
              {snapshot
                ? `Snapshot ${formatDate(
                    snapshot.metric_date,
                    timezone,
                  )}`
                : loading
                  ? "Loading snapshot…"
                  : "Snapshot unavailable"}
            </h2>

            {snapshot ? (
              <p>
                Recorded Campaign Seat metric history
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close metric snapshot"
            onClick={
              onClose
            }
          >
            <X
              size={19}
            />
          </button>
        </header>


        {!snapshot ? (
          <div
            className={
              styles.detailBody
            }
          >
            <div
              className={
                styles.detailEmpty
              }
            >
              <BarChart3
                size={30}
              />

              <strong>
                {loading
                  ? "Loading snapshot"
                  : "Snapshot not found"}
              </strong>
            </div>
          </div>
        ) : (
          <div
            className={
              styles.detailBody
            }
          >
            <section
              className={
                styles.detailHero
              }
            >
              <span
                className={
                  styles.detailStatus
                }
              >
                <CheckCircle2
                  size={14}
                />
                Recorded
              </span>

              <strong>
                {healthLabel(
                  snapshot
                    .campaign_health,
                )}
              </strong>

              <p>
                Campaign health
              </p>
            </section>


            <section
              className={
                styles.detailGrid
              }
            >
              <div>
                <small>
                  Readiness
                </small>

                <strong>
                  {healthLabel(
                    snapshot
                      .campaign_readiness,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Field
                </small>

                <strong>
                  {healthLabel(
                    snapshot
                      .field_health,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Events
                </small>

                <strong>
                  {healthLabel(
                    snapshot
                      .events_health,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Communications
                </small>

                <strong>
                  {healthLabel(
                    snapshot
                      .communications_health,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Volunteers
                </small>

                <strong>
                  {healthLabel(
                    snapshot
                      .volunteers_health,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Doors knocked
                </small>

                <strong>
                  {snapshot
                    .doors_knocked}
                </strong>
              </div>

              <div>
                <small>
                  Contacts
                </small>

                <strong>
                  {snapshot
                    .contacts_total}
                </strong>
              </div>

              <div>
                <small>
                  Event RSVPs
                </small>

                <strong>
                  {snapshot
                    .event_rsvps}
                </strong>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <FileText
                  size={19}
                />

                <div>
                  <h3>
                    Communications snapshot
                  </h3>

                  <p>
                    Messages sent: {snapshot.messages_sent}
                    {" · "}
                    Messages opened: {snapshot.messages_opened}
                  </p>
                </div>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <Users
                  size={19}
                />

                <div>
                  <h3>
                    Volunteer snapshot
                  </h3>

                  <p>
                    Shifts filled: {snapshot.volunteer_shifts_filled}
                    {" · "}
                    Goal: {snapshot.volunteer_shifts_goal}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
