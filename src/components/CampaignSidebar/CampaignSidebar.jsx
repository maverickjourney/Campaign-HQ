import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ContactRound,
  CreditCard,
  CircleDollarSign,
  FileCheck2,
  Files,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LogOut,
  MapPin,
  MessageSquareText,
  PackageOpen,
  Settings,
  UserCog,
  UsersRound,
  Vote,
  X,
  Inbox,
  Target,
  Clock3,
} from "lucide-react";

import {
  clearCampaignSession,
  getCampaignExperience,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import {
  useActiveTaskCount,
} from "../../hooks/useActiveTaskCount";

import {
  ACTIVE_SEAT_PRODUCT,
  getSeatCoreModules,
  getSeatPlatformModules,
  getSeatProductModules,
} from "../../config/seatPlatform";

import "./CampaignSidebarTheme.css";

// CAMPAIGN SEAT — SHARED SEAT CORE NAVIGATION
//
// The Dashboard previously used an older hard-coded sidebar.
// It now reads the same Seat Core manifest as the newer
// CampaignWorkspaceShell so HQ exposes the current product.

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  calendar: CalendarDays,
  tasks: ClipboardCheck,
  commitments: Target,
  waiting_on: Clock3,
  contacts: ContactRound,
  documents: Files,
  approvals: FileCheck2,
  team: UserCog,
  inventory: PackageOpen,

  candidate: Vote,
  volunteers: UsersRound,
  fundraising: CircleDollarSign,
  events: CalendarDays,
  social_media: MessageSquareText,
  media_center: FolderKanban,
  reports_analytics: BarChart3,

  integrations: Link2,
  plan_usage: CreditCard,
  settings: Settings,
  support: LifeBuoy,
};

function createSeatNavigation(
  modules,
) {
  return modules.map(
    (module) => ({
      key: module.key,
      label: module.label,
      route: module.route,
      icon:
        MODULE_ICONS[
          module.key
        ] ||
        LayoutDashboard,
    }),
  );
}

const CORE_NAVIGATION =
  createSeatNavigation(
    getSeatCoreModules(),
  );

const CAMPAIGN_TOOL_NAVIGATION =
  createSeatNavigation(
    getSeatProductModules(
      ACTIVE_SEAT_PRODUCT,
    ),
  );

const PLATFORM_NAVIGATION =
  createSeatNavigation(
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

const VOLUNTEER_NAVIGATION = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    label: "My tasks",
    icon: ClipboardCheck,
    route: "/tasks",
  },
  {
    label: "My field assignment",
    icon: MapPin,
    route: "/field-assignment",
  },
  {
    label: "My schedule",
    icon: CalendarDays,
    comingSoon: true,
  },
  {
    label: "My materials",
    icon: FolderKanban,
    comingSoon: true,
  },
  {
    label: "Messages",
    icon: MessageSquareText,
    comingSoon: true,
  },
];

const LEADERSHIP_NAVIGATION = [
  {
    label: "Manage candidate",
    icon: Vote,
    route: "/workspace/candidate-profile",
  },
  {
    label: "Team access",
    icon: UserCog,
    route: "/team/access",
  },
  {
    label: "Workspace settings",
    icon: Settings,
    route: "/workspace/settings",
  },
];

export function CampaignSidebar({
  activePage,
  sidebarOpen,
  onClose,
  styles,
  showLeadership = false,
  adminAccent = false,
}) {
  const navigate = useNavigate();

  const location =
    useLocation();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const roleLabel =
    getRoleLabel();

  const campaignExperience =
    getCampaignExperience();

  const navigationItems =
    campaignExperience.key ===
    "volunteer"
      ? VOLUNTEER_NAVIGATION
      : CORE_NAVIGATION;

  const showSeatCoreGroups =
    campaignExperience.key !==
    "volunteer";

  const partyValue =
    String(
      workspace.politicalParty ||
      workspace.political_party ||
      "republican",
    ).toLowerCase();

  const partyTheme =
    partyValue === "republican" ||
    partyValue === "democratic"
      ? partyValue
      : "neutral";

  const {
    count: activeTaskCount,
  } = useActiveTaskCount(
    workspace.id,
  );

  const sidebarClassName = [
    styles.sidebar,
    sidebarOpen
      ? styles.sidebarOpen
      : "",
    adminAccent &&
    styles.adminSidebar
      ? styles.adminSidebar
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleNavigation =
    (item) => {
      if (
        item.comingSoon ||
        !item.route
      ) {
        return;
      }

      // CAMPAIGN SEAT CANONICAL HQ NAVIGATION
      //
      // HQ gets a full application reload so operational
      // page state/shells cannot leak into the main dashboard.
      if (item.route === "/dashboard") {
        window.location.assign("/dashboard");
        return;
      }

      navigate(item.route);
      onClose();
    };

  const handleLogout =
    async () => {
      await clearCampaignSession();

      navigate(
        "/",
        {
          replace: true,
        },
      );
    };

  return (
    <>
      <aside
        className={
          sidebarClassName
        }
        data-campaign-party={
          partyTheme
        }
      >
        <div
          className={
            styles.sidebarHeader
          }
        >
          <button
            className={
              styles.campaignIdentity
            }
            type="button"
            onClick={() => {
              navigate(
                "/profile/settings",
              );
              onClose();
            }}
            aria-label="Open campaign workspace profile"
            title="Open campaign workspace profile"
            aria-current={
              location.pathname ===
                "/profile/settings"
                ? "page"
                : undefined
            }
            data-candidate-identity="true"
            data-campaign-workspace="true"
            data-profile-active={
              location.pathname ===
              "/profile/settings"
                ? "true"
                : "false"
            }
          >
            <div
              className={
                styles.campaignMark
              }
            >
              <span>
                {getUserInitials(
                  workspace.name,
                )}
              </span>

              <Vote
                size={18}
                strokeWidth={1.8}
              />
            </div>

            <div
              data-candidate-copy="true"
              data-campaign-workspace-copy="true"
            >
              <small
                data-campaign-workspace-label="true"
              >
                Campaign workspace
              </small>

              <strong>
                {workspace.name}
              </strong>

              <span
                data-sidebar-muted="true"
                data-candidate-office="true"
              >
                {workspace.description}
              </span>
            </div>
          </button>

          <button
            className={
              styles.closeSidebar
            }
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>

        <nav
          className={
            styles.navigation
          }
        >
          <span
            className={
              styles.navigationLabel
            }
            data-sidebar-section="true"
          >
            Campaign
          </span>

          {navigationItems.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                item.route ===
                  location.pathname ||
                item.label ===
                  activePage;

              return (
                <button
                  key={item.label}
                  className={
                    active
                      ? styles.activeNavigation
                      : ""
                  }
                  type="button"
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  disabled={
                    item.comingSoon
                  }
                  title={
                    item.comingSoon
                      ? "This campaign module is coming next."
                      : item.label
                  }
                  onClick={() =>
                    handleNavigation(
                      item,
                    )
                  }
                >
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                  />

                  <span>
                    {item.label}
                  </span>

                  {item.route ===
                    "/tasks" &&
                    activeTaskCount >
                      0 && (
                      <small
                        className={
                          styles.taskCountBadge ||
                          undefined
                        }
                      >
                        {activeTaskCount}
                      </small>
                    )}

                  {item.comingSoon && (
                    <em>
                      Soon
                    </em>
                  )}
                </button>
              );
            },
          )}

          {showSeatCoreGroups && (
            <>
              <span
                className={
                  styles.navigationLabel
                }
                data-sidebar-section="true"
              >
                Campaign tools
              </span>

              {CAMPAIGN_TOOL_NAVIGATION.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const active =
                    item.route ===
                      location.pathname ||
                    item.label ===
                      activePage;

                  return (
                    <button
                      key={
                        item.key ||
                        item.label
                      }
                      className={
                        active
                          ? styles.activeNavigation
                          : ""
                      }
                      type="button"
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      title={
                        item.label
                      }
                      onClick={() =>
                        handleNavigation(
                          item,
                        )
                      }
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />

                      <span>
                        {item.label}
                      </span>
                    </button>
                  );
                },
              )}

              <span
                className={
                  styles.navigationLabel
                }
                data-sidebar-section="true"
              >
                Platform
              </span>

              {PLATFORM_NAVIGATION.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const active =
                    item.route ===
                      location.pathname ||
                    item.label ===
                      activePage;

                  return (
                    <button
                      key={
                        item.key ||
                        item.label
                      }
                      className={
                        active
                          ? styles.activeNavigation
                          : ""
                      }
                      type="button"
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      title={
                        item.label
                      }
                      onClick={() =>
                        handleNavigation(
                          item,
                        )
                      }
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />

                      <span>
                        {item.label}
                      </span>
                    </button>
                  );
                },
              )}
            </>
          )}

          {campaignExperience.key ===
            "volunteer" &&
            showLeadership && (
            <>
              <span
                className={
                  styles.navigationLabel
                }
                data-sidebar-section="true"
              >
                Leadership
              </span>

              {LEADERSHIP_NAVIGATION.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const active =
                    item.label ===
                    activePage;

                  return (
                    <button
                      key={
                        item.label
                      }
                      className={
                        active
                          ? styles.activeNavigation
                          : ""
                      }
                      type="button"
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      disabled={
                        item.comingSoon
                      }
                      title={
                        item.comingSoon
                          ? `${item.label} is coming next.`
                          : item.label
                      }
                      onClick={() =>
                        handleNavigation(
                          item,
                        )
                      }
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />

                      <span>
                        {item.label}
                      </span>

                      {item.comingSoon && (
                        <em>
                          Soon
                        </em>
                      )}
                    </button>
                  );
                },
              )}
            </>
          )}
        </nav>

        <div
          className={
            styles.sidebarFooter
          }
          data-signed-in-panel="true"
        >
          <span
            data-signed-in-label="true"
          >
            Signed in as
          </span>

          <div
            data-signed-in-row="true"
          >
            <button
              type="button"
              onClick={() => {
                navigate(
                  "/profile/settings",
                );
                onClose();
              }}
              aria-label={`Open profile settings for ${user.name}`}
              title="Open your profile settings"
              data-signed-in-profile="true"
            >
              <div
                data-signed-in-avatar="true"
              >
                {getUserInitials(
                  user.name,
                )}
              </div>

              <div
                data-signed-in-copy="true"
              >
                <strong>
                  {user.name}
                </strong>

                <span>
                  {roleLabel}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out of Campaign HQ"
              title="Sign out"
              data-sidebar-signout="true"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className={
            styles.mobileOverlay
          }
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
