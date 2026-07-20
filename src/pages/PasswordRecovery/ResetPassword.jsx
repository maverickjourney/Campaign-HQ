import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import LoginLayout from "../../layouts/LoginLayout/LoginLayout";

import {
  establishPasswordRecoverySession,
  updateCampaignPassword,
} from "../../services/auth";

import styles from "./PasswordRecovery.module.css";

export default function ResetPassword() {
  const [
    recoveryStatus,
    setRecoveryStatus,
  ] = useState("checking");

  const [
    recoveryError,
    setRecoveryError,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmation,
    setShowConfirmation,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  const requirements =
    useMemo(
      () => ({
        length:
          password.length >= 12,

        letter:
          /[A-Za-z]/.test(
            password,
          ),

        number:
          /\d/.test(
            password,
          ),

        matching:
          Boolean(password) &&
          password ===
            confirmation,
      }),
      [
        confirmation,
        password,
      ],
    );

  const passwordIsValid =
    Object.values(
      requirements,
    ).every(Boolean);

  useEffect(() => {
    let active = true;

    const initialize =
      async () => {
        try {
          await establishPasswordRecoverySession();

          if (active) {
            setRecoveryStatus(
              "ready",
            );
          }
        } catch (error) {
          if (!active) {
            return;
          }

          setRecoveryStatus(
            "invalid",
          );

          setRecoveryError(
            error instanceof Error
              ? error.message
              : "This password-reset link is invalid or has expired.",
          );
        }
      };

    initialize();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (!passwordIsValid) {
        setFormError(
          "Complete every password requirement before continuing.",
        );

        return;
      }

      setIsSaving(true);

      try {
        await updateCampaignPassword({
          password,
        });

        setRecoveryStatus(
          "complete",
        );

        setPassword("");
        setConfirmation("");
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "The new password could not be saved.",
        );
      } finally {
        setIsSaving(false);
      }
    };

  const renderContent =
    () => {
      if (
        recoveryStatus ===
        "checking"
      ) {
        return (
          <div
            className={
              styles.statusPanel
            }
          >
            <LoaderCircle
              className={
                styles.largeSpinner
              }
              size={38}
            />

            <span
              className={
                styles.eyebrow
              }
            >
              Secure verification
            </span>

            <h1>
              Checking recovery link
            </h1>

            <p>
              Campaign Seat is verifying
              that this password-reset
              request is valid.
            </p>
          </div>
        );
      }

      if (
        recoveryStatus ===
        "invalid"
      ) {
        return (
          <div
            className={
              styles.statusPanel
            }
          >
            <div
              className={
                styles.warningIcon
              }
            >
              <KeyRound
                size={29}
              />
            </div>

            <span
              className={
                styles.eyebrow
              }
            >
              Link unavailable
            </span>

            <h1>
              Request a new reset link
            </h1>

            <p>
              {recoveryError}
            </p>

            <Link
              className={
                styles.submitButton
              }
              to="/forgot-password"
            >
              Request another email
            </Link>

            <Link
              className={
                styles.backLink
              }
              to="/"
            >
              <ArrowLeft
                size={17}
              />
              Return to sign in
            </Link>
          </div>
        );
      }

      if (
        recoveryStatus ===
        "complete"
      ) {
        return (
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
                size={30}
              />
            </div>

            <span
              className={
                styles.eyebrow
              }
            >
              Password updated
            </span>

            <h1>
              Your account is secured
            </h1>

            <p>
              Your Campaign Seat password
              was changed successfully.
              Sign in again using the new
              password.
            </p>

            <Link
              className={
                styles.submitButton
              }
              to="/"
            >
              Continue to sign in
            </Link>
          </div>
        );
      }

      return (
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
              Campaign Seat
            </span>

            <h1>
              Create a new password
            </h1>

            <p>
              Choose a strong password
              that is not used for another
              campaign or personal
              account.
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
            <label
              className={
                styles.fieldGroup
              }
              htmlFor="new-password"
            >
              <span>
                New password
              </span>

              <div
                className={
                  styles.inputWrap
                }
              >
                <LockKeyhole
                  size={19}
                />

                <input
                  id="new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    password
                  }
                  onChange={(
                    event,
                  ) => {
                    setPassword(
                      event.target
                        .value,
                    );

                    setFormError(
                      "",
                    );
                  }}
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  autoFocus
                  disabled={
                    isSaving
                  }
                  required
                />

                <button
                  className={
                    styles.iconButton
                  }
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                  disabled={
                    isSaving
                  }
                  aria-label={
                    showPassword
                      ? "Hide new password"
                      : "Show new password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>
              </div>
            </label>

            <label
              className={
                styles.fieldGroup
              }
              htmlFor="confirm-password"
            >
              <span>
                Confirm new password
              </span>

              <div
                className={
                  styles.inputWrap
                }
              >
                <ShieldCheck
                  size={19}
                />

                <input
                  id="confirm-password"
                  type={
                    showConfirmation
                      ? "text"
                      : "password"
                  }
                  value={
                    confirmation
                  }
                  onChange={(
                    event,
                  ) => {
                    setConfirmation(
                      event.target
                        .value,
                    );

                    setFormError(
                      "",
                    );
                  }}
                  placeholder="Re-enter the new password"
                  autoComplete="new-password"
                  disabled={
                    isSaving
                  }
                  required
                />

                <button
                  className={
                    styles.iconButton
                  }
                  type="button"
                  onClick={() =>
                    setShowConfirmation(
                      (current) =>
                        !current,
                    )
                  }
                  disabled={
                    isSaving
                  }
                  aria-label={
                    showConfirmation
                      ? "Hide password confirmation"
                      : "Show password confirmation"
                  }
                >
                  {showConfirmation ? (
                    <EyeOff
                      size={18}
                    />
                  ) : (
                    <Eye
                      size={18}
                    />
                  )}
                </button>
              </div>
            </label>

            <div
              className={
                styles.requirementList
              }
            >
              <span>
                Password requirements
              </span>

              <p
                className={
                  requirements.length
                    ? styles.requirementMet
                    : ""
                }
              >
                <CheckCircle2
                  size={15}
                />
                At least 12 characters
              </p>

              <p
                className={
                  requirements.letter
                    ? styles.requirementMet
                    : ""
                }
              >
                <CheckCircle2
                  size={15}
                />
                Contains a letter
              </p>

              <p
                className={
                  requirements.number
                    ? styles.requirementMet
                    : ""
                }
              >
                <CheckCircle2
                  size={15}
                />
                Contains a number
              </p>

              <p
                className={
                  requirements.matching
                    ? styles.requirementMet
                    : ""
                }
              >
                <CheckCircle2
                  size={15}
                />
                Both entries match
              </p>
            </div>

            {formError && (
              <p
                className={
                  styles.errorMessage
                }
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              className={
                styles.submitButton
              }
              type="submit"
              disabled={
                isSaving ||
                !passwordIsValid
              }
            >
              {isSaving ? (
                <>
                  <LoaderCircle
                    className={
                      styles.spinner
                    }
                    size={19}
                  />
                  Securing account…
                </>
              ) : (
                <>
                  <KeyRound
                    size={19}
                  />
                  Save new password
                </>
              )}
            </button>
          </form>
        </>
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
                Protected password update
              </strong>

              <span>
                Recovery authorization is
                verified before changes
                are accepted.
              </span>
            </div>
          </div>

          {renderContent()}
        </section>

        <footer
          className={
            styles.footer
          }
        >
          <span>
            © 2026 Campaign Seat
          </span>

          <span>
            Authorized campaign use only
          </span>
        </footer>
      </div>
    </LoginLayout>
  );
}
