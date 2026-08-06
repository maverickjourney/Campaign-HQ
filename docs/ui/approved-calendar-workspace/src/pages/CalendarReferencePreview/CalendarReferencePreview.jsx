import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  ListChecks,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
  Video,
  X,
} from "lucide-react";

import { CampaignWorkspaceShell } from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import styles from "./CalendarReferencePreview.module.css";

const HOUR_START = 4;
const HOUR_END = 24;
const HOUR_HEIGHT = 42;

const EVENT_TONES = {
  meeting: "blue",
  outreach: "green",
  deadline: "gold",
  media: "purple",
  fundraiser: "red",
};

const EVENT_TYPE_LABELS = {
  meeting: "Meetings",
  outreach: "Outreach",
  deadline: "Deadlines",
  media: "Media",
  fundraiser: "Fundraising",
};

const TEMPLATE_EVENTS = [
  {
    id: "setup",
    dayOffset: 0,
    title: "Palm Beach Event Setup",
    location: "Campaign HQ",
    type: "meeting",
    allDay: true,
  },
  {
    id: "standup",
    dayOffset: 1,
    title: "Campaign Team Standup",
    location: "HQ Meeting Room",
    type: "meeting",
    startHour: 9,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "communications",
    dayOffset: 2,
    title: "Communications Meeting",
    location: "Strategy Room",
    type: "deadline",
    startHour: 10,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "press",
    dayOffset: 3,
    title: "Press Interview",
    location: "WPTV Studios",
    type: "media",
    startHour: 11,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "policy",
    dayOffset: 4,
    title: "Policy Meeting",
    location: "Transportation Plan",
    type: "outreach",
    startHour: 10,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "debate",
    dayOffset: 5,
    title: "Debate Preparation",
    location: "Strategy Session",
    type: "media",
    startHour: 9,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "social",
    dayOffset: 6,
    title: "Social Media Content Day",
    location: "Campaign HQ",
    type: "meeting",
    startHour: 10,
    startMinute: 0,
    duration: 60,
  },
  {
    id: "canvass",
    dayOffset: 0,
    title: "Canvassing Training",
    location: "Community Room",
    type: "media",
    startHour: 13,
    startMinute: 0,
    duration: 120,
  },
  {
    id: "fundraising",
    dayOffset: 1,
    title: "Fundraising Call with Donors",
    location: "Campaign HQ",
    type: "outreach",
    startHour: 14,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "volunteers",
    dayOffset: 2,
    title: "Volunteer Recruitment Call",
    location: "Zoom Meeting",
    type: "media",
    startHour: 15,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "finance",
    dayOffset: 3,
    title: "Finance Review",
    location: "Treasurer Office",
    type: "deadline",
    startHour: 14,
    startMinute: 0,
    duration: 60,
  },
  {
    id: "mail",
    dayOffset: 4,
    title: "Mail Piece Review",
    location: "Final Approval",
    type: "media",
    startHour: 13,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "planning",
    dayOffset: 5,
    title: "Event Planning Meeting",
    location: "Campaign HQ",
    type: "deadline",
    startHour: 14,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "outreach",
    dayOffset: 6,
    title: "Community Outreach Event",
    location: "Wellington Green",
    type: "media",
    startHour: 11,
    startMinute: 0,
    duration: 120,
  },
  {
    id: "website",
    dayOffset: 1,
    title: "Website Content Review",
    location: "Digital Team",
    type: "fundraiser",
    startHour: 17,
    startMinute: 0,
    duration: 90,
  },
  {
    id: "evening",
    dayOffset: 3,
    title: "Evening with Elizabeth",
    location: "The Wanderers Club",
    type: "meeting",
    startHour: 18,
    startMinute: 0,
    duration: 120,
  },
  {
    id: "volunteer-checkin",
    dayOffset: 4,
    title: "Volunteer Check-In",
    location: "Wellington Field Office",
    type: "outreach",
    startHour: 16,
    startMinute: 0,
    duration: 60,
  },
  {
    id: "yard-sign",
    dayOffset: 6,
    title: "Yard Sign Drop-Off & Pickup",
    location: "Campaign Warehouse",
    type: "fundraiser",
    startHour: 16,
    startMinute: 0,
    duration: 90,
  },
];

const TASKS = [
  {
    id: "task-1",
    title: "Prepare debate briefing",
    due: "Due today",
    urgent: true,
  },
  {
    id: "task-2",
    title: "Call list for voter outreach",
    due: "Today",
  },
  {
    id: "task-3",
    title: "Review direct mail designs",
    due: "Tomorrow",
  },
  {
    id: "task-4",
    title: "Confirm event vendors",
    due: "Thursday",
  },
  {
    id: "task-5",
    title: "Post social media content",
    due: "Friday",
  },
];

function startOfWeek(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function startOfMonth(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMinutes(value, amount) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + amount);
  return date;
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatShortDay(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(value);
}

function formatMonthYear(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatWeekRange(days) {
  const first = days[0];
  const last = days[days.length - 1];

  const firstLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(first);

  const lastLabel = new Intl.DateTimeFormat("en-US", {
    month:
      first.getMonth() === last.getMonth()
        ? undefined
        : "short",
    day: "numeric",
    year: "numeric",
  }).format(last);

  return `${firstLabel} – ${lastLabel}`;
}

function buildInitialEvents(anchor) {
  const weekStart = startOfWeek(anchor);

  return TEMPLATE_EVENTS.map((item) => {
    const date = addDays(weekStart, item.dayOffset);

    if (item.allDay) {
      return {
        ...item,
        tone: EVENT_TONES[item.type],
        start: date,
        end: addDays(date, 1),
      };
    }

    date.setHours(
      item.startHour,
      item.startMinute,
      0,
      0,
    );

    return {
      ...item,
      tone: EVENT_TONES[item.type],
      start: date,
      end: addMinutes(date, item.duration),
    };
  });
}

function TimelineView({
  days,
  events,
  now,
  onEventClick,
}) {
  const hours = Array.from(
    {
      length: HOUR_END - HOUR_START + 1,
    },
    (_, index) => HOUR_START + index,
  );

  const timelineHeight =
    (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  const currentDayIndex = days.findIndex((day) =>
    sameDay(day, now),
  );

  const currentDecimalHour =
    now.getHours() + now.getMinutes() / 60;

  const currentLineVisible =
    currentDayIndex >= 0 &&
    currentDecimalHour >= HOUR_START &&
    currentDecimalHour <= HOUR_END;

  const currentLineTop =
    (currentDecimalHour - HOUR_START) *
    HOUR_HEIGHT;

  return (
    <div className={styles.timelineShell}>
      <div
        className={`${styles.timelineCanvas} ${
          days.length === 1
            ? styles.dayModeTimeline
            : styles.weekModeTimeline
        }`}
        style={{
          "--calendar-columns": days.length,
        }}
      >
        <div className={styles.timelineCorner} />

        {days.map((day) => (
          <div
            className={`${styles.dayHeading} ${
              sameDay(day, now)
                ? styles.todayHeading
                : ""
            }`}
            key={formatDateKey(day)}
          >
            <small>{formatShortDay(day)}</small>
            <strong>{day.getDate()}</strong>
          </div>
        ))}

        <div className={styles.allDayLabel}>
          All day
        </div>

        {days.map((day) => {
          const allDayEvents = events.filter(
            (event) =>
              event.allDay &&
              sameDay(event.start, day),
          );

          return (
            <div
              className={styles.allDayCell}
              key={`all-day-${formatDateKey(day)}`}
            >
              {allDayEvents.map((event) => (
                <button
                  className={`${styles.allDayEvent} ${
                    styles[`tone_${event.tone}`]
                  }`}
                  key={event.id}
                  type="button"
                  onClick={() =>
                    onEventClick(event)
                  }
                >
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}

        <div
          className={styles.timelineBody}
          style={{
            height: timelineHeight,
          }}
        >
          <div className={styles.timeAxis}>
            {hours.slice(0, -1).map((hour) => (
              <span
                key={hour}
                style={{
                  top:
                    (hour - HOUR_START) *
                    HOUR_HEIGHT,
                }}
              >
                {new Intl.DateTimeFormat(
                  "en-US",
                  {
                    hour: "numeric",
                  },
                ).format(
                  new Date(
                    2026,
                    0,
                    1,
                    hour,
                    0,
                  ),
                )}
              </span>
            ))}
          </div>

          <div
            className={styles.dayColumns}
            style={{
              "--calendar-columns": days.length,
            }}
          >
            {days.map((day) => {
              const dayEvents = events.filter(
                (event) =>
                  !event.allDay &&
                  sameDay(event.start, day),
              );

              return (
                <div
                  className={styles.dayColumn}
                  key={`column-${formatDateKey(day)}`}
                >
                  {dayEvents.map((event) => {
                    const startHour =
                      event.start.getHours() +
                      event.start.getMinutes() / 60;

                    const durationMinutes =
                      (event.end - event.start) /
                      60000;

                    const top =
                      (startHour - HOUR_START) *
                      HOUR_HEIGHT;

                    const height = Math.max(
                      48,
                      (durationMinutes / 60) *
                        HOUR_HEIGHT,
                    );

                    const compactnessClass =
                      durationMinutes <= 60
                        ? styles.shortCalendarEvent
                        : durationMinutes <= 90
                          ? styles.mediumCalendarEvent
                          : styles.longCalendarEvent;

                    return (
                      <button
                        className={`${styles.calendarEvent} ${
                          styles[
                            `tone_${event.tone}`
                          ]
                        } ${compactnessClass}`}
                        key={event.id}
                        type="button"
                        style={{
                          top:
                            top +
                            (days.length === 1
                              ? 0
                              : 1),
                          height:
                            days.length === 1
                              ? height
                              : Math.max(
                                  44,
                                  height - 2,
                                ),
                          ...(days.length === 1
                            ? {
                                left: "20px",
                                right: "auto",
                                width:
                                  "min(720px, calc(100% - 40px))",
                              }
                            : {}),
                        }}
                        onClick={() =>
                          onEventClick(event)
                        }
                      >
                        <small>
                          {formatTime(event.start)} –{" "}
                          {formatTime(event.end)}
                        </small>

                        <strong>
                          {event.title}
                        </strong>

                        <span>
                          {event.location}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {currentLineVisible ? (
            <div
              className={styles.currentTimeLine}
              style={{
                top: currentLineTop,
              }}
            >
              <span>{formatTime(now)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  viewDate,
  events,
  now,
  onDateSelect,
  onEventClick,
}) {
  const monthStart = startOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart);

  const cells = Array.from(
    {
      length: 42,
    },
    (_, index) => addDays(gridStart, index),
  );

  return (
    <div className={styles.monthView}>
      <div className={styles.monthWeekdays}>
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.monthGrid}>
        {cells.map((date) => {
          const dayEvents = events.filter(
            (event) =>
              sameDay(event.start, date),
          );

          const outsideMonth =
            date.getMonth() !==
            viewDate.getMonth();

          return (
            <button
              className={`${styles.monthCell} ${
                outsideMonth
                  ? styles.outsideMonth
                  : ""
              } ${
                sameDay(date, now)
                  ? styles.currentMonthDay
                  : ""
              }`}
              key={formatDateKey(date)}
              type="button"
              onClick={() =>
                onDateSelect(date)
              }
            >
              <strong>{date.getDate()}</strong>

              <span>
                {dayEvents.slice(0, 4).map(
                  (event) => (
                    <button
                      className={`${styles.monthEvent} ${
                        styles[
                          `tone_${event.tone}`
                        ]
                      }`}
                      key={event.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {event.title}
                    </button>
                  ),
                )}
              </span>

              {dayEvents.length > 4 ? (
                <small>
                  +{dayEvents.length - 4} more
                </small>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({
  events,
  onEventClick,
}) {
  const grouped = events.reduce(
    (result, event) => {
      const key = formatDateKey(event.start);

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(event);
      return result;
    },
    {},
  );

  return (
    <div className={styles.agendaView}>
      {Object.entries(grouped).map(
        ([key, dayEvents]) => {
          const date = new Date(
            `${key}T12:00:00`,
          );

          return (
            <section
              className={styles.agendaDay}
              key={key}
            >
              <header>
                <strong>
                  {new Intl.DateTimeFormat(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    },
                  ).format(date)}
                </strong>

                <span>
                  {dayEvents.length} events
                </span>
              </header>

              {dayEvents.map((event) => (
                <button
                  className={styles.agendaEvent}
                  key={event.id}
                  type="button"
                  onClick={() =>
                    onEventClick(event)
                  }
                >
                  <span
                    className={`${styles.agendaTone} ${
                      styles[
                        `tone_${event.tone}`
                      ]
                    }`}
                  />

                  <time>
                    {event.allDay
                      ? "All day"
                      : formatTime(event.start)}
                  </time>

                  <div>
                    <strong>
                      {event.title}
                    </strong>

                    <small
                      className={styles.agendaType}
                    >
                      {
                        EVENT_TYPE_LABELS[
                          event.type
                        ]
                      }
                    </small>

                    <span>
                      <MapPin size={14} />
                      {event.location}
                    </span>
                  </div>

                  <ChevronRight size={17} />
                </button>
              ))}
            </section>
          );
        },
      )}
    </div>
  );
}

function MiniMonth({
  viewDate,
  now,
  events,
  onDateSelect,
}) {
  const monthStart = startOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart);

  const cells = Array.from(
    {
      length: 42,
    },
    (_, index) => addDays(gridStart, index),
  );

  return (
    <div className={styles.miniMonth}>
      <div className={styles.miniWeekdays}>
        {["S", "M", "T", "W", "T", "F", "S"].map(
          (day, index) => (
            <span key={`${day}-${index}`}>
              {day}
            </span>
          ),
        )}
      </div>

      <div className={styles.miniGrid}>
        {cells.map((date) => {
          const hasEvent = events.some(
            (event) =>
              sameDay(event.start, date),
          );

          return (
            <button
              className={`${styles.miniDay} ${
                date.getMonth() !==
                viewDate.getMonth()
                  ? styles.miniMuted
                  : ""
              } ${
                sameDay(date, now)
                  ? styles.miniToday
                  : ""
              }`}
              key={formatDateKey(date)}
              type="button"
              onClick={() =>
                onDateSelect(date)
              }
            >
              {date.getDate()}

              {hasEvent ? <i /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarReferencePreview() {
  const initialNow = useMemo(
    () => new Date(),
    [],
  );

  const [now, setNow] =
    useState(initialNow);

  const [viewDate, setViewDate] =
    useState(initialNow);

  const [viewMode, setViewMode] =
    useState("week");

  const [events, setEvents] = useState(() =>
    buildInitialEvents(initialNow),
  );

  const [search, setSearch] =
    useState("");

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [activeTypes, setActiveTypes] =
    useState(() =>
      Object.keys(EVENT_TYPE_LABELS),
    );

  const [selectedEvent, setSelectedEvent] =
    useState(null);

  const [newEventOpen, setNewEventOpen] =
    useState(false);

  const [syncing, setSyncing] =
    useState(false);

  const [completedTasks, setCompletedTasks] =
    useState([]);

  const [eventForm, setEventForm] =
    useState({
      title: "",
      date: formatDateKey(initialNow),
      start: "10:00",
      end: "11:00",
      location: "Campaign HQ",
      type: "meeting",
    });

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(new Date()),
      30000,
    );

    return () =>
      window.clearInterval(interval);
  }, []);

  // CALENDAR CURRENT TIME AUTO SCROLL — START
  useEffect(() => {
    if (
      viewMode !== "day" &&
      viewMode !== "week"
    ) {
      return undefined;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    const positionCurrentTime = () => {
      const shell =
        document.querySelector(
          `.${styles.timelineShell}`,
        );

      if (
        !(
          shell instanceof
          HTMLElement
        )
      ) {
        return;
      }

      const parts =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            hour:
              "2-digit",
            minute:
              "2-digit",
            hour12:
              false,
          },
        ).formatToParts(
          new Date(),
        );

      const values =
        Object.fromEntries(
          parts.map(
            (part) => [
              part.type,
              part.value,
            ],
          ),
        );

      let hour =
        Number(values.hour);

      const minute =
        Number(values.minute);

      if (hour === 24) {
        hour = 0;
      }

      const currentMinutes =
        hour * 60 +
        minute;

      const startMinutes =
        HOUR_START * 60;

      const endMinutes =
        HOUR_END * 60;

      const visibleMinutes =
        Math.max(
          startMinutes,
          Math.min(
            endMinutes,
            currentMinutes,
          ),
        );

      const targetPosition =
        (
          (
            visibleMinutes -
            startMinutes
          ) /
          60
        ) *
        HOUR_HEIGHT;

      const nextScroll =
        Math.max(
          0,
          targetPosition -
          shell.clientHeight * 0.42,
        );

      shell.scrollTo({
        top:
          nextScroll,
        behavior:
          "auto",
      });
    };

    firstFrame =
      window.requestAnimationFrame(
        () => {
          secondFrame =
            window.requestAnimationFrame(
              positionCurrentTime,
            );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        firstFrame,
      );

      window.cancelAnimationFrame(
        secondFrame,
      );
    };
  }, [viewMode, viewDate]);
  // CALENDAR CURRENT TIME AUTO SCROLL — END

  // CALENDAR OVERLAY BODY STATE — START
  useEffect(() => {
    const className =
      "campaign-seat-calendar-overlay-open";

    if (
      selectedEvent ||
      newEventOpen
    ) {
      document.body.classList.add(
        className,
      );
    } else {
      document.body.classList.remove(
        className,
      );
    }

    return () => {
      document.body.classList.remove(
        className,
      );
    };
  }, [selectedEvent, newEventOpen]);
  // CALENDAR OVERLAY BODY STATE — END

  const weekStart = useMemo(
    () => startOfWeek(viewDate),
    [viewDate],
  );

  const weekDays = useMemo(
    () =>
      Array.from(
        {
          length: 7,
        },
        (_, index) =>
          addDays(weekStart, index),
      ),
    [weekStart],
  );

  const dayViewDays = useMemo(
    () => [
      new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        viewDate.getDate(),
      ),
    ],
    [viewDate],
  );

  const visibleEvents = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return events
      .filter((event) =>
        activeTypes.includes(event.type),
      )
      .filter((event) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          event.title,
          event.location,
          EVENT_TYPE_LABELS[event.type],
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort(
        (left, right) =>
          left.start - right.start,
      );
  }, [events, search, activeTypes]);

  const summary = useMemo(() => {
    const todayEvents = events.filter(
      (event) =>
        sameDay(event.start, now),
    );

    const currentWeekStart =
      startOfWeek(now);

    const currentWeekEnd =
      addDays(currentWeekStart, 7);

    const weekEvents = events.filter(
      (event) =>
        event.start >= currentWeekStart &&
        event.start < currentWeekEnd,
    );

    const upcoming = events.filter(
      (event) => event.start >= now,
    );

    const meetings = weekEvents.filter(
      (event) =>
        event.type === "meeting",
    );

    return {
      today: todayEvents.length,
      week: weekEvents.length,
      upcoming: upcoming.length,
      overdue: 3,
      meetings: meetings.length,
    };
  }, [events, now, weekStart]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            !event.allDay &&
            event.start >= now,
        )
        .sort(
          (left, right) =>
            left.start - right.start,
        )
        .slice(0, 4),
    [events, now],
  );

  const toggleType = (type) => {
    setActiveTypes((current) =>
      current.includes(type)
        ? current.filter(
            (value) => value !== type,
          )
        : [...current, type],
    );
  };

  const moveCalendar = (direction) => {
    const next = new Date(viewDate);

    if (viewMode === "month") {
      next.setMonth(
        next.getMonth() + direction,
      );
    } else if (viewMode === "day") {
      next.setDate(
        next.getDate() + direction,
      );
    } else {
      next.setDate(
        next.getDate() + direction * 7,
      );
    }

    setViewDate(next);
  };

  const handleSync = () => {
    setSyncing(true);

    window.setTimeout(
      () => setSyncing(false),
      1100,
    );
  };

  const saveEvent = (submitEvent) => {
    submitEvent.preventDefault();

    const start = new Date(
      `${eventForm.date}T${eventForm.start}:00`,
    );

    const end = new Date(
      `${eventForm.date}T${eventForm.end}:00`,
    );

    const nextEvent = {
      id: `custom-${Date.now()}`,
      title:
        eventForm.title.trim() ||
        "New campaign event",
      location:
        eventForm.location.trim() ||
        "Location pending",
      type: eventForm.type,
      tone:
        EVENT_TONES[eventForm.type] ||
        "blue",
      allDay: false,
      start,
      end:
        end > start
          ? end
          : addMinutes(start, 60),
    };

    setEvents((current) => [
      ...current,
      nextEvent,
    ]);

    setSelectedEvent(nextEvent);
    setNewEventOpen(false);

    setEventForm({
      title: "",
      date: eventForm.date,
      start: "10:00",
      end: "11:00",
      location: "Campaign HQ",
      type: "meeting",
    });
  };

  const renderMainView = () => {
    if (viewMode === "month") {
      return (
        <MonthView
          viewDate={viewDate}
          events={visibleEvents}
          now={now}
          onDateSelect={(date) => {
            setViewDate(date);
            setViewMode("day");
          }}
          onEventClick={setSelectedEvent}
        />
      );
    }

    if (viewMode === "agenda") {
      return (
        <AgendaView
          events={visibleEvents}
          onEventClick={setSelectedEvent}
        />
      );
    }

    return (
      <TimelineView
        days={
          viewMode === "day"
            ? dayViewDays
            : weekDays
        }
        events={visibleEvents}
        now={now}
        onEventClick={setSelectedEvent}
      />
    );
  };

  return (
    <CampaignWorkspaceShell
      activePage="Calendar"
    >
      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>
              Campaign scheduling
            </span>

            <h1>Calendar</h1>

            <p>
              Manage campaign events,
              meetings, deadlines and team
              schedules.
            </p>
          </div>

          <div className={styles.headerActions}>
            <label className={styles.searchBox}>
              <Search size={18} />

              <input
                type="search"
                value={search}
                placeholder="Search events…"
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <kbd>⌘K</kbd>
            </label>

            <button
              className={styles.syncButton}
              type="button"
              onClick={handleSync}
            >
              <RefreshCw
                className={
                  syncing
                    ? styles.spinning
                    : ""
                }
                size={17}
              />

              {syncing
                ? "Syncing"
                : "Sync calendar"}
            </button>

            <button
              className={styles.primaryButton}
              type="button"
              onClick={() =>
                setNewEventOpen(true)
              }
            >
              <Plus size={19} />
              New event
              <ChevronDown size={15} />
            </button>
          </div>
        </section>

        <section
          className={styles.summaryGrid}
          aria-label="Calendar summary"
        >
          <article>
            <span
              className={`${styles.summaryIcon} ${styles.redIcon}`}
            >
              <CalendarDays size={21} />
            </span>

            <div>
              <small>Today</small>
              <strong>{summary.today}</strong>
              <span>campaign items</span>
              <p>Meetings and tasks</p>
            </div>
          </article>

          <article>
            <span
              className={`${styles.summaryIcon} ${styles.purpleIcon}`}
            >
              <CalendarRange size={21} />
            </span>

            <div>
              <small>This week</small>
              <strong>{summary.week}</strong>
              <span>events</span>
              <p>Across the campaign</p>
            </div>
          </article>

          <article>
            <span
              className={`${styles.summaryIcon} ${styles.goldIcon}`}
            >
              <CalendarClock size={21} />
            </span>

            <div>
              <small>Upcoming</small>
              <strong>
                {summary.upcoming}
              </strong>
              <span>events</span>
              <p>Next scheduled items</p>
            </div>
          </article>

          <article>
            <span
              className={`${styles.summaryIcon} ${styles.redIcon}`}
            >
              <AlertTriangle size={21} />
            </span>

            <div>
              <small>Overdue</small>
              <strong>{summary.overdue}</strong>
              <span>items</span>
              <p>Require attention</p>
            </div>
          </article>

          <article>
            <span
              className={`${styles.summaryIcon} ${styles.greenIcon}`}
            >
              <UsersRound size={21} />
            </span>

            <div>
              <small>Meetings</small>
              <strong>
                {summary.meetings}
              </strong>
              <span>scheduled</span>
              <p>This week</p>
            </div>
          </article>
        </section>

        <section className={styles.calendarLayout}>
          <div className={styles.calendarCard}>
            <div className={styles.calendarToolbar}>
              <div className={styles.dateControls}>
                <button
                  type="button"
                  onClick={() =>
                    setViewDate(new Date())
                  }
                >
                  Today
                </button>

                <span className={styles.arrowGroup}>
                  <button
                    type="button"
                    aria-label="Previous date range"
                    onClick={() =>
                      moveCalendar(-1)
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next date range"
                    onClick={() =>
                      moveCalendar(1)
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </span>

                <button
                  className={styles.rangeButton}
                  type="button"
                >
                  {viewMode === "month"
                    ? formatMonthYear(viewDate)
                    : viewMode === "day"
                      ? new Intl.DateTimeFormat(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        ).format(viewDate)
                      : formatWeekRange(
                          weekDays,
                        )}

                  <ChevronDown size={15} />
                </button>
              </div>

              <div className={styles.viewControls}>
                {[
                  ["day", "Day"],
                  ["week", "Week"],
                  ["month", "Month"],
                  ["agenda", "Agenda"],
                ].map(([value, label]) => (
                  <button
                    className={
                      viewMode === value
                        ? styles.activeView
                        : ""
                    }
                    key={value}
                    type="button"
                    onClick={() =>
                      setViewMode(value)
                    }
                  >
                    {label}
                  </button>
                ))}

                <div className={styles.filterWrap}>
                  <button
                    className={
                      filtersOpen
                        ? styles.activeFilter
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setFiltersOpen(
                        (current) => !current,
                      )
                    }
                  >
                    <Filter size={17} />
                    Filter
                  </button>

                  {filtersOpen ? (
                    <div
                      className={styles.filterMenu}
                    >
                      <header>
                        <strong>
                          Event types
                        </strong>

                        <button
                          type="button"
                          aria-label="Close filters"
                          onClick={() =>
                            setFiltersOpen(false)
                          }
                        >
                          <X size={16} />
                        </button>
                      </header>

                      {Object.entries(
                        EVENT_TYPE_LABELS,
                      ).map(
                        ([type, label]) => (
                          <label key={type}>
                            <input
                              type="checkbox"
                              checked={activeTypes.includes(
                                type,
                              )}
                              onChange={() =>
                                toggleType(type)
                              }
                            />

                            <span
                              className={`${styles.filterDot} ${
                                styles[
                                  `tone_${EVENT_TONES[type]}`
                                ]
                              }`}
                            />

                            {label}
                          </label>
                        ),
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setActiveTypes(
                            Object.keys(
                              EVENT_TYPE_LABELS,
                            ),
                          )
                        }
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              className={styles.eventLegend}
              aria-label="Calendar event color key"
            >
              {Object.entries(
                EVENT_TYPE_LABELS,
              ).map(([type, label]) => (
                <span key={type}>
                  <i
                    className={
                      styles[
                        `tone_${
                          EVENT_TONES[type]
                        }`
                      ]
                    }
                  />

                  {label}
                </span>
              ))}
            </div>

            {renderMainView()}
          </div>

          <aside className={styles.rightRail}>
            <section className={styles.railCard}>
              <header>
                <strong>
                  {formatMonthYear(viewDate)}
                </strong>

                <span>
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => {
                      const next =
                        new Date(viewDate);

                      next.setMonth(
                        next.getMonth() - 1,
                      );

                      setViewDate(next);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => {
                      const next =
                        new Date(viewDate);

                      next.setMonth(
                        next.getMonth() + 1,
                      );

                      setViewDate(next);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </span>
              </header>

              <MiniMonth
                viewDate={viewDate}
                now={now}
                events={events}
                onDateSelect={(date) => {
                  setViewDate(date);
                  setViewMode("day");
                }}
              />
            </section>

            <section className={styles.railCard}>
              <header>
                <strong>
                  Upcoming events
                </strong>

                <button type="button">
                  View all
                </button>
              </header>

              <div className={styles.upcomingList}>
                {upcomingEvents.length ? (
                  upcomingEvents.map(
                    (event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() =>
                          setSelectedEvent(
                            event,
                          )
                        }
                      >
                        <i
                          className={
                            styles[
                              `tone_${event.tone}`
                            ]
                          }
                        />

                        <span>
                          <strong>
                            {event.title}
                          </strong>

                          <small>
                            {new Intl.DateTimeFormat(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            ).format(
                              event.start,
                            )}
                            ,{" "}
                            {formatTime(
                              event.start,
                            )}
                          </small>

                          <small>
                            {event.location}
                          </small>
                        </span>
                      </button>
                    ),
                  )
                ) : (
                  <p>
                    No upcoming events match
                    the current filters.
                  </p>
                )}
              </div>
            </section>

            <section className={styles.railCard}>
              <header>
                <strong>
                  My calendar tasks
                </strong>

                <button type="button">
                  View all
                </button>
              </header>

              <div className={styles.taskList}>
                {TASKS.map((task) => {
                  const completed =
                    completedTasks.includes(
                      task.id,
                    );

                  return (
                    <label key={task.id}>
                      <input
                        type="checkbox"
                        checked={completed}
                        onChange={() =>
                          setCompletedTasks(
                            (current) =>
                              completed
                                ? current.filter(
                                    (id) =>
                                      id !==
                                      task.id,
                                  )
                                : [
                                    ...current,
                                    task.id,
                                  ],
                          )
                        }
                      />

                      <span
                        className={
                          completed
                            ? styles.completedTask
                            : ""
                        }
                      >
                        {task.title}
                      </span>

                      <small
                        className={
                          task.urgent
                            ? styles.urgentTask
                            : ""
                        }
                      >
                        {task.due}
                      </small>
                    </label>
                  );
                })}
              </div>

              <button
                className={styles.connectButton}
                type="button"
              >
                <CalendarDays size={17} />
                Connect calendar
              </button>
            </section>
          </aside>
        </section>

        {selectedEvent ? (
          <div
            className={styles.overlay}
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedEvent(null);
              }
            }}
          >
            <aside
              className={styles.eventDrawer}
              role="dialog"
              aria-modal="true"
              aria-label="Event details"
            >
              <header>
                <span
                  className={`${styles.detailIcon} ${
                    styles[
                      `tone_${selectedEvent.tone}`
                    ]
                  }`}
                >
                  <CalendarDays size={22} />
                </span>

                <button
                  type="button"
                  aria-label="Close event details"
                  onClick={() =>
                    setSelectedEvent(null)
                  }
                >
                  <X size={20} />
                </button>
              </header>

              <span className={styles.eyebrow}>
                {
                  EVENT_TYPE_LABELS[
                    selectedEvent.type
                  ]
                }
              </span>

              <h2>{selectedEvent.title}</h2>

              <div className={styles.detailRows}>
                <span>
                  <Clock3 size={18} />

                  <div>
                    <small>Date and time</small>

                    <strong>
                      {new Intl.DateTimeFormat(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        },
                      ).format(
                        selectedEvent.start,
                      )}
                    </strong>

                    <p>
                      {selectedEvent.allDay
                        ? "All day"
                        : `${formatTime(
                            selectedEvent.start,
                          )} – ${formatTime(
                            selectedEvent.end,
                          )}`}
                    </p>
                  </div>
                </span>

                <span>
                  <MapPin size={18} />

                  <div>
                    <small>Location</small>
                    <strong>
                      {selectedEvent.location}
                    </strong>
                  </div>
                </span>

                <span>
                  <UsersRound size={18} />

                  <div>
                    <small>Campaign team</small>
                    <strong>
                      Elizabeth Accomando,
                      Chris Isaak and team
                    </strong>
                  </div>
                </span>
              </div>

              <section
                className={styles.detailStatus}
              >
                <CheckCircle2 size={18} />

                <div>
                  <strong>
                    Visible on the campaign calendar
                  </strong>

                  <span>
                    Team members can view this
                    event and its updates.
                  </span>
                </div>
              </section>

              <div className={styles.drawerActions}>
                <button type="button">
                  Edit event
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEvents((current) =>
                      current.filter(
                        (event) =>
                          event.id !==
                          selectedEvent.id,
                      ),
                    );

                    setSelectedEvent(null);
                  }}
                >
                  Cancel event
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {newEventOpen ? (
          <div
            className={styles.overlay}
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setNewEventOpen(false);
              }
            }}
          >
            <form
              className={styles.eventModal}
              onSubmit={saveEvent}
            >
              <header>
                <div>
                  <span className={styles.eyebrow}>
                    Campaign calendar
                  </span>

                  <h2>Create event</h2>
                </div>

                <button
                  type="button"
                  aria-label="Close create event"
                  onClick={() =>
                    setNewEventOpen(false)
                  }
                >
                  <X size={20} />
                </button>
              </header>

              <label>
                Event name
                <input
                  required
                  type="text"
                  value={eventForm.title}
                  placeholder="Enter event name"
                  onChange={(event) =>
                    setEventForm(
                      (current) => ({
                        ...current,
                        title:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <div className={styles.formGrid}>
                <label>
                  Date
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(event) =>
                      setEventForm(
                        (current) => ({
                          ...current,
                          date:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Type
                  <select
                    value={eventForm.type}
                    onChange={(event) =>
                      setEventForm(
                        (current) => ({
                          ...current,
                          type:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    {Object.entries(
                      EVENT_TYPE_LABELS,
                    ).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Start
                  <input
                    type="time"
                    value={eventForm.start}
                    onChange={(event) =>
                      setEventForm(
                        (current) => ({
                          ...current,
                          start:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  End
                  <input
                    type="time"
                    value={eventForm.end}
                    onChange={(event) =>
                      setEventForm(
                        (current) => ({
                          ...current,
                          end:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <label>
                Location or meeting link
                <input
                  type="text"
                  value={eventForm.location}
                  placeholder="Campaign HQ, Zoom, address…"
                  onChange={(event) =>
                    setEventForm(
                      (current) => ({
                        ...current,
                        location:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <div className={styles.modalNotice}>
                <Video size={18} />

                <span>
                  Calendar connections and
                  virtual meeting links can be
                  attached after the event is
                  created.
                </span>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setNewEventOpen(false)
                  }
                >
                  Cancel
                </button>

                <button type="submit">
                  <Check size={18} />
                  Add to calendar
                </button>
              </footer>
            </form>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}
