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
  supabase,
} from "../../lib/supabase";

import styles
  from "./NylasCalendarOAuthCallback.module.css";

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

    const marker =
      `campaign-seat-nylas-calendar-exchange:${state}`;

    if (
      window.sessionStorage
        .getItem(
          marker,
        )
    ) {
      return;
    }

    window.sessionStorage
      .setItem(
        marker,
        "started",
      );

    const finish =
      async () => {
        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "nylas-calendar-oauth-exchange",
              {
                body: {
                  code,
                  state,
                },
              },
            );

        if (
          error ||
          data?.success !==
            true
        ) {
          let functionErrorMessage =
            "";

          if (
            error?.context instanceof
              Response
          ) {
            try {
              const errorPayload =
                await error.context.json();

              functionErrorMessage =
                errorPayload?.error ||
                errorPayload?.message ||
                "";
            } catch {
              // Fall through to the normal
              // Supabase error message.
            }
          }

          setStatus(
            "error",
          );

          setMessage(
            functionErrorMessage ||
            data?.error ||
            error?.message ||
            "Campaign Seat could not finalize the Calendar connection.",
          );

          return;
        }

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
      };

    finish();
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
