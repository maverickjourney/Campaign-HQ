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
  LockKeyhole,
  LogOut,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import LoginLayout
  from "../../layouts/LoginLayout/LoginLayout";

import {
  restoreCampaignSession,
} from "../../services/auth";

import {
  PHONE_MFA_ENABLED,
  beginPhoneEnrollment,
  beginTotpEnrollment,
  cancelPhoneEnrollment,
  cancelTotpEnrollment,
  challengePhoneFactor,
  getMfaState,
  verifyPhoneFactor,
  verifyTotpFactor,
} from "../../services/mfa";

import {
  clearCampaignSession,
} from "../../utils/campaignSession";

import {
  supabase,
} from "../../lib/supabase";

import styles from "./Mfa.module.css";

export default function MfaSetup() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const destination =
    location.state?.from ||
    "/workspaces";

  const visualPreview =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "preview",
    ) ===
      "methods";

  const [
    status,
    setStatus,
  ] = useState(
    "checking",
  );

  const [
    method,
    setMethod,
  ] = useState(
    PHONE_MFA_ENABLED
      ? "phone"
      : "totp",
  );

  const [
    phone,
    setPhone,
  ] = useState("");

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

    if (visualPreview) {
      setStatus(
        "ready",
      );

      return () => {
        active = false;
      };
    }

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
              replace: true,
            },
          );

          return;
        }

        try {
          const mfaState =
            await getMfaState();

          if (
            mfaState.isAal2
          ) {
            await restoreCampaignSession();

            navigate(
              destination,
              {
                replace: true,
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
                replace: true,
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
              : "Campaign Seat could not prepare two-step verification.",
          );
        }
      };

    void initialize();

    return () => {
      active = false;
    };
  }, [
    destination,
    navigate,
    visualPreview,
  ]);

  const chooseMethod =
    (nextMethod) => {
      if (
        nextMethod === "phone" &&
        !PHONE_MFA_ENABLED
      ) {
        return;
      }

      setMethod(
        nextMethod,
      );

      setEnrollment(
        null,
      );

      setCode("");
      setErrorMessage("");
    };

  const startEnrollment =
    async () => {
      setStatus(
        "starting",
      );

      setErrorMessage("");

      try {
        if (
          method === "phone"
        ) {
          const result =
            await beginPhoneEnrollment({
              phone,
            });

          setEnrollment(
            result,
          );

          setStatus(
            "enrolling",
          );

          return;
        }

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
            : "Two-step verification setup could not begin.",
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

      setErrorMessage("");

      try {
        if (
          method === "phone"
        ) {
          await verifyPhoneFactor({
            factorId:
              enrollment
                ?.factorId,

            challengeId:
              enrollment
                ?.challengeId,

            code,
          });
        } else {
          await verifyTotpFactor({
            factorId:
              enrollment
                ?.factorId,

            code,
          });
        }

        await restoreCampaignSession();

        setStatus(
          "complete",
        );

        window.setTimeout(
          () => {
            navigate(
              destination,
              {
                replace: true,
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
            : "The security code could not be verified.",
        );
      }
    };

  const resendPhoneCode =
    async () => {
      if (
        !enrollment
          ?.factorId
      ) {
        return;
      }

      setStatus(
        "starting",
      );

      setErrorMessage("");

      try {
        const challenge =
          await challengePhoneFactor({
            factorId:
              enrollment
                .factorId,
          });

        setEnrollment(
          (current) => ({
            ...current,
            challengeId:
              challenge
                .challengeId,
          }),
        );

        setCode("");

        setStatus(
          "enrolling",
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
            : "Campaign Seat could not resend the verification text.",
        );
      }
    };

  const cancelEnrollment =
    async () => {
      try {
        if (
          method === "phone"
        ) {
          await cancelPhoneEnrollment(
            enrollment
              ?.factorId,
          );
        } else {
          await cancelTotpEnrollment(
            enrollment
              ?.factorId,
          );
        }
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

      setErrorMessage("");
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

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(false),
        1600,
      );
    };

  const signOut =
    async () => {
      await clearCampaignSession();

      navigate(
        "/",
        {
          replace: true,
        },
      );
    };

  const phoneEnrollment =
    method === "phone";

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
                Two-step verification protects
                sensitive campaign operations
                after your password.
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
                Preparing verification
              </h1>

              <p>
                Campaign Seat is preparing
                your secure account.
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
                Security confirmed
              </h1>

              <p>
                Two-step verification is
                active. Opening Campaign
                Seat…
              </p>
            </div>
          ) : status ===
              "enrolling" ||
            status ===
              "verifying" ? (
            phoneEnrollment ? (
              <>
                <div
                  className={
                    styles.challengeIcon
                  }
                >
                  <MessageSquareText
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
                    Text message verification
                  </span>

                  <h1>
                    Enter the code we texted
                    you
                  </h1>

                  <p>
                    Campaign Seat sent a
                    six-digit security code
                    to{" "}
                    <strong>
                      {enrollment
                        ?.maskedPhone ||
                        "your phone"}
                    </strong>
                    .
                  </p>
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
                      Security code
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
                        Verify and continue
                      </>
                    )}
                  </button>

                  <div
                    className={
                      styles.inlineActions
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        resendPhoneCode
                      }
                      disabled={
                        status ===
                        "verifying"
                      }
                    >
                      Send another code
                    </button>

                    <button
                      type="button"
                      onClick={
                        cancelEnrollment
                      }
                      disabled={
                        status ===
                        "verifying"
                      }
                    >
                      Use another method
                    </button>
                  </div>
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
                    Authenticator setup
                  </span>

                  <h1>
                    Scan the QR code
                  </h1>

                  <p>
                    Open Google Authenticator,
                    Microsoft Authenticator,
                    Authy, 1Password, or your
                    phone&apos;s password
                    manager.
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
                      {enrollment
                        ?.secret}
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
                    Use another method
                  </button>
                </form>
              </>
            )
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
                  Secure your campaign
                  account
                </h1>

                <p>
                  Choose how you want to
                  receive security codes.
                  You can change or add
                  another method later.
                </p>
              </div>

              <div
                className={
                  styles.methodGrid
                }
              >
                <button
                  className={[
                    styles.methodCard,

                    method ===
                      "phone"
                      ? styles
                          .methodCardSelected
                      : "",

                    !PHONE_MFA_ENABLED
                      ? styles
                          .methodCardDisabled
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  disabled={
                    !PHONE_MFA_ENABLED
                  }
                  onClick={() =>
                    chooseMethod(
                      "phone",
                    )
                  }
                >
                  <span
                    className={
                      styles.methodIcon
                    }
                  >
                    <MessageSquareText
                      size={24}
                    />
                  </span>

                  <span
                    className={
                      styles.methodCopy
                    }
                  >
                    <strong>
                      Text message
                    </strong>

                    <small>
                      Easiest setup
                    </small>

                    <p>
                      Receive a six-digit
                      security code by SMS.
                    </p>
                  </span>

                  <span
                    className={
                      styles.methodBadge
                    }
                  >
                    {PHONE_MFA_ENABLED
                      ? "Recommended"
                      : "Provider setup pending"}
                  </span>
                </button>

                <button
                  className={[
                    styles.methodCard,

                    method ===
                      "totp"
                      ? styles
                          .methodCardSelected
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  onClick={() =>
                    chooseMethod(
                      "totp",
                    )
                  }
                >
                  <span
                    className={
                      styles.methodIcon
                    }
                  >
                    <QrCode
                      size={24}
                    />
                  </span>

                  <span
                    className={
                      styles.methodCopy
                    }
                  >
                    <strong>
                      Authenticator app
                    </strong>

                    <small>
                      Advanced option
                    </small>

                    <p>
                      Use a rotating code
                      from an authenticator
                      app.
                    </p>
                  </span>

                  <LockKeyhole
                    size={18}
                  />
                </button>
              </div>

              {method ===
                "phone" &&
              PHONE_MFA_ENABLED ? (
                <div
                  className={
                    styles.phoneSetup
                  }
                >
                  <label>
                    <span>
                      Mobile phone number
                    </span>

                    <div
                      className={
                        styles.phoneInput
                      }
                    >
                      <Smartphone
                        size={19}
                      />

                      <input
                        type="tel"
                        autoComplete="tel"
                        value={
                          phone
                        }
                        onChange={(
                          event,
                        ) => {
                          setPhone(
                            event.target
                              .value,
                          );

                          setErrorMessage(
                            "",
                          );
                        }}
                        placeholder="(561) 555-0123"
                      />
                    </div>
                  </label>

                  <p
                    className={
                      styles.consentCopy
                    }
                  >
                    By choosing Text message,
                    you agree to receive
                    security codes at this
                    number. Standard messaging
                    rates may apply.
                  </p>
                </div>
              ) : null}

              {!PHONE_MFA_ENABLED && (
                <div
                  className={
                    styles.providerNotice
                  }
                >
                  <MessageSquareText
                    size={18}
                  />

                  <span>
                    Text-message verification
                    is being activated.
                    Authenticator setup remains
                    available now.
                  </span>
                </div>
              )}

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
                disabled={
                  method ===
                    "phone" &&
                  (
                    !PHONE_MFA_ENABLED ||
                    !phone.trim()
                  )
                }
                onClick={
                  startEnrollment
                }
              >
                {method ===
                "phone" ? (
                  <>
                    <MessageSquareText
                      size={18}
                    />
                    Text me a code
                  </>
                ) : (
                  <>
                    <QrCode
                      size={18}
                    />
                    Set up authenticator
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
            </>
          )}
        </section>

        <footer
          className={
            styles.footer
          }
        >
          <Link to="/">
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
