import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Columns3,
  Filter,
  List,
  LoaderCircle,
  Menu,
  MessageSquare,
  Paperclip,
  Download,
  UploadCloud,
  FileText,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useTasksCommandCenter } from "../../hooks/useTasksCommandCenter";
import { useFilesCommandCenter } from "../../hooks/useFilesCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";
import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

// CAMPAIGN SEAT CANONICAL WORKSPACE SHELL
import styles from "./Tasks.module.css";

// CAMPAIGN HQ CALENDAR LINT COMPLETION

const STATUS_META = {
  open: {
    label: "Open",
    description: "Ready to begin",
  },
  in_progress: {
    label: "In progress",
    description: "Currently being worked",
  },
  completed: {
    label: "Completed",
    description: "Finished campaign work",
  },
  archived: {
    label: "Archived",
    description: "No longer active",
  },
};

const PRIORITY_META = {
  urgent: {
    label: "Urgent",
    className: "urgent",
  },
  high: {
    label: "High",
    className: "high",
  },
  normal: {
    label: "Normal",
    className: "normal",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

const CATEGORY_OPTIONS = [
  "General",
  "Candidate",
  "Field",
  "Events",
  "Communications",
  "Digital",
  "Fundraising",
  "Finance",
  "Compliance",
  "Volunteer",
  "Research",
  "Operations",
];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "General",
  priority: "normal",
  status: "open",
  assignedTo: "",
  dueDate: "",
  dueTime: "17:00",
  visibility: "workspace",
  tags: "",
  estimatedMinutes: "",

  repeatMode: "none",
  repeatInterval: "1",
  repeatUnit: "week",
  repeatEndDate: "",
};

const EMPTY_PLAYBOOK_FORM = {
  name: "",
  taskTitle: "",
  taskDescription: "",
  category: "General",
  priority: "normal",
  visibility: "workspace",
  tags: "",
  estimatedMinutes: "",
};

function formatRelativeTime(value) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const minutes = Math.max(
    0,
    Math.floor(difference / 60000),
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTaskReminderScheduleLabel(
  reminder,
) {
  if (
    reminder.schedule_type ===
    "exact"
  ) {
    return reminder.next_fire_at
      ? `Exact · ${formatDateTime(
          reminder.next_fire_at,
        )}`
      : "Exact reminder";
  }

  const minutes =
    Number(
      reminder.offset_minutes ||
      0,
    );

  let amountLabel =
    `${minutes} min`;

  if (minutes === 60) {
    amountLabel =
      "1 hour";
  } else if (
    minutes > 0 &&
    minutes % 1440 === 0
  ) {
    const days =
      minutes / 1440;

    amountLabel =
      `${days} ${
        days === 1
          ? "day"
          : "days"
      }`;
  } else if (
    minutes > 60 &&
    minutes % 60 === 0
  ) {
    const hours =
      minutes / 60;

    amountLabel =
      `${hours} hours`;
  }

  return reminder.schedule_type ===
    "overdue"
    ? `${amountLabel} after deadline`
    : `${amountLabel} before deadline`;
}

function getTaskReminderRecipientLabel(
  value,
) {
  const labels = {
    assignee:
      "Task owner",

    creator:
      "Task creator",

    leadership:
      "Campaign leadership",

    assignee_and_leadership:
      "Owner + leadership",
  };

  return (
    labels[value] ||
    "Task owner"
  );
}

// CAMPAIGN SEAT TASK COMMAND CENTER FINAL POLISH

const REMINDER_TIME_OPTIONS =
  Array.from(
    {
      length: 96,
    },
    (_, index) => {
      const totalMinutes =
        index * 15;

      const hours24 =
        Math.floor(
          totalMinutes / 60,
        );

      const minutes =
        totalMinutes % 60;

      const value =
        `${String(
          hours24,
        ).padStart(
          2,
          "0",
        )}:${String(
          minutes,
        ).padStart(
          2,
          "0",
        )}`;

      const period =
        hours24 >= 12
          ? "PM"
          : "AM";

      const hours12 =
        hours24 % 12 || 12;

      const label =
        `${hours12}:${String(
          minutes,
        ).padStart(
          2,
          "0",
        )} ${period}`;

      return {
        value,
        label,
      };
    },
  );

function getLocalDateInputValue(
  date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function getDefaultReminderExactDate() {
  const date =
    new Date(
      Date.now() +
        15 * 60 * 1000,
    );

  return getLocalDateInputValue(
    date,
  );
}

function getDefaultReminderExactTime() {
  const date =
    new Date(
      Date.now() +
        15 * 60 * 1000,
    );

  date.setSeconds(
    0,
    0,
  );

  date.setMinutes(
    Math.ceil(
      date.getMinutes() /
        15,
    ) * 15,
  );

  return `${String(
    date.getHours(),
  ).padStart(
    2,
    "0",
  )}:${String(
    date.getMinutes(),
  ).padStart(
    2,
    "0",
  )}`;
}

// CAMPAIGN SEAT REMINDER CONTROL UX FINAL

function getReminderCalendarMonthValue(
  dateValue,
) {
  const value =
    dateValue ||
    getDefaultReminderExactDate();

  return `${value.slice(
    0,
    7,
  )}-01`;
}

function getReminderDateLabel(
  value,
) {
  if (!value) {
    return "Choose date";
  }

  const date =
    new Date(
      `${value}T12:00:00`,
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function getReminderTimeLabel(
  value,
) {
  return (
    REMINDER_TIME_OPTIONS.find(
      (option) =>
        option.value === value,
    )?.label ||
    value ||
    "Choose time"
  );
}

function getReminderMonthLabel(
  monthValue,
) {
  const date =
    new Date(
      `${monthValue}T12:00:00`,
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

function shiftReminderCalendarMonth(
  monthValue,
  amount,
) {
  const date =
    new Date(
      `${monthValue}T12:00:00`,
    );

  date.setDate(1);

  date.setMonth(
    date.getMonth() +
      amount,
  );

  return `${getLocalDateInputValue(
    date,
  ).slice(
    0,
    7,
  )}-01`;
}

function getReminderCalendarDays(
  monthValue,
) {
  const monthDate =
    new Date(
      `${monthValue}T12:00:00`,
    );

  const year =
    monthDate.getFullYear();

  const month =
    monthDate.getMonth();

  const firstWeekday =
    new Date(
      year,
      month,
      1,
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0,
    ).getDate();

  const cells =
    Array(42).fill(
      null,
    );

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const date =
      new Date(
        year,
        month,
        day,
        12,
        0,
        0,
      );

    cells[
      firstWeekday +
        day -
        1
    ] =
      getLocalDateInputValue(
        date,
      );
  }

  return cells;
}

function normalizeReminderTimeToQuarter(
  value,
) {
  if (
    REMINDER_TIME_OPTIONS.some(
      (option) =>
        option.value === value,
    )
  ) {
    return value;
  }

  const [
    hourValue,
    minuteValue,
  ] =
    String(
      value || "09:00",
    )
      .split(":")
      .map(Number);

  const date =
    new Date();

  date.setHours(
    Number.isFinite(hourValue)
      ? hourValue
      : 9,
    Number.isFinite(minuteValue)
      ? minuteValue
      : 0,
    0,
    0,
  );

  date.setMinutes(
    Math.round(
      date.getMinutes() /
        15,
    ) * 15,
  );

  return `${String(
    date.getHours(),
  ).padStart(
    2,
    "0",
  )}:${String(
    date.getMinutes(),
  ).padStart(
    2,
    "0",
  )}`;
}

function getDateParts(value) {
  if (!value) {
    return {
      date: "",
      time: "17:00",
    };
  }

  const date = new Date(value);

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");
  const hours = String(
    date.getHours(),
  ).padStart(2, "0");
  const minutes = String(
    date.getMinutes(),
  ).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

function isSameCalendarDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isTaskOverdue(task) {
  return (
    task.due_at &&
    !["completed", "archived"].includes(task.status) &&
    new Date(task.due_at).getTime() < Date.now()
  );
}

function getAssignee(task, team) {
  if (!task.assigned_to) {
    return null;
  }

  return team.find(
    (member) => member.id === task.assigned_to,
  );
}

function getCreator(task, team) {
  return team.find(
    (member) => member.id === task.created_by,
  );
}

function getTaskDeadlineLabel(task) {
  if (!task.due_at) {
    return "No deadline";
  }

  const dueDate = new Date(task.due_at);
  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isTaskOverdue(task)) {
    return `Overdue · ${formatDateTime(task.due_at)}`;
  }

  if (isSameCalendarDay(dueDate, today)) {
    return `Due today · ${new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(dueDate)}`;
  }

  if (isSameCalendarDay(dueDate, tomorrow)) {
    return `Due tomorrow · ${new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(dueDate)}`;
  }

  return `Due ${formatDateTime(task.due_at)}`;
}

function getVisibilityLabel(value) {
  if (value === "admin_only") {
    return "Campaign leadership only";
  }

  if (value === "assignee_only") {
    return "Assignee and campaign leadership";
  }

  return "Entire campaign team";
}

function TaskCard({
  task,
  team,
  tasks,
  taskDependencies,
  taskReminderOverview,
  taskSubtaskOverview,
  onOpen,
  onStatusChange,
  isSelected,
  onSelectionChange,
  canSelect,
  isSaving,
}) {
  const assignee = getAssignee(task, team);
  const priority =
    PRIORITY_META[task.priority] ||
    PRIORITY_META.normal;
  const overdue = isTaskOverdue(task);

  const blockedByCount =
    taskDependencies.filter(
      (dependency) => {
        if (
          dependency.task_id !==
          task.id
        ) {
          return false;
        }

        const prerequisite =
          tasks.find(
            (candidate) =>
              candidate.id ===
              dependency.depends_on_task_id,
          );

        return (
          prerequisite &&
          prerequisite.status !==
            "completed"
        );
      },
    ).length;

  const activeReminderCount =
    taskReminderOverview.filter(
      (reminder) =>
        reminder.task_id ===
          task.id &&
        reminder.is_enabled &&
        !reminder.fired_at,
    ).length;

  const taskChecklistItems =
    taskSubtaskOverview.filter(
      (subtask) =>
        subtask.task_id ===
        task.id,
    );

  const completedChecklistItems =
    taskChecklistItems.filter(
      (subtask) =>
        subtask.is_completed,
    ).length;

  return (
    <article
      className={`${styles.taskCard} ${
        overdue ? styles.overdueTask : ""
      } ${
        isSelected
          ? styles.taskCardSelected
          : ""
      }`}
    >
      <button
        className={styles.taskMainButton}
        type="button"
        onClick={() => onOpen(task.id)}
      >
        <div className={styles.taskCardTop}>
          <span
            className={`${styles.priorityBadge} ${
              styles[priority.className]
            }`}
          >
            {priority.label}
          </span>

          <span className={styles.categoryBadge}>
            {task.category}
          </span>
        </div>

        <h3>{task.title}</h3>

        {task.description && (
          <p className={styles.taskDescription}>
            {task.description}
          </p>
        )}

        <div className={styles.taskMetadata}>
          <span
            className={
              overdue ? styles.overdueText : ""
            }
          >
            <Clock3 size={14} />
            {getTaskDeadlineLabel(task)}
          </span>

          <span>
            <UserRound size={14} />
            {assignee?.fullName || "Unassigned"}
          </span>

          {blockedByCount > 0 && (
            <span
              className={
                styles.blockedTaskMeta
              }
            >
              <AlertTriangle
                size={14}
              />
              Blocked by{" "}
              {blockedByCount}
            </span>
          )}


          {activeReminderCount > 0 && (
            <span
              className={
                styles.reminderTaskMeta
              }
            >
              <BellRing
                size={14}
              />

              {activeReminderCount}{" "}
              {activeReminderCount === 1
                ? "reminder"
                : "reminders"}
            </span>
          )}

          {taskChecklistItems.length > 0 && (
            <span
              className={
                styles.checklistTaskMeta
              }
            >
              <ClipboardCheck
                size={14}
              />

              {completedChecklistItems}/
              {taskChecklistItems.length} checklist
            </span>
          )}
        </div>

        {!!task.tags?.length && (
          <div className={styles.taskTags}>
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag}>
                <Tag size={11} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className={styles.taskCardFooter}>
        <div
          className={
            styles.taskCardSelectionMeta
          }
        >
          {canSelect ? (
            <label
              className={
                styles.taskSelectControl
              }
            >
              <input
                type="checkbox"
                checked={
                  Boolean(isSelected)
                }
                onChange={() =>
                  onSelectionChange(
                    task.id,
                  )
                }
                aria-label={`Select ${task.title}`}
              />

              <span>
                {isSelected
                  ? "Selected"
                  : "Select"}
              </span>
            </label>
          ) : null}

          <span
            className={
              styles.visibilityText
            }
          >
            {task.visibility ===
            "workspace"
              ? "Team"
              : task.visibility ===
                  "admin_only"
                ? "Leadership"
                : "Private"}
          </span>
        </div>

        <div className={styles.taskCardActions}>
          {task.status === "open" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onStatusChange(task, "in_progress")
              }
            >
              Start
            </button>
          )}

          {task.status === "in_progress" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onStatusChange(task, "completed")
              }
            >
              Complete
            </button>
          )}

          {task.status === "completed" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onStatusChange(task, "open")
              }
            >
              Reopen
            </button>
          )}

          <button
            className={styles.openTaskButton}
            type="button"
            onClick={() => onOpen(task.id)}
            aria-label={`Open ${task.title}`}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

function getRequestedTaskId() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  return (
    new URLSearchParams(
      window.location.search,
    ).get(
      "task",
    ) || ""
  );
}

function clearRequestedTaskId() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const url =
    new URL(
      window.location.href,
    );

  if (
    !url.searchParams.has(
      "task",
    )
  ) {
    return;
  }

  url.searchParams.delete(
    "task",
  );

  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export default function Tasks() {
const user = getCurrentUser();
  const currentUserId = user.id;
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
const canCreateTasks =
    hasCampaignPermission("tasks.create");

  const canAssignTasks =
    hasCampaignPermission("tasks.assign");

  const leadershipRoles = [
    "campaign_owner",
    "campaign_consultant",
    "campaign_manager",
  ];

  const isCampaignLeadership =
    canAssignTasks ||
    leadershipRoles.includes(
      user.roleKey ||
      user.assignedRole,
    );

  /*
   * Compatibility name used throughout the
   * existing Tasks interface. This now means
   * campaign leadership, not software admin.
   */
  const isAdmin = isCampaignLeadership;

  const [sidebarOpen, setSidebarOpen] =
    useState(false);
  const [selectedTaskId, setSelectedTaskId] =
    useState(
      getRequestedTaskId,
    );

  useEffect(() => {
    if (
      !getRequestedTaskId()
    ) {
      return;
    }

    /*
     * Calendar may deep-link directly into a task.
     * The task drawer keeps the selected ID after
     * the query parameter is cleaned from the URL.
     */
    clearRequestedTaskId();
  }, []);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("active");
  const [priorityFilter, setPriorityFilter] =
    useState("all");
  const [assigneeFilter, setAssigneeFilter] =
    useState(
    user.dashboardType === "command"
      ? "all"
      : "mine",
  );
  const [categoryFilter, setCategoryFilter] =
    useState("all");

  // CAMPAIGN HQ CLICKABLE TASK SUMMARY FILTERS
  const [summaryFilter, setSummaryFilter] =
    useState("");
  // CAMPAIGN SEAT TASK BULK ACTIONS
  const [
    selectedTaskIds,
    setSelectedTaskIds,
  ] = useState([]);

  const [
    bulkAction,
    setBulkAction,
  ] = useState("");

  const [
    bulkActionError,
    setBulkActionError,
  ] = useState("");

  const [
    bulkArchiveConfirm,
    setBulkArchiveConfirm,
  ] = useState(null);

  const [modalMode, setModalMode] = useState("");
  const [formData, setFormData] =
    useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  // CAMPAIGN SEAT NEW TASK PLAYBOOK / DRAFT CHECKLIST
  const [
    selectedTaskTemplateId,
    setSelectedTaskTemplateId,
  ] = useState("");

  const [
    draftChecklistItems,
    setDraftChecklistItems,
  ] = useState([]);

  const [
    draftChecklistInput,
    setDraftChecklistInput,
  ] = useState("");

  // CAMPAIGN SEAT PLAYBOOK MANAGER
  const [
    playbookManagerOpen,
    setPlaybookManagerOpen,
  ] = useState(false);

  const [
    editingPlaybookId,
    setEditingPlaybookId,
  ] = useState("");

  const [
    playbookForm,
    setPlaybookForm,
  ] = useState(
    EMPTY_PLAYBOOK_FORM,
  );

  const [
    playbookChecklistItems,
    setPlaybookChecklistItems,
  ] = useState([]);

  const [
    playbookChecklistInput,
    setPlaybookChecklistInput,
  ] = useState("");

  const [
    playbookSaveError,
    setPlaybookSaveError,
  ] = useState("");
  const [commentBody, setCommentBody] =
    useState("");

  const [
    newSubtaskTitle,
    setNewSubtaskTitle,
  ] = useState("");

  const [
    editingSubtaskId,
    setEditingSubtaskId,
  ] = useState("");

  const [
    editingSubtaskTitle,
    setEditingSubtaskTitle,
  ] = useState("");

  const [
    checklistError,
    setChecklistError,
  ] = useState("");

  const [
    newDependencyTaskId,
    setNewDependencyTaskId,
  ] = useState("");

  const [
    taskDependencyError,
    setTaskDependencyError,
  ] = useState("");

  const [
    quickDependencyTitle,
    setQuickDependencyTitle,
  ] = useState("");


  // CAMPAIGN SEAT TASK RECURRENCE DRAWER
  const [
    recurrenceUnit,
    setRecurrenceUnit,
  ] = useState("week");

  const [
    recurrenceInterval,
    setRecurrenceInterval,
  ] = useState("1");

  const [
    recurrenceEndDate,
    setRecurrenceEndDate,
  ] = useState("");

  const [
    recurrenceError,
    setRecurrenceError,
  ] = useState("");

  const [
    recurrenceRemoveConfirmOpen,
    setRecurrenceRemoveConfirmOpen,
  ] = useState(false);

  const [
    archiveConfirmOpen,
    setArchiveConfirmOpen,
  ] = useState(false);

  // CAMPAIGN SEAT TASK REMINDER UI
  const [
    reminderScheduleType,
    setReminderScheduleType,
  ] = useState(
    "before_due",
  );

  const [
    reminderOffsetMinutes,
    setReminderOffsetMinutes,
  ] = useState("60");

  const [
    reminderExactDate,
    setReminderExactDate,
  ] = useState(
    getDefaultReminderExactDate,
  );

  const [
    reminderExactTime,
    setReminderExactTime,
  ] = useState(
    getDefaultReminderExactTime,
  );

  const [
    reminderRecipientScope,
    setReminderRecipientScope,
  ] = useState(
    "assignee",
  );

  const [
    reminderMessage,
    setReminderMessage,
  ] = useState("");

  const [
    reminderError,
    setReminderError,
  ] = useState("");


  const [
    editingReminderId,
    setEditingReminderId,
  ] = useState("");

  const [
    reminderDatePickerOpen,
    setReminderDatePickerOpen,
  ] = useState(false);

  const [
    reminderTimePickerOpen,
    setReminderTimePickerOpen,
  ] = useState(false);

  const [
    reminderCalendarMonth,
    setReminderCalendarMonth,
  ] = useState(
    getReminderCalendarMonthValue(
      getDefaultReminderExactDate(),
    ),
  );


  const reminderTimePickerRef =
    useRef(null);




  // CAMPAIGN SEAT TIME PICKER AUTO-SCROLL
  useEffect(() => {
    if (
      !reminderTimePickerOpen
    ) {
      return undefined;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          const picker =
            reminderTimePickerRef.current;

          if (!picker) {
            return;
          }

          const selected =
            picker.querySelector(
              '[data-reminder-time-selected="true"]',
            );

          selected?.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "auto",
          });
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, [
    reminderExactTime,
    reminderTimePickerOpen,
  ]);

  // CAMPAIGN SEAT TASK ATTACHMENTS UI
  const taskAttachmentInputRef =
    useRef(null);

  const [
    selectedCampaignFileId,
    setSelectedCampaignFileId,
  ] = useState("");

  const [
    attachmentActionError,
    setAttachmentActionError,
  ] = useState("");


  // CAMPAIGN HQ TASK UX FIX
  const drawerBodyRef = useRef(null);

  // CAMPAIGN SEAT TASK MODAL SCROLL RESET
  const taskModalRef = useRef(null);
  const taskFormRef = useRef(null);

  const {
    tasks,
    team,
    comments,
    subtasks,
    isSubtasksLoading,
    taskDependencies,
    isDependenciesLoading,
    taskReminders,
    isRemindersLoading,
    taskReminderOverview,
    taskSubtaskOverview,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    createTask,
    updateTask,
    changeTaskStatus,
    bulkUpdateTasks,
    loadActiveTaskRecurrencesForTasks,
    removeTaskRecurrencesForTasks,
    addComment,
    createSubtasksBatch,
    addSubtask,
    toggleSubtask,
    renameSubtask,
    deleteSubtask,
    addTaskDependency,
    deleteTaskDependency,

    taskAttachments,
    isAttachmentsLoading,
    taskAttachmentError,
    attachTaskFile,
    unlinkTaskAttachment,

    createTaskReminder,
    updateTaskReminder,
    deleteTaskReminder,

    taskTemplates,
    isTaskTemplatesLoading,
    taskTemplateError,
    loadTaskTemplates,
    createTaskTemplate,
    updateTaskTemplate,
    archiveTaskTemplate,

    taskRecurrenceRule,
    isRecurrenceLoading,
    createTaskRecurrence,
    setTaskRecurrenceEnabled,
    removeTaskRecurrence,
  } = useTasksCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
    selectedTaskId,
  });

  const selectedTask = tasks.find(
    (task) => task.id === selectedTaskId,
  );


  // CAMPAIGN SEAT TASK ATTACHMENTS UI
  const {
    files: campaignFiles,
    isLoading:
      isCampaignFilesLoading,
    isSaving:
      isCampaignFileSaving,
    error:
      campaignFilesError,
    uploadFiles:
      uploadCampaignFiles,
    openFile:
      openCampaignFile,
  } = useFilesCommandCenter({
    workspaceId:
      workspace.id,
    userId:
      user.id,
  });


  const attachedCampaignFileIds =
    useMemo(
      () =>
        new Set(
          taskAttachments
            .map(
              (attachment) =>
                attachment.file_id,
            )
            .filter(Boolean),
        ),
      [
        taskAttachments,
      ],
    );


  const availableCampaignFiles =
    useMemo(
      () =>
        campaignFiles.filter(
          (file) =>
            !attachedCampaignFileIds.has(
              file.id,
            ),
        ),
      [
        attachedCampaignFileIds,
        campaignFiles,
      ],
    );


  const formatTaskAttachmentSize =
    (value) => {
      const bytes =
        Number(value || 0);

      if (bytes < 1024) {
        return `${bytes} B`;
      }

      if (
        bytes <
        1024 * 1024
      ) {
        return `${(
          bytes / 1024
        ).toFixed(1)} KB`;
      }

      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    };


  const handleTaskAttachmentUpload =
    async (event) => {
      const selectedFiles =
        Array.from(
          event.target.files ||
          [],
        );

      event.target.value = "";

      if (
        !selectedTask?.id ||
        !selectedFiles.length
      ) {
        return;
      }

      setAttachmentActionError("");

      try {
        const uploaded =
          await uploadCampaignFiles(
            selectedFiles,
            "Task Attachments",
          );

        for (
          const file of uploaded
        ) {
          await attachTaskFile(
            selectedTask.id,
            file.id,
          );
        }
      } catch (uploadError) {
        console.error(
          "Task attachment upload failed:",
          uploadError,
        );

        setAttachmentActionError(
          uploadError?.message ||
            "The file could not be uploaded and attached.",
        );
      }
    };


  const handleAttachExistingCampaignFile =
    async () => {
      if (
        !selectedTask?.id ||
        !selectedCampaignFileId
      ) {
        return;
      }

      setAttachmentActionError("");

      try {
        await attachTaskFile(
          selectedTask.id,
          selectedCampaignFileId,
        );

        setSelectedCampaignFileId(
          "",
        );
      } catch (attachError) {
        console.error(
          "Existing campaign file could not be attached:",
          attachError,
        );

        setAttachmentActionError(
          attachError?.message ||
            "The campaign file could not be attached.",
        );
      }
    };


  const handleUnlinkTaskAttachment =
    async (attachment) => {
      const fileName =
        attachment?.file?.file_name ||
        "this file";

      if (
        !window.confirm(
          `Remove ${fileName} from this task? The file will stay in Campaign Files.`,
        )
      ) {
        return;
      }

      setAttachmentActionError("");

      try {
        await unlinkTaskAttachment(
          attachment,
        );
      } catch (unlinkError) {
        console.error(
          "Task attachment could not be removed:",
          unlinkError,
        );

        setAttachmentActionError(
          unlinkError?.message ||
            "The attachment could not be removed from this task.",
        );
      }
    };


  // CAMPAIGN SEAT TASK MODAL ALWAYS OPENS AT TOP
  useEffect(() => {
    if (!modalMode) {
      return undefined;
    }

    let secondFrame = null;

    const resetModalScroll = () => {
      taskModalRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });

      taskFormRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });

      if (taskModalRef.current) {
        taskModalRef.current.scrollTop = 0;
      }

      if (taskFormRef.current) {
        taskFormRef.current.scrollTop = 0;
      }
    };

    const firstFrame =
      window.requestAnimationFrame(
        () => {
          resetModalScroll();

          /*
           * Run again after autofocus/layout settles.
           * This prevents the browser from restoring
           * an old scroll position inside the form.
           */
          secondFrame =
            window.requestAnimationFrame(
              resetModalScroll,
            );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        firstFrame,
      );

      if (secondFrame !== null) {
        window.cancelAnimationFrame(
          secondFrame,
        );
      }
    };
  }, [modalMode]);


  const completedSubtaskCount =
    subtasks.filter(
      (subtask) =>
        subtask.is_completed,
    ).length;

  const checklistProgress =
    subtasks.length
      ? Math.round(
          (
            completedSubtaskCount /
            subtasks.length
          ) * 100,
        )
      : 0;


  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      drawerBodyRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [selectedTaskId]);
  useEffect(() => {
    setNewSubtaskTitle("");
    setEditingSubtaskId("");
    setEditingSubtaskTitle("");
    setChecklistError("");
    setNewDependencyTaskId("");
    setTaskDependencyError("");
    setQuickDependencyTitle("");

    setRecurrenceUnit(
      "week",
    );

    setRecurrenceInterval(
      "1",
    );

    setRecurrenceEndDate(
      "",
    );

    setRecurrenceError(
      "",
    );

    setRecurrenceRemoveConfirmOpen(
      false,
    );

    setArchiveConfirmOpen(
      false,
    );

    setReminderScheduleType(
      selectedTask?.due_at
        ? "before_due"
        : "exact",
    );

    setReminderOffsetMinutes(
      "60",
    );

    setReminderExactDate(
      getDefaultReminderExactDate(),
    );

    setReminderExactTime(
      getDefaultReminderExactTime(),
    );

    setReminderRecipientScope(
      "assignee",
    );

    setReminderMessage("");
    setReminderError("");

    setEditingReminderId("");

    setReminderDatePickerOpen(
      false,
    );

    setReminderTimePickerOpen(
      false,
    );

    setReminderCalendarMonth(
      getReminderCalendarMonthValue(
        getDefaultReminderExactDate(),
      ),
    );
  }, [selectedTaskId]);

  const categories = useMemo(() => {
    return [
      ...new Set([
        ...CATEGORY_OPTIONS,
        ...tasks.map((task) => task.category),
      ]),
    ].filter(Boolean);
  }, [tasks]);

  const taskById =
    new Map(
      tasks.map(
        (task) => [
          task.id,
          task,
        ],
      ),
    );

  const selectedBlockedBy =
    taskDependencies
      .filter(
        (dependency) =>
          dependency.task_id ===
          selectedTaskId,
      )
      .map(
        (dependency) => ({
          dependency,
          task:
            taskById.get(
              dependency.depends_on_task_id,
            ) || null,
        }),
      )
      .filter(
        (item) =>
          Boolean(item.task),
      );

  const selectedBlocking =
    taskDependencies
      .filter(
        (dependency) =>
          dependency.depends_on_task_id ===
          selectedTaskId,
      )
      .map(
        (dependency) => ({
          dependency,
          task:
            taskById.get(
              dependency.task_id,
            ) || null,
        }),
      )
      .filter(
        (item) =>
          Boolean(item.task),
      );

  const selectedOpenBlockers =
    selectedBlockedBy.filter(
      (item) =>
        item.task.status !==
        "completed",
    );

  const selectedTaskBlocked =
    selectedOpenBlockers.length >
    0;

  const dependencyCandidates =
    tasks
      .filter(
        (task) =>
          task.id !==
            selectedTaskId &&
          task.status !==
            "archived" &&
          !selectedBlockedBy.some(
            (item) =>
              item.task.id ===
              task.id,
          ),
      )
      .sort(
        (left, right) => {
          const leftCompleted =
            left.status ===
            "completed";

          const rightCompleted =
            right.status ===
            "completed";

          if (
            leftCompleted !==
            rightCompleted
          ) {
            return leftCompleted
              ? 1
              : -1;
          }

          return left.title.localeCompare(
            right.title,
          );
        },
      );

  const activeDependencyCandidates =
    dependencyCandidates.filter(
      (task) =>
        task.status !==
        "completed",
    );

  const completedDependencyCandidates =
    dependencyCandidates.filter(
      (task) =>
        task.status ===
        "completed",
    );

  const blockedTaskIds =
    new Set(
      taskDependencies
        .filter(
          (dependency) => {
            const prerequisite =
              taskById.get(
                dependency.depends_on_task_id,
              );

            return (
              prerequisite &&
              prerequisite.status !==
                "completed"
            );
          },
        )
        .map(
          (dependency) =>
            dependency.task_id,
        ),
    );

  const activeTasks = tasks.filter(
    (task) =>
      !["completed", "archived"].includes(
        task.status,
      ),
  );

  const activeTaskIds =
    new Set(
      activeTasks.map(
        (task) => task.id,
      ),
    );

  const scheduledReminders =
    taskReminderOverview.filter(
      (reminder) =>
        reminder.is_enabled &&
        !reminder.fired_at &&
        activeTaskIds.has(
          reminder.task_id,
        ),
    );

  const scheduledReminderTaskIds =
    new Set(
      scheduledReminders.map(
        (reminder) =>
          reminder.task_id,
      ),
    );

  const overdueTasks = activeTasks.filter(
    isTaskOverdue,
  );

  const dueTodayTasks = activeTasks.filter(
    (task) =>
      task.due_at &&
      isSameCalendarDay(
        new Date(task.due_at),
        new Date(),
      ),
  );

  const recentlyCompleted = tasks.filter(
    (task) => {
      if (
        task.status !== "completed" ||
        !task.completed_at
      ) {
        return false;
      }

      return (
        (lastUpdated?.getTime() || 0) -
          new Date(task.completed_at).getTime() <=
        7 * 24 * 60 * 60 * 1000
      );
    },
  );

  const unassignedTasks = activeTasks.filter(
    (task) => !task.assigned_to,
  );

  const blockedTasks =
    activeTasks.filter(
      (task) =>
        blockedTaskIds.has(
          task.id,
        ),
    );


  const urgentTasks =
    activeTasks.filter(
      (task) =>
        task.priority ===
        "urgent",
    );

  const highPriorityTasks =
    activeTasks.filter(
      (task) =>
        task.priority ===
        "high",
    );

  const myActiveTasks =
    activeTasks.filter(
      (task) =>
        task.assigned_to ===
        currentUserId,
    );

  const teamWorkload =
    team
      .map((member) => {
        const assigned =
          activeTasks.filter(
            (task) =>
              task.assigned_to ===
              member.id,
          );

        const overdue =
          assigned.filter(
            isTaskOverdue,
          );

        const urgent =
          assigned.filter(
            (task) =>
              task.priority ===
              "urgent",
          );

        return {
          ...member,

          activeCount:
            assigned.length,

          overdueCount:
            overdue.length,

          urgentCount:
            urgent.length,
        };
      })
      .filter(
        (member) =>
          member.activeCount >
          0,
      )
      .sort(
        (left, right) => {
          if (
            left.overdueCount !==
            right.overdueCount
          ) {
            return (
              right.overdueCount -
              left.overdueCount
            );
          }

          if (
            left.urgentCount !==
            right.urgentCount
          ) {
            return (
              right.urgentCount -
              left.urgentCount
            );
          }

          return (
            right.activeCount -
            left.activeCount
          );
        },
      );

  const overdueTaskIds =
    new Set(
      overdueTasks.map(
        (task) => task.id,
      ),
    );

  const dueTodayTaskIds =
    new Set(
      dueTodayTasks.map(
        (task) => task.id,
      ),
    );

  const recentlyCompletedTaskIds =
    new Set(
      recentlyCompleted.map(
        (task) => task.id,
      ),
    );

  const unassignedTaskIds =
    new Set(
      unassignedTasks.map(
        (task) => task.id,
      ),
    );

  // CAMPAIGN HQ TASK FILTER COMPILER FIX
  // Derived during render; React Compiler can optimize it.
  const filteredTasks = (() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (
          statusFilter === "active" &&
          ["completed", "archived"].includes(
            task.status,
          )
        ) {
          return false;
        }

        if (
          !["all", "active"].includes(statusFilter) &&
          task.status !== statusFilter
        ) {
          return false;
        }

        if (
          summaryFilter === "overdue" &&
          !overdueTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          summaryFilter === "due_today" &&
          !dueTodayTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          summaryFilter === "completed_week" &&
          !recentlyCompletedTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          summaryFilter === "blocked" &&
          !blockedTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          summaryFilter ===
            "scheduled_reminders" &&
          !scheduledReminderTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          summaryFilter === "unassigned" &&
          !unassignedTaskIds.has(
            task.id,
          )
        ) {
          return false;
        }

        if (
          priorityFilter !== "all" &&
          task.priority !== priorityFilter
        ) {
          return false;
        }

        if (
          categoryFilter !== "all" &&
          task.category !== categoryFilter
        ) {
          return false;
        }

        if (
          assigneeFilter === "mine" &&
          task.assigned_to !== currentUserId
        ) {
          return false;
        }

        if (
          assigneeFilter === "unassigned" &&
          task.assigned_to
        ) {
          return false;
        }

        if (
          !["all", "mine", "unassigned"].includes(
            assigneeFilter,
          ) &&
          task.assigned_to !== assigneeFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchText = [
          task.title,
          task.description,
          task.category,
          ...(task.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const priorityOrder = {
          urgent: 0,
          high: 1,
          normal: 2,
          low: 3,
        };

        const leftOverdue = isTaskOverdue(left);
        const rightOverdue = isTaskOverdue(right);

        if (leftOverdue !== rightOverdue) {
          return leftOverdue ? -1 : 1;
        }

        if (
          priorityOrder[left.priority] !==
          priorityOrder[right.priority]
        ) {
          return (
            priorityOrder[left.priority] -
            priorityOrder[right.priority]
          );
        }

        if (left.due_at && right.due_at) {
          return (
            new Date(left.due_at).getTime() -
            new Date(right.due_at).getTime()
          );
        }

        return left.due_at ? -1 : 1;
      });
  })();

  const applySummaryFilter =
    (value) => {
      setSummaryFilter(
        value,
      );

      setSearch("");
      setPriorityFilter("all");
      setCategoryFilter("all");

      if (
        value === "completed_week"
      ) {
        setStatusFilter(
          "completed",
        );

        setAssigneeFilter(
          "all",
        );

        setViewMode(
          "list",
        );

        return;
      }

      if (
        value === "unassigned"
      ) {
        setStatusFilter(
          "active",
        );

        setAssigneeFilter(
          "unassigned",
        );

        setViewMode(
          "list",
        );

        return;
      }

      setStatusFilter(
        "active",
      );

      setAssigneeFilter(
        "all",
      );

      setViewMode(
        "list",
      );
    };

  const canEditSelectedTask =
    selectedTask &&
    (isAdmin ||
      selectedTask.assigned_to === user.id ||
      selectedTask.created_by === user.id);

  const openCreateModal = () => {
    setFormData({
      ...EMPTY_FORM,
      assignedTo: isAdmin ? "" : user.id,
    });
    setSelectedTaskTemplateId("");
    setDraftChecklistItems([]);
    setDraftChecklistInput("");
    setFormError("");
    setModalMode("create");
  };

  const openEditModal = (task) => {
    const dueParts = getDateParts(task.due_at);

    setFormData({
      title: task.title,
      description: task.description || "",
      category: task.category || "General",
      priority: task.priority || "normal",
      status: task.status || "open",
      assignedTo: task.assigned_to || "",
      dueDate: dueParts.date,
      dueTime: dueParts.time,
      visibility:
        task.visibility || "workspace",
      tags: (task.tags || []).join(", "),
      estimatedMinutes:
        task.estimated_minutes?.toString() || "",
    });

    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setModalMode("");
    setFormError("");
  };

  const resetPlaybookEditor =
    () => {
      setEditingPlaybookId("");

      setPlaybookForm({
        ...EMPTY_PLAYBOOK_FORM,
      });

      setPlaybookChecklistItems(
        [],
      );

      setPlaybookChecklistInput(
        "",
      );

      setPlaybookSaveError(
        "",
      );
    };


  const loadPlaybookIntoEditor =
    (template) => {
      if (!template) {
        resetPlaybookEditor();
        return;
      }

      setEditingPlaybookId(
        template.id,
      );

      setPlaybookForm({
        name:
          template.name ||
          "",

        taskTitle:
          template.task_title ||
          "",

        taskDescription:
          template.task_description ||
          "",

        category:
          template.category ||
          "General",

        priority:
          template.priority ||
          "normal",

        visibility:
          template.visibility ||
          "workspace",

        tags:
          (
            template.tags ||
            []
          ).join(", "),

        estimatedMinutes:
          template
            .estimated_minutes
            ?.toString() ||
          "",
      });

      setPlaybookChecklistItems(
        (
          template.checklistItems ||
          []
        ).map(
          (item) => ({
            key:
              item.id,

            title:
              item.title,
          }),
        ),
      );

      setPlaybookChecklistInput(
        "",
      );

      setPlaybookSaveError(
        "",
      );
    };


  const openPlaybookManager =
    () => {
      setPlaybookManagerOpen(
        true,
      );

      if (taskTemplates.length) {
        loadPlaybookIntoEditor(
          taskTemplates[0],
        );
      } else {
        resetPlaybookEditor();
      }
    };


  const openSaveTaskAsPlaybook =
    () => {
      if (!selectedTask) {
        return;
      }

      setEditingPlaybookId("");

      setPlaybookForm({
        name:
          selectedTask.title ||
          "",

        taskTitle:
          selectedTask.title ||
          "",

        taskDescription:
          selectedTask.description ||
          "",

        category:
          selectedTask.category ||
          "General",

        priority:
          selectedTask.priority ||
          "normal",

        visibility:
          selectedTask.visibility ||
          "workspace",

        tags:
          (
            selectedTask.tags ||
            []
          ).join(", "),

        estimatedMinutes:
          selectedTask
            .estimated_minutes
            ?.toString() ||
          "",
      });

      setPlaybookChecklistItems(
        subtasks.map(
          (item) => ({
            key:
              item.id,

            title:
              item.title,
          }),
        ),
      );

      setPlaybookChecklistInput(
        "",
      );

      setPlaybookSaveError(
        "",
      );

      setPlaybookManagerOpen(
        true,
      );
    };


  const handlePlaybookFieldChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setPlaybookForm(
        (current) => ({
          ...current,
          [name]: value,
        }),
      );

      setPlaybookSaveError(
        "",
      );
    };


  const addPlaybookChecklistItem =
    () => {
      const title =
        playbookChecklistInput
          .trim();

      if (!title) {
        return;
      }

      setPlaybookChecklistItems(
        (current) => [
          ...current,

          {
            key:
              `playbook-${Date.now()}-${current.length}`,

            title,
          },
        ],
      );

      setPlaybookChecklistInput(
        "",
      );
    };


  const removePlaybookChecklistItem =
    (itemKey) => {
      setPlaybookChecklistItems(
        (current) =>
          current.filter(
            (item) =>
              item.key !==
              itemKey,
          ),
      );
    };


  const handleSavePlaybook =
    async (event) => {
      event.preventDefault();

      setPlaybookSaveError(
        "",
      );

      if (
        !playbookForm.name
          .trim()
      ) {
        setPlaybookSaveError(
          "Give this campaign playbook a name.",
        );

        return;
      }

      if (
        !playbookForm.taskTitle
          .trim()
      ) {
        setPlaybookSaveError(
          "Add the task title this playbook should create.",
        );

        return;
      }

      const templateData = {
        name:
          playbookForm.name
            .trim(),

        task_title:
          playbookForm.taskTitle
            .trim(),

        task_description:
          playbookForm
            .taskDescription
            .trim() ||
          null,

        category:
          playbookForm.category ||
          "General",

        priority:
          playbookForm.priority ||
          "normal",

        visibility:
          playbookForm.visibility ||
          "workspace",

        tags:
          playbookForm.tags
            .split(",")
            .map(
              (tag) =>
                tag.trim(),
            )
            .filter(Boolean),

        estimated_minutes:
          playbookForm
            .estimatedMinutes
            ? Number(
                playbookForm
                  .estimatedMinutes,
              )
            : null,
      };

      const checklistTitles =
        playbookChecklistItems.map(
          (item) =>
            item.title,
        );

      try {
        let savedTemplate = null;

        if (editingPlaybookId) {
          savedTemplate =
            await updateTaskTemplate(
              editingPlaybookId,
              templateData,
              checklistTitles,
            );
        } else {
          savedTemplate =
            await createTaskTemplate(
              templateData,
              checklistTitles,
            );
        }

        const refreshed =
          await loadTaskTemplates();

        const nextTemplate =
          refreshed.find(
            (template) =>
              template.id ===
              savedTemplate?.id,
          ) ||
          refreshed[0] ||
          null;

        if (nextTemplate) {
          loadPlaybookIntoEditor(
            nextTemplate,
          );

          /*
           * If New Task is open, the new
           * playbook immediately becomes
           * selectable there.
           */
          setSelectedTaskTemplateId(
            nextTemplate.id,
          );
        } else {
          resetPlaybookEditor();
        }
      } catch (saveError) {
        console.error(
          "Campaign playbook could not be saved:",
          saveError,
        );

        setPlaybookSaveError(
          saveError?.message ||
            "The campaign playbook could not be saved.",
        );
      }
    };


  const handleArchivePlaybook =
    async () => {
      if (!editingPlaybookId) {
        return;
      }

      const template =
        taskTemplates.find(
          (candidate) =>
            candidate.id ===
            editingPlaybookId,
        );

      const confirmed =
        window.confirm(
          `Archive ${
            template?.name ||
            "this playbook"
          }? It will stop appearing in Start from template, but existing tasks created from it will stay unchanged.`,
        );

      if (!confirmed) {
        return;
      }

      setPlaybookSaveError(
        "",
      );

      try {
        await archiveTaskTemplate(
          editingPlaybookId,
        );

        const refreshed =
          await loadTaskTemplates();

        if (refreshed.length) {
          loadPlaybookIntoEditor(
            refreshed[0],
          );
        } else {
          resetPlaybookEditor();
        }

        if (
          selectedTaskTemplateId ===
          editingPlaybookId
        ) {
          setSelectedTaskTemplateId(
            "",
          );
        }
      } catch (archiveError) {
        console.error(
          "Campaign playbook could not be archived:",
          archiveError,
        );

        setPlaybookSaveError(
          archiveError?.message ||
            "The campaign playbook could not be archived.",
        );
      }
    };


  const handleTaskTemplateChange =
    (event) => {
      const templateId =
        event.target.value;

      setSelectedTaskTemplateId(
        templateId,
      );

      setFormError("");

      if (!templateId) {
        setDraftChecklistItems(
          [],
        );

        return;
      }

      const template =
        taskTemplates.find(
          (candidate) =>
            candidate.id ===
            templateId,
        );

      if (!template) {
        setFormError(
          "That campaign playbook is no longer available.",
        );

        return;
      }

      setFormData(
        (current) => ({
          ...current,

          title:
            template.task_title ||
            "",

          description:
            template.task_description ||
            "",

          category:
            template.category ||
            "General",

          priority:
            template.priority ||
            "normal",

          visibility:
            template.visibility ===
              "admin_only" &&
            !isAdmin
              ? "workspace"
              : (
                  template.visibility ||
                  "workspace"
                ),

          tags:
            (
              template.tags ||
              []
            ).join(", "),

          estimatedMinutes:
            template
              .estimated_minutes
              ?.toString() ||
            "",
        }),
      );

      setDraftChecklistItems(
        (
          template.checklistItems ||
          []
        ).map(
          (item) => ({
            key:
              item.id,

            title:
              item.title,
          }),
        ),
      );

      setDraftChecklistInput(
        "",
      );
    };

  const addDraftChecklistItem =
    () => {
      const title =
        draftChecklistInput.trim();

      if (!title) {
        return;
      }

      setDraftChecklistItems(
        (current) => [
          ...current,
          {
            key:
              `draft-${Date.now()}-${current.length}`,

            title,
          },
        ],
      );

      setDraftChecklistInput(
        "",
      );
    };

  const removeDraftChecklistItem =
    (itemKey) => {
      setDraftChecklistItems(
        (current) =>
          current.filter(
            (item) =>
              item.key !==
              itemKey,
          ),
      );
    };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setFormError("Enter a clear task title.");
      return;
    }

    if (
      formData.visibility === "admin_only" &&
      !isAdmin
    ) {
      setFormError(
        "Only campaign leadership can create leadership-only tasks.",
      );
      return;
    }

    let dueAt = null;

    if (formData.dueDate) {
      const localDate = new Date(
        `${formData.dueDate}T${
          formData.dueTime || "17:00"
        }`,
      );

      dueAt = localDate.toISOString();
    }

    const wantsRepeat =
      modalMode === "create" &&
      formData.repeatMode !== "none";

    let recurrenceData = null;

    if (wantsRepeat) {
      if (!dueAt) {
        setFormError(
          "Add a deadline before creating a repeating task.",
        );
        return;
      }

      let recurrenceUnit = "week";
      let intervalCount = 1;

      if (formData.repeatMode === "daily") {
        recurrenceUnit = "day";
      } else if (
        formData.repeatMode === "weekly"
      ) {
        recurrenceUnit = "week";
      } else if (
        formData.repeatMode === "monthly"
      ) {
        recurrenceUnit = "month";
      } else if (
        formData.repeatMode === "custom"
      ) {
        recurrenceUnit =
          formData.repeatUnit || "week";

        intervalCount =
          Number(formData.repeatInterval);

        if (
          !Number.isInteger(intervalCount) ||
          intervalCount < 1 ||
          intervalCount > 365
        ) {
          setFormError(
            "Custom repeat interval must be between 1 and 365.",
          );
          return;
        }
      }

      let recurrenceEndAt = null;

      if (formData.repeatEndDate) {
        const localEndDate = new Date(
          `${formData.repeatEndDate}T23:59:59`,
        );

        if (
          Number.isNaN(
            localEndDate.getTime(),
          )
        ) {
          setFormError(
            "Choose a valid repeat end date.",
          );
          return;
        }

        if (
          localEndDate.getTime() <=
          new Date(dueAt).getTime()
        ) {
          setFormError(
            "The repeat end date must be after the first deadline.",
          );
          return;
        }

        recurrenceEndAt =
          localEndDate.toISOString();
      }

      recurrenceData = {
        recurrence_unit:
          recurrenceUnit,

        interval_count:
          intervalCount,

        end_at:
          recurrenceEndAt,

        schedule_timezone:
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone ||
          "America/New_York",
      };
    }

    const taskData = {
      title: formData.title.trim(),
      description:
        formData.description.trim() || null,
      category: formData.category,
      priority: formData.priority,
      status: formData.status,
      assigned_to:
        formData.assignedTo || null,
      due_at: dueAt,
      visibility: formData.visibility,
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      estimated_minutes:
        formData.estimatedMinutes
          ? Number(formData.estimatedMinutes)
          : null,
    };

    try {
      if (
        modalMode === "edit" &&
        selectedTask
      ) {
        await updateTask(
          selectedTask.id,
          taskData,
        );
      } else {
        const createdTask =
          await createTask(taskData);

        setSelectedTaskId(createdTask.id);

        if (
          draftChecklistItems.length
        ) {
          try {
            await createSubtasksBatch(
              createdTask.id,
              draftChecklistItems.map(
                (item) =>
                  item.title,
              ),
            );
          } catch (checklistSaveError) {
            console.error(
              "Task was created but its checklist could not be created:",
              checklistSaveError,
            );

            /*
             * The task already exists.
             * Close the create modal so a second submit
             * cannot accidentally create a duplicate.
             */
            setModalMode("");
            setFormError("");

            setChecklistError(
              checklistSaveError?.message ||
                "The task was created, but its checklist could not be copied. You can add checklist items from Task Details.",
            );

            return;
          }
        }

        /*
         * Recurrence comes AFTER the checklist so the
         * recurrence rule snapshots the completed blueprint.
         */
        if (recurrenceData) {
          try {
            await createTaskRecurrence(
              createdTask.id,
              recurrenceData,
            );
          } catch (recurrenceSaveError) {
            console.error(
              "Task was created but recurrence could not be created:",
              recurrenceSaveError,
            );

            /*
             * Do NOT leave the create modal open after
             * the task itself has already been inserted.
             * That could cause an accidental duplicate.
             */
            setModalMode("");
            setFormError("");

            setRecurrenceError(
              recurrenceSaveError?.message ||
                "The task was created, but its repeat schedule could not be created. You can add the repeat schedule from Task Details.",
            );

            return;
          }
        }
      }

      setModalMode("");
      setFormError("");
    } catch (saveError) {
      console.error(
        "Campaign task could not be saved:",
        saveError,
      );

      setFormError(
        saveError?.message ||
          "The task could not be saved.",
      );
    }
  };

  const handleStatusChange = async (
    task,
    nextStatus,
  ) => {
    try {
      await changeTaskStatus(task, nextStatus);
    } catch (statusError) {
      console.error(
        "Task status could not be changed:",
        statusError,
      );
    }
  };

  const archiveSelectedTask =
    async ({
      stopRepeating = false,
    } = {}) => {
      if (!selectedTask) {
        return;
      }

      try {
        if (
          stopRepeating &&
          taskRecurrenceRule
        ) {
          await removeTaskRecurrence(
            taskRecurrenceRule,
          );
        }

        await changeTaskStatus(
          selectedTask,
          "archived",
        );

        setArchiveConfirmOpen(false);
        setSelectedTaskId("");
      } catch (archiveError) {
        console.error(
          "Task could not be archived:",
          archiveError,
        );

        setRecurrenceError(
          archiveError?.message ||
            "The task could not be archived.",
        );
      }
    };

  const handleArchive = async () => {
    if (!selectedTask) {
      return;
    }

    if (
      taskRecurrenceRule?.is_enabled
    ) {
      setArchiveConfirmOpen(true);
      return;
    }

    await archiveSelectedTask();
  };

  const cancelReminderEdit =
    () => {
      setEditingReminderId(
        "",
      );

      setReminderScheduleType(
        selectedTask?.due_at
          ? "before_due"
          : "exact",
      );

      setReminderOffsetMinutes(
        "60",
      );

      const nextDate =
        getDefaultReminderExactDate();

      setReminderExactDate(
        nextDate,
      );

      setReminderExactTime(
        getDefaultReminderExactTime(),
      );

      setReminderCalendarMonth(
        getReminderCalendarMonthValue(
          nextDate,
        ),
      );

      setReminderRecipientScope(
        "assignee",
      );

      setReminderMessage("");
      setReminderError("");

      setReminderDatePickerOpen(
        false,
      );

      setReminderTimePickerOpen(
        false,
      );
    };

  const beginEditTaskReminder =
    (reminder) => {
      setReminderError("");

      setReminderDatePickerOpen(
        false,
      );

      setReminderTimePickerOpen(
        false,
      );

      /*
       * Treat exact_at as authoritative.
       * This also protects older reminders whose
       * schedule_type may be absent or stale.
       */
      const isExactReminder =
        reminder.schedule_type ===
          "exact" ||
        Boolean(reminder.exact_at);

      const normalizedScheduleType =
        isExactReminder
          ? "exact"
          : (
              reminder.schedule_type ===
                "before_due" ||
              reminder.schedule_type ===
                "overdue"
            )
            ? "before_due"
            : selectedTask?.due_at
              ? "before_due"
              : "exact";

      setReminderScheduleType(
        normalizedScheduleType,
      );

      setReminderOffsetMinutes(
        String(
          reminder.offset_minutes ??
          60,
        ),
      );

      setReminderRecipientScope(
        reminder.recipient_scope ||
        "assignee",
      );

      setReminderMessage(
        reminder.message ||
        "",
      );

      /*
       * A sent reminder is historical.
       * Reuse it as a new reminder instead
       * of rewriting the old delivery.
       */
      if (reminder.fired_at) {
        setEditingReminderId(
          "",
        );

        if (isExactReminder) {
          const nextDate =
            getDefaultReminderExactDate();

          setReminderExactDate(
            nextDate,
          );

          setReminderExactTime(
            getDefaultReminderExactTime(),
          );

          setReminderCalendarMonth(
            getReminderCalendarMonthValue(
              nextDate,
            ),
          );
        }

        return;
      }

      setEditingReminderId(
        reminder.id,
      );

      if (isExactReminder) {
        const parts =
          getDateParts(
            reminder.exact_at ||
            reminder.next_fire_at,
          );

        const dateValue =
          parts.date ||
          getDefaultReminderExactDate();

        setReminderExactDate(
          dateValue,
        );

        setReminderExactTime(
          normalizeReminderTimeToQuarter(
            parts.time,
          ),
        );

        setReminderCalendarMonth(
          getReminderCalendarMonthValue(
            dateValue,
          ),
        );
      }
    };

  const handleCreateTaskReminder =
    async (event) => {
      event.preventDefault();

      setReminderError("");

      if (
        !selectedTask ||
        !canEditSelectedTask
      ) {
        return;
      }

      const relativeReminder =
        reminderScheduleType !==
        "exact";

      if (
        relativeReminder &&
        !selectedTask.due_at
      ) {
        setReminderError(
          "Add a task deadline before creating a deadline-based reminder.",
        );

        return;
      }

      let exactAt = null;
      let offsetMinutes = null;

      if (
        reminderScheduleType ===
        "exact"
      ) {
        if (
          !reminderExactDate ||
          !reminderExactTime
        ) {
          setReminderError(
            "Choose the date and time for this reminder.",
          );

          return;
        }

        const exactDate =
          new Date(
            `${reminderExactDate}T${reminderExactTime}`,
          );

        if (
          Number.isNaN(
            exactDate.getTime(),
          )
        ) {
          setReminderError(
            "Choose a valid reminder date and time.",
          );

          return;
        }

        if (
          exactDate.getTime() <=
          Date.now()
        ) {
          setReminderError(
            "Choose a reminder time in the future.",
          );

          return;
        }

        exactAt =
          exactDate.toISOString();
      } else {
        offsetMinutes =
          Number(
            reminderOffsetMinutes,
          );

        if (
          !Number.isFinite(
            offsetMinutes,
          ) ||
          offsetMinutes < 0
        ) {
          setReminderError(
            "Choose a valid reminder interval.",
          );

          return;
        }
      }

      const payload = {
        schedule_type:
          reminderScheduleType,

        offset_minutes:
          offsetMinutes,

        exact_at:
          exactAt,

        recipient_scope:
          reminderRecipientScope,

        message:
          reminderMessage
            .trim() ||
          null,

        is_enabled:
          true,
      };

      try {
        if (
          editingReminderId
        ) {
          const reminder =
            taskReminders.find(
              (candidate) =>
                candidate.id ===
                editingReminderId,
            );

          if (!reminder) {
            throw new Error(
              "The reminder being edited is no longer available.",
            );
          }

          await updateTaskReminder(
            reminder,
            payload,
          );

          setEditingReminderId(
            "",
          );
        } else {
          await createTaskReminder(
            selectedTask.id,
            payload,
          );
        }

        setReminderMessage("");

        setReminderDatePickerOpen(
          false,
        );

        setReminderTimePickerOpen(
          false,
        );
      } catch (saveError) {
        console.error(
          "Task reminder could not be saved:",
          saveError,
        );

        setReminderError(
          saveError?.message ||
          "Task reminder could not be saved.",
        );
      }
    };

  const handleToggleTaskReminder =
    async (reminder) => {
      setReminderError("");

      try {
        await updateTaskReminder(
          reminder,
          {
            is_enabled:
              !reminder.is_enabled,
          },
        );
      } catch (saveError) {
        console.error(
          "Task reminder could not be updated:",
          saveError,
        );

        setReminderError(
          saveError?.message ||
          "Task reminder could not be updated.",
        );
      }
    };

  const handleDeleteTaskReminder =
    async (reminder) => {
      setReminderError("");

      try {
        await deleteTaskReminder(
          reminder,
        );
      } catch (deleteError) {
        console.error(
          "Task reminder could not be deleted:",
          deleteError,
        );

        setReminderError(
          deleteError?.message ||
          "Task reminder could not be deleted.",
        );
      }
    };

  const handleCreateTaskRecurrence =
    async (event) => {
      event.preventDefault();

      if (!selectedTask) {
        return;
      }

      setRecurrenceError("");

      if (!selectedTask.due_at) {
        setRecurrenceError(
          "Set a deadline before making this task repeat.",
        );

        return;
      }

      const interval =
        Number(
          recurrenceInterval,
        );

      if (
        !Number.isInteger(interval) ||
        interval < 1 ||
        interval > 365
      ) {
        setRecurrenceError(
          "Repeat interval must be between 1 and 365.",
        );

        return;
      }

      let endAt = null;

      if (recurrenceEndDate) {
        const localEnd =
          new Date(
            `${recurrenceEndDate}T23:59:59`,
          );

        if (
          Number.isNaN(
            localEnd.getTime(),
          )
        ) {
          setRecurrenceError(
            "Choose a valid repeat end date.",
          );

          return;
        }

        if (
          localEnd.getTime() <=
          new Date(
            selectedTask.due_at,
          ).getTime()
        ) {
          setRecurrenceError(
            "Repeat end date must be after this task deadline.",
          );

          return;
        }

        endAt =
          localEnd.toISOString();
      }

      try {
        await createTaskRecurrence(
          selectedTask.id,
          {
            recurrence_unit:
              recurrenceUnit,

            interval_count:
              interval,

            end_at:
              endAt,

            schedule_timezone:
              Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone ||
              "America/New_York",
          },
        );

        setRecurrenceError(
          "",
        );
      } catch (saveError) {
        console.error(
          "Task recurrence could not be created:",
          saveError,
        );

        setRecurrenceError(
          saveError?.message ||
            "The repeat schedule could not be created.",
        );
      }
    };

  const handleToggleTaskRecurrence =
    async () => {
      if (!taskRecurrenceRule) {
        return;
      }

      setRecurrenceError("");

      try {
        await setTaskRecurrenceEnabled(
          taskRecurrenceRule,
          !taskRecurrenceRule
            .is_enabled,
        );
      } catch (saveError) {
        console.error(
          "Task recurrence could not be updated:",
          saveError,
        );

        setRecurrenceError(
          saveError?.message ||
            "The repeat schedule could not be updated.",
        );
      }
    };

  const handleConfirmRemoveTaskRecurrence =
    async () => {
      if (!taskRecurrenceRule) {
        return;
      }

      setRecurrenceError("");

      try {
        await removeTaskRecurrence(
          taskRecurrenceRule,
        );

        setRecurrenceRemoveConfirmOpen(
          false,
        );
      } catch (saveError) {
        console.error(
          "Task recurrence could not be removed:",
          saveError,
        );

        setRecurrenceError(
          saveError?.message ||
            "The repeat schedule could not be removed.",
        );
      }
    };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();

    if (!selectedTask || !commentBody.trim()) {
      return;
    }

    try {
      await addComment(
        selectedTask.id,
        commentBody,
      );

      setCommentBody("");
    } catch (commentError) {
      console.error(
        "Comment could not be added:",
        commentError,
      );
    }
  };
  const handleAddSubtask = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !selectedTask ||
      !newSubtaskTitle.trim()
    ) {
      return;
    }

    setChecklistError("");

    try {
      await addSubtask(
        selectedTask.id,
        newSubtaskTitle,
      );

      setNewSubtaskTitle("");
    } catch (subtaskError) {
      console.error(
        "Checklist item could not be created:",
        subtaskError,
      );

      setChecklistError(
        subtaskError?.message ||
          "The checklist item could not be created.",
      );
    }
  };

  const handleToggleSubtask = async (
    subtask,
  ) => {
    setChecklistError("");

    try {
      await toggleSubtask(
        subtask,
      );
    } catch (subtaskError) {
      console.error(
        "Checklist item could not be updated:",
        subtaskError,
      );

      setChecklistError(
        subtaskError?.message ||
          "The checklist item could not be updated.",
      );
    }
  };

  const beginRenameSubtask = (
    subtask,
  ) => {
    setEditingSubtaskId(
      subtask.id,
    );

    setEditingSubtaskTitle(
      subtask.title,
    );

    setChecklistError("");
  };

  const handleRenameSubtask = async (
    event,
    subtask,
  ) => {
    event.preventDefault();

    if (
      !editingSubtaskTitle.trim()
    ) {
      return;
    }

    setChecklistError("");

    try {
      await renameSubtask(
        subtask,
        editingSubtaskTitle,
      );

      setEditingSubtaskId("");
      setEditingSubtaskTitle("");
    } catch (subtaskError) {
      console.error(
        "Checklist item could not be renamed:",
        subtaskError,
      );

      setChecklistError(
        subtaskError?.message ||
          "The checklist item could not be renamed.",
      );
    }
  };

  const handleDeleteSubtask = async (
    subtask,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${subtask.title}" from this checklist?`,
      );

    if (!confirmed) {
      return;
    }

    setChecklistError("");

    try {
      await deleteSubtask(
        subtask,
      );

      if (
        editingSubtaskId ===
        subtask.id
      ) {
        setEditingSubtaskId("");
        setEditingSubtaskTitle("");
      }
    } catch (subtaskError) {
      console.error(
        "Checklist item could not be deleted:",
        subtaskError,
      );

      setChecklistError(
        subtaskError?.message ||
          "The checklist item could not be deleted.",
      );
    }
  };

  const handleAddTaskDependency =
    async (event) => {
      event.preventDefault();

      if (
        !selectedTask ||
        !newDependencyTaskId
      ) {
        return;
      }

      setTaskDependencyError("");

      try {
        await addTaskDependency(
          selectedTask.id,
          newDependencyTaskId,
        );

        setNewDependencyTaskId(
          "",
        );
      } catch (dependencyError) {
        console.error(
          "Task dependency could not be created:",
          dependencyError,
        );

        setTaskDependencyError(
          dependencyError?.message ||
            "The task dependency could not be created.",
        );
      }
    };

  const handleQuickCreateDependency =
    async (event) => {
      event.preventDefault();

      const title =
        quickDependencyTitle.trim();

      if (
        !selectedTask ||
        !title
      ) {
        return;
      }

      setTaskDependencyError("");

      try {
        const createdTask =
          await createTask({
            title,

            description:
              `Prerequisite for: ${selectedTask.title}`,

            category:
              selectedTask.category ||
              "General",

            priority:
              selectedTask.priority ||
              "normal",

            status:
              "open",

            assigned_to:
              selectedTask.assigned_to ||
              user.id,

            due_at:
              null,

            visibility:
              selectedTask.visibility ||
              "workspace",

            tags: [
              "prerequisite",
            ],

            estimated_minutes:
              null,
          });

        await addTaskDependency(
          selectedTask.id,
          createdTask.id,
        );

        setQuickDependencyTitle(
          "",
        );
      } catch (dependencyError) {
        console.error(
          "Prerequisite task could not be created:",
          dependencyError,
        );

        setTaskDependencyError(
          dependencyError?.message ||
            "The prerequisite task could not be created and linked.",
        );
      }
    };

  const handleDeleteTaskDependency =
    async (dependency) => {
      const prerequisite =
        taskById.get(
          dependency.depends_on_task_id,
        );

      const confirmed =
        window.confirm(
          `Remove "${
            prerequisite?.title ||
            "this task"
          }" as a prerequisite?`,
        );

      if (!confirmed) {
        return;
      }

      setTaskDependencyError("");

      try {
        await deleteTaskDependency(
          dependency,
        );
      } catch (dependencyError) {
        console.error(
          "Task dependency could not be removed:",
          dependencyError,
        );

        setTaskDependencyError(
          dependencyError?.message ||
            "The task dependency could not be removed.",
        );
      }
    };

  const selectedTaskIdSet =
    new Set(selectedTaskIds);

  const selectedTasks =
    tasks.filter(
      (task) =>
        selectedTaskIdSet.has(
          task.id,
        ),
    );

  const allVisibleTasksSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every(
      (task) =>
        selectedTaskIdSet.has(
          task.id,
        ),
    );

  const toggleTaskSelection =
    (taskId) => {
      setBulkActionError("");
      setBulkArchiveConfirm(null);

      setSelectedTaskIds(
        (current) =>
          current.includes(taskId)
            ? current.filter(
                (id) =>
                  id !== taskId,
              )
            : [
                ...current,
                taskId,
              ],
      );
    };

  const toggleVisibleTaskSelection =
    () => {
      setBulkActionError("");
      setBulkArchiveConfirm(null);

      if (
        allVisibleTasksSelected
      ) {
        const visibleIds =
          new Set(
            filteredTasks.map(
              (task) => task.id,
            ),
          );

        setSelectedTaskIds(
          (current) =>
            current.filter(
              (id) =>
                !visibleIds.has(id),
            ),
        );

        return;
      }

      setSelectedTaskIds(
        (current) => [
          ...new Set([
            ...current,
            ...filteredTasks.map(
              (task) => task.id,
            ),
          ]),
        ],
      );
    };

  const executeBulkArchive =
    async (
      stopRepeating,
    ) => {
      const taskIds =
        bulkArchiveConfirm
          ?.taskIds || [];

      if (!taskIds.length) {
        return;
      }

      setBulkActionError("");

      try {
        if (stopRepeating) {
          await removeTaskRecurrencesForTasks(
            taskIds,
          );
        }

        await bulkUpdateTasks(
          taskIds,
          {
            status: "archived",
          },
        );

        setSelectedTaskIds([]);
        setBulkAction("");
        setBulkArchiveConfirm(null);
      } catch (bulkError) {
        console.error(
          "Bulk archive failed:",
          bulkError,
        );

        setBulkActionError(
          bulkError?.message ||
            "The selected tasks could not be archived.",
        );
      }
    };

  const handleBulkTaskAction =
    async () => {
      if (
        !selectedTaskIds.length ||
        !bulkAction
      ) {
        return;
      }

      setBulkActionError("");
      setBulkArchiveConfirm(null);

      let changes = null;

      if (
        bulkAction.startsWith(
          "status:",
        )
      ) {
        changes = {
          status:
            bulkAction.slice(
              "status:".length,
            ),
        };
      } else if (
        bulkAction.startsWith(
          "priority:",
        )
      ) {
        changes = {
          priority:
            bulkAction.slice(
              "priority:".length,
            ),
        };
      } else if (
        bulkAction.startsWith(
          "assignee:",
        )
      ) {
        const assigneeValue =
          bulkAction.slice(
            "assignee:".length,
          );

        changes = {
          assigned_to:
            assigneeValue ===
            "unassigned"
              ? null
              : assigneeValue,
        };
      } else if (
        bulkAction === "archive"
      ) {
        try {
          const activeRecurrences =
            await loadActiveTaskRecurrencesForTasks(
              selectedTaskIds,
            );

          if (
            activeRecurrences.length >
            0
          ) {
            setBulkArchiveConfirm({
              taskIds: [
                ...selectedTaskIds,
              ],

              recurringCount:
                activeRecurrences.length,
            });

            return;
          }
        } catch (recurrenceError) {
          console.error(
            "Selected task recurrence could not be checked:",
            recurrenceError,
          );

          setBulkActionError(
            recurrenceError?.message ||
              "Campaign Seat could not verify the selected repeat schedules.",
          );

          return;
        }

        const confirmed =
          window.confirm(
            `Archive ${selectedTaskIds.length} selected ${
              selectedTaskIds.length ===
              1
                ? "task"
                : "tasks"
            }?`,
          );

        if (!confirmed) {
          return;
        }

        changes = {
          status: "archived",
        };
      }

      if (!changes) {
        setBulkActionError(
          "Choose a bulk action first.",
        );
        return;
      }

      try {
        await bulkUpdateTasks(
          selectedTaskIds,
          changes,
        );

        setSelectedTaskIds([]);
        setBulkAction("");
        setBulkArchiveConfirm(null);
      } catch (bulkError) {
        console.error(
          "Bulk task action failed:",
          bulkError,
        );

        setBulkActionError(
          bulkError?.message ||
            "The selected tasks could not be updated.",
        );
      }
    };

  const renderTaskCollection = (collection) => {
    if (!collection.length) {
      return (
        <div className={styles.emptyTasks}>
          <CheckCircle2 size={30} />
          <strong>No tasks match this view</strong>
          <p>
            Adjust the filters or create a new campaign
            responsibility.
          </p>
        </div>
      );
    }

    return collection.map((task) => (
      <TaskCard
        key={task.id}
        task={task}
        team={team}
        tasks={tasks}
        taskDependencies={taskDependencies}
        taskReminderOverview={
          taskReminderOverview
        }
        taskSubtaskOverview={
          taskSubtaskOverview
        }
        onOpen={setSelectedTaskId}
        onStatusChange={handleStatusChange}
        isSelected={
          selectedTaskIdSet.has(
            task.id,
          )
        }
        onSelectionChange={
          toggleTaskSelection
        }
        canSelect={
          isCampaignLeadership
        }
        isSaving={isSaving}
      />
    ));
  };

  const boardColumns = [
    {
      status: "open",
      title: "Open",
      description: "Ready to begin",
    },
    {
      status: "in_progress",
      title: "In progress",
      description: "Campaign work underway",
    },
    {
      status: "completed",
      title: "Completed",
      description: "Finished responsibilities",
    },
  ];

  return (
    <CampaignWorkspaceShell activeItem="Tasks">
      {isCampaignLeadership && (
        <div className={styles.adminBanner}>
          <ShieldCheck size={15} />
          {roleLabel} — task assignment and
          campaign-wide controls are active.
        </div>
      )}






        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>
                Campaign execution
              </span>

              <h1>
                Task Command Center
              </h1>

              <p>
                Assign campaign work, manage deadlines,
                surface risk and keep every responsibility
                accountable in one place.
              </p>

              <div className={styles.liveStatus}>
                <span />
                {isLoading
                  ? "Synchronizing campaign tasks…"
                  : error
                    ? error
                    : lastUpdated
                      ? `Live · updated ${formatRelativeTime(
                          lastUpdated,
                        )}`
                      : "Live campaign task data"}
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.refreshButton}
                type="button"
                disabled={isLoading}
                onClick={refresh}
              >
                {isLoading ? (
                  <LoaderCircle
                    className={styles.spinner}
                    size={17}
                  />
                ) : (
                  <CircleDot size={17} />
                )}
                Refresh
              </button>

              {canCreateTasks && (
                <button
                  className={styles.createButton}
                  type="button"
                  onClick={openCreateModal}
                >
                  <Plus size={18} />
                  New task
                </button>
              )}
            </div>
          </section>

          <section
            className={
              styles.summaryGrid
            }
            aria-label="Task summary filters"
          >
            <button
              className={`${styles.summaryCard} ${styles.attentionSummary} ${
                summaryFilter === "active"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "active",
                )
              }
              aria-pressed={
                summaryFilter === "active"
              }
            >
              <div>
                <span>
                  Needs action
                </span>

                <strong>
                  {isLoading ? "—" : activeTasks.length}
                </strong>
              </div>

              <ClipboardCheck
                size={22}
              />

              <p>
                Open campaign responsibilities
              </p>
            </button>

            <button
              className={`${styles.summaryCard} ${
                overdueTasks.length
                  ? styles.dangerSummary
                  : ""
              } ${
                summaryFilter === "overdue"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "overdue",
                )
              }
              aria-pressed={
                summaryFilter === "overdue"
              }
            >
              <div>
                <span>
                  Overdue
                </span>

                <strong>
                  {isLoading ? "—" : overdueTasks.length}
                </strong>
              </div>

              <AlertTriangle
                size={22}
              />

              <p>
                {overdueTasks.length
                  ? "Requires immediate intervention"
                  : "No overdue campaign work"}
              </p>
            </button>

            <button
              className={`${styles.summaryCard} ${
                summaryFilter === "due_today"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "due_today",
                )
              }
              aria-pressed={
                summaryFilter === "due_today"
              }
            >
              <div>
                <span>
                  Due today
                </span>

                <strong>
                  {isLoading ? "—" : dueTodayTasks.length}
                </strong>
              </div>

              <Clock3
                size={22}
              />

              <p>
                Deadline pressure for today
              </p>
            </button>

            <button
              className={`${styles.summaryCard} ${
                summaryFilter === "completed_week"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "completed_week",
                )
              }
              aria-pressed={
                summaryFilter === "completed_week"
              }
            >
              <div>
                <span>
                  Completed this week
                </span>

                <strong>
                  {isLoading ? "—" : recentlyCompleted.length}
                </strong>
              </div>

              <CheckCircle2
                size={22}
              />

              <p>
                Campaign work successfully closed
              </p>
            </button>

            <button
              className={`${styles.summaryCard} ${
                blockedTasks.length
                  ? styles.warningSummary
                  : ""
              } ${
                summaryFilter === "blocked"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "blocked",
                )
              }
              aria-pressed={
                summaryFilter === "blocked"
              }
            >
              <div>
                <span>
                  Blocked
                </span>

                <strong>
                  {isLoading
                    ? "—"
                    : blockedTasks.length}
                </strong>
              </div>

              <AlertTriangle
                size={22}
              />

              <p>
                Work waiting on prerequisites
              </p>
            </button>

            <button
              className={`${styles.summaryCard} ${
                summaryFilter ===
                "scheduled_reminders"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "scheduled_reminders",
                )
              }
              aria-pressed={
                summaryFilter ===
                "scheduled_reminders"
              }
            >
              <div>
                <span>
                  Scheduled reminders
                </span>

                <strong>
                  {isLoading
                    ? "—"
                    : scheduledReminders.length}
                </strong>
              </div>

              <BellRing
                size={22}
              />

              <p>
                Timed follow-ups still pending
              </p>
            </button>
          </section>

          {!isAdmin && (
            <section className={styles.candidateBriefing}>
              <div className={styles.briefingIcon}>
                <UserRound size={22} />
              </div>

              <div>
                <span>Candidate responsibility view</span>
                <h2>
                  Focused on what requires your attention
                </h2>
                <p>
                  Your default view includes tasks assigned to
                  you and responsibilities you created.
                </p>
              </div>

              <strong>
                {
                  tasks.filter(
                    (task) =>
                      task.assigned_to === user.id &&
                      ![
                        "completed",
                        "archived",
                      ].includes(task.status),
                  ).length
                }{" "}
                active
              </strong>
            </section>
          )}

          <section className={styles.controlsPanel}>
            <div className={styles.searchWrap}>
              <Search size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  );

                  setSummaryFilter("");
                }}
                placeholder="Search task, category, description or tag…"
              />
            </div>

            <div className={styles.filters}>
              <div className={styles.selectWrap}>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(
                      event.target.value,
                    );

                    setSummaryFilter("");
                  }}
                >
                  <option value="active">
                    Active tasks
                  </option>
                  <option value="all">
                    All statuses
                  </option>
                  <option value="open">Open</option>
                  <option value="in_progress">
                    In progress
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                  <option value="archived">
                    Archived
                  </option>
                </select>
              </div>

              <select
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(
                    event.target.value,
                  );

                  setSummaryFilter("");
                }}
              >
                <option value="all">
                  All priorities
                </option>
                <option value="urgent">
                  Urgent
                </option>
                <option value="high">High</option>
                <option value="normal">
                  Normal
                </option>
                <option value="low">Low</option>
              </select>

              <select
                value={assigneeFilter}
                onChange={(event) => {
                  setAssigneeFilter(
                    event.target.value,
                  );

                  setSummaryFilter("");
                }}
              >
                <option value="all">
                  All owners
                </option>
                <option value="mine">
                  Assigned to me
                </option>
                <option value="unassigned">
                  Unassigned
                </option>

                {team.map((member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.fullName}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(
                    event.target.value,
                  );

                  setSummaryFilter("");
                }}
              >
                <option value="all">
                  All categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.viewToggle}>
              <button
                className={
                  viewMode === "list"
                    ? styles.activeView
                    : ""
                }
                type="button"
                onClick={() => setViewMode("list")}
              >
                <List size={17} />
                List
              </button>

              <button
                className={
                  viewMode === "board"
                    ? styles.activeView
                    : ""
                }
                type="button"
                onClick={() => setViewMode("board")}
              >
                <Columns3 size={17} />
                Board
              </button>
            </div>
          </section>

          <section className={styles.resultsHeader}>
            <div>
              <strong>
                {filteredTasks.length}{" "}
                {filteredTasks.length === 1
                  ? "task"
                  : "tasks"}
              </strong>
              <span>
                Ordered by urgency, priority and
                deadline
              </span>
            </div>

            {isCampaignLeadership &&
            filteredTasks.length ? (
              <button
                type="button"
                className={
                  styles.selectVisibleButton
                }
                onClick={
                  toggleVisibleTaskSelection
                }
              >
                {allVisibleTasksSelected
                  ? "Clear visible"
                  : `Select visible (${filteredTasks.length})`}
              </button>
            ) : null}

            {(search ||
              statusFilter !== "active" ||
              priorityFilter !== "all" ||
              assigneeFilter !==
                (isAdmin ? "all" : "mine") ||
              categoryFilter !== "all" ||
              summaryFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("active");
                  setPriorityFilter("all");
                  setAssigneeFilter(
                    isAdmin ? "all" : "mine",
                  );
                  setCategoryFilter("all");
                  setSummaryFilter("");
                }}
              >
                Clear filters
              </button>
            )}
          </section>

          {isCampaignLeadership &&
          selectedTaskIds.length > 0 ? (
            <section
              className={
                styles.taskBulkToolbar
              }
              aria-label="Bulk task actions"
            >
              <div
                className={
                  styles.taskBulkSummary
                }
              >
                <strong>
                  {
                    selectedTaskIds.length
                  }{" "}
                  {selectedTaskIds.length ===
                  1
                    ? "task"
                    : "tasks"}{" "}
                  selected
                </strong>

                <span>
                  Apply one change to all
                  selected responsibilities.
                </span>
              </div>

              <div
                className={
                  styles.taskBulkControls
                }
              >
                <select
                  value={bulkAction}
                  onChange={(event) => {
                    setBulkAction(
                      event.target.value,
                    );

                    setBulkActionError(
                      "",
                    );

                    setBulkArchiveConfirm(
                      null,
                    );
                  }}
                  aria-label="Choose bulk action"
                >
                  <option value="">
                    Choose action…
                  </option>

                  <optgroup label="Status">
                    <option value="status:open">
                      Mark open
                    </option>

                    <option value="status:in_progress">
                      Mark in progress
                    </option>

                    <option value="status:completed">
                      Mark completed
                    </option>
                  </optgroup>

                  <optgroup label="Priority">
                    <option value="priority:urgent">
                      Priority · Urgent
                    </option>

                    <option value="priority:high">
                      Priority · High
                    </option>

                    <option value="priority:normal">
                      Priority · Normal
                    </option>

                    <option value="priority:low">
                      Priority · Low
                    </option>
                  </optgroup>

                  <optgroup label="Owner">
                    <option value="assignee:unassigned">
                      Assign · Unassigned
                    </option>

                    {team.map(
                      (member) => (
                        <option
                          key={member.id}
                          value={`assignee:${member.id}`}
                        >
                          Assign ·{" "}
                          {member.fullName ||
                            member.full_name ||
                            member.name ||
                            member.email ||
                            "Team member"}
                        </option>
                      ),
                    )}
                  </optgroup>

                  <optgroup label="Task">
                    <option value="archive">
                      Archive selected
                    </option>
                  </optgroup>
                </select>

                <button
                  type="button"
                  className={
                    styles.taskBulkApplyButton
                  }
                  disabled={
                    isSaving ||
                    !bulkAction
                  }
                  onClick={
                    handleBulkTaskAction
                  }
                >
                  {isSaving
                    ? "Applying…"
                    : "Apply"}
                </button>

                <button
                  type="button"
                  className={
                    styles.taskBulkClearButton
                  }
                  disabled={isSaving}
                  onClick={() => {
                    setSelectedTaskIds(
                      [],
                    );

                    setBulkAction("");
                    setBulkActionError(
                      "",
                    );

                    setBulkArchiveConfirm(
                      null,
                    );
                  }}
                >
                  Clear
                </button>
              </div>

              {bulkArchiveConfirm ? (
                <div
                  className={
                    styles.taskBulkArchiveWarning
                  }
                >
                  <div
                    className={
                      styles.taskBulkArchiveWarningText
                    }
                  >
                    <strong>
                      {
                        bulkArchiveConfirm
                          .recurringCount
                      }{" "}
                      {bulkArchiveConfirm
                        .recurringCount === 1
                        ? "selected task is"
                        : "selected tasks are"}{" "}
                      still repeating
                    </strong>

                    <span>
                      Choose whether future recurring
                      tasks should continue.
                    </span>
                  </div>

                  <div
                    className={
                      styles.taskBulkArchiveWarningActions
                    }
                  >
                    <button
                      type="button"
                      disabled={isSaving}
                      className={
                        styles.taskBulkArchiveCancelButton
                      }
                      onClick={() =>
                        setBulkArchiveConfirm(
                          null,
                        )
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      className={
                        styles.taskBulkArchiveOnlyButton
                      }
                      onClick={() =>
                        executeBulkArchive(
                          false,
                        )
                      }
                    >
                      Archive only
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      className={
                        styles.taskBulkArchiveStopButton
                      }
                      onClick={() =>
                        executeBulkArchive(
                          true,
                        )
                      }
                    >
                      Archive + stop repeating
                    </button>
                  </div>
                </div>
              ) : null}

              {bulkActionError ? (
                <div
                  className={
                    styles.taskBulkError
                  }
                  role="alert"
                >
                  {bulkActionError}
                </div>
              ) : null}
            </section>
          ) : null}

          <section
            className={
              styles.tasksCommandLayout
            }
          >
            <div
              className={
                styles.tasksPrimaryWorkspace
              }
            >
              {isLoading &&
              !tasks.length ? (
                <div
                  className={
                    styles.loadingState
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={30}
                  />

                  <strong>
                    Opening the Task Command Center
                  </strong>

                  <span>
                    Loading campaign responsibilities…
                  </span>
                </div>
              ) : viewMode ===
                "board" ? (
                <section
                  className={
                    styles.board
                  }
                >
                  {boardColumns.map(
                    (column) => {
                      const columnTasks =
                        filteredTasks.filter(
                          (task) =>
                            task.status ===
                            column.status,
                        );

                      return (
                        <div
                          key={
                            column.status
                          }
                          className={
                            styles.boardColumn
                          }
                        >
                          <div
                            className={
                              styles.boardColumnHeader
                            }
                          >
                            <div>
                              <span>
                                {
                                  column.description
                                }
                              </span>

                              <h2>
                                {column.title}
                              </h2>
                            </div>

                            <strong>
                              {
                                columnTasks.length
                              }
                            </strong>
                          </div>

                          <div
                            className={
                              styles.boardTaskList
                            }
                          >
                            {renderTaskCollection(
                              columnTasks,
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </section>
              ) : (
                <section
                  className={
                    styles.taskGrid
                  }
                >
                  {renderTaskCollection(
                    filteredTasks,
                  )}
                </section>
              )}
            </div>

            <aside
              className={
                styles.tasksOperationsRail
              }
            >
              <section
                className={
                  styles.taskOpsCard
                }
              >
                <header
                  className={
                    styles.taskOpsHeading
                  }
                >
                  <div>
                    <span>
                      Operations
                    </span>

                    <h2>
                      Needs attention
                    </h2>
                  </div>

                  <AlertTriangle
                    size={19}
                  />
                </header>

                <button
                  type="button"
                  className={
                    styles.taskOpsMetric
                  }
                  onClick={() =>
                    applySummaryFilter(
                      "overdue",
                    )
                  }
                >
                  <span>
                    Overdue
                  </span>

                  <strong>
                    {
                      overdueTasks.length
                    }
                  </strong>
                </button>

                <button
                  type="button"
                  className={
                    styles.taskOpsMetric
                  }
                  onClick={() =>
                    applySummaryFilter(
                      "due_today",
                    )
                  }
                >
                  <span>
                    Due today
                  </span>

                  <strong>
                    {
                      dueTodayTasks.length
                    }
                  </strong>
                </button>

                <button
                  type="button"
                  className={
                    styles.taskOpsMetric
                  }
                  onClick={() => {
                    setSummaryFilter(
                      "",
                    );

                    setStatusFilter(
                      "active",
                    );

                    setPriorityFilter(
                      "urgent",
                    );

                    setAssigneeFilter(
                      "all",
                    );
                  }}
                >
                  <span>
                    Urgent
                  </span>

                  <strong>
                    {
                      urgentTasks.length
                    }
                  </strong>
                </button>

                <button
                  type="button"
                  className={
                    styles.taskOpsMetric
                  }
                  onClick={() =>
                    applySummaryFilter(
                      "blocked",
                    )
                  }
                >
                  <span>
                    Blocked
                  </span>

                  <strong>
                    {
                      blockedTasks.length
                    }
                  </strong>
                </button>

                <button
                  type="button"
                  className={
                    styles.taskOpsMetric
                  }
                  onClick={() =>
                    applySummaryFilter(
                      "unassigned",
                    )
                  }
                >
                  <span>
                    Unassigned
                  </span>

                  <strong>
                    {
                      unassignedTasks.length
                    }
                  </strong>
                </button>
              </section>

              <section
                className={
                  styles.taskOpsCard
                }
              >
                <header
                  className={
                    styles.taskOpsHeading
                  }
                >
                  <div>
                    <span>
                      Ownership
                    </span>

                    <h2>
                      Team workload
                    </h2>
                  </div>

                  <UserRound
                    size={19}
                  />
                </header>

                <div
                  className={
                    styles.taskWorkloadList
                  }
                >
                  {teamWorkload.length ? (
                    teamWorkload
                      .slice(
                        0,
                        6,
                      )
                      .map(
                        (member) => (
                          <button
                            type="button"
                            key={
                              member.id
                            }
                            onClick={() => {
                              setSummaryFilter(
                                "",
                              );

                              setStatusFilter(
                                "active",
                              );

                              setPriorityFilter(
                                "all",
                              );

                              setAssigneeFilter(
                                member.id,
                              );
                            }}
                          >
                            <span
                              className={
                                styles.taskWorkloadAvatar
                              }
                            >
                              {String(
                                member.fullName ||
                                "?",
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </span>

                            <div>
                              <strong>
                                {
                                  member.fullName
                                }
                              </strong>

                              <small>
                                {
                                  member.activeCount
                                } active
                                {member.overdueCount
                                  ? ` · ${member.overdueCount} overdue`
                                  : ""}
                              </small>
                            </div>

                            <b>
                              {
                                member.activeCount
                              }
                            </b>
                          </button>
                        ),
                      )
                  ) : (
                    <div
                      className={
                        styles.taskOpsEmpty
                      }
                    >
                      No assigned active
                      workload.
                    </div>
                  )}
                </div>
              </section>

              <section
                className={
                  styles.taskOpsCard
                }
              >
                <header
                  className={
                    styles.taskOpsHeading
                  }
                >
                  <div>
                    <span>
                      Quick views
                    </span>

                    <h2>
                      Focus
                    </h2>
                  </div>

                  <Filter
                    size={19}
                  />
                </header>

                <div
                  className={
                    styles.taskQuickViews
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSummaryFilter(
                        "",
                      );

                      setStatusFilter(
                        "active",
                      );

                      setPriorityFilter(
                        "all",
                      );

                      setAssigneeFilter(
                        "mine",
                      );
                    }}
                  >
                    My tasks
                    <strong>
                      {
                        myActiveTasks.length
                      }
                    </strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSummaryFilter(
                        "",
                      );

                      setStatusFilter(
                        "active",
                      );

                      setPriorityFilter(
                        "high",
                      );

                      setAssigneeFilter(
                        "all",
                      );
                    }}
                  >
                    High priority
                    <strong>
                      {
                        highPriorityTasks.length
                      }
                    </strong>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySummaryFilter(
                        "completed_week",
                      )
                    }
                  >
                    Recently completed
                    <strong>
                      {
                        recentlyCompleted.length
                      }
                    </strong>
                  </button>
                </div>

                {canCreateTasks ? (
                  <button
                    type="button"
                    className={
                      styles.taskRailCreateButton
                    }
                    onClick={
                      openCreateModal
                    }
                  >
                    <Plus
                      size={16}
                    />

                    New task
                  </button>
                ) : null}
              </section>
            </aside>
          </section>

          <footer className={styles.footer}>
            <span>© 2026 Campaign HQ</span>
            <div>
              <ShieldCheck size={14} />
              Authorized campaign use only
            </div>
          </footer>
        </main>


      {selectedTask && (
        <>
          <button
            className={styles.drawerOverlay}
            type="button"
            onClick={() => setSelectedTaskId("")}
            aria-label="Close task details"
          />

          <aside className={styles.taskDrawer}>
            <div className={styles.drawerHeader}>
              <div>
                <span>Campaign responsibility</span>
                <strong>Task details</strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTaskId("")
                }
              >
                <X size={21} />
              </button>
            </div>

            <div
              ref={drawerBodyRef}
              className={styles.drawerBody}
            >
              <div className={styles.drawerTitleBlock}>
                <div className={styles.drawerBadges}>
                  <span
                    className={`${styles.priorityBadge} ${
                      styles[
                        PRIORITY_META[
                          selectedTask.priority
                        ]?.className || "normal"
                      ]
                    }`}
                  >
                    {
                      PRIORITY_META[
                        selectedTask.priority
                      ]?.label
                    }
                  </span>

                  <span
                    className={styles.statusBadge}
                  >
                    {
                      STATUS_META[
                        selectedTask.status
                      ]?.label
                    }
                  </span>
                </div>

                <h2>{selectedTask.title}</h2>

                <p>
                  {selectedTask.description ||
                    "No additional description was provided."}
                </p>
              </div>

              <div className={styles.drawerActions}>
                {selectedTask.status === "open" && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      handleStatusChange(
                        selectedTask,
                        "in_progress",
                      )
                    }
                  >
                    <CircleDot size={17} />
                    Start task
                  </button>
                )}

                {selectedTask.status ===
                  "in_progress" && (
                  <button
                    className={styles.completeButton}
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      handleStatusChange(
                        selectedTask,
                        "completed",
                      )
                    }
                  >
                    <CheckCircle2 size={17} />
                    Mark completed
                  </button>
                )}

                {selectedTask.status ===
                  "completed" && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      handleStatusChange(
                        selectedTask,
                        "open",
                      )
                    }
                  >
                    Reopen task
                  </button>
                )}

                {canEditSelectedTask && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      openEditModal(selectedTask)
                    }
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                )}

                {isCampaignLeadership ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={
                      openSaveTaskAsPlaybook
                    }
                  >
                    <Save size={16} />
                    Save as playbook
                  </button>
                ) : null}
              </div>

              <div className={styles.detailGrid}>
                <div>
                  <span>Owner</span>
                  <strong>
                    {getAssignee(
                      selectedTask,
                      team,
                    )?.fullName || "Unassigned"}
                  </strong>
                </div>

                <div>
                  <span>Created by</span>
                  <strong>
                    {getCreator(
                      selectedTask,
                      team,
                    )?.fullName ||
                      "Campaign user"}
                  </strong>
                </div>

                <div>
                  <span>Deadline</span>
                  <strong
                    className={
                      isTaskOverdue(selectedTask)
                        ? styles.overdueText
                        : ""
                    }
                  >
                    {getTaskDeadlineLabel(
                      selectedTask,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>
                    {selectedTask.category}
                  </strong>
                </div>

                <div>
                  <span>Visibility</span>
                  <strong>
                    {getVisibilityLabel(
                      selectedTask.visibility,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Estimated work</span>
                  <strong>
                    {selectedTask.estimated_minutes
                      ? `${selectedTask.estimated_minutes} minutes`
                      : "Not estimated"}
                  </strong>
                </div>
              </div>

              {!!selectedTask.tags?.length && (
                <div className={styles.drawerTags}>
                  <span>Campaign tags</span>
                  <div>
                    {selectedTask.tags.map((tag) => (
                      <strong key={tag}>
                        <Tag size={12} />
                        {tag}
                      </strong>
                    ))}
                  </div>
                </div>
              )}

              <section
              className={
                styles.checklistSection
              }
            >
              <div
                className={
                  styles.checklistHeading
                }
              >
                <div>
                  <span>
                    Execution checklist
                  </span>

                  <h3>
                    Checklist
                  </h3>
                </div>

                <strong>
                  {completedSubtaskCount} of{" "}
                  {subtasks.length}
                </strong>
              </div>

              <div
                className={
                  styles.checklistProgressTrack
                }
                aria-label={`${checklistProgress}% of checklist complete`}
              >
                <span
                  style={{
                    width:
                      `${checklistProgress}%`,
                  }}
                />
              </div>

              {isSubtasksLoading ? (
                <div
                  className={
                    styles.checklistLoading
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={17}
                  />

                  Loading checklist…
                </div>
              ) : subtasks.length ? (
                <div
                  className={
                    styles.checklistItems
                  }
                >
                  {subtasks.map(
                    (subtask) => {
                      const completedBy =
                        team.find(
                          (member) =>
                            member.id ===
                            subtask.completed_by,
                        );

                      return (
                        <div
                          key={
                            subtask.id
                          }
                          className={`${styles.checklistItem} ${
                            subtask.is_completed
                              ? styles.checklistItemCompleted
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={
                              styles.checklistToggle
                            }
                            disabled={
                              isSaving ||
                              !canEditSelectedTask
                            }
                            aria-pressed={
                              subtask.is_completed
                            }
                            aria-label={
                              subtask.is_completed
                                ? `Mark ${subtask.title} incomplete`
                                : `Mark ${subtask.title} complete`
                            }
                            onClick={() =>
                              handleToggleSubtask(
                                subtask,
                              )
                            }
                          >
                            {subtask.is_completed ? (
                              <CheckCircle2
                                size={18}
                              />
                            ) : (
                              <CircleDot
                                size={18}
                              />
                            )}
                          </button>

                          {editingSubtaskId ===
                          subtask.id ? (
                            <form
                              className={
                                styles.checklistEditForm
                              }
                              onSubmit={(
                                event,
                              ) =>
                                handleRenameSubtask(
                                  event,
                                  subtask,
                                )
                              }
                            >
                              <input
                                value={
                                  editingSubtaskTitle
                                }
                                maxLength={500}
                                autoFocus
                                onChange={(
                                  event,
                                ) =>
                                  setEditingSubtaskTitle(
                                    event.target.value,
                                  )
                                }
                              />

                              <button
                                type="submit"
                                disabled={
                                  isSaving ||
                                  !editingSubtaskTitle.trim()
                                }
                                aria-label="Save checklist item"
                              >
                                <Save
                                  size={14}
                                />
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isSaving
                                }
                                onClick={() => {
                                  setEditingSubtaskId(
                                    "",
                                  );

                                  setEditingSubtaskTitle(
                                    "",
                                  );
                                }}
                                aria-label="Cancel checklist edit"
                              >
                                <X
                                  size={14}
                                />
                              </button>
                            </form>
                          ) : (
                            <>
                              <div
                                className={
                                  styles.checklistItemCopy
                                }
                              >
                                <strong>
                                  {
                                    subtask.title
                                  }
                                </strong>

                                <small>
                                  {subtask.is_completed
                                    ? `Completed${
                                        completedBy?.fullName
                                          ? ` by ${completedBy.fullName}`
                                          : ""
                                      }${
                                        subtask.completed_at
                                          ? ` · ${formatRelativeTime(
                                              subtask.completed_at,
                                            )}`
                                          : ""
                                      }`
                                    : "Open checklist item"}
                                </small>
                              </div>

                              {canEditSelectedTask ? (
                                <div
                                  className={
                                    styles.checklistItemActions
                                  }
                                >
                                  <button
                                    type="button"
                                    disabled={
                                      isSaving
                                    }
                                    onClick={() =>
                                      beginRenameSubtask(
                                        subtask,
                                      )
                                    }
                                    aria-label={`Rename ${subtask.title}`}
                                  >
                                    <Pencil
                                      size={14}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      isSaving
                                    }
                                    onClick={() =>
                                      handleDeleteSubtask(
                                        subtask,
                                      )
                                    }
                                    aria-label={`Delete ${subtask.title}`}
                                  >
                                    <Trash2
                                      size={14}
                                    />
                                  </button>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.checklistEmpty
                  }
                >
                  <ClipboardCheck
                    size={21}
                  />

                  <div>
                    <strong>
                      No checklist items yet
                    </strong>

                    <span>
                      Break this responsibility into clear,
                      trackable steps.
                    </span>
                  </div>
                </div>
              )}

              {checklistError ? (
                <div
                  className={
                    styles.checklistError
                  }
                >
                  <AlertTriangle
                    size={14}
                  />

                  {checklistError}
                </div>
              ) : null}

              {canEditSelectedTask ? (
                <form
                  className={
                    styles.checklistAddForm
                  }
                  onSubmit={
                    handleAddSubtask
                  }
                >
                  <input
                    value={
                      newSubtaskTitle
                    }
                    maxLength={500}
                    placeholder="Add a checklist item…"
                    onChange={(event) =>
                      setNewSubtaskTitle(
                        event.target.value,
                      )
                    }
                  />

                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      !newSubtaskTitle.trim()
                    }
                  >
                    <Plus
                      size={15}
                    />

                    Add item
                  </button>
                </form>
              ) : null}
            </section>

            <section
              className={
                styles.taskDependencySection
              }
            >
              <div
                className={
                  styles.taskDependencyHeading
                }
              >
                <div>
                  <span>
                    Workflow dependencies
                  </span>

                  <h3>
                    Dependencies
                  </h3>
                </div>

                {selectedBlockedBy.length ? (
                  <strong
                    className={
                      selectedTaskBlocked
                        ? styles.taskDependencyBlocked
                        : styles.taskDependencyReady
                    }
                  >
                    {selectedTaskBlocked
                      ? "Blocked"
                      : "Ready to proceed"}
                  </strong>
                ) : (
                  <strong
                    className={
                      styles.taskDependencyClear
                    }
                  >
                    No blockers
                  </strong>
                )}
              </div>

              {selectedTaskBlocked ? (
                <div
                  className={
                    styles.taskDependencyNotice
                  }
                >
                  <AlertTriangle
                    size={16}
                  />

                  <div>
                    <strong>
                      Waiting on{" "}
                      {
                        selectedOpenBlockers.length
                      }{" "}
                      prerequisite
                      {selectedOpenBlockers.length ===
                      1
                        ? ""
                        : "s"}
                    </strong>

                    <span>
                      Complete the open prerequisite
                      {selectedOpenBlockers.length ===
                      1
                        ? ""
                        : "s"}{" "}
                      before this work is ready to proceed.
                    </span>
                  </div>
                </div>
              ) : selectedBlockedBy.length ? (
                <div
                  className={`${styles.taskDependencyNotice} ${styles.taskDependencyNoticeReady}`}
                >
                  <CheckCircle2
                    size={16}
                  />

                  <div>
                    <strong>
                      Ready to proceed
                    </strong>

                    <span>
                      Every prerequisite for this task
                      is complete.
                    </span>
                  </div>
                </div>
              ) : null}

              <div
                className={
                  styles.taskDependencyGrid
                }
              >
                <div
                  className={
                    styles.taskDependencyPanel
                  }
                >
                  <header>
                    <div>
                      <strong>
                        Blocked by
                      </strong>

                      <span>
                        Work that must happen first
                      </span>
                    </div>

                    <b>
                      {
                        selectedBlockedBy.length
                      }
                    </b>
                  </header>

                  {isDependenciesLoading ? (
                    <div
                      className={
                        styles.taskDependencyLoading
                      }
                    >
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={16}
                      />
                      Loading dependencies…
                    </div>
                  ) : selectedBlockedBy.length ? (
                    <div
                      className={
                        styles.taskDependencyList
                      }
                    >
                      {selectedBlockedBy.map(
                        ({
                          dependency,
                          task,
                        }) => {
                          const complete =
                            task.status ===
                            "completed";

                          return (
                            <div
                              key={
                                dependency.id
                              }
                              className={
                                styles.taskDependencyRow
                              }
                            >
                              <button
                                type="button"
                                className={
                                  styles.taskDependencyOpen
                                }
                                onClick={() =>
                                  setSelectedTaskId(
                                    task.id,
                                  )
                                }
                              >
                                <span
                                  className={
                                    complete
                                      ? styles.taskDependencyStatusComplete
                                      : styles.taskDependencyStatusOpen
                                  }
                                >
                                  {complete ? (
                                    <CheckCircle2
                                      size={15}
                                    />
                                  ) : (
                                    <AlertTriangle
                                      size={15}
                                    />
                                  )}
                                </span>

                                <div>
                                  <strong>
                                    {
                                      task.title
                                    }
                                  </strong>

                                  <small>
                                    {complete
                                      ? "Completed"
                                      : task.status ===
                                          "in_progress"
                                        ? "In progress"
                                        : "Open"}
                                    {task.category
                                      ? ` · ${task.category}`
                                      : ""}
                                  </small>
                                </div>

                                <ChevronRight
                                  size={15}
                                />
                              </button>

                              {canEditSelectedTask ? (
                                <button
                                  type="button"
                                  className={
                                    styles.taskDependencyRemove
                                  }
                                  disabled={
                                    isSaving
                                  }
                                  onClick={() =>
                                    handleDeleteTaskDependency(
                                      dependency,
                                    )
                                  }
                                  aria-label={`Remove ${task.title} as prerequisite`}
                                >
                                  <X
                                    size={14}
                                  />
                                </button>
                              ) : null}
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div
                      className={
                        styles.taskDependencyEmpty
                      }
                    >
                      <CheckCircle2
                        size={18}
                      />

                      <span>
                        This task has no prerequisites.
                      </span>
                    </div>
                  )}

                  {canEditSelectedTask ? (
                    <div
                      className={
                        styles.taskDependencyComposer
                      }
                    >
                      {dependencyCandidates.length ? (
                        <form
                          className={
                            styles.taskDependencyAddForm
                          }
                          onSubmit={
                            handleAddTaskDependency
                          }
                        >
                          <select
                            value={
                              newDependencyTaskId
                            }
                            onChange={(event) =>
                              setNewDependencyTaskId(
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              Select a campaign task…
                            </option>

                            {activeDependencyCandidates.length ? (
                              <optgroup
                                label="Active campaign tasks"
                              >
                                {activeDependencyCandidates.map(
                                  (task) => (
                                    <option
                                      key={
                                        task.id
                                      }
                                      value={
                                        task.id
                                      }
                                    >
                                      {task.title}
                                      {task.status ===
                                      "in_progress"
                                        ? " · In progress"
                                        : ""}
                                    </option>
                                  ),
                                )}
                              </optgroup>
                            ) : null}

                            {completedDependencyCandidates.length ? (
                              <optgroup
                                label="Completed campaign tasks"
                              >
                                {completedDependencyCandidates.map(
                                  (task) => (
                                    <option
                                      key={
                                        task.id
                                      }
                                      value={
                                        task.id
                                      }
                                    >
                                      {task.title}
                                      {" · Completed"}
                                    </option>
                                  ),
                                )}
                              </optgroup>
                            ) : null}
                          </select>

                          <button
                            type="submit"
                            disabled={
                              isSaving ||
                              !newDependencyTaskId
                            }
                          >
                            <Plus
                              size={14}
                            />
                            Add blocker
                          </button>
                        </form>
                      ) : (
                        <div
                          className={
                            styles.taskDependencyNoCandidates
                          }
                        >
                          No other visible campaign tasks
                          are available to link.
                        </div>
                      )}

                      <div
                        className={
                          styles.taskDependencyHelp
                        }
                      >
                        Dependencies connect separate campaign
                        tasks. Checklist items are steps inside
                        this task and do not appear in the
                        campaign-task menu.
                      </div>

                      <div
                        className={
                          styles.taskDependencyOr
                        }
                      >
                        <span />
                        <strong>or</strong>
                        <span />
                      </div>

                      <form
                        className={
                          styles.taskDependencyQuickCreate
                        }
                        onSubmit={
                          handleQuickCreateDependency
                        }
                      >
                        <input
                          type="text"
                          maxLength={500}
                          value={
                            quickDependencyTitle
                          }
                          placeholder="Create a new prerequisite task…"
                          onChange={(event) =>
                            setQuickDependencyTitle(
                              event.target.value,
                            )
                          }
                        />

                        <button
                          type="submit"
                          disabled={
                            isSaving ||
                            !quickDependencyTitle.trim()
                          }
                        >
                          <Plus
                            size={14}
                          />
                          Create + link prerequisite
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                <div
                  className={
                    styles.taskDependencyPanel
                  }
                >
                  <header>
                    <div>
                      <strong>
                        Blocking
                      </strong>

                      <span>
                        Work waiting on this task
                      </span>
                    </div>

                    <b>
                      {
                        selectedBlocking.length
                      }
                    </b>
                  </header>

                  {selectedBlocking.length ? (
                    <div
                      className={
                        styles.taskDependencyList
                      }
                    >
                      {selectedBlocking.map(
                        ({
                          dependency,
                          task,
                        }) => (
                          <div
                            key={
                              dependency.id
                            }
                            className={
                              styles.taskDependencyRow
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.taskDependencyOpen
                              }
                              onClick={() =>
                                setSelectedTaskId(
                                  task.id,
                                )
                              }
                            >
                              <span
                                className={
                                  styles.taskDependencyStatusBlocking
                                }
                              >
                                <CircleDot
                                  size={15}
                                />
                              </span>

                              <div>
                                <strong>
                                  {
                                    task.title
                                  }
                                </strong>

                                <small>
                                  {task.status ===
                                  "completed"
                                    ? "Completed"
                                    : task.status ===
                                        "in_progress"
                                      ? "In progress"
                                      : "Open"}
                                  {task.category
                                    ? ` · ${task.category}`
                                    : ""}
                                </small>
                              </div>

                              <ChevronRight
                                size={15}
                              />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div
                      className={
                        styles.taskDependencyEmpty
                      }
                    >
                      <CircleDot
                        size={18}
                      />

                      <span>
                        No other visible tasks are
                        waiting on this work.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {taskDependencyError ? (
                <div
                  className={
                    styles.taskDependencyError
                  }
                >
                  <AlertTriangle
                    size={14}
                  />

                  {taskDependencyError}
                </div>
              ) : null}
            </section>

            <section
              className={
                `${styles.taskReminderSection} ${styles.taskRecurrenceSection}`
              }
            >
              <div
                className={
                  styles.taskReminderHeading
                }
              >
                <div>
                  <span>
                    Recurring task automation
                  </span>

                  <h3>
                    Repeat schedule
                  </h3>
                </div>

                <div
                  className={
                    styles.taskReminderHeadingMeta
                  }
                >
                  <strong>
                    {isRecurrenceLoading
                      ? "Loading…"
                      : taskRecurrenceRule
                        ? taskRecurrenceRule
                            .is_enabled
                          ? "Active"
                          : "Paused"
                        : "Not repeating"}
                  </strong>
                </div>
              </div>

              {isRecurrenceLoading ? (
                <div
                  className={
                    styles.taskReminderLoading
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={17}
                  />

                  Loading repeat schedule…
                </div>
              ) : taskRecurrenceRule ? (
                <div
                  className={
                    styles.taskReminderList
                  }
                >
                  <article
                    className={
                      styles.taskReminderRow
                    }
                  >
                    <div
                      className={
                        styles.taskReminderRowCopy
                      }
                    >
                      <div>
                        <strong>
                          Every{" "}
                          {
                            taskRecurrenceRule
                              .interval_count
                          }{" "}
                          {
                            taskRecurrenceRule
                              .recurrence_unit
                          }
                          {taskRecurrenceRule
                            .interval_count ===
                          1
                            ? ""
                            : "s"}
                        </strong>

                        <span
                          className={`${styles.taskReminderStatus} ${
                            taskRecurrenceRule
                              .is_enabled
                              ? styles.taskReminderActive
                              : styles.taskReminderPaused
                          }`}
                        >
                          {taskRecurrenceRule
                            .is_enabled
                            ? "Active"
                            : "Paused"}
                        </span>
                      </div>

                      <small>
                        Next occurrence{" "}
                        {formatDateTime(
                          taskRecurrenceRule
                            .next_occurrence_at,
                        )}
                      </small>

                      {taskRecurrenceRule
                        .end_at ? (
                        <small>
                          Ends{" "}
                          {formatDateTime(
                            taskRecurrenceRule
                              .end_at,
                          )}
                        </small>
                      ) : (
                        <small>
                          No scheduled end date
                        </small>
                      )}

                      <p>
                        Future occurrences inherit
                        this task&apos;s owner,
                        campaign area, priority,
                        visibility, tags and
                        estimate. The checklist was
                        captured when this repeat
                        schedule was created.
                      </p>
                    </div>

                    {canEditSelectedTask ? (
                      <div
                        className={
                          styles.taskReminderActions
                        }
                      >
                        <button
                          type="button"
                          disabled={
                            isSaving
                          }
                          onClick={
                            handleToggleTaskRecurrence
                          }
                        >
                          {taskRecurrenceRule
                            .is_enabled
                            ? "Pause"
                            : "Resume"}
                        </button>

                        <button
                          type="button"
                          className={
                            styles.taskRecurrenceDangerButton
                          }
                          disabled={isSaving}
                          onClick={() =>
                            setRecurrenceRemoveConfirmOpen(
                              true,
                            )
                          }
                        >
                          Remove repeat
                        </button>
                      </div>
                    ) : null}
                  </article>

                  {recurrenceRemoveConfirmOpen ? (
                    <div
                      className={
                        styles.taskRecurrenceConfirm
                      }
                    >
                      <div>
                        <strong>
                          Remove repeat schedule?
                        </strong>

                        <span>
                          Future occurrences will stop.
                          This task and any tasks already
                          created will stay in Campaign
                          Seat.
                        </span>
                      </div>

                      <div
                        className={
                          styles.taskRecurrenceConfirmActions
                        }
                      >
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            setRecurrenceRemoveConfirmOpen(
                              false,
                            )
                          }
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          className={
                            styles.taskRecurrenceConfirmDanger
                          }
                          disabled={isSaving}
                          onClick={
                            handleConfirmRemoveTaskRecurrence
                          }
                        >
                          Remove repeat
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : canEditSelectedTask ? (
                selectedTask.due_at ? (
                  <form
                    className={
                      styles.taskReminderForm
                    }
                    onSubmit={
                      handleCreateTaskRecurrence
                    }
                  >
                    <div
                      className={
                        styles.taskReminderFormGrid
                      }
                    >
                      <label>
                        <span>
                          Every
                        </span>

                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={
                            recurrenceInterval
                          }
                          onChange={(event) =>
                            setRecurrenceInterval(
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Period
                        </span>

                        <select
                          value={
                            recurrenceUnit
                          }
                          onChange={(event) =>
                            setRecurrenceUnit(
                              event.target.value,
                            )
                          }
                        >
                          <option value="day">
                            Day
                          </option>

                          <option value="week">
                            Week
                          </option>

                          <option value="month">
                            Month
                          </option>
                        </select>
                      </label>

                      <label>
                        <span>
                          End date
                        </span>

                        <input
                          type="date"
                          min={
                            getDateParts(
                              selectedTask.due_at,
                            ).date
                          }
                          value={
                            recurrenceEndDate
                          }
                          onChange={(event) =>
                            setRecurrenceEndDate(
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <p>
                      This task becomes the first
                      occurrence. Future occurrences
                      are created automatically.
                      Checklist items repeat as fresh,
                      unchecked steps. Dependencies do
                      not copy.
                    </p>

                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        !recurrenceInterval
                      }
                    >
                      {isSaving ? (
                        <LoaderCircle
                          className={
                            styles.spinner
                          }
                          size={16}
                        />
                      ) : (
                        <Plus
                          size={16}
                        />
                      )}

                      Create repeat schedule
                    </button>
                  </form>
                ) : (
                  <div
                    className={
                      styles.taskReminderLoading
                    }
                  >
                    Set a task deadline first. The
                    deadline becomes the recurring
                    due date and time.
                  </div>
                )
              ) : (
                <div
                  className={
                    styles.taskReminderLoading
                  }
                >
                  This task does not currently repeat.
                </div>
              )}

              {recurrenceError ? (
                <div
                  className={
                    styles.taskReminderError
                  }
                >
                  <AlertTriangle
                    size={15}
                  />

                  {recurrenceError}
                </div>
              ) : null}
            </section>

            <section
              className={
                styles.taskReminderSection
              }
            >
              <div
                className={
                  styles.taskReminderHeading
                }
              >
                <div>
                  <span>
                    Timed task automation
                  </span>

                  <h3>
                    Reminders & escalation
                  </h3>
                </div>

                <div
                  className={
                    styles.taskReminderHeadingMeta
                  }
                >
                  <BellRing
                    size={18}
                  />

                  <strong>
                    {
                      taskReminders.filter(
                        (reminder) =>
                          reminder.is_enabled &&
                          !reminder.fired_at,
                      ).length
                    }{" "}
                    active
                  </strong>
                </div>
              </div>

              {isRemindersLoading ? (
                <div
                  className={
                    styles.taskReminderLoading
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={17}
                  />

                  Loading reminders…
                </div>
              ) : taskReminders.length ? (
                <div
                  className={
                    styles.taskReminderList
                  }
                >
                  {taskReminders.map(
                    (reminder) => {
                      const fired =
                        Boolean(
                          reminder.fired_at,
                        );

                      return (
                        <article
                          key={
                            reminder.id
                          }
                          className={
                            styles.taskReminderRow
                          }
                        >
                          <div
                            className={
                              styles.taskReminderRowIcon
                            }
                          >
                            <BellRing
                              size={17}
                            />
                          </div>

                          <div
                            className={
                              styles.taskReminderRowCopy
                            }
                          >
                            <div>
                              <strong>
                                {getTaskReminderScheduleLabel(
                                  reminder,
                                )}
                              </strong>

                              <span
                                className={`${styles.taskReminderStatus} ${
                                  fired
                                    ? styles.taskReminderSent
                                    : reminder.is_enabled
                                      ? styles.taskReminderActive
                                      : styles.taskReminderPaused
                                }`}
                              >
                                {fired
                                  ? "Sent"
                                  : reminder.is_enabled
                                    ? "Scheduled"
                                    : "Paused"}
                              </span>
                            </div>

                            <small>
                              Notify{" "}
                              {getTaskReminderRecipientLabel(
                                reminder.recipient_scope,
                              )}
                              {reminder.next_fire_at
                                ? ` · ${formatDateTime(
                                    reminder.next_fire_at,
                                  )}`
                                : " · Waiting for deadline"}
                            </small>

                            {reminder.message ? (
                              <p>
                                {reminder.message}
                              </p>
                            ) : null}

                            {fired &&
                            reminder.fired_at ? (
                              <em>
                                Sent{" "}
                                {formatRelativeTime(
                                  reminder.fired_at,
                                )}
                              </em>
                            ) : null}
                          </div>

                          {canEditSelectedTask ? (
                            <div
                              className={
                                styles.taskReminderActions
                              }
                            >
                              <button
                                type="button"
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  beginEditTaskReminder(
                                    reminder,
                                  )
                                }
                              >
                                {fired
                                  ? "Reuse"
                                  : "Edit"}
                              </button>

                              {!fired ? (
                                <button
                                  type="button"
                                  disabled={
                                    isSaving
                                  }
                                  onClick={() =>
                                    handleToggleTaskReminder(
                                      reminder,
                                    )
                                  }
                                >
                                  {reminder.is_enabled
                                    ? "Pause"
                                    : "Enable"}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                className={
                                  styles.taskReminderDelete
                                }
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  handleDeleteTaskReminder(
                                    reminder,
                                  )
                                }
                                aria-label="Delete reminder"
                              >
                                <Trash2
                                  size={14}
                                />
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    },
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.taskReminderEmpty
                  }
                >
                  <BellRing
                    size={20}
                  />

                  <div>
                    <strong>
                      No reminders scheduled
                    </strong>

                    <span>
                      Add a reminder or overdue escalation so
                      campaign work does not get missed.
                    </span>
                  </div>
                </div>
              )}

              {reminderError ? (
                <div
                  className={
                    styles.taskReminderError
                  }
                >
                  <AlertTriangle
                    size={15}
                  />

                  {reminderError}
                </div>
              ) : null}

              {canEditSelectedTask ? (
                <form
                  className={
                    styles.taskReminderForm
                  }
                  onSubmit={
                    handleCreateTaskReminder
                  }
                >
                  {editingReminderId ? (
                    <div
                      className={
                        styles.taskReminderEditBanner
                      }
                    >
                      <div>
                        <strong>
                          Editing reminder
                        </strong>

                        <span>
                          Change the schedule, recipient or note,
                          then save your changes.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={
                          cancelReminderEdit
                        }
                      >
                        Cancel edit
                      </button>
                    </div>
                  ) : null}

                  <div
                    className={
                      styles.taskReminderFormGrid
                    }
                  >
                    <label>
                      <span>
                        When
                      </span>

                      <select
                        value={
                          reminderScheduleType
                        }
                        onChange={(event) => {
                          setReminderScheduleType(
                            event.target.value,
                          );

                          setReminderDatePickerOpen(
                            false,
                          );

                          setReminderTimePickerOpen(
                            false,
                          );
                        }}
                      >
                        <option
                          value="before_due"
                          disabled={
                            !selectedTask?.due_at
                          }
                        >
                          Before deadline
                        </option>

                        <option value="exact">
                          Exact date & time
                        </option>

                        <option value="overdue">
                          Overdue escalation
                        </option>
                      </select>
                    </label>

                    {reminderScheduleType ===
                    "exact" ? (
                      <>
                        <div
                          className={
                            styles.taskReminderPickerField
                          }
                        >
                          <span>
                            Date
                          </span>

                          <div
                            className={
                              styles.taskReminderPicker
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.taskReminderPickerButton
                              }
                              onClick={() => {
                                setReminderTimePickerOpen(
                                  false,
                                );

                                setReminderCalendarMonth(
                                  getReminderCalendarMonthValue(
                                    reminderExactDate,
                                  ),
                                );

                                setReminderDatePickerOpen(
                                  (current) =>
                                    !current,
                                );
                              }}
                            >
                              {
                                getReminderDateLabel(
                                  reminderExactDate,
                                )
                              }

                              <span>
                                ▾
                              </span>
                            </button>

                            {reminderDatePickerOpen ? (
                              <div
                                className={
                                  styles.taskReminderCalendarPopover
                                }
                              >
                                <header>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReminderCalendarMonth(
                                        (current) =>
                                          shiftReminderCalendarMonth(
                                            current,
                                            -1,
                                          ),
                                      )
                                    }
                                    aria-label="Previous month"
                                  >
                                    ‹
                                  </button>

                                  <strong>
                                    {
                                      getReminderMonthLabel(
                                        reminderCalendarMonth,
                                      )
                                    }
                                  </strong>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReminderCalendarMonth(
                                        (current) =>
                                          shiftReminderCalendarMonth(
                                            current,
                                            1,
                                          ),
                                      )
                                    }
                                    aria-label="Next month"
                                  >
                                    ›
                                  </button>
                                </header>

                                <div
                                  className={
                                    styles.taskReminderCalendarWeekdays
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
                                        key={
                                          day
                                        }
                                      >
                                        {day}
                                      </span>
                                    ),
                                  )}
                                </div>

                                <div
                                  className={
                                    styles.taskReminderCalendarDays
                                  }
                                >
                                  {getReminderCalendarDays(
                                    reminderCalendarMonth,
                                  ).map(
                                    (
                                      day,
                                      index,
                                    ) =>
                                      day ? (
                                        <button
                                          key={
                                            day
                                          }
                                          type="button"
                                          className={`${
                                            styles.taskReminderCalendarDay
                                          } ${
                                            day ===
                                            reminderExactDate
                                              ? styles.taskReminderCalendarDaySelected
                                              : ""
                                          } ${
                                            day ===
                                            getLocalDateInputValue(
                                              new Date(),
                                            )
                                              ? styles.taskReminderCalendarDayToday
                                              : ""
                                          }`}
                                          onClick={() => {
                                            setReminderExactDate(
                                              day,
                                            );

                                            setReminderDatePickerOpen(
                                              false,
                                            );
                                          }}
                                        >
                                          {
                                            Number(
                                              day.slice(
                                                -2,
                                              ),
                                            )
                                          }
                                        </button>
                                      ) : (
                                        <span
                                          key={`empty-${index}`}
                                          className={
                                            styles.taskReminderCalendarBlank
                                          }
                                        />
                                      ),
                                  )}
                                </div>

                                <footer>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const today =
                                        getLocalDateInputValue(
                                          new Date(),
                                        );

                                      setReminderExactDate(
                                        today,
                                      );

                                      setReminderCalendarMonth(
                                        getReminderCalendarMonthValue(
                                          today,
                                        ),
                                      );

                                      setReminderDatePickerOpen(
                                        false,
                                      );
                                    }}
                                  >
                                    Today
                                  </button>
                                </footer>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className={
                            styles.taskReminderPickerField
                          }
                        >
                          <span>
                            Time
                          </span>

                          <div
                            className={
                              styles.taskReminderPicker
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.taskReminderPickerButton
                              }
                              onClick={() => {
                                setReminderDatePickerOpen(
                                  false,
                                );

                                setReminderTimePickerOpen(
                                  (current) =>
                                    !current,
                                );
                              }}
                            >
                              {
                                getReminderTimeLabel(
                                  reminderExactTime,
                                )
                              }

                              <span>
                                ▾
                              </span>
                            </button>

                            {reminderTimePickerOpen ? (
                              <div
                                ref={
                                  reminderTimePickerRef
                                }
                                className={
                                  styles.taskReminderTimePopover
                                }
                              >
                                {REMINDER_TIME_OPTIONS.map(
                                  (option) => (
                                    <button
                                      type="button"
                                      key={
                                        option.value
                                      }
                                      data-reminder-time-selected={
                                        option.value ===
                                        reminderExactTime
                                          ? "true"
                                          : "false"
                                      }
                                      className={
                                        option.value ===
                                        reminderExactTime
                                          ? styles.taskReminderTimeSelected
                                          : ""
                                      }
                                      onClick={() => {
                                        setReminderExactTime(
                                          option.value,
                                        );

                                        setReminderTimePickerOpen(
                                          false,
                                        );
                                      }}
                                    >
                                      {
                                        option.label
                                      }
                                    </button>
                                  ),
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <label
                        className={
                          styles.taskReminderIntervalField
                        }
                      >
                        <span>
                          {reminderScheduleType ===
                          "overdue"
                            ? "Escalate after"
                            : "Remind before"}
                        </span>

                        <select
                          value={
                            reminderOffsetMinutes
                          }
                          onChange={(event) =>
                            setReminderOffsetMinutes(
                              event.target.value,
                            )
                          }
                        >
                          <option value="15">
                            15 minutes
                          </option>

                          <option value="60">
                            1 hour
                          </option>

                          <option value="240">
                            4 hours
                          </option>

                          <option value="1440">
                            1 day
                          </option>

                          <option value="2880">
                            2 days
                          </option>

                          <option value="10080">
                            1 week
                          </option>
                        </select>
                      </label>
                    )}

                    <label>
                      <span>
                        Notify
                      </span>

                      <select
                        value={
                          reminderRecipientScope
                        }
                        onChange={(event) =>
                          setReminderRecipientScope(
                            event.target.value,
                          )
                        }
                      >
                        <option value="assignee">
                          Task owner
                        </option>

                        <option value="creator">
                          Task creator
                        </option>

                        <option value="leadership">
                          Campaign leadership
                        </option>

                        <option value="assignee_and_leadership">
                          Owner + leadership
                        </option>
                      </select>
                    </label>
                  </div>

                  <label
                    className={
                      styles.taskReminderMessageField
                    }
                  >
                    <span>
                      Reminder note
                    </span>

                    <input
                      type="text"
                      maxLength={1000}
                      value={
                        reminderMessage
                      }
                      placeholder="Optional message for this reminder…"
                      onChange={(event) =>
                        setReminderMessage(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  {reminderScheduleType !==
                    "exact" &&
                  !selectedTask?.due_at ? (
                    <div
                      className={
                        styles.taskReminderDeadlineNotice
                      }
                    >
                      <AlertTriangle
                        size={14}
                      />

                      Add a task deadline first to use a
                      deadline-based reminder.
                    </div>
                  ) : null}

                  <div
                    className={
                      styles.taskReminderFormFooter
                    }
                  >
                    <span>
                      Campaign Seat checks due reminders every
                      minute.
                    </span>

                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        (
                          reminderScheduleType !==
                            "exact" &&
                          !selectedTask?.due_at
                        ) ||
                        (
                          reminderScheduleType ===
                            "exact" &&
                          (
                            !reminderExactDate ||
                            !reminderExactTime
                          )
                        )
                      }
                    >
                      <Plus
                        size={15}
                      />

                      {editingReminderId
                        ? "Save changes"
                        : "Add reminder"}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>

            {/* CAMPAIGN SEAT TASK ATTACHMENTS UI */}
            <section
              className={
                styles.taskAttachmentSection
              }
            >
              <div
                className={
                  styles.taskAttachmentHeading
                }
              >
                <div>
                  <span>
                    Campaign resources
                  </span>

                  <h3>
                    Attachments
                  </h3>
                </div>

                <div
                  className={
                    styles.taskAttachmentCount
                  }
                >
                  <Paperclip
                    size={17}
                  />

                  <strong>
                    {
                      taskAttachments.length
                    }{" "}
                    {
                      taskAttachments.length ===
                      1
                        ? "file"
                        : "files"
                    }
                  </strong>
                </div>
              </div>

              {isAttachmentsLoading ? (
                <div
                  className={
                    styles.taskAttachmentEmpty
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={18}
                  />

                  <div>
                    <strong>
                      Loading attachments…
                    </strong>
                  </div>
                </div>
              ) : taskAttachments.length ? (
                <div
                  className={
                    styles.taskAttachmentList
                  }
                >
                  {taskAttachments.map(
                    (attachment) => {
                      const file =
                        attachment.file;

                      if (!file) {
                        return null;
                      }

                      return (
                        <article
                          key={
                            attachment.id
                          }
                          className={
                            styles.taskAttachmentRow
                          }
                        >
                          <div
                            className={
                              styles.taskAttachmentIcon
                            }
                          >
                            <FileText
                              size={18}
                            />
                          </div>

                          <button
                            type="button"
                            className={
                              styles.taskAttachmentFile
                            }
                            onClick={() =>
                              openCampaignFile(
                                file,
                              )
                            }
                          >
                            <strong>
                              {
                                file.file_name
                              }
                            </strong>

                            <span>
                              {
                                file.category ||
                                "Campaign file"
                              }
                              {" · "}
                              {
                                formatTaskAttachmentSize(
                                  file.size_bytes,
                                )
                              }
                            </span>
                          </button>

                          <div
                            className={
                              styles.taskAttachmentActions
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openCampaignFile(
                                  file,
                                  true,
                                )
                              }
                              aria-label={`Download ${file.file_name}`}
                              title="Download"
                            >
                              <Download
                                size={15}
                              />
                            </button>

                            {canEditSelectedTask ? (
                              <button
                                type="button"
                                className={
                                  styles.taskAttachmentRemove
                                }
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  handleUnlinkTaskAttachment(
                                    attachment,
                                  )
                                }
                                aria-label={`Remove ${file.file_name} from task`}
                                title="Remove from task"
                              >
                                <X
                                  size={15}
                                />
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.taskAttachmentEmpty
                  }
                >
                  <Paperclip
                    size={20}
                  />

                  <div>
                    <strong>
                      No files attached
                    </strong>

                    <span>
                      Keep walk sheets, graphics,
                      PDFs and other campaign
                      resources with this task.
                    </span>
                  </div>
                </div>
              )}

              {canEditSelectedTask ? (
                <div
                  className={
                    styles.taskAttachmentComposer
                  }
                >
                  <input
                    ref={
                      taskAttachmentInputRef
                    }
                    className={
                      styles.taskAttachmentInput
                    }
                    type="file"
                    multiple
                    onChange={
                      handleTaskAttachmentUpload
                    }
                  />

                  <button
                    type="button"
                    className={
                      styles.taskAttachmentUpload
                    }
                    disabled={
                      isCampaignFileSaving ||
                      isSaving
                    }
                    onClick={() =>
                      taskAttachmentInputRef
                        .current
                        ?.click()
                    }
                  >
                    {isCampaignFileSaving ? (
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={16}
                      />
                    ) : (
                      <UploadCloud
                        size={16}
                      />
                    )}

                    {isCampaignFileSaving
                      ? "Uploading…"
                      : "Upload files"}
                  </button>

                  <div
                    className={
                      styles.taskAttachmentExisting
                    }
                  >
                    <select
                      value={
                        selectedCampaignFileId
                      }
                      disabled={
                        isCampaignFilesLoading ||
                        !availableCampaignFiles.length
                      }
                      onChange={(event) =>
                        setSelectedCampaignFileId(
                          event.target.value,
                        )
                      }
                      aria-label="Choose campaign file to attach"
                    >
                      <option value="">
                        {isCampaignFilesLoading
                          ? "Loading Campaign Files…"
                          : availableCampaignFiles.length
                            ? "Choose from Campaign Files"
                            : "No other Campaign Files"}
                      </option>

                      {
                        availableCampaignFiles.map(
                          (file) => (
                            <option
                              key={
                                file.id
                              }
                              value={
                                file.id
                              }
                            >
                              {
                                file.file_name
                              }
                            </option>
                          ),
                        )
                      }
                    </select>

                    <button
                      type="button"
                      disabled={
                        !selectedCampaignFileId ||
                        isSaving
                      }
                      onClick={
                        handleAttachExistingCampaignFile
                      }
                    >
                      <Plus
                        size={15}
                      />
                      Attach
                    </button>
                  </div>
                </div>
              ) : null}

              {
                attachmentActionError ||
                taskAttachmentError ||
                campaignFilesError
                  ? (
                    <div
                      className={
                        styles.taskAttachmentError
                      }
                    >
                      <AlertTriangle
                        size={15}
                      />

                      {
                        attachmentActionError ||
                        taskAttachmentError ||
                        campaignFilesError
                      }
                    </div>
                  )
                  : null
              }
            </section>

            <section className={styles.commentsSection}>
                <div className={styles.commentsHeading}>
                  <div>
                    <span>Team discussion</span>
                    <h3>
                      Comments and updates
                    </h3>
                  </div>

                  <MessageSquare size={19} />
                </div>

                <div className={styles.commentsList}>
                  {!comments.length ? (
                    <div
                      className={styles.emptyComments}
                    >
                      <MessageSquare size={25} />
                      <strong>
                        No comments yet
                      </strong>
                      <p>
                        Add the first campaign update
                        or question.
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <article
                        key={comment.id}
                        className={styles.comment}
                      >
                        <div
                          className={styles.commentAvatar}
                        >
                          {getUserInitials(
                            comment.authorName,
                          )}
                        </div>

                        <div>
                          <header>
                            <strong>
                              {comment.authorName}
                            </strong>
                            <span>
                              {formatRelativeTime(
                                comment.created_at,
                              )}
                            </span>
                          </header>

                          <p>{comment.body}</p>

                          {comment.is_edited && (
                            <small>Edited</small>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <form
                  className={styles.commentForm}
                  onSubmit={handleCommentSubmit}
                >
                  <textarea
                    value={commentBody}
                    onChange={(event) =>
                      setCommentBody(
                        event.target.value,
                      )
                    }
                    placeholder="Add an update, question or decision note…"
                    maxLength={5000}
                  />

                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      !commentBody.trim()
                    }
                  >
                    {isSaving ? (
                      <LoaderCircle
                        className={styles.spinner}
                        size={16}
                      />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    Add comment
                  </button>
                </form>
              </section>
            </div>

            {canEditSelectedTask && (
              <div className={styles.drawerFooter}>
                {archiveConfirmOpen ? (
                  <div
                    className={
                      styles.taskArchiveConfirm
                    }
                  >
                    <div>
                      <strong>
                        This task is still repeating
                      </strong>

                      <span>
                        Choose whether future recurring
                        tasks should continue.
                      </span>
                    </div>

                    <div
                      className={
                        styles.taskArchiveConfirmActions
                      }
                    >
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          setArchiveConfirmOpen(false)
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          archiveSelectedTask()
                        }
                      >
                        Archive only
                      </button>

                      <button
                        type="button"
                        className={
                          styles.taskArchiveStopButton
                        }
                        disabled={isSaving}
                        onClick={() =>
                          archiveSelectedTask({
                            stopRepeating: true,
                          })
                        }
                      >
                        Archive + stop repeating
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleArchive}
                  >
                    <Archive size={16} />
                    Archive task
                  </button>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {playbookManagerOpen ? (
        <div
          className={
            styles.playbookManagerLayer
          }
        >
          <button
            type="button"
            className={
              styles.playbookManagerOverlay
            }
            onClick={() =>
              setPlaybookManagerOpen(
                false,
              )
            }
            aria-label="Close campaign playbooks"
          />

          <section
            className={
              styles.playbookManagerModal
            }
          >
            <header
              className={
                styles.playbookManagerHeader
              }
            >
              <div>
                <span>
                  Campaign operations
                </span>

                <h2>
                  Manage playbooks
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPlaybookManagerOpen(
                    false,
                  )
                }
                disabled={isSaving}
              >
                <X size={21} />
              </button>
            </header>

            <div
              className={
                styles.playbookManagerBody
              }
            >
              <aside
                className={
                  styles.playbookManagerList
                }
              >
                <div
                  className={
                    styles.playbookManagerListHeader
                  }
                >
                  <div>
                    <span>
                      Active playbooks
                    </span>

                    <strong>
                      {
                        taskTemplates.length
                      }
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={
                      resetPlaybookEditor
                    }
                  >
                    <Plus size={15} />
                    New
                  </button>
                </div>

                {taskTemplates.length ? (
                  <div
                    className={
                      styles.playbookManagerListItems
                    }
                  >
                    {taskTemplates.map(
                      (template) => (
                        <button
                          key={
                            template.id
                          }
                          type="button"
                          className={
                            editingPlaybookId ===
                            template.id
                              ? styles.playbookManagerListItemActive
                              : ""
                          }
                          onClick={() =>
                            loadPlaybookIntoEditor(
                              template,
                            )
                          }
                        >
                          <strong>
                            {template.name}
                          </strong>

                          <span>
                            {
                              template
                                .checklistItems
                                ?.length ||
                              0
                            }{" "}
                            checklist{" "}
                            {
                              (
                                template
                                  .checklistItems
                                  ?.length ||
                                0
                              ) === 1
                                ? "item"
                                : "items"
                            }
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      styles.playbookManagerEmpty
                    }
                  >
                    <ClipboardCheck
                      size={25}
                    />

                    <strong>
                      No playbooks yet
                    </strong>

                    <span>
                      Create the first reusable
                      campaign workflow.
                    </span>
                  </div>
                )}
              </aside>

              <form
                className={
                  styles.playbookEditor
                }
                onSubmit={
                  handleSavePlaybook
                }
              >
                <div
                  className={
                    styles.playbookEditorHeading
                  }
                >
                  <div>
                    <span>
                      {editingPlaybookId
                        ? "Editing playbook"
                        : "New playbook"}
                    </span>

                    <h3>
                      {editingPlaybookId
                        ? playbookForm.name ||
                          "Campaign playbook"
                        : "Create campaign playbook"}
                    </h3>
                  </div>

                  {editingPlaybookId ? (
                    <button
                      type="button"
                      className={
                        styles.playbookArchiveButton
                      }
                      disabled={isSaving}
                      onClick={
                        handleArchivePlaybook
                      }
                    >
                      <Archive
                        size={15}
                      />
                      Archive
                    </button>
                  ) : null}
                </div>

                <div
                  className={
                    styles.playbookEditorGrid
                  }
                >
                  <label
                    className={
                      styles.playbookEditorFull
                    }
                  >
                    <span>
                      Playbook name
                    </span>

                    <input
                      name="name"
                      value={
                        playbookForm.name
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                      placeholder="Example: Volunteer event launch"
                      maxLength={160}
                    />
                  </label>

                  <label
                    className={
                      styles.playbookEditorFull
                    }
                  >
                    <span>
                      Task title
                    </span>

                    <input
                      name="taskTitle"
                      value={
                        playbookForm.taskTitle
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                      placeholder="Task created from this playbook"
                      maxLength={500}
                    />
                  </label>

                  <label
                    className={
                      styles.playbookEditorFull
                    }
                  >
                    <span>
                      Description and expected outcome
                    </span>

                    <textarea
                      name="taskDescription"
                      value={
                        playbookForm
                          .taskDescription
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                      placeholder="What should this campaign responsibility accomplish?"
                      maxLength={10000}
                    />
                  </label>

                  <label>
                    <span>
                      Campaign area
                    </span>

                    <select
                      name="category"
                      value={
                        playbookForm.category
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                    >
                      {CATEGORY_OPTIONS.map(
                        (category) => (
                          <option
                            key={
                              category
                            }
                            value={
                              category
                            }
                          >
                            {category}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Priority
                    </span>

                    <select
                      name="priority"
                      value={
                        playbookForm.priority
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                    >
                      <option value="urgent">
                        Urgent
                      </option>

                      <option value="high">
                        High
                      </option>

                      <option value="normal">
                        Normal
                      </option>

                      <option value="low">
                        Low
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Visibility
                    </span>

                    <select
                      name="visibility"
                      value={
                        playbookForm.visibility
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                    >
                      <option value="workspace">
                        Entire campaign team
                      </option>

                      <option value="assignee_only">
                        Assignee and leadership
                      </option>

                      <option value="admin_only">
                        Campaign leadership only
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Estimated minutes
                    </span>

                    <input
                      name="estimatedMinutes"
                      type="number"
                      min="1"
                      max="10080"
                      value={
                        playbookForm
                          .estimatedMinutes
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                      placeholder="30"
                    />
                  </label>

                  <label
                    className={
                      styles.playbookEditorFull
                    }
                  >
                    <span>
                      Tags
                    </span>

                    <input
                      name="tags"
                      value={
                        playbookForm.tags
                      }
                      onChange={
                        handlePlaybookFieldChange
                      }
                      placeholder="field, volunteers, follow-up"
                    />
                  </label>
                </div>

                <section
                  className={
                    styles.playbookChecklistEditor
                  }
                >
                  <div>
                    <span>
                      Execution steps
                    </span>

                    <strong>
                      Checklist blueprint
                    </strong>

                    <small>
                      {
                        playbookChecklistItems
                          .length
                      }{" "}
                      {playbookChecklistItems
                        .length === 1
                        ? "item"
                        : "items"}
                    </small>
                  </div>

                  {playbookChecklistItems.length ? (
                    <div
                      className={
                        styles.playbookChecklistItems
                      }
                    >
                      {playbookChecklistItems.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            key={
                              item.key
                            }
                          >
                            <span>
                              {index + 1}
                            </span>

                            <strong>
                              {item.title}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                removePlaybookChecklistItem(
                                  item.key,
                                )
                              }
                            >
                              <X
                                size={14}
                              />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}

                  <div
                    className={
                      styles.playbookChecklistAdd
                    }
                  >
                    <input
                      value={
                        playbookChecklistInput
                      }
                      onChange={(event) =>
                        setPlaybookChecklistInput(
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();

                          addPlaybookChecklistItem();
                        }
                      }}
                      placeholder="Add reusable checklist step…"
                      maxLength={500}
                    />

                    <button
                      type="button"
                      disabled={
                        !playbookChecklistInput
                          .trim()
                      }
                      onClick={
                        addPlaybookChecklistItem
                      }
                    >
                      <Plus
                        size={15}
                      />
                      Add
                    </button>
                  </div>
                </section>

                {playbookSaveError ? (
                  <div
                    className={
                      styles.playbookSaveError
                    }
                    role="alert"
                  >
                    <AlertTriangle
                      size={15}
                    />

                    {playbookSaveError}
                  </div>
                ) : null}

                <footer
                  className={
                    styles.playbookEditorFooter
                  }
                >
                  <span>
                    Deadlines, owners and repeat
                    schedules are intentionally
                    chosen when the real task is
                    created.
                  </span>

                  <button
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={16}
                      />
                    ) : (
                      <Save
                        size={16}
                      />
                    )}

                    {editingPlaybookId
                      ? "Save playbook"
                      : "Create playbook"}
                  </button>
                </footer>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {modalMode && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeModal}
            aria-label="Close task form"
          />

          <section
            ref={taskModalRef}
            className={styles.taskModal}
          >
            <header className={styles.modalHeader}>
              <div>
                <span>
                  {modalMode === "edit"
                    ? "Update responsibility"
                    : "New campaign responsibility"}
                </span>

                <h2>
                  {modalMode === "edit"
                    ? "Edit task"
                    : "Create campaign task"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
              >
                <X size={21} />
              </button>
            </header>

            <form
              ref={taskFormRef}
              className={styles.taskForm}
              onSubmit={handleSubmit}
            >
              {modalMode === "create" ? (
                <section
                  className={`${styles.fullField} ${styles.taskTemplatePickerPanel}`}
                >
                  <div
                    className={
                      styles.taskTemplatePickerHeading
                    }
                  >
                    <div>
                      <span>
                        Campaign playbooks
                      </span>

                      <strong>
                        Start from template
                      </strong>
                    </div>

                    <div
                      className={
                        styles.taskTemplatePickerActions
                      }
                    >
                      <small>
                        Optional
                      </small>

                      {isCampaignLeadership ? (
                        <button
                          type="button"
                          onClick={
                            openPlaybookManager
                          }
                        >
                          Manage playbooks
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <select
                    value={
                      selectedTaskTemplateId
                    }
                    onChange={
                      handleTaskTemplateChange
                    }
                    disabled={
                      isTaskTemplatesLoading
                    }
                    aria-label="Start task from campaign playbook"
                  >
                    <option value="">
                      {isTaskTemplatesLoading
                        ? "Loading playbooks…"
                        : "Blank task"}
                    </option>

                    {taskTemplates.map(
                      (template) => (
                        <option
                          key={
                            template.id
                          }
                          value={
                            template.id
                          }
                        >
                          {template.name}
                        </option>
                      ),
                    )}
                  </select>

                  {taskTemplateError ? (
                    <div
                      className={
                        styles.taskTemplatePickerError
                      }
                    >
                      {taskTemplateError}
                    </div>
                  ) : taskTemplates.length ? (
                    <p>
                      Choose a reusable campaign
                      playbook to prefill this task.
                      You can change every field
                      before creating it.
                    </p>
                  ) : (
                    <p>
                      No active campaign playbooks
                      yet. You can still build this
                      task from scratch.
                    </p>
                  )}
                </section>
              ) : null}

              <div
                className={`${styles.formField} ${styles.fullField}`}
              >
                <label htmlFor="task-title">
                  Task title
                </label>

                <input
                  id="task-title"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Example: Confirm fundraiser guest list"
                  maxLength={180}
                  autoFocus
                />
              </div>

              <div
                className={`${styles.formField} ${styles.fullField}`}
              >
                <label htmlFor="task-description">
                  Description and expected outcome
                </label>

                <textarea
                  id="task-description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Explain what must be completed, why it matters and what success looks like."
                  maxLength={5000}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-owner">
                  Accountable owner
                </label>

                <select
                  id="task-owner"
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleFormChange}
                >
                  <option value="">
                    Unassigned
                  </option>

                  {team.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.fullName} ·{" "}
                      {member.role === "admin"
                        ? "Admin"
                        : "Client"}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-category">
                  Campaign area
                </label>

                <select
                  id="task-category"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                >
                  {CATEGORY_OPTIONS.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-priority">
                  Priority
                </label>

                <select
                  id="task-priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleFormChange}
                >
                  <option value="urgent">
                    Urgent
                  </option>
                  <option value="high">High</option>
                  <option value="normal">
                    Normal
                  </option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-status">
                  Status
                </label>

                <select
                  id="task-status"
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">
                    In progress
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-date">
                  Deadline date
                </label>

                <input
                  id="task-date"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-time">
                  Deadline time
                </label>

                <input
                  id="task-time"
                  name="dueTime"
                  type="time"
                  value={formData.dueTime}
                  onChange={handleFormChange}
                  disabled={!formData.dueDate}
                />
              </div>

              {modalMode === "create" ? (
                <section
                  className={`${styles.fullField} ${styles.taskDraftChecklistPanel}`}
                >
                  <div
                    className={
                      styles.taskDraftChecklistHeading
                    }
                  >
                    <div>
                      <span>
                        Execution steps
                      </span>

                      <strong>
                        Checklist
                      </strong>
                    </div>

                    <small>
                      {
                        draftChecklistItems.length
                      }{" "}
                      {draftChecklistItems.length ===
                      1
                        ? "item"
                        : "items"}
                    </small>
                  </div>

                  {draftChecklistItems.length ? (
                    <div
                      className={
                        styles.taskDraftChecklistItems
                      }
                    >
                      {draftChecklistItems.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            key={
                              item.key
                            }
                          >
                            <span>
                              {index + 1}
                            </span>

                            <strong>
                              {item.title}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                removeDraftChecklistItem(
                                  item.key,
                                )
                              }
                              aria-label={`Remove ${item.title}`}
                            >
                              <X
                                size={14}
                              />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p
                      className={
                        styles.taskDraftChecklistEmpty
                      }
                    >
                      Add execution steps now, or
                      create the task without a
                      checklist.
                    </p>
                  )}

                  <div
                    className={
                      styles.taskDraftChecklistAdd
                    }
                  >
                    <input
                      type="text"
                      value={
                        draftChecklistInput
                      }
                      onChange={(event) =>
                        setDraftChecklistInput(
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();

                          addDraftChecklistItem();
                        }
                      }}
                      placeholder="Add checklist step…"
                      maxLength={500}
                    />

                    <button
                      type="button"
                      disabled={
                        !draftChecklistInput
                          .trim()
                      }
                      onClick={
                        addDraftChecklistItem
                      }
                    >
                      <Plus
                        size={15}
                      />
                      Add step
                    </button>
                  </div>

                  <p
                    className={
                      styles.taskDraftChecklistHint
                    }
                  >
                    These become live checklist
                    items after the task is
                    created.
                  </p>
                </section>
              ) : null}

              {modalMode === "create" ? (
                <section
                  className={`${styles.fullField} ${styles.taskCreateRepeatPanel}`}
                >
                  <div
                    className={
                      styles.taskCreateRepeatHeading
                    }
                  >
                    <div>
                      <span>
                        Automation
                      </span>

                      <strong>
                        Repeat schedule
                      </strong>
                    </div>

                    <small>
                      {formData.repeatMode ===
                      "none"
                        ? "Does not repeat"
                        : "Repeats automatically"}
                    </small>
                  </div>

                  <div
                    className={
                      styles.taskCreateRepeatGrid
                    }
                  >
                    <label>
                      <span>Repeat</span>

                      <select
                        name="repeatMode"
                        value={
                          formData.repeatMode
                        }
                        onChange={
                          handleFormChange
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

                        <option value="custom">
                          Custom interval
                        </option>
                      </select>
                    </label>

                    {formData.repeatMode ===
                    "custom" ? (
                      <>
                        <label>
                          <span>Every</span>

                          <input
                            name="repeatInterval"
                            type="number"
                            min="1"
                            max="365"
                            value={
                              formData.repeatInterval
                            }
                            onChange={
                              handleFormChange
                            }
                          />
                        </label>

                        <label>
                          <span>Period</span>

                          <select
                            name="repeatUnit"
                            value={
                              formData.repeatUnit
                            }
                            onChange={
                              handleFormChange
                            }
                          >
                            <option value="day">
                              Day
                            </option>

                            <option value="week">
                              Week
                            </option>

                            <option value="month">
                              Month
                            </option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {formData.repeatMode !==
                    "none" ? (
                      <label>
                        <span>
                          End date
                          <em>Optional</em>
                        </span>

                        <input
                          name="repeatEndDate"
                          type="date"
                          min={
                            formData.dueDate ||
                            undefined
                          }
                          value={
                            formData.repeatEndDate
                          }
                          onChange={
                            handleFormChange
                          }
                          disabled={
                            !formData.dueDate
                          }
                        />
                      </label>
                    ) : null}
                  </div>

                  {formData.repeatMode !==
                    "none" &&
                  !formData.dueDate ? (
                    <div
                      className={
                        styles.taskCreateRepeatWarning
                      }
                    >
                      Add the deadline above
                      before creating a
                      repeating task.
                    </div>
                  ) : formData.repeatMode !==
                    "none" ? (
                    <p
                      className={
                        styles.taskCreateRepeatHint
                      }
                    >
                      This task becomes the
                      first occurrence. Future
                      tasks will be generated
                      automatically on this
                      schedule.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className={styles.formField}>
                <label htmlFor="task-visibility">
                  Who can see this task?
                </label>

                <select
                  id="task-visibility"
                  name="visibility"
                  value={formData.visibility}
                  onChange={handleFormChange}
                >
                  <option value="workspace">
                    Entire campaign team
                  </option>

                  <option value="assignee_only">
                    Assignee and administrators
                  </option>

                  {isAdmin && (
                    <option value="admin_only">
                      Administrators only
                    </option>
                  )}
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="task-estimate">
                  Estimated minutes
                </label>

                <input
                  id="task-estimate"
                  name="estimatedMinutes"
                  type="number"
                  min="1"
                  max="10080"
                  value={formData.estimatedMinutes}
                  onChange={handleFormChange}
                  placeholder="Example: 30"
                />
              </div>

              <div
                className={`${styles.formField} ${styles.fullField}`}
              >
                <label htmlFor="task-tags">
                  Tags
                </label>

                <input
                  id="task-tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleFormChange}
                  placeholder="Separate tags with commas: WOB, fundraiser, urgent"
                />
              </div>

              {formError && (
                <p
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle size={16} />
                  {formError}
                </p>
              )}

              <footer className={styles.modalFooter}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={closeModal}
                  disabled={
                    isSaving ||
                    (
                      modalMode === "create" &&
                      formData.repeatMode !==
                        "none" &&
                      !formData.dueDate
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <LoaderCircle
                      className={styles.spinner}
                      size={17}
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {modalMode === "edit"
                    ? "Save changes"
                    : "Create task"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
