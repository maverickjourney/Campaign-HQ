import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
  Vote,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { supabase } from "../../lib/supabase";
import {
  restoreCampaignSession,
} from "../../services/auth";

import styles from "./InvitationAccept.module.css";

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

function getAuthMessage(error) {
  const message =
    String(
      error?.message ||
      "",
    ).toLowerCase();

  if (
    message.includes(
      "user already registered",
    )
  ) {
    return "An account already exists for this email. Choose Sign in instead.";
  }

  if (
    message.includes(
      "invalid login credentials",
    )
  ) {
    return "The email or password is incorrect.";
  }

  if (
    message.includes(
      "password",
    )
  ) {
    return "Use a password with at least 8 characters.";
  }

  if (
    message.includes(
      "email rate limit",
    )
  ) {
    return "Too many verification emails were requested. Wait a few minutes and try again.";
  }

  return (
    error?.message ||
    "Campaign HQ could not complete this request."
  );
}

function getInvitationMessage(error) {
  const message =
    String(
      error?.message ||
      "",
    );

  if (
    /invalid or expired/i.test(
      message,
    )
  ) {
    return "This invitation is invalid, expired or has already been used.";
  }

  if (
    /another email address/i.test(
      message,
    )
  ) {
    return "This invitation belongs to a different email address. Sign in with the email that received the invitation.";
  }

  if (
    /authentication is required/i.test(
      message,
    )
  ) {
    return "Sign in or create your account before accepting this invitation.";
  }

  return (
    message ||
    "Campaign HQ could not accept this invitation."
  );
}

export default function InvitationAccept() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const token =
    String(
      searchParams.get(
        "token",
      ) || "",
    ).trim();

  const tokenIsValid =
    TOKEN_PATTERN.test(
      token,
    );

  const [
    mode,
    setMode,
  ] =
    useState(
      "create",
    );

  const [
    fullName,
    setFullName,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState(null);

  const [
    status,
    setStatus,
  ] =
    useState(
      "checking",
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    verificationEmail,
    setVerificationEmail,
  ] =
    useState("");

  const isBusy =
    status ===
      "submitting" ||
    status ===
      "accepting";

  const signedInEmail =
    currentUser?.email ||
    "";

  const pageState =
    useMemo(
      () => {
        if (
          !tokenIsValid
        ) {
          return "invalid";
        }

        if (
          status ===
          "accepted"
        ) {
          return "accepted";
        }

        if (
          status ===
          "verify-email"
        ) {
          return "verify-email";
        }

        return "ready";
      },
      [
        status,
        tokenIsValid,
      ],
    );

  useEffect(() => {
    let isMounted =
      true;

    const loadSession =
      async () => {
        const {
          data,
        } =
          await supabase.auth
            .getSession();

        if (
          !isMounted
        ) {
          return;
        }

        setCurrentUser(
          data.session?.user ||
          null,
        );

        setStatus(
          "ready",
        );
      };

    loadSession();

    const {
      data: listener,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session,
          ) => {
            if (
              !isMounted
            ) {
              return;
            }

            setCurrentUser(
              session?.user ||
              null,
            );

            if (
              event ===
              "SIGNED_IN"
            ) {
              setStatus(
                "ready",
              );
            }
          },
        );

    return () => {
      isMounted =
        false;

      listener.subscription
        .unsubscribe();
    };
  }, []);

  const finishAcceptance =
    async () => {
      setStatus(
        "accepting",
      );
      setError("");

      try {
        const {
          error:
            acceptanceError,
        } =
          await supabase.rpc(
            "accept_workspace_invitation",
            {
              invitation_token:
                token,
            },
          );

        if (
          acceptanceError
        ) {
          throw acceptanceError;
        }

        const campaignSession =
          await restoreCampaignSession();

        if (
          !campaignSession
        ) {
          throw new Error(
            "Campaign access was accepted, but the secure session could not be opened.",
          );
        }

        window.history
          .replaceState(
            {},
            document.title,
            "/invite",
          );

        setStatus(
          "accepted",
        );

        window.setTimeout(
          () => {
            navigate(
              "/dashboard",
              {
                replace: true,
              },
            );
          },
          900,
        );
      } catch (
        acceptanceError
      ) {
        setStatus(
          "ready",
        );
        setError(
          getInvitationMessage(
            acceptanceError,
          ),
        );
      }
    };

  const handleCreateAccount =
    async (event) => {
      event.preventDefault();
      setError("");

      const normalizedName =
        fullName.trim();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        normalizedName.length <
        2
      ) {
        setError(
          "Enter your full name.",
        );
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail,
        )
      ) {
        setError(
          "Enter a valid email address.",
        );
        return;
      }

      if (
        password.length <
        8
      ) {
        setError(
          "Use a password with at least 8 characters.",
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

      setStatus(
        "submitting",
      );

      try {
        const {
          data,
          error:
            signUpError,
        } =
          await supabase.auth
            .signUp({
              email:
                normalizedEmail,
              password,
              options: {
                data: {
                  full_name:
                    normalizedName,
                  name:
                    normalizedName,
                },
                emailRedirectTo:
                  window.location.href,
              },
            });

        if (
          signUpError
        ) {
          throw signUpError;
        }

        if (
          data.session &&
          data.user
        ) {
          setCurrentUser(
            data.user,
          );
          await finishAcceptance();
          return;
        }

        setVerificationEmail(
          normalizedEmail,
        );
        setStatus(
          "verify-email",
        );
      } catch (
        signUpError
      ) {
        setStatus(
          "ready",
        );
        setError(
          getAuthMessage(
            signUpError,
          ),
        );
      }
    };

  const handleSignIn =
    async (event) => {
      event.preventDefault();
      setError("");

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail ||
        !password
      ) {
        setError(
          "Enter your email and password.",
        );
        return;
      }

      setStatus(
        "submitting",
      );

      try {
        const {
          data,
          error:
            signInError,
        } =
          await supabase.auth
            .signInWithPassword({
              email:
                normalizedEmail,
              password,
            });

        if (
          signInError ||
          !data.user
        ) {
          throw (
            signInError ||
            new Error(
              "Campaign HQ could not sign in.",
            )
          );
        }

        setCurrentUser(
          data.user,
        );

        await finishAcceptance();
      } catch (
        signInError
      ) {
        setStatus(
          "ready",
        );
        setError(
          getAuthMessage(
            signInError,
          ),
        );
      }
    };

  const handleUseDifferentAccount =
    async () => {
      setError("");
      setStatus(
        "submitting",
      );

      await supabase.auth
        .signOut();

      setCurrentUser(
        null,
      );
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setStatus(
        "ready",
      );
    };

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brandMark}>
          <Vote size={29} />
        </div>

        <span className={styles.eyebrow}>
          Secure campaign access
        </span>

        <h1>Join Campaign HQ</h1>

        <p>
          Create your private account,
          accept your assigned campaign
          role and enter the campaign
          workspace.
        </p>

        <div className={styles.securityCard}>
          <ShieldCheck size={22} />
          <div>
            <strong>
              Invitation protected
            </strong>
            <span>
              The secure token is
              verified by Campaign HQ
              and can only be accepted
              by the invited email.
            </span>
          </div>
        </div>

        <small>
          Authorized campaign use only
        </small>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formShell}>
          {status === "checking" && (
            <div className={styles.stateCard}>
              <LoaderCircle
                className={styles.spinning}
                size={32}
              />
              <h2>Checking invitation</h2>
              <p>
                Campaign HQ is preparing
                the secure account
                process.
              </p>
            </div>
          )}

          {status !== "checking" &&
            pageState === "invalid" && (
            <div className={styles.stateCard}>
              <AlertTriangle size={36} />
              <h2>
                Invitation link is
                incomplete
              </h2>
              <p>
                Ask campaign leadership
                to create a new secure
                invitation.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/",
                    { replace: true },
                  )
                }
              >
                Return to sign in
              </button>
            </div>
          )}

          {status !== "checking" &&
            pageState === "verify-email" && (
            <div className={styles.stateCard}>
              <Mail size={36} />
              <h2>Check your email</h2>
              <p>
                A verification message
                was sent to{" "}
                <strong>
                  {verificationEmail}
                </strong>
                . Verify the account,
                then reopen this same
                invitation link.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("ready");
                  setMode("signin");
                }}
              >
                I already verified
              </button>
            </div>
          )}

          {status !== "checking" &&
            pageState === "accepted" && (
            <div className={styles.stateCard}>
              <CheckCircle2 size={38} />
              <h2>
                Welcome to Campaign HQ
              </h2>
              <p>
                Your campaign access is
                active. Opening your
                dashboard now.
              </p>
            </div>
          )}

          {status !== "checking" &&
            pageState === "ready" && (
            <>
              <header className={styles.header}>
                <div className={styles.headerIcon}>
                  <KeyRound size={23} />
                </div>
                <div>
                  <span>Account setup</span>
                  <h2>
                    Accept your invitation
                  </h2>
                </div>
              </header>

              {error && (
                <div
                  className={styles.error}
                  role="alert"
                >
                  <AlertTriangle size={19} />
                  <span>{error}</span>
                </div>
              )}

              {currentUser ? (
                <section
                  className={styles.currentAccount}
                >
                  <UserRound size={24} />
                  <div>
                    <span>Signed in as</span>
                    <strong>
                      {signedInEmail}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleUseDifferentAccount
                    }
                    disabled={isBusy}
                  >
                    <LogOut size={16} />
                    Different account
                  </button>

                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={finishAcceptance}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <LoaderCircle
                        className={styles.spinning}
                        size={18}
                      />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                    Accept invitation
                  </button>
                </section>
              ) : (
                <>
                  <div className={styles.modeSwitch}>
                    <button
                      className={
                        mode === "create"
                          ? styles.activeMode
                          : ""
                      }
                      type="button"
                      onClick={() => {
                        setMode("create");
                        setError("");
                      }}
                    >
                      Create account
                    </button>

                    <button
                      className={
                        mode === "signin"
                          ? styles.activeMode
                          : ""
                      }
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError("");
                      }}
                    >
                      Sign in
                    </button>
                  </div>

                  <form
                    className={styles.form}
                    onSubmit={
                      mode === "create"
                        ? handleCreateAccount
                        : handleSignIn
                    }
                  >
                    {mode === "create" && (
                      <label>
                        <span>Full name</span>
                        <div className={styles.inputWrap}>
                          <UserRound size={18} />
                          <input
                            type="text"
                            value={fullName}
                            onChange={(event) =>
                              setFullName(
                                event.target.value,
                              )
                            }
                            autoComplete="name"
                            placeholder="Your full name"
                            required
                          />
                        </div>
                      </label>
                    )}

                    <label>
                      <span>Email address</span>
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
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </label>

                    <label>
                      <span>Password</span>
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
                          autoComplete={
                            mode === "create"
                              ? "new-password"
                              : "current-password"
                          }
                          placeholder={
                            mode === "create"
                              ? "At least 8 characters"
                              : "Your password"
                          }
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
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </label>

                    {mode === "create" && (
                      <label>
                        <span>
                          Confirm password
                        </span>
                        <div className={styles.inputWrap}>
                          <LockKeyhole size={18} />
                          <input
                            type={
                              showPassword
                                ? "text"
                                : "password"
                            }
                            value={confirmPassword}
                            onChange={(event) =>
                              setConfirmPassword(
                                event.target.value,
                              )
                            }
                            autoComplete="new-password"
                            placeholder="Repeat your password"
                            required
                          />
                        </div>
                      </label>
                    )}

                    <button
                      className={styles.primaryButton}
                      type="submit"
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <LoaderCircle
                          className={styles.spinning}
                          size={18}
                        />
                      ) : (
                        <ArrowRight size={18} />
                      )}
                      {mode === "create"
                        ? "Create account and join"
                        : "Sign in and join"}
                    </button>
                  </form>
                </>
              )}

              <div className={styles.privacy}>
                <ShieldCheck size={17} />
                <span>
                  Campaign HQ checks the
                  invitation, signed-in
                  email, expiration and
                  assigned role before
                  access is activated.
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
