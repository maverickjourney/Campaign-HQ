import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Filter,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import {
  useTasksCommandCenter,
} from "../../hooks/useTasksCommandCenter";

import styles from "./TasksReferencePreview.module.css";

const PRIORITIES = {
  urgent: {
    label: "Urgent",
    rank: 0,
  },
  high: {
    label: "High",
    rank: 1,
  },
  normal: {
    label: "Medium",
    rank: 2,
  },
  low: {
    label: "Low",
    rank: 3,
  },
};

const STATUSES = {
  open: {
    label: "To do",
    progress: 0,
  },
  in_progress: {
    label: "In progress",
    progress: 50,
  },
  completed: {
    label: "Completed",
    progress: 100,
  },
  archived: {
    label: "Archived",
    progress: 100,
  },
};

const CATEGORIES = [
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

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function endOfNextSevenDays() {
  const date = endOfToday();
  date.setDate(date.getDate() + 7);
  return date;
}

function isActiveTask(task) {
  return ![
    "completed",
    "archived",
  ].includes(task.status);
}

function isOverdue(task) {
  if (!task.due_at || !isActiveTask(task)) {
    return false;
  }

  return new Date(task.due_at).getTime() < Date.now();
}

function isDueToday(task) {
  if (!task.due_at || !isActiveTask(task)) {
    return false;
  }

  const due = new Date(task.due_at);

  return (
    due >= startOfToday() &&
    due <= endOfToday()
  );
}

function isDueThisWeek(task) {
  if (!task.due_at || !isActiveTask(task)) {
    return false;
  }

  const due = new Date(task.due_at);

  return (
    due >= startOfToday() &&
    due <= endOfNextSevenDays()
  );
}

function isCompletedThisMonth(task) {
  if (
    task.status !== "completed" ||
    !task.completed_at
  ) {
    return false;
  }

  const completed = new Date(task.completed_at);
  const now = new Date();

  return (
    completed.getFullYear() === now.getFullYear() &&
    completed.getMonth() === now.getMonth()
  );
}

function getAssignee(task, team) {
  return team.find(
    (member) => member.id === task.assigned_to,
  );
}

function getCreator(task, team) {
  return team.find(
    (member) => member.id === task.created_by,
  );
}

function formatDueDate(value) {
  if (!value) {
    return {
      primary: "No deadline",
      secondary: "Not scheduled",
    };
  }

  const date = new Date(value);

  return {
    primary: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    }).format(date),
    secondary: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function formatRelativeTime(value) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  const difference = Math.max(
    0,
    Date.now() - date.getTime(),
  );

  const minutes = Math.floor(
    difference / 60000,
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function dateParts(value) {
  if (!value) {
    return {
      date: "",
      time: "17:00",
    };
  }

  const date = new Date(value);

  return {
    date: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-"),
    time: [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
    ].join(":"),
  };
}

function commentAuthor(comment) {
  return (
    comment.authorName ||
    comment.author_name ||
    comment.profile?.full_name ||
    "Campaign member"
  );
}

function commentBody(comment) {
  return (
    comment.body ||
    comment.comment ||
    comment.content ||
    ""
  );
}

function commentDate(comment) {
  return (
    comment.createdAt ||
    comment.created_at ||
    comment.updated_at
  );
}

export default function TasksReferencePreview() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();

  const canCreateTasks =
    hasCampaignPermission("tasks.create");

  const canAssignTasks =
    hasCampaignPermission("tasks.assign");

  const isLeadership =
    canAssignTasks ||
    [
      "campaign_owner",
      "campaign_consultant",
      "campaign_manager",
      "candidate",
      "owner",
      "manager",
    ].includes(
      user.roleKey ||
      user.assignedRole,
    );

  const [activeTab, setActiveTab] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("active");

  const [sortMode, setSortMode] =
    useState("due");

  const [selectedTaskId, setSelectedTaskId] =
    useState("");

  const [modalMode, setModalMode] =
    useState("");

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [formError, setFormError] =
    useState("");

  const [commentText, setCommentText] =
    useState("");

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


  const activeTasks = useMemo(
    () => tasks.filter(isActiveTask),
    [tasks],
  );

  const overdueTasks = useMemo(
    () => activeTasks.filter(isOverdue),
    [activeTasks],
  );

  const dueTodayTasks = useMemo(
    () => activeTasks.filter(isDueToday),
    [activeTasks],
  );

  const dueWeekTasks = useMemo(
    () => activeTasks.filter(isDueThisWeek),
    [activeTasks],
  );

  const completedMonthTasks = useMemo(
    () => tasks.filter(isCompletedThisMonth),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (
          activeTab === "all" &&
          !isActiveTask(task)
        ) {
          return false;
        }

        if (
          activeTab === "mine" &&
          task.assigned_to !== user.id
        ) {
          return false;
        }

        if (
          activeTab === "team" &&
          (
            !task.assigned_to ||
            task.assigned_to === user.id ||
            !isActiveTask(task)
          )
        ) {
          return false;
        }

        if (
          activeTab === "completed" &&
          task.status !== "completed"
        ) {
          return false;
        }

        if (
          statusFilter === "active" &&
          !isActiveTask(task)
        ) {
          return false;
        }

        if (
          ![
            "all",
            "active",
          ].includes(statusFilter) &&
          task.status !== statusFilter
        ) {
          return false;
        }

        if (
          priorityFilter !== "all" &&
          task.priority !== priorityFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          task.title,
          task.description,
          task.category,
          getAssignee(task, team)?.fullName,
          ...(task.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (sortMode === "priority") {
          return (
            (
              PRIORITIES[left.priority]?.rank ??
              99
            ) -
            (
              PRIORITIES[right.priority]?.rank ??
              99
            )
          );
        }

        if (sortMode === "updated") {
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
        }

        const leftOverdue = isOverdue(left);
        const rightOverdue = isOverdue(right);

        if (leftOverdue !== rightOverdue) {
          return leftOverdue ? -1 : 1;
        }

        if (left.due_at && right.due_at) {
          return (
            new Date(left.due_at).getTime() -
            new Date(right.due_at).getTime()
          );
        }

        if (left.due_at) {
          return -1;
        }

        if (right.due_at) {
          return 1;
        }

        return (
          (
            PRIORITIES[left.priority]?.rank ??
            99
          ) -
          (
            PRIORITIES[right.priority]?.rank ??
            99
          )
        );
      });
  }, [
    tasks,
    team,
    user.id,
    activeTab,
    search,
    priorityFilter,
    statusFilter,
    sortMode,
  ]);

  const selectedTask = tasks.find(
    (task) => task.id === selectedTaskId,
  );

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId("");
      return;
    }

    if (
      selectedTaskId &&
      visibleTasks.some(
        (task) => task.id === selectedTaskId,
      )
    ) {
      return;
    }

    setSelectedTaskId(
      visibleTasks[0].id,
    );
  }, [
    visibleTasks,
    selectedTaskId,
  ]);

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter("all");
    setStatusFilter(
      activeTab === "completed"
        ? "completed"
        : "active",
    );
    setSortMode("due");
  };

  const chooseTab = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setPriorityFilter("all");
    setStatusFilter(
      tab === "completed"
        ? "completed"
        : "active",
    );
  };

  const openCreateModal = () => {
    setFormData({
      ...EMPTY_FORM,
      assignedTo:
        isLeadership ? "" : user.id,
    });
    setFormError("");
    setModalMode("create");
  };

  const openEditModal = (task) => {
    const due = dateParts(task.due_at);

    setFormData({
      title: task.title || "",
      description:
        task.description || "",
      category:
        task.category || "General",
      priority:
        task.priority || "normal",
      status:
        task.status || "open",
      assignedTo:
        task.assigned_to || "",
      dueDate: due.date,
      dueTime: due.time,
      visibility:
        task.visibility || "workspace",
      tags:
        (task.tags || []).join(", "),
      estimatedMinutes:
        task.estimated_minutes
          ? String(task.estimated_minutes)
          : "",
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
    const {
      name,
      value,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveTask = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!formData.title.trim()) {
      setFormError(
        "Enter a clear task name.",
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
        formData.description.trim() ||
        null,
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
        const created =
          await createTask(taskData);

        if (created?.id) {
          setSelectedTaskId(created.id);
        }
      }

      setModalMode("");
    } catch (saveError) {
      setFormError(
        saveError?.message ||
        "The task could not be saved.",
      );
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();

    if (
      !selectedTask ||
      !commentText.trim()
    ) {
      return;
    }

    try {
      await addComment(
        selectedTask.id,
        commentText.trim(),
      );

      setCommentText("");
    } catch (commentError) {
      console.error(
        "Task comment could not be saved:",
        commentError,
      );
    }
  };

  const setTaskStatus = async (
    task,
    nextStatus,
  ) => {
    try {
      await changeTaskStatus(
        task,
        nextStatus,
      );
    } catch (statusError) {
      console.error(
        "Task status could not be changed:",
        statusError,
      );
    }
  };

  const summaryCards = [
    {
      key: "all",
      label: "Total tasks",
      value: activeTasks.length,
      caption: "All active campaign work",
      icon: ClipboardCheck,
    },
    {
      key: "today",
      label: "Due today",
      value: dueTodayTasks.length,
      caption: "Requires attention today",
      icon: CalendarClock,
    },
    {
      key: "week",
      label: "Due this week",
      value: dueWeekTasks.length,
      caption: "Next seven days",
      icon: Clock3,
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdueTasks.length,
      caption:
        overdueTasks.length
          ? "Immediate attention"
          : "Nothing overdue",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      key: "completed",
      label: "Completed",
      value: completedMonthTasks.length,
      caption: "Completed this month",
      icon: CheckCircle2,
      tone: "success",
    },
  ];

  const summaryClick = (key) => {
    if (key === "completed") {
      chooseTab("completed");
      return;
    }

    chooseTab("all");

    if (key === "overdue") {
      setSortMode("due");
    }
  };

  return (
    <CampaignWorkspaceShell activeItem="Tasks">
      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <span>Campaign execution</span>

            <h1>Tasks</h1>

            <p>
              Stay on top of every responsibility that
              moves the campaign forward.
            </p>

            <div className={styles.liveLine}>
              <span />

              {isLoading
                ? "Synchronizing campaign tasks…"
                : error
                  ? error
                  : lastUpdated
                    ? `Updated ${formatRelativeTime(
                        lastUpdated,
                      )}`
                    : "Live campaign task data"}
            </div>
          </div>

          <div className={styles.headingActions}>
            <label className={styles.headerSearch}>
              <Search size={18} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search tasks…"
              />

              <kbd>⌘K</kbd>
            </label>

            <button
              className={styles.refreshButton}
              type="button"
              onClick={refresh}
              disabled={isLoading}
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

            {(canCreateTasks ||
              isLeadership) && (
              <button
                className={styles.newTaskButton}
                type="button"
                onClick={openCreateModal}
              >
                <Plus size={18} />
                New task
                <ChevronDown size={15} />
              </button>
            )}
          </div>
        </section>

        <section
          className={styles.summaryGrid}
          aria-label="Task summary"
        >
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.key}
                className={`${styles.summaryCard} ${
                  card.tone
                    ? styles[card.tone]
                    : ""
                }`}
                type="button"
                onClick={() =>
                  summaryClick(card.key)
                }
              >
                <span className={styles.summaryIcon}>
                  <Icon size={20} />
                </span>

                <span className={styles.summaryCopy}>
                  <small>{card.label}</small>

                  <strong>{card.value}</strong>

                  <em>{card.caption}</em>
                </span>
              </button>
            );
          })}
        </section>

        <section
          className={`${styles.tasksWorkspace} ${
            selectedTask
              ? styles.hasDetails
              : ""
          }`}
        >
          <div className={styles.taskPanel}>
            <div className={styles.tabsBar}>
              <div
                className={styles.tabs}
                role="tablist"
                aria-label="Task views"
              >
                {[
                  ["all", "All tasks"],
                  ["mine", "My tasks"],
                  ["team", "Team tasks"],
                  ["completed", "Completed"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={
                      activeTab === key
                        ? styles.activeTab
                        : ""
                    }
                    type="button"
                    role="tab"
                    aria-selected={
                      activeTab === key
                    }
                    onClick={() =>
                      chooseTab(key)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.tableActions}>
                <label className={styles.selectControl}>
                  <Filter size={16} />

                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(
                        event.target.value,
                      )
                    }
                  >
                    <option value="all">
                      All priorities
                    </option>
                    <option value="urgent">
                      Urgent
                    </option>
                    <option value="high">
                      High
                    </option>
                    <option value="normal">
                      Medium
                    </option>
                    <option value="low">
                      Low
                    </option>
                  </select>
                </label>

                <label className={styles.selectControl}>
                  <ListChecks size={16} />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value,
                      )
                    }
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="all">
                      All statuses
                    </option>
                    <option value="open">
                      To do
                    </option>
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
                </label>

                <label className={styles.sortControl}>
                  <span>Sort:</span>

                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(
                        event.target.value,
                      )
                    }
                  >
                    <option value="due">
                      Due date
                    </option>
                    <option value="priority">
                      Priority
                    </option>
                    <option value="updated">
                      Recently updated
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.resultsLine}>
              <div>
                <strong>
                  {visibleTasks.length}
                </strong>

                <span>
                  {visibleTasks.length === 1
                    ? "task"
                    : "tasks"}
                </span>
              </div>

              {(search ||
                priorityFilter !== "all" ||
                statusFilter !==
                  (
                    activeTab === "completed"
                      ? "completed"
                      : "active"
                  ) ||
                sortMode !== "due") && (
                <button
                  type="button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className={styles.tableScroller}>
              <table className={styles.taskTable}>
                <thead>
                  <tr>
                    <th aria-label="Complete" />
                    <th>Task</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>

                <tbody>
                  {isLoading && !tasks.length ? (
                    <tr>
                      <td
                        className={styles.loadingCell}
                        colSpan="8"
                      >
                        <LoaderCircle
                          className={styles.spinning}
                          size={24}
                        />

                        Loading campaign tasks…
                      </td>
                    </tr>
                  ) : !visibleTasks.length ? (
                    <tr>
                      <td
                        className={styles.emptyCell}
                        colSpan="8"
                      >
                        <CheckCircle2 size={28} />

                        <strong>
                          No tasks match this view
                        </strong>

                        <span>
                          Adjust the filters or create
                          a new campaign task.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    visibleTasks.map((task) => {
                      const assignee =
                        getAssignee(task, team);

                      const due =
                        formatDueDate(task.due_at);

                      const priority =
                        PRIORITIES[task.priority] ||
                        PRIORITIES.normal;

                      const status =
                        STATUSES[task.status] ||
                        STATUSES.open;

                      const completed =
                        task.status === "completed";

                      return (
                        <tr
                          key={task.id}
                          className={`${styles.taskRow} ${
                            selectedTaskId === task.id
                              ? styles.selectedRow
                              : ""
                          } ${
                            isOverdue(task)
                              ? styles.overdueRow
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedTaskId(task.id)
                          }
                        >
                          <td>
                            <label
                              className={styles.taskCheckbox}
                              onClick={(event) =>
                                event.stopPropagation()
                              }
                            >
                              <input
                                type="checkbox"
                                checked={completed}
                                disabled={isSaving}
                                onChange={() =>
                                  setTaskStatus(
                                    task,
                                    completed
                                      ? "open"
                                      : "completed",
                                  )
                                }
                              />

                              <span>
                                {completed && (
                                  <Check size={13} />
                                )}
                              </span>
                            </label>
                          </td>

                          <td>
                            <button
                              className={styles.taskName}
                              type="button"
                              onClick={() =>
                                setSelectedTaskId(
                                  task.id,
                                )
                              }
                            >
                              <strong>
                                {task.title}
                              </strong>

                              <span>
                                {task.description ||
                                  "No description provided"}
                              </span>
                            </button>
                          </td>

                          <td>
                            <span
                              className={`${styles.priorityBadge} ${
                                styles[
                                  task.priority ||
                                  "normal"
                                ]
                              }`}
                            >
                              {priority.label}
                            </span>
                          </td>

                          <td>
                            <span className={styles.assignee}>
                              <span>
                                {getUserInitials(
                                  assignee?.fullName ||
                                  "Unassigned",
                                )}
                              </span>

                              <strong>
                                {assignee?.fullName ||
                                  "Unassigned"}
                              </strong>
                            </span>
                          </td>

                          <td>
                            <span
                              className={`${styles.dueDate} ${
                                isOverdue(task)
                                  ? styles.overdueDate
                                  : ""
                              }`}
                            >
                              <strong>
                                {isDueToday(task)
                                  ? "Today"
                                  : due.primary}
                              </strong>

                              <small>
                                {due.secondary}
                              </small>
                            </span>
                          </td>

                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                styles[
                                  task.status ||
                                  "open"
                                ]
                              }`}
                            >
                              <CircleDot size={11} />
                              {status.label}
                            </span>
                          </td>

                          <td>
                            <span className={styles.projectName}>
                              {task.category ||
                                "General"}
                            </span>
                          </td>

                          <td>
                            <button
                              className={styles.moreButton}
                              type="button"
                              aria-label={`Open ${task.title}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTaskId(
                                  task.id,
                                );
                              }}
                            >
                              <MoreVertical size={17} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <footer className={styles.tableFooter}>
              <span>
                Showing {visibleTasks.length} of{" "}
                {tasks.length} tasks
              </span>

              <span>
                Campaign Seat task command center
              </span>
            </footer>
          </div>

          {selectedTask && (
            <aside className={styles.detailsPanel}>
              <header className={styles.detailsHeader}>
                <div>
                  <span>
                    Task details
                  </span>

                  <strong>
                    Campaign responsibility
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedTaskId("")
                  }
                  aria-label="Close task details"
                >
                  <X size={19} />
                </button>
              </header>

              <div className={styles.detailsBody}>
                <section className={styles.detailsTitle}>
                  <div className={styles.detailTitleLine}>
                    <span
                      className={`${styles.priorityBadge} ${
                        styles[
                          selectedTask.priority ||
                          "normal"
                        ]
                      }`}
                    >
                      {
                        (
                          PRIORITIES[
                            selectedTask.priority
                          ] ||
                          PRIORITIES.normal
                        ).label
                      }{" "}
                      priority
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(selectedTask)
                      }
                      disabled={isSaving}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                  </div>

                  <h2>{selectedTask.title}</h2>

                  <p>
                    {selectedTask.description ||
                      "No additional description was provided."}
                  </p>
                </section>

                <section className={styles.detailFields}>
                  <div>
                    <span>
                      <Tag size={15} />
                      Project
                    </span>

                    <strong>
                      {selectedTask.category ||
                        "General"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <UserRound size={15} />
                      Assignee
                    </span>

                    <strong>
                      {getAssignee(
                        selectedTask,
                        team,
                      )?.fullName ||
                        "Unassigned"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CalendarClock size={15} />
                      Due date
                    </span>

                    <strong
                      className={
                        isOverdue(selectedTask)
                          ? styles.redText
                          : ""
                      }
                    >
                      {
                        formatDueDate(
                          selectedTask.due_at,
                        ).primary
                      }{" "}
                      ·{" "}
                      {
                        formatDueDate(
                          selectedTask.due_at,
                        ).secondary
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CircleDot size={15} />
                      Status
                    </span>

                    <select
                      value={
                        selectedTask.status ||
                        "open"
                      }
                      disabled={isSaving}
                      onChange={(event) =>
                        setTaskStatus(
                          selectedTask,
                          event.target.value,
                        )
                      }
                    >
                      <option value="open">
                        To do
                      </option>
                      <option value="in_progress">
                        In progress
                      </option>
                      <option value="completed">
                        Completed
                      </option>
                    </select>
                  </div>

                  <div>
                    <span>
                      <Clock3 size={15} />
                      Estimated work
                    </span>

                    <strong>
                      {selectedTask.estimated_minutes
                        ? `${selectedTask.estimated_minutes} minutes`
                        : "Not estimated"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <UsersRound size={15} />
                      Created by
                    </span>

                    <strong>
                      {getCreator(
                        selectedTask,
                        team,
                      )?.fullName ||
                        "Campaign member"}
                    </strong>
                  </div>
                </section>

                {!!selectedTask.tags?.length && (
                  <section className={styles.tagsBlock}>
                    <span>Tags</span>

                    <div>
                      {selectedTask.tags.map(
                        (tag) => (
                          <strong key={tag}>
                            {tag}
                          </strong>
                        ),
                      )}
                    </div>
                  </section>
                )}

                <section className={styles.progressBlock}>
                  <div>
                    <strong>Task progress</strong>

                    <span>
                      {
                        (
                          STATUSES[
                            selectedTask.status
                          ] ||
                          STATUSES.open
                        ).progress
                      }
                      %
                    </span>
                  </div>

                  <span className={styles.progressTrack}>
                    <span
                      style={{
                        width: `${
                          (
                            STATUSES[
                              selectedTask.status
                            ] ||
                            STATUSES.open
                          ).progress
                        }%`,
                      }}
                    />
                  </span>
                </section>

                <section className={styles.commentsBlock}>
                  <header>
                    <div>
                      <strong>
                        Activity and comments
                      </strong>

                      <span>
                        {comments.length} updates
                      </span>
                    </div>

                    <MessageSquare size={18} />
                  </header>

                  <div className={styles.commentList}>
                    {!comments.length ? (
                      <div className={styles.noComments}>
                        <MessageSquare size={22} />

                        <strong>
                          No comments yet
                        </strong>

                        <span>
                          Add the first campaign update.
                        </span>
                      </div>
                    ) : (
                      comments.map((comment) => {
                        const author =
                          commentAuthor(comment);

                        return (
                          <article key={comment.id}>
                            <span>
                              {getUserInitials(author)}
                            </span>

                            <div>
                              <header>
                                <strong>
                                  {author}
                                </strong>

                                <small>
                                  {formatRelativeTime(
                                    commentDate(
                                      comment,
                                    ),
                                  )}
                                </small>
                              </header>

                              <p>
                                {commentBody(comment)}
                              </p>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <form
                    className={styles.commentForm}
                    onSubmit={submitComment}
                  >
                    <textarea
                      value={commentText}
                      onChange={(event) =>
                        setCommentText(
                          event.target.value,
                        )
                      }
                      placeholder="Add a comment or campaign update…"
                      maxLength={5000}
                    />

                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        !commentText.trim()
                      }
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </section>
              </div>

              <footer className={styles.detailsFooter}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setTaskStatus(
                      selectedTask,
                      "archived",
                    )
                  }
                >
                  <Archive size={16} />
                  Archive
                </button>

                <button
                  className={styles.primaryDetailButton}
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setTaskStatus(
                      selectedTask,
                      selectedTask.status ===
                        "completed"
                        ? "open"
                        : "completed",
                    )
                  }
                >
                  <CheckCircle2 size={16} />

                  {selectedTask.status ===
                  "completed"
                    ? "Reopen task"
                    : "Mark complete"}
                </button>
              </footer>
            </aside>
          )}
        </section>
      </main>

      {modalMode && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalBackdrop}
            type="button"
            onClick={closeModal}
            aria-label="Close task form"
          />

          <section
            className={styles.taskModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
          >
            <header>
              <div>
                <span>
                  Campaign tasks
                </span>

                <h2 id="task-modal-title">
                  {modalMode === "edit"
                    ? "Edit task"
                    : "Create task"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={styles.taskForm}
              onSubmit={saveTask}
            >
              <label className={styles.fullField}>
                <span>Task name</span>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Example: Prepare debate briefing"
                  maxLength={180}
                  autoFocus
                />
              </label>

              <label className={styles.fullField}>
                <span>Description</span>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Explain what must be completed and what success looks like."
                  maxLength={5000}
                />
              </label>

              <label>
                <span>Assignee</span>

                <select
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
                      {member.fullName}
                      {member.displayTitle
                        ? ` · ${member.displayTitle}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Project</span>

                <select
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                >
                  {CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Priority</span>

                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleFormChange}
                >
                  <option value="urgent">
                    Urgent
                  </option>
                  <option value="high">
                    High
                  </option>
                  <option value="normal">
                    Medium
                  </option>
                  <option value="low">
                    Low
                  </option>
                </select>
              </label>

              <label>
                <span>Status</span>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="open">
                    To do
                  </option>
                  <option value="in_progress">
                    In progress
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                </select>
              </label>

              <label>
                <span>Due date</span>

                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                />
              </label>

              <label>
                <span>Due time</span>

                <input
                  type="time"
                  name="dueTime"
                  value={formData.dueTime}
                  onChange={handleFormChange}
                  disabled={!formData.dueDate}
                />
              </label>

              <label>
                <span>Visibility</span>

                <select
                  name="visibility"
                  value={formData.visibility}
                  onChange={handleFormChange}
                >
                  <option value="workspace">
                    Entire campaign team
                  </option>
                  <option value="assignee_only">
                    Assignee and leadership
                  </option>

                  {isLeadership && (
                    <option value="admin_only">
                      Campaign leadership only
                    </option>
                  )}
                </select>
              </label>

              <label>
                <span>Estimated minutes</span>

                <input
                  type="number"
                  name="estimatedMinutes"
                  min="1"
                  max="10080"
                  value={
                    formData.estimatedMinutes
                  }
                  onChange={handleFormChange}
                  placeholder="30"
                />
              </label>

              <label className={styles.fullField}>
                <span>Tags</span>

                <input
                  name="tags"
                  value={formData.tags}
                  onChange={handleFormChange}
                  placeholder="Separate tags with commas"
                />
              </label>

              {formError && (
                <p
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle size={16} />
                  {formError}
                </p>
              )}

              <footer>
                <button
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
                      className={styles.spinning}
                      size={17}
                    />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}

                  {modalMode === "edit"
                    ? "Save changes"
                    : "Add task"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
