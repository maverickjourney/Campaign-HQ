import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Files,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Plus,
  Target,
  UserCog,
  Users,
  Menu,
} from "lucide-react";

import {
  ActivityCenter,
} from "../ActivityCenter/ActivityCenter";

import {
  CampaignSearch,
} from "../CampaignSearch/CampaignSearch";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import dashboardStyles from "../../pages/DashboardReferencePreview/DashboardReferencePreview.module.css";

import styles from "./CampaignWorkspaceShell.module.css";

const PRIMARY_NAVIGATION = [
  {
    label: "HQ",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    label: "Inbox",
    icon: Inbox,
    route: "/inbox",
    count: 8,
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
    count: 3,
  },
  {
    label: "Commitments",
    icon: Target,
    route: "/commitments",
  },
  {
    label: "Waiting On",
    icon: Clock3,
    route: "/waiting-on",
    count: 3,
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
    count: 3,
  },
  {
    label: "Team",
    icon: UserCog,
    route: "/team",
  },
];

const CAMPAIGN_TOOLS = [
  {
    label: "Volunteers",
    icon: Users,
    route: "/volunteers",
  },
  {
    label: "Fundraising",
    icon: CircleDollarSign,
    route: "/fundraising",
  },
  {
    label: "Events",
    icon: CalendarDays,
    route: "/events",
  },
  {
    label: "Social Media",
    icon: MessageSquare,
    route: "/social-media",
  },
  {
    label: "Media Center",
    icon: FolderKanban,
    route: "/media-center",
  },
  {
    label: "Reports & Analytics",
    icon: BarChart3,
    route: "/reports-analytics",
  },
];

export function CampaignWorkspaceShell({
  activeItem,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // SYSTEM RESPONSIVE DRAWER STATE — START
  const [
    sharedSidebarOpen,
    setSharedSidebarOpen,
  ] = useState(false);

  useEffect(() => {
    setSharedSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sharedSidebarOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSharedSidebarOpen(false);
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [sharedSidebarOpen]);
  // SYSTEM RESPONSIVE DRAWER STATE — END


  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
  const initials = getUserInitials(user.name);


  const isInboxWorkspace = [
    "Inbox",
    "Calendar",
    "Tasks",
    "Commitments",
    "Waiting On",
  ].includes(activeItem);

  const workspaceEyebrow = isInboxWorkspace
    ? "Current workspace"
    : "Campaign workspace";

  const workspaceTitle =
    `${workspace.name} · District 6`;
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone:
            "America/New_York",
        },
      ).format(new Date()),
    [],
  );

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
          timeZone:
            "America/New_York",
        },
      ).format(new Date()),
    [],
  );

  const openRoute = (route) => {
    navigate(route);
  };

  const renderNavigation = (
    navigationItems,
  ) =>
    navigationItems.map((item) => {
      const Icon = item.icon;
      const isComingSoon = Boolean(item.comingSoon);

      const isActive =
        item.label === activeItem ||
        (
          item.label === "Inbox" &&
          location.pathname ===
            "/inbox"
        );

      return (
        <button
          key={item.label}
          className={[
            isActive
              ? dashboardStyles.activeNavigation
              : "",
            isComingSoon
              ? styles.comingSoonNavigation
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-disabled={
            isComingSoon ? "true" : undefined
          }
          title={
            isComingSoon
              ? `${item.label} — Coming soon`
              : undefined
          }
          onClick={() => {
            if (!isComingSoon) {
              openRoute(item.route);
            }
          }}
        >
          <Icon
            size={17}
            strokeWidth={1.9}
          />

          <span>{item.label}</span>

          {item.count ? (
            <small>{item.count}</small>
          ) : null}

        </button>
      );
    });

  return (
    <div className={styles.app}>
      <aside
        className={dashboardStyles.sidebar}
        data-shared-workspace-sidebar="true"
        data-open={
          sharedSidebarOpen
            ? "true"
            : "false"
        }
        aria-label="Campaign navigation"
      >
        {/* LOCKED WORKSPACE SWITCHER — START */}
        <details
          className={styles.workspaceSwitcher}
          data-workspace-switcher="true"
        >
          <summary>

            <span className={styles.workspaceBrandCopy}>
              <small>Campaign Workspace</small>

              <strong>Elizabeth Accomando</strong>

              <span className={styles.workspaceDistrict}>
                Palm Beach County Commission
                <br />
                District 6
              </span>
            </span>

            <span
              className={styles.workspaceSwitcherChevron}
              aria-hidden="true"
            >
              ⌄
            </span>
          </summary>

          <div className={styles.workspaceSwitcherMenu}>
            <button
              type="button"
              onClick={() =>
                window.location.assign("/dashboard")
              }
            >
              <span className={styles.workspaceSwitcherAvatar}>
                EA
              </span>

              <span>
                <strong>Elizabeth Accomando</strong>

                <small>
                  Palm Beach County · District 6
                </small>
              </span>

              <em>Current</em>
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.assign("/workspaces")
              }
            >
              <span className={styles.workspaceSwitcherIcon}>
                +
              </span>

              <span>
                <strong>View all workspaces</strong>

                <small>
                  Open or switch campaigns
                </small>
              </span>
            </button>
          </div>
        </details>
        {/* LOCKED WORKSPACE SWITCHER — END */}

        <nav
          className={
            dashboardStyles.sidebarNavigation
          }
        >
          {renderNavigation(
            PRIMARY_NAVIGATION,
          )}

          <span
            className={
              dashboardStyles.navigationLabel
            }
          >
            Campaign tools
          </span>

          {renderNavigation(
            CAMPAIGN_TOOLS,
          )}

          <span
            className={
              dashboardStyles.navigationLabel
            }
          >
            Connected apps
          </span>

          <div
            className={dashboardStyles.connectedApps}
          >
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
              aria-label="Email integration"
            >
              <Mail size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
              aria-label="Calendar integration"
            >
              <CalendarDays size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
              aria-label="File integration"
            >
              <Files size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
              aria-label="Messaging integration"
            >
              <MessageSquare size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
              aria-label="Add integration"
            >
              <Plus size={16} />
            </button>
          </div>
        </nav>

        <button
          data-profile-settings="true"
          className={
            dashboardStyles.sidebarProfile
          }
          type="button"
          onClick={() =>
            navigate(
              "/workspace/settings",
            )
          }
        >
          <span
            className={
              dashboardStyles.profileAvatar
            }
          >
            {initials}
          </span>

          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel}</span>
          </div>

          <ChevronDown size={15} />
        </button>
      </aside>


      {/* SYSTEM RESPONSIVE SIDEBAR SCRIM */}
      {sharedSidebarOpen && (
        <button
          className={styles.sharedSidebarScrim}
          type="button"
          aria-label="Close campaign navigation"
          onClick={() =>
            setSharedSidebarOpen(false)
          }
        />
      )}

      <section
        className={styles.workspace}
        data-shared-workspace-region="true"
      >
        <header
          className={styles.topbar}
          data-shared-workspace-topbar="true"
        >
          {/* SYSTEM RESPONSIVE MENU BUTTON */}
          <button
            className={styles.sharedMenuButton}
            type="button"
            aria-label="Open campaign navigation"
            aria-expanded={sharedSidebarOpen}
            onClick={() =>
              setSharedSidebarOpen(true)
            }
          >
            <Menu
              size={20}
              strokeWidth={2}
            />
          </button>

          <div
            className={
              styles.workspaceIdentity
            }
          >
            <span>{workspaceEyebrow}</span>

            <strong>{workspaceTitle}</strong>
          </div>

          <div
            className={
              styles.topbarActions
            }
          >
            <button
              className={
                styles.dateTime
              }
              type="button"
              onClick={() =>
                navigate(
                  "/workspace/settings",
                )
              }
            >
              <CalendarDays size={17} />

              <span>{dateLabel}</span>

              <i />

              <Clock3 size={17} />

              <strong>
                {timeLabel}
              </strong>
            </button>

            <CampaignSearch />

            <ActivityCenter />
          </div>
        </header>

        <div
          className={styles.content}
          data-shared-workspace-content="true"
        >
          {children}
        </div>
      </section>
    </div>
  );
}
