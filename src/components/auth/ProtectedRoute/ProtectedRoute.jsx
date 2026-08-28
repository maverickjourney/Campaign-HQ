import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  restoreCampaignSession,
} from "../../../services/auth";

import {
  getCampaignExperience,
  getCampaignMemberships,
  getCurrentMembership,
} from "../../../utils/campaignSession";

import styles from "./ProtectedRoute.module.css";

const CAMPAIGN_ACCESS_TIMEOUT_MS =
  15000;


async function restoreCampaignSessionWithTimeout() {
  let timeoutId;

  try {
    return await Promise.race([
      restoreCampaignSession(),

      new Promise(
        (
          _resolve,
          reject,
        ) => {
          timeoutId =
            window.setTimeout(
              () => {
                reject(
                  new Error(
                    "Campaign access verification took too long.",
                  ),
                );
              },
              CAMPAIGN_ACCESS_TIMEOUT_MS,
            );
        },
      ),
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(
        timeoutId,
      );
    }
  }
}


export default function ProtectedRoute({
  children,
  allowedExperiences = [],
}) {
  const location =
    useLocation();

  const [
    status,
    setStatus,
  ] = useState(
    "checking",
  );

  const [
    accessError,
    setAccessError,
  ] = useState("");

  const [
    retryKey,
    setRetryKey,
  ] = useState(0);

  const allowedKey =
    allowedExperiences
      .join("|");

  useEffect(() => {
    let mounted = true;

    const verify =
      async () => {
        setStatus(
          "checking",
        );

        setAccessError(
          "",
        );

        let authentication;

        try {
          authentication =
            await restoreCampaignSessionWithTimeout();
        } catch (
          error
        ) {
          console.error(
            "Campaign access verification failed:",
            error,
          );

          if (!mounted) {
            return;
          }

          setAccessError(
            error?.message ||
              "Campaign Seat could not verify your campaign access.",
          );

          setStatus(
            "error",
          );

          return;
        }

        if (!mounted) {
          return;
        }

        if (!authentication) {
          setStatus(
            "signed-out",
          );

          return;
        }

        if (
          authentication.status ===
          "mfa-setup"
        ) {
          setStatus(
            "mfa-setup",
          );

          return;
        }

        if (
          authentication.status ===
          "mfa-challenge"
        ) {
          setStatus(
            "mfa-challenge",
          );

          return;
        }

        /*
         * A protected Campaign workspace screen must never
         * render against the neutral fallback workspace.
         *
         * One workspace is automatically selected by
         * saveAuthenticatedSession().
         *
         * If no workspace is selected here, the user must
         * choose one from the Workspace selector.
         */
        const campaignMemberships =
          getCampaignMemberships();


        const selectedMembership =
          getCurrentMembership();


        const workspaceSelectionRequired =
          campaignMemberships.length > 0 &&
          !selectedMembership &&
          location.pathname !==
            "/workspaces" &&
          location.pathname !==
            "/profile/settings";


        if (
          workspaceSelectionRequired
        ) {
          setStatus(
            "workspace-required",
          );

          return;
        }


        const allowed =
          allowedKey
            ? allowedKey.split(
                "|",
              )
            : [];

        if (
          allowed.length &&
          !allowed.includes(
            getCampaignExperience()
              .key,
          )
        ) {
          setStatus(
            "forbidden",
          );

          return;
        }

        setStatus(
          "authorized",
        );
      };

    verify();

    return () => {
      mounted = false;
    };
  }, [
    allowedKey,
    location.pathname,
    retryKey,
  ]);

  const returnDestination =
    `${location.pathname}${location.search}`;

  if (
    status ===
    "checking"
  ) {
    return (
      <div
        className={
          styles.loadingPage
        }
      >
        <div
          className={
            styles.loadingMark
          }
        >
          <ShieldCheck
            size={28}
            strokeWidth={1.8}
          />
        </div>

        <strong>
          Opening Campaign HQ
        </strong>

        <span>
          Verifying your secure
          campaign access…
        </span>
      </div>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <div
        className={
          styles.loadingPage
        }
      >
        <div
          className={[
            styles.loadingMark,
            styles.errorMark,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ShieldAlert
            size={28}
            strokeWidth={1.8}
          />
        </div>

        <strong>
          Campaign access needs another check
        </strong>

        <span
          className={
            styles.errorMessage
          }
        >
          {accessError ||
            "Campaign Seat could not finish verifying your secure access."}
        </span>

        <button
          type="button"
          className={
            styles.retryButton
          }
          onClick={() =>
            setRetryKey(
              (current) =>
                current + 1,
            )
          }
        >
          <RefreshCw
            size={17}
          />

          Retry access check
        </button>
      </div>
    );
  }


  if (
    status ===
    "signed-out"
  ) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from:
            returnDestination,
        }}
      />
    );
  }

  if (
    status ===
    "mfa-setup"
  ) {
    return (
      <Navigate
        to="/mfa/setup"
        replace
        state={{
          from:
            returnDestination,
        }}
      />
    );
  }

  if (
    status ===
    "mfa-challenge"
  ) {
    return (
      <Navigate
        to="/mfa/challenge"
        replace
        state={{
          from:
            returnDestination,
        }}
      />
    );
  }

  if (
    status ===
    "workspace-required"
  ) {
    return (
      <Navigate
        to="/workspaces"
        replace
      />
    );
  }


  if (
    status ===
    "forbidden"
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}
