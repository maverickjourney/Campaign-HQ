import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  Cloud,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";

import {
  activateMyCampaignSeat,
  loadMyCampaignSeatActivationStatus,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


function money(
  cents,
  currency = "USD",
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(
    Number(cents || 0) /
      100,
  );
}


function readableStatus(
  value,
) {
  return String(
    value ||
    "",
  )
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}


export default function SeatActivationStep() {
  const [
    status,
    setStatus,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    activating,
    setActivating,
  ] =
    useState(false);

  const [
    confirmed,
    setConfirmed,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    activationResult,
    setActivationResult,
  ] =
    useState(null);


  const load =
    async ({
      refresh = false,
    } = {}) => {
      if (refresh) {
        setRefreshing(true);
      }

      try {
        const result =
          await loadMyCampaignSeatActivationStatus();

        setStatus(
          result,
        );

        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Activation status could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };


  useEffect(() => {
    void load();
  }, []);


  const activate =
    async () => {
      if (
        activating ||
        !confirmed ||
        !status?.ready
      ) {
        return;
      }

      setActivating(true);
      setError("");

      try {
        const result =
          await activateMyCampaignSeat();

        setActivationResult(
          result,
        );

        setStatus(
          (current) => ({
            ...current,

            activated:
              true,

            ready:
              true,

            workspace_id:
              result.workspace_id,
          }),
        );
      } catch (
        activationError
      ) {
        setError(
          activationError instanceof Error
            ? activationError.message
            : "Campaign Seat could not be activated.",
        );
      } finally {
        setActivating(false);
      }
    };


  if (loading) {
    return (
      <section
        className={
          styles.activationCard
        }
      >
        <LoaderCircle
          size={29}
        />

        Loading Activation status…
      </section>
    );
  }


  if (
    activationResult ||
    status?.activated
  ) {
    const workspaceId =
      activationResult
        ?.workspace_id ||
      status?.workspace_id;


    return (
      <section
        className={[
          styles.activationCard,
          styles.activationSuccess,
        ].join(" ")}
      >
        <div
          className={
            styles.activationSuccessIcon
          }
        >
          <BadgeCheck
            size={34}
          />
        </div>

        <span
          className={
            styles.eyebrow
          }
        >
          Campaign Seat activated
        </span>

        <h2>
          Your Campaign HQ is ready.
        </h2>

        <p>
          The secure Campaign workspace has been created and your Campaign Owner access is active.
        </p>

        {activationResult
          ?.invitation_delivery
          ?.some(
            (item) =>
              !item.sent,
          ) && (
          <div
            className={
              styles.activationWarning
            }
          >
            <TriangleAlert
              size={19}
            />

            <span>
              The workspace is active, but one or more launch-team invitation emails require follow-up.
            </span>
          </div>
        )}

        <button
          className={
            styles.activationLaunchButton
          }
          type="button"
          onClick={() => {
            if (workspaceId) {
              window.location.href =
                "/dashboard";
            }
          }}
        >
          Open Campaign HQ
          <ArrowRight
            size={19}
          />
        </button>
      </section>
    );
  }


  if (
    !status?.found
  ) {
    return (
      <section
        className={
          styles.activationCard
        }
      >
        <TriangleAlert
          size={28}
        />

        <strong>
          Campaign Seat Activation could not be found.
        </strong>
      </section>
    );
  }


  const blockers =
    status.blockers ||
    [];

  const integrations =
    status.integrations ||
    [];


  return (
    <section
      className={
        styles.activationCard
      }
    >
      <header
        className={
          styles.activationHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Activation
          </span>

          <h2>
            Launch your Campaign Seat.
          </h2>

          <p>
            Activation creates the live Campaign workspace only after every required security, billing and provider connection is actually ready.
          </p>
        </div>

        <Rocket size={31} />
      </header>


      <div
        className={
          status.ready
            ? styles.activationReadyBanner
            : styles.activationLockedBanner
        }
      >
        {status.ready ? (
          <ShieldCheck
            size={22}
          />
        ) : (
          <LockKeyhole
            size={22}
          />
        )}

        <div>
          <strong>
            {status.ready
              ? "All launch requirements are complete."
              : "Activation is safely locked."}
          </strong>

          <span>
            {status.ready
              ? "Campaign Seat can now create the live Campaign workspace."
              : "Nothing will be activated until every remaining launch requirement is satisfied."}
          </span>
        </div>
      </div>


      <div
        className={
          styles.activationRequirementGrid
        }
      >
        <article
          data-ready="true"
        >
          <div>
            <Check size={18} />
          </div>

          <section>
            <strong>
              Onboarding Review
            </strong>

            <span>
              Final client details confirmed
            </span>
          </section>

          <b>
            Ready
          </b>
        </article>


        <article
          data-ready={
            status.billing?.ready
              ? "true"
              : "false"
          }
        >
          <div>
            {status.billing?.ready ? (
              <Check size={18} />
            ) : (
              <CreditCard
                size={18}
              />
            )}
          </div>

          <section>
            <strong>
              Billing
            </strong>

            <span>
              {money(
                status.billing
                  ?.monthly_amount_cents,
                status.billing
                  ?.currency,
              )}/month ·{" "}
              {readableStatus(
                status.billing
                  ?.status,
              )}
            </span>
          </section>

          <b>
            {status.billing?.ready
              ? "Ready"
              : "Pending"}
          </b>
        </article>


        {integrations.map(
          (integration) => {
            const connected =
              integration.status ===
              "connected";

            return (
              <article
                key={
                  integration
                    .integration_key
                }
                data-ready={
                  connected
                    ? "true"
                    : "false"
                }
              >
                <div>
                  {connected ? (
                    <Check
                      size={18}
                    />
                  ) : (
                    <Cloud
                      size={18}
                    />
                  )}
                </div>

                <section>
                  <strong>
                    {
                      integration
                        .display_name
                    }
                  </strong>

                  <span>
                    {connected
                      ? integration
                          .display_email ||
                        "Secure provider authorization complete"
                      : "Secure OAuth authorization required"}
                  </span>
                </section>

                <b>
                  {connected
                    ? "Connected"
                    : "Pending"}
                </b>
              </article>
            );
          },
        )}


        <article
          data-ready="true"
        >
          <div>
            <Users size={18} />
          </div>

          <section>
            <strong>
              Team & access
            </strong>

            <span>
              Launch access plan saved
            </span>
          </section>

          <b>
            Ready
          </b>
        </article>
      </div>


      {!status.ready && (
        <section
          className={
            styles.activationBlockers
          }
        >
          <div
            className={
              styles.activationBlockerHeading
            }
          >
            <TriangleAlert
              size={20}
            />

            <div>
              <strong>
                Requirements remaining
              </strong>

              <span>
                Complete these before Campaign Seat can launch the workspace.
              </span>
            </div>
          </div>

          <div
            className={
              styles.activationBlockerList
            }
          >
            {blockers.map(
              (blocker) => (
                <article
                  key={
                    blocker.key
                  }
                >
                  <div />

                  <section>
                    <strong>
                      {
                        blocker.title
                      }
                    </strong>

                    <span>
                      {
                        blocker.description
                      }
                    </span>
                  </section>
                </article>
              ),
            )}
          </div>
        </section>
      )}


      {status.ready && (
        <label
          className={
            styles.activationConfirmation
          }
        >
          <input
            type="checkbox"
            checked={
              confirmed
            }
            onChange={(event) =>
              setConfirmed(
                event.target.checked,
              )
            }
          />

          <div>
            <strong>
              Activate this Campaign Seat workspace.
            </strong>

            <span>
              I understand that Activation creates the live Campaign workspace, assigns Campaign Owner access and prepares any planned team invitations.
            </span>
          </div>
        </label>
      )}


      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </div>
      )}


      <div
        className={
          styles.activationActions
        }
      >
        <button
          className={
            styles.activationRefreshButton
          }
          type="button"
          disabled={
            refreshing ||
            activating
          }
          onClick={() =>
            load({
              refresh: true,
            })
          }
        >
          <RefreshCw
            size={17}
          />

          {refreshing
            ? "Checking…"
            : "Refresh launch status"}
        </button>

        <button
          className={
            styles.activationLaunchButton
          }
          type="button"
          disabled={
            !status.ready ||
            !confirmed ||
            activating
          }
          onClick={activate}
        >
          {activating
            ? "Activating…"
            : status.ready
              ? (
                <>
                  Activate Campaign Seat
                  <ArrowRight
                    size={19}
                  />
                </>
              )
              : (
                <>
                  <LockKeyhole
                    size={18}
                  />
                  Activation locked
                </>
              )}
        </button>
      </div>
    </section>
  );
}
