import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  LockKeyhole,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Vote,
} from "lucide-react";

import campaignHero1 from "../../assets/images/login/hero.jpg";
import campaignHero2 from "../../assets/images/login/hero2.jpg";
import campaignHero3 from "../../assets/images/login/hero3.jpg";

import {
  clearCampaignSession,
  getCampaignMemberships,
  getCurrentUser,
  getDashboardRoute,
  getUserInitials,
  selectCampaignWorkspace,
} from "../../utils/campaignSession";

import styles from "./WorkspaceSelector.module.css";

const lastOpenedWorkspaceMemory =
  new Map();

function readLastOpenedWorkspaces() {
  return Object.fromEntries(
    lastOpenedWorkspaceMemory,
  );
}

function saveLastOpenedWorkspace(
  current,
  workspaceId,
) {
  if (!workspaceId) {
    return current;
  }

  const openedAt =
    new Date().toISOString();

  // Keep workspace recency only in memory for the current app session.
  // Workspace identifiers are never persisted to browser storage.
  lastOpenedWorkspaceMemory.set(
    workspaceId,
    openedAt,
  );

  return {
    ...current,
    [workspaceId]: openedAt,
  };
}

function formatLastOpened(value) {
  if (!value) {
    return "Not opened yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not opened yet";
  }

  const today = new Date();

  const sameDay =
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() ===
      today.getDate();

  const time =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(date);

  if (sameDay) {
    return `Today at ${time}`;
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


const ELIZABETH_WORKSPACE_ID =
  "11111111-1111-1111-1111-111111111111";

const campaignImagesByWorkspace = {
  [ELIZABETH_WORKSPACE_ID]: [
    campaignHero1,
    campaignHero2,
    campaignHero3,
  ],
};

const fallbackCampaignImages = [
  campaignHero1,
  campaignHero2,
  campaignHero3,
];

function getCampaignImages(workspaceId) {
  return (
    campaignImagesByWorkspace[workspaceId] ||
    fallbackCampaignImages
  );
}

function getDashboardLabel(dashboardType) {
  const labels = {
    candidate: "Candidate HQ",
    command: "Campaign HQ",
    department: "Department HQ",
    captain: "Team Captain HQ",
    volunteer: "Volunteer HQ",
    reviewer: "Review HQ",
  };

  return (
    labels[dashboardType] ||
    "Campaign Workspace"
  );
}

function getSeatLabel(seatType) {
  const labels = {
    command: "Campaign Management Access",
    staff: "Staff Access",
    volunteer: "Volunteer Access",
    reviewer: "Review Access",
  };

  return labels[seatType] || "Campaign Access";
}

function getGreeting() {
  const currentHour =
    new Date().getHours();

  if (currentHour < 12) {
    return "Good morning";
  }

  if (currentHour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getDaysUntilElection(dateValue) {
  if (!dateValue) {
    return null;
  }

  const electionDate =
    new Date(`${dateValue}T00:00:00`);

  if (
    Number.isNaN(
      electionDate.getTime(),
    )
  ) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const milliseconds =
    electionDate.getTime() -
    today.getTime();

  return Math.max(
    0,
    Math.ceil(
      milliseconds /
        (1000 * 60 * 60 * 24),
    ),
  );
}

export default function WorkspaceSelector() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    lastOpenedByWorkspace,
    setLastOpenedByWorkspace,
  ] = useState(
    readLastOpenedWorkspaces,
  );

  const [activeSlide, setActiveSlide] =
    useState(0);

  const user = getCurrentUser();

  const memberships =
    getCampaignMemberships();

  const primaryMembership =
    memberships[0] || null;

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setActiveSlide((current) => {
          return (
            (current + 1) %
            fallbackCampaignImages.length
          );
        });
      }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const filteredMemberships =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return memberships;
      }

      return memberships.filter(
        (membership) => {
          const workspace =
            membership.workspace;

          return [
            workspace?.name,
            workspace?.description,
            workspace?.location,
            membership.roleName,
            membership.displayTitle,
          ]
            .filter(Boolean)
            .some((value) =>
              value
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ),
            );
        },
      );
    }, [memberships, searchTerm]);

  const visibleMemberships =
    useMemo(() => {
      return [
        ...filteredMemberships,
      ].sort((left, right) => {
        const leftId =
          left.workspaceId ||
          left.workspace?.id;

        const rightId =
          right.workspaceId ||
          right.workspace?.id;

        const leftTime =
          Date.parse(
            lastOpenedByWorkspace[
              leftId
            ] || "",
          ) || 0;

        const rightTime =
          Date.parse(
            lastOpenedByWorkspace[
              rightId
            ] || "",
          ) || 0;

        return rightTime - leftTime;
      });
    }, [
      filteredMemberships,
      lastOpenedByWorkspace,
    ]);

  const electionCountdown =
    getDaysUntilElection(
      primaryMembership?.workspace
        ?.electionDateRaw,
    );

  const firstName =
    user.name?.split(" ")[0] ||
    "there";

  const handleSelectWorkspace = (
    membership,
  ) => {
    const workspaceId =
      membership.workspaceId ||
      membership.workspace?.id;

    setLastOpenedByWorkspace(
      (current) =>
        saveLastOpenedWorkspace(
          current,
          workspaceId,
        ),
    );

    const selectedMembership =
      selectCampaignWorkspace(
        membership,
      );

    navigate(
      getDashboardRoute(
        selectedMembership.dashboardType,
      ),
      {
        replace: true,
      },
    );
  };

  const handleLogout = async () => {
    await clearCampaignSession();

    navigate("/", {
      replace: true,
    });
  };

  return (
    <div className={styles.page}>
      <div
        className={styles.backgroundGlow}
        aria-hidden="true"
      />

      <div
        className={styles.backgroundGrid}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div
              className={styles.brandMark}
              aria-hidden="true"
            >
              <span>HQ</span>
            </div>

            <div className={styles.brandCopy}>
              <strong>
                Campaign Seat
              </strong>

              <span>
                Campaign Access
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div
              className={
                styles.membershipBadge
              }
            >
              <Layers3
                size={16}
                strokeWidth={1.9}
              />

              <span>
                {memberships.length}{" "}
                {memberships.length === 1
                  ? "Campaign Workspace"
                  : "Campaign Workspaces"}
              </span>
            </div>

            <div className={styles.profile}>
              <div
                className={styles.avatar}
                aria-hidden="true"
              >
                {getUserInitials(
                  user.name,
                )}
              </div>

              <div
                className={
                  styles.profileCopy
                }
              >
                <strong>
                  {user.name}
                </strong>

                <span>
                  {primaryMembership
                    ?.displayTitle ||
                    "Campaign HQ Account"}
                </span>
              </div>

              <button
                className={
                  styles.logoutButton
                }
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <LogOut
                  size={18}
                  strokeWidth={1.9}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={[
          styles.main,
          memberships.length > 1
            ? styles.multipleMain
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <section
          className={
            styles.workspaceSection
          }
        >
          <div className={styles.intro}>
            <div>
              <div
                className={styles.eyebrow}
              >
                <Sparkles
                  size={14}
                  strokeWidth={2}
                />

                {memberships.length === 1
                  ? "Your Campaign Workspace"
                  : "Your Campaign Workspaces"}
              </div>

              <h1>
                {getGreeting()},{" "}
                {firstName}.
              </h1>

              <p>
                {memberships.length === 1
                  ? "Confirm your campaign and access, then open Campaign HQ."
                  : "Choose the campaign you want to manage. Each workspace keeps its own team, access, data and dashboard."}
              </p>
            </div>

            {memberships.length > 1 && (
              <div
                className={
                  styles.searchWrap
                }
              >
                <Search
                  size={19}
                  strokeWidth={1.8}
                />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value,
                    )
                  }
                  placeholder="Search campaign workspaces"
                  aria-label="Search campaigns"
                />
              </div>
            )}
          </div>

          <div className={styles.workspaceGrid}>
            {filteredMemberships.length ? (
              visibleMemberships.map(
                (membership) => {
                  const workspace =
                    membership.workspace;

                  const campaignImages =
                    getCampaignImages(
                      membership.workspaceId,
                    );

                  const currentImage =
                    campaignImages[
                      activeSlide %
                        campaignImages.length
                    ];

                  return (
                    <article
                      key={
                        membership.membershipId
                      }
                      className={
                        styles.campaignCard
                      }
                      style={{
                        backgroundImage: `
                          linear-gradient(
                            90deg,
                            rgba(3, 16, 35, 0.96),
                            rgba(3, 16, 35, 0.76) 52%,
                            rgba(3, 16, 35, 0.25)
                          ),
                          linear-gradient(
                            180deg,
                            transparent 42%,
                            rgba(2, 13, 30, 0.8)
                          ),
                          url(${currentImage})
                        `,
                      }}
                    >
                      <div
                        className={
                          styles.cardTop
                        }
                      >
                        <div
                          className={
                            styles.campaignIdentity
                          }
                        >
                          <div
                            className={
                              styles.campaignMark
                            }
                          >
                            <span>
                              {getUserInitials(
                                workspace.name,
                              )}
                            </span>

                            <Vote
                              size={18}
                              strokeWidth={1.8}
                            />
                          </div>

                          <div>
                            <span>
                              Campaign Workspace
                            </span>

                            <strong>
                              {workspace.status === "active"
                                ? "Active"
                                : workspace.status}
                            </strong>

                            <small
                              className={
                                styles.lastOpened
                              }
                            >
                              Last opened:{" "}
                              {formatLastOpened(
                                lastOpenedByWorkspace[
                                  workspace.id
                                ],
                              )}
                            </small>
                          </div>
                        </div>

                        <div
                          className={
                            styles.roleBadge
                          }
                        >
                          <ShieldCheck
                            size={15}
                            strokeWidth={2}
                          />

                          {
                            membership.displayTitle
                          }
                        </div>
                      </div>

                      <div
                        className={
                          styles.cardContent
                        }
                      >
                        <p>
                          Palm Beach County,
                          Florida
                        </p>

                        <h2>
                          {workspace.name}
                        </h2>

                        <h3>
                          {
                            workspace.description
                          }
                        </h3>

                        <div
                          className={
                            styles.campaignDetails
                          }
                        >
                          <div>
                            <CalendarDays
                              size={18}
                              strokeWidth={1.8}
                            />

                            <span>
                              Next Election
                            </span>

                            <strong>
                              {
                                workspace.electionDate
                              }
                            </strong>
                          </div>

                          <div>
                            <BriefcaseBusiness
                              size={18}
                              strokeWidth={1.8}
                            />

                            <span>
                              Your Role
                            </span>

                            <strong>
                              {
                                membership.displayTitle
                              }
                            </strong>
                          </div>

                          <div>
                            <UsersRound
                              size={18}
                              strokeWidth={1.8}
                            />

                            <span>
                              Workspace Access
                            </span>

                            <strong>
                              {getSeatLabel(
                                membership.seatType,
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div
                        className={
                          styles.cardFooter
                        }
                      >
                        <div
                          className={
                            styles.slideDots
                          }
                          aria-label="Campaign images"
                        >
                          {campaignImages.map(
                            (
                              image,
                              index,
                            ) => (
                              <button
                                key={image}
                                className={
                                  index ===
                                  activeSlide %
                                    campaignImages.length
                                    ? styles.activeDot
                                    : ""
                                }
                                type="button"
                                onClick={() =>
                                  setActiveSlide(
                                    index,
                                  )
                                }
                                aria-label={`Show campaign image ${
                                  index + 1
                                }`}
                              />
                            ),
                          )}
                        </div>

                        <button
                          className={
                            styles.enterButton
                          }
                          type="button"
                          onClick={() =>
                            handleSelectWorkspace(
                              membership,
                            )
                          }
                        >
                          <span>
                            Open Campaign HQ
                          </span>

                          <ArrowRight
                            size={19}
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    </article>
                  );
                },
              )
            ) : (
              <div
                className={
                  styles.emptyState
                }
              >
                <Search
                  size={30}
                  strokeWidth={1.6}
                />

                <h2>
                  No campaigns found
                </h2>

                <p>
                  Try another campaign name,
                  location or role.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setSearchTerm("")
                  }
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sidePanel}
          hidden={memberships.length > 1}>
          <div
            className={styles.accessCard}
          >
            <div
              className={
                styles.accessHeader
              }
            >
              <div
                className={
                  styles.accessIcon
                }
              >
                <LockKeyhole
                  size={21}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <span>
                  Your Campaign Access
                </span>

                <h2>
                  {
                    primaryMembership
                      ?.displayTitle
                  }
                </h2>
              </div>
            </div>

            <p>
              Your assigned role and permissions are applied automatically when you open this workspace.
            </p>

            <div
              className={styles.accessList}
            >
              <div>
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                />

                <span>
                  {getDashboardLabel(
                    primaryMembership
                      ?.dashboardType,
                  )}
                </span>
              </div>

              <div>
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                />

                <span>
                  {getSeatLabel(
                    primaryMembership
                      ?.seatType,
                  )}
                </span>
              </div>

              <div>
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                />

                <span>
                  {
                    primaryMembership
                      ?.permissions?.length ||
                    0
                  }{" "}
                  permissions enabled
                </span>
              </div>
            </div>
          </div>

          <div
            className={
              styles.countdownCard
            }
          >
            <div>
              <Clock3
                size={20}
                strokeWidth={1.8}
              />

              <span>
                Next Election
              </span>
            </div>

            <strong>
              {electionCountdown ?? "—"}
            </strong>

            <p>
              Days until{" "}
              {
                primaryMembership
                  ?.workspace
                  ?.electionDate
              }
            </p>
          </div>

          <div className={styles.locationCard}>
            <MapPin
              size={19}
              strokeWidth={1.8}
            />

            <div>
              <span>
                Campaign Location
              </span>

              <strong>
                {
                  primaryMembership
                    ?.workspace
                    ?.location
                }
              </strong>
            </div>
          </div>

          <div className={styles.inviteCard}>
            <span>
              Need access to another campaign?
            </span>

            <p>
              Ask the campaign owner or an authorized administrator to invite your Campaign Seat account.
            </p>
          </div>
        </aside>
      </main>

      <footer className={styles.footer}>
        <span>
          © 2026 Campaign Seat Technologies LLC
        </span>

        <span>
          Build the campaign. Win the seat.
        </span>
      </footer>
    </div>
  );
}
