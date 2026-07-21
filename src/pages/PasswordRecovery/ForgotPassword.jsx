import {
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import LoginLayout from "../../layouts/LoginLayout/LoginLayout";

import TurnstileChallenge from "../../components/security/TurnstileChallenge/TurnstileChallenge";

import {
  requestCampaignPasswordReset,
} from "../../services/auth";

import styles from "./PasswordRecovery.module.css";

export default function ForgotPassword() {
  const location =
    useLocation();

  const turnstileRef =
    useRef(null);

  const [
    email,
    setEmail,
  ] = useState(
    String(
      location.state
        ?.email ||
        "",
    ),
  );

  const [
    captchaToken,
    setCaptchaToken,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState(
    "ready",
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const isSending =
    status ===
    "sending";

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault();

      setErrorMessage(
        "",
      );

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail,
        )
      ) {
        setErrorMessage(
          "Enter the email address used for your Campaign Seat account.",
        );

        return;
      }

      if (
        !captchaToken
      ) {
        setErrorMessage(
          "Wait for the browser security check to finish.",
        );

        return;
      }

      setStatus(
        "sending",
      );

      try {
        await requestCampaignPasswordReset({
          email:
            normalizedEmail,

          captchaToken,
        });

        setStatus(
          "sent",
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
            : "Campaign Seat could not send the recovery email.",
        );
      } finally {
        setCaptchaToken(
          "",
        );

        turnstileRef
          .current?.reset();
      }
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
                Protected account recovery
              </strong>

              <span>
                Recovery requests are checked before an email is sent.
              </span>
            </div>
          </div>

          {status ===
          "sent" ? (
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
                Recovery email sent
              </span>

              <h1>
                Check your inbox
              </h1>

              <p>
                A secure password-reset link was sent to{" "}
                <strong>
                  {email
                    .trim()
                    .toLowerCase()}
                </strong>
                .
              </p>

              <Link
                className={
                  styles.submitButton
                }
                to="/"
              >
                Return to sign in
              </Link>
            </div>
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
                  Campaign Seat
                </span>

                <h1>
                  Reset your password
                </h1>

                <p>
                  Enter your Campaign Seat email and we will send a protected recovery link.
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
                  htmlFor="recovery-email"
                >
                  <span>
                    Email address
                  </span>

                  <div
                    className={
                      styles.inputWrap
                    }
                  >
                    <Mail
                      size={19}
                    />

                    <input
                      id="recovery-email"
                      type="email"
                      value={
                        email
                      }
                      onChange={(
                        event,
                      ) => {
                        setEmail(
                          event.target
                            .value,
                        );

                        setErrorMessage(
                          "",
                        );
                      }}
                      placeholder="you@campaign.com"
                      autoComplete="email"
                      autoFocus
                      disabled={
                        isSending
                      }
                      required
                    />
                  </div>
                </label>

                <TurnstileChallenge
                  ref={
                    turnstileRef
                  }
                  action="password_reset"
                  onTokenChange={
                    setCaptchaToken
                  }
                />

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
                    styles.submitButton
                  }
                  type="submit"
                  disabled={
                    isSending ||
                    !captchaToken
                  }
                >
                  {isSending ? (
                    <>
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={19}
                      />

                      Sending securely…
                    </>
                  ) : (
                    <>
                      <KeyRound
                        size={19}
                      />

                      Send recovery email
                    </>
                  )}
                </button>

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
              </form>
            </>
          )}
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
