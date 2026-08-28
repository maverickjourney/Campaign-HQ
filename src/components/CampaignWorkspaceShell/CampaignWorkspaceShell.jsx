import {
  useEffect,
  useMemo,
  useRef,
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
  CreditCard,
  FileCheck2,
  Files,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  PackageOpen,
  Target,
  UserCog,
  Users,
  Vote,
  Menu,
  X,
} from "lucide-react";

import {
  ActivityCenter,
} from "../ActivityCenter/ActivityCenter";

import {
  CampaignSearch,
} from "../CampaignSearch/CampaignSearch";

import {
  ACTIVE_SEAT_PRODUCT,
  getSeatCoreModules,
  getSeatPlatformModules,
  getSeatProductModules,
} from "../../config/seatPlatform";

import {
  supabase,
} from "../../lib/supabase";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import {
  createCandidatePhotoSignedUrl,
} from "../../utils/candidatePhotoStorage";

import dashboardStyles from "../../pages/DashboardReferencePreview/DashboardReferencePreview.module.css";

import {
  getWorkspaceThemePalette,
  getWorkspaceThemeStyle,
} from "../../utils/workspacePresentation";

import {
  useWorkspaceCommandCounts,
} from "../../hooks/useWorkspaceCommandCounts";

import {
  useWorkspaceProviderFreshness,
} from "../../hooks/useWorkspaceProviderFreshness";


import {
  useWorkspaceEmailRealtime,
} from "../../hooks/useWorkspaceEmailRealtime";


import styles from "./CampaignWorkspaceShell.module.css";

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  calendar: CalendarDays,
  tasks: CheckCircle2,
  commitments: Target,
  waiting_on: Clock3,
  contacts: Users,
  documents: Files,
  approvals: FileCheck2,
  team: UserCog,
  inventory: PackageOpen,
  integrations: Link2,
  plan_usage: CreditCard,
  settings: Settings,
  support: LifeBuoy,
  candidate: Vote,
  volunteers: Users,
  fundraising: CircleDollarSign,
  events: CalendarDays,
  social_media: MessageSquare,
  media_center: FolderKanban,
  reports_analytics: BarChart3,
};

const SIDEBAR_SCROLL_STORAGE_KEY =
  "campaign-seat:workspace-sidebar-scroll";

function createNavigation(
  modules,
) {
  return modules.map(
    (module) => ({
      ...module,
      icon:
        MODULE_ICONS[
          module.key
        ] ||
        LayoutDashboard,
    }),
  );
}

const PRIMARY_NAVIGATION =
  createNavigation(
    getSeatCoreModules(),
  );

const CAMPAIGN_TOOLS =
  createNavigation(
    getSeatProductModules(
      ACTIVE_SEAT_PRODUCT,
    ),
  );


const PLATFORM_TOOLS =
  createNavigation(
    getSeatPlatformModules()
      .filter(
        (module) =>
          [
            "integrations",
            "plan_usage",
            "settings",
            "support",
          ].includes(
            module.key,
          ),
      ),
  );

export function CampaignWorkspaceShell({
  activeItem,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarNavigationRef =
    useRef(null);

  // SYSTEM RESPONSIVE DRAWER STATE — START
  const [
    sharedSidebarOpen,
    setSharedSidebarOpen,
  ] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSharedSidebarOpen(false);
    });
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

  const workspaceTheme =
    getWorkspaceThemePalette(
      workspace,
    );

  const workspaceThemeStyle =
    getWorkspaceThemeStyle(
      workspace,
    );

  const {
    counts:
      workspaceCommandCounts,
  } =
    useWorkspaceCommandCounts(
      workspace?.id,
    );

  useWorkspaceProviderFreshness({
    workspaceId:
      workspace?.id,

    enabled:
      Boolean(
        workspace?.id,
      ),
  });

  const {
    notification:
      emailNotification,

    dismissNotification:
      dismissEmailNotification,
  } =
    useWorkspaceEmailRealtime({
      workspaceId:
        workspace?.id,

      enabled:
        Boolean(
          workspace?.id,
        ),
    });


  const [
    candidateAvatarUrl,
    setCandidateAvatarUrl,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    const candidateRole =
      /candidate/i.test(
        String(
          roleLabel || "",
        ),
      );

    const loadCandidateAvatar =
      async (
        overrideStoragePath,
      ) => {
        if (
          !candidateRole ||
          !workspace?.id
        ) {
          if (!cancelled) {
            setCandidateAvatarUrl("");
          }

          return;
        }

        try {
          let storagePath =
            overrideStoragePath;

          if (
            storagePath ===
            undefined
          ) {
            const {
              data,
              error:
                workspaceError,
            } =
              await supabase
                .from(
                  "workspaces",
                )
                .select(
                  "candidate_photo_path",
                )
                .eq(
                  "id",
                  workspace.id,
                )
                .maybeSingle();

            if (
              workspaceError
            ) {
              throw workspaceError;
            }

            storagePath =
              data
                ?.candidate_photo_path ||
              "";
          }

          if (!storagePath) {
            if (!cancelled) {
              setCandidateAvatarUrl(
                "",
              );
            }

            return;
          }

          const signedUrl =
            await createCandidatePhotoSignedUrl(
              storagePath,
              21600,
            );

          if (!cancelled) {
            setCandidateAvatarUrl(
              signedUrl ||
                "",
            );
          }
        } catch {
          if (!cancelled) {
            setCandidateAvatarUrl(
              "",
            );
          }
        }
      };

    const handleCandidatePhoto =
      (event) => {
        if (!candidateRole) {
          return;
        }

        const storagePath =
          event?.detail
            ?.storagePath;

        void loadCandidateAvatar(
          storagePath,
        );
      };

    void loadCandidateAvatar(
      undefined,
    );

    window.addEventListener(
      "campaign-seat-candidate-photo-updated",
      handleCandidatePhoto,
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "campaign-seat-candidate-photo-updated",
        handleCandidatePhoto,
      );
    };
  }, [
    roleLabel,
    workspace?.id,
  ]);


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

  const workspaceDescriptionParts =
    String(
      workspace.description ||
        "",
    )
      .split(",")
      .map(
        (part) =>
          part.trim(),
      )
      .filter(Boolean);

  const workspaceTitleDetail =
    workspaceDescriptionParts.length > 1
      ? workspaceDescriptionParts.at(-1)
      : "";

  const workspaceOfficeTitle =
    workspaceDescriptionParts.length > 1
      ? workspaceDescriptionParts
          .slice(0, -1)
          .join(", ")
      : workspaceDescriptionParts[0] ||
        workspace.name;

  const workspaceTitle =
    [
      workspace.name,
      workspaceTitleDetail,
    ]
      .filter(Boolean)
      .join(" · ");
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

  const shortDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(
        "en-US",
        {
          month: "short",
          day: "numeric",
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

  useEffect(() => {
    const frameId =
      window.requestAnimationFrame(
        () => {
          const navigation =
            sidebarNavigationRef.current;

          if (!navigation) {
            return;
          }

          try {
            const stored =
              window.sessionStorage.getItem(
                SIDEBAR_SCROLL_STORAGE_KEY,
              );

            const scrollTop =
              Number(stored);

            if (
              Number.isFinite(scrollTop) &&
              scrollTop >= 0
            ) {
              navigation.scrollTop =
                scrollTop;
            }
          } catch {
            // Sidebar persistence is optional.
          }
        },
      );

    return () =>
      window.cancelAnimationFrame(
        frameId,
      );
  }, []);

  const rememberSidebarScroll =
    () => {
      const navigation =
        sidebarNavigationRef.current;

      if (!navigation) {
        return;
      }

      try {
        window.sessionStorage.setItem(
          SIDEBAR_SCROLL_STORAGE_KEY,
          String(
            navigation.scrollTop,
          ),
        );
      } catch {
        // Navigation remains available without session storage.
      }
    };

  const openRoute = (route) => {
    rememberSidebarScroll();

    if (route === "/support") {
      const currentLocation = [
        location.pathname,
        location.search,
        location.hash,
      ].join("");

      navigate(
        `/support?from=${encodeURIComponent(
          currentLocation,
        )}`,
      );

      return;
    }

    navigate(route);
  };

  const renderNavigation = (
    navigationItems,
  ) =>
    navigationItems.map((item) => {
      const Icon = item.icon;

      const liveCount =
        Number(
          workspaceCommandCounts[
            item.key
          ] ||
          0,
        );

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

          {liveCount > 0 ? (
            <small>
              {liveCount > 99
                ? "99+"
                : liveCount}
            </small>
          ) : null}

        </button>
      );
    });

  return (
    <div
      className={styles.app}
      data-workspace-theme={
        workspaceTheme.theme
      }
      style={
        workspaceThemeStyle
      }
    >
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

              <strong>
                {workspace.name}
              </strong>

              <span className={styles.workspaceDistrict}>
                {workspaceOfficeTitle}

                {workspaceTitleDetail ? (
                  <>
                    <br />
                    {workspaceTitleDetail}
                  </>
                ) : null}
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
                {getUserInitials(
                  workspace.name,
                )}
              </span>

              <span>
                <strong>
                  {workspace.name}
                </strong>

                <small>
                  {workspaceOfficeTitle}
                  {workspaceTitleDetail
                    ? ` · ${workspaceTitleDetail}`
                    : ""}
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
          ref={sidebarNavigationRef}
          className={
            dashboardStyles.sidebarNavigation
          }
          onScroll={
            rememberSidebarScroll
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
            {ACTIVE_SEAT_PRODUCT.toolGroupLabel}
          </span>

          {renderNavigation(
            CAMPAIGN_TOOLS,
          )}

          <span
            className={
              dashboardStyles.navigationLabel
            }
          >
            Platform
          </span>

          {renderNavigation(
            PLATFORM_TOOLS,
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
            data-candidate-photo-frame="sidebar"
          >
            {candidateAvatarUrl ? (
              <img
                className={
                  styles.profileAvatarImage
                }
                src={
                  candidateAvatarUrl
                }
                alt=""
                aria-hidden="true"
                data-candidate-photo="sidebar"
                decoding="async"
                loading="eager"
                draggable="false"
              />
            ) : (
              initials
            )}
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
          <div
            className={
              styles.topbarLead
            }
          >
            <button
              className={
                styles.sharedMenuButton
              }
              type="button"
              aria-label="Open campaign navigation"
              aria-expanded={
                sharedSidebarOpen
              }
              onClick={() =>
                setSharedSidebarOpen(
                  true,
                )
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
              <span>
                {workspaceEyebrow}
              </span>

              <strong>
                {workspaceTitle}
              </strong>

              <small
                className={
                  styles.workspaceLocation
                }
              >
                {workspace.location ||
                  "Campaign location"}
              </small>
            </div>
          </div>

          <div
            className={
              styles.topbarUtility
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
              <CalendarDays
                className={
                  styles.utilityCalendarIcon
                }
                size={17}
              />

              <span
                className={
                  styles.fullDateLabel
                }
              >
                {dateLabel}
              </span>

              <span
                className={
                  styles.shortDateLabel
                }
              >
                {shortDateLabel}
              </span>

              <i />

              <Clock3
                className={
                  styles.utilityClockIcon
                }
                size={17}
              />

              <strong>
                {timeLabel}
              </strong>
            </button>

            <div
              className={
                styles.utilityDivider
              }
              aria-hidden="true"
            />

            <CampaignSearch />

            <div
              className={
                styles.utilityDivider
              }
              aria-hidden="true"
            />

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

      {emailNotification ? (
        <aside
          className={
            styles.emailRealtimeToast
          }
          role="status"
          aria-live="polite"
        >
          <span
            className={
              styles.emailRealtimeToastIcon
            }
          >
            <Mail
              size={20}
              strokeWidth={2}
            />
          </span>

          <div
            className={
              styles.emailRealtimeToastCopy
            }
          >
            <strong>
              {
                emailNotification
                  .title
              }
            </strong>

            <span>
              {
                emailNotification
                  .message
              }
            </span>
          </div>

          <button
            className={
              styles.emailRealtimeToastOpen
            }
            type="button"
            onClick={() => {
              dismissEmailNotification();

              navigate(
                "/inbox",
              );
            }}
          >
            Open Inbox
          </button>

          <button
            className={
              styles.emailRealtimeToastClose
            }
            type="button"
            aria-label="Dismiss new email notification"
            onClick={
              dismissEmailNotification
            }
          >
            <X
              size={17}
            />
          </button>
        </aside>
      ) : null}
    </div>
  );
}
