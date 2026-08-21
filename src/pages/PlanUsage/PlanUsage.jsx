import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bot,
  CalendarClock,
  HardDrive,
  Mail,
  MessageCircle,
  MessageSquareText,
  PackageOpen,
  RefreshCw,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

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

import styles from "./PlanUsage.module.css";

function numberValue(value) {
  const parsed = Number(value || 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-US",
  ).format(
    numberValue(value),
  );
}

function formatBytes(value) {
  const bytes =
    numberValue(value);

  if (bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const unitIndex =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  const amount =
    bytes /
    1024 ** unitIndex;

  return `${
    amount >= 10 ||
    unitIndex === 0
      ? amount.toFixed(0)
      : amount.toFixed(1)
  } ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function humanize(value) {
  if (!value) {
    return "Not available";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function statusTone(value) {
  if (
    value === "active" ||
    value === "trial"
  ) {
    return "good";
  }

  if (
    value === "past_due" ||
    value === "suspended"
  ) {
    return "warning";
  }

  return "neutral";
}

function UsageMeter({
  label,
  icon: Icon,
  used,
  limit,
  formatter = formatNumber,
  helper,
}) {
  const hasLimit =
    limit !== null &&
    limit !== undefined;

  const normalizedUsed =
    numberValue(used);

  const normalizedLimit =
    hasLimit
      ? numberValue(limit)
      : 0;

  const percent =
    hasLimit &&
    normalizedLimit > 0
      ? Math.min(
          100,
          (
            normalizedUsed /
            normalizedLimit
          ) * 100,
        )
      : 0;

  return (
    <article
      className={
        styles.usageCard
      }
    >
      <div
        className={
          styles.usageCardHeader
        }
      >
        <span
          className={
            styles.usageIcon
          }
        >
          <Icon size={18} />
        </span>

        <span>{label}</span>
      </div>

      <div
        className={
          styles.usageValues
        }
      >
        <strong>
          {formatter(
            normalizedUsed,
          )}
        </strong>

        <span>
          {hasLimit
            ? `of ${formatter(
                normalizedLimit,
              )}`
            : "Current usage"}
        </span>
      </div>

      {hasLimit ? (
        <div
          className={
            styles.meterTrack
          }
          aria-label={`${label} usage`}
        >
          <span
            style={{
              width:
                `${percent}%`,
            }}
          />
        </div>
      ) : null}

      <small>
        {helper ||
          (
            hasLimit
              ? `${Math.round(
                  percent,
                )}% of allowance`
              : "Plan limit is restricted to billing administrators."
          )}
      </small>
    </article>
  );
}

export default function PlanUsage() {
  const workspace =
    getCurrentWorkspace();

  const workspaceId =
    workspace?.id || "";

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
    storageBytes,
    setStorageBytes,
  ] = useState(0);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const loadUsage =
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
                    count: "exact",
                    head: true,
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
                    count: "exact",
                    head: true,
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
                  "size_bytes",
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

          /*
           * Billing visibility intentionally follows the
           * existing workspace_subscriptions RLS policy.
           *
           * Members without billing/member-management
           * permission can still see their workspace's
           * operational usage, but not restricted plan
           * or subscription details.
           */
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
            setStorageBytes(
              (
                filesResult.data ||
                []
              ).reduce(
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
            );
          }

          setLastUpdated(
            new Date(),
          );
        } catch (
          loadError
        ) {
          setError(
            loadError?.message ||
              "Plan and usage information could not be loaded.",
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
          void loadUsage();
        },
        0,
      );

    return () =>
      window.clearTimeout(
        timeoutId,
      );
  }, [loadUsage]);

  const usage =
    summary?.usage || {};

  const canViewBilling =
    Boolean(subscription);

  const plan =
    canViewBilling
      ? summary?.plan || {}
      : {};

  const planName =
    canViewBilling
      ? (
          plan.display_name ||
          humanize(
            subscription?.plan_key,
          )
        )
      : "Billing restricted";

  const planStatus =
    canViewBilling
      ? subscription?.status ||
        "active"
      : "";

  const usagePeriod =
    useMemo(
      () => ({
        start:
          summary?.period_start,
        end:
          summary?.period_end,
      }),
      [
        summary?.period_end,
        summary?.period_start,
      ],
    );

  const aiCredits =
    numberValue(
      usage.ai_credit,
    );

  const aiRequests =
    numberValue(
      usage.ai_request,
    );

  const inputTokens =
    numberValue(
      usage.ai_input_token,
    );

  const outputTokens =
    numberValue(
      usage.ai_output_token,
    );

  const commercialPricingFinalized =
    plan?.metadata
      ?.commercial_pricing_finalized ===
    true;

  const limitFor = (
    key,
  ) => {
    if (!canViewBilling) {
      return null;
    }

    if (
      plan?.[key] ===
        undefined ||
      plan?.[key] === null
    ) {
      return null;
    }

    return numberValue(
      plan[key],
    );
  };

  const refreshAction = (
    <button
      className={
        styles.refreshButton
      }
      type="button"
      onClick={() =>
        void loadUsage()
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
      Refresh usage
    </button>
  );

  return (
    <CampaignWorkspaceShell
      activeItem="Plan & Usage"
    >
      <SeatPage
        eyebrow="Seat Core"
        title="Plan & Usage"
        description="Understand the workspace plan, account capacity and Campaign Seat usage in one place."
        loading={loading}
        error={error}
        actions={
          refreshAction
        }
      >
        <div
          className={
            styles.notice
          }
        >
          <Sparkles
            size={18}
          />

          <div>
            <strong>
              Usage metering is
              active.
            </strong>

            <span>
              Provider-backed
              services will begin
              accumulating usage as
              each integration is
              connected. Current
              pilot limits are
              entitlement
              placeholders, not
              finalized commercial
              pricing.
            </span>
          </div>
        </div>

        <div
          className={
            styles.overviewGrid
          }
        >
          <article
            className={
              styles.overviewCard
            }
          >
            <WalletCards
              size={20}
            />

            <span>
              Current plan
            </span>

            <strong>
              {planName}
            </strong>

            {canViewBilling ? (
              <em
                data-tone={
                  statusTone(
                    planStatus,
                  )
                }
              >
                {humanize(
                  planStatus,
                )}
              </em>
            ) : (
              <small>
                Plan and billing
                details require
                billing or member
                management access.
              </small>
            )}
          </article>

          <article
            className={
              styles.overviewCard
            }
          >
            <CalendarClock
              size={20}
            />

            <span>
              Usage period
            </span>

            <strong>
              {formatDate(
                usagePeriod.start,
              )}
            </strong>

            <small>
              through{" "}
              {formatDate(
                usagePeriod.end,
              )}
            </small>
          </article>

          <article
            className={
              styles.overviewCard
            }
          >
            <Users size={20} />

            <span>
              Active team
            </span>

            <strong>
              {formatNumber(
                activeSeatCount,
              )}
            </strong>

            <small>
              active workspace
              members
            </small>
          </article>

          <article
            className={
              styles.overviewCard
            }
          >
            <PackageOpen
              size={20}
            />

            <span>
              Inventory capacity
            </span>

            <strong>
              {formatNumber(
                inventoryItemCount,
              )}
            </strong>

            <small>
              active inventory
              items
            </small>
          </article>
        </div>

        <SeatPageSection
          title="Usage"
          description="Current workspace consumption for the active usage period."
        >
          <div
            className={
              styles.usageGrid
            }
          >
            <UsageMeter
              label="AI credits"
              icon={Bot}
              used={aiCredits}
              limit={
                limitFor(
                  "ai_credit_limit",
                )
              }
            />

            <UsageMeter
              label="SMS messages"
              icon={
                MessageSquareText
              }
              used={
                usage.sms_message
              }
              limit={
                limitFor(
                  "sms_message_limit",
                )
              }
            />

            <UsageMeter
              label="WhatsApp"
              icon={
                MessageCircle
              }
              used={
                usage.whatsapp_message
              }
              limit={
                limitFor(
                  "whatsapp_message_limit",
                )
              }
            />

            <UsageMeter
              label="Email sends"
              icon={Mail}
              used={
                usage.email_send
              }
              limit={
                limitFor(
                  "email_send_limit",
                )
              }
            />

            <UsageMeter
              label="Storage"
              icon={HardDrive}
              used={storageBytes}
              limit={
                limitFor(
                  "storage_bytes_limit",
                )
              }
              formatter={
                formatBytes
              }
            />

            <UsageMeter
              label="Team seats"
              icon={Users}
              used={
                activeSeatCount
              }
              limit={
                limitFor(
                  "member_seat_limit",
                )
              }
            />

            <UsageMeter
              label="Inventory items"
              icon={
                PackageOpen
              }
              used={
                inventoryItemCount
              }
              limit={
                limitFor(
                  "inventory_item_limit",
                )
              }
            />
          </div>
        </SeatPageSection>

        <div
          className={
            styles.detailGrid
          }
        >
          <SeatPageSection
            title="AI metering"
            description="Raw model activity stays visible internally while customers can be billed using understandable AI credits."
          >
            <div
              className={
                styles.statList
              }
            >
              <div>
                <span>
                  AI requests
                </span>

                <strong>
                  {formatNumber(
                    aiRequests,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Input tokens
                </span>

                <strong>
                  {formatNumber(
                    inputTokens,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Output tokens
                </span>

                <strong>
                  {formatNumber(
                    outputTokens,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  AI credits
                </span>

                <strong>
                  {formatNumber(
                    aiCredits,
                  )}
                </strong>
              </div>
            </div>
          </SeatPageSection>

          <SeatPageSection
            title="Subscription"
            description="Workspace billing state and account-level capacity."
          >
            {canViewBilling ? (
              <div
                className={
                  styles.subscriptionDetails
                }
              >
                <div>
                  <span>
                    Plan
                  </span>
                  <strong>
                    {planName}
                  </strong>
                </div>

                <div>
                  <span>
                    Status
                  </span>
                  <strong>
                    {humanize(
                      planStatus,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Started
                  </span>
                  <strong>
                    {formatDate(
                      subscription
                        ?.starts_at,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Renews
                  </span>
                  <strong>
                    {formatDate(
                      subscription
                        ?.renews_at,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Command seats
                  </span>
                  <strong>
                    {subscription
                      ?.command_seat_limit ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Staff seats
                  </span>
                  <strong>
                    {subscription
                      ?.staff_seat_limit ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Volunteer accounts
                  </span>
                  <strong>
                    {subscription
                      ?.volunteer_account_limit ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Reviewer accounts
                  </span>
                  <strong>
                    {subscription
                      ?.reviewer_account_limit ??
                      "—"}
                  </strong>
                </div>

                {!commercialPricingFinalized ? (
                  <p
                    className={
                      styles.pricingNote
                    }
                  >
                    Commercial
                    pricing and final
                    plan limits have
                    not been
                    finalized for
                    this pilot.
                  </p>
                ) : null}
              </div>
            ) : (
              <div
                className={
                  styles.restricted
                }
              >
                <WalletCards
                  size={22}
                />

                <div>
                  <strong>
                    Billing details
                    are restricted.
                  </strong>

                  <span>
                    Users with
                    workspace billing
                    or member
                    management
                    permission can
                    view subscription
                    details and plan
                    allowances.
                  </span>
                </div>
              </div>
            )}
          </SeatPageSection>
        </div>

        <p
          className={
            styles.updated
          }
        >
          {lastUpdated
            ? `Last refreshed ${new Intl.DateTimeFormat(
                "en-US",
                {
                  hour: "numeric",
                  minute: "2-digit",
                },
              ).format(
                lastUpdated,
              )}`
            : ""}
        </p>
      </SeatPage>
    </CampaignWorkspaceShell>
  );
}
