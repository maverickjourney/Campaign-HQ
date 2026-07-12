import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Files,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
  UsersRound,
  Vote,
  X,
} from "lucide-react";

import {
  clearCampaignSession,
  getAccessMode,
  getCurrentUser,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import elizabethPhoto from "../../assets/images/dashboard/elizabeth.jpg";
import styles from "./Dashboard.module.css";

const primaryNavigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Tasks", icon: ClipboardCheck, count: 8 },
  { label: "Calendar", icon: CalendarDays },
  { label: "Team", icon: UsersRound },
  { label: "Files", icon: FolderKanban },
  { label: "Communications", icon: MessageSquareText },
  { label: "Approvals", icon: FileCheck2, count: 3 },
];

const administratorNavigation = [
  { label: "User access", icon: UserCog },
  { label: "Workspace settings", icon: Settings },
];

const priorities = [
  {
    title: "Review Monday event guest list",
    category: "Events",
    time: "Due today",
  },
  {
    title: "Approve volunteer welcome email",
    category: "Communications",
    time: "Waiting for approval",
  },
  {
    title: "Confirm canvassing materials",
    category: "Field",
    time: "Due tomorrow",
  },
];

const urgentItems = [
  {
    title: "3 approvals waiting for review",
    detail: "Volunteer form, social copy and event materials",
    level: "urgent",
  },
  {
    title: "Guest list due today",
    detail: "Wellington reception must be finalized by 4:00 PM",
    level: "today",
  },
  {
    title: "Volunteer coverage is 75%",
    detail: "7 more shifts need to be filled before Saturday",
    level: "watch",
  },
  {
    title: "1 team message needs a reply",
    detail: "Field team is waiting for direction",
    level: "info",
  },
];

const liveFeed = [
  {
    title: "New RSVP received",
    detail: "Wellington campaign reception",
    time: "4 min ago",
  },
  {
    title: "Volunteer added to weekend canvass",
    detail: "Field team schedule updated",
    time: "11 min ago",
  },
  {
    title: "Approval completed",
    detail: "Volunteer welcome form is ready to share",
    time: "22 min ago",
  },
  {
    title: "Campaign file uploaded",
    detail: "Reception signage folder",
    time: "41 min ago",
  },
];

const metrics = [
  {
    label: "Volunteer shifts",
    value: "21 / 28",
    note: "75% filled",
    delta: "+4 today",
    tone: "blue",
    bars: [34, 48, 52, 61, 66, 75],
  },
  {
    label: "Event RSVPs",
    value: "84",
    note: "12 new this week",
    delta: "+18%",
    tone: "red",
    bars: [24, 38, 44, 58, 72, 84],
  },
  {
    label: "Doors knocked",
    value: "428",
    note: "Across target precincts",
    delta: "+18%",
    tone: "blue",
    bars: [28, 40, 55, 63, 74, 82],
  },
  {
    label: "Open approvals",
    value: "3",
    note: "Needs attention",
    delta: "Urgent",
    tone: "red",
    bars: [18, 20, 20, 30, 36, 42],
  },
  {
    label: "Contacts added",
    value: "1,248",
    note: "+37 this week",
    delta: "+37",
    tone: "blue",
    bars: [26, 30, 42, 55, 64, 78],
  },
  {
    label: "Response rate",
    value: "62%",
    note: "Messages opened",
    delta: "+6%",
    tone: "blue",
    bars: [32, 36, 44, 48, 58, 62],
  },
];

const upcomingEvents = [
  {
    month: "JUL",
    day: "13",
    title: "Wellington campaign reception",
    time: "6:00 PM – 8:00 PM",
    type: "Fundraiser",
  },
  {
    month: "JUL",
    day: "15",
    title: "Campaign leadership check-in",
    time: "9:30 AM – 10:15 AM",
    type: "Team meeting",
  },
  {
    month: "JUL",
    day: "18",
    title: "Weekend canvassing launch",
    time: "8:30 AM – 12:30 PM",
    type: "Field event",
  },
];

const recentActivity = [
  {
    title: "New event materials uploaded",
    detail: "Wellington reception folder",
    time: "12 minutes ago",
  },
  {
    title: "Volunteer form approved",
    detail: "Ready to share with the team",
    time: "48 minutes ago",
  },
  {
    title: "Three volunteers added",
    detail: "Field and events teams",
    time: "2 hours ago",
  },
];

const healthBreakdown = [
  { label: "Field", value: 82 },
  { label: "Events", value: 76 },
  { label: "Communications", value: 64 },
  { label: "Volunteers", value: 71 },
];

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

function getDaysUntilElection() {
  const electionDate = new Date("2026-08-18T00:00:00");
  const today = new Date();
  const difference = electionDate.getTime() - today.getTime();

  return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)));
}

function getFormattedDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const accessMode = getAccessMode();
  const roleLabel = getRoleLabel(accessMode);
  const isAdmin = accessMode === "admin";

  const [activeNavigation, setActiveNavigation] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);

  const daysUntilElection = useMemo(getDaysUntilElection, []);
  const formattedDate = useMemo(getFormattedDate, []);
  const firstName = user.name.split(" ")[0] || "there";
  const campaignHealth = 82;

  const quickActions = isAdmin
    ? [
        { label: "Manage users", icon: UserCog },
        { label: "Review approvals", icon: FileCheck2 },
        { label: "Add event", icon: CalendarDays },
        { label: "Upload file", icon: Files },
      ]
    : [
        { label: "Review approvals", icon: FileCheck2 },
        { label: "View calendar", icon: CalendarDays },
        { label: "Open files", icon: FolderKanban },
        { label: "Message team", icon: Mail },
      ];

  const handleLogout = () => {
    clearCampaignSession();
    navigate("/");
  };

  const handleWorkspaceChange = () => {
    navigate("/workspaces");
  };

  const handleNavigation = (label) => {
    setActiveNavigation(label);
    setSidebarOpen(false);
  };

  const toggleTask = (title) => {
    setCompletedTasks((currentTasks) => {
      if (currentTasks.includes(title)) {
        return currentTasks.filter((task) => task !== title);
      }

      return [...currentTasks, title];
    });
  };

  return (
    <div className={styles.app}>
      {isAdmin && (
        <div className={styles.adminBanner}>
          <ShieldCheck size={15} strokeWidth={2} />
          <span>Administrator Portal — campaign-wide controls are active.</span>
        </div>
      )}

      <aside
        className={`${styles.sidebar} ${
          sidebarOpen ? styles.sidebarOpen : ""
        } ${isAdmin ? styles.adminSidebar : ""}`}
      >
        <div className={styles.sidebarHeader}>
          <button
            className={styles.campaignIdentity}
            type="button"
            onClick={handleWorkspaceChange}
          >
            <div className={styles.campaignMark}>
              <span>EA</span>
              <Vote size={20} strokeWidth={1.8} />
            </div>

            <div>
              <strong>Elizabeth Accomando</strong>
              <span>Wellington Council</span>
            </div>
          </button>

          <button
            className={styles.closeSidebar}
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>

        <div
          className={`${styles.modeCard} ${
            isAdmin ? styles.adminModeCard : ""
          }`}
        >
          <span className={styles.modeLabel}>Current access</span>
          <strong>{isAdmin ? "Administrator Portal" : "Client Portal"}</strong>
          <p>
            {isAdmin
              ? "Manage team access, campaign settings and workspace controls."
              : "View campaign progress, events, files, tasks and approvals."}
          </p>
        </div>

        <nav className={styles.navigation}>
          <span className={styles.navigationLabel}>Campaign</span>

          {primaryNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={
                  activeNavigation === item.label
                    ? styles.activeNavigation
                    : ""
                }
                type="button"
                onClick={() => handleNavigation(item.label)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.count && <small>{item.count}</small>}
              </button>
            );
          })}

          {isAdmin && (
            <>
              <span className={styles.navigationLabel}>Administration</span>

              {administratorNavigation.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    className={
                      activeNavigation === item.label
                        ? styles.activeNavigation
                        : ""
                    }
                    type="button"
                    onClick={() => handleNavigation(item.label)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarProfile}>
            <div className={styles.avatar}>{getUserInitials(user.name)}</div>

            <div>
              <strong>{user.name}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out and change portal"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className={styles.mobileOverlay}
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

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
                {isAdmin ? "Administrator dashboard" : "Client dashboard"}
              </strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <button
              className={styles.notificationButton}
              type="button"
              aria-label="Notifications"
            >
              <Bell size={19} strokeWidth={1.8} />
              <span />
            </button>

            <div className={styles.topbarProfile}>
              <div className={styles.avatar}>{getUserInitials(user.name)}</div>

              <div>
                <strong>{user.name}</strong>
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.welcomeSection}>
            <div className={styles.welcomeCopy}>
              <div className={styles.welcomeBadge}>
                <Sparkles size={15} strokeWidth={2} />
                <span>Campaign command center</span>
              </div>

              <h1>
                {getGreeting()}, <span>{firstName}.</span>
              </h1>

              <p>
                See what needs attention, what changed and what to do next —
                all in one place.
              </p>
            </div>

            <div className={styles.topInfoCards}>
              <div className={styles.topMiniCard}>
                <CalendarDays size={18} strokeWidth={1.8} />

                <div>
                  <span>Today</span>
                  <strong>{formattedDate}</strong>
                </div>
              </div>

              <div
                className={`${styles.topMiniCard} ${styles.previewCard}`}
              >
                <Activity size={18} strokeWidth={1.8} />

                <div>
                  <span>Dashboard status</span>
                  <strong>Preview campaign data</strong>
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
                  <strong>Wellington.</strong>
                </h2>

                <p>
                  One campaign hub for events, volunteer activity, approvals,
                  files and team communication.
                </p>

                <div className={styles.heroTags}>
                  <span>Community</span>
                  <span>Leadership</span>
                  <span>Wellington First</span>
                </div>

                <div className={styles.heroStatsRow}>
                  <div className={styles.heroElection}>
                    <small>Election Day</small>
                    <strong>{daysUntilElection}</strong>
                    <span>days to August 18, 2026</span>
                  </div>

                  <div className={styles.heroReadiness}>
                    <div className={styles.progressHeader}>
                      <span>Campaign readiness</span>
                      <strong>72%</strong>
                    </div>

                    <div className={styles.progressTrack}>
                      <span style={{ width: "72%" }} />
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
                      <button key={action.label} type="button">
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
                  alt="Elizabeth Accomando"
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
                    PREVIEW
                  </div>
                </div>

                <div className={styles.attentionList}>
                  {urgentItems.map((item) => (
                    <div key={item.title} className={styles.attentionItem}>
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
                    <p>Field and events are strong. Communications needs attention.</p>
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

                <div className={styles.metricValue}>{metric.value}</div>
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

                <button type="button" className={styles.inlineButton}>
                  View all
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className={styles.priorityList}>
                {priorities.map((priority) => {
                  const isComplete = completedTasks.includes(priority.title);

                  return (
                    <button
                      key={priority.title}
                      className={isComplete ? styles.completedPriority : ""}
                      type="button"
                      onClick={() => toggleTask(priority.title)}
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

                <button type="button" className={styles.inlineButton}>
                  Calendar
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className={styles.eventList}>
                {upcomingEvents.map((event) => (
                  <div key={event.title} className={styles.eventItem}>
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
                  <div key={activity.title} className={styles.activityItem}>
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
                  <span>Activity preview</span>
                  <h3>Recent campaign updates</h3>
                </div>

                <div className={styles.liveBadge}>
                  <span />
                  PREVIEW
                </div>
              </div>

              <div className={styles.feedList}>
                {liveFeed.map((item) => (
                  <div key={item.title} className={styles.feedItem}>
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
