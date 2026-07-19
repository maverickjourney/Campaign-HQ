import {
  useState,
} from "react";

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Eye,
  LockKeyhole,
  MapPin,
  Menu,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Vote,
} from "lucide-react";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";

import {
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import {
  useWorkspaceSettings,
} from "../../hooks/useWorkspaceSettings";

import shellStyles from "../Team/Team.module.css";
import styles from "./WorkspaceSettings.module.css";

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(value);
}

function formatElectionDate(value) {
  if (!value) {
    return "Election date pending";
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return "Election date pending";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(
    new Date(
      year,
      month - 1,
      day,
    ),
  );
}

function getDaysUntilElection(
  value,
  referenceTime,
) {
  if (
    !value ||
    !referenceTime
  ) {
    return null;
  }

  const election =
    new Date(
      `${value}T00:00:00`,
    );

  const reference =
    new Date(
      referenceTime,
    );

  reference.setHours(
    0,
    0,
    0,
    0,
  );

  if (
    Number.isNaN(
      election.getTime(),
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil(
      (
        election.getTime() -
        reference.getTime()
      ) /
        86400000,
    ),
  );
}

export default function WorkspaceSettings() {
  const [
    sessionWorkspace,
  ] = useState(
    () =>
      getCurrentWorkspace(),
  );

  const roleLabel =
    getRoleLabel();

  const canManageSettings =
    /candidate|consultant|manager|owner|administrator/i.test(
      roleLabel,
    );

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  const {
    workspace,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    lastSavedAt,
    hasChanges,
    refresh,
    updateField,
    resetChanges,
    saveWorkspaceSettings,
  } =
    useWorkspaceSettings({
      workspaceId:
        sessionWorkspace.id,
      initialWorkspace:
        sessionWorkspace,
    });

  const daysUntilElection =
    getDaysUntilElection(
      workspace.electionDate,
      lastUpdated?.getTime(),
    );

  const handleSubmit =
    async (event) => {
      event.preventDefault();
      setFormError("");

      if (
        !canManageSettings
      ) {
        setFormError(
          "Your current role cannot change workspace settings.",
        );
        return;
      }

      try {
        await saveWorkspaceSettings();
      } catch (saveError) {
        setFormError(
          saveError?.message ||
            "Workspace settings could not be saved.",
        );
      }
    };

  const handleReset =
    () => {
      resetChanges();
      setFormError("");
    };

  const handleCopyId =
    async () => {
      try {
        await navigator.clipboard.writeText(
          workspace.id,
        );

        setCopied(true);

        window.setTimeout(
          () => {
            setCopied(false);
          },
          1600,
        );
      } catch {
        setCopied(false);
      }
    };

  return (
    <div
      className={
        styles.app
      }
    >
      <CampaignSidebar
        activePage="Workspace settings"
        sidebarOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={
          shellStyles
        }
        accessDescription="Manage campaign identity, location, election details and workspace information."
        showLeadership
        adminAccent
      />

      <div
        className={
          styles.workspace
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.topbarLeft
            }
          >
            <button
              className={
                styles.menuButton
              }
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu
                size={21}
              />
            </button>

            <div>
              <span
                className={
                  styles.breadcrumb
                }
              >
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Leadership
                <ChevronRight
                  size={13}
                />
                Workspace settings
              </span>

              <strong>
                Campaign configuration
              </strong>
            </div>
          </div>

          <div
            className={
              styles.topbarActions
            }
          >
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            <div
              className={
                styles.syncStatus
              }
            >
              <span />

              {isLoading
                ? "Synchronizing workspace"
                : lastUpdated
                  ? `Updated ${formatTime(
                      lastUpdated,
                    )}`
                  : "Waiting for sync"}
            </div>

          </div>
        </header>

        <main
          className={
            styles.main
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Leadership settings
              </span>

              <h1>
                Workspace settings
              </h1>

              <p>
                Keep the campaign name,
                race, location and
                election date accurate
                everywhere in Campaign
                HQ.
              </p>
            </div>

            <button
              className={
                styles.refreshButton
              }
              type="button"
              onClick={
                refresh
              }
              disabled={
                isLoading ||
                isSaving
              }
            >
              <RefreshCw
                className={
                  isLoading
                    ? styles.spinning
                    : ""
                }
                size={17}
              />
              Refresh
            </button>
          </section>

          {!canManageSettings && (
            <section
              className={
                styles.restrictedPanel
              }
            >
              <LockKeyhole
                size={38}
              />

              <h2>
                Leadership access is
                required
              </h2>

              <p>
                Your current campaign
                role can view the
                workspace but cannot
                change its settings.
              </p>
            </section>
          )}

          {canManageSettings && (
            <>
              {(error ||
                formError) && (
                <section
                  className={
                    styles.errorBanner
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={20}
                  />

                  <div>
                    <strong>
                      Workspace settings
                      need attention
                    </strong>

                    <p>
                      {formError ||
                        error}
                    </p>
                  </div>
                </section>
              )}

              {lastSavedAt && (
                <section
                  className={
                    styles.successBanner
                  }
                >
                  <CheckCircle2
                    size={20}
                  />

                  <div>
                    <strong>
                      Workspace updated
                    </strong>

                    <p>
                      Changes were saved
                      at{" "}
                      {formatTime(
                        lastSavedAt,
                      )}
                      {" "}and are now
                      reflected in the
                      campaign sidebar
                      and workspace
                      selector.
                    </p>
                  </div>
                </section>
              )}

              <section
                className={
                  styles.securityNotice
                }
              >
                <ShieldCheck
                  size={22}
                />

                <div>
                  <strong>
                    Protected campaign
                    configuration
                  </strong>

                  <p>
                    Changes are validated
                    by Supabase and are
                    limited to authorized
                    campaign leadership.
                  </p>
                </div>
              </section>

              <div
                className={
                  styles.settingsGrid
                }
              >
                <form
                  className={
                    styles.settingsPanel
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <header
                    className={
                      styles.panelHeader
                    }
                  >
                    <div>
                      <span>
                        Campaign identity
                      </span>

                      <h2>
                        Workspace details
                      </h2>
                    </div>

                    <Settings2
                      size={23}
                    />
                  </header>

                  <div
                    className={
                      styles.formBody
                    }
                  >
                    <label
                      className={
                        styles.fullField
                      }
                    >
                      <span>
                        Campaign name
                      </span>

                      <div
                        className={
                          styles.inputWrap
                        }
                      >
                        <Building2
                          size={18}
                        />

                        <input
                          type="text"
                          value={
                            workspace.name
                          }
                          onChange={(
                            event,
                          ) =>
                            updateField(
                              "name",
                              event.target
                                .value,
                            )
                          }
                          maxLength={120}
                          required
                        />
                      </div>

                      <small>
                        Appears throughout
                        the sidebar and
                        workspace selector.
                      </small>
                    </label>

                    <label
                      className={
                        styles.fullField
                      }
                    >
                      <span>
                        Race or office
                      </span>

                      <textarea
                        value={
                          workspace.description
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "description",
                            event.target
                              .value,
                          )
                        }
                        maxLength={300}
                        rows={4}
                        required
                      />

                      <small>
                        Example: Palm Beach
                        County Commission,
                        District 6.
                      </small>
                    </label>

                    <label>
                      <span>
                        Campaign location
                      </span>

                      <div
                        className={
                          styles.inputWrap
                        }
                      >
                        <MapPin
                          size={18}
                        />

                        <input
                          type="text"
                          value={
                            workspace.location
                          }
                          onChange={(
                            event,
                          ) =>
                            updateField(
                              "location",
                              event.target
                                .value,
                            )
                          }
                          maxLength={160}
                          required
                        />
                      </div>
                    </label>

                    <label>
                      <span>
                        Political party
                      </span>

                      <div
                        className={
                          styles.inputWrap
                        }
                      >
                        <Vote
                          size={18}
                        />

                        <select
                          value={
                            workspace.politicalParty
                          }
                          onChange={(
                            event,
                          ) =>
                            updateField(
                              "politicalParty",
                              event.target
                                .value,
                            )
                          }
                          required
                        >
                          <option value="republican">
                            Republican
                          </option>

                          <option value="democratic">
                            Democratic
                          </option>

                          <option value="nonpartisan">
                            Nonpartisan
                          </option>

                          <option value="other">
                            Other
                          </option>
                        </select>
                      </div>

                      <small>
                        Republican uses a
                        red sidebar with
                        blue navigation.
                        Democratic uses a
                        blue sidebar with
                        red navigation.
                      </small>
                    </label>

                    <label>
                      <span>
                        Election date
                      </span>

                      <div
                        className={
                          styles.inputWrap
                        }
                      >
                        <CalendarDays
                          size={18}
                        />

                        <input
                          type="date"
                          value={
                            workspace.electionDate
                          }
                          onChange={(
                            event,
                          ) =>
                            updateField(
                              "electionDate",
                              event.target
                                .value,
                            )
                          }
                          required
                        />
                      </div>
                    </label>
                  </div>

                  <footer
                    className={
                      styles.formFooter
                    }
                  >
                    <div>
                      {hasChanges ? (
                        <span
                          className={
                            styles.unsavedStatus
                          }
                        >
                          Unsaved changes
                        </span>
                      ) : (
                        <span
                          className={
                            styles.savedStatus
                          }
                        >
                          <Check
                            size={15}
                          />
                          Settings are
                          current
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        styles.formActions
                      }
                    >
                      <button
                        type="button"
                        onClick={
                          handleReset
                        }
                        disabled={
                          !hasChanges ||
                          isSaving
                        }
                      >
                        <RotateCcw
                          size={16}
                        />
                        Reset
                      </button>

                      <button
                        className={
                          styles.saveButton
                        }
                        type="submit"
                        disabled={
                          !hasChanges ||
                          isSaving
                        }
                      >
                        <Save
                          size={17}
                        />

                        {isSaving
                          ? "Saving…"
                          : "Save settings"}
                      </button>
                    </div>
                  </footer>
                </form>

                <aside
                  className={
                    styles.previewColumn
                  }
                >
                  <article
                    className={
                      styles.previewPanel
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Live preview
                        </span>

                        <h2>
                          Campaign identity
                        </h2>
                      </div>

                      <Eye
                        size={22}
                      />
                    </header>

                    <div
                      className={
                        styles.previewCard
                      }
                    >
                      <div
                        className={
                          styles.previewMark
                        }
                      >
                        <span>
                          {getUserInitials(
                            workspace.name,
                          )}
                        </span>

                        <Vote
                          size={18}
                        />
                      </div>

                      <div
                        className={
                          styles.previewIdentity
                        }
                      >
                        <strong>
                          {workspace.name ||
                            "Campaign name"}
                        </strong>

                        <span>
                          {workspace.description ||
                            "Campaign race or office"}
                        </span>
                      </div>

                      <div
                        className={
                          styles.previewDetails
                        }
                      >
                        <div>
                          <MapPin
                            size={17}
                          />

                          <span>
                            {workspace.location ||
                              "Campaign location"}
                          </span>
                        </div>

                        <div>
                          <CalendarDays
                            size={17}
                          />

                          <span>
                            {formatElectionDate(
                              workspace.electionDate,
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        className={
                          styles.countdown
                        }
                      >
                        <span>
                          Election countdown
                        </span>

                        <strong>
                          {daysUntilElection ??
                            "—"}
                        </strong>

                        <small>
                          days remaining
                        </small>
                      </div>
                    </div>
                  </article>

                  <article
                    className={
                      styles.systemPanel
                    }
                  >
                    <header>
                      <div>
                        <span>
                          Workspace system
                        </span>

                        <h2>
                          Technical details
                        </h2>
                      </div>

                      <Database
                        size={22}
                      />
                    </header>

                    <div
                      className={
                        styles.systemRows
                      }
                    >
                      <div>
                        <span>
                          Workspace status
                        </span>

                        <strong
                          className={
                            styles.activeStatus
                          }
                        >
                          {workspace.status}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Workspace ID
                        </span>

                        <div
                          className={
                            styles.idRow
                          }
                        >
                          <code>
                            {workspace.id}
                          </code>

                          <button
                            type="button"
                            onClick={
                              handleCopyId
                            }
                            title="Copy workspace ID"
                          >
                            {copied ? (
                              <Check
                                size={16}
                              />
                            ) : (
                              <Copy
                                size={16}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span>
                          Connected modules
                        </span>

                        <strong>
                          9 campaign modules
                        </strong>
                      </div>
                    </div>
                  </article>
                </aside>
              </div>

              <footer
                className={
                  styles.footer
                }
              >
                <span>
                  Campaign HQ Workspace
                  Settings
                </span>

                <span>
                  Authorized leadership
                  use only
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
