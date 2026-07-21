import { supabase } from "../lib/supabase";

import {
  getMfaState,
  membershipsRequireMfa,
} from "./mfa";
import {
  clearLocalCampaignSession,
  saveAuthenticatedSession,
} from "../utils/campaignSession";

async function loadProfile(authUser) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Campaign profile could not be loaded.",
    );
  }

  return data;
}

async function loadMemberships(authUser) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
        id,
        workspace_id,
        user_id,
        role_key,
        display_title,
        dashboard_type,
        seat_type,
        membership_state,
        status
      `,
    )
    .eq("user_id", authUser.id)
    .eq("status", "active")
    .eq("membership_state", "active");

  if (error) {
    console.error(error);

    throw new Error(
      "Campaign memberships could not be loaded.",
    );
  }

  return data || [];
}

async function buildMembershipAccess(
  memberships,
) {
  if (!memberships.length) {
    return [];
  }

  const workspaceIds = [
    ...new Set(
      memberships.map(
        (membership) =>
          membership.workspace_id,
      ),
    ),
  ];

  const roleKeys = [
    ...new Set(
      memberships.map(
        (membership) =>
          membership.role_key,
      ),
    ),
  ];

  const membershipIds =
    memberships.map(
      (membership) => membership.id,
    );

  const [
    workspacesResult,
    rolesResult,
    permissionsResult,
    overridesResult,
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select(
        `
          id,
          name,
          description,
          location,
          election_date,
          political_party,
          status
        `,
      )
      .in("id", workspaceIds),

    supabase
      .from("campaign_roles")
      .select(
        `
          key,
          name,
          dashboard_type,
          seat_type
        `,
      )
      .in("key", roleKeys),

    supabase
      .from(
        "campaign_role_permissions",
      )
      .select(
        "role_key, permission_key",
      )
      .in("role_key", roleKeys),

    supabase
      .from(
        "member_permission_overrides",
      )
      .select(
        `
          workspace_member_id,
          permission_key,
          allowed
        `,
      )
      .in(
        "workspace_member_id",
        membershipIds,
      ),
  ]);

  const failed = [
    workspacesResult,
    rolesResult,
    permissionsResult,
    overridesResult,
  ].find((result) => result.error);

  if (failed?.error) {
    console.error(failed.error);

    throw new Error(
      "Campaign roles and permissions could not be loaded.",
    );
  }

  const workspaceMap = new Map(
    (workspacesResult.data || []).map(
      (workspace) => [
        workspace.id,
        workspace,
      ],
    ),
  );

  const roleMap = new Map(
    (rolesResult.data || []).map(
      (role) => [role.key, role],
    ),
  );

  const permissionsByRole = new Map();

  (permissionsResult.data || []).forEach(
    (permission) => {
      if (
        !permissionsByRole.has(
          permission.role_key,
        )
      ) {
        permissionsByRole.set(
          permission.role_key,
          new Set(),
        );
      }

      permissionsByRole
        .get(permission.role_key)
        .add(permission.permission_key);
    },
  );

  const overridesByMember = new Map();

  (overridesResult.data || []).forEach(
    (override) => {
      if (
        !overridesByMember.has(
          override.workspace_member_id,
        )
      ) {
        overridesByMember.set(
          override.workspace_member_id,
          [],
        );
      }

      overridesByMember
        .get(override.workspace_member_id)
        .push(override);
    },
  );

  return memberships
    .map((membership) => {
      const workspace =
        workspaceMap.get(
          membership.workspace_id,
        );

      const role =
        roleMap.get(
          membership.role_key,
        );

      if (!workspace || !role) {
        return null;
      }

      const permissions = new Set(
        permissionsByRole.get(
          membership.role_key,
        ) || [],
      );

      (
        overridesByMember.get(
          membership.id,
        ) || []
      ).forEach((override) => {
        if (override.allowed) {
          permissions.add(
            override.permission_key,
          );
        } else {
          permissions.delete(
            override.permission_key,
          );
        }
      });

      return {
        membershipId: membership.id,
        workspaceId:
          membership.workspace_id,
        userId: membership.user_id,
        roleKey: membership.role_key,
        roleName: role.name,
        displayTitle:
          membership.display_title ||
          role.name,
        dashboardType:
          membership.dashboard_type ||
          role.dashboard_type,
        seatType:
          membership.seat_type ||
          role.seat_type,
        membershipState:
          membership.membership_state,
        permissions: [
          ...permissions,
        ].sort(),
        workspace,
      };
    })
    .filter(Boolean);
}

export async function loadCampaignAccess(
  authUser,
) {
  const [profile, rawMemberships] =
    await Promise.all([
      loadProfile(authUser),
      loadMemberships(authUser),
    ]);

  const memberships =
    await buildMembershipAccess(
      rawMemberships,
    );

  return {
    authUser,
    profile,
    memberships,
  };
}


async function resolveCampaignMfaRequirement(
  access,
) {
  const mfaRequired =
    membershipsRequireMfa(
      access.memberships,
    );

  if (!mfaRequired) {
    return {
      status:
        "ready",

      mfaRequired:
        false,

      mfaState:
        null,

      access,
    };
  }

  const mfaState =
    await getMfaState();

  if (mfaState.isAal2) {
    return {
      status:
        "ready",

      mfaRequired:
        true,

      mfaState,
      access,
    };
  }

  if (
    mfaState
      .verifiedFactors
      .length
  ) {
    return {
      status:
        "mfa-challenge",

      mfaRequired:
        true,

      mfaState,
      access,
    };
  }

  return {
    status:
      "mfa-setup",

    mfaRequired:
      true,

    mfaState,
    access,
  };
}

async function finalizeCampaignAuthentication(
  access,
) {
  const decision =
    await resolveCampaignMfaRequirement(
      access,
    );

  if (
    decision.status !==
    "ready"
  ) {
    /*
     * Keep the Supabase aal1 session alive so the
     * user can enroll or verify MFA, but remove
     * Campaign Seat's local workspace session.
     */
    clearLocalCampaignSession();

    return decision;
  }

  const campaignSession =
    saveAuthenticatedSession(
      access,
    );

  return {
    ...decision,
    campaignSession,
  };
}

export async function signInToCampaign({
  email,
  password,
  captchaToken,
}) {
  const normalizedEmail =
    email.trim().toLowerCase();

  const normalizedCaptchaToken =
    String(
      captchaToken ||
      "",
    ).trim();

  if (!normalizedCaptchaToken) {
    throw new Error(
      "Wait for the browser security check to finish.",
    );
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,

      options: {
        captchaToken:
          normalizedCaptchaToken,
      },
    });

  if (error) {
    const message =
      String(
        error.message ||
        "",
      ).toLowerCase();

    if (
      message.includes(
        "captcha",
      ) ||
      message.includes(
        "challenge",
      )
    ) {
      throw new Error(
        "The browser security check expired. Complete it again and retry.",
      );
    }

    throw new Error(
      "The email or password is incorrect.",
    );
  }

  if (!data.user) {
    throw new Error(
      "The email or password is incorrect.",
    );
  }

  try {
    const access =
      await loadCampaignAccess(
        data.user,
      );

    if (!access.memberships.length) {
      throw new Error(
        "This account does not have access to an active campaign.",
      );
    }

    return finalizeCampaignAuthentication(
      access,
    );
  } catch (accessError) {
    await supabase.auth.signOut();
    clearLocalCampaignSession();

    throw accessError;
  }
}


export async function requestCampaignPasswordReset({
  email,
  captchaToken,
}) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Enter the email address used for your Campaign Seat account.",
    );
  }

  const normalizedCaptchaToken =
    String(
      captchaToken ||
      "",
    ).trim();

  if (!normalizedCaptchaToken) {
    throw new Error(
      "Wait for the browser security check to finish.",
    );
  }

  const redirectTo =
    new URL(
      "/reset-password",
      window.location.origin,
    ).toString();

  const {
    error,
  } =
    await supabase.auth
      .resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo,

          captchaToken:
            normalizedCaptchaToken,
        },
      );

  if (error) {
    const message =
      String(
        error.message || "",
      ).toLowerCase();

    if (
      message.includes(
        "captcha",
      ) ||
      message.includes(
        "challenge",
      )
    ) {
      throw new Error(
        "The browser security check expired. Complete it again and retry.",
      );
    }

    if (
      message.includes(
        "rate limit",
      ) ||
      message.includes(
        "too many",
      )
    ) {
      throw new Error(
        "Too many recovery requests were submitted. Wait a few minutes before trying again.",
      );
    }

    throw new Error(
      "Campaign Seat could not send the recovery email. Check your connection and try again.",
    );
  }

  return {
    email:
      normalizedEmail,
    redirectTo,
  };
}

export async function establishPasswordRecoverySession() {
  const currentUrl =
    new URL(
      window.location.href,
    );

  const queryError =
    currentUrl.searchParams.get(
      "error_description",
    );

  const hashParameters =
    new URLSearchParams(
      currentUrl.hash.replace(
        /^#/,
        "",
      ),
    );

  const hashError =
    hashParameters.get(
      "error_description",
    );

  if (
    queryError ||
    hashError
  ) {
    throw new Error(
      decodeURIComponent(
        queryError ||
          hashError,
      ),
    );
  }

  const authorizationCode =
    currentUrl.searchParams.get(
      "code",
    );

  const accessToken =
    hashParameters.get(
      "access_token",
    );

  const refreshToken =
    hashParameters.get(
      "refresh_token",
    );

  let recoveryError = null;

  if (authorizationCode) {
    const {
      error,
    } =
      await supabase.auth
        .exchangeCodeForSession(
          authorizationCode,
        );

    recoveryError =
      error;
  } else if (
    accessToken &&
    refreshToken
  ) {
    const {
      error,
    } =
      await supabase.auth
        .setSession({
          access_token:
            accessToken,

          refresh_token:
            refreshToken,
        });

    recoveryError =
      error;
  }

  const {
    data: {
      session,
    },
    error:
      sessionError,
  } =
    await supabase.auth
      .getSession();

  if (
    sessionError ||
    !session
  ) {
    console.error(
      "Password recovery session could not be established:",
      recoveryError ||
        sessionError,
    );

    throw new Error(
      "This password-reset link is invalid or has expired. Request a new recovery email.",
    );
  }

  if (
    currentUrl.search ||
    currentUrl.hash
  ) {
    window.history.replaceState(
      {},
      document.title,
      currentUrl.pathname,
    );
  }

  return session;
}

export async function updateCampaignPassword({
  password,
}) {
  const normalizedPassword =
    String(password || "");

  if (
    normalizedPassword.length <
    12
  ) {
    throw new Error(
      "The new password must contain at least 12 characters.",
    );
  }

  if (
    !/[a-z]/.test(
      normalizedPassword,
    ) ||
    !/[A-Z]/.test(
      normalizedPassword,
    ) ||
    !/\d/.test(
      normalizedPassword,
    ) ||
    !/[^A-Za-z0-9\s]/.test(
      normalizedPassword,
    )
  ) {
    throw new Error(
      "The new password must contain uppercase and lowercase letters, a number and a symbol.",
    );
  }

  const {
    error,
  } =
    await supabase.auth
      .updateUser({
        password:
          normalizedPassword,
      });

  if (error) {
    throw new Error(
      error.message ||
        "The new password could not be saved.",
    );
  }

  await supabase.auth
    .signOut();

  clearLocalCampaignSession();

  return true;
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
    const access =
      await loadCampaignAccess(user);

    if (!access.memberships.length) {
      clearLocalCampaignSession();
      return null;
    }

    return finalizeCampaignAuthentication(
      access,
    );
  } catch (accessError) {
    console.error(
      "Campaign session restoration failed:",
      accessError,
    );

    clearLocalCampaignSession();
    return null;
  }
}
