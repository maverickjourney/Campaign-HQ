import {
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import LoginLayout from "../../layouts/LoginLayout/LoginLayout";

import {
  requestCampaignPasswordReset,
} from "../../services/auth";

import styles from "./PasswordRecovery.module.css";

export default function ForgotPassword() {
  const location =
    useLocation();

  const [email, setEmail] =
    useState(
      String(
        location.state?.email ||
          "",
      ),
    );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        setErrorMessage(
          "Enter the email address used for your Campaign Seat account.",
        );

        return;
      }

      setIsSubmitting(true);
      setErrorMessage("");

      try {
        await requestCampaignPasswordReset({
          email:
            normalizedEmail,
        });

        setSubmitted(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The recovery request could not be completed.",
        );
      } finally {
        setIsSubmitting(false);
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
                Secure account recovery
              </strong>

              <span>
                Recovery links are sent
                only through Campaign
                Seat authentication.
              </span>
            </div>
          </div>

          {submitted ? (
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
                Check your inbox
              </span>

              <h1>
                Recovery email requested
              </h1>

              <p>
                If an eligible Campaign
                Seat account exists for
                <strong>
                  {" "}
                  {email.trim()}
                </strong>
                , a secure password-reset
                link will arrive shortly.
              </p>

              <p
                className={
                  styles.supportingCopy
                }
              >
                Check spam or junk mail
                before requesting another
                link. Only the newest
                recovery link should be
                used.
              </p>

              <button
                className={
                  styles.secondaryButton
                }
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setErrorMessage("");
                }}
              >
                Send another request
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
                  Enter the email address
                  assigned to your campaign
                  account. We will send a
                  secure recovery link.
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
                    Campaign email address
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
                      value={email}
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
                        isSubmitting
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
                    styles.submitButton
                  }
                  type="submit"
                  disabled={
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle
                        className={
                          styles.spinner
                        }
                        size={19}
                      />
                      Sending recovery
                      email…
                    </>
                  ) : (
                    <>
                      <Mail
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
