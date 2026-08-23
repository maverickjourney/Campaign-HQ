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
  probeSeatProviderData,
  startSeatProviderConnection,
} from "../../services/seatOnboarding";


import {
  getMfaState,
  verifyTotpFactor,
} from "../../services/mfa";

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


  const [
    connectingIntegrationKey,
    setConnectingIntegrationKey,
  ] =
    useState("");


  const [
    probingIntegrationKey,
    setProbingIntegrationKey,
  ] =
    useState("");

  const [
    providerProbeResults,
    setProviderProbeResults,
  ] =
    useState({});


  const [
    providerMfaPrompt,
    setProviderMfaPrompt,
  ] =
    useState(null);

  const [
    providerMfaCode,
    setProviderMfaCode,
  ] =
    useState("");

  const [
    providerMfaBusy,
    setProviderMfaBusy,
  ] =
    useState(false);

  const [
    providerMfaError,
    setProviderMfaError,
  ] =
    useState("");


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


  const connectProvider =
    async (
      integrationKey,
    ) => {
      if (
        connectingIntegrationKey ||
        activating
      ) {
        return;
      }

      setError("");
      setConnectingIntegrationKey(
        integrationKey,
      );

      try {
        const result =
          await startSeatProviderConnection(
            integrationKey,
          );

        window.location.assign(
          result.authorizationUrl,
        );
      } catch (
        connectionError
      ) {
        setError(
          connectionError instanceof Error
            ? connectionError.message
            : "The provider connection could not be started.",
        );

        setConnectingIntegrationKey(
          "",
        );
      }
    };


  const runProviderProbe =
    async (
      integrationKey,
    ) => {
      setError("");
      setProbingIntegrationKey(
        integrationKey,
      );

      try {
        const result =
          await probeSeatProviderData(
            integrationKey,
          );

        setProviderProbeResults(
          (current) => ({
            ...current,

            [integrationKey]:
              result,
          }),
        );

        return true;
      } catch (
        probeError
      ) {
        setError(
          probeError instanceof Error
            ? probeError.message
            : "Provider data access could not be verified.",
        );

        return false;
      } finally {
        setProbingIntegrationKey(
          "",
        );
      }
    };


  const verifyProviderData =
    async (
      integrationKey,
    ) => {
      if (
        probingIntegrationKey ||
        connectingIntegrationKey ||
        providerMfaBusy ||
        activating
      ) {
        return;
      }

      setError("");
      setProviderMfaError("");

      try {
        const mfaState =
          await getMfaState();

        if (
          mfaState.isAal2
        ) {
          await runProviderProbe(
            integrationKey,
          );

          return;
        }

        const authenticatorFactor =
          mfaState
            .verifiedTotpFactors
            ?.[0];

        if (
          !authenticatorFactor
            ?.id
        ) {
          throw new Error(
            "A verified authenticator method is required before Campaign Seat can inspect connected provider data.",
          );
        }

        setProviderMfaCode(
          "",
        );

        setProviderMfaPrompt({
          integrationKey,

          factorId:
            authenticatorFactor.id,

          friendlyName:
            authenticatorFactor
              .friendly_name ||
            "Campaign Seat Authenticator",
        });
      } catch (
        mfaStateError
      ) {
        setError(
          mfaStateError instanceof Error
            ? mfaStateError.message
            : "Campaign Seat could not verify the current session security level.",
        );
      }
    };


  const confirmProviderMfa =
    async () => {
      const prompt =
        providerMfaPrompt;

      if (
        !prompt ||
        providerMfaBusy
      ) {
        return;
      }

      const normalizedCode =
        String(
          providerMfaCode ||
          "",
        )
          .replace(
            /\D/g,
            "",
          )
          .slice(
            0,
            6,
          );

      if (
        !/^\d{6}$/.test(
          normalizedCode,
        )
      ) {
        setProviderMfaError(
          "Enter the complete six-digit code from Campaign Seat Authenticator.",
        );

        return;
      }

      setProviderMfaBusy(
        true,
      );

      setProviderMfaError(
        "",
      );

      setError(
        "",
      );

      try {
        await verifyTotpFactor({
          factorId:
            prompt.factorId,

          code:
            normalizedCode,
        });

        const integrationKey =
          prompt.integrationKey;

        setProviderMfaPrompt(
          null,
        );

        setProviderMfaCode(
          "",
        );

        await runProviderProbe(
          integrationKey,
        );
      } catch (
        mfaError
      ) {
        setProviderMfaError(
          mfaError instanceof Error
            ? mfaError.message
            : "Campaign Seat could not verify the security code.",
        );
      } finally {
        setProviderMfaBusy(
          false,
        );
      }
    };


  const cancelProviderMfa =
    () => {
      if (
        providerMfaBusy
      ) {
        return;
      }

      setProviderMfaPrompt(
        null,
      );

      setProviderMfaCode(
        "",
      );

      setProviderMfaError(
        "",
      );
    };


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

                  {providerProbeResults[
                    integration.integration_key
                  ]?.success && (
                    <em
                      className={
                        styles.providerProbeVerified
                      }
                    >
                      Email · Calendar · Contacts verified
                    </em>
                  )}
                </section>

                <aside
                  className={
                    styles.activationProviderAction
                  }
                >
                  <b>
                    {connected
                      ? "Connected"
                      : "Pending"}
                  </b>

                  {!connected ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          connectingIntegrationKey,
                        ) ||
                        Boolean(
                          probingIntegrationKey,
                        ) ||
                        activating
                      }
                      onClick={() =>
                        connectProvider(
                          integration
                            .integration_key,
                        )
                      }
                    >
                      {connectingIntegrationKey ===
                      integration.integration_key
                        ? "Opening…"
                        : "Connect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          probingIntegrationKey,
                        ) ||
                        Boolean(
                          connectingIntegrationKey,
                        ) ||
                        activating
                      }
                      onClick={() =>
                        verifyProviderData(
                          integration
                            .integration_key,
                        )
                      }
                    >
                      {probingIntegrationKey ===
                      integration.integration_key
                        ? "Checking…"
                        : providerProbeResults[
                            integration.integration_key
                          ]?.success
                          ? "Verified"
                          : "Verify data"}
                    </button>
                  )}
                </aside>
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


      {providerMfaPrompt && (
        <section
          className={
            styles.providerMfaPrompt
          }
        >
          <div
            className={
              styles.providerMfaPromptHeader
            }
          >
            <div
              className={
                styles.providerMfaIcon
              }
            >
              <ShieldCheck
                size={21}
              />
            </div>

            <div>
              <strong>
                Confirm it’s you
              </strong>

              <span>
                Connected campaign data is protected. Enter the current six-digit code from your Campaign Seat Authenticator to continue.
              </span>
            </div>
          </div>

          <div
            className={
              styles.providerMfaForm
            }
          >
            <label>
              <span>
                Authenticator code
              </span>

              <input
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={
                  providerMfaCode
                }
                disabled={
                  providerMfaBusy
                }
                onChange={(event) =>
                  setProviderMfaCode(
                    event.target.value
                      .replace(
                        /\D/g,
                        "",
                      )
                      .slice(
                        0,
                        6,
                      ),
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    void confirmProviderMfa();
                  }
                }}
              />
            </label>

            <div
              className={
                styles.providerMfaActions
              }
            >
              <button
                type="button"
                className={
                  styles.providerMfaCancel
                }
                disabled={
                  providerMfaBusy
                }
                onClick={
                  cancelProviderMfa
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  styles.providerMfaConfirm
                }
                disabled={
                  providerMfaBusy ||
                  providerMfaCode
                    .replace(
                      /\D/g,
                      "",
                    )
                    .length !==
                    6
                }
                onClick={() =>
                  void confirmProviderMfa()
                }
              >
                {providerMfaBusy
                  ? "Verifying…"
                  : "Verify & Continue"}
              </button>
            </div>
          </div>

          {providerMfaError && (
            <div
              className={
                styles.providerMfaError
              }
              role="alert"
            >
              {
                providerMfaError
              }
            </div>
          )}
        </section>
      )}


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
