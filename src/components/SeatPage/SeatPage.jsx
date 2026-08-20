import styles from "./SeatPage.module.css";

export function SeatPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  loading = false,
  error = "",
  empty = false,
  emptyTitle = "Nothing here yet",
  emptyDescription = "",
  className = "",
}) {
  return (
    <main
      className={[
        styles.page,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-seat-page="true"
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          {eyebrow ? (
            <span className={styles.eyebrow}>
              {eyebrow}
            </span>
          ) : null}

          <h1>{title}</h1>

          {description ? (
            <p>{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className={styles.actions}>
            {actions}
          </div>
        ) : null}
      </header>

      {loading ? (
        <section
          className={styles.state}
          aria-live="polite"
        >
          <div className={styles.spinner} />
          <strong>Loading…</strong>
        </section>
      ) : error ? (
        <section
          className={styles.state}
          role="alert"
        >
          <strong>Something needs attention</strong>
          <p>{error}</p>
        </section>
      ) : empty ? (
        <section className={styles.state}>
          <strong>{emptyTitle}</strong>

          {emptyDescription ? (
            <p>{emptyDescription}</p>
          ) : null}
        </section>
      ) : (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </main>
  );
}

export function SeatPageSection({
  title,
  description,
  actions,
  children,
  className = "",
}) {
  return (
    <section
      className={[
        styles.section,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(title || description || actions) ? (
        <header className={styles.sectionHeader}>
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? (
              <p>{description}</p>
            ) : null}
          </div>

          {actions ? (
            <div className={styles.sectionActions}>
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}

      {children}
    </section>
  );
}
