import {
  supabase,
} from "../lib/supabase";


function normalizeEmail(
  value,
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


async function sha256Hex(
  value,
) {
  if (
    !window.crypto?.subtle
  ) {
    throw new Error(
      "This browser cannot perform the required secure onboarding check.",
    );
  }

  const bytes =
    new TextEncoder()
      .encode(
        String(value || ""),
      );

  const digest =
    await window.crypto.subtle
      .digest(
        "SHA-256",
        bytes,
      );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}


export async function provisionApprovedSeatProposal(
  proposalId,
  roleKey = "candidate",
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "provision_approved_seat_proposal",
      {
        target_proposal_id:
          proposalId,

        target_role_key:
          roleKey,

        expires_in_hours:
          72,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Client onboarding could not be provisioned.",
    );
  }

  return data?.[0] || null;
}


export async function loadSeatOnboardingInvitation(
  token,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_seat_onboarding_invitation_by_token",
      {
        target_token:
          token,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      "This onboarding invitation could not be opened.",
    );
  }

  return data;
}


export async function getCurrentSeatUser() {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  return user || null;
}


export async function createSeatOnboardingAccount({
  token,
  invitation,
  fullName,
  password,
  captchaToken,
}) {
  const currentUser =
    await getCurrentSeatUser();

  if (currentUser) {
    if (
      normalizeEmail(
        currentUser.email,
      ) !==
      normalizeEmail(
        invitation.email,
      )
    ) {
      return {
        status:
          "session_conflict",

        currentEmail:
          currentUser.email,
      };
    }

    return {
      status:
        "ready",
    };
  }


  const invitationHash =
    await sha256Hex(
      token,
    );


  const {
    data,
    error,
  } =
    await supabase.auth
      .signUp({
        email:
          normalizeEmail(
            invitation.email,
          ),

        password,

        options: {
          captchaToken,

          emailRedirectTo:
            `${window.location.origin}/onboarding/continue`,

          data: {
            full_name:
              String(
                fullName ||
                invitation.full_name ||
                "",
              ).trim(),

            seat_onboarding_invitation_hash:
              invitationHash,
          },
        },
      });


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Your secure Seat account could not be created.",
    );
  }


  return {
    status:
      data.session
        ? "ready"
        : "confirmation_required",

    user:
      data.user || null,

    session:
      data.session || null,
  };
}


export async function loadMySeatOnboarding() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_seat_onboarding",
    );

  if (error) {
    console.error(error);

    throw new Error(
      "Your onboarding workspace could not be loaded.",
    );
  }

  return data;
}


export async function resendSeatVerificationEmail(
  email,
  captchaToken,
) {
  const normalizedEmail =
    normalizeEmail(
      email,
    );

  if (!normalizedEmail) {
    throw new Error(
      "Verification email is missing.",
    );
  }

  const {
    error,
  } =
    await supabase.auth
      .resend({
        type:
          "signup",

        email:
          normalizedEmail,

        options: {
          captchaToken,

          emailRedirectTo:
            `${window.location.origin}/onboarding/continue`,
        },
      });

  if (error) {
    console.error(error);

    const message =
      String(
        error.message ||
        "",
      );

    if (
      /rate limit/i.test(
        message,
      )
    ) {
      throw new Error(
        "A verification email was requested recently. Wait a minute before trying again.",
      );
    }

    throw new Error(
      message ||
        "The verification email could not be resent.",
    );
  }

  return {
    ok: true,
  };
}


export async function signInSeatOnboarding({
  email,
  password,
  captchaToken,
}) {
  const normalizedEmail =
    normalizeEmail(
      email,
    );

  if (
    !normalizedEmail ||
    !password
  ) {
    throw new Error(
      "Enter your email and password.",
    );
  }

  if (!captchaToken) {
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
          captchaToken,
        },
      });

  if (error) {
    console.error(error);

    const message =
      String(
        error.message ||
        "",
      );

    if (
      /email.*confirm|confirm.*email/i.test(
        message,
      )
    ) {
      return {
        status:
          "confirmation_required",

        email:
          normalizedEmail,
      };
    }

    if (
      /invalid login credentials/i.test(
        message,
      )
    ) {
      throw new Error(
        "The email or password is incorrect.",
      );
    }

    if (
      /captcha|challenge/i.test(
        message,
      )
    ) {
      throw new Error(
        "The browser security check expired. Complete it again and retry.",
      );
    }

    throw new Error(
      message ||
        "Seat onboarding sign-in could not be completed.",
    );
  }

  if (
    !data.user ||
    !data.session
  ) {
    throw new Error(
      "A secure onboarding session could not be opened.",
    );
  }

  return {
    status:
      "ready",

    user:
      data.user,

    session:
      data.session,
  };
}


export async function saveMySeatCampaignProfile(
  profile,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_my_seat_campaign_profile",
      {
        profile,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Profile could not be saved.",
    );
  }

  return data;
}


export async function completeMySeatSecurityStep() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "complete_my_seat_security_step",
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Security onboarding could not be completed.",
    );
  }

  return data;
}
