import {
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  LoaderCircle,
  Save,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  createPlatformClientDraft,
  loadNewClientOptions,
  loadProductSalesOptions,
} from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";

const HQ_OPTIONS = [
  "Messages for You",
  "Decisions for You",
  "People to Contact",
  "Commitments",
  "Team Brief",
  "Risk & Compliance",
  "Fundraising Snapshot",
  "Upcoming Events",
];

function dollarsToCents(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(
        0,
        Math.round(number * 100),
      )
    : 0;
}

export default function PlatformAdminNewClient() {
  const [products, setProducts] =
    useState([]);

  const [options, setOptions] =
    useState({
      packages: [],
      modules: [],
      integrations: [],
      addons: [],
    });

  const [form, setForm] =
    useState({
      productId: "",
      customerName: "",
      customerType: "campaign",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      packageId: "",
      monthlyPrice: "",
      setupFee: "",
      contractMonths: "",
      includedSeats: "",
      notes: "",
      dataImport: false,
      customSetup: false,
    });

  const [modules, setModules] =
    useState([]);

  const [integrations, setIntegrations] =
    useState([]);

  const [addons, setAddons] =
    useState([]);

  const [hqCards, setHqCards] =
    useState(HQ_OPTIONS.slice(0, 6));

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data =
          await loadNewClientOptions();

        if (!active) {
          return;
        }

        setProducts(data);

        if (data.length === 1) {
          setForm(
            (current) => ({
              ...current,
              productId: data[0].id,
            }),
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Products could not be loaded.",
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

  useEffect(() => {
    let active = true;

    if (!form.productId) {
      return () => {
        active = false;
      };
    }

    const load = async () => {
      try {
        const data =
          await loadProductSalesOptions(
            form.productId,
          );

        if (!active) {
          return;
        }

        setOptions(data);

        setModules(
          data.modules
            .filter(
              (module) =>
                module.required ||
                module.defaultEnabled,
            )
            .map(
              (module) =>
                module.module_key,
            ),
        );

        setIntegrations(
          data.integrations
            .filter(
              (integration) =>
                integration.defaultEnabled,
            )
            .map(
              (integration) =>
                integration.integration_key,
            ),
        );

        setAddons([]);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Product configuration could not be loaded.",
          );
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [form.productId]);

  const change =
    (key) =>
      (event) => {
        const value =
          event.target.type === "checkbox"
            ? event.target.checked
            : event.target.value;

        setForm(
          (current) => ({
            ...current,
            [key]: value,
          }),
        );
      };

  const toggle =
    (value, setter) => {
      setter(
        (current) =>
          current.includes(value)
            ? current.filter(
                (item) =>
                  item !== value,
              )
            : [...current, value],
      );
    };

  const choosePackage =
    (event) => {
      const id =
        event.target.value;

      const selected =
        options.packages.find(
          (item) =>
            item.id === id,
        );

      setForm(
        (current) => ({
          ...current,
          packageId: id,

          monthlyPrice:
            selected?.monthly_price_cents != null
              ? String(
                  selected.monthly_price_cents /
                    100,
                )
              : current.monthlyPrice,

          setupFee:
            selected?.onboarding_fee_cents != null
              ? String(
                  selected.onboarding_fee_cents /
                    100,
                )
              : current.setupFee,

          contractMonths:
            selected?.contract_term_months != null
              ? String(
                  selected.contract_term_months,
                )
              : current.contractMonths,

          includedSeats:
            selected?.included_user_seats != null
              ? String(
                  selected.included_user_seats,
                )
              : current.includedSeats,
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
          await createPlatformClientDraft({
            productId:
              form.productId,

            customerName:
              form.customerName.trim(),

            customerType:
              form.customerType,

            contactName:
              form.contactName.trim(),

            contactEmail:
              form.contactEmail.trim(),

            contactPhone:
              form.contactPhone.trim(),

            packageId:
              form.packageId || null,

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

            notes:
              form.notes.trim(),

            metadata: {
              included_user_seats:
                form.includedSeats
                  ? Number(
                      form.includedSeats,
                    )
                  : null,

              requested_module_keys:
                modules,

              requested_integration_keys:
                integrations,

              requested_addon_ids:
                addons,

              dashboard_emphasis:
                hqCards,

              data_import_required:
                form.dataImport,

              custom_setup_required:
                form.customSetup,
            },
          });

        setResult(created);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Client setup could not be created.",
        );
      } finally {
        setSaving(false);
      }
    };

  if (result) {
    return (
      <PlatformAdminShell
        title="Client Draft Created"
        description="The customer, primary contact and deal were created together."
      >
        <section className={styles.adminSuccess}>
          <CheckCircle2 size={42} />

          <h2>
            {form.customerName}
          </h2>

          <p>
            Deal{" "}
            <strong>
              {result.deal_code}
            </strong>{" "}
            is ready for the proposal step.
          </p>

          <Link
            className={styles.primaryAction}
            to="/admin/customers"
          >
            View customers
          </Link>
        </section>
      </PlatformAdminShell>
    );
  }

  return (
    <PlatformAdminShell
      title="New Client Setup"
      description="Configure exactly what this customer is buying before proposal and onboarding."
    >
      <form
        className={styles.clientSetup}
        onSubmit={submit}
      >
        {error && (
          <div className={styles.adminError}>
            {error}
          </div>
        )}

        <section className={styles.adminPanel}>
          <h2>
            1. Customer
          </h2>

          <div className={styles.formGrid}>
            <label>
              Seat product

              <select
                value={form.productId}
                onChange={change("productId")}
                disabled={loading}
                required
              >
                <option value="">
                  Select product
                </option>

                {products.map(
                  (product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.product_name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Customer type

              <select
                value={form.customerType}
                onChange={change(
                  "customerType",
                )}
              >
                <option value="campaign">
                  Campaign
                </option>
                <option value="firm">
                  Firm
                </option>
                <option value="government">
                  Government
                </option>
                <option value="association">
                  Association
                </option>
                <option value="nonprofit">
                  Nonprofit
                </option>
                <option value="business">
                  Business
                </option>
                <option value="organization">
                  Organization
                </option>
                <option value="individual">
                  Individual
                </option>
                <option value="other">
                  Other
                </option>
              </select>
            </label>

            <label className={styles.wide}>
              Customer / organization name

              <input
                value={form.customerName}
                onChange={change(
                  "customerName",
                )}
                placeholder="Chris Herrerias Campaign"
                required
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            2. Primary contact
          </h2>

          <div className={styles.formGrid}>
            <label>
              Full name

              <input
                value={form.contactName}
                onChange={change(
                  "contactName",
                )}
                required
              />
            </label>

            <label>
              Email

              <input
                type="email"
                value={form.contactEmail}
                onChange={change(
                  "contactEmail",
                )}
                required
              />
            </label>

            <label>
              Phone

              <input
                type="tel"
                value={form.contactPhone}
                onChange={change(
                  "contactPhone",
                )}
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            3. Package + commercial terms
          </h2>

          <div className={styles.formGrid}>
            <label className={styles.wide}>
              Package

              <select
                value={form.packageId}
                onChange={choosePackage}
              >
                <option value="">
                  Custom package
                </option>

                {options.packages.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.display_name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Monthly fee ($)

              <input
                type="number"
                min="0"
                value={form.monthlyPrice}
                onChange={change(
                  "monthlyPrice",
                )}
                placeholder="399"
              />
            </label>

            <label>
              Onboarding fee ($)

              <input
                type="number"
                min="0"
                value={form.setupFee}
                onChange={change(
                  "setupFee",
                )}
                placeholder="500"
              />
            </label>

            <label>
              Contract months

              <input
                type="number"
                min="0"
                value={form.contractMonths}
                onChange={change(
                  "contractMonths",
                )}
                placeholder="12"
              />
            </label>

            <label>
              Included users

              <input
                type="number"
                min="0"
                value={form.includedSeats}
                onChange={change(
                  "includedSeats",
                )}
                placeholder="10"
              />
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            4. Included modules
          </h2>

          <div className={styles.checkboxGrid}>
            {options.modules.map(
              (module) => (
                <label
                  key={module.id}
                  className={styles.checkboxCard}
                >
                  <input
                    type="checkbox"
                    checked={
                      modules.includes(
                        module.module_key,
                      )
                    }
                    disabled={
                      module.required
                    }
                    onChange={() =>
                      toggle(
                        module.module_key,
                        setModules,
                      )
                    }
                  />

                  <span>
                    {module.displayLabel}
                    {module.required
                      ? " · Required"
                      : ""}
                  </span>
                </label>
              ),
            )}
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            5. Integrations + add-ons
          </h2>

          <div className={styles.checkboxGrid}>
            {options.integrations.map(
              (integration) => (
                <label
                  key={integration.id}
                  className={styles.checkboxCard}
                >
                  <input
                    type="checkbox"
                    checked={
                      integrations.includes(
                        integration.integration_key,
                      )
                    }
                    onChange={() =>
                      toggle(
                        integration.integration_key,
                        setIntegrations,
                      )
                    }
                  />

                  <span>
                    {integration.display_name}
                  </span>
                </label>
              ),
            )}

            {options.addons.map(
              (addon) => (
                <label
                  key={addon.id}
                  className={styles.checkboxCard}
                >
                  <input
                    type="checkbox"
                    checked={
                      addons.includes(
                        addon.id,
                      )
                    }
                    onChange={() =>
                      toggle(
                        addon.id,
                        setAddons,
                      )
                    }
                  />

                  <span>
                    {addon.display_name}
                  </span>
                </label>
              ),
            )}

            <label className={styles.checkboxCard}>
              <input
                type="checkbox"
                checked={form.dataImport}
                onChange={change(
                  "dataImport",
                )}
              />

              <span>
                Data migration / import
              </span>
            </label>

            <label className={styles.checkboxCard}>
              <input
                type="checkbox"
                checked={form.customSetup}
                onChange={change(
                  "customSetup",
                )}
              />

              <span>
                Custom implementation
              </span>
            </label>
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            6. Starting HQ emphasis
          </h2>

          <div className={styles.checkboxGrid}>
            {HQ_OPTIONS.map(
              (item) => (
                <label
                  key={item}
                  className={styles.checkboxCard}
                >
                  <input
                    type="checkbox"
                    checked={
                      hqCards.includes(
                        item,
                      )
                    }
                    onChange={() =>
                      toggle(
                        item,
                        setHqCards,
                      )
                    }
                  />

                  <span>
                    {item}
                  </span>
                </label>
              ),
            )}
          </div>
        </section>

        <section className={styles.adminPanel}>
          <h2>
            7. Internal sales notes
          </h2>

          <textarea
            className={styles.notes}
            value={form.notes}
            onChange={change("notes")}
            rows={5}
            placeholder="What they need, special terms, timeline, onboarding details..."
          />
        </section>

        <div className={styles.saveBar}>
          <div>
            <strong>
              Create draft only
            </strong>

            <span>
              No client account or invitation is sent yet.
            </span>
          </div>

          <button
            className={styles.primaryAction}
            type="submit"
            disabled={
              saving ||
              loading
            }
          >
            {saving ? (
              <>
                <LoaderCircle
                  size={17}
                />
                Creating…
              </>
            ) : (
              <>
                <Save size={17} />
                Create Client Draft
              </>
            )}
          </button>
        </div>
      </form>
    </PlatformAdminShell>
  );
}
