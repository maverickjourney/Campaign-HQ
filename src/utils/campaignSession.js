import { supabase } from "../lib/supabase";

const USER_KEY = "campaignHQ.user";
const MODE_KEY = "campaignHQ.mode";
const WORKSPACE_KEY = "campaignHQ.workspace";
const MEMBERSHIPS_KEY = "campaignHQ.memberships";
const CURRENT_MEMBERSHIP_KEY =
  "campaignHQ.currentMembership";

/*
 * Campaign profile, workspace, role and permission data must not be
 * persisted in browser storage. Protected routes restore this data
 * from Supabase whenever the application is opened or refreshed.
 */
const campaignMemory = new Map();

const campaignMemoryStore = {
  getItem(key) {
    return campaignMemory.has(key)
      ? campaignMemory.get(key)
      : null;
  },

  setItem(key, value) {
    campaignMemory.set(
      key,
      String(value),
    );
  },

  removeItem(key) {
    campaignMemory.delete(key);
  },
};

export const CAMPAIGN_WORKSPACE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Elizabeth Accomando",
  description:
    "Palm Beach County Commission, District 6",
  location: "Palm Beach County, Florida",
  electionDate: "August 18, 2026",
  electionDateRaw: "2026-08-18",
  politicalParty: "republican",
  status: "active",
};

function readSessionValue(key, fallback = null) {
  try {
    const value = campaignMemoryStore.getItem(key);

    return value ? JSON.parse(value) : fallback;
  } catch {
    campaignMemoryStore.removeItem(key);
    return fallback;
  }
}

function formatElectionDate(value) {
  if (!value) {
    return CAMPAIGN_WORKSPACE.electionDate;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return CAMPAIGN_WORKSPACE.electionDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function normalizeWorkspace(workspace = {}) {
  const electionDateRaw =
    workspace.election_date ||
    workspace.electionDateRaw ||
    CAMPAIGN_WORKSPACE.electionDateRaw;

  return {
    id: workspace.id || CAMPAIGN_WORKSPACE.id,
    name:
      workspace.name ||
      CAMPAIGN_WORKSPACE.name,
    description:
      workspace.description ||
      CAMPAIGN_WORKSPACE.description,
    location:
      workspace.location ||
      CAMPAIGN_WORKSPACE.location,
    electionDate:
      workspace.electionDate ||
      formatElectionDate(electionDateRaw),
    electionDateRaw,
    politicalParty:
      workspace.politicalParty ||
      workspace.political_party ||
      CAMPAIGN_WORKSPACE.politicalParty,
    status:
      workspace.status ||
      CAMPAIGN_WORKSPACE.status,
  };
}

function normalizeMembership(membership = {}) {
  return {
    membershipId:
      membership.membershipId ||
      membership.id ||
      "",

    workspaceId:
      membership.workspaceId ||
      membership.workspace_id ||
      membership.workspace?.id ||
      "",

    userId:
      membership.userId ||
      membership.user_id ||
      "",

    roleKey:
      membership.roleKey ||
      membership.role_key ||
      "volunteer",

    roleName:
      membership.roleName ||
      "Campaign Member",

    displayTitle:
      membership.displayTitle ||
      membership.display_title ||
      membership.roleName ||
      "Campaign Member",

    dashboardType:
      membership.dashboardType ||
      membership.dashboard_type ||
      "volunteer",

    seatType:
      membership.seatType ||
      membership.seat_type ||
      "volunteer",

    membershipState:
      membership.membershipState ||
      membership.membership_state ||
      "active",

    permissions: Array.isArray(
      membership.permissions,
    )
      ? membership.permissions
      : [],

    workspace: normalizeWorkspace(
      membership.workspace,
    ),
  };
}

function getCompatibilityMode(dashboardType) {
  return dashboardType === "command"
    ? "admin"
    : "client";
}

export function saveAuthenticatedSession({
  authUser,
  profile,
  memberships = [],
}) {
  const previousMembership =
    getCurrentMembership();

  const normalizedMemberships =
    memberships.map(normalizeMembership);

  campaignMemoryStore.setItem(
    USER_KEY,
    JSON.stringify({
      id: authUser.id,
      name:
        profile.full_name ||
        "Campaign User",
      email:
        profile.email ||
        authUser.email ||
        "",
      role: "Campaign Member",
      roleName: "Campaign Member",
      roleKey: "",
      accessMode: "client",
      dashboardType: "",
      seatType: "",
      membershipId: "",
      workspaceId: "",
      permissions: [],
    }),
  );

  campaignMemoryStore.setItem(
    MEMBERSHIPS_KEY,
    JSON.stringify(normalizedMemberships),
  );

  const preservedMembership =
    normalizedMemberships.find(
      (membership) =>
        membership.membershipId ===
          previousMembership?.membershipId ||
        membership.workspaceId ===
          previousMembership?.workspaceId,
    );

  if (preservedMembership) {
    selectCampaignWorkspace(
      preservedMembership,
    );
  } else {
    clearSelectedCampaign();
  }

  return {
    user: getCurrentUser(),
    memberships: normalizedMemberships,
  };
}

export function selectCampaignWorkspace(
  membership,
) {
  const normalized =
    normalizeMembership(membership);

  const accessMode =
    getCompatibilityMode(
      normalized.dashboardType,
    );

  const account =
    readSessionValue(USER_KEY, {
      id: normalized.userId,
      name: "Campaign User",
      email: "",
    });

  campaignMemoryStore.setItem(
    USER_KEY,
    JSON.stringify({
      ...account,
      role:
        normalized.displayTitle ||
        normalized.roleName,
      roleName: normalized.roleName,
      roleKey: normalized.roleKey,
      assignedRole: normalized.roleKey,
      accessMode,
      dashboardType:
        normalized.dashboardType,
      seatType: normalized.seatType,
      membershipId:
        normalized.membershipId,
      workspaceId:
        normalized.workspaceId,
      permissions:
        normalized.permissions,
    }),
  );

  campaignMemoryStore.setItem(
    CURRENT_MEMBERSHIP_KEY,
    JSON.stringify(normalized),
  );

  campaignMemoryStore.setItem(
    WORKSPACE_KEY,
    JSON.stringify(normalized.workspace),
  );

  campaignMemoryStore.setItem(
    MODE_KEY,
    accessMode,
  );

  return normalized;
}

export function clearSelectedCampaign() {
  const user =
    readSessionValue(USER_KEY, null);

  if (user) {
    campaignMemoryStore.setItem(
      USER_KEY,
      JSON.stringify({
        id: user.id,
        name:
          user.name ||
          "Campaign User",
        email:
          user.email ||
          "",
        role: "Campaign Member",
        roleName: "Campaign Member",
        roleKey: "",
        accessMode: "client",
        dashboardType: "",
        seatType: "",
        membershipId: "",
        workspaceId: "",
        permissions: [],
      }),
    );
  }

  campaignMemoryStore.removeItem(MODE_KEY);
  campaignMemoryStore.removeItem(WORKSPACE_KEY);
  campaignMemoryStore.removeItem(
    CURRENT_MEMBERSHIP_KEY,
  );
}

export function getCurrentUser() {
  return (
    readSessionValue(USER_KEY) || {
      id: "",
      name: "Campaign User",
      email: "",
      role: "Campaign Member",
      roleName: "Campaign Member",
      roleKey: "",
      accessMode: "client",
      dashboardType: "",
      seatType: "",
      membershipId: "",
      workspaceId: "",
      permissions: [],
    }
  );
}

export function saveCurrentUserProfile({
  name,
  email,
}) {
  const current =
    getCurrentUser();

  const updated = {
    ...current,
    name:
      String(
        name ||
        current.name ||
        "Campaign User",
      ).trim() ||
      "Campaign User",
    email:
      email ??
      current.email ??
      "",
  };

  campaignMemoryStore.setItem(
    USER_KEY,
    JSON.stringify(
      updated,
    ),
  );

  return updated;
}

export function getCampaignMemberships() {
  return readSessionValue(
    MEMBERSHIPS_KEY,
    [],
  );
}

export function getCurrentMembership() {
  return readSessionValue(
    CURRENT_MEMBERSHIP_KEY,
    null,
  );
}

export function getCurrentWorkspace() {
  return (
    readSessionValue(
      WORKSPACE_KEY,
      null,
    ) || CAMPAIGN_WORKSPACE
  );
}

export function getAccessMode() {
  return campaignMemoryStore.getItem(MODE_KEY) ===
    "admin"
    ? "admin"
    : "client";
}

export function getDashboardType() {
  return (
    getCurrentMembership()?.dashboardType ||
    getCurrentUser().dashboardType ||
    ""
  );
}

// CAMPAIGN HQ WORKSPACE ROLE LABEL SYNC
export function getRoleLabel() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const storedMembership =
    getCurrentMembership();

  const campaignMemberships =
    getCampaignMemberships();

  const workspaceMembership =
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

  return (
    workspaceMembership?.displayTitle ||
    workspaceMembership?.roleName ||
    workspaceMembership?.roleLabel ||
    workspaceMembership?.display_title ||
    user.displayTitle ||
    user.roleName ||
    user.role ||
    "Campaign Member"
  );
}

// CAMPAIGN HQ ACTIVE MEMBERSHIP PERMISSION FIX
export function hasCampaignPermission(
  permissionKey,
) {
  if (!permissionKey) {
    return false;
  }

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const storedMembership =
    getCurrentMembership();

  const campaignMembership =
    getCampaignMemberships().find(
      (membership) =>
        membership.workspaceId ===
          workspace.id ||
        membership.workspace?.id ===
          workspace.id,
    );

  const activeMembership =
    (
      storedMembership?.workspaceId ===
        workspace.id ||
      storedMembership?.workspace?.id ===
        workspace.id
    )
      ? storedMembership
      : campaignMembership ||
        storedMembership;

  const membershipPermissions =
    Array.isArray(
      activeMembership?.permissions,
    )
      ? activeMembership.permissions
      : [];

  const userPermissions =
    Array.isArray(
      user.permissions,
    )
      ? user.permissions
      : [];

  return (
    membershipPermissions.includes(
      permissionKey,
    ) ||
    userPermissions.includes(
      permissionKey,
    )
  );
}

export function getCampaignExperience() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const storedMembership =
    getCurrentMembership();

  const campaignMembership =
    getCampaignMemberships().find(
      (membership) =>
        membership.workspaceId ===
          workspace.id ||
        membership.workspace?.id ===
          workspace.id,
    );

  const membership =
    (
      storedMembership?.workspaceId ===
        workspace.id ||
      storedMembership?.workspace?.id ===
        workspace.id
    )
      ? storedMembership
      : campaignMembership ||
        storedMembership;

  const roleSignals = [
    membership?.roleKey,
    membership?.assignedRole,
    membership?.roleName,
    membership?.displayTitle,
    membership?.roleLabel,
    membership?.role_key,
    membership?.display_title,
    user.roleKey,
    user.assignedRole,
    user.roleName,
    user.displayTitle,
    user.role,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .trim()
        .toLowerCase()
        .replaceAll("-", "_")
        .replaceAll(" ", "_"),
    );

  const hasRoleSignal =
    (...signals) =>
      signals.some((signal) =>
        roleSignals.some(
          (value) =>
            value === signal ||
            value.includes(signal),
        ),
      );

  if (
    hasRoleSignal(
      "campaign_owner",
      "workspace_owner",
      "campaign_administrator",
      "administrator",
    )
  ) {
    return {
      key: "owner",
      name: "Workspace Owner",
      dashboardTitle:
        "Owner command center",
      badge:
        "Campaign leadership",
      description:
        "Control campaign operations, access, deadlines and communication from one secure workspace.",
      showLeadership: true,
    };
  }

  if (
    hasRoleSignal(
      "candidate",
    )
  ) {
    return {
      key: "candidate",
      name: "Candidate",
      dashboardTitle:
        "Candidate briefing",
      badge:
        "Candidate command view",
      description:
        "Review the schedule, approvals, priority decisions and campaign progress that need your attention.",
      showLeadership: true,
    };
  }

  if (
    hasRoleSignal(
      "campaign_manager",
      "campaign_consultant",
      "manager",
      "consultant",
    ) ||
    [
      "command",
      "department",
      "captain",
    ].includes(
      membership?.dashboardType ||
      membership?.dashboard_type ||
      user.dashboardType,
    )
  ) {
    return {
      key: "manager",
      name: "Campaign Manager",
      dashboardTitle:
        "Campaign manager dashboard",
      badge:
        "Campaign operations",
      description:
        "Assign work, coordinate people, monitor deadlines and keep the campaign moving.",
      showLeadership: true,
    };
  }

  return {
    key: "volunteer",
    name: "Volunteer",
    dashboardTitle:
      "Volunteer dashboard",
    badge:
      "Your campaign workspace",
    description:
      "See your assignments, upcoming events, deadlines and messages in one simple place.",
    showLeadership: false,
  };
}

export function getDashboardRoute(
  dashboardType = getDashboardType(),
) {
  if (
    dashboardType === "department" ||
    dashboardType === "captain"
  ) {
    return "/tasks";
  }

  return "/dashboard";
}

export function getUserInitials(name = "") {
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

export function saveWorkspace(
  workspace = getCurrentWorkspace(),
) {
  const normalized =
    normalizeWorkspace(
      workspace,
    );

  campaignMemoryStore.setItem(
    WORKSPACE_KEY,
    JSON.stringify(
      normalized,
    ),
  );

  const currentMembership =
    getCurrentMembership();

  if (
    currentMembership &&
    (
      currentMembership.workspaceId ===
        normalized.id ||
      currentMembership.workspace?.id ===
        normalized.id
    )
  ) {
    campaignMemoryStore.setItem(
      CURRENT_MEMBERSHIP_KEY,
      JSON.stringify({
        ...currentMembership,
        workspace:
          normalized,
      }),
    );
  }

  const memberships =
    getCampaignMemberships();

  const updatedMemberships =
    memberships.map(
      (membership) => {
        if (
          membership.workspaceId ===
            normalized.id ||
          membership.workspace?.id ===
            normalized.id
        ) {
          return {
            ...membership,
            workspace:
              normalized,
          };
        }

        return membership;
      },
    );

  campaignMemoryStore.setItem(
    MEMBERSHIPS_KEY,
    JSON.stringify(
      updatedMemberships,
    ),
  );

  return normalized;
}

export function clearLocalCampaignSession() {
  campaignMemoryStore.removeItem(USER_KEY);
  campaignMemoryStore.removeItem(MODE_KEY);
  campaignMemoryStore.removeItem(WORKSPACE_KEY);
  campaignMemoryStore.removeItem(MEMBERSHIPS_KEY);
  campaignMemoryStore.removeItem(
    CURRENT_MEMBERSHIP_KEY,
  );
}

export async function clearCampaignSession() {
  clearLocalCampaignSession();

  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error(
      "Supabase sign-out failed:",
      error,
    );
  }
}
