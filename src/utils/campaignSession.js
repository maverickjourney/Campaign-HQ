const USER_KEY = "campaignHQ.user";
const MODE_KEY = "campaignHQ.mode";
const WORKSPACE_KEY = "campaignHQ.workspace";

export const CAMPAIGN_WORKSPACE = {
  id: "elizabeth-accomando-2026",
  name: "Elizabeth Accomando",
  description: "Wellington Council Campaign",
  location: "Wellington, Florida",
  electionDate: "August 18, 2026",
};

function formatNameFromEmail(email) {
  const emailName = email.split("@")[0] || "campaign user";

  return emailName
    .split(/[._-\s]+/)
    .filter(Boolean)
    .map((part) => {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function saveLoginSession(email, mode) {
  const accessMode = mode === "admin" ? "admin" : "client";

  const user = {
    name: formatNameFromEmail(email),
    email: email.trim().toLowerCase(),
    accessMode,
    role:
      accessMode === "admin"
        ? "Campaign Administrator"
        : "Campaign Client",
  };

  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(MODE_KEY, accessMode);

  return user;
}

export function getCurrentUser() {
  try {
    const savedUser = JSON.parse(sessionStorage.getItem(USER_KEY));

    if (savedUser?.name && savedUser?.email) {
      return savedUser;
    }
  } catch {
    sessionStorage.removeItem(USER_KEY);
  }

  return {
    name: "Campaign Client",
    email: "client@campaign.com",
    accessMode: "client",
    role: "Campaign Client",
  };
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

export function getUserInitials(name) {
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

export function saveWorkspace() {
  sessionStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify(CAMPAIGN_WORKSPACE),
  );
}

export function clearCampaignSession() {
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(WORKSPACE_KEY);
}
