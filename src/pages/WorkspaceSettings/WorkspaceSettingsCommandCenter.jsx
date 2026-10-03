
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Database,
  Eye,
  Link2,
  MapPin,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
  WalletCards,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useWorkspaceSettings,
} from "../../hooks/useWorkspaceSettings";

import {
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import styles from "./WorkspaceSettingsCommandCenter.module.css";


const SETTINGS_VIEWS =
  new Set([
    "overview",
    "identity",
    "system",
  ]);


function readSettingsLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "overview";
  }

  const url =
    new URL(
      window.location.href,
    );

  const requested =
    url.searchParams.get(
      "settings-view",
    );

  return SETTINGS_VIEWS.has(
    requested,
  )
    ? requested
    : "overview";
}


function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        "America/New_York",
    },
  ).format(
    value,
  );
}


function formatElectionDate(value) {
  if (!value) {
    return "Not configured";
  }

  const parts =
    String(
      value,
    )
      .split("-")
      .map(Number);

  if (
    parts.length !==
      3 ||
    parts.some(
      (part) =>
        !part,
    )
  ) {
    return "Not configured";
  }

  const [
    year,
    month,
    day,
  ] =
    parts;

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      timeZone:
        "America/New_York",
    },
  ).format(
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
    ),
  );
}


function humanize(value) {
  if (!value) {
    return "Not configured";
  }

  return String(
    value,
  )
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}


function getDaysUntilElection(value) {
  if (!value) {
    return null;
  }

  const election =
    new Date(
      `${value}T12:00:00`,
    );

  if (
    Number.isNaN(
      election.getTime(),
    )
  ) {
    return null;
  }

  const now =
    new Date();

  const reference =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    );

  return Math.ceil(
    (
      election.getTime() -
      reference.getTime()
    ) /
      86400000,
  );
}


export default function WorkspaceSettingsCommandCenter() {
  const navigate =
    useNavigate();

  const [
    sessionWorkspace,
  ] =
    useState(
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
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readSettingsLocation(),
    );

  const [
    formError,
    setFormError,
  ] =
    useState("");

  const [
    notice,
    setNotice,
  ] =
    useState("");

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


  const applyView =
    (
      nextView,
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "settings-view",
        nextView,
      );

      const nextUrl =
        `${url.pathname}${url.search}${url.hash}`;

      window.history[
        replace
          ? "replaceState"
          : "pushState"
      ](
        {},
        "",
        nextUrl,
      );

      setActiveView(
        nextView,
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          setActiveView(
            readSettingsLocation(),
          );
        };

      window.addEventListener(
        "popstate",
        syncHistory,
      );

      return () => {
        window.removeEventListener(
          "popstate",
          syncHistory,
        );
      };
    },
    [],
  );


  const requiredFields =
    useMemo(
      () => [
        workspace.name,
        workspace.description,
        workspace.location,
        workspace.electionDate,
        workspace.politicalParty,
      ],
      [
        workspace.name,
        workspace.description,
        workspace.location,
        workspace.electionDate,
        workspace.politicalParty,
      ],
    );

  const configuredFields =
    requiredFields.filter(
      (value) =>
        Boolean(
          String(
            value ||
            "",
          ).trim(),
        ),
    ).length;

  const daysUntilElection =
    getDaysUntilElection(
      workspace.electionDate,
    );


  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault();

      setFormError(
        "",
      );

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

        setNotice(
          "Workspace settings saved.",
        );
      } catch (
        saveError
      ) {
        setFormError(
          saveError?.message ||
          "Workspace settings could not be saved.",
        );
      }
    };


  const handleReset =
    () => {
      resetChanges();

      setFormError(
        "",
      );

      setNotice(
        "Unsaved changes reset.",
      );
    };


  return (
    <CampaignWorkspaceShell
      activeItem="Settings"
    >
      <main
        className={
          styles.main
        }
        data-workspace-settings-command-center="true"
        data-settings-existing-rpc="manage_workspace_settings_with_party"
      >
        <div
          className={
            styles.canvas
          }
        >
          <section
            className={
              styles.hero
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Workspace configuration
              </span>

              <h1>
                Settings Command Center
              </h1>

              <p>
                Review Campaign Seat workspace identity, configuration,
                access state, and technical details from one protected
                workspace surface.
              </p>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={async () => {
                  await refresh();

                  setNotice(
                    "Workspace settings refreshed.",
                  );
                }}
                disabled={
                  isLoading ||
                  isSaving
                }
              >
                <RefreshCw
                  size={18}
                />
                Refresh
              </button>
            </div>
          </section>


          <div
            className={
              [
                styles.liveStatus,
                error
                  ? styles.liveStatusError
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {error ? (
              <AlertTriangle
                size={16}
              />
            ) : (
              <ShieldCheck
                size={16}
              />
            )}

            <span>
              {error
                ? error
                : isLoading
                  ? "Loading protected workspace configuration…"
                  : "Live Campaign Seat workspace configuration connected"}
            </span>

            {lastUpdated ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdated,
                )}
              </small>
            ) : null}
          </div>


          {notice ? (
            <div
              className={
                styles.notice
              }
              role="status"
            >
              <Check
                size={16}
              />

              <span>
                {notice}
              </span>

              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() =>
                  setNotice(
                    "",
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            </div>
          ) : null}


          {formError ? (
            <div
              className={
                styles.errorNotice
              }
              role="alert"
            >
              <AlertTriangle
                size={17}
              />

              <span>
                {formError}
              </span>
            </div>
          ) : null}


          <section
            className={
              styles.metrics
            }
            aria-label="Workspace configuration summary"
          >
            <button
              type="button"
              onClick={() =>
                applyView(
                  "system",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Database
                  size={22}
                />
              </span>

              <span>
                <small>
                  Workspace status
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  {humanize(
                    workspace.status,
                  )}
                </strong>

                <em>
                  Live workspace record
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyView(
                  "identity",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Settings2
                  size={22}
                />
              </span>

              <span>
                <small>
                  Required fields
                </small>

                <strong>
                  {configuredFields}/5
                </strong>

                <em>
                  Workspace identity configuration
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyView(
                  "identity",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <CalendarDays
                  size={22}
                />
              </span>

              <span>
                <small>
                  Election date
                </small>

                <strong
                  className={
                    styles.metricDate
                  }
                >
                  {formatElectionDate(
                    workspace.electionDate,
                  )}
                </strong>

                <em>
                  Workspace configuration
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyView(
                  "identity",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <ShieldCheck
                  size={22}
                />
              </span>

              <span>
                <small>
                  Settings access
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  {canManageSettings
                    ? "Editable"
                    : "View only"}
                </strong>

                <em>
                  Existing role authorization
                </em>
              </span>
            </button>
          </section>


          <section
            className={
              styles.workspace
            }
          >
            <div
              className={
                styles.primaryColumn
              }
            >
              <nav
                className={
                  styles.tabs
                }
                aria-label="Workspace settings views"
              >
                <button
                  type="button"
                  className={
                    activeView ===
                    "overview"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "overview",
                    )
                  }
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "identity"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "identity",
                    )
                  }
                >
                  Workspace identity
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "system"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "system",
                    )
                  }
                >
                  System
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <>
                  <section
                    className={
                      styles.snapshotPanel
                    }
                  >
                    <header>
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        <Eye
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Workspace identity snapshot
                        </h2>

                        <p>
                          Current values loaded from the live workspace record.
                        </p>
                      </div>
                    </header>

                    <div
                      className={
                        styles.snapshotGrid
                      }
                    >
                      <SnapshotCell
                        label="Workspace name"
                        value={
                          workspace.name
                        }
                        icon={
                          Building2
                        }
                      />

                      <SnapshotCell
                        label="Race or office"
                        value={
                          workspace.description
                        }
                        icon={
                          Vote
                        }
                      />

                      <SnapshotCell
                        label="Location"
                        value={
                          workspace.location
                        }
                        icon={
                          MapPin
                        }
                      />

                      <SnapshotCell
                        label="Election date"
                        value={
                          formatElectionDate(
                            workspace.electionDate,
                          )
                        }
                        icon={
                          CalendarDays
                        }
                      />
                    </div>
                  </section>


                  <section
                    className={
                      styles.previewPanel
                    }
                  >
                    <header>
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        <Vote
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Campaign identity preview
                        </h2>

                        <p>
                          Preview uses the currently loaded settings values.
                        </p>
                      </div>
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
                        {getUserInitials(
                          workspace.name,
                        )}
                      </div>

                      <div
                        className={
                          styles.previewIdentity
                        }
                      >
                        <strong>
                          {workspace.name ||
                            "Campaign workspace"}
                        </strong>

                        <span>
                          {workspace.description ||
                            "Workspace description"}
                        </span>
                      </div>

                      <div
                        className={
                          styles.previewDetails
                        }
                      >
                        <span>
                          <MapPin
                            size={15}
                          />
                          {workspace.location ||
                            "Location not configured"}
                        </span>

                        <span>
                          <CalendarDays
                            size={15}
                          />
                          {formatElectionDate(
                            workspace.electionDate,
                          )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.countdown
                        }
                      >
                        <small>
                          Election countdown
                        </small>

                        <strong>
                          {daysUntilElection ===
                          null
                            ? "—"
                            : Math.max(
                                0,
                                daysUntilElection,
                              )}
                        </strong>

                        <span>
                          days remaining
                        </span>
                      </div>
                    </div>
                  </section>
                </>
              ) : null}


              {activeView ===
              "identity" ? (
                <form
                  className={
                    styles.formPanel
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <Settings2
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Workspace identity
                      </h2>

                      <p>
                        Saving uses the existing protected Campaign Seat
                        workspace-settings RPC.
                      </p>
                    </div>
                  </header>

                  {!canManageSettings ? (
                    <div
                      className={
                        styles.restrictedState
                      }
                    >
                      <ShieldCheck
                        size={28}
                      />

                      <strong>
                        View-only access
                      </strong>

                      <span>
                        Your current role can view workspace configuration
                        but cannot save changes.
                      </span>
                    </div>
                  ) : (
                    <>
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
                              size={17}
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
                                  event.target.value,
                                )
                              }
                              maxLength={120}
                              required
                            />
                          </div>
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
                                event.target.value,
                              )
                            }
                            maxLength={300}
                            rows={4}
                            required
                          />
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
                              size={17}
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
                                  event.target.value,
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
                              size={17}
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
                                  event.target.value,
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
                              size={17}
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
                                  event.target.value,
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
                              Settings are current
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
                            type="submit"
                            className={
                              styles.saveButton
                            }
                            disabled={
                              !hasChanges ||
                              isSaving
                            }
                          >
                            <Save
                              size={16}
                            />
                            {isSaving
                              ? "Saving…"
                              : "Save settings"}
                          </button>
                        </div>
                      </footer>
                    </>
                  )}
                </form>
              ) : null}


              {activeView ===
              "system" ? (
                <section
                  className={
                    styles.systemPanel
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <Database
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Workspace system details
                      </h2>

                      <p>
                        Read-only technical metadata for this Campaign Seat workspace.
                      </p>
                    </div>
                  </header>

                  <div
                    className={
                      styles.systemGrid
                    }
                  >
                    <SystemCell
                      label="Workspace ID"
                      value={
                        workspace.id
                      }
                    />

                    <SystemCell
                      label="Workspace status"
                      value={
                        humanize(
                          workspace.status,
                        )
                      }
                    />

                    <SystemCell
                      label="Settings access"
                      value={
                        canManageSettings
                          ? "Authorized to edit"
                          : "View only"
                      }
                    />

                    <SystemCell
                      label="Save path"
                      value="Protected workspace settings RPC"
                    />

                    <SystemCell
                      label="Configured fields"
                      value={`${configuredFields} of 5`}
                    />

                    <SystemCell
                      label="Last refreshed"
                      value={
                        lastUpdated
                          ? formatTime(
                              lastUpdated,
                            )
                          : "Not yet refreshed"
                      }
                    />
                  </div>

                  <div
                    className={
                      styles.securityPanel
                    }
                  >
                    <ShieldCheck
                      size={21}
                    />

                    <div>
                      <strong>
                        Existing authorization remains authoritative
                      </strong>

                      <p>
                        V80 does not add a new settings write path.
                        Saves continue through the existing protected
                        Campaign Seat workspace-settings function.
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>


            <aside
              className={
                styles.rightRail
              }
            >
              <section
                className={
                  styles.attentionCard
                }
              >
                <header>
                  <span>
                    <Settings2
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Configuration status
                    </h2>

                    <p>
                      Current workspace settings conditions.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "identity",
                    )
                  }
                >
                  <div>
                    <strong>
                      {5 -
                        configuredFields} required fields incomplete
                    </strong>

                    <span>
                      Name, office, location, election date and party
                    </span>
                  </div>

                  <em>
                    {5 -
                      configuredFields}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "identity",
                    )
                  }
                >
                  <div>
                    <strong>
                      {hasChanges
                        ? "Unsaved changes"
                        : "Settings are current"}
                    </strong>

                    <span>
                      Local form state versus saved workspace state
                    </span>
                  </div>

                  <em>
                    {hasChanges
                      ? 1
                      : 0}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "system",
                    )
                  }
                >
                  <div>
                    <strong>
                      {canManageSettings
                        ? "Edit access available"
                        : "View-only access"}
                    </strong>

                    <span>
                      Existing workspace role authorization
                    </span>
                  </div>

                  <em>
                    {canManageSettings
                      ? 0
                      : 1}
                  </em>
                </button>
              </section>


              <section
                className={
                  styles.quickCard
                }
              >
                <header>
                  <h2>
                    Quick actions
                  </h2>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/workspace/integrations",
                    )
                  }
                >
                  <Link2
                    size={16}
                  />
                  View integrations
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/workspace/usage",
                    )
                  }
                >
                  <WalletCards
                    size={16}
                  />
                  Plan &amp; Usage
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/team",
                    )
                  }
                >
                  <Users
                    size={16}
                  />
                  Review team
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/inventory",
                    )
                  }
                >
                  <PackageOpen
                    size={16}
                  />
                  Open inventory
                </button>
              </section>


              <section
                className={
                  styles.connectionCard
                }
              >
                <span>
                  <ShieldCheck
                    size={21}
                  />
                </span>

                <div>
                  <strong>
                    Protected workspace configuration
                  </strong>

                  <p>
                    Workspace settings are loaded from live Campaign Seat data.
                  </p>

                  <small>
                    V80 does not bypass existing role, RLS, MFA, or RPC protections.
                  </small>
                </div>
              </section>
            </aside>
          </section>


          <div
            className={
              styles.footerNote
            }
          >
            <ShieldCheck
              size={16}
            />

            <span>
              V80 introduces no new database write path. The command center
              uses the existing Workspace Settings hook and protected save RPC.
            </span>
          </div>


          {lastSavedAt ? (
            <div
              className={
                styles.savedBanner
              }
            >
              <Check
                size={16}
              />

              <span>
                Last saved{" "}
                {formatTime(
                  lastSavedAt,
                )}
              </span>
            </div>
          ) : null}
        </div>
      </main>
    </CampaignWorkspaceShell>
  );
}


function SnapshotCell({
  label,
  value,
  icon: Icon,
}) {
  return (
    <article
      className={
        styles.snapshotCell
      }
    >
      <span>
        <Icon
          size={18}
        />
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value ||
            "Not configured"}
        </strong>
      </div>
    </article>
  );
}


function SystemCell({
  label,
  value,
}) {
  return (
    <div>
      <small>
        {label}
      </small>

      <strong>
        {value ||
          "Not available"}
      </strong>
    </div>
  );
}
