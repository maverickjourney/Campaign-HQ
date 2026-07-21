import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  ShieldCheck,
} from "lucide-react";

import {
  restoreCampaignSession,
} from "../../../services/auth";

import {
  getCampaignExperience,
} from "../../../utils/campaignSession";

import styles from "./ProtectedRoute.module.css";

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

  const allowedKey =
    allowedExperiences
      .join("|");

  useEffect(() => {
    let mounted = true;

    const verify =
      async () => {
        const authentication =
          await restoreCampaignSession();

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
