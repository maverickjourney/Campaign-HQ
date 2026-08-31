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

import {
  useCalendarCommandCenter,
} from "../../hooks/useCalendarCommandCenter";

import {
  useEventTaskLinks,
} from "../../hooks/useEventTaskLinks";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import {
  supabase,
} from "../../lib/supabase";

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

function taskDueDate(task) {
  if (!task?.due_at) {
    return null;
  }

  const value =
    new Date(task.due_at);

  return Number.isNaN(
    value.getTime(),
  )
    ? null
    : value;
}

function taskIsActive(task) {
  return ![
    "completed",
    "done",
    "cancelled",
    "archived",
  ].includes(
    String(
      task?.status || "",
    )
      .trim()
      .toLowerCase(),
  );
}

function taskPriorityScore(task) {
  const priority =
    String(
      task?.priority || "",
    )
      .trim()
      .toLowerCase();

  if (
    priority === "critical" ||
    priority === "urgent"
  ) {
    return 4;
  }

  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  return 1;
}

function formatDueLabel(
  value,
  reference = new Date(),
) {
  const due =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      due.getTime(),
    )
  ) {
    return "Due date";
  }

  const today =
    new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate(),
    );

  const dueDay =
    new Date(
      due.getFullYear(),
      due.getMonth(),
      due.getDate(),
    );

  const tomorrow =
    addDays(
      today,
      1,
    );

  const nextWeek =
    addDays(
      today,
      7,
    );

  if (dueDay < today) {
    return "Overdue";
  }

  if (sameDay(dueDay, today)) {
    return "Today";
  }

  if (
    sameDay(
      dueDay,
      tomorrow,
    )
  ) {
    return "Tomorrow";
  }

  if (dueDay < nextWeek) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
      },
    ).format(dueDay);
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  ).format(dueDay);
}

function formatEventPeople(
  event,
  team,
) {
  const participants =
    Array.isArray(
      event?.participants,
    )
      ? event.participants
      : [];

  const participantNames =
    participants
      .map(
        (participant) => {
          if (
            typeof participant ===
            "string"
          ) {
            return participant.trim();
          }

          return String(
            participant?.name ||
            participant?.full_name ||
            participant?.fullName ||
            participant?.email ||
            "",
          ).trim();
        },
      )
      .filter(Boolean);

  if (participantNames.length) {
    const visible =
      participantNames.slice(
        0,
        3,
      );

    const remaining =
      participantNames.length -
      visible.length;

    return remaining > 0
      ? `${visible.join(", ")} +${remaining} more`
      : visible.join(", ");
  }

  const teamNames =
    (Array.isArray(team)
      ? team
      : [])
      .map(
        (member) =>
          String(
            member?.fullName ||
            member?.full_name ||
            member?.email ||
            "",
          ).trim(),
      )
      .filter(Boolean)
      .slice(
        0,
        3,
      );

  if (teamNames.length) {
    return teamNames.join(", ");
  }

  return "Campaign team";
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

function TimelineView({
  days,
  events,
  tasks,
  now,
  onEventClick,
  onTaskClick,
  onTaskDeadlineDrop,
}) {
  const [
    taskDropDayKey,
    setTaskDropDayKey,
  ] = useState("");

  const [
    draggedTaskId,
    setDraggedTaskId,
  ] = useState("");

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

              const dayTasks =
                (tasks || [])
                  .filter(
                    taskIsActive,
                  )
                  .map(
                    (task) => ({
                      task,
                      due:
                        taskDueDate(
                          task,
                        ),
                    }),
                  )
                  .filter(
                    ({
                      due,
                    }) => {
                      if (
                        !due ||
                        !sameDay(
                          due,
                          day,
                        )
                      ) {
                        return false;
                      }

                      const decimalHour =
                        due.getHours() +
                        due.getMinutes() /
                          60;

                      return (
                        decimalHour >=
                          HOUR_START &&
                        decimalHour <
                          HOUR_END
                      );
                    },
                  );

              return (
                <div
                  className={`${styles.dayColumn} ${
                    taskDropDayKey ===
                    formatDateKey(
                      day,
                    )
                      ? styles.taskDropDay
                      : ""
                  }`}
                  key={`column-${formatDateKey(day)}`}
                  onDragEnter={(
                    dragEvent,
                  ) => {
                    dragEvent
                      .preventDefault();

                    setTaskDropDayKey(
                      formatDateKey(
                        day,
                      ),
                    );
                  }}
                  onDragOver={(
                    dragEvent,
                  ) => {
                    dragEvent
                      .preventDefault();

                    dragEvent
                      .dataTransfer
                      .dropEffect =
                      "move";
                  }}
                  onDragLeave={(
                    dragEvent,
                  ) => {
                    if (
                      dragEvent
                        .currentTarget
                        .contains(
                          dragEvent
                            .relatedTarget,
                        )
                    ) {
                      return;
                    }

                    setTaskDropDayKey(
                      "",
                    );
                  }}
                  onDrop={(
                    dragEvent,
                  ) => {
                    dragEvent
                      .preventDefault();

                    const taskId =
                      dragEvent
                        .dataTransfer
                        .getData(
                          "application/x-campaign-seat-task",
                        ) ||
                      dragEvent
                        .dataTransfer
                        .getData(
                          "text/plain",
                        );

                    setTaskDropDayKey(
                      "",
                    );

                    setDraggedTaskId(
                      "",
                    );

                    if (
                      !taskId ||
                      !onTaskDeadlineDrop
                    ) {
                      return;
                    }

                    const rect =
                      dragEvent
                        .currentTarget
                        .getBoundingClientRect();

                    const offsetY =
                      Math.max(
                        0,
                        Math.min(
                          rect.height,
                          dragEvent
                            .clientY -
                            rect.top,
                        ),
                      );

                    const rawMinutes =
                      HOUR_START *
                        60 +
                      (
                        offsetY /
                        HOUR_HEIGHT
                      ) *
                        60;

                    const snappedMinutes =
                      Math.max(
                        HOUR_START *
                          60,
                        Math.min(
                          HOUR_END *
                            60 -
                            15,
                          Math.round(
                            rawMinutes /
                              15,
                          ) *
                            15,
                        ),
                      );

                    onTaskDeadlineDrop(
                      taskId,
                      day,
                      snappedMinutes,
                    );
                  }}
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

                  {dayTasks.map(
                    ({
                      task,
                      due,
                    }) => {
                      const dueHour =
                        due.getHours() +
                        due.getMinutes() /
                          60;

                      const top =
                        (
                          dueHour -
                          HOUR_START
                        ) *
                        HOUR_HEIGHT;

                      return (
                        <button
                          className={`${styles.taskDeadlineMarker} ${
                            draggedTaskId ===
                            task.id
                              ? styles.taskDeadlineDragging
                              : ""
                          }`}
                          key={`task-deadline-${task.id}`}
                          type="button"
                          draggable
                          style={{
                            top:
                              Math.max(
                                18,
                                Math.min(
                                  timelineHeight -
                                    18,
                                  top,
                                ),
                              ),
                          }}
                          title={`${task.title || "Campaign task"} · ${formatTime(
                            due,
                          )} deadline · Click for exact time · Drag to reschedule`}
                          onDragStart={(
                            dragEvent,
                          ) => {
                            dragEvent
                              .dataTransfer
                              .effectAllowed =
                              "move";

                            dragEvent
                              .dataTransfer
                              .setData(
                                "application/x-campaign-seat-task",
                                task.id,
                              );

                            dragEvent
                              .dataTransfer
                              .setData(
                                "text/plain",
                                task.id,
                              );

                            setDraggedTaskId(
                              task.id,
                            );
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(
                              "",
                            );

                            setTaskDropDayKey(
                              "",
                            );
                          }}
                          onClick={() =>
                            onTaskClick?.(
                              task,
                            )
                          }
                        >
                          <span
                            className={
                              styles.taskDeadlineIcon
                            }
                          >
                            <ListChecks
                              size={12}
                            />
                          </span>

                          <span
                            className={
                              styles.taskDeadlineCopy
                            }
                          >
                            <small>
                              {formatTime(
                                due,
                              )}
                              {" · Deadline"}
                            </small>

                            <strong>
                              {task.title ||
                                "Campaign task"}
                            </strong>
                          </span>
                        </button>
                      );
                    },
                  )}
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
  tasks,
  now,
  onEventClick,
}) {
  const todayStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

  const tomorrowStart =
    addDays(
      todayStart,
      1,
    );

  const dayAfterTomorrow =
    addDays(
      todayStart,
      2,
    );

  const nextWeekStart =
    addDays(
      todayStart,
      7,
    );

  const bucketForDate =
    (
      date,
      {
        overdue = false,
      } = {},
    ) => {
      if (overdue) {
        return {
          key: "overdue",
          label: "Overdue",
          rank: 0,
        };
      }

      if (
        date >= todayStart &&
        date < tomorrowStart
      ) {
        return {
          key: "today",
          label: "Today",
          rank: 1,
        };
      }

      if (
        date >= tomorrowStart &&
        date < dayAfterTomorrow
      ) {
        return {
          key: "tomorrow",
          label: "Tomorrow",
          rank: 2,
        };
      }

      if (
        date >= dayAfterTomorrow &&
        date < nextWeekStart
      ) {
        return {
          key: "this-week",
          label: "This week",
          rank: 3,
        };
      }

      return {
        key: "later",
        label: "Later",
        rank: 4,
      };
    };

  const eventItems =
    (events || [])
      .filter(
        (event) =>
          event.end >=
          todayStart,
      )
      .map(
        (event) => ({
          id:
            `event-${event.id}`,
          source:
            "event",
          date:
            event.start,
          sortDate:
            event.start,
          bucket:
            bucketForDate(
              event.start,
            ),
          title:
            event.title,
          typeLabel:
            EVENT_TYPE_LABELS[
              event.type
            ] ||
            "Event",
          location:
            event.location,
          tone:
            event.tone,
          allDay:
            event.allDay,
          event,
        }),
      );

  const taskItems =
    (tasks || [])
      .filter(
        taskIsActive,
      )
      .map(
        (task) => {
          const due =
            taskDueDate(
              task,
            );

          if (!due) {
            return null;
          }

          const overdue =
            due <
            todayStart;

          return {
            id:
              `task-${task.id}`,
            source:
              "task",
            date:
              due,
            sortDate:
              due,
            bucket:
              bucketForDate(
                due,
                {
                  overdue,
                },
              ),
            title:
              task.title ||
              "Campaign task",
            typeLabel:
              task.category ||
              "Campaign task",
            priority:
              task.priority ||
              "normal",
            urgent:
              overdue ||
              taskPriorityScore(
                task,
              ) >= 3,
            overdue,
            task,
          };
        },
      )
      .filter(Boolean);

  const groups =
    [
      ...eventItems,
      ...taskItems,
    ]
      .sort(
        (left, right) => {
          if (
            left.bucket.rank !==
            right.bucket.rank
          ) {
            return (
              left.bucket.rank -
              right.bucket.rank
            );
          }

          if (
            left.source === "task" &&
            right.source === "task"
          ) {
            const priorityDifference =
              taskPriorityScore(
                right.task,
              ) -
              taskPriorityScore(
                left.task,
              );

            if (
              priorityDifference
            ) {
              return (
                priorityDifference
              );
            }
          }

          return (
            left.sortDate -
            right.sortDate
          );
        },
      )
      .reduce(
        (result, item) => {
          const key =
            item.bucket.key;

          if (!result[key]) {
            result[key] = {
              ...item.bucket,
              items: [],
            };
          }

          result[key]
            .items
            .push(
              item,
            );

          return result;
        },
        {},
      );

  const orderedGroups =
    Object.values(
      groups,
    ).sort(
      (left, right) =>
        left.rank -
        right.rank,
    );

  if (
    !orderedGroups.length
  ) {
    return (
      <div
        className={
          styles.agendaEmpty
        }
      >
        <CalendarDays
          size={28}
        />

        <strong>
          Nothing scheduled yet
        </strong>

        <span>
          Upcoming campaign events
          and task deadlines will
          appear here.
        </span>
      </div>
    );
  }

  return (
    <div
      className={
        styles.agendaView
      }
    >
      <div
        className={
          styles.agendaCommandHeader
        }
      >
        <div>
          <small>
            Campaign command view
          </small>

          <strong>
            Upcoming schedule & deadlines
          </strong>
        </div>

        <span>
          {eventItems.length}
          {" "}
          event{
            eventItems.length === 1
              ? ""
              : "s"
          }
          {" · "}
          {taskItems.length}
          {" "}
          task{
            taskItems.length === 1
              ? ""
              : "s"
          }
        </span>
      </div>

      {orderedGroups.map(
        (group) => (
          <section
            className={`${styles.agendaDay} ${
              group.key ===
              "overdue"
                ? styles.agendaOverdueGroup
                : ""
            }`}
            key={
              group.key
            }
          >
            <header>
              <strong>
                {group.label}
              </strong>

              <span>
                {
                  group.items
                    .length
                }
                {" "}
                item{
                  group.items
                    .length === 1
                    ? ""
                    : "s"
                }
              </span>
            </header>

            {group.items.map(
              (item) => {
                if (
                  item.source ===
                  "task"
                ) {
                  const priorityLabel =
                    String(
                      item.priority,
                    );

                  return (
                    <button
                      className={`${styles.agendaEvent} ${styles.agendaTask} ${
                        item.urgent
                          ? styles.agendaUrgent
                          : ""
                      }`}
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        window.location.assign(
                          `/tasks?task=${encodeURIComponent(
                            item.task.id,
                          )}`,
                        )
                      }
                    >
                      <span
                        className={`${styles.agendaTone} ${styles.agendaTaskTone}`}
                      />

                      <time>
                        {formatTime(
                          item.date,
                        )}
                      </time>

                      <div>
                        <strong>
                          {
                            item.title
                          }
                        </strong>

                        <small
                          className={
                            styles.agendaType
                          }
                        >
                          Task
                          {" · "}
                          {
                            item.typeLabel
                          }
                          {" · "}
                          {
                            priorityLabel
                              .charAt(0)
                              .toUpperCase() +
                            priorityLabel
                              .slice(1)
                          }
                        </small>

                        <span>
                          {item.overdue ? (
                            <>
                              <AlertTriangle
                                size={14}
                              />
                              Deadline passed
                            </>
                          ) : (
                            <>
                              <ListChecks
                                size={14}
                              />
                              Open task details
                            </>
                          )}
                        </span>
                      </div>

                      <ChevronRight
                        size={17}
                      />
                    </button>
                  );
                }

                return (
                  <button
                    className={
                      styles.agendaEvent
                    }
                    key={
                      item.id
                    }
                    type="button"
                    onClick={() =>
                      onEventClick(
                        item.event,
                      )
                    }
                  >
                    <span
                      className={`${styles.agendaTone} ${
                        styles[
                          `tone_${item.tone}`
                        ]
                      }`}
                    />

                    <time>
                      {item.allDay
                        ? "All day"
                        : formatTime(
                            item.date,
                          )}
                    </time>

                    <div>
                      <strong>
                        {
                          item.title
                        }
                      </strong>

                      <small
                        className={
                          styles.agendaType
                        }
                      >
                        {
                          item.typeLabel
                        }
                      </small>

                      <span>
                        <MapPin
                          size={14}
                        />
                        {
                          item.location
                        }
                      </span>
                    </div>

                    <ChevronRight
                      size={17}
                    />
                  </button>
                );
              },
            )}
          </section>
        ),
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

function normalizeStoredEvent(event) {
  if (!event?.starts_at) {
    return null;
  }

  const start =
    new Date(event.starts_at);

  if (
    Number.isNaN(
      start.getTime(),
    )
  ) {
    return null;
  }

  const requestedType =
    String(
      event.event_type ||
        "meeting",
    ).toLowerCase();

  const type =
    EVENT_TONES[requestedType]
      ? requestedType
      : "meeting";

  const requestedEnd =
    event.ends_at
      ? new Date(event.ends_at)
      : addMinutes(
          start,
          60,
        );

  const end =
    !Number.isNaN(
      requestedEnd.getTime(),
    ) &&
    requestedEnd > start
      ? requestedEnd
      : addMinutes(
          start,
          60,
        );

  return {
    id: event.id,
    title:
      event.title ||
      "Campaign event",
    description:
      event.description ||
      "",
    location:
      event.location ||
      "Location pending",
    type,
    tone:
      EVENT_TONES[type] ||
      "blue",
    allDay:
      event.is_all_day ===
      true,
    start,
    end,
    status:
      event.status ||
      "scheduled",

    eventTimezone:
      event.event_timezone ||
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/New_York",

    participants:
      Array.isArray(
        event.participants,
      )
        ? event.participants
        : [],

    recurrenceRules:
      Array.isArray(
        event.recurrence_rules,
      )
        ? event.recurrence_rules
        : [],

    reminders:
      event.reminders &&
      typeof event.reminders ===
        "object"
        ? event.reminders
        : {},

    busy:
      event.busy !==
      false,

    visibility:
      event.visibility ||
      "default",

    conferencing:
      event.conferencing &&
      typeof event.conferencing ===
        "object"
        ? event.conferencing
        : {},

    hideParticipants:
      event.hide_participants ===
      true,

    notifyParticipants:
      event.notify_participants !==
      false,

    sourceProvider:
      event.source_provider ||
      null,

    externalCalendarId:
      event.external_calendar_id ||
      null,

    externalEventId:
      event.external_event_id ||
      null,

    externalIcalUid:
      event.external_ical_uid ||
      null,

    syncMetadata:
      event.sync_metadata &&
      typeof event.sync_metadata ===
        "object"
        ? event.sync_metadata
        : {},

    source:
      event.source_provider ===
      "nylas"
        ? "provider"
        : "campaign-seat",
  };
}


function formatTimeInputValue(date) {
  if (!(date instanceof Date)) {
    return "10:00";
  }

  return [
    String(
      date.getHours(),
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getMinutes(),
    ).padStart(
      2,
      "0",
    ),
  ].join(":");
}

function recurrenceModeFromRules(rules) {
  if (!Array.isArray(rules)) {
    return "none";
  }

  const rule =
    rules.find(
      (value) =>
        String(value)
          .toUpperCase()
          .startsWith(
            "RRULE:",
          ),
    ) || "";

  const upper =
    String(rule)
      .toUpperCase();

  if (
    upper.includes(
      "FREQ=DAILY",
    )
  ) {
    return "daily";
  }

  if (
    upper.includes(
      "FREQ=WEEKLY",
    )
  ) {
    return "weekly";
  }

  if (
    upper.includes(
      "FREQ=MONTHLY",
    )
  ) {
    return "monthly";
  }

  if (upper) {
    return "custom";
  }

  return "none";
}

function recurrenceRulesFromMode(
  mode,
  existingRules,
) {
  if (mode === "daily") {
    return [
      "RRULE:FREQ=DAILY",
    ];
  }

  if (mode === "weekly") {
    return [
      "RRULE:FREQ=WEEKLY",
    ];
  }

  if (mode === "monthly") {
    return [
      "RRULE:FREQ=MONTHLY",
    ];
  }

  if (mode === "custom") {
    return Array.isArray(
      existingRules,
    )
      ? existingRules
      : [];
  }

  return [];
}

function reminderEditorStateFromObject(
  reminders,
) {
  if (
    reminders?.use_default ===
    true
  ) {
    return {
      useDefaultReminders:
        true,

      reminderRows:
        [],
    };
  }

  const overrides =
    Array.isArray(
      reminders?.overrides,
    )
      ? reminders
          .overrides
          .map(
            (reminder) => {
              const minutes =
                Number(
                  reminder
                    ?.reminder_minutes,
                );

              const method =
                String(
                  reminder
                    ?.reminder_method ||
                  "popup",
                )
                  .trim()
                  .toLowerCase();

              if (
                !Number.isFinite(
                  minutes,
                )
              ) {
                return null;
              }

              return {
                minutes:
                  String(minutes),

                method:
                  [
                    "popup",
                    "email",
                  ].includes(
                    method,
                  )
                    ? method
                    : "popup",
              };
            },
          )
          .filter(Boolean)
      : [];

  return {
    useDefaultReminders:
      false,

    reminderRows:
      overrides,
  };
}

function remindersFromEditor(
  useDefaultReminders,
  reminderRows,
) {
  if (
    useDefaultReminders
  ) {
    return {
      use_default:
        true,
    };
  }

  const overrides =
    (
      Array.isArray(
        reminderRows,
      )
        ? reminderRows
        : []
    )
      .map(
        (reminder) => {
          const minutes =
            Number(
              reminder
                ?.minutes,
            );

          const method =
            String(
              reminder
                ?.method ||
              "popup",
            )
              .trim()
              .toLowerCase();

          if (
            !Number.isFinite(
              minutes,
            ) ||
            minutes < 0
          ) {
            return null;
          }

          return {
            reminder_minutes:
              Math.round(
                minutes,
              ),

            reminder_method:
              [
                "popup",
                "email",
              ].includes(
                method,
              )
                ? method
                : "popup",
          };
        },
      )
      .filter(Boolean)
      .slice(
        0,
        5,
      );

  if (
    overrides.length ===
    0
  ) {
    return {};
  }

  return {
    use_default:
      false,

    overrides,
  };
}



function addDaysToDateKey(
  dateKey,
  days,
) {
  const [
    year,
    month,
    day,
  ] =
    String(
      dateKey ||
      "",
    )
      .split("-")
      .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return "";
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function zonedDateTimeToEpochSeconds(
  dateKey,
  timeValue,
  timeZone,
) {
  const [
    year,
    month,
    day,
  ] =
    String(
      dateKey ||
      "",
    )
      .split("-")
      .map(Number);

  const [
    hour,
    minute,
  ] =
    String(
      timeValue ||
      "00:00",
    )
      .split(":")
      .map(Number);

  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const targetUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0,
    );

  let guess =
    targetUtc;

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone,

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",

          hour:
            "2-digit",

          minute:
            "2-digit",

          hourCycle:
            "h23",
        },
      ).formatToParts(
        new Date(
          guess,
        ),
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

    const representedUtc =
      Date.UTC(
        Number(
          values.year,
        ),
        Number(
          values.month,
        ) - 1,
        Number(
          values.day,
        ),
        Number(
          values.hour,
        ),
        Number(
          values.minute,
        ),
        0,
        0,
      );

    const correction =
      targetUtc -
      representedUtc;

    if (
      Math.abs(
        correction,
      ) < 1000
    ) {
      break;
    }

    guess +=
      correction;
  }

  return Math.floor(
    guess /
    1000,
  );
}

function dateKeyFromEpochInZone(
  epochSeconds,
  timeZone,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(
      new Date(
        epochSeconds *
        1000,
      ),
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

  return (
    `${values.year}-${values.month}-${values.day}`
  );
}

function timeInputFromEpochInZone(
  epochSeconds,
  timeZone,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      },
    ).formatToParts(
      new Date(
        epochSeconds *
        1000,
      ),
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

  return (
    `${values.hour}:${values.minute}`
  );
}

export default function CalendarReferencePreview() {
  const initialNow = useMemo(
    () => new Date(),
    [],
  );

  const sessionWorkspace =
    useMemo(
      () =>
        getCurrentWorkspace(),
      [],
    );

  const sessionUser =
    useMemo(
      () =>
        getCurrentUser(),
      [],
    );

  const {
    events:
      storedEvents,
    tasks:
      storedTasks,
    team:
      storedTeam,
    refresh:
      refreshCalendar,
    saveEvent:
      saveCalendarEvent,
    setTaskDeadline:
      setCalendarTaskDeadline,
    cancelEvent:
      cancelCalendarEvent,
  } =
    useCalendarCommandCenter({
      workspaceId:
        sessionWorkspace?.id ||
        "",
      userId:
        sessionUser?.id ||
        "",
    });

  const {
    links:
      eventTaskLinks,
    isSaving:
      eventTaskLinksSaving,
    linkTask:
      linkTaskToEvent,
    unlinkTask:
      unlinkTaskFromEvent,
  } =
    useEventTaskLinks({
      workspaceId:
        sessionWorkspace?.id ||
        "",
      userId:
        sessionUser?.id ||
        "",
    });

  const [now, setNow] =
    useState(initialNow);

  const [viewDate, setViewDate] =
    useState(initialNow);

  const [viewMode, setViewMode] =
    useState("week");

  const [
    events,
    setEvents,
  ] = useState([]);

  useEffect(() => {
    const normalizedEvents =
      (storedEvents || [])
        .map(
          normalizeStoredEvent,
        )
        .filter(Boolean);

    setEvents(
      normalizedEvents,
    );
  }, [
    storedEvents,
  ]);

  const [search, setSearch] =
    useState("");

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [activeTypes, setActiveTypes] =
    useState(() =>
      Object.keys(EVENT_TYPE_LABELS),
    );

  const [
    summaryFocus,
    setSummaryFocus,
  ] = useState("");

  const [
    schedulingTaskId,
    setSchedulingTaskId,
  ] = useState("");

  const [
    taskScheduleMessage,
    setTaskScheduleMessage,
  ] = useState("");

  const [
    deadlineEditor,
    setDeadlineEditor,
  ] = useState(null);

  const [
    taskLinkSelection,
    setTaskLinkSelection,
  ] = useState("");

  const [selectedEvent, setSelectedEvent] =
    useState(null);

  useEffect(() => {
    setTaskLinkSelection(
      "",
    );
  }, [
    selectedEvent,
  ]);

  const [newEventOpen, setNewEventOpen] =
    useState(false);

  const [syncing, setSyncing] =
    useState(false);

  const [
    calendarConnecting,
    setCalendarConnecting,
  ] = useState(false);

  const [
    calendarConnection,
    setCalendarConnection,
  ] = useState(null);

  const [
    calendarConnectionLoading,
    setCalendarConnectionLoading,
  ] = useState(true);

  useEffect(() => {
    if (syncing) {
      return undefined;
    }

    let active =
      true;

    const loadCalendarConnection =
      async () => {
        const workspaceId =
          sessionWorkspace?.id ||
          "";

        if (!workspaceId) {
          if (active) {
            setCalendarConnection(
              null,
            );

            setCalendarConnectionLoading(
              false,
            );
          }

          return;
        }

        setCalendarConnectionLoading(
          true,
        );

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "workspace_integrations",
            )
            .select(
              "id,status,display_email,settings,last_sync_at,last_success_at,connected_at",
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "provider",
              "nylas",
            )
            .eq(
              "integration_type",
              "calendar",
            )
            .eq(
              "status",
              "connected",
            )
            .order(
              "connected_at",
              {
                ascending:
                  false,
              },
            )
            .limit(
              1,
            )
            .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          console.error(
            "Calendar connection status load failed",
            error,
          );

          setCalendarConnection(
            null,
          );
        } else {
          setCalendarConnection(
            data ||
            null,
          );
        }

        setCalendarConnectionLoading(
          false,
        );
      };

    loadCalendarConnection();

    return () => {
      active =
        false;
    };
  }, [
    sessionWorkspace?.id,
    syncing,
  ]);

  const calendarConnected =
    calendarConnection?.status ===
    "connected";

  const calendarProvider =
    String(
      calendarConnection
        ?.settings
        ?.account_provider ||
      "",
    )
      .trim()
      .toLowerCase();

  const calendarProviderLabel =
    calendarProvider ===
      "google"
      ? "Google Calendar"
      : calendarProvider ===
          "microsoft"
        ? "Microsoft Calendar"
        : "Calendar";

  const calendarLastSyncLabel =
    calendarConnection
      ?.last_sync_at
      ? new Intl.DateTimeFormat(
          undefined,
          {
            dateStyle:
              "medium",
            timeStyle:
              "short",
          },
        ).format(
          new Date(
            calendarConnection
              .last_sync_at,
          ),
        )
      : "";

  const [eventForm, setEventForm] =
    useState({
      title: "",
      date: formatDateKey(initialNow),
      start: "10:00",
      end: "11:00",
      location: "Campaign HQ",
      type: "meeting",
    });

  const [
    editEventOpen,
    setEditEventOpen,
  ] = useState(false);

  const [
    editSaving,
    setEditSaving,
  ] = useState(false);

  const [
    eventCancelling,
    setEventCancelling,
  ] = useState(false);

  const [
    guestDraft,
    setGuestDraft,
  ] = useState("");

  const [
    guestNameDraft,
    setGuestNameDraft,
  ] = useState("");

  const [
    findingTime,
    setFindingTime,
  ] = useState(false);

  const [
    findTimeDays,
    setFindTimeDays,
  ] = useState(7);

  const [
    findTimeResult,
    setFindTimeResult,
  ] = useState(null);

  const [
    selectedFindTimeStart,
    setSelectedFindTimeStart,
  ] = useState(null);

  const [
    findTimeError,
    setFindTimeError,
  ] = useState("");

  const [
    editEventForm,
    setEditEventForm,
  ] = useState({
    title: "",
    date: formatDateKey(initialNow),
    start: "10:00",
    end: "11:00",
    location: "",
    type: "meeting",
    description: "",
    timezone:
      "America/New_York",
    allDay: false,
    recurrenceMode:
      "none",
    useDefaultReminders:
      false,

    reminderRows: [
      {
        minutes:
          "30",

        method:
          "popup",
      },
    ],

    participants: [],
    busy: true,
    visibility:
      "default",
    addConference:
      false,
    conferencing: {},
    hideParticipants:
      false,
    notifyParticipants:
      true,
    existingRecurrenceRules:
      [],
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

  const summaryWindow =
    useMemo(
      () => {
        if (!summaryFocus) {
          return null;
        }

        const start =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );

        const end =
          addDays(
            start,
            summaryFocus ===
              "today"
              ? 1
              : 7,
          );

        return {
          start,
          end,

          eventType:
            summaryFocus ===
            "deadlines"
              ? "deadline"
              : summaryFocus ===
                  "meetings"
                ? "meeting"
                : "",
        };
      },
      [
        now,
        summaryFocus,
      ],
    );

  const focusedTasks =
    useMemo(
      () => {
        if (!summaryFocus) {
          return (
            storedTasks ||
            []
          );
        }

        if (
          summaryFocus ===
          "meetings"
        ) {
          return [];
        }

        if (!summaryWindow) {
          return (
            storedTasks ||
            []
          );
        }

        return (
          storedTasks ||
          []
        )
          .filter(
            taskIsActive,
          )
          .filter(
            (task) => {
              const due =
                taskDueDate(
                  task,
                );

              return (
                due &&
                due >=
                  summaryWindow
                    .start &&
                due <
                  summaryWindow
                    .end
              );
            },
          );
      },
      [
        storedTasks,
        summaryFocus,
        summaryWindow,
      ],
    );

  const visibleEvents = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return events
      .filter((event) =>
        activeTypes.includes(event.type),
      )
      .filter((event) => {
        if (!summaryWindow) {
          return true;
        }

        if (
          event.start <
            summaryWindow.start ||
          event.start >=
            summaryWindow.end
        ) {
          return false;
        }

        if (
          summaryWindow.eventType &&
          event.type !==
            summaryWindow.eventType
        ) {
          return false;
        }

        return true;
      })
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
  }, [
    events,
    search,
    activeTypes,
    summaryWindow,
  ]);

  const summary = useMemo(() => {
    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

    const tomorrowStart =
      addDays(
        todayStart,
        1,
      );

    const nextSevenEnd =
      addDays(
        todayStart,
        7,
      );

    const activeTasks =
      (storedTasks || [])
        .filter(
          (task) =>
            ![
              "completed",
              "done",
              "cancelled",
              "archived",
            ].includes(
              String(
                task?.status || "",
              )
                .trim()
                .toLowerCase(),
            ),
        );

    const taskDate =
      (task) => {
        const value =
          task?.due_at
            ? new Date(
                task.due_at,
              )
            : null;

        return (
          value &&
          !Number.isNaN(
            value.getTime(),
          )
            ? value
            : null
        );
      };

    const todayEvents =
      events.filter(
        (event) =>
          event.start >=
            todayStart &&
          event.start <
            tomorrowStart,
      );

    const todayTasks =
      activeTasks.filter(
        (task) => {
          const due =
            taskDate(task);

          return (
            due &&
            due >=
              todayStart &&
            due <
              tomorrowStart
          );
        },
      );

    const nextSevenEvents =
      events.filter(
        (event) =>
          event.start >=
            todayStart &&
          event.start <
            nextSevenEnd,
      );

    const nextSevenTasks =
      activeTasks.filter(
        (task) => {
          const due =
            taskDate(task);

          return (
            due &&
            due >=
              todayStart &&
            due <
              nextSevenEnd
          );
        },
      );

    const eventDeadlines =
      nextSevenEvents.filter(
        (event) =>
          event.type ===
          "deadline",
      );

    const meetings =
      nextSevenEvents.filter(
        (event) =>
          event.type ===
          "meeting",
      );

    return {
      today:
        todayEvents.length +
        todayTasks.length,

      nextSeven:
        nextSevenEvents.length +
        nextSevenTasks.length,

      deadlines:
        eventDeadlines.length +
        nextSevenTasks.length,

      meetings:
        meetings.length,
    };
  }, [
    events,
    now,
    storedTasks,
  ]);

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

  const activeTaskDeadlines =
    useMemo(
      () =>
        (storedTasks || [])
          .filter(
            taskIsActive,
          )
          .map(
            (task) => ({
              ...task,
              dueDate:
                taskDueDate(
                  task,
                ),
            }),
          )
          .filter(
            (task) =>
              task.dueDate,
          )
          .sort(
            (left, right) =>
              left.dueDate -
                right.dueDate ||
              taskPriorityScore(
                right,
              ) -
                taskPriorityScore(
                  left,
                ),
          ),
      [storedTasks],
    );

  const unscheduledTasks =
    useMemo(
      () =>
        (
          storedTasks ||
          []
        )
          .filter(
            taskIsActive,
          )
          .filter(
            (task) =>
              !taskDueDate(
                task,
              ),
          )
          .sort(
            (
              left,
              right,
            ) => {
              const userId =
                sessionUser
                  ?.id ||
                "";

              const leftMine =
                left
                  .assigned_to ===
                userId
                  ? 0
                  : 1;

              const rightMine =
                right
                  .assigned_to ===
                userId
                  ? 0
                  : 1;

              if (
                leftMine !==
                rightMine
              ) {
                return (
                  leftMine -
                  rightMine
                );
              }

              const priorityDifference =
                taskPriorityScore(
                  right,
                ) -
                taskPriorityScore(
                  left,
                );

              if (
                priorityDifference
              ) {
                return (
                  priorityDifference
                );
              }

              return String(
                left.title ||
                "",
              ).localeCompare(
                String(
                  right.title ||
                  "",
                ),
              );
            },
          ),
      [
        storedTasks,
        sessionUser?.id,
      ],
    );

  const myCalendarTasks =
    useMemo(
      () => {
        const userId =
          sessionUser?.id ||
          "";

        if (!userId) {
          return [];
        }

        return activeTaskDeadlines
          .filter(
            (task) =>
              task.assigned_to ===
              userId,
          )
          .slice(
            0,
            5,
          );
      },
      [
        activeTaskDeadlines,
        sessionUser?.id,
      ],
    );

  const criticalDeadlines =
    useMemo(
      () => {
        const todayStart =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );

        const horizon =
          addDays(
            todayStart,
            14,
          );

        const taskItems =
          activeTaskDeadlines
            .filter(
              (task) =>
                task.dueDate <
                horizon,
            )
            .map(
              (task) => ({
                id:
                  `task-${task.id}`,
                title:
                  task.title ||
                  "Campaign task",
                due:
                  task.dueDate,
                kind:
                  "Task",
                urgent:
                  task.dueDate <
                    todayStart ||
                  taskPriorityScore(
                    task,
                  ) >= 3,
                task,
              }),
            );

        const eventItems =
          events
            .filter(
              (event) =>
                event.type ===
                  "deadline" &&
                event.start >=
                  todayStart &&
                event.start <
                  horizon,
            )
            .map(
              (event) => ({
                id:
                  `event-${event.id}`,
                title:
                  event.title,
                due:
                  event.start,
                kind:
                  "Calendar",
                urgent:
                  false,
                event,
              }),
            );

        return [
          ...taskItems,
          ...eventItems,
        ]
          .sort(
            (left, right) =>
              left.due -
              right.due,
          )
          .slice(
            0,
            5,
          );
      },
      [
        activeTaskDeadlines,
        events,
        now,
      ],
    );

  const scheduleConflicts =
    useMemo(
      () => {
        const todayStart =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );

        const timedEvents =
          events
            .filter(
              (event) =>
                !event.allDay &&
                event.end >
                  event.start &&
                event.end >=
                  todayStart,
            )
            .sort(
              (left, right) =>
                left.start -
                right.start,
            );

        const groups =
          [];

        let currentGroup =
          null;

        const getFirstConflictAt =
          (groupEvents) => {
            let firstConflictAt =
              null;

            for (
              let leftIndex = 0;
              leftIndex <
              groupEvents.length;
              leftIndex += 1
            ) {
              const left =
                groupEvents[
                  leftIndex
                ];

              for (
                let rightIndex =
                  leftIndex + 1;
                rightIndex <
                groupEvents.length;
                rightIndex += 1
              ) {
                const right =
                  groupEvents[
                    rightIndex
                  ];

                if (
                  !sameDay(
                    left.start,
                    right.start,
                  )
                ) {
                  continue;
                }

                if (
                  right.start <
                    left.end &&
                  right.end >
                    left.start
                ) {
                  const overlapStart =
                    right.start >
                    left.start
                      ? right.start
                      : left.start;

                  if (
                    !firstConflictAt ||
                    overlapStart <
                      firstConflictAt
                  ) {
                    firstConflictAt =
                      overlapStart;
                  }
                }
              }
            }

            return (
              firstConflictAt
            );
          };

        const finishGroup =
          () => {
            if (
              currentGroup &&
              currentGroup
                .events
                .length >
                1
            ) {
              const firstConflictAt =
                getFirstConflictAt(
                  currentGroup
                    .events,
                );

              groups.push(
                {
                  ...currentGroup,

                  firstConflictAt:
                    firstConflictAt ||
                    currentGroup
                      .startsAt,

                  id:
                    currentGroup
                      .events
                      .map(
                        (event) =>
                          event.id,
                      )
                      .join("-"),
                },
              );
            }

            currentGroup =
              null;
          };

        for (
          const event of
          timedEvents
        ) {
          if (
            !currentGroup
          ) {
            currentGroup = {
              date:
                event.start,

              startsAt:
                event.start,

              endsAt:
                event.end,

              events: [
                event,
              ],
            };

            continue;
          }

          const sameDate =
            sameDay(
              currentGroup
                .date,
              event.start,
            );

          const overlapsGroup =
            sameDate &&
            event.start <
              currentGroup
                .endsAt;

          if (
            overlapsGroup
          ) {
            currentGroup
              .events
              .push(
                event,
              );

            if (
              event.end >
              currentGroup
                .endsAt
            ) {
              currentGroup
                .endsAt =
                event.end;
            }

            continue;
          }

          finishGroup();

          currentGroup = {
            date:
              event.start,

            startsAt:
              event.start,

            endsAt:
              event.end,

            events: [
              event,
            ],
          };
        }

        finishGroup();

        return groups.slice(
          0,
          6,
        );
      },
      [
        events,
        now,
      ],
    );

  const openTaskDeadlineEditor =
    (task) => {
      const due =
        taskDueDate(
          task,
        );

      if (
        !task?.id ||
        !due
      ) {
        return;
      }

      setTaskScheduleMessage(
        "",
      );

      setDeadlineEditor({
        taskId:
          task.id,

        title:
          task.title ||
          "Campaign task",

        date:
          formatDateKey(
            due,
          ),

        time:
          formatTimeInputValue(
            due,
          ),

        originalDueAt:
          task.due_at ||
          due.toISOString(),

        moved:
          false,
      });
    };

  const saveExactTaskDeadline =
    async () => {
      if (
        !deadlineEditor ||
        !setCalendarTaskDeadline
      ) {
        return;
      }

      const [
        year,
        month,
        day,
      ] =
        String(
          deadlineEditor
            .date ||
          "",
        )
          .split("-")
          .map(Number);

      const [
        hour,
        minute,
      ] =
        String(
          deadlineEditor
            .time ||
          "",
        )
          .split(":")
          .map(Number);

      if (
        !year ||
        !month ||
        !day ||
        !Number.isFinite(
          hour,
        ) ||
        !Number.isFinite(
          minute,
        )
      ) {
        window.alert(
          "Choose a valid deadline date and time.",
        );

        return;
      }

      const exactDue =
        new Date(
          year,
          month - 1,
          day,
          hour,
          minute,
          0,
          0,
        );

      if (
        Number.isNaN(
          exactDue.getTime(),
        )
      ) {
        window.alert(
          "Choose a valid deadline date and time.",
        );

        return;
      }

      setSchedulingTaskId(
        deadlineEditor
          .taskId,
      );

      try {
        await setCalendarTaskDeadline(
          deadlineEditor
            .taskId,
          exactDue
            .toISOString(),
        );

        setTaskScheduleMessage(
          `${deadlineEditor.title} deadline confirmed for ${new Intl.DateTimeFormat(
            "en-US",
            {
              weekday:
                "short",
              month:
                "short",
              day:
                "numeric",
              hour:
                "numeric",
              minute:
                "2-digit",
            },
          ).format(
            exactDue,
          )}.`,
        );

        setDeadlineEditor(
          null,
        );
      } catch (
        exactTimeError
      ) {
        console.error(
          "Exact task deadline could not be saved:",
          exactTimeError,
        );

        window.alert(
          "Campaign Seat could not save that exact deadline time.",
        );
      } finally {
        setSchedulingTaskId(
          "",
        );
      }
    };

  const undoTaskDeadlineMove =
    async () => {
      if (
        !deadlineEditor?.moved ||
        !setCalendarTaskDeadline
      ) {
        return;
      }

      setSchedulingTaskId(
        deadlineEditor
          .taskId,
      );

      try {
        await setCalendarTaskDeadline(
          deadlineEditor
            .taskId,
          deadlineEditor
            .originalDueAt ||
          null,
        );

        setTaskScheduleMessage(
          deadlineEditor
            .originalDueAt
            ? `${deadlineEditor.title} restored to its previous deadline.`
            : `${deadlineEditor.title} moved back to Unscheduled work.`,
        );

        setDeadlineEditor(
          null,
        );
      } catch (
        undoError
      ) {
        console.error(
          "Task deadline move could not be undone:",
          undoError,
        );

        window.alert(
          "Campaign Seat could not undo that deadline move.",
        );
      } finally {
        setSchedulingTaskId(
          "",
        );
      }
    };

  const handleTaskDeadlineDrop =
    async (
      taskId,
      day,
      minuteOfDay,
    ) => {
      const task =
        (
          storedTasks ||
          []
        ).find(
          (candidate) =>
            candidate.id ===
            taskId,
        );

      if (
        !task ||
        !setCalendarTaskDeadline
      ) {
        return;
      }

      const originalDueAt =
        task.due_at ||
        null;

      const dueDate =
        new Date(
          day,
        );

      dueDate.setHours(
        Math.floor(
          minuteOfDay /
          60,
        ),
        minuteOfDay %
          60,
        0,
        0,
      );

      setSchedulingTaskId(
        taskId,
      );

      setTaskScheduleMessage(
        "",
      );

      try {
        await setCalendarTaskDeadline(
          taskId,
          dueDate
            .toISOString(),
        );

        setDeadlineEditor({
          taskId,

          title:
            task.title ||
            "Campaign task",

          date:
            formatDateKey(
              dueDate,
            ),

          time:
            formatTimeInputValue(
              dueDate,
            ),

          originalDueAt,

          moved:
            true,
        });
      } catch (
        scheduleError
      ) {
        console.error(
          "Calendar drag-to-deadline failed:",
          scheduleError,
        );

        setTaskScheduleMessage(
          "The task deadline could not be updated.",
        );
      } finally {
        setSchedulingTaskId(
          "",
        );
      }
    };

  const clearSummaryFocus =
    () => {
      setSummaryFocus("");

      setActiveTypes(
        Object.keys(
          EVENT_TYPE_LABELS,
        ),
      );
    };

  const applySummaryFocus =
    (focus) => {
      if (
        summaryFocus ===
        focus
      ) {
        clearSummaryFocus();

        return;
      }

      setSummaryFocus(
        focus,
      );

      setFiltersOpen(
        false,
      );

      setViewDate(
        new Date(),
      );

      if (
        focus ===
        "meetings"
      ) {
        setActiveTypes([
          "meeting",
        ]);

        setViewMode(
          "week",
        );

        return;
      }

      if (
        focus ===
        "deadlines"
      ) {
        setActiveTypes([
          "deadline",
        ]);
      } else {
        setActiveTypes(
          Object.keys(
            EVENT_TYPE_LABELS,
          ),
        );
      }

      setViewMode(
        "agenda",
      );
    };

  const toggleType = (type) => {
    setSummaryFocus("");

    setActiveTypes((current) =>
      current.includes(type)
        ? current.filter(
            (value) => value !== type,
          )
        : [...current, type],
    );
  };

  const moveCalendar = (direction) => {
    clearSummaryFocus();

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

  const handleConnectCalendar =
    async () => {
      const workspaceId =
        sessionWorkspace?.id ||
        "";

      if (!workspaceId) {
        window.alert(
          "Campaign Seat could not resolve the current campaign workspace.",
        );

        return;
      }

      setCalendarConnecting(
        true,
      );

      try {
        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "nylas-calendar-oauth-start",
              {
                body: {
                  workspaceId,
                },
              },
            );

        if (
          error ||
          !data
            ?.authorizationUrl
        ) {
          throw new Error(
            data?.error ||
            error?.message ||
            "Campaign Seat could not start the Calendar connection.",
          );
        }

        window.location.assign(
          data.authorizationUrl,
        );
      } catch (
        connectionError
      ) {
        console.error(
          "Calendar connection start failed",
          connectionError,
        );

        window.alert(
          connectionError
            ?.message ||
          "Campaign Seat could not start the Calendar connection.",
        );

        setCalendarConnecting(
          false,
        );
      }
    };

  const handleSync =
    async () => {
      const workspaceId =
        sessionWorkspace?.id ||
        "";

      if (!workspaceId) {
        window.alert(
          "Campaign Seat could not resolve the current campaign workspace.",
        );

        return;
      }

      setSyncing(true);

      try {
        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "nylas-calendar-sync",
              {
                body: {
                  workspaceId,
                },
              },
            );

        if (
          error ||
          data?.success !== true
        ) {
          throw new Error(
            data?.error ||
            error?.message ||
            "Campaign Seat could not sync the connected Calendar.",
          );
        }

        await refreshCalendar();

        window.alert(
          `Google Calendar sync complete. ${data.importedCount ?? 0} event${data.importedCount === 1 ? "" : "s"} synced${data.skippedCount ? ` · ${data.skippedCount} skipped` : ""}.`,
        );
      } catch (
        syncError
      ) {
        console.error(
          "Calendar provider sync failed",
          syncError,
        );

        window.alert(
          syncError?.message ||
          "Campaign Seat could not sync the connected Calendar.",
        );
      } finally {
        setSyncing(false);
      }
    };

  const saveEvent =
    async (
      submitEvent,
    ) => {
      submitEvent.preventDefault();

      const form =
        submitEvent.currentTarget;

      const formData =
        new FormData(form);

      const submittedTitle =
        String(
          formData.get("title") ||
            "",
        ).trim();

      const submittedDate =
        String(
          formData.get("date") ||
            "",
        );

      const submittedType =
        String(
          formData.get("type") ||
            "meeting",
        );

      const submittedStart =
        String(
          formData.get("start") ||
            "10:00",
        );

      const submittedEnd =
        String(
          formData.get("end") ||
            "11:00",
        );

      const submittedLocation =
        String(
          formData.get("location") ||
            "",
        ).trim();

      const [
        year,
        month,
        day,
      ] =
        submittedDate
          .split("-")
          .map(Number);

      const [
        startHour,
        startMinute,
      ] =
        submittedStart
          .split(":")
          .map(Number);

      const [
        endHour,
        endMinute,
      ] =
        submittedEnd
          .split(":")
          .map(Number);

      const dateParts = [
        year,
        month,
        day,
        startHour,
        startMinute,
        endHour,
        endMinute,
      ];

      if (
        dateParts.some(
          (value) =>
            !Number.isFinite(value),
        )
      ) {
        return;
      }

      const start =
        new Date(
          year,
          month - 1,
          day,
          startHour,
          startMinute,
          0,
          0,
        );

      const requestedEnd =
        new Date(
          year,
          month - 1,
          day,
          endHour,
          endMinute,
          0,
          0,
        );

      const end =
        requestedEnd > start
          ? requestedEnd
          : addMinutes(
              start,
              60,
            );

      try {
        const savedEvent =
          await saveCalendarEvent({
            values: {
              title:
                submittedTitle ||
                "New campaign event",
              description: "",
              eventType:
                submittedType,
              location:
                submittedLocation ||
                "Location pending",
              startsAt:
                start.toISOString(),
              endsAt:
                end.toISOString(),
              status:
                "scheduled",
              capacity: "",
              rsvpCount:
                "0",
            },
          });

        let finalSavedEvent =
          savedEvent;

        let providerWriteWarning =
          "";

        if (
          calendarConnected &&
          savedEvent?.id
        ) {
          const workspaceId =
            sessionWorkspace?.id ||
            "";

          try {
            const {
              data:
                providerData,
              error:
                providerError,
            } =
              await supabase
                .functions
                .invoke(
                  "nylas-calendar-event-create",
                  {
                    body: {
                      workspaceId,
                      eventId:
                        savedEvent.id,
                    },
                  },
                );

            if (
              providerError ||
              providerData
                ?.success !== true
            ) {
              throw new Error(
                providerData
                  ?.error ||
                providerError
                  ?.message ||
                "The event was saved in Campaign Seat, but could not be added to Google Calendar.",
              );
            }

            if (
              providerData?.event
            ) {
              finalSavedEvent =
                providerData.event;
            }

            await refreshCalendar();
          } catch (
            providerWriteError
          ) {
            console.error(
              "Calendar provider event creation failed",
              providerWriteError,
            );

            providerWriteWarning =
              providerWriteError
                ?.message ||
              "The event was saved in Campaign Seat, but could not be added to Google Calendar.";
          }
        }

        const normalizedEvent =
          normalizeStoredEvent(
            finalSavedEvent,
          );

        if (normalizedEvent) {
          setSelectedEvent(
            normalizedEvent,
          );
        }

        setNewEventOpen(
          false,
        );

        if (
          providerWriteWarning
        ) {
          window.alert(
            providerWriteWarning,
          );
        }

        setEventForm({
          title: "",
          date:
            submittedDate,
          start:
            "10:00",
          end:
            "11:00",
          location:
            "Campaign HQ",
          type:
            "meeting",
        });
      } catch {
        // The calendar hook exposes
        // the protected save error.
      }
    };

  const openEditSelectedEvent =
    () => {
      if (!selectedEvent) {
        return;
      }

      const participants =
        Array.isArray(
          selectedEvent.participants,
        )
          ? selectedEvent
              .participants
              .map(
                (participant) => ({
                  ...participant,
                }),
              )
          : [];

      const conferencing =
        selectedEvent
          .conferencing &&
        typeof selectedEvent
          .conferencing ===
          "object"
          ? selectedEvent
              .conferencing
          : {};

      const reminderEditor =
        reminderEditorStateFromObject(
          selectedEvent.reminders,
        );

      setEditEventForm({
        title:
          selectedEvent.title ||
          "",

        date:
          formatDateKey(
            selectedEvent.start,
          ),

        start:
          formatTimeInputValue(
            selectedEvent.start,
          ),

        end:
          formatTimeInputValue(
            selectedEvent.end,
          ),

        location:
          selectedEvent.location ||
          "",

        type:
          selectedEvent.type ||
          "meeting",

        description:
          selectedEvent.description ||
          "",

        timezone:
          selectedEvent
            .eventTimezone ||
          "America/New_York",

        allDay:
          selectedEvent.allDay ===
          true,

        recurrenceMode:
          recurrenceModeFromRules(
            selectedEvent
              .recurrenceRules,
          ),

        useDefaultReminders:
          reminderEditor
            .useDefaultReminders,

        reminderRows:
          reminderEditor
            .reminderRows,

        participants,

        busy:
          selectedEvent.busy !==
          false,

        visibility:
          selectedEvent.visibility ||
          "default",

        addConference:
          Boolean(
            conferencing.provider ||
            conferencing.details ||
            conferencing.autocreate,
          ),

        conferencing,

        hideParticipants:
          selectedEvent
            .hideParticipants ===
          true,

        notifyParticipants:
          selectedEvent
            .notifyParticipants !==
          false,

        existingRecurrenceRules:
          Array.isArray(
            selectedEvent
              .recurrenceRules,
          )
            ? selectedEvent
                .recurrenceRules
            : [],
      });

      setGuestDraft("");
      setGuestNameDraft("");

      setFindTimeResult(
        null,
      );

      setSelectedFindTimeStart(
        null,
      );

      setFindTimeError(
        "",
      );

      setFindingTime(
        false,
      );

      setEditEventOpen(true);
    };

  const handleFindTime =
    async () => {
      const workspaceId =
        sessionWorkspace?.id ||
        "";

      if (!workspaceId) {
        setFindTimeError(
          "Campaign Seat could not resolve the current campaign workspace.",
        );

        return;
      }

      if (
        editEventForm.allDay
      ) {
        setFindTimeError(
          "Find a Time is available for timed events. Turn off All day first.",
        );

        return;
      }

      const [
        startHour,
        startMinute,
      ] =
        String(
          editEventForm.start ||
          "10:00",
        )
          .split(":")
          .map(Number);

      const [
        endHour,
        endMinute,
      ] =
        String(
          editEventForm.end ||
          "11:00",
        )
          .split(":")
          .map(Number);

      let durationMinutes =
        (
          endHour * 60 +
          endMinute
        ) -
        (
          startHour * 60 +
          startMinute
        );

      if (
        !Number.isFinite(
          durationMinutes,
        ) ||
        durationMinutes <= 0
      ) {
        durationMinutes =
          60;
      }

      if (
        durationMinutes >
        240
      ) {
        setFindTimeError(
          "Find a Time currently supports meetings up to four hours long.",
        );

        return;
      }

      const timezone =
        editEventForm
          .timezone ||
        "America/New_York";

      const searchStartTime =
        zonedDateTimeToEpochSeconds(
          editEventForm.date,
          "00:00",
          timezone,
        );

      const searchEndDate =
        addDaysToDateKey(
          editEventForm.date,
          Number(
            findTimeDays,
          ),
        );

      const searchEndTime =
        zonedDateTimeToEpochSeconds(
          searchEndDate,
          "00:00",
          timezone,
        );

      if (
        !searchStartTime ||
        !searchEndTime
      ) {
        setFindTimeError(
          "Campaign Seat could not resolve the availability search dates.",
        );

        return;
      }

      const guestEmails =
        editEventForm
          .participants
          .map(
            (participant) =>
              String(
                participant
                  ?.email ||
                "",
              )
                .trim()
                .toLowerCase(),
          )
          .filter(Boolean);

      setFindingTime(
        true,
      );

      setFindTimeError(
        "",
      );

      setFindTimeResult(
        null,
      );

      setSelectedFindTimeStart(
        null,
      );

      try {
        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "nylas-calendar-find-time",
              {
                body: {
                  workspaceId,

                  guestEmails,

                  searchStartTime,

                  searchEndTime,

                  durationMinutes,

                  intervalMinutes:
                    15,

                  dayStartMinutes:
                    8 * 60,

                  dayEndMinutes:
                    20 * 60,

                  timezone,
                },
              },
            );

        let detailedError =
          data?.error ||
          "";

        if (
          error?.context &&
          typeof error
            .context
            .clone ===
            "function"
        ) {
          try {
            const errorBody =
              await error
                .context
                .clone()
                .json();

            if (
              errorBody
                ?.error
            ) {
              detailedError =
                errorBody.error;
            }
          } catch {
            // Keep the Supabase error message.
          }
        }

        if (
          error ||
          data?.success !==
            true
        ) {
          throw new Error(
            detailedError ||
            error?.message ||
            "Campaign Seat could not check Calendar availability.",
          );
        }

        setFindTimeResult(
          data,
        );
      } catch (
        availabilityError
      ) {
        console.error(
          "Calendar Find a Time failed",
          availabilityError,
        );

        setFindTimeError(
          availabilityError
            ?.message ||
          "Campaign Seat could not check Calendar availability.",
        );
      } finally {
        setFindingTime(
          false,
        );
      }
    };

  const applyFindTimeSuggestion =
    (suggestion) => {
      const timezone =
        editEventForm
          .timezone ||
        "America/New_York";

      const startTime =
        Number(
          suggestion
            ?.start_time,
        );

      const endTime =
        Number(
          suggestion
            ?.end_time,
        );

      if (
        !Number.isFinite(
          startTime,
        ) ||
        !Number.isFinite(
          endTime,
        )
      ) {
        return;
      }

      setSelectedFindTimeStart(
        startTime,
      );

      setEditEventForm(
        (current) => ({
          ...current,

          allDay:
            false,

          date:
            dateKeyFromEpochInZone(
              startTime,
              timezone,
            ),

          start:
            timeInputFromEpochInZone(
              startTime,
              timezone,
            ),

          end:
            timeInputFromEpochInZone(
              endTime,
              timezone,
            ),
        }),
      );

      setFindTimeError(
        "",
      );
    };

  const addEditGuest =
    () => {
      const email =
        String(
          guestDraft ||
          "",
        )
          .trim()
          .toLowerCase();

      const name =
        String(
          guestNameDraft ||
          "",
        ).trim();

      if (
        !email ||
        !email.includes("@")
      ) {
        return;
      }

      setEditEventForm(
        (current) => {
          const exists =
            current
              .participants
              .some(
                (participant) =>
                  String(
                    participant
                      ?.email ||
                    "",
                  )
                    .trim()
                    .toLowerCase() ===
                  email,
              );

          if (exists) {
            return current;
          }

          return {
            ...current,

            participants: [
              ...current.participants,
              {
                email,

                ...(name
                  ? {
                      name,
                    }
                  : {}),
              },
            ],
          };
        },
      );

      setGuestDraft("");
      setGuestNameDraft("");
    };

  const addReminderRow =
    () => {
      setEditEventForm(
        (current) => {
          if (
            current
              .reminderRows
              .length >= 5
          ) {
            return current;
          }

          return {
            ...current,

            useDefaultReminders:
              false,

            reminderRows: [
              ...current.reminderRows,
              {
                minutes:
                  "30",

                method:
                  "popup",
              },
            ],
          };
        },
      );
    };

  const updateReminderRow =
    (
      index,
      changes,
    ) => {
      setEditEventForm(
        (current) => ({
          ...current,

          reminderRows:
            current
              .reminderRows
              .map(
                (
                  reminder,
                  reminderIndex,
                ) =>
                  reminderIndex ===
                  index
                    ? {
                        ...reminder,
                        ...changes,
                      }
                    : reminder,
              ),
        }),
      );
    };

  const removeReminderRow =
    (index) => {
      setEditEventForm(
        (current) => ({
          ...current,

          reminderRows:
            current
              .reminderRows
              .filter(
                (
                  _reminder,
                  reminderIndex,
                ) =>
                  reminderIndex !==
                  index,
              ),
        }),
      );
    };

  const removeEditGuest =
    (email) => {
      setEditEventForm(
        (current) => ({
          ...current,

          participants:
            current
              .participants
              .filter(
                (participant) =>
                  String(
                    participant
                      ?.email ||
                    "",
                  )
                    .trim()
                    .toLowerCase() !==
                  String(
                    email ||
                    "",
                  )
                    .trim()
                    .toLowerCase(),
              ),
        }),
      );
    };

  const saveEditedEvent =
    async (
      submitEvent,
    ) => {
      submitEvent.preventDefault();

      if (
        !selectedEvent?.id
      ) {
        return;
      }

      const workspaceId =
        sessionWorkspace?.id ||
        "";

      if (!workspaceId) {
        window.alert(
          "Campaign Seat could not resolve the current campaign workspace.",
        );

        return;
      }

      const [
        year,
        month,
        day,
      ] =
        editEventForm
          .date
          .split("-")
          .map(Number);

      if (
        !year ||
        !month ||
        !day
      ) {
        return;
      }

      let start;
      let end;

      if (
        editEventForm.allDay
      ) {
        start =
          new Date(
            Date.UTC(
              year,
              month - 1,
              day,
              12,
              0,
              0,
            ),
          );

        end =
          new Date(
            start.getTime() +
            24 * 60 * 60 * 1000,
          );
      } else {
        const [
          startHour,
          startMinute,
        ] =
          editEventForm
            .start
            .split(":")
            .map(Number);

        const [
          endHour,
          endMinute,
        ] =
          editEventForm
            .end
            .split(":")
            .map(Number);

        start =
          new Date(
            year,
            month - 1,
            day,
            startHour,
            startMinute,
            0,
            0,
          );

        end =
          new Date(
            year,
            month - 1,
            day,
            endHour,
            endMinute,
            0,
            0,
          );

        if (
          end <= start
        ) {
          end =
            addMinutes(
              start,
              60,
            );
        }
      }

      const recurrenceRules =
        recurrenceRulesFromMode(
          editEventForm
            .recurrenceMode,
          editEventForm
            .existingRecurrenceRules,
        );

      const reminders =
        remindersFromEditor(
          editEventForm
            .useDefaultReminders,

          editEventForm
            .reminderRows,
        );

      let conferencing =
        {};

      if (
        editEventForm
          .addConference
      ) {
        const existing =
          editEventForm
            .conferencing &&
          typeof editEventForm
            .conferencing ===
            "object"
            ? editEventForm
                .conferencing
            : {};

        if (
          existing.details ||
          existing.autocreate
        ) {
          conferencing =
            existing;
        } else {
          conferencing = {
            provider:
              calendarProvider ===
              "microsoft"
                ? "Microsoft Teams"
                : "Google Meet",

            autocreate:
              {},
          };
        }
      }

      setEditSaving(true);

      try {
        const localSavedEvent =
          await saveCalendarEvent({
            eventId:
              selectedEvent.id,

            values: {
              title:
                editEventForm
                  .title
                  .trim() ||
                "Campaign event",

              description:
                editEventForm
                  .description ||
                "",

              eventType:
                editEventForm.type,

              location:
                editEventForm
                  .location
                  .trim(),

              startsAt:
                start.toISOString(),

              endsAt:
                end.toISOString(),

              status:
                selectedEvent.status ||
                "scheduled",

              eventTimezone:
                editEventForm
                  .timezone,

              participants:
                editEventForm
                  .participants,

              recurrenceRules,

              reminders,

              busy:
                editEventForm.busy,

              visibility:
                editEventForm
                  .visibility,

              conferencing,

              hideParticipants:
                editEventForm
                  .hideParticipants,

              notifyParticipants:
                editEventForm
                  .notifyParticipants,

              isAllDay:
                editEventForm
                  .allDay,
            },
          });

        let finalEvent =
          localSavedEvent;

        let providerWarning =
          "";

        if (
          calendarConnected &&
          localSavedEvent
            ?.source_provider ===
            "nylas" &&
          localSavedEvent
            ?.external_event_id &&
          localSavedEvent
            ?.external_calendar_id
        ) {
          try {
            const {
              data:
                providerData,
              error:
                providerError,
            } =
              await supabase
                .functions
                .invoke(
                  "nylas-calendar-event-update",
                  {
                    body: {
                      workspaceId,

                      eventId:
                        localSavedEvent.id,
                    },
                  },
                );

            if (
              providerError ||
              providerData
                ?.success !== true
            ) {
              throw new Error(
                providerData
                  ?.error ||
                providerError
                  ?.message ||
                "Campaign Seat saved the event, but the connected Calendar could not be updated.",
              );
            }

            if (
              providerData?.event
            ) {
              finalEvent =
                providerData.event;
            }

            await refreshCalendar();
          } catch (
            providerUpdateError
          ) {
            console.error(
              "Calendar provider event update failed",
              providerUpdateError,
            );

            providerWarning =
              providerUpdateError
                ?.message ||
              "Campaign Seat saved the event, but the connected Calendar could not be updated.";
          }
        }

        const normalized =
          normalizeStoredEvent(
            finalEvent,
          );

        if (normalized) {
          setSelectedEvent(
            normalized,
          );
        }

        setEditEventOpen(
          false,
        );

        if (providerWarning) {
          window.alert(
            providerWarning,
          );
        }
      } catch (
        editError
      ) {
        console.error(
          "Campaign Seat event edit failed",
          editError,
        );

        window.alert(
          editError?.message ||
          "The event could not be updated.",
        );
      } finally {
        setEditSaving(false);
      }
    };

  const handleCancelSelectedEvent =
    async () => {
      if (
        !selectedEvent?.id ||
        eventCancelling
      ) {
        return;
      }

      const workspaceId =
        sessionWorkspace?.id ||
        "";

      const providerLinked =
        selectedEvent
          .sourceProvider ===
          "nylas" &&
        Boolean(
          selectedEvent
            .externalEventId,
        ) &&
        Boolean(
          selectedEvent
            .externalCalendarId,
        );

      const confirmed =
        window.confirm(
          providerLinked
            ? `Cancel this event in Campaign Seat and delete it from ${calendarProviderLabel}? This cannot be undone.`
            : "Cancel this event in Campaign Seat? This cannot be undone.",
        );

      if (!confirmed) {
        return;
      }

      setEventCancelling(
        true,
      );

      try {
        if (providerLinked) {
          if (!workspaceId) {
            throw new Error(
              "Campaign Seat could not resolve the current campaign workspace.",
            );
          }

          const {
            data,
            error,
          } =
            await supabase
              .functions
              .invoke(
                "nylas-calendar-event-cancel",
                {
                  body: {
                    workspaceId,

                    eventId:
                      selectedEvent.id,
                  },
                },
              );

          if (
            error ||
            data?.success !== true
          ) {
            throw new Error(
              data?.error ||
              error?.message ||
              "Campaign Seat could not cancel the connected Calendar event.",
            );
          }

          await refreshCalendar();
        } else {
          await cancelCalendarEvent(
            selectedEvent.id,
          );
        }

        setEditEventOpen(
          false,
        );

        setSelectedEvent(
          null,
        );
      } catch (
        cancelError
      ) {
        console.error(
          "Calendar event cancellation failed",
          cancelError,
        );

        window.alert(
          cancelError?.message ||
          "The event could not be cancelled.",
        );
      } finally {
        setEventCancelling(
          false,
        );
      }
    };

  const selectedEventTaskLinks =
    useMemo(
      () => {
        if (
          !selectedEvent?.id
        ) {
          return [];
        }

        return (
          eventTaskLinks ||
          []
        ).filter(
          (link) =>
            link.event_id ===
            selectedEvent.id,
        );
      },
      [
        eventTaskLinks,
        selectedEvent,
      ],
    );

  const selectedEventLinkedTasks =
    useMemo(
      () =>
        selectedEventTaskLinks
          .map(
            (link) => {
              const task =
                (
                  storedTasks ||
                  []
                ).find(
                  (candidate) =>
                    candidate.id ===
                    link.task_id,
                );

              return task
                ? {
                    link,
                    task,
                  }
                : null;
            },
          )
          .filter(Boolean),
      [
        selectedEventTaskLinks,
        storedTasks,
      ],
    );

  const selectedEventAvailableTasks =
    useMemo(
      () => {
        const linkedTaskIds =
          new Set(
            selectedEventTaskLinks.map(
              (link) =>
                link.task_id,
            ),
          );

        return (
          storedTasks ||
          []
        )
          .filter(
            taskIsActive,
          )
          .filter(
            (task) =>
              !linkedTaskIds.has(
                task.id,
              ),
          )
          .sort(
            (
              left,
              right,
            ) => {
              const priorityDifference =
                taskPriorityScore(
                  right,
                ) -
                taskPriorityScore(
                  left,
                );

              if (
                priorityDifference
              ) {
                return (
                  priorityDifference
                );
              }

              const leftDue =
                taskDueDate(
                  left,
                );

              const rightDue =
                taskDueDate(
                  right,
                );

              if (
                leftDue &&
                rightDue
              ) {
                return (
                  leftDue -
                  rightDue
                );
              }

              if (leftDue) {
                return -1;
              }

              if (rightDue) {
                return 1;
              }

              return String(
                left.title ||
                "",
              ).localeCompare(
                String(
                  right.title ||
                  "",
                ),
              );
            },
          );
      },
      [
        selectedEventTaskLinks,
        storedTasks,
      ],
    );

  const handleLinkTaskToSelectedEvent =
    async () => {
      if (
        !selectedEvent?.id ||
        !taskLinkSelection
      ) {
        return;
      }

      try {
        await linkTaskToEvent(
          selectedEvent.id,
          taskLinkSelection,
        );

        setTaskLinkSelection(
          "",
        );
      } catch (
        linkError
      ) {
        console.error(
          "Calendar could not link task:",
          linkError,
        );

        window.alert(
          "Campaign Seat could not link that task to this event.",
        );
      }
    };

  const handleUnlinkTaskFromSelectedEvent =
    async (
      linkId,
    ) => {
      try {
        await unlinkTaskFromEvent(
          linkId,
        );
      } catch (
        unlinkError
      ) {
        console.error(
          "Calendar could not unlink task:",
          unlinkError,
        );

        window.alert(
          "Campaign Seat could not remove that task from this event.",
        );
      }
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
          tasks={focusedTasks}
          now={now}
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
        tasks={focusedTasks}
        now={now}
        onEventClick={setSelectedEvent}
        onTaskClick={
          openTaskDeadlineEditor
        }
        onTaskDeadlineDrop={
          handleTaskDeadlineDrop
        }
      />
    );
  };

  return (
    <CampaignWorkspaceShell activeItem="Calendar">
      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <div className={styles.headerTitle}>
            <h1>Calendar</h1>
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
          aria-label="Calendar command summary"
        >
          <button
            className={`${styles.summaryCommandCard} ${
              summaryFocus ===
              "today"
                ? styles.summaryCommandActive
                : ""
            }`}
            type="button"
            aria-pressed={
              summaryFocus ===
              "today"
            }
            onClick={() =>
              applySummaryFocus(
                "today",
              )
            }
          >
            <span
              className={`${styles.summaryIcon} ${styles.redIcon}`}
            >
              <CalendarDays
                size={20}
              />
            </span>

            <div>
              <small>
                Today
              </small>

              <strong>
                {summary.today}
              </strong>

              <span>
                items
              </span>

              <p>
                Events + due tasks
              </p>
            </div>
          </button>

          <button
            className={`${styles.summaryCommandCard} ${
              summaryFocus ===
              "next-seven"
                ? styles.summaryCommandActive
                : ""
            }`}
            type="button"
            aria-pressed={
              summaryFocus ===
              "next-seven"
            }
            onClick={() =>
              applySummaryFocus(
                "next-seven",
              )
            }
          >
            <span
              className={`${styles.summaryIcon} ${styles.purpleIcon}`}
            >
              <CalendarRange
                size={20}
              />
            </span>

            <div>
              <small>
                Next 7 days
              </small>

              <strong>
                {summary.nextSeven}
              </strong>

              <span>
                items
              </span>

              <p>
                Events + task deadlines
              </p>
            </div>
          </button>

          <button
            className={`${styles.summaryCommandCard} ${
              summaryFocus ===
              "deadlines"
                ? styles.summaryCommandActive
                : ""
            }`}
            type="button"
            aria-pressed={
              summaryFocus ===
              "deadlines"
            }
            onClick={() =>
              applySummaryFocus(
                "deadlines",
              )
            }
          >
            <span
              className={`${styles.summaryIcon} ${styles.goldIcon}`}
            >
              <ListChecks
                size={20}
              />
            </span>

            <div>
              <small>
                Deadlines
              </small>

              <strong>
                {summary.deadlines}
              </strong>

              <span>
                due
              </span>

              <p>
                Next 7 days
              </p>
            </div>
          </button>

          <button
            className={`${styles.summaryCommandCard} ${
              summaryFocus ===
              "meetings"
                ? styles.summaryCommandActive
                : ""
            }`}
            type="button"
            aria-pressed={
              summaryFocus ===
              "meetings"
            }
            onClick={() =>
              applySummaryFocus(
                "meetings",
              )
            }
          >
            <span
              className={`${styles.summaryIcon} ${styles.greenIcon}`}
            >
              <UsersRound
                size={20}
              />
            </span>

            <div>
              <small>
                Meetings
              </small>

              <strong>
                {summary.meetings}
              </strong>

              <span>
                scheduled
              </span>

              <p>
                Next 7 days
              </p>
            </div>
          </button>
        </section>

        <section className={styles.calendarLayout}>
          <div className={styles.calendarCard}>
            <div className={styles.calendarToolbar}>
              <div className={styles.dateControls}>
                <button
                  type="button"
                  onClick={() => {
                    clearSummaryFocus();

                    setViewDate(
                      new Date(),
                    );
                  }}
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
                    onClick={() => {
                      clearSummaryFocus();

                      setViewMode(
                        value,
                      );
                    }}
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
                        onClick={() => {
                          clearSummaryFocus();

                          setActiveTypes(
                            Object.keys(
                              EVENT_TYPE_LABELS,
                            ),
                          );
                        }}
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
            {viewMode !== "agenda" ? (
              <>
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
                  Next up
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "agenda",
                    )
                  }
                >
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
                  Critical deadlines
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "agenda",
                    )
                  }
                >
                  View all
                </button>
              </header>

              <div
                className={
                  styles.deadlineList
                }
              >
                {criticalDeadlines.length ? (
                  criticalDeadlines.map(
                    (item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          item.urgent
                            ? styles.urgentDeadline
                            : ""
                        }
                        onClick={() => {
                          if (
                            item.event
                          ) {
                            setSelectedEvent(
                              item.event,
                            );

                            return;
                          }

                          window.location.assign(
                            item.task?.id
                              ? `/tasks?task=${encodeURIComponent(
                                  item.task.id,
                                )}`
                              : "/tasks",
                          );
                        }}
                      >
                        <span
                          className={
                            styles.deadlineIcon
                          }
                        >
                          <AlertTriangle
                            size={15}
                          />
                        </span>

                        <span>
                          <strong>
                            {item.title}
                          </strong>

                          <small>
                            {item.kind}
                            {" · "}
                            {formatDueLabel(
                              item.due,
                              now,
                            )}
                          </small>
                        </span>
                      </button>
                    ),
                  )
                ) : (
                  <p
                    className={
                      styles.railEmpty
                    }
                  >
                    No critical deadlines
                    in the next 14 days.
                  </p>
                )}
              </div>
            </section>

              </>
            ) : null}

            {viewMode === "agenda" &&
            scheduleConflicts.length ? (
              <section
                className={`${styles.railCard} ${styles.conflictRailCard}`}
              >
                <header>
                  <strong>
                    Schedule conflicts
                  </strong>

                  <span
                    className={
                      styles.conflictCount
                    }
                  >
                    {
                      scheduleConflicts
                        .length
                    }
                  </span>
                </header>

                <div
                  className={
                    styles.conflictList
                  }
                >
                  {scheduleConflicts.map(
                    (conflict) => {
                      const primaryEvent =
                        conflict
                          .events[0];

                      const additionalCount =
                        conflict
                          .events
                          .length -
                        1;

                      return (
                        <button
                          key={
                            conflict.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedEvent(
                              primaryEvent,
                            )
                          }
                        >
                          <span
                            className={
                              styles.conflictIcon
                            }
                          >
                            <AlertTriangle
                              size={15}
                            />
                          </span>

                          <span>
                            <strong>
                              {
                                conflict
                                  .events
                                  .length
                              }
                              {" "}
                              events in conflict
                            </strong>

                            <small>
                              {
                                primaryEvent
                                  .title
                              }
                              {additionalCount >
                              0
                                ? ` + ${additionalCount} more`
                                : ""}
                            </small>

                            <small>
                              {new Intl.DateTimeFormat(
                                "en-US",
                                {
                                  month:
                                    "short",
                                  day:
                                    "numeric",
                                },
                              ).format(
                                conflict
                                  .firstConflictAt ||
                                conflict
                                  .date,
                              )}
                              {" · Conflict starts "}
                              {formatTime(
                                conflict
                                  .firstConflictAt ||
                                conflict
                                  .startsAt,
                              )}
                            </small>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>
            ) : null}

            {(
              unscheduledTasks.length ||
              taskScheduleMessage
            ) ? (
              <section
                className={`${styles.railCard} ${styles.unscheduledRailCard}`}
              >
                <header>
                  <strong>
                    Unscheduled work
                  </strong>

                  {[
                    "day",
                    "week",
                  ].includes(
                    viewMode,
                  ) ? (
                    <span
                      className={
                        styles.unscheduledCount
                      }
                    >
                      {
                        unscheduledTasks
                          .length
                      }
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        clearSummaryFocus();

                        setViewDate(
                          new Date(),
                        );

                        setViewMode(
                          "week",
                        );
                      }}
                    >
                      Plan
                    </button>
                  )}
                </header>

                {taskScheduleMessage ? (
                  <div
                    className={
                      styles.taskScheduleNotice
                    }
                  >
                    <CheckCircle2
                      size={15}
                    />

                    <span>
                      {
                        taskScheduleMessage
                      }
                    </span>
                  </div>
                ) : null}

                <div
                  className={
                    styles.unscheduledList
                  }
                >
                  {unscheduledTasks.length ? (
                    unscheduledTasks
                      .slice(
                        0,
                        5,
                      )
                      .map(
                        (task) => (
                          <button
                            key={
                              task.id
                            }
                            className={
                              schedulingTaskId ===
                              task.id
                                ? styles.taskScheduling
                                : ""
                            }
                            type="button"
                            draggable={
                              schedulingTaskId !==
                              task.id
                            }
                            onDragStart={(
                              dragEvent,
                            ) => {
                              dragEvent
                                .dataTransfer
                                .effectAllowed =
                                "move";

                              dragEvent
                                .dataTransfer
                                .setData(
                                  "application/x-campaign-seat-task",
                                  task.id,
                                );

                              dragEvent
                                .dataTransfer
                                .setData(
                                  "text/plain",
                                  task.id,
                                );
                            }}
                            onClick={() =>
                              window.location.assign(
                                `/tasks?task=${encodeURIComponent(
                                  task.id,
                                )}`,
                              )
                            }
                          >
                            <span
                              className={
                                styles.unscheduledIcon
                              }
                            >
                              <CalendarClock
                                size={15}
                              />
                            </span>

                            <span
                              className={
                                styles.unscheduledCopy
                              }
                            >
                              <strong>
                                {task.title ||
                                  "Campaign task"}
                              </strong>

                              <small>
                                {task.category ||
                                  "General"}
                                {" · "}
                                {String(
                                  task.priority ||
                                  "normal",
                                )
                                  .charAt(
                                    0,
                                  )
                                  .toUpperCase() +
                                  String(
                                    task.priority ||
                                    "normal",
                                  ).slice(
                                    1,
                                  )}
                              </small>

                              <small>
                                {[
                                  "day",
                                  "week",
                                ].includes(
                                  viewMode,
                                )
                                  ? "Drag onto the calendar to set deadline"
                                  : "Open task or choose Plan to schedule"}
                              </small>
                            </span>
                          </button>
                        ),
                      )
                  ) : (
                    <p
                      className={
                        styles.railEmpty
                      }
                    >
                      All active tasks
                      have deadlines.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            <section className={styles.railCard}>
              <header>
                <strong>
                  My tasks
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    window.location.assign(
                      "/tasks",
                    )
                  }
                >
                  View all
                </button>
              </header>

              <div
                className={
                  styles.liveTaskList
                }
              >
                {myCalendarTasks.length ? (
                  myCalendarTasks.map(
                    (task) => {
                      const overdue =
                        task.dueDate <
                        new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                        );

                      const urgent =
                        overdue ||
                        taskPriorityScore(
                          task,
                        ) >= 3;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() =>
                            window.location.assign(
                              `/tasks?task=${encodeURIComponent(
                                task.id,
                              )}`,
                            )
                          }
                        >
                          <span
                            className={
                              styles.taskRailIcon
                            }
                          >
                            <ListChecks
                              size={15}
                            />
                          </span>

                          <span
                            className={
                              styles.taskRailCopy
                            }
                          >
                            <strong>
                              {task.title ||
                                "Campaign task"}
                            </strong>

                            <small>
                              {task.category ||
                                "Campaign task"}
                            </small>
                          </span>

                          <small
                            className={
                              urgent
                                ? styles.taskDueUrgent
                                : styles.taskDue
                            }
                          >
                            {formatDueLabel(
                              task.dueDate,
                              now,
                            )}
                          </small>
                        </button>
                      );
                    },
                  )
                ) : (
                  <p
                    className={
                      styles.railEmpty
                    }
                  >
                    No upcoming tasks
                    are assigned to you.
                  </p>
                )}
              </div>
            </section>

            <section className={styles.railCard}>
              <header>
                <strong>
                  Calendar connection
                </strong>
              </header>

              {calendarConnectionLoading ? (
                <div
                  className={
                    styles.calendarConnectionStatus
                  }
                >
                  <RefreshCw
                    className={
                      styles.spinning
                    }
                    size={17}
                  />

                  <div>
                    <strong>
                      Checking calendar…
                    </strong>

                    <span>
                      Verifying provider connection
                    </span>
                  </div>
                </div>
              ) : calendarConnected ? (
                <div
                  className={
                    styles.calendarConnectionStatus
                  }
                >
                  <CheckCircle2
                    size={18}
                  />

                  <div>
                    <strong>
                      {calendarProviderLabel} connected
                    </strong>

                    <span>
                      {calendarConnection
                        ?.display_email ||
                        "Connected campaign calendar"}
                    </span>

                    <small>
                      {calendarLastSyncLabel
                        ? `Last synced ${calendarLastSyncLabel}`
                        : "Connected · Ready to sync"}
                    </small>
                  </div>
                </div>
              ) : (
                <button
                  className={
                    styles.connectButton
                  }
                  type="button"
                  onClick={
                    handleConnectCalendar
                  }
                  disabled={
                    calendarConnecting
                  }
                >
                  <CalendarDays
                    size={17}
                  />

                  {calendarConnecting
                    ? "Connecting calendar…"
                    : "Connect calendar"}
                </button>
              )}
            </section>
          </aside>
        </section>

        {deadlineEditor ? (
          <section
            className={
              styles.deadlineEditorPopover
            }
            role="dialog"
            aria-label="Edit task deadline"
          >
            <header
              className={
                styles.deadlineEditorHeader
              }
            >
              <span
                className={
                  styles.deadlineEditorIcon
                }
              >
                <CalendarClock
                  size={18}
                />
              </span>

              <div>
                <small>
                  {deadlineEditor
                    .moved
                    ? "Confirm exact deadline"
                    : "Edit task deadline"}
                </small>

                <strong>
                  {
                    deadlineEditor
                      .title
                  }
                </strong>
              </div>

              <button
                type="button"
                aria-label="Close exact deadline editor"
                onClick={() =>
                  setDeadlineEditor(
                    null,
                  )
                }
              >
                <X size={17} />
              </button>
            </header>

            <div
              className={
                styles.deadlineEditorFields
              }
            >
              <label>
                <span>
                  Date
                </span>

                <input
                  type="date"
                  value={
                    deadlineEditor
                      .date
                  }
                  onChange={(
                    inputEvent,
                  ) =>
                    setDeadlineEditor(
                      (
                        current,
                      ) =>
                        current
                          ? {
                              ...current,

                              date:
                                inputEvent
                                  .target
                                  .value,
                            }
                          : current,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Exact time
                </span>

                <input
                  type="time"
                  step="60"
                  value={
                    deadlineEditor
                      .time
                  }
                  onChange={(
                    inputEvent,
                  ) =>
                    setDeadlineEditor(
                      (
                        current,
                      ) =>
                        current
                          ? {
                              ...current,

                              time:
                                inputEvent
                                  .target
                                  .value,
                            }
                          : current,
                    )
                  }
                />
              </label>
            </div>

            <p
              className={
                styles.deadlineEditorHint
              }
            >
              Dragging snaps to 15-minute
              intervals. You can type any
              exact minute here.
            </p>

            <div
              className={
                styles.deadlineEditorActions
              }
            >
              <button
                className={
                  styles.deadlineEditorPrimary
                }
                type="button"
                disabled={
                  schedulingTaskId ===
                  deadlineEditor
                    .taskId
                }
                onClick={
                  saveExactTaskDeadline
                }
              >
                {schedulingTaskId ===
                deadlineEditor
                  .taskId
                  ? "Saving…"
                  : "Save exact time"}
              </button>

              <button
                className={
                  styles.deadlineEditorSecondary
                }
                type="button"
                disabled={
                  schedulingTaskId ===
                  deadlineEditor
                    .taskId
                }
                onClick={() =>
                  setDeadlineEditor(
                    null,
                  )
                }
              >
                {deadlineEditor
                  .moved
                  ? "Keep snapped time"
                  : "Close"}
              </button>
            </div>

            <footer
              className={
                styles.deadlineEditorFooter
              }
            >
              <button
                type="button"
                onClick={() =>
                  window.location.assign(
                    `/tasks?task=${encodeURIComponent(
                      deadlineEditor
                        .taskId,
                    )}`,
                  )
                }
              >
                Open task
              </button>

              {deadlineEditor
                .moved ? (
                <button
                  className={
                    styles.deadlineEditorUndo
                  }
                  type="button"
                  disabled={
                    schedulingTaskId ===
                    deadlineEditor
                      .taskId
                  }
                  onClick={
                    undoTaskDeadlineMove
                  }
                >
                  Undo move
                </button>
              ) : null}
            </footer>
          </section>
        ) : null}

        {selectedEvent && !editEventOpen ? (
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
                    <small>
                      People
                    </small>

                    <strong>
                      {formatEventPeople(
                        selectedEvent,
                        storedTeam,
                      )}
                    </strong>
                  </div>
                </span>
              </div>

              <section
                className={
                  styles.eventLinkedTasks
                }
              >
                <header>
                  <div>
                    <small>
                      Event work
                    </small>

                    <strong>
                      Linked tasks
                    </strong>
                  </div>

                  <span>
                    {
                      selectedEventLinkedTasks
                        .length
                    }
                  </span>
                </header>

                {selectedEventLinkedTasks.length ? (
                  <div
                    className={
                      styles.eventLinkedTaskList
                    }
                  >
                    {selectedEventLinkedTasks.map(
                      ({
                        link,
                        task,
                      }) => {
                        const due =
                          taskDueDate(
                            task,
                          );

                        return (
                          <div
                            className={
                              styles.eventLinkedTaskRow
                            }
                            key={
                              link.id
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                window.location.assign(
                                  `/tasks?task=${encodeURIComponent(
                                    task.id,
                                  )}`,
                                )
                              }
                            >
                              <span
                                className={
                                  styles.eventLinkedTaskIcon
                                }
                              >
                                <ListChecks
                                  size={15}
                                />
                              </span>

                              <span>
                                <strong>
                                  {task.title ||
                                    "Campaign task"}
                                </strong>

                                <small>
                                  {task.category ||
                                    "General"}

                                  {due
                                    ? ` · ${formatDueLabel(
                                        due,
                                        now,
                                      )}`
                                    : " · No deadline"}
                                </small>
                              </span>
                            </button>

                            <button
                              className={
                                styles.eventLinkedTaskRemove
                              }
                              type="button"
                              aria-label={`Remove ${task.title || "task"} from event`}
                              disabled={
                                eventTaskLinksSaving
                              }
                              onClick={() =>
                                handleUnlinkTaskFromSelectedEvent(
                                  link.id,
                                )
                              }
                            >
                              <X
                                size={15}
                              />
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <p
                    className={
                      styles.eventLinkedTaskEmpty
                    }
                  >
                    No tasks are linked
                    to this event yet.
                  </p>
                )}

                {selectedEventAvailableTasks.length ? (
                  <div
                    className={
                      styles.eventTaskLinkControls
                    }
                  >
                    <select
                      value={
                        taskLinkSelection
                      }
                      disabled={
                        eventTaskLinksSaving
                      }
                      onChange={(
                        inputEvent,
                      ) =>
                        setTaskLinkSelection(
                          inputEvent
                            .target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        Link an existing task…
                      </option>

                      {selectedEventAvailableTasks.map(
                        (task) => (
                          <option
                            key={
                              task.id
                            }
                            value={
                              task.id
                            }
                          >
                            {task.title ||
                              "Campaign task"}
                          </option>
                        ),
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={
                        !taskLinkSelection ||
                        eventTaskLinksSaving
                      }
                      onClick={
                        handleLinkTaskToSelectedEvent
                      }
                    >
                      <Plus
                        size={15}
                      />

                      {eventTaskLinksSaving
                        ? "Saving…"
                        : "Link task"}
                    </button>
                  </div>
                ) : (
                  <small
                    className={
                      styles.eventLinkedTaskComplete
                    }
                  >
                    All active tasks are
                    already linked.
                  </small>
                )}
              </section>

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
                <button
                  type="button"
                  onClick={
                    openEditSelectedEvent
                  }
                >
                  Edit event
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancelSelectedEvent
                  }
                  disabled={
                    eventCancelling
                  }
                >
                  {eventCancelling
                    ? "Cancelling…"
                    : "Cancel event"}
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {editEventOpen && selectedEvent ? (
          <div
            className={
              styles.richEventOverlay
            }
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget &&
                !editSaving
              ) {
                setEditEventOpen(
                  false,
                );
              }
            }}
          >
            <form
              className={
                styles.richEventEditor
              }
              onSubmit={
                saveEditedEvent
              }
            >
              <header
                className={
                  styles.richEventEditorHeader
                }
              >
                <div>
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    Campaign calendar
                  </span>

                  <h2>
                    Edit event
                  </h2>
                </div>

                <div
                  className={
                    styles.richEventHeaderActions
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setEditEventOpen(
                        false,
                      )
                    }
                    disabled={
                      editSaving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.richEventSaveButton
                    }
                    disabled={
                      editSaving
                    }
                  >
                    {editSaving
                      ? "Saving…"
                      : "Save changes"}
                  </button>

                  <button
                    type="button"
                    className={
                      styles.richEventClose
                    }
                    aria-label="Close event editor"
                    onClick={() =>
                      setEditEventOpen(
                        false,
                      )
                    }
                    disabled={
                      editSaving
                    }
                  >
                    <X size={20} />
                  </button>
                </div>
              </header>

              <div
                className={
                  styles.richEventEditorBody
                }
              >
                <main
                  className={
                    styles.richEventMain
                  }
                >
                  <input
                    className={
                      styles.richEventTitle
                    }
                    type="text"
                    required
                    value={
                      editEventForm.title
                    }
                    placeholder="Add title"
                    onChange={(event) =>
                      setEditEventForm(
                        (current) => ({
                          ...current,
                          title:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <Clock3
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <div
                        className={
                          styles.richEditorGrid
                        }
                      >
                        <label>
                          <span>
                            Date
                          </span>

                          <input
                            type="date"
                            value={
                              editEventForm
                                .date
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  date:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          />
                        </label>

                        {!editEventForm
                          .allDay ? (
                          <>
                            <label>
                              <span>
                                Start
                              </span>

                              <input
                                type="time"
                                value={
                                  editEventForm
                                    .start
                                }
                                onChange={(event) =>
                                  setEditEventForm(
                                    (current) => ({
                                      ...current,
                                      start:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>
                                End
                              </span>

                              <input
                                type="time"
                                value={
                                  editEventForm
                                    .end
                                }
                                onChange={(event) =>
                                  setEditEventForm(
                                    (current) => ({
                                      ...current,
                                      end:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                                }
                              />
                            </label>
                          </>
                        ) : null}
                      </div>

                      <div
                        className={
                          styles.richEditorInlineOptions
                        }
                      >
                        <label
                          className={
                            styles.richEditorCheckbox
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              editEventForm
                                .allDay
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  allDay:
                                    event
                                      .target
                                      .checked,
                                }),
                              )
                            }
                          />

                          <span>
                            All day
                          </span>
                        </label>

                        <label
                          className={
                            styles.richEditorCompactField
                          }
                        >
                          <span>
                            Time zone
                          </span>

                          <select
                            value={
                              editEventForm
                                .timezone
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  timezone:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            <option
                              value="America/New_York"
                            >
                              Eastern Time
                            </option>

                            <option
                              value="America/Chicago"
                            >
                              Central Time
                            </option>

                            <option
                              value="America/Denver"
                            >
                              Mountain Time
                            </option>

                            <option
                              value="America/Los_Angeles"
                            >
                              Pacific Time
                            </option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <Search
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <div
                        className={
                          styles.richFindTimeCard
                        }
                      >
                        <div
                          className={
                            styles.richFindTimeHeading
                          }
                        >
                          <div>
                            <strong>
                              Find a time
                            </strong>

                            <span>
                              Check your connected calendar
                              {editEventForm
                                .participants
                                .length
                                ? ` and ${editEventForm.participants.length} guest${editEventForm.participants.length === 1 ? "" : "s"}`
                                : ""}
                              {" "}for shared openings.
                            </span>
                          </div>

                          <div
                            className={
                              styles.richFindTimeControls
                            }
                          >
                            <select
                              aria-label="Availability search range"
                              value={
                                findTimeDays
                              }
                              onChange={(event) =>
                                setFindTimeDays(
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                                )
                              }
                            >
                              <option value={3}>
                                Next 3 days
                              </option>

                              <option value={7}>
                                Next 7 days
                              </option>

                              <option value={14}>
                                Next 14 days
                              </option>
                            </select>

                            <button
                              type="button"
                              onClick={
                                handleFindTime
                              }
                              disabled={
                                findingTime
                              }
                            >
                              <Search
                                size={15}
                              />

                              {findingTime
                                ? "Checking…"
                                : "Find a time"}
                            </button>
                          </div>
                        </div>

                        <small
                          className={
                            styles.richFindTimeWindow
                          }
                        >
                          Searches 8:00 AM–8:00 PM in {
                            editEventForm
                              .timezone ===
                            "America/New_York"
                              ? "Eastern Time"
                              : editEventForm
                                  .timezone ===
                                "America/Chicago"
                                ? "Central Time"
                                : editEventForm
                                    .timezone ===
                                  "America/Denver"
                                  ? "Mountain Time"
                                  : editEventForm
                                      .timezone ===
                                    "America/Los_Angeles"
                                    ? "Pacific Time"
                                    : editEventForm
                                        .timezone
                          }.
                        </small>

                        {findTimeError ? (
                          <div
                            className={
                              styles.richFindTimeError
                            }
                          >
                            <AlertTriangle
                              size={16}
                            />

                            <span>
                              {findTimeError}
                            </span>
                          </div>
                        ) : null}

                        {findTimeResult
                          ?.unresolved
                          ?.length ? (
                          <div
                            className={
                              styles.richFindTimeWarning
                            }
                          >
                            <AlertTriangle
                              size={16}
                            />

                            <div>
                              <strong>
                                Partial availability
                              </strong>

                              <span>
                                Campaign Seat could not verify:
                                {" "}
                                {findTimeResult
                                  .unresolved
                                  .map(
                                    (item) =>
                                      item.email,
                                  )
                                  .join(", ")}
                                .
                                Suggested times only account
                                for calendars we could verify.
                              </span>
                            </div>
                          </div>
                        ) : null}

                        {findTimeResult ? (
                          <div
                            className={
                              styles.richFindTimeResults
                            }
                          >
                            <div
                              className={
                                styles.richFindTimeResultHeading
                              }
                            >
                              <strong>
                                Suggested times
                              </strong>

                              <span>
                                {findTimeResult
                                  .suggestions
                                  ?.length ||
                                  0}
                                {" "}opening{
                                  (
                                    findTimeResult
                                      .suggestions
                                      ?.length ||
                                    0
                                  ) === 1
                                    ? ""
                                    : "s"
                                } found
                              </span>
                            </div>

                            {findTimeResult
                              .suggestions
                              ?.length ? (
                              <div
                                className={
                                  styles.richFindTimeSlots
                                }
                              >
                                {findTimeResult
                                  .suggestions
                                  .slice(
                                    0,
                                    12,
                                  )
                                  .map(
                                    (
                                      suggestion,
                                      index,
                                    ) => {
                                      const startDate =
                                        new Date(
                                          suggestion
                                            .start_time *
                                            1000,
                                        );

                                      const endDate =
                                        new Date(
                                          suggestion
                                            .end_time *
                                            1000,
                                        );

                                      const timezone =
                                        findTimeResult
                                          .timezone ||
                                        editEventForm
                                          .timezone;

                                      return (
                                        <button
                                          type="button"
                                          className={
                                            selectedFindTimeStart ===
                                            Number(
                                              suggestion.start_time,
                                            )
                                              ? styles.richFindTimeSlotSelected
                                              : ""
                                          }
                                          aria-pressed={
                                            selectedFindTimeStart ===
                                            Number(
                                              suggestion.start_time,
                                            )
                                          }
                                          key={`${suggestion.start_time}-${index}`}
                                          onClick={() =>
                                            applyFindTimeSuggestion(
                                              suggestion,
                                            )
                                          }
                                        >
                                          <strong>
                                            {new Intl.DateTimeFormat(
                                              "en-US",
                                              {
                                                timeZone:
                                                  timezone,

                                                weekday:
                                                  "short",

                                                month:
                                                  "short",

                                                day:
                                                  "numeric",
                                              },
                                            ).format(
                                              startDate,
                                            )}
                                          </strong>

                                          <span>
                                            {new Intl.DateTimeFormat(
                                              "en-US",
                                              {
                                                timeZone:
                                                  timezone,

                                                hour:
                                                  "numeric",

                                                minute:
                                                  "2-digit",
                                              },
                                            ).format(
                                              startDate,
                                            )}
                                            {" – "}
                                            {new Intl.DateTimeFormat(
                                              "en-US",
                                              {
                                                timeZone:
                                                  timezone,

                                                hour:
                                                  "numeric",

                                                minute:
                                                  "2-digit",
                                              },
                                            ).format(
                                              endDate,
                                            )}
                                          </span>
                                        </button>
                                      );
                                    },
                                  )}
                              </div>
                            ) : (
                              <div
                                className={
                                  styles.richFindTimeEmpty
                                }
                              >
                                No shared openings were found
                                in this search window.
                              </div>
                            )}

                            {(
                              findTimeResult
                                .suggestions
                                ?.length ||
                              0
                            ) > 12 ? (
                              <small
                                className={
                                  styles.richFindTimeMore
                                }
                              >
                                Showing the first 12 openings.
                              </small>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <CalendarRange
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <label>
                        <span>
                          Repeat
                        </span>

                        <select
                          value={
                            editEventForm
                              .recurrenceMode
                          }
                          onChange={(event) =>
                            setEditEventForm(
                              (current) => ({
                                ...current,
                                recurrenceMode:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="none">
                            Does not repeat
                          </option>

                          <option value="daily">
                            Daily
                          </option>

                          <option value="weekly">
                            Weekly
                          </option>

                          <option value="monthly">
                            Monthly
                          </option>

                          {editEventForm
                            .recurrenceMode ===
                          "custom" ? (
                            <option value="custom">
                              Custom recurrence
                            </option>
                          ) : null}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <Video
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <div
                        className={
                          styles.richConferenceCard
                        }
                      >
                        <div
                          className={
                            styles.richConferenceStatus
                          }
                        >
                          <span
                            className={
                              styles.richConferenceIcon
                            }
                          >
                            <Video
                              size={18}
                            />
                          </span>

                          <div>
                            <strong>
                              {calendarProvider ===
                              "microsoft"
                                ? "Microsoft Teams"
                                : "Google Meet"}
                            </strong>

                            <span>
                              {editEventForm
                                .addConference
                                ? editEventForm
                                    .conferencing
                                    ?.details
                                    ?.url
                                  ? "Video meeting attached"
                                  : "Meeting link will be created when you save"
                                : "Add a video meeting to this event"}
                            </span>
                          </div>
                        </div>

                        {editEventForm
                          .addConference ? (
                          <div
                            className={
                              styles.richConferenceActions
                            }
                          >
                            {editEventForm
                              .conferencing
                              ?.details
                              ?.url ? (
                              <a
                                className={
                                  styles.richConferenceLink
                                }
                                href={
                                  editEventForm
                                    .conferencing
                                    .details
                                    .url
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                Join meeting
                              </a>
                            ) : null}

                            <button
                              type="button"
                              className={
                                styles.richConferenceRemove
                              }
                              onClick={() =>
                                setEditEventForm(
                                  (current) => ({
                                    ...current,

                                    addConference:
                                      false,

                                    conferencing:
                                      {},
                                  }),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={
                              styles.richConferenceAdd
                            }
                            onClick={() =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,

                                  addConference:
                                    true,

                                  conferencing: {
                                    provider:
                                      calendarProvider ===
                                      "microsoft"
                                        ? "Microsoft Teams"
                                        : "Google Meet",

                                    autocreate:
                                      {},
                                  },
                                }),
                              )
                            }
                          >
                            <Video
                              size={16}
                            />

                            {calendarProvider ===
                            "microsoft"
                              ? "Add Microsoft Teams"
                              : "Add Google Meet"}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <MapPin
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <label>
                        <span>
                          Location
                        </span>

                        <input
                          type="text"
                          value={
                            editEventForm
                              .location
                          }
                          placeholder="Add location or meeting link"
                          onChange={(event) =>
                            setEditEventForm(
                              (current) => ({
                                ...current,
                                location:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <CalendarClock
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <div
                        className={
                          styles.richReminderCard
                        }
                      >
                        <div
                          className={
                            styles.richReminderHeading
                          }
                        >
                          <div>
                            <strong>
                              Notifications
                            </strong>

                            <span>
                              Choose when guests and organizers are reminded.
                            </span>
                          </div>

                          <label
                            className={
                              styles.richReminderDefault
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                editEventForm
                                  .useDefaultReminders
                              }
                              onChange={(event) =>
                                setEditEventForm(
                                  (current) => ({
                                    ...current,

                                    useDefaultReminders:
                                      event
                                        .target
                                        .checked,
                                  }),
                                )
                              }
                            />

                            <span>
                              Use calendar default
                            </span>
                          </label>
                        </div>

                        {!editEventForm
                          .useDefaultReminders ? (
                          <>
                            <div
                              className={
                                styles.richReminderList
                              }
                            >
                              {editEventForm
                                .reminderRows
                                .length ===
                              0 ? (
                                <div
                                  className={
                                    styles.richReminderEmpty
                                  }
                                >
                                  No notifications
                                </div>
                              ) : (
                                editEventForm
                                  .reminderRows
                                  .map(
                                    (
                                      reminder,
                                      index,
                                    ) => (
                                      <div
                                        className={
                                          styles.richReminderRow
                                        }
                                        key={`reminder-${index}`}
                                      >
                                        <select
                                          aria-label="Reminder time"
                                          value={
                                            reminder
                                              .minutes
                                          }
                                          onChange={(event) =>
                                            updateReminderRow(
                                              index,
                                              {
                                                minutes:
                                                  event
                                                    .target
                                                    .value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="5">
                                            5 minutes before
                                          </option>

                                          <option value="10">
                                            10 minutes before
                                          </option>

                                          <option value="15">
                                            15 minutes before
                                          </option>

                                          <option value="30">
                                            30 minutes before
                                          </option>

                                          <option value="60">
                                            1 hour before
                                          </option>

                                          <option value="120">
                                            2 hours before
                                          </option>

                                          <option value="1440">
                                            1 day before
                                          </option>

                                          <option value="2880">
                                            2 days before
                                          </option>

                                          {![
                                            "5",
                                            "10",
                                            "15",
                                            "30",
                                            "60",
                                            "120",
                                            "1440",
                                            "2880",
                                          ].includes(
                                            String(
                                              reminder
                                                .minutes,
                                            ),
                                          ) ? (
                                            <option
                                              value={
                                                reminder
                                                  .minutes
                                              }
                                            >
                                              {reminder
                                                .minutes} minutes before
                                            </option>
                                          ) : null}
                                        </select>

                                        <select
                                          aria-label="Reminder method"
                                          value={
                                            reminder
                                              .method
                                          }
                                          onChange={(event) =>
                                            updateReminderRow(
                                              index,
                                              {
                                                method:
                                                  event
                                                    .target
                                                    .value,
                                              },
                                            )
                                          }
                                        >
                                          <option value="popup">
                                            Notification
                                          </option>

                                          <option value="email">
                                            Email
                                          </option>
                                        </select>

                                        <button
                                          type="button"
                                          aria-label="Remove notification"
                                          onClick={() =>
                                            removeReminderRow(
                                              index,
                                            )
                                          }
                                        >
                                          <X
                                            size={16}
                                          />
                                        </button>
                                      </div>
                                    ),
                                  )
                              )}
                            </div>

                            <button
                              type="button"
                              className={
                                styles.richReminderAdd
                              }
                              onClick={
                                addReminderRow
                              }
                              disabled={
                                editEventForm
                                  .reminderRows
                                  .length >= 5
                              }
                            >
                              <Plus
                                size={15}
                              />

                              Add notification
                            </button>
                          </>
                        ) : (
                          <div
                            className={
                              styles.richReminderDefaultNotice
                            }
                          >
                            This event will use the connected calendar’s default notification settings.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <ListChecks
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <div
                        className={
                          styles.richEditorGridTwo
                        }
                      >
                        <label>
                          <span>
                            Event type
                          </span>

                          <select
                            value={
                              editEventForm
                                .type
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  type:
                                    event
                                      .target
                                      .value,
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
                          <span>
                            Show as
                          </span>

                          <select
                            value={
                              editEventForm
                                .busy
                                ? "busy"
                                : "free"
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  busy:
                                    event
                                      .target
                                      .value ===
                                    "busy",
                                }),
                              )
                            }
                          >
                            <option value="busy">
                              Busy
                            </option>

                            <option value="free">
                              Free
                            </option>
                          </select>
                        </label>

                        <label>
                          <span>
                            Visibility
                          </span>

                          <select
                            value={
                              editEventForm
                                .visibility
                            }
                            onChange={(event) =>
                              setEditEventForm(
                                (current) => ({
                                  ...current,
                                  visibility:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            {calendarProvider ===
                            "google" ? (
                              <option value="default">
                                Default visibility
                              </option>
                            ) : null}

                            <option value="public">
                              Public
                            </option>

                            <option value="private">
                              Private
                            </option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richEditorSection
                    }
                  >
                    <div
                      className={
                        styles.richEditorSectionIcon
                      }
                    >
                      <MoreVertical
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.richEditorSectionContent
                      }
                    >
                      <label>
                        <span>
                          Description or notes
                        </span>

                        <textarea
                          rows={6}
                          value={
                            editEventForm
                              .description
                          }
                          placeholder="Add notes, agenda, talking points, or event details…"
                          onChange={(event) =>
                            setEditEventForm(
                              (current) => ({
                                ...current,
                                description:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>
                </main>

                <aside
                  className={
                    styles.richEventSidebar
                  }
                >
                  <section
                    className={
                      styles.richGuestPanel
                    }
                  >
                    <div
                      className={
                        styles.richSidebarHeading
                      }
                    >
                      <UsersRound
                        size={20}
                      />

                      <div>
                        <strong>
                          Guests
                        </strong>

                        <span>
                          Add campaign staff or outside attendees
                        </span>
                      </div>
                    </div>

                    <div
                      className={
                        styles.richGuestComposer
                      }
                    >
                      <input
                        className={
                          styles.richGuestNameInput
                        }
                        type="text"
                        value={
                          guestNameDraft
                        }
                        placeholder="Guest name (optional)"
                        onChange={(event) =>
                          setGuestNameDraft(
                            event
                              .target
                              .value,
                          )
                        }
                      />

                      <div
                        className={
                          styles.richGuestInput
                        }
                      >
                        <input
                          type="email"
                          value={
                            guestDraft
                          }
                          placeholder="Email address"
                          onChange={(event) =>
                            setGuestDraft(
                              event
                                .target
                                .value,
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();
                              addEditGuest();
                            }
                          }}
                        />

                        <button
                          type="button"
                          onClick={
                            addEditGuest
                          }
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        styles.richGuestList
                      }
                    >
                      {editEventForm
                        .participants
                        .length ===
                      0 ? (
                        <div
                          className={
                            styles.richGuestEmpty
                          }
                        >
                          No guests added
                        </div>
                      ) : (
                        editEventForm
                          .participants
                          .map(
                            (
                              participant,
                            ) => (
                              <div
                                className={
                                  styles.richGuestItem
                                }
                                key={
                                  participant
                                    .email
                                }
                              >
                                <span
                                  className={
                                    styles.richGuestAvatar
                                  }
                                >
                                  {String(
                                    participant
                                      ?.name ||
                                    participant
                                      ?.email ||
                                    "?",
                                  )
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>

                                <div>
                                  <strong>
                                    {participant
                                      ?.name ||
                                      participant
                                        ?.email}
                                  </strong>

                                  {participant
                                    ?.name ? (
                                    <span>
                                      {participant
                                        .email}
                                    </span>
                                  ) : null}
                                </div>

                                <button
                                  type="button"
                                  aria-label={`Remove ${participant.email}`}
                                  onClick={() =>
                                    removeEditGuest(
                                      participant
                                        .email,
                                    )
                                  }
                                >
                                  <X
                                    size={15}
                                  />
                                </button>
                              </div>
                            ),
                          )
                      )}
                    </div>

                    <div
                      className={
                        styles.richGuestSettings
                      }
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            editEventForm
                              .notifyParticipants
                          }
                          onChange={(event) =>
                            setEditEventForm(
                              (current) => ({
                                ...current,
                                notifyParticipants:
                                  event
                                    .target
                                    .checked,
                              }),
                            )
                          }
                        />

                        <span>
                          Email guests about changes
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          checked={
                            editEventForm
                              .hideParticipants
                          }
                          onChange={(event) =>
                            setEditEventForm(
                              (current) => ({
                                ...current,
                                hideParticipants:
                                  event
                                    .target
                                    .checked,
                              }),
                            )
                          }
                        />

                        <span>
                          Hide guest list
                        </span>
                      </label>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richConnectedCalendar
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <div>
                      <strong>
                        {calendarProviderLabel}
                      </strong>

                      <span>
                        {calendarConnection
                          ?.display_email ||
                          "Connected calendar"}
                      </span>

                      <small>
                        Changes sync to this calendar
                      </small>
                    </div>
                  </section>

                  <section
                    className={
                      styles.richProviderIdentity
                    }
                  >
                    <span>
                      Calendar event
                    </span>

                    <strong>
                      {selectedEvent
                        .externalEventId
                        ? "Synced with provider"
                        : "Campaign Seat only"}
                    </strong>
                  </section>
                </aside>
              </div>

              <footer
                className={
                  styles.richEventEditorFooter
                }
              >
                <button
                  type="button"
                  className={
                    styles.richEventDangerButton
                  }
                  onClick={
                    handleCancelSelectedEvent
                  }
                  disabled={
                    editSaving ||
                    eventCancelling
                  }
                >
                  {eventCancelling
                    ? "Cancelling…"
                    : "Cancel event"}
                </button>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditEventOpen(
                        false,
                      )
                    }
                    disabled={
                      editSaving
                    }
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.richEventSaveButton
                    }
                    disabled={
                      editSaving
                    }
                  >
                    {editSaving
                      ? "Saving changes…"
                      : "Save changes"}
                  </button>
                </div>
              </footer>
            </form>
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
                  name="title"
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
                    name="date"
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
                    name="type"
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
                    name="start"
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
                    name="end"
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
                  name="location"
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
