import {
  useEffect,
  useState,
} from "react";

import {
  Check,
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import {
  useParams,
} from "react-router-dom";

import {
  loadClientProposal,
  respondToClientProposal,
} from "../../services/platformAdminData";

import styles
  from "./SeatProposal.module.css";

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


function proposalValidityLabel(
  proposal,
) {
  if (!proposal?.valid_until) {
    return "Private proposal";
  }

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


export default function SeatProposal() {
  const {
    token,
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
    responding,
    setResponding,
  ] = useState(false);

  const [
    note,
    setNote,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    responseStatus,
    setResponseStatus,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadClientProposal(
              token,
            );

          if (active) {
            setProposal(result);
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Proposal could not be opened.",
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

  const respond =
    async (action) => {
      setResponding(true);
      setError("");

      try {
        const result =
          await respondToClientProposal(
            token,
            action,
            note,
          );

        setResponseStatus(
          result?.status ||
          action,
        );
      } catch (responseError) {
        setError(
          responseError instanceof Error
            ? responseError.message
            : "Response could not be saved.",
        );
      } finally {
        setResponding(false);
      }
    };

  if (loading) {
    return (
      <main className={styles.page}>
        <LoaderCircle
          className={styles.spinner}
          size={36}
        />
      </main>
    );
  }

  if (
    error ||
    !proposal?.found
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <ShieldCheck size={34} />

          <h1>
            Proposal unavailable
          </h1>

          <p>
            {proposal?.expired
              ? "This proposal link has expired."
              : error ||
                "This secure proposal link is invalid or no longer available."}
          </p>
        </section>
      </main>
    );
  }

  if (responseStatus) {
    return (
      <main className={styles.page}>
        <section className={styles.messageCard}>
          <CheckCircle2 size={42} />

          <h1>
            {responseStatus ===
            "approved"
              ? "Proposal approved"
              : responseStatus ===
                "changes_requested"
              ? "Changes requested"
              : "Response received"}
          </h1>

          <p>
            Campaign Seat has securely recorded your response.
          </p>
        </section>
      </main>
    );
  }

  const groupedItems =
    partitionProposalItems(
      proposal.items,
    );

  const includedUsers =
    groupedItems
      .includedUsers
      ?.quantity ??
    "—";

  const validityLabel =
    proposalValidityLabel(
      proposal,
    );

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <strong>
            Seat Platform
          </strong>

          <span>
            Secure Client Proposal
          </span>
        </div>

        <div className={styles.secure}>
          <ShieldCheck size={17} />
          Secure private link
        </div>
      </header>

      <section className={styles.proposal}>
        <div className={styles.hero}>
          <span>
            {proposal.product_name}
          </span>

          <h1>
            {proposal.terms_summary
              ?.headline ||
              "Your Seat Proposal"}
          </h1>

          <p>
            Prepared for{" "}
            <strong>
              {proposal.customer_name}
            </strong>
          </p>

          <small>
            {proposal.proposal_code}
          </small>
        </div>

        <div className={styles.pricing}>
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
              Contract
            </span>

            <strong>
              {proposal.contract_term_months
                ? `${proposal.contract_term_months} months`
                : "Flexible"}
            </strong>
          </div>
        </div>

        <div className={styles.details}>
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
              Included users
            </span>

            <strong>
              {includedUsers}
            </strong>
          </div>

          <div>
            <span>
              Valid until
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

        <section className={styles.section}>
          <h2>
            What you're getting
          </h2>

          <p>
            {proposal.terms_summary
              ?.summary}
          </p>

          <div className={styles.includedGroup}>
            <div className={styles.groupHeading}>
              <span>
                Platform access
              </span>

              <h3>
                Included modules
              </h3>
            </div>

            <div className={styles.moduleGrid}>
              {groupedItems.modules.map(
                (item, index) => (
                  <div
                    className={styles.moduleChip}
                    key={`${item.item_key}-${index}`}
                  >
                    <Check size={15} />

                    <span>
                      {item.display_name}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          {groupedItems.integrations.length > 0 && (
            <div className={styles.includedGroup}>
              <div className={styles.groupHeading}>
                <span>
                  Onboarding
                </span>

                <h3>
                  Connected during onboarding
                </h3>
              </div>

              <div className={styles.integrationGrid}>
                {groupedItems.integrations.map(
                  (item, index) => (
                    <article
                      className={styles.integrationCard}
                      key={`${item.item_key}-${index}`}
                    >
                      <Check size={17} />

                      <div>
                        <strong>
                          {item.display_name}
                        </strong>

                        <span>
                          Securely connected during setup.
                        </span>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </div>
          )}

          {groupedItems.services.length > 0 && (
            <div className={styles.includedGroup}>
              <div className={styles.groupHeading}>
                <span>
                  Implementation
                </span>

                <h3>
                  Additional services
                </h3>
              </div>

              <div className={styles.integrationGrid}>
                {groupedItems.services.map(
                  (item, index) => (
                    <article
                      className={styles.integrationCard}
                      key={`${item.item_key}-${index}`}
                    >
                      <Check size={17} />

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
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2>
            Billing & launch
          </h2>

          <p>
            {proposal.terms_summary
              ?.billing_note}
          </p>
        </section>

        <section className={styles.response}>
          <h2>
            Ready to move forward?
          </h2>

          <textarea
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value,
              )
            }
            rows={3}
            placeholder="Optional note or requested changes"
          />

          {error && (
            <p className={styles.error}>
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.approve}
              type="button"
              disabled={responding}
              onClick={() =>
                respond(
                  "approved",
                )
              }
            >
              <CheckCircle2 size={18} />
              Approve Proposal
            </button>

            <button
              type="button"
              disabled={responding}
              onClick={() =>
                respond(
                  "changes_requested",
                )
              }
            >
              <MessageSquareText size={18} />
              Request Changes
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
