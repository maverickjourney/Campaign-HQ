import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  CalendarDays,
  ClipboardCheck,
  ContactRound,
  FileCheck2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquareText,
  Settings,
  UserCog,
  UsersRound,
  Vote,
  X,
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
import "./CampaignSidebarTheme.css";

const CAMPAIGN_NAVIGATION = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    label: "Tasks",
    icon: ClipboardCheck,
    route: "/tasks",
  },
  {
    label: "Field operations",
    icon: MapPin,
    route: "/field-operations",
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    route: "/calendar",
  },
  {
    label: "Team",
    icon: UsersRound,
    route: "/team",
  },
  {
    label: "Contacts",
    icon: ContactRound,
    route: "/contacts",
  },
  {
    label: "Files",
    icon: FolderKanban,
    route: "/files",
  },
  {
    label: "Communications",
    icon: MessageSquareText,
    route: "/communications",
  },
  {
    label: "Approvals",
    icon: FileCheck2,
    route: "/approvals",
  },
];


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
      : CAMPAIGN_NAVIGATION;

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

          {showLeadership && (
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
