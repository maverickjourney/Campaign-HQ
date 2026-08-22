import {
  useEffect,
  useState,
} from "react";

import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Send,
} from "lucide-react";

import {
  useParams,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import SeatBrand
  from "../../components/brand/SeatBrand/SeatBrand";

import {
  loadAdminProposal,
  sendPlatformProposal,
} from "../../services/platformAdminData";

import {
  provisionApprovedSeatProposal,
} from "../../services/seatOnboarding";

import styles
  from "./PlatformAdmin.module.css";

function money(
  cents,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(
    (cents || 0) / 100,
  );
}


function partitionProposalItems(
  items = [],
) {
  return {
    modules:
      items.filter(
        (item) =>
          item.item_type ===
          "module",
      ),

    integrations:
      items.filter(
        (item) =>
          item.item_type ===
          "integration",
      ),

    services:
      items.filter(
        (item) =>
          [
            "addon",
            "migration",
            "custom",
          ].includes(
            item.item_type,
          ) ||
          (
            item.item_type ===
              "service" &&
            item.item_key !==
              "onboarding_setup"
          ),
      ),

    includedUsers:
      items.find(
        (item) =>
          item.item_key ===
          "included_users",
      ) || null,
  };
}


function proposalTermLabel(
  proposal,
) {
  return proposal
    ?.contract_term_months
    ? `${proposal.contract_term_months} months`
    : "Flexible";
}


function proposalValidityLabel(
  proposal,
) {
  if (proposal?.valid_until) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    ).format(
      new Date(
        proposal.valid_until,
      ),
    );
  }

  const days =
    proposal
      ?.metadata
      ?.proposal_valid_days ||
    7;

  return `${days} days after sending`;
}


export default function PlatformAdminProposalPreview() {
  const {
    proposalId,
  } = useParams();

  const [
    proposal,
    setProposal,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    clientLink,
    setClientLink,
  ] = useState("");

  const [
    copied,
    setCopied,
  ] = useState(false);


  const [
    onboardingRole,
    setOnboardingRole,
  ] = useState("candidate");

  const [
    provisioning,
    setProvisioning,
  ] = useState(false);

  const [
    onboardingResult,
    setOnboardingResult,
  ] = useState(null);

  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadAdminProposal(
              proposalId,
            );

          if (active) {
            setProposal(result);
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Proposal could not be loaded.",
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
  }, [proposalId]);

  const sendProposal =
    async () => {
      setSending(true);
      setError("");

      try {
        const result =
          await sendPlatformProposal(
            proposalId,
            proposal?.metadata
              ?.proposal_valid_days ||
              7,
          );

        const link =
          `${window.location.origin}/proposal/${result.access_token}`;

        setClientLink(link);

        setProposal(
          (current) => ({
            ...current,
            status: "sent",
            valid_until:
              result.valid_until,
          }),
        );
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Proposal link could not be generated.",
        );
      } finally {
        setSending(false);
      }
    };

  const provisionOnboarding =
    async () => {
      setProvisioning(true);
      setError("");

      try {
        const result =
          await provisionApprovedSeatProposal(
            proposalId,
            onboardingRole,
          );

        setOnboardingResult(
          result,
        );
      } catch (provisionError) {
        setError(
          provisionError instanceof Error
            ? provisionError.message
            : "Client onboarding could not be provisioned.",
        );
      } finally {
        setProvisioning(false);
      }
    };


  const copyLink =
    async () => {
      await navigator
        .clipboard
        .writeText(
          clientLink,
        );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(false),
        1500,
      );
    };

  if (
    loading ||
    !proposal
  ) {
    return (
      <PlatformAdminShell
        title="Proposal Preview"
      >
        <section className={styles.adminPanel}>
          {error ||
            "Loading proposal…"}
        </section>
      </PlatformAdminShell>
    );
  }

  const groupedItems =
    partitionProposalItems(
      proposal.items,
    );

  const includedUsers =
    proposal.metadata
      ?.included_user_seats ??
    groupedItems
      .includedUsers
      ?.quantity ??
    "—";

  const termLabel =
    proposalTermLabel(
      proposal,
    );

  const validityLabel =
    proposalValidityLabel(
      proposal,
    );

  return (
    <PlatformAdminShell
      title="Proposal Preview"
      description="Review exactly what the client will see before creating their secure link."
    >
      {error && (
        <div className={styles.adminError}>
          {error}
        </div>
      )}

      <section className={styles.proposalPreview}>
        <div className={styles.proposalPreviewHeader}>
          <div className={styles.proposalBrand}>
            <SeatBrand
              variant="wordmark"
              color="black"
              className={styles.proposalBrandLogo}
            />
          </div>
          <span>
            {proposal.product
              ?.product_name}
          </span>

          <h2>
            {proposal.terms_summary
              ?.headline ||
              "Your Seat Proposal"}
          </h2>

          <p>
            Prepared for{" "}
            <strong>
              {proposal.customer
                ?.display_name}
            </strong>
          </p>

          <small>
            {proposal.proposal_code}
            {" · "}
            Version {proposal.version}
          </small>
        </div>

        <div className={styles.proposalPricing}>
          <div>
            <span>
              Monthly
            </span>

            <strong>
              {money(
                proposal.monthly_total_cents,
              )}
            </strong>
          </div>

          <div>
            <span>
              Onboarding
            </span>

            <strong>
              {money(
                proposal.setup_total_cents,
              )}
            </strong>
          </div>

          <div>
            <span>
              Included users
            </span>

            <strong>
              {includedUsers}
            </strong>
          </div>
        </div>

        <p className={styles.proposalSummary}>
          {proposal.terms_summary
            ?.summary}
        </p>

        <div className={styles.proposalMetaGrid}>
          <div>
            <span>
              Proposal
            </span>

            <strong>
              {proposal.proposal_code}
            </strong>
          </div>

          <div>
            <span>
              Term
            </span>

            <strong>
              {termLabel}
            </strong>
          </div>

          <div>
            <span>
              Valid
            </span>

            <strong>
              {validityLabel}
            </strong>
          </div>

          <div>
            <span>
              Billing
            </span>

            <strong>
              After onboarding
            </strong>
          </div>
        </div>

        {groupedItems.modules.length > 0 && (
          <section className={styles.proposalContentSection}>
            <div className={styles.proposalSectionHeading}>
              <div>
                <span>
                  Platform access
                </span>

                <h3>
                  Included modules
                </h3>
              </div>

              <strong>
                {groupedItems.modules.length}
              </strong>
            </div>

            <div className={styles.proposalCompactGrid}>
              {groupedItems.modules.map(
                (item) => (
                  <div
                    className={styles.proposalCompactItem}
                    key={item.id}
                  >
                    <Check size={15} />

                    <span>
                      {item.display_name}
                    </span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {groupedItems.integrations.length > 0 && (
          <section className={styles.proposalContentSection}>
            <div className={styles.proposalSectionHeading}>
              <div>
                <span>
                  Onboarding
                </span>

                <h3>
                  Connected during onboarding
                </h3>
              </div>
            </div>

            <div className={styles.proposalIntegrationGrid}>
              {groupedItems.integrations.map(
                (item) => (
                  <article
                    className={styles.proposalIntegrationCard}
                    key={item.id}
                  >
                    <Check size={17} />

                    <div>
                      <strong>
                        {item.display_name}
                      </strong>

                      <span>
                        Securely connected during onboarding.
                      </span>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        {groupedItems.services.length > 0 && (
          <section className={styles.proposalContentSection}>
            <div className={styles.proposalSectionHeading}>
              <div>
                <span>
                  Implementation
                </span>

                <h3>
                  Additional services
                </h3>
              </div>
            </div>

            <div className={styles.proposalServiceGrid}>
              {groupedItems.services.map(
                (item) => (
                  <article
                    className={styles.proposalServiceCard}
                    key={item.id}
                  >
                    <Check size={16} />

                    <div>
                      <strong>
                        {item.display_name}
                      </strong>

                      {item.description && (
                        <span>
                          {item.description}
                        </span>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        <div className={styles.proposalTermsBox}>
          <strong>
            Billing
          </strong>

          <p>
            {proposal.terms_summary
              ?.billing_note}
          </p>
        </div>
      </section>

      <section className={styles.proposalSendPanel}>
        {proposal.status === "approved" ? (
          onboardingResult ? (
            onboardingResult.existing_user ? (
              <>
                <div>
                  <strong>
                    Existing Seat account linked.
                  </strong>

                  <span>
                    The approved customer can sign in and continue onboarding.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.clientLinkBox}>
                  <strong>
                    Private onboarding link
                  </strong>

                  <span>
                    {`${window.location.origin}/onboarding/${onboardingResult.invitation_token}`}
                  </span>
                </div>

                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${window.location.origin}/onboarding/${onboardingResult.invitation_token}`,
                    )
                  }
                >
                  <Copy size={16} />
                  Copy onboarding link
                </button>

                <a
                  className={styles.primaryAction}
                  href={`${window.location.origin}/onboarding/${onboardingResult.invitation_token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} />
                  Open onboarding
                </a>
              </>
            )
          ) : (
            <>
              <div>
                <strong>
                  Proposal approved.
                </strong>

                <span>
                  Provision the product account, pending billing record and private onboarding invitation.
                </span>
              </div>

              <label className={styles.onboardingRoleField}>
                Initial role

                <select
                  value={onboardingRole}
                  onChange={(event) =>
                    setOnboardingRole(
                      event.target.value,
                    )
                  }
                >
                  <option value="candidate">
                    Candidate
                  </option>

                  <option value="campaign_manager">
                    Campaign Manager
                  </option>

                  <option value="campaign_consultant">
                    Campaign Consultant
                  </option>

                  <option value="campaign_administrator">
                    Campaign Administrator
                  </option>
                </select>
              </label>

              <button
                className={styles.primaryAction}
                type="button"
                onClick={provisionOnboarding}
                disabled={provisioning}
              >
                {provisioning
                  ? "Provisioning…"
                  : "Start Client Onboarding"}
              </button>
            </>
          )
        ) : !clientLink ? (
          <>
            <div>
              <strong>
                Proposal is still private.
              </strong>

              <span>
                Generate a secure expiring client link when this preview is ready.
              </span>
            </div>

            <button
              className={styles.primaryAction}
              type="button"
              onClick={sendProposal}
              disabled={sending}
            >
              {sending ? (
                <>
                  <LoaderCircle size={17} />
                  Generating…
                </>
              ) : (
                <>
                  <Send size={17} />
                  Generate Secure Client Link
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div className={styles.clientLinkBox}>
              <strong>
                Secure client link
              </strong>

              <span>
                {clientLink}
              </span>
            </div>

            <button
              className={styles.secondaryAction}
              type="button"
              onClick={copyLink}
            >
              <Copy size={16} />
              {copied
                ? "Copied"
                : "Copy link"}
            </button>

            <a
              className={styles.primaryAction}
              href={clientLink}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              Open Client View
            </a>
          </>
        )}
      </section>
    </PlatformAdminShell>
  );
}
