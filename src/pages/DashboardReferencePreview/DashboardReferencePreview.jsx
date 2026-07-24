import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  Files,
  Flag,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  PhoneCall,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserCog,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  getCampaignExperience,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import { useCampaignDashboard } from "../../hooks/useCampaignDashboard";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import elizabethPhoto from "../../assets/images/dashboard/elizabeth.jpg";
import styles from "./DashboardReferencePreview.module.css";

const PRIMARY_NAVIGATION = [
  {
    label: "HQ",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    label: "Inbox",
    icon: Inbox,
    route: "/communications",
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    route: "/calendar",
  },
  {
    label: "Tasks",
    icon: CheckCircle2,
    route: "/tasks",
    countKey: "tasks",
  },
  {
    label: "Commitments",
    icon: Target,
    route: "/tasks",
  },
  {
    label: "Waiting On",
    icon: Clock3,
    route: "/approvals",
    countKey: "waiting",
  },
  {
    label: "Contacts",
    icon: Users,
    route: "/contacts",
  },
  {
    label: "Documents",
    icon: Files,
    route: "/files",
  },
  {
    label: "Approvals",
    icon: FileCheck2,
    route: "/approvals",
    countKey: "approvals",
  },
  {
    label: "Team",
    icon: UserCog,
    route: "/team",
  },
];

const CAMPAIGN_TOOLS = [
  {
    label: "Communications",
    icon: Mail,
    route: "/communications",
  },
  {
    label: "Volunteers",
    icon: Users,
    route: "/team",
  },
  {
    label: "Fundraising",
    icon: CircleDollarSign,
    route: "/workspace/settings",
  },
  {
    label: "Events",
    icon: CalendarDays,
    route: "/calendar",
  },
  {
    label: "Social Media",
    icon: MessageSquare,
    route: "/communications",
  },
  {
    label: "Media Center",
    icon: FolderKanban,
    route: "/files",
  },
  {
    label: "Reports & Analytics",
    icon: BarChart3,
    route: "/dashboard",
  },
];


// PRESENTATION PRIORITIES — START
const PRESENTATION_PRIORITIES = [
  {
    id: "presentation-reporter-response",
    title: "Respond to Palm Beach Post reporter",
    detail: "Waiting for 14 hours",
    priority: "urgent",
    icon: Star,
  },
  {
    id: "presentation-yard-sign",
    title: "Approve yard sign design",
    detail: "Vendor awaiting approval",
    priority: "high",
    icon: FileText,
  },
  {
    id: "presentation-budget-update",
    title: "Treasurer budget update",
    detail: "Requested 2 days ago",
    priority: "medium",
    icon: CircleDollarSign,
  },
  {
    id: "presentation-donor-notes",
    title: "Prepare donor call notes",
    detail: "Call with John Smith at 2:00 PM",
    priority: "medium",
    icon: PhoneCall,
  },
  {
    id: "presentation-volunteer-schedule",
    title: "Review volunteer schedule",
    detail: "Saturday canvass needs 3 more",
    priority: "low",
    icon: Users,
  },
];
// PRESENTATION PRIORITIES — END

const PRESENTATION_SCHEDULE = [
  {
    id: "presentation-standup",
    title: "Campaign Team Standup",
    location: "HQ Office",
    starts_at: "2026-07-24T09:00:00-04:00",
    attendeeLabels: ["EA", "CH", "TM"],
    attendeeOverflow: 4,
  },
  {
    id: "presentation-communications",
    title: "Communications Brief",
    location: "Zoom Meeting",
    starts_at: "2026-07-24T10:30:00-04:00",
    attendeeLabels: ["EA", "CH", "JS"],
    attendeeOverflow: 3,
  },
  {
    id: "presentation-lunch",
    title: "Lunch with Supporter",
    location: "150 Aero Club Dr, Wellington, FL",
    starts_at: "2026-07-24T12:00:00-04:00",
    attendeeLabels: [],
    attendeeOverflow: 0,
  },
  {
    id: "presentation-donor-call",
    title: "Donor Call: John Smith",
    location: "Phone Call",
    starts_at: "2026-07-24T14:00:00-04:00",
    attendeeLabels: [],
    attendeeOverflow: 0,
    highlight: true,
    phone: true,
    conflict: true,
  },
  {
    id: "presentation-media-review",
    title: "Media Strategy Review",
    location: "HQ Office",
    starts_at: "2026-07-24T16:00:00-04:00",
    attendeeLabels: ["EA", "CH", "TM"],
    attendeeOverflow: 2,
  },
  {
    id: "presentation-fundraiser",
    title: "Fundraiser Event",
    location: "Wellington Community Center",
    starts_at: "2026-07-24T18:00:00-04:00",
    attendeeLabels: [],
    attendeeOverflow: 0,
  },
];

// SPOTLIGHT SHORTCUT OPTIONS — START
const SPOTLIGHT_SHORTCUT_OPTIONS = [
  {
    key: "manage-users",
    label: "Manage users",
    icon: UserCog,
    route: "/team/access",
  },
  {
    key: "review-approvals",
    label: "Review approvals",
    icon: FileCheck2,
    route: "/approvals",
  },
  {
    key: "add-event",
    label: "Add event",
    icon: CalendarDays,
    route: "/calendar",
  },
  {
    key: "upload-file",
    label: "Upload file",
    icon: Files,
    route: "/files",
  },
  {
    key: "open-tasks",
    label: "Open tasks",
    icon: CheckCircle2,
    route: "/tasks",
  },
  {
    key: "volunteers",
    label: "Volunteers",
    icon: Users,
    route: "/team",
  },
  {
    key: "communications",
    label: "Communications",
    icon: Mail,
    route: "/communications",
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: Users,
    route: "/contacts",
  },
  {
    key: "field-operations",
    label: "Field operations",
    icon: MapPin,
    route: "/field-operations",
  },
  {
    key: "full-calendar",
    label: "Full calendar",
    icon: CalendarDays,
    route: "/calendar",
  },
  {
    key: "campaign-files",
    label: "Campaign files",
    icon: Files,
    route: "/files",
  },
  {
    key: "workspace-settings",
    label: "Workspace settings",
    icon: Settings,
    route: "/workspace/settings",
  },
];
// SPOTLIGHT SHORTCUT OPTIONS — END

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getDaysUntilElection(value) {
  const date = new Date(`${value || "2026-08-18"}T00:00:00`);
  const difference = date.getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(difference / (1000 * 60 * 60 * 24)),
  );
}

function formatTime(value) {
  if (!value) {
    return "No time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateBadge(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      month: "TBD",
      day: "—",
    };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
    })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
    }).format(date),
  };
}

function formatRelative(value) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatStatus(value = "") {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPriorityTone(value = "") {
  const normalized = String(value).toLowerCase();

  if (["urgent", "critical"].includes(normalized)) {
    return "urgent";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "medium") {
    return "medium";
  }

  return "low";
}

export default function DashboardReferencePreview() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [
    isEditingSpotlightShortcuts,
    setIsEditingSpotlightShortcuts,
  ] = useState(false);

  const [
    customSpotlightShortcutKeys,
    setCustomSpotlightShortcutKeys,
  ] = useState([]);

  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const experience = getCampaignExperience();
  const roleLabel = getRoleLabel();

  const normalizedRoleLabel = String(roleLabel || "")
    .trim()
    .toLowerCase();

  const effectiveExperienceKey =
    normalizedRoleLabel.includes("candidate")
      ? "candidate"
      : normalizedRoleLabel.includes("owner")
        ? "owner"
        : normalizedRoleLabel.includes("manager") ||
            normalizedRoleLabel.includes("consultant")
          ? "manager"
          : normalizedRoleLabel.includes("volunteer")
            ? "volunteer"
            : experience.key;

  const {
    data,
    isLoading,
    error,
    lastUpdated,
  } = useCampaignDashboard(workspace.id);

  const firstName = user.name.split(" ")[0] || "there";
  const initials = getUserInitials(user.name);
  const daysUntilElection = useMemo(
    () => getDaysUntilElection(workspace.electionDateRaw),
    [workspace.electionDateRaw],
  );

  const openTasks = data.tasks.filter((task) =>
    ["open", "in_progress"].includes(task.status),
  );

  const visibleTasks = [
    "owner",
    "manager",
    "candidate",
  ].includes(experience.key)
    ? openTasks
    : openTasks.filter(
        (task) =>
          task.assigned_to === user.id ||
          task.created_by === user.id,
      );

  const priorities = visibleTasks.slice(0, 5);

  const overdueTasks = openTasks.filter(
    (task) =>
      task.due_at &&
      new Date(task.due_at).getTime() < Date.now(),
  );

  const pendingApprovals = data.approvals.filter((approval) =>
    ["draft", "pending", "changes_requested"].includes(
      approval.status,
    ),
  );

  const upcomingEvents = data.events.slice(0, 6);

  const isPresentationWorkspace =
    workspace.id ===
      "11111111-1111-1111-1111-111111111111" ||
    workspace.name === "Elizabeth Accomando";

  const isUsingPresentationSchedule =
    isPresentationWorkspace &&
    upcomingEvents.length === 0 &&
    !isLoading;

  const displayedScheduleEvents =
    upcomingEvents.length > 0
      ? upcomingEvents
      : isUsingPresentationSchedule
        ? PRESENTATION_SCHEDULE
        : [];

  const hasScheduleConflict =
    displayedScheduleEvents.some(
      (event) => event.conflict,
    );

  const lowerEvents = data.events.slice(0, 3);

  const displayedPriorities =
    isPresentationWorkspace
      ? PRESENTATION_PRIORITIES
      : priorities;
  const recentActivity = data.activity.slice(0, 4);

  const latestMetric =
    data.metrics[data.metrics.length - 1] || {};

  const campaignHealth = Number(
    latestMetric.campaign_health || 0,
  );

  const shiftsFilled = Number(
    latestMetric.volunteer_shifts_filled || 0,
  );

  const shiftsGoal = Number(
    latestMetric.volunteer_shifts_goal || 0,
  );

  const volunteerCoverage =
    shiftsGoal > 0
      ? Math.round((shiftsFilled / shiftsGoal) * 100)
      : 0;

  const messagesSent = Number(
    latestMetric.messages_sent || 0,
  );

  const messagesOpened = Number(
    latestMetric.messages_opened || 0,
  );

  const responseRate =
    messagesSent > 0
      ? Math.round((messagesOpened / messagesSent) * 100)
      : 0;

  const navigationCounts = {
    tasks: openTasks.length,
    waiting: overdueTasks.length,
    approvals: pendingApprovals.length,
  };

  const quickActionsByExperience = {
    owner: [
      {
        label: "Manage users",
        icon: UserCog,
        route: "/team/access",
      },
      {
        label: "Review approvals",
        icon: FileCheck2,
        route: "/approvals",
      },
      {
        label: "Add event",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Upload file",
        icon: Files,
        route: "/files",
      },
    ],
    manager: [
      {
        label: "Field operations",
        icon: MapPin,
        route: "/field-operations",
      },
      {
        label: "View calendar",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Message team",
        icon: Mail,
        route: "/communications",
      },
      {
        label: "Manage team",
        icon: UserCog,
        route: "/team",
      },
    ],
    candidate: [
      {
        label: "Review approvals",
        icon: FileCheck2,
        route: "/approvals",
      },
      {
        label: "View calendar",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Open files",
        icon: Files,
        route: "/files",
      },
      {
        label: "Message managers",
        icon: Mail,
        route: "/communications",
      },
    ],
    volunteer: [
      {
        label: "My tasks",
        icon: CheckCircle2,
        route: "/tasks",
      },
      {
        label: "My schedule",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Campaign files",
        icon: Files,
        route: "/files",
      },
      {
        label: "Message coordinator",
        icon: Mail,
        route: "/communications",
      },
    ],
  };

  const quickActions =
    quickActionsByExperience[effectiveExperienceKey] ||
    quickActionsByExperience.volunteer;

  // EDITABLE SPOTLIGHT SHORTCUTS — START
  const recommendedShortcutKeysByRole = {
    owner: [
      "manage-users",
      "review-approvals",
      "add-event",
      "upload-file",
    ],
    manager: [
      "field-operations",
      "full-calendar",
      "communications",
      "volunteers",
    ],
    candidate: [
      "review-approvals",
      "full-calendar",
      "campaign-files",
      "communications",
    ],
    volunteer: [
      "open-tasks",
      "full-calendar",
      "campaign-files",
      "communications",
    ],
  };

  const recommendedSpotlightShortcutKeys =
    isPresentationWorkspace
      ? [
          "manage-users",
          "review-approvals",
          "add-event",
          "upload-file",
        ]
      : recommendedShortcutKeysByRole[
          effectiveExperienceKey
        ] ||
        recommendedShortcutKeysByRole.volunteer;

  const activeSpotlightShortcutKeys =
    customSpotlightShortcutKeys.length > 0
      ? customSpotlightShortcutKeys
      : recommendedSpotlightShortcutKeys;

  const spotlightActions =
    activeSpotlightShortcutKeys
      .map((key) =>
        SPOTLIGHT_SHORTCUT_OPTIONS.find(
          (option) => option.key === key,
        ),
      )
      .filter(Boolean);

  const toggleSpotlightShortcut = (key) => {
    setCustomSpotlightShortcutKeys((current) => {
      const selection =
        current.length > 0
          ? current
          : recommendedSpotlightShortcutKeys;

      if (selection.includes(key)) {
        if (selection.length === 1) {
          return selection;
        }

        return selection.filter(
          (selectedKey) => selectedKey !== key,
        );
      }

      if (selection.length >= 4) {
        return selection;
      }

      return [...selection, key];
    });
  };

  const resetSpotlightShortcuts = () => {
    setCustomSpotlightShortcutKeys([]);
  };
  // EDITABLE SPOTLIGHT SHORTCUTS — END

  // PRESENTATION SPOTLIGHT ACTIONS — START
  // PRESENTATION SPOTLIGHT ACTIONS — END

  const sidebar = (
    <aside
      className={`${styles.sidebar} ${
        sidebarOpen ? styles.sidebarOpen : ""
      }`}
    >
      <div className={styles.sidebarBrand}>
        <div>
          <strong>Campaign Seat</strong>
          <span>Campaign Operations Platform</span>
        </div>

        <button
          type="button"
          className={styles.closeSidebar}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X size={19} />
        </button>
      </div>

      <nav className={styles.sidebarNavigation}>
        {PRIMARY_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const count = item.countKey
            ? navigationCounts[item.countKey]
            : 0;

          return (
            <button
              key={item.label}
              className={
                item.label === "HQ"
                  ? styles.activeNavigation
                  : ""
              }
              type="button"
              onClick={() => {
                navigate(item.route);
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} strokeWidth={1.9} />
              <span>{item.label}</span>

              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}

        <span className={styles.navigationLabel}>
          Campaign tools
        </span>

        {CAMPAIGN_TOOLS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                navigate(item.route);
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <span className={styles.navigationLabel}>
          Connected apps
        </span>

        <div className={styles.connectedApps}>
          <button
            type="button"
            onClick={() =>
              navigate("/workspace/settings")
            }
            aria-label="Email integration"
          >
            <Mail size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/workspace/settings")
            }
            aria-label="Calendar integration"
          >
            <CalendarDays size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/workspace/settings")
            }
            aria-label="File storage integration"
          >
            <Files size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/workspace/settings")
            }
            aria-label="Messaging integration"
          >
            <MessageSquare size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/workspace/settings")
            }
            aria-label="Add integration"
          >
            <Plus size={16} />
          </button>
        </div>
      </nav>

      <div className={styles.sidebarProfile}>
        <span className={styles.profileAvatar}>
          {initials}
        </span>

        <div>
          <strong>{user.name}</strong>
          <span>{roleLabel}</span>
        </div>

        <ChevronDown size={15} />
      </div>
    </aside>
  );

  return (
    <div className={styles.app}>
      {sidebar}

      {sidebarOpen && (
        <button
          className={styles.sidebarScrim}
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className={styles.greeting}>
            <h1>
              {getGreeting()},{" "}
              <span>{firstName}.</span>
            </h1>
            <p>
              Here is what is happening with your campaign
              today.
            </p>
          </div>

          <div className={styles.topbarActions}>
            <CampaignSearch />
            <ActivityCenter />

            <button
              className={styles.workspaceSwitcher}
              type="button"
              onClick={() => navigate("/workspaces")}
            >
              <span className={styles.workspaceMark}>
                {workspace.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>

              <span>
                <strong>{workspace.name}</strong>
                <small>{workspace.location}</small>
              </span>

              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <main className={styles.main}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <section className={styles.heroGrid}>
<article
              className={`${styles.compactCard} ${styles.heroPriorityCard}`}
              tabIndex={0}
              aria-label="Today’s campaign priorities"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Flag size={15} />
                  Today&apos;s priorities
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/tasks")}
                >
                  View all
                </button>
              </div>

              <div className={styles.priorityList}>
                {displayedPriorities.map((task) => {
                  const tone =
                    getPriorityTone(task.priority);

                  const PriorityIcon =
                    task.icon || CheckCircle2;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() =>
                        navigate("/tasks")
                      }
                    >
                      <span
                        className={`${styles.priorityIcon} ${
                          styles[tone]
                        }`}
                      >
                        <PriorityIcon size={14} />
                      </span>

                      <span className={styles.priorityCopy}>
                        <strong>{task.title}</strong>
                        <small>
                          {task.detail ||
                            task.description ||
                            task.category ||
                            "Campaign task"}
                        </small>
                      </span>

                      <span
                        className={`${styles.priorityBadge} ${
                          styles[tone]
                        }`}
                      >
                        {task.priority || "Normal"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.priorityMonitoring}>
                <Sparkles size={15} />

                <span>
                  Campaign Seat is monitoring{" "}
                  <strong>23 more items</strong>
                </span>
              </div>
            </article>
            <div className={styles.centerHeroStack}>
              <article className={styles.heroCard}>
                            <div className={styles.heroCopy}>
                              <span className={styles.sectionEyebrow}>
                                Campaign spotlight
                              </span>

                              <h2>
                                Building momentum for
                                <br />
                                <strong>
                                  {workspace.description
                                    ?.split(",")
                                    .pop()
                                    ?.trim() || "the campaign"}.
                                </strong>
                              </h2>

                              <p>
                                One campaign hub for events, volunteer
                                activity, approvals, files and team
                                communication.
                              </p>

                              <div className={styles.heroTags}>
                                <span>Community</span>
                                <span>Leadership</span>
                                <span>
                                  {workspace.location
                                    ?.split(",")
                                    .slice(0, 1)
                                    .join(",") || "Campaign"}
                                </span>
                              </div>

                              <div className={styles.heroStats}>
                                <div>
                                  <small>Election day</small>
                                  <strong>{daysUntilElection}</strong>
                                  <span>
                                    days to {workspace.electionDate}
                                  </span>
                                </div>

                              </div>

                              <div className={styles.heroShortcutArea}>
                                <div className={styles.heroActions}>
                                  {spotlightActions.map((action) => {
                                    const Icon = action.icon;

                                    return (
                                      <button
                                        key={action.key}
                                        type="button"
                                        onClick={() =>
                                          navigate(action.route)
                                        }
                                      >
                                        <Icon size={15} />
                                        <span>{action.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                <button
                                  className={styles.editShortcutsButton}
                                  type="button"
                                  aria-expanded={
                                    isEditingSpotlightShortcuts
                                  }
                                  onClick={() =>
                                    setIsEditingSpotlightShortcuts(
                                      (current) => !current,
                                    )
                                  }
                                >
                                  <Settings size={13} />
                                  Edit shortcuts
                                </button>

                                {isEditingSpotlightShortcuts && (
                                  <div
                                    className={styles.shortcutEditor}
                                    role="dialog"
                                    aria-label="Edit campaign shortcuts"
                                  >
                                    <div
                                      className={
                                        styles.shortcutEditorHeader
                                      }
                                    >
                                      <div>
                                        <strong>
                                          Campaign shortcuts
                                        </strong>

                                        <small>
                                          Choose up to four items to keep
                                          in this spotlight.
                                        </small>
                                      </div>

                                      <button
                                        type="button"
                                        aria-label="Close shortcut editor"
                                        onClick={() =>
                                          setIsEditingSpotlightShortcuts(
                                            false,
                                          )
                                        }
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <div
                                      className={styles.shortcutOptions}
                                    >
                                      {SPOTLIGHT_SHORTCUT_OPTIONS.map(
                                        (option) => {
                                          const Icon = option.icon;

                                          const isSelected =
                                            activeSpotlightShortcutKeys.includes(
                                              option.key,
                                            );

                                          return (
                                            <button
                                              key={option.key}
                                              type="button"
                                              aria-pressed={isSelected}
                                              className={
                                                isSelected
                                                  ? styles.selectedShortcut
                                                  : ""
                                              }
                                              onClick={() =>
                                                toggleSpotlightShortcut(
                                                  option.key,
                                                )
                                              }
                                            >
                                              <Icon size={15} />
                                              <span>{option.label}</span>

                                              {isSelected && (
                                                <CheckCircle2 size={14} />
                                              )}
                                            </button>
                                          );
                                        },
                                      )}
                                    </div>

                                    <div
                                      className={
                                        styles.shortcutEditorFooter
                                      }
                                    >
                                      <span>
                                        {
                                          activeSpotlightShortcutKeys.length
                                        }
                                        /4 selected
                                      </span>

                                      <button
                                        type="button"
                                        onClick={
                                          resetSpotlightShortcuts
                                        }
                                      >
                                        Reset recommended
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={styles.heroPortraitWrap}>
                              <img
                                src={elizabethPhoto}
                                alt={workspace.name}
                                className={styles.heroPortrait}
                              />
                            </div>
                          </article>

              <section
                className={styles.campaignAiPanel}
                aria-label="Ask Campaign HQ"
              
              data-campaign-ai-panel="true"
            >
                <span className={styles.campaignAiIcon}>
                  <Sparkles size={18} />
                </span>

                <div className={styles.campaignAiCopy}>
      <span className={styles.campaignAiLive}>
        <i aria-hidden="true" />
        Live campaign intelligence
      </span>

                  <strong>Ask Campaign HQ</strong>
                  <small>
                    Get a quick briefing, find campaign
                    work or ask what needs attention.
                  </small>
                </div>

                <div className={styles.campaignAiAction}>
                  <button
                    className={styles.campaignAiLauncher}
                    type="button"
                    aria-label="Open Ask Campaign HQ"
                    onClick={() => {
                      const aiPanel =
                        document.querySelector(
                          '[data-campaign-ai-panel="true"]',
                        );

                      const globalLauncher =
                        Array.from(
                          document.querySelectorAll("button"),
                        ).find((button) => {
                          if (aiPanel?.contains(button)) {
                            return false;
                          }

                          const label = [
                            button.getAttribute("aria-label") || "",
                            button.textContent || "",
                          ]
                            .join(" ")
                            .replace(/\s+/g, " ")
                            .trim()
                            .toLowerCase();

                          return label.includes(
                            "ask campaign hq",
                          );
                        });

                      if (globalLauncher) {
                        globalLauncher.click();
                        return;
                      }

                      window.dispatchEvent(
                        new KeyboardEvent("keydown", {
                          key: "k",
                          code: "KeyK",
                          metaKey: true,
                          ctrlKey: true,
                          bubbles: true,
                        }),
                      );
                    }}
                  >
                    <Sparkles size={18} />
                    <span>Ask Campaign HQ</span>
                    <kbd>⌘K</kbd>
                  </button>
                </div>
              </section>
            </div>

            <article
              className={styles.scheduleCard}
              tabIndex={0}
              aria-label="Today’s campaign schedule"
            >
              <div className={styles.cardHeading}>
                <span>
                  <CalendarDays size={15} />
                  Today&apos;s schedule
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/calendar")}
                >
                  View calendar
                </button>
              </div>

              <div
                className={`${styles.scheduleTimeline} ${
                  !displayedScheduleEvents.length
                    ? styles.emptyTimeline
                    : ""
                }`}
              >
                {displayedScheduleEvents.length ? (
                  displayedScheduleEvents.map(
                    (event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() =>
                          navigate("/calendar")
                        }
                        className={
                          event.highlight
                            ? styles.activeSchedule
                            : ""
                        }
                      >
                        <time>
                          {formatTime(event.starts_at)}
                        </time>

                        <span
                          className={styles.timelineDot}
                        />

                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {event.location ||
                              "Location pending"}
                          </small>
                        </span>

                        {event.phone ? (
                          <span
                            className={styles.phoneAction}
                            aria-label="Phone call"
                          >
                            <PhoneCall size={14} />
                          </span>
                        ) : event.attendeeLabels?.length ? (
                          <span
                            className={
                              styles.attendeeStack
                            }
                            aria-label="Scheduled attendees"
                          >
                            {event.attendeeLabels.map(
                              (label) => (
                                <i key={label}>
                                  {label}
                                </i>
                              ),
                            )}

                            {event.attendeeOverflow > 0 && (
                              <i>
                                +{event.attendeeOverflow}
                              </i>
                            )}
                          </span>
                        ) : (
                          <ArrowRight size={14} />
                        )}
                      </button>
                    ),
                  )
                ) : (
                  <div className={styles.emptyState}>
                    <CalendarDays size={22} />
                    <strong>
                      {isLoading
                        ? "Loading schedule…"
                        : "No upcoming events"}
                    </strong>
                    <p>
                      New campaign events will appear here.
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`${styles.scheduleFooter} ${
                  hasScheduleConflict
                    ? styles.scheduleConflict
                    : ""
                }`}
              >
                <Clock3 size={14} />

                {hasScheduleConflict
                  ? "You have 1 conflict"
                  : displayedScheduleEvents.length
                    ? `${displayedScheduleEvents.length} upcoming ${
                        displayedScheduleEvents.length === 1
                          ? "event"
                          : "events"
                      }`
                    : "Campaign schedule is clear"}

                {hasScheduleConflict && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/calendar")
                    }
                  >
                    Resolve
                  </button>
                )}
              </div>
            </article>
          </section>

          <section className={styles.middleGrid}>
            

            <article
              className={styles.compactCard}
              tabIndex={0}
              aria-label="Campaign communications summary"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Mail size={15} />
                  Communications
                </span>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/communications")
                  }
                >
                  Open
                </button>
              </div>

              <div className={styles.metricNumber}>
                {responseRate}%
              </div>

              <p className={styles.metricDescription}>
                Message open response
              </p>

              <div className={styles.communicationStats}>
                <span>
                  <strong>
                    {messagesSent.toLocaleString()}
                  </strong>
                  Sent
                </span>

                <span>
                  <strong>
                    {messagesOpened.toLocaleString()}
                  </strong>
                  Opened
                </span>
              </div>
            </article>

            <article
              className={styles.compactCard}
              tabIndex={0}
              aria-label="Campaign follow-ups"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Clock3 size={15} />
                  Waiting on
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/approvals")}
                >
                  View all
                </button>
              </div>

              <div className={styles.waitingMetric}>
                <strong>
                  {pendingApprovals.length +
                    overdueTasks.length}
                </strong>
                <span>Open follow-ups</span>
              </div>

              <div className={styles.waitingList}>
                {pendingApprovals.slice(0, 2).map(
                  (approval) => (
                    <button
                      key={approval.id}
                      type="button"
                      onClick={() =>
                        navigate("/approvals")
                      }
                    >
                      <span>{approval.title}</span>
                      <small>
                        {formatStatus(approval.status)}
                      </small>
                    </button>
                  ),
                )}

                {overdueTasks.slice(0, 1).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate("/tasks")}
                  >
                    <span>{task.title}</span>
                    <small className={styles.overdue}>
                      Overdue
                    </small>
                  </button>
                ))}

                {!pendingApprovals.length &&
                  !overdueTasks.length && (
                    <div className={styles.emptyMini}>
                      Nothing is waiting.
                    </div>
                  )}
              </div>
            </article>

            <article
              className={styles.compactCard}
              tabIndex={0}
              aria-label="Campaign health"
            >
              <div className={styles.cardHeading}>
                <span>
                  <TrendingUp size={15} />
                  Campaign health
                </span>

                <small>
                  {lastUpdated
                    ? formatRelative(lastUpdated)
                    : "Live"}
                </small>
              </div>

              <div className={styles.healthLayout}>
                <div
                  className={styles.healthRing}
                  style={{
                    background: `conic-gradient(#ef3340 ${
                      campaignHealth * 3.6
                    }deg, #e5ebf2 0deg)`,
                  }}
                >
                  <div>
                    <strong>{campaignHealth}</strong>
                    <span>Healthy</span>
                  </div>
                </div>

                <div>
                  <span>
                    Field
                    <strong>
                      {latestMetric.field_health || 0}%
                    </strong>
                  </span>
                  <span>
                    Events
                    <strong>
                      {latestMetric.events_health || 0}%
                    </strong>
                  </span>
                  <span>
                    Volunteers
                    <strong>
                      {latestMetric.volunteers_health || 0}%
                    </strong>
                  </span>
                  <span>
                    Tasks
                    <strong>
                      {overdueTasks.length > 0
                        ? "Needs attention"
                        : "On track"}
                    </strong>
                  </span>
                </div>
              </div>
            </article>

            <article
              className={styles.compactCard}
              tabIndex={0}
              aria-label="Recent campaign activity"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Zap size={15} />
                  Recent activity
                </span>
              </div>

              <div className={styles.activityList}>
                {recentActivity.length ? (
                  recentActivity.map((item) => (
                    <div key={item.id}>
                      <span className={styles.activityDot} />

                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.detail ||
                            "Campaign workspace update"}
                        </small>
                      </span>

                      <time>
                        {formatRelative(item.occurred_at)}
                      </time>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>
                    No recent activity.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article
              className={styles.lowerCard}
              tabIndex={0}
              aria-label="Upcoming campaign events"
            >
              <div className={styles.cardHeading}>
                <span>
                  <CalendarDays size={15} />
                  Upcoming events
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/calendar")}
                >
                  View calendar
                </button>
              </div>

              <div className={styles.upcomingList}>
                {lowerEvents.length ? (
                  lowerEvents.map((event) => {
                    const badge = formatDateBadge(
                      event.starts_at,
                    );

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() =>
                          navigate("/calendar")
                        }
                      >
                        <span className={styles.dateBadge}>
                          <small>{badge.month}</small>
                          <strong>{badge.day}</strong>
                        </span>

                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {formatTime(event.starts_at)} ·{" "}
                            {event.location ||
                              "Location pending"}
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.emptyMini}>
                    No upcoming events.
                  </div>
                )}
              </div>
            </article>

            <article
              className={styles.lowerCard}
              tabIndex={0}
              aria-label="Volunteer activity"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Users size={15} />
                  Volunteer activity
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/team")}
                >
                  View all
                </button>
              </div>

              <div className={styles.volunteerMetric}>
                <strong>
                  {data.volunteerCount > 0
                    ? data.volunteerCount.toLocaleString()
                    : "—"}
                </strong>
                <span>
                  {data.volunteerCount > 0
                    ? "Active volunteer records"
                    : "No active volunteer records found"}
                </span>
              </div>

              <div className={styles.coverageRow}>
                <span>
                  Shift coverage
                  <strong>{volunteerCoverage}%</strong>
                </span>

                <div>
                  <span
                    style={{
                      width: `${volunteerCoverage}%`,
                    }}
                  />
                </div>

                <small>
                  Shift coverage metric · {shiftsFilled} of{" "}
                  {shiftsGoal} shifts filled
                </small>
              </div>
            </article>

            <article
              className={styles.lowerCard}
              tabIndex={0}
              aria-label="Fundraising snapshot"
            >
              <div className={styles.cardHeading}>
                <span>
                  <CircleDollarSign size={15} />
                  Fundraising snapshot
                </span>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/workspace/settings")
                  }
                >
                  Configure
                </button>
              </div>

              <div className={styles.integrationState}>
                <ShieldCheck size={22} />
                <strong>
                  Fundraising data is not connected
                </strong>
                <p>
                  Connect an approved fundraising provider
                  to display verified totals here.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/workspace/settings")
                  }
                >
                  Open integration settings
                  <ArrowRight size={14} />
                </button>
              </div>
            </article>

            <article
              className={styles.lowerCard}
              tabIndex={0}
              aria-label="Approval queue"
            >
              <div className={styles.cardHeading}>
                <span>
                  <FileCheck2 size={15} />
                  Approval queue
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/approvals")}
                >
                  View all
                </button>
              </div>

              <div className={styles.approvalMetric}>
                <strong>{pendingApprovals.length}</strong>
                <span>Items awaiting review</span>
              </div>

              <div className={styles.approvalList}>
                {pendingApprovals.slice(0, 3).map(
                  (approval) => (
                    <button
                      key={approval.id}
                      type="button"
                      onClick={() =>
                        navigate("/approvals")
                      }
                    >
                      <span>
                        <strong>{approval.title}</strong>
                        <small>
                          {formatStatus(
                            approval.approval_type,
                          )}
                        </small>
                      </span>

                      <small
                        className={styles.approvalStatus}
                      >
                        {formatStatus(approval.status)}
                      </small>
                    </button>
                  ),
                )}

                {!pendingApprovals.length && (
                  <div className={styles.emptyMini}>
                    Approval queue is clear.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className={styles.tipBar}>
            <Sparkles size={16} />
            <p>
              <strong>Campaign Seat tip:</strong> Ask
              Campaign HQ what needs attention today.
            </p>

            <button
              type="button"
              onClick={() => navigate("/tasks")}
            >
              Open priorities
              <ArrowRight size={14} />
            </button>
          </section>

          <footer className={styles.footer}>
            <span>
              © 2026 Campaign Seat Technologies LLC
            </span>

            <span>
              Authorized campaign use only
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
