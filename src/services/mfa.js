import { supabase } from "../lib/supabase";

export const PHONE_MFA_ENABLED =
  String(
    import.meta.env
      .VITE_PHONE_MFA_ENABLED ||
      "",
  )
    .trim()
    .toLowerCase() ===
  "true";

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
    return "The six-digit security code is incorrect or has expired.";
  }

  if (
    lowerMessage.includes(
      "factor",
    ) &&
    lowerMessage.includes(
      "not found",
    )
  ) {
    return "This security-factor setup is no longer available. Start the setup again.";
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
        "Campaign Seat could not load the account's security factors.",
      ),
    );
  }

  const totpFactors =
    factorsResult.data?.totp ||
    [];

  const phoneFactors =
    factorsResult.data?.phone ||
    [];

  const verifiedTotpFactors =
    totpFactors.filter(
      (factor) =>
        factor.status ===
        "verified",
    );

  const verifiedPhoneFactors =
    phoneFactors.filter(
      (factor) =>
        factor.status ===
        "verified",
    );

  const unverifiedTotpFactors =
    totpFactors.filter(
      (factor) =>
        factor.status !==
        "verified",
    );

  const unverifiedPhoneFactors =
    phoneFactors.filter(
      (factor) =>
        factor.status !==
        "verified",
    );

  const verifiedFactors = [
    ...verifiedPhoneFactors.map(
      (factor) => ({
        ...factor,
        factorType:
          "phone",
      }),
    ),

    ...verifiedTotpFactors.map(
      (factor) => ({
        ...factor,
        factorType:
          "totp",
      }),
    ),
  ];

  const unverifiedFactors = [
    ...unverifiedPhoneFactors.map(
      (factor) => ({
        ...factor,
        factorType:
          "phone",
      }),
    ),

    ...unverifiedTotpFactors.map(
      (factor) => ({
        ...factor,
        factorType:
          "totp",
      }),
    ),
  ];

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

    totpFactors,
    phoneFactors,

    verifiedTotpFactors,
    verifiedPhoneFactors,

    unverifiedTotpFactors,
    unverifiedPhoneFactors,

    verifiedFactors,
    unverifiedFactors,

    hasVerifiedTotp:
      verifiedTotpFactors
        .length > 0,

    hasVerifiedPhone:
      verifiedPhoneFactors
        .length > 0,

    phoneMfaAvailable:
      PHONE_MFA_ENABLED,

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
    state.unverifiedTotpFactors
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


function normalizePhoneNumber(
  value,
) {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return "";
  }

  const compact =
    raw.replace(
      /[^\d+]/g,
      "",
    );

  if (
    compact.startsWith(
      "+",
    )
  ) {
    return compact;
  }

  const digits =
    compact.replace(
      /\D/g,
      "",
    );

  if (
    digits.length ===
    10
  ) {
    return `+1${digits}`;
  }

  return digits
    ? `+${digits}`
    : "";
}

export function maskPhoneNumber(
  value,
) {
  const digits =
    String(value || "")
      .replace(
        /\D/g,
        "",
      );

  if (digits.length < 4) {
    return "Phone";
  }

  return `••• ••• ${digits.slice(-4)}`;
}

export async function beginPhoneEnrollment({
  phone,
  friendlyName =
    "Campaign Seat Text Message",
} = {}) {
  if (!PHONE_MFA_ENABLED) {
    throw new Error(
      "Text-message verification is not enabled for this Campaign Seat environment yet.",
    );
  }

  const normalizedPhone =
    normalizePhoneNumber(
      phone,
    );

  if (
    !/^\+\d{10,15}$/.test(
      normalizedPhone,
    )
  ) {
    throw new Error(
      "Enter a valid mobile phone number including area code.",
    );
  }

  const state =
    await getMfaState();

  for (
    const factor of
    state.unverifiedPhoneFactors
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
        "An unfinished phone MFA factor could not be removed:",
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
          "phone",

        phone:
          normalizedPhone,

        friendlyName:
          String(
            friendlyName ||
              "Campaign Seat Text Message",
          ).slice(
            0,
            100,
          ),
      });

  if (
    error ||
    !data?.id
  ) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "Campaign Seat could not begin text-message verification.",
      ),
    );
  }

  const challenge =
    await challengePhoneFactor({
      factorId:
        data.id,
    });

  return {
    factorId:
      data.id,

    challengeId:
      challenge.challengeId,

    phone:
      data.phone ||
      normalizedPhone,

    maskedPhone:
      maskPhoneNumber(
        data.phone ||
        normalizedPhone,
      ),

    friendlyName:
      data.friendly_name ||
      friendlyName,
  };
}

export async function challengePhoneFactor({
  factorId,
} = {}) {
  if (!PHONE_MFA_ENABLED) {
    throw new Error(
      "Text-message verification is not enabled for this Campaign Seat environment yet.",
    );
  }

  if (!factorId) {
    throw new Error(
      "Choose a phone security factor.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth.mfa
      .challenge({
        factorId,
      });

  if (
    error ||
    !data?.id
  ) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "Campaign Seat could not send the verification text.",
      ),
    );
  }

  return {
    challengeId:
      data.id,
  };
}

export async function verifyPhoneFactor({
  factorId,
  challengeId,
  code,
}) {
  const normalizedCode =
    normalizeCode(code);

  if (
    !factorId ||
    !challengeId ||
    !/^\d{6}$/.test(
      normalizedCode,
    )
  ) {
    throw new Error(
      "Enter the complete six-digit code from the text message.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth.mfa
      .verify({
        factorId,
        challengeId,
        code:
          normalizedCode,
      });

  if (error) {
    throw new Error(
      getMfaErrorMessage(
        error,
        "Campaign Seat could not verify the text-message code.",
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

export async function cancelPhoneEnrollment(
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
        "The unfinished text-message setup could not be cancelled.",
      ),
    );
  }
}

export async function removeMfaFactor(
  factorId,
) {
  if (!factorId) {
    throw new Error(
      "Choose a verification method to remove.",
    );
  }

  const state =
    await getMfaState();

  const verifiedTarget =
    state.verifiedFactors.find(
      (factor) =>
        factor.id ===
        factorId,
    );

  if (
    verifiedTarget &&
    !state.isAal2
  ) {
    throw new Error(
      "Verify your identity with a current two-step method before removing a verified method.",
    );
  }

  if (
    verifiedTarget &&
    state.verifiedFactors.length <=
      1
  ) {
    throw new Error(
      "The final verified two-step method cannot be removed from a protected leadership account. Add and verify another method first.",
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
        "The verification method could not be removed.",
      ),
    );
  }

  const {
    error:
      refreshError,
  } =
    await supabase.auth
      .refreshSession();

  if (refreshError) {
    throw new Error(
      getMfaErrorMessage(
        refreshError,
        "The verification method was removed, but Campaign Seat could not refresh the secure session.",
      ),
    );
  }

  return getMfaState();
}
