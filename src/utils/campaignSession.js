import { supabase } from "../lib/supabase";

const USER_KEY = "campaignHQ.user";
const MODE_KEY = "campaignHQ.mode";
const WORKSPACE_KEY = "campaignHQ.workspace";

export const CAMPAIGN_WORKSPACE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Elizabeth Accomando",
  description: "Palm Beach County Commission, District 6",
  location: "Palm Beach County, Florida",
  electionDate: "August 18, 2026",
  electionDateRaw: "2026-08-18",
};

function formatElectionDate(dateValue) {
  if (!dateValue) {
    return CAMPAIGN_WORKSPACE.electionDate;
  }

  const [year, month, day] = dateValue
    .split("-")
    .map((part) => Number(part));

  if (!year || !month || !day) {
    return CAMPAIGN_WORKSPACE.electionDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function saveAuthenticatedSession({
  authUser,
  profile,
  membership,
  workspace,
  portalMode,
}) {
  const safePortalMode =
    membership.role === "admin" && portalMode === "admin"
      ? "admin"
      : "client";

  const user = {
    id: authUser.id,
    name: profile.full_name || "Campaign User",
    email: profile.email || authUser.email || "",
    accessMode: safePortalMode,
    assignedRole: membership.role,
    role:
      safePortalMode === "admin"
        ? "Campaign Administrator"
        : "Campaign Client",
  };

  const campaignWorkspace = {
    id: workspace.id,
    name: workspace.name,
    description:
      workspace.description ||
      CAMPAIGN_WORKSPACE.description,
    location:
      workspace.location ||
      CAMPAIGN_WORKSPACE.location,
    electionDate: formatElectionDate(workspace.election_date),
    electionDateRaw:
      workspace.election_date ||
      CAMPAIGN_WORKSPACE.electionDateRaw,
    status: workspace.status,
  };

  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(MODE_KEY, safePortalMode);
  sessionStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify(campaignWorkspace),
  );

  return {
    user,
    workspace: campaignWorkspace,
    membership,
  };
}

export function getCurrentUser() {
  try {
    const savedUser = JSON.parse(sessionStorage.getItem(USER_KEY));

    if (savedUser?.id && savedUser?.name && savedUser?.email) {
      return savedUser;
    }
  } catch {
    sessionStorage.removeItem(USER_KEY);
  }

  return {
    id: "",
    name: "Campaign User",
    email: "",
    accessMode: "client",
    assignedRole: "client",
    role: "Campaign Client",
  };
}

export function getCurrentWorkspace() {
  try {
    const savedWorkspace = JSON.parse(
      sessionStorage.getItem(WORKSPACE_KEY),
    );

    if (savedWorkspace?.id && savedWorkspace?.name) {
      return savedWorkspace;
    }
  } catch {
    sessionStorage.removeItem(WORKSPACE_KEY);
  }

  return CAMPAIGN_WORKSPACE;
}

export function getAccessMode() {
  return sessionStorage.getItem(MODE_KEY) === "admin"
    ? "admin"
    : "client";
}

export function getRoleLabel(mode = getAccessMode()) {
  return mode === "admin"
    ? "Campaign Administrator"
    : "Campaign Client";
}

export function getUserInitials(name = "") {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!nameParts.length) {
    return "CU";
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return `${nameParts[0][0]}${
    nameParts[nameParts.length - 1][0]
  }`.toUpperCase();
}

export function saveWorkspace(workspace = getCurrentWorkspace()) {
  sessionStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify(workspace),
  );
}

export function clearLocalCampaignSession() {
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(WORKSPACE_KEY);
}

export async function clearCampaignSession() {
  clearLocalCampaignSession();

  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Supabase sign-out failed:", error);
  }
}
