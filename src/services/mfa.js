import { supabase } from "../lib/supabase";

export const LEADERSHIP_MFA_ROLES =
  new Set([
    "campaign_owner",
    "workspace_owner",
    "owner",

    "candidate",

    "campaign_administrator",
    "administrator",

    "campaign_consultant",
    "consultant",

    "campaign_manager",
    "manager",
  ]);

const LEADERSHIP_MFA_DASHBOARDS =
  new Set([
    "command",
    "candidate",
    "department",
    "captain",
  ]);

function normalizeMembershipSignal(
  value,
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function normalizeCode(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}

function getMfaErrorMessage(
  error,
  fallback,
) {
  const message =
    String(
      error?.message || "",
    );

  const lowerMessage =
    message.toLowerCase();

  if (
    lowerMessage.includes(
      "invalid totp",
    ) ||
    lowerMessage.includes(
      "invalid code",
    ) ||
    lowerMessage.includes(
      "verification code",
    )
  ) {
    return "The six-digit authenticator code is incorrect or has expired.";
  }

  if (
    lowerMessage.includes(
      "factor",
    ) &&
    lowerMessage.includes(
      "not found",
    )
  ) {
    return "This authenticator setup is no longer available. Start the setup again.";
  }

  return (
    message ||
    fallback
  );
}

export function membershipsRequireMfa(
  memberships = [],
) {
  return memberships.some(
    (membership) => {
      const roleKey =
        normalizeMembershipSignal(
          membership?.roleKey ||
            membership?.role_key,
        );

      const dashboardType =
        normalizeMembershipSignal(
          membership?.dashboardType ||
            membership?.dashboard_type,
        );

      return (
        LEADERSHIP_MFA_ROLES.has(
          roleKey,
        ) ||
        LEADERSHIP_MFA_DASHBOARDS.has(
          dashboardType,
        )
      );
    },
  );
}

export async function getMfaState() {
  const [
    assuranceResult,
    factorsResult,
  ] =
    await Promise.all([
      supabase.auth.mfa
        .getAuthenticatorAssuranceLevel(),

      supabase.auth.mfa
        .listFactors(),
    ]);

  if (assuranceResult.error) {
    throw new Error(
      getMfaErrorMessage(
        assuranceResult.error,
        "Campaign Seat could not verify the session security level.",
      ),
    );
  }

  if (factorsResult.error) {
    throw new Error(
      getMfaErrorMessage(
        factorsResult.error,
        "Campaign Seat could not load the account's authenticator factors.",
      ),
    );
  }

  const totpFactors =
    factorsResult.data?.totp ||
    [];

  const verifiedFactors =
    totpFactors.filter(
      (factor) =>
        factor.status ===
        "verified",
    );

  const unverifiedFactors =
    totpFactors.filter(
      (factor) =>
        factor.status !==
        "verified",
    );

  const currentLevel =
    assuranceResult.data
      ?.currentLevel ||
    "aal1";

  const nextLevel =
    assuranceResult.data
      ?.nextLevel ||
    currentLevel;

  return {
    currentLevel,
    nextLevel,

    verifiedFactors,
    unverifiedFactors,

    isAal2:
      currentLevel ===
      "aal2",

    requiresChallenge:
      currentLevel ===
        "aal1" &&
      nextLevel ===
        "aal2",
  };
}

export async function beginTotpEnrollment({
  friendlyName = "Campaign Seat Authenticator",
} = {}) {
  const state =
    await getMfaState();

  for (
    const factor of
    state.unverifiedFactors
  ) {
    const {
      error:
        cleanupError,
    } =
      await supabase.auth.mfa
        .unenroll({
          factorId:
            factor.id,
        });

    if (cleanupError) {
      console.warn(
        "An unfinished MFA factor could not be removed:",
        cleanupError,
      );
    }
  }

  const {
    data,
    error,
  } =
    await supabase.auth.mfa
      .enroll({
        factorType:
          "totp",

        friendlyName:
          String(
            friendlyName ||
              "Campaign Seat Authenticator",
          ).slice(
            0,
            100,
          ),
      });

  if (
    error ||
    !data?.id ||
    !data?.totp
  ) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "Campaign Seat could not begin authenticator setup.",
      ),
    );
  }

  return {
    factorId:
      data.id,

    friendlyName:
      data.friendly_name ||
      friendlyName,

    qrCode:
      data.totp.qr_code,

    secret:
      data.totp.secret,

    uri:
      data.totp.uri,
  };
}

export async function verifyTotpFactor({
  factorId,
  code,
}) {
  const normalizedCode =
    normalizeCode(code);

  if (
    !factorId ||
    !/^\d{6}$/.test(
      normalizedCode,
    )
  ) {
    throw new Error(
      "Enter the complete six-digit code from your authenticator app.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth.mfa
      .challengeAndVerify({
        factorId,
        code:
          normalizedCode,
      });

  if (error) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "Campaign Seat could not verify the authenticator code.",
      ),
    );
  }

  const state =
    await getMfaState();

  if (!state.isAal2) {
    throw new Error(
      "The code was accepted, but the secure session was not upgraded. Try again.",
    );
  }

  return {
    data,
    state,
  };
}

export async function cancelTotpEnrollment(
  factorId,
) {
  if (!factorId) {
    return;
  }

  const {
    error,
  } =
    await supabase.auth.mfa
      .unenroll({
        factorId,
      });

  if (error) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "The unfinished authenticator setup could not be cancelled.",
      ),
    );
  }
}

export async function removeMfaFactor(
  factorId,
) {
  if (!factorId) {
    throw new Error(
      "Choose an authenticator factor to remove.",
    );
  }

  const {
    error,
  } =
    await supabase.auth.mfa
      .unenroll({
        factorId,
      });

  if (error) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "The authenticator factor could not be removed.",
      ),
    );
  }

  await supabase.auth
    .refreshSession();

  return getMfaState();
}
