import { supabase } from "../lib/supabase";
import { getMfaState } from "./mfa";

const PLATFORM_ADMIN_ROLES = [
  "platform_owner",
  "platform_admin",
];

async function hasPlatformAdminRole() {
  const {
    data,
    error,
  } = await supabase.rpc(
    "has_platform_role",
    {
      required_roles:
        PLATFORM_ADMIN_ROLES,
    },
  );

  if (error) {
    console.error(
      "Platform role verification failed:",
      error,
    );

    throw new Error(
      "Seat Platform could not verify administrative authority.",
    );
  }

  return data === true;
}

export async function getPlatformAdminSession() {
  const {
    data: {
      user,
    },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      mfaState: null,
    };
  }

  const authorized =
    await hasPlatformAdminRole();

  if (!authorized) {
    return {
      authenticated: true,
      authorized: false,
      user,
      mfaState: null,
    };
  }

  const mfaState =
    await getMfaState();

  return {
    authenticated: true,
    authorized: true,
    user,
    mfaState,
  };
}

export async function signInToPlatformAdmin({
  email,
  password,
  captchaToken,
}) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const normalizedCaptcha =
    String(captchaToken || "")
      .trim();

  if (
    !normalizedEmail ||
    !password
  ) {
    throw new Error(
      "Enter your Admin email and password.",
    );
  }

  if (!normalizedCaptcha) {
    throw new Error(
      "Wait for the browser security check to finish.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth
      .signInWithPassword({
        email:
          normalizedEmail,

        password,

        options: {
          captchaToken:
            normalizedCaptcha,
        },
      });

  if (
    error ||
    !data.user
  ) {
    throw new Error(
      "The email or password is incorrect.",
    );
  }

  try {
    const authorized =
      await hasPlatformAdminRole();

    if (!authorized) {
      await supabase.auth.signOut();

      throw new Error(
        "This account is not authorized for Seat Platform Admin.",
      );
    }

    const mfaState =
      await getMfaState();

    if (
      mfaState.isAal2 &&
      mfaState.hasVerifiedTotp
    ) {
      return {
        status: "ready",
        user: data.user,
        mfaState,
      };
    }

    if (
      !mfaState.hasVerifiedTotp
    ) {
      return {
        status: "mfa-setup",
        user: data.user,
        mfaState,
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
        user: data.user,
        mfaState,
      };
    }

    return {
      status: "mfa-setup",
      user: data.user,
      mfaState,
    };
  } catch (accessError) {
    if (
      accessError?.message ===
      "This account is not authorized for Seat Platform Admin."
    ) {
      throw accessError;
    }

    await supabase.auth.signOut();

    throw accessError;
  }
}

export async function signOutPlatformAdmin() {
  await supabase.auth.signOut();
}
