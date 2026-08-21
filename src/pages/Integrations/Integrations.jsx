import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Files,
  Link2,
  Mail,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  SeatPage,
  SeatPageSection,
} from "../../components/SeatPage/SeatPage";

import {
  supabase,
} from "../../lib/supabase";

import {
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./Integrations.module.css";

const ATTENTION_STATUSES = new Set([
  "degraded",
  "reauthorization_required",
  "error",
]);

const PENDING_STATUSES = new Set([
  "connecting",
  "pending_verification",
]);

const STATUS_LABELS = {
  connected: "Connected",
  connecting: "Connecting",
  degraded: "Needs attention",
  reauthorization_required:
    "Reconnect required",
  pending_verification:
    "Pending verification",
  disconnected: "Disconnected",
  error: "Error",
  not_connected: "Not connected",
};

function statusForRow(
  row,
  fallbackLabel,
  fallbackTone = "neutral",
) {
  if (!row) {
    return {
      label: fallbackLabel,
      tone: fallbackTone,
    };
  }

  if (row.status === "connected") {
    return {
      label: "Connected",
      tone: "good",
    };
  }

  if (
    ATTENTION_STATUSES.has(
      row.status,
    )
  ) {
    return {
      label:
        STATUS_LABELS[
          row.status
        ] || "Needs attention",
      tone: "warning",
    };
  }

  if (
    PENDING_STATUSES.has(
      row.status,
    )
  ) {
    return {
      label:
        STATUS_LABELS[
          row.status
        ] || "In progress",
      tone: "pending",
    };
  }

  return {
    label:
      STATUS_LABELS[
        row.status
      ] || fallbackLabel,
    tone: "neutral",
  };
}

function newestIntegration(
  rows,
  integrationType,
  provider = null,
) {
  return (
    rows.find(
      (row) =>
        row.integration_type ===
          integrationType &&
        (
          !provider ||
          row.provider === provider
        ),
    ) ||
    null
  );
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function formatBytes(value) {
  const bytes =
    Number(value || 0);

  if (
    !Number.isFinite(bytes) ||
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
      units.length - 1,
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

function humanize(value) {
  if (!value) {
    return "Not configured";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function IntegrationCard({
  icon: Icon,
  title,
  provider,
  status,
  description,
  details = [],
  actionLabel,
  onAction,
  actionDisabled = false,
}) {
  return (
    <article
      className={
        styles.integrationCard
      }
    >
      <div
        className={
          styles.cardTop
        }
      >
        <span
          className={
            styles.integrationIcon
          }
        >
          <Icon size={21} />
        </span>

        <span
          className={
            styles.status
          }
          data-tone={
            status.tone
          }
        >
          {status.label}
        </span>
      </div>

      <div
        className={
          styles.cardHeading
        }
      >
        <strong>{title}</strong>
        <span>{provider}</span>
      </div>

      <p>{description}</p>

      {details.length ? (
        <div
          className={
            styles.cardDetails
          }
        >
          {details.map(
            (detail) => (
              <span
                key={detail}
              >
                {detail}
              </span>
            ),
          )}
        </div>
      ) : null}

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          disabled={
            actionDisabled
          }
        >
          {actionLabel}
        </button>
      ) : null}
    </article>
  );
}

export default function Integrations() {
  const navigate =
    useNavigate();

  const workspace =
    getCurrentWorkspace();

  const workspaceId =
    workspace?.id || "";

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

  const loadIntegrations =
    useCallback(
      async () => {
        if (!workspaceId) {
          setError(
            "An active Campaign Seat workspace is required.",
          );
          setLoading(false);
          return;
        }

        setLoading(true);
        setError("");

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
                    ascending: false,
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

          if (aiResult.error) {
            throw aiResult.error;
          }

          if (filesResult.error) {
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

          setLastUpdated(
            new Date(),
          );
        } catch (
          loadError
        ) {
          setError(
            loadError?.message ||
              "Integration status could not be loaded.",
          );
        } finally {
          setLoading(false);
        }
      },
      [workspaceId],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadIntegrations();
        },
        0,
      );

    return () =>
      window.clearTimeout(
        timeoutId,
      );
  }, [loadIntegrations]);

  const emailIntegration =
    newestIntegration(
      integrations,
      "email",
      "nylas",
    );

  const contactsIntegration =
    newestIntegration(
      integrations,
      "contacts",
      "nylas",
    );

  const calendarIntegration =
    newestIntegration(
      integrations,
      "calendar",
      "nylas",
    );

  const smsIntegration =
    newestIntegration(
      integrations,
      "sms",
      "twilio",
    );

  const whatsappIntegration =
    newestIntegration(
      integrations,
      "whatsapp",
      "twilio",
    );

  const emailStatus =
    statusForRow(
      emailIntegration,
      "Ready to connect",
      "foundation",
    );

  const calendarStatus =
    statusForRow(
      calendarIntegration,
      "Ready to connect",
      "foundation",
    );

  const smsStatus =
    statusForRow(
      smsIntegration,
      "Platform ready",
      "foundation",
    );

  const whatsappStatus =
    statusForRow(
      whatsappIntegration,
      "External handoff",
      "neutral",
    );

  const connectedCount =
    integrations.filter(
      (row) =>
        row.status ===
        "connected",
    ).length;

  const attentionCount =
    integrations.filter(
      (row) =>
        ATTENTION_STATUSES.has(
          row.status,
        ),
    ).length;

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
      [files],
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
      [onboardingSteps],
    );

  const aiPreferred =
    aiSettings
      ?.preferred_provider ||
    "auto";

  const aiEnabled =
    aiSettings?.enabled ===
    true;

  const aiStatus = {
    label:
      aiEnabled
        ? "Workspace enabled"
        : "Foundation ready",
    tone:
      aiEnabled
        ? "pending"
        : "foundation",
  };

  const refreshAction = (
    <button
      className={
        styles.refreshButton
      }
      type="button"
      onClick={() =>
        void loadIntegrations()
      }
      disabled={loading}
    >
      <RefreshCw
        size={16}
        className={
          loading
            ? styles.spinning
            : ""
        }
      />
      Refresh status
    </button>
  );

  return (
    <CampaignWorkspaceShell
      activeItem="Integrations"
    >
      <SeatPage
        eyebrow="Seat Core"
        title="Integrations Center"
        description="See what Campaign Seat is connected to, what needs attention and what is ready to configure."
        loading={loading}
        error={error}
        actions={
          refreshAction
        }
      >
        <div
          className={
            styles.securityNotice
          }
        >
          <ShieldCheck
            size={19}
          />

          <div>
            <strong>
              Connection metadata
              only.
            </strong>

            <span>
              Provider passwords,
              refresh tokens and API
              secrets are never shown
              in Campaign Seat.
              Credentials remain in
              protected server-side
              storage.
            </span>
          </div>
        </div>

        <div
          className={
            styles.summaryGrid
          }
        >
          <article>
            <CheckCircle2
              size={19}
            />
            <span>
              Connected records
            </span>
            <strong>
              {connectedCount}
            </strong>
          </article>

          <article>
            <AlertTriangle
              size={19}
            />
            <span>
              Needs attention
            </span>
            <strong>
              {attentionCount}
            </strong>
          </article>

          <article>
            <Files size={19} />
            <span>
              Stored files
            </span>
            <strong>
              {files.length}
            </strong>
            <small>
              {formatBytes(
                storageBytes,
              )}
            </small>
          </article>

          <article>
            <Bot size={19} />
            <span>
              AI preference
            </span>
            <strong>
              {humanize(
                aiPreferred,
              )}
            </strong>
            <small>
              {aiEnabled
                ? "Workspace enabled"
                : "Not enabled yet"}
            </small>
          </article>
        </div>

        <SeatPageSection
          title="Communication & productivity"
          description="Live provider connections and Campaign Seat platform services."
        >
          <div
            className={
              styles.integrationGrid
            }
          >
            <IntegrationCard
              icon={Mail}
              title="Campaign email"
              provider="Nylas · Google / Microsoft"
              status={
                emailStatus
              }
              description="Campaign mailbox sending, receiving and provider-backed contacts."
              details={[
                emailIntegration
                  ?.display_email ||
                  "No campaign mailbox recorded",
                contactsIntegration
                  ?.status ===
                  "connected"
                  ? "Provider contacts connected"
                  : "Contacts follow the mailbox connection",
                emailIntegration
                  ?.last_success_at
                  ? `Last success ${formatDateTime(
                      emailIntegration.last_success_at,
                    )}`
                  : "",
                emailIntegration
                  ?.last_error_summary ||
                  "",
              ].filter(Boolean)}
              actionLabel="Manage email"
              onAction={() =>
                navigate(
                  "/workspace/settings?tab=integrations",
                )
              }
            />

            <IntegrationCard
              icon={CalendarDays}
              title="Campaign calendar"
              provider="Nylas Calendar"
              status={
                calendarStatus
              }
              description="Provider calendar sync, event creation, updates, cancellation and availability."
              details={[
                calendarIntegration
                  ?.display_email ||
                  "No connected calendar recorded",
                calendarIntegration
                  ?.last_sync_at
                  ? `Last sync ${formatDateTime(
                      calendarIntegration.last_sync_at,
                    )}`
                  : "",
                calendarIntegration
                  ?.last_error_summary ||
                  "",
              ].filter(Boolean)}
              actionLabel="Open Calendar"
              onAction={() =>
                navigate(
                  "/calendar",
                )
              }
            />

            <IntegrationCard
              icon={Files}
              title="Campaign files"
              provider="Campaign Seat secure storage"
              status={{
                label: "Active",
                tone: "good",
              }}
              description="Private workspace file storage used by Documents, Tasks, communications and Inventory."
              details={[
                `${files.length} stored file${
                  files.length === 1
                    ? ""
                    : "s"
                }`,
                formatBytes(
                  storageBytes,
                ),
                stepsByKey.files
                  ?.status
                  ? `Setup: ${humanize(
                      stepsByKey.files.status,
                    )}`
                  : "",
              ].filter(Boolean)}
              actionLabel="Open Files"
              onAction={() =>
                navigate(
                  "/files",
                )
              }
            />

            <IntegrationCard
              icon={
                MessageSquareText
              }
              title="Campaign texting"
              provider="Twilio"
              status={smsStatus}
              description="Campaign Seat has the SMS platform runtime in place. Workspace connection metadata appears here when texting is configured."
              details={[
                smsIntegration
                  ?.display_name ||
                  "No workspace SMS connection recorded",
                smsIntegration
                  ?.last_success_at
                  ? `Last success ${formatDateTime(
                      smsIntegration.last_success_at,
                    )}`
                  : "",
                smsIntegration
                  ?.last_error_summary ||
                  "",
              ].filter(Boolean)}
              actionLabel="View usage"
              onAction={() =>
                navigate(
                  "/workspace/usage",
                )
              }
            />

            <IntegrationCard
              icon={
                MessageCircle
              }
              title="WhatsApp"
              provider="WhatsApp handoff"
              status={
                whatsappStatus
              }
              description="WhatsApp currently opens as an external handoff with Campaign Seat history and human confirmation."
              details={[
                whatsappIntegration
                  ?.display_name ||
                  "Native WhatsApp Business delivery is not connected",
                "Campaign Seat does not label external handoffs as provider-sent messages",
              ].filter(Boolean)}
              actionLabel="Open Inbox"
              onAction={() =>
                navigate(
                  "/inbox",
                )
              }
            />
          </div>
        </SeatPageSection>

        <SeatPageSection
          title="AI providers"
          description="Campaign Seat has a provider-neutral AI foundation. Provider credentials and the AI gateway are the next connection layer."
        >
          <div
            className={
              styles.aiIntro
            }
          >
            <Sparkles
              size={18}
            />

            <div>
              <strong>
                Ask Campaign HQ is
                being built as one
                assistant.
              </strong>

              <span>
                OpenAI, Claude and
                Gemini will sit behind
                one Campaign Seat
                gateway with fallback,
                metering and human
                approval rather than
                separate provider
                buttons.
              </span>
            </div>
          </div>

          <div
            className={
              styles.aiGrid
            }
          >
            <IntegrationCard
              icon={Bot}
              title="OpenAI"
              provider="AI provider"
              status={aiStatus}
              description="Provider support exists in the Seat Core data model; the server-side gateway and credential are not connected yet."
              details={[
                aiPreferred ===
                "openai"
                  ? "Preferred provider"
                  : "Available as future provider",
                aiSettings
                  ?.preferred_model
                  ? `Preferred model: ${aiSettings.preferred_model}`
                  : "",
              ].filter(Boolean)}
              actionLabel="Gateway next"
              actionDisabled
            />

            <IntegrationCard
              icon={Sparkles}
              title="Claude"
              provider="Anthropic"
              status={aiStatus}
              description="Anthropic is included in the provider-neutral AI settings and fallback model."
              details={[
                aiPreferred ===
                "anthropic"
                  ? "Preferred provider"
                  : "Available as future provider",
              ]}
              actionLabel="Gateway next"
              actionDisabled
            />

            <IntegrationCard
              icon={Link2}
              title="Gemini"
              provider="Google AI"
              status={aiStatus}
              description="Gemini is included in Campaign Seat's provider-neutral AI foundation and fallback model."
              details={[
                aiPreferred ===
                "gemini"
                  ? "Preferred provider"
                  : "Available as future provider",
              ]}
              actionLabel="Gateway next"
              actionDisabled
            />
          </div>
        </SeatPageSection>

        <SeatPageSection
          title="Workspace readiness"
          description="Setup state for the core services that feed Campaign Seat."
        >
          <div
            className={
              styles.readinessGrid
            }
          >
            {[
              [
                "communications",
                "Communications",
              ],
              [
                "calendar",
                "Calendar",
              ],
              [
                "files",
                "Files",
              ],
              [
                "texting",
                "Texting",
              ],
            ].map(
              ([
                key,
                label,
              ]) => {
                const step =
                  stepsByKey[key];

                return (
                  <article
                    key={key}
                  >
                    <span>
                      {label}
                    </span>

                    <strong>
                      {humanize(
                        step?.status ||
                          "not started",
                      )}
                    </strong>

                    <small>
                      {step
                        ?.completed_at
                        ? `Completed ${formatDateTime(
                            step.completed_at,
                          )}`
                        : "Workspace setup state"}
                    </small>
                  </article>
                );
              },
            )}
          </div>
        </SeatPageSection>

        <p
          className={
            styles.updated
          }
        >
          {lastUpdated
            ? `Last refreshed ${formatDateTime(
                lastUpdated,
              )}`
            : ""}
        </p>
      </SeatPage>
    </CampaignWorkspaceShell>
  );
}
