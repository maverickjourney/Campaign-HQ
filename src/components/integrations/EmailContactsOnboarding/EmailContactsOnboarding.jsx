import {
  ArrowRight,
  CheckCircle2,
  ContactRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  useEmailContactsOnboarding,
} from "../../../hooks/useEmailContactsOnboarding";

import styles
  from "./EmailContactsOnboarding.module.css";

function providerLabel(
  provider,
) {
  if (
    provider ===
    "google"
  ) {
    return "Google Workspace";
  }

  if (
    provider ===
    "microsoft"
  ) {
    return "Microsoft 365";
  }

  return "Connected provider";
}

export default function EmailContactsOnboarding({
  workspaceId,
}) {
  const {
    workspaceState,
    communicationsStep,
    calendarStep,
    integrations,

    isLoading,
    isConnecting,
    isCompleting,
    error,

    startConnection,
    completeOnboarding,
  } =
    useEmailContactsOnboarding({
      workspaceId,
    });

  const productionProviderWritesEnabled =
    window.location.hostname ===
      "campaignseat.com" ||
    window.location.hostname ===
      "www.campaignseat.com";

  const developmentProviderWritesEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "provider-writes",
    ) ===
      "enabled";

  const controlledWritesEnabled =
    productionProviderWritesEnabled ||
    developmentProviderWritesEnabled;

  const emailConnection =
    integrations.find(
      (item) =>
        item.integration_type ===
          "email" &&
        item.status ===
          "connected",
    ) ||
    null;

  const contactsConnection =
    integrations.find(
      (item) =>
        item.integration_type ===
          "contacts" &&
        item.status ===
          "connected" &&
        item.connection_key ===
          emailConnection
            ?.connection_key,
    ) ||
    null;

  const accountProvider =
    emailConnection
      ?.settings
      ?.account_provider ||
    "";

  const emailCanSend =
    emailConnection
      ?.capabilities
      ?.send === true;

  const connectionReady =
    Boolean(
      emailConnection &&
      contactsConnection &&
      emailCanSend,
    );

  const communicationsCurrent =
    workspaceState
      ?.onboarding_current_step ===
      "communications" &&
    communicationsStep
      ?.status ===
      "in_progress";

  const communicationsComplete =
    communicationsStep
      ?.status ===
      "complete";

  const calendarStarted =
    workspaceState
      ?.onboarding_current_step ===
      "calendar" &&
    calendarStep
      ?.status ===
      "in_progress";

  const handleComplete =
    async () => {
      try {
        await completeOnboarding();

        window.location.assign(
          "/calendar?onboarding=calendar",
        );
      } catch {
        // The hook exposes
        // the protected error.
      }
    };

  return (
    <section
      className={
        styles.card
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div
          className={
            styles.headerIcon
          }
        >
          <Mail
            size={23}
          />
        </div>

        <div>
          <span>
            Email &amp; Contacts onboarding
          </span>

          <h2>
            Connect the campaign mailbox
          </h2>

          <p>
            Connect Google Workspace or
            Microsoft 365 through a
            protected provider session.
            Campaign Seat will connect
            mailbox read and send access
            plus provider contacts.
            Calendar stays separate.
          </p>
        </div>
      </header>

      <div
        className={
          styles.providerGrid
        }
      >
        <article>
          <div
            className={
              styles.providerIcon
            }
          >
            G
          </div>

          <div>
            <strong>
              Google Workspace
            </strong>

            <span>
              Gmail + Google Contacts
            </span>
          </div>

          <button
            type="button"
            disabled={
              !controlledWritesEnabled ||
              isLoading ||
              isConnecting ||
              connectionReady
            }
            onClick={() =>
              startConnection(
                "google",
              )
            }
          >
            Connect Google
          </button>
        </article>

        <article>
          <div
            className={
              styles.providerIcon
            }
          >
            M
          </div>

          <div>
            <strong>
              Microsoft 365
            </strong>

            <span>
              Outlook + Microsoft Contacts
            </span>
          </div>

          <button
            type="button"
            disabled={
              !controlledWritesEnabled ||
              isLoading ||
              isConnecting ||
              connectionReady
            }
            onClick={() =>
              startConnection(
                "microsoft",
              )
            }
          >
            Connect Microsoft
          </button>
        </article>
      </div>

      <div
        className={
          styles.statusGrid
        }
      >
        <article
          className={
            emailConnection
              ? styles.ready
              : styles.pending
          }
        >
          {emailConnection ? (
            <CheckCircle2
              size={20}
            />
          ) : (
            <Mail
              size={20}
            />
          )}

          <div>
            <strong>
              Campaign email
            </strong>

            <span>
              {emailConnection
                ? `${emailConnection.display_email} · ${providerLabel(accountProvider)}`
                : "No verified mailbox connected"}
            </span>
          </div>
        </article>

        <article
          className={
            contactsConnection
              ? styles.ready
              : styles.pending
          }
        >
          {contactsConnection ? (
            <CheckCircle2
              size={20}
            />
          ) : (
            <ContactRound
              size={20}
            />
          )}

          <div>
            <strong>
              Provider contacts
            </strong>

            <span>
              {contactsConnection
                ? "Read/import access verified"
                : "Waiting for provider connection"}
            </span>
          </div>
        </article>

        <article
          className={
            styles.protected
          }
        >
          <ShieldCheck
            size={20}
          />

          <div>
            <strong>
              Credential boundary
            </strong>

            <span>
              Provider tokens stay with
              Nylas. Campaign Seat stores
              only the protected grant
              reference.
            </span>
          </div>
        </article>
      </div>

      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          <TriangleAlert
            size={18}
          />

          <span>
            {error}
          </span>
        </div>
      )}

      {!controlledWritesEnabled &&
        communicationsCurrent &&
        !connectionReady && (
          <div
            className={
              styles.controlled
            }
          >
            Provider connection is locked
            on the normal development URL
            while this OAuth foundation is
            being tested.
          </div>
        )}

      <footer
        className={
          styles.footer
        }
      >
        <div>
          <strong>
            {communicationsComplete ||
            calendarStarted
              ? "Email & Contacts complete"
              : connectionReady
                ? "Email & Contacts ready"
                : "Provider connection required"}
          </strong>

          <span>
            {connectionReady
              ? "The verified mailbox and provider-contact connection are ready to confirm."
              : "Connect one campaign-managed Google or Microsoft account. Existing Campaign Seat contact consent records remain separate."}
          </span>
        </div>

        {communicationsComplete ||
        calendarStarted ? (
          <button
            className={
              styles.primary
            }
            type="button"
            onClick={() =>
              window.location.assign(
                "/calendar?onboarding=calendar",
              )
            }
          >
            Open Calendar

            <ArrowRight
              size={17}
            />
          </button>
        ) : (
          <button
            className={
              styles.primary
            }
            type="button"
            disabled={
              !controlledWritesEnabled ||
              !connectionReady ||
              !communicationsCurrent ||
              isCompleting
            }
            onClick={
              handleComplete
            }
          >
            {isCompleting ? (
              <LoaderCircle
                className={
                  styles.spinner
                }
                size={17}
              />
            ) : (
              <ShieldCheck
                size={17}
              />
            )}

            {isCompleting
              ? "Confirming…"
              : "Complete Email & Contacts"}

            {!isCompleting && (
              <ArrowRight
                size={17}
              />
            )}
          </button>
        )}
      </footer>
    </section>
  );
}
