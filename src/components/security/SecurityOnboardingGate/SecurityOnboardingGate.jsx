import {
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import {
  getCurrentWorkspace,
} from "../../../utils/campaignSession";

import {
  useSecurityOnboarding,
} from "../../../hooks/useSecurityOnboarding";

import MfaSecurityPanel
  from "../MfaSecurityPanel/MfaSecurityPanel";

import styles
  from "./SecurityOnboardingGate.module.css";

export default function SecurityOnboardingGate() {
  const workspace =
    getCurrentWorkspace();

  const [
    mfaState,
    setMfaState,
  ] = useState(null);

  const {
    workspaceState,
    securityStep,
    teamStep,

    isLoading,
    isCompleting,
    error,

    completeSecurity,
  } =
    useSecurityOnboarding({
      workspaceId:
        workspace?.id ||
        "",
    });

  const controlledWritesEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "security-writes",
    ) ===
      "enabled";

  const verifiedFactors =
    mfaState
      ?.verifiedFactors ||
    [];

  const hasVerifiedFactor =
    verifiedFactors.length >=
      1;

  const hasBackupFactor =
    verifiedFactors.length >=
      2;

  const hasAal2 =
    mfaState?.isAal2 ===
      true;

  const securityIsCurrent =
    workspaceState
      ?.onboarding_current_step ===
      "security" &&
    securityStep
      ?.status ===
      "in_progress";

  const teamIsPending =
    teamStep?.status ===
      "pending";

  const securityComplete =
    securityStep?.status ===
      "complete";

  const teamStarted =
    workspaceState
      ?.onboarding_current_step ===
      "team" &&
    teamStep?.status ===
      "in_progress";

  const securityReady =
    hasAal2 &&
    hasVerifiedFactor;

  const canComplete =
    controlledWritesEnabled &&
    securityReady &&
    securityIsCurrent &&
    teamIsPending &&
    !isLoading &&
    !isCompleting;

  const handleComplete =
    async () => {
      try {
        await completeSecurity();

        window.location.assign(
          "/team/access?onboarding=team",
        );
      } catch {
        // The protected onboarding hook
        // exposes the user-facing error.
      }
    };

  const openTeam =
    () => {
      window.location.assign(
        "/team/access?onboarding=team",
      );
    };

  return (
    <>
      <MfaSecurityPanel
        onStateChange={
          setMfaState
        }
      />

      <section
        className={
          styles.onboardingCard
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerIcon
            }
          >
            <ShieldCheck
              size={22}
            />
          </div>

          <div>
            <span>
              Security onboarding
            </span>

            <h2>
              Secure this leadership
              account
            </h2>

            <p>
              Campaign Seat verifies
              your protected session
              before advancing to Team
              &amp; Access.
            </p>
          </div>
        </header>

        <div
          className={
            styles.checkGrid
          }
        >
          <article
            className={
              hasAal2
                ? styles.readyCheck
                : styles.pendingCheck
            }
          >
            {hasAal2 ? (
              <CheckCircle2
                size={20}
              />
            ) : (
              <TriangleAlert
                size={20}
              />
            )}

            <div>
              <strong>
                Two-step verification
              </strong>

              <small>
                {hasAal2
                  ? "Current session is AAL2 protected."
                  : "A verified second step is required."}
              </small>
            </div>
          </article>

          <article
            className={
              hasVerifiedFactor
                ? styles.readyCheck
                : styles.pendingCheck
            }
          >
            {hasVerifiedFactor ? (
              <CheckCircle2
                size={20}
              />
            ) : (
              <TriangleAlert
                size={20}
              />
            )}

            <div>
              <strong>
                Verified method
              </strong>

              <small>
                {hasVerifiedFactor
                  ? `${verifiedFactors.length} verified method${verifiedFactors.length === 1 ? "" : "s"}.`
                  : "Add and verify a two-step method first."}
              </small>
            </div>
          </article>

          <article
            className={
              hasBackupFactor
                ? styles.readyCheck
                : styles.recommendedCheck
            }
          >
            <Smartphone
              size={20}
            />

            <div>
              <strong>
                Backup verification method
              </strong>

              <small>
                {hasBackupFactor
                  ? "Recovery protection is configured."
                  : "Recommended for recovery, but not required to continue."}
              </small>
            </div>
          </article>
        </div>

        {error && (
          <div
            className={
              styles.errorBanner
            }
            role="alert"
          >
            <TriangleAlert
              size={18}
            />

            <span>
              {error}
            </span>
          </div>
        )}

        {!controlledWritesEnabled &&
          securityIsCurrent && (
            <div
              className={
                styles.controlledNotice
              }
            >
              Controlled Security
              completion is locked on
              the normal development
              URL while this transition
              is being tested.
            </div>
          )}

        <footer
          className={
            styles.footer
          }
        >
          <div>
            <strong>
              {securityComplete ||
              teamStarted
                ? "Security complete"
                : securityReady
                  ? "Security ready"
                  : "Security needs attention"}
            </strong>

            <span>
              {securityComplete ||
              teamStarted
                ? "Continue with campaign roles and access."
                : securityReady
                  ? "Your protected session meets the Security requirement."
                  : "Complete two-step verification before continuing."}
            </span>
          </div>

          {securityComplete ||
          teamStarted ? (
            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                openTeam
              }
            >
              Open Team &amp; Access

              <ArrowRight
                size={17}
              />
            </button>
          ) : (
            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                handleComplete
              }
              disabled={
                !canComplete
              }
            >
              {isCompleting ? (
                <LoaderCircle
                  className={
                    styles.spinner
                  }
                  size={17}
                />
              ) : (
                <ShieldCheck
                  size={17}
                />
              )}

              {isCompleting
                ? "Securing…"
                : "Complete Security"}

              {!isCompleting && (
                <ArrowRight
                  size={17}
                />
              )}
            </button>
          )}
        </footer>
      </section>
    </>
  );
}
