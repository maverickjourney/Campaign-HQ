import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { signInToCampaign } from "../../../services/auth";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState({
      email: "",
      password: "",
      remember: false,
    });

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      setMessage(
        "Enter your email address and password.",
      );
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const result =
        await signInToCampaign({
          email:
            formData.email,

          password:
            formData.password,
        });

      if (
        result?.status ===
        "mfa-setup"
      ) {
        navigate(
          "/mfa/setup",
          {
            replace:
              true,

            state: {
              from:
                "/workspaces",
            },
          },
        );

        return;
      }

      if (
        result?.status ===
        "mfa-challenge"
      ) {
        navigate(
          "/mfa/challenge",
          {
            replace:
              true,

            state: {
              from:
                "/workspaces",
            },
          },
        );

        return;
      }

      navigate(
        "/workspaces",
        {
          replace:
            true,
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Campaign HQ could not sign you in.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.loginCard}>
        <div
          className={styles.accentBars}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <div className={styles.security}>
          <ShieldCheck size={21} />

          <div>
            <strong>
              Secure Campaign Access
            </strong>

            <span>
              Your role is verified automatically.
            </span>
          </div>
        </div>

        <div className={styles.heading}>
          <p className={styles.eyebrow}>
            Campaign HQ
          </p>

          <h2>Welcome back</h2>

          <p>
            Sign in once. Campaign HQ will
            automatically open your assigned
            campaigns, role and permissions.
          </p>
        </div>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <div className={styles.fieldGroup}>
            <label htmlFor="email">
              Email address
            </label>

            <div className={styles.inputWrap}>
              <Mail size={19} />

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@campaign.com"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password">
              Password
            </label>

            <div className={styles.inputWrap}>
              <LockKeyhole size={19} />

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
              />

              <button
                className={
                  styles.passwordButton
                }
                type="button"
                disabled={isLoading}
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          <div className={styles.options}>
            <label className={styles.remember}>
              <input
                name="remember"
                type="checkbox"
                checked={formData.remember}
                onChange={handleChange}
                disabled={isLoading}
              />

              <span>Remember me</span>
            </label>

            <button
              className={styles.textButton}
              type="button"
              onClick={() =>
                navigate(
                  "/forgot-password",
                  {
                    state: {
                      email:
                        formData.email,
                    },
                  },
                )
              }
            >
              Forgot password?
            </button>
          </div>

          <button
            className={styles.submitButton}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className={
                    styles.loadingSpinner
                  }
                  size={19}
                />

                <span>
                  Verifying Campaign Access
                </span>
              </>
            ) : (
              <>
                <span>
                  Enter Campaign HQ
                </span>

                <ArrowRight size={20} />
              </>
            )}
          </button>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <button
            className={styles.googleButton}
            type="button"
            onClick={() =>
              setMessage(
                "Google sign-in will be connected later.",
              )
            }
          >
            <span className={styles.googleIcon}>
              G
            </span>

            <span>
              Continue with Google
            </span>
          </button>

          {message && (
            <p
              className={styles.message}
              role="alert"
            >
              {message}
            </p>
          )}
        </form>

        <div className={styles.help}>
          <span>Need help?</span>

          <button type="button">
            Contact campaign leadership
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 Campaign HQ</span>

        <span>
          Authorized campaign use only
        </span>
      </footer>
    </div>
  );
}
