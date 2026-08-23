import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import {
  loadMySeatBillingSetup,
  saveMySeatBillingSetup,
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


export default function SeatBillingStep() {
  const [
    billing,
    setBilling,
  ] =
    useState(null);

  const [
    form,
    setForm,
  ] =
    useState({
      billing_name: "",
      billing_email: "",
      billing_phone: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state_region: "",
      postal_code: "",
      country_code: "US",
      terms_confirmed: false,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadMySeatBillingSetup();

          if (
            !active ||
            !result?.found
          ) {
            return;
          }

          setBilling(result);

          const address =
            result.billing_address ||
            {};

          setForm({
            billing_name:
              result.full_name ||
              "",

            billing_email:
              result.billing_email ||
              "",

            billing_phone:
              result.phone ||
              "",

            address_line1:
              address.line1 ||
              "",

            address_line2:
              address.line2 ||
              "",

            city:
              address.city ||
              "",

            state_region:
              address.state_region ||
              "",

            postal_code:
              address.postal_code ||
              "",

            country_code:
              address.country_code ||
              "US",

            terms_confirmed:
              false,
          });
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Billing setup could not be loaded.",
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


  const update =
    (field) =>
      (event) => {
        setForm(
          (current) => ({
            ...current,

            [field]:
              field ===
              "terms_confirmed"
                ? event.target.checked
                : event.target.value,
          }),
        );
      };


  const submit =
    async (event) => {
      event.preventDefault();

      if (
        saving ||
        !form.terms_confirmed
      ) {
        return;
      }

      setSaving(true);
      setError("");

      try {
        await saveMySeatBillingSetup(
          form,
        );

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Billing setup could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <section
        className={
          styles.billingCard
        }
      >
        <LoaderCircle
          size={28}
        />

        Loading billing details…
      </section>
    );
  }


  return (
    <form
      className={
        styles.billingCard
      }
      onSubmit={submit}
    >
      <header
        className={
          styles.billingHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Billing
          </span>

          <h2>
            Confirm your billing setup.
          </h2>

          <p>
            Review the approved commercial terms and confirm where Campaign Seat billing should be sent.
          </p>
        </div>

        <ReceiptText
          size={28}
        />
      </header>


      {billing?.found && (
        <section
          className={
            styles.billingSummary
          }
        >
          <article>
            <span>
              Monthly
            </span>

            <strong>
              {money(
                billing.monthly_amount_cents,
                billing.currency,
              )}
            </strong>
          </article>

          <article>
            <span>
              Onboarding
            </span>

            <strong>
              {money(
                billing.onboarding_fee_cents,
                billing.currency,
              )}
            </strong>
          </article>

          <article>
            <span>
              Included users
            </span>

            <strong>
              {billing.included_user_seats ??
                "—"}
            </strong>
          </article>

          <article>
            <span>
              Billing status
            </span>

            <strong>
              Pending setup
            </strong>
          </article>
        </section>
      )}


      <div
        className={
          styles.billingNotice
        }
      >
        <ShieldCheck size={20} />

        <div>
          <strong>
            No payment is being processed on this screen.
          </strong>

          <span>
            Payment information will be connected through the approved Campaign Seat billing provider before final activation.
          </span>
        </div>
      </div>


      <section
        className={
          styles.profileSection
        }
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <CreditCard size={19} />

          <div>
            <strong>
              Billing contact
            </strong>

            <span>
              Where invoices, receipts and billing notices should go.
            </span>
          </div>
        </div>

        <div
          className={[
            styles.profileGrid,
            styles.billingFormGrid,
          ].join(" ")}
        >
          <label>
            Billing contact name

            <input
              value={
                form.billing_name
              }
              onChange={update(
                "billing_name",
              )}
              required
            />
          </label>

          <label>
            Billing email

            <input
              type="email"
              value={
                form.billing_email
              }
              onChange={update(
                "billing_email",
              )}
              required
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Billing phone

            <input
              value={
                form.billing_phone
              }
              onChange={update(
                "billing_phone",
              )}
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Billing address

            <input
              value={
                form.address_line1
              }
              onChange={update(
                "address_line1",
              )}
              required
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Address line 2

            <input
              value={
                form.address_line2
              }
              onChange={update(
                "address_line2",
              )}
            />
          </label>

          <label>
            City

            <input
              value={form.city}
              onChange={update(
                "city",
              )}
              required
            />
          </label>

          <label>
            State / region

            <input
              value={
                form.state_region
              }
              onChange={update(
                "state_region",
              )}
              required
            />
          </label>

          <label>
            Postal code

            <input
              value={
                form.postal_code
              }
              onChange={update(
                "postal_code",
              )}
              required
            />
          </label>

          <label>
            Country code

            <input
              maxLength={2}
              value={
                form.country_code
              }
              onChange={update(
                "country_code",
              )}
              required
            />
          </label>
        </div>
      </section>


      <label
        className={
          styles.billingConfirmation
        }
      >
        <input
          type="checkbox"
          checked={
            form.terms_confirmed
          }
          onChange={update(
            "terms_confirmed",
          )}
        />

        <div>
          <strong>
            I confirm these approved billing terms.
          </strong>

          <span>
            I understand that payment setup and any charge will occur through the Campaign Seat billing provider before activation.
          </span>
        </div>
      </label>


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
            Next: Integrations
          </strong>

          <span>
            Billing remains pending until the payment provider is connected.
          </span>
        </div>

        <button
          className={styles.primary}
          type="submit"
          disabled={
            saving ||
            !form.terms_confirmed
          }
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              Confirm Billing
              <ArrowRight
                size={18}
              />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
