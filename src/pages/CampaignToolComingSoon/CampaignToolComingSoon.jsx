import {
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DollarSign,
  Download,
  FileText,
  FolderKanban,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  Mic2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import {
  useState,
} from "react";


import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import styles from "./CampaignToolComingSoon.module.css";

const GENERIC_TOOL_CONFIG = {
  events: {
    title: "Events",
    icon: CalendarDays,
    accent: "#b96d18",
    soft: "#fff4e6",
    description:
      "A central place to plan campaign events, coordinate people, manage details, and keep every event moving on schedule.",
    features: [
      "Campaign event planning",
      "RSVP and attendance tracking",
      "Volunteer and staff assignments",
      "Venue and vendor coordination",
      "Run-of-show preparation",
      "Post-event follow-up",
    ],
  },

  "social-media": {
    title: "Social Media",
    icon: MessageSquare,
    accent: "#356db1",
    soft: "#edf5fd",
    description:
      "A campaign content workspace for organizing social posts, approvals, channel plans, and coordinated digital messaging.",
    features: [
      "Campaign content calendar",
      "Post drafting and review",
      "Channel-specific planning",
      "Creative asset coordination",
      "Approval and publishing workflow",
      "Engagement performance overview",
    ],
  },

  "media-center": {
    title: "Media Center",
    icon: FolderKanban,
    accent: "#7957bd",
    soft: "#f3effc",
    description:
      "A campaign media workspace for preparing press materials, organizing coverage, and coordinating public-facing responses.",
    features: [
      "Press release preparation",
      "Media contact organization",
      "Talking points and statements",
      "Interview request coordination",
      "Campaign coverage tracking",
      "Rapid-response preparation",
    ],
  },

  "reports-analytics": {
    title: "Reports & Analytics",
    icon: BarChart3,
    accent: "#c13b48",
    soft: "#fff0f2",
    description:
      "A clear reporting workspace for understanding campaign activity, progress, trends, and the areas that need attention.",
    features: [
      "Campaign performance summaries",
      "Volunteer activity reporting",
      "Fundraising progress insights",
      "Field and outreach metrics",
      "Operational trend monitoring",
      "Leadership-ready campaign reports",
    ],
  },
};

const FUNDRAISING_CAPABILITIES = [
  {
    title: "Donor Management",
    description:
      "Keep your donor database organized and up to date.",
    icon: Users,
  },
  {
    title: "Online Donations",
    description:
      "Secure, branded donation pages that convert.",
    icon: DollarSign,
  },
  {
    title: "Campaign Progress",
    description:
      "Real-time tracking toward your fundraising goals.",
    icon: TrendingUp,
  },
  {
    title: "Events & Pledges",
    description:
      "Manage fundraising events and donor pledges.",
    icon: CalendarDays,
  },
];

const FUNDRAISING_BENEFITS = [
  {
    title: "Secure & Compliant",
    description:
      "Built with top-tier security and campaign finance compliance in mind.",
    icon: LockKeyhole,
  },
  {
    title: "Mobile Friendly",
    description:
      "Accept donations anywhere with optimized mobile experiences.",
    icon: Smartphone,
  },
  {
    title: "Automated Receipts",
    description:
      "Donors get instant receipts and thank-you messages automatically.",
    icon: Mail,
  },
  {
    title: "Smart Insights",
    description:
      "Understand your donors and grow with data-driven insights and reports.",
    icon: BarChart3,
  },
];

const COMING_SOON_FEATURES = [
  "Custom Donation Pages",
  "Peer-to-Peer Fundraising",
  "Text-to-Donate",
  "Pledge Management",
  "Donor Segmentation",
  "Advanced Reports",
];

const SAMPLE_DONATIONS = [
  {
    initials: "JD",
    donor: "Jennifer Davis",
    amount: "$250.00",
    date: "Jul 27, 2026",
    type: "Online",
    campaign: "General Fund",
    payment: "VISA •••• 4242",
  },
  {
    initials: "RB",
    donor: "Robert Brown",
    amount: "$100.00",
    date: "Jul 27, 2026",
    type: "Online",
    campaign: "General Fund",
    payment: "MC •••• 5555",
  },
  {
    initials: "SM",
    donor: "Susan Miller",
    amount: "$500.00",
    date: "Jul 26, 2026",
    type: "Recurring",
    campaign: "Monthly Support",
    payment: "VISA •••• 1111",
  },
  {
    initials: "TH",
    donor: "Tom Harris",
    amount: "$50.00",
    date: "Jul 26, 2026",
    type: "Mobile",
    campaign: "General Fund",
    payment: "AMEX •••• 1005",
  },
  {
    initials: "LW",
    donor: "Lisa White",
    amount: "$25.00",
    date: "Jul 26, 2026",
    type: "Online",
    campaign: "Get Out the Vote",
    payment: "MC •••• 8888",
  },
];





const REPORT_CAPABILITIES = [
  {
    title: "Custom Report Builder",
    description:
      "Build the exact reports you need with drag-and-drop simplicity.",
    icon: BarChart3,
  },
  {
    title: "Real-Time Dashboards",
    description:
      "Live data and visual dashboards that keep you informed at a glance.",
    icon: TrendingUp,
  },
  {
    title: "Performance Tracking",
    description:
      "Measure what matters and track progress toward your goals.",
    icon: Clock3,
  },
  {
    title: "Export & Share",
    description:
      "Export, schedule, and share reports with your team in one click.",
    icon: Download,
  },
];

const REPORT_DISTRICTS = [
  {
    label: "District 1",
    percentage: "82%",
    growth: "↑ 8%",
  },
  {
    label: "District 2",
    percentage: "76%",
    growth: "↑ 5%",
  },
  {
    label: "District 3",
    percentage: "71%",
    growth: "↑ 3%",
  },
  {
    label: "District 4",
    percentage: "69%",
    growth: "↑ 6%",
  },
  {
    label: "District 5",
    percentage: "64%",
    growth: "↑ 2%",
  },
  {
    label: "District 6",
    percentage: "81%",
    growth: "↑ 9%",
  },
];

const REPORT_DONATION_SOURCES = [
  {
    label: "Online",
    amount: "$78,650",
    percentage: "55%",
    color: "#2877e6",
  },
  {
    label: "Events",
    amount: "$24,300",
    percentage: "17%",
    color: "#ef4250",
  },
  {
    label: "Mail",
    amount: "$21,100",
    percentage: "15%",
    color: "#37a96f",
  },
  {
    label: "In-Person",
    amount: "$13,640",
    percentage: "10%",
    color: "#7656ce",
  },
  {
    label: "Other",
    amount: "$5,000",
    percentage: "2%",
    color: "#a895d9",
  },
];

const REPORT_CONTACT_METHODS = [
  {
    label: "Door to Door",
    percentage: "42%",
  },
  {
    label: "Phone Calls",
    percentage: "28%",
  },
  {
    label: "Text Messages",
    percentage: "18%",
  },
  {
    label: "Email",
    percentage: "12%",
  },
];

const REPORT_COMING_SOON_FEATURES = [
  "Advanced filtering & segmentation",
  "Scheduled reports & email delivery",
  "Comparative date ranges",
  "Interactive graphs & charts",
  "Goal tracking & benchmarks",
  "Role-based report access",
];

const MEDIA_CAPABILITIES = [
  {
    title: "Press Releases",
    description:
      "Draft, organize, and share campaign announcements.",
    icon: FileText,
  },
  {
    title: "Media Contacts",
    description:
      "Keep reporters, outlets, and press lists organized.",
    icon: Users,
  },
  {
    title: "Approved Assets",
    description:
      "Store logos, headshots, photos, and press kits.",
    icon: FolderKanban,
  },
  {
    title: "Coverage Tracking",
    description:
      "Monitor interviews, mentions, and follow-ups.",
    icon: BarChart3,
  },
];

const MEDIA_BENEFITS = [
  {
    title: "Press Kits",
    description:
      "Build and share professional press kits in seconds.",
    icon: FolderKanban,
  },
  {
    title: "Interview Coordination",
    description:
      "Manage requests, schedules, and follow-ups.",
    icon: Mic2,
  },
  {
    title: "Asset Library",
    description:
      "Centralize approved photos, logos, and documents.",
    icon: FileText,
  },
  {
    title: "Approval Workflow",
    description:
      "Review, approve, and track assets with full history.",
    icon: ShieldCheck,
  },
  {
    title: "Media Monitoring",
    description:
      "Track coverage and measure campaign visibility.",
    icon: BarChart3,
  },
];

const MEDIA_COMING_SOON_FEATURES = [
  "Press release templates",
  "Media list management",
  "Asset download links",
  "Interview request tracking",
  "Coverage reporting",
  "Approval history",
];

const SAMPLE_MEDIA_ACTIVITY = [
  {
    initials: "PB",
    item: "Palm Beach Post Interview",
    type: "Interview Request",
    date: "May 14, 2025",
    status: "Open",
    owner: "Sarah T.",
  },
  {
    initials: "CF",
    item: "Community Forum Press Release",
    type: "Press Release",
    date: "May 12, 2025",
    status: "Approved",
    owner: "James L.",
  },
  {
    initials: "CH",
    item: "Candidate Headshot Kit",
    type: "Asset",
    date: "May 10, 2025",
    status: "Published",
    owner: "Emily R.",
  },
  {
    initials: "DT",
    item: "Debate Talking Points",
    type: "Talking Points",
    date: "May 9, 2025",
    status: "Approved",
    owner: "James L.",
  },
  {
    initials: "PC",
    item: "Press Conference Advisory",
    type: "Press Advisory",
    date: "May 8, 2025",
    status: "Scheduled",
    owner: "Sarah T.",
  },
];

const MEDIA_BREAKDOWN = [
  {
    label: "Press Releases",
    value: "24% (24)",
    color: "#2877e6",
  },
  {
    label: "Interview Requests",
    value: "22% (22)",
    color: "#7e52dd",
  },
  {
    label: "Assets",
    value: "28% (28)",
    color: "#42a863",
  },
  {
    label: "Mentions",
    value: "26% (26)",
    color: "#f18a24",
  },
];

const SOCIAL_CAPABILITIES = [
  {
    title: "Smart Publishing",
    description:
      "Schedule and publish across all major platforms from one easy-to-use calendar.",
    icon: CalendarDays,
  },
  {
    title: "Engagement Inbox",
    description:
      "Monitor comments, messages, and mentions in real time—never miss a conversation.",
    icon: MessageSquare,
  },
  {
    title: "Performance Analytics",
    description:
      "Track what is working with powerful insights and easy-to-read reports.",
    icon: BarChart3,
  },
  {
    title: "Audience Growth",
    description:
      "Build your audience and turn followers into supporters.",
    icon: Users,
  },
];

const SOCIAL_POSTS = [
  {
    platform: "F",
    platformName: "Facebook",
    title: "Early Voting Starts Now!",
    description: "Get out and make your voice heard.",
    date: "Jul 20, 2026",
    time: "9:00 AM",
  },
  {
    platform: "IG",
    platformName: "Instagram",
    title: "Thank You, Volunteers!",
    description:
      "Our campaign is powered by people like you.",
    date: "Jul 20, 2026",
    time: "1:00 PM",
  },
  {
    platform: "X",
    platformName: "X",
    title: "Together, We Win.",
    description:
      "Let us keep the momentum going.",
    date: "Jul 21, 2026",
    time: "10:00 AM",
  },
  {
    platform: "TT",
    platformName: "TikTok",
    title: "Why I’m Running",
    description:
      "Watch my latest message to District 6.",
    date: "Jul 21, 2026",
    time: "6:00 PM",
  },
];

const SOCIAL_PLATFORMS = [
  {
    name: "Facebook",
    abbreviation: "F",
    total: "12,452",
    percentage: "86%",
  },
  {
    name: "Instagram",
    abbreviation: "IG",
    total: "7,324",
    percentage: "62%",
  },
  {
    name: "X (Twitter)",
    abbreviation: "X",
    total: "3,829",
    percentage: "39%",
  },
  {
    name: "TikTok",
    abbreviation: "TT",
    total: "987",
    percentage: "17%",
  },
];

const SOCIAL_COMING_SOON_FEATURES = [
  "Cross-platform publishing",
  "Content library & templates",
  "Hashtag & trend recommendations",
  "Paid post tracking",
  "Social listening & alerts",
  "Team collaboration & approvals",
];

const EVENT_CAPABILITIES = [
  {
    title: "Event Planning",
    description:
      "Create events, set goals, and manage every detail.",
    icon: CalendarDays,
  },
  {
    title: "RSVPs & Attendance",
    description:
      "Collect RSVPs, track attendance, and manage guest lists.",
    icon: Users,
  },
  {
    title: "Volunteer Coordination",
    description:
      "Assign roles, schedule volunteers, and stay organized.",
    icon: Users,
  },
  {
    title: "Venue & Logistics",
    description:
      "Manage venues, vendors, and all event logistics.",
    icon: MapPin,
  },
];

const EVENT_BENEFITS = [
  {
    title: "Event Planning",
    description:
      "Build events, set goals, create timelines, and manage every detail.",
    icon: CalendarDays,
  },
  {
    title: "RSVPs & Attendance",
    description:
      "Collect RSVPs, manage guest lists, and track attendance in real time.",
    icon: Users,
  },
  {
    title: "Volunteer Coordination",
    description:
      "Recruit volunteers, assign roles, and streamline scheduling.",
    icon: Users,
  },
  {
    title: "Venue & Logistics",
    description:
      "Manage venues, vendors, equipment, and all the details that matter.",
    icon: MapPin,
  },
  {
    title: "Reminders & Follow-Ups",
    description:
      "Automate reminders, send updates, and follow up to maximize turnout.",
    icon: BellRing,
  },
  {
    title: "Smart Scheduling",
    description:
      "Find the best dates, avoid conflicts, and optimize your event calendar.",
    icon: Clock3,
  },
];

const EVENT_COMING_SOON_FEATURES = [
  "Event Pages",
  "RSVP Tracking",
  "Check-In Tools",
  "Volunteer Scheduling",
  "Venue Coordination",
  "Event Analytics",
];

const SAMPLE_EVENTS = [
  {
    initials: "FD",
    name: "Fundraiser Dinner",
    type: "Dinner & Networking",
    date: "Jul 31, 2026",
    time: "6:00 PM",
    location: "Riverside Event Center",
    city: "Wellington, FL",
    rsvps: "243 / 300",
    volunteers: "28",
    status: "Confirmed",
  },
  {
    initials: "CF",
    name: "Community Forum",
    type: "Community Engagement",
    date: "Aug 6, 2026",
    time: "6:30 PM",
    location: "Wellington Community Center",
    city: "Wellington, FL",
    rsvps: "156 / 200",
    volunteers: "18",
    status: "Confirmed",
  },
  {
    initials: "VR",
    name: "Volunteer Rally",
    type: "Volunteer Event",
    date: "Aug 14, 2026",
    time: "9:00 AM",
    location: "Village Park",
    city: "Wellington, FL",
    rsvps: "89 / 120",
    volunteers: "35",
    status: "Scheduled",
  },
  {
    initials: "MG",
    name: "Meet & Greet",
    type: "Meet the Candidate",
    date: "Aug 21, 2026",
    time: "5:30 PM",
    location: "The Patio Café",
    city: "Wellington, FL",
    rsvps: "112 / 150",
    volunteers: "16",
    status: "Scheduled",
  },
  {
    initials: "PC",
    name: "Press Conference",
    type: "Media Event",
    date: "Aug 28, 2026",
    time: "10:00 AM",
    location: "City Hall Plaza",
    city: "Wellington, FL",
    rsvps: "76 / 100",
    volunteers: "12",
    status: "Planned",
  },
];

function FundraisingPreview() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [
    notifyModalOpen,
    setNotifyModalOpen,
  ] = useState(false);

  const handleNotify = (event) => {
    event.preventDefault();

    setNotice(
      "Your interest was recorded for this browser preview.",
    );

    setEmail("");
  };

  return (
    <CampaignWorkspaceShell activeItem="Fundraising">
      <main
        className={styles.main}
        data-campaign-tool-preview="fundraising"
      >
        <div className={styles.pageCanvas}>
          <nav
            className={styles.previewActions}
            aria-label="Fundraising preview actions"
          >
<button
              type="button"
              onClick={() => {
                setNotice("");
                setNotifyModalOpen(true);
              }}
            >
              <BellRing size={16} />
              Notify Me When It&apos;s Live
            </button>
          </nav>

          <section className={styles.fundraisingHero}>
            <div className={styles.fundraisingIntro}>
              <span className={styles.comingSoonLabel}>
                Coming soon
              </span>

              <h1>
                Fundraising That
                <strong>Powers Your Campaign.</strong>
              </h1>

              <p className={styles.heroLead}>
                Our Fundraising Suite is almost here.
              </p>

              <p className={styles.heroDescription}>
                Track donations, manage donors, run
                campaigns, and hit your goals—all in one
                powerful place.
              </p>

              <div className={styles.capabilityList}>
                {FUNDRAISING_CAPABILITIES.map(
                  (capability) => {
                    const Icon = capability.icon;

                    return (
                      <article key={capability.title}>
                        <span>
                          <Icon size={21} />
                        </span>

                        <div>
                          <h2>{capability.title}</h2>
                          <p>{capability.description}</p>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </div>

            <section
              className={styles.dashboardPreview}
              aria-label="Sample fundraising dashboard preview"
            >
              <header className={styles.dashboardHeader}>
                <div>
                  <strong>Fundraising Overview</strong>
                  <span>Sample preview data</span>
                </div>

                <span className={styles.dateRange}>
                  <CalendarDays size={14} />
                  Jul 1 – Jul 28, 2026
                </span>
              </header>

              <div className={styles.metricGrid}>
                <article className={styles.primaryMetric}>
                  <span>Total Raised</span>
                  <strong>$142,680</strong>
                  <small>of $220,000 goal</small>

                  <div className={styles.progressTrack}>
                    <span />
                  </div>

                  <b>65%</b>
                </article>

                <article>
                  <span>Donations</span>
                  <strong>482</strong>
                  <small>↑ 18% vs last month</small>
                </article>

                <article>
                  <span>New Donors</span>
                  <strong>124</strong>
                  <small>↑ 24% vs last month</small>
                </article>

                <article>
                  <span>Average Donation</span>
                  <strong>$296</strong>
                  <small>↑ 8% vs last month</small>
                </article>

                <article>
                  <span>Recurring Donors</span>
                  <strong>86</strong>
                  <small>↑ 12% vs last month</small>
                </article>
              </div>

              <div className={styles.dashboardLower}>
                <section className={styles.donationTable}>
                  <header>
                    <strong>Recent Donations</strong>
                    <span>View all</span>
                  </header>

                  <div className={styles.tableHeading}>
                    <span>Donor</span>
                    <span>Amount</span>
                    <span>Date</span>
                    <span>Type</span>
                    <span>Campaign</span>
                    <span>Status</span>
                  </div>

                  {SAMPLE_DONATIONS.map((donation) => (
                    <article key={donation.donor}>
                      <div className={styles.donorCell}>
                        <span>{donation.initials}</span>

                        <div>
                          <strong>{donation.donor}</strong>
                          <small>{donation.payment}</small>
                        </div>
                      </div>

                      <b>{donation.amount}</b>
                      <span>{donation.date}</span>
                      <span>{donation.type}</span>
                      <span>{donation.campaign}</span>
                      <em>Completed</em>
                    </article>
                  ))}
                </section>

                <section className={styles.progressChart}>
                  <header>
                    <strong>Fundraising Progress</strong>
                    <span>View goals</span>
                  </header>

                  <div className={styles.chartSummary}>
                    <div>
                      <strong>$142,680</strong>
                      <span>of $220,000 goal</span>
                    </div>

                    <b>65%</b>
                  </div>

                  <div className={styles.largeProgressTrack}>
                    <span />
                  </div>

                  <svg
                    viewBox="0 0 320 160"
                    role="img"
                    aria-label="Sample fundraising progress chart"
                  >
                    <path
                      className={styles.goalLine}
                      d="M12 139 C62 115 112 94 158 73 C208 52 257 36 308 18"
                    />

                    <path
                      className={styles.raisedLine}
                      d="M12 139 L40 126 L68 118 L96 99 L124 94 L152 76 L180 70 L208 52 L236 55 L264 39 L292 42 L308 34"
                    />
                  </svg>

                  <div className={styles.chartLegend}>
                    <span>
                      <i />
                      Raised
                    </span>

                    <span>
                      <i />
                      Goal
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </section>

          <section
            className={styles.benefitGrid}
            aria-label="Fundraising suite benefits"
          >
            {FUNDRAISING_BENEFITS.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <article key={benefit.title}>
                  <span>
                    <Icon size={23} />
                  </span>

                  <div>
                    <h2>{benefit.title}</h2>
                    <p>{benefit.description}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section
            className={styles.notificationPanel}
            id="fundraising-notify"
          >
            <div className={styles.notificationIntro}>
              <span>
                <Mail size={26} />
              </span>

              <div>
                <h2>
                  Be the first to know when Fundraising
                  goes live.
                </h2>

                <p>
                  Get notified as soon as we launch and be
                  ready to start raising more.
                </p>
              </div>
            </div>

            <form
              className={styles.notificationForm}
              onSubmit={handleNotify}
            >
              <label htmlFor="fundraising-preview-email">
                Email address
              </label>

              <input
                id="fundraising-preview-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                required
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <button type="submit">
                <BellRing size={16} />
                Notify Me When It&apos;s Live
              </button>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notificationNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </form>

            <div className={styles.comingSoonList}>
              <h2>What&apos;s Coming Soon</h2>

              <div>
                {COMING_SOON_FEATURES.map((feature) => (
                  <span key={feature}>
                    <CheckCircle2 size={15} />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <footer className={styles.previewFooter}>
            <Sparkles size={18} />

            <span>
              Campaign Seat is built to help you organize,
              connect, and win.
            </span>

            <strong>
              Together, we can make a difference.
            </strong>
          </footer>
        </div>

        {notifyModalOpen ? (
          <div
            className={styles.notifyModalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setNotifyModalOpen(false);
              }
            }}
          >
            <section
              className={styles.notifyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="fundraising-notify-title"
            >
              <button
                className={styles.notifyModalClose}
                type="button"
                aria-label="Close notification form"
                onClick={() =>
                  setNotifyModalOpen(false)
                }
              >
                <X size={19} />
              </button>

              <span className={styles.notifyModalIcon}>
                <BellRing size={27} />
              </span>

              <span className={styles.notifyModalStatus}>
                Coming soon
              </span>

              <h2 id="fundraising-notify-title">
                Be the first to know.
              </h2>

              <p>
                Enter your email to record your interest
                in the Campaign Seat Fundraising Suite.
              </p>

              <form
                className={styles.notifyModalForm}
                onSubmit={handleNotify}
              >
                <label htmlFor="fundraising-modal-email">
                  Email address
                </label>

                <input
                  id="fundraising-modal-email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

                <button type="submit">
                  <BellRing size={16} />
                  Notify Me When It&apos;s Live
                </button>
              </form>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notifyModalNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function EventsPreview() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [
    eventsNotifyModalOpen,
    setEventsNotifyModalOpen,
  ] = useState(false);

  const handleNotify = (event) => {
    event.preventDefault();

    setNotice(
      "Your interest was recorded for this browser preview.",
    );

    setEmail("");
  };

  return (
    <CampaignWorkspaceShell activeItem="Events">
      <main
        className={styles.main}
        data-campaign-tool-preview="events"
      >
        <div className={styles.pageCanvas}>
          <nav
            className={styles.previewActions}
            aria-label="Events preview actions"
          >
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setEventsNotifyModalOpen(true);
              }}
            >
              <BellRing size={16} />
              Notify Me When It&apos;s Live
            </button>
          </nav>

          <section className={styles.eventsHero}>
            <div className={styles.eventsIntro}>
              <span className={styles.comingSoonLabel}>
                Coming soon
              </span>

              <h1>
                Events That Bring
                <strong>People Together.</strong>
              </h1>

              <p className={styles.heroLead}>
                Our Events Suite is almost here.
              </p>

              <p className={styles.heroDescription}>
                Plan, manage, and execute memorable events
                that engage your community and move your
                campaign forward—all in one place.
              </p>

              <div className={styles.eventCapabilityList}>
                {EVENT_CAPABILITIES.map((capability) => {
                  const Icon = capability.icon;

                  return (
                    <article key={capability.title}>
                      <span>
                        <Icon size={20} />
                      </span>

                      <div>
                        <h2>{capability.title}</h2>
                        <p>{capability.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <section
              className={styles.eventsDashboard}
              aria-label="Sample events dashboard preview"
            >
              <header className={styles.dashboardHeader}>
                <div>
                  <strong>Events Overview</strong>
                  <span>Sample preview data</span>
                </div>

                <span className={styles.dateRange}>
                  <CalendarDays size={14} />
                  Jul 1 – Jul 28, 2026
                </span>
              </header>

              <div className={styles.eventMetricGrid}>
                <article>
                  <span>Total Events</span>
                  <strong>18</strong>
                  <small>↑ 20% vs last month</small>
                </article>

                <article>
                  <span>Upcoming Events</span>
                  <strong>7</strong>
                  <small>↑ 16% vs last month</small>
                </article>

                <article>
                  <span>RSVPs</span>
                  <strong>1,246</strong>
                  <small>↑ 28% vs last month</small>
                </article>

                <article>
                  <span>Volunteers Assigned</span>
                  <strong>142</strong>
                  <small>↑ 18% vs last month</small>
                </article>

                <article>
                  <span>Check-ins</span>
                  <strong>856</strong>
                  <small>↑ 25% vs last month</small>
                </article>

                <article>
                  <span>Venue Confirmations</span>
                  <strong>12</strong>
                  <small>↑ 9% vs last month</small>
                </article>
              </div>

              <div className={styles.eventsDashboardLower}>
                <section className={styles.eventsTable}>
                  <header>
                    <strong>Upcoming Events</strong>
                    <span>View all</span>
                  </header>

                  <div className={styles.eventTableHeading}>
                    <span>Event</span>
                    <span>Date & Time</span>
                    <span>Location</span>
                    <span>RSVPs</span>
                    <span>Volunteers</span>
                    <span>Status</span>
                  </div>

                  {SAMPLE_EVENTS.map((event) => (
                    <article key={event.name}>
                      <div className={styles.eventNameCell}>
                        <span>{event.initials}</span>

                        <div>
                          <strong>{event.name}</strong>
                          <small>{event.type}</small>
                        </div>
                      </div>

                      <div className={styles.eventStackedCell}>
                        <strong>{event.date}</strong>
                        <small>{event.time}</small>
                      </div>

                      <div className={styles.eventStackedCell}>
                        <strong>{event.location}</strong>
                        <small>{event.city}</small>
                      </div>

                      <b>{event.rsvps}</b>
                      <b>{event.volunteers}</b>

                      <em
                        data-status={event.status.toLowerCase()}
                      >
                        {event.status}
                      </em>
                    </article>
                  ))}
                </section>

                <section className={styles.rsvpChart}>
                  <header>
                    <strong>RSVP Progress</strong>
                    <span>View details</span>
                  </header>

                  <div className={styles.chartSummary}>
                    <div>
                      <strong>1,246 RSVP&apos;d</strong>
                      <span>of 2,000 target</span>
                    </div>

                    <b>62%</b>
                  </div>

                  <div className={styles.eventProgressTrack}>
                    <span />
                  </div>

                  <svg
                    viewBox="0 0 320 160"
                    role="img"
                    aria-label="Sample event RSVP progress chart"
                  >
                    <path
                      className={styles.eventGoalLine}
                      d="M12 139 C62 119 112 100 158 78 C208 57 257 38 308 20"
                    />

                    <path
                      className={styles.eventRsvpLine}
                      d="M12 139 L38 127 L66 117 L94 96 L122 92 L150 73 L178 68 L206 49 L234 53 L262 37 L290 39 L308 31"
                    />
                  </svg>

                  <div className={styles.chartLegend}>
                    <span>
                      <i />
                      RSVPs
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </section>

          <section
            className={styles.eventBenefitGrid}
            aria-label="Events Suite benefits"
          >
            {EVENT_BENEFITS.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <article key={benefit.title}>
                  <span>
                    <Icon size={21} />
                  </span>

                  <div>
                    <h2>{benefit.title}</h2>
                    <p>{benefit.description}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section
            className={styles.notificationPanel}
            id="events-notify"
          >
            <div className={styles.notificationIntro}>
              <span>
                <Mail size={26} />
              </span>

              <div>
                <h2>
                  Be the first to know when Events goes
                  live.
                </h2>

                <p>
                  Get notified as soon as we launch and be
                  ready to plan amazing events.
                </p>
              </div>
            </div>

            <form
              className={styles.notificationForm}
              onSubmit={handleNotify}
            >
              <label htmlFor="events-preview-email">
                Email address
              </label>

              <input
                id="events-preview-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                required
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <button type="submit">
                <BellRing size={16} />
                Notify Me When It&apos;s Live
              </button>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notificationNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </form>

            <div className={styles.comingSoonList}>
              <h2>What&apos;s Coming Soon</h2>

              <div>
                {EVENT_COMING_SOON_FEATURES.map(
                  (feature) => (
                    <span key={feature}>
                      <CheckCircle2 size={15} />
                      {feature}
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>

          <footer className={styles.previewFooter}>
            <Sparkles size={18} />

            <span>
              Campaign Seat is built to help you organize,
              connect, and win.
            </span>

            <strong>
              Together, we can make a difference.
            </strong>
          </footer>
        </div>

        {eventsNotifyModalOpen ? (
          <div
            className={styles.notifyModalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setEventsNotifyModalOpen(false);
              }
            }}
          >
            <section
              className={styles.notifyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="events-notify-title"
            >
              <button
                className={styles.notifyModalClose}
                type="button"
                aria-label="Close Events notification form"
                onClick={() =>
                  setEventsNotifyModalOpen(false)
                }
              >
                <X size={19} />
              </button>

              <span className={styles.notifyModalIcon}>
                <BellRing size={27} />
              </span>

              <span className={styles.notifyModalStatus}>
                Coming soon
              </span>

              <h2 id="events-notify-title">
                Be the first to know.
              </h2>

              <p>
                Enter your email to record your interest
                in the Campaign Seat Events Suite.
              </p>

              <form
                className={styles.notifyModalForm}
                onSubmit={handleNotify}
              >
                <label htmlFor="events-modal-email">
                  Email address
                </label>

                <input
                  id="events-modal-email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

                <button type="submit">
                  <BellRing size={16} />
                  Notify Me When It&apos;s Live
                </button>
              </form>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notifyModalNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function SocialMediaPreview() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [
    socialNotifyModalOpen,
    setSocialNotifyModalOpen,
  ] = useState(false);

  const handleNotify = (event) => {
    event.preventDefault();

    setNotice(
      "Your interest was recorded for this browser preview.",
    );

    setEmail("");
  };

  return (
    <CampaignWorkspaceShell activeItem="Social Media">
      <main
        className={styles.main}
        data-campaign-tool-preview="social-media"
      >
        <div className={styles.pageCanvas}>
          <nav
            className={styles.previewActions}
            aria-label="Social Media preview actions"
          >
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setSocialNotifyModalOpen(true);
              }}
            >
              <BellRing size={16} />
              Notify Me When It&apos;s Live
            </button>
          </nav>

          <section className={styles.socialHero}>
            <div className={styles.socialIntro}>
              <span className={styles.comingSoonLabel}>
                Coming soon
              </span>

              <h1>
                Social Media
                <strong>Built for Campaigns.</strong>
              </h1>

              <p className={styles.heroDescription}>
                Our Social Media Suite is almost here.
                Manage every platform, create content that
                connects, and engage supporters—all from
                one central hub.
              </p>

              <div className={styles.socialCapabilityList}>
                {SOCIAL_CAPABILITIES.map((capability) => {
                  const Icon = capability.icon;

                  return (
                    <article key={capability.title}>
                      <span>
                        <Icon size={20} />
                      </span>

                      <div>
                        <h2>{capability.title}</h2>
                        <p>{capability.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <section
              className={styles.socialDashboard}
              aria-label="Sample Social Media dashboard preview"
            >
              <header className={styles.dashboardHeader}>
                <div>
                  <strong>Social Media Overview</strong>
                  <span>Sample preview data</span>
                </div>

                <span className={styles.dateRange}>
                  <CalendarDays size={14} />
                  Coming Q3 2026
                </span>
              </header>

              <div className={styles.socialMetricGrid}>
                <article>
                  <span>Total Followers</span>
                  <strong>24,532</strong>
                  <small>↑ 18% vs last month</small>
                </article>

                <article>
                  <span>Engagement Rate</span>
                  <strong>5.7%</strong>
                  <small>↑ 0.8% vs last month</small>
                </article>

                <article>
                  <span>Total Reach</span>
                  <strong>182,456</strong>
                  <small>↑ 24% vs last month</small>
                </article>

                <article>
                  <span>Posts Published</span>
                  <strong>56</strong>
                  <small>↑ 12% vs last month</small>
                </article>

                <article>
                  <span>New Followers</span>
                  <strong>2,345</strong>
                  <small>↑ 19% vs last month</small>
                </article>
              </div>

              <div className={styles.socialDashboardLower}>
                <section className={styles.socialPostTable}>
                  <header>
                    <strong>Upcoming Posts</strong>
                    <span>View calendar</span>
                  </header>

                  {SOCIAL_POSTS.map((post) => (
                    <article key={post.title}>
                      <span
                        className={styles.socialPlatformIcon}
                        data-platform={post.platformName.toLowerCase()}
                      >
                        {post.platform}
                      </span>

                      <div className={styles.socialPostCopy}>
                        <strong>{post.title}</strong>
                        <p>{post.description}</p>
                        <small>
                          {post.date} · {post.time}
                        </small>
                      </div>

                      <em>Scheduled</em>
                    </article>
                  ))}
                </section>

                <section className={styles.socialAnalytics}>
                  <div className={styles.engagementChart}>
                    <header>
                      <strong>Engagement</strong>
                      <span>View analytics</span>
                    </header>

                    <div className={styles.socialLegend}>
                      <span>
                        <i data-line="likes" />
                        Likes
                      </span>

                      <span>
                        <i data-line="comments" />
                        Comments
                      </span>

                      <span>
                        <i data-line="shares" />
                        Shares
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 320 150"
                      role="img"
                      aria-label="Sample Social Media engagement chart"
                    >
                      <path
                        className={styles.socialGridLine}
                        d="M12 30 H308 M12 65 H308 M12 100 H308 M12 135 H308"
                      />

                      <path
                        className={styles.socialLikesLine}
                        d="M14 112 L42 84 L70 91 L98 79 L126 94 L154 66 L182 81 L210 51 L238 68 L266 39 L294 45 L308 27"
                      />

                      <path
                        className={styles.socialCommentsLine}
                        d="M14 132 L42 116 L70 124 L98 103 L126 116 L154 92 L182 109 L210 82 L238 97 L266 70 L294 85 L308 64"
                      />

                      <path
                        className={styles.socialSharesLine}
                        d="M14 143 L42 136 L70 140 L98 130 L126 136 L154 123 L182 130 L210 115 L238 124 L266 105 L294 116 L308 101"
                      />
                    </svg>
                  </div>

                  <div className={styles.topPlatforms}>
                    <header>
                      <strong>Top Platforms</strong>
                      <span>View all</span>
                    </header>

                    {SOCIAL_PLATFORMS.map((platform) => (
                      <article key={platform.name}>
                        <span
                          className={styles.socialPlatformIcon}
                          data-platform={platform.name.toLowerCase()}
                        >
                          {platform.abbreviation}
                        </span>

                        <strong>{platform.name}</strong>

                        <div>
                          <span
                            style={{
                              width: platform.percentage,
                            }}
                          />
                        </div>

                        <b>{platform.total}</b>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          </section>

          <section className={styles.socialNotificationPanel}>
            <div className={styles.socialNotificationIntro}>
              <span className={styles.socialDevicePreview}>
                <MessageSquare size={27} />
              </span>

              <div>
                <h2>
                  We&apos;re building the ultimate social
                  media command center for campaigns.
                </h2>

                <p>
                  Be the first to know when it launches and
                  get early access.
                </p>
              </div>
            </div>

            <form
              className={styles.notificationForm}
              onSubmit={handleNotify}
            >
              <label htmlFor="social-preview-email">
                Email address
              </label>

              <input
                id="social-preview-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                required
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <button type="submit">
                <BellRing size={16} />
                Notify Me When It&apos;s Live
              </button>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notificationNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </form>

            <div className={styles.comingSoonList}>
              <h2>Coming Soon Features</h2>

              <div>
                {SOCIAL_COMING_SOON_FEATURES.map(
                  (feature) => (
                    <span key={feature}>
                      <CheckCircle2 size={15} />
                      {feature}
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>

          <footer className={styles.previewFooter}>
            <Sparkles size={18} />

            <span>
              Campaign Seat is built to help you organize,
              connect, and win.
            </span>

            <strong>
              Together, we can make a difference.
            </strong>
          </footer>
        </div>

        {socialNotifyModalOpen ? (
          <div
            className={styles.notifyModalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSocialNotifyModalOpen(false);
              }
            }}
          >
            <section
              className={styles.notifyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="social-notify-title"
            >
              <button
                className={styles.notifyModalClose}
                type="button"
                aria-label="Close Social Media notification form"
                onClick={() =>
                  setSocialNotifyModalOpen(false)
                }
              >
                <X size={19} />
              </button>

              <span className={styles.notifyModalIcon}>
                <BellRing size={27} />
              </span>

              <span className={styles.notifyModalStatus}>
                Coming soon
              </span>

              <h2 id="social-notify-title">
                Be the first to know.
              </h2>

              <p>
                Enter your email to record your interest
                in the Campaign Seat Social Media Suite.
              </p>

              <form
                className={styles.notifyModalForm}
                onSubmit={handleNotify}
              >
                <label htmlFor="social-modal-email">
                  Email address
                </label>

                <input
                  id="social-modal-email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

                <button type="submit">
                  <BellRing size={16} />
                  Notify Me When It&apos;s Live
                </button>
              </form>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notifyModalNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function MediaCenterPreview() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [
    mediaNotifyModalOpen,
    setMediaNotifyModalOpen,
  ] = useState(false);

  const handleNotify = (event) => {
    event.preventDefault();

    setNotice(
      "Your interest was recorded for this browser preview.",
    );

    setEmail("");
  };

  return (
    <CampaignWorkspaceShell activeItem="Media Center">
      <main
        className={styles.main}
        data-campaign-tool-preview="media-center"
      >
        <div className={styles.pageCanvas}>
          <nav
            className={styles.previewActions}
            aria-label="Media Center preview actions"
          >
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setMediaNotifyModalOpen(true);
              }}
            >
              <BellRing size={16} />
              Notify Me When It&apos;s Live
            </button>
          </nav>

          <section className={styles.mediaHero}>
            <div className={styles.mediaIntro}>
              <span className={styles.comingSoonLabel}>
                Coming soon
              </span>

              <h1>
                Media Center That Keeps Your Campaign
                <strong>On Message.</strong>
              </h1>

              <p className={styles.heroDescription}>
                Our new Media Center suite is almost here.
                Organize press releases, media contacts,
                talking points, approved assets, and press
                requests in one centralized hub—so your
                campaign stays prepared, consistent, and
                trusted.
              </p>

              <div className={styles.mediaCapabilityList}>
                {MEDIA_CAPABILITIES.map((capability) => {
                  const Icon = capability.icon;

                  return (
                    <article key={capability.title}>
                      <span>
                        <Icon size={20} />
                      </span>

                      <div>
                        <h2>{capability.title}</h2>
                        <p>{capability.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <section
              className={styles.mediaDashboard}
              aria-label="Sample Media Center dashboard"
            >
              <header className={styles.dashboardHeader}>
                <div>
                  <strong>Media Center Overview</strong>
                  <span>Sample preview data</span>
                </div>

                <span className={styles.dateRange}>
                  <CalendarDays size={14} />
                  This Month
                </span>
              </header>

              <div className={styles.mediaMetricGrid}>
                <article>
                  <span>Press Releases</span>
                  <strong>24</strong>
                  <small>↑ 8 from last month</small>
                </article>

                <article>
                  <span>Media Contacts</span>
                  <strong>186</strong>
                  <small>↑ 15 from last month</small>
                </article>

                <article>
                  <span>Open Requests</span>
                  <strong>7</strong>
                  <small data-negative="true">
                    ↓ 2 from last month
                  </small>
                </article>

                <article>
                  <span>Coverage Mentions</span>
                  <strong>42</strong>
                  <small>↑ 11 from last month</small>
                </article>

                <article>
                  <span>Approved Assets</span>
                  <strong>318</strong>
                  <small>↑ 25 from last month</small>
                </article>

                <article>
                  <span>Response Rate</span>
                  <strong>78%</strong>
                  <small>↑ 6% from last month</small>
                </article>
              </div>

              <div className={styles.mediaDashboardLower}>
                <section className={styles.mediaActivityTable}>
                  <header>
                    <strong>Recent Media Activity</strong>
                    <span>View all</span>
                  </header>

                  <div className={styles.mediaTableHeading}>
                    <span>Item</span>
                    <span>Type</span>
                    <span>Date</span>
                    <span>Status</span>
                    <span>Owner</span>
                  </div>

                  {SAMPLE_MEDIA_ACTIVITY.map((activity) => (
                    <article key={activity.item}>
                      <div className={styles.mediaItemCell}>
                        <span>{activity.initials}</span>
                        <strong>{activity.item}</strong>
                      </div>

                      <span>{activity.type}</span>
                      <span>{activity.date}</span>

                      <em
                        data-status={
                          activity.status.toLowerCase()
                        }
                      >
                        {activity.status}
                      </em>

                      <div className={styles.mediaOwner}>
                        <span>
                          {activity.owner
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </span>

                        <strong>{activity.owner}</strong>
                      </div>
                    </article>
                  ))}
                </section>

                <div className={styles.mediaAnalysisColumn}>
                  <section className={styles.coverageChart}>
                    <header>
                      <strong>Coverage Activity</strong>
                      <span>Last 30 Days</span>
                    </header>

                    <svg
                      viewBox="0 0 320 145"
                      role="img"
                      aria-label="Sample coverage activity chart"
                    >
                      <path
                        className={styles.mediaGridLine}
                        d="M12 28 H308 M12 62 H308 M12 96 H308 M12 130 H308"
                      />

                      <path
                        className={styles.mediaCoverageLine}
                        d="M14 105 L34 99 L54 55 L74 84 L94 94 L114 50 L134 30 L154 107 L174 97 L194 77 L214 113 L234 91 L254 38 L274 79 L294 57 L308 87"
                      />
                    </svg>

                    <div className={styles.mediaChartDates}>
                      <span>Apr 16</span>
                      <span>Apr 23</span>
                      <span>Apr 30</span>
                      <span>May 7</span>
                      <span>May 14</span>
                    </div>
                  </section>

                  <section className={styles.mediaBreakdown}>
                    <header>
                      <strong>Media Breakdown</strong>
                    </header>

                    <div>
                      <span
                        className={styles.mediaDonut}
                        role="img"
                        aria-label="Sample media breakdown"
                      />

                      <div className={styles.mediaBreakdownLegend}>
                        {MEDIA_BREAKDOWN.map((item) => (
                          <article key={item.label}>
                            <i
                              style={{
                                background: item.color,
                              }}
                            />

                            <span>{item.label}</span>
                            <b>{item.value}</b>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          </section>

          <section
            className={styles.mediaBenefitGrid}
            aria-label="Media Center benefits"
          >
            {MEDIA_BENEFITS.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <article key={benefit.title}>
                  <span>
                    <Icon size={21} />
                  </span>

                  <div>
                    <h2>{benefit.title}</h2>
                    <p>{benefit.description}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section className={styles.mediaNotificationPanel}>
            <div className={styles.notificationIntro}>
              <span>
                <Mail size={26} />
              </span>

              <div>
                <h2>
                  Be the first to know when Media Center
                  goes live.
                </h2>

                <p>
                  Join the early-access list and we&apos;ll
                  notify you when it is available.
                </p>
              </div>
            </div>

            <form
              className={styles.notificationForm}
              onSubmit={handleNotify}
            >
              <label htmlFor="media-preview-email">
                Email address
              </label>

              <input
                id="media-preview-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                required
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <button type="submit">
                <BellRing size={16} />
                Notify Me When It&apos;s Live
              </button>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notificationNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </form>

            <div className={styles.comingSoonList}>
              <h2>What&apos;s Coming Soon</h2>

              <div>
                {MEDIA_COMING_SOON_FEATURES.map(
                  (feature) => (
                    <span key={feature}>
                      <CheckCircle2 size={15} />
                      {feature}
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>

          <footer className={styles.previewFooter}>
            <Sparkles size={18} />

            <span>
              Campaign Seat is built to help you organize,
              connect, and win.
            </span>

            <strong>
              Together, we can make a difference.
            </strong>
          </footer>
        </div>

        {mediaNotifyModalOpen ? (
          <div
            className={styles.notifyModalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setMediaNotifyModalOpen(false);
              }
            }}
          >
            <section
              className={styles.notifyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="media-notify-title"
            >
              <button
                className={styles.notifyModalClose}
                type="button"
                aria-label="Close Media Center notification form"
                onClick={() =>
                  setMediaNotifyModalOpen(false)
                }
              >
                <X size={19} />
              </button>

              <span className={styles.notifyModalIcon}>
                <BellRing size={27} />
              </span>

              <span className={styles.notifyModalStatus}>
                Coming soon
              </span>

              <h2 id="media-notify-title">
                Be the first to know.
              </h2>

              <p>
                Enter your email to record your interest
                in the Campaign Seat Media Center.
              </p>

              <form
                className={styles.notifyModalForm}
                onSubmit={handleNotify}
              >
                <label htmlFor="media-modal-email">
                  Email address
                </label>

                <input
                  id="media-modal-email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

                <button type="submit">
                  <BellRing size={16} />
                  Notify Me When It&apos;s Live
                </button>
              </form>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notifyModalNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}


function ReportsAnalyticsPreview() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [
    reportsNotifyModalOpen,
    setReportsNotifyModalOpen,
  ] = useState(false);

  const handleNotify = (event) => {
    event.preventDefault();

    setNotice(
      "Your interest was recorded for this browser preview.",
    );

    setEmail("");
  };

  return (
    <CampaignWorkspaceShell activeItem="Reports & Analytics">
      <main
        className={styles.main}
        data-campaign-tool-preview="reports-analytics"
      >
        <div className={styles.pageCanvas}>
          <nav
            className={styles.previewActions}
            aria-label="Reports and Analytics preview actions"
          >
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setReportsNotifyModalOpen(true);
              }}
            >
              <BellRing size={16} />
              Notify Me When It&apos;s Live
            </button>
          </nav>

          <section className={styles.reportsHero}>
            <div className={styles.reportsIntro}>
              <span className={styles.comingSoonLabel}>
                Coming soon
              </span>

              <h1>
                Reports &amp; Analytics
                <strong>See More. Win More.</strong>
              </h1>

              <p className={styles.heroLead}>
                Our Reports &amp; Analytics Suite is
                almost here.
              </p>

              <p className={styles.heroDescription}>
                Get real-time insights, track performance,
                and make data-driven decisions that move
                your campaign forward.
              </p>

              <div className={styles.reportsCapabilityList}>
                {REPORT_CAPABILITIES.map((capability) => {
                  const Icon = capability.icon;

                  return (
                    <article key={capability.title}>
                      <span>
                        <Icon size={20} />
                      </span>

                      <div>
                        <h2>{capability.title}</h2>
                        <p>{capability.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <section
              className={styles.reportsDashboard}
              aria-label="Sample Reports and Analytics dashboard"
            >
              <header className={styles.dashboardHeader}>
                <div>
                  <strong>
                    Reports Overview (Preview)
                  </strong>

                  <span>Sample preview data</span>
                </div>

                <span className={styles.dateRange}>
                  <CalendarDays size={14} />
                  Last 28 Days
                </span>
              </header>

              <div className={styles.reportsMetricGrid}>
                <article>
                  <span>Total Contacts</span>
                  <strong>24,532</strong>
                  <small>↑ 18% vs last month</small>
                </article>

                <article>
                  <span>Volunteer Hours</span>
                  <strong>1,245</strong>
                  <small>↑ 12% vs last month</small>
                </article>

                <article>
                  <span>Donations</span>
                  <strong>$142,680</strong>
                  <small>↑ 24% vs last month</small>
                </article>

                <article>
                  <span>Events Held</span>
                  <strong>32</strong>
                  <small>↑ 10% vs last month</small>
                </article>

                <article>
                  <span>Voters Contacted</span>
                  <strong>12,842</strong>
                  <small>↑ 16% vs last month</small>
                </article>

                <article>
                  <span>Tasks Completed</span>
                  <strong>1,156</strong>
                  <small>↑ 17% vs last month</small>
                </article>
              </div>

              <div className={styles.reportsDashboardMiddle}>
                <section className={styles.performanceTrends}>
                  <header>
                    <strong>Performance Trends</strong>
                    <span>Last 28 Days</span>
                  </header>

                  <div className={styles.reportsLegend}>
                    <span>
                      <i data-series="donations" />
                      Donations
                    </span>

                    <span>
                      <i data-series="contacts" />
                      Contacts
                    </span>

                    <span>
                      <i data-series="volunteers" />
                      Volunteer Hours
                    </span>
                  </div>

                  <svg
                    viewBox="0 0 420 185"
                    role="img"
                    aria-label="Sample campaign performance trends"
                  >
                    <path
                      className={styles.reportsGridLine}
                      d="M16 32 H405 M16 69 H405 M16 106 H405 M16 143 H405"
                    />

                    <path
                      className={styles.donationsTrend}
                      d="M20 125 L54 96 L88 86 L122 94 L156 72 L190 77 L224 52 L258 81 L292 55 L326 35 L360 57 L394 22"
                    />

                    <path
                      className={styles.contactsTrend}
                      d="M20 151 L54 136 L88 143 L122 123 L156 137 L190 111 L224 88 L258 118 L292 89 L326 101 L360 75 L394 62"
                    />

                    <path
                      className={styles.volunteerTrend}
                      d="M20 169 L54 157 L88 163 L122 153 L156 160 L190 148 L224 132 L258 143 L292 126 L326 105 L360 128 L394 99"
                    />
                  </svg>

                  <div className={styles.reportsChartDates}>
                    <span>Jun 28</span>
                    <span>Jul 5</span>
                    <span>Jul 12</span>
                    <span>Jul 19</span>
                    <span>Jul 26</span>
                  </div>
                </section>

                <section className={styles.districtMetrics}>
                  <header>
                    <strong>Top Metrics by Area</strong>
                    <span>By District</span>
                  </header>

                  <div>
                    {REPORT_DISTRICTS.map((district) => (
                      <article key={district.label}>
                        <strong>{district.label}</strong>

                        <div>
                          <span
                            style={{
                              width: district.percentage,
                            }}
                          />
                        </div>

                        <b>{district.percentage}</b>
                        <small>{district.growth}</small>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className={styles.reportsDashboardLower}>
                <section className={styles.donationSources}>
                  <header>
                    <strong>Donations by Source</strong>
                  </header>

                  <div>
                    <span
                      className={styles.reportsDonut}
                      role="img"
                      aria-label="Sample donations by source breakdown"
                    />

                    <div className={styles.donationSourceLegend}>
                      {REPORT_DONATION_SOURCES.map(
                        (source) => (
                          <article key={source.label}>
                            <i
                              style={{
                                background: source.color,
                              }}
                            />

                            <span>{source.label}</span>
                            <strong>{source.amount}</strong>
                            <b>({source.percentage})</b>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                </section>

                <section className={styles.contactEffectiveness}>
                  <header>
                    <strong>
                      Contact Methods Effectiveness
                    </strong>
                  </header>

                  <div>
                    {REPORT_CONTACT_METHODS.map((method) => (
                      <article key={method.label}>
                        <span>{method.label}</span>

                        <div>
                          <i
                            style={{
                              width: method.percentage,
                            }}
                          />
                        </div>

                        <b>{method.percentage}</b>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.taskCompletion}>
                  <header>
                    <strong>Task Completion</strong>
                  </header>

                  <div>
                    <span className={styles.taskCompletionRing}>
                      <strong>73%</strong>
                      <small>
                        1,156 of 1,580
                        <br />
                        tasks completed
                      </small>
                    </span>

                    <div>
                      <article>
                        <i data-status="completed" />
                        <span>Completed</span>
                        <b>1,156</b>
                      </article>

                      <article>
                        <i data-status="progress" />
                        <span>In Progress</span>
                        <b>276</b>
                      </article>

                      <article>
                        <i data-status="overdue" />
                        <span>Overdue</span>
                        <b>148</b>
                      </article>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </section>

          <section className={styles.reportsNotificationPanel}>
            <div className={styles.reportsNotificationIntro}>
              <span>
                <BarChart3 size={28} />
              </span>

              <div>
                <h2>
                  Powerful reports.
                  <strong>Built for campaigns.</strong>
                </h2>

                <p>
                  From fundraising to field operations,
                  our reports give you the clarity to lead
                  with confidence and win on Election Day.
                </p>
              </div>
            </div>

            <form
              className={styles.notificationForm}
              onSubmit={handleNotify}
            >
              <label htmlFor="reports-preview-email">
                Email address
              </label>

              <input
                id="reports-preview-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                required
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              <button type="submit">
                <BellRing size={16} />
                Notify Me When It&apos;s Live
              </button>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notificationNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </form>

            <div className={styles.comingSoonList}>
              <h2>Coming Soon Features</h2>

              <div>
                {REPORT_COMING_SOON_FEATURES.map(
                  (feature) => (
                    <span key={feature}>
                      <CheckCircle2 size={15} />
                      {feature}
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>

          <footer className={styles.previewFooter}>
            <Sparkles size={18} />

            <span>
              Campaign Seat is built to help you organize,
              connect, and win.
            </span>

            <strong>
              Together, we can make a difference.
            </strong>
          </footer>
        </div>

        {reportsNotifyModalOpen ? (
          <div
            className={styles.notifyModalScrim}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setReportsNotifyModalOpen(false);
              }
            }}
          >
            <section
              className={styles.notifyModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reports-notify-title"
            >
              <button
                className={styles.notifyModalClose}
                type="button"
                aria-label="Close Reports and Analytics notification form"
                onClick={() =>
                  setReportsNotifyModalOpen(false)
                }
              >
                <X size={19} />
              </button>

              <span className={styles.notifyModalIcon}>
                <BellRing size={27} />
              </span>

              <span className={styles.notifyModalStatus}>
                Coming soon
              </span>

              <h2 id="reports-notify-title">
                Be the first to know.
              </h2>

              <p>
                Enter your email to record your interest
                in Campaign Seat Reports &amp; Analytics.
              </p>

              <form
                className={styles.notifyModalForm}
                onSubmit={handleNotify}
              >
                <label htmlFor="reports-modal-email">
                  Email address
                </label>

                <input
                  id="reports-modal-email"
                  type="email"
                  value={email}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

                <button type="submit">
                  <BellRing size={16} />
                  Notify Me When It&apos;s Live
                </button>
              </form>

              <small>
                Preview only. Email delivery is not
                connected yet.
              </small>

              {notice ? (
                <p
                  className={styles.notifyModalNotice}
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}

function GenericPreview({
  toolKey,
}) {
  const tool =
    GENERIC_TOOL_CONFIG[toolKey] ||
    GENERIC_TOOL_CONFIG.events;

  const Icon = tool.icon;

  return (
    <CampaignWorkspaceShell activeItem={tool.title}>
      <main
        className={styles.main}
        style={{
          "--tool-accent": tool.accent,
          "--tool-soft": tool.soft,
        }}
      >
        <div className={styles.pageCanvas}>
          <section className={styles.genericHero}>
            <div className={styles.genericTopline}>
              <span className={styles.genericIcon}>
                <Icon size={28} />
              </span>

              <span className={styles.genericStatus}>
                <Clock3 size={15} />
                Coming soon
              </span>
            </div>

            <span>Campaign tool preview</span>

            <h1>{tool.title}</h1>
            <p>{tool.description}</p>
          </section>

          <section className={styles.genericFeaturePanel}>
            <header>
              <Sparkles size={21} />

              <div>
                <span>What is being prepared</span>

                <h2>
                  Built for organized campaign operations
                </h2>
              </div>
            </header>

            <div>
              {tool.features.map((feature) => (
                <article key={feature}>
                  <CheckCircle2 size={18} />
                  {feature}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.genericStayTuned}>
            <BellRing size={22} />

            <div>
              <strong>Stay tuned</strong>

              <p>
                The {tool.title} workspace is being
                prepared for Campaign Seat. This preview
                shows the direction of the tool while the
                complete workflow is built and reviewed.
              </p>
            </div>
          </section>
        </div>
      </main>
    </CampaignWorkspaceShell>
  );
}

export default function CampaignToolComingSoon({
  toolKey,
}) {
  if (toolKey === "fundraising") {
    return <FundraisingPreview />;
  }

  if (toolKey === "events") {
    return <EventsPreview />;
  }

  if (toolKey === "social-media") {
    return <SocialMediaPreview />;
  }

  if (toolKey === "media-center") {
    return <MediaCenterPreview />;
  }

  if (toolKey === "reports-analytics") {
    return <ReportsAnalyticsPreview />;
  }

  return <GenericPreview toolKey={toolKey} />;
}
