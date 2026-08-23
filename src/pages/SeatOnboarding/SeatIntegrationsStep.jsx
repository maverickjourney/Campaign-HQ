import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Cloud,
  ContactRound,
  Database,
  HardDrive,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  loadMySeatIntegrationSetup,
  saveMySeatIntegrationSetup,
} from "../../services/seatOnboarding";

import styles
  from "./SeatOnboarding.module.css";


function capabilityIcon(
  capability,
) {
  switch (capability) {
    case "calendar":
      return CalendarDays;

    case "email":
      return Mail;

    case "contacts":
      return ContactRound;

    case "drive":
    case "onedrive":
      return HardDrive;

    default:
      return Database;
  }
}


function capabilityLabel(
  capability,
) {
  const labels = {
    calendar:
      "Calendar",

    email:
      "Email",

    contacts:
      "Contacts",

    drive:
      "Drive",

    onedrive:
      "OneDrive",
  };

  return (
    labels[capability] ||
    capability
  );
}


export default function SeatIntegrationsStep() {
  const [
    integrations,
    setIntegrations,
  ] =
    useState([]);

  const [
    selected,
    setSelected,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  useEffect(() => {
    let active = true;

    const load =
      async () => {
        try {
          const result =
            await loadMySeatIntegrationSetup();

          if (
            !active ||
            !result?.found
          ) {
            return;
          }

          const items =
            result.integrations ||
            [];

          setIntegrations(
            items,
          );

          setSelected(
            items.map(
              (item) =>
                item.integration_key,
            ),
          );
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Integration setup could not be loaded.",
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


  const toggle =
    (integrationKey) => {
      setSelected(
        (current) =>
          current.includes(
            integrationKey,
          )
            ? current.filter(
                (key) =>
                  key !==
                  integrationKey,
              )
            : [
                ...current,
                integrationKey,
              ],
      );
    };


  const submit =
    async () => {
      if (saving) {
        return;
      }

      setSaving(true);
      setError("");

      try {
        await saveMySeatIntegrationSetup(
          selected,
        );

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Integration setup could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <section
        className={
          styles.integrationCard
        }
      >
        <LoaderCircle
          size={28}
        />

        Loading integrations…
      </section>
    );
  }


  return (
    <section
      className={
        styles.integrationCard
      }
    >
      <header
        className={
          styles.integrationHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Integrations
          </span>

          <h2>
            Connect the tools your campaign already uses.
          </h2>

          <p>
            Campaign Seat will use secure provider authorization. We will never ask for or store your Google or Microsoft password.
          </p>
        </div>

        <Cloud size={30} />
      </header>


      <div
        className={
          styles.integrationNotice
        }
      >
        <ShieldCheck
          size={20}
        />

        <div>
          <strong>
            Provider connection is not active yet.
          </strong>

          <span>
            This step records the providers selected for this account. Google and Microsoft OAuth will connect to these exact records before final activation.
          </span>
        </div>
      </div>


      <div
        className={
          styles.integrationList
        }
      >
        {integrations.map(
          (integration) => {
            const checked =
              selected.includes(
                integration
                  .integration_key,
              );

            const connected =
              integration
                .connection_status ===
              "connected";

            return (
              <article
                className={
                  styles.integrationItem
                }
                key={
                  integration
                    .integration_key
                }
                data-selected={
                  checked
                    ? "true"
                    : "false"
                }
              >
                <button
                  type="button"
                  className={
                    styles.integrationSelect
                  }
                  onClick={() =>
                    toggle(
                      integration
                        .integration_key,
                    )
                  }
                  aria-pressed={
                    checked
                  }
                >
                  <span
                    className={
                      styles.integrationCheck
                    }
                  >
                    {checked && (
                      <Check
                        size={15}
                      />
                    )}
                  </span>

                  <div>
                    <strong>
                      {
                        integration
                          .display_name
                      }
                    </strong>

                    <span>
                      Secure OAuth2 connection
                    </span>
                  </div>
                </button>


                <div
                  className={
                    styles.integrationCapabilities
                  }
                >
                  {(
                    integration
                      .capabilities ||
                    []
                  ).map(
                    (
                      capability,
                    ) => {
                      const Icon =
                        capabilityIcon(
                          capability,
                        );

                      return (
                        <span
                          key={
                            capability
                          }
                        >
                          <Icon
                            size={14}
                          />

                          {capabilityLabel(
                            capability,
                          )}
                        </span>
                      );
                    },
                  )}
                </div>


                <div
                  className={
                    connected
                      ? styles.integrationConnected
                      : styles.integrationPending
                  }
                >
                  {connected
                    ? "Connected"
                    : checked
                      ? "Selected · connection pending"
                      : "Not selected"}
                </div>
              </article>
            );
          },
        )}
      </div>


      {error && (
        <div
          className={styles.error}
          role="alert"
        >
          {error}
        </div>
      )}


      <div
        className={
          styles.profileActions
        }
      >
        <div>
          <strong>
            Next: Team & access
          </strong>

          <span>
            Selected provider connections remain outstanding until OAuth is activated.
          </span>
        </div>

        <button
          className={styles.primary}
          type="button"
          onClick={submit}
          disabled={saving}
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              Save Integration Plan
              <ArrowRight
                size={18}
              />
            </>
          )}
        </button>
      </div>
    </section>
  );
}
