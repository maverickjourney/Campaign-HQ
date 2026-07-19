import {
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  KeyRound,
  LoaderCircle,
  Mail,
  Menu,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";

import {
  useInvitationManagement,
} from "../../hooks/useInvitationManagement";

import {
  useMemberAccessManagement,
} from "../../hooks/useMemberAccessManagement";

import {
  useTeamAccessCommandCenter,
} from "../../hooks/useTeamAccessCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import shellStyles from "../Team/Team.module.css";
import styles from "./TeamAccess.module.css";

const EMPTY_FORM = {
  membershipId: "",
  fullName: "",
  roleKey: "",
  displayTitle: "",
  status: "active",
};

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

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function formatLabel(value) {
  return String(
    value || "",
  )
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function isLeadershipMember(member) {
  return [
    "campaign_owner",
    "candidate",
    "campaign_consultant",
    "campaign_manager",
  ].includes(
    member.roleKey,
  );
}

function invitationIsPending(
  invitation,
  referenceTime,
) {
  if (
    invitation.status !==
    "pending"
  ) {
    return false;
  }

  if (
    !invitation.expires_at ||
    !referenceTime
  ) {
    return true;
  }

  return (
    new Date(
      invitation.expires_at,
    ).getTime() >
    referenceTime
  );
}

export default function TeamAccess() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const roleLabel =
    getRoleLabel();

  const leadershipAccess =
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const canManageInvitations =
    hasCampaignPermission(
      "workspace.invite_members",
    );

  const canManageAccess =
    leadershipAccess &&
    canManageInvitations;

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
    editorOpen,
    setEditorOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const {
    members,
    isLoading:
      membersLoading,
    error:
      membersError,
    lastUpdated:
      membersUpdated,
    refresh:
      refreshMembers,
  } =
    useTeamAccessCommandCenter({
      workspaceId:
        workspace.id,
    });

  const {
    roles,
    invitations,
    departments,
    teams,
    isLoading:
      invitationsLoading,
    error:
      invitationsError,
    lastUpdated:
      invitationsUpdated,
    refresh:
      refreshInvitations,
  } =
    useInvitationManagement({
      workspaceId:
        workspace.id,
      canManageInvitations,
    });

  const {
    isSaving,
    actionError,
    clearActionError,
    updateMemberAccess,
  } =
    useMemberAccessManagement({
      workspaceId:
        workspace.id,
    });

  const isLoading =
    membersLoading ||
    invitationsLoading;

  const lastUpdated =
    membersUpdated ||
    invitationsUpdated;

  const referenceTime =
    invitationsUpdated
      ?.getTime() ||
    membersUpdated
      ?.getTime() ||
    0;

  const pendingInvitations =
    invitations.filter(
      (invitation) =>
        invitationIsPending(
          invitation,
          referenceTime,
        ),
    );

  const activeMembers =
    members.filter(
      (member) =>
        member.status ===
        "active",
    );

  const inactiveMembers =
    members.filter(
      (member) =>
        member.status ===
        "inactive",
    );

  const leadershipMembers =
    activeMembers.filter(
      isLeadershipMember,
    );

  const filteredMembers =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return members.filter(
        (member) => {
          const matchesSearch =
            !search ||
            [
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
                    search,
                  ),
              );

          const matchesRole =
            roleFilter ===
              "all" ||
            member.roleKey ===
              roleFilter;

          const matchesStatus =
            statusFilter ===
              "all" ||
            member.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        },
      );
    }, [
      members,
      roleFilter,
      searchTerm,
      statusFilter,
    ]);

  const roleMap =
    new Map(
      roles.map(
        (role) => [
          role.key,
          role,
        ],
      ),
    );

  const openEditor =
    (member) => {
      clearActionError();
      setFormError("");

      setForm({
        membershipId:
          member.membershipId,
        fullName:
          member.fullName,
        roleKey:
          member.roleKey,
        displayTitle:
          member.displayTitle,
        status:
          member.status ||
          "active",
      });

      setEditorOpen(true);
    };

  const closeEditor =
    () => {
      if (isSaving) {
        return;
      }

      setEditorOpen(false);
      setFormError("");
      clearActionError();
    };

  const updateForm =
    (field, value) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      );
    };

  const handleRoleChange =
    (roleKey) => {
      const role =
        roleMap.get(
          roleKey,
        );

      setForm(
        (current) => ({
          ...current,
          roleKey,
          displayTitle:
            current.displayTitle ||
            role?.name ||
            "",
        }),
      );
    };

  const handleSave =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (!form.roleKey) {
        setFormError(
          "Choose a campaign role.",
        );
        return;
      }

      try {
        await updateMemberAccess({
          membershipId:
            form.membershipId,
          roleKey:
            form.roleKey,
          displayTitle:
            form.displayTitle,
          status:
            form.status,
        });

        await Promise.all([
          refreshMembers(),
          refreshInvitations(),
        ]);

        setEditorOpen(false);
        setForm(
          EMPTY_FORM,
        );
      } catch (error) {
        setFormError(
          error?.message ||
            "Member access could not be saved.",
        );
      }
    };

  const handleRefresh =
    async () => {
      await Promise.all([
        refreshMembers(),
        refreshInvitations(),
      ]);
    };

  return (
    <div
      className={
        styles.app
      }
    >
      <CampaignSidebar
        activePage="Team access"
        sidebarOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={
          shellStyles
        }
        accessDescription="Control campaign roles, invitations and active workspace access."
        showLeadership
        adminAccent
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
              <Menu
                size={21}
              />
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
                Leadership
                <ChevronRight
                  size={13}
                />
                Team access
              </span>

              <strong>
                Access control center
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
            <div
              className={
                styles.syncStatus
              }
            >
              <span />

              {isLoading
                ? "Synchronizing access"
                : lastUpdated
                  ? `Updated ${formatTime(
                      lastUpdated,
                    )}`
                  : "Waiting for sync"}
            </div>

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
                Leadership controls
              </span>

              <h1>
                Team access
              </h1>

              <p>
                Review every campaign
                seat, manage role access
                and track secure
                invitations from one
                leadership workspace.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <button
                className={
                  styles.secondaryButton
                }
                type="button"
                onClick={
                  handleRefresh
                }
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

              {canManageInvitations && (
                <button
                  className={
                    styles.primaryButton
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
            </div>
          </section>

          {!leadershipAccess && (
            <section
              className={
                styles.restrictedPanel
              }
            >
              <ShieldCheck
                size={38}
              />

              <h2>
                Leadership access is
                required
              </h2>

              <p>
                Your current campaign
                role cannot open member
                access controls.
              </p>
            </section>
          )}

          {leadershipAccess && (
            <>
              {(membersError ||
                invitationsError ||
                actionError) && (
                <section
                  className={
                    styles.errorBanner
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={20}
                  />

                  <div>
                    <strong>
                      Team access needs
                      attention
                    </strong>

                    <p>
                      {actionError ||
                        membersError ||
                        invitationsError}
                    </p>
                  </div>
                </section>
              )}

              <section
                className={
                  styles.securityNotice
                }
              >
                <ShieldCheck
                  size={22}
                />

                <div>
                  <strong>
                    Protected access
                    management
                  </strong>

                  <p>
                    Owner access and your
                    own active session
                    cannot be changed
                    here. Role changes are
                    validated again by
                    Supabase before they
                    are saved.
                  </p>
                </div>
              </section>

              <section
                className={
                  styles.summaryGrid
                }
              >
                <article>
                  <div>
                    <UsersRound
                      size={21}
                    />
                  </div>

                  <span>
                    Active members
                  </span>

                  <strong>
                    {isLoading
                      ? "—"
                      : activeMembers.length}
                  </strong>

                  <p>
                    Current workspace
                    seats
                  </p>
                </article>

                <article>
                  <div>
                    <ShieldCheck
                      size={21}
                    />
                  </div>

                  <span>
                    Leadership
                  </span>

                  <strong>
                    {isLoading
                      ? "—"
                      : leadershipMembers.length}
                  </strong>

                  <p>
                    Command-level access
                  </p>
                </article>

                <article>
                  <div>
                    <Clock3
                      size={21}
                    />
                  </div>

                  <span>
                    Pending invitations
                  </span>

                  <strong>
                    {isLoading
                      ? "—"
                      : pendingInvitations.length}
                  </strong>

                  <p>
                    Awaiting acceptance
                  </p>
                </article>

                <article>
                  <div>
                    <UserMinus
                      size={21}
                    />
                  </div>

                  <span>
                    Inactive access
                  </span>

                  <strong>
                    {isLoading
                      ? "—"
                      : inactiveMembers.length}
                  </strong>

                  <p>
                    Retained in history
                  </p>
                </article>
              </section>

              <section
                className={
                  styles.memberPanel
                }
              >
                <header
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <span>
                      Member access
                    </span>

                    <h2>
                      Campaign seats
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

                <div
                  className={
                    styles.controls
                  }
                >
                  <label
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
                          event.target
                            .value,
                        )
                      }
                      placeholder="Search people, email or role"
                    />
                  </label>

                  <select
                    value={
                      roleFilter
                    }
                    onChange={(
                      event,
                    ) =>
                      setRoleFilter(
                        event.target
                          .value,
                      )
                    }
                    aria-label="Filter by role"
                  >
                    <option value="all">
                      All roles
                    </option>

                    {roles.map(
                      (role) => (
                        <option
                          key={
                            role.key
                          }
                          value={
                            role.key
                          }
                        >
                          {role.name}
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
                        event.target
                          .value,
                      )
                    }
                    aria-label="Filter by access status"
                  >
                    <option value="active">
                      Active access
                    </option>
                    <option value="inactive">
                      Inactive access
                    </option>
                    <option value="all">
                      All statuses
                    </option>
                  </select>
                </div>

                {membersLoading ? (
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
                      Loading campaign
                      access…
                    </strong>
                  </div>
                ) : filteredMembers.length ? (
                  <div
                    className={
                      styles.memberList
                    }
                  >
                    {filteredMembers.map(
                      (member) => {
                        const locked =
                          member.userId ===
                            user.id ||
                          member.roleKey ===
                            "campaign_owner";

                        return (
                          <article
                            className={
                              styles.memberRow
                            }
                            key={
                              member.membershipId
                            }
                          >
                            <div
                              className={
                                styles.memberAvatar
                              }
                            >
                              {getUserInitials(
                                member.fullName,
                              )}
                            </div>

                            <div
                              className={
                                styles.memberIdentity
                              }
                            >
                              <strong>
                                {
                                  member.fullName
                                }
                              </strong>

                              <span>
                                {member.email ||
                                  "No email available"}
                              </span>
                            </div>

                            <div
                              className={
                                styles.memberRole
                              }
                            >
                              <span>
                                {
                                  member.displayTitle
                                }
                              </span>

                              <small>
                                {formatLabel(
                                  member.dashboardType,
                                )}
                                {" · "}
                                {formatLabel(
                                  member.seatType,
                                )}
                              </small>
                            </div>

                            <span
                              className={`${styles.statusBadge} ${
                                member.status ===
                                "active"
                                  ? styles.activeBadge
                                  : styles.inactiveBadge
                              }`}
                            >
                              {formatLabel(
                                member.status,
                              )}
                            </span>

                            <button
                              className={
                                styles.editButton
                              }
                              type="button"
                              onClick={() =>
                                openEditor(
                                  member,
                                )
                              }
                              disabled={
                                !canManageAccess ||
                                locked
                              }
                              title={
                                locked
                                  ? "Owner access and your own access are protected."
                                  : canManageAccess
                                    ? "Edit member access"
                                    : "Your role cannot edit access."
                              }
                            >
                              <Pencil
                                size={16}
                              />
                              Edit
                            </button>
                          </article>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      styles.emptyState
                    }
                  >
                    <UserCog
                      size={31}
                    />

                    <h3>
                      No members match
                      this view
                    </h3>

                    <p>
                      Adjust the search
                      or access filters.
                    </p>
                  </div>
                )}
              </section>

              <section
                className={
                  styles.bottomGrid
                }
              >
                <article
                  className={
                    styles.invitationPanel
                  }
                >
                  <header>
                    <div>
                      <span>
                        Invitation activity
                      </span>

                      <h2>
                        Pending access
                        requests
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/team/invitations",
                        )
                      }
                    >
                      Open manager
                      <ArrowUpRight
                        size={16}
                      />
                    </button>
                  </header>

                  {pendingInvitations.length ? (
                    <div
                      className={
                        styles.invitationList
                      }
                    >
                      {pendingInvitations
                        .slice(0, 4)
                        .map(
                          (
                            invitation,
                          ) => (
                            <div
                              key={
                                invitation.id
                              }
                            >
                              <Mail
                                size={17}
                              />

                              <div>
                                <strong>
                                  {
                                    invitation.email
                                  }
                                </strong>

                                <span>
                                  {invitation.display_title ||
                                    roleMap.get(
                                      invitation.role_key,
                                    )?.name ||
                                    formatLabel(
                                      invitation.role_key,
                                    )}
                                </span>
                              </div>

                              <small>
                                {formatDateTime(
                                  invitation.expires_at,
                                )}
                              </small>
                            </div>
                          ),
                        )}
                    </div>
                  ) : (
                    <div
                      className={
                        styles.compactEmpty
                      }
                    >
                      <CheckCircle2
                        size={25}
                      />

                      <strong>
                        No pending
                        invitations
                      </strong>

                      <span>
                        All current access
                        requests are clear.
                      </span>
                    </div>
                  )}
                </article>

                <article
                  className={
                    styles.rolePanel
                  }
                >
                  <header>
                    <div>
                      <span>
                        Access catalog
                      </span>

                      <h2>
                        Campaign roles
                      </h2>
                    </div>

                    <KeyRound
                      size={23}
                    />
                  </header>

                  <div
                    className={
                      styles.roleList
                    }
                  >
                    {roles
                      .slice(0, 6)
                      .map(
                        (role) => (
                          <div
                            key={
                              role.key
                            }
                          >
                            <strong>
                              {role.name}
                            </strong>

                            <span>
                              {formatLabel(
                                role.dashboard_type,
                              )}
                              {" · "}
                              {formatLabel(
                                role.seat_type,
                              )}
                            </span>
                          </div>
                        ),
                      )}
                  </div>

                  <p>
                    {
                      departments.length
                    }
                    {" active "}
                    {departments.length ===
                    1
                      ? "department"
                      : "departments"}
                    {" · "}
                    {teams.length}
                    {" active "}
                    {teams.length === 1
                      ? "team"
                      : "teams"}
                  </p>
                </article>
              </section>

              <footer
                className={
                  styles.footer
                }
              >
                <span>
                  Campaign HQ Team Access
                </span>

                <span>
                  Authorized leadership
                  use only
                </span>
              </footer>
            </>
          )}
        </main>
      </div>

      {editorOpen && (
        <div
          className={
            styles.modalLayer
          }
          role="presentation"
        >
          <button
            className={
              styles.modalOverlay
            }
            type="button"
            onClick={
              closeEditor
            }
            aria-label="Close access editor"
          />

          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-access-editor-title"
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div>
                <span>
                  Member access
                </span>

                <h2
                  id="team-access-editor-title"
                >
                  {form.fullName}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeEditor
                }
                aria-label="Close editor"
              >
                <X
                  size={20}
                />
              </button>
            </header>

            <form
              className={
                styles.accessForm
              }
              onSubmit={
                handleSave
              }
            >
              <label>
                <span>
                  Campaign role
                </span>

                <select
                  value={
                    form.roleKey
                  }
                  onChange={(
                    event,
                  ) =>
                    handleRoleChange(
                      event.target
                        .value,
                    )
                  }
                  required
                >
                  {roles.map(
                    (role) => (
                      <option
                        key={
                          role.key
                        }
                        value={
                          role.key
                        }
                      >
                        {role.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Access status
                </span>

                <select
                  value={
                    form.status
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "status",
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Display title
                </span>

                <input
                  type="text"
                  value={
                    form.displayTitle
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "displayTitle",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Example: Field Director"
                  maxLength={120}
                />
              </label>

              <div
                className={
                  styles.rolePreview
                }
              >
                <KeyRound
                  size={20}
                />

                <div>
                  <strong>
                    {roleMap.get(
                      form.roleKey,
                    )?.name ||
                      "Campaign role"}
                  </strong>

                  <p>
                    {roleMap.get(
                      form.roleKey,
                    )?.description ||
                      "The selected role controls the member’s campaign workspace experience."}
                  </p>
                </div>
              </div>

              {(formError ||
                actionError) && (
                <div
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={17}
                  />
                  {formError ||
                    actionError}
                </div>
              )}

              <div
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    closeEditor
                  }
                  disabled={
                    isSaving
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={
                    isSaving
                  }
                >
                  {isSaving
                    ? "Saving access…"
                    : "Save access"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
