import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import LoginLayout from "../../layouts/LoginLayout/LoginLayout";

import {
  restoreCampaignSession,
} from "../../services/auth";

import {
  getMfaState,
  verifyTotpFactor,
} from "../../services/mfa";

import {
  clearCampaignSession,
} from "../../utils/campaignSession";

import { supabase } from "../../lib/supabase";

import styles from "./Mfa.module.css";

export default function MfaChallenge() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const destination =
    location.state?.from ||
    "/workspaces";

  const [
    status,
    setStatus,
  ] = useState(
    "checking",
  );

  const [
    factor,
    setFactor,
  ] = useState(null);

  const [
    code,
    setCode,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const initialize =
      async () => {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth
            .getUser();

        if (!active) {
          return;
        }

        if (!user) {
          navigate(
            "/",
            {
              replace:
                true,
            },
          );

          return;
        }

        try {
          const mfaState =
            await getMfaState();

          if (
            mfaState
              .isAal2
          ) {
            await restoreCampaignSession();

            navigate(
              destination,
              {
                replace:
                  true,
              },
            );

            return;
          }

          const selectedFactor =
            mfaState
              .verifiedFactors[0];

          if (
            !selectedFactor
          ) {
            navigate(
              "/mfa/setup",
              {
                replace:
                  true,

                state: {
                  from:
                    destination,
                },
              },
            );

            return;
          }

          setFactor(
            selectedFactor,
          );

          setStatus(
            "ready",
          );
        } catch (
          error
        ) {
          setStatus(
            "error",
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Campaign Seat could not prepare the authenticator challenge.",
          );
        }
      };

    initialize();

    return () => {
      active = false;
    };
  }, [
    destination,
    navigate,
  ]);

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault();

      setStatus(
        "verifying",
      );

      setErrorMessage(
        "",
      );

      try {
        await verifyTotpFactor({
          factorId:
            factor?.id,

          code,
        });

        await restoreCampaignSession();

        navigate(
          destination,
          {
            replace:
              true,
          },
        );
      } catch (
        error
      ) {
        setStatus(
          "ready",
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The authenticator code could not be verified.",
        );
      }
    };

  const signOut =
    async () => {
      await clearCampaignSession();

      navigate(
        "/",
        {
          replace:
            true,
        },
      );
    };

  return (
    <LoginLayout>
      <div
        className={
          styles.wrapper
        }
      >
        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.accentBars
            }
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </div>

          <div
            className={
              styles.security
            }
          >
            <ShieldCheck
              size={21}
            />

            <div>
              <strong>
                Two-step verification
              </strong>

              <span>
                Password accepted. Verify
                the authenticator code to
                continue.
              </span>
            </div>
          </div>

          {status ===
          "checking" ? (
            <div
              className={
                styles.statusPanel
              }
            >
              <LoaderCircle
                className={
                  styles.spinner
                }
                size={40}
              />

              <span
                className={
                  styles.eyebrow
                }
              >
                Secure verification
              </span>

              <h1>
                Checking authenticator
              </h1>

              <p>
                Campaign Seat is loading
                the protected login
                challenge.
              </p>
            </div>
          ) : (
            <>
              <div
                className={
                  styles.challengeIcon
                }
              >
                <Smartphone
                  size={30}
                />
              </div>

              <div
                className={
                  styles.heading
                }
              >
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Authenticator required
                </span>

                <h1>
                  Enter your six-digit
                  code
                </h1>

                <p>
                  Open the authenticator
                  app connected to this
                  Campaign Seat account.
                </p>
              </div>

              <form
                className={
                  styles.form
                }
                onSubmit={
                  handleSubmit
                }
              >
                <label>
                  <span>
                    Authenticator code
                  </span>

                  <div
                    className={
                      styles.codeInput
                    }
                  >
                    <KeyRound
                      size={19}
                    />

                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={
                        code
                      }
                      onChange={(
                        event,
                      ) => {
                        setCode(
                          event.target
                            .value
                            .replace(
                              /\D/g,
                              "",
                            )
                            .slice(
                              0,
                              6,
                            ),
                        );

                        setErrorMessage(
                          "",
                        );
                      }}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      disabled={
                        status ===
                        "verifying"
                      }
                      required
                    />
                  </div>
                </label>

                {errorMessage && (
                  <p
                    className={
                      styles.errorMessage
                    }
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}

                <button
                  className={
                    styles.primaryButton
                  }
                  type="submit"
                  disabled={
                    status ===
                      "verifying" ||
                    code.length !==
                      6
                  }
                >
                  {status ===
                  "verifying" ? (
                    <>
                      <LoaderCircle
                        className={
                          styles.buttonSpinner
                        }
                        size={18}
                      />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <ShieldCheck
                        size={18}
                      />
                      Verify and continue
                    </>
                  )}
                </button>

                <button
                  className={
                    styles.signOutButton
                  }
                  type="button"
                  onClick={
                    signOut
                  }
                >
                  <LogOut
                    size={17}
                  />
                  Use another account
                </button>
              </form>
            </>
          )}
        </section>

        <footer
          className={
            styles.footer
          }
        >
          <Link
            to="/"
          >
            <ArrowLeft
              size={15}
            />
            Sign in
          </Link>

          <span>
            Authorized campaign use only
          </span>
        </footer>
      </div>
    </LoginLayout>
  );
}
