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
  useMemo,
  useState,
} from "react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

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

const DONORS = [
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

function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "DN";
}

export default function FundraisingReferencePreview() {
  const [
    activeView,
    setActiveView,
  ] = useState("overview");

  const [
    contributions,
    setContributions,
  ] = useState(INITIAL_CONTRIBUTIONS);

  const [
    contributionModalOpen,
    setContributionModalOpen,
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
    campaign: "General Fund",
  });

  const [
    activityMessage,
    setActivityMessage,
  ] = useState("");

  const addedTotal = useMemo(
    () =>
      contributions
        .slice(INITIAL_CONTRIBUTIONS.length)
        .reduce(
          (sum, contribution) =>
            sum + Number(contribution.amount || 0),
          0,
        ),
    [contributions],
  );

  const totalRaised = 142680 + addedTotal;
  const fundraisingGoal = 220000;
  const progressPercent = Math.min(
    100,
    Math.round((totalRaised / fundraisingGoal) * 100),
  );

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

  const handleRecordContribution = (event) => {
    event.preventDefault();

    const donor = contributionForm.donor.trim();
    const amount = Number(contributionForm.amount);

    if (!donor || !Number.isFinite(amount) || amount <= 0) {
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

    setContributions((current) => [
      newContribution,
      ...current,
    ]);

    setContributionForm({
      donor: "",
      amount: "",
      type: "Online",
      campaign: "General Fund",
    });

    setContributionModalOpen(false);

    setActivityMessage(
      `${money(amount)} contribution from ${donor} recorded in this browser preview.`,
    );
  };

  return (
    <CampaignWorkspaceShell activeItem="Fundraising">
      <main
        className={styles.main}
        data-fundraising-command-center="true"
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
                onClick={() =>
                  setActivityMessage(
                    "Fundraising preview refreshed.",
                  )
                }
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
                setActiveView("overview")
              }
            >
              <span className={styles.metricIcon}>
                <CircleDollarSign size={22} />
              </span>

              <span>
                <small>Total raised</small>
                <strong>{money(totalRaised)}</strong>
                <em>
                  {progressPercent}% of {money(fundraisingGoal)}
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
                setActiveView("contributions")
              }
            >
              <span className={styles.metricIcon}>
                <HandCoins size={22} />
              </span>

              <span>
                <small>Contributions</small>
                <strong>{482 + contributions.length - INITIAL_CONTRIBUTIONS.length}</strong>
                <em>Campaign-to-date records</em>
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
                setActiveView("donors")
              }
            >
              <span className={styles.metricIcon}>
                <Users size={22} />
              </span>

              <span>
                <small>Active donors</small>
                <strong>318</strong>
                <em>124 new this cycle</em>
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
                setActiveView("goals")
              }
            >
              <span className={styles.metricIcon}>
                <TrendingUp size={22} />
              </span>

              <span>
                <small>Recurring donors</small>
                <strong>86</strong>
                <em>$18,640 monthly</em>
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
                    setActiveView("overview")
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
                    setActiveView("contributions")
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
                    setActiveView("donors")
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
                    setActiveView("goals")
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
                        86 recurring donors contributing
                        monthly
                      </span>
                    </div>
                  </section>

                  <ContributionTable
                    contributions={contributions.slice(0, 5)}
                    title="Recent contributions"
                    subtitle="Latest contribution activity across the campaign."
                    onViewAll={() =>
                      setActiveView("contributions")
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
                        setActivityMessage(
                          "Add donor workflow is staged for the next fundraising pass.",
                        )
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

                    {DONORS.map((donor) => (
                      <article key={donor.name}>
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
                    ))}
                  </div>
                </section>
              ) : null}

              {activeView === "goals" ? (
                <>
                  <section className={styles.goalGrid}>
                    {GOALS.map((goal) => (
                      <article key={goal.name}>
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
                          <span>Active</span>
                        </footer>
                      </article>
                    ))}
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

                      {PLEDGES.map((pledge) => (
                        <article key={pledge.donor}>
                          <strong>{pledge.donor}</strong>
                          <b>{pledge.amount}</b>
                          <span>{pledge.due}</span>
                          <span>{pledge.owner}</span>
                          <em>{pledge.status}</em>
                        </article>
                      ))}
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

                <button type="button">
                  <div>
                    <strong>3 pledges need follow-up</strong>
                    <span>Next due Oct 2</span>
                  </div>

                  <em>3</em>
                </button>

                <button type="button">
                  <div>
                    <strong>6 donor records need details</strong>
                    <span>Review incomplete contact records</span>
                  </div>

                  <em>6</em>
                </button>

                <button type="button">
                  <div>
                    <strong>4 thank-you notes queued</strong>
                    <span>Recent contribution follow-up</span>
                  </div>

                  <em>4</em>
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
                    setActiveView("donors")
                  }
                >
                  <Users size={18} />
                  Review donors
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveView("goals")
                  }
                >
                  <HeartHandshake size={18} />
                  Review pledges
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivityMessage(
                      "Fundraising report export is preview-only in V70.",
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
                    12 acknowledgements recorded today.
                  </p>
                </div>
              </section>
            </aside>
          </section>

          <footer className={styles.previewNote}>
            <FileText size={16} />
            <span>
              V70 uses local preview data only. Shared
              fundraising storage, payment processing, and
              external delivery are not connected yet.
            </span>
          </footer>
        </div>

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
                    <option>General Fund</option>
                    <option>Field Program</option>
                    <option>Digital Outreach</option>
                    <option>Monthly Support</option>
                  </select>
                </label>
              </div>

              <div className={styles.modalInfo}>
                <Clock3 size={17} />

                <span>
                  This V70 form records data only in the
                  current browser session.
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

function ContributionTable({
  contributions,
  title,
  subtitle,
  onViewAll,
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

      <ContributionRows contributions={contributions} />
    </section>
  );
}

function ContributionRows({
  contributions,
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
        <article key={contribution.id}>
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
    </div>
  );
}
