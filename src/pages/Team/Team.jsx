import {
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  LoaderCircle,
  Mail,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useTeamAccessCommandCenter,
} from "../../hooks/useTeamAccessCommandCenter";



import {
  getCampaignMemberships,
  getCurrentMembership,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import styles from "./Team.module.css";

function getInitials(name = "") {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "CU";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function isLeadershipMember(member) {
  return [
    "campaign_owner",
    "candidate",
    "campaign_consultant",
    "campaign_manager",
  ].includes(member.roleKey) ||
    /candidate|consultant|manager|owner/i.test(
      member.displayTitle,
    );
}

function formatAccessType(value) {
  const labels = {
    command: "Command center",
    candidate: "Candidate dashboard",
    department: "Department dashboard",
    captain: "Captain dashboard",
    reviewer: "Reviewer workspace",
    volunteer: "Volunteer workspace",
  };

  return (
    labels[value] ||
    String(value || "Campaign access")
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase(),
      )
  );
}

function formatSeatType(value) {
  const labels = {
    command: "Command seat",
    leadership: "Leadership seat",
    staff: "Staff seat",
    candidate: "Candidate seat",
    department: "Department seat",
    captain: "Captain seat",
    reviewer: "Reviewer seat",
    volunteer: "Volunteer seat",
  };

  return (
    labels[value] ||
    String(value || "Campaign seat")
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase(),
      )
  );
}

function formatStatus(value) {
  return String(value || "active")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(value);
}

function MemberCard({
  member,
  onOpen,
}) {
  const leadership =
    isLeadershipMember(member);

  return (
    <button
      className={styles.memberCard}
      type="button"
      onClick={() =>
        onOpen(member.membershipId)
      }
    >
      <div
        className={
          leadership
            ? `${styles.memberAvatar} ${styles.leadershipAvatar}`
            : styles.memberAvatar
        }
      >
        {getInitials(
          member.fullName,
        )}
      </div>

      <div
        className={
          styles.memberPrimary
        }
      >
        <div>
          <strong>
            {member.fullName}
          </strong>

          <span>
            {member.displayTitle}
          </span>
        </div>

        <p>
          {member.email ||
            "No email available"}
        </p>
      </div>

      <div
        className={
          styles.memberAccess
        }
      >
        <span>
          {formatAccessType(
            member.dashboardType,
          )}
        </span>

        <small>
          {formatStatus(
            member.status,
          )}
        </small>
      </div>

      <ChevronRight
        size={18}
      />
    </button>
  );
}

export default function Team() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();
// CAMPAIGN HQ TEAM ACTIVE MEMBERSHIP FIX
  const storedMembership =
    getCurrentMembership();

  const campaignMemberships =
    getCampaignMemberships();

  const currentMembership =
    (
      storedMembership?.workspaceId ===
        workspace.id ||
      storedMembership?.workspace?.id ===
        workspace.id
    )
      ? storedMembership
      : campaignMemberships.find(
          (membership) =>
            membership.workspaceId ===
              workspace.id ||
            membership.workspace?.id ===
              workspace.id,
        ) ||
        storedMembership;

  const roleLabel =
    currentMembership?.displayTitle ||
    currentMembership?.roleName ||
    user.role ||
    getRoleLabel() ||
    "Campaign Member";

  const currentRoleKey =
    currentMembership?.roleKey ||
    currentMembership?.assignedRole ||
    user.roleKey ||
    user.assignedRole ||
    "";

  const currentDashboardType =
    currentMembership?.dashboardType ||
    user.dashboardType ||
    "";

  const currentSeatType =
    currentMembership?.seatType ||
    user.seatType ||
    "";

  const membershipPermissions =
    Array.isArray(
      currentMembership?.permissions,
    )
      ? currentMembership.permissions
      : [];

  const userPermissions =
    Array.isArray(
      user.permissions,
    )
      ? user.permissions
      : [];

  const permissionCount =
    membershipPermissions.length ||
    userPermissions.length;

  const canInviteMembers =
    hasCampaignPermission(
      "workspace.invite_members",
    );

  const leadershipAccess =
    [
      "campaign_owner",
      "candidate",
      "campaign_consultant",
      "campaign_manager",
    ].includes(
      currentRoleKey,
    ) ||
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const {
    members,
    isLoading,
    error,
    lastUpdated,
    refresh,
  } = useTeamAccessCommandCenter({
    workspaceId:
      workspace.id,
  });

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("active");

  const [
    selectedMembershipId,
    setSelectedMembershipId,
  ] = useState("");

  const normalizedSearch =
    searchTerm
      .trim()
      .toLowerCase();

  const roleOptions = [
    ...new Map(
      members.map(
        (member) => [
          member.roleKey,
          member.displayTitle,
        ],
      ),
    ).entries(),
  ].sort(
    (left, right) =>
      left[1].localeCompare(
        right[1],
      ),
  );

  const filteredMembers =
    members.filter(
      (member) => {
        if (
          roleFilter !== "all" &&
          member.roleKey !==
            roleFilter
        ) {
          return false;
        }

        if (
          statusFilter !== "all" &&
          member.status !==
            statusFilter
        ) {
          return false;
        }

        if (
          normalizedSearch &&
          ![
            member.fullName,
            member.email,
            member.displayTitle,
            member.roleKey,
            member.dashboardType,
            member.seatType,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ),
            )
        ) {
          return false;
        }

        return true;
      },
    );

  const selectedMember =
    members.find(
      (member) =>
        member.membershipId ===
        selectedMembershipId,
    ) || null;

  const activeMembers =
    members.filter(
      (member) =>
        member.status === "active",
    );

  const leadershipMembers =
    activeMembers.filter(
      isLeadershipMember,
    );

  const commandMembers =
    activeMembers.filter(
      (member) =>
        member.dashboardType ===
          "command" ||
        member.dashboardType ===
          "candidate",
    );

  const volunteerMembers =
    activeMembers.filter(
      (member) =>
        member.seatType ===
          "volunteer" ||
        member.roleKey ===
          "volunteer",
    );
return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Team"
        sidebarOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={styles}
        accessDescription={
          leadershipAccess
            ? "Review campaign members, leadership coverage and workspace access."
            : "View campaign teammates and understand how responsibilities are organized."
        }
        showLeadership={
          leadershipAccess
        }
      />

      <div
        className={
          styles.workspace
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.topbarLeft
            }
          >
            <button
              className={
                styles.menuButton
              }
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span
                className={
                  styles.breadcrumb
                }
              >
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Team
              </span>

              <strong>
                Team & Access
              </strong>
            </div>
          </div>

          <div
            className={
              styles.topbarActions
            }
          >
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            

          </div>
        </header>

        <main
          className={
            styles.main
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Campaign Organization
              </span>

              <h1>
                Team & Access
              </h1>

              <p>
                See who is inside the campaign workspace,
                what role each person holds and which
                operating experience they use.
              </p>

              <div
                className={
                  styles.liveStatus
                }
              >
                <span />

                {isLoading
                  ? "Synchronizing campaign members"
                  : error
                    ? "Connection needs attention"
                    : lastUpdated
                      ? `Live · updated ${formatTime(
                          lastUpdated,
                        )}`
                      : "Live campaign data"}
              </div>
            </div>

            <div
              className={
                styles.pageHeaderActions
              }
            >
              {canInviteMembers && (
                <button
                  className={
                    styles.inviteButton
                  }
                  type="button"
                  onClick={() =>
                    navigate(
                      "/team/invitations",
                    )
                  }
                >
                  <UserPlus
                    size={18}
                  />

                  Invite member
                </button>
              )}

              <button
                className={
                  styles.refreshButton
                }
                type="button"
                onClick={refresh}
                disabled={
                  isLoading
                }
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
            </div>
          </section>

          {error && (
            <div
              className={
                styles.errorBanner
              }
              role="alert"
            >
              <AlertTriangle
                size={18}
              />

              <div>
                <strong>
                  Team data could not be loaded
                </strong>

                <span>
                  {error}
                </span>
              </div>
            </div>
          )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <article
              className={
                styles.summaryCard
              }
            >
              <span>
                Active members
              </span>

              <strong>
                {isLoading ? "—" : activeMembers.length}
              </strong>

              <p>
                Campaign workspace seats
              </p>

              <UsersRound
                size={24}
              />
            </article>

            <article
              className={
                styles.summaryCard
              }
            >
              <span>
                Leadership
              </span>

              <strong>
                {isLoading ? "—" : leadershipMembers.length}
              </strong>

              <p>
                Candidate and campaign leadership
              </p>

              <ShieldCheck
                size={24}
              />
            </article>

            <article
              className={
                styles.summaryCard
              }
            >
              <span>
                Command access
              </span>

              <strong>
                {isLoading ? "—" : commandMembers.length}
              </strong>

              <p>
                Command or candidate dashboards
              </p>

              <KeyRound
                size={24}
              />
            </article>

            <article
              className={
                styles.summaryCard
              }
            >
              <span>
                Volunteer seats
              </span>

              <strong>
                {isLoading ? "—" : volunteerMembers.length}
              </strong>

              <p>
                Volunteer workspace access
              </p>

              <UserRound
                size={24}
              />
            </article>
          </section>

          <section
            className={
              styles.controlsPanel
            }
          >
            <div
              className={
                styles.searchWrap
              }
            >
              <Search
                size={18}
              />

              <input
                type="search"
                value={
                  searchTerm
                }
                onChange={(
                  event,
                ) =>
                  setSearchTerm(
                    event.target.value,
                  )
                }
                placeholder="Search people, email or role"
              />
            </div>

            <select
              value={
                roleFilter
              }
              onChange={(
                event,
              ) =>
                setRoleFilter(
                  event.target.value,
                )
              }
              aria-label="Filter by role"
            >
              <option value="all">
                All roles
              </option>

              {roleOptions.map(
                ([
                  roleKey,
                  title,
                ]) => (
                  <option
                    key={roleKey}
                    value={roleKey}
                  >
                    {title}
                  </option>
                ),
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event,
              ) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              aria-label="Filter by membership status"
            >
              <option value="active">
                Active members
              </option>

              <option value="all">
                All statuses
              </option>

              <option value="inactive">
                Inactive
              </option>

              <option value="pending">
                Pending
              </option>
            </select>
          </section>

          <section
            className={
              styles.contentGrid
            }
          >
            <article
              className={
                styles.directoryPanel
              }
            >
              <header
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    Campaign directory
                  </span>

                  <h2>
                    Workspace members
                  </h2>
                </div>

                <strong>
                  {
                    filteredMembers.length
                  }
                  {" "}
                  visible
                </strong>
              </header>

              {isLoading ? (
                <div
                  className={
                    styles.loadingState
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinning
                    }
                    size={28}
                  />

                  <strong>
                    Loading campaign members
                  </strong>
                </div>
              ) : filteredMembers.length ? (
                <div
                  className={
                    styles.memberList
                  }
                >
                  {filteredMembers.map(
                    (member) => (
                      <MemberCard
                        key={
                          member.membershipId
                        }
                        member={member}
                        onOpen={
                          setSelectedMembershipId
                        }
                      />
                    ),
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <UsersRound
                    size={34}
                  />

                  <strong>
                    No members match this view
                  </strong>

                  <p>
                    Adjust the search or access filters.
                  </p>
                </div>
              )}
            </article>

            <aside
              className={
                styles.accessPanel
              }
            >
              <div
                className={
                  styles.accessPanelIcon
                }
              >
                <ShieldCheck
                  size={24}
                />
              </div>

              <span>
                Your campaign access
              </span>

              <h2>
                {roleLabel}
              </h2>

              <p>
                Your current workspace session controls
                which campaign tools and actions are
                available.
              </p>

              <div
                className={
                  styles.accessFacts
                }
              >
                <div>
                  <span>
                    Experience
                  </span>

                  <strong>
                    {formatAccessType(
                      currentDashboardType,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Seat
                  </span>

                  <strong>
                    {formatSeatType(
                      currentSeatType,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Permissions
                  </span>

                  <strong>
                    {permissionCount}
                    {" "}
                    loaded
                  </strong>
                </div>
              </div>

              <div
                className={
                  styles.foundationNotice
                }
              >
                <CheckCircle2
                  size={18}
                />

                <div>
                  <strong>
                    Directory foundation active
                  </strong>

                  <span>
                    Invitation, department and role-editing
                    controls will be connected after their
                    database schema and RLS policies are
                    verified.
                  </span>
                </div>
              </div>
            </aside>
          </section>

          <footer
            className={
              styles.footer
            }
          >
            <span>
              © 2026 Campaign HQ
            </span>

            <div>
              <ShieldCheck
                size={14}
              />
              Authorized campaign use only
            </div>
          </footer>
        </main>
      </div>

      {selectedMember && (
        <>
          <button
            className={
              styles.drawerOverlay
            }
            type="button"
            onClick={() =>
              setSelectedMembershipId("")
            }
            aria-label="Close member details"
          />

          <aside
            className={
              styles.memberDrawer
            }
          >
            <header
              className={
                styles.drawerHeader
              }
            >
              <div>
                <span>
                  Member details
                </span>

                <strong>
                  Campaign access
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedMembershipId("")
                }
                aria-label="Close member details"
              >
                <X size={21} />
              </button>
            </header>

            <div
              className={
                styles.drawerBody
              }
            >
              <div
                className={
                  styles.drawerIdentity
                }
              >
                <div
                  className={
                    isLeadershipMember(
                      selectedMember,
                    )
                      ? `${styles.largeAvatar} ${styles.leadershipAvatar}`
                      : styles.largeAvatar
                  }
                >
                  {getInitials(
                    selectedMember.fullName,
                  )}
                </div>

                <div>
                  <span>
                    {formatStatus(
                      selectedMember.status,
                    )}
                  </span>

                  <h2>
                    {
                      selectedMember.fullName
                    }
                  </h2>

                  <p>
                    {
                      selectedMember.displayTitle
                    }
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailGrid
                }
              >
                <div>
                  <Mail
                    size={18}
                  />

                  <span>
                    Email
                  </span>

                  <strong>
                    {selectedMember.email ||
                      "Not available"}
                  </strong>
                </div>

                <div>
                  <ShieldCheck
                    size={18}
                  />

                  <span>
                    Campaign role
                  </span>

                  <strong>
                    {
                      selectedMember.displayTitle
                    }
                  </strong>
                </div>

                <div>
                  <KeyRound
                    size={18}
                  />

                  <span>
                    Access experience
                  </span>

                  <strong>
                    {formatAccessType(
                      selectedMember.dashboardType,
                    )}
                  </strong>
                </div>

                <div>
                  <UserRound
                    size={18}
                  />

                  <span>
                    Seat type
                  </span>

                  <strong>
                    {formatSeatType(
                      selectedMember.seatType,
                    )}
                  </strong>
                </div>
              </div>

              <div
                className={
                  styles.technicalPanel
                }
              >
                <span>
                  Access identifiers
                </span>

                <div>
                  <small>
                    Role key
                  </small>

                  <code>
                    {
                      selectedMember.roleKey
                    }
                  </code>
                </div>

                <div>
                  <small>
                    Membership status
                  </small>

                  <code>
                    {
                      selectedMember.status
                    }
                  </code>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
