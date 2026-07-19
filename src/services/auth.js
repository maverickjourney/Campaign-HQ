import { supabase } from "../lib/supabase";
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

export async function signInToCampaign({
  email,
  password,
}) {
  const normalizedEmail =
    email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (error || !data.user) {
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

    return saveAuthenticatedSession(
      access,
    );
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
    const access =
      await loadCampaignAccess(user);

    if (!access.memberships.length) {
      clearLocalCampaignSession();
      return null;
    }

    saveAuthenticatedSession(access);

    return access;
  } catch (accessError) {
    console.error(
      "Campaign session restoration failed:",
      accessError,
    );

    clearLocalCampaignSession();
    return null;
  }
}
