import {
  useLocation,
} from "react-router-dom";

import Hero from "../../components/login/Hero/Hero";
import SeatBrand from "../../components/brand/SeatBrand/SeatBrand";
import LoginForm from "../../components/login/LoginForm/LoginForm";
import styles from "./LoginLayout.module.css";

const SCROLLABLE_ACCOUNT_ROUTES =
  new Set([
    "/forgot-password",
    "/reset-password",
    "/mfa/setup",
    "/mfa/challenge",
  ]);

const MFA_ACCOUNT_ROUTES =
  new Set([
    "/mfa/setup",
    "/mfa/challenge",
  ]);

export default function LoginLayout({
  children = null,
}) {
  const location =
    useLocation();

  const platformAdminFlow =
    window.location.hostname
      .trim()
      .toLowerCase() ===
      "admin.campaignseat.com" ||
    String(
      location.state?.from ||
      "",
    ).startsWith(
      "/admin",
    );

  const isScrollableRoute =
    SCROLLABLE_ACCOUNT_ROUTES.has(
      location.pathname,
    );

  const isMfaRoute =
    MFA_ACCOUNT_ROUTES.has(
      location.pathname,
    );

  const formPanelClassName = [
    styles.formPanel,

    isScrollableRoute
      ? styles.formPanelScrollable
      : styles.formPanelStatic,

    isMfaRoute
      ? styles.mfaFormPanel
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (platformAdminFlow) {
    return (
      <main className={styles.adminAuthLayout}>
        <header className={styles.adminAuthBrand}>
          <SeatBrand
            variant="wordmark"
            color="white"
            className={styles.adminAuthLogo}
          />

          <div>
            <strong>
              Seat Platform Admin
            </strong>

            <span>
              Protected administrative access
            </span>
          </div>
        </header>

        <section className={styles.adminAuthPanel}>
          {children || <LoginForm />}
        </section>

        <footer className={styles.adminAuthFooter}>
          Platform role + MFA required
        </footer>
      </main>
    );
  }

  return (
    <main
      className={[
        styles.loginLayout,
        isMfaRoute
          ? styles.mfaLoginLayout
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <section
        className={[
          styles.heroPanel,
          isMfaRoute
            ? styles.mfaHeroPanel
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Hero />
      </section>

      <section
        className={
          formPanelClassName
        }
      >
        {children || <LoginForm />}
      </section>
    </main>
  );
}
