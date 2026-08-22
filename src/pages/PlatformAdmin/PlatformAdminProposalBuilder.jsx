import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  FileText,
  LoaderCircle,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  createPlatformProposalDraft,
  loadProposalBuilder,
} from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";

function dollars(
  cents,
) {
  return cents == null
    ? ""
    : String(cents / 100);
}

function dollarsToCents(
  value,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? Math.max(
        0,
        Math.round(number * 100),
      )
    : 0;
}

export default function PlatformAdminProposalBuilder() {
  const {
    dealCode,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    context,
    setContext,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({
    customerName: "",
    clientName: "",
    clientEmail: "",
    monthlyPrice: "",
    setupFee: "",
    contractMonths: "",
    validDays: "7",
    headline:
      "Your Campaign Seat",
    summary:
      "A secure operating workspace configured around your team, communications and campaign operations.",
    billingNote:
      "Billing begins after onboarding and activation.",
  });

  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadProposalBuilder(
              dealCode,
            );

          if (!active) {
            return;
          }

          setContext(
            result,
          );

          setForm(
            (current) => ({
              ...current,

              customerName:
                result.customer
                  .display_name ||
                "",

              clientName:
                result.primaryContact
                  ?.full_name ||
                "",

              clientEmail:
                result.primaryContact
                  ?.email ||
                result.customer
                  .billing_email ||
                "",

              monthlyPrice:
                dollars(
                  result.deal
                    .expected_monthly_cents,
                ),

              setupFee:
                dollars(
                  result.deal
                    .expected_setup_cents,
                ),

              contractMonths:
                result.deal
                  .contract_term_months !=
                null
                  ? String(
                      result.deal
                        .contract_term_months,
                    )
                  : "",
            }),
          );
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Proposal could not be prepared.",
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
  }, [dealCode]);

  const change =
    (key) =>
      (event) => {
        setForm(
          (current) => ({
            ...current,
            [key]:
              event.target.value,
          }),
        );
      };

  const submit =
    async (event) => {
      event.preventDefault();

      setSaving(true);
      setError("");

      try {
        const created =
          await createPlatformProposalDraft({
            dealCode,

            customerName:
              form.customerName.trim(),

            clientName:
              form.clientName.trim(),

            clientEmail:
              form.clientEmail.trim(),

            monthlyCents:
              dollarsToCents(
                form.monthlyPrice,
              ),

            setupCents:
              dollarsToCents(
                form.setupFee,
              ),

            contractMonths:
              form.contractMonths
                ? Number(
                    form.contractMonths,
                  )
                : null,

            validDays:
              Number(
                form.validDays,
              ) || 7,

            termsSummary: {
              headline:
                form.headline.trim(),

              summary:
                form.summary.trim(),

              billing_note:
                form.billingNote.trim(),
            },
          });

        navigate(
          `/admin/proposals/${created.proposal_id}`,
        );
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Proposal could not be created.",
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <PlatformAdminShell
        title="Proposal Builder"
      >
        <section className={styles.adminPanel}>
          Loading proposal…
        </section>
      </PlatformAdminShell>
    );
  }

  return (
    <PlatformAdminShell
      title="Proposal Builder"
      description={`Build the client-facing proposal for ${dealCode}.`}
      actions={
        <Link
          className={styles.secondaryAction}
          to="/admin/customers"
        >
          <ArrowLeft size={16} />
          Customers
        </Link>
      }
    >
      <form
        className={styles.proposalBuilder}
        onSubmit={submit}
      >
        {error && (
          <div className={styles.adminError}>
            {error}
          </div>
        )}

        <section className={styles.adminPanel}>
          <h2>
            Client identity
          </h2>

          <div className={styles.formGrid}>
            <label>
              Customer / organization

              <input
                value={
                  form.customerName
                }
                onChange={
                  change(
                    "customerName",
                  )
                }
                required
              />
            </label>

            <label>
              Primary contact

              <input
                value={
                  form.clientName
                }
                onChange={
                  change(
                    "clientName",
                  )
                }
                required
              />
            </label>

            <label>
              Proposal email

              <input
                type="email"
                value={
                  form.clientEmail
                }
                onChange={
                  change(
                    "clientEmail",
                  )
                }
                required
              />
            </label>

            <label>
              Product

              <input
                value={
                  context
                    ?.product
                    ?.product_name ||
                  ""
                }
                disabled
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            Commercial terms
          </h2>

          <div className={styles.proposalTermsGrid}>
            <label>
              Monthly fee ($)

              <input
                type="number"
                min="0"
                value={
                  form.monthlyPrice
                }
                onChange={
                  change(
                    "monthlyPrice",
                  )
                }
              />
            </label>

            <label>
              Onboarding fee ($)

              <input
                type="number"
                min="0"
                value={
                  form.setupFee
                }
                onChange={
                  change(
                    "setupFee",
                  )
                }
              />
            </label>

            <label>
              Contract months

              <input
                type="number"
                min="0"
                value={
                  form.contractMonths
                }
                onChange={
                  change(
                    "contractMonths",
                  )
                }
                placeholder="Optional"
              />
            </label>

            <label>
              Proposal valid days

              <input
                type="number"
                min="1"
                max="30"
                value={
                  form.validDays
                }
                onChange={
                  change(
                    "validDays",
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            Client-facing message
          </h2>

          <div className={styles.proposalMessageGrid}>
            <label>
              Headline

              <input
                value={
                  form.headline
                }
                onChange={
                  change(
                    "headline",
                  )
                }
              />
            </label>

            <label>
              Summary

              <textarea
                rows={4}
                value={
                  form.summary
                }
                onChange={
                  change(
                    "summary",
                  )
                }
              />
            </label>

            <label>
              Billing note

              <textarea
                rows={3}
                value={
                  form.billingNote
                }
                onChange={
                  change(
                    "billingNote",
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            Configuration coming from the deal
          </h2>

          <div className={styles.proposalConfigSummary}>
            <div>
              <strong>
                Included users
              </strong>

              <span>
                {context?.deal?.metadata
                  ?.included_user_seats ??
                  "Not specified"}
              </span>
            </div>

            <div>
              <strong>
                Modules
              </strong>

              <span>
                {(
                  context?.deal?.metadata
                    ?.requested_module_keys ||
                  []
                ).length}
                {" "}selected
              </span>
            </div>

            <div>
              <strong>
                Integrations
              </strong>

              <span>
                {(
                  context?.deal?.metadata
                    ?.requested_integration_keys ||
                  []
                ).length}
                {" "}selected
              </span>
            </div>

            <div>
              <strong>
                HQ priorities
              </strong>

              <span>
                {(
                  context?.deal?.metadata
                    ?.dashboard_emphasis ||
                  []
                ).length}
                {" "}selected
              </span>
            </div>
          </div>
        </section>

        <div className={styles.proposalActionBar}>
          <div>
            <strong>
              Draft first
            </strong>

            <span>
              You will preview the exact client proposal before generating a secure link.
            </span>
          </div>

          <button
            className={styles.primaryAction}
            type="submit"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircle size={17} />
                Creating…
              </>
            ) : (
              <>
                <FileText size={17} />
                Create Proposal Draft
              </>
            )}
          </button>
        </div>
      </form>
    </PlatformAdminShell>
  );
}
