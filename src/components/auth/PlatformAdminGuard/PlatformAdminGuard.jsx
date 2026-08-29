import {
  useEffect,
  useState,
} from "react";

// Temporarily disabled while building the Platform Admin.
// Keep the idle-session system in place so it can be re-enabled
// before production Admin launch.
/*
 * TEMPORARY PLATFORM ADMIN WORK SESSION
 *
 * Keep the private Admin signed in during active build sessions.
 * Production still expires after 8 hours of inactivity.
 *
 * Revisit before wider Platform Admin access is introduced.
 */
const ADMIN_IDLE_TIMEOUT_MS =
  import.meta.env.DEV
    ? 0
    : 8 * 60 * 60 * 1000;

import {
  useNavigate,
} from "react-router-dom";

import {
  getPlatformAdminSession,
  signOutPlatformAdmin,
} from "../../../services/platformAdminAuth";

export default function PlatformAdminGuard({
  children,
}) {
  const navigate =
    useNavigate();

  const [
    allowed,
    setAllowed,
  ] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const session =
          await getPlatformAdminSession();

        if (!active) {
          return;
        }

        if (
          !session.authenticated
        ) {
          navigate(
            "/admin/login",
            {
              replace: true,
            },
          );

          return;
        }

        if (!session.authorized) {
          await signOutPlatformAdmin();

          navigate(
            "/admin/login",
            {
              replace: true,
            },
          );

          return;
        }

        if (
          !session
            .mfaState
            ?.hasVerifiedTotp
        ) {
          navigate(
            "/mfa/setup",
            {
              replace: true,

              state: {
                from:
                  "/admin",
              },
            },
          );

          return;
        }

        if (
          !session
            .mfaState
            ?.isAal2
        ) {
          navigate(
            "/mfa/challenge",
            {
              replace: true,

              state: {
                from:
                  "/admin",
              },
            },
          );

          return;
        }

        setAllowed(true);
      } catch (error) {
        console.error(
          "Platform Admin access check failed:",
          error,
        );

        if (active) {
          await signOutPlatformAdmin();

          navigate(
            "/admin/login",
            {
              replace: true,
            },
          );
        }
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (
      !allowed ||
      ADMIN_IDLE_TIMEOUT_MS <= 0
    ) {
      return undefined;
    }

    let timeoutId;

    const expireAdminSession =
      async () => {
        await signOutPlatformAdmin();

        navigate(
          "/admin/login",
          {
            replace: true,
          },
        );
      };

    const resetTimer = () => {
      window.clearTimeout(
        timeoutId,
      );

      timeoutId =
        window.setTimeout(
          expireAdminSession,
          ADMIN_IDLE_TIMEOUT_MS,
        );
    };

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    for (
      const eventName of
      activityEvents
    ) {
      window.addEventListener(
        eventName,
        resetTimer,
        {
          passive: true,
        },
      );
    }

    resetTimer();

    return () => {
      window.clearTimeout(
        timeoutId,
      );

      for (
        const eventName of
        activityEvents
      ) {
        window.removeEventListener(
          eventName,
          resetTimer,
        );
      }
    };
  }, [
    allowed,
    navigate,
  ]);

  if (!allowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "system-ui, sans-serif",
        }}
      >
        Verifying Seat Platform Admin security…
      </main>
    );
  }

  return children;
}
