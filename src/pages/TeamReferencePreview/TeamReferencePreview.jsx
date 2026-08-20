import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  Check,
  Copy,
  ChevronRight,
  Clock3,
  Crown,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

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
  getCurrentWorkspace,
  getRoleLabel,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import styles from "./TeamReferencePreview.module.css";

const TEAM_REFERENCE_TIME = Date.now();

const DEMO_ROLES = [
  {
    key: "candidate",
    name: "Candidate",
    description: "Campaign principal and final decision-maker.",
  },
  {
    key: "campaign_manager",
    name: "Campaign Manager",
    description: "Full campaign operations and team oversight.",
  },
  {
    key: "department_lead",
    name: "Department Lead",
    description: "Leads a campaign department and assigned staff.",
  },
  {
    key: "staff",
    name: "Staff",
    description: "Campaign staff access and assigned work.",
  },
  {
    key: "team_captain",
    name: "Team Captain",
    description: "Coordinates volunteers and assigned campaign work.",
  },
  {
    key: "reviewer",
    name: "Reviewer",
    description: "Reviews designated materials and approval requests.",
  },
  {
    key: "volunteer",
    name: "Volunteer",
    description: "Limited access to assigned campaign work.",
  },
];

const DEMO_DEPARTMENTS = [
  {
    id: "demo-department-leadership",
    name: "Campaign Leadership",
  },
  {
    id: "demo-department-field",
    name: "Field Operations",
  },
  {
    id: "demo-department-communications",
    name: "Communications",
  },
  {
    id: "demo-department-finance",
    name: "Finance",
  },
];

const DEMO_TEAMS = [
  {
    id: "demo-team-executive",
    department_id:
      "demo-department-leadership",
    name: "Executive Team",
  },
  {
    id: "demo-team-field",
    department_id:
      "demo-department-field",
    name: "District 6 Field Team",
  },
  {
    id: "demo-team-content",
    department_id:
      "demo-department-communications",
    name: "Content & Digital",
  },
];

const DEMO_MEMBER_AUDIT = {
  "demo-member-1": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        42 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Workspace setup",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        11 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Campaign security setup",
  },
  "demo-member-2": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        39 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Elizabeth Accomando",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        8 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Elizabeth Accomando",
  },
  "demo-member-3": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        28 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Chris Isaak",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        5 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Chris Isaak",
  },
  "demo-member-4": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        24 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Chris Isaak",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        4 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Chris Isaak",
  },
  "demo-member-5": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        17 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Patrick Sullivan",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        3 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Patrick Sullivan",
  },
  "demo-member-6": {
    joinedAt: new Date(
      TEAM_REFERENCE_TIME -
        14 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    invitedBy: "Lucy Ramirez",
    accessChangedAt: new Date(
      TEAM_REFERENCE_TIME -
        2 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accessChangedBy: "Chris Isaak",
  },
};

const DEMO_INVITATION_DETAILS = {
  "demo-invitation-1": {
    invitedBy: "Chris Isaak",
    lastSentAt: new Date(
      TEAM_REFERENCE_TIME -
        22 * 60 * 60 * 1000,
    ).toISOString(),
    sendCount: 1,
    token: "demo-finance-assistant-token",
  },
  "demo-invitation-2": {
    invitedBy: "Patrick Sullivan",
    lastSentAt: new Date(
      TEAM_REFERENCE_TIME -
        3 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    sendCount: 2,
    token: "demo-weekend-volunteer-token",
  },
  "demo-invitation-3": {
    invitedBy: "Elizabeth Accomando",
    lastSentAt: new Date(
      TEAM_REFERENCE_TIME -
        12 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    sendCount: 1,
    token: "demo-compliance-reviewer-token",
  },
};

function isoOffsetHours(hours) {
  return new Date(
    TEAM_REFERENCE_TIME -
      hours * 60 * 60 * 1000,
  ).toISOString();
}

function isoOffsetDays(days) {
  return new Date(
    TEAM_REFERENCE_TIME +
      days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function buildDemoMembers() {
  return [
    {
      membershipId: "demo-member-1",
      userId: "demo-user-elizabeth",
      fullName: "Elizabeth Accomando",
      email: "elizabeth@accomandofordistrict6.com",
      roleKey: "candidate",
      displayTitle: "Candidate",
      dashboardType: "candidate",
      seatType: "leadership",
      status: "active",
      departmentName: "Campaign Leadership",
      teamName: "Executive Team",
      lastActivityAt: isoOffsetHours(1),
      permissions: [
        "Campaign administration",
        "Approvals",
        "Member access",
      ],
    },
    {
      membershipId: "demo-member-2",
      userId: "demo-user-chris",
      fullName: "Chris Isaak",
      email: "chris@campaignseat.com",
      roleKey: "campaign_manager",
      displayTitle: "Campaign Manager",
      dashboardType: "manager",
      seatType: "leadership",
      status: "active",
      departmentName: "Campaign Leadership",
      teamName: "Executive Team",
      lastActivityAt: isoOffsetHours(2),
      permissions: [
        "Campaign operations",
        "Team management",
        "Invitations",
      ],
    },
    {
      membershipId: "demo-member-3",
      userId: "demo-user-patrick",
      fullName: "Patrick Sullivan",
      email: "patrick@example.com",
      roleKey: "department_lead",
      displayTitle: "Field Director",
      dashboardType: "manager",
      seatType: "staff",
      status: "active",
      departmentName: "Field Operations",
      teamName: "District 6 Field Team",
      lastActivityAt: isoOffsetHours(5),
      permissions: [
        "Field assignments",
        "Volunteer coordination",
      ],
    },
    {
      membershipId: "demo-member-4",
      userId: "demo-user-mary",
      fullName: "Mary Collins",
      email: "mary@example.com",
      roleKey: "staff",
      displayTitle: "Communications Director",
      dashboardType: "staff",
      seatType: "staff",
      status: "active",
      departmentName: "Communications",
      teamName: "Content & Digital",
      lastActivityAt: isoOffsetHours(9),
      permissions: [
        "Communications",
        "Documents",
      ],
    },
    {
      membershipId: "demo-member-5",
      userId: "demo-user-lucy",
      fullName: "Lucy Ramirez",
      email: "lucy@example.com",
      roleKey: "team_captain",
      displayTitle: "Volunteer Captain",
      dashboardType: "volunteer",
      seatType: "volunteer",
      status: "active",
      departmentName: "Field Operations",
      teamName: "District 6 Field Team",
      lastActivityAt: isoOffsetHours(26),
      permissions: [
        "Assigned volunteers",
        "Field tasks",
      ],
    },
    {
      membershipId: "demo-member-6",
      userId: "demo-user-jordan",
      fullName: "Jordan Lee",
      email: "jordan@example.com",
      roleKey: "volunteer",
      displayTitle: "Canvassing Volunteer",
      dashboardType: "volunteer",
      seatType: "volunteer",
      status: "inactive",
      departmentName: "Field Operations",
      teamName: "District 6 Field Team",
      lastActivityAt: isoOffsetHours(96),
      permissions: [
        "Assigned field work",
      ],
    },
  ];
}

function buildDemoInvitations() {
  return [
    {
      id: "demo-invitation-1",
      email: "alexis@example.com",
      role_key: "staff",
      display_title: "Finance Assistant",
      department_id: "demo-department-finance",
      campaign_team_id: null,
      status: "pending",
      created_at: isoOffsetDays(-1),
      expires_at: isoOffsetDays(6),
    },
    {
      id: "demo-invitation-2",
      email: "michael@example.com",
      role_key: "volunteer",
      display_title: "Weekend Volunteer",
      department_id: "demo-department-field",
      campaign_team_id: "demo-team-field",
      status: "pending",
      created_at: isoOffsetDays(-3),
      expires_at: isoOffsetDays(1),
    },
    {
      id: "demo-invitation-3",
      email: "taylor@example.com",
      role_key: "reviewer",
      display_title: "Compliance Reviewer",
      department_id: "demo-department-leadership",
      campaign_team_id: null,
      status: "accepted",
      created_at: isoOffsetDays(-12),
      expires_at: isoOffsetDays(-5),
    },
  ];
}

function memberAudit(member) {
  const fallback =
    DEMO_MEMBER_AUDIT[
      member.membershipId
    ] || {};

  return {
    joinedAt:
      member.joinedAt ||
      member.createdAt ||
      member.created_at ||
      fallback.joinedAt ||
      null,
    invitedBy:
      member.invitedBy ||
      member.invitedByName ||
      fallback.invitedBy ||
      "Not recorded",
    accessChangedAt:
      member.accessChangedAt ||
      member.updatedAt ||
      member.updated_at ||
      fallback.accessChangedAt ||
      null,
    accessChangedBy:
      member.accessChangedBy ||
      member.accessChangedByName ||
      fallback.accessChangedBy ||
      "Not recorded",
  };
}

function invitationDetails(invitation) {
  const fallback =
    DEMO_INVITATION_DETAILS[
      invitation.id
    ] || {};

  return {
    invitedBy:
      invitation.invited_by_name ||
      invitation.invitedByName ||
      fallback.invitedBy ||
      "Campaign leadership",
    lastSentAt:
      invitation.last_sent_at ||
      fallback.lastSentAt ||
      invitation.created_at ||
      null,
    sendCount:
      invitation.send_count ||
      fallback.sendCount ||
      1,
    token:
      invitation.invitation_token ||
      fallback.token ||
      "",
  };
}

function invitationExpiresSoon(invitation) {
  if (
    invitationStatus(invitation) !==
      "pending" ||
    !invitation.expires_at
  ) {
    return false;
  }

  const remaining =
    new Date(
      invitation.expires_at,
    ).getTime() -
    TEAM_REFERENCE_TIME;

  return (
    remaining > 0 &&
    remaining <=
      48 * 60 * 60 * 1000
  );
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function initials(name) {
  const parts = String(name || "")
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

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function isLeadership(member) {
  return [
    "candidate",
    "campaign_owner",
    "campaign_consultant",
    "campaign_manager",
  ].includes(member.roleKey);
}

function invitationStatus(invitation) {
  if (
    invitation.status === "pending" &&
    invitation.expires_at &&
    new Date(
      invitation.expires_at,
    ).getTime() <= TEAM_REFERENCE_TIME
  ) {
    return "expired";
  }

  return invitation.status || "pending";
}

const EMPTY_ACCESS_FORM = {
  membershipId: "",
  fullName: "",
  email: "",
  roleKey: "staff",
  displayTitle: "",
  status: "active",
};

const EMPTY_INVITATION_FORM = {
  email: "",
  roleKey: "staff",
  displayTitle: "",
  departmentId: "",
  campaignTeamId: "",
};

export default function TeamReferencePreview() {
  const location = useLocation();
  const navigate = useNavigate();

  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();

  const demoMode =
    new URLSearchParams(
      location.search,
    ).get("team-demo") === "1";

  const leadershipAccess =
    demoMode ||
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const canManageInvitations =
    demoMode ||
    hasCampaignPermission(
      "workspace.invite_members",
    );

  const canManageAccess =
    demoMode ||
    (
      leadershipAccess &&
      canManageInvitations
    );

  const teamCommand =
    useTeamAccessCommandCenter({
      workspaceId:
        demoMode
          ? ""
          : workspace.id,
    });

  const invitationCommand =
    useInvitationManagement({
      workspaceId:
        demoMode
          ? ""
          : workspace.id,
      canManageInvitations:
        demoMode
          ? false
          : canManageInvitations,
    });

  const accessCommand =
    useMemberAccessManagement({
      workspaceId:
        demoMode
          ? ""
          : workspace.id,
    });

  const [
    demoMembers,
    setDemoMembers,
  ] = useState(buildDemoMembers);

  const [
    demoInvitations,
    setDemoInvitations,
  ] = useState(
    buildDemoInvitations,
  );

  const [
    demoUpdatedAt,
    setDemoUpdatedAt,
  ] = useState(
    () =>
      new Date(
        TEAM_REFERENCE_TIME,
      ),
  );

  const [
    activeView,
    setActiveView,
  ] = useState("people");

  const [
    summaryFilter,
    setSummaryFilter,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState("");

  const [
    drawerTab,
    setDrawerTab,
  ] = useState("overview");

  const [
    drawerExpanded,
    setDrawerExpanded,
  ] = useState(false);

  const [
    accessEditorOpen,
    setAccessEditorOpen,
  ] = useState(false);

  const [
    invitationEditorOpen,
    setInvitationEditorOpen,
  ] = useState(false);

  const [
    accessForm,
    setAccessForm,
  ] = useState(
    EMPTY_ACCESS_FORM,
  );

  const [
    invitationForm,
    setInvitationForm,
  ] = useState(
    EMPTY_INVITATION_FORM,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    workspaceNotice,
    setWorkspaceNotice,
  ] = useState("");

  const members =
    demoMode
      ? demoMembers
      : teamCommand.members;

  const invitations =
    demoMode
      ? demoInvitations
      : invitationCommand.invitations;

  const roles =
    invitationCommand.roles.length
      ? invitationCommand.roles
      : DEMO_ROLES;

  const departments =
    invitationCommand.departments
      .length
      ? invitationCommand
          .departments
      : DEMO_DEPARTMENTS;

  const campaignTeams =
    invitationCommand.teams.length
      ? invitationCommand.teams
      : DEMO_TEAMS;

  const roleMap = useMemo(
    () =>
      new Map(
        roles.map((role) => [
          role.key,
          role,
        ]),
      ),
    [roles],
  );

  const departmentMap = useMemo(
    () =>
      new Map(
        departments.map(
          (department) => [
            department.id,
            department,
          ],
        ),
      ),
    [departments],
  );

  const teamMap = useMemo(
    () =>
      new Map(
        campaignTeams.map(
          (team) => [
            team.id,
            team,
          ],
        ),
      ),
    [campaignTeams],
  );

  const filteredMembers =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return members.filter(
        (member) => {
          if (
            summaryFilter ===
              "leadership" &&
            !isLeadership(member)
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "field" &&
            !(
              member.seatType ===
                "volunteer" ||
              member.dashboardType ===
                "volunteer" ||
              member.departmentName ===
                "Field Operations"
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "inactive" &&
            member.status !==
              "inactive"
          ) {
            return false;
          }

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

          if (!normalizedSearch) {
            return true;
          }

          return [
            member.fullName,
            member.email,
            member.displayTitle,
            member.roleKey,
            member.departmentName,
            member.teamName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      members,
      roleFilter,
      search,
      statusFilter,
      summaryFilter,
    ]);

  const filteredInvitations =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return invitations.filter(
        (invitation) => {
          if (
            statusFilter !== "all" &&
            invitationStatus(
              invitation,
            ) !== statusFilter
          ) {
            return false;
          }

          if (
            roleFilter !== "all" &&
            invitation.role_key !==
              roleFilter
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            invitation.email,
            invitation.display_title,
            invitation.role_key,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      invitations,
      roleFilter,
      search,
      statusFilter,
    ]);

  const selectedMember =
    members.find(
      (member) =>
        member.membershipId ===
        selectedMemberId,
    ) || null;

  const selectedMemberAudit =
    selectedMember
      ? memberAudit(selectedMember)
      : null;

  const activeMembers =
    members.filter(
      (member) =>
        member.status ===
        "active",
    );

  const leadershipMembers =
    activeMembers.filter(
      isLeadership,
    );

  const fieldMembers =
    activeMembers.filter(
      (member) =>
        member.seatType ===
          "volunteer" ||
        member.dashboardType ===
          "volunteer" ||
        member.departmentName ===
          "Field Operations",
    );

  const inactiveMembers =
    members.filter(
      (member) =>
        member.status ===
        "inactive",
    );

  const pendingInvitations =
    invitations.filter(
      (invitation) =>
        invitationStatus(
          invitation,
        ) === "pending",
    );

  const privilegedMembers =
    leadershipMembers;

  const expiringInvitations =
    pendingInvitations.filter(
      invitationExpiresSoon,
    );

  const loading =
    !demoMode &&
    (
      teamCommand.isLoading ||
      invitationCommand
        .isLoading
    );

  const saving =
    !demoMode &&
    (
      accessCommand.isSaving ||
      invitationCommand
        .isSaving
    );

  const pageError =
    demoMode
      ? ""
      : (
          teamCommand.error ||
          invitationCommand.error ||
          invitationCommand
            .actionError ||
          accessCommand.actionError
        );

  const updatedAt =
    demoMode
      ? demoUpdatedAt
      : (
          teamCommand
            .lastUpdated ||
          invitationCommand
            .lastUpdated
        );

  useEffect(() => {
    const body = document.body;

    if (
      selectedMemberId ||
      accessEditorOpen ||
      invitationEditorOpen
    ) {
      body.dataset.teamFocus =
        "true";
    } else {
      delete body.dataset
        .teamFocus;
    }

    return () => {
      delete body.dataset
        .teamFocus;
    };
  }, [
    accessEditorOpen,
    invitationEditorOpen,
    selectedMemberId,
  ]);

  const handleRefresh =
    async () => {
      if (demoMode) {
        setDemoUpdatedAt(
          new Date(),
        );
        return;
      }

      await Promise.all([
        teamCommand.refresh(),
        invitationCommand
          .refresh(),
      ]);
    };

  const openMember =
    (member) => {
      setDrawerTab("overview");
      setDrawerExpanded(false);
      setSelectedMemberId(
        member.membershipId,
      );
    };

  const openAccessEditor =
    (member) => {
      setAccessForm({
        membershipId:
          member.membershipId,
        fullName:
          member.fullName,
        email:
          member.email,
        roleKey:
          member.roleKey,
        displayTitle:
          member.displayTitle,
        status:
          member.status,
      });

      setFormError("");
      setAccessEditorOpen(true);
    };

  const saveMemberAccess =
    async (event) => {
      event.preventDefault();

      if (
        !accessForm.roleKey ||
        !accessForm.displayTitle
          .trim()
      ) {
        setFormError(
          "Choose a role and enter a display title.",
        );
        return;
      }

      try {
        if (demoMode) {
          setDemoMembers(
            (current) =>
              current.map(
                (member) =>
                  member
                    .membershipId ===
                    accessForm
                      .membershipId
                    ? {
                        ...member,
                        roleKey:
                          accessForm
                            .roleKey,
                        displayTitle:
                          accessForm
                            .displayTitle
                            .trim(),
                        status:
                          accessForm
                            .status,
                      }
                    : member,
              ),
          );

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          await accessCommand
            .updateMemberAccess({
              membershipId:
                accessForm
                  .membershipId,
              roleKey:
                accessForm
                  .roleKey,
              displayTitle:
                accessForm
                  .displayTitle,
              status:
                accessForm
                  .status,
            });

          await teamCommand
            .refresh();
        }

        setAccessEditorOpen(false);
        setFormError("");
      } catch (error) {
        setFormError(
          error?.message ||
            "Member access could not be saved.",
        );
      }
    };

  const createInvitation =
    async (event) => {
      event.preventDefault();

      const cleanEmail =
        invitationForm.email
          .trim()
          .toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          cleanEmail,
        )
      ) {
        setFormError(
          "Enter a valid email address.",
        );
        return;
      }

      if (
        !invitationForm.roleKey
      ) {
        setFormError(
          "Choose a campaign role.",
        );
        return;
      }

      try {
        if (demoMode) {
          const invitation = {
            id:
              `demo-invitation-${Date.now()}`,
            email: cleanEmail,
            role_key:
              invitationForm
                .roleKey,
            display_title:
              invitationForm
                .displayTitle
                .trim() ||
              roleMap.get(
                invitationForm
                  .roleKey,
              )?.name ||
              "Campaign Member",
            department_id:
              invitationForm
                .departmentId ||
              null,
            campaign_team_id:
              invitationForm
                .campaignTeamId ||
              null,
            status: "pending",
            created_at:
              new Date()
                .toISOString(),
            expires_at:
              new Date(
                Date.now() +
                  7 *
                    24 *
                    60 *
                    60 *
                    1000,
              ).toISOString(),
          };

          setDemoInvitations(
            (current) => [
              invitation,
              ...current,
            ],
          );

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          await invitationCommand
            .createInvitation({
              email: cleanEmail,
              roleKey:
                invitationForm
                  .roleKey,
              displayTitle:
                invitationForm
                  .displayTitle,
              departmentId:
                invitationForm
                  .departmentId,
              campaignTeamId:
                invitationForm
                  .campaignTeamId,
            });
        }

        setInvitationForm(
          EMPTY_INVITATION_FORM,
        );
        setInvitationEditorOpen(
          false,
        );
        setActiveView(
          "invitations",
        );
        setFormError("");
      } catch (error) {
        setFormError(
          error?.message ||
            "The invitation could not be created.",
        );
      }
    };

  const cancelInvite =
    async (invitation) => {
      const confirmed =
        window.confirm(
          `Cancel the invitation for ${invitation.email}?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        if (demoMode) {
          setDemoInvitations(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  invitation.id
                    ? {
                        ...item,
                        status:
                          "cancelled",
                      }
                    : item,
              ),
          );

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          await invitationCommand
            .cancelInvitation(
              invitation.id,
            );
        }
      } catch (error) {
        setFormError(
          error?.message ||
            "The invitation could not be cancelled.",
        );
      }
    };

  const resendInvite =
    async (invitation) => {
      if (!demoMode) {
        navigate(
          "/team/invitations",
        );
        return;
      }

      const details =
        invitationDetails(
          invitation,
        );

      setDemoInvitations(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              invitation.id
                ? {
                    ...item,
                    last_sent_at:
                      new Date()
                        .toISOString(),
                    send_count:
                      details
                        .sendCount +
                      1,
                  }
                : item,
          ),
      );

      setDemoUpdatedAt(
        new Date(),
      );

      setWorkspaceNotice(
        `Demo invitation resent to ${invitation.email}.`,
      );
    };

  const copyInviteLink =
    async (invitation) => {
      if (!demoMode) {
        navigate(
          "/team/invitations",
        );
        return;
      }

      const details =
        invitationDetails(
          invitation,
        );

      const token =
        details.token ||
        invitation.id;

      const secureLink =
        `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;

      try {
        if (
          navigator.clipboard &&
          navigator.clipboard
            .writeText
        ) {
          await navigator.clipboard
            .writeText(
              secureLink,
            );
        } else {
          window.prompt(
            "Copy this demo invitation link:",
            secureLink,
          );
        }

        setWorkspaceNotice(
          `Demo invitation link copied for ${invitation.email}.`,
        );
      } catch {
        window.prompt(
          "Copy this demo invitation link:",
          secureLink,
        );
      }
    };

  const summaryCards = [
    {
      key: "all",
      label: "Active members",
      value: activeMembers.length,
      caption: "Current workspace seats",
      icon: UsersRound,
    },
    {
      key: "leadership",
      label: "Leadership",
      value:
        leadershipMembers.length,
      caption: "Command-level access",
      icon: Crown,
    },
    {
      key: "field",
      label: "Field & volunteer",
      value: fieldMembers.length,
      caption: "District operations",
      icon: BriefcaseBusiness,
    },
    {
      key: "inactive",
      label: "Inactive access",
      value:
        inactiveMembers.length,
      caption: "Suspended workspace seats",
      icon: ShieldOff,
    },
  ];

  return (
    <CampaignWorkspaceShell
      activeItem="Team"
    >
      <main className={styles.page}>
        <header
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
              Campaign people and access
            </span>

            <h1>Team</h1>

            <p>
              Manage campaign members,
              invitations, roles, access,
              departments, and volunteer
              seats from one secure
              workspace.
            </p>

            <small
              className={
                styles.updated
              }
            >
              <span />

              {demoMode
                ? "Local preview data"
                : updatedAt
                  ? `Updated ${formatDateTime(updatedAt)}`
                  : "Ready"}
            </small>
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
              disabled={loading}
            >
              <RefreshCw
                size={18}
              />
              Refresh
            </button>

            <button
              className={
                styles.primaryButton
              }
              type="button"
              onClick={() => {
                setInvitationForm(
                  EMPTY_INVITATION_FORM,
                );
                setFormError("");
                setInvitationEditorOpen(
                  true,
                );
              }}
              disabled={
                !canManageInvitations
              }
            >
              <UserPlus size={18} />
              Invite member
            </button>
          </div>
        </header>

        {pageError && (
          <section
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
                Team access needs
                attention
              </strong>

              <p>{pageError}</p>
            </div>
          </section>
        )}

        {workspaceNotice && (
          <section
            className={
              styles.noticeBanner
            }
            role="status"
          >
            <Check size={18} />

            <span>
              {workspaceNotice}
            </span>

            <button
              type="button"
              onClick={() =>
                setWorkspaceNotice(
                  "",
                )
              }
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </section>
        )}

        {!leadershipAccess && (
          <section
            className={
              styles.restrictedBanner
            }
          >
            <ShieldCheck
              size={22}
            />

            <div>
              <strong>
                Leadership access is
                required
              </strong>

              <p>
                Your current campaign
                role cannot change
                workspace member access.
              </p>
            </div>
          </section>
        )}

        <section
          className={
            styles.summaryGrid
          }
        >
          {summaryCards.map(
            ({
              key,
              label,
              value,
              caption,
              icon: Icon,
            }) => (
              <button
                key={key}
                className={
                  summaryFilter ===
                  key
                    ? styles
                        .summaryActive
                    : ""
                }
                type="button"
                onClick={() => {
                  setSummaryFilter(
                    key,
                  );
                  setActiveView(
                    "people",
                  );
                }}
              >
                <div>
                  <Icon size={21} />
                </div>

                <span>{label}</span>

                <strong>
                  {loading
                    ? "—"
                    : value}
                </strong>

                <p>{caption}</p>
              </button>
            ),
          )}
        </section>

        <section
          className={
            styles.workspacePanel
          }
        >
          <nav
            className={styles.tabs}
            aria-label="Team views"
          >
            {[
              [
                "people",
                "Campaign Team",
              ],
              [
                "invitations",
                `Invitations (${invitations.length})`,
              ],
              [
                "access",
                "Access Review",
              ],
            ].map(
              ([key, label]) => (
                <button
                  key={key}
                  className={
                    activeView === key
                      ? styles.activeTab
                      : ""
                  }
                  type="button"
                  onClick={() => {
                    setActiveView(
                      key,
                    );
                    setSearch("");
                    setRoleFilter(
                      "all",
                    );
                    setStatusFilter(
                      "all",
                    );
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          <div
            className={
              styles.toolbar
            }
          >
            <label
              className={
                styles.searchBox
              }
            >
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder={
                  activeView ===
                  "invitations"
                    ? "Search invitations…"
                    : "Search people, email or role…"
                }
              />
            </label>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value,
                )
              }
              aria-label="Filter role"
            >
              <option value="all">
                All roles
              </option>

              {roles.map(
                (role) => (
                  <option
                    key={role.key}
                    value={role.key}
                  >
                    {role.name}
                  </option>
                ),
              )}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              aria-label="Filter status"
            >
              <option value="all">
                All statuses
              </option>

              {activeView ===
              "invitations" ? (
                <>
                  <option value="pending">
                    Pending
                  </option>

                  <option value="accepted">
                    Accepted
                  </option>

                  <option value="expired">
                    Expired
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </>
              ) : (
                <>
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </>
              )}
            </select>

            <strong
              className={
                styles.resultCount
              }
            >
              {activeView ===
              "invitations"
                ? `${filteredInvitations.length} invitation${
                    filteredInvitations.length ===
                    1
                      ? ""
                      : "s"
                  }`
                : `${filteredMembers.length} member${
                    filteredMembers.length ===
                    1
                      ? ""
                      : "s"
                  }`}
            </strong>
          </div>

          {loading ? (
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
                Loading campaign team…
              </strong>
            </div>
          ) : activeView ===
            "invitations" ? (
            <div
              className={
                styles.tableWrap
              }
            >
              <table
                className={
                  styles.teamTable
                }
              >
                <thead>
                  <tr>
                    <th>Invitation</th>
                    <th>Role</th>
                    <th>Assignment</th>
                    <th>Sent by</th>
                    <th>Last sent</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvitations.map(
                    (invitation) => {
                      const status =
                        invitationStatus(
                          invitation,
                        );

                      const department =
                        departmentMap.get(
                          invitation
                            .department_id,
                        );

                      const team =
                        teamMap.get(
                          invitation
                            .campaign_team_id,
                        );

                      const details =
                        invitationDetails(
                          invitation,
                        );

                      return (
                        <tr
                          key={
                            invitation.id
                          }
                        >
                          <td>
                            <div
                              className={
                                styles
                                  .personCell
                              }
                            >
                              <span
                                className={
                                  styles
                                    .inviteAvatar
                                }
                              >
                                <Mail
                                  size={
                                    17
                                  }
                                />
                              </span>

                              <div>
                                <strong>
                                  {
                                    invitation.email
                                  }
                                </strong>

                                <small>
                                  {invitation
                                    .display_title ||
                                    "Campaign member"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            {roleMap.get(
                              invitation
                                .role_key,
                            )?.name ||
                              formatLabel(
                                invitation
                                  .role_key,
                              )}
                          </td>

                          <td>
                            <strong>
                              {team?.name ||
                                department?.name ||
                                "Campaign-wide"}
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {
                                details
                                  .invitedBy
                              }
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {formatDateTime(
                                details
                                  .lastSentAt,
                              )}
                            </strong>

                            <small
                              className={
                                styles
                                  .cellSubtext
                              }
                            >
                              Sent{" "}
                              {
                                details
                                  .sendCount
                              }{" "}
                              time
                              {details
                                .sendCount ===
                              1
                                ? ""
                                : "s"}
                            </small>
                          </td>

                          <td>
                            {formatDate(
                              invitation
                                .expires_at,
                            )}

                            {invitationExpiresSoon(
                              invitation,
                            ) && (
                              <small
                                className={
                                  styles
                                    .expiryWarning
                                }
                              >
                                Expires soon
                              </small>
                            )}
                          </td>

                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                styles[
                                  `status${formatLabel(
                                    status,
                                  ).replaceAll(
                                    " ",
                                    "",
                                  )}`
                                ] || ""
                              }`}
                            >
                              {formatLabel(
                                status,
                              )}
                            </span>
                          </td>

                          <td>
                            {status ===
                            "pending" ? (
                              demoMode ? (
                                <div
                                  className={
                                    styles
                                      .inviteActions
                                  }
                                >
                                  <button
                                    className={
                                      styles
                                        .compactAction
                                    }
                                    type="button"
                                    onClick={() =>
                                      resendInvite(
                                        invitation,
                                      )
                                    }
                                  >
                                    <Send
                                      size={
                                        14
                                      }
                                    />
                                    Resend
                                  </button>

                                  <button
                                    className={
                                      styles
                                        .compactAction
                                    }
                                    type="button"
                                    onClick={() =>
                                      copyInviteLink(
                                        invitation,
                                      )
                                    }
                                  >
                                    <Copy
                                      size={
                                        14
                                      }
                                    />
                                    Copy link
                                  </button>

                                  <button
                                    className={
                                      styles
                                        .rowAction
                                    }
                                    type="button"
                                    onClick={() =>
                                      cancelInvite(
                                        invitation,
                                      )
                                    }
                                    disabled={
                                      saving ||
                                      !canManageInvitations
                                    }
                                  >
                                    <Ban
                                      size={
                                        14
                                      }
                                    />
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className={
                                    styles
                                      .compactAction
                                  }
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      "/team/invitations",
                                    )
                                  }
                                >
                                  Open manager
                                  <ChevronRight
                                    size={
                                      14
                                    }
                                  />
                                </button>
                              )
                            ) : (
                              <span
                                className={
                                  styles
                                    .mutedAction
                                }
                              >
                                No action
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>

              {!filteredInvitations.length && (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <Mail size={27} />

                  <strong>
                    No invitations match
                  </strong>

                  <p>
                    Adjust the search,
                    role, or status
                    filters.
                  </p>
                </div>
              )}
            </div>
          ) : activeView ===
            "access" ? (
            <div
              className={
                styles.accessReview
              }
            >
              <section
                className={
                  styles.accessMetrics
                }
              >
                <article>
                  <span>
                    <Crown size={20} />
                  </span>

                  <div>
                    <strong>
                      {
                        privilegedMembers
                          .length
                      }
                    </strong>

                    <p>
                      Privileged leadership
                      seats
                    </p>
                  </div>
                </article>

                <article>
                  <span>
                    <ShieldOff
                      size={20}
                    />
                  </span>

                  <div>
                    <strong>
                      {
                        inactiveMembers
                          .length
                      }
                    </strong>

                    <p>
                      Inactive accounts to
                      review
                    </p>
                  </div>
                </article>

                <article>
                  <span>
                    <Clock3 size={20} />
                  </span>

                  <div>
                    <strong>
                      {
                        expiringInvitations
                          .length
                      }
                    </strong>

                    <p>
                      Invitations expiring
                      within 48 hours
                    </p>
                  </div>
                </article>
              </section>

              <section
                className={
                  styles.reviewColumns
                }
              >
                <article
                  className={
                    styles.reviewCard
                  }
                >
                  <header>
                    <div>
                      <Crown size={18} />

                      <h3>
                        Privileged access
                      </h3>
                    </div>

                    <span>
                      {
                        privilegedMembers
                          .length
                      }
                    </span>
                  </header>

                  <p>
                    Candidate and campaign
                    leadership seats with
                    elevated authority.
                  </p>

                  <div
                    className={
                      styles.reviewList
                    }
                  >
                    {privilegedMembers.map(
                      (member) => (
                        <button
                          key={
                            member
                              .membershipId
                          }
                          type="button"
                          onClick={() =>
                            openMember(
                              member,
                            )
                          }
                        >
                          <span
                            className={
                              styles.avatar
                            }
                          >
                            {initials(
                              member
                                .fullName,
                            )}
                          </span>

                          <div>
                            <strong>
                              {
                                member
                                  .fullName
                              }
                            </strong>

                            <small>
                              {
                                member
                                  .displayTitle
                              }
                            </small>
                          </div>

                          <ChevronRight
                            size={17}
                          />
                        </button>
                      ),
                    )}
                  </div>
                </article>

                <article
                  className={
                    styles.reviewCard
                  }
                >
                  <header>
                    <div>
                      <ShieldOff
                        size={18}
                      />

                      <h3>
                        Inactive access
                      </h3>
                    </div>

                    <span>
                      {
                        inactiveMembers
                          .length
                      }
                    </span>
                  </header>

                  <p>
                    Suspended or inactive
                    accounts that should be
                    periodically reviewed.
                  </p>

                  <div
                    className={
                      styles.reviewList
                    }
                  >
                    {inactiveMembers.length ? (
                      inactiveMembers.map(
                        (member) => (
                          <button
                            key={
                              member
                                .membershipId
                            }
                            type="button"
                            onClick={() =>
                              openMember(
                                member,
                              )
                            }
                          >
                            <span
                              className={
                                styles.avatar
                              }
                            >
                              {initials(
                                member
                                  .fullName,
                              )}
                            </span>

                            <div>
                              <strong>
                                {
                                  member
                                    .fullName
                                }
                              </strong>

                              <small>
                                {
                                  member
                                    .displayTitle
                                }
                              </small>
                            </div>

                            <ChevronRight
                              size={
                                17
                              }
                            />
                          </button>
                        ),
                      )
                    ) : (
                      <div
                        className={
                          styles.reviewEmpty
                        }
                      >
                        <Check
                          size={18}
                        />
                        No inactive access
                      </div>
                    )}
                  </div>
                </article>

                <article
                  className={
                    styles.reviewCard
                  }
                >
                  <header>
                    <div>
                      <Clock3 size={18} />

                      <h3>
                        Expiring invitations
                      </h3>
                    </div>

                    <span>
                      {
                        expiringInvitations
                          .length
                      }
                    </span>
                  </header>

                  <p>
                    Pending invitations
                    expiring within the next
                    48 hours.
                  </p>

                  <div
                    className={
                      styles.reviewList
                    }
                  >
                    {expiringInvitations.length ? (
                      expiringInvitations.map(
                        (invitation) => (
                          <button
                            key={
                              invitation.id
                            }
                            type="button"
                            onClick={() =>
                              setActiveView(
                                "invitations",
                              )
                            }
                          >
                            <span
                              className={
                                styles
                                  .inviteAvatar
                              }
                            >
                              <Mail
                                size={16}
                              />
                            </span>

                            <div>
                              <strong>
                                {
                                  invitation
                                    .email
                                }
                              </strong>

                              <small>
                                Expires{" "}
                                {formatDate(
                                  invitation
                                    .expires_at,
                                )}
                              </small>
                            </div>

                            <ChevronRight
                              size={
                                17
                              }
                            />
                          </button>
                        ),
                      )
                    ) : (
                      <div
                        className={
                          styles.reviewEmpty
                        }
                      >
                        <Check
                          size={18}
                        />
                        No invitations
                        expiring soon
                      </div>
                    )}
                  </div>
                </article>
              </section>
            </div>
          ) : (
            <div
              className={
                styles.tableWrap
              }
            >
              <table
                className={
                  styles.teamTable
                }
              >
                <thead>
                  <tr>
                    <th>Campaign member</th>
                    <th>Role</th>
                    <th>Department / team</th>
                    <th>Seat</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map(
                    (member) => (
                      <tr
                        key={
                          member
                            .membershipId
                        }
                        tabIndex={0}
                        onClick={() =>
                          openMember(
                            member,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            openMember(
                              member,
                            );
                          }
                        }}
                      >
                        <td>
                          <div
                            className={
                              styles
                                .personCell
                            }
                          >
                            <span
                              className={
                                styles.avatar
                              }
                            >
                              {initials(
                                member
                                  .fullName,
                              )}
                            </span>

                            <div>
                              <strong>
                                {
                                  member
                                    .fullName
                                }
                              </strong>

                              <small>
                                {
                                  member
                                    .email
                                }
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {
                              member
                                .displayTitle
                            }
                          </strong>

                          <small
                            className={
                              styles
                                .cellSubtext
                            }
                          >
                            {roleMap.get(
                              member
                                .roleKey,
                            )?.name ||
                              formatLabel(
                                member
                                  .roleKey,
                              )}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {member
                              .departmentName ||
                              "Campaign-wide"}
                          </strong>

                          <small
                            className={
                              styles
                                .cellSubtext
                            }
                          >
                            {member
                              .teamName ||
                              "No team assigned"}
                          </small>
                        </td>

                        <td>
                          {formatLabel(
                            member
                              .seatType,
                          )}
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              member.status ===
                              "active"
                                ? styles.statusActive
                                : styles.statusInactive
                            }`}
                          >
                            {formatLabel(
                              member
                                .status,
                            )}
                          </span>
                        </td>

                        <td>
                          <ChevronRight
                            size={18}
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>

              {!filteredMembers.length && (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <UsersRound
                    size={27}
                  />

                  <strong>
                    No team members match
                  </strong>

                  <p>
                    Adjust the search,
                    role, status, or
                    summary filters.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeView ===
            "access" && (
            <footer
              className={
                styles.accessFooter
              }
            >
              <div>
                <KeyRound size={18} />

                <span>
                  Role and status changes
                  use the protected
                  campaign member access
                  workflow.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/team/access",
                  )
                }
              >
                Open legacy access
                manager
                <ChevronRight
                  size={16}
                />
              </button>
            </footer>
          )}
        </section>
      </main>

      {selectedMember && (
        <div
          className={
            styles.drawerLayer
          }
        >
          <button
            className={
              styles.drawerBackdrop
            }
            type="button"
            onClick={() =>
              setSelectedMemberId(
                "",
              )
            }
            aria-label="Close member details"
          />

          <aside
            className={`${styles.drawer} ${
              drawerExpanded
                ? styles.drawerExpanded
                : ""
            }`}
            aria-label="Campaign member details"
          >
            <header
              className={
                styles.drawerHeader
              }
            >
              <div
                className={
                  styles.drawerIdentity
                }
              >
                <span
                  className={
                    styles.drawerAvatar
                  }
                >
                  {initials(
                    selectedMember
                      .fullName,
                  )}
                </span>

                <div>
                  <span>
                    Campaign member
                  </span>

                  <h2>
                    {
                      selectedMember
                        .fullName
                    }
                  </h2>

                  <p>
                    {
                      selectedMember
                        .displayTitle
                    }
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.drawerControls
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setDrawerExpanded(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {drawerExpanded
                    ? "Restore"
                    : "Expand"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMemberId(
                      "",
                    )
                  }
                  aria-label="Close"
                >
                  <X size={19} />
                </button>
              </div>
            </header>

            <nav
              className={
                styles.drawerTabs
              }
            >
              {[
                [
                  "overview",
                  "Overview",
                ],
                [
                  "access",
                  "Access",
                ],
                [
                  "activity",
                  "Activity",
                ],
              ].map(
                ([key, label]) => (
                  <button
                    key={key}
                    className={
                      drawerTab === key
                        ? styles
                            .drawerTabActive
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setDrawerTab(
                        key,
                      )
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </nav>

            <div
              className={
                styles.drawerBody
              }
            >
              {drawerTab ===
                "overview" && (
                <>
                  <section
                    className={
                      styles
                        .memberSummary
                    }
                  >
                    <div>
                      <span>Status</span>

                      <strong>
                        {formatLabel(
                          selectedMember
                            .status,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Role</span>

                      <strong>
                        {
                          selectedMember
                            .displayTitle
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Department
                      </span>

                      <strong>
                        {selectedMember
                          .departmentName ||
                          "Campaign-wide"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Last activity
                      </span>

                      <strong>
                        {formatDateTime(
                          selectedMember
                            .lastActivityAt,
                        )}
                      </strong>
                    </div>
                  </section>

                  <section
                    className={
                      styles.detailCard
                    }
                  >
                    <header>
                      <div>
                        <Mail
                          size={17}
                        />
                        <h3>
                          Contact and
                          assignment
                        </h3>
                      </div>
                    </header>

                    <dl>
                      <div>
                        <dt>Email</dt>
                        <dd>
                          {
                            selectedMember
                              .email
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>Team</dt>
                        <dd>
                          {selectedMember
                            .teamName ||
                            "No team assigned"}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Dashboard
                        </dt>
                        <dd>
                          {formatLabel(
                            selectedMember
                              .dashboardType,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Seat type</dt>
                        <dd>
                          {formatLabel(
                            selectedMember
                              .seatType,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Joined</dt>
                        <dd>
                          {formatDate(
                            selectedMemberAudit
                              ?.joinedAt,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Invited by</dt>
                        <dd>
                          {selectedMemberAudit
                            ?.invitedBy ||
                            "Not recorded"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </>
              )}

              {drawerTab ===
                "access" && (
                <>
                  <section
                    className={
                      styles.detailCard
                    }
                  >
                    <header>
                      <div>
                        <ShieldCheck
                          size={17}
                        />

                        <h3>
                          Access posture
                        </h3>
                      </div>
                    </header>

                    <div
                      className={
                        styles
                          .permissionList
                      }
                    >
                      {(
                        selectedMember
                          .permissions ||
                        [
                          formatLabel(
                            selectedMember
                              .roleKey,
                          ),
                        ]
                      ).map(
                        (permission) => (
                          <span
                            key={
                              permission
                            }
                          >
                            <Check
                              size={
                                15
                              }
                            />
                            {permission}
                          </span>
                        ),
                      )}
                    </div>
                  </section>

                  <button
                    className={
                      styles
                        .drawerPrimaryAction
                    }
                    type="button"
                    onClick={() =>
                      openAccessEditor(
                        selectedMember,
                      )
                    }
                    disabled={
                      !canManageAccess
                    }
                  >
                    <UserCog
                      size={17}
                    />
                    Edit member access
                  </button>
                </>
              )}

              {drawerTab ===
                "activity" && (
                <section
                  className={
                    styles.activityList
                  }
                >
                  <article>
                    <span>
                      <Clock3
                        size={16}
                      />
                    </span>

                    <div>
                      <strong>
                        Last workspace
                        activity
                      </strong>

                      <p>
                        {formatDateTime(
                          selectedMember
                            .lastActivityAt,
                        )}
                      </p>
                    </div>
                  </article>

                  <article>
                    <span>
                      <UserPlus
                        size={16}
                      />
                    </span>

                    <div>
                      <strong>
                        Joined campaign
                        workspace
                      </strong>

                      <p>
                        {formatDateTime(
                          selectedMemberAudit
                            ?.joinedAt,
                        )}
                        {" · "}
                        Invited by{" "}
                        {selectedMemberAudit
                          ?.invitedBy ||
                          "Not recorded"}
                      </p>
                    </div>
                  </article>

                  <article>
                    <span>
                      <UserCog
                        size={16}
                      />
                    </span>

                    <div>
                      <strong>
                        Most recent access
                        change
                      </strong>

                      <p>
                        {formatDateTime(
                          selectedMemberAudit
                            ?.accessChangedAt,
                        )}
                        {" · "}
                        Changed by{" "}
                        {selectedMemberAudit
                          ?.accessChangedBy ||
                          "Not recorded"}
                      </p>
                    </div>
                  </article>

                  <article>
                    <span>
                      <ShieldCheck
                        size={16}
                      />
                    </span>

                    <div>
                      <strong>
                        Access currently{" "}
                        {
                          selectedMember
                            .status
                        }
                      </strong>

                      <p>
                        Role:{" "}
                        {
                          selectedMember
                            .displayTitle
                        }
                      </p>
                    </div>
                  </article>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

      {accessEditorOpen && (
        <div
          className={
            styles.modalLayer
          }
        >
          <button
            className={
              styles.modalBackdrop
            }
            type="button"
            onClick={() =>
              setAccessEditorOpen(
                false,
              )
            }
            aria-label="Close access editor"
          />

          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-editor-title"
          >
            <header>
              <div>
                <span>
                  Protected member access
                </span>

                <h2
                  id="access-editor-title"
                >
                  Edit member access
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAccessEditorOpen(
                    false,
                  )
                }
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={
                styles.modalForm
              }
              onSubmit={
                saveMemberAccess
              }
            >
              <div
                className={
                  styles.identityNotice
                }
              >
                <span
                  className={
                    styles.avatar
                  }
                >
                  {initials(
                    accessForm
                      .fullName,
                  )}
                </span>

                <div>
                  <strong>
                    {
                      accessForm
                        .fullName
                    }
                  </strong>

                  <small>
                    {
                      accessForm
                        .email
                    }
                  </small>
                </div>
              </div>

              <label>
                <span>
                  Campaign role
                </span>

                <select
                  value={
                    accessForm
                      .roleKey
                  }
                  onChange={(event) =>
                    setAccessForm(
                      (current) => ({
                        ...current,
                        roleKey:
                          event.target
                            .value,
                      }),
                    )
                  }
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
                  Display title
                </span>

                <input
                  value={
                    accessForm
                      .displayTitle
                  }
                  onChange={(event) =>
                    setAccessForm(
                      (current) => ({
                        ...current,
                        displayTitle:
                          event.target
                            .value,
                      }),
                    )
                  }
                  maxLength={120}
                />
              </label>

              <label>
                <span>
                  Workspace status
                </span>

                <select
                  value={
                    accessForm.status
                  }
                  onChange={(event) =>
                    setAccessForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value,
                      }),
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

              <div
                className={
                  styles.securityNotice
                }
              >
                <ShieldCheck
                  size={18}
                />

                <p>
                  Live changes use the
                  protected member-access
                  database function and
                  campaign authority
                  checks.
                </p>
              </div>

              {formError && (
                <p
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={16}
                  />
                  {formError}
                </p>
              )}

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setAccessEditorOpen(
                      false,
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={saving}
                >
                  <Check size={17} />
                  Save access
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {invitationEditorOpen && (
        <div
          className={
            styles.modalLayer
          }
        >
          <button
            className={
              styles.modalBackdrop
            }
            type="button"
            onClick={() =>
              setInvitationEditorOpen(
                false,
              )
            }
            aria-label="Close invitation form"
          />

          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="invitation-editor-title"
          >
            <header>
              <div>
                <span>
                  Secure campaign access
                </span>

                <h2
                  id="invitation-editor-title"
                >
                  Invite campaign member
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setInvitationEditorOpen(
                    false,
                  )
                }
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={
                styles.modalForm
              }
              onSubmit={
                createInvitation
              }
            >
              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Email address
                </span>

                <input
                  type="email"
                  value={
                    invitationForm
                      .email
                  }
                  onChange={(event) =>
                    setInvitationForm(
                      (current) => ({
                        ...current,
                        email:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="person@example.com"
                  autoFocus
                />
              </label>

              <label>
                <span>
                  Campaign role
                </span>

                <select
                  value={
                    invitationForm
                      .roleKey
                  }
                  onChange={(event) =>
                    setInvitationForm(
                      (current) => ({
                        ...current,
                        roleKey:
                          event.target
                            .value,
                      }),
                    )
                  }
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
                  Display title
                </span>

                <input
                  value={
                    invitationForm
                      .displayTitle
                  }
                  onChange={(event) =>
                    setInvitationForm(
                      (current) => ({
                        ...current,
                        displayTitle:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Field Organizer"
                />
              </label>

              <label>
                <span>
                  Department
                </span>

                <select
                  value={
                    invitationForm
                      .departmentId
                  }
                  onChange={(event) =>
                    setInvitationForm(
                      (current) => ({
                        ...current,
                        departmentId:
                          event.target
                            .value,
                        campaignTeamId:
                          "",
                      }),
                    )
                  }
                >
                  <option value="">
                    Campaign-wide
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
              </label>

              <label>
                <span>
                  Campaign team
                </span>

                <select
                  value={
                    invitationForm
                      .campaignTeamId
                  }
                  onChange={(event) =>
                    setInvitationForm(
                      (current) => ({
                        ...current,
                        campaignTeamId:
                          event.target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    No team assigned
                  </option>

                  {campaignTeams
                    .filter(
                      (team) =>
                        !invitationForm
                          .departmentId ||
                        team
                          .department_id ===
                          invitationForm
                            .departmentId,
                    )
                    .map(
                      (team) => (
                        <option
                          key={
                            team.id
                          }
                          value={
                            team.id
                          }
                        >
                          {team.name}
                        </option>
                      ),
                    )}
                </select>
              </label>

              <div
                className={
                  styles.securityNotice
                }
              >
                <KeyRound
                  size={18}
                />

                <p>
                  Live invitations require
                  the database permission,
                  create a secure token,
                  and use the protected
                  invitation-email
                  function.
                </p>
              </div>

              {formError && (
                <p
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={16}
                  />
                  {formError}
                </p>
              )}

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setInvitationEditorOpen(
                      false,
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={saving}
                >
                  <UserPlus
                    size={17}
                  />
                  Create invitation
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
