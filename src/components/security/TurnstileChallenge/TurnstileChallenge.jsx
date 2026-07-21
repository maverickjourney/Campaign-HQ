import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  ShieldCheck,
} from "lucide-react";

import styles from "./TurnstileChallenge.module.css";

const SITE_KEY =
  String(
    import.meta.env
      .VITE_TURNSTILE_SITE_KEY ||
      "",
  ).trim();

let turnstileLoaderPromise =
  null;

function loadTurnstile() {
  if (
    typeof window ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Turnstile requires a browser.",
      ),
    );
  }

  if (
    window.turnstile
  ) {
    return Promise.resolve(
      window.turnstile,
    );
  }

  if (
    turnstileLoaderPromise
  ) {
    return turnstileLoaderPromise;
  }

  turnstileLoaderPromise =
    new Promise(
      (
        resolve,
        reject,
      ) => {
        const existingScript =
          document.querySelector(
            'script[data-campaign-seat-turnstile="true"]',
          );

        const finishLoading =
          () => {
            if (
              window.turnstile
            ) {
              resolve(
                window.turnstile,
              );
              return;
            }

            reject(
              new Error(
                "Turnstile loaded without its browser API.",
              ),
            );
          };

        if (
          existingScript
        ) {
          const startedAt =
            Date.now();

          const intervalId =
            window.setInterval(
              () => {
                if (
                  window.turnstile
                ) {
                  window.clearInterval(
                    intervalId,
                  );

                  resolve(
                    window.turnstile,
                  );

                  return;
                }

                if (
                  Date.now() -
                    startedAt >
                  15000
                ) {
                  window.clearInterval(
                    intervalId,
                  );

                  reject(
                    new Error(
                      "Turnstile did not finish loading.",
                    ),
                  );
                }
              },
              100,
            );

          return;
        }

        const script =
          document.createElement(
            "script",
          );

        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

        script.async =
          true;

        script.defer =
          true;

        script.dataset
          .campaignSeatTurnstile =
          "true";

        script.addEventListener(
          "load",
          finishLoading,
          {
            once: true,
          },
        );

        script.addEventListener(
          "error",
          () => {
            reject(
              new Error(
                "Turnstile could not be loaded.",
              ),
            );
          },
          {
            once: true,
          },
        );

        document.head
          .appendChild(
            script,
          );
      },
    );

  return turnstileLoaderPromise;
}

const TurnstileChallenge =
  forwardRef(
    function TurnstileChallenge(
      {
        action =
          "campaign_auth",

        onTokenChange,
      },
      forwardedRef,
    ) {
      const containerRef =
        useRef(null);

      const widgetIdRef =
        useRef(null);

      const apiRef =
        useRef(null);

      const callbackRef =
        useRef(
          onTokenChange,
        );

      const [
        status,
        setStatus,
      ] = useState(
        "loading",
      );

      useEffect(() => {
        callbackRef.current =
          onTokenChange;
      }, [
        onTokenChange,
      ]);

      const reset =
        () => {
          callbackRef
            .current?.("");

          setStatus(
            "checking",
          );

          if (
            apiRef.current &&
            widgetIdRef
              .current !==
              null
          ) {
            try {
              apiRef.current
                .reset(
                  widgetIdRef
                    .current,
                );
            } catch (
              error
            ) {
              console.error(
                "Turnstile reset failed:",
                error,
              );
            }
          }
        };

      useImperativeHandle(
        forwardedRef,
        () => ({
          reset,
        }),
      );

      useEffect(() => {
        let active =
          true;

        callbackRef
          .current?.("");

        if (!SITE_KEY) {
          setStatus(
            "misconfigured",
          );

          return undefined;
        }

        loadTurnstile()
          .then(
            (
              turnstile,
            ) => {
              if (
                !active ||
                !containerRef
                  .current
              ) {
                return;
              }

              apiRef.current =
                turnstile;

              setStatus(
                "checking",
              );

              widgetIdRef.current =
                turnstile.render(
                  containerRef
                    .current,
                  {
                    sitekey:
                      SITE_KEY,

                    action,

                    theme:
                      "light",

                    size:
                      "flexible",

                    appearance:
                      "interaction-only",

                    execution:
                      "render",

                    retry:
                      "auto",

                    "refresh-expired":
                      "auto",

                    "refresh-timeout":
                      "auto",

                    callback:
                      (
                        token,
                      ) => {
                        if (
                          !active
                        ) {
                          return;
                        }

                        callbackRef
                          .current?.(
                            token,
                          );

                        setStatus(
                          "verified",
                        );
                      },

                    "expired-callback":
                      () => {
                        callbackRef
                          .current?.("");

                        setStatus(
                          "checking",
                        );
                      },

                    "timeout-callback":
                      () => {
                        callbackRef
                          .current?.("");

                        setStatus(
                          "checking",
                        );
                      },

                    "error-callback":
                      () => {
                        callbackRef
                          .current?.("");

                        setStatus(
                          "error",
                        );
                      },
                  },
                );
            },
          )
          .catch(
            (
              error,
            ) => {
              console.error(
                "Turnstile initialization failed:",
                error,
              );

              if (
                active
              ) {
                callbackRef
                  .current?.("");

                setStatus(
                  "error",
                );
              }
            },
          );

        return () => {
          active =
            false;

          callbackRef
            .current?.("");

          if (
            apiRef.current &&
            widgetIdRef
              .current !==
              null
          ) {
            try {
              apiRef.current
                .remove(
                  widgetIdRef
                    .current,
                );
            } catch {
              // The widget may already have been removed.
            }
          }

          widgetIdRef.current =
            null;
        };
      }, [
        action,
      ]);

      const statusMessage =
        status ===
        "verified"
          ? "Security check complete."
          : status ===
              "error"
            ? "Security check could not load. Refresh this page."
            : status ===
                "misconfigured"
              ? "Security verification is not configured."
              : "Checking this browser securely…";

      return (
        <section
          className={
            styles.wrapper
          }
          aria-label="Automated security verification"
        >
          <div
            className={
              styles.widget
            }
            ref={
              containerRef
            }
          />

          <div
            className={[
              styles.status,
              styles[
                `status_${status}`
              ] || "",
            ]
              .filter(
                Boolean,
              )
              .join(" ")}
            role={
              status ===
              "error"
                ? "alert"
                : "status"
            }
          >
            <ShieldCheck
              size={15}
            />

            <span>
              {statusMessage}
            </span>
          </div>
        </section>
      );
    },
  );

export default TurnstileChallenge;
