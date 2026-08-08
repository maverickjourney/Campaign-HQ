import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  Globe2,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquareText,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Vote,
  Zap,
} from "lucide-react";

import {
  CAMPAIGN_MODULES,
  JURISDICTION_TYPES,
  OFFICE_LEVELS,
  POLITICAL_PARTIES,
} from "../../config/campaignSetup";

import {
  useCampaignSetup,
} from "../../hooks/useCampaignSetup";

import {
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./CampaignSetupWizard.module.css";

const STEPS = [
  {
    key: "identity",
    number: "01",
    shortLabel: "Workspace",
    command: "INITIALIZE WORKSPACE",
    description:
      "Choose your Campaign Seat look, then identify the campaign.",
  },
  {
    key: "race",
    number: "02",
    shortLabel: "Race",
    command: "DEFINE THE RACE",
    description:
      "Configure the office, district and political environment.",
  },
  {
    key: "election",
    number: "03",
    shortLabel: "Election",
    command: "SET THE CLOCK",
    description:
      "Load election dates and campaign communication details.",
  },
  {
    key: "dashboard",
    number: "04",
    shortLabel: "Command Center",
    command: "BUILD YOUR COMMAND CENTER",
    description:
      "Choose the tools Campaign Seat should activate on day one.",
  },
  {
    key: "review",
    number: "05",
    shortLabel: "Activate",
    command: "FINAL SYSTEM CHECK",
    description:
      "Your Campaign Seat workspace is configured. Security, team access and secure provider connections continue after activation.",
  },
];

const CAMPAIGN_TYPES = [
  {
    value: "candidate_campaign",
    label: "Candidate Campaign",
    description:
      "Run a campaign for elected office.",
    icon: UserRound,
  },
  {
    value: "ballot_measure",
    label: "Ballot Measure",
    description:
      "Organize an initiative or referendum.",
    icon: Vote,
  },
  {
    value: "pac",
    label: "PAC / Committee",
    description:
      "Operate a political committee or PAC.",
    icon: Landmark,
  },
  {
    value: "party_organization",
    label: "Party Organization",
    description:
      "Coordinate a political party organization.",
    icon: Building2,
  },
  {
    value: "elected_official",
    label: "Elected Office",
    description:
      "Manage constituent and office operations.",
    icon: ShieldCheck,
  },
  {
    value: "advocacy_organization",
    label: "Advocacy",
    description:
      "Organize around issues and public policy.",
    icon: Megaphone,
  },
];

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  inbox: MessageSquareText,
  calendar: CalendarDays,
  tasks: CircleCheck,
  commitments: HeartHandshake,
  waiting_on: Zap,
  contacts: UsersRound,
  documents: FileText,
  approvals: ShieldCheck,
  team: UsersRound,
  volunteers: HeartHandshake,
  fundraising: BarChart3,
  events: CalendarDays,
  social_media: Megaphone,
  media_center: Megaphone,
  reports_analytics: BarChart3,
};

function createInitialForm() {
  return {
    campaignType:
      "",

    candidateName:
      "",

    publicCampaignName:
      "",

    legalCommitteeName:
      "",

    officeLevel:
      "county",

    officeSought:
      "",

    jurisdictionType:
      "county",

    jurisdictionName:
      "",

    districtLabel:
      "",

    politicalParty:
      "nonpartisan",

    activeTheme:
      "",

    primaryElectionDate:
      "",

    generalElectionDate:
      "",

    timezone:
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/New_York",

    campaignEmail:
      "",

    campaignPhone:
      "",

    websiteUrl:
      "",

    enabledModules:
      CAMPAIGN_MODULES.map(
        (module) =>
          module.key,
      ),
  };
}

function formatDate(
  value,
) {
  if (!value) {
    return "Not provided";
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
    return value;
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

function WorkspacePreview({
  form,
  theme,
  selectedModules,
}) {
  const candidateName =
    form.candidateName ||
    form.publicCampaignName ||
    "Candidate";

  const firstName =
    candidateName
      .trim()
      .split(/\s+/)[0] ||
    "Candidate";

  const workspaceName =
    form.publicCampaignName ||
    "Campaign Workspace";

  const raceLine =
    [
      form.officeSought,
      form.districtLabel,
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Campaign operation";

  const locationLine =
    form.jurisdictionName ||
    "Campaign jurisdiction";

  const electionReady =
    Boolean(
      form.primaryElectionDate ||
      form.generalElectionDate,
    );

  const moduleKeys =
    new Set(
      selectedModules.map(
        (module) => module.key,
      ),
    );

  return (
    <aside
      className={
        styles.livePreview
      }
      aria-label="Live Campaign Seat dashboard preview"
    >
      <div
        className={
          styles.previewHeader
        }
      >
        <div>
          <span
            className={
              styles.liveDot
            }
          />
          LIVE CAMPAIGN SEAT
        </div>

        <div
          className={
            styles.previewThemeControls
          }
        >
          <span
            className={
              styles.previewThemeBadge
            }
          >
            {theme} theme
          </span>
        </div>
      </div>

      <div
        className={
          styles.dashboardMock
        }
      >
        <aside
          className={
            styles.mockSidebar
          }
        >
          <div
            className={
              styles.mockWorkspace
            }
          >
            <small>
              CAMPAIGN WORKSPACE
            </small>

            <strong>
              {workspaceName}
            </strong>

            <span>
              {locationLine}
            </span>

            <span>
              {form.districtLabel ||
                "District / jurisdiction"}
            </span>
          </div>

          <div
            className={
              styles.mockNav
            }
          >
            {[
              ["dashboard", "HQ"],
              ["inbox", "Inbox"],
              ["calendar", "Calendar"],
              ["tasks", "Tasks"],
              ["commitments", "Commitments"],
              ["waiting_on", "Waiting On"],
              ["contacts", "Contacts"],
              ["documents", "Documents"],
              ["approvals", "Approvals"],
              ["team", "Team"],
              ["volunteers", "Volunteers"],
              ["fundraising", "Fundraising"],
              ["events", "Events"],
              ["social_media", "Social Media"],
              ["media_center", "Media Center"],
              ["reports_analytics", "Reports"],
            ]
              .filter(
                ([key]) =>
                  moduleKeys.has(key),
              )
              .slice(0, 13)
              .map(
                ([key, label], index) => (
                  <div
                    key={key}
                    className={
                      index === 0
                        ? styles.mockNavActive
                        : ""
                    }
                  >
                    <i />
                    <span>
                      {label}
                    </span>
                  </div>
                ),
              )}
          </div>

          <div
            className={
              styles.mockConnections
            }
          >
            <small>
              CONNECTED APPS
            </small>

            <div>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </aside>

        <section
          className={
            styles.mockMain
          }
        >
          <header
            className={
              styles.mockTopbar
            }
          >
            <div
              className={
                styles.mockGreeting
              }
            >
              <strong>
                Good evening,{" "}
                <em>
                  {firstName}.
                </em>
              </strong>

              <span>
                Your campaign command
                center is being configured.
              </span>
            </div>

            <div
              className={
                styles.mockHeaderControls
              }
            >
              <span>
                NEXT DEADLINE
              </span>
              <span>
                CAMPAIGN TIME
              </span>
              <span>
                ASK CAMPAIGN HQ
              </span>
              <b />
            </div>
          </header>

          <div
            className={
              styles.mockDashboard
            }
          >
            <section
              className={
                styles.mockPriorities
              }
            >
              <header>
                <strong>
                  TODAY'S PRIORITIES
                </strong>
                <span>
                  View all
                </span>
              </header>

              {[
                "Priority campaign item",
                "Review pending approval",
                "Prepare team follow-up",
                "Confirm upcoming operation",
                "Review campaign schedule",
              ].map(
                (item, index) => (
                  <div
                    key={item}
                    className={
                      styles.mockListRow
                    }
                  >
                    <i />
                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Campaign task
                      </small>
                    </span>
                    <b
                      data-tone={
                        index === 0
                          ? "urgent"
                          : index === 4
                            ? "low"
                            : "normal"
                      }
                    >
                      {index === 0
                        ? "Urgent"
                        : "Open"}
                    </b>
                  </div>
                ),
              )}

              <footer>
                Campaign Seat is monitoring
                campaign priorities
              </footer>
            </section>

            <section
              className={
                styles.mockSpotlight
              }
            >
              <span>
                CAMPAIGN SPOTLIGHT
              </span>

              <h3>
                Building momentum for{" "}
                <em>
                  {form.districtLabel ||
                    "the campaign"}.
                </em>
              </h3>

              <p>
                {raceLine}
              </p>

              <div
                className={
                  styles.mockSpotlightTags
                }
              >
                <span>
                  Campaign
                </span>
                <span>
                  Leadership
                </span>
                <span>
                  {locationLine}
                </span>
              </div>

              <div
                className={
                  styles.mockElection
                }
              >
                <small>
                  ELECTION SYSTEM
                </small>

                <strong>
                  {electionReady
                    ? "ACTIVE"
                    : "DATE NEEDED"}
                </strong>
              </div>

              <div
                className={
                  styles.mockSpotlightActions
                }
              >
                <span>
                  Manage team
                </span>
                <span>
                  Review approvals
                </span>
                <span>
                  Add event
                </span>
                <span>
                  Upload file
                </span>
              </div>
            </section>

            <section
              className={
                styles.mockSchedule
              }
            >
              <header>
                <strong>
                  TODAY'S SCHEDULE
                </strong>
                <span>
                  View calendar
                </span>
              </header>

              {[
                "Campaign meeting",
                "Team check-in",
                "Operations review",
                "Community event",
              ].map(
                (item, index) => (
                  <div
                    key={item}
                    className={
                      styles.mockScheduleRow
                    }
                  >
                    <small>
                      {index + 5}:00
                    </small>

                    <i />

                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Campaign location
                      </small>
                    </span>
                  </div>
                ),
              )}

              <footer>
                Campaign schedule synced
              </footer>
            </section>

            <section
              className={
                styles.mockIntelligence
              }
            >
              <span
                className={
                  styles.commandPulse
                }
              />

              <div>
                <small>
                  LIVE CAMPAIGN INTELLIGENCE
                </small>

                <strong>
                  Ask Campaign HQ
                </strong>

                <span>
                  Campaign Seat is preparing
                  your workspace intelligence.
                </span>
              </div>

              <button
                type="button"
                tabIndex={-1}
              >
                Ask Campaign HQ
              </button>
            </section>

            <section
              className={
                styles.mockCard
              }
            >
              <header>
                <strong>
                  MESSAGES FOR YOU
                </strong>
                <span>
                  View inbox
                </span>
              </header>

              <div
                className={
                  styles.mockMetric
                }
              >
                <strong>
                  —
                </strong>

                <span>
                  Conversations requiring
                  attention
                </span>
              </div>

              <div
                className={
                  styles.mockAvatarRow
                }
              >
                <i />
                <i />
                <i />
                <i />
              </div>

              <footer>
                Open messages
              </footer>
            </section>

            <section
              className={
                styles.mockCard
              }
            >
              <header>
                <strong>
                  DECISIONS FOR YOU
                </strong>
                <span>
                  View all
                </span>
              </header>

              {[
                "Campaign approval",
                "Team decision",
                "Content review",
              ].map(
                (item) => (
                  <div
                    key={item}
                    className={
                      styles.mockCompactRow
                    }
                  >
                    <i />
                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Awaiting review
                      </small>
                    </span>
                  </div>
                ),
              )}
            </section>

            <section
              className={
                styles.mockCard
              }
            >
              <header>
                <strong>
                  PEOPLE TO CONTACT
                </strong>
                <span>
                  View tasks
                </span>
              </header>

              {[
                "Campaign contact",
                "Community contact",
                "Team follow-up",
              ].map(
                (item) => (
                  <div
                    key={item}
                    className={
                      styles.mockCompactRow
                    }
                  >
                    <i />
                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Follow-up
                      </small>
                    </span>
                  </div>
                ),
              )}
            </section>

            <section
              className={
                styles.mockCard
              }
            >
              <header>
                <strong>
                  COMMITMENTS & FOLLOW-UPS
                </strong>
                <span>
                  View all
                </span>
              </header>

              {[
                "Open commitment",
                "Campaign follow-up",
                "Pending response",
              ].map(
                (item) => (
                  <div
                    key={item}
                    className={
                      styles.mockCompactRow
                    }
                  >
                    <i />
                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Open
                      </small>
                    </span>
                  </div>
                ),
              )}
            </section>

            <section
              className={
                styles.mockCard
              }
            >
              <header>
                <strong>
                  TEAM BRIEF
                </strong>
                <span>
                  Latest changes
                </span>
              </header>

              {[
                "Campaign activity updated",
                "Team record changed",
                "New operation created",
              ].map(
                (item) => (
                  <div
                    key={item}
                    className={
                      styles.mockCompactRow
                    }
                  >
                    <i />
                    <span>
                      <strong>
                        {item}
                      </strong>
                      <small>
                        Recent activity
                      </small>
                    </span>
                  </div>
                ),
              )}
            </section>

            <section
              className={`${styles.mockCard} ${styles.mockRisk}`}
            >
              <header>
                <strong>
                  RISK & COMPLIANCE
                </strong>
                <span>
                  Review
                </span>
              </header>

              <div
                className={
                  styles.mockMetric
                }
              >
                <strong>
                  —
                </strong>

                <span>
                  Items requiring review
                </span>
              </div>

              <div
                className={
                  styles.mockCompactRow
                }
              >
                <i />
                <span>
                  <strong>
                    Campaign compliance
                  </strong>
                  <small>
                    System ready
                  </small>
                </span>
              </div>
            </section>
          </div>
        </section>
      </div>

      <div
        className={
          styles.previewFooter
        }
      >
        <span
          className={
            styles.liveDot
          }
        />

        This dashboard uses the approved
        Campaign Seat layout with generic
        preview data only.
      </div>
    </aside>
  );
}

export default function CampaignSetupWizard() {
  const [
    sessionWorkspace,
  ] = useState(
    () =>
      getCurrentWorkspace(),
  );

  const {
    setupWorkspace,
    isLoading:
      setupIsLoading,
    isSaving:
      setupIsSaving,
    isActivating:
      setupIsActivating,
    error:
      setupLoadError,
    lastSavedAt:
      setupLastSavedAt,
    saveDraft:
      saveSetupDraft,
    activateWorkspace:
      activateSetupWorkspace,
  } = useCampaignSetup({
    workspaceId:
      sessionWorkspace.id,
  });

  const [
    hasHydratedSetup,
    setHasHydratedSetup,
  ] = useState(false);

  const [
    activeStep,
    setActiveStep,
  ] = useState(0);

  const [
    form,
    setForm,
  ] = useState(
    createInitialForm,
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    colorLocked,
    setColorLocked,
  ] = useState(false);

  const [
    workspaceTypeLocked,
    setWorkspaceTypeLocked,
  ] = useState(false);

  useEffect(() => {
    if (
      !setupWorkspace ||
      hasHydratedSetup
    ) {
      return undefined;
    }

    const hydrationTimeout =
      window.setTimeout(
        () => {
          const setupStarted =
            setupWorkspace.onboarding_status &&
            setupWorkspace.onboarding_status !==
              "not_started";

          const campaignType =
            setupStarted
              ? setupWorkspace.campaign_type ||
                ""
              : "";

          const activeTheme =
            setupStarted
              ? setupWorkspace.active_theme ||
                ""
              : "";

          setForm(
            (current) => ({
        ...current,

        campaignType,

        candidateName:
          setupWorkspace.candidate_name ||
          (
            setupWorkspace.campaign_type ===
            "candidate_campaign"
              ? setupWorkspace.name
              : ""
          ) ||
          "",

        publicCampaignName:
          setupWorkspace.name ||
          "",

        legalCommitteeName:
          setupWorkspace.legal_committee_name ||
          "",

        officeLevel:
          setupWorkspace.office_level ||
          current.officeLevel,

        officeSought:
          setupWorkspace.office_sought ||
          setupWorkspace.description ||
          "",

        jurisdictionType:
          setupWorkspace.jurisdiction_type ||
          current.jurisdictionType,

        jurisdictionName:
          setupWorkspace.jurisdiction_name ||
          setupWorkspace.location ||
          "",

        districtLabel:
          setupWorkspace.district_label ||
          "",

        politicalParty:
          setupWorkspace.political_party ||
          current.politicalParty,

        activeTheme,

        primaryElectionDate:
          setupWorkspace.primary_election_date ||
          setupWorkspace.election_date ||
          "",

        generalElectionDate:
          setupWorkspace.general_election_date ||
          "",

        timezone:
          setupWorkspace.timezone ||
          current.timezone,

        campaignEmail:
          setupWorkspace.campaign_email ||
          "",

        campaignPhone:
          setupWorkspace.campaign_phone ||
          "",

        websiteUrl:
          setupWorkspace.website_url ||
          "",

        enabledModules:
          Array.isArray(
            setupWorkspace.enabled_modules,
          ) &&
          setupWorkspace.enabled_modules.length
            ? setupWorkspace.enabled_modules
            : current.enabledModules,
      }),
    );

          if (setupStarted) {
            setColorLocked(
              Boolean(
                setupWorkspace.active_theme,
              ),
            );

            setWorkspaceTypeLocked(
              Boolean(
                setupWorkspace.campaign_type,
              ),
            );
          }

          setHasHydratedSetup(
            true,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        hydrationTimeout,
      );
    };
  }, [
    hasHydratedSetup,
    setupWorkspace,
  ]);

  const step =
    STEPS[activeStep];

  const visibleError =
    error ||
    setupLoadError;

  const draftWritesEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "draft-writes",
    ) === "enabled";

  const activationWritesEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(
      window.location.search,
    ).get(
      "activation-writes",
    ) === "enabled";

  const effectiveTheme =
    form.activeTheme ||
    "neutral";

  const selectedParty =
    POLITICAL_PARTIES.find(
      (party) =>
        party.value ===
        form.politicalParty,
    );

  const selectedModules =
    CAMPAIGN_MODULES.filter(
      (module) =>
        form.enabledModules.includes(
          module.key,
        ),
    );

  const progress =
    Math.round(
      ((activeStep + 1) /
        STEPS.length) *
        100,
    );

  const intelligenceMessage =
    useMemo(() => {
      if (
        step.key ===
        "identity"
      ) {
        if (
          !form.activeTheme
        ) {
          return "Choose your Campaign Seat workspace color.";
        }

        if (
          !form.campaignType
        ) {
          return "Choose the type of campaign workspace.";
        }

        if (
          !form.activeTheme
        ) {
          return "Choose your Campaign Seat workspace color to begin.";
        }

        if (
          !workspaceTypeLocked
        ) {
          return "Workspace color locked. Now choose the campaign operation type.";
        }

        return "Workspace type locked. Now add the campaign identity details.";
      }

      if (
        step.key ===
        "race"
      ) {
        return `${selectedParty?.label || "Campaign"} profile detected. Workspace appearance remains ${
          effectiveTheme === "red"
            ? "Red"
            : effectiveTheme === "blue"
              ? "Blue"
              : effectiveTheme === "purple"
                ? "Purple"
                : "Campaign Navy"
        }.`;
      }

      if (
        step.key ===
        "election"
      ) {
        return form.primaryElectionDate ||
          form.generalElectionDate
          ? "Election clock detected. Scheduling and countdown systems are ready to configure."
          : "Add an election date and I will prepare the campaign clock.";
      }

      if (
        step.key ===
        "dashboard"
      ) {
        return `All ${selectedModules.length} Campaign Seat tools are enabled. Your team can hide tools later in Workspace Settings.`;
      }

      return "Configuration staged. Backend activation and secure provider connections are next.";
    }, [
      form.activeTheme,
      form.campaignType,
      workspaceTypeLocked,
      effectiveTheme,
      form.generalElectionDate,
      form.primaryElectionDate,
      selectedModules.length,
      selectedParty?.label,
      step.key,
    ]);

  const updateField = (
    field,
    value,
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );

    setError("");
  };

  const handleThemeSelection = (
    value,
  ) => {
    updateField(
      "activeTheme",
      value,
    );

    setColorLocked(true);
    setWorkspaceTypeLocked(false);
  };

  const handleThemeUnlock =
    () => {
      setColorLocked(false);
      setWorkspaceTypeLocked(false);

      window.setTimeout(
        () => {
          document
            .getElementById(
              "workspace-color-selector",
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        },
        0,
      );
    };

  const handleWorkspaceTypeSelection = (
    value,
  ) => {
    setForm(
      (current) => ({
        ...current,
        campaignType:
          value,
        enabledModules:
          CAMPAIGN_MODULES.map(
            (module) =>
              module.key,
          ),
      }),
    );

    setError("");
    setWorkspaceTypeLocked(true);
  };

  const handleWorkspaceTypeUnlock =
    () => {
      setWorkspaceTypeLocked(false);
    };

  const toggleModule = (
    module,
  ) => {
    if (module.required) {
      return;
    }

    setForm(
      (current) => {
        const enabled =
          current.enabledModules.includes(
            module.key,
          );

        return {
          ...current,
          enabledModules:
            enabled
              ? current.enabledModules.filter(
                  (key) =>
                    key !==
                    module.key,
                )
              : [
                  ...current.enabledModules,
                  module.key,
                ],
        };
      },
    );
  };

  const validateCurrentStep =
    () => {
      if (
        step.key ===
        "identity"
      ) {
        if (
          !form.publicCampaignName
            .trim()
        ) {
          return "Enter the public campaign or organization name.";
        }

        if (
          form.campaignType ===
            "candidate_campaign" &&
          !form.candidateName.trim()
        ) {
          return "Enter the candidate's name.";
        }
      }

      if (
        step.key ===
        "race"
      ) {
        if (
          !form.officeSought
            .trim()
        ) {
          return "Enter the office, race or public purpose.";
        }

        if (
          !form.jurisdictionName
            .trim()
        ) {
          return "Enter the campaign jurisdiction or location.";
        }

        if (
          !form.politicalParty
        ) {
          return "Choose the political affiliation.";
        }
      }

      if (
        step.key ===
        "election"
      ) {
        if (
          !form.primaryElectionDate &&
          !form.generalElectionDate
        ) {
          return "Enter at least one election date.";
        }

        if (
          !form.timezone
        ) {
          return "Choose the campaign timezone.";
        }
      }

      return "";
    };

  const moveNext =
    async () => {
      const validationError =
        validateCurrentStep();

      if (validationError) {
        setError(
          validationError,
        );
        return;
      }

      if (
        setupIsLoading ||
        setupIsSaving ||
        !hasHydratedSetup
      ) {
        return;
      }

      setError("");

      const nextSetupStep = {
        identity:
          "race",
        race:
          "election_details",
        election:
          "command_center",
        dashboard:
          "review",
      }[step.key];

      if (
        draftWritesEnabled
      ) {
        try {
          await saveSetupDraft({
            form,
            currentStep:
              nextSetupStep ||
              "review",
          });
        } catch (
          saveError
        ) {
          setError(
            saveError?.message ||
              "Campaign Seat setup could not be saved.",
          );

          return;
        }
      }

      setActiveStep(
        (current) =>
          Math.min(
            STEPS.length - 1,
            current + 1,
          ),
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const moveBack = () => {
    setError("");

    setActiveStep(
      (current) =>
        Math.max(
          0,
          current - 1,
        ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <main
      className={
        styles.page
      }
      data-setup-theme={
        effectiveTheme
      }
    >
      <header
        className={
          styles.topbar
        }
      >
        <div
          className={
            styles.brand
          }
        >
          <span
            className={
              styles.brandMark
            }
          >
            CS
          </span>

          <div>
            <strong>
              Campaign Seat
            </strong>
            <span>
              COMMAND CENTER INITIALIZATION
            </span>
          </div>
        </div>

        <div
          className={
            styles.topStatus
          }
        >
          <span
            className={
              styles.secureDot
            }
          />
          {setupIsLoading
            ? "Synchronizing workspace"
            : "Connected to Campaign-HQ"}
        </div>
      </header>

      <div
        className={
          styles.layout
        }
      >
        <aside
          className={
            styles.commandRail
          }
        >
          <div
            className={
              styles.gridOverlay
            }
          />

          <div
            className={
              styles.core
            }
          >
            <div
              className={
                styles.coreOrb
              }
            >
              <div
                className={
                  styles.coreRingOuter
                }
              />

              <div
                className={
                  styles.coreRingInner
                }
              />

              <div
                className={
                  styles.coreCenter
                }
              >
                <Zap
                  size={24}
                />
              </div>
            </div>

            <div
              className={
                styles.coreCopy
              }
            >
              <span>
                CAMPAIGN SEAT CORE
              </span>
              <strong>
                ONLINE
              </strong>
            </div>
          </div>

          <div
            className={
              styles.progressBlock
            }
          >
            <div
              className={
                styles.progressRing
              }
              style={{
                "--progress":
                  `${progress * 3.6}deg`,
              }}
            >
              <div>
                <strong>
                  {progress}%
                </strong>
                <small>
                  CONFIGURED
                </small>
              </div>
            </div>

            <div>
              <span>
                INITIALIZATION
              </span>
              <strong>
                Building your
                campaign command
                center
              </strong>
            </div>
          </div>

          <nav
            className={
              styles.steps
            }
            aria-label="Campaign setup progress"
          >
            {STEPS.map(
              (
                item,
                index,
              ) => {
                const complete =
                  index <
                  activeStep;

                const active =
                  index ===
                  activeStep;

                return (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    disabled={
                      index >
                      activeStep
                    }
                    className={`${styles.step} ${
                      active
                        ? styles.stepActive
                        : ""
                    } ${
                      complete
                        ? styles.stepComplete
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        index <=
                        activeStep
                      ) {
                        setActiveStep(
                          index,
                        );
                        setError("");
                      }
                    }}
                  >
                    <span
                      className={
                        styles.stepNode
                      }
                    >
                      {complete ? (
                        <Check
                          size={14}
                        />
                      ) : (
                        item.number
                      )}
                    </span>

                    <span
                      className={
                        styles.stepCopy
                      }
                    >
                      <strong>
                        {
                          item.shortLabel
                        }
                      </strong>
                      <small>
                        {
                          item.command
                        }
                      </small>
                    </span>
                  </button>
                );
              },
            )}
          </nav>

          <div
            className={
              styles.intelligence
            }
          >
            <div
              className={
                styles.intelligenceHeader
              }
            >
              <Sparkles
                size={15}
              />
              <span>
                CORE RESPONSE
              </span>
            </div>

            <p>
              {
                intelligenceMessage
              }
            </p>
          </div>
        </aside>

        <section
          className={
            styles.workspace
          }
        >
          <div
            className={
              styles.mobileProgress
            }
          >
            <span>
              {step.number} /{" "}
              {
                STEPS.length
              }
            </span>

            <strong>
              {step.command}
            </strong>

            <span>
              {progress}%
            </span>
          </div>

          <div
            className={
              styles.stage
            }
          >
            <section
              key={
                step.key
              }
              className={
                styles.stagePanel
              }
            >
              <header
                className={
                  styles.stageHeader
                }
              >
                <span
                  className={
                    styles.commandLabel
                  }
                >
                  {step.number} ·{" "}
                  {step.command}
                </span>

                <h1>
                  {step.key ===
                    "identity" &&
                    "Initialize your Campaign Seat."}

                  {step.key ===
                    "race" &&
                    "Define the race."}

                  {step.key ===
                    "election" &&
                    "Set the campaign clock."}

                  {step.key ===
                    "dashboard" &&
                    "Build your command center."}

                  {step.key ===
                    "review" &&
                    "Your core workspace is ready."}
                </h1>

                <p>
                  {
                    step.description
                  }
                </p>
              </header>

              {visibleError && (
                <div
                  className={
                    styles.error
                  }
                  role="alert"
                >
                  {visibleError}
                </div>
              )}

              {step.key !==
                "review" && (
                <div
                  className={
                    styles.stageGrid
                  }
                >
                  <div
                    className={
                      styles.formSurface
                    }
                  >
                    {step.key ===
                      "identity" && (
                      <>
                        {!colorLocked && (
                        <div
                          id="workspace-color-selector"
                          className={
                            styles.setupThemeSection
                          }
                        >
                          <div
                            className={
                              styles.sectionIntro
                            }
                          >
                            <span>
                              START HERE · CAMPAIGN SEAT APPEARANCE
                            </span>

                            <strong>
                              Choose your
                              Campaign Seat color
                            </strong>

                            <p
                              className={
                                styles.setupThemeIntro
                              }
                            >
                              This becomes the
                              starting color system
                              across your Campaign
                              Seat dashboard,
                              navigation and
                              workspace tools.
                            </p>
                          </div>

                          <div
                            className={
                              styles.setupThemeGrid
                            }
                          >
                            {[
                              {
                                value:
                                  "red",
                                label:
                                  "Red",
                                description:
                                  "Traditional campaign red · often Republican-associated.",
                              },
                              {
                                value:
                                  "blue",
                                label:
                                  "Blue",
                                description:
                                  "Traditional campaign blue · often Democratic-associated.",
                              },
                              {
                                value:
                                  "purple",
                                label:
                                  "Purple",
                                description:
                                  "Battleground-inspired · a blended political palette.",
                              },
                              {
                                value:
                                  "neutral",
                                label:
                                  "Campaign Navy",
                                description:
                                  "Neutral patriotic Campaign Seat default.",
                              },
                            ].map(
                              (
                                themeOption,
                              ) => {
                                const selected =
                                  form.activeTheme ===
                                  themeOption.value;

                                return (
                                  <button
                                    key={
                                      themeOption.value
                                    }
                                    type="button"
                                    className={`${styles.setupThemeCard} ${
                                      selected
                                        ? styles.setupThemeCardSelected
                                        : ""
                                    }`}
                                    data-theme-choice={
                                      themeOption.value
                                    }
                                    onClick={() =>
                                      handleThemeSelection(
                                        themeOption.value,
                                      )
                                    }
                                  >
                                    <span
                                      className={
                                        styles.setupThemeSwatch
                                      }
                                      data-theme={
                                        themeOption.value
                                      }
                                    >
                                      <span />
                                    </span>

                                    <span
                                      className={
                                        styles.setupThemeCopy
                                      }
                                    >
                                      <strong>
                                        {
                                          themeOption.label
                                        }
                                      </strong>

                                      <small>
                                        {
                                          themeOption.description
                                        }
                                      </small>
                                    </span>

                                    <span
                                      className={
                                        styles.setupThemeCheck
                                      }
                                    >
                                      {selected && (
                                        <Check
                                          size={14}
                                        />
                                      )}
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>

                          <div
                            className={
                              styles.setupThemeResponse
                            }
                          >
                            <Sparkles
                              size={16}
                            />

                            <span>
                              <strong>
                                {
                                  !form.activeTheme
                                    ? "Choose a color to initialize your workspace"
                                    : effectiveTheme ===
                                        "red"
                                      ? "Red workspace selected"
                                      : effectiveTheme ===
                                          "blue"
                                        ? "Blue workspace selected"
                                        : effectiveTheme ===
                                            "purple"
                                          ? "Purple workspace selected"
                                          : "Campaign Navy selected"
                                }
                              </strong>

                              <small>
                                {
                                  form.activeTheme
                                    ? "This color will carry across your Campaign Seat workspace."
                                    : "Your selection will instantly configure the interface preview."
                                }
                              </small>
                            </span>
                          </div>
                        </div>

                        )}

                        <div
                          className={`${styles.sectionIntro} ${styles.workspaceTypeIntro} ${
                            (
                              !colorLocked ||
                              workspaceTypeLocked
                            )
                              ? styles.identityPhaseHidden
                              : ""
                          }`}
                        >
                          <span>
                            WORKSPACE TYPE
                          </span>

                          <strong>
                            Choose your operation
                          </strong>

                          {colorLocked && (
                            <div
                              className={
                                styles.lockedColorChip
                              }
                              data-theme={
                                effectiveTheme
                              }
                            >
                              <span
                                className={
                                  styles.lockedColorSwatch
                                }
                                data-theme={
                                  effectiveTheme
                                }
                              />

                              <span
                                className={
                                  styles.lockedColorCopy
                                }
                              >
                                <small>
                                  WORKSPACE COLOR · LOCKED
                                </small>

                                <strong>
                                  {effectiveTheme ===
                                  "red"
                                    ? "Red"
                                    : effectiveTheme ===
                                        "blue"
                                      ? "Blue"
                                      : effectiveTheme ===
                                          "purple"
                                        ? "Purple"
                                        : "Campaign Navy"}
                                </strong>
                              </span>

                              <Check
                                className={
                                  styles.lockedColorCheck
                                }
                                size={15}
                              />

                              <button
                                type="button"
                                onClick={
                                  handleThemeUnlock
                                }
                              >
                                Change
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          className={`${styles.typeGrid} ${
                            (
                              !colorLocked ||
                              workspaceTypeLocked
                            )
                              ? styles.identityPhaseHidden
                              : ""
                          }`}
                        >
                          {CAMPAIGN_TYPES.map(
                            (
                              item,
                            ) => {
                              const Icon =
                                item.icon;

                              const selected =
                                form.campaignType ===
                                item.value;

                              return (
                                <button
                                  key={
                                    item.value
                                  }
                                  type="button"
                                  className={`${styles.choiceCard} ${
                                    selected
                                      ? styles.choiceSelected
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleWorkspaceTypeSelection(
                                      item.value,
                                    )
                                  }
                                >
                                  <span
                                    className={
                                      styles.choiceIcon
                                    }
                                  >
                                    <Icon
                                      size={21}
                                    />
                                  </span>

                                  <span>
                                    <strong>
                                      {
                                        item.label
                                      }
                                    </strong>
                                    <small>
                                      {
                                        item.description
                                      }
                                    </small>
                                  </span>

                                  <span
                                    className={
                                      styles.choiceCheck
                                    }
                                  >
                                    {selected && (
                                      <Check
                                        size={13}
                                      />
                                    )}
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>

                                                <div
                          className={`${styles.lockedOperationSummary} ${
                            (
                              !colorLocked ||
                              !workspaceTypeLocked
                            )
                              ? styles.identityPhaseHidden
                              : ""
                          }`}
                        >
                          <div>
                            <small>
                              WORKSPACE TYPE · LOCKED
                            </small>

                            <strong>
                              {
                                CAMPAIGN_TYPES.find(
                                  (item) =>
                                    item.value ===
                                    form.campaignType,
                                )?.label ||
                                "Workspace"
                              }
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={
                              handleWorkspaceTypeUnlock
                            }
                          >
                            Change type
                          </button>
                        </div>

<div
                          className={`${styles.formGrid} ${
                            (
                              !colorLocked ||
                              !workspaceTypeLocked
                            )
                              ? styles.identityPhaseHidden
                              : ""
                          }`}
                        >
                          {form.campaignType ===
                            "candidate_campaign" && (
                            <label>
                              <span>
                                Candidate
                                name
                              </span>
                              <input
                                value={
                                  form.candidateName
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    "candidateName",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Candidate name"
                              />
                            </label>
                          )}

                          <label>
                            <span>
                              Public
                              campaign
                              name
                            </span>
                            <input
                              value={
                                form.publicCampaignName
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "publicCampaignName",
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Public campaign name"
                            />
                          </label>

                          <label
                            className={
                              styles.fullField
                            }
                          >
                            <span>
                              Legal
                              committee
                              name
                            </span>
                            <input
                              value={
                                form.legalCommitteeName
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "legalCommitteeName",
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Can be completed later"
                            />
                            <small>
                              Used for
                              compliance,
                              disclaimers
                              and provider
                              registrations.
                            </small>
                          </label>
                        </div>
                      </>
                    )}

                    {step.key ===
                      "race" && (
                      <>
                        <div
                          className={
                            styles.formGrid
                          }
                        >
                          <label>
                            <span>
                              Level of
                              office
                            </span>
                            <select
                              value={
                                form.officeLevel
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "officeLevel",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            >
                              {OFFICE_LEVELS.map(
                                (
                                  option,
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <label>
                            <span>
                              Office
                              sought
                            </span>
                            <input
                              value={
                                form.officeSought
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "officeSought",
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="County Commissioner"
                            />
                          </label>

                          <label>
                            <span>
                              Jurisdiction
                              type
                            </span>
                            <select
                              value={
                                form.jurisdictionType
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "jurisdictionType",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            >
                              {JURISDICTION_TYPES.map(
                                (
                                  option,
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <label>
                            <span>
                              Jurisdiction
                            </span>
                            <input
                              value={
                                form.jurisdictionName
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "jurisdictionName",
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="County, city or jurisdiction"
                            />
                          </label>

                          <label
                            className={
                              styles.fullField
                            }
                          >
                            <span>
                              District
                            </span>
                            <input
                              value={
                                form.districtLabel
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "districtLabel",
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="District or seat"
                            />
                          </label>
                        </div>

                        <div
                          className={
                            styles.partySection
                          }
                        >
                          <div
                            className={
                              styles.sectionIntro
                            }
                          >
                            <span>
                              POLITICAL PROFILE
                            </span>
                            <strong>
                              Political
                              affiliation
                            </strong>
                          </div>

                          <div
                            className={
                              styles.partyGrid
                            }
                          >
                            {POLITICAL_PARTIES.map(
                              (
                                party,
                              ) => {
                                const selected =
                                  form.politicalParty ===
                                  party.value;

                                return (
                                  <button
                                    key={
                                      party.value
                                    }
                                    type="button"
                                    data-party={
                                      party.recommendedTheme
                                    }
                                    className={`${styles.partyCard} ${
                                      selected
                                        ? styles.partySelected
                                        : ""
                                    }`}
                                    onClick={() =>
                                      updateField(
                                        "politicalParty",
                                        party.value,
                                      )
                                    }
                                  >
                                    <span
                                      className={
                                        styles.partySignal
                                      }
                                    />

                                    <strong>
                                      {
                                        party.label
                                      }
                                    </strong>

                                    <small>
                                      Political affiliation
                                    </small>

                                    {selected && (
                                      <CircleCheck
                                        size={17}
                                      />
                                    )}
                                  </button>
                                );
                              },
                            )}
                          </div>

                          <div
                            className={
                              styles.themeResponse
                            }
                          >
                            <Palette
                              size={20}
                            />

                            <div>
                              <span>
                                CAMPAIGN
                                SEAT CORE
                              </span>

                              <strong>
                                {selectedParty?.label}{" "}
                                profile
                                detected.
                              </strong>

                              <p>
                                Political affiliation
                                is stored separately
                                from workspace
                                appearance. Your
                                Campaign Seat color
                                remains{" "}
                                {effectiveTheme ===
                                "red"
                                  ? "Red"
                                  : effectiveTheme ===
                                      "blue"
                                    ? "Blue"
                                    : effectiveTheme ===
                                        "purple"
                                      ? "Purple"
                                      : "Campaign Navy"}
                                .
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {step.key ===
                      "election" && (
                      <>
                        <div
                          className={
                            styles.formGrid
                          }
                        >
                          <label>
                            <span>
                              Primary
                              election
                              (optional)
                            </span>
                            <input
                              type="date"
                              value={
                                form.primaryElectionDate
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "primaryElectionDate",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              General
                              election
                              (optional)
                            </span>
                            <input
                              type="date"
                              value={
                                form.generalElectionDate
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "generalElectionDate",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <label
                            className={
                              styles.fullField
                            }
                          >
                            <span>
                              Campaign
                              timezone
                            </span>

                            <select
                              value={
                                form.timezone
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  "timezone",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            >
                              <option value="America/New_York">
                                Eastern Time
                              </option>

                              <option value="America/Chicago">
                                Central Time
                              </option>

                              <option value="America/Denver">
                                Mountain Time
                              </option>

                              <option value="America/Phoenix">
                                Arizona Time
                              </option>

                              <option value="America/Los_Angeles">
                                Pacific Time
                              </option>

                              <option value="America/Anchorage">
                                Alaska Time
                              </option>

                              <option value="Pacific/Honolulu">
                                Hawaii Time
                              </option>
                            </select>

                            <small>
                              Used for campaign
                              deadlines, calendar
                              events, reminders
                              and reporting.
                            </small>
                          </label>
                        </div>

                        <div
                          className={
                            styles.sectionIntro
                          }
                        >
                          <span>
                            CAMPAIGN
                            IDENTITY
                          </span>
                          <strong>
                            Public campaign
                            contact
                            information
                          </strong>
                        </div>

                        <div
                          className={
                            styles.contactIdentityNotice
                          }
                        >
                          <Mail
                            size={17}
                          />

                          <div>
                            <strong>
                              Public campaign information
                            </strong>

                            <p>
                              Enter the email,
                              phone number and
                              website the campaign
                              uses publicly. This
                              does not connect
                              Gmail, Outlook or
                              campaign texting yet.
                              Secure account
                              connections are
                              configured later.
                            </p>
                          </div>
                        </div>

                        <div
                          className={
                            styles.formGrid
                          }
                        >
                          <label>
                            <span>
                              Campaign
                              email
                            </span>

                            <div
                              className={
                                styles.inputIcon
                              }
                            >
                              <Mail
                                size={17}
                              />
                              <input
                                type="email"
                                value={
                                  form.campaignEmail
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    "campaignEmail",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="campaign@example.com"
                              />
                            </div>
                          </label>

                          <label>
                            <span>
                              Campaign
                              phone
                            </span>

                            <div
                              className={
                                styles.inputIcon
                              }
                            >
                              <Phone
                                size={17}
                              />
                              <input
                                value={
                                  form.campaignPhone
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    "campaignPhone",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="(561) 555-0123"
                              />
                            </div>
                          </label>

                          <label
                            className={
                              styles.fullField
                            }
                          >
                            <span>
                              Campaign
                              website
                            </span>

                            <div
                              className={
                                styles.inputIcon
                              }
                            >
                              <Globe2
                                size={17}
                              />
                              <input
                                value={
                                  form.websiteUrl
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    "websiteUrl",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="https://example.com"
                              />
                            </div>
                          </label>
                        </div>
                      </>
                    )}

                    {step.key ===
                      "dashboard" && (
                      <>
                        <div
                          className={
                            styles.allToolsNotice
                          }
                        >
                          <Sparkles
                            size={20}
                          />

                          <div>
                            <span>
                              FULL CAMPAIGN SEAT EXPERIENCE
                            </span>

                            <strong>
                              All tools are enabled from day one
                            </strong>

                            <p>
                              Your campaign starts
                              with the complete
                              Campaign Seat
                              command center.
                              Tools can be hidden
                              later in Workspace
                              Settings if your
                              team does not use
                              them.
                            </p>
                          </div>
                        </div>

                        <div
                          className={
                            styles.moduleGrid
                          }
                        >
                          {CAMPAIGN_MODULES.map(
                            (
                              module,
                            ) => {
                              const Icon =
                                MODULE_ICONS[
                                  module.key
                                ] ||
                                LayoutDashboard;

                              const enabled =
                                form.enabledModules.includes(
                                  module.key,
                                );

                              return (
                                <button
                                  key={
                                    module.key
                                  }
                                  type="button"
                                  className={`${styles.moduleCard} ${
                                    enabled
                                      ? styles.moduleEnabled
                                      : ""
                                  }`}
                                  onClick={() =>
                                    toggleModule(
                                      module,
                                    )
                                  }
                                  aria-pressed={
                                    enabled
                                  }
                                >
                                  <span
                                    className={
                                      styles.moduleIcon
                                    }
                                  >
                                    <Icon
                                      size={18}
                                    />
                                  </span>

                                  <span
                                    className={
                                      styles.moduleCopy
                                    }
                                  >
                                    <strong>
                                      {
                                        module.label
                                      }
                                    </strong>

                                    <small>
                                      Enabled by default
                                    </small>
                                  </span>

                                  <span
                                    className={
                                      styles.moduleToggle
                                    }
                                  >
                                    <span />
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <WorkspacePreview
                    form={
                      form
                    }
                    theme={
                      effectiveTheme
                    }
                    selectedModules={
                      selectedModules
                    }
                  />
                </div>
              )}

              {step.key ===
                "review" && (
                <div
                  className={
                    styles.activation
                  }
                >
                  <div
                    className={
                      styles.activationHero
                    }
                  >
                    <div
                      className={
                        styles.activationCore
                      }
                    >
                      <div
                        className={
                          styles.activationRingOne
                        }
                      />
                      <div
                        className={
                          styles.activationRingTwo
                        }
                      />

                      <CircleCheck
                        size={38}
                      />
                    </div>

                    <span>
                      CORE WORKSPACE
                      READY
                    </span>

                    <h2>
                      {form.publicCampaignName ||
                        form.candidateName ||
                        "Campaign Workspace"}
                    </h2>

                    <p>
                      {[
                        form.officeSought,
                        form.jurisdictionName,
                        form.districtLabel,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(" · ")}
                    </p>
                  </div>

                  <div
                    className={
                      styles.activationGrid
                    }
                  >
                    {[
                      [
                        "Campaign profile",
                        "Ready",
                        true,
                      ],
                      [
                        "Workspace appearance",
                        effectiveTheme === "red"
                          ? "Red"
                          : effectiveTheme === "blue"
                            ? "Blue"
                            : effectiveTheme === "purple"
                              ? "Purple"
                              : "Campaign Navy",
                        true,
                      ],
                      [
                        "Political affiliation",
                        selectedParty?.label ||
                          "Not specified",
                        true,
                      ],
                      [
                        "Election setup",
                        formatDate(
                          form.primaryElectionDate ||
                            form.generalElectionDate,
                        ),
                        true,
                      ],
                      [
                        "Command center",
                        `All ${selectedModules.length} tools enabled`,
                        true,
                      ],
                      [
                        "Security",
                        "Complete secure account setup next",
                        false,
                      ],
                      [
                        "Team & access",
                        "Invite and assign your team next",
                        false,
                      ],
                      [
                        "Email & contacts",
                        "Connect Google or Microsoft next",
                        false,
                      ],
                      [
                        "Calendar",
                        "Connect campaign calendar next",
                        false,
                      ],
                      [
                        "Files",
                        "Connect Drive or OneDrive next",
                        false,
                      ],
                      [
                        "Campaign texting",
                        "Number and compliance setup next",
                        false,
                      ],
                    ].map(
                      ([
                        label,
                        detail,
                        ready,
                      ]) => (
                        <article
                          key={
                            label
                          }
                          className={
                            ready
                              ? styles.activationReady
                              : ""
                          }
                        >
                          <span>
                            {ready ? (
                              <Check
                                size={13}
                              />
                            ) : (
                              <Zap
                                size={13}
                              />
                            )}
                          </span>

                          <div>
                            <strong>
                              {
                                label
                              }
                            </strong>
                            <small>
                              {
                                detail
                              }
                            </small>
                          </div>
                        </article>
                      ),
                    )}
                  </div>

                  <div
                    className={
                      styles.activationNotice
                    }
                  >
                    <ShieldCheck
                      size={20}
                    />

                    <div>
                      <strong>
                        Preview
                        configuration
                        complete
                      </strong>

                      <p>
                        Campaign Seat is
                        now reading this
                        workspace directly
                        from Campaign-HQ.
                        Changes remain local
                        until the protected
                        save and activation
                        actions are enabled
                        in the next step.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <footer
            className={
              styles.actions
            }
          >
            <div
              className={
                styles.previewNotice
              }
            >
              <span />
              {setupIsLoading
                ? "Synchronizing Campaign-HQ workspace…"
                : draftWritesEnabled
                  ? setupIsSaving
                    ? "Saving protected Campaign Seat draft…"
                    : setupLastSavedAt
                      ? "Protected draft saved · Activate Workspace remains locked"
                      : "Protected draft test enabled · Activate Workspace remains locked"
                  : "Connected workspace · Draft writes locked"}
            </div>

            <div
              className={
                styles.actionButtons
              }
            >
              {activeStep >
                0 && (
                <button
                  type="button"
                  className={
                    styles.backButton
                  }
                  onClick={
                    moveBack
                  }
                >
                  <ChevronLeft
                    size={17}
                  />
                  Back
                </button>
              )}

              {activeStep <
                STEPS.length -
                  1 &&
                !(
                  step.key ===
                    "identity" &&
                  (
                    !colorLocked ||
                    !workspaceTypeLocked
                  )
                ) && (
                <button
                  type="button"
                  className={
                    styles.continueButton
                  }
                  onClick={
                    moveNext
                  }
                  disabled={
                    setupIsLoading ||
                    setupIsSaving ||
                    !hasHydratedSetup
                  }
                >
                  {setupIsSaving
                    ? "Saving…"
                    : "Continue"}
                  <ChevronRight
                    size={17}
                  />
                </button>
              )}

              {activeStep ===
                STEPS.length -
                  1 && (
                <button
                  type="button"
                  className={
                    styles.activateButton
                  }
                  onClick={
                    async () => {
                      if (
                        !activationWritesEnabled
                      ) {
                        window.alert(
                          "Protected workspace activation remains locked. Use the controlled activation test before making this action live.",
                        );
                        return;
                      }

                      try {
                        await activateSetupWorkspace(
                          {
                            form,
                          },
                        );

                        window.location.assign(
                          "/workspace/settings?tab=security",
                        );
                      } catch {
                        // The protected Setup hook
                        // surfaces MFA and role errors.
                      }
                    }
                  }
                  disabled={
                    setupIsLoading ||
                    setupIsSaving ||
                    setupIsActivating ||
                    !hasHydratedSetup
                  }
                >
                  <Zap
                    size={17}
                  />
                  {setupIsActivating
                    ? "Activating…"
                    : "Activate Workspace"}
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
