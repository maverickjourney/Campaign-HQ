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

        <section className={styles.section}>
          <h2>
            What you're getting
          </h2>

          <p>
            {proposal.terms_summary
              ?.summary}
          </p>

          <div className={styles.items}>
            {(proposal.items || []).map(
              (item, index) => (
                <article
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

                  {!item.included &&
                    item.unit_amount_cents >
                      0 && (
                    <small>
                      {money(
                        item.unit_amount_cents,
                      )}
                      {item.billing_cadence ===
                      "monthly"
                        ? "/mo"
                        : ""}
                    </small>
                  )}
                </article>
              ),
            )}
          </div>
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
