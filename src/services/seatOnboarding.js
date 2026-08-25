import {
  supabase,
} from "../lib/supabase";

import {
  campaignAppUrl,
} from "../config/seatUrls";


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
            campaignAppUrl("/onboarding/continue"),

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
            campaignAppUrl("/onboarding/continue"),
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


export async function saveMySeatCandidatePhotoPath(
  storagePath,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_my_seat_candidate_photo_path",
      {
        target_candidate_photo_path:
          String(
            storagePath || "",
          ).trim() ||
          null,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Candidate photo could not be saved to onboarding.",
    );
  }

  return data;
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


  const candidatePhotoPath =
    profile
      ?.campaign_type ===
      "candidate_campaign"
      ? String(
          profile
            ?.candidate_photo_path ||
          "",
        ).trim()
      : "";


  await saveMySeatCandidatePhotoPath(
    candidatePhotoPath,
  );


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


export async function loadMySeatBillingSetup() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_seat_billing_setup",
    );

  if (error) {
    console.error(error);

    throw new Error(
      "Billing setup could not be loaded.",
    );
  }

  return data;
}


export async function saveMySeatBillingSetup(
  billingData,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_my_seat_billing_setup",
      {
        billing_data:
          billingData,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Billing setup could not be saved.",
    );
  }

  return data;
}


export async function loadMySeatIntegrationSetup() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_seat_integration_setup",
    );

  if (error) {
    console.error(error);

    throw new Error(
      "Integration setup could not be loaded.",
    );
  }

  return data;
}


export async function saveMySeatIntegrationSetup(
  selectedIntegrationKeys,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_my_seat_integration_setup",
      {
        selected_integration_keys:
          selectedIntegrationKeys,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Integration setup could not be saved.",
    );
  }

  return data;
}


export async function loadMySeatTeamSetup() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_seat_team_setup",
    );

  if (error) {
    console.error(error);

    throw new Error(
      "Team setup could not be loaded.",
    );
  }

  return data;
}


export async function saveMySeatTeamSetup(
  teamMembers,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_my_seat_team_setup",
      {
        team_members:
          teamMembers,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Team setup could not be saved.",
    );
  }

  return data;
}


export async function reopenMySeatOnboardingStep(
  stepKey,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "reopen_my_seat_onboarding_step",
      {
        requested_step_key:
          stepKey,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "That onboarding step could not be reopened.",
    );
  }

  return data;
}


export async function loadMySeatOnboardingReview() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_seat_onboarding_review",
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Your onboarding review could not be loaded.",
    );
  }

  return data;
}


export async function completeMySeatOnboardingReview() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "complete_my_seat_onboarding_review",
      {
        details_confirmed:
          true,
      },
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Your onboarding review could not be confirmed.",
    );
  }

  return data;
}


export async function loadMyCampaignSeatActivationStatus() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_campaign_seat_activation_status",
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat Activation status could not be loaded.",
    );
  }

  return data;
}


export async function activateMyCampaignSeat() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "activate_my_campaign_seat",
    );

  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat could not be activated.",
    );
  }


  let providerSync = {
    attempted:
      false,

    success:
      false,

    status:
      "not_started",

    calendars:
      [],

    contacts:
      [],

    error:
      "",
  };


  const activatedWorkspaceId =
    data?.workspace_id ||
    null;


  if (activatedWorkspaceId) {
    providerSync = {
      ...providerSync,

      attempted:
        true,

      status:
        "running",
    };


    try {
      const {
        data:
          syncData,
        error:
          syncError,
      } =
        await supabase
          .functions
          .invoke(
            "nylas-workspace-data-sync",
            {
              body: {
                workspaceId:
                  activatedWorkspaceId,
              },
            },
          );


      if (syncError) {
        throw syncError;
      }


      providerSync = {
        attempted:
          true,

        success:
          syncData?.success ===
          true,

        status:
          syncData
            ?.syncStatus ||
          (
            syncData?.success
              ? "complete"
              : "failed"
          ),

        jobId:
          syncData
            ?.syncJobId ||
          null,

        calendars:
          syncData
            ?.calendars ||
          [],

        contacts:
          syncData
            ?.contacts ||
          [],

        error:
          syncData?.success ===
          true
            ? ""
            : "The Campaign workspace was activated, but one or more provider data sources require a sync retry.",
      };

    } catch (
      syncFailure
    ) {
      console.error(
        "Initial Campaign Seat provider synchronization failed:",
        syncFailure,
      );


      providerSync = {
        attempted:
          true,

        success:
          false,

        status:
          "retry_required",

        jobId:
          null,

        calendars:
          [],

        contacts:
          [],

        error:
          "The Campaign workspace is active, but its first provider Calendar/Contacts sync needs to be retried.",
      };
    }
  }


  const invitationDelivery = [];


  for (
    const invitation of
      data?.team_invitations ||
      []
  ) {
    try {
      const {
        data: emailData,
        error: emailError,
      } =
        await supabase
          .functions
          .invoke(
            "send-workspace-invitation",
            {
              body: {
                invitationId:
                  invitation.invitation_id,

                invitationToken:
                  invitation.invitation_token,
              },
            },
          );

      if (emailError) {
        throw emailError;
      }

      if (
        emailData?.success !==
        true
      ) {
        throw new Error(
          emailData?.error ||
            "Invitation email delivery was not confirmed.",
        );
      }

      invitationDelivery.push({
        email:
          invitation.email,

        sent:
          true,

        emailId:
          emailData.emailId ||
          null,

        error:
          "",
      });
    } catch (
      emailFailure
    ) {
      console.error(
        "Launch invitation delivery failed:",
        emailFailure,
      );

      invitationDelivery.push({
        email:
          invitation.email,

        sent:
          false,

        emailId:
          null,

        error:
          "The workspace was activated, but this team invitation email was not automatically delivered.",
      });
    }
  }


  return {
    ...data,

    invitation_delivery:
      invitationDelivery,

    provider_sync:
      providerSync,
  };
}


async function getSeatOAuthFunctionError(
  error,
  fallback,
) {
  if (
    error?.context instanceof
      Response
  ) {
    try {
      const payload =
        await error.context.json();

      return (
        payload?.error ||
        payload?.message ||
        error.message ||
        fallback
      );
    } catch {
      // Fall through.
    }
  }

  return (
    error?.message ||
    fallback
  );
}


export async function startSeatProviderConnection(
  integrationKey,
) {
  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        "nylas-seat-oauth-start",
        {
          body: {
            integrationKey,
          },
        },
      );

  if (
    error ||
    !data?.authorizationUrl
  ) {
    throw new Error(
      await getSeatOAuthFunctionError(
        error,
        data?.error ||
          "Campaign Seat could not begin the provider connection.",
      ),
    );
  }

  return data;
}


export async function probeSeatProviderData(
  integrationKey,
) {
  const {
    data:
      sessionData,
    error:
      sessionError,
  } =
    await supabase.auth
      .getSession();


  if (
    sessionError ||
    !sessionData
      ?.session
      ?.access_token
  ) {
    throw new Error(
      "Your secure Campaign Seat session could not be verified.",
    );
  }


  const accessToken =
    sessionData
      .session
      .access_token;


  let tokenPayload = {};


  try {
    const payloadPart =
      accessToken
        .split(".")[1] ||
      "";

    const normalized =
      payloadPart
        .replace(
          /-/g,
          "+",
        )
        .replace(
          /_/g,
          "/",
        );

    const padded =
      normalized.padEnd(
        Math.ceil(
          normalized.length /
          4,
        ) * 4,
        "=",
      );

    tokenPayload =
      JSON.parse(
        atob(
          padded,
        ),
      );
  } catch {
    tokenPayload =
      {};
  }


  if (
    tokenPayload?.aal !==
      "aal2"
  ) {
    throw new Error(
      "Two-step verification is required to verify connected provider data.",
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        "nylas-seat-data-probe",
        {
          body: {
            integrationKey,
          },

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
      );


  if (error) {
    let message =
      error.message ||
      "Campaign Seat could not verify provider data access.";


    if (
      error.context instanceof
        Response
    ) {
      try {
        const payload =
          await error.context.json();

        message =
          payload?.error ||
          payload?.message ||
          message;
      } catch {
        // Preserve fallback.
      }
    }


    throw new Error(
      message,
    );
  }


  if (
    data?.success !==
    true
  ) {
    throw new Error(
      data?.error ||
        "Campaign Seat could not verify provider data access.",
    );
  }


  return data;
}


// ============================================================
// CAMPAIGN SEAT — WORKSPACE PROVIDER SYNC STATUS
// ============================================================

export async function getWorkspaceProviderSyncStatus(
  workspaceId,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_workspace_provider_sync_status",
      {
        target_workspace_id:
          workspaceId,
      },
    );


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat provider sync status could not be loaded.",
    );
  }


  return data;
}


export async function retryWorkspaceProviderSync(
  workspaceId,
) {
  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        "nylas-workspace-data-sync",
        {
          body: {
            workspaceId,
          },
        },
      );


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat provider synchronization could not be retried.",
    );
  }


  return data;
}


// ============================================================
// CAMPAIGN SEAT — WORKSPACE INVITATION DELIVERY
// ============================================================

export async function getWorkspaceInvitationDeliveryStatus(
  workspaceId,
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_workspace_invitation_delivery_status",
      {
        target_workspace_id:
          workspaceId,
      },
    );


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat invitation delivery status could not be loaded.",
    );
  }


  return data;
}


export async function retryWorkspaceInvitationDelivery(
  invitationId,
) {
  const {
    data:
      rotatedRows,
    error:
      rotateError,
  } =
    await supabase.rpc(
      "rotate_workspace_invitation_for_retry",
      {
        target_invitation_id:
          invitationId,
      },
    );


  if (rotateError) {
    console.error(
      rotateError,
    );

    throw new Error(
      rotateError.message ||
        "Campaign Seat could not prepare a secure invitation retry.",
    );
  }


  const rotated =
    Array.isArray(
      rotatedRows,
    )
      ? rotatedRows[0]
      : rotatedRows;


  if (
    !rotated
      ?.invitation_id ||
    !rotated
      ?.invitation_token
  ) {
    throw new Error(
      "Campaign Seat did not return a secure retry token.",
    );
  }


  /*
   * The plaintext retry token exists only in this function call.
   * Supabase stores only the replacement SHA-256 hash.
   */
  const {
    data:
      deliveryData,
    error:
      deliveryError,
  } =
    await supabase
      .functions
      .invoke(
        "send-workspace-invitation",
        {
          body: {
            invitationId:
              rotated
                .invitation_id,

            invitationToken:
              rotated
                .invitation_token,
          },
        },
      );


  if (
    deliveryError ||
    deliveryData
      ?.success !==
      true
  ) {
    console.error(
      deliveryError ||
      deliveryData,
    );

    throw new Error(
      deliveryData?.error ||
        deliveryError?.message ||
        "Campaign Seat prepared a new invitation link, but email delivery still requires attention.",
    );
  }


  return {
    ...deliveryData,

    expiresAt:
      rotated
        .invitation_expires_at ||
      deliveryData
        ?.expiresAt ||
      null,
  };
}


// ============================================================
// CAMPAIGN SEAT — LAUNCH HEALTH / ACTIVATION RECEIPT
// ============================================================

export async function getCampaignSeatLaunchHealth() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_campaign_seat_launch_health",
    );


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat launch health could not be loaded.",
    );
  }


  return data;
}


// ============================================================
// CAMPAIGN SEAT — ONE-TIME 30-DAY FREE TRIAL
// ============================================================

export async function startMyCampaignSeatFreeTrial() {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "start_my_campaign_seat_free_trial",
    );


  if (error) {
    console.error(error);

    throw new Error(
      error.message ||
        "Campaign Seat could not start the 30-day free trial.",
    );
  }


  return data;
}
