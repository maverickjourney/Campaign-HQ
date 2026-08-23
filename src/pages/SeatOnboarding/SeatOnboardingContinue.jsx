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
} from "../../services/seatOnboarding";

import SeatCampaignProfileStep
  from "./SeatCampaignProfileStep";


import SeatSecurityStep
  from "./SeatSecurityStep";


import SeatBillingStep
  from "./SeatBillingStep";

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
                (step) => (
                  <article
                    key={step.step_key}
                    data-status={
                      step.status
                    }
                  >
                    <div className={styles.stepIcon}>
                      {step.status ===
                      "complete" ? (
                        <Check size={16} />
                      ) : (
                        <Circle size={15} />
                      )}
                    </div>

                    <div>
                      <strong>
                        {step.display_name}
                      </strong>

                      <span>
                        {step.status.replace(
                          "_",
                          " ",
                        )}
                      </span>
                    </div>
                  </article>
                ),
              )}
          </div>
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
