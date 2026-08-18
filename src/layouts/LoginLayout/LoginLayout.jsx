import {
  useLocation,
} from "react-router-dom";

import Hero from "../../components/login/Hero/Hero";
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
