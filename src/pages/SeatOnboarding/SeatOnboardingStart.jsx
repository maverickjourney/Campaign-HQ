import {
  useEffect,
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

import {
  createSeatOnboardingAccount,
  getCurrentSeatUser,
  loadSeatOnboardingInvitation,
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

      setSaving(true);

      try {
        const result =
          await createSeatOnboardingAccount({
            token,
            invitation,
            fullName,
            password,
          });

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
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Account setup could not be completed.",
        );
      } finally {
        setSaving(false);
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
