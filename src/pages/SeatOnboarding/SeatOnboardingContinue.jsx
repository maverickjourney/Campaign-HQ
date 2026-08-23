import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Circle,
  ShieldCheck,
} from "lucide-react";

import SeatBrand
  from "../../components/brand/SeatBrand/SeatBrand";

import {
  loadMySeatOnboarding,
  reopenMySeatOnboardingStep,
} from "../../services/seatOnboarding";

import SeatCampaignProfileStep
  from "./SeatCampaignProfileStep";


import SeatSecurityStep
  from "./SeatSecurityStep";


import SeatBillingStep
  from "./SeatBillingStep";


import SeatIntegrationsStep
  from "./SeatIntegrationsStep";


import SeatTeamAccessStep
  from "./SeatTeamAccessStep";


import SeatReviewStep
  from "./SeatReviewStep";


import SeatActivationStep
  from "./SeatActivationStep";

import styles
  from "./SeatOnboarding.module.css";


export default function SeatOnboardingContinue() {
  const [
    onboarding,
    setOnboarding,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  const [
    reopeningStepKey,
    setReopeningStepKey,
  ] = useState("");

  const [
    navigationError,
    setNavigationError,
  ] = useState("");


  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadMySeatOnboarding();

          if (active) {
            setOnboarding(
              result,
            );
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Onboarding could not be loaded.",
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
  }, []);


  const currentStep =
    useMemo(
      () =>
        (onboarding?.steps || [])
          .find(
            (step) =>
              step.step_key ===
              onboarding?.current_step_key,
          ) || null,
      [
        onboarding,
      ],
    );


  const reopenStep =
    async (stepKey) => {
      if (reopeningStepKey) {
        return;
      }

      setNavigationError("");
      setReopeningStepKey(
        stepKey,
      );

      try {
        await reopenMySeatOnboardingStep(
          stepKey,
        );

        window.location.reload();
      } catch (reopenError) {
        setNavigationError(
          reopenError instanceof Error
            ? reopenError.message
            : "That onboarding step could not be reopened.",
        );

        setReopeningStepKey("");
      }
    };


  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.centerMessage}>
          Loading your secure onboarding…
        </div>
      </main>
    );
  }


  if (
    error ||
    !onboarding?.found
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <ShieldCheck size={38} />

          <h1>
            Sign in to continue
          </h1>

          <p>
            {error ||
              "Finish email verification, then return to your Seat onboarding sign-in."}
          </p>
        </section>
      </main>
    );
  }


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

      <section className={styles.continueLayout}>
        <div className={styles.continueHeader}>
          <span className={styles.eyebrow}>
            {onboarding.product_name}
          </span>

          <h1>
            Your account is secured.
          </h1>

          <p>
            Welcome,{" "}
            <strong>
              {onboarding.full_name}
            </strong>
            . We’ll now configure{" "}
            <strong>
              {onboarding.account_name}
            </strong>
            .
          </p>
        </div>

        <section className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <div>
              <span>
                Onboarding progress
              </span>

              <h2>
                Next:{" "}
                {currentStep?.display_name ||
                  "Onboarding"}
              </h2>
            </div>

            <ShieldCheck size={24} />
          </div>

          <div className={styles.steps}>
            {(onboarding.steps || [])
              .map(
                (step) => {
                  const canReopen =
                    step.status ===
                      "complete" &&
                    [
                      "product_profile",
                      "security",
                      "billing",
                      "integrations",
                      "team",
                    ].includes(
                      step.step_key,
                    );

                  const content = (
                    <>
                      <div
                        className={
                          styles.stepIcon
                        }
                      >
                        {step.status ===
                        "complete" ? (
                          <Check
                            size={16}
                          />
                        ) : (
                          <Circle
                            size={15}
                          />
                        )}
                      </div>

                      <div
                        className={
                          styles.stepCopy
                        }
                      >
                        <strong>
                          {
                            step.display_name
                          }
                        </strong>

                        <span>
                          {step.status.replace(
                            "_",
                            " ",
                          )}
                        </span>
                      </div>

                      {canReopen && (
                        <span
                          className={
                            styles.stepEditHint
                          }
                        >
                          {reopeningStepKey ===
                          step.step_key
                            ? "Opening…"
                            : "Edit"}
                        </span>
                      )}
                    </>
                  );

                  return canReopen ? (
                    <button
                      className={
                        styles.progressStepButton
                      }
                      key={
                        step.step_key
                      }
                      data-status={
                        step.status
                      }
                      type="button"
                      disabled={
                        Boolean(
                          reopeningStepKey,
                        )
                      }
                      onClick={() =>
                        reopenStep(
                          step.step_key,
                        )
                      }
                    >
                      {content}
                    </button>
                  ) : (
                    <article
                      key={
                        step.step_key
                      }
                      data-status={
                        step.status
                      }
                    >
                      {content}
                    </article>
                  );
                },
              )}
          </div>

          {navigationError && (
            <div
              className={
                styles.progressNavigationError
              }
              role="alert"
            >
              {navigationError}
            </div>
          )}
        </section>


        {onboarding.current_step_key ===
        "product_profile" ? (
          <SeatCampaignProfileStep
            onboarding={onboarding}
          />
        ) : onboarding.current_step_key ===
          "security" ? (
          <SeatSecurityStep />
        ) : onboarding.current_step_key ===
          "billing" ? (
          <SeatBillingStep />
        ) : onboarding.current_step_key ===
          "integrations" ? (
          <SeatIntegrationsStep />
        ) : onboarding.current_step_key ===
          "team" ? (
          <SeatTeamAccessStep />
        ) : onboarding.current_step_key ===
          "review" ? (
          <SeatReviewStep />
        ) : onboarding.current_step_key ===
          "activation" ? (
          <SeatActivationStep />
        ) : (
          <div className={styles.nextNotice}>
            The{" "}
            {currentStep?.display_name ||
              "next onboarding"}{" "}
            step is ready for the next build.
          </div>
        )}
      </section>
    </main>
  );
}
