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
  from "./NylasOAuthCallback.module.css";

const activeExchangeStates =
  new Set();

export default function NylasOAuthCallback() {
  const location =
    useLocation();

  const callbackState =
    new URLSearchParams(
      location.search,
    ).get(
      "state",
    ) || "";

  const seatOnboardingConnection =
    callbackState.startsWith(
      "seat.",
    );

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
        try {
          const data =
            await invokeProtectedOAuthExchange({
              functionName:
                seatOnboardingConnection
                  ? "nylas-seat-oauth-exchange"
                  : "nylas-oauth-exchange",

              body: {
                code,
                state,
              },

              fallbackErrorMessage:
                "Campaign Seat could not finalize the provider connection.",
            });

          const reauthorized =
            data?.mode ===
              "reauthorize";

          setStatus(
            "success",
          );

          if (
            seatOnboardingConnection
          ) {
            setMessage(
              `Connected ${data.email}. Returning to Campaign Seat Activation…`,
            );

            window.setTimeout(
              () => {
                window.location.replace(
                  `/onboarding/continue?provider-connection=success&provider=${encodeURIComponent(
                    data.provider ||
                      "",
                  )}`,
                );
              },
              750,
            );

            return;
          }

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
        } catch (
          exchangeError
        ) {
          setStatus(
            "error",
          );

          setMessage(
            exchangeError?.message ||
              "Campaign Seat could not finalize the provider connection.",
          );
        } finally {
          activeExchangeStates.delete(
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
                seatOnboardingConnection
                  ? "/onboarding/continue"
                  : "/workspace/settings?tab=integrations&onboarding=communications",
              )
            }
          >
            {seatOnboardingConnection
              ? "Return to Activation"
              : "Return to Email & Contacts"}
          </button>
        )}
      </section>
    </main>
  );
}
