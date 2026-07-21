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

function getFactorLabel(
  factor,
  index,
) {
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
    ? "Primary authenticator"
    : `Backup authenticator ${index}`;
}

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
    factors,
    setFactors,
  ] = useState([]);

  const [
    selectedFactorId,
    setSelectedFactorId,
  ] = useState("");

  const [
    code,
    setCode,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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
            mfaState.isAal2
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

  const selectFactor =
    (factorId) => {
      setSelectedFactorId(
        factorId,
      );

      setCode("");

      setErrorMessage(
        "",
      );
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
          "Choose an authenticator and enter its complete six-digit code.",
        );

        return;
      }

      setStatus(
        "verifying",
      );

      setErrorMessage(
        "",
      );

      try {
        await verifyTotpFactor({
          factorId:
            selectedFactor.id,

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
                an enrolled authenticator
                to continue.
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
                Checking authenticators
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
                  Use a code from one of
                  the trusted authenticators
                  connected to this account.
                </p>
              </div>

              {factors.length >
                1 && (
                <div
                  className={
                    styles.factorChoices
                  }
                >
                  <span>
                    Choose authenticator
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
                              "verifying"
                            }
                          >
                            <Smartphone
                              size={18}
                            />

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
              )}

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
