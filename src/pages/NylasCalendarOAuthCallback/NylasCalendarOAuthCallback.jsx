import {
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import {
  useLocation,
} from "react-router-dom";

import {
  invokeProtectedOAuthExchange,
} from "../../utils/providerOAuthCallback";

import styles
  from "./NylasCalendarOAuthCallback.module.css";

const activeCalendarExchangeStates =
  new Set();

export default function NylasCalendarOAuthCallback() {
  const location =
    useLocation();

  const [
    status,
    setStatus,
  ] = useState(
    "working",
  );

  const [
    message,
    setMessage,
  ] = useState(
    "Verifying the protected Calendar connection…",
  );

  useEffect(() => {
    const params =
      new URLSearchParams(
        location.search,
      );

    const providerError =
      params.get(
        "error",
      );

    const code =
      params.get(
        "code",
      );

    const state =
      params.get(
        "state",
      );

    if (
      providerError
    ) {
      window.setTimeout(
        () => {
          setStatus(
            "error",
          );

          setMessage(
            "The provider did not authorize Calendar access. No Campaign Seat Calendar connection was created.",
          );
        },
        0,
      );

      return;
    }

    if (
      !code ||
      !state
    ) {
      window.setTimeout(
        () => {
          setStatus(
            "error",
          );

          setMessage(
            "The Calendar callback is missing its authorization code or state.",
          );
        },
        0,
      );

      return;
    }

    if (
      activeCalendarExchangeStates.has(
        state,
      )
    ) {
      return;
    }

    activeCalendarExchangeStates.add(
      state,
    );

    const finish =
      async () => {
        try {
          const data =
            await invokeProtectedOAuthExchange({
              functionName:
                "nylas-calendar-oauth-exchange",

              body: {
                code,
                state,
              },

              fallbackErrorMessage:
                "Campaign Seat could not finalize the Calendar connection.",
            });

          setStatus(
            "success",
          );

          setMessage(
            `Connected Calendar for ${data.email}. Returning to Calendar…`,
          );

          window.setTimeout(
            () => {
              window.location.replace(
                "/calendar?onboarding=calendar&calendar-connection=success",
              );
            },
            750,
          );
        } catch (
          exchangeError
        ) {
          setStatus(
            "error",
          );

          setMessage(
            exchangeError?.message ||
              "Campaign Seat could not finalize the Calendar connection.",
          );
        } finally {
          activeCalendarExchangeStates.delete(
            state,
          );
        }
      };

    void finish();
  }, [
    location.search,
  ]);

  return (
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.card
        }
      >
        {status ===
        "working" ? (
          <LoaderCircle
            className={
              styles.spinner
            }
            size={35}
          />
        ) : status ===
          "success" ? (
          <CheckCircle2
            size={35}
          />
        ) : (
          <TriangleAlert
            size={35}
          />
        )}

        <span>
          Campaign Seat
        </span>

        <h1>
          {status ===
          "error"
            ? "Connection needs attention"
            : "Securing your campaign calendar"}
        </h1>

        <p>
          {message}
        </p>

        {status ===
          "error" && (
          <button
            type="button"
            onClick={() =>
              window.location.replace(
                "/calendar?onboarding=calendar",
              )
            }
          >
            Return to Calendar
          </button>
        )}
      </section>
    </main>
  );
}
