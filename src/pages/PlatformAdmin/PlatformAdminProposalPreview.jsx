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

import {
  loadAdminProposal,
  sendPlatformProposal,
} from "../../services/platformAdminData";

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
              {proposal.metadata
                ?.included_user_seats ??
                "—"}
            </strong>
          </div>
        </div>

        <p className={styles.proposalSummary}>
          {proposal.terms_summary
            ?.summary}
        </p>

        <div className={styles.proposalItemList}>
          {proposal.items.map(
            (item) => (
              <article
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
        {!clientLink ? (
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
