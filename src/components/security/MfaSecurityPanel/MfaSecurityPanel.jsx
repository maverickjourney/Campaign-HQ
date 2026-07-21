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
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  beginTotpEnrollment,
  cancelTotpEnrollment,
  getMfaState,
  removeMfaFactor,
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

export default function MfaSecurityPanel() {
  const [
    mfaState,
    setMfaState,
  ] = useState(null);

  const [
    enrollment,
    setEnrollment,
  ] = useState(null);

  const [
    code,
    setCode,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("loading");

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

        setErrorMessage(
          "",
        );

        try {
          const state =
            await getMfaState();

          setMfaState(
            state,
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
              : "Campaign Seat could not load authenticator settings.",
          );
        }
      },
      [],
    );

  useEffect(() => {
    loadMfaState();
  }, [
    loadMfaState,
  ]);

  const verifiedFactors =
    mfaState
      ?.verifiedFactors ||
    [];

  const hasBackupFactor =
    verifiedFactors.length >=
    2;

  const startBackupEnrollment =
    async () => {
      setStatus(
        "starting",
      );

      setErrorMessage(
        "",
      );

      setSuccessMessage(
        "",
      );

      try {
        const result =
          await beginTotpEnrollment({
            friendlyName:
              verifiedFactors.length
                ? "Campaign Seat Backup Authenticator"
                : "Campaign Seat Authenticator",
          });

        setEnrollment(
          result,
        );

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
            : "Campaign Seat could not begin backup-authenticator setup.",
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
          "Enter the complete six-digit code from the new authenticator.",
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
        const result =
          await verifyTotpFactor({
            factorId:
              enrollment.factorId,

            code,
          });

        setMfaState(
          result.state,
        );

        setEnrollment(
          null,
        );

        setCode("");

        setStatus(
          "ready",
        );

        setSuccessMessage(
          "The additional authenticator was verified successfully.",
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
      setErrorMessage(
        "",
      );

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
          .writeText(
            secret,
          );

        setCopied(
          true,
        );

        window.setTimeout(
          () => {
            setCopied(
              false,
            );
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
          "The final authenticator cannot be removed from a protected leadership account. Add a backup authenticator first.",
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Remove this authenticator from your Campaign Seat account? You will no longer be able to use codes from that device.",
        );

      if (!confirmed) {
        return;
      }

      setRemovingFactorId(
        factor.id,
      );

      setErrorMessage(
        "",
      );

      setSuccessMessage(
        "",
      );

      try {
        const state =
          await removeMfaFactor(
            factor.id,
          );

        setMfaState(
          state,
        );

        setSuccessMessage(
          "The authenticator was removed successfully.",
        );
      } catch (
        error
      ) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The authenticator could not be removed.",
        );
      } finally {
        setRemovingFactorId(
          "",
        );
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
            Authenticator protection
          </h2>

          <p>
            Manage the authenticator apps
            permitted to verify this
            Campaign Seat account.
          </p>
        </div>

        <div
          className={
            hasBackupFactor
              ? styles.secureBadge
              : styles.warningBadge
          }
        >
          {hasBackupFactor ? (
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
            : "Backup recommended"}
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
            Loading authenticator
            security…
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

          {!hasBackupFactor &&
            !enrollment && (
              <div
                className={
                  styles.backupNotice
                }
              >
                <Smartphone
                  size={25}
                />

                <div>
                  <strong>
                    Add a backup
                    authenticator
                  </strong>

                  <p>
                    Connect a second
                    trusted phone,
                    password manager or
                    authenticator app so
                    you retain access if
                    the primary device is
                    lost.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    startBackupEnrollment
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
                      size={17}
                    />
                  ) : (
                    <Plus
                      size={17}
                    />
                  )}

                  Add backup
                </button>
              </div>
            )}

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
                  Verified factors
                </span>

                <strong>
                  {
                    verifiedFactors.length
                  }{" "}
                  authenticator
                  {verifiedFactors.length ===
                  1
                    ? ""
                    : "s"}
                </strong>
              </div>

              {hasBackupFactor &&
                !enrollment && (
                  <button
                    className={
                      styles.addButton
                    }
                    type="button"
                    onClick={
                      startBackupEnrollment
                    }
                    disabled={
                      status ===
                      "starting"
                    }
                  >
                    <Plus
                      size={16}
                    />

                    Add another
                  </button>
                )}
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
                ) => (
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
                      <Smartphone
                        size={20}
                      />
                    </div>

                    <div
                      className={
                        styles.factorDetails
                      }
                    >
                      <strong>
                        {index ===
                        0
                          ? "Primary authenticator"
                          : `Backup authenticator ${index}`}
                      </strong>

                      <span>
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
                          ? "Add a backup authenticator before removing this factor."
                          : "Remove authenticator"
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
                ),
              )}
            </div>
          </div>

          {enrollment && (
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
                    Connect the backup
                    authenticator
                  </strong>

                  <span>
                    Scan this new QR code
                    using the additional
                    trusted device.
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
                  alt="Backup authenticator QR code"
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
                    Six-digit code from
                    the backup device
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

                    Verify backup
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
