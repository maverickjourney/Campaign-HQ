import {
  useEffect,
  useState,
} from "react";

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
            ?.isAal2
        ) {
          const hasFactor =
            Boolean(
              session
                .mfaState
                ?.verifiedFactors
                ?.length,
            );

          navigate(
            hasFactor
              ? "/mfa/challenge"
              : "/mfa/setup",
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
