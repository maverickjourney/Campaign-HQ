import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  KeyRound,
  LoaderCircle,
  LogOut,
  QrCode,
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
  beginTotpEnrollment,
  cancelTotpEnrollment,
  getMfaState,
  verifyTotpFactor,
} from "../../services/mfa";

import {
  clearCampaignSession,
} from "../../utils/campaignSession";

import { supabase } from "../../lib/supabase";

import styles from "./Mfa.module.css";

export default function MfaSetup() {
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
    enrollment,
    setEnrollment,
  ] = useState(null);

  const [
    code,
    setCode,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    copied,
    setCopied,
  ] = useState(false);

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

        if (
          !active
        ) {
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

          if (
            mfaState
              .verifiedFactors
              .length
          ) {
            navigate(
              "/mfa/challenge",
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
              : "Campaign Seat could not load authenticator setup.",
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

  const startEnrollment =
    async () => {
      setStatus(
        "starting",
      );

      setErrorMessage(
        "",
      );

      try {
        const result =
          await beginTotpEnrollment();

        setEnrollment(
          result,
        );

        setStatus(
          "enrolling",
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
            : "Authenticator setup could not begin.",
        );
      }
    };

  const verifyEnrollment =
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
            enrollment
              ?.factorId,

          code,
        });

        await restoreCampaignSession();

        setStatus(
          "complete",
        );

        window.setTimeout(
          () => {
            navigate(
              destination,
              {
                replace:
                  true,
              },
            );
          },
          900,
        );
      } catch (
        error
      ) {
        setStatus(
          "enrolling",
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The authenticator code could not be verified.",
        );
      }
    };

  const cancelEnrollment =
    async () => {
      try {
        await cancelTotpEnrollment(
          enrollment
            ?.factorId,
        );
      } catch (
        error
      ) {
        console.error(
          error,
        );
      }

      setEnrollment(
        null,
      );

      setCode("");

      setStatus(
        "ready",
      );

      setErrorMessage(
        "",
      );
    };

  const copySecret =
    async () => {
      if (
        !enrollment
          ?.secret
      ) {
        return;
      }

      await navigator
        .clipboard
        .writeText(
          enrollment
            .secret,
        );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1600,
      );
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
                Leadership account protection
              </strong>

              <span>
                Add an authenticator app
                before opening sensitive
                campaign tools.
              </span>
            </div>
          </div>

          {status ===
            "checking" ||
          status ===
            "starting" ? (
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
                Secure setup
              </span>

              <h1>
                Preparing authenticator
              </h1>

              <p>
                Campaign Seat is checking
                the current account and
                security factors.
              </p>
            </div>
          ) : status ===
            "complete" ? (
            <div
              className={
                styles.statusPanel
              }
            >
              <div
                className={
                  styles.successIcon
                }
              >
                <CheckCircle2
                  size={31}
                />
              </div>

              <span
                className={
                  styles.eyebrow
                }
              >
                MFA enabled
              </span>

              <h1>
                Authenticator confirmed
              </h1>

              <p>
                This account now has
                two-step verification.
                Opening Campaign Seat…
              </p>
            </div>
          ) : status ===
            "enrolling" ||
          status ===
            "verifying" ? (
            <>
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
                  Authenticator setup
                </span>

                <h1>
                  Scan the QR code
                </h1>

                <p>
                  Open Google Authenticator,
                  Microsoft Authenticator,
                  Authy, 1Password, or your
                  phone’s password manager.
                </p>
              </div>

              <div
                className={
                  styles.qrPanel
                }
              >
                {enrollment
                  ?.qrCode ? (
                  <img
                    src={
                      enrollment
                        .qrCode
                    }
                    alt="Campaign Seat authenticator QR code"
                  />
                ) : (
                  <QrCode
                    size={84}
                  />
                )}

                <div>
                  <strong>
                    Cannot scan it?
                  </strong>

                  <span>
                    Enter this setup key
                    manually:
                  </span>

                  <code>
                    {
                      enrollment
                        ?.secret
                    }
                  </code>

                  <button
                    type="button"
                    onClick={
                      copySecret
                    }
                  >
                    <Clipboard
                      size={15}
                    />

                    {copied
                      ? "Copied"
                      : "Copy setup key"}
                  </button>
                </div>
              </div>

              <form
                className={
                  styles.form
                }
                onSubmit={
                  verifyEnrollment
                }
              >
                <label>
                  <span>
                    Six-digit authenticator
                    code
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
                      Verifying code…
                    </>
                  ) : (
                    <>
                      <ShieldCheck
                        size={18}
                      />
                      Enable authenticator
                    </>
                  )}
                </button>

                <button
                  className={
                    styles.secondaryButton
                  }
                  type="button"
                  onClick={
                    cancelEnrollment
                  }
                  disabled={
                    status ===
                    "verifying"
                  }
                >
                  Cancel setup
                </button>
              </form>
            </>
          ) : (
            <>
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
                  Two-step verification
                </span>

                <h1>
                  Protect your campaign
                  account
                </h1>

                <p>
                  After your password,
                  Campaign Seat will ask
                  for a rotating six-digit
                  code from your phone.
                </p>
              </div>

              <div
                className={
                  styles.featureList
                }
              >
                <div>
                  <Smartphone
                    size={21}
                  />

                  <span>
                    Works with standard
                    authenticator apps
                  </span>
                </div>

                <div>
                  <ShieldCheck
                    size={21}
                  />

                  <span>
                    Required for sensitive
                    leadership access
                  </span>
                </div>
              </div>

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
                type="button"
                onClick={
                  startEnrollment
                }
              >
                <QrCode
                  size={18}
                />
                Start authenticator setup
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
