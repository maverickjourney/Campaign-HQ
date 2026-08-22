import {
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import TurnstileChallenge
  from "../../components/security/TurnstileChallenge/TurnstileChallenge";

import SeatBrand
  from "../../components/brand/SeatBrand/SeatBrand";

import {
  signInToPlatformAdmin,
} from "../../services/platformAdminAuth";

import styles
  from "./PlatformAdmin.module.css";

export default function PlatformAdminLogin() {
  const navigate =
    useNavigate();

  const turnstileRef =
    useRef(null);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    captchaToken,
    setCaptchaToken,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const submit =
    async (event) => {
      event.preventDefault();

      setLoading(true);
      setMessage("");

      try {
        const result =
          await signInToPlatformAdmin({
            email,
            password,
            captchaToken,
          });

        if (
          result.status ===
          "mfa-setup"
        ) {
          navigate(
            "/mfa/setup",
            {
              replace: true,

              state: {
                from:
                  "/admin",
              },
            },
          );

          return;
        }

        if (
          result.status ===
          "mfa-challenge"
        ) {
          navigate(
            "/mfa/challenge",
            {
              replace: true,

              state: {
                from:
                  "/admin",
              },
            },
          );

          return;
        }

        navigate(
          "/admin",
          {
            replace: true,
          },
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Admin sign-in failed.",
        );

        setCaptchaToken("");

        turnstileRef
          .current?.reset();
      } finally {
        setLoading(false);
      }
    };

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <div className={styles.adminBrand}>
          <SeatBrand
            variant="wordmark"
            color="black"
            className={styles.adminBrandLogo}
          />
        </div>

        <div className={styles.adminBadge}>
          <ShieldCheck size={20} />
          Seat Platform Admin
        </div>

        <h1>Administrative access</h1>

        <p className={styles.lead}>
          Authorized Seat Platform staff only.
          Administrative authority and MFA are
          verified before access is granted.
        </p>

        <form
          className={styles.form}
          onSubmit={submit}
        >
          <label>
            Email address

            <div className={styles.inputWrap}>
              <Mail size={18} />

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                placeholder="support@campaignseat.com"
                disabled={loading}
                required
              />
            </div>
          </label>

          <label>
            Password

            <div className={styles.inputWrap}>
              <LockKeyhole size={18} />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="current-password"
                disabled={loading}
                required
              />

              <button
                className={styles.iconButton}
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
                  )
                }
              >
                {showPassword
                  ? <EyeOff size={18} />
                  : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            className={styles.textButton}
            type="button"
            onClick={() =>
              navigate(
                "/forgot-password",
                {
                  state: {
                    email,
                  },
                },
              )
            }
          >
            Set or reset password
          </button>

          <TurnstileChallenge
            ref={turnstileRef}
            action="platform_admin_signin"
            onTokenChange={
              setCaptchaToken
            }
          />

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={
              loading ||
              !captchaToken
            }
          >
            {loading
              ? "Verifying…"
              : "Enter Seat Platform Admin"}
          </button>

          {message && (
            <p
              className={styles.error}
              role="alert"
            >
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
