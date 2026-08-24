import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import {
  CampaignDateTime,
} from "../../components/CampaignDateTime/CampaignDateTime";
import {
  getCurrentUser,
  getCurrentWorkspace,
  getUserInitials,
} from "../../utils/campaignSession";
import {
  useVolunteerTasks,
} from "../../hooks/useVolunteerTasks";

import {
  supabase,
} from "../../lib/supabase";

import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./VolunteerDashboard.module.css";

function getGreeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getElectionCountdown(
  electionDateRaw,
) {
  if (!electionDateRaw) {
    return null;
  }

  const electionDate =
    new Date(
      `${electionDateRaw}T00:00:00`,
    );

  if (
    Number.isNaN(
      electionDate.getTime(),
    )
  ) {
    return null;
  }

  const milliseconds =
    electionDate.getTime() -
    Date.now();

  return Math.max(
    0,
    Math.ceil(
      milliseconds /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function formatDue(value) {
  if (!value) {
    return "No due date";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date unavailable";
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

function statusLabel(value) {
  const labels = {
    open: "Assigned",
    in_progress:
      "In progress",
    completed: "Completed",
  };

  return (
    labels[value] ||
    String(value || "Assigned")
  );
}

export default function VolunteerDashboard() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const candidateName =
    workspace.candidateName ||
    workspace.name ||
    "the campaign";

  const districtLabel =
    workspace.districtLabel ||
    workspace.officeSought ||
    workspace.description ||
    "your community";

  const jurisdictionLabel =
    workspace.jurisdictionName ||
    workspace.location ||
    "the community";

  const candidateInitials =
    getUserInitials(
      candidateName,
    );

  const [
    candidatePhotoUrl,
    setCandidatePhotoUrl,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadPhoto =
      async () => {
        const storagePath =
          workspace.candidatePhotoPath;

        if (!storagePath) {
          setCandidatePhotoUrl(
            "",
          );
          return;
        }

        try {
          const {
            data,
            error:
              signedUrlError,
          } =
            await supabase.storage
              .from(
                "campaign-files",
              )
              .createSignedUrl(
                storagePath,
                21600,
              );

          if (
            signedUrlError
          ) {
            throw signedUrlError;
          }

          if (!cancelled) {
            setCandidatePhotoUrl(
              data?.signedUrl ||
              "",
            );
          }
        } catch {
          if (!cancelled) {
            setCandidatePhotoUrl(
              "",
            );
          }
        }
      };

    void loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [
    workspace.candidatePhotoPath,
  ]);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] =
    useState(false);

  const {
    tasks,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    updateStatus,
  } =
    useVolunteerTasks({
      workspaceId:
        workspace.id,
      userId:
        user.id,
    });

  const activeTasks =
    useMemo(
      () =>
        tasks.filter(
          (task) =>
            ![
              "completed",
              "archived",
            ].includes(
              task.status,
            ),
        ),
      [tasks],
    );

  const completedTasks =
    tasks.filter(
      (task) =>
        task.status ===
        "completed",
    );

  const nextTask =
    activeTasks[0] ||
    null;

  const totalTracked =
    activeTasks.length +
    completedTasks.length;

  const volunteerReadiness =
    totalTracked
      ? Math.round(
          (
            completedTasks.length /
            totalTracked
          ) * 100,
        )
      : 0;

  const firstName =
    user.name
      .split(" ")[0] ||
    "Volunteer";

  const countdown =
    getElectionCountdown(
      workspace.electionDateRaw,
    );

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Overview"
        sidebarOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={
          shellStyles
        }
        showLeadership={false}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span>
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Volunteer
              </span>

              <strong>
                My campaign workspace
              </strong>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <CampaignDateTime />

            <span className={styles.secureBadge}>
              <ShieldCheck
                size={15}
              />
              Assigned access
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.welcome}>
            <div>
              <span>
                Volunteer field workspace
              </span>

              <h1>
                {getGreeting()},{" "}
                <strong>
                  {firstName}.
                </strong>
              </h1>

              <p>
                Your campaign work,
                assignments and approved
                resources—all in one
                focused workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={
                isLoading
              }
            >
              {isLoading ? (
                <LoaderCircle
                  className={styles.spinning}
                  size={17}
                />
              ) : (
                <RefreshCw
                  size={17}
                />
              )}
              Refresh
            </button>
          </section>

          {error && (
            <div
              className={styles.error}
              role="alert"
            >
              {error}
            </div>
          )}

          <section className={styles.campaignHero}>
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}>
                <Sparkles size={16} />
                Campaign spotlight
              </div>

              <h2>
                Building momentum for
                <strong>
                  {districtLabel}.
                </strong>
              </h2>

              <p>
                Every volunteer shift,
                conversation and completed
                assignment helps move{" "}
                {candidateName} forward.
              </p>

              <div className={styles.heroTags}>
                <span>Community</span>
                <span>Field team</span>
                <span>
                  {jurisdictionLabel}
                </span>
              </div>

              <div className={styles.heroProgress}>
                <div className={styles.countdown}>
                  <span>
                    Election day
                  </span>

                  <strong>
                    {countdown ?? "—"}
                  </strong>

                  <small>
                    {countdown === null
                      ? "Election date not set"
                      : `days to ${workspace.electionDate}`}
                  </small>
                </div>

                <div className={styles.readiness}>
                  <div>
                    <span>
                      My volunteer readiness
                    </span>

                    <strong>
                      {
                        volunteerReadiness
                      }
                      %
                    </strong>
                  </div>

                  <div className={styles.progressTrack}>
                    <span
                      style={{
                        width:
                          `${volunteerReadiness}%`,
                      }}
                    />
                  </div>

                  <small>
                    {totalTracked
                      ? `${completedTasks.length} of ${totalTracked} assigned tasks completed`
                      : "Your progress begins with your first assignment"}
                  </small>
                </div>
              </div>

            </div>

            <div className={styles.heroPortrait}>
              <div className={styles.flagGlow} />

              {candidatePhotoUrl ? (
                <img
                  src={
                    candidatePhotoUrl
                  }
                  alt={`${candidateName} campaign portrait`}
                />
              ) : (
                <div
                  className={
                    styles.portraitFallback
                  }
                  aria-label="Candidate photo not uploaded"
                >
                  <strong>
                    {candidateInitials}
                  </strong>

                  <span>
                    Candidate photo
                  </span>
                </div>
              )}

              <div className={styles.portraitCaption}>
                <span>
                  Volunteer mission
                </span>

                <strong>
                  Help strengthen{" "}
                  {districtLabel} in{" "}
                  {jurisdictionLabel}.
                </strong>
              </div>
            </div>
          </section>

          <section
            className={styles.volunteerActionBar}
            aria-label="Volunteer quick actions"
          >
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/tasks",
                )
              }
            >
              <ClipboardCheck
                size={18}
              />

              <span>
                <strong>
                  My tasks
                </strong>

                <small>
                  View assigned work
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/field-assignment",
                )
              }
            >
              <MapPin size={18} />

              <span>
                <strong>
                  My field assignment
                </strong>

                <small>
                  Open precinct and route
                </small>
              </span>
            </button>

            <button
              type="button"
              disabled
            >
              <CalendarDays
                size={18}
              />

              <span>
                <strong>
                  My schedule
                </strong>

                <small>
                  Shifts and events · Soon
                </small>
              </span>
            </button>

            <button
              type="button"
              disabled
            >
              <MessageSquareText
                size={18}
              />

              <span>
                <strong>
                  Message coordinator
                </strong>

                <small>
                  Campaign support · Soon
                </small>
              </span>
            </button>
          </section>

          <section className={styles.assignmentGrid}>
            <article className={styles.primaryAssignment}>
              <div className={styles.cardLabel}>
                <MapPin size={18} />
                My field assignment
              </div>

              <h2>
                Precinct assignment
                pending
              </h2>

              <p>
                A campaign manager will
                assign your precinct,
                turf, shift and route
                here.
              </p>

              <div className={styles.assignmentFacts}>
                <div>
                  <span>Precinct</span>
                  <strong>
                    Not assigned
                  </strong>
                </div>

                <div>
                  <span>Job</span>
                  <strong>
                    Not assigned
                  </strong>
                </div>

                <div>
                  <span>Shift</span>
                  <strong>
                    Not scheduled
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/field-assignment",
                  )
                }
              >
                <Navigation
                  size={17}
                />
                Open My Field Assignment
              </button>
            </article>

            <article className={styles.statusCard}>
              <Route size={23} />

              <span>
                Route progress
              </span>

              <strong>
                0%
              </strong>

              <p>
                Door and route tracking
                will activate in Field
                Operations.
              </p>
            </article>

            <article className={styles.statusCard}>
              <CalendarDays
                size={23}
              />

              <span>
                Next shift
              </span>

              <strong>
                Not scheduled
              </strong>

              <p>
                Your confirmed volunteer
                shifts will appear here.
              </p>
            </article>
          </section>

          <section className={styles.summaryGrid}>
            <article>
              <ClipboardCheck
                size={22}
              />

              <div>
                <span>
                  Assigned
                </span>

                <strong>
                  {
                    activeTasks.length
                  }
                </strong>
              </div>
            </article>

            <article>
              <Clock3 size={22} />

              <div>
                <span>
                  Next deadline
                </span>

                <strong>
                  {nextTask
                    ? formatDue(
                        nextTask.due_at,
                      )
                    : "All clear"}
                </strong>
              </div>
            </article>

            <article>
              <CheckCircle2
                size={22}
              />

              <div>
                <span>
                  Completed
                </span>

                <strong>
                  {
                    completedTasks.length
                  }
                </strong>
              </div>
            </article>
          </section>

          <section className={styles.tasksPanel}>
            <header>
              <div>
                <span>
                  My responsibilities
                </span>

                <h2>
                  Assigned tasks
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/tasks",
                  )
                }
              >
                Open My Tasks
                <ChevronRight
                  size={16}
                />
              </button>
            </header>

            {isLoading ? (
              <div className={styles.loading}>
                <LoaderCircle
                  className={styles.spinning}
                  size={28}
                />
                Loading your assignments
              </div>
            ) : activeTasks.length ? (
              <div className={styles.taskList}>
                {activeTasks
                  .slice(0, 5)
                  .map(
                    (task) => (
                      <article
                        key={task.id}
                      >
                        <div>
                          <span>
                            {
                              task.category
                            }
                          </span>

                          <h3>
                            {
                              task.title
                            }
                          </h3>

                          <p>
                            {formatDue(
                              task.due_at,
                            )}
                          </p>
                        </div>

                        <div className={styles.taskActions}>
                          <small>
                            {statusLabel(
                              task.status,
                            )}
                          </small>

                          {task.status ===
                            "open" && (
                            <button
                              type="button"
                              disabled={
                                isSaving
                              }
                              onClick={() =>
                                updateStatus(
                                  task.id,
                                  "in_progress",
                                )
                              }
                            >
                              Start
                            </button>
                          )}

                          {task.status ===
                            "in_progress" && (
                            <button
                              type="button"
                              disabled={
                                isSaving
                              }
                              onClick={() =>
                                updateStatus(
                                  task.id,
                                  "completed",
                                )
                              }
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </article>
                    ),
                  )}
              </div>
            ) : (
              <div className={styles.empty}>
                <CheckCircle2
                  size={31}
                />

                <strong>
                  No assigned work right
                  now
                </strong>

                <p>
                  New responsibilities
                  will appear here when a
                  campaign manager assigns
                  them to you.
                </p>
              </div>
            )}
          </section>

          <section className={styles.nextFoundation}>
            <div>
              <span>
                Field Operations
              </span>

              <h2>
                The secure foundation is
                ready
              </h2>

              <p>
                Next we connect precincts,
                turfs, door-knocking
                routes, check-in,
                completion results and
                maps.
              </p>
            </div>

            <small>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString(
                    [],
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}`
                : "Waiting for sync"}
            </small>
          </section>
        </main>
      </div>
    </div>
  );
}
