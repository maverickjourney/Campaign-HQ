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
  from "./NylasOAuthCallback.module.css";

const activeExchangeStates =
  new Set();

export default function NylasOAuthCallback() {
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
    "Verifying the protected provider connection…",
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
            "The provider did not authorize this connection. No Campaign Seat provider record was created.",
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
            "The provider callback is missing its authorization code or state.",
          );
        },
        0,
      );

      return;
    }

    if (
      activeExchangeStates.has(
        state,
      )
    ) {
      return;
    }

    activeExchangeStates.add(
      state,
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
              "nylas-oauth-exchange",
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
            "Campaign Seat could not finalize the provider connection.",
          );

          return;
        }

        const reauthorized =
          data?.mode ===
            "reauthorize";

        setStatus(
          "success",
        );

        setMessage(
          reauthorized
            ? `Reconnected ${data.email}. Returning to Email & Contacts…`
            : `Connected ${data.email}. Returning to Email & Contacts…`,
        );

        window.setTimeout(
          () => {
            window.location.replace(
              reauthorized
                ? "/workspace/settings?tab=integrations&onboarding=communications&provider-connection=reauthorized"
                : "/workspace/settings?tab=integrations&onboarding=communications&provider-connection=success",
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
            : "Securing your campaign connection"}
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
                "/workspace/settings?tab=integrations&onboarding=communications",
              )
            }
          >
            Return to Email &amp; Contacts
          </button>
        )}
      </section>
    </main>
  );
}
