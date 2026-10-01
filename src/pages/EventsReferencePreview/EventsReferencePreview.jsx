import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useCalendarCommandCenter,
} from "../../hooks/useCalendarCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./EventsReferencePreview.module.css";


const EVENT_VIEWS =
  new Set([
    "overview",
    "upcoming",
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


function titleCase(value) {
  return String(
    value ||
    "",
  )
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}


function initialsFor(value) {
  return String(
    value ||
    "",
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase(),
    )
    .join("") ||
    "EV";
}


function formatDate(
  value,
  timezone,
) {
  const date =
    safeDate(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
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
    safeDate(value);

  if (!date) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
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
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function normalizedText(value) {
  return String(
    value ||
    "",
  )
    .trim()
    .toLowerCase();
}


function eventSignature(event) {
  return [
    normalizedText(
      event?.title,
    ),
    String(
      event?.starts_at ||
      "",
    ),
    String(
      event?.ends_at ||
      "",
    ),
    normalizedText(
      event?.location,
    ),
  ].join("|");
}


function providerRank(event) {
  if (
    event?.source_account_provider
  ) {
    return 3;
  }

  if (
    event?.source_provider
  ) {
    return 2;
  }

  return 1;
}


function canonicalizeEvents(rows) {
  const groups =
    new Map();

  (
    Array.isArray(rows)
      ? rows
      : []
  ).forEach(
    (event) => {
      const signature =
        eventSignature(event);

      if (
        !groups.has(signature)
      ) {
        groups.set(
          signature,
          [],
        );
      }

      groups
        .get(signature)
        .push(event);
    },
  );

  const output =
    [];

  groups.forEach(
    (group) => {
      if (
        group.length === 1
      ) {
        output.push(
          group[0],
        );

        return;
      }

      const hasProviderRow =
        group.some(
          (event) =>
            Boolean(
              event
                ?.source_provider,
            ),
        );

      if (
        !hasProviderRow
      ) {
        output.push(
          ...group,
        );

        return;
      }

      const preferred =
        [...group]
          .sort(
            (
              left,
              right,
            ) => {
              const rankDelta =
                providerRank(
                  right,
                ) -
                providerRank(
                  left,
                );

              if (
                rankDelta !==
                0
              ) {
                return rankDelta;
              }

              return String(
                right
                  ?.updated_at ||
                "",
              ).localeCompare(
                String(
                  left
                    ?.updated_at ||
                  "",
                ),
              );
            },
          )[0];

      output.push(
        preferred,
      );
    },
  );

  return output.sort(
    (
      left,
      right,
    ) => {
      const leftTime =
        safeDate(
          left?.starts_at,
        )?.getTime() ||
        0;

      const rightTime =
        safeDate(
          right?.starts_at,
        )?.getTime() ||
        0;

      return (
        leftTime -
        rightTime
      );
    },
  );
}


function providerLabel(event) {
  const provider =
    event
      ?.source_account_provider ||
    event
      ?.source_provider ||
    "";

  if (!provider) {
    return "Campaign Seat";
  }

  return titleCase(
    provider,
  );
}


function readEventsLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      eventId:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requested =
    url.searchParams.get(
      "events-view",
    );

  return {
    view:
      EVENT_VIEWS.has(
        requested,
      )
        ? requested
        : "overview",

    eventId:
      url.searchParams.get(
        "event",
      ) ||
      "",
  };
}


function statusKey(value) {
  return normalizedText(
    value,
  )
    .replace(
      /\s+/g,
      "-",
    );
}


export default function EventsReferencePreview() {
  const navigate =
    useNavigate();

  const workspace =
    getCurrentWorkspace();

  const user =
    getCurrentUser();

  const timezone =
    workspace?.timezone ||
    "America/New_York";

  const {
    events:
      rawEvents,

    isLoading,
    error,
    lastUpdated,
    refresh,
  } =
    useCalendarCommandCenter({
      workspaceId:
        workspace?.id ||
        "",

      userId:
        user?.id ||
        "",
    });

  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readEventsLocation()
          .view,
    );

  const [
    selectedEventId,
    setSelectedEventId,
  ] =
    useState(
      () =>
        readEventsLocation()
          .eventId,
    );


  const events =
    useMemo(
      () =>
        canonicalizeEvents(
          rawEvents,
        ),
      [
        rawEvents,
      ],
    );


  const now =
    new Date();


  const upcomingEvents =
    useMemo(
      () =>
        events.filter(
          (event) => {
            const start =
              safeDate(
                event.starts_at,
              );

            return (
              start &&
              start >= now &&
              event.status !==
                "cancelled"
            );
          },
        ),
      [
        events,
      ],
    );


  const historyEvents =
    useMemo(
      () =>
        [...events]
          .filter(
            (event) => {
              const start =
                safeDate(
                  event.starts_at,
                );

              return (
                start &&
                start < now
              );
            },
          )
          .sort(
            (
              left,
              right,
            ) =>
              (
                safeDate(
                  right
                    .starts_at,
                )
                  ?.getTime() ||
                0
              ) -
              (
                safeDate(
                  left
                    .starts_at,
                )
                  ?.getTime() ||
                0
              ),
          ),
      [
        events,
      ],
    );


  const selectedEvent =
    selectedEventId
      ? events.find(
          (event) =>
            event.id ===
            selectedEventId,
        ) ||
        null
      : null;


  const totalRsvps =
    events.reduce(
      (
        sum,
        event,
      ) =>
        sum +
        Number(
          event.rsvp_count ||
          0,
        ),
      0,
    );


  const syncedCount =
    events.filter(
      (event) =>
        Boolean(
          event
            .source_provider,
        ),
    ).length;


  const missingLocationCount =
    upcomingEvents.filter(
      (event) =>
        !String(
          event.location ||
          "",
        ).trim(),
    ).length;


  const missingCapacityCount =
    upcomingEvents.filter(
      (event) =>
        event.capacity ===
          null ||
        event.capacity ===
          undefined,
    ).length;


  const displayEvents =
    activeView ===
    "upcoming"
      ? upcomingEvents
      : activeView ===
        "history"
        ? historyEvents
        : historyEvents.slice(
            0,
            8,
          );


  const applyLocation =
    (
      nextView,
      nextEventId = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "events-view",
        nextView,
      );

      if (
        nextEventId
      ) {
        url.searchParams.set(
          "event",
          nextEventId,
        );
      } else {
        url.searchParams.delete(
          "event",
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

      setSelectedEventId(
        nextEventId,
      );
    };


  const openEvent =
    (event) => {
      applyLocation(
        activeView,
        event.id,
      );
    };


  const closeEvent =
    () => {
      applyLocation(
        activeView,
        "",
        {
          replace: true,
        },
      );
    };


  useEffect(
    () => {
      const handlePopState =
        () => {
          const next =
            readEventsLocation();

          setActiveView(
            next.view,
          );

          setSelectedEventId(
            next.eventId,
          );
        };

      window.addEventListener(
        "popstate",
        handlePopState,
      );

      return () => {
        window.removeEventListener(
          "popstate",
          handlePopState,
        );
      };
    },
    [],
  );


  const nextEvent =
    upcomingEvents[0] ||
    null;


  return (
    <CampaignWorkspaceShell
      activeItem="Events"
    >
      <main
        className={
          styles.main
        }
        data-events-command-center="true"
        data-events-live-storage="true"
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
                Event operations
              </span>

              <h1>
                Events Command Center
              </h1>

              <p>
                See the campaign&apos;s live event calendar,
                RSVP activity, locations, provider sync,
                and recent event history in one operational
                workspace.
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
                onClick={() =>
                  refresh()
                }
              >
                <RefreshCw
                  size={18}
                />
                Refresh
              </button>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={() =>
                  navigate(
                    "/calendar",
                  )
                }
              >
                <CalendarDays
                  size={18}
                />
                Open Calendar
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
              <X size={16} />
            ) : (
              <CheckCircle2
                size={16}
              />
            )}

            <span>
              {error
                ? error
                : isLoading
                  ? "Loading live Campaign Seat events…"
                  : "Live Campaign Seat events connected"}
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


          <section
            className={
              styles.metrics
            }
            aria-label="Events summary"
          >
            <button
              type="button"
              className={
                activeView ===
                "overview"
                  ? styles.metricActive
                  : ""
              }
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
                <CalendarRange
                  size={22}
                />
              </span>

              <span>
                <small>
                  Live events
                </small>

                <strong>
                  {events.length}
                </strong>

                <em>
                  Unique active calendar records
                </em>
              </span>
            </button>

            <button
              type="button"
              className={
                activeView ===
                "upcoming"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "upcoming",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Clock3
                  size={22}
                />
              </span>

              <span>
                <small>
                  Upcoming
                </small>

                <strong>
                  {
                    upcomingEvents.length
                  }
                </strong>

                <em>
                  Scheduled from now forward
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
                  Recorded RSVPs
                </small>

                <strong>
                  {totalRsvps}
                </strong>

                <em>
                  Across live event records
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
                <CalendarDays
                  size={22}
                />
              </span>

              <span>
                <small>
                  Calendar-linked
                </small>

                <strong>
                  {syncedCount}
                </strong>

                <em>
                  Provider-backed records
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
                aria-label="Event views"
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
                    "upcoming"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "upcoming",
                    )
                  }
                >
                  Upcoming
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
                  Event history
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <section
                  className={
                    styles.nextEventCard
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <Sparkles
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Next campaign event
                      </h2>

                      <p>
                        Nearest scheduled event on the live
                        campaign calendar.
                      </p>
                    </div>
                  </header>

                  {nextEvent ? (
                    <button
                      type="button"
                      className={
                        styles.nextEventButton
                      }
                      onClick={() =>
                        openEvent(
                          nextEvent,
                        )
                      }
                    >
                      <div>
                        <strong>
                          {
                            nextEvent.title
                          }
                        </strong>

                        <span>
                          {formatDateTime(
                            nextEvent
                              .starts_at,
                            timezone,
                          )}
                        </span>
                      </div>

                      <div>
                        <small>
                          Location
                        </small>

                        <b>
                          {
                            nextEvent.location ||
                            "Not recorded"
                          }
                        </b>
                      </div>

                      <em>
                        {titleCase(
                          nextEvent.status,
                        )}
                      </em>
                    </button>
                  ) : (
                    <div
                      className={
                        styles.emptyState
                      }
                    >
                      <CalendarDays
                        size={28}
                      />

                      <strong>
                        No upcoming events scheduled
                      </strong>

                      <span>
                        The live calendar currently has no
                        future campaign events. Open Calendar
                        to create or schedule the next event.
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            "/calendar",
                          )
                        }
                      >
                        Open Calendar
                      </button>
                    </div>
                  )}
                </section>
              ) : null}


              <EventsTable
                events={
                  displayEvents
                }
                timezone={
                  timezone
                }
                title={
                  activeView ===
                  "upcoming"
                    ? "Upcoming events"
                    : activeView ===
                      "history"
                      ? "Event history"
                      : "Recent event activity"
                }
                subtitle={
                  activeView ===
                  "upcoming"
                    ? "Future events from the live campaign calendar."
                    : "Live Campaign Seat and connected-calendar event records."
                }
                onSelect={
                  openEvent
                }
                selectedEventId={
                  selectedEventId
                }
              />
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
                      Event setup signals from live records.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "upcoming",
                    )
                  }
                >
                  <div>
                    <strong>
                      {
                        upcomingEvents.length
                      } upcoming events
                    </strong>

                    <span>
                      Current live schedule
                    </span>
                  </div>

                  <em>
                    {
                      upcomingEvents.length
                    }
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "upcoming",
                    )
                  }
                >
                  <div>
                    <strong>
                      {
                        missingLocationCount
                      } missing locations
                    </strong>

                    <span>
                      Upcoming event logistics
                    </span>
                  </div>

                  <em>
                    {
                      missingLocationCount
                    }
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "upcoming",
                    )
                  }
                >
                  <div>
                    <strong>
                      {
                        missingCapacityCount
                      } without capacity
                    </strong>

                    <span>
                      RSVP planning readiness
                    </span>
                  </div>

                  <em>
                    {
                      missingCapacityCount
                    }
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
                    navigate(
                      "/calendar",
                    )
                  }
                >
                  <CalendarDays
                    size={18}
                  />
                  Create or edit in Calendar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    refresh()
                  }
                >
                  <RefreshCw
                    size={18}
                  />
                  Refresh live events
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
                    size={18}
                  />
                  Review event history
                </button>
              </section>


              <section
                className={
                  styles.sourceCard
                }
              >
                <span>
                  <CalendarRange
                    size={21}
                  />
                </span>

                <div>
                  <strong>
                    Calendar source
                  </strong>

                  <p>
                    {syncedCount} of {events.length} live
                    records currently carry connected
                    calendar provenance.
                  </p>
                </div>
              </section>
            </aside>
          </section>


          <footer
            className={
              styles.footerNote
            }
          >
            <FileText
              size={16}
            />

            <span>
              V74 reads the existing live Campaign Seat
              events table. Event creation and provider
              editing remain in Calendar.
            </span>
          </footer>
        </div>


        <EventDetailDrawer
          event={
            selectedEvent
          }
          eventId={
            selectedEventId
          }
          timezone={
            timezone
          }
          onClose={
            closeEvent
          }
          onOpenCalendar={() =>
            navigate(
              "/calendar",
            )
          }
        />
      </main>
    </CampaignWorkspaceShell>
  );
}


function EventsTable({
  events,
  timezone,
  title,
  subtitle,
  onSelect,
  selectedEventId,
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
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>

      <div
        className={
          styles.eventTable
        }
      >
        <div
          className={
            styles.eventHeading
          }
        >
          <span>Event</span>
          <span>Date &amp; time</span>
          <span>Location</span>
          <span>RSVPs</span>
          <span>Source</span>
          <span>Status</span>
        </div>

        {events.length ? (
          events.map(
            (event) => (
              <article
                key={
                  event.id
                }
                role="button"
                tabIndex={0}
                className={
                  selectedEventId ===
                  event.id
                    ? styles.rowSelected
                    : styles.clickableRow
                }
                onClick={() =>
                  onSelect(
                    event,
                  )
                }
                onKeyDown={
                  (
                    keyboardEvent,
                  ) => {
                    if (
                      keyboardEvent.key ===
                        "Enter" ||
                      keyboardEvent.key ===
                        " "
                    ) {
                      keyboardEvent
                        .preventDefault();

                      onSelect(
                        event,
                      );
                    }
                  }
                }
              >
                <div
                  className={
                    styles.personCell
                  }
                >
                  <span>
                    {initialsFor(
                      event.title,
                    )}
                  </span>

                  <div>
                    <strong>
                      {event.title}
                    </strong>

                    <small>
                      {titleCase(
                        event.event_type,
                      )}
                    </small>
                  </div>
                </div>

                <span>
                  {formatDate(
                    event.starts_at,
                    timezone,
                  )}

                  <small>
                    {formatTime(
                      event.starts_at,
                      timezone,
                    )}
                  </small>
                </span>

                <span>
                  {event.location ||
                    "Not recorded"}
                </span>

                <b>
                  {Number(
                    event.rsvp_count ||
                    0,
                  )}
                  {event.capacity !==
                    null &&
                  event.capacity !==
                    undefined
                    ? ` / ${event.capacity}`
                    : ""}
                </b>

                <span>
                  {providerLabel(
                    event,
                  )}
                </span>

                <em
                  data-status={
                    statusKey(
                      event.status,
                    )
                  }
                >
                  {titleCase(
                    event.status,
                  )}
                </em>
              </article>
            ),
          )
        ) : (
          <div
            className={
              styles.tableEmpty
            }
          >
            <CalendarDays
              size={26}
            />

            <strong>
              No events in this view
            </strong>

            <span>
              Campaign Seat will display live event records
              here as they become available.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}


function EventDetailDrawer({
  event,
  eventId,
  timezone,
  onClose,
  onOpenCalendar,
}) {
  if (!eventId) {
    return null;
  }

  if (!event) {
    return (
      <div
        className={
          styles.detailScrim
        }
        role="presentation"
        onMouseDown={
          (mouseEvent) => {
            if (
              mouseEvent.target ===
              mouseEvent.currentTarget
            ) {
              onClose();
            }
          }
        }
      >
        <aside
          className={
            styles.detailDrawer
          }
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
        >
          <header
            className={
              styles.detailHeader
            }
          >
            <div>
              <span>
                Event details
              </span>

              <h2>
                Event unavailable
              </h2>

              <p>
                This live event record could not be found.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close event details"
              onClick={
                onClose
              }
            >
              <X size={22} />
            </button>
          </header>

          <div
            className={
              styles.detailBody
            }
          >
            <section
              className={
                styles.detailEmpty
              }
            >
              <CalendarDays
                size={28}
              />

              <strong>
                Live event unavailable
              </strong>

              <span>
                The URL does not currently resolve to an
                event in this campaign workspace.
              </span>
            </section>
          </div>
        </aside>
      </div>
    );
  }

  const participants =
    Array.isArray(
      event.participants,
    )
      ? event.participants.length
      : 0;

  return (
    <div
      className={
        styles.detailScrim
      }
      role="presentation"
      onMouseDown={
        (mouseEvent) => {
          if (
            mouseEvent.target ===
            mouseEvent.currentTarget
          ) {
            onClose();
          }
        }
      }
    >
      <aside
        className={
          styles.detailDrawer
        }
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Live event
            </span>

            <h2>
              {event.title}
            </h2>

            <p>
              {titleCase(
                event.event_type,
              )}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close event details"
            onClick={
              onClose
            }
          >
            <X size={22} />
          </button>
        </header>

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
                size={15}
              />
              {titleCase(
                event.status,
              )}
            </span>

            <strong>
              {formatDate(
                event.starts_at,
                timezone,
              )}
            </strong>

            <p>
              {formatTime(
                event.starts_at,
                timezone,
              )}
              {event.ends_at
                ? ` – ${formatTime(
                    event.ends_at,
                    timezone,
                  )}`
                : ""}
            </p>
          </section>


          <section
            className={
              styles.detailGrid
            }
          >
            <div>
              <small>
                Location
              </small>

              <strong>
                {event.location ||
                  "Not recorded"}
              </strong>
            </div>

            <div>
              <small>
                Calendar source
              </small>

              <strong>
                {providerLabel(
                  event,
                )}
              </strong>
            </div>

            <div>
              <small>
                RSVPs
              </small>

              <strong>
                {Number(
                  event.rsvp_count ||
                  0,
                )}
              </strong>
            </div>

            <div>
              <small>
                Capacity
              </small>

              <strong>
                {event.capacity ??
                  "Not set"}
              </strong>
            </div>

            <div>
              <small>
                Participants
              </small>

              <strong>
                {participants}
              </strong>
            </div>

            <div>
              <small>
                Timezone
              </small>

              <strong>
                {event.event_timezone ||
                  timezone}
              </strong>
            </div>
          </section>


          <section
            className={
              styles.detailSection
            }
          >
            <div>
              <span
                className={
                  styles.sectionIcon
                }
              >
                <MapPin
                  size={18}
                />
              </span>

              <div>
                <h3>
                  Event operations
                </h3>

                <p>
                  This record comes from the same live event
                  foundation used by Campaign Seat Calendar.
                  Creation and provider-aware editing remain
                  centralized there.
                </p>
              </div>
            </div>
          </section>


          <button
            type="button"
            className={
              styles.detailAction
            }
            onClick={
              onOpenCalendar
            }
          >
            <CalendarDays
              size={18}
            />
            Open Calendar
          </button>
        </div>
      </aside>
    </div>
  );
}
