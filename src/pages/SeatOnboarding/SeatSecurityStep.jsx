import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import MfaSecurityPanel
  from "../../components/security/MfaSecurityPanel/MfaSecurityPanel";

import {
  completeMySeatSecurityStep,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


export default function SeatSecurityStep() {
  const [
    mfaState,
    setMfaState,
  ] =
    useState(null);

  const [
    completing,
    setCompleting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  const verifiedFactors =
    mfaState?.verifiedFactors ||
    [];

  const hasVerifiedFactor =
    verifiedFactors.length >
    0;

  const hasSecureSession =
    Boolean(
      mfaState?.isAal2,
    );


  useEffect(() => {
    if (
      hasSecureSession
    ) {
      setError("");
    }
  }, [
    hasSecureSession,
  ]);


  const completeSecurity =
    async () => {
      if (
        !hasVerifiedFactor ||
        !hasSecureSession ||
        completing
      ) {
        return;
      }

      setCompleting(true);
      setError("");

      try {
        await completeMySeatSecurityStep();

        window.location.reload();
      } catch (completeError) {
        setError(
          completeError instanceof Error
            ? completeError.message
            : "Security onboarding could not be completed.",
        );
      } finally {
        setCompleting(false);
      }
    };


  return (
    <section
      className={
        styles.securityOnboarding
      }
    >
      <header
        className={
          styles.securityOnboardingHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Security
          </span>

          <h2>
            Protect your Campaign Seat account.
          </h2>

          <p>
            Candidate and campaign leadership accounts require two-step verification before protected campaign access can be activated.
          </p>
        </div>

        <ShieldCheck size={28} />
      </header>


      <MfaSecurityPanel
        onStateChange={
          setMfaState
        }
      />


      <div
        className={
          hasSecureSession
            ? styles.securityReady
            : styles.securityWaiting
        }
      >
        {hasSecureSession ? (
          <>
            <CheckCircle2
              size={22}
            />

            <div>
              <strong>
                Two-step verification complete
              </strong>

              <span>
                This session is verified at AAL2 and can continue onboarding.
              </span>
            </div>
          </>
        ) : (
          <>
            <ShieldCheck
              size={22}
            />

            <div>
              <strong>
                Security verification required
              </strong>

              <span>
                Add and verify an authenticator method above to continue.
              </span>
            </div>
          </>
        )}
      </div>


      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          {error}
        </div>
      )}


      <div
        className={
          styles.profileActions
        }
      >
        <div>
          <strong>
            Next: Billing
          </strong>

          <span>
            Completing Security does not charge the campaign.
          </span>
        </div>

        <button
          className={styles.primary}
          type="button"
          disabled={
            !hasVerifiedFactor ||
            !hasSecureSession ||
            completing
          }
          onClick={
            completeSecurity
          }
        >
          {completing
            ? "Securing…"
            : (
              <>
                Complete Security
                <ArrowRight size={18} />
              </>
            )}
        </button>
      </div>
    </section>
  );
}
