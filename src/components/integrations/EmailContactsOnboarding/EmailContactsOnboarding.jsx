import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  ContactRound,
  LoaderCircle,
  Mail,
  PenLine,
  ShieldCheck,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";

import {
  useEmailContactsOnboarding,
} from "../../../hooks/useEmailContactsOnboarding";

import {
  useWorkspaceEmailSignature,
} from "../../../hooks/useWorkspaceEmailSignature";

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

  const {
    signature:
      emailSignature,
    isLoading:
      signatureLoading,
    isSaving:
      signatureSaving,
    error:
      signatureError,
    saveSignature,
  } =
    useWorkspaceEmailSignature({
      workspaceId,
    });

  const [
    signatureName,
    setSignatureName,
  ] = useState(
    "Campaign signature",
  );

  const [
    signatureText,
    setSignatureText,
  ] = useState("");

  const [
    signatureEnabled,
    setSignatureEnabled,
  ] = useState(false);

  const [
    signatureOnNew,
    setSignatureOnNew,
  ] = useState(true);

  const [
    signatureOnReply,
    setSignatureOnReply,
  ] = useState(true);

  const [
    signatureSaved,
    setSignatureSaved,
  ] = useState("");

  useEffect(() => {
    setSignatureName(
      emailSignature
        ?.signature_name ||
      "Campaign signature",
    );

    setSignatureText(
      emailSignature
        ?.signature_text ||
      "",
    );

    setSignatureEnabled(
      emailSignature
        ?.enabled ===
      true,
    );

    setSignatureOnNew(
      emailSignature
        ?.include_on_new !==
      false,
    );

    setSignatureOnReply(
      emailSignature
        ?.include_on_reply !==
      false,
    );
  }, [
    emailSignature,
  ]);


  const productionProviderWritesEnabled =
    window.location.hostname ===
      "app.campaignseat.com" ||
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

  const handleSaveSignature =
    async (
      event,
    ) => {
      event.preventDefault();

      setSignatureSaved(
        "",
      );

      try {
        await saveSignature({
          signatureName,
          signatureText,
          enabled:
            signatureEnabled,
          includeOnNew:
            signatureOnNew,
          includeOnReply:
            signatureOnReply,
        });

        setSignatureSaved(
          "Email signature saved.",
        );
      } catch {
        // Protected hook error
        // is rendered below.
      }
    };


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
            {communicationsComplete ||
            calendarStarted
              ? "Email & Contacts"
              : "Email & Contacts onboarding"}
          </span>

          <h2>
            {communicationsComplete ||
            calendarStarted
              ? "Campaign mailbox & contacts"
              : "Connect the campaign mailbox"}
          </h2>

          <p>
            {communicationsComplete ||
            calendarStarted
              ? "Review the connected campaign mailbox, provider contacts and protected authorization. Calendar remains a separate campaign integration."
              : "Connect Google Workspace or Microsoft 365 through a protected provider session. Campaign Seat will connect mailbox read and send access plus provider contacts. Calendar stays separate."}
          </p>
        </div>
      </header>

      {!connectionReady && (
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
      )}

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

      {connectionReady &&
        (
          communicationsComplete ||
          calendarStarted
        ) && (
          <section
            className={
              styles.connectionMaintenance
            }
          >
            <div
              className={
                styles.connectionMaintenanceIcon
              }
            >
              <RefreshCw
                size={20}
              />
            </div>

            <div
              className={
                styles.connectionMaintenanceCopy
              }
            >
              <strong>
                Mailbox connection maintenance
              </strong>

              <span>
                Reconnect the existing
                {" "}
                {providerLabel(
                  accountProvider,
                )}
                {" "}
                authorization for
                {" "}
                <b>
                  {
                    emailConnection
                      ?.display_email
                  }
                </b>.
                Campaign Seat will require
                two-step verification and
                will not change the mailbox,
                provider, Contacts connection,
                or current Calendar onboarding
                step.
              </span>
            </div>

            <button
              className={
                styles.reconnectButton
              }
              type="button"
              disabled={
                !controlledWritesEnabled ||
                isLoading ||
                isConnecting ||
                !accountProvider
              }
              onClick={() =>
                startConnection(
                  accountProvider,
                  "reauthorize",
                )
              }
            >
              {isConnecting ? (
                <LoaderCircle
                  className={
                    styles.spinner
                  }
                  size={17}
                />
              ) : (
                <RefreshCw
                  size={17}
                />
              )}

              {isConnecting
                ? "Starting secure reconnect…"
                : `Reconnect ${
                    accountProvider ===
                      "google"
                      ? "Google"
                      : "Microsoft"
                  }`}
            </button>
          </section>
        )}

      {connectionReady &&
        (
          communicationsComplete ||
          calendarStarted
        ) &&
        !controlledWritesEnabled && (
          <div
            className={
              styles.reconnectDevelopmentNotice
            }
          >
            Reconnect is intentionally locked
            on the normal development URL.
            Controlled provider writes must be
            explicitly enabled before an OAuth
            reauthorization can start.
          </div>
        )}

      {connectionReady &&
        (
          communicationsComplete ||
          calendarStarted
        ) && (
          <form
            className={
              styles.signatureSettings
            }
            onSubmit={
              handleSaveSignature
            }
          >
            <header>
              <div
                className={
                  styles.signatureIcon
                }
              >
                <PenLine
                  size={20}
                />
              </div>

              <div>
                <strong>
                  Email signature
                </strong>

                <span>
                  Set the campaign signature
                  that appears on outbound
                  mailbox email. Team members
                  see the same saved signature
                  across devices.
                </span>
              </div>
            </header>

            <div
              className={
                styles.signatureFields
              }
            >
              <label>
                <span>
                  Signature name
                </span>

                <input
                  value={
                    signatureName
                  }
                  maxLength={120}
                  onChange={(
                    event,
                  ) => {
                    setSignatureName(
                      event.target
                        .value,
                    );

                    setSignatureSaved(
                      "",
                    );
                  }}
                  placeholder="Campaign signature"
                />
              </label>

              <label
                className={
                  styles.signatureBodyField
                }
              >
                <span>
                  Signature
                </span>

                <textarea
                  value={
                    signatureText
                  }
                  maxLength={10000}
                  rows={7}
                  onChange={(
                    event,
                  ) => {
                    setSignatureText(
                      event.target
                        .value,
                    );

                    setSignatureSaved(
                      "",
                    );
                  }}
                  placeholder={
                    `Example:
Chris Herrerias
Campaign Team
Elizabeth Accomando for Palm Beach County Commission · District 6`
                  }
                />
              </label>
            </div>

            <div
              className={
                styles.signatureOptions
              }
            >
              <label>
                <input
                  type="checkbox"
                  checked={
                    signatureEnabled
                  }
                  onChange={(
                    event,
                  ) => {
                    setSignatureEnabled(
                      event.target
                        .checked,
                    );

                    setSignatureSaved(
                      "",
                    );
                  }}
                />

                <span>
                  <strong>
                    Enable signature
                  </strong>

                  <small>
                    Make this signature
                    available to outbound
                    campaign email.
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    signatureOnNew
                  }
                  disabled={
                    !signatureEnabled
                  }
                  onChange={(
                    event,
                  ) => {
                    setSignatureOnNew(
                      event.target
                        .checked,
                    );

                    setSignatureSaved(
                      "",
                    );
                  }}
                />

                <span>
                  <strong>
                    New emails
                  </strong>

                  <small>
                    Include by default when
                    starting an email.
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    signatureOnReply
                  }
                  disabled={
                    !signatureEnabled
                  }
                  onChange={(
                    event,
                  ) => {
                    setSignatureOnReply(
                      event.target
                        .checked,
                    );

                    setSignatureSaved(
                      "",
                    );
                  }}
                />

                <span>
                  <strong>
                    Replies
                  </strong>

                  <small>
                    Include by default when
                    replying to email.
                  </small>
                </span>
              </label>
            </div>

            {signatureText
              .trim() ? (
              <div
                className={
                  styles.signaturePreview
                }
              >
                <small>
                  Preview
                </small>

                <pre>
                  {
                    signatureText
                  }
                </pre>
              </div>
            ) : null}

            {signatureError ? (
              <div
                className={
                  styles.signatureError
                }
                role="alert"
              >
                {
                  signatureError
                }
              </div>
            ) : null}

            {signatureSaved ? (
              <div
                className={
                  styles.signatureSaved
                }
              >
                {
                  signatureSaved
                }
              </div>
            ) : null}

            <footer>
              <span>
                {signatureLoading
                  ? "Loading signature…"
                  : signatureEnabled
                    ? "Signature is enabled."
                    : "Signature is currently disabled."}
              </span>

              <button
                type="submit"
                disabled={
                  signatureLoading ||
                  signatureSaving
                }
              >
                {signatureSaving
                  ? "Saving…"
                  : "Save signature"}
              </button>
            </footer>
          </form>
        )}

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
            {communicationsComplete ||
            calendarStarted
              ? "Email & Contacts setup is complete. Use mailbox connection maintenance above if the provider authorization needs to be renewed."
              : connectionReady
                ? "The verified mailbox and provider-contact connection are ready to complete setup."
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
