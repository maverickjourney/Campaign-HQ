
import {
  Bot,
  CalendarClock,
  CircleDollarSign,
  HardDrive,
  Mail,
  MessageCircle,
  MessageSquareText,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
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

import styles from "./PlanUsageCommandCenter.module.css";


const USAGE_VIEWS =
  new Set([
    "overview",
    "consumption",
    "subscription",
    "ai",
  ]);


function numberValue(value) {
  const parsed =
    Number(
      value ||
      0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-US",
  ).format(
    numberValue(
      value,
    ),
  );
}


function formatBytes(value) {
  const bytes =
    numberValue(
      value,
    );

  if (
    bytes <=
    0
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
        Math.log(
          bytes,
        ) /
          Math.log(
            1024,
          ),
      ),
      units.length -
        1,
    );

  const amount =
    bytes /
    1024 ** index;

  return `${
    amount >=
      10 ||
    index ===
      0
      ? amount.toFixed(
          0,
        )
      : amount.toFixed(
          1,
        )
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


function formatDate(
  value,
  timezone,
  fallback = "Not scheduled",
) {
  const date =
    safeDate(
      value,
    );

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

      timeZone:
        timezone ||
        "America/New_York",
    },
  ).format(
    date,
  );
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
  ).format(
    date,
  );
}


function humanize(value) {
  if (!value) {
    return "Not available";
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


function readUsageLocation() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      view:
        "overview",

      metricKey:
        "",
    };
  }

  const url =
    new URL(
      window.location.href,
    );

  const requestedView =
    url.searchParams.get(
      "usage-view",
    );

  return {
    view:
      USAGE_VIEWS.has(
        requestedView,
      )
        ? requestedView
        : "overview",

    metricKey:
      url.searchParams.get(
        "usage-metric",
      ) ||
      "",
  };
}


export default function PlanUsageCommandCenter() {
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
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    subscription,
    setSubscription,
  ] = useState(null);

  const [
    activeSeatCount,
    setActiveSeatCount,
  ] = useState(0);

  const [
    inventoryItemCount,
    setInventoryItemCount,
  ] = useState(0);

  const [
    files,
    setFiles,
  ] = useState([]);

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
        readUsageLocation()
          .view,
    );

  const [
    selectedMetricKey,
    setSelectedMetricKey,
  ] =
    useState(
      () =>
        readUsageLocation()
          .metricKey,
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
          setLoading(
            true,
          );
        }

        try {
          const [
            summaryResult,
            subscriptionResult,
            memberResult,
            inventoryResult,
            filesResult,
          ] =
            await Promise.all([
              supabase.rpc(
                "get_campaign_usage_summary",
                {
                  target_workspace_id:
                    workspaceId,
                },
              ),

              supabase
                .from(
                  "workspace_subscriptions",
                )
                .select(
                  [
                    "workspace_id",
                    "plan_key",
                    "status",
                    "command_seat_limit",
                    "staff_seat_limit",
                    "volunteer_account_limit",
                    "reviewer_account_limit",
                    "starts_at",
                    "renews_at",
                    "trial_ends_at",
                    "entitlement_overrides",
                    "metadata",
                  ].join(","),
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .maybeSingle(),

              supabase
                .from(
                  "workspace_members",
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  },
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "status",
                  "active",
                )
                .eq(
                  "membership_state",
                  "active",
                ),

              supabase
                .from(
                  "workspace_inventory_items",
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  },
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .eq(
                  "status",
                  "active",
                ),

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
            summaryResult.error
          ) {
            throw summaryResult.error;
          }

          setSummary(
            summaryResult.data ||
              {},
          );

          if (
            subscriptionResult.error
          ) {
            setSubscription(
              null,
            );
          } else {
            setSubscription(
              subscriptionResult.data ||
                null,
            );
          }

          if (
            !memberResult.error
          ) {
            setActiveSeatCount(
              memberResult.count ||
                0,
            );
          }

          if (
            !inventoryResult.error
          ) {
            setInventoryItemCount(
              inventoryResult.count ||
                0,
            );
          }

          if (
            !filesResult.error
          ) {
            setFiles(
              filesResult.data ||
                [],
            );
          }

          setError("");

          setLastUpdated(
            new Date(),
          );

          setLoading(
            false,
          );

          return true;
        } catch (
          loadError
        ) {
          console.error(
            "[Plan & Usage] workspace load failed",
            loadError,
          );

          setError(
            loadError?.message ||
            "Plan and usage information could not be loaded.",
          );

          setLoading(
            false,
          );

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
      nextMetricKey = "",
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "usage-view",
        nextView,
      );

      if (
        nextMetricKey
      ) {
        url.searchParams.set(
          "usage-metric",
          nextMetricKey,
        );
      } else {
        url.searchParams.delete(
          "usage-metric",
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

      setSelectedMetricKey(
        nextMetricKey,
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          const next =
            readUsageLocation();

          setActiveView(
            next.view,
          );

          setSelectedMetricKey(
            next.metricKey,
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


  const usage =
    summary?.usage ||
    {};

  const plan =
    summary?.plan ||
    {};

  const canViewBilling =
    Boolean(
      subscription,
    );

  const planName =
    canViewBilling
      ? (
          plan.display_name ||
          humanize(
            subscription
              ?.plan_key,
          )
        )
      : "Billing restricted";

  const planStatus =
    canViewBilling
      ? subscription?.status ||
        "active"
      : "";

  const storageBytes =
    useMemo(
      () =>
        files.reduce(
          (
            total,
            file,
          ) =>
            total +
            numberValue(
              file.size_bytes,
            ),
          0,
        ),
      [
        files,
      ],
    );

  const usageMetricCount =
    Object.keys(
      usage,
    ).length;

  const commercialPricingFinalized =
    plan?.metadata
      ?.commercial_pricing_finalized ===
    true;

  const trialEnded =
    subscription?.status ===
      "trial" &&
    safeDate(
      subscription
        ?.trial_ends_at,
    ) &&
    safeDate(
      subscription
        ?.trial_ends_at,
    ).getTime() <
      Date.now();


  const limitFor =
    (key) => {
      if (
        !canViewBilling ||
        plan?.[key] ===
          undefined ||
        plan?.[key] ===
          null
      ) {
        return null;
      }

      return numberValue(
        plan[key],
      );
    };


  const metrics = [
    {
      key:
        "ai_credit",

      label:
        "AI credits",

      icon:
        Bot,

      used:
        numberValue(
          usage.ai_credit,
        ),

      limit:
        limitFor(
          "ai_credit_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_usage_ledger",
    },

    {
      key:
        "sms_message",

      label:
        "SMS messages",

      icon:
        MessageSquareText,

      used:
        numberValue(
          usage.sms_message,
        ),

      limit:
        limitFor(
          "sms_message_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_usage_ledger",
    },

    {
      key:
        "whatsapp_message",

      label:
        "WhatsApp",

      icon:
        MessageCircle,

      used:
        numberValue(
          usage.whatsapp_message,
        ),

      limit:
        limitFor(
          "whatsapp_message_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_usage_ledger",
    },

    {
      key:
        "email_send",

      label:
        "Email sends",

      icon:
        Mail,

      used:
        numberValue(
          usage.email_send,
        ),

      limit:
        limitFor(
          "email_send_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_usage_ledger",
    },

    {
      key:
        "storage",

      label:
        "Storage",

      icon:
        HardDrive,

      used:
        storageBytes,

      limit:
        limitFor(
          "storage_bytes_limit",
        ),

      formatter:
        formatBytes,

      source:
        "campaign_files",
    },

    {
      key:
        "team",

      label:
        "Team seats",

      icon:
        Users,

      used:
        activeSeatCount,

      limit:
        limitFor(
          "member_seat_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_members",
    },

    {
      key:
        "inventory",

      label:
        "Inventory items",

      icon:
        PackageOpen,

      used:
        inventoryItemCount,

      limit:
        limitFor(
          "inventory_item_limit",
        ),

      formatter:
        formatNumber,

      source:
        "workspace_inventory_items",
    },
  ];


  const selectedMetric =
    selectedMetricKey
      ? metrics.find(
          (metric) =>
            metric.key ===
            selectedMetricKey,
        ) ||
        null
      : null;


  return (
    <CampaignWorkspaceShell
      activeItem="Plan & Usage"
    >
      <main
        className={
          styles.main
        }
        data-plan-usage-command-center="true"
        data-plan-usage-live-storage="true"
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
                Workspace capacity &amp; metering
              </span>

              <h1>
                Plan &amp; Usage Command Center
              </h1>

              <p>
                Review the workspace subscription, live capacity,
                file storage, and metered Campaign Seat activity
                without inventing commercial limits or provider usage.
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
                      ? "Live plan and usage data refreshed."
                      : "Unable to refresh plan and usage data.",
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
              <CheckCircleIcon />
            )}

            <span>
              {error
                ? error
                : loading
                  ? "Loading live Plan & Usage sources…"
                  : "Live Campaign Seat Plan & Usage sources connected"}
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
              <Sparkles
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
            aria-label="Plan and Usage summary"
          >
            <button
              type="button"
              className={
                activeView ===
                "subscription"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "subscription",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <WalletCards
                  size={22}
                />
              </span>

              <span>
                <small>
                  Current plan
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  {planName}
                </strong>

                <em>
                  {canViewBilling
                    ? humanize(
                        planStatus,
                      )
                    : "Billing details restricted"}
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyLocation(
                  "consumption",
                  "team",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Users
                  size={22}
                />
              </span>

              <span>
                <small>
                  Active team
                </small>

                <strong>
                  {formatNumber(
                    activeSeatCount,
                  )}
                </strong>

                <em>
                  Active workspace members
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyLocation(
                  "consumption",
                  "storage",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <HardDrive
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
                "consumption"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                applyLocation(
                  "consumption",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <CircleDollarSign
                  size={22}
                />
              </span>

              <span>
                <small>
                  Metered categories
                </small>

                <strong>
                  {usageMetricCount}
                </strong>

                <em>
                  Usage ledger categories this period
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
                aria-label="Plan and Usage views"
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
                    "consumption"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "consumption",
                    )
                  }
                >
                  Consumption
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "subscription"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyLocation(
                      "subscription",
                    )
                  }
                >
                  Subscription
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
                  AI metering
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <>
                  <section
                    className={
                      styles.nextCard
                    }
                  >
                    <header>
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        <CalendarClock
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          Active usage period
                        </h2>

                        <p>
                          Period reported by the existing
                          Campaign Seat usage-summary service.
                        </p>
                      </div>
                    </header>

                    <div
                      className={
                        styles.periodCard
                      }
                    >
                      <div>
                        <small>
                          Starts
                        </small>

                        <strong>
                          {formatDate(
                            summary
                              ?.period_start,
                            timezone,
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Ends
                        </small>

                        <strong>
                          {formatDate(
                            summary
                              ?.period_end,
                            timezone,
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Recorded usage categories
                        </small>

                        <strong>
                          {usageMetricCount}
                        </strong>
                      </div>
                    </div>
                  </section>


                  <section
                    className={
                      styles.serviceGrid
                    }
                  >
                    <ServiceSummary
                      icon={
                        HardDrive
                      }
                      label="Storage"
                      value={
                        formatBytes(
                          storageBytes,
                        )
                      }
                      detail={`${files.length} stored file${
                        files.length ===
                          1
                          ? ""
                          : "s"
                      }`}
                    />

                    <ServiceSummary
                      icon={
                        Users
                      }
                      label="Team"
                      value={
                        formatNumber(
                          activeSeatCount,
                        )
                      }
                      detail="Active workspace members"
                    />

                    <ServiceSummary
                      icon={
                        PackageOpen
                      }
                      label="Inventory"
                      value={
                        formatNumber(
                          inventoryItemCount,
                        )
                      }
                      detail="Active inventory items"
                    />

                    <ServiceSummary
                      icon={
                        Bot
                      }
                      label="AI credits"
                      value={
                        formatNumber(
                          usage.ai_credit,
                        )
                      }
                      detail="Metered credits this period"
                    />
                  </section>
                </>
              ) : null}


              {activeView ===
              "consumption" ? (
                <UsagePanel
                  metrics={
                    metrics
                  }
                  onSelect={(
                    metric,
                  ) =>
                    applyLocation(
                      "consumption",
                      metric.key,
                    )
                  }
                />
              ) : null}


              {activeView ===
              "subscription" ? (
                <SubscriptionPanel
                  subscription={
                    subscription
                  }
                  canViewBilling={
                    canViewBilling
                  }
                  planName={
                    planName
                  }
                  planStatus={
                    planStatus
                  }
                  commercialPricingFinalized={
                    commercialPricingFinalized
                  }
                  timezone={
                    timezone
                  }
                />
              ) : null}


              {activeView ===
              "ai" ? (
                <AiMeterPanel
                  usage={
                    usage
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
                      Plan and metering conditions worth reviewing.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "subscription",
                    )
                  }
                >
                  <div>
                    <strong>
                      {trialEnded
                        ? "Trial end date has passed"
                        : "Trial date status"}
                    </strong>

                    <span>
                      {subscription
                        ?.trial_ends_at
                        ? `Recorded trial end: ${formatDate(
                            subscription.trial_ends_at,
                            timezone,
                          )}`
                        : "No trial end date recorded"}
                    </span>
                  </div>

                  <em>
                    {trialEnded
                      ? 1
                      : 0}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "subscription",
                    )
                  }
                >
                  <div>
                    <strong>
                      {commercialPricingFinalized
                        ? "Commercial limits published"
                        : "Plan limits not finalized"}
                    </strong>

                    <span>
                      Campaign Seat will not invent commercial allowances.
                    </span>
                  </div>

                  <em>
                    {commercialPricingFinalized
                      ? 0
                      : 1}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyLocation(
                      "consumption",
                    )
                  }
                >
                  <div>
                    <strong>
                      {usageMetricCount} metered categories
                    </strong>

                    <span>
                      Categories with recorded usage this period
                    </span>
                  </div>

                  <em>
                    {usageMetricCount}
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
                  <Sparkles
                    size={16}
                  />
                  View integrations
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
                    Billing visibility follows workspace access
                  </strong>

                  <p>
                    Operational usage remains visible through the
                    existing Campaign Seat usage service.
                  </p>

                  <small>
                    Subscription and plan details remain subject to
                    existing workspace RLS and billing permissions.
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
              V79 is read-only. Usage values come from live Campaign
              Seat records and the existing usage ledger. Missing plan
              limits remain unavailable rather than being estimated.
            </span>
          </div>
        </div>


        {selectedMetricKey ? (
          <UsageMetricDrawer
            metric={
              selectedMetric
            }
            loading={
              loading
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


function CheckCircleIcon() {
  return (
    <ShieldCheck
      size={16}
    />
  );
}


function ServiceSummary({
  icon: Icon,
  label,
  value,
  detail,
}) {
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
      </header>

      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>

      <p>
        {detail}
      </p>
    </article>
  );
}


function UsagePanel({
  metrics,
  onSelect,
}) {
  return (
    <section
      className={
        styles.usagePanel
      }
    >
      <header>
        <span>
          <CircleDollarSign
            size={21}
          />
        </span>

        <div>
          <h2>
            Current consumption
          </h2>

          <p>
            Live workspace consumption. Unpublished limits remain blank.
          </p>
        </div>
      </header>

      <div
        className={
          styles.usageCards
        }
      >
        {metrics.map(
          (metric) => (
            <UsageCard
              key={
                metric.key
              }
              metric={
                metric
              }
              onClick={() =>
                onSelect(
                  metric,
                )
              }
            />
          ),
        )}
      </div>
    </section>
  );
}


function UsageCard({
  metric,
  onClick,
}) {
  const Icon =
    metric.icon;

  const hasLimit =
    metric.limit !==
      null &&
    metric.limit !==
      undefined;

  const percentage =
    hasLimit &&
    metric.limit >
      0
      ? Math.min(
          100,
          (
            metric.used /
            metric.limit
          ) *
            100,
        )
      : 0;

  return (
    <button
      type="button"
      className={
        styles.usageCard
      }
      onClick={
        onClick
      }
    >
      <span
        className={
          styles.usageIcon
        }
      >
        <Icon
          size={18}
        />
      </span>

      <div>
        <small>
          {metric.label}
        </small>

        <strong>
          {metric.formatter(
            metric.used,
          )}
        </strong>

        <em>
          {hasLimit
            ? `of ${metric.formatter(
                metric.limit,
              )}`
            : "No published plan limit"}
        </em>
      </div>

      {hasLimit ? (
        <div
          className={
            styles.meterTrack
          }
        >
          <span
            style={{
              width:
                `${percentage}%`,
            }}
          />
        </div>
      ) : null}
    </button>
  );
}


function SubscriptionPanel({
  subscription,
  canViewBilling,
  planName,
  planStatus,
  commercialPricingFinalized,
  timezone,
}) {
  return (
    <section
      className={
        styles.subscriptionPanel
      }
    >
      <header>
        <span>
          <WalletCards
            size={21}
          />
        </span>

        <div>
          <h2>
            Workspace subscription
          </h2>

          <p>
            Billing details shown only when existing RLS permits access.
          </p>
        </div>
      </header>

      {!canViewBilling ? (
        <div
          className={
            styles.restrictedState
          }
        >
          <ShieldCheck
            size={25}
          />

          <strong>
            Billing details are restricted
          </strong>

          <span>
            Workspace billing or member-management permission is
            required to see subscription details.
          </span>
        </div>
      ) : (
        <>
          <div
            className={
              styles.subscriptionGrid
            }
          >
            <DetailCell
              label="Plan"
              value={
                planName
              }
            />

            <DetailCell
              label="Status"
              value={
                humanize(
                  planStatus,
                )
              }
            />

            <DetailCell
              label="Started"
              value={
                formatDate(
                  subscription
                    ?.starts_at,
                  timezone,
                )
              }
            />

            <DetailCell
              label="Renews"
              value={
                formatDate(
                  subscription
                    ?.renews_at,
                  timezone,
                  "Not scheduled",
                )
              }
            />

            <DetailCell
              label="Trial ends"
              value={
                formatDate(
                  subscription
                    ?.trial_ends_at,
                  timezone,
                  "Not recorded",
                )
              }
            />

            <DetailCell
              label="Command seats"
              value={
                subscription
                  ?.command_seat_limit ??
                "Not published"
              }
            />

            <DetailCell
              label="Staff seats"
              value={
                subscription
                  ?.staff_seat_limit ??
                "Not published"
              }
            />

            <DetailCell
              label="Volunteer accounts"
              value={
                subscription
                  ?.volunteer_account_limit ??
                "Not published"
              }
            />

            <DetailCell
              label="Reviewer accounts"
              value={
                subscription
                  ?.reviewer_account_limit ??
                "Not published"
              }
            />
          </div>

          {!commercialPricingFinalized ? (
            <div
              className={
                styles.pricingNotice
              }
            >
              <Sparkles
                size={18}
              />

              <div>
                <strong>
                  Commercial limits are not finalized
                </strong>

                <p>
                  Campaign Seat will not display invented prices or
                  allowances. This workspace continues to show the
                  subscription metadata actually stored by Seat Core.
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}


function DetailCell({
  label,
  value,
}) {
  return (
    <div>
      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function AiMeterPanel({
  usage,
}) {
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
            AI metering
          </h2>

          <p>
            Raw model activity from the live workspace usage ledger.
          </p>
        </div>
      </header>

      <div
        className={
          styles.aiSettingsGrid
        }
      >
        <DetailCell
          label="AI requests"
          value={
            formatNumber(
              usage.ai_request,
            )
          }
        />

        <DetailCell
          label="Input tokens"
          value={
            formatNumber(
              usage.ai_input_token,
            )
          }
        />

        <DetailCell
          label="Output tokens"
          value={
            formatNumber(
              usage.ai_output_token,
            )
          }
        />

        <DetailCell
          label="AI credits"
          value={
            formatNumber(
              usage.ai_credit,
            )
          }
        />
      </div>

      <div
        className={
          styles.aiNotice
        }
      >
        <Bot
          size={18}
        />

        <div>
          <strong>
            Metering is not pricing
          </strong>

          <p>
            Raw request and token totals do not imply a customer
            charge unless a finalized commercial plan explicitly
            defines one.
          </p>
        </div>
      </div>
    </section>
  );
}


function UsageMetricDrawer({
  metric,
  loading,
  onClose,
}) {
  const Icon =
    metric?.icon ||
    CircleDollarSign;

  const hasLimit =
    metric &&
    metric.limit !==
      null &&
    metric.limit !==
      undefined;

  const percentage =
    metric &&
    hasLimit &&
    metric.limit >
      0
      ? Math.min(
          100,
          Math.round(
            (
              metric.used /
              metric.limit
            ) *
              100,
          ),
        )
      : 0;

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
        aria-label="Usage metric details"
      >
        <header
          className={
            styles.detailHeader
          }
        >
          <div>
            <span>
              Plan &amp; Usage
            </span>

            <h2>
              {metric
                ? metric.label
                : loading
                  ? "Loading metric…"
                  : "Metric unavailable"}
            </h2>

            {metric ? (
              <p>
                Live Campaign Seat workspace consumption
              </p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close usage metric"
            onClick={
              onClose
            }
          >
            <X
              size={19}
            />
          </button>
        </header>

        {!metric ? (
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
              <CircleDollarSign
                size={30}
              />

              <strong>
                {loading
                  ? "Loading metric"
                  : "Metric not found"}
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
                data-tone="good"
              >
                <ShieldCheck
                  size={14}
                />
                Live
              </span>

              <strong>
                {metric.formatter(
                  metric.used,
                )}
              </strong>

              <p>
                Current usage
              </p>
            </section>

            <section
              className={
                styles.detailGrid
              }
            >
              <div>
                <small>
                  Source
                </small>

                <strong>
                  {metric.source}
                </strong>
              </div>

              <div>
                <small>
                  Plan limit
                </small>

                <strong>
                  {hasLimit
                    ? metric.formatter(
                        metric.limit,
                      )
                    : "Not published"}
                </strong>
              </div>

              <div>
                <small>
                  Usage
                </small>

                <strong>
                  {metric.formatter(
                    metric.used,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Allowance used
                </small>

                <strong>
                  {hasLimit
                    ? `${percentage}%`
                    : "Unavailable"}
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
                    Data disclosure
                  </h3>

                  <p>
                    This metric reflects the currently recorded
                    workspace value. No missing allowance, pricing,
                    or provider consumption has been estimated.
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
