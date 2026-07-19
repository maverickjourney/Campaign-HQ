import {
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  ContactRound,
  FileCheck2,
  FileUp,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Settings,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import {
  useActivityCenter,
} from "../../hooks/useActivityCenter";

import styles from "./ActivityCenter.module.css";

const ROUTES_BY_ENTITY = {
  approval: "/approvals",
  communication:
    "/communications",
  contact: "/contacts",
  event: "/calendar",
  file: "/files",
  invitation:
    "/team/invitations",
  member: "/team/access",
  task: "/tasks",
  volunteer: "/team",
  workspace:
    "/workspace/settings",
};

function formatRelativeTime(
  value,
  referenceTime,
) {
  if (
    !value ||
    !referenceTime
  ) {
    return "Recently";
  }

  const occurredAt =
    new Date(
      value,
    ).getTime();

  const difference =
    Math.max(
      0,
      referenceTime -
        occurredAt,
    );

  const minutes =
    Math.floor(
      difference / 60000,
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  ).format(
    new Date(value),
  );
}

function getActivityIcon(
  activity,
) {
  const type =
    activity.activity_type ||
    "";

  const entity =
    activity.entity_type ||
    "";

  if (
    type.includes("file") ||
    entity === "file"
  ) {
    return FileUp;
  }

  if (
    type.includes("task") ||
    entity === "task"
  ) {
    return ClipboardCheck;
  }

  if (
    type.includes("contact") ||
    entity === "contact"
  ) {
    return ContactRound;
  }

  if (
    type.includes("event") ||
    entity === "event"
  ) {
    return CalendarDays;
  }

  if (
    type.includes(
      "communication",
    ) ||
    entity === "communication"
  ) {
    return MessageSquareText;
  }

  if (
    type.includes(
      "approval",
    ) ||
    entity === "approval"
  ) {
    return FileCheck2;
  }

  if (
    type.includes(
      "invitation",
    )
  ) {
    return UserPlus;
  }

  if (
    type.includes("member") ||
    entity === "member"
  ) {
    return UsersRound;
  }

  if (
    type.includes(
      "workspace",
    ) ||
    entity === "workspace"
  ) {
    return Settings;
  }

  return Activity;
}

function getActivityRoute(
  activity,
) {
  return (
    activity.route ||
    ROUTES_BY_ENTITY[
      activity.entity_type
    ] ||
    ""
  );
}

export function ActivityCenter() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const [isOpen, setIsOpen] =
    useState(false);

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("all");

  const {
    activities,
    profiles,
    readIdSet,
    unreadCount,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    markActivityRead,
    markAllRead,
  } =
    useActivityCenter({
      workspaceId:
        workspace.id,
      userId:
        user.id,
    });

  const visibleActivities =
    useMemo(
      () =>
        activeFilter ===
        "unread"
          ? activities.filter(
              (activity) =>
                !readIdSet.has(
                  activity.id,
                ),
            )
          : activities,
      [
        activeFilter,
        activities,
        readIdSet,
      ],
    );

  const referenceTime =
    lastUpdated
      ?.getTime() ||
    0;

  const openActivity =
    async (activity) => {
      try {
        await markActivityRead(
          activity.id,
        );
      } catch {
        return;
      }

      const route =
        getActivityRoute(
          activity,
        );

      if (route) {
        setIsOpen(false);
        navigate(route);
      }
    };

  return (
    <div
      className={
        styles.activityRoot
      }
    >
      <button
        className={
          styles.bellButton
        }
        type="button"
        onClick={() =>
          setIsOpen(true)
        }
        aria-label={
          unreadCount
            ? `Activity Center, ${unreadCount} unread`
            : "Activity Center"
        }
        title="Activity Center"
      >
        <Bell
          size={19}
          strokeWidth={1.9}
        />

        {unreadCount > 0 && (
          <span
            className={
              styles.unreadBadge
            }
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            className={
              styles.overlay
            }
            type="button"
            onClick={() =>
              setIsOpen(false)
            }
            aria-label="Close Activity Center"
          />

          <aside
            className={
              styles.drawer
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-center-title"
          >
            <header
              className={
                styles.drawerHeader
              }
            >
              <div>
                <span>
                  Campaign updates
                </span>

                <h2
                  id="activity-center-title"
                >
                  Activity Center
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsOpen(false)
                }
                aria-label="Close Activity Center"
              >
                <X
                  size={20}
                />
              </button>
            </header>

            <div
              className={
                styles.drawerControls
              }
            >
              <div
                className={
                  styles.filters
                }
              >
                <button
                  className={
                    activeFilter ===
                    "all"
                      ? styles.activeFilter
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setActiveFilter(
                      "all",
                    )
                  }
                >
                  All
                </button>

                <button
                  className={
                    activeFilter ===
                    "unread"
                      ? styles.activeFilter
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setActiveFilter(
                      "unread",
                    )
                  }
                >
                  Unread
                  {unreadCount >
                    0 && (
                    <span>
                      {
                        unreadCount
                      }
                    </span>
                  )}
                </button>
              </div>

              <div
                className={
                  styles.controlActions
                }
              >
                <button
                  type="button"
                  onClick={
                    refresh
                  }
                  disabled={
                    isLoading
                  }
                  title="Refresh activity"
                >
                  <RefreshCw
                    className={
                      isLoading
                        ? styles.spinning
                        : ""
                    }
                    size={17}
                  />
                </button>

                <button
                  type="button"
                  onClick={
                    markAllRead
                  }
                  disabled={
                    unreadCount ===
                      0 ||
                    isSaving
                  }
                  title="Mark all as read"
                >
                  <CheckCheck
                    size={18}
                  />
                  Mark all read
                </button>
              </div>
            </div>

            {error && (
              <div
                className={
                  styles.errorBanner
                }
                role="alert"
              >
                <AlertCircle
                  size={19}
                />

                <div>
                  <strong>
                    Activity Center needs setup
                  </strong>

                  <p>
                    {error}
                  </p>
                </div>
              </div>
            )}

            <div
              className={
                styles.activityList
              }
            >
              {isLoading && (
                <div
                  className={
                    styles.loadingState
                  }
                >
                  <LoaderCircle
                    className={
                      styles.spinning
                    }
                    size={27}
                  />

                  <strong>
                    Loading campaign activity…
                  </strong>
                </div>
              )}

              {!isLoading &&
                visibleActivities.map(
                  (activity) => {
                    const Icon =
                      getActivityIcon(
                        activity,
                      );

                    const isUnread =
                      !readIdSet.has(
                        activity.id,
                      );

                    const actor =
                      profiles[
                        activity
                          .actor_user_id
                      ];

                    return (
                      <button
                        className={`${styles.activityItem} ${
                          isUnread
                            ? styles.unreadItem
                            : ""
                        }`}
                        type="button"
                        key={
                          activity.id
                        }
                        onClick={() =>
                          openActivity(
                            activity,
                          )
                        }
                      >
                        <div
                          className={
                            styles.activityIcon
                          }
                        >
                          <Icon
                            size={
                              18
                            }
                          />
                        </div>

                        <div
                          className={
                            styles.activityCopy
                          }
                        >
                          <div>
                            <strong>
                              {
                                activity.title
                              }
                            </strong>

                            {isUnread && (
                              <span
                                className={
                                  styles.unreadDot
                                }
                              />
                            )}
                          </div>

                          <p>
                            {activity.detail ||
                              "Campaign information was updated."}
                          </p>

                          <small>
                            {actor?.full_name ||
                              "Campaign HQ"}
                            {" · "}
                            {formatRelativeTime(
                              activity.occurred_at,
                              referenceTime,
                            )}
                          </small>
                        </div>
                      </button>
                    );
                  },
                )}

              {!isLoading &&
                visibleActivities.length ===
                  0 && (
                  <div
                    className={
                      styles.emptyState
                    }
                  >
                    <CheckCheck
                      size={31}
                    />

                    <h3>
                      {activeFilter ===
                      "unread"
                        ? "You’re all caught up"
                        : "No campaign activity yet"}
                    </h3>

                    <p>
                      {activeFilter ===
                      "unread"
                        ? "There are no unread updates."
                        : "New uploads, tasks, events, approvals and team changes will appear here."}
                    </p>
                  </div>
                )}
            </div>

            <footer
              className={
                styles.drawerFooter
              }
            >
              <span>
                {activities.length}
                {" recent "}
                {activities.length ===
                1
                  ? "update"
                  : "updates"}
              </span>

              <span>
                {unreadCount}
                {" unread"}
              </span>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
