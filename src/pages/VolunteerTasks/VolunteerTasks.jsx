import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Menu,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";
import { useVolunteerTasks } from "../../hooks/useVolunteerTasks";

import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./VolunteerTasks.module.css";

function formatDue(value) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPriority(value) {
  return String(value || "normal")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) => character.toUpperCase(),
    );
}

export default function VolunteerTasks() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("active");

  const {
    tasks,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    updateStatus,
  } = useVolunteerTasks({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) =>
        view === "completed"
          ? task.status === "completed"
          : task.status !== "completed",
      ),
    [tasks, view],
  );

  const activeCount = tasks.filter(
    (task) => task.status !== "completed",
  ).length;

  const completedCount = tasks.filter(
    (task) => task.status === "completed",
  ).length;

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="My tasks"
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        styles={shellStyles}
        showLeadership={false}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span>
                Campaign HQ
                <ChevronRight size={13} />
                Volunteer
              </span>
              <strong>My Tasks</strong>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <CampaignDateTime />
            <span className={styles.secureBadge}>
              <ShieldCheck size={15} />
              Private assignments
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span>Your responsibilities</span>
              <h1>My Tasks</h1>
              <p>
                Review only the work assigned directly to you
                and update its progress.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle
                  className={styles.spinning}
                  size={17}
                />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh
            </button>
          </section>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <section className={styles.summary}>
            <button
              type="button"
              className={
                view === "active"
                  ? styles.activeSummary
                  : ""
              }
              onClick={() => setView("active")}
            >
              <Clock3 size={21} />
              <div>
                <span>Assigned</span>
                <strong>{activeCount}</strong>
              </div>
            </button>

            <button
              type="button"
              className={
                view === "completed"
                  ? styles.activeSummary
                  : ""
              }
              onClick={() => setView("completed")}
            >
              <CheckCircle2 size={21} />
              <div>
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>
            </button>
          </section>

          <section className={styles.taskPanel}>
            <header>
              <div>
                <span>
                  {view === "active"
                    ? "Current work"
                    : "Finished work"}
                </span>
                <h2>
                  {view === "active"
                    ? "Assigned to me"
                    : "Completed tasks"}
                </h2>
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
            </header>

            {isLoading ? (
              <div className={styles.loading}>
                <LoaderCircle
                  className={styles.spinning}
                  size={30}
                />
                Loading your tasks
              </div>
            ) : visibleTasks.length ? (
              <div className={styles.taskList}>
                {visibleTasks.map((task) => (
                  <article key={task.id}>
                    <div className={styles.taskMain}>
                      <div className={styles.taskBadges}>
                        <span>{task.category}</span>
                        <small>
                          {formatPriority(task.priority)}
                        </small>
                      </div>

                      <h3>{task.title}</h3>

                      {task.description && (
                        <p>{task.description}</p>
                      )}

                      <div className={styles.dueLine}>
                        <Clock3 size={14} />
                        {formatDue(task.due_at)}
                      </div>
                    </div>

                    <div className={styles.taskActions}>
                      {task.status === "open" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            updateStatus(
                              task.id,
                              "in_progress",
                            )
                          }
                        >
                          <Play size={16} />
                          Start
                        </button>
                      )}

                      {task.status === "in_progress" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            updateStatus(
                              task.id,
                              "completed",
                            )
                          }
                        >
                          <CheckCircle2 size={16} />
                          Complete
                        </button>
                      )}

                      {task.status === "completed" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            updateStatus(task.id, "open")
                          }
                        >
                          <RotateCcw size={16} />
                          Reopen
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <CheckCircle2 size={34} />
                <strong>
                  {view === "active"
                    ? "No assigned work right now"
                    : "No completed tasks yet"}
                </strong>
                <p>
                  {view === "active"
                    ? "A campaign manager will assign new responsibilities here."
                    : "Completed assignments will appear here."}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
