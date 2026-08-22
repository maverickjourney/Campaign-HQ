import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import SeatBrand
  from "../../components/brand/SeatBrand/SeatBrand";

import TurnstileChallenge
  from "../../components/security/TurnstileChallenge/TurnstileChallenge";

import {
  createSeatOnboardingAccount,
  getCurrentSeatUser,
  loadSeatOnboardingInvitation,
  resendSeatVerificationEmail,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


function roleLabel(
  value,
) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0)
          .toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}


function validatePassword(
  value,
) {
  const password =
    String(value || "");

  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}


export default function SeatOnboardingStart() {
  const turnstileRef =
    useRef(null);

  const {
    token,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    invitation,
    setInvitation,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    signedInEmail,
    setSignedInEmail,
  ] = useState("");

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

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
    captchaToken,
    setCaptchaToken,
  ] = useState("");


  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const [
            invitationResult,
            currentUser,
          ] =
            await Promise.all([
              loadSeatOnboardingInvitation(
                token,
              ),

              getCurrentSeatUser(),
            ]);

          if (!active) {
            return;
          }

          setInvitation(
            invitationResult,
          );

          setFullName(
            invitationResult
              ?.full_name ||
              "",
          );

          setSignedInEmail(
            currentUser?.email ||
              "",
          );
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Onboarding could not be opened.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      active = false;
    };
  }, [token]);


  const submit =
    async (event) => {
      event.preventDefault();

      setError("");

      if (
        !validatePassword(
          password,
        )
      ) {
        setError(
          "Use at least 12 characters with uppercase, lowercase, a number and a symbol.",
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setError(
          "The passwords do not match.",
        );

        return;
      }

      if (!captchaToken) {
        setError(
          "Wait for the browser security check to finish, then try again.",
        );

        return;
      }

      setSaving(true);

      try {
        const result =
          await createSeatOnboardingAccount({
            token,
            invitation,
            fullName,
            password,
            captchaToken,
          });

        setCaptchaToken("");

        turnstileRef
          .current?.reset();

        if (
          result.status ===
          "session_conflict"
        ) {
          setError(
            `This browser is already signed in as ${result.currentEmail}. Open this private onboarding link in a private/incognito window so the two Seat accounts stay separate.`,
          );

          return;
        }

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
      } catch (saveError) {
        setCaptchaToken("");

        turnstileRef
          .current?.reset();

        const message =
          saveError instanceof Error
            ? saveError.message
            : "Account setup could not be completed.";

        setError(
          /captcha|challenge/i.test(
            message,
          )
            ? "The browser security check expired. Complete it again and retry."
            : message,
        );
      } finally {
        setSaving(false);
      }
    };


  const resendVerification =
    async () => {
      if (
        resendState ===
        "sending"
      ) {
        return;
      }

      if (!captchaToken) {
        setResendState(
          "error",
        );

        setResendMessage(
          "Wait for the browser security check to finish before resending.",
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
          invitation.email,
          captchaToken,
        );

        setCaptchaToken("");

        turnstileRef
          .current?.reset();

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
        setCaptchaToken("");

        turnstileRef
          .current?.reset();

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


  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.centerMessage}>
          Verifying your private onboarding invitation…
        </div>
      </main>
    );
  }


  if (
    !invitation?.found &&
    invitation?.used
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <SeatBrand
            variant="wordmark"
            color="black"
            className={styles.messageLogo}
          />

          <ShieldCheck size={38} />

          <h1>
            Your Seat account is ready
          </h1>

          <p>
            This one-time onboarding invitation has already been used. Sign in with the account you created to continue onboarding.
          </p>

          <button
            className={styles.primary}
            type="button"
            onClick={() =>
              navigate(
                "/onboarding/sign-in",
              )
            }
          >
            Continue to Sign In
          </button>
        </section>
      </main>
    );
  }


  if (
    !invitation?.found
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <ShieldCheck size={38} />

          <h1>
            Onboarding invitation unavailable
          </h1>

          <p>
            {invitation?.expired
              ? "This onboarding invitation has expired."
              : invitation?.used
              ? "This onboarding invitation has already been used."
              : error ||
                "This private onboarding invitation is invalid."}
          </p>
        </section>
      </main>
    );
  }


  if (confirmationRequired) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <SeatBrand
            variant="wordmark"
            color="black"
            className={styles.messageLogo}
          />

          <CheckCircle2 size={42} />

          <h1>
            Verify your email
          </h1>

          <p>
            We created the secure Seat account for{" "}
            <strong>
              {invitation.email}
            </strong>
            . Open the verification email and follow the secure link to continue onboarding.
          </p>

          <TurnstileChallenge
            ref={turnstileRef}
            action="campaign_auth"
            onTokenChange={
              setCaptchaToken
            }
          />

          <button
            className={styles.resendButton}
            type="button"
            onClick={resendVerification}
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
              ? "Email sent"
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

          <small className={styles.resendHelp}>
            Delivery can take a moment. Also check Junk Email and Other.
          </small>
        </section>
      </main>
    );
  }


  const sessionConflict =
    signedInEmail &&
    signedInEmail
      .toLowerCase() !==
      invitation.email
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

      <section className={styles.layout}>
        <aside className={styles.intro}>
          <span className={styles.eyebrow}>
            {invitation.product_name}
          </span>

          <h1>
            Welcome to your Seat.
          </h1>

          <p>
            Your proposal is approved. Now we’ll securely set up your account, campaign profile, integrations and team access.
          </p>

          <div className={styles.summary}>
            <div>
              <span>
                Account
              </span>

              <strong>
                {invitation.account_name}
              </strong>
            </div>

            <div>
              <span>
                Initial role
              </span>

              <strong>
                {roleLabel(
                  invitation.requested_role_key,
                )}
              </strong>
            </div>

            <div>
              <span>
                Proposal
              </span>

              <strong>
                {invitation.proposal_code}
              </strong>
            </div>
          </div>
        </aside>

        <section className={styles.formCard}>
          <div className={styles.securityBadge}>
            <ShieldCheck size={18} />
            Private invitation verified
          </div>

          <h2>
            Create your secure account
          </h2>

          <p>
            This account will become your authorized identity for Seat Platform access.
          </p>

          {sessionConflict && (
            <div className={styles.warning}>
              This browser is currently signed in as{" "}
              <strong>
                {signedInEmail}
              </strong>
              . Open this onboarding link in a private/incognito window before creating the client account.
            </div>
          )}

          <form
            onSubmit={submit}
            className={styles.form}
          >
            <label>
              Full name

              <input
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value,
                  )
                }
                autoComplete="name"
                required
              />
            </label>

            <label>
              Email

              <input
                value={
                  invitation.email
                }
                type="email"
                disabled
              />
            </label>

            <label>
              Password

              <div className={styles.passwordField}>
                <LockKeyhole size={18} />

                <input
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
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

            <label>
              Confirm password

              <input
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                type="password"
                autoComplete="new-password"
                required
              />
            </label>

            <small className={styles.passwordHelp}>
              Minimum 12 characters with uppercase, lowercase, a number and a symbol.
            </small>

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

            <button
              className={styles.primary}
              type="submit"
              disabled={
                saving ||
                sessionConflict
              }
            >
              {saving
                ? "Creating secure account…"
                : "Create Account & Continue"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
