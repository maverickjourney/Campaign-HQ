import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Files,
  FolderKanban,
  Mail,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
} from "lucide-react";

import {
  getAccessMode,
  getCampaignExperience,
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";
import { useCampaignDashboard } from "../../hooks/useCampaignDashboard";

import elizabethPhoto from "../../assets/images/dashboard/elizabeth.jpg";
import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import styles from "./Dashboard.module.css";

// CAMPAIGN HQ CALENDAR LINT COMPLETION

function formatRelativeTime(value) {
  if (!value) {
    return "just now";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const difference = Date.now() - date.getTime();
  const minutes = Math.max(
    0,
    Math.floor(difference / (1000 * 60)),
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

  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDueLabel(value) {
  if (!value) {
    return "No due date";
  }

  const dueDate = new Date(value);

  if (Number.isNaN(dueDate.getTime())) {
    return "Due date unavailable";
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isSameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(dueDate);

  if (dueDate.getTime() < Date.now()) {
    return `Overdue · ${time}`;
  }

  if (isSameDay(dueDate, today)) {
    return `Due today · ${time}`;
  }

  if (isSameDay(dueDate, tomorrow)) {
    return `Due tomorrow · ${time}`;
  }

  return `Due ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(dueDate)}`;
}

function formatEventDate(value) {
  const date = new Date(value);

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

function formatEventTime(startsAt, endsAt) {
  const start = new Date(startsAt);

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endsAt) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} – ${formatter.format(
    new Date(endsAt),
  )}`;
}

function formatEventType(value = "campaign") {
  return value
    .split("_")
    .map((part) => {
      return (
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase()
      );
    })
    .join(" ");
}

function createBars(values) {
  const safeValues = values.map((value) =>
    Number(value || 0),
  );

  if (!safeValues.length) {
    return [18, 18, 18, 18, 18, 18];
  }

  const maximum = Math.max(...safeValues, 1);

  return safeValues.map((value) =>
    Math.max(18, Math.round((value / maximum) * 100)),
  );
}

function formatChange(current, previous, suffix = "") {
  const change =
    Number(current || 0) - Number(previous || 0);

  if (change === 0) {
    return `No change${suffix}`;
  }

  return `${change > 0 ? "+" : ""}${change}${suffix}`;
}


function getGreeting() {
  const currentHour = new Date().getHours();

  if (currentHour < 12) {
    return "Good morning";
  }

  if (currentHour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getDaysUntilElection(electionDateRaw) {
  const electionDate = new Date(
    `${electionDateRaw || "2026-08-18"}T00:00:00`,
  );
  const today = new Date();
  const difference = electionDate.getTime() - today.getTime();

  return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const accessMode = getAccessMode();
  const campaignExperience =
    getCampaignExperience();
  const isAdmin =
    accessMode === "admin";
const {
    data: dashboardData,
    isLoading,
    error,
    lastUpdated,
    updateTaskStatus,
  } = useCampaignDashboard(workspace.id);
  const activeNavigation = "Overview";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState("");

  const daysUntilElection = useMemo(
    () => getDaysUntilElection(workspace.electionDateRaw),
    [workspace.electionDateRaw],
  );

  const firstName = user.name.split(" ")[0] || "there";

  const {
    tasks,
    events,
    approvals,
    activity,
    metrics: metricHistory,
    volunteerCount,
  } = dashboardData;

  const latestMetric =
    metricHistory[metricHistory.length - 1] || {};

  const previousMetric =
    metricHistory[metricHistory.length - 2] || {};

  const campaignHealth =
    latestMetric.campaign_health || 0;

  const campaignReadiness =
    latestMetric.campaign_readiness || 0;

  const shiftsFilled =
    latestMetric.volunteer_shifts_filled || 0;

  const shiftsGoal =
    latestMetric.volunteer_shifts_goal || 0;

  const volunteerCoverage =
    shiftsGoal > 0
      ? Math.round((shiftsFilled / shiftsGoal) * 100)
      : 0;

  const messagesSent =
    latestMetric.messages_sent || 0;

  const messagesOpened =
    latestMetric.messages_opened || 0;

  const responseRate =
    messagesSent > 0
      ? Math.round((messagesOpened / messagesSent) * 100)
      : 0;

  const previousResponseRate =
    previousMetric.messages_sent > 0
      ? Math.round(
          (
            previousMetric.messages_opened /
            previousMetric.messages_sent
          ) * 100,
        )
      : 0;

  const openTasks = tasks.filter((task) =>
    ["open", "in_progress"].includes(task.status),
  );

  const visibleTasks = isAdmin
    ? openTasks
    : openTasks.filter(
        (task) =>
          task.assigned_to === user.id ||
          task.created_by === user.id,
      );

  const priorities = visibleTasks
    .slice(0, 3)
    .map((task) => ({
      ...task,
      time: formatDueLabel(task.due_at),
    }));

  const openApprovals = approvals.filter((approval) =>
    ["draft", "pending", "changes_requested"].includes(
      approval.status,
    ),
  );

  const upcomingEvents = events
    .slice(0, 3)
    .map((event) => {
      const eventDate = formatEventDate(event.starts_at);

      return {
        ...event,
        month: eventDate.month,
        day: eventDate.day,
        time: formatEventTime(
          event.starts_at,
          event.ends_at,
        ),
        type: formatEventType(event.event_type),
      };
    });

  const recentActivity = activity
    .slice(0, 3)
    .map((item) => ({
      ...item,
      time: formatRelativeTime(item.occurred_at),
    }));

  const liveFeed = activity
    .slice(0, 4)
    .map((item) => ({
      ...item,
      time: formatRelativeTime(item.occurred_at),
    }));

  const healthBreakdown = [
    {
      label: "Field",
      value: latestMetric.field_health || 0,
    },
    {
      label: "Events",
      value: latestMetric.events_health || 0,
    },
    {
      label: "Communications",
      value:
        latestMetric.communications_health || 0,
    },
    {
      label: "Volunteers",
      value: latestMetric.volunteers_health || 0,
    },
  ];

  const sortedHealth = [...healthBreakdown].sort(
    (left, right) => right.value - left.value,
  );

  const strongestHealth = sortedHealth[0];
  const weakestHealth =
    sortedHealth[sortedHealth.length - 1];

  const healthSummary =
    campaignHealth > 0
      ? `${strongestHealth.label} is strongest. ${weakestHealth.label} needs the most attention.`
      : "Campaign health metrics are ready for an update.";

  const metrics = [
    {
      label: "Volunteer shifts",
      value: `${shiftsFilled} / ${shiftsGoal}`,
      note: `${volunteerCoverage}% filled`,
      delta: formatChange(
        shiftsFilled,
        previousMetric.volunteer_shifts_filled,
      ),
      tone:
        volunteerCoverage < 75 ? "red" : "blue",
      bars: createBars(
        metricHistory.map(
          (metric) =>
            metric.volunteer_shifts_filled,
        ),
      ),
    },
    {
      label: "Event RSVPs",
      value: (
        latestMetric.event_rsvps || 0
      ).toLocaleString(),
      note: `${events.length} upcoming events`,
      delta: formatChange(
        latestMetric.event_rsvps,
        previousMetric.event_rsvps,
      ),
      tone: "red",
      bars: createBars(
        metricHistory.map(
          (metric) => metric.event_rsvps,
        ),
      ),
    },
    {
      label: "Doors knocked",
      value: (
        latestMetric.doors_knocked || 0
      ).toLocaleString(),
      note: "Across target precincts",
      delta: formatChange(
        latestMetric.doors_knocked,
        previousMetric.doors_knocked,
      ),
      tone: "blue",
      bars: createBars(
        metricHistory.map(
          (metric) => metric.doors_knocked,
        ),
      ),
    },
    {
      label: "Open approvals",
      value: openApprovals.length.toLocaleString(),
      note:
        openApprovals.length === 1
          ? "Needs review"
          : "Need review",
      delta:
        openApprovals.length > 0
          ? "Action needed"
          : "Clear",
      tone:
        openApprovals.length > 0 ? "red" : "blue",
      bars: createBars([
        1,
        1,
        2,
        2,
        2,
        openApprovals.length,
      ]),
    },
    {
      label: "Campaign contacts",
      value: (
        latestMetric.contacts_total || 0
      ).toLocaleString(),
      note: `${volunteerCount} active volunteers`,
      delta: formatChange(
        latestMetric.contacts_total,
        previousMetric.contacts_total,
      ),
      tone: "blue",
      bars: createBars(
        metricHistory.map(
          (metric) => metric.contacts_total,
        ),
      ),
    },
    {
      label: "Response rate",
      value: `${responseRate}%`,
      note: "Messages opened",
      delta: formatChange(
        responseRate,
        previousResponseRate,
        "%",
      ),
      tone: responseRate < 50 ? "red" : "blue",
      bars: createBars(
        metricHistory.map((metric) => {
          if (!metric.messages_sent) {
            return 0;
          }

          return Math.round(
            (
              metric.messages_opened /
              metric.messages_sent
            ) * 100,
          );
        }),
      ),
    },
  ];

  const urgentItems = [];

  if (openApprovals.length > 0) {
    urgentItems.push({
      title: `${openApprovals.length} ${
        openApprovals.length === 1
          ? "approval"
          : "approvals"
      } waiting for review`,
      detail: openApprovals
        .slice(0, 3)
        .map((approval) => approval.title)
        .join(", "),
      level: "urgent",
    });
  }

  const overdueTasks = openTasks.filter(
    (task) =>
      task.due_at &&
      new Date(task.due_at).getTime() < (lastUpdated?.getTime() || 0),
  );

  if (overdueTasks.length > 0) {
    urgentItems.push({
      title: `${overdueTasks.length} ${
        overdueTasks.length === 1
          ? "task is"
          : "tasks are"
      } overdue`,
      detail: overdueTasks
        .slice(0, 2)
        .map((task) => task.title)
        .join(", "),
      level: "today",
    });
  }

  if (
    shiftsGoal > 0 &&
    volunteerCoverage < 100
  ) {
    const remainingShifts = Math.max(
      0,
      shiftsGoal - shiftsFilled,
    );

    urgentItems.push({
      title: `Volunteer coverage is ${volunteerCoverage}%`,
      detail: `${remainingShifts} more ${
        remainingShifts === 1 ? "shift" : "shifts"
      } need to be filled`,
      level:
        volunteerCoverage < 70 ? "urgent" : "watch",
    });
  }

  if (events[0]) {
    urgentItems.push({
      title: `Next event: ${events[0].title}`,
      detail: `${formatEventTime(
        events[0].starts_at,
        events[0].ends_at,
      )} · ${events[0].location || "Location pending"}`,
      level: "info",
    });
  }

  if (!urgentItems.length) {
    urgentItems.push({
      title: "No urgent campaign items",
      detail:
        "The campaign workspace is currently on track.",
      level: "info",
    });
  }

  const dashboardStatus = isLoading
    ? "Synchronizing campaign data…"
    : error
      ? "Live connection needs attention"
      : lastUpdated
        ? `Live · updated ${formatRelativeTime(
            lastUpdated,
          )}`
        : "Live campaign data";

  const campaignRaceLabel =
    workspace.description?.split(",").pop()?.trim() ||
    workspace.description ||
    "Campaign";


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
        icon: FolderKanban,
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
        icon: FolderKanban,
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
    quickActionsByExperience[
      campaignExperience.key
    ] ||
    quickActionsByExperience
      .volunteer;
const toggleTask = async (task) => {
    if (taskUpdatingId) {
      return;
    }

    const nextStatus =
      task.status === "completed"
        ? "open"
        : "completed";

    setTaskUpdatingId(task.id);

    try {
      await updateTaskStatus(task.id, nextStatus);
    } catch (taskError) {
      console.error(
        "Task status could not be updated:",
        taskError,
      );
    } finally {
      setTaskUpdatingId("");
    }
  };

  return (
    <div className={styles.app}>
      {isAdmin && (
        <div className={styles.adminBanner}>
          <ShieldCheck size={15} strokeWidth={2} />
          <span>Administrator Portal — campaign-wide controls are active.</span>
        </div>
      )}

      <CampaignSidebar
        activePage="Overview"
        sidebarOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={styles}
        accessDescription={
          isAdmin
            ? "Monitor campaign execution, deadlines and leadership controls."
            : "Review campaign progress, responsibilities and upcoming deadlines."
        }
        showLeadership={
          campaignExperience
            .showLeadership
        }
        adminAccent={isAdmin}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span className={styles.breadcrumb}>
                Campaign HQ
                <ChevronRight size={13} />
                {activeNavigation}
              </span>

              <strong>
                {
                  campaignExperience
                    .dashboardTitle
                }
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
          <section className={styles.welcomeSection}>
            <div className={styles.welcomeCopy}>
              <div className={styles.welcomeBadge}>
                <Sparkles size={15} strokeWidth={2} />
                <span>
                  {
                    campaignExperience
                      .badge
                  }
                </span>
              </div>

              <h1>
                {getGreeting()}, <span>{firstName}.</span>
              </h1>

              <p>
                {
                  campaignExperience
                    .description
                }
              </p>
            </div>

            <div className={styles.topInfoCards}>
              {/* CAMPAIGN HQ NEXT DEADLINE DASHBOARD REFINEMENT */}
              <div
                className={`${styles.topMiniCard} ${styles.deadlineMiniCard}`}
              >
                <Clock3 size={18} strokeWidth={1.8} />

                <div>
                  <span>Next deadline</span>

                  <strong>
                    {priorities[0]
                      ? priorities[0].time
                      : "All clear"}
                  </strong>

                  <small>
                    {priorities[0]
                      ? priorities[0].title
                      : "No active campaign deadlines"}
                  </small>
                </div>
              </div>

              <div
                className={`${styles.topMiniCard} ${styles.previewCard}`}
              >
                <Activity size={18} strokeWidth={1.8} />

                <div>
                  <span>Dashboard status</span>
                  <strong>{dashboardStatus}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.commandGrid}>
            <article className={styles.heroCard}>
              <div className={styles.heroGlow} aria-hidden="true" />
              <div className={styles.heroPattern} aria-hidden="true" />

              <div className={styles.heroContent}>
                <span className={styles.heroEyebrow}>Campaign spotlight</span>

                <h2>
                  Building momentum for
                  <br />
                  <strong>{campaignRaceLabel}.</strong>
                </h2>

                <p>
                  One campaign hub for events, volunteer activity, approvals,
                  files and team communication.
                </p>

                <div className={styles.heroTags}>
                  <span>Community</span>
                  <span>Leadership</span>
                  <span>Palm Beach County</span>
                </div>

                <div className={styles.heroStatsRow}>
                  <div className={styles.heroElection}>
                    <small>Election Day</small>
                    <strong>{daysUntilElection}</strong>
                    <span>days to {workspace.electionDate}</span>
                  </div>

                  <div className={styles.heroReadiness}>
                    <div className={styles.progressHeader}>
                      <span>Campaign readiness</span>
                      <strong>{campaignReadiness}%</strong>
                    </div>

                    <div className={styles.progressTrack}>
                      <span
                        style={{
                          width: `${campaignReadiness}%`,
                        }}
                      />
                    </div>

                    <div className={styles.progressFooter}>
                      <span>Strong progress this week</span>
                      <span>Momentum is rising</span>
                    </div>
                  </div>
                </div>

                <div className={styles.quickActionRow}>
                  {quickActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          if (
                            action.route
                          ) {
                            navigate(
                              action.route,
                            );
                          }
                        }}
                      >
                        <Icon size={16} strokeWidth={1.9} />
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.portraitWrap}>
                <img
                  className={styles.heroPortrait}
                  src={elizabethPhoto}
                  alt={workspace.name}
                />
              </div>
            </article>

            <div className={styles.rightRail}>
              <article className={styles.attentionCard}>
                <div className={styles.cardHeading}>
                  <div>
                    <span>Needs attention</span>
                    <h3>See this first</h3>
                  </div>

                  <div className={styles.liveBadge}>
                    <span />
                    {isLoading ? "SYNCING" : error ? "CHECK" : "LIVE"}
                  </div>
                </div>

                <div className={styles.attentionList}>
                  {urgentItems.map((item) => (
                    <div key={item.id} className={styles.attentionItem}>
                      <span
                        className={`${styles.levelDot} ${styles[item.level]}`}
                        aria-hidden="true"
                      />

                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className={styles.primaryPanelButton} type="button">
                  Open urgent items
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
              </article>

              <article className={styles.healthCard}>
                <div className={styles.cardHeading}>
                  <div>
                    <span>Campaign health</span>
                    <h3>Overall status</h3>
                  </div>

                  <TrendingUp size={18} strokeWidth={1.9} />
                </div>

                <div className={styles.healthTop}>
                  <div
                    className={styles.healthGauge}
                    style={{
                      background: `conic-gradient(#ef3340 0deg ${
                        campaignHealth * 3.6
                      }deg, #dfe6ef ${campaignHealth * 3.6}deg 360deg)`,
                    }}
                  >
                    <div>
                      <strong>{campaignHealth}</strong>
                      <span>/ 100</span>
                    </div>
                  </div>

                  <div className={styles.healthSummary}>
                    <strong>Campaign Health</strong>
                    <p>{healthSummary}</p>
                  </div>
                </div>

                <div className={styles.healthBreakdown}>
                  {healthBreakdown.map((item) => (
                    <div key={item.label}>
                      <div className={styles.healthRow}>
                        <span>{item.label}</span>
                        <strong>{item.value}%</strong>
                      </div>

                      <div className={styles.healthBar}>
                        <span style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <article key={metric.label} className={styles.metricCard}>
                <div className={styles.metricTop}>
                  <span>{metric.label}</span>
                  <small
                    className={
                      metric.tone === "red" ? styles.metricAlert : styles.metricDelta
                    }
                  >
                    {metric.delta}
                  </small>
                </div>

                <div className={styles.metricValue}>
                  {isLoading
                    ? "—"
                    : metric.value}
                </div>
                <p>{metric.note}</p>

                <div className={styles.sparkline}>
                  {metric.bars.map((bar, index) => (
                    <span
                      key={`${metric.label}-${index}`}
                      style={{ height: `${bar}%` }}
                      className={metric.tone === "red" ? styles.redBar : ""}
                    />
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className={styles.lowerGrid}>
            <article className={styles.panel}>
              <div className={styles.cardHeading}>
                <div>
                  <span>Today</span>
                  <h3>Your priorities</h3>
                </div>

                <button
                  type="button"
                  className={styles.inlineButton}
                  onClick={() => navigate("/tasks")}
                >
                  View all
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className={styles.priorityList}>
                {priorities.map((priority) => {
                  const isComplete =
                      priority.status === "completed";

                  return (
                    <button
                      key={priority.id}
                      className={isComplete ? styles.completedPriority : ""}
                      type="button"
                      disabled={
                        taskUpdatingId === priority.id
                      }
                      onClick={() => toggleTask(priority)}
                    >
                      <span className={styles.taskCheck}>
                        {isComplete && <CheckCircle2 size={18} strokeWidth={2.3} />}
                      </span>

                      <div className={styles.priorityCopy}>
                        <strong>{priority.title}</strong>

                        <span>
                          {priority.category}
                          <i />
                          {priority.time}
                        </span>
                      </div>

                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.cardHeading}>
                <div>
                  <span>Schedule</span>
                  <h3>Today and upcoming</h3>
                </div>

                <button
                  type="button"
                  className={styles.inlineButton}
                  onClick={() => navigate("/calendar")}
                >
                  Calendar
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className={styles.eventList}>
                {upcomingEvents.map((event) => (
                  <div key={event.id} className={styles.eventItem}>
                    <div className={styles.eventDate}>
                      <span>{event.month}</span>
                      <strong>{event.day}</strong>
                    </div>

                    <div className={styles.eventCopy}>
                      <strong>{event.title}</strong>

                      <span>
                        <Clock3 size={14} strokeWidth={1.8} />
                        {event.time}
                      </span>
                    </div>

                    <small>{event.type}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.cardHeading}>
                <div>
                  <span>Recent activity</span>
                  <h3>What changed</h3>
                </div>

                <Activity size={18} strokeWidth={1.9} />
              </div>

              <div className={styles.activityList}>
                {recentActivity.map((activity) => (
                  <div key={activity.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>
                      <CheckCircle2 size={16} strokeWidth={2} />
                    </div>

                    <div>
                      <strong>{activity.title}</strong>
                      <p>{activity.detail}</p>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.feedDivider} />

              <div className={styles.cardHeading}>
                <div>
                  <span>Live activity</span>
                  <h3>Recent campaign updates</h3>
                </div>

                <div className={styles.liveBadge}>
                  <span />
                  {isLoading ? "SYNCING" : error ? "CHECK" : "LIVE"}
                </div>
              </div>

              <div className={styles.feedList}>
                {liveFeed.map((item) => (
                  <div key={item.id} className={styles.feedItem}>
                    <span className={styles.feedPulse} aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <small>{item.time}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          {isAdmin && (
            <section className={styles.adminPanel}>
              <div className={styles.adminPanelIcon}>
                <ShieldCheck size={22} strokeWidth={1.8} />
              </div>

              <div>
                <span>Administrator tools</span>
                <h3>Manage the full campaign workspace</h3>
                <p>
                  Control team access, workspace settings and campaign-wide permissions.
                </p>
              </div>

              <div className={styles.adminButtons}>
                <button type="button">
                  <UserCog size={16} />
                  Manage users
                </button>

                <button type="button">
                  <Settings size={16} />
                  Workspace settings
                </button>
              </div>
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
    </div>
  );
}
