import {
  ArrowDownToLine,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DollarSign,
  FileText,
  HandCoins,
  HeartHandshake,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useFundraisingWorkspace,
} from "../../hooks/useFundraisingWorkspace";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./FundraisingReferencePreview.module.css";

const INITIAL_CONTRIBUTIONS = [
  {
    id: "contribution-1",
    donor: "Jennifer Davis",
    initials: "JD",
    amount: 250,
    date: "Sep 29",
    time: "9:42 AM",
    type: "Online",
    campaign: "General Fund",
    status: "Completed",
  },
  {
    id: "contribution-2",
    donor: "Robert Brown",
    initials: "RB",
    amount: 100,
    date: "Sep 29",
    time: "8:18 AM",
    type: "Online",
    campaign: "General Fund",
    status: "Completed",
  },
  {
    id: "contribution-3",
    donor: "Susan Miller",
    initials: "SM",
    amount: 500,
    date: "Sep 28",
    time: "7:10 PM",
    type: "Recurring",
    campaign: "Monthly Support",
    status: "Completed",
  },
  {
    id: "contribution-4",
    donor: "Tom Harris",
    initials: "TH",
    amount: 50,
    date: "Sep 28",
    time: "4:36 PM",
    type: "Mobile",
    campaign: "General Fund",
    status: "Completed",
  },
  {
    id: "contribution-5",
    donor: "Lisa White",
    initials: "LW",
    amount: 25,
    date: "Sep 28",
    time: "1:22 PM",
    type: "Online",
    campaign: "Field Program",
    status: "Completed",
  },
];

const INITIAL_DONORS = [
  {
    name: "Susan Miller",
    initials: "SM",
    lifetime: "$4,850",
    gifts: "12",
    last: "Sep 28",
    segment: "Recurring",
  },
  {
    name: "Jennifer Davis",
    initials: "JD",
    lifetime: "$2,750",
    gifts: "7",
    last: "Sep 29",
    segment: "Frequent",
  },
  {
    name: "Robert Brown",
    initials: "RB",
    lifetime: "$1,900",
    gifts: "5",
    last: "Sep 29",
    segment: "Active",
  },
  {
    name: "Lisa White",
    initials: "LW",
    lifetime: "$725",
    gifts: "9",
    last: "Sep 28",
    segment: "Recurring",
  },
  {
    name: "Tom Harris",
    initials: "TH",
    lifetime: "$550",
    gifts: "4",
    last: "Sep 28",
    segment: "Active",
  },
];

const GOALS = [
  {
    name: "General Fund",
    raised: "$92,400",
    goal: "$125,000",
    progress: 74,
  },
  {
    name: "Field Program",
    raised: "$31,280",
    goal: "$55,000",
    progress: 57,
  },
  {
    name: "Digital Outreach",
    raised: "$18,000",
    goal: "$40,000",
    progress: 45,
  },
];

const PLEDGES = [
  {
    donor: "Andrea Martin",
    amount: "$1,000",
    due: "Oct 2",
    owner: "Chris Herrerias",
    status: "Follow up",
  },
  {
    donor: "Michael Torres",
    amount: "$500",
    due: "Oct 4",
    owner: "Chris Herrerias",
    status: "Open",
  },
  {
    donor: "Rebecca Stone",
    amount: "$250",
    due: "Oct 5",
    owner: "Campaign team",
    status: "Open",
  },
];

function money(value) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function numberFromMoney(value) {
  const amount = Number(
    String(value || "")
      .replace(/[^0-9.-]+/g, ""),
  );

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "DN";
}


const FUNDRAISING_VIEWS = new Set([
  "overview",
  "contributions",
  "donors",
  "goals",
]);

function fundraisingKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readFundraisingLocation() {
  if (typeof window === "undefined") {
    return {
      view: "overview",
      detail: null,
    };
  }

  const url = new URL(window.location.href);

  const contributionId =
    url.searchParams.get("contribution");

  const donorId =
    url.searchParams.get("donor");

  const pledgeId =
    url.searchParams.get("pledge");

  let detail = null;
  let detailView = "";

  if (contributionId) {
    detail = {
      type: "contribution",
      id: contributionId,
    };
    detailView = "contributions";
  } else if (donorId) {
    detail = {
      type: "donor",
      id: donorId,
    };
    detailView = "donors";
  } else if (pledgeId) {
    detail = {
      type: "pledge",
      id: pledgeId,
    };
    detailView = "goals";
  }

  const requestedView =
    url.searchParams.get("fundraising-view");

  const view = detailView ||
    (
      FUNDRAISING_VIEWS.has(requestedView)
        ? requestedView
        : "overview"
    );

  return {
    view,
    detail,
  };
}

function handleInteractiveKey(event, action) {
  if (
    event.key !== "Enter" &&
    event.key !== " "
  ) {
    return;
  }

  event.preventDefault();
  action();
}

export default function FundraisingReferencePreview() {
  const demoMode =
    typeof window !== "undefined" &&
    new URL(
      window.location.href,
    )
      .searchParams
      .get(
        "fundraising-demo",
      ) ===
      "1";

  const workspace =
    getCurrentWorkspace();

  const currentUser =
    getCurrentUser();

  const liveFundraising =
    useFundraisingWorkspace({
      enabled:
        !demoMode,

      workspaceId:
        workspace?.id ||
        "",

      timezone:
        workspace?.timezone ||
        "America/New_York",

      currentUserId:
        currentUser?.id ||
        "",

      currentUserName:
        currentUser?.name ||
        "",
    });

  const [
    activeView,
    setActiveView,
  ] = useState(
    () => readFundraisingLocation().view,
  );

  const [
    detailState,
    setDetailState,
  ] = useState(
    () => readFundraisingLocation().detail,
  );

  const [
    previewContributions,
    setPreviewContributions,
  ] = useState(
    INITIAL_CONTRIBUTIONS,
  );

  const [
    previewDonors,
    setPreviewDonors,
  ] = useState(
    INITIAL_DONORS,
  );

  const contributions =
    demoMode
      ? previewContributions
      : liveFundraising
          .contributions;

  const donors =
    demoMode
      ? previewDonors
      : liveFundraising
          .donors;

  const goals =
    demoMode
      ? GOALS
      : liveFundraising
          .goals;

  const pledges =
    demoMode
      ? PLEDGES
      : liveFundraising
          .pledges;

  const [
    contributionModalOpen,
    setContributionModalOpen,
  ] = useState(false);

  const [
    donorModalOpen,
    setDonorModalOpen,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    contributionForm,
    setContributionForm,
  ] = useState({
    donor: "",
    amount: "",
    type: "Online",
    campaign:
      demoMode
        ? "General Fund"
        : "",
  });

  const [
    donorForm,
    setDonorForm,
  ] = useState({
    name: "",
    email: "",
    phone: "",
    segment: "Active",
  });

  const [
    activityMessage,
    setActivityMessage,
  ] = useState("");

  const applyFundraisingLocation = (
    nextView,
    nextDetail = null,
    {
      replace = false,
    } = {},
  ) => {
    const url = new URL(window.location.href);

    url.searchParams.set(
      "fundraising-view",
      nextView,
    );

    url.searchParams.delete("contribution");
    url.searchParams.delete("donor");
    url.searchParams.delete("pledge");

    if (nextDetail?.type && nextDetail?.id) {
      url.searchParams.set(
        nextDetail.type,
        nextDetail.id,
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

    setActiveView(nextView);
    setDetailState(nextDetail);
  };

  const navigateView = (nextView) => {
    applyFundraisingLocation(
      nextView,
      null,
    );
  };

  const openContribution = (contribution) => {
    applyFundraisingLocation(
      "contributions",
      {
        type: "contribution",
        id: contribution.id,
      },
    );
  };

  const openDonor = (donorOrName) => {
    const donorName =
      typeof donorOrName === "string"
        ? donorOrName
        : donorOrName?.name;

    const donorId =
      typeof donorOrName === "string"
        ? fundraisingKey(
            donorName,
          )
        : (
            donorOrName?.id ||
            donorOrName
              ?.contactId ||
            fundraisingKey(
              donorName,
            )
          );

    applyFundraisingLocation(
      "donors",
      {
        type: "donor",
        id: donorId,
      },
    );
  };

  const openPledge = (pledge) => {
    applyFundraisingLocation(
      "goals",
      {
        type: "pledge",
        id:
          pledge?.id ||
          fundraisingKey(
            pledge?.donor,
          ),
      },
    );
  };

  const closeDetail = () => {
    applyFundraisingLocation(
      activeView,
      null,
      {
        replace: true,
      },
    );
  };

  useEffect(() => {
    const syncFromBrowserHistory = () => {
      const next =
        readFundraisingLocation();

      setActiveView(next.view);
      setDetailState(next.detail);
      setContributionModalOpen(false);
      setDonorModalOpen(false);
    };

    window.addEventListener(
      "popstate",
      syncFromBrowserHistory,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncFromBrowserHistory,
      );
    };
  }, []);


  const addedTotal = useMemo(
    () =>
      demoMode
        ? previewContributions
            .slice(
              INITIAL_CONTRIBUTIONS.length,
            )
            .reduce(
              (sum, contribution) =>
                sum +
                Number(
                  contribution.amount ||
                  0,
                ),
              0,
            )
        : 0,
    [
      demoMode,
      previewContributions,
    ],
  );

  const totalRaised =
    demoMode
      ? 142680 +
        addedTotal
      : liveFundraising
          .metrics
          .totalRaised;

  const fundraisingGoal =
    demoMode
      ? 220000
      : liveFundraising
          .metrics
          .fundraisingGoal;

  const progressPercent =
    fundraisingGoal >
      0
      ? Math.min(
          100,
          Math.round(
            (
              totalRaised /
              fundraisingGoal
            ) *
            100,
          ),
        )
      : 0;

  const contributionCount =
    demoMode
      ? 482 +
        previewContributions.length -
        INITIAL_CONTRIBUTIONS.length
      : contributions.length;

  const activeDonorCount =
    demoMode
      ? 318 +
        previewDonors.length -
        INITIAL_DONORS.length
      : donors.length;

  const recurringDonorCount =
    demoMode
      ? 86
      : liveFundraising
          .metrics
          .recurringDonorCount;

  const recurringDonorCopy =
    demoMode
      ? "$18,640 monthly"
      : `${money(
          liveFundraising
            .metrics
            .recurringRaised,
        )} recorded recurring`;

  const pledgeAttentionCount =
    demoMode
      ? 3
      : liveFundraising
          .metrics
          .openPledges;

  const donorAttentionCount =
    demoMode
      ? 6
      : liveFundraising
          .metrics
          .incompleteDonors;

  const receiptAttentionCount =
    demoMode
      ? 4
      : liveFundraising
          .metrics
          .pendingReceipts;

  const receiptActivityCount =
    demoMode
      ? 12
      : liveFundraising
          .metrics
          .sentReceipts;

  const visibleContributions = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    if (!needle) {
      return contributions;
    }

    return contributions.filter((contribution) =>
      [
        contribution.donor,
        contribution.type,
        contribution.campaign,
        contribution.status,
      ].some((value) =>
        String(value)
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [
    contributions,
    searchTerm,
  ]);


  const selectedContribution =
    detailState?.type === "contribution"
      ? contributions.find(
          (contribution) =>
            contribution.id === detailState.id,
        ) || null
      : null;

  const selectedDonor =
    detailState?.type === "donor"
      ? donors.find(
          (donor) =>
            donor.id ===
              detailState.id ||
            donor.contactId ===
              detailState.id ||
            fundraisingKey(
              donor.name,
            ) ===
              detailState.id,
        ) || null
      : null;

  const selectedPledge =
    detailState?.type === "pledge"
      ? pledges.find(
          (pledge) =>
            pledge.id ===
              detailState.id ||
            fundraisingKey(
              pledge.donor,
            ) ===
              detailState.id,
        ) || null
      : null;

  const handleAddDonor = async (event) => {
    event.preventDefault();

    const name = donorForm.name.trim();

    if (!name) {
      return;
    }

    const existingDonor = donors.find(
      (donor) =>
        fundraisingKey(donor.name) ===
        fundraisingKey(name),
    );

    if (existingDonor) {
      setDonorModalOpen(false);
      openDonor(existingDonor);
      setActivityMessage(
        `${existingDonor.name} already has a donor relationship record.`,
      );
      return;
    }

    if (!demoMode) {
      try {
        const newDonor =
          await liveFundraising
            .addDonor({
              name,
              email:
                donorForm.email,
              phone:
                donorForm.phone,
              segment:
                donorForm.segment,
            });

        setDonorForm({
          name: "",
          email: "",
          phone: "",
          segment: "Active",
        });

        setDonorModalOpen(false);
        openDonor(newDonor);

        setActivityMessage(
          `${name} saved to the live campaign donor directory.`,
        );
      } catch (
        donorError
      ) {
        console.error(
          "[Fundraising] donor save failed",
          donorError,
        );

        setActivityMessage(
          `Unable to save donor: ${
            donorError?.message ||
            "campaign access denied"
          }`,
        );
      }

      return;
    }

    const newDonor = {
      name,
      initials: initialsFor(name),
      lifetime: money(0),
      gifts: "0",
      last: "No gifts yet",
      segment: donorForm.segment,
      email: donorForm.email.trim(),
      phone: donorForm.phone.trim(),
    };

    setPreviewDonors((current) => [
      newDonor,
      ...current,
    ]);

    setDonorForm({
      name: "",
      email: "",
      phone: "",
      segment: "Active",
    });

    setDonorModalOpen(false);
    openDonor(newDonor);

    setActivityMessage(
      `${name} added to donor relationships in this browser preview.`,
    );
  };

  const handleRecordContribution = async (event) => {
    event.preventDefault();

    const donor = contributionForm.donor.trim();
    const amount = Number(contributionForm.amount);

    if (!donor || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (!demoMode) {
      try {
        const savedContribution =
          await liveFundraising
            .recordContribution({
              donorName:
                donor,

              amount,

              type:
                contributionForm.type,

              goalId:
                contributionForm.campaign ||
                null,
            });

        setContributionForm({
          donor: "",
          amount: "",
          type: "Online",
          campaign: "",
        });

        setContributionModalOpen(false);

        openContribution(
          savedContribution,
        );

        setActivityMessage(
          `${money(amount)} contribution from ${donor} saved to the live campaign ledger.`,
        );
      } catch (
        contributionError
      ) {
        console.error(
          "[Fundraising] contribution save failed",
          contributionError,
        );

        setActivityMessage(
          `Unable to save contribution: ${
            contributionError?.message ||
            "campaign access denied"
          }`,
        );
      }

      return;
    }

    const newContribution = {
      id: `preview-${Date.now()}`,
      donor,
      initials: initialsFor(donor),
      amount,
      date: "Sep 29",
      time: "Now",
      type: contributionForm.type,
      campaign: contributionForm.campaign,
      status: "Completed",
    };

    setPreviewContributions((current) => [
      newContribution,
      ...current,
    ]);

    setPreviewDonors((current) => {
      const donorKey = fundraisingKey(donor);

      const existingIndex = current.findIndex(
        (record) =>
          fundraisingKey(record.name) === donorKey,
      );

      if (existingIndex === -1) {
        return [
          {
            name: donor,
            initials: initialsFor(donor),
            lifetime: money(amount),
            gifts: "1",
            last: "Sep 29",
            segment: "New",
            email: "",
            phone: "",
          },
          ...current,
        ];
      }

      return current.map((record, index) => {
        if (index !== existingIndex) {
          return record;
        }

        return {
          ...record,
          lifetime: money(
            numberFromMoney(record.lifetime) + amount,
          ),
          gifts: String(
            Number(record.gifts || 0) + 1,
          ),
          last: "Sep 29",
        };
      });
    });

    setContributionForm({
      donor: "",
      amount: "",
      type: "Online",
      campaign: "General Fund",
    });

    setContributionModalOpen(false);

    openContribution(newContribution);

    setActivityMessage(
      `${money(amount)} contribution from ${donor} recorded in this browser preview.`,
    );
  };

  return (
    <CampaignWorkspaceShell activeItem="Fundraising">
      <main
        className={styles.main}
        data-fundraising-command-center="true"
        data-fundraising-deep-links="true"
        data-fundraising-donor-workflows="true"
        data-fundraising-storage={
          demoMode
            ? "preview"
            : "live"
        }
      >
        <div className={styles.canvas}>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>
                Fundraising operations
              </span>

              <h1>Fundraising Command Center</h1>

              <p>
                Track contributions, donors, goals,
                recurring support, pledges, receipts, and
                follow-up from one campaign workspace.
              </p>
            </div>

            <div className={styles.heroActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={async () => {
                  if (
                    demoMode
                  ) {
                    setActivityMessage(
                      "Fundraising preview refreshed.",
                    );

                    return;
                  }

                  const refreshed =
                    await liveFundraising
                      .refresh();

                  setActivityMessage(
                    refreshed
                      ? "Live fundraising workspace refreshed."
                      : "Unable to refresh live fundraising records.",
                  );
                }}
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                className={styles.primaryButton}
                type="button"
                onClick={() =>
                  setContributionModalOpen(true)
                }
              >
                <Plus size={18} />
                Record contribution
              </button>
            </div>
          </section>

          {!demoMode ? (
            <div
              className={styles.liveStorageStatus}
              data-state={
                liveFundraising.error
                  ? "error"
                  : liveFundraising.loading
                    ? "loading"
                    : "ready"
              }
            >
              {liveFundraising.loading ? (
                <RefreshCw size={16} />
              ) : liveFundraising.error ? (
                <X size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}

              <span>
                {liveFundraising.loading
                  ? "Loading live campaign fundraising records…"
                  : liveFundraising.error
                    ? liveFundraising.error
                    : "Live Campaign Seat fundraising storage connected"}
              </span>
            </div>
          ) : null}

          {activityMessage ? (
            <div
              className={styles.activityNotice}
              role="status"
            >
              <CheckCircle2 size={17} />
              <span>{activityMessage}</span>

              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setActivityMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}

          <section
            className={styles.metrics}
            aria-label="Fundraising summary"
          >
            <button
              type="button"
              className={
                activeView === "overview"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                navigateView("overview")
              }
            >
              <span className={styles.metricIcon}>
                <CircleDollarSign size={22} />
              </span>

              <span>
                <small>Total raised</small>
                <strong>{money(totalRaised)}</strong>
                <em>
                  {
                    !demoMode &&
                    fundraisingGoal <= 0
                      ? "No active fundraising goal yet"
                      : `${progressPercent}% of ${money(
                          fundraisingGoal,
                        )}`
                  }
                </em>
              </span>
            </button>

            <button
              type="button"
              className={
                activeView === "contributions"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                navigateView("contributions")
              }
            >
              <span className={styles.metricIcon}>
                <HandCoins size={22} />
              </span>

              <span>
                <small>Contributions</small>
                <strong>{contributionCount}</strong>
                <em>
                  {demoMode
                    ? "Campaign-to-date records"
                    : "Live workspace records"}
                </em>
              </span>
            </button>

            <button
              type="button"
              className={
                activeView === "donors"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                navigateView("donors")
              }
            >
              <span className={styles.metricIcon}>
                <Users size={22} />
              </span>

              <span>
                <small>Active donors</small>
                <strong>
                  {activeDonorCount}
                </strong>
                <em>
                  {demoMode
                    ? "124 new this cycle"
                    : `${donors.length} donor relationship records`}
                </em>
              </span>
            </button>

            <button
              type="button"
              className={
                activeView === "goals"
                  ? styles.metricActive
                  : ""
              }
              onClick={() =>
                navigateView("goals")
              }
            >
              <span className={styles.metricIcon}>
                <TrendingUp size={22} />
              </span>

              <span>
                <small>Recurring donors</small>
                <strong>
                  {recurringDonorCount}
                </strong>
                <em>
                  {recurringDonorCopy}
                </em>
              </span>
            </button>
          </section>

          <section className={styles.workspace}>
            <div className={styles.primaryColumn}>
              <nav
                className={styles.tabs}
                aria-label="Fundraising views"
              >
                <button
                  type="button"
                  className={
                    activeView === "overview"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    navigateView("overview")
                  }
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={
                    activeView === "contributions"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    navigateView("contributions")
                  }
                >
                  Contributions
                </button>

                <button
                  type="button"
                  className={
                    activeView === "donors"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    navigateView("donors")
                  }
                >
                  Donors
                </button>

                <button
                  type="button"
                  className={
                    activeView === "goals"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    navigateView("goals")
                  }
                >
                  Goals &amp; pledges
                </button>
              </nav>

              {activeView === "overview" ? (
                <>
                  <section className={styles.progressPanel}>
                    <header>
                      <div>
                        <span className={styles.sectionIcon}>
                          <TrendingUp size={20} />
                        </span>

                        <div>
                          <h2>Fundraising progress</h2>
                          <p>
                            Campaign-wide progress against the
                            current fundraising target.
                          </p>
                        </div>
                      </div>

                      <span className={styles.periodPill}>
                        <CalendarDays size={15} />
                        Current cycle
                      </span>
                    </header>

                    <div className={styles.progressSummary}>
                      <div>
                        <small>Raised</small>
                        <strong>{money(totalRaised)}</strong>
                      </div>

                      <div>
                        <small>Goal</small>
                        <strong>{money(fundraisingGoal)}</strong>
                      </div>

                      <div>
                        <small>Remaining</small>
                        <strong>
                          {money(
                            Math.max(
                              0,
                              fundraisingGoal - totalRaised,
                            ),
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.progressTrackLarge}>
                      <span
                        style={{
                          width: `${progressPercent}%`,
                        }}
                      />
                    </div>

                    <div className={styles.progressFooter}>
                      <span>
                        {progressPercent}% complete
                      </span>
                      <span>
                        {demoMode
                          ? "86 recurring donors contributing monthly"
                          : `${recurringDonorCount} recurring donor relationships`}
                      </span>
                    </div>
                  </section>

                  <ContributionTable
                    contributions={contributions.slice(0, 5)}
                    title="Recent contributions"
                    subtitle="Latest contribution activity across the campaign."
                    onViewAll={() =>
                      navigateView("contributions")
                    }
                    onSelect={openContribution}
                    selectedId={
                      detailState?.type === "contribution"
                        ? detailState.id
                        : ""
                    }
                  />
                </>
              ) : null}

              {activeView === "contributions" ? (
                <section className={styles.tablePanel}>
                  <header className={styles.tablePanelHeader}>
                    <div>
                      <h2>Contributions</h2>
                      <p>
                        Search and review recorded campaign
                        contributions.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.smallPrimary}
                      onClick={() =>
                        setContributionModalOpen(true)
                      }
                    >
                      <Plus size={16} />
                      Record contribution
                    </button>
                  </header>

                  <div className={styles.searchRow}>
                    <Search size={18} />

                    <input
                      type="search"
                      value={searchTerm}
                      placeholder="Search donor, campaign, type, or status"
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                    />
                  </div>

                  <ContributionRows
                    contributions={visibleContributions}
                    onSelect={openContribution}
                    selectedId={
                      detailState?.type === "contribution"
                        ? detailState.id
                        : ""
                    }
                  />
                </section>
              ) : null}

              {activeView === "donors" ? (
                <section className={styles.tablePanel}>
                  <header className={styles.tablePanelHeader}>
                    <div>
                      <h2>Donor relationships</h2>
                      <p>
                        Review donor activity, giving history,
                        and recurring support.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.smallPrimary}
                      onClick={() =>
                        setDonorModalOpen(true)
                      }
                    >
                      <UserPlus size={16} />
                      Add donor
                    </button>
                  </header>

                  <div className={styles.donorTable}>
                    <div className={styles.donorHeading}>
                      <span>Donor</span>
                      <span>Lifetime giving</span>
                      <span>Gifts</span>
                      <span>Last contribution</span>
                      <span>Segment</span>
                    </div>

                    {donors.length ? (
                      donors.map((donor) => (
                      <article
                        key={donor.name}
                        role="button"
                        tabIndex={0}
                        className={
                          detailState?.type === "donor" &&
                          (
                            detailState.id ===
                              donor.id ||
                            detailState.id ===
                              donor.contactId ||
                            detailState.id ===
                              fundraisingKey(
                                donor.name,
                              )
                          )
                            ? styles.rowSelected
                            : styles.clickableRow
                        }
                        onClick={() =>
                          openDonor(donor)
                        }
                        onKeyDown={(event) =>
                          handleInteractiveKey(
                            event,
                            () => openDonor(donor),
                          )
                        }
                      >
                        <div className={styles.personCell}>
                          <span>{donor.initials}</span>

                          <div>
                            <strong>{donor.name}</strong>
                            <small>
                              Campaign donor record
                            </small>
                          </div>
                        </div>

                        <b>{donor.lifetime}</b>
                        <span>{donor.gifts}</span>
                        <span>{donor.last}</span>

                        <em>{donor.segment}</em>
                      </article>
                      ))
                    ) : (
                      <div className={styles.tableEmpty}>
                        <Users size={24} />

                        <strong>
                          No donor relationships yet
                        </strong>

                        <span>
                          Add the first donor or record a contribution to begin the live fundraising history.
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeView === "goals" ? (
                <>
                  <section className={styles.goalGrid}>
                    {goals.length ? (
                      goals.map((goal) => (
                      <article key={goal.id || goal.name}>
                        <header>
                          <span>
                            <WalletCards size={18} />
                          </span>

                          <strong>{goal.name}</strong>
                        </header>

                        <div>
                          <b>{goal.raised}</b>
                          <small>of {goal.goal}</small>
                        </div>

                        <div className={styles.goalTrack}>
                          <span
                            style={{
                              width: `${goal.progress}%`,
                            }}
                          />
                        </div>

                        <footer>
                          <span>{goal.progress}% funded</span>
                          <span>
                            {goal.status || "Active"}
                          </span>
                        </footer>
                      </article>
                      ))
                    ) : (
                      <div className={styles.emptyPanel}>
                        <WalletCards size={25} />

                        <strong>
                          No fundraising goals yet
                        </strong>

                        <span>
                          The live fundraising foundation is connected and ready for goal setup.
                        </span>
                      </div>
                    )}
                  </section>

                  <section className={styles.tablePanel}>
                    <header className={styles.tablePanelHeader}>
                      <div>
                        <h2>Open pledges</h2>
                        <p>
                          Commitments requiring campaign
                          follow-up.
                        </p>
                      </div>
                    </header>

                    <div className={styles.pledgeTable}>
                      <div className={styles.pledgeHeading}>
                        <span>Donor</span>
                        <span>Amount</span>
                        <span>Due</span>
                        <span>Owner</span>
                        <span>Status</span>
                      </div>

                      {pledges.length ? (
                        pledges.map((pledge) => (
                        <article
                          key={pledge.id || pledge.donor}
                          role="button"
                          tabIndex={0}
                          className={
                            detailState?.type === "pledge" &&
                            (
                              detailState.id ===
                                pledge.id ||
                              detailState.id ===
                                fundraisingKey(
                                  pledge.donor,
                                )
                            )
                              ? styles.rowSelected
                              : styles.clickableRow
                          }
                          onClick={() =>
                            openPledge(pledge)
                          }
                          onKeyDown={(event) =>
                            handleInteractiveKey(
                              event,
                              () => openPledge(pledge),
                            )
                          }
                        >
                          <strong>{pledge.donor}</strong>
                          <b>{pledge.amount}</b>
                          <span>{pledge.due}</span>
                          <span>{pledge.owner}</span>
                          <em>{pledge.status}</em>
                        </article>
                        ))
                      ) : (
                        <div className={styles.tableEmpty}>
                          <HeartHandshake size={24} />

                          <strong>
                            No open pledges
                          </strong>

                          <span>
                            Live campaign pledges will appear here when they are created.
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : null}
            </div>

            <aside className={styles.rightRail}>
              <section className={styles.attentionCard}>
                <header>
                  <span>
                    <Sparkles size={19} />
                  </span>

                  <div>
                    <h2>Needs attention</h2>
                    <p>
                      Fundraising work that needs a next
                      action.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    navigateView("goals")
                  }
                >
                  <div>
                    <strong>
                      {pledgeAttentionCount} pledges need follow-up
                    </strong>
                    <span>
                      {demoMode
                        ? "Next due Oct 2"
                        : liveFundraising.metrics.nextPledgeDue
                          ? `Next due ${liveFundraising.metrics.nextPledgeDue}`
                          : "No pledge follow-up currently due"}
                    </span>
                  </div>

                  <em>
                    {pledgeAttentionCount}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigateView("donors")
                  }
                >
                  <div>
                    <strong>
                      {donorAttentionCount} donor records need details
                    </strong>
                    <span>
                      Review incomplete contact records
                    </span>
                  </div>

                  <em>
                    {donorAttentionCount}
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigateView("contributions")
                  }
                >
                  <div>
                    <strong>
                      {receiptAttentionCount} acknowledgements queued
                    </strong>
                    <span>
                      Contribution receipt follow-up
                    </span>
                  </div>

                  <em>
                    {receiptAttentionCount}
                  </em>
                </button>
              </section>

              <section className={styles.quickCard}>
                <header>
                  <h2>Quick actions</h2>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    setContributionModalOpen(true)
                  }
                >
                  <DollarSign size={18} />
                  Record contribution
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigateView("donors")
                  }
                >
                  <Users size={18} />
                  Review donors
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigateView("goals")
                  }
                >
                  <HeartHandshake size={18} />
                  Review pledges
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivityMessage(
                      demoMode
                        ? "Fundraising report export is preview-only in V73B demo mode."
                        : "Fundraising export is not connected yet; live ledger data remains in Campaign Seat.",
                    )
                  }
                >
                  <ArrowDownToLine size={18} />
                  Export report
                </button>
              </section>

              <section className={styles.receiptCard}>
                <span>
                  <Mail size={21} />
                </span>

                <div>
                  <strong>Receipt activity</strong>
                  <p>
                    {receiptActivityCount} acknowledgements recorded.
                  </p>
                </div>
              </section>
            </aside>
          </section>

          <footer className={styles.previewNote}>
            <FileText size={16} />
            <span>
              {demoMode
                ? "V73B demo mode uses local preview data only."
                : "V73B is reading and writing live Campaign Seat fundraising records. Payment processing and external receipt delivery remain disconnected."}
            </span>
          </footer>
        </div>

        <FundraisingDetailDrawer
          detailState={detailState}
          contribution={selectedContribution}
          donor={selectedDonor}
          pledge={selectedPledge}
          onClose={closeDetail}
          onOpenDonor={openDonor}
          liveMode={!demoMode}
        />

        {donorModalOpen ? (
          <div
            className={styles.modalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDonorModalOpen(false);
              }
            }}
          >
            <form
              className={styles.modal}
              onSubmit={handleAddDonor}
            >
              <header>
                <div>
                  <span>Donor relationships</span>
                  <h2>Add donor</h2>
                </div>

                <button
                  type="button"
                  aria-label="Close donor form"
                  onClick={() =>
                    setDonorModalOpen(false)
                  }
                >
                  <X size={20} />
                </button>
              </header>

              <label>
                Donor name
                <input
                  type="text"
                  value={donorForm.name}
                  placeholder="Full name"
                  required
                  autoFocus
                  onChange={(event) =>
                    setDonorForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <div className={styles.modalGrid}>
                <label>
                  Email
                  <input
                    type="email"
                    value={donorForm.email}
                    placeholder="name@example.com"
                    onChange={(event) =>
                      setDonorForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Phone
                  <input
                    type="tel"
                    value={donorForm.phone}
                    placeholder="(561) 555-0000"
                    onChange={(event) =>
                      setDonorForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label>
                Relationship segment
                <select
                  value={donorForm.segment}
                  onChange={(event) =>
                    setDonorForm((current) => ({
                      ...current,
                      segment: event.target.value,
                    }))
                  }
                >
                  <option>Active</option>
                  <option>Recurring</option>
                  <option>Frequent</option>
                  <option>Prospect</option>
                  <option>New</option>
                </select>
              </label>

              <div className={styles.modalInfo}>
                <Clock3 size={17} />

                <span>
                  {demoMode
                    ? "Demo donor records remain local to this browser preview."
                    : "This donor will be saved to the live campaign Contacts donor directory."}
                </span>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setDonorModalOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.modalSubmit}
                >
                  <UserPlus size={17} />
                  Add donor
                </button>
              </footer>
            </form>
          </div>
        ) : null}

        {contributionModalOpen ? (
          <div
            className={styles.modalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setContributionModalOpen(false);
              }
            }}
          >
            <form
              className={styles.modal}
              onSubmit={handleRecordContribution}
            >
              <header>
                <div>
                  <span>Fundraising</span>
                  <h2>Record contribution</h2>
                </div>

                <button
                  type="button"
                  aria-label="Close contribution form"
                  onClick={() =>
                    setContributionModalOpen(false)
                  }
                >
                  <X size={20} />
                </button>
              </header>

              <label>
                Donor name
                <input
                  type="text"
                  value={contributionForm.donor}
                  placeholder="Full name"
                  required
                  autoFocus
                  onChange={(event) =>
                    setContributionForm((current) => ({
                      ...current,
                      donor: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Amount
                <div className={styles.amountField}>
                  <span>$</span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={contributionForm.amount}
                    placeholder="0"
                    required
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>

              <div className={styles.modalGrid}>
                <label>
                  Contribution type
                  <select
                    value={contributionForm.type}
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                  >
                    <option>Online</option>
                    <option>Recurring</option>
                    <option>Mobile</option>
                    <option>Check</option>
                    <option>In person</option>
                  </select>
                </label>

                <label>
                  Campaign
                  <select
                    value={contributionForm.campaign}
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        campaign: event.target.value,
                      }))
                    }
                  >
                    {demoMode ? (
                      <>
                        <option>General Fund</option>
                        <option>Field Program</option>
                        <option>Digital Outreach</option>
                        <option>Monthly Support</option>
                      </>
                    ) : (
                      <>
                        <option value="">
                          Unassigned
                        </option>

                        {goals.map((goal) => (
                          <option
                            key={goal.id}
                            value={goal.id}
                          >
                            {goal.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
              </div>

              <div className={styles.modalInfo}>
                <Clock3 size={17} />

                <span>
                  {demoMode
                    ? "This demo contribution stays in the current browser session."
                    : "This contribution will be written to the live Campaign Seat fundraising ledger."}
                </span>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setContributionModalOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.modalSubmit}
                >
                  <DollarSign size={17} />
                  Record contribution
                </button>
              </footer>
            </form>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function FundraisingDetailDrawer({
  detailState,
  contribution,
  donor,
  pledge,
  onClose,
  onOpenDonor,
  liveMode,
}) {
  if (!detailState) {
    return null;
  }

  const hasRecord =
    Boolean(contribution) ||
    Boolean(donor) ||
    Boolean(pledge);

  let eyebrow = "Fundraising details";
  let title = "Record unavailable";
  let subtitle =
    liveMode
      ? "This live fundraising record is not available or is outside your current campaign access."
      : "This preview record is not available in the current browser session.";

  if (contribution) {
    eyebrow = "Contribution details";
    title = contribution.donor;
    subtitle =
      `${contribution.date} · ${contribution.time}`;
  } else if (donor) {
    eyebrow = "Donor relationship";
    title = donor.name;
    subtitle = donor.segment;
  } else if (pledge) {
    eyebrow = "Pledge details";
    title = pledge.donor;
    subtitle = pledge.status;
  }

  return (
    <div
      className={styles.detailScrim}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className={styles.detailDrawer}
        role="dialog"
        aria-modal="true"
        aria-label={eyebrow}
      >
        <header className={styles.detailHeader}>
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <button
            type="button"
            aria-label="Close fundraising details"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>

        {!hasRecord ? (
          <div className={styles.detailBody}>
            <section className={styles.detailEmpty}>
              <FileText size={28} />
              <h3>Preview record unavailable</h3>
              <p>
                {liveMode
                  ? "This URL does not resolve to a live fundraising record available to your campaign role."
                  : "This URL points to local preview data that is not present in this browser session."}
              </p>

              <button
                type="button"
                onClick={onClose}
              >
                Return to fundraising
              </button>
            </section>
          </div>
        ) : null}

        {contribution ? (
          <div className={styles.detailBody}>
            <section className={styles.detailHero}>
              <span className={styles.detailStatus}>
                <CheckCircle2 size={15} />
                {contribution.status}
              </span>

              <strong>
                {money(contribution.amount)}
              </strong>

              <p>
                Recorded for {contribution.campaign}
              </p>
            </section>

            <section className={styles.detailGrid}>
              <div>
                <small>Donor</small>
                <strong>{contribution.donor}</strong>
              </div>

              <div>
                <small>Contribution type</small>
                <strong>{contribution.type}</strong>
              </div>

              <div>
                <small>Date</small>
                <strong>{contribution.date}</strong>
              </div>

              <div>
                <small>Time</small>
                <strong>{contribution.time}</strong>
              </div>

              <div>
                <small>Campaign</small>
                <strong>{contribution.campaign}</strong>
              </div>

              <div>
                <small>Status</small>
                <strong>{contribution.status}</strong>
              </div>
            </section>

            <section className={styles.detailSection}>
              <div>
                <span className={styles.sectionIcon}>
                  <Mail size={18} />
                </span>

                <div>
                  <h3>Receipt & follow-up</h3>
                  <p>
                    {liveMode
                      ? `Receipt status: ${contribution.receiptStatus || "pending"}. External delivery is not connected yet.`
                      : "Contribution acknowledgement is represented by preview data only."}
                  </p>
                </div>
              </div>
            </section>

            <button
              type="button"
              className={styles.detailAction}
              onClick={() =>
                onOpenDonor({
                  id:
                    contribution.donorContactId ||
                    "",
                  name:
                    contribution.donor,
                })
              }
            >
              <Users size={18} />
              Open donor relationship
            </button>
          </div>
        ) : null}

        {donor ? (
          <div className={styles.detailBody}>
            <section className={styles.detailHero}>
              <span className={styles.detailStatus}>
                <Users size={15} />
                {donor.segment}
              </span>

              <strong>{donor.lifetime}</strong>

              <p>Lifetime recorded giving</p>
            </section>

            <section className={styles.detailGrid}>
              <div>
                <small>Donor</small>
                <strong>{donor.name}</strong>
              </div>

              <div>
                <small>Segment</small>
                <strong>{donor.segment}</strong>
              </div>

              <div>
                <small>Lifetime giving</small>
                <strong>{donor.lifetime}</strong>
              </div>

              <div>
                <small>Recorded gifts</small>
                <strong>{donor.gifts}</strong>
              </div>

              <div>
                <small>Last contribution</small>
                <strong>{donor.last}</strong>
              </div>

              <div>
                <small>Record type</small>
                <strong>Campaign donor</strong>
              </div>

              <div>
                <small>Email</small>
                <strong>
                  {donor.email || "Not recorded"}
                </strong>
              </div>

              <div>
                <small>Phone</small>
                <strong>
                  {donor.phone || "Not recorded"}
                </strong>
              </div>
            </section>

            <section className={styles.detailSection}>
              <div>
                <span className={styles.sectionIcon}>
                  <HeartHandshake size={18} />
                </span>

                <div>
                  <h3>Relationship record</h3>
                  <p>
                    {liveMode
                      ? "Giving history is calculated from the live Campaign Seat contribution ledger."
                      : "Giving history and segmentation are local preview records in this demo workspace."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {pledge ? (
          <div className={styles.detailBody}>
            <section className={styles.detailHero}>
              <span className={styles.detailStatus}>
                <Clock3 size={15} />
                {pledge.status}
              </span>

              <strong>{pledge.amount}</strong>

              <p>Open fundraising pledge</p>
            </section>

            <section className={styles.detailGrid}>
              <div>
                <small>Donor</small>
                <strong>{pledge.donor}</strong>
              </div>

              <div>
                <small>Amount</small>
                <strong>{pledge.amount}</strong>
              </div>

              <div>
                <small>Due</small>
                <strong>{pledge.due}</strong>
              </div>

              <div>
                <small>Owner</small>
                <strong>{pledge.owner}</strong>
              </div>

              <div>
                <small>Status</small>
                <strong>{pledge.status}</strong>
              </div>

              <div>
                <small>Record type</small>
                <strong>Campaign pledge</strong>
              </div>
            </section>

            <section className={styles.detailSection}>
              <div>
                <span className={styles.sectionIcon}>
                  <HeartHandshake size={18} />
                </span>

                <div>
                  <h3>Follow-up required</h3>
                  <p>
                    Keep the pledge visible until the campaign
                    records the next fundraising action.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function ContributionTable({
  contributions,
  title,
  subtitle,
  onViewAll,
  onSelect,
  selectedId,
}) {
  return (
    <section className={styles.tablePanel}>
      <header className={styles.tablePanelHeader}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <button
          type="button"
          className={styles.textButton}
          onClick={onViewAll}
        >
          View all
        </button>
      </header>

      <ContributionRows
        contributions={contributions}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    </section>
  );
}

function ContributionRows({
  contributions,
  onSelect,
  selectedId,
}) {
  return (
    <div className={styles.contributionTable}>
      <div className={styles.contributionHeading}>
        <span>Donor</span>
        <span>Amount</span>
        <span>Date</span>
        <span>Type</span>
        <span>Campaign</span>
        <span>Status</span>
      </div>

      {contributions.map((contribution) => (
        <article
          key={contribution.id}
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          className={
            selectedId === contribution.id
              ? styles.rowSelected
              : onSelect
                ? styles.clickableRow
                : undefined
          }
          onClick={() =>
            onSelect?.(contribution)
          }
          onKeyDown={(event) => {
            if (!onSelect) {
              return;
            }

            handleInteractiveKey(
              event,
              () => onSelect(contribution),
            );
          }}
        >
          <div className={styles.personCell}>
            <span>{contribution.initials}</span>

            <div>
              <strong>{contribution.donor}</strong>
              <small>Contribution record</small>
            </div>
          </div>

          <b>{money(contribution.amount)}</b>

          <span>
            {contribution.date}
            <small>{contribution.time}</small>
          </span>

          <span>{contribution.type}</span>
          <span>{contribution.campaign}</span>

          <em>{contribution.status}</em>
        </article>
      ))}

      {!contributions.length ? (
        <div className={styles.tableEmpty}>
          <HandCoins size={24} />

          <strong>
            No contributions yet
          </strong>

          <span>
            Record the first contribution to begin this campaign's live fundraising ledger.
          </span>
        </div>
      ) : null}
    </div>
  );
}
