import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  QrCode,
  ShieldCheck,
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
  challengePhoneFactor,
  getMfaState,
  maskPhoneNumber,
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

function getFactorType(
  factor,
) {
  return (
    factor?.factorType ||
    factor?.factor_type ||
    (
      factor?.phone
        ? "phone"
        : "totp"
    )
  );
}

function getFactorLabel(
  factor,
  index,
) {
  if (
    getFactorType(
      factor,
    ) === "phone"
  ) {
    return `Text message · ${maskPhoneNumber(
      factor?.phone,
    )}`;
  }

  const storedName =
    String(
      factor?.friendly_name ||
      factor?.friendlyName ||
      "",
    )
      .replace(
        /\s+\d{14}$/,
        "",
      )
      .trim();

  if (storedName) {
    return storedName;
  }

  return index === 0
    ? "Authenticator app"
    : `Authenticator ${index + 1}`;
}

export default function MfaChallenge() {
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
      "sms";

  const [
    status,
    setStatus,
  ] = useState(
    "checking",
  );

  const [
    factors,
    setFactors,
  ] = useState([]);

  const [
    selectedFactorId,
    setSelectedFactorId,
  ] = useState("");

  const [
    challengeId,
    setChallengeId,
  ] = useState("");

  const [
    code,
    setCode,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(0);

  const selectedFactor =
    useMemo(
      () =>
        factors.find(
          (factor) =>
            factor.id ===
            selectedFactorId,
        ) ||
        factors[0] ||
        null,
      [
        factors,
        selectedFactorId,
      ],
    );

  const selectedType =
    getFactorType(
      selectedFactor,
    );

  const phoneSelected =
    selectedType ===
    "phone";

  useEffect(() => {
    let active = true;

    if (visualPreview) {
      const previewFactors = [
        {
          id: "preview-phone",
          factorType: "phone",
          factor_type: "phone",
          status: "verified",
          phone: "+15615550123",
          friendly_name:
            "Campaign Seat Text Message",
        },
        {
          id: "preview-totp",
          factorType: "totp",
          factor_type: "totp",
          status: "verified",
          friendly_name:
            "Campaign Seat Authenticator",
        },
      ];

      setFactors(
        previewFactors,
      );

      setSelectedFactorId(
        "preview-phone",
      );

      setChallengeId("");
      setCode("");
      setErrorMessage("");
      setResendSeconds(0);

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

          const verifiedFactors =
            mfaState
              .verifiedFactors ||
            [];

          if (
            !verifiedFactors.length
          ) {
            navigate(
              "/mfa/setup",
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

          setFactors(
            verifiedFactors,
          );

          setSelectedFactorId(
            verifiedFactors[0].id,
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

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setResendSeconds(
            (current) =>
              Math.max(
                0,
                current - 1,
              ),
          );
        },
        1000,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    resendSeconds,
  ]);

  const selectFactor =
    (factorId) => {
      setSelectedFactorId(
        factorId,
      );

      setChallengeId("");
      setCode("");
      setErrorMessage("");
      setResendSeconds(0);
    };

  const sendPhoneCode =
    async () => {
      if (
        !selectedFactor ||
        !phoneSelected ||
        resendSeconds > 0
      ) {
        return;
      }

      if (visualPreview) {
        setErrorMessage("");

        setChallengeId(
          "preview-sms-challenge",
        );

        setCode("");
        setResendSeconds(30);

        setStatus(
          "ready",
        );

        return;
      }

      if (!PHONE_MFA_ENABLED) {
        setErrorMessage(
          "Text-message verification is not enabled in this environment yet.",
        );

        return;
      }

      setStatus(
        "sending",
      );

      setErrorMessage("");

      try {
        const result =
          await challengePhoneFactor({
            factorId:
              selectedFactor.id,
          });

        setChallengeId(
          result.challengeId,
        );

        setCode("");
        setResendSeconds(30);

        setStatus(
          "ready",
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
            : "Campaign Seat could not send the verification text.",
        );
      }
    };

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        !selectedFactor ||
        code.length !== 6
      ) {
        setErrorMessage(
          "Enter the complete six-digit security code.",
        );

        return;
      }

      if (
        phoneSelected &&
        !challengeId
      ) {
        setErrorMessage(
          "Send a text code first.",
        );

        return;
      }

      setStatus(
        "verifying",
      );

      setErrorMessage("");

      try {
        if (
          phoneSelected
        ) {
          await verifyPhoneFactor({
            factorId:
              selectedFactor.id,

            challengeId,

            code,
          });
        } else {
          await verifyTotpFactor({
            factorId:
              selectedFactor.id,

            code,
          });
        }

        await restoreCampaignSession();

        navigate(
          destination,
          {
            replace: true,
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
            : "The security code could not be verified.",
        );
      }
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
                Password accepted.
                Complete your second
                security step to continue.
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
                Checking security methods
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
                {phoneSelected ? (
                  <MessageSquareText
                    size={30}
                  />
                ) : (
                  <QrCode
                    size={30}
                  />
                )}
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
                  Security code required
                </span>

                <h1>
                  Verify your identity
                </h1>

                <p>
                  Choose a trusted security
                  method connected to this
                  account.
                </p>
              </div>

              <div
                className={
                  styles.factorChoices
                }
              >
                <span>
                  Verification method
                </span>

                <div
                  className={
                    styles.factorChoiceList
                  }
                >
                  {factors.map(
                    (
                      factor,
                      index,
                    ) => {
                      const selected =
                        factor.id ===
                        selectedFactor
                          ?.id;

                      const type =
                        getFactorType(
                          factor,
                        );

                      return (
                        <button
                          className={[
                            styles.factorChoice,

                            selected
                              ? styles.factorChoiceSelected
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          type="button"
                          key={
                            factor.id
                          }
                          aria-pressed={
                            selected
                          }
                          onClick={() =>
                            selectFactor(
                              factor.id,
                            )
                          }
                          disabled={
                            status ===
                            "verifying" ||
                            status ===
                            "sending"
                          }
                        >
                          {type ===
                          "phone" ? (
                            <MessageSquareText
                              size={18}
                            />
                          ) : (
                            <QrCode
                              size={18}
                            />
                          )}

                          <span>
                            {getFactorLabel(
                              factor,
                              index,
                            )}
                          </span>

                          {selected && (
                            <CheckCircle2
                              size={17}
                            />
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {phoneSelected &&
              !challengeId ? (
                <div
                  className={
                    styles.deliveryPanel
                  }
                >
                  <MessageSquareText
                    size={22}
                  />

                  <div>
                    <strong>
                      Send a security code
                    </strong>

                    <span>
                      We&apos;ll text a
                      six-digit code to{" "}
                      {maskPhoneNumber(
                        selectedFactor
                          ?.phone,
                      )}
                      .
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={
                      sendPhoneCode
                    }
                    disabled={
                      status ===
                        "sending" ||
                      resendSeconds > 0 ||
                      (
                        !PHONE_MFA_ENABLED &&
                        !visualPreview
                      )
                    }
                  >
                    {status ===
                    "sending"
                      ? "Sending…"
                      : "Text me a code"}
                  </button>
                </div>
              ) : (
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
                      {phoneSelected
                        ? "Text message code"
                        : "Authenticator code"}
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

                  {phoneSelected && (
                    <div
                      className={
                        styles.inlineActions
                      }
                    >
                      <button
                        type="button"
                        onClick={
                          sendPhoneCode
                        }
                        disabled={
                          status ===
                            "verifying" ||
                          status ===
                            "sending" ||
                          resendSeconds > 0
                        }
                      >
                        {resendSeconds > 0
                          ? `Send another code in ${resendSeconds}s`
                          : status === "sending"
                            ? "Sending…"
                            : "Send another code"}
                      </button>
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
                    type="submit"
                    disabled={
                      status ===
                        "verifying" ||
                      code.length !==
                        6 ||
                      !selectedFactor
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
                </form>
              )}

              {errorMessage &&
              phoneSelected &&
              !challengeId ? (
                <p
                  className={
                    styles.errorMessage
                  }
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : null}

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
