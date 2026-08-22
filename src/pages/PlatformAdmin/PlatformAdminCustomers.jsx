import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Plus,
  Search,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  loadPlatformCustomers,
} from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";

function money(cents) {
  if (
    cents === null ||
    cents === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(cents / 100);
}

export default function PlatformAdminCustomers() {
  const [customers, setCustomers] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result =
          await loadPlatformCustomers();

        if (active) {
          setCustomers(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Customers could not be loaded.",
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

  const filtered =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return customers;
      }

      return customers.filter(
        (customer) =>
          [
            customer.display_name,
            customer.billing_email,
            customer.primaryContact?.full_name,
            customer.primaryContact?.email,
            customer.currentDeal?.deal_code,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(query),
            ),
      );
    }, [customers, search]);

  return (
    <PlatformAdminShell
      title="Customers"
      description="Every customer relationship across the Seat Platform."
      actions={
        <Link
          className={styles.primaryAction}
          to="/admin/customers/new"
        >
          <Plus size={17} />
          New Client
        </Link>
      }
    >
      <section className={styles.adminPanel}>
        <div className={styles.customerToolbar}>
          <div className={styles.searchBox}>
            <Search size={17} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search customer or contact"
            />
          </div>

          <span>
            {filtered.length} customer
            {filtered.length === 1
              ? ""
              : "s"}
          </span>
        </div>

        {error && (
          <div className={styles.adminError}>
            {error}
          </div>
        )}

        {loading ? (
          <div className={styles.adminEmpty}>
            Loading customers…
          </div>
        ) : !filtered.length ? (
          <div className={styles.adminEmpty}>
            <strong>
              No Seat customers yet.
            </strong>

            <span>
              Create Client #1 to begin the real sales and onboarding pipeline.
            </span>
          </div>
        ) : (
          <div className={styles.customerList}>
            {filtered.map(
              (customer) => (
                <article
                  key={customer.id}
                  className={styles.customerCard}
                >
                  <div>
                    <strong>
                      {customer.display_name}
                    </strong>

                    <span>
                      {customer.customer_type}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {customer.primaryContact?.full_name || "—"}
                    </strong>

                    <span>
                      {customer.primaryContact?.email ||
                        customer.billing_email ||
                        "—"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {customer.currentDeal?.deal_code || "No deal"}
                    </strong>

                    <span>
                      {customer.currentDeal?.stage || customer.status}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {money(
                        customer.currentDeal
                          ?.expected_monthly_cents,
                      )}
                      /mo
                    </strong>

                    <span>
                      {money(
                        customer.currentDeal
                          ?.expected_setup_cents,
                      )}{" "}
                      setup
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </PlatformAdminShell>
  );
}
