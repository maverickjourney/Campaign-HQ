import {
  useEffect,
  useState,
} from "react";

import {
  ShieldCheck,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../../lib/supabase";

import {
  signOutPlatformAdmin,
} from "../../services/platformAdminAuth";

import styles
  from "./PlatformAdmin.module.css";

export default function PlatformAdminHome() {
  const navigate =
    useNavigate();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: userData,
      } =
        await supabase.auth
          .getUser();

      const {
        data,
        error:
          productsError,
      } =
        await supabase
          .from("seat_products")
          .select(
            "id, product_key, product_name, status, hq_label",
          )
          .order(
            "product_name",
          );

      if (!active) {
        return;
      }

      setEmail(
        userData.user
          ?.email || "",
      );

      if (productsError) {
        console.error(
          productsError,
        );

        setError(
          "Seat products could not be loaded.",
        );

        return;
      }

      setProducts(
        data || [],
      );
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const signOut =
    async () => {
      await signOutPlatformAdmin();

      navigate(
        "/admin/login",
        {
          replace: true,
        },
      );
    };

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <div className={styles.adminBadge}>
            <ShieldCheck size={20} />
            Security verified
          </div>

          <h1>Seat Platform Admin</h1>

          <p>
            {email}
          </p>
        </div>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={signOut}
        >
          Sign out
        </button>
      </header>

      <section className={styles.panel}>
        <h2>Seat products</h2>

        <p>
          This live query is protected by
          Platform Staff authority + MFA/AAL2.
        </p>

        {error && (
          <p className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.productGrid}>
          {products.map(
            (product) => (
              <article
                className={styles.productCard}
                key={product.id}
              >
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

      <section className={styles.panel}>
        <h2>Admin foundation</h2>

        <div className={styles.adminGrid}>
          <span>Customers</span>
          <span>Deals</span>
          <span>Packages</span>
          <span>Proposals</span>
          <span>Onboarding</span>
          <span>Billing</span>
          <span>Products</span>
          <span>Security</span>
        </div>
      </section>
    </main>
  );
}
