import {
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  MapPin,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";

import {
  useCalendarCommandCenter,
} from "../../hooks/useCalendarCommandCenter";



import {
  getCampaignMemberships,
  getCurrentMembership,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import styles from "./Calendar.module.css";

// Calendar runtime fix: use a local YYYY-MM-DD key for today.
const todayKey = (() => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})()

// CAMPAIGN HQ CALENDAR LINT COMPLETION

const TIME_ZONE =
  "America/New_York";

const EVENT_TYPES = [
  {
    value: "campaign",
    label: "Campaign",
  },
  {
    value: "fundraiser",
    label: "Fundraiser",
  },
  {
    value: "meeting",
    label: "Meeting",
  },
  {
    value: "canvassing",
    label: "Canvassing",
  },
  {
    value: "volunteer",
    label: "Volunteer",
  },
  {
    value: "community",
    label: "Community",
  },
];

const EVENT_STATUSES = [
  {
    value: "scheduled",
    label: "Scheduled",
  },
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function pad(value) {
  return String(value).padStart(
    2,
    "0",
  );
}

function getDateKey(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);

  const map = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return [
    map.year,
    map.month,
    map.day,
  ].join("-");
}

function formatDate(value, options = {}) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: TIME_ZONE,
      ...options,
    },
  ).format(date);
}

function formatTime(value) {
  return formatDate(
    value,
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function formatTimeRange(
  startsAt,
  endsAt,
) {
  if (!startsAt) {
    return "Time pending";
  }

  if (!endsAt) {
    return formatTime(
      startsAt,
    );
  }

  return `${formatTime(
    startsAt,
  )} – ${formatTime(
    endsAt,
  )}`;
}

function formatEventType(value) {
  return (
    EVENT_TYPES.find(
      (item) =>
        item.value === value,
    )?.label ||
    "Campaign"
  );
}

function formatEventStatus(value) {
  return (
    EVENT_STATUSES.find(
      (item) =>
        item.value === value,
    )?.label ||
    "Scheduled"
  );
}

function getMonthTitle(date) {
  return formatDate(
    date,
    {
      month: "long",
      year: "numeric",
    },
  );
}

function startOfDay(value) {
  const date = new Date(value);

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}

function startOfWeek(value) {
  const date =
    startOfDay(value);

  date.setDate(
    date.getDate() -
      date.getDay(),
  );

  return date;
}

function addDays(
  value,
  amount,
) {
  const date =
    new Date(value);

  date.setDate(
    date.getDate() +
      amount,
  );

  return date;
}

function buildMonthDays(
  focusDate,
) {
  const first =
    new Date(
      focusDate.getFullYear(),
      focusDate.getMonth(),
      1,
    );

  const gridStart =
    addDays(
      first,
      -first.getDay(),
    );

  return Array.from(
    {
      length: 42,
    },
    (_, index) =>
      addDays(
        gridStart,
        index,
      ),
  );
}

function toInputValue(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return [
    date.getFullYear(),
    "-",
    pad(
      date.getMonth() + 1,
    ),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function getDefaultForm(
  focusDate = new Date(),
) {
  const start =
    new Date(focusDate);

  start.setHours(
    10,
    0,
    0,
    0,
  );

  const end =
    new Date(start);

  end.setHours(
    11,
    0,
    0,
    0,
  );

  return {
    title: "",
    description: "",
    eventType: "campaign",
    location: "",
    startsAtLocal:
      toInputValue(start),
    endsAtLocal:
      toInputValue(end),
    status: "scheduled",
    capacity: "",
    rsvpCount: "0",
  };
}

function getInitials(name) {
  return String(
    name || "Campaign User",
  )
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase(),
    )
    .join("");
}

function eventsOverlap(
  leftStart,
  leftEnd,
  rightStart,
  rightEnd,
) {
  const leftStartTime =
    new Date(
      leftStart,
    ).getTime();

  const leftEndTime =
    new Date(
      leftEnd || leftStart,
    ).getTime();

  const rightStartTime =
    new Date(
      rightStart,
    ).getTime();

  const rightEndTime =
    new Date(
      rightEnd || rightStart,
    ).getTime();

  return (
    leftStartTime <
      rightEndTime &&
    leftEndTime >
      rightStartTime
  );
}

function ScheduleItem({
  item,
  compact = false,
  onOpenEvent,
  onOpenTask,
}) {
  const isTask =
    item.kind === "task";

  const className = [
    styles.scheduleItem,
    isTask
      ? styles.taskItem
      : styles.eventItem,
    compact
      ? styles.compactItem
      : "",
    !isTask &&
    item.status === "cancelled"
      ? styles.cancelledItem
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        if (isTask) {
          onOpenTask(item);
          return;
        }

        onOpenEvent(item);
      }}
      title={item.title}
    >
      <span
        className={
          styles.itemIndicator
        }
        aria-hidden="true"
      />

      <span
        className={
          styles.itemCopy
        }
      >
        <strong>
          {item.title}
        </strong>

        {!compact && (
          <small>
            {isTask
              ? `Task deadline · ${
                  item.priority
                }`
              : formatTimeRange(
                  item.starts_at,
                  item.ends_at,
                )}
          </small>
        )}
      </span>
    </button>
  );
}

export default function Calendar() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();
// CAMPAIGN HQ CALENDAR MEMBERSHIP ROLE FIX

  // CAMPAIGN HQ CALENDAR ACTIVE MEMBERSHIP FIX
  const storedMembership =
    getCurrentMembership();

  const campaignMemberships =
    getCampaignMemberships();

  const membership =
    (
      storedMembership?.workspaceId === workspace.id ||
      storedMembership?.workspace?.id === workspace.id
    )
      ? storedMembership
      : campaignMemberships.find(
          (item) =>
            item.workspaceId === workspace.id ||
            item.workspace?.id === workspace.id,
        ) ||
        storedMembership;

  const roleLabel =
    membership?.displayTitle ||
    membership?.roleName ||
    membership?.roleLabel ||
    membership?.display_title ||
    user.displayTitle ||
    user.roleName ||
    getRoleLabel() ||
    "Campaign Member";

  const roleKey =
    membership?.roleKey ||
    membership?.assignedRole ||
    membership?.role_key ||
    membership?.role ||
    user.roleKey ||
    user.assignedRole ||
    user.role ||
    "";

  const leadershipRole =
    [
      "campaign_owner",
      "campaign_consultant",
      "campaign_manager",
      "candidate",
    ].includes(roleKey) ||
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const canCreateEvents =
    hasCampaignPermission(
      "events.create",
    ) ||
    leadershipRole;

  const canUpdateEvents =
    hasCampaignPermission(
      "events.update",
    ) ||
    leadershipRole;

  const canCancelEvents =
    hasCampaignPermission(
      "events.delete",
    ) ||
    hasCampaignPermission(
      "events.update",
    ) ||
    leadershipRole;

  const {
    events,
    tasks,
    team,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    saveEvent,
    cancelEvent,
  } = useCalendarCommandCenter({
    workspaceId:
      workspace.id,
    userId:
      user.id,
  });

  const [view, setView] =
    useState("month");

  const [
    focusDate,
    setFocusDate,
  ] = useState(
    new Date(),
  );

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("active");

  // CAMPAIGN HQ CLICKABLE CALENDAR SUMMARY FILTERS
  const [
    summaryFilter,
    setSummaryFilter,
  ] = useState("");

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState("");

  const [
    editingEventId,
    setEditingEventId,
  ] = useState("");

  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(
    getDefaultForm(),
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const creatorMap =
    useMemo(
      () =>
        new Map(
          team.map(
            (member) => [
              member.id,
              member,
            ],
          ),
        ),
      [team],
    );

  const selectedEvent =
    events.find(
      (event) =>
        event.id ===
        selectedEventId,
    ) || null;

  const referenceTime =
    lastUpdated?.getTime() ||
    focusDate.getTime();

  const referenceDateKey =
    getDateKey(
      lastUpdated ||
      focusDate,
    );

  const conflictEventIds =
    useMemo(() => {
      const ids =
        new Set();

      const activeEvents =
        events.filter(
          (event) =>
            ![
              "cancelled",
              "completed",
            ].includes(
              event.status,
            ),
        );

      activeEvents.forEach(
        (event, index) => {
          activeEvents
            .slice(index + 1)
            .forEach(
              (other) => {
                if (
                  eventsOverlap(
                    event.starts_at,
                    event.ends_at,
                    other.starts_at,
                    other.ends_at,
                  )
                ) {
                  ids.add(
                    event.id,
                  );

                  ids.add(
                    other.id,
                  );
                }
              },
            );
        },
      );

      return ids;
    }, [events]);

  const filteredEvents =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return events.filter(
        (event) => {
          if (
            typeFilter !== "all" &&
            event.event_type !==
              typeFilter
          ) {
            return false;
          }

          if (
            statusFilter ===
              "active" &&
            [
              "completed",
              "cancelled",
            ].includes(
              event.status,
            )
          ) {
            return false;
          }

          if (
            statusFilter !==
              "all" &&
            statusFilter !==
              "active" &&
            event.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "upcoming" &&
            !(
              event.status ===
                "scheduled" &&
              new Date(
                event.starts_at,
              ).getTime() >=
                referenceTime
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "today" &&
            getDateKey(
              event.starts_at,
            ) !==
              referenceDateKey
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "conflicts" &&
            !conflictEventIds.has(
              event.id,
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "tasks"
          ) {
            return false;
          }

          if (
            normalizedSearch &&
            ![
              event.title,
              event.description,
              event.location,
              event.event_type,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
              )
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      conflictEventIds,
      events,
      referenceDateKey,
      referenceTime,
      searchTerm,
      statusFilter,
      summaryFilter,
      typeFilter,
    ]);

  const visibleTasks =
    useMemo(() => {
      if (
        summaryFilter ===
          "upcoming" ||
        summaryFilter ===
          "conflicts"
      ) {
        return [];
      }

      if (
        summaryFilter ===
          "today"
      ) {
        return tasks.filter(
          (task) =>
            getDateKey(
              task.due_at,
            ) ===
              referenceDateKey,
        );
      }

      return tasks;
    }, [
      referenceDateKey,
      summaryFilter,
      tasks,
    ]);

  const scheduleItems =
    useMemo(() => {
      const eventItems =
        filteredEvents.map(
          (event) => ({
            ...event,
            kind: "event",
            scheduleAt:
              event.starts_at,
          }),
        );

      const taskItems =
        visibleTasks.map(
          (task) => ({
            ...task,
            kind: "task",
            scheduleAt:
              task.due_at,
          }),
        );

      return [
        ...eventItems,
        ...taskItems,
      ].sort(
        (left, right) =>
          new Date(
            left.scheduleAt,
          ).getTime() -
          new Date(
            right.scheduleAt,
          ).getTime(),
      );
    }, [
      filteredEvents,
      visibleTasks,
    ]);

  const itemsByDate =
    useMemo(() => {
      const map =
        new Map();

      scheduleItems.forEach(
        (item) => {
          const key =
            getDateKey(
              item.scheduleAt,
            );

          if (!key) {
            return;
          }

          if (!map.has(key)) {
            map.set(
              key,
              [],
            );
          }

          map
            .get(key)
            .push(item);
        },
      );

      return map;
    }, [scheduleItems]);

  const monthDays =
    useMemo(
      () =>
        buildMonthDays(
          focusDate,
        ),
      [focusDate],
    );

  const weekDays =
    useMemo(() => {
      const start =
        startOfWeek(
          focusDate,
        );

      return Array.from(
        {
          length: 7,
        },
        (_, index) =>
          addDays(
            start,
            index,
          ),
      );
    }, [focusDate]);

  const agendaItems =
    useMemo(() => {
      const beginning =
        startOfDay(
          new Date(),
        ).getTime();

      return scheduleItems
        .filter(
          (item) =>
            new Date(
              item.scheduleAt,
            ).getTime() >=
            beginning,
        )
        .slice(0, 60);
    }, [scheduleItems]);

  const agendaGroups =
    useMemo(() => {
      const map =
        new Map();

      agendaItems.forEach(
        (item) => {
          const key =
            getDateKey(
              item.scheduleAt,
            );

          if (!map.has(key)) {
            map.set(
              key,
              {
                date:
                  new Date(
                    item.scheduleAt,
                  ),
                items: [],
              },
            );
          }

          map
            .get(key)
            .items
            .push(item);
        },
      );

      return Array.from(
        map.values(),
      );
    }, [agendaItems]);

  const todayItems = [
    ...events.filter(
      (event) =>
        ![
          "cancelled",
          "completed",
        ].includes(
          event.status,
        ) &&
        getDateKey(
          event.starts_at,
        ) ===
          referenceDateKey,
    ),

    ...tasks.filter(
      (task) =>
        getDateKey(
          task.due_at,
        ) ===
          referenceDateKey,
    ),
  ];

  const upcomingEvents =
    events.filter(
      (event) =>
        new Date(
          event.starts_at,
        ).getTime() >=
          referenceTime &&
        event.status ===
          "scheduled",
    );

  const conflictCount =
    useMemo(() => {
      let conflicts = 0;

      const activeEvents =
        events.filter(
          (event) =>
            ![
              "cancelled",
              "completed",
            ].includes(
              event.status,
            ),
        );

      activeEvents.forEach(
        (event, index) => {
          activeEvents
            .slice(index + 1)
            .forEach(
              (other) => {
                if (
                  eventsOverlap(
                    event.starts_at,
                    event.ends_at,
                    other.starts_at,
                    other.ends_at,
                  )
                ) {
                  conflicts += 1;
                }
              },
            );
        },
      );

      return conflicts;
    }, [events]);

  const applySummaryFilter =
    (value) => {
      setSummaryFilter(
        value,
      );

      setSearchTerm("");
      setTypeFilter("all");
      setStatusFilter("active");
      setView("agenda");
    };

  const formConflicts =
    useMemo(() => {
      if (
        !form.startsAtLocal
      ) {
        return [];
      }

      const start =
        new Date(
          form.startsAtLocal,
        );

      const end =
        form.endsAtLocal
          ? new Date(
              form.endsAtLocal,
            )
          : new Date(
              start.getTime() +
                60 * 60 * 1000,
            );

      if (
        Number.isNaN(
          start.getTime(),
        ) ||
        Number.isNaN(
          end.getTime(),
        )
      ) {
        return [];
      }

      return events.filter(
        (event) =>
          event.id !==
            editingEventId &&
          ![
            "cancelled",
            "completed",
          ].includes(
            event.status,
          ) &&
          eventsOverlap(
            start,
            end,
            event.starts_at,
            event.ends_at,
          ),
      );
    }, [
      editingEventId,
      events,
      form.endsAtLocal,
      form.startsAtLocal,
    ]);
const openCreateModal =
    (date = focusDate) => {
      setEditingEventId("");
      setForm(
        getDefaultForm(date),
      );
      setFormError("");
      setIsModalOpen(true);
    };

  const openEditModal =
    (event) => {
      if (!event) {
        return;
      }

      setEditingEventId(
        event.id,
      );

      setForm({
        title:
          event.title || "",
        description:
          event.description || "",
        eventType:
          event.event_type ||
          "campaign",
        location:
          event.location || "",
        startsAtLocal:
          toInputValue(
            event.starts_at,
          ),
        endsAtLocal:
          toInputValue(
            event.ends_at,
          ),
        status:
          event.status ||
          "scheduled",
        capacity:
          event.capacity ??
          "",
        rsvpCount:
          event.rsvp_count ??
          0,
      });

      setFormError("");
      setIsModalOpen(true);
    };

  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setForm(
        (current) => ({
          ...current,
          [name]: value,
        }),
      );
    };

  const handleSave =
    async (event) => {
      event.preventDefault();

      if (
        !form.title.trim()
      ) {
        setFormError(
          "Enter an event title.",
        );
        return;
      }

      if (
        !form.startsAtLocal
      ) {
        setFormError(
          "Choose the event start date and time.",
        );
        return;
      }

      const start =
        new Date(
          form.startsAtLocal,
        );

      const end =
        form.endsAtLocal
          ? new Date(
              form.endsAtLocal,
            )
          : null;

      if (
        Number.isNaN(
          start.getTime(),
        )
      ) {
        setFormError(
          "The event start time is invalid.",
        );
        return;
      }

      if (
        end &&
        (
          Number.isNaN(
            end.getTime(),
          ) ||
          end.getTime() <
            start.getTime()
        )
      ) {
        setFormError(
          "The event end time must be after the start time.",
        );
        return;
      }

      setFormError("");

      try {
        const saved =
          await saveEvent({
            eventId:
              editingEventId ||
              null,
            values: {
              ...form,
              startsAt:
                start.toISOString(),
              endsAt:
                end
                  ? end.toISOString()
                  : null,
            },
          });

        setIsModalOpen(false);
        setEditingEventId("");
        setSelectedEventId(
          saved.id,
        );
      } catch {
        // Hook displays the database error.
      }
    };

  const handleCancelSelected =
    async () => {
      if (
        !selectedEvent ||
        !window.confirm(
          `Cancel "${selectedEvent.title}"?`,
        )
      ) {
        return;
      }

      try {
        await cancelEvent(
          selectedEvent.id,
        );

        setSelectedEventId("");
      } catch {
        // Hook displays the database error.
      }
    };

  const movePeriod =
    (direction) => {
      const next =
        new Date(focusDate);

      if (view === "month") {
        next.setMonth(
          next.getMonth() +
            direction,
        );
      } else if (
        view === "week"
      ) {
        next.setDate(
          next.getDate() +
            direction * 7,
        );
      } else {
        next.setMonth(
          next.getMonth() +
            direction,
        );
      }

      setFocusDate(next);
    };

  const creator =
    selectedEvent
      ? creatorMap.get(
          selectedEvent.created_by,
        )
      : null;

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Calendar"
        sidebarOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={styles}
        accessDescription="Campaign schedule, event coordination and deadline visibility."
        showLeadership={
          leadershipRole
        }
      />

      <div
        className={
          styles.workspace
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.topbarLeft
            }
          >
            <button
              className={
                styles.menuButton
              }
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span
                className={
                  styles.breadcrumb
                }
              >
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Calendar
              </span>

              <strong>
                Campaign calendar
              </strong>
            </div>
          </div>

          <div
            className={
              styles.topbarActions
            }
          >
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            

          </div>
        </header>

        <main
          className={
            styles.main
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Campaign Schedule
              </span>

              <h1>
                Calendar & Events
              </h1>

              <p>
                Coordinate campaign events,
                meetings, field activity and
                task deadlines from one live
                schedule.
              </p>

              <div
                className={
                  styles.liveStatus
                }
              >
                <span />

                {isLoading
                  ? "Synchronizing calendar"
                  : error
                    ? "Connection needs attention"
                    : lastUpdated
                      ? `Live · updated ${formatTime(
                          lastUpdated,
                        )}`
                      : "Live campaign data"}
              </div>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <button
                className={
                  styles.refreshButton
                }
                type="button"
                onClick={refresh}
                disabled={
                  isLoading
                }
              >
                <RefreshCw
                  className={
                    isLoading
                      ? styles.spinning
                      : ""
                  }
                  size={17}
                />

                Refresh
              </button>

              {canCreateEvents && (
                <button
                  className={
                    styles.createButton
                  }
                  type="button"
                  onClick={() =>
                    openCreateModal()
                  }
                >
                  <Plus
                    size={18}
                  />

                  New event
                </button>
              )}
            </div>
          </section>

          {error && (
            <div
              className={
                styles.errorBanner
              }
              role="alert"
            >
              <AlertTriangle
                size={18}
              />

              <div>
                <strong>
                  Calendar action could not be completed
                </strong>

                <span>
                  {error}
                </span>
              </div>
            </div>
          )}

          <section
            className={
              styles.summaryGrid
            }
            aria-label="Calendar summary filters"
          >
            <button
              className={`${styles.summaryCard} ${
                summaryFilter === "upcoming"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "upcoming",
                )
              }
              aria-pressed={
                summaryFilter === "upcoming"
              }
            >
              <span>
                Upcoming events
              </span>

              <strong>
                {isLoading ? "—" : upcomingEvents.length}
              </strong>

              <p>
                Scheduled from today forward
              </p>

              <CalendarDays
                size={24}
              />
            </button>

            <button
              className={`${styles.summaryCard} ${
                summaryFilter === "today"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "today",
                )
              }
              aria-pressed={
                summaryFilter === "today"
              }
            >
              <span>
                On today’s schedule
              </span>

              <strong>
                {isLoading ? "—" : todayItems.length}
              </strong>

              <p>
                Events and task deadlines
              </p>

              <Clock3
                size={24}
              />
            </button>

            <button
              className={`${styles.summaryCard} ${
                conflictCount
                  ? styles.warningCard
                  : ""
              } ${
                summaryFilter === "conflicts"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "conflicts",
                )
              }
              aria-pressed={
                summaryFilter === "conflicts"
              }
            >
              <span>
                Schedule conflicts
              </span>

              <strong>
                {isLoading ? "—" : conflictCount}
              </strong>

              <p>
                Overlapping active events
              </p>

              <AlertTriangle
                size={24}
              />
            </button>

            <button
              className={`${styles.summaryCard} ${
                summaryFilter === "tasks"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "tasks",
                )
              }
              aria-pressed={
                summaryFilter === "tasks"
              }
            >
              <span>
                Task deadlines
              </span>

              <strong>
                {isLoading ? "—" : tasks.length}
              </strong>

              <p>
                Visible on the campaign calendar
              </p>

              <ClipboardCheck
                size={24}
              />
            </button>
          </section>

          <section
            className={
              styles.controlsPanel
            }
          >
            <div
              className={
                styles.searchWrap
              }
            >
              <Search
                size={18}
              />

              <input
                type="search"
                value={
                  searchTerm
                }
                onChange={(
                  event,
                ) => {
                  setSearchTerm(
                    event.target.value,
                  );

                  setSummaryFilter("");
                }}
                placeholder="Search events, locations or types"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(
                event,
              ) => {
                setTypeFilter(
                  event.target.value,
                );

                setSummaryFilter("");
              }}
              aria-label="Filter by event type"
            >
              <option value="all">
                All event types
              </option>

              {EVENT_TYPES.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event,
              ) => {
                setStatusFilter(
                  event.target.value,
                );

                setSummaryFilter("");
              }}
              aria-label="Filter by event status"
            >
              <option value="active">
                Active schedule
              </option>

              <option value="all">
                All statuses
              </option>

              {EVENT_STATUSES.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                ),
              )}
            </select>

            <div
              className={
                styles.viewToggle
              }
            >
              {[
                "month",
                "week",
                "agenda",
              ].map(
                (option) => (
                  <button
                    key={option}
                    className={
                      view === option
                        ? styles.activeView
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setView(
                        option,
                      )
                    }
                  >
                    {option}
                  </button>
                ),
              )}
            </div>
          </section>

          <section
            className={
              styles.calendarToolbar
            }
          >
            <div
              className={
                styles.periodControls
              }
            >
              <button
                type="button"
                onClick={() =>
                  movePeriod(-1)
                }
                aria-label="Previous period"
              >
                <ChevronLeft
                  size={20}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setFocusDate(
                    new Date(),
                  )
                }
              >
                Today
              </button>

              <button
                type="button"
                onClick={() =>
                  movePeriod(1)
                }
                aria-label="Next period"
              >
                <ChevronRight
                  size={20}
                />
              </button>
            </div>

            <div>
              <span>
                {view === "month"
                  ? "Month view"
                  : view === "week"
                    ? "Week view"
                    : "Upcoming agenda"}
              </span>

              <h2>
                {getMonthTitle(
                  focusDate,
                )}
              </h2>
            </div>

            <div
              className={
                styles.legend
              }
            >
              <span>
                <i
                  className={
                    styles.eventLegend
                  }
                />
                Events
              </span>

              <span>
                <i
                  className={
                    styles.taskLegend
                  }
                />
                Task deadlines
              </span>
            </div>
          </section>

          {isLoading ? (
            <div
              className={
                styles.loadingState
              }
            >
              <LoaderCircle
                className={
                  styles.spinning
                }
                size={28}
              />

              <strong>
                Loading campaign calendar
              </strong>
            </div>
          ) : view === "month" ? (
            <section
              className={
                styles.monthCalendar
              }
            >
              <div
                className={
                  styles.weekdayHeader
                }
              >
                {[
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ].map(
                  (day) => (
                    <span
                      key={day}
                    >
                      {day}
                    </span>
                  ),
                )}
              </div>

              <div
                className={
                  styles.monthGrid
                }
              >
                {monthDays.map(
                  (day) => {
                    const key =
                      getDateKey(
                        day,
                      );

                    const items =
                      itemsByDate.get(
                        key,
                      ) || [];

                    const outsideMonth =
                      day.getMonth() !==
                      focusDate.getMonth();

                    return (
                      <article
                        key={key}
                        className={[
                          styles.dayCell,
                          outsideMonth
                            ? styles.outsideMonth
                            : "",
                          key === todayKey
                            ? styles.todayCell
                            : "",
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            " ",
                          )}
                      >
                        <button
                          className={
                            styles.dayNumber
                          }
                          type="button"
                          onClick={() => {
                            setFocusDate(
                              day,
                            );

                            if (
                              canCreateEvents &&
                              !items.length
                            ) {
                              openCreateModal(
                                day,
                              );
                            }
                          }}
                        >
                          {day.getDate()}
                        </button>

                        <div
                          className={
                            styles.dayItems
                          }
                        >
                          {items
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (item) => (
                                <ScheduleItem
                                  key={`${item.kind}-${item.id}`}
                                  item={item}
                                  compact
                                  onOpenEvent={(
                                    selected,
                                  ) =>
                                    setSelectedEventId(
                                      selected.id,
                                    )
                                  }
                                  onOpenTask={() =>
                                    navigate(
                                      "/tasks",
                                    )
                                  }
                                />
                              ),
                            )}

                          {items.length >
                            3 && (
                            <button
                              className={
                                styles.moreItems
                              }
                              type="button"
                              onClick={() => {
                                setFocusDate(
                                  day,
                                );
                                setView(
                                  "agenda",
                                );
                              }}
                            >
                              +
                              {items.length -
                                3}{" "}
                              more
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          ) : view === "week" ? (
            <section
              className={
                styles.weekCalendar
              }
            >
              {weekDays.map(
                (day) => {
                  const key =
                    getDateKey(
                      day,
                    );

                  const items =
                    itemsByDate.get(
                      key,
                    ) || [];

                  return (
                    <article
                      key={key}
                      className={
                        key ===
                        todayKey
                          ? `${styles.weekDay} ${styles.currentWeekDay}`
                          : styles.weekDay
                      }
                    >
                      <header>
                        <span>
                          {formatDate(
                            day,
                            {
                              weekday:
                                "short",
                            },
                          )}
                        </span>

                        <strong>
                          {day.getDate()}
                        </strong>
                      </header>

                      <div>
                        {items.length ? (
                          items.map(
                            (item) => (
                              <ScheduleItem
                                key={`${item.kind}-${item.id}`}
                                item={item}
                                onOpenEvent={(
                                  selected,
                                ) =>
                                  setSelectedEventId(
                                    selected.id,
                                  )
                                }
                                onOpenTask={() =>
                                  navigate(
                                    "/tasks",
                                  )
                                }
                              />
                            ),
                          )
                        ) : (
                          <button
                            className={
                              styles.emptyWeekDay
                            }
                            type="button"
                            onClick={() =>
                              canCreateEvents
                                ? openCreateModal(
                                    day,
                                  )
                                : undefined
                            }
                          >
                            No scheduled items
                          </button>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </section>
          ) : (
            <section
              className={
                styles.agendaView
              }
            >
              {agendaGroups.length ? (
                agendaGroups.map(
                  (group) => (
                    <article
                      key={getDateKey(
                        group.date,
                      )}
                      className={
                        styles.agendaGroup
                      }
                    >
                      <div
                        className={
                          styles.agendaDate
                        }
                      >
                        <span>
                          {formatDate(
                            group.date,
                            {
                              weekday:
                                "short",
                              month:
                                "short",
                            },
                          )}
                        </span>

                        <strong>
                          {formatDate(
                            group.date,
                            {
                              day:
                                "2-digit",
                            },
                          )}
                        </strong>
                      </div>

                      <div
                        className={
                          styles.agendaItems
                        }
                      >
                        {group.items.map(
                          (item) => (
                            <ScheduleItem
                              key={`${item.kind}-${item.id}`}
                              item={item}
                              onOpenEvent={(
                                selected,
                              ) =>
                                setSelectedEventId(
                                  selected.id,
                                )
                              }
                              onOpenTask={() =>
                                navigate(
                                  "/tasks",
                                )
                              }
                            />
                          ),
                        )}
                      </div>
                    </article>
                  ),
                )
              ) : (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <CalendarDays
                    size={34}
                  />

                  <strong>
                    No upcoming schedule items
                  </strong>

                  <p>
                    New events and task deadlines
                    will appear here.
                  </p>
                </div>
              )}
            </section>
          )}

          <footer
            className={
              styles.footer
            }
          >
            <span>
              © 2026 Campaign HQ
            </span>

            <div>
              <ShieldCheck
                size={14}
              />
              Authorized campaign use only
            </div>
          </footer>
        </main>
      </div>

      {selectedEvent && (
        <>
          <button
            className={
              styles.drawerOverlay
            }
            type="button"
            onClick={() =>
              setSelectedEventId("")
            }
            aria-label="Close event details"
          />

          <aside
            className={
              styles.eventDrawer
            }
          >
            <header
              className={
                styles.drawerHeader
              }
            >
              <div>
                <span>
                  Event details
                </span>

                <strong>
                  Campaign calendar
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedEventId("")
                }
                aria-label="Close event details"
              >
                <X size={21} />
              </button>
            </header>

            <div
              className={
                styles.drawerBody
              }
            >
              <div
                className={
                  styles.drawerTitle
                }
              >
                <div
                  className={
                    styles.drawerBadges
                  }
                >
                  <span>
                    {formatEventType(
                      selectedEvent.event_type,
                    )}
                  </span>

                  <span>
                    {formatEventStatus(
                      selectedEvent.status,
                    )}
                  </span>
                </div>

                <h2>
                  {
                    selectedEvent.title
                  }
                </h2>

                <p>
                  {selectedEvent.description ||
                    "No event description has been added."}
                </p>
              </div>

              <div
                className={
                  styles.drawerActions
                }
              >
                {canUpdateEvents && (
                  <button
                    type="button"
                    onClick={() =>
                      openEditModal(
                        selectedEvent,
                      )
                    }
                  >
                    <Pencil
                      size={16}
                    />
                    Edit event
                  </button>
                )}

                {canCancelEvents &&
                  selectedEvent.status !==
                    "cancelled" && (
                  <button
                    className={
                      styles.cancelButton
                    }
                    type="button"
                    onClick={
                      handleCancelSelected
                    }
                    disabled={
                      isSaving
                    }
                  >
                    <X size={16} />
                    Cancel event
                  </button>
                )}
              </div>

              <div
                className={
                  styles.detailGrid
                }
              >
                <div>
                  <Clock3
                    size={18}
                  />

                  <span>
                    Date and time
                  </span>

                  <strong>
                    {formatDate(
                      selectedEvent.starts_at,
                      {
                        weekday:
                          "long",
                        month:
                          "long",
                        day:
                          "numeric",
                        year:
                          "numeric",
                      },
                    )}
                    <br />
                    {formatTimeRange(
                      selectedEvent.starts_at,
                      selectedEvent.ends_at,
                    )}
                  </strong>
                </div>

                <div>
                  <MapPin
                    size={18}
                  />

                  <span>
                    Location
                  </span>

                  <strong>
                    {selectedEvent.location ||
                      "Location pending"}
                  </strong>
                </div>

                <div>
                  <UsersRound
                    size={18}
                  />

                  <span>
                    RSVP progress
                  </span>

                  <strong>
                    {selectedEvent.rsvp_count ||
                      0}
                    {selectedEvent.capacity
                      ? ` of ${selectedEvent.capacity}`
                      : " responses"}
                  </strong>
                </div>

                <div>
                  <ShieldCheck
                    size={18}
                  />

                  <span>
                    Created by
                  </span>

                  <strong>
                    {creator?.fullName ||
                      "Campaign leadership"}
                  </strong>
                </div>
              </div>

              {selectedEvent.capacity && (
                <div
                  className={
                    styles.capacityPanel
                  }
                >
                  <div>
                    <span>
                      Attendance capacity
                    </span>

                    <strong>
                      {Math.min(
                        100,
                        Math.round(
                          (
                            Number(
                              selectedEvent.rsvp_count ||
                                0,
                            ) /
                            Number(
                              selectedEvent.capacity,
                            )
                          ) *
                            100,
                        ),
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (
                              Number(
                                selectedEvent.rsvp_count ||
                                  0,
                              ) /
                              Number(
                                selectedEvent.capacity,
                              )
                            ) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {isModalOpen && (
        <div
          className={
            styles.modalLayer
          }
        >
          <button
            className={
              styles.modalOverlay
            }
            type="button"
            onClick={() =>
              setIsModalOpen(false)
            }
            aria-label="Close event form"
          />

          <section
            className={
              styles.eventModal
            }
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div>
                <span>
                  {editingEventId
                    ? "Update event"
                    : "Create event"}
                </span>

                <h2>
                  {editingEventId
                    ? "Edit campaign event"
                    : "Add to campaign calendar"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsModalOpen(false)
                }
                aria-label="Close event form"
              >
                <X size={21} />
              </button>
            </header>

            <form
              className={
                styles.eventForm
              }
              onSubmit={
                handleSave
              }
            >
              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Event title
                </span>

                <input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Campaign event title"
                  autoFocus
                />
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Description
                </span>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Purpose, agenda, instructions or important context"
                />
              </label>

              <label>
                <span>
                  Event type
                </span>

                <select
                  name="eventType"
                  value={
                    form.eventType
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  {EVENT_TYPES.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  {EVENT_STATUSES.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Location
                </span>

                <input
                  name="location"
                  value={
                    form.location
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Address, venue or virtual meeting"
                />
              </label>

              <label>
                <span>
                  Starts
                </span>

                <input
                  name="startsAtLocal"
                  type="datetime-local"
                  value={
                    form.startsAtLocal
                  }
                  onChange={
                    handleFormChange
                  }
                />
              </label>

              <label>
                <span>
                  Ends
                </span>

                <input
                  name="endsAtLocal"
                  type="datetime-local"
                  value={
                    form.endsAtLocal
                  }
                  onChange={
                    handleFormChange
                  }
                />
              </label>

              <label>
                <span>
                  Capacity
                </span>

                <input
                  name="capacity"
                  type="number"
                  min="0"
                  value={
                    form.capacity
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                <span>
                  RSVP count
                </span>

                <input
                  name="rsvpCount"
                  type="number"
                  min="0"
                  value={
                    form.rsvpCount
                  }
                  onChange={
                    handleFormChange
                  }
                />
              </label>

              {formConflicts.length >
                0 && (
                <div
                  className={`${styles.formNotice} ${styles.conflictNotice}`}
                >
                  <AlertTriangle
                    size={18}
                  />

                  <div>
                    <strong>
                      Possible schedule conflict
                    </strong>

                    <span>
                      This overlaps{" "}
                      {formConflicts
                        .slice(0, 2)
                        .map(
                          (item) =>
                            item.title,
                        )
                        .join(", ")}
                      .
                    </span>
                  </div>
                </div>
              )}

              {formError && (
                <div
                  className={`${styles.formNotice} ${styles.formError}`}
                  role="alert"
                >
                  <AlertTriangle
                    size={18}
                  />

                  <span>
                    {formError}
                  </span>
                </div>
              )}

              <footer
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={
                    isSaving
                  }
                >
                  {isSaving && (
                    <LoaderCircle
                      className={
                        styles.spinning
                      }
                      size={17}
                    />
                  )}

                  {editingEventId
                    ? "Save changes"
                    : "Create event"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
