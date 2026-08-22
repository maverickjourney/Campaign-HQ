import {
  useEffect,
  useState,
} from "react";

import {
  Building2,
  CircleDollarSign,
  FileCheck2,
  UserPlus,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  loadPlatformAdminOverview,
} from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";

export default function PlatformAdminHome() {
  const [overview, setOverview] =
    useState(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result =
          await loadPlatformAdminOverview();

        if (active) {
          setOverview(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Admin overview could not be loaded.",
          );
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const counts =
    overview?.counts || {
      customers: 0,
      openDeals: 0,
      proposals: 0,
      activeAccounts: 0,
    };

  return (
    <PlatformAdminShell
      title="Business Overview"
      description="Customers, deals, onboarding and Seat products from one secure control center."
      actions={
        <Link
          className={styles.primaryAction}
          to="/admin/customers/new"
        >
          <UserPlus size={17} />
          New Client
        </Link>
      }
    >
      {error && (
        <div className={styles.adminError}>
          {error}
        </div>
      )}

      <section className={styles.metricGrid}>
        <article>
          <Building2 size={20} />
          <strong>{counts.customers}</strong>
          <span>Customers</span>
        </article>

        <article>
          <CircleDollarSign size={20} />
          <strong>{counts.openDeals}</strong>
          <span>Open deals</span>
        </article>

        <article>
          <FileCheck2 size={20} />
          <strong>{counts.proposals}</strong>
          <span>Active proposals</span>
        </article>

        <article>
          <Building2 size={20} />
          <strong>{counts.activeAccounts}</strong>
          <span>Active Seat accounts</span>
        </article>
      </section>

      <section className={styles.adminPanel}>
        <h2>
          Seat products
        </h2>

        <div className={styles.productGrid}>
          {(overview?.products || []).map(
            (product) => (
              <article key={product.id}>
                <strong>
                  {product.product_name}
                </strong>

                <span>
                  {product.hq_label}
                </span>

                <small>
                  {product.status}
                </small>
              </article>
            ),
          )}
        </div>
      </section>
    </PlatformAdminShell>
  );
}
