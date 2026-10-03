
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Files,
  Link2,
  Mail,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import {
  useCallback,
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
  supabase,
} from "../../lib/supabase";

import {
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./IntegrationsCommandCenter.module.css";


const INTEGRATION_VIEWS =
  new Set([
    "overview",
    "connections",
    "ai",
    "readiness",
  ]);

const ATTENTION_STATUSES =
  new Set([
    "degraded",
    "reauthorization_required",
    "error",
  ]);

const PENDING_STATUSES =
  new Set([
    "connecting",
    "pending_verification",
  ]);


function humanize(value) {
  if (!value) {
    return "Not configured";
  }

  return String(value)
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


function formatBytes(value) {
  const bytes =
    Number(
      value ||
      0,
    );

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length -
        1,
    );

  const amount =
    bytes /
    1024 ** index;

  return `${
    amount >= 10 ||
    index === 0
      ? amount.toFixed(0)
      : amount.toFixed(1)
  } ${units[index]}`;
}


function safeDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}


function formatDateTime(
  value,
  timezone,
  fallback = "Not recorded",
) {
  const date =
    safeDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function formatTime(
  value,
  timezone,
) {
  const date =
    value instanceof Date
      ? value
      : safeDate(
          value,
        );

  if (!date) {
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
        timezone ||
        "America/New_York",
    },
  ).format(date);
}


function statusMeta(row) {
  if (!row) {
    return {
      label:
        "Not connected",

      tone:
        "neutral",
    };
  }

  if (
    row.status ===
    "connected"
  ) {
    return {
      label:
        "Connected",

      tone:
        "good",
    };
  }

  if (
    ATTENTION_STATUSES.has(
      row.status,
    )
  ) {
    return {
      label:
        row.status ===
        "reauthorization_required"
          ? "Reconnect required"
          : row.status ===
            "error"
            ? "Error"
            : "Needs attention",

      tone:
        "warning",
    };
  }

  if (
    PENDING_STATUSES.has(
      row.status,
    )
  ) {
    return {
      label:
        row.status ===
        "pending_verification"
          ? "Pending verification"
          : "Connecting",

      tone:
        "pending",
    };
  }

  return {
    label:
      humanize(
        row.status ||
        "not connected",
      ),

    tone:
      "neutral",
  };
}


function accountProvider(row) {
  const value =
    String(
      row?.connection_key ||
      "",
    )
      .split(":")[0]
      .trim()
      .toLowerCase();

  if (
    value ===
    "microsoft"
  ) {
    return "Microsoft";
  }

  if (
    value ===
    "google"
  ) {
    return "Google";
  }

  return row?.provider
    ? humanize(
        row.provider,
      )
    : "Provider";
}


function readIntegrationLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      integrationId:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requestedView =
    url.searchParams.get(
      "integrations-view",
    );

  return {
    view:
      INTEGRATION_VIEWS.has(
        requestedView,
      )
        ? requestedView
        : "overview",

    integrationId:
      url.searchParams.get(
        "integration",
      ) ||
      "",
  };
}


function newestIntegration(
  rows,
  integrationType,
) {
  return (
    rows.find(
      (row) =>
        row.integration_type ===
        integrationType,
    ) ||
    null
  );
}


export default function IntegrationsCommandCenter() {
  const navigate =
    useNavigate();

  const workspace =
    getCurrentWorkspace();

  const workspaceId =
    workspace?.id ||
    "";

  const timezone =
    workspace?.timezone ||
    "America/New_York";


  const [
    integrations,
    setIntegrations,
  ] = useState([]);

  const [
    onboardingSteps,
    setOnboardingSteps,
  ] = useState([]);

  const [
    aiSettings,
    setAiSettings,
  ] = useState(null);

  const [
    files,
    setFiles,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readIntegrationLocation()
          .view,
    );

  const [
    selectedIntegrationId,
    setSelectedIntegrationId,
  ] =
    useState(
      () =>
        readIntegrationLocation()
          .integrationId,
    );


  const refresh =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (!workspaceId) {
          setError(
            "An active Campaign Seat workspace is required.",
          );

          setLoading(false);

          return false;
        }

        if (showLoading) {
          setLoading(true);
        }

        try {
          const [
            integrationResult,
            onboardingResult,
            aiResult,
            filesResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "workspace_integrations",
                )
                .select(
                  [
                    "id",
                    "workspace_id",
                    "provider",
                    "integration_type",
                    "connection_key",
                    "status",
                    "display_name",
                    "display_email",
                    "capabilities",
                    "settings",
                    "last_sync_at",
                    "last_success_at",
                    "connected_at",
                    "updated_at",
                    "last_error_code",
                    "last_error_summary",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .order(
                  "updated_at",
                  {
                    ascending:
                      false,
                  },
                ),

              supabase
                .from(
                  "workspace_onboarding_steps",
                )
                .select(
                  "step_key,status,completed_at,updated_at",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "step_key",
                  [
                    "communications",
                    "calendar",
                    "files",
                    "texting",
                  ],
                ),

              supabase
                .from(
                  "workspace_ai_settings",
                )
                .select(
                  [
                    "enabled",
                    "preferred_provider",
                    "preferred_model",
                    "fallback_providers",
                    "allow_write_actions",
                    "require_human_approval",
                    "require_source_citations",
                    "updated_at",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .maybeSingle(),

              supabase
                .from(
                  "campaign_files",
                )
                .select(
                  "id,size_bytes",
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                ),
            ]);

          if (
            integrationResult.error
          ) {
            throw integrationResult.error;
          }

          if (
            onboardingResult.error
          ) {
            throw onboardingResult.error;
          }

          if (
            aiResult.error
          ) {
            throw aiResult.error;
          }

          if (
            filesResult.error
          ) {
            throw filesResult.error;
          }

          setIntegrations(
            integrationResult.data ||
              [],
          );

          setOnboardingSteps(
            onboardingResult.data ||
              [],
          );

          setAiSettings(
            aiResult.data ||
              null,
          );

          setFiles(
            filesResult.data ||
              [],
          );

          setError("");

          setLastUpdated(
            new Date(),
          );

          setLoading(false);

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Integrations] workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Integration status could not be loaded.",
          );

          setLoading(false);

          return false;
        }
      },
      [
        workspaceId,
      ],
    );


  useEffect(
    () => {
      const timeout =
        window.setTimeout(
          () => {
            void refresh({
              showLoading:
                true,
            });
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timeout,
        );
    },
    [
      refresh,
    ],
  );


  const applyLocation =
    (
      nextView,
      nextIntegrationId = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "integrations-view",
        nextView,
      );

      if (
        nextIntegrationId
      ) {
        url.searchParams.set(
          "integration",
          nextIntegrationId,
        );
      } else {
        url.searchParams.delete(
          "integration",
        );
      }

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

      setSelectedIntegrationId(
        nextIntegrationId,
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          const next =
            readIntegrationLocation();

          setActiveView(
            next.view,
          );

          setSelectedIntegrationId(
            next.integrationId,
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


  const selectedIntegration =
    selectedIntegrationId
      ? integrations.find(
          (row) =>
            row.id ===
            selectedIntegrationId,
        ) ||
        null
      : null;


  const connectedCount =
    integrations.filter(
      (row) =>
        row.status ===
        "connected",
    ).length;

  const attentionRows =
    integrations.filter(
      (row) =>
        ATTENTION_STATUSES.has(
          row.status,
        ),
    );

  const pendingRows =
    integrations.filter(
      (row) =>
        PENDING_STATUSES.has(
          row.status,
        ),
    );

  const storageBytes =
    useMemo(
      () =>
        files.reduce(
          (
            total,
            file,
          ) =>
            total +
            Number(
              file.size_bytes ||
              0,
            ),
          0,
        ),
      [
        files,
      ],
    );

  const stepsByKey =
    useMemo(
      () =>
        Object.fromEntries(
          onboardingSteps.map(
            (step) => [
              step.step_key,
              step,
            ],
          ),
        ),
      [
        onboardingSteps,
      ],
    );

  const incompleteSteps =
    [
      "communications",
      "calendar",
      "files",
      "texting",
    ].filter(
      (key) =>
        stepsByKey[key]
          ?.status !==
        "complete",
    );

  const emailIntegration =
    newestIntegration(
      integrations,
      "email",
    );

  const calendarIntegration =
    newestIntegration(
      integrations,
      "calendar",
    );

  const smsIntegration =
    newestIntegration(
      integrations,
      "sms",
    );


  return (
    <CampaignWorkspaceShell
      activeItem="Integrations"
    >
      <main
        className={
          styles.main
        }
        data-integrations-command-center="true"
        data-integrations-live-storage="true"
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
                Platform connections
              </span>

              <h1>
                Integrations Command Center
              </h1>

              <p>
                See the campaign&apos;s live provider connections,
                setup readiness, file storage, and AI configuration
                without exposing provider credentials or secrets.
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
                  const result =
                    await refresh({
                      showLoading:
                        true,
                    });

                  setNotice(
                    result
                      ? "Live integration status refreshed."
                      : "Unable to refresh integration status.",
                  );
                }}
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
              <X
                size={16}
              />
            ) : (
              <CheckCircle2
                size={16}
              />
            )}

            <span>
              {error
                ? error
                : loading
                  ? "Loading live integration metadata…"
                  : "Live Campaign Seat integration metadata connected"}
            </span>

            {lastUpdated ? (
              <small>
                Updated{" "}
                {formatTime(
                  lastUpdated,
                  timezone,
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
              <CheckCircle2
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


          <section
            className={
              styles.metrics
            }
            aria-label="Integration summary"
          >
            <button
              type="button"
              className={
                activeView ===
                "connections"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "connections",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Link2
                  size={22}
                />
              </span>

              <span>
                <small>
                  Connected records
                </small>

                <strong>
                  {connectedCount}
                </strong>

                <em>
                  Live workspace integrations
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "connections"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "connections",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <AlertTriangle
                  size={22}
                />
              </span>

              <span>
                <small>
                  Needs attention
                </small>

                <strong>
                  {attentionRows.length}
                </strong>

                <em>
                  Provider connection issues
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyLocation(
                  "overview",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Files
                  size={22}
                />
              </span>

              <span>
                <small>
                  Stored files
                </small>

                <strong>
                  {files.length}
                </strong>

                <em>
                  {formatBytes(
                    storageBytes,
                  )}
                </em>
              </span>
            </button>


            <button
              type="button"
              className={
                activeView ===
                "ai"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "ai",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Bot
                  size={22}
                />
              </span>

              <span>
                <small>
                  AI gateway
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  {aiSettings
                    ?.enabled
                    ? "Enabled"
                    : "Disabled"}
                </strong>

                <em>
                  Preferred:{" "}
                  {humanize(
                    aiSettings
                      ?.preferred_provider ||
                    "auto",
                  )}
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
                aria-label="Integration views"
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
                    applyLocation(
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
                    "connections"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "connections",
                    )
                  }
                >
                  Connections
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "ai"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "ai",
                    )
                  }
                >
                  AI gateway
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "readiness"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "readiness",
                    )
                  }
                >
                  Readiness
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <>
                  <section
                    className={
                      styles.serviceGrid
                    }
                  >
                    <ServiceCard
                      icon={Mail}
                      title="Campaign email"
                      subtitle="Nylas · Google / Microsoft"
                      row={
                        emailIntegration
                      }
                      fallback="Ready to connect"
                      details={
                        emailIntegration
                          ?.display_email ||
                        "No campaign mailbox recorded"
                      }
                    />

                    <ServiceCard
                      icon={
                        CalendarDays
                      }
                      title="Campaign calendar"
                      subtitle="Nylas Calendar"
                      row={
                        calendarIntegration
                      }
                      fallback="Ready to connect"
                      details={
                        calendarIntegration
                          ?.display_email ||
                        "No calendar recorded"
                      }
                    />

                    <ServiceCard
                      icon={
                        MessageSquareText
                      }
                      title="Campaign texting"
                      subtitle="Twilio"
                      row={
                        smsIntegration
                      }
                      fallback="Platform ready"
                      details={
                        smsIntegration
                          ?.display_name ||
                        "No workspace SMS connection recorded"
                      }
                    />

                    <ServiceCard
                      icon={Files}
                      title="Campaign files"
                      subtitle="Campaign Seat secure storage"
                      fixedStatus={{
                        label:
                          "Active",

                        tone:
                          "good",
                      }}
                      details={`${files.length} files · ${formatBytes(
                        storageBytes,
                      )}`}
                    />
                  </section>


                  <ConnectionTable
                    integrations={
                      integrations.slice(
                        0,
                        6,
                      )
                    }
                    timezone={
                      timezone
                    }
                    selectedIntegrationId={
                      selectedIntegrationId
                    }
                    onSelect={(
                      row,
                    ) =>
                      applyLocation(
                        "overview",
                        row.id,
                      )
                    }
                    title="Recent connection records"
                    subtitle="Live workspace integration metadata. Credentials are not displayed."
                  />
                </>
              ) : null}


              {activeView ===
              "connections" ? (
                <ConnectionTable
                  integrations={
                    integrations
                  }
                  timezone={
                    timezone
                  }
                  selectedIntegrationId={
                    selectedIntegrationId
                  }
                  onSelect={(
                    row,
                  ) =>
                    applyLocation(
                      "connections",
                      row.id,
                    )
                  }
                  title="Provider connections"
                  subtitle="Each row is a live workspace_integrations record."
                />
              ) : null}


              {activeView ===
              "ai" ? (
                <AiPanel
                  aiSettings={
                    aiSettings
                  }
                  timezone={
                    timezone
                  }
                />
              ) : null}


              {activeView ===
              "readiness" ? (
                <ReadinessPanel
                  stepsByKey={
                    stepsByKey
                  }
                  files={
                    files
                  }
                  storageBytes={
                    storageBytes
                  }
                  timezone={
                    timezone
                  }
                />
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
                    <Sparkles
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Needs attention
                    </h2>

                    <p>
                      Connection and setup conditions worth reviewing.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "connections",
                    )
                  }
                >
                  <div>
                    <strong>
                      {attentionRows.length} connection issues
                    </strong>

                    <span>
                      Error, degraded, or reconnect-required records
                    </span>
                  </div>

                  <em>
                    {attentionRows.length}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "connections",
                    )
                  }
                >
                  <div>
                    <strong>
                      {pendingRows.length} pending connections
                    </strong>

                    <span>
                      Connecting or awaiting verification
                    </span>
                  </div>

                  <em>
                    {pendingRows.length}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "readiness",
                    )
                  }
                >
                  <div>
                    <strong>
                      {incompleteSteps.length} setup steps incomplete
                    </strong>

                    <span>
                      Core workspace integration readiness
                    </span>
                  </div>

                  <em>
                    {incompleteSteps.length}
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
                      "/workspace/settings?tab=integrations",
                    )
                  }
                >
                  <Mail
                    size={16}
                  />
                  Manage email
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/calendar",
                    )
                  }
                >
                  <CalendarDays
                    size={16}
                  />
                  Open Calendar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/files",
                    )
                  }
                >
                  <Files
                    size={16}
                  />
                  Open Files
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/workspace/usage",
                    )
                  }
                >
                  <MessageSquareText
                    size={16}
                  />
                  View usage
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
                    Connection metadata only
                  </strong>

                  <p>
                    Provider passwords, refresh tokens, API keys,
                    and other credentials are intentionally not
                    displayed in this workspace.
                  </p>

                  <small>
                    Credentials remain in protected server-side storage.
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
              V78 is read-only for provider connection metadata.
              Connected does not imply that every Campaign Seat
              product feature or external provider is configured.
            </span>
          </div>
        </div>


        {selectedIntegrationId ? (
          <IntegrationDrawer
            row={
              selectedIntegration
            }
            loading={
              loading
            }
            timezone={
              timezone
            }
            onClose={() =>
              applyLocation(
                activeView,
                "",
                {
                  replace:
                    true,
                },
              )
            }
          />
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function ServiceCard({
  icon: Icon,
  title,
  subtitle,
  row,
  fallback,
  fixedStatus,
  details,
}) {
  const status =
    fixedStatus ||
    (
      row
        ? statusMeta(
            row,
          )
        : {
            label:
              fallback,

            tone:
              "neutral",
          }
    );

  return (
    <article
      className={
        styles.serviceCard
      }
    >
      <header>
        <span>
          <Icon
            size={19}
          />
        </span>

        <em
          data-tone={
            status.tone
          }
        >
          {status.label}
        </em>
      </header>

      <strong>
        {title}
      </strong>

      <small>
        {subtitle}
      </small>

      <p>
        {details}
      </p>
    </article>
  );
}


function ConnectionTable({
  integrations,
  timezone,
  selectedIntegrationId,
  onSelect,
  title,
  subtitle,
}) {
  return (
    <section
      className={
        styles.tablePanel
      }
    >
      <header
        className={
          styles.tableHeader
        }
      >
        <div>
          <h2>
            {title}
          </h2>

          <p>
            {subtitle}
          </p>
        </div>
      </header>

      {!integrations.length ? (
        <div
          className={
            styles.tableEmpty
          }
        >
          <Link2
            size={27}
          />

          <strong>
            No integration records yet
          </strong>

          <span>
            Live provider connection metadata will appear here
            when a workspace integration is recorded.
          </span>
        </div>
      ) : (
        <>
          <div
            className={
              styles.connectionHeading
            }
          >
            <span>
              Connection
            </span>

            <span>
              Account
            </span>

            <span>
              Status
            </span>

            <span>
              Last success
            </span>

            <span>
              Updated
            </span>
          </div>

          <div
            className={
              styles.connectionTable
            }
          >
            {integrations.map(
              (row) => {
                const status =
                  statusMeta(
                    row,
                  );

                return (
                  <article
                    key={
                      row.id
                    }
                    role="button"
                    tabIndex={0}
                    className={
                      selectedIntegrationId ===
                      row.id
                        ? styles.rowSelected
                        : styles.clickableRow
                    }
                    onClick={() =>
                      onSelect(
                        row,
                      )
                    }
                    onKeyDown={(
                      event,
                    ) => {
                      if (
                        event.key ===
                          "Enter" ||
                        event.key ===
                          " "
                      ) {
                        event.preventDefault();

                        onSelect(
                          row,
                        );
                      }
                    }}
                  >
                    <div
                      className={
                        styles.connectionCell
                      }
                    >
                      <span>
                        <Link2
                          size={16}
                        />
                      </span>

                      <div>
                        <strong>
                          {humanize(
                            row.integration_type,
                          )}
                        </strong>

                        <small>
                          {humanize(
                            row.provider,
                          )}
                        </small>
                      </div>
                    </div>

                    <span>
                      {accountProvider(
                        row,
                      )}
                      {row.display_email
                        ? ` · ${row.display_email}`
                        : ""}
                    </span>

                    <em
                      data-tone={
                        status.tone
                      }
                    >
                      {status.label}
                    </em>

                    <span>
                      {formatDateTime(
                        row.last_success_at,
                        timezone,
                        "—",
                      )}
                    </span>

                    <span>
                      {formatDateTime(
                        row.updated_at,
                        timezone,
                        "—",
                      )}
                    </span>
                  </article>
                );
              },
            )}
          </div>
        </>
      )}
    </section>
  );
}


function AiPanel({
  aiSettings,
  timezone,
}) {
  const enabled =
    aiSettings?.enabled ===
    true;

  return (
    <section
      className={
        styles.aiPanel
      }
    >
      <header>
        <span>
          <Bot
            size={21}
          />
        </span>

        <div>
          <h2>
            AI gateway configuration
          </h2>

          <p>
            Workspace AI preferences are not the same thing as
            connected provider credentials.
          </p>
        </div>
      </header>

      <div
        className={
          styles.aiSettingsGrid
        }
      >
        <article>
          <small>
            Gateway
          </small>

          <strong>
            {enabled
              ? "Enabled"
              : "Disabled"}
          </strong>
        </article>

        <article>
          <small>
            Preferred provider
          </small>

          <strong>
            {humanize(
              aiSettings
                ?.preferred_provider ||
              "auto",
            )}
          </strong>
        </article>

        <article>
          <small>
            Preferred model
          </small>

          <strong>
            {aiSettings
              ?.preferred_model ||
              "Not configured"}
          </strong>
        </article>

        <article>
          <small>
            Write actions
          </small>

          <strong>
            {aiSettings
              ?.allow_write_actions
              ? "Allowed"
              : "Disabled"}
          </strong>
        </article>

        <article>
          <small>
            Human approval
          </small>

          <strong>
            {aiSettings
              ?.require_human_approval
              ? "Required"
              : "Not required"}
          </strong>
        </article>

        <article>
          <small>
            Source citations
          </small>

          <strong>
            {aiSettings
              ?.require_source_citations
              ? "Required"
              : "Not required"}
          </strong>
        </article>
      </div>

      <div
        className={
          styles.aiNotice
        }
      >
        <Sparkles
          size={18}
        />

        <div>
          <strong>
            Provider-neutral foundation
          </strong>

          <p>
            OpenAI, Anthropic, and Gemini may be represented in
            workspace preference data. V78 does not claim any AI
            provider credential or gateway is connected unless the
            backend actually reports one.
          </p>

          {aiSettings?.updated_at ? (
            <small>
              Settings updated{" "}
              {formatDateTime(
                aiSettings.updated_at,
                timezone,
              )}
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}


function ReadinessPanel({
  stepsByKey,
  files,
  storageBytes,
  timezone,
}) {
  const steps = [
    [
      "communications",
      "Communications",
      Mail,
    ],

    [
      "calendar",
      "Calendar",
      CalendarDays,
    ],

    [
      "files",
      "Files",
      Files,
    ],

    [
      "texting",
      "Texting",
      MessageSquareText,
    ],
  ];

  return (
    <section
      className={
        styles.readinessPanel
      }
    >
      <header>
        <span>
          <CheckCircle2
            size={21}
          />
        </span>

        <div>
          <h2>
            Workspace readiness
          </h2>

          <p>
            Core setup state feeding Campaign Seat platform services.
          </p>
        </div>
      </header>

      <div
        className={
          styles.readinessGrid
        }
      >
        {steps.map(
          ([
            key,
            label,
            Icon,
          ]) => {
            const step =
              stepsByKey[key];

            const complete =
              step?.status ===
              "complete";

            return (
              <article
                key={key}
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
                    {humanize(
                      step?.status ||
                      "not started",
                    )}
                  </strong>

                  <em>
                    {step?.completed_at
                      ? `Completed ${formatDateTime(
                          step.completed_at,
                          timezone,
                        )}`
                      : "Workspace setup state"}
                  </em>
                </div>

                <i
                  data-complete={
                    complete
                      ? "true"
                      : "false"
                  }
                >
                  {complete
                    ? "Ready"
                    : "Open"}
                </i>
              </article>
            );
          },
        )}
      </div>

      <div
        className={
          styles.storageSummary
        }
      >
        <Files
          size={19}
        />

        <div>
          <strong>
            Secure Campaign Seat file storage
          </strong>

          <p>
            {files.length} stored file{
              files.length ===
              1
                ? ""
                : "s"
            }
            {" · "}
            {formatBytes(
              storageBytes,
            )}
          </p>
        </div>
      </div>
    </section>
  );
}


function IntegrationDrawer({
  row,
  loading,
  timezone,
  onClose,
}) {
  const status =
    row
      ? statusMeta(
          row,
        )
      : null;

  const capabilities =
    row &&
    row.capabilities &&
    typeof row.capabilities ===
      "object"
      ? Object.entries(
          row.capabilities,
        ).filter(
          (
            [
              ,
              enabled,
            ],
          ) =>
            enabled ===
            true,
        )
      : [];

  return (
    <div
      className={
        styles.detailScrim
      }
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className={
          styles.detailDrawer
        }
        aria-label="Integration connection details"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Integration record
            </span>

            <h2>
              {row
                ? humanize(
                    row.integration_type,
                  )
                : loading
                  ? "Loading connection…"
                  : "Connection unavailable"}
            </h2>

            {row ? (
              <p>
                {humanize(
                  row.provider,
                )}
                {" · "}
                {accountProvider(
                  row,
                )}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close integration details"
            onClick={
              onClose
            }
          >
            <X
              size={19}
            />
          </button>
        </header>


        {!row ? (
          <div
            className={
              styles.detailBody
            }
          >
            <div
              className={
                styles.detailEmpty
              }
            >
              <Link2
                size={30}
              />

              <strong>
                {loading
                  ? "Loading connection"
                  : "Connection not found"}
              </strong>
            </div>
          </div>
        ) : (
          <div
            className={
              styles.detailBody
            }
          >
            <section
              className={
                styles.detailHero
              }
            >
              <span
                className={
                  styles.detailStatus
                }
                data-tone={
                  status.tone
                }
              >
                {status.tone ===
                "warning" ? (
                  <AlertTriangle
                    size={14}
                  />
                ) : (
                  <CheckCircle2
                    size={14}
                  />
                )}

                {status.label}
              </span>

              <strong>
                {humanize(
                  row.provider,
                )}
              </strong>

              <p>
                {humanize(
                  row.integration_type,
                )}
              </p>
            </section>


            <section
              className={
                styles.detailGrid
              }
            >
              <div>
                <small>
                  Account provider
                </small>

                <strong>
                  {accountProvider(
                    row,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Display email
                </small>

                <strong>
                  {row.display_email ||
                    "Not recorded"}
                </strong>
              </div>

              <div>
                <small>
                  Connected
                </small>

                <strong>
                  {formatDateTime(
                    row.connected_at,
                    timezone,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Last success
                </small>

                <strong>
                  {formatDateTime(
                    row.last_success_at,
                    timezone,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Last sync
                </small>

                <strong>
                  {formatDateTime(
                    row.last_sync_at,
                    timezone,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Updated
                </small>

                <strong>
                  {formatDateTime(
                    row.updated_at,
                    timezone,
                  )}
                </strong>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <ShieldCheck
                  size={19}
                />

                <div>
                  <h3>
                    Capabilities
                  </h3>

                  {capabilities.length ? (
                    <div
                      className={
                        styles.capabilityPills
                      }
                    >
                      {capabilities.map(
                        (
                          [
                            key,
                          ],
                        ) => (
                          <span
                            key={
                              key
                            }
                          >
                            {humanize(
                              key,
                            )}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    <p>
                      No enabled capabilities were recorded.
                    </p>
                  )}
                </div>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <Clock3
                  size={19}
                />

                <div>
                  <h3>
                    Provider health
                  </h3>

                  <p>
                    {row.last_error_summary
                      ? row.last_error_summary
                      : "No current provider error is recorded."}
                  </p>

                  {row.last_error_code ? (
                    <small>
                      Error code:{" "}
                      {row.last_error_code}
                    </small>
                  ) : null}
                </div>
              </div>
            </section>


            <section
              className={
                styles.detailSection
              }
            >
              <div>
                <ShieldCheck
                  size={19}
                />

                <div>
                  <h3>
                    Credential privacy
                  </h3>

                  <p>
                    This drawer intentionally shows connection
                    metadata only. Passwords, refresh tokens,
                    API keys, and provider secrets are not exposed.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
