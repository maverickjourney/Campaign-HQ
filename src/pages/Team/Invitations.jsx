import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Vote,
  X,
} from "lucide-react";

import {
  useInvitationManagement,
} from "../../hooks/useInvitationManagement";

import {
  clearCampaignSession,
  getCampaignMemberships,
  getCurrentMembership,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import teamStyles from "./Team.module.css";
import styles from "./Invitations.module.css";

const NAVIGATION = [
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
    label: "Files",
    icon: FolderKanban,
    comingSoon: true,
  },
  {
    label: "Communications",
    icon: MessageSquareText,
    comingSoon: true,
  },
  {
    label: "Approvals",
    icon: FileCheck2,
    comingSoon: true,
  },
];

const EMPTY_FORM = {
  email: "",
  roleKey: "volunteer",
  displayTitle: "",
  departmentId: "",
  campaignTeamId: "",
};

function getInitials(name = "") {
  return getUserInitials(name);
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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
  ).format(date);
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

function formatStatus(value) {
  return String(
    value || "pending",
  )
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function isExpired(
  invitation,
  referenceTime,
) {
  if (!invitation.expires_at) {
    return false;
  }

  return (
    new Date(
      invitation.expires_at,
    ).getTime() <
    referenceTime
  );
}

function isExpiringSoon(
  invitation,
  referenceTime,
) {
  if (
    invitation.status !==
      "pending" ||
    !invitation.expires_at
  ) {
    return false;
  }

  const remaining =
    new Date(
      invitation.expires_at,
    ).getTime() -
    referenceTime;

  return (
    remaining > 0 &&
    remaining <=
      48 * 60 * 60 * 1000
  );
}

function getInvitationStatus(
  invitation,
  referenceTime,
) {
  if (
    invitation.status ===
      "pending" &&
    isExpired(
      invitation,
      referenceTime,
    )
  ) {
    return "expired";
  }

  return (
    invitation.status ||
    "pending"
  );
}

export default function Invitations() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const storedMembership =
    getCurrentMembership();

  const campaignMemberships =
    getCampaignMemberships();

  const membership =
    (
      storedMembership
        ?.workspaceId ===
        workspace.id ||
      storedMembership
        ?.workspace
        ?.id ===
        workspace.id
    )
      ? storedMembership
      : campaignMemberships.find(
          (item) =>
            item.workspaceId ===
              workspace.id ||
            item.workspace?.id ===
              workspace.id,
        ) ||
        storedMembership;

  const roleLabel =
    membership?.displayTitle ||
    membership?.roleName ||
    user.role ||
    getRoleLabel() ||
    "Campaign Member";

  const canManageInvitations =
    hasCampaignPermission(
      "workspace.invite_members",
    );

  const {
    roles,
    invitations,
    departments,
    teams,
    isLoading,
    isSaving,
    error,
    actionError,
    lastUpdated,
    refresh,
    createInvitation,
    cancelInvitation,
  } = useInvitationManagement({
    workspaceId:
      workspace.id,

    canManageInvitations,
  });

  const [
    sidebarOpen,
    setSidebarOpen,
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

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("pending");

  const roleMap =
    new Map(
      roles.map(
        (role) => [
          role.key,
          role,
        ],
      ),
    );

  const departmentMap =
    new Map(
      departments.map(
        (department) => [
          department.id,
          department,
        ],
      ),
    );

  const teamMap =
    new Map(
      teams.map(
        (team) => [
          team.id,
          team,
        ],
      ),
    );

  const selectedRole =
    roleMap.get(
      form.roleKey,
    ) || null;

  const availableTeams =
    form.departmentId
      ? teams.filter(
          (team) =>
            team.department_id ===
              form.departmentId ||
            !team.department_id,
        )
      : teams;

  // CAMPAIGN HQ INVITATION TIME PURITY FIX
  const referenceTime =
    lastUpdated?.getTime() ||
    0;

  const pendingInvitations =
    invitations.filter(
      (invitation) =>
        getInvitationStatus(
          invitation,
          referenceTime,
        ) === "pending",
    );

  const expiringSoon =
    pendingInvitations.filter(
      (invitation) =>
        isExpiringSoon(
          invitation,
          referenceTime,
        ),
    );

  const acceptedInvitations =
    invitations.filter(
      (invitation) =>
        invitation.status ===
        "accepted",
    );

  const cancelledInvitations =
    invitations.filter(
      (invitation) =>
        invitation.status ===
        "cancelled",
    );

  const visibleInvitations =
    invitations.filter(
      (invitation) => {
        if (
          statusFilter === "all"
        ) {
          return true;
        }

        if (
          statusFilter ===
          "expiring"
        ) {
          return isExpiringSoon(
            invitation,
            referenceTime,
          );
        }

        return (
          getInvitationStatus(
            invitation,
            referenceTime,
          ) === statusFilter
        );
      },
    );

  const invitationLink =
    result?.invitationToken
      ? `${window.location.origin}/invite?token=${encodeURIComponent(
          result.invitationToken,
        )}`
      : "";

  const handleNavigation =
    (item) => {
      if (item.route) {
        navigate(item.route);
        setSidebarOpen(false);
      }
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

  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setForm(
        (current) => {
          if (
            name ===
            "departmentId"
          ) {
            return {
              ...current,
              departmentId:
                value,
              campaignTeamId:
                "",
            };
          }

          return {
            ...current,
            [name]: value,
          };
        },
      );

      setFormError("");
    };

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !form.email.trim()
      ) {
        setFormError(
          "Enter the invitee’s email address.",
        );

        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.email.trim(),
        )
      ) {
        setFormError(
          "Enter a valid email address.",
        );

        return;
      }

      if (!form.roleKey) {
        setFormError(
          "Choose a campaign role.",
        );

        return;
      }

      try {
        const invitation =
          await createInvitation(
            form,
          );

        setResult(
          invitation,
        );

        setForm(
          EMPTY_FORM,
        );

        setFormError("");
        setCopied(false);
      } catch {
        // Hook displays the grounded
        // database error.
      }
    };

  const handleCopy =
    async () => {
      if (!invitationLink) {
        return;
      }

      await navigator.clipboard.writeText(
        invitationLink,
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        1800,
      );
    };

  const handleCancel =
    async (invitation) => {
      const confirmed =
        window.confirm(
          `Cancel the invitation for ${invitation.email}?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        await cancelInvitation(
          invitation.id,
        );
      } catch {
        // Hook displays the grounded
        // database error.
      }
    };

  return (
    <div
      className={
        teamStyles.app
      }
    >
      <aside
        className={`${teamStyles.sidebar} ${
          sidebarOpen
            ? teamStyles.sidebarOpen
            : ""
        }`}
      >
        <div
          className={
            teamStyles.sidebarHeader
          }
        >
          <button
            className={
              teamStyles.campaignIdentity
            }
            type="button"
            onClick={() =>
              navigate(
                "/profile/settings",
              )
            }
            aria-label="Open campaign workspace profile"
            data-invitation-workspace="true"
          >
            <div
              className={
                teamStyles.campaignMark
              }
            >
              <span>
                {getInitials(
                  workspace.name,
                )}
              </span>

              <Vote
                size={19}
                strokeWidth={1.8}
              />
            </div>

            <div
              data-invitation-workspace-copy="true"
            >
              <small
                data-invitation-workspace-label="true"
              >
                Campaign workspace
              </small>

              <strong>
                {workspace.name}
              </strong>

              <span>
                {
                  workspace.description
                }
              </span>
            </div>
          </button>

          <button
            className={
              teamStyles.closeSidebar
            }
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>

        <nav
          className={
            teamStyles.navigation
          }
        >
          <span
            className={
              teamStyles.navigationLabel
            }
          >
            Campaign
          </span>

          {NAVIGATION.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={
                    item.label
                  }
                  className={
                    item.label ===
                    "Team"
                      ? teamStyles.activeNavigation
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    handleNavigation(
                      item,
                    )
                  }
                  disabled={
                    item.comingSoon
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
        </nav>

        <div
          className={
            teamStyles.sidebarFooter
          }
          data-invitation-signed-in="true"
        >
          <span
            data-invitation-signed-in-label="true"
          >
            Signed in as
          </span>

          <div
            data-invitation-signed-in-row="true"
          >
            <button
              className={
                teamStyles.profile
              }
              type="button"
              onClick={() =>
                navigate(
                  "/profile/settings",
                )
              }
              data-invitation-profile="true"
            >
              <div
                className={
                  teamStyles.avatar
                }
              >
                {getInitials(
                  user.name,
                )}
              </div>

              <div>
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
              onClick={
                handleLogout
              }
              aria-label="Sign out"
              title="Sign out"
              data-invitation-signout="true"
            >
              <LogOut
                size={18}
              />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className={
            teamStyles.mobileOverlay
          }
          type="button"
          onClick={() =>
            setSidebarOpen(false)
          }
          aria-label="Close navigation"
        />
      )}

      <div
        className={
          teamStyles.workspace
        }
      >
        <header
          className={
            teamStyles.topbar
          }
        >
          <div
            className={
              teamStyles.topbarLeft
            }
          >
            <button
              className={
                teamStyles.menuButton
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
                  teamStyles.breadcrumb
                }
              >
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Team
                <ChevronRight
                  size={13}
                />
                Invitations
              </span>

              <strong>
                Invitation Manager
              </strong>
            </div>
          </div>

          <div
            className={
              teamStyles.topbarActions
            }
          >
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            

          </div>
        </header>

        <main
          className={
            teamStyles.main
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <button
                className={
                  styles.backButton
                }
                type="button"
                onClick={() =>
                  navigate(
                    "/team",
                  )
                }
              >
                <ArrowLeft
                  size={16}
                />
                Back to Team
              </button>

              <span
                className={
                  styles.eyebrow
                }
              >
                Team Management
              </span>

              <h1>
                Invitation Manager
              </h1>

              <p>
                Create secure campaign invitations,
                choose the correct operating role and
                track every outstanding access request.
              </p>

              <div
                className={
                  styles.liveStatus
                }
              >
                <span />

                {isLoading
                  ? "Synchronizing invitations"
                  : error
                    ? "Connection needs attention"
                    : lastUpdated
                      ? `Live · updated ${formatTime(
                          lastUpdated,
                        )}`
                      : "Live campaign data"}
              </div>
            </div>

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
          </section>

          {!canManageInvitations && (
            <section
              className={
                styles.noAccess
              }
            >
              <ShieldCheck
                size={34}
              />

              <h2>
                Invitation management is restricted
              </h2>

              <p>
                Your current campaign role does not
                include the workspace.invite_members
                permission.
              </p>
            </section>
          )}

          {canManageInvitations && (
            <>
              {(error ||
                actionError) && (
                <div
                  className={
                    styles.errorBanner
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={19}
                  />

                  <div>
                    <strong>
                      Invitation action needs attention
                    </strong>

                    <span>
                      {actionError ||
                        error}
                    </span>
                  </div>
                </div>
              )}

              {/* CAMPAIGN HQ CLICKABLE INVITATION SUMMARY FILTERS */}
              <section
                className={
                  styles.summaryGrid
                }
                aria-label="Invitation status filters"
              >
                <button
                  className={`${styles.summaryCard} ${
                    statusFilter === "pending"
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "pending",
                    )
                  }
                  aria-pressed={
                    statusFilter === "pending"
                  }
                >
                  <span>
                    Pending
                  </span>

                  <strong>
                    {
                      pendingInvitations.length
                    }
                  </strong>

                  <p>
                    Awaiting acceptance
                  </p>

                  <Clock3
                    size={24}
                  />
                </button>

                <button
                  className={`${styles.summaryCard} ${
                    statusFilter === "expiring"
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "expiring",
                    )
                  }
                  aria-pressed={
                    statusFilter === "expiring"
                  }
                >
                  <span>
                    Expiring soon
                  </span>

                  <strong>
                    {
                      expiringSoon.length
                    }
                  </strong>

                  <p>
                    Within 48 hours
                  </p>

                  <AlertTriangle
                    size={24}
                  />
                </button>

                <button
                  className={`${styles.summaryCard} ${
                    statusFilter === "accepted"
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "accepted",
                    )
                  }
                  aria-pressed={
                    statusFilter === "accepted"
                  }
                >
                  <span>
                    Accepted
                  </span>

                  <strong>
                    {
                      acceptedInvitations.length
                    }
                  </strong>

                  <p>
                    Invitation history
                  </p>

                  <CheckCircle2
                    size={24}
                  />
                </button>

                <button
                  className={`${styles.summaryCard} ${
                    statusFilter === "cancelled"
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "cancelled",
                    )
                  }
                  aria-pressed={
                    statusFilter === "cancelled"
                  }
                >
                  <span>
                    Cancelled
                  </span>

                  <strong>
                    {
                      cancelledInvitations.length
                    }
                  </strong>

                  <p>
                    Revoked invitations
                  </p>

                  <Ban
                    size={24}
                  />
                </button>
              </section>

              {result && (
                <section
                  className={
                    styles.resultPanel
                  }
                >
                  <div
                    className={
                      styles.resultIcon
                    }
                  >
                    <Link2
                      size={23}
                    />
                  </div>

                  <div
                    className={
                      styles.resultCopy
                    }
                  >
                    <span>
                      {result
                        .emailSent
                        ? "Invitation emailed securely"
                        : "Secure invitation created"}
                    </span>

                    <h2>
                      {result
                        .emailSent
                        ? "Email sent successfully"
                        : "Copy this link now"}
                    </h2>

                    <p>
                      {result
                        .emailSent
                        ? `Campaign Seat emailed the secure invitation to ${
                            result
                              .emailRecipient ||
                            "the invited address"
                          }. Keep the link below as a backup until the invitation is accepted.`
                        : result
                            .emailError ||
                          "The invitation was created, but email delivery did not complete. Copy and send the secure link manually."}
                    </p>

                    <div
                      className={
                        styles.linkRow
                      }
                    >
                      <input
                        value={
                          invitationLink
                        }
                        readOnly
                        aria-label="Secure invitation link"
                      />

                      <button
                        type="button"
                        onClick={
                          handleCopy
                        }
                      >
                        {copied ? (
                          <Check
                            size={17}
                          />
                        ) : (
                          <Copy
                            size={17}
                          />
                        )}

                        {copied
                          ? "Copied"
                          : "Copy link"}
                      </button>
                    </div>

                    <small>
                      Expires{" "}
                      {formatDateTime(
                        result
                          .invitationExpiresAt,
                      )}
                    </small>

                    <div
                      className={
                        styles.acceptanceNotice
                      }
                    >
                      <AlertTriangle
                        size={17}
                      />

                      <span>
                        {result
                          .emailSent
                          ? "The recipient must use the invited email address. The secure link expires at the time shown above."
                          : "Email delivery did not complete. Copy the secure link and send it directly; the invitation remains active until it expires or is cancelled."}
                      </span>
                    </div>
                  </div>

                  <button
                    className={
                      styles.dismissResult
                    }
                    type="button"
                    onClick={() =>
                      setResult(null)
                    }
                    aria-label="Dismiss invitation result"
                  >
                    <X size={19} />
                  </button>
                </section>
              )}

              <section
                className={
                  styles.managementGrid
                }
              >
                <form
                  className={
                    styles.invitePanel
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <header>
                    <div
                      className={
                        styles.panelIcon
                      }
                    >
                      <UserPlus
                        size={22}
                      />
                    </div>

                    <div>
                      <span>
                        New invitation
                      </span>

                      <h2>
                        Invite a campaign member
                      </h2>
                    </div>
                  </header>

                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label
                      htmlFor="invite-email"
                    >
                      Email address
                    </label>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Mail
                        size={17}
                      />

                      <input
                        id="invite-email"
                        name="email"
                        type="email"
                        value={
                          form.email
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="person@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label
                      htmlFor="invite-role"
                    >
                      Campaign role
                    </label>

                    <select
                      id="invite-role"
                      name="roleKey"
                      value={
                        form.roleKey
                      }
                      onChange={
                        handleFormChange
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

                    {selectedRole && (
                      <div
                        className={
                          styles.rolePreview
                        }
                      >
                        <KeyRound
                          size={16}
                        />

                        <div>
                          <strong>
                            {
                              selectedRole.name
                            }
                          </strong>

                          <span>
                            {
                              selectedRole.description
                            }
                          </span>

                          <small>
                            {
                              selectedRole.dashboard_type
                            }
                            {" dashboard · "}
                            {
                              selectedRole.seat_type
                            }
                            {" seat"}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={
                      styles.formField
                    }
                  >
                    <label
                      htmlFor="invite-title"
                    >
                      Display title
                      <small>
                        Optional
                      </small>
                    </label>

                    <input
                      id="invite-title"
                      name="displayTitle"
                      type="text"
                      value={
                        form.displayTitle
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="Example: Field Director"
                      maxLength={120}
                    />
                  </div>

                  <div
                    className={
                      styles.formColumns
                    }
                  >
                    <div
                      className={
                        styles.formField
                      }
                    >
                      <label
                        htmlFor="invite-department"
                      >
                        Department
                        <small>
                          Optional
                        </small>
                      </label>

                      <select
                        id="invite-department"
                        name="departmentId"
                        value={
                          form.departmentId
                        }
                        onChange={
                          handleFormChange
                        }
                      >
                        <option value="">
                          No department
                        </option>

                        {departments.map(
                          (department) => (
                            <option
                              key={
                                department.id
                              }
                              value={
                                department.id
                              }
                            >
                              {
                                department.name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div
                      className={
                        styles.formField
                      }
                    >
                      <label
                        htmlFor="invite-team"
                      >
                        Campaign team
                        <small>
                          Optional
                        </small>
                      </label>

                      <select
                        id="invite-team"
                        name="campaignTeamId"
                        value={
                          form.campaignTeamId
                        }
                        onChange={
                          handleFormChange
                        }
                      >
                        <option value="">
                          No team
                        </option>

                        {availableTeams.map(
                          (team) => (
                            <option
                              key={
                                team.id
                              }
                              value={
                                team.id
                              }
                            >
                              {
                                team.name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>

                  {formError && (
                    <div
                      className={
                        styles.formError
                      }
                    >
                      <AlertTriangle
                        size={16}
                      />

                      {formError}
                    </div>
                  )}

                  <button
                    className={
                      styles.submitButton
                    }
                    type="submit"
                    disabled={
                      isSaving ||
                      isLoading
                    }
                  >
                    {isSaving ? (
                      <LoaderCircle
                        className={
                          styles.spinning
                        }
                        size={18}
                      />
                    ) : (
                      <Send
                        size={18}
                      />
                    )}

                    {isSaving
                      ? "Creating invitation"
                      : "Create secure invitation"}
                  </button>
                </form>

                <section
                  className={
                    styles.invitationPanel
                  }
                >
                  <header
                    className={
                      styles.listHeader
                    }
                  >
                    <div>
                      <span>
                        Invitation activity
                      </span>

                      <h2>
                        Access requests
                      </h2>
                    </div>

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
                      aria-label="Filter invitation status"
                    >
                      <option value="pending">
                        Pending
                      </option>

                      <option value="accepted">
                        Accepted
                      </option>

                      <option value="expiring">
                        Expiring soon
                      </option>

                      <option value="expired">
                        Expired
                      </option>

                      <option value="cancelled">
                        Cancelled
                      </option>

                      <option value="all">
                        All invitations
                      </option>
                    </select>
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
                        Loading invitations
                      </strong>
                    </div>
                  ) : visibleInvitations.length ? (
                    <div
                      className={
                        styles.invitationList
                      }
                    >
                      {visibleInvitations.map(
                        (invitation) => {
                          const status =
                            getInvitationStatus(
                              invitation,
                              referenceTime,
                            );

                          const role =
                            roleMap.get(
                              invitation.role_key,
                            );

                          const department =
                            departmentMap.get(
                              invitation.department_id,
                            );

                          const team =
                            teamMap.get(
                              invitation.campaign_team_id,
                            );

                          return (
                            <article
                              key={
                                invitation.id
                              }
                              className={
                                styles.invitationCard
                              }
                            >
                              <div
                                className={
                                  styles.invitationAvatar
                                }
                              >
                                <Mail
                                  size={19}
                                />
                              </div>

                              <div
                                className={
                                  styles.invitationMain
                                }
                              >
                                <div
                                  className={
                                    styles.invitationTitle
                                  }
                                >
                                  <strong>
                                    {
                                      invitation.email
                                    }
                                  </strong>

                                  <span
                                    className={`${styles.statusBadge} ${
                                      styles[
                                        `status${formatStatus(
                                          status,
                                        ).replaceAll(
                                          " ",
                                          "",
                                        )}`
                                      ] || ""
                                    }`}
                                  >
                                    {formatStatus(
                                      status,
                                    )}
                                  </span>
                                </div>

                                <p>
                                  {
                                    invitation.display_title ||
                                    role?.name ||
                                    invitation.role_key
                                  }
                                </p>

                                <div
                                  className={
                                    styles.invitationMeta
                                  }
                                >
                                  <span>
                                    Created{" "}
                                    {formatDateTime(
                                      invitation.created_at,
                                    )}
                                  </span>

                                  <span>
                                    Expires{" "}
                                    {formatDateTime(
                                      invitation.expires_at,
                                    )}
                                  </span>

                                  {department && (
                                    <span>
                                      {
                                        department.name
                                      }
                                    </span>
                                  )}

                                  {team && (
                                    <span>
                                      {
                                        team.name
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>

                              {status ===
                                "pending" && (
                                <button
                                  className={
                                    styles.cancelButton
                                  }
                                  type="button"
                                  onClick={() =>
                                    handleCancel(
                                      invitation,
                                    )
                                  }
                                  disabled={
                                    isSaving
                                  }
                                >
                                  <Ban
                                    size={16}
                                  />

                                  Cancel
                                </button>
                              )}
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
                      <UserPlus
                        size={34}
                      />

                      <strong>
                        No invitations in this view
                      </strong>

                      <p>
                        Create a secure invitation or
                        choose another status filter.
                      </p>
                    </div>
                  )}
                </section>
              </section>

              <footer
                className={
                  teamStyles.footer
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
