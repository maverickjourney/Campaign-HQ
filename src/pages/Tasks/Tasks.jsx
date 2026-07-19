import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
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
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Tag,
  UserRound,
  X,
} from "lucide-react";

import { useTasksCommandCenter } from "../../hooks/useTasksCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";
import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
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
  onOpen,
  onStatusChange,
  isSaving,
}) {
  const assignee = getAssignee(task, team);
  const priority =
    PRIORITY_META[task.priority] ||
    PRIORITY_META.normal;
  const overdue = isTaskOverdue(task);

  return (
    <article
      className={`${styles.taskCard} ${
        overdue ? styles.overdueTask : ""
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
        <span className={styles.visibilityText}>
          {task.visibility === "workspace"
            ? "Team"
            : task.visibility === "admin_only"
              ? "Leadership"
              : "Private"}
        </span>

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
    useState("");
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
  const [modalMode, setModalMode] = useState("");
  const [formData, setFormData] =
    useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [commentBody, setCommentBody] =
    useState("");


  // CAMPAIGN HQ TASK UX FIX
  const drawerBodyRef = useRef(null);
  const {
    tasks,
    team,
    comments,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    createTask,
    updateTask,
    changeTaskStatus,
    addComment,
  } = useTasksCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
    selectedTaskId,
  });

  const selectedTask = tasks.find(
    (task) => task.id === selectedTaskId,
  );


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
  const categories = useMemo(() => {
    return [
      ...new Set([
        ...CATEGORY_OPTIONS,
        ...tasks.map((task) => task.category),
      ]),
    ].filter(Boolean);
  }, [tasks]);

  const activeTasks = tasks.filter(
    (task) =>
      !["completed", "archived"].includes(
        task.status,
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

  const handleArchive = async () => {
    if (!selectedTask) {
      return;
    }

    try {
      await changeTaskStatus(
        selectedTask,
        "archived",
      );
      setSelectedTaskId("");
    } catch (archiveError) {
      console.error(
        "Task could not be archived:",
        archiveError,
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
        onOpen={setSelectedTaskId}
        onStatusChange={handleStatusChange}
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
    <div className={styles.app}>
      {isCampaignLeadership && (
        <div className={styles.adminBanner}>
          <ShieldCheck size={15} />
          {roleLabel} — task assignment and
          campaign-wide controls are active.
        </div>
      )}

      <CampaignSidebar
        activePage="Tasks"
        sidebarOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={styles}
        accessDescription={
          isCampaignLeadership
            ? "Assign work, manage deadlines and monitor campaign execution."
            : "Review your assigned responsibilities, updates and campaign deadlines."
        }
        showLeadership={
          isCampaignLeadership
        }
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div>
              <span className={styles.breadcrumb}>
                Campaign HQ
                <ChevronRight size={13} />
                Tasks
              </span>

              <strong>
                Task Command Center
              </strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            

          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>
                Campaign execution
              </span>

              <h1>
                Every task.
                <span> One accountable owner.</span>
              </h1>

              <p>
                Assign work, identify delays and keep the
                campaign moving without relying on scattered
                texts, emails or verbal reminders.
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
                unassignedTasks.length
                  ? styles.warningSummary
                  : ""
              } ${
                summaryFilter === "unassigned"
                  ? styles.summaryCardActive
                  : ""
              }`}
              type="button"
              onClick={() =>
                applySummaryFilter(
                  "unassigned",
                )
              }
              aria-pressed={
                summaryFilter === "unassigned"
              }
            >
              <div>
                <span>
                  Unassigned
                </span>

                <strong>
                  {isLoading ? "—" : unassignedTasks.length}
                </strong>
              </div>

              <UserRound
                size={22}
              />

              <p>
                Responsibilities without an owner
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
                <Filter size={15} />
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

          {isLoading && !tasks.length ? (
            <div className={styles.loadingState}>
              <LoaderCircle
                className={styles.spinner}
                size={30}
              />
              <strong>
                Opening the Task Command Center
              </strong>
              <span>
                Loading campaign responsibilities…
              </span>
            </div>
          ) : viewMode === "board" ? (
            <section className={styles.board}>
              {boardColumns.map((column) => {
                const columnTasks =
                  filteredTasks.filter(
                    (task) =>
                      task.status === column.status,
                  );

                return (
                  <div
                    key={column.status}
                    className={styles.boardColumn}
                  >
                    <div
                      className={styles.boardColumnHeader}
                    >
                      <div>
                        <span>
                          {column.description}
                        </span>
                        <h2>{column.title}</h2>
                      </div>

                      <strong>
                        {columnTasks.length}
                      </strong>
                    </div>

                    <div className={styles.boardTaskList}>
                      {renderTaskCollection(
                        columnTasks,
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : (
            <section className={styles.taskGrid}>
              {renderTaskCollection(filteredTasks)}
            </section>
          )}

          <footer className={styles.footer}>
            <span>© 2026 Campaign HQ</span>
            <div>
              <ShieldCheck size={14} />
              Authorized campaign use only
            </div>
          </footer>
        </main>
      </div>

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
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleArchive}
                >
                  <Archive size={16} />
                  Archive task
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {modalMode && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeModal}
            aria-label="Close task form"
          />

          <section className={styles.taskModal}>
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
              className={styles.taskForm}
              onSubmit={handleSubmit}
            >
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
                  disabled={isSaving}
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
    </div>
  );
}
