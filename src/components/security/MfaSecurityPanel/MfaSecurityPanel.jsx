import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Clipboard,
  KeyRound,
  LoaderCircle,
  MessageSquareText,
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  PHONE_MFA_ENABLED,
  beginPhoneEnrollment,
  beginTotpEnrollment,
  cancelPhoneEnrollment,
  cancelTotpEnrollment,
  challengePhoneFactor,
  getMfaState,
  maskPhoneNumber,
  removeMfaFactor,
  verifyPhoneFactor,
  verifyTotpFactor,
} from "../../../services/mfa";

import styles from "./MfaSecurityPanel.module.css";

function formatFactorDate(value) {
  if (!value) {
    return "Enrollment date unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Enrollment date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function getFactorType(factor) {
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

function getAuthenticatorName(
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
    ? "Authenticator app"
    : `Authenticator app ${index + 1}`;
}

export default function MfaSecurityPanel({
  onStateChange = null,
}) {
  const [
    mfaState,
    setMfaState,
  ] = useState(null);

  const [
    enrollment,
    setEnrollment,
  ] = useState(null);

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    code,
    setCode,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState(
    "loading",
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    removingFactorId,
    setRemovingFactorId,
  ] = useState("");

  const loadMfaState =
    useCallback(
      async () => {
        setStatus(
          "loading",
        );

        setErrorMessage("");

        try {
          const state =
            await getMfaState();

          setMfaState(state);

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
              : "Campaign Seat could not load two-step verification settings.",
          );
        }
      },
      [],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadMfaState();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadMfaState,
  ]);

  useEffect(() => {
    if (
      mfaState &&
      typeof onStateChange ===
        "function"
    ) {
      onStateChange(
        mfaState,
      );
    }
  }, [
    mfaState,
    onStateChange,
  ]);

  const verifiedFactors =
    mfaState
      ?.verifiedFactors ||
    [];

  const verifiedTotpFactors =
    mfaState
      ?.verifiedTotpFactors ||
    [];

  const verifiedPhoneFactors =
    mfaState
      ?.verifiedPhoneFactors ||
    [];

  const hasBackupFactor =
    verifiedFactors.length >=
    2;

  const hasAuthenticator =
    verifiedTotpFactors.length >
    0;

  const hasPhone =
    verifiedPhoneFactors.length >
    0;

  const startAuthenticatorEnrollment =
    async () => {
      setStatus(
        "starting",
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const result =
          await beginTotpEnrollment({
            friendlyName:
              hasAuthenticator
                ? `Campaign Seat Authenticator ${verifiedTotpFactors.length + 1}`
                : "Campaign Seat Authenticator",
          });

        setEnrollment({
          ...result,
          type: "totp",
        });

        setCode("");

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
            : "Campaign Seat could not begin authenticator setup.",
        );
      }
    };

  const startPhoneEnrollment =
    async () => {
      setStatus(
        "starting-phone",
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const result =
          await beginPhoneEnrollment({
            phone,
          });

        setEnrollment({
          ...result,
          type: "phone",
        });

        setCode("");

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
            : "Campaign Seat could not begin text-message verification.",
        );
      }
    };

  const verifyEnrollment =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        !enrollment
          ?.factorId ||
        code.length !==
          6
      ) {
        setErrorMessage(
          "Enter the complete six-digit security code.",
        );

        return;
      }

      setStatus(
        "verifying",
      );

      setErrorMessage("");

      try {
        const result =
          enrollment.type ===
          "phone"
            ? await verifyPhoneFactor({
                factorId:
                  enrollment.factorId,

                challengeId:
                  enrollment.challengeId,

                code,
              })
            : await verifyTotpFactor({
                factorId:
                  enrollment.factorId,

                code,
              });

        setMfaState(
          result.state,
        );

        setEnrollment(null);
        setPhone("");
        setCode("");

        setStatus(
          "ready",
        );

        setSuccessMessage(
          enrollment.type ===
            "phone"
            ? "Text-message verification was added successfully."
            : "Authenticator verification was added successfully.",
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
        enrollment?.type !==
          "phone" ||
        !enrollment
          ?.factorId
      ) {
        return;
      }

      setErrorMessage("");

      try {
        const result =
          await challengePhoneFactor({
            factorId:
              enrollment.factorId,
          });

        setEnrollment(
          (current) => ({
            ...current,
            challengeId:
              result.challengeId,
          }),
        );

        setCode("");

        setSuccessMessage(
          "A new security code was sent.",
        );
      } catch (
        error
      ) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Campaign Seat could not resend the security code.",
        );
      }
    };

  const cancelEnrollment =
    async () => {
      setErrorMessage("");

      try {
        if (
          enrollment?.type ===
          "phone"
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
        console.error(error);
      }

      setEnrollment(null);
      setPhone("");
      setCode("");

      setStatus(
        "ready",
      );
    };

  const copySetupKey =
    async () => {
      const secret =
        enrollment
          ?.secret;

      if (!secret) {
        return;
      }

      try {
        await navigator
          .clipboard
          .writeText(secret);

        setCopied(true);

        window.setTimeout(
          () => {
            setCopied(false);
          },
          1600,
        );
      } catch {
        setErrorMessage(
          "The setup key could not be copied automatically.",
        );
      }
    };

  const removeFactor =
    async (
      factor,
    ) => {
      if (
        verifiedFactors.length <=
        1
      ) {
        setErrorMessage(
          "The final verification method cannot be removed from a protected leadership account. Add another method first.",
        );

        return;
      }

      const factorType =
        getFactorType(
          factor,
        );

      const methodName =
        factorType ===
        "phone"
          ? "text-message verification"
          : "this authenticator";

      const confirmed =
        window.confirm(
          `Remove ${methodName} from your Campaign Seat account?`,
        );

      if (!confirmed) {
        return;
      }

      setRemovingFactorId(
        factor.id,
      );

      setErrorMessage("");
      setSuccessMessage("");

      try {
        const state =
          await removeMfaFactor(
            factor.id,
          );

        setMfaState(state);

        setSuccessMessage(
          "The verification method was removed successfully.",
        );
      } catch (
        error
      ) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The verification method could not be removed.",
        );
      } finally {
        setRemovingFactorId("");
      }
    };

  return (
    <section
      className={
        styles.securityCard
      }
    >
      <header
        className={
          styles.cardHeader
        }
      >
        <div
          className={
            styles.headerIcon
          }
        >
          <ShieldCheck
            size={22}
          />
        </div>

        <div>
          <span>
            Security and MFA
          </span>

          <h2>
            Two-step verification
          </h2>

          <p>
            Manage the trusted methods
            permitted to verify this
            Campaign Seat account.
          </p>
        </div>

        <div
          className={
            verifiedFactors.length
              ? styles.secureBadge
              : styles.warningBadge
          }
        >
          {verifiedFactors.length ? (
            <CheckCircle2
              size={17}
            />
          ) : (
            <TriangleAlert
              size={17}
            />
          )}

          {hasBackupFactor
            ? "Backup protected"
            : verifiedFactors.length
              ? "1 method active"
              : "Setup required"}
        </div>
      </header>

      {status ===
      "loading" ? (
        <div
          className={
            styles.loadingState
          }
        >
          <LoaderCircle
            className={
              styles.spinner
            }
            size={28}
          />

          <span>
            Loading two-step
            verification…
          </span>
        </div>
      ) : (
        <div
          className={
            styles.cardBody
          }
        >
          {errorMessage && (
            <div
              className={
                styles.errorBanner
              }
              role="alert"
            >
              <TriangleAlert
                size={18}
              />

              <span>
                {errorMessage}
              </span>
            </div>
          )}

          {successMessage && (
            <div
              className={
                styles.successBanner
              }
              role="status"
            >
              <CheckCircle2
                size={18}
              />

              <span>
                {successMessage}
              </span>
            </div>
          )}

          <div
            className={
              styles.methodOverview
            }
          >
            <article
              className={[
                styles.methodCard,
                !PHONE_MFA_ENABLED &&
                !hasPhone
                  ? styles.methodCardPending
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={
                  styles.methodIcon
                }
              >
                <MessageSquareText
                  size={22}
                />
              </div>

              <div
                className={
                  styles.methodCopy
                }
              >
                <strong>
                  Text message
                </strong>

                <span>
                  Receive a six-digit
                  security code by SMS.
                </span>

                {hasPhone && (
                  <small>
                    {maskPhoneNumber(
                      verifiedPhoneFactors[0]
                        ?.phone,
                    )}
                  </small>
                )}
              </div>

              <span
                className={[
                  styles.methodStatus,
                  hasPhone
                    ? styles.methodStatusActive
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {hasPhone
                  ? "Active"
                  : PHONE_MFA_ENABLED
                    ? "Available"
                    : "Activation pending"}
              </span>

              {PHONE_MFA_ENABLED &&
              !hasPhone &&
              !enrollment ? (
                <div
                  className={
                    styles.phoneMethodActions
                  }
                >
                  <div
                    className={
                      styles.phoneInput
                    }
                  >
                    <Smartphone
                      size={17}
                    />

                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
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

                  <button
                    type="button"
                    onClick={
                      startPhoneEnrollment
                    }
                    disabled={
                      !phone.trim() ||
                      status ===
                        "starting-phone"
                    }
                  >
                    {status ===
                    "starting-phone" ? (
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={16}
                      />
                    ) : (
                      <MessageSquareText
                        size={16}
                      />
                    )}

                    Send code
                  </button>
                </div>
              ) : null}
            </article>

            <article
              className={
                styles.methodCard
              }
            >
              <div
                className={
                  styles.methodIcon
                }
              >
                <QrCode
                  size={22}
                />
              </div>

              <div
                className={
                  styles.methodCopy
                }
              >
                <strong>
                  Authenticator app
                </strong>

                <span>
                  Use rotating codes from
                  a trusted authenticator
                  app or password manager.
                </span>
              </div>

              <span
                className={[
                  styles.methodStatus,
                  hasAuthenticator
                    ? styles.methodStatusActive
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {hasAuthenticator
                  ? "Active"
                  : "Available"}
              </span>

              {!enrollment && (
                <button
                  className={
                    styles.methodAction
                  }
                  type="button"
                  onClick={
                    startAuthenticatorEnrollment
                  }
                  disabled={
                    status ===
                    "starting"
                  }
                >
                  {status ===
                  "starting" ? (
                    <LoaderCircle
                      className={
                        styles.spinner
                      }
                      size={16}
                    />
                  ) : (
                    <Plus
                      size={16}
                    />
                  )}

                  {hasAuthenticator
                    ? "Add another"
                    : "Add authenticator"}
                </button>
              )}
            </article>
          </div>

          {!PHONE_MFA_ENABLED &&
          !hasPhone ? (
            <div
              className={
                styles.providerNotice
              }
            >
              <MessageSquareText
                size={18}
              />

              <div>
                <strong>
                  Text-message verification
                  is being activated
                </strong>

                <span>
                  Authenticator verification
                  remains available while
                  the SMS provider setup is
                  completed.
                </span>
              </div>
            </div>
          ) : null}

          <div
            className={
              styles.factorSection
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  Verified methods
                </span>

                <strong>
                  {
                    verifiedFactors.length
                  }{" "}
                  verification method
                  {verifiedFactors.length ===
                  1
                    ? ""
                    : "s"}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.factorList
              }
            >
              {verifiedFactors.map(
                (
                  factor,
                  index,
                ) => {
                  const factorType =
                    getFactorType(
                      factor,
                    );

                  const phoneFactor =
                    factorType ===
                    "phone";

                  return (
                    <article
                      className={
                        styles.factorRow
                      }
                      key={
                        factor.id
                      }
                    >
                      <div
                        className={
                          styles.factorIcon
                        }
                      >
                        {phoneFactor ? (
                          <MessageSquareText
                            size={20}
                          />
                        ) : (
                          <QrCode
                            size={20}
                          />
                        )}
                      </div>

                      <div
                        className={
                          styles.factorDetails
                        }
                      >
                        <strong>
                          {phoneFactor
                            ? "Text message"
                            : getAuthenticatorName(
                                factor,
                                index,
                              )}
                        </strong>

                        <span>
                          {phoneFactor
                            ? `${maskPhoneNumber(
                                factor.phone,
                              )} · `
                            : ""}
                          Verified{" "}
                          {formatFactorDate(
                            factor.created_at,
                          )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.verifiedStatus
                        }
                      >
                        <CheckCircle2
                          size={15}
                        />
                        Verified
                      </div>

                      <button
                        className={
                          styles.removeButton
                        }
                        type="button"
                        onClick={() =>
                          removeFactor(
                            factor,
                          )
                        }
                        disabled={
                          verifiedFactors.length <=
                            1 ||
                          removingFactorId ===
                            factor.id
                        }
                        title={
                          verifiedFactors.length <=
                          1
                            ? "Add another verification method before removing this one."
                            : "Remove verification method"
                        }
                      >
                        {removingFactorId ===
                        factor.id ? (
                          <LoaderCircle
                            className={
                              styles.spinner
                            }
                            size={17}
                          />
                        ) : (
                          <Trash2
                            size={17}
                          />
                        )}

                        Remove
                      </button>
                    </article>
                  );
                },
              )}
            </div>
          </div>

          {enrollment?.type ===
            "totp" && (
            <div
              className={
                styles.enrollmentPanel
              }
            >
              <div
                className={
                  styles.enrollmentHeading
                }
              >
                <QrCode
                  size={21}
                />

                <div>
                  <strong>
                    Connect authenticator
                    app
                  </strong>

                  <span>
                    Scan this QR code using
                    the trusted app or
                    password manager you
                    want to add.
                  </span>
                </div>
              </div>

              <div
                className={
                  styles.qrGrid
                }
              >
                <img
                  src={
                    enrollment.qrCode
                  }
                  alt="Authenticator setup QR code"
                />

                <div
                  className={
                    styles.manualSetup
                  }
                >
                  <strong>
                    Cannot scan it?
                  </strong>

                  <span>
                    Enter this setup key
                    manually:
                  </span>

                  <code>
                    {
                      enrollment.secret
                    }
                  </code>

                  <button
                    type="button"
                    onClick={
                      copySetupKey
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
                  styles.verificationForm
                }
                onSubmit={
                  verifyEnrollment
                }
              >
                <label>
                  <span>
                    Six-digit
                    authenticator code
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
                      value={code}
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
                      disabled={
                        status ===
                        "verifying"
                      }
                      required
                    />
                  </div>
                </label>

                <div
                  className={
                    styles.enrollmentActions
                  }
                >
                  <button
                    className={
                      styles.verifyButton
                    }
                    type="submit"
                    disabled={
                      code.length !==
                        6 ||
                      status ===
                        "verifying"
                    }
                  >
                    {status ===
                    "verifying" ? (
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={17}
                      />
                    ) : (
                      <ShieldCheck
                        size={17}
                      />
                    )}

                    Verify authenticator
                  </button>

                  <button
                    className={
                      styles.cancelButton
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
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {enrollment?.type ===
            "phone" && (
            <div
              className={
                styles.enrollmentPanel
              }
            >
              <div
                className={
                  styles.enrollmentHeading
                }
              >
                <MessageSquareText
                  size={21}
                />

                <div>
                  <strong>
                    Verify text message
                  </strong>

                  <span>
                    Enter the six-digit code
                    sent to{" "}
                    {enrollment
                      .maskedPhone}.
                  </span>
                </div>
              </div>

              <form
                className={
                  styles.verificationForm
                }
                onSubmit={
                  verifyEnrollment
                }
              >
                <label>
                  <span>
                    Text message code
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
                      value={code}
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
                      disabled={
                        status ===
                        "verifying"
                      }
                      required
                    />
                  </div>
                </label>

                <div
                  className={
                    styles.enrollmentActions
                  }
                >
                  <button
                    className={
                      styles.verifyButton
                    }
                    type="submit"
                    disabled={
                      code.length !==
                        6 ||
                      status ===
                        "verifying"
                    }
                  >
                    <ShieldCheck
                      size={17}
                    />
                    Verify text message
                  </button>

                  <button
                    className={
                      styles.cancelButton
                    }
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
                    className={
                      styles.cancelButton
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
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
