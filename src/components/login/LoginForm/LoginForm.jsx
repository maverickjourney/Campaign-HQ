import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.email.trim() || !formData.password.trim()) {
      setMessage("Enter your email address and password.");
      return;
    }

    setMessage("");

    // Temporary demo navigation.
    // Supabase authentication will replace this next.
    navigate("/dashboard");
  };

  const handleGoogleSignIn = () => {
    setMessage("Google sign-in will be connected through Supabase.");
  };

  const handleForgotPassword = () => {
    setMessage("Password recovery will be connected through Supabase.");
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
          <ShieldCheck size={22} strokeWidth={1.8} />

          <div>
            <strong>Secure Campaign Access</strong>
            <span>Your campaign information is protected.</span>
          </div>
        </div>

        <div className={styles.heading}>
          <p className={styles.eyebrow}>Campaign HQ</p>

          <h2>Welcome back</h2>

          <p>
            Sign in to access campaign files, events, tasks, approvals,
            messages and team updates.
          </p>
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
              />

              <button
                className={styles.passwordButton}
                type="button"
                onClick={() => setShowPassword((current) => !current)}
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
              />

              <span>Remember me</span>
            </label>

            <button
              className={styles.textButton}
              type="button"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>
          </div>

          <button className={styles.submitButton} type="submit">
            <span>Enter Campaign HQ</span>
            <ArrowRight size={20} strokeWidth={2} />
          </button>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <button
            className={styles.googleButton}
            type="button"
            onClick={handleGoogleSignIn}
          >
            <span className={styles.googleIcon}>G</span>
            <span>Continue with Google</span>
          </button>

          {message && (
            <p className={styles.message} role="status">
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