import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import SeatBrand
  from "../../components/brand/SeatBrand/SeatBrand";

import TurnstileChallenge
  from "../../components/security/TurnstileChallenge/TurnstileChallenge";

import {
  getCurrentSeatUser,
  resendSeatVerificationEmail,
  signInSeatOnboarding,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


export default function SeatOnboardingSignIn() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const turnstileRef =
    useRef(null);

  const [
    email,
    setEmail,
  ] = useState(
    String(
      searchParams.get(
        "email",
      ) ||
      "",
    ).trim(),
  );

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
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    confirmationRequired,
    setConfirmationRequired,
  ] = useState(false);

  const [
    resendState,
    setResendState,
  ] = useState("idle");

  const [
    resendMessage,
    setResendMessage,
  ] = useState("");

  const [
    signedInEmail,
    setSignedInEmail,
  ] = useState("");


  useEffect(() => {
    let active = true;

    const check =
      async () => {
        const user =
          await getCurrentSeatUser();

        if (
          !active ||
          !user
        ) {
          return;
        }

        setSignedInEmail(
          user.email ||
            "",
        );
      };

    void check();

    return () => {
      active = false;
    };
  }, []);


  const submit =
    async (event) => {
      event.preventDefault();

      setError("");

      if (!captchaToken) {
        setError(
          "Wait for the browser security check to finish.",
        );

        return;
      }

      setSaving(true);

      try {
        const result =
          await signInSeatOnboarding({
            email,
            password,
            captchaToken,
          });

        setCaptchaToken("");

        turnstileRef
          .current?.reset();

        if (
          result.status ===
          "confirmation_required"
        ) {
          setConfirmationRequired(
            true,
          );

          return;
        }

        navigate(
          "/onboarding/continue",
          {
            replace: true,
          },
        );
      } catch (signInError) {
        setCaptchaToken("");

        turnstileRef
          .current?.reset();

        setError(
          signInError instanceof Error
            ? signInError.message
            : "Sign-in could not be completed.",
        );
      } finally {
        setSaving(false);
      }
    };


  const resend =
    async () => {
      const normalized =
        email
          .trim()
          .toLowerCase();

      if (!normalized) {
        setResendMessage(
          "Enter your onboarding email first.",
        );

        setResendState(
          "error",
        );

        return;
      }

      setResendState(
        "sending",
      );

      setResendMessage(
        "",
      );

      try {
        await resendSeatVerificationEmail(
          normalized,
        );

        setResendState(
          "sent",
        );

        setResendMessage(
          "Verification email sent. Check Inbox, Junk and Other.",
        );

        window.setTimeout(
          () => {
            setResendState(
              "idle",
            );
          },
          60000,
        );
      } catch (resendError) {
        setResendState(
          "error",
        );

        setResendMessage(
          resendError instanceof Error
            ? resendError.message
            : "Verification email could not be resent.",
        );
      }
    };


  const sessionConflict =
    signedInEmail &&
    email &&
    signedInEmail
      .toLowerCase() !==
      email
        .trim()
        .toLowerCase();


  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <SeatBrand
          variant="wordmark"
          color="white"
          className={styles.topLogo}
        />

        <span>
          Secure Client Onboarding
        </span>
      </header>

      <section className={styles.signInLayout}>
        <div className={styles.signInIntro}>
          <span className={styles.eyebrow}>
            Campaign Seat
          </span>

          <h1>
            Continue your onboarding.
          </h1>

          <p>
            Your private invitation has already been secured to your account. Sign in anytime to continue setup.
          </p>

          <div className={styles.returnSecurity}>
            <ShieldCheck size={20} />

            <div>
              <strong>
                Returning client access
              </strong>

              <span>
                Your original onboarding invitation cannot be reused.
              </span>
            </div>
          </div>
        </div>

        <section className={styles.formCard}>
          <div className={styles.securityBadge}>
            <ShieldCheck size={18} />
            Secure onboarding sign-in
          </div>

          <h2>
            Sign in to continue
          </h2>

          <p>
            Use the account you created from your private Campaign Seat onboarding invitation.
          </p>

          {sessionConflict && (
            <div className={styles.warning}>
              This browser is currently signed in as{" "}
              <strong>
                {signedInEmail}
              </strong>
              . Use a private/incognito window for the client account.
            </div>
          )}

          <form
            className={styles.form}
            onSubmit={submit}
          >
            <label>
              Email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password

              <div className={styles.passwordField}>
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
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />}
                </button>
              </div>
            </label>

            <TurnstileChallenge
              ref={turnstileRef}
              action="campaign_auth"
              onTokenChange={
                setCaptchaToken
              }
            />

            {error && (
              <div
                className={styles.error}
                role="alert"
              >
                {error}
              </div>
            )}

            {confirmationRequired && (
              <div className={styles.verificationNotice}>
                <strong>
                  Email verification is still required.
                </strong>

                <span>
                  Verify your email, then return here and sign in.
                </span>
              </div>
            )}

            <button
              className={styles.primary}
              type="submit"
              disabled={
                saving ||
                sessionConflict
              }
            >
              {saving
                ? "Opening onboarding…"
                : "Sign In & Continue"}
            </button>

            <button
              className={styles.resendButton}
              type="button"
              onClick={resend}
              disabled={
                resendState ===
                  "sending" ||
                resendState ===
                  "sent"
              }
            >
              {resendState ===
              "sending"
                ? "Sending…"
                : resendState ===
                  "sent"
                ? "Verification sent"
                : "Resend verification email"}
            </button>

            {resendMessage && (
              <div
                className={
                  resendState ===
                  "error"
                    ? styles.resendError
                    : styles.resendSuccess
                }
              >
                {resendMessage}
              </div>
            )}
          </form>
        </section>
      </section>
    </main>
  );
}
