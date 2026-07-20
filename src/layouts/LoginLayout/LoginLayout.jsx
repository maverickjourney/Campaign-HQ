import Hero from "../../components/login/Hero/Hero";
import LoginForm from "../../components/login/LoginForm/LoginForm";
import styles from "./LoginLayout.module.css";

export default function LoginLayout({
  children,
}) {
  return (
    <main className={styles.loginLayout}>
      <section className={styles.heroPanel}>
        <Hero />
      </section>

      <section className={styles.formPanel}>
        {children || <LoginForm />}
      </section>
    </main>
  );
}
