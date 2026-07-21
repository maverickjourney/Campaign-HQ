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

export default function LoginLayout({
  children = null,
}) {
  const location =
    useLocation();

  const isScrollableRoute =
    SCROLLABLE_ACCOUNT_ROUTES.has(
      location.pathname,
    );

  const formPanelClassName = [
    styles.formPanel,

    isScrollableRoute
      ? styles.formPanelScrollable
      : styles.formPanelStatic,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={
        styles.loginLayout
      }
    >
      <section
        className={
          styles.heroPanel
        }
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
