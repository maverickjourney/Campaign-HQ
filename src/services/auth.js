import { supabase } from "../lib/supabase";
import {
  clearLocalCampaignSession,
  getAccessMode,
  saveAuthenticatedSession,
} from "../utils/campaignSession";

async function loadProfile(authUser) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error("Campaign profile could not be loaded.");
  }

  if (!data) {
    throw new Error(
      "No Campaign HQ profile is connected to this account.",
    );
  }

  return data;
}

async function loadMembership(authUser) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, status")
    .eq("user_id", authUser.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Campaign access could not be verified.");
  }

  if (!data) {
    throw new Error(
      "This account does not have access to an active campaign workspace.",
    );
  }

  return data;
}

async function loadWorkspace(workspaceId) {
  const { data, error } = await supabase
    .from("workspaces")
    .select(
      "id, name, description, location, election_date, status",
    )
    .eq("id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("The campaign workspace could not be loaded.");
  }

  if (!data) {
    throw new Error(
      "The assigned campaign workspace is not currently active.",
    );
  }

  return data;
}

export async function loadCampaignAccess(
  authUser,
  requestedPortalMode = "client",
) {
  const profile = await loadProfile(authUser);
  const membership = await loadMembership(authUser);
  const workspace = await loadWorkspace(
    membership.workspace_id,
  );

  const portalMode =
    membership.role === "admin" &&
    requestedPortalMode === "admin"
      ? "admin"
      : "client";

  return {
    authUser,
    profile,
    membership,
    workspace,
    portalMode,
  };
}

export async function signInToCampaign({
  email,
  password,
  portalMode,
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (error || !data.user) {
    throw new Error("The email or password is incorrect.");
  }

  try {
    const access = await loadCampaignAccess(
      data.user,
      portalMode,
    );

    if (
      portalMode === "admin" &&
      access.membership.role !== "admin"
    ) {
      await supabase.auth.signOut();
      clearLocalCampaignSession();

      throw new Error(
        "This account does not have Administrator access. Choose Client Login.",
      );
    }

    return saveAuthenticatedSession(access);
  } catch (accessError) {
    await supabase.auth.signOut();
    clearLocalCampaignSession();
    throw accessError;
  }
}

export async function restoreCampaignSession() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    clearLocalCampaignSession();
    return null;
  }

  try {
    const requestedPortalMode = getAccessMode();

    const access = await loadCampaignAccess(
      user,
      requestedPortalMode,
    );

    return saveAuthenticatedSession(access);
  } catch (accessError) {
    console.error(
      "Campaign session restoration failed:",
      accessError,
    );

    await supabase.auth.signOut();
    clearLocalCampaignSession();

    return null;
  }
}
