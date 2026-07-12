import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { signInToCampaign } from "../../../services/auth";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const navigate = useNavigate();

  const [accessMode, setAccessMode] = useState("client");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = accessMode === "admin";

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleModeChange = (mode) => {
    if (isLoading) {
      return;
    }

    setAccessMode(mode);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.email.trim() || !formData.password.trim()) {
      setMessage("Enter your email address and password.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await signInToCampaign({
        email: formData.email,
        password: formData.password,
        portalMode: accessMode,
      });

      navigate("/workspaces", { replace: true });
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

  const handleGoogleSignIn = () => {
    setMessage(
      "Google sign-in will be connected after email access is fully tested.",
    );
  };

  const handleForgotPassword = () => {
    setMessage(
      "Password recovery will be connected in the next authentication step.",
    );
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.loginCard}>
        <div className={styles.accentBars} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className={styles.security}>
          <ShieldCheck size={21} strokeWidth={1.8} />

          <div>
            <strong>Secure Campaign Access</strong>
            <span>Your campaign information is protected.</span>
          </div>
        </div>

        <div className={styles.heading}>
          <p className={styles.eyebrow}>Campaign HQ</p>
          <h2>Welcome back</h2>

          <p>
            Choose your assigned access type, then sign in to enter
            the Elizabeth Accomando campaign workspace.
          </p>
        </div>

        <div className={styles.portalSection}>
          <div className={styles.portalHeader}>
            <strong>Choose your access</strong>
            <span>Select the portal assigned to your account.</span>
          </div>

          <div
            className={styles.portalGrid}
            role="radiogroup"
            aria-label="Choose login access"
          >
            <button
              className={`${styles.portalOption} ${
                accessMode === "client"
                  ? styles.clientSelected
                  : ""
              }`}
              type="button"
              role="radio"
              aria-checked={accessMode === "client"}
              disabled={isLoading}
              onClick={() => handleModeChange("client")}
            >
              <span className={styles.portalIcon}>
                <UserRound size={19} strokeWidth={1.9} />
              </span>

              <span className={styles.portalCopy}>
                <small>Client Login</small>
                <strong>Client</strong>
                <span>
                  Campaign updates, files, events and approvals.
                </span>
              </span>

              {accessMode === "client" && (
                <CheckCircle2
                  className={styles.portalCheck}
                  size={17}
                  strokeWidth={2.3}
                />
              )}
            </button>

            <button
              className={`${styles.portalOption} ${
                accessMode === "admin"
                  ? styles.adminSelected
                  : ""
              }`}
              type="button"
              role="radio"
              aria-checked={accessMode === "admin"}
              disabled={isLoading}
              onClick={() => handleModeChange("admin")}
            >
              <span className={styles.portalIcon}>
                <ShieldCheck size={19} strokeWidth={1.9} />
              </span>

              <span className={styles.portalCopy}>
                <small>Admin Login</small>
                <strong>Admin</strong>
                <span>
                  Team access, settings and campaign controls.
                </span>
              </span>

              {accessMode === "admin" && (
                <CheckCircle2
                  className={styles.portalCheck}
                  size={17}
                  strokeWidth={2.3}
                />
              )}
            </button>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="email">Email address</label>

            <div className={styles.inputWrap}>
              <Mail size={19} strokeWidth={1.8} />

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
            <label htmlFor="password">Password</label>

            <div className={styles.inputWrap}>
              <LockKeyhole size={19} strokeWidth={1.8} />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
              />

              <button
                className={styles.passwordButton}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setShowPassword((current) => !current);
                }}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={19} strokeWidth={1.8} />
                ) : (
                  <Eye size={19} strokeWidth={1.8} />
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
              disabled={isLoading}
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>
          </div>

          <button
            className={`${styles.submitButton} ${
              isAdmin ? styles.adminSubmitButton : ""
            }`}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className={styles.loadingSpinner}
                  size={19}
                  strokeWidth={2}
                />
                <span>Verifying Access</span>
              </>
            ) : (
              <>
                <span>
                  Enter {isAdmin ? "Admin" : "Client"} Portal
                </span>

                <ArrowRight size={20} strokeWidth={2} />
              </>
            )}
          </button>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <button
            className={styles.googleButton}
            type="button"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
          >
            <span className={styles.googleIcon}>G</span>

            <span>
              Continue as {isAdmin ? "Admin" : "Client"} with Google
            </span>
          </button>

          {message && (
            <p className={styles.message} role="alert">
              {message}
            </p>
          )}
        </form>

        <div className={styles.help}>
          <span>Need help?</span>

          <button type="button">
            Contact your campaign administrator
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 Campaign HQ</span>
        <span>Authorized campaign use only</span>
      </footer>
    </div>
  );
}
