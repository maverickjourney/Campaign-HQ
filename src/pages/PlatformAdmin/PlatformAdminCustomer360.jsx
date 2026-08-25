import {
  discardPlatformWorkspaceDraft,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileClock,
  Link2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  loadPlatformCustomerControlCenter,
  loadPlatformCampaignRoles,
  loadPlatformWorkspaceRevisionHistory,
  setPlatformCustomerAccountStatus,
  setPlatformCustomerMemberAccess,
  setPlatformCustomerModule,
  updatePlatformManualBilling,
}
from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";


const TABS = [
  {
    id: "overview",
    label: "Overview",
    Icon: Activity,
  },
  {
    id: "workspace",
    label: "Workspace",
    Icon: Settings2,
  },
  {
    id: "billing",
    label: "Billing & Subscription",
    Icon: CreditCard,
  },
  {
    id: "modules",
    label: "Product & Modules",
    Icon: Boxes,
  },
  {
    id: "team",
    label: "Team & Access",
    Icon: Users,
  },
  {
    id: "integrations",
    label: "Integrations",
    Icon: Link2,
  },
  {
    id: "history",
    label: "History & Security",
    Icon: ShieldCheck,
  },
];


function pretty(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}


function money(
  cents,
  currency = "USD",
) {
  const amount =
    Number(cents || 0) / 100;

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency:
        String(
          currency || "USD",
        ).toUpperCase(),
      maximumFractionDigits:
        amount % 1 === 0
          ? 0
          : 2,
    },
  ).format(amount);
}


function dateLabel(value) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
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


function dateTimeLabel(value) {
  if (!value) {
    return "Not yet";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}


function StatusPill({
  value,
}) {
  const normalized =
    String(value || "")
      .toLowerCase();

  const good =
    [
      "active",
      "completed",
      "connected",
    ].includes(normalized);

  const warning =
    [
      "trial",
      "pending",
      "pending_billing",
      "past_due",
    ].includes(normalized);

  return (
    <span
      className={[
        styles.customer360Status,
        good
          ? styles.customer360StatusGood
          : "",
        warning
          ? styles.customer360StatusWarning
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {pretty(value)}
    </span>
  );
}


export default function PlatformAdminCustomer360() {
  const {
    workspaceId,
  } = useParams();

  const navigate =
    useNavigate();

  const location =
    useLocation();


  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    data,
    setData,
  ] = useState(null);

  const [
    revisions,
    setRevisions,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  const [
    billingBusy,
    setBillingBusy,
  ] = useState(false);

  const [
    billingNotice,
    setBillingNotice,
  ] = useState("");

  const [
    billingReason,
    setBillingReason,
  ] = useState("");

  const [
    workspaceNotice,
    setWorkspaceNotice,
  ] = useState("");

  const [
    discardDraft,
    setDiscardDraft,
  ] = useState(null);

  const [
    discardReason,
    setDiscardReason,
  ] = useState("");

  const [
    discardBusy,
    setDiscardBusy,
  ] = useState(false);


  const [
    lifecycleAction,
    setLifecycleAction,
  ] = useState(null);

  const [
    lifecycleReason,
    setLifecycleReason,
  ] = useState("");

  const [
    lifecycleBusy,
    setLifecycleBusy,
  ] = useState(false);

  const [
    lifecycleNotice,
    setLifecycleNotice,
  ] = useState("");


  const [
    campaignRoles,
    setCampaignRoles,
  ] = useState([]);

  const [
    teamAction,
    setTeamAction,
  ] = useState(null);

  const [
    teamReason,
    setTeamReason,
  ] = useState("");

  const [
    teamRole,
    setTeamRole,
  ] = useState("");

  const [
    teamTitle,
    setTeamTitle,
  ] = useState("");

  const [
    teamStatus,
    setTeamStatus,
  ] = useState("active");

  const [
    teamBusy,
    setTeamBusy,
  ] = useState(false);

  const [
    teamNotice,
    setTeamNotice,
  ] = useState("");


  const [
    moduleAction,
    setModuleAction,
  ] = useState(null);

  const [
    moduleReason,
    setModuleReason,
  ] = useState("");

  const [
    moduleBusy,
    setModuleBusy,
  ] = useState(false);

  const [
    moduleNotice,
    setModuleNotice,
  ] = useState("");


  const [
    billingForm,
    setBillingForm,
  ] = useState({
    monthly: "",
    annual: "",
    onboarding: "",
    seats: "",
    status: "",
    trialEnds: "",
    periodEnds: "",
    billingEmail: "",
    billingName: "",
    billingPhone: "",
    line1: "",
    line2: "",
    city: "",
    stateRegion: "",
    postalCode: "",
    countryCode: "US",
  });


  const hydrateBilling =
    (controlCenter) => {
      const subscription =
        controlCenter
          ?.subscription || {};

      const customer =
        controlCenter
          ?.customer || {};

      const contact =
        controlCenter
          ?.billing_contact || {};

      const address =
        customer
          ?.billing_address || {};

      const dollars =
        (cents) =>
          String(
            Number(cents || 0) /
            100,
          );

      const dateInput =
        (value) =>
          value
            ? String(value).slice(0, 10)
            : "";

      setBillingForm({
        monthly:
          dollars(
            subscription
              .monthly_amount_cents,
          ),

        annual:
          dollars(
            subscription
              .annual_amount_cents,
          ),

        onboarding:
          dollars(
            subscription
              .onboarding_fee_cents,
          ),

        seats:
          String(
            subscription
              .included_user_seats ??
            0,
          ),

        status:
          subscription.status || "",

        trialEnds:
          dateInput(
            subscription
              .trial_ends_at,
          ),

        periodEnds:
          dateInput(
            subscription
              .current_period_end,
          ),

        billingEmail:
          customer
            .billing_email ||
          contact.email ||
          "",

        billingName:
          contact
            .billing_name ||
          contact
            .full_name ||
          "",

        billingPhone:
          contact.phone || "",

        line1:
          address.line1 || "",

        line2:
          address.line2 || "",

        city:
          address.city || "",

        stateRegion:
          address
            .state_region ||
          address.state ||
          "",

        postalCode:
          address
            .postal_code ||
          "",

        countryCode:
          address
            .country_code ||
          "US",
      });
    };


  const load =
    async ({
      quiet = false,
    } = {}) => {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          controlCenter,
          history,
          roles,
        ] =
          await Promise.all([
            loadPlatformCustomerControlCenter(
              workspaceId,
            ),

            loadPlatformWorkspaceRevisionHistory(
              workspaceId,
            ),

            loadPlatformCampaignRoles(),
          ]);

        setData(
          controlCenter,
        );

        hydrateBilling(
          controlCenter,
        );

        setRevisions(
          history,
        );

        setCampaignRoles(
          roles,
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Customer 360 could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };


  useEffect(() => {
    void load();
  }, [workspaceId]);


  const customer =
    data?.customer || {};

  const account =
    data?.product_account || {};

  const subscription =
    data?.subscription || {};

  const team =
    data?.team || [];

  const entitlements =
    data?.entitlements || [];

  const integrations =
    data?.integrations || [];


  const activeSeats =
    useMemo(
      () =>
        team.filter(
          (member) =>
            member.status ===
              "active" &&
            member.membership_state ===
              "active",
        ).length,
      [team],
    );


  const activeDraft =
    useMemo(
      () =>
        revisions.find(
          (revision) =>
            revision.status ===
            "draft",
        ) || null,
      [revisions],
    );


  const enabledModules =
    useMemo(
      () =>
        entitlements.filter(
          (item) =>
            item.enabled,
        ).length,
      [entitlements],
    );


  const discardSavedDraft =
    async () => {
      if (
        !discardDraft ||
        !discardReason.trim()
      ) {
        setError(
          "Enter an internal reason before discarding this draft.",
        );

        return;
      }

      setError("");
      setWorkspaceNotice("");
      setDiscardBusy(true);

      try {
        await discardPlatformWorkspaceDraft({
          workspaceId,

          revisionId:
            discardDraft.id,

          reason:
            discardReason.trim(),
        });

        const history =
          await loadPlatformWorkspaceRevisionHistory(
            workspaceId,
          );

        setRevisions(
          history,
        );

        setWorkspaceNotice(
          `Draft revision ${discardDraft.revision_number} was discarded and recorded in Admin history.`,
        );

        setDiscardDraft(null);
        setDiscardReason("");
      } catch (
        discardError
      ) {
        setError(
          discardError instanceof Error
            ? discardError.message
            : "The workspace draft could not be discarded.",
        );
      } finally {
        setDiscardBusy(false);
      }
    };


  const reverifyAuthenticator =
    () => {
      navigate(
        "/mfa/challenge",
        {
          state: {
            from:
              location.pathname,

            forceReverify:
              true,
          },
        },
      );
    };


  const saveLifecycleChange =
    async () => {
      if (
        !lifecycleAction ||
        !lifecycleReason.trim()
      ) {
        setError(
          "Enter an internal reason before changing account access.",
        );

        return;
      }

      setError("");
      setLifecycleNotice("");
      setLifecycleBusy(true);

      try {
        const result =
          await setPlatformCustomerAccountStatus({
            workspaceId,

            status:
              lifecycleAction,

            reason:
              lifecycleReason.trim(),
          });

        setData(
          result,
        );

        setLifecycleNotice(
          `Customer product access changed to ${pretty(
            lifecycleAction,
          )}. The action was recorded in Platform Admin history.`,
        );

        setLifecycleAction(
          null,
        );

        setLifecycleReason(
          "",
        );
      } catch (
        lifecycleError
      ) {
        setError(
          lifecycleError instanceof Error
            ? lifecycleError.message
            : "Customer account status could not be changed.",
        );
      } finally {
        setLifecycleBusy(false);
      }
    };


  const openTeamManager =
    (member) => {
      setTeamReason("");

      setTeamRole(
        member.role_key || "",
      );

      setTeamTitle(
        member.display_title || "",
      );

      setTeamStatus(
        member.status || "active",
      );

      setTeamAction(
        member,
      );
    };


  const saveTeamChange =
    async () => {
      if (
        !teamAction ||
        !teamReason.trim()
      ) {
        setError(
          "Enter an internal reason before changing team access.",
        );

        return;
      }

      setError("");
      setTeamNotice("");
      setTeamBusy(true);

      try {
        const result =
          await setPlatformCustomerMemberAccess({
            workspaceId,

            membershipId:
              teamAction.id,

            roleKey:
              teamRole,

            displayTitle:
              teamTitle.trim(),

            status:
              teamStatus,

            reason:
              teamReason.trim(),
          });

        setData(
          result,
        );

        setTeamNotice(
          `Updated ${
            teamAction.full_name ||
            teamAction.email ||
            "campaign member"
          }. The access change was recorded in Platform Admin history.`,
        );

        setTeamAction(null);
        setTeamReason("");
      } catch (
        teamError
      ) {
        setError(
          teamError instanceof Error
            ? teamError.message
            : "Team access could not be changed.",
        );
      } finally {
        setTeamBusy(false);
      }
    };


  const saveModuleChange =
    async () => {
      if (
        !moduleAction ||
        !moduleReason.trim()
      ) {
        setError(
          "Enter an internal reason before changing module access.",
        );

        return;
      }

      setError("");
      setModuleNotice("");
      setModuleBusy(true);

      try {
        const result =
          await setPlatformCustomerModule({
            workspaceId,

            moduleKey:
              moduleAction
                .item
                .module_key,

            enabled:
              moduleAction
                .enabled,

            reason:
              moduleReason.trim(),
          });

        setData(result);

        setModuleNotice(
          `${
            moduleAction.enabled
              ? "Enabled"
              : "Disabled"
          } ${
            moduleAction.item.display_name ||
            moduleAction.item.module_name ||
            pretty(
              moduleAction.item.module_key,
            )
          }. The Admin override was recorded in audit history.`,
        );

        setModuleAction(null);
        setModuleReason("");
      } catch (
        moduleError
      ) {
        setError(
          moduleError instanceof Error
            ? moduleError.message
            : "Module access could not be changed.",
        );
      } finally {
        setModuleBusy(false);
      }
    };


  const saveBilling =
    async () => {
      setError("");
      setBillingNotice("");

      if (
        !billingReason.trim()
      ) {
        setError(
          "Enter an internal reason before saving billing changes.",
        );

        return;
      }

      const cents =
        (value) => {
          const number =
            Number(value);

          if (
            !Number.isFinite(number) ||
            number < 0
          ) {
            return null;
          }

          return Math.round(
            number * 100,
          );
        };

      const monthly =
        cents(
          billingForm.monthly,
        );

      const annual =
        cents(
          billingForm.annual,
        );

      const onboarding =
        cents(
          billingForm.onboarding,
        );

      const seats =
        Number(
          billingForm.seats,
        );

      if (
        monthly === null ||
        annual === null ||
        onboarding === null ||
        !Number.isInteger(seats) ||
        seats < 0
      ) {
        setError(
          "Enter valid billing amounts and included seats.",
        );

        return;
      }

      setBillingBusy(true);

      try {
        const result =
          await updatePlatformManualBilling({
            workspaceId,

            expectedUpdatedAt:
              subscription
                .updated_at,

            reason:
              billingReason.trim(),

            billing: {
              billing_email:
                billingForm
                  .billingEmail
                  .trim(),

              billing_name:
                billingForm
                  .billingName
                  .trim(),

              billing_phone:
                billingForm
                  .billingPhone
                  .trim(),

              billing_address: {
                line1:
                  billingForm
                    .line1
                    .trim(),

                line2:
                  billingForm
                    .line2
                    .trim() ||
                  null,

                city:
                  billingForm
                    .city
                    .trim(),

                state_region:
                  billingForm
                    .stateRegion
                    .trim(),

                postal_code:
                  billingForm
                    .postalCode
                    .trim(),

                country_code:
                  billingForm
                    .countryCode
                    .trim()
                    .toUpperCase(),
              },

              monthly_amount_cents:
                monthly,

              annual_amount_cents:
                annual,

              onboarding_fee_cents:
                onboarding,

              included_user_seats:
                seats,

              subscription_status:
                billingForm.status,

              trial_ends_at:
                billingForm
                  .trialEnds ||
                null,

              current_period_end:
                billingForm
                  .periodEnds ||
                null,
            },
          });

        setData(result);

        hydrateBilling(
          result,
        );

        setBillingReason("");

        setBillingNotice(
          "Billing changes saved and recorded in Admin history.",
        );
      } catch (
        saveError
      ) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Billing could not be saved.",
        );
      } finally {
        setBillingBusy(false);
      }
    };


  if (loading) {
    return (
      <PlatformAdminShell
        title="Customer 360"
        description="Loading the complete Campaign Seat customer record."
      >
        <div
          className={
            styles.adminEmpty
          }
        >
          Loading Customer 360…
        </div>
      </PlatformAdminShell>
    );
  }


  return (
    <PlatformAdminShell
      title={
        customer.display_name ||
        account.account_name ||
        "Customer 360"
      }
      description="Workspace, billing, product access, team, integrations and security in one protected customer record."
      actions={
        <Link
          className={
            styles.customer360BackButton
          }
          to="/admin/customers"
        >
          <ArrowLeft
            size={15}
          />
          Customers
        </Link>
      }
    >
      <main
        className={
          styles.customer360
        }
      >
        {error && (
          <div
            className={
              styles.adminError
            }
          >
            {error}
          </div>
        )}

        <section
          className={
            styles.customer360Hero
          }
        >
          <div>
            <span>
              Customer 360
            </span>

            <h2>
              {customer.display_name}
            </h2>

            <p>
              {pretty(
                customer.customer_type,
              )}
              {" · "}
              {account.account_name}
            </p>
          </div>

          <div
            className={
              styles.customer360HeroActions
            }
          >
            <StatusPill
              value={
                account.status
              }
            />

            <StatusPill
              value={
                subscription.status
              }
            />

            <button
              type="button"
              onClick={() =>
                load({
                  quiet: true,
                })
              }
              disabled={
                refreshing
              }
            >
              <RefreshCw
                size={14}
              />
              {refreshing
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </section>


        <nav
          className={
            styles.customer360Tabs
          }
        >
          {TABS.map(
            ({
              id,
              label,
              Icon,
            }) => (
              <button
                key={id}
                type="button"
                className={
                  activeTab === id
                    ? styles.customer360TabActive
                    : ""
                }
                onClick={() =>
                  setActiveTab(id)
                }
              >
                <Icon size={15} />
                {label}
              </button>
            ),
          )}
        </nav>


        {activeTab ===
          "overview" ? (
          <section
            className={
              styles.customer360Overview
            }
          >
            <div
              className={
                styles.customer360Metrics
              }
            >
              <article>
                <CircleDollarSign />
                <span>
                  Monthly
                </span>
                <strong>
                  {money(
                    subscription
                      .monthly_amount_cents,
                    subscription.currency,
                  )}
                </strong>
              </article>

              <article>
                <CreditCard />
                <span>
                  Onboarding
                </span>
                <strong>
                  {money(
                    subscription
                      .onboarding_fee_cents,
                    subscription.currency,
                  )}
                </strong>
              </article>

              <article>
                <Users />
                <span>
                  Seats
                </span>
                <strong>
                  {activeSeats}
                  {" / "}
                  {subscription
                    .included_user_seats ??
                    0}
                </strong>
              </article>

              <article>
                <Boxes />
                <span>
                  Modules
                </span>
                <strong>
                  {enabledModules}
                </strong>
              </article>

              <article>
                <Link2 />
                <span>
                  Integrations
                </span>
                <strong>
                  {integrations.length}
                </strong>
              </article>

              <article>
                <ShieldCheck />
                <span>
                  Admin Security
                </span>
                <strong>
                  MFA
                </strong>
              </article>
            </div>


            <div
              className={
                styles.customer360OverviewGrid
              }
            >
              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <CreditCard
                    size={18}
                  />
                  <strong>
                    Subscription
                  </strong>
                </header>

                <dl>
                  <div>
                    <dt>
                      Plan
                    </dt>

                    <dd>
                      {subscription
                        .package_name ||
                        "Custom"}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Provider
                    </dt>

                    <dd>
                      {pretty(
                        subscription
                          .billing_provider,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Trial ends
                    </dt>

                    <dd>
                      {dateLabel(
                        subscription
                          .trial_ends_at,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Status
                    </dt>

                    <dd>
                      {pretty(
                        subscription.status,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>


              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <Settings2
                    size={18}
                  />
                  <strong>
                    Campaign Workspace
                  </strong>
                </header>

                <dl>
                  <div>
                    <dt>
                      Relationship
                    </dt>

                    <dd>
                      {pretty(
                        data
                          ?.binding
                          ?.relationship_type,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Revisions
                    </dt>

                    <dd>
                      {revisions.length}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Onboarding
                    </dt>

                    <dd>
                      {pretty(
                        data
                          ?.onboarding
                          ?.status,
                      )}
                    </dd>
                  </div>
                </dl>

                <Link
                  className={
                    styles.customer360OpenWorkspace
                  }
                  to={`/admin/workspaces/${workspaceId}`}
                >
                  Open Workspace Manager
                </Link>
              </article>


              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <Users
                    size={18}
                  />
                  <strong>
                    Team & Access
                  </strong>
                </header>

                <div
                  className={
                    styles.customer360BigStat
                  }
                >
                  <b>
                    {activeSeats}
                  </b>

                  <span>
                    Active workspace members
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "team",
                    )
                  }
                >
                  View Team
                </button>
              </article>


              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <FileClock
                    size={18}
                  />
                  <strong>
                    History & Security
                  </strong>
                </header>

                <div
                  className={
                    styles.customer360SecurityLine
                  }
                >
                  <CheckCircle2
                    size={17}
                  />

                  <div>
                    <strong>
                      Platform role + MFA
                    </strong>

                    <span>
                      Sensitive Admin changes require recent authenticator verification.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "history",
                    )
                  }
                >
                  View Security
                </button>
              </article>
            </div>
          </section>
        ) : activeTab ===
          "workspace" ? (
          <section
            className={
              styles.customer360Workspace
            }
          >
            {workspaceNotice && (
              <div
                className={
                  styles.customer360BillingNotice
                }
              >
                <CheckCircle2
                  size={16}
                />

                {workspaceNotice}
              </div>
            )}

            <div
              className={
                styles.customer360WorkspaceSummary
              }
            >
              <article>
                <span>
                  Published
                </span>

                <strong>
                  {account.account_name ||
                    customer.display_name}
                </strong>
              </article>

              <article>
                <span>
                  Saved Draft
                </span>

                <strong>
                  {activeDraft
                    ? `Revision ${activeDraft.revision_number}`
                    : "No saved draft"}
                </strong>
              </article>

              <article>
                <span>
                  Campaign sees
                </span>

                <strong>
                  Published version
                </strong>
              </article>

              <article>
                <span>
                  Revision history
                </span>

                <strong>
                  {revisions.length}
                </strong>
              </article>
            </div>


            <section
              className={
                styles.customer360WorkspaceLaunch
              }
            >
              <div
                className={
                  styles.customer360WorkspaceLaunchIcon
                }
              >
                <Settings2
                  size={27}
                />
              </div>

              <div>
                <span>
                  Campaign Workspace Manager
                </span>

                <h2>
                  Draft → Preview → Publish
                </h2>

                <p>
                  Configure campaign identity, election information, contact details, branding and candidate profile privately. Saving a draft never changes what the campaign sees. Publish is the only action that promotes approved changes to the live workspace.
                </p>
              </div>

              <Link
                className={
                  styles.customer360WorkspaceLaunchButton
                }
                to={`/admin/workspaces/${workspaceId}`}
              >
                Open Workspace Manager
              </Link>
            </section>


            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <FileClock
                  size={18}
                />

                <strong>
                  Workspace Revision History
                </strong>

                <span
                  className={
                    styles.customer360TeamCount
                  }
                >
                  {revisions.length}
                  {" revisions"}
                </span>
              </header>

              {revisions.length ? (
                <div
                  className={
                    styles.customer360WorkspaceHistory
                  }
                >
                  {revisions.map(
                    (revision) => (
                      <article
                        key={
                          revision.id
                        }
                      >
                        <div
                          className={
                            styles.customer360WorkspaceRevisionNumber
                          }
                        >
                          R
                          {
                            revision
                              .revision_number
                          }
                        </div>

                        <div
                          className={
                            styles.customer360WorkspaceRevisionIdentity
                          }
                        >
                          <strong>
                            Revision{" "}
                            {
                              revision
                                .revision_number
                            }
                          </strong>

                          <span>
                            Updated{" "}
                            {dateTimeLabel(
                              revision.updated_at,
                            )}
                          </span>
                        </div>

                        <StatusPill
                          value={
                            revision.status
                          }
                        />

                        <div
                          className={
                            styles.customer360WorkspaceRevisionTime
                          }
                        >
                          {revision.published_at
                            ? `Published ${dateTimeLabel(
                                revision.published_at,
                              )}`
                            : "Not published"}
                        </div>

                        {revision.status ===
                          "draft" && (
                          <button
                            type="button"
                            className={
                              styles.customer360DiscardDraftButton
                            }
                            onClick={() => {
                              setDiscardReason("");

                              setDiscardDraft(
                                revision,
                              );
                            }}
                          >
                            Discard Draft
                          </button>
                        )}
                      </article>
                    ),
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.customer360WorkspaceEmpty
                  }
                >
                  <FileClock
                    size={21}
                  />

                  <strong>
                    No workspace revisions yet
                  </strong>

                  <span>
                    The first saved Workspace Manager draft will appear here.
                  </span>
                </div>
              )}
            </article>


            {discardDraft && (
              <div
                className={
                  styles.customer360TeamModalBackdrop
                }
              >
                <section
                  className={
                    styles.customer360TeamModal
                  }
                >
                  <header>
                    <div>
                      <span>
                        Protected Admin action
                      </span>

                      <h2>
                        Discard Revision{" "}
                        {
                          discardDraft
                            .revision_number
                        }
                      </h2>
                    </div>

                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => {
                        setDiscardDraft(null);
                        setDiscardReason("");
                      }}
                      disabled={
                        discardBusy
                      }
                    >
                      ×
                    </button>
                  </header>

                  <div
                    className={
                      styles.customer360WorkspaceDiscardWarning
                    }
                  >
                    This removes the saved Admin draft from the active workflow. It does not change the live campaign workspace.
                  </div>

                  <label
                    className={
                      styles.customer360TeamReason
                    }
                  >
                    <span>
                      Internal reason *
                    </span>

                    <textarea
                      value={
                        discardReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setDiscardReason(
                          event.target.value,
                        )
                      }
                      placeholder="Document why this saved draft is being discarded."
                    />
                  </label>

                  <footer>
                    <button
                      type="button"
                      className={
                        styles.customer360ModuleCancel
                      }
                      onClick={() => {
                        setDiscardDraft(null);
                        setDiscardReason("");
                      }}
                      disabled={
                        discardBusy
                      }
                    >
                      Keep Draft
                    </button>

                    <button
                      type="button"
                      className={
                        styles.customer360LifecycleDanger
                      }
                      onClick={
                        discardSavedDraft
                      }
                      disabled={
                        discardBusy ||
                        !discardReason.trim()
                      }
                    >
                      {discardBusy
                        ? "Discarding…"
                        : "Discard Draft"}
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </section>
        ) : activeTab ===
          "billing" ? (
          <section
            className={
              styles.customer360Billing
            }
          >
            <div
              className={
                styles.customer360BillingMetrics
              }
            >
              <article>
                <span>
                  Monthly
                </span>

                <strong>
                  {money(
                    subscription
                      .monthly_amount_cents,
                    subscription.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Annual
                </span>

                <strong>
                  {money(
                    subscription
                      .annual_amount_cents,
                    subscription.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Onboarding
                </span>

                <strong>
                  {money(
                    subscription
                      .onboarding_fee_cents,
                    subscription.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Seats
                </span>

                <strong>
                  {subscription
                    .included_user_seats ??
                    0}
                </strong>
              </article>
            </div>


            {billingNotice && (
              <div
                className={
                  styles.customer360BillingNotice
                }
              >
                <CheckCircle2
                  size={16}
                />

                {billingNotice}
              </div>
            )}


            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <CreditCard
                  size={18}
                />

                <strong>
                  Billing & Subscription
                </strong>

                <StatusPill
                  value={
                    subscription.status
                  }
                />
              </header>

              {subscription
                .billing_provider !==
                "manual" && (
                <div
                  className={
                    styles.customer360BillingLocked
                  }
                >
                  This subscription is connected to an external billing provider. Local manual pricing changes are disabled to prevent billing drift.
                </div>
              )}

              <div
                className={
                  styles.customer360BillingGrid
                }
              >
                <label>
                  <span>
                    Monthly price
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      billingForm.monthly
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          monthly:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Annual price
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      billingForm.annual
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          annual:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Onboarding fee
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      billingForm.onboarding
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          onboarding:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Included seats
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      billingForm.seats
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          seats:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Subscription status
                  </span>

                  <select
                    value={
                      billingForm.status
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          status:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option value="pending_billing">
                      Pending Billing
                    </option>

                    <option value="trial">
                      Trial
                    </option>

                    <option value="active">
                      Active
                    </option>

                    <option value="past_due">
                      Past Due
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Trial ends
                  </span>

                  <input
                    type="date"
                    value={
                      billingForm.trialEnds
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          trialEnds:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Current period ends
                  </span>

                  <input
                    type="date"
                    value={
                      billingForm.periodEnds
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          periodEnds:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>


              <div
                className={
                  styles.customer360BillingDivider
                }
              />


              <h3>
                Billing contact
              </h3>

              <div
                className={
                  styles.customer360BillingGrid
                }
              >
                <label>
                  <span>
                    Billing name
                  </span>

                  <input
                    value={
                      billingForm.billingName
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          billingName:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Billing email
                  </span>

                  <input
                    type="email"
                    value={
                      billingForm.billingEmail
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          billingEmail:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Billing phone
                  </span>

                  <input
                    value={
                      billingForm.billingPhone
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          billingPhone:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Address
                  </span>

                  <input
                    value={
                      billingForm.line1
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          line1:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Address line 2
                  </span>

                  <input
                    value={
                      billingForm.line2
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          line2:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    City
                  </span>

                  <input
                    value={
                      billingForm.city
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          city:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    State
                  </span>

                  <input
                    value={
                      billingForm.stateRegion
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          stateRegion:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    ZIP / Postal
                  </span>

                  <input
                    value={
                      billingForm.postalCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          postalCode:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Country
                  </span>

                  <input
                    maxLength={2}
                    value={
                      billingForm.countryCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillingForm(
                        (current) => ({
                          ...current,
                          countryCode:
                            event.target.value
                              .toUpperCase(),
                        }),
                      )
                    }
                  />
                </label>
              </div>


              <label
                className={
                  styles.customer360BillingReason
                }
              >
                <span>
                  Internal reason for billing change *
                </span>

                <textarea
                  value={
                    billingReason
                  }
                  onChange={(
                    event,
                  ) =>
                    setBillingReason(
                      event.target.value,
                    )
                  }
                  placeholder="Document why the billing terms are being changed."
                />
              </label>


              <div
                className={
                  styles.customer360BillingActions
                }
              >
                <button
                  type="button"
                  onClick={
                    saveBilling
                  }
                  disabled={
                    billingBusy ||
                    subscription
                      .billing_provider !==
                      "manual"
                  }
                >
                  {billingBusy
                    ? "Saving…"
                    : "Save Billing Changes"}
                </button>
              </div>
            </article>
          </section>
        ) : activeTab ===
          "modules" ? (
          <section
            className={
              styles.customer360Modules
            }
          >
            <div
              className={
                styles.customer360ModuleSummary
              }
            >
              <article>
                <span>
                  Enabled
                </span>

                <strong>
                  {
                    entitlements.filter(
                      (item) =>
                        item.enabled,
                    ).length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Disabled
                </span>

                <strong>
                  {
                    entitlements.filter(
                      (item) =>
                        !item.enabled,
                    ).length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Total modules
                </span>

                <strong>
                  {entitlements.length}
                </strong>
              </article>
            </div>


            {moduleNotice && (
              <div
                className={
                  styles.customer360BillingNotice
                }
              >
                <CheckCircle2
                  size={16}
                />

                {moduleNotice}
              </div>
            )}


            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <Boxes
                  size={18}
                />

                <strong>
                  Product & Modules
                </strong>

                <span
                  className={
                    styles.customer360ModuleCount
                  }
                >
                  {
                    entitlements.filter(
                      (item) =>
                        item.enabled,
                    ).length
                  }
                  {" enabled"}
                </span>
              </header>

              <p
                className={
                  styles.customer360ModuleIntro
                }
              >
                Control which Campaign Seat modules are available to this customer. Manual Admin changes are protected by fresh MFA, require an internal reason, and are recorded in Platform Admin history.
              </p>

              <div
                className={
                  styles.customer360ModuleGrid
                }
              >
                {entitlements.map(
                  (item) => {
                    const name =
                      item.display_name ||
                      item.module_name ||
                      pretty(
                        item.module_key,
                      );

                    return (
                      <article
                        key={
                          item.id ||
                          item.module_key
                        }
                      >
                        <div
                          className={
                            styles.customer360ModuleIcon
                          }
                        >
                          <Boxes
                            size={17}
                          />
                        </div>

                        <div
                          className={
                            styles.customer360ModuleIdentity
                          }
                        >
                          <strong>
                            {name}
                          </strong>

                          <span>
                            {pretty(
                              item.module_scope,
                            )}
                          </span>
                        </div>

                        <span
                          className={
                            styles.customer360ModuleSource
                          }
                        >
                          {pretty(
                            item.source_type,
                          )}
                        </span>

                        <button
                          type="button"
                          className={[
                            styles.customer360ModuleToggle,
                            item.enabled
                              ? styles.customer360ModuleToggleOn
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => {
                            setModuleReason("");

                            setModuleAction({
                              item,

                              enabled:
                                !item.enabled,
                            });
                          }}
                        >
                          <span />

                          {item.enabled
                            ? "Enabled"
                            : "Disabled"}
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            </article>


            {moduleAction && (
              <div
                className={
                  styles.customer360ModuleModalBackdrop
                }
              >
                <section
                  className={
                    styles.customer360ModuleModal
                  }
                >
                  <header>
                    <div>
                      <span>
                        Protected Admin action
                      </span>

                      <h2>
                        {moduleAction.enabled
                          ? "Enable"
                          : "Disable"}
                        {" "}
                        {moduleAction
                          .item
                          .display_name ||
                          moduleAction
                            .item
                            .module_name ||
                          pretty(
                            moduleAction
                              .item
                              .module_key,
                          )}
                      </h2>
                    </div>

                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => {
                        setModuleAction(
                          null,
                        );

                        setModuleReason(
                          "",
                        );
                      }}
                      disabled={
                        moduleBusy
                      }
                    >
                      ×
                    </button>
                  </header>

                  <p>
                    This creates a manual Platform Admin entitlement override. The previous entitlement source remains preserved in the account history.
                  </p>

                  <label>
                    <span>
                      Internal reason *
                    </span>

                    <textarea
                      value={
                        moduleReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setModuleReason(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Document why this customer's module access is changing."
                    />
                  </label>

                  <footer>
                    <button
                      type="button"
                      className={
                        styles.customer360ModuleCancel
                      }
                      onClick={() => {
                        setModuleAction(
                          null,
                        );

                        setModuleReason(
                          "",
                        );
                      }}
                      disabled={
                        moduleBusy
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className={
                        styles.customer360ModuleConfirm
                      }
                      onClick={
                        saveModuleChange
                      }
                      disabled={
                        moduleBusy ||
                        !moduleReason.trim()
                      }
                    >
                      {moduleBusy
                        ? "Applying…"
                        : "Confirm Change"}
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </section>
        ) : activeTab ===
          "team" ? (
          <section
            className={
              styles.customer360Team
            }
          >
            <div
              className={
                styles.customer360TeamSummary
              }
            >
              <article>
                <span>
                  Active members
                </span>

                <strong>
                  {activeSeats}
                </strong>
              </article>

              <article>
                <span>
                  Included seats
                </span>

                <strong>
                  {subscription
                    .included_user_seats ??
                    0}
                </strong>
              </article>

              <article>
                <span>
                  Available seats
                </span>

                <strong>
                  {Math.max(
                    0,
                    Number(
                      subscription
                        .included_user_seats ||
                      0,
                    ) -
                    activeSeats,
                  )}
                </strong>
              </article>
            </div>


            {teamNotice && (
              <div
                className={
                  styles.customer360BillingNotice
                }
              >
                <CheckCircle2
                  size={16}
                />

                {teamNotice}
              </div>
            )}


            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <Users
                  size={18}
                />

                <strong>
                  Team & Access
                </strong>

                <span
                  className={
                    styles.customer360TeamCount
                  }
                >
                  {activeSeats}
                  {" active · "}
                  {team.length}
                  {" total"}
                </span>
              </header>

              <p
                className={
                  styles.customer360TeamIntro
                }
              >
                Manage the people who can access this campaign workspace. Role and access changes require fresh MFA, an internal reason, and are recorded in Platform Admin history.
              </p>


              <div
                className={
                  styles.customer360TeamList
                }
              >
                {team.map(
                  (member) => {
                    const owner =
                      member.role_key ===
                      "campaign_owner";

                    const initials =
                      String(
                        member.full_name ||
                        member.email ||
                        "U",
                      )
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(
                          (part) =>
                            part
                              .charAt(0)
                              .toUpperCase(),
                        )
                        .join("");

                    return (
                      <article
                        key={
                          member.id
                        }
                      >
                        <div
                          className={
                            styles.customer360TeamAvatar
                          }
                        >
                          {initials}
                        </div>

                        <div
                          className={
                            styles.customer360TeamIdentity
                          }
                        >
                          <strong>
                            {member.full_name ||
                              member.email}
                          </strong>

                          <span>
                            {member.email}
                          </span>
                        </div>

                        <div
                          className={
                            styles.customer360TeamRole
                          }
                        >
                          <strong>
                            {pretty(
                              member.role_key,
                            )}
                          </strong>

                          <span>
                            {member.display_title ||
                              pretty(
                                member.seat_type,
                              )}
                          </span>
                        </div>

                        <div
                          className={
                            styles.customer360TeamAccess
                          }
                        >
                          <span
                            className={[
                              styles.customer360Status,
                              member.status ===
                                "active"
                                ? styles.customer360StatusGood
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {pretty(
                              member.status,
                            )}
                          </span>

                          {owner && (
                            <span
                              className={
                                styles.customer360OwnerBadge
                              }
                            >
                              Protected Owner
                            </span>
                          )}
                        </div>

                        <div
                          className={
                            styles.customer360TeamLastAccess
                          }
                        >
                          <span>
                            Last access
                          </span>

                          <strong>
                            {member.last_accessed_at
                              ? dateLabel(
                                  member.last_accessed_at,
                                )
                              : "No activity yet"}
                          </strong>
                        </div>

                        <button
                          type="button"
                          className={
                            styles.customer360TeamManage
                          }
                          onClick={() =>
                            openTeamManager(
                              member,
                            )
                          }
                        >
                          Manage
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            </article>


            {teamAction && (
              <div
                className={
                  styles.customer360TeamModalBackdrop
                }
              >
                <section
                  className={
                    styles.customer360TeamModal
                  }
                >
                  <header>
                    <div>
                      <span>
                        Protected Admin action
                      </span>

                      <h2>
                        Manage{" "}
                        {teamAction.full_name ||
                          teamAction.email}
                      </h2>
                    </div>

                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => {
                        setTeamAction(
                          null,
                        );

                        setTeamReason(
                          "",
                        );
                      }}
                      disabled={
                        teamBusy
                      }
                    >
                      ×
                    </button>
                  </header>


                  {teamAction.role_key ===
                    "campaign_owner" && (
                    <div
                      className={
                        styles.customer360OwnerProtection
                      }
                    >
                      <ShieldCheck
                        size={17}
                      />

                      <div>
                        <strong>
                          Campaign Owner protected
                        </strong>

                        <span>
                          The final active Campaign Owner cannot be removed or demoted. Ownership transfer requires a separate protected workflow.
                        </span>
                      </div>
                    </div>
                  )}


                  <div
                    className={
                      styles.customer360TeamModalGrid
                    }
                  >
                    <label>
                      <span>
                        Campaign role
                      </span>

                      <select
                        value={
                          teamRole
                        }
                        onChange={(
                          event,
                        ) =>
                          setTeamRole(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          teamBusy ||
                          teamAction.role_key ===
                            "campaign_owner"
                        }
                      >
                        {campaignRoles.length ? (
                          campaignRoles.map(
                            (role) => (
                              <option
                                key={
                                  role.key
                                }
                                value={
                                  role.key
                                }
                              >
                                {role.name}
                              </option>
                            ),
                          )
                        ) : (
                          <option
                            value={
                              teamRole
                            }
                          >
                            {pretty(
                              teamRole,
                            )}
                          </option>
                        )}
                      </select>
                    </label>


                    <label>
                      <span>
                        Display title
                      </span>

                      <input
                        value={
                          teamTitle
                        }
                        onChange={(
                          event,
                        ) =>
                          setTeamTitle(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          teamBusy
                        }
                      />
                    </label>


                    <label>
                      <span>
                        Access status
                      </span>

                      <select
                        value={
                          teamStatus
                        }
                        onChange={(
                          event,
                        ) =>
                          setTeamStatus(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          teamBusy ||
                          teamAction.role_key ===
                            "campaign_owner"
                        }
                      >
                        <option value="active">
                          Active
                        </option>

                        <option value="inactive">
                          Inactive
                        </option>
                      </select>
                    </label>
                  </div>


                  <label
                    className={
                      styles.customer360TeamReason
                    }
                  >
                    <span>
                      Internal reason *
                    </span>

                    <textarea
                      value={
                        teamReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setTeamReason(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Document why this campaign user's access is changing."
                    />
                  </label>


                  <footer>
                    <button
                      type="button"
                      className={
                        styles.customer360ModuleCancel
                      }
                      onClick={() => {
                        setTeamAction(
                          null,
                        );

                        setTeamReason(
                          "",
                        );
                      }}
                      disabled={
                        teamBusy
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className={
                        styles.customer360ModuleConfirm
                      }
                      onClick={
                        saveTeamChange
                      }
                      disabled={
                        teamBusy ||
                        !teamReason.trim()
                      }
                    >
                      {teamBusy
                        ? "Applying…"
                        : "Save Access Change"}
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </section>
        ) : activeTab ===
          "integrations" ? (
          <section
            className={
              styles.customer360Integrations
            }
          >
            <div
              className={
                styles.customer360IntegrationSummary
              }
            >
              <article>
                <span>
                  Connected
                </span>

                <strong>
                  {
                    integrations.filter(
                      (item) =>
                        item.status ===
                          "connected",
                    ).length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Integration records
                </span>

                <strong>
                  {integrations.length}
                </strong>
              </article>
            </div>

            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <Link2
                  size={18}
                />

                <strong>
                  Integrations
                </strong>

                <span
                  className={
                    styles.customer360TeamCount
                  }
                >
                  {integrations.length}
                  {" configured"}
                </span>
              </header>

              <p
                className={
                  styles.customer360TeamIntro
                }
              >
                Connected services attached to this Campaign Seat product account. Connection management remains separate from billing and workspace publishing.
              </p>

              <div
                className={
                  styles.customer360IntegrationGrid
                }
              >
                {integrations.map(
                  (integration) => (
                    <article
                      key={
                        integration.id
                      }
                    >
                      <div
                        className={
                          styles.customer360IntegrationIcon
                        }
                      >
                        <Link2
                          size={19}
                        />
                      </div>

                      <div
                        className={
                          styles.customer360IntegrationIdentity
                        }
                      >
                        <strong>
                          {integration
                            .integration_name}
                        </strong>

                        <span>
                          {integration
                            .display_email ||
                            integration
                              .display_name ||
                            pretty(
                              integration
                                .category,
                            )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.customer360IntegrationMeta
                        }
                      >
                        <span>
                          Category
                        </span>

                        <strong>
                          {pretty(
                            integration
                              .category,
                          )}
                        </strong>
                      </div>

                      <div
                        className={
                          styles.customer360IntegrationMeta
                        }
                      >
                        <span>
                          Last sync
                        </span>

                        <strong>
                          {dateTimeLabel(
                            integration
                              .last_synced_at,
                          )}
                        </strong>
                      </div>

                      <StatusPill
                        value={
                          integration.status
                        }
                      />
                    </article>
                  ),
                )}

                {!integrations.length && (
                  <div
                    className={
                      styles.customer360IntegrationEmpty
                    }
                  >
                    No integrations are connected to this customer yet.
                  </div>
                )}
              </div>
            </article>
          </section>
        ) : activeTab ===
          "history" ? (
          <section
            className={
              styles.customer360History
            }
          >
            {lifecycleNotice && (
              <div
                className={
                  styles.customer360BillingNotice
                }
              >
                <CheckCircle2
                  size={16}
                />

                {lifecycleNotice}
              </div>
            )}

            <div
              className={
                styles.customer360HistoryGrid
              }
            >
              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <ShieldCheck
                    size={18}
                  />

                  <strong>
                    Admin Security
                  </strong>
                </header>

                <div
                  className={
                    styles.customer360SecurityRows
                  }
                >
                  <div>
                    <span>
                      Platform MFA
                    </span>

                    <strong>
                      {data
                        ?.security
                        ?.aal2
                        ? "Verified"
                        : "Required"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Fresh authenticator
                    </span>

                    <strong>
                      {data
                        ?.security
                        ?.recent_totp
                        ? "Fresh"
                        : "Re-verification required"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Sensitive actions
                    </span>

                    <strong>
                      Fresh TOTP + reason
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={
                    styles.customer360ReverifyButton
                  }
                  onClick={
                    reverifyAuthenticator
                  }
                >
                  Re-verify Authenticator
                </button>
              </article>


              <article
                className={
                  styles.customer360Card
                }
              >
                <header>
                  <ShieldCheck
                    size={18}
                  />

                  <strong>
                    Account Lifecycle
                  </strong>

                  <StatusPill
                    value={
                      account.status
                    }
                  />
                </header>

                <p
                  className={
                    styles.customer360TeamIntro
                  }
                >
                  These controls change Campaign Seat product access only. They do not silently change subscription billing.
                </p>

                <div
                  className={
                    styles.customer360LifecycleButtons
                  }
                >
                  {account.status ===
                    "suspended" && (
                    <button
                      type="button"
                      className={
                        styles.customer360LifecyclePrimary
                      }
                      onClick={() => {
                        setLifecycleReason(
                          "",
                        );

                        setLifecycleAction(
                          "active",
                        );
                      }}
                    >
                      Reactivate Account
                    </button>
                  )}

                  {account.status ===
                    "active" && (
                    <button
                      type="button"
                      className={
                        styles.customer360LifecycleWarning
                      }
                      onClick={() => {
                        setLifecycleReason(
                          "",
                        );

                        setLifecycleAction(
                          "suspended",
                        );
                      }}
                    >
                      Suspend Account
                    </button>
                  )}

                  {account.status !==
                    "cancelled" && (
                    <button
                      type="button"
                      className={
                        styles.customer360LifecycleDanger
                      }
                      onClick={() => {
                        setLifecycleReason(
                          "",
                        );

                        setLifecycleAction(
                          "cancelled",
                        );
                      }}
                    >
                      Cancel Account
                    </button>
                  )}
                </div>
              </article>
            </div>


            <article
              className={
                styles.customer360Card
              }
            >
              <header>
                <FileClock
                  size={18}
                />

                <strong>
                  Platform Admin History
                </strong>

                <span
                  className={
                    styles.customer360TeamCount
                  }
                >
                  {(data?.audit || []).length}
                  {" recent events"}
                </span>
              </header>

              <div
                className={
                  styles.customer360AuditList
                }
              >
                {(data?.audit || []).map(
                  (entry) => (
                    <article
                      key={
                        entry.id
                      }
                    >
                      <div
                        className={
                          styles.customer360AuditIcon
                        }
                      >
                        <ShieldCheck
                          size={15}
                        />
                      </div>

                      <div
                        className={
                          styles.customer360AuditIdentity
                        }
                      >
                        <strong>
                          {pretty(
                            entry.action,
                          )}
                        </strong>

                        <span>
                          {entry.reason ||
                            pretty(
                              entry
                                .target_type,
                            )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.customer360AuditTarget
                        }
                      >
                        <span>
                          Target
                        </span>

                        <strong>
                          {pretty(
                            entry
                              .target_type,
                          )}
                        </strong>
                      </div>

                      <time>
                        {dateTimeLabel(
                          entry
                            .occurred_at,
                        )}
                      </time>
                    </article>
                  ),
                )}

                {!(data?.audit || []).length && (
                  <div
                    className={
                      styles.customer360IntegrationEmpty
                    }
                  >
                    No Customer 360 Admin actions have been recorded yet.
                  </div>
                )}
              </div>
            </article>


            {lifecycleAction && (
              <div
                className={
                  styles.customer360TeamModalBackdrop
                }
              >
                <section
                  className={
                    styles.customer360TeamModal
                  }
                >
                  <header>
                    <div>
                      <span>
                        Protected Admin action
                      </span>

                      <h2>
                        {lifecycleAction === "cancelled"
                          ? "Cancel Account"
                          : lifecycleAction === "suspended"
                            ? "Suspend Account"
                            : lifecycleAction === "active"
                              ? "Reactivate Account"
                              : `${pretty(
                                  lifecycleAction,
                                )} Account`}
                      </h2>
                    </div>

                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => {
                        setLifecycleAction(
                          null,
                        );

                        setLifecycleReason(
                          "",
                        );
                      }}
                      disabled={
                        lifecycleBusy
                      }
                    >
                      ×
                    </button>
                  </header>

                  <p
                    className={
                      styles.customer360TeamIntro
                    }
                  >
                    Product access changes require fresh authenticator verification and are permanently recorded in Platform Admin history.
                  </p>

                  {lifecycleAction ===
                    "cancelled" && (
                    <div
                      className={
                        styles.customer360LifecycleWarningBox
                      }
                    >
                      Cancellation cannot be casually reversed through the same Admin action.
                    </div>
                  )}

                  <label
                    className={
                      styles.customer360TeamReason
                    }
                  >
                    <span>
                      Internal reason *
                    </span>

                    <textarea
                      value={
                        lifecycleReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setLifecycleReason(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Document why this customer's Campaign Seat access is changing."
                    />
                  </label>

                  <footer>
                    <button
                      type="button"
                      className={
                        styles.customer360ModuleCancel
                      }
                      onClick={() => {
                        setLifecycleAction(
                          null,
                        );

                        setLifecycleReason(
                          "",
                        );
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className={
                        lifecycleAction ===
                          "active"
                          ? styles.customer360LifecyclePrimary
                          : styles.customer360LifecycleDanger
                      }
                      onClick={
                        saveLifecycleChange
                      }
                      disabled={
                        lifecycleBusy ||
                        !lifecycleReason.trim()
                      }
                    >
                      {lifecycleBusy
                        ? "Applying…"
                        : "Confirm Account Change"}
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </section>
        ) : (
          <section
            className={
              styles.customer360ComingNext
            }
          >
            <div>
              {
                (() => {
                  const tab =
                    TABS.find(
                      (item) =>
                        item.id ===
                        activeTab,
                    );

                  const Icon =
                    tab?.Icon ||
                    Activity;

                  return (
                    <Icon
                      size={25}
                    />
                  );
                })()
              }
            </div>

            <span>
              Customer 360
            </span>

            <h2>
              {
                TABS.find(
                  (item) =>
                    item.id ===
                    activeTab,
                )?.label
              }
            </h2>

            <p>
              This Customer 360 section is unavailable.
            </p>
          </section>
        )}
      </main>
    </PlatformAdminShell>
  );
}
