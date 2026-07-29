import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  Filter,
  Hourglass,
  MailQuestion,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useApprovalsCommandCenter,
} from "../../hooks/useApprovalsCommandCenter";

import {
  useTasksCommandCenter,
} from "../../hooks/useTasksCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./WaitingOnReferencePreview.module.css";

const WAITING_REFERENCE_TIME = Date.now();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const OPEN_APPROVAL_STATUSES = [
  "draft",
  "pending",
  "changes_requested",
];

const PRIORITIES = {
  urgent: {
    label: "Critical",
    rank: 0,
  },
  high: {
    label: "High",
    rank: 1,
  },
  normal: {
    label: "Normal",
    rank: 2,
  },
  low: {
    label: "Low",
    rank: 3,
  },
};

const SOURCES = [
  "Candidate request",
  "Team response",
  "Vendor response",
  "Community partner",
  "Donor response",
  "Government office",
  "Approval decision",
  "Other",
];

const SCOPES = [
  {
    value: "external",
    label: "Outside the campaign",
  },
  {
    value: "internal",
    label: "Inside the campaign",
  },
];

const PROJECTS = [
  "Candidate",
  "Communications",
  "Events",
  "Field",
  "Fundraising",
  "Operations",
  "Research",
  "Volunteer",
  "General",
];

const EMPTY_FORM = {
  title: "",
  description: "",
  waitingFor: "",
  source: "Team response",
  scope: "internal",
  category: "General",
  priority: "normal",
  status: "open",
  assignedTo: "",
  dueDate: "",
  dueTime: "17:00",
};

const DEMO_TASK_BLUEPRINTS = [
  {
    title: "Receive corrected precinct map from elections office",
    description:
      "The field plan cannot be finalized until the corrected precinct boundaries are delivered.",
    waitingFor: "Palm Beach County Elections Office",
    source: "Government office",
    scope: "external",
    category: "Field",
    priority: "urgent",
    status: "open",
    dueOffsetHours: -22,
    lastFollowUpOffsetHours: -51,
  },
  {
    title: "Get final quote for event security",
    description:
      "The venue contract is ready, but the campaign still needs the final security staffing quote.",
    waitingFor: "Event security vendor",
    source: "Vendor response",
    scope: "external",
    category: "Events",
    priority: "high",
    status: "in_progress",
    dueOffsetHours: 13,
    lastFollowUpOffsetHours: -27,
  },
  {
    title: "Receive revised volunteer training outline",
    description:
      "Volunteer leadership is revising the training outline after the campaign manager’s notes.",
    waitingFor: "Volunteer leadership team",
    source: "Team response",
    scope: "internal",
    category: "Volunteer",
    priority: "high",
    status: "open",
    dueOffsetHours: 31,
    lastFollowUpOffsetHours: -17,
  },
  {
    title: "Confirm community forum participant list",
    description:
      "The communications plan depends on receiving the final participant and moderator list.",
    waitingFor: "District 6 civic association",
    source: "Community partner",
    scope: "external",
    category: "Communications",
    priority: "normal",
    status: "open",
    dueOffsetHours: 58,
    lastFollowUpOffsetHours: -12,
  },
  {
    title: "Receive research memo on county budget amendment",
    description:
      "The candidate briefing is paused until the research memo and source links are complete.",
    waitingFor: "Campaign research team",
    source: "Team response",
    scope: "internal",
    category: "Research",
    priority: "normal",
    status: "in_progress",
    dueOffsetHours: 79,
    lastFollowUpOffsetHours: -8,
  },
  {
    title: "Get sponsorship logo approval",
    description:
      "The print file is ready but cannot be released until the sponsor confirms the final logo treatment.",
    waitingFor: "Local business sponsor",
    source: "Donor response",
    scope: "external",
    category: "Fundraising",
    priority: "normal",
    status: "completed",
    dueOffsetHours: -40,
    lastFollowUpOffsetHours: -54,
  },
];

const DEMO_APPROVAL_BLUEPRINTS = [
  {
    title: "Approve July mail-piece proof",
    description:
      "Final sign-off is required before the printer’s production deadline.",
    approvalType: "communications",
    status: "pending",
    dueOffsetHours: 7,
  },
  {
    title: "Review community event expense request",
    description:
      "The event team is awaiting a decision on the revised expense request.",
    approvalType: "event",
    status: "changes_requested",
    dueOffsetHours: 45,
  },
  {
    title: "Approve weekly compliance filing",
    description:
      "The filing package is prepared and waiting for leadership review.",
    approvalType: "compliance",
    status: "approved",
    dueOffsetHours: -18,
  },
];

function displayName(user) {
  return (
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.email ||
    "Campaign member"
  );
}

function initials(value) {
  return String(value || "Campaign member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function tagValue(tags, prefix) {
  const normalizedPrefix =
    prefix.toLowerCase();

  const match = (tags || []).find(
    (tag) =>
      String(tag)
        .toLowerCase()
        .startsWith(normalizedPrefix),
  );

  if (!match) {
    return "";
  }

  return String(match)
    .slice(prefix.length)
    .trim();
}

function hasWaitingTag(task) {
  return (task.tags || []).some(
    (tag) =>
      String(tag).toLowerCase() ===
      "waiting-on",
  );
}

function taskIsResolved(task) {
  return [
    "completed",
    "archived",
  ].includes(task.status);
}

function recordIsResolved(record) {
  return record.resolved;
}

function dueTimestamp(record) {
  if (!record.dueAt) {
    return Number.POSITIVE_INFINITY;
  }

  return new Date(
    record.dueAt,
  ).getTime();
}

function isOverdue(
  record,
  referenceTime,
) {
  return (
    !recordIsResolved(record) &&
    Boolean(record.dueAt) &&
    dueTimestamp(record) <
      referenceTime
  );
}

function isDueSoon(
  record,
  referenceTime,
) {
  const due = dueTimestamp(record);

  return (
    !recordIsResolved(record) &&
    Number.isFinite(due) &&
    due >= referenceTime &&
    due <=
      referenceTime +
        7 *
          DAY
  );
}

function needsFollowUp(
  record,
  referenceTime,
) {
  if (recordIsResolved(record)) {
    return false;
  }

  if (
    isOverdue(
      record,
      referenceTime,
    )
  ) {
    return true;
  }

  const lastFollowUp =
    record.lastFollowUpAt
      ? new Date(
          record.lastFollowUpAt,
        ).getTime()
      : new Date(
          record.createdAt ||
            record.updatedAt ||
            0,
        ).getTime();

  return (
    referenceTime -
      lastFollowUp >=
    48 *
      HOUR
  );
}

function recordHealth(
  record,
  referenceTime,
) {
  if (recordIsResolved(record)) {
    return {
      label: "Resolved",
      tone: "resolved",
    };
  }

  if (
    isOverdue(
      record,
      referenceTime,
    )
  ) {
    return {
      label: "Overdue",
      tone: "overdue",
    };
  }

  if (
    needsFollowUp(
      record,
      referenceTime,
    )
  ) {
    return {
      label: "Follow up",
      tone: "followup",
    };
  }

  if (record.status === "in_progress") {
    return {
      label: "Following up",
      tone: "moving",
    };
  }

  return {
    label: "Waiting",
    tone: "waiting",
  };
}

function formatDateTime(value) {
  if (!value) {
    return {
      date: "No follow-up date",
      time: "Not scheduled",
    };
  }

  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    ).format(date),

    time: new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(date),
  };
}

function formDateParts(value) {
  if (!value) {
    return {
      date: "",
      time: "17:00",
    };
  }

  const date = new Date(value);

  const year = String(
    date.getFullYear(),
  );

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  const hours = String(
    date.getHours(),
  ).padStart(2, "0");

  const minutes = String(
    date.getMinutes(),
  ).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

function buildWaitingTags({
  existingTags,
  waitingFor,
  source,
  scope,
  lastFollowUpAt,
}) {
  const preserved = (
    existingTags || []
  ).filter((tag) => {
    const normalized =
      String(tag).toLowerCase();

    return (
      normalized !== "waiting-on" &&
      !normalized.startsWith(
        "waiting-for:",
      ) &&
      !normalized.startsWith(
        "waiting-source:",
      ) &&
      !normalized.startsWith(
        "waiting-scope:",
      ) &&
      !normalized.startsWith(
        "waiting-last-follow-up:",
      )
    );
  });

  const tags = [
    ...preserved,
    "waiting-on",
    `waiting-for:${waitingFor.trim()}`,
    `waiting-source:${source}`,
    `waiting-scope:${scope}`,
  ];

  if (lastFollowUpAt) {
    tags.push(
      `waiting-last-follow-up:${lastFollowUpAt}`,
    );
  }

  return tags;
}

function buildDemoTasks(
  user,
  workspace,
) {
  return DEMO_TASK_BLUEPRINTS.map(
    (item, index) => {
      const dueAt =
        new Date(
          WAITING_REFERENCE_TIME +
            item.dueOffsetHours *
              HOUR,
        ).toISOString();

      const lastFollowUpAt =
        new Date(
          WAITING_REFERENCE_TIME +
            item.lastFollowUpOffsetHours *
              HOUR,
        ).toISOString();

      return {
        id: `demo-waiting-task-${index + 1}`,
        workspace_id: workspace?.id || "",
        title: item.title,
        description: item.description,
        category: item.category,
        priority: item.priority,
        status: item.status,
        assigned_to: user?.id || "",
        created_by: user?.id || "",
        due_at: dueAt,
        visibility: "workspace",
        tags: buildWaitingTags({
          existingTags: [],
          waitingFor:
            item.waitingFor,
          source: item.source,
          scope: item.scope,
          lastFollowUpAt,
        }),
        created_at:
          new Date(
            WAITING_REFERENCE_TIME -
              (index + 3) *
                DAY,
          ).toISOString(),
        updated_at:
          new Date(
            WAITING_REFERENCE_TIME -
              (index + 1) *
                4 *
                HOUR,
          ).toISOString(),
        completed_at:
          item.status === "completed"
            ? new Date(
                WAITING_REFERENCE_TIME -
                  10 *
                    HOUR,
              ).toISOString()
            : null,
        is_demo: true,
      };
    },
  );
}

function buildDemoApprovals(
  user,
  workspace,
) {
  return DEMO_APPROVAL_BLUEPRINTS.map(
    (item, index) => ({
      id:
        `demo-waiting-approval-${index + 1}`,
      workspace_id:
        workspace?.id || "",
      title: item.title,
      description:
        item.description,
      approval_type:
        item.approvalType,
      status: item.status,
      due_at:
        new Date(
          WAITING_REFERENCE_TIME +
            item.dueOffsetHours *
              HOUR,
        ).toISOString(),
      submitted_by:
        user?.id || "",
      assigned_to:
        `demo-reviewer-${index + 1}`,
      reviewed_by:
        item.status === "approved"
          ? `demo-reviewer-${index + 1}`
          : null,
      reviewed_at:
        item.status === "approved"
          ? new Date(
              WAITING_REFERENCE_TIME -
                8 *
                  HOUR,
            ).toISOString()
          : null,
      review_notes:
        item.status ===
        "changes_requested"
          ? "Update the supporting expense notes before final approval."
          : null,
      created_at:
        new Date(
          WAITING_REFERENCE_TIME -
            (index + 2) *
              DAY,
        ).toISOString(),
      updated_at:
        new Date(
          WAITING_REFERENCE_TIME -
            (index + 1) *
              5 *
              HOUR,
        ).toISOString(),
      is_demo: true,
    }),
  );
}

function normalizeTaskRecord(
  task,
) {
  const lastFollowUpAt =
    tagValue(
      task.tags,
      "waiting-last-follow-up:",
    );

  return {
    key: `task:${task.id}`,
    id: task.id,
    kind: "task",
    title: task.title,
    description:
      task.description || "",
    waitingFor:
      tagValue(
        task.tags,
        "waiting-for:",
      ) ||
      "Campaign contact",
    source:
      tagValue(
        task.tags,
        "waiting-source:",
      ) ||
      task.category ||
      "Campaign request",
    scope:
      tagValue(
        task.tags,
        "waiting-scope:",
      ) ||
      "external",
    category:
      task.category ||
      "General",
    priority:
      task.priority ||
      "normal",
    status:
      task.status ||
      "open",
    ownerId:
      task.assigned_to || "",
    requesterId:
      task.created_by || "",
    dueAt:
      task.due_at || null,
    createdAt:
      task.created_at,
    updatedAt:
      task.updated_at,
    lastFollowUpAt:
      lastFollowUpAt || null,
    tags:
      task.tags || [],
    resolved:
      taskIsResolved(task),
    raw: task,
  };
}

function normalizeApprovalRecord(
  approval,
) {
  const resolved =
    !OPEN_APPROVAL_STATUSES.includes(
      approval.status,
    );

  return {
    key:
      `approval:${approval.id}`,
    id: approval.id,
    kind: "approval",
    title: approval.title,
    description:
      approval.description || "",
    waitingFor:
      approval.assigned_to
        ? "Assigned campaign reviewer"
        : "Campaign leadership",
    source: "Approval decision",
    scope: "internal",
    category:
      approval.approval_type ||
      "general",
    priority:
      approval.status ===
        "changes_requested"
        ? "high"
        : "normal",
    status:
      approval.status,
    ownerId:
      approval.submitted_by || "",
    requesterId:
      approval.submitted_by || "",
    reviewerId:
      approval.assigned_to || "",
    dueAt:
      approval.due_at || null,
    createdAt:
      approval.created_at,
    updatedAt:
      approval.updated_at,
    lastFollowUpAt:
      approval.updated_at,
    tags: [],
    resolved,
    reviewNotes:
      approval.review_notes || "",
    raw: approval,
  };
}

export default function WaitingOnReferencePreview() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = getCurrentUser();
  const workspace =
    getCurrentWorkspace();

  const demoMode =
    new URLSearchParams(
      location.search,
    ).get("waiting-demo") ===
    "1";

  const [
    demoTasks,
    setDemoTasks,
  ] = useState(
    () =>
      buildDemoTasks(
        user,
        workspace,
      ),
  );

  const [
    demoApprovals,
  ] = useState(
    () =>
      buildDemoApprovals(
        user,
        workspace,
      ),
  );

  const [activeTab, setActiveTab] =
    useState("all");

  const [summaryFilter, setSummaryFilter] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [ownerFilter, setOwnerFilter] =
    useState("all");

  const [sortMode, setSortMode] =
    useState("due");

  const [
    selectedRecordKey,
    setSelectedRecordKey,
  ] = useState("");

  const [modalMode, setModalMode] =
    useState("");

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [formError, setFormError] =
    useState("");

  const {
    tasks: liveTasks,
    team: taskTeam,
    isLoading: tasksLoading,
    isSaving: taskSaving,
    error: tasksError,
    lastUpdated:
      tasksUpdated,
    refresh: refreshTasks,
    createTask,
    updateTask,
    changeTaskStatus,
  } = useTasksCommandCenter({
    workspaceId:
      demoMode
        ? ""
        : workspace.id,

    userId: user.id,

    selectedTaskId: "",
  });

  const {
    approvals: liveApprovals,
    team: approvalTeam,
    isLoading:
      approvalsLoading,
    error: approvalsError,
    lastUpdated:
      approvalsUpdated,
    refresh:
      refreshApprovals,
  } = useApprovalsCommandCenter({
    workspaceId:
      demoMode
        ? ""
        : workspace.id,

    userId: user.id,
  });

  const team = useMemo(
    () => {
      const members = new Map();

      [
        ...(taskTeam || []),
        ...(approvalTeam || []),
      ].forEach((member) => {
        members.set(
          member.id,
          member,
        );
      });

      if (user?.id) {
        members.set(
          user.id,
          {
            id: user.id,
            fullName:
              displayName(user),
          },
        );
      }

      return Array.from(
        members.values(),
      ).sort((left, right) =>
        String(
          left.fullName || "",
        ).localeCompare(
          String(
            right.fullName || "",
          ),
        ),
      );
    },
    [
      approvalTeam,
      taskTeam,
      user,
    ],
  );

  const personName = useCallback(
    (personId) => {
      if (!personId) {
        return "Unassigned";
      }

      if (personId === user.id) {
        return displayName(user);
      }

      return (
        team.find(
          (member) =>
            member.id === personId,
        )?.fullName ||
        "Campaign member"
      );
    },
    [
      team,
      user,
    ],
  );

  const taskRecords = useMemo(
    () =>
      (
        demoMode
          ? demoTasks
          : Array.isArray(liveTasks)
            ? liveTasks
            : []
      )
        .filter(hasWaitingTag)
        .map(normalizeTaskRecord),
    [
      demoMode,
      demoTasks,
      liveTasks,
    ],
  );

  const approvalRecords = useMemo(
    () =>
      (
        demoMode
          ? demoApprovals
          : Array.isArray(
                liveApprovals,
              )
            ? liveApprovals
            : []
      ).map(
        normalizeApprovalRecord,
      ),
    [
      demoApprovals,
      demoMode,
      liveApprovals,
    ],
  );

  const records = useMemo(
    () => [
      ...taskRecords,
      ...approvalRecords,
    ],
    [
      approvalRecords,
      taskRecords,
    ],
  );

  const referenceTime =
    Math.max(
      tasksUpdated?.getTime() ||
        0,
      approvalsUpdated?.getTime() ||
        0,
      WAITING_REFERENCE_TIME,
    );

  const openRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          !recordIsResolved(record),
      ),
    [records],
  );

  const dueSoonRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          isDueSoon(
            record,
            referenceTime,
          ),
      ),
    [
      records,
      referenceTime,
    ],
  );

  const overdueRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          isOverdue(
            record,
            referenceTime,
          ),
      ),
    [
      records,
      referenceTime,
    ],
  );

  const followUpRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          needsFollowUp(
            record,
            referenceTime,
          ),
      ),
    [
      records,
      referenceTime,
    ],
  );

  const resolvedRecords = useMemo(
    () =>
      records.filter(
        recordIsResolved,
      ),
    [records],
  );

  const ownerOptions = useMemo(
    () => {
      const owners = new Map();

      records.forEach(
        (record) => {
          if (!record.ownerId) {
            return;
          }

          owners.set(
            record.ownerId,
            personName(
              record.ownerId,
            ),
          );
        },
      );

      return Array.from(
        owners.entries(),
      ).sort((left, right) =>
        left[1].localeCompare(
          right[1],
        ),
      );
    },
    [
      personName,
      records,
    ],
  );

  const visibleRecords = useMemo(
    () => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return records
        .filter((record) => {
          if (
            activeTab === "all" &&
            recordIsResolved(record)
          ) {
            return false;
          }

          if (
            activeTab === "mine" &&
            (
              record.requesterId !==
                user.id ||
              recordIsResolved(record)
            )
          ) {
            return false;
          }

          if (
            activeTab === "external" &&
            (
              record.scope !==
                "external" ||
              recordIsResolved(record)
            )
          ) {
            return false;
          }

          if (
            activeTab === "internal" &&
            (
              record.scope !==
                "internal" ||
              recordIsResolved(record)
            )
          ) {
            return false;
          }

          if (
            activeTab === "resolved" &&
            !recordIsResolved(record)
          ) {
            return false;
          }

          if (
            typeFilter !== "all" &&
            record.kind !==
              typeFilter
          ) {
            return false;
          }

          if (
            ownerFilter !== "all" &&
            record.ownerId !==
              ownerFilter
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "due-soon" &&
            !isDueSoon(
              record,
              referenceTime,
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "follow-up" &&
            !needsFollowUp(
              record,
              referenceTime,
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "overdue" &&
            !isOverdue(
              record,
              referenceTime,
            )
          ) {
            return false;
          }

          if (
            summaryFilter ===
              "resolved" &&
            !recordIsResolved(record)
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            record.title,
            record.description,
            record.waitingFor,
            record.source,
            record.category,
            personName(
              record.ownerId,
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        })
        .sort((left, right) => {
          if (sortMode === "risk") {
            const overdueDifference =
              Number(
                isOverdue(
                  right,
                  referenceTime,
                ),
              ) -
              Number(
                isOverdue(
                  left,
                  referenceTime,
                ),
              );

            if (overdueDifference) {
              return overdueDifference;
            }

            return (
              (
                PRIORITIES[
                  left.priority
                ]?.rank ?? 99
              ) -
              (
                PRIORITIES[
                  right.priority
                ]?.rank ?? 99
              )
            );
          }

          if (
            sortMode === "updated"
          ) {
            return (
              new Date(
                right.updatedAt ||
                  right.createdAt ||
                  0,
              ).getTime() -
              new Date(
                left.updatedAt ||
                  left.createdAt ||
                  0,
              ).getTime()
            );
          }

          return (
            dueTimestamp(left) -
            dueTimestamp(right)
          );
        });
    },
    [
      activeTab,
      ownerFilter,
      personName,
      records,
      referenceTime,
      search,
      sortMode,
      summaryFilter,
      typeFilter,
      user.id,
    ],
  );

  const selectedRecord =
    records.find(
      (record) =>
        record.key ===
        selectedRecordKey,
    ) || null;

  const loading =
    !demoMode &&
    (
      tasksLoading ||
      approvalsLoading
    );

  const pageError =
    demoMode
      ? ""
      : tasksError ||
        approvalsError;

  const saving =
    taskSaving;

  useEffect(() => {
    if (
      typeof document ===
      "undefined"
    ) {
      return undefined;
    }

    const body = document.body;

    if (
      selectedRecordKey ||
      modalMode
    ) {
      body.dataset.waitingOnFocusMode =
        "true";
    } else {
      delete body.dataset
        .waitingOnFocusMode;
    }

    return () => {
      delete body.dataset
        .waitingOnFocusMode;
    };
  }, [
    modalMode,
    selectedRecordKey,
  ]);

  const chooseTab = (tab) => {
    setActiveTab(tab);
    setSummaryFilter(
      tab === "resolved"
        ? "resolved"
        : "all",
    );
    setSearch("");
    setTypeFilter("all");
    setOwnerFilter("all");
    setSortMode("due");
    setSelectedRecordKey("");
  };

  const chooseSummary = (key) => {
    setActiveTab(
      key === "resolved"
        ? "resolved"
        : "all",
    );
    setSummaryFilter(key);
    setSearch("");
    setTypeFilter("all");
    setOwnerFilter("all");
    setSortMode("due");
    setSelectedRecordKey("");
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setOwnerFilter("all");
    setSortMode("due");

    setSummaryFilter(
      activeTab === "resolved"
        ? "resolved"
        : "all",
    );
  };

  const openCreateModal = () => {
    setFormData({
      ...EMPTY_FORM,
      assignedTo:
        user.id || "",
    });

    setFormError("");
    setModalMode("create");
  };

  const openEditModal = (record) => {
    if (
      record.kind !== "task"
    ) {
      navigate("/approvals");
      return;
    }

    const due =
      formDateParts(
        record.dueAt,
      );

    setFormData({
      title:
        record.title || "",
      description:
        record.description || "",
      waitingFor:
        record.waitingFor || "",
      source:
        record.source ||
        "Team response",
      scope:
        record.scope ||
        "internal",
      category:
        record.category ||
        "General",
      priority:
        record.priority ||
        "normal",
      status:
        record.status ||
        "open",
      assignedTo:
        record.ownerId || "",
      dueDate: due.date,
      dueTime: due.time,
    });

    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalMode("");
    setFormError("");
  };

  const handleFormChange = (
    event,
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );
  };

  const buildDueAt = () => {
    if (!formData.dueDate) {
      return null;
    }

    return new Date(
      `${formData.dueDate}T${
        formData.dueTime ||
        "17:00"
      }:00`,
    ).toISOString();
  };

  const saveWaitingItem = async (
    event,
  ) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setFormError(
        "Enter what the campaign is waiting on.",
      );
      return;
    }

    if (
      !formData.waitingFor.trim()
    ) {
      setFormError(
        "Enter the person, organization, or team the campaign is waiting on.",
      );
      return;
    }

    const dueAt = buildDueAt();

    const existingTags =
      selectedRecord?.kind ===
      "task"
        ? selectedRecord.tags
        : [];

    const tags =
      buildWaitingTags({
        existingTags,
        waitingFor:
          formData.waitingFor,
        source:
          formData.source,
        scope:
          formData.scope,
        lastFollowUpAt:
          selectedRecord
            ?.lastFollowUpAt ||
          null,
      });

    const payload = {
      title:
        formData.title.trim(),
      description:
        formData.description
          .trim() || null,
      category:
        formData.category,
      priority:
        formData.priority,
      status:
        formData.status,
      assigned_to:
        formData.assignedTo ||
        null,
      due_at: dueAt,
      visibility: "workspace",
      tags,
    };

    try {
      if (demoMode) {
        const timestamp =
          new Date().toISOString();

        if (
          modalMode === "edit" &&
          selectedRecord?.kind ===
            "task"
        ) {
          setDemoTasks(
            (current) =>
              current.map(
                (task) =>
                  task.id ===
                  selectedRecord.id
                    ? {
                        ...task,
                        ...payload,
                        updated_at:
                          timestamp,
                        completed_at:
                          formData.status ===
                          "completed"
                            ? (
                                task.completed_at ||
                                timestamp
                              )
                            : null,
                      }
                    : task,
              ),
          );
        } else {
          const id =
            typeof crypto !==
              "undefined" &&
            crypto.randomUUID
              ? `demo-waiting-task-${crypto.randomUUID()}`
              : `demo-waiting-created-${new Date().getTime()}`;

          setDemoTasks(
            (current) => [
              {
                id,
                workspace_id:
                  workspace.id,
                created_by:
                  user.id,
                created_at:
                  timestamp,
                updated_at:
                  timestamp,
                completed_at:
                  formData.status ===
                  "completed"
                    ? timestamp
                    : null,
                is_demo: true,
                ...payload,
              },
              ...current,
            ],
          );

          setSelectedRecordKey(
            `task:${id}`,
          );
        }
      } else if (
        modalMode === "edit" &&
        selectedRecord?.kind ===
          "task"
      ) {
        await updateTask(
          selectedRecord.id,
          payload,
        );
      } else {
        const created =
          await createTask(
            payload,
          );

        if (created?.id) {
          setSelectedRecordKey(
            `task:${created.id}`,
          );
        }
      }

      const showResolved =
        formData.status ===
        "completed";

      setActiveTab(
        showResolved
          ? "resolved"
          : "all",
      );

      setSummaryFilter(
        showResolved
          ? "resolved"
          : "all",
      );

      setSearch("");
      setTypeFilter("all");
      setOwnerFilter("all");
      setSortMode("due");

      setModalMode("");
      setFormError("");
    } catch (saveError) {
      console.error(
        "Waiting item could not be saved:",
        saveError,
      );

      setFormError(
        saveError?.message ||
        "The waiting item could not be saved.",
      );
    }
  };

  const updateWaitingStatus =
    async (
      record,
      nextStatus,
    ) => {
      if (
        record.kind !== "task"
      ) {
        navigate("/approvals");
        return;
      }

      try {
        if (demoMode) {
          const timestamp =
            new Date().toISOString();

          setDemoTasks(
            (current) =>
              current.map(
                (task) =>
                  task.id ===
                  record.id
                    ? {
                        ...task,
                        status:
                          nextStatus,
                        updated_at:
                          timestamp,
                        completed_at:
                          nextStatus ===
                          "completed"
                            ? timestamp
                            : null,
                      }
                    : task,
              ),
          );
        } else {
          await changeTaskStatus(
            record.raw,
            nextStatus,
          );
        }

        const showResolved =
          nextStatus ===
          "completed";

        setActiveTab(
          showResolved
            ? "resolved"
            : "all",
        );

        setSummaryFilter(
          showResolved
            ? "resolved"
            : "all",
        );

        setSearch("");
        setTypeFilter("all");
        setOwnerFilter("all");
        setSortMode("due");
      } catch (statusError) {
        console.error(
          "Waiting status could not be changed:",
          statusError,
        );
      }
    };

  const logFollowUp =
    async (record) => {
      if (
        record.kind !== "task"
      ) {
        navigate("/approvals");
        return;
      }

      const timestamp =
        new Date().toISOString();

      const nextTags =
        buildWaitingTags({
          existingTags:
            record.tags,
          waitingFor:
            record.waitingFor,
          source:
            record.source,
          scope:
            record.scope,
          lastFollowUpAt:
            timestamp,
        });

      try {
        if (demoMode) {
          setDemoTasks(
            (current) =>
              current.map(
                (task) =>
                  task.id ===
                  record.id
                    ? {
                        ...task,
                        tags:
                          nextTags,
                        status:
                          task.status ===
                          "open"
                            ? "in_progress"
                            : task.status,
                        updated_at:
                          timestamp,
                      }
                    : task,
              ),
          );

          return;
        }

        await updateTask(
          record.id,
          {
            tags: nextTags,
            status:
              record.status ===
              "open"
                ? "in_progress"
                : record.status,
          },
        );
      } catch (followUpError) {
        console.error(
          "Follow-up could not be recorded:",
          followUpError,
        );
      }
    };

  const handleRefresh = () => {
    setSelectedRecordKey("");

    if (demoMode) {
      setDemoTasks(
        buildDemoTasks(
          user,
          workspace,
        ),
      );
      return;
    }

    refreshTasks();
    refreshApprovals();
  };

  const summaryCards = [
    {
      key: "all",
      label: "Waiting now",
      value:
        openRecords.length,
      caption:
        "Open dependencies",
      icon: Hourglass,
    },
    {
      key: "due-soon",
      label: "Due soon",
      value:
        dueSoonRecords.length,
      caption:
        "Within seven days",
      icon: CalendarClock,
    },
    {
      key: "follow-up",
      label: "Needs follow-up",
      value:
        followUpRecords.length,
      caption:
        "No recent response",
      icon: MailQuestion,
      tone: "warning",
    },
    {
      key: "overdue",
      label: "Overdue",
      value:
        overdueRecords.length,
      caption:
        "Past expected response",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      key: "resolved",
      label: "Resolved",
      value:
        resolvedRecords.length,
      caption:
        "Responses received",
      icon: CheckCircle2,
      tone: "success",
    },
  ];

  const updatedTime =
    Math.max(
      tasksUpdated?.getTime() ||
        0,
      approvalsUpdated?.getTime() ||
        0,
    );

  const updatedLabel =
    demoMode
      ? "Local preview data"
      : updatedTime
        ? `Updated ${new Intl.DateTimeFormat(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
            },
          ).format(
            new Date(
              updatedTime,
            ),
          )}`
        : "Ready";

  const showClearFilters =
    Boolean(search) ||
    typeFilter !== "all" ||
    ownerFilter !== "all" ||
    sortMode !== "due" ||
    ![
      "all",
      "resolved",
    ].includes(summaryFilter);

  return (
    <CampaignWorkspaceShell activeItem="Waiting On">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>
              Campaign follow-through
            </span>

            <h1>Waiting On</h1>

            <p>
              See every response, decision, document, and outside dependency holding up campaign work.
            </p>

            <small className={styles.updated}>
              <span />
              {updatedLabel}
            </small>
          </div>

          <div className={styles.headerActions}>
            <label className={styles.searchBox}>
              <Search size={20} />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  );
                  setSummaryFilter("");
                }}
                placeholder="Search waiting items…"
              />
            </label>

            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleRefresh}
            >
              <RefreshCw size={18} />
              Refresh
            </button>

            <button
              className={styles.primaryButton}
              type="button"
              onClick={openCreateModal}
            >
              <Plus size={19} />
              Add waiting item
            </button>
          </div>
        </header>

        {pageError && (
          <div
            className={styles.errorBanner}
            role="alert"
          >
            <AlertTriangle size={18} />
            {pageError}
          </div>
        )}

        <section className={styles.summaryGrid}>
          {summaryCards.map(
            (card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.key}
                  className={`${styles.summaryCard} ${
                    card.tone
                      ? styles[card.tone]
                      : ""
                  } ${
                    summaryFilter ===
                    card.key
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  aria-pressed={
                    summaryFilter ===
                    card.key
                  }
                  onClick={() =>
                    chooseSummary(
                      card.key,
                    )
                  }
                >
                  <span className={styles.summaryIcon}>
                    <Icon size={23} />
                  </span>

                  <span className={styles.summaryCopy}>
                    <small>
                      {card.label}
                    </small>

                    <strong>
                      {card.value}
                    </strong>

                    <em>
                      {card.caption}
                    </em>
                  </span>
                </button>
              );
            },
          )}
        </section>

        <section
          className={`${styles.waitingWorkspace} ${
            selectedRecord
              ? styles.hasDetails
              : ""
          }`}
        >
          <div className={styles.waitingPanel}>
            <div className={styles.tabsBar}>
              <nav
                className={styles.tabs}
                aria-label="Waiting On views"
              >
                {[
                  [
                    "all",
                    "All waiting",
                  ],
                  [
                    "mine",
                    "My requests",
                  ],
                  [
                    "external",
                    "External",
                  ],
                  [
                    "internal",
                    "Internal",
                  ],
                  [
                    "resolved",
                    "Resolved",
                  ],
                ].map(
                  ([key, label]) => (
                    <button
                      key={key}
                      className={
                        activeTab === key
                          ? styles.activeTab
                          : ""
                      }
                      type="button"
                      onClick={() =>
                        chooseTab(key)
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
              </nav>

              <div className={styles.tableActions}>
                <label className={styles.selectControl}>
                  <Filter size={16} />

                  <select
                    value={typeFilter}
                    onChange={(event) => {
                      setTypeFilter(
                        event.target.value,
                      );
                      setSummaryFilter("");
                    }}
                  >
                    <option value="all">
                      All waiting types
                    </option>
                    <option value="task">
                      Dependencies
                    </option>
                    <option value="approval">
                      Approval decisions
                    </option>
                  </select>
                </label>

                <label className={styles.selectControl}>
                  <UserRound size={16} />

                  <select
                    value={ownerFilter}
                    onChange={(event) => {
                      setOwnerFilter(
                        event.target.value,
                      );
                      setSummaryFilter("");
                    }}
                  >
                    <option value="all">
                      All owners
                    </option>

                    {ownerOptions.map(
                      ([id, name]) => (
                        <option
                          key={id}
                          value={id}
                        >
                          {name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className={styles.sortControl}>
                  <span>Sort:</span>

                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(
                        event.target.value,
                      )
                    }
                  >
                    <option value="due">
                      Expected response
                    </option>
                    <option value="risk">
                      Risk
                    </option>
                    <option value="updated">
                      Recently updated
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.resultsLine}>
              <div>
                <strong>
                  {visibleRecords.length}
                </strong>

                <span>
                  {visibleRecords.length ===
                  1
                    ? "waiting item"
                    : "waiting items"}
                </span>
              </div>

              {showClearFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className={styles.tableScroller}>
              <table className={styles.waitingTable}>
                <thead>
                  <tr>
                    <th>Waiting on</th>
                    <th>Person or group</th>
                    <th>Owner</th>
                    <th>Expected response</th>
                    <th>Health</th>
                    <th>Type</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        className={styles.emptyCell}
                        colSpan="6"
                      >
                        Loading campaign dependencies…
                      </td>
                    </tr>
                  ) : !visibleRecords.length ? (
                    <tr>
                      <td
                        className={styles.emptyCell}
                        colSpan="6"
                      >
                        <Hourglass size={28} />

                        <strong>
                          Nothing is waiting in this view
                        </strong>

                        <span>
                          Adjust the filters or add a campaign dependency.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    visibleRecords.map(
                      (record) => {
                        const due =
                          formatDateTime(
                            record.dueAt,
                          );

                        const health =
                          recordHealth(
                            record,
                            referenceTime,
                          );

                        return (
                          <tr
                            key={record.key}
                            className={`${styles.waitingRow} ${
                              selectedRecordKey ===
                              record.key
                                ? styles.selectedRow
                                : ""
                            } ${
                              isOverdue(
                                record,
                                referenceTime,
                              )
                                ? styles.overdueRow
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedRecordKey(
                                record.key,
                              )
                            }
                          >
                            <td>
                              <button
                                className={styles.waitingName}
                                type="button"
                                onClick={() =>
                                  setSelectedRecordKey(
                                    record.key,
                                  )
                                }
                              >
                                <strong>
                                  {record.title}
                                </strong>

                                <span>
                                  {record.description ||
                                    "No additional context provided"}
                                </span>
                              </button>
                            </td>

                            <td>
                              <span className={styles.waitingFor}>
                                {record.waitingFor}
                              </span>
                            </td>

                            <td>
                              <span className={styles.owner}>
                                <span>
                                  {initials(
                                    personName(
                                      record.ownerId,
                                    ),
                                  )}
                                </span>

                                <strong>
                                  {personName(
                                    record.ownerId,
                                  )}
                                </strong>
                              </span>
                            </td>

                            <td>
                              <span
                                className={`${styles.dueDate} ${
                                  isOverdue(
                                    record,
                                    referenceTime,
                                  )
                                    ? styles.overdueDate
                                    : ""
                                }`}
                              >
                                <strong>
                                  {due.date}
                                </strong>

                                <small>
                                  {due.time}
                                </small>
                              </span>
                            </td>

                            <td>
                              <span
                                className={`${styles.healthBadge} ${
                                  styles[
                                    health.tone
                                  ]
                                }`}
                              >
                                <CircleDot size={11} />
                                {health.label}
                              </span>
                            </td>

                            <td>
                              <span className={styles.typeBadge}>
                                {record.kind ===
                                "approval"
                                  ? "Approval"
                                  : record.scope ===
                                      "external"
                                    ? "External"
                                    : "Internal"}
                              </span>
                            </td>
                          </tr>
                        );
                      },
                    )
                  )}
                </tbody>
              </table>
            </div>

            <footer className={styles.tableFooter}>
              <span>
                Showing {visibleRecords.length} of{" "}
                {records.length} waiting items
              </span>

              <span>
                Campaign dependency command center
              </span>
            </footer>
          </div>

          {selectedRecord && (
            <aside className={styles.detailsPanel}>
              <header className={styles.detailsHeader}>
                <div>
                  <span>
                    Waiting On details
                  </span>

                  <strong>
                    {selectedRecord.kind ===
                    "approval"
                      ? "Approval dependency"
                      : "Campaign dependency"}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRecordKey(
                      "",
                    )
                  }
                  aria-label="Close Waiting On details"
                >
                  <X size={19} />
                </button>
              </header>

              <div className={styles.detailsBody}>
                <section className={styles.detailsTitle}>
                  <div className={styles.detailTitleLine}>
                    <span
                      className={`${styles.priorityBadge} ${
                        styles[
                          selectedRecord.priority ||
                          "normal"
                        ]
                      }`}
                    >
                      {
                        (
                          PRIORITIES[
                            selectedRecord.priority
                          ] ||
                          PRIORITIES.normal
                        ).label
                      }{" "}
                      priority
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(
                          selectedRecord,
                        )
                      }
                      disabled={saving}
                    >
                      {selectedRecord.kind ===
                      "approval" ? (
                        <>
                          <ExternalLink size={15} />
                          Open approval
                        </>
                      ) : (
                        <>
                          <Pencil size={15} />
                          Edit
                        </>
                      )}
                    </button>
                  </div>

                  <h2>
                    {selectedRecord.title}
                  </h2>

                  <p>
                    {selectedRecord.description ||
                      "No additional context was provided."}
                  </p>
                </section>

                <section className={styles.detailFields}>
                  <div>
                    <span>
                      <UsersRound size={15} />
                      Waiting for
                    </span>

                    <strong>
                      {selectedRecord.waitingFor}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <UserRound size={15} />
                      Owner
                    </span>

                    <strong>
                      {personName(
                        selectedRecord.ownerId,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CalendarClock size={15} />
                      Expected response
                    </span>

                    <strong
                      className={
                        isOverdue(
                          selectedRecord,
                          referenceTime,
                        )
                          ? styles.redText
                          : ""
                      }
                    >
                      {
                        formatDateTime(
                          selectedRecord.dueAt,
                        ).date
                      }{" "}
                      ·{" "}
                      {
                        formatDateTime(
                          selectedRecord.dueAt,
                        ).time
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CircleDot size={15} />
                      Status
                    </span>

                    {selectedRecord.kind ===
                    "task" ? (
                      <select
                        value={
                          selectedRecord.status ||
                          "open"
                        }
                        disabled={saving}
                        onChange={(event) =>
                          updateWaitingStatus(
                            selectedRecord,
                            event.target.value,
                          )
                        }
                      >
                        <option value="open">
                          Waiting
                        </option>
                        <option value="in_progress">
                          Following up
                        </option>
                        <option value="completed">
                          Resolved
                        </option>
                      </select>
                    ) : (
                      <strong>
                        {selectedRecord.status ===
                        "changes_requested"
                          ? "Changes requested"
                          : selectedRecord.status ===
                              "pending"
                            ? "Pending review"
                            : selectedRecord.status ===
                                "draft"
                              ? "Draft"
                              : "Resolved"}
                      </strong>
                    )}
                  </div>

                  <div>
                    <span>
                      <Tag size={15} />
                      Source
                    </span>

                    <strong>
                      {selectedRecord.source}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <ShieldAlert size={15} />
                      Scope
                    </span>

                    <strong>
                      {selectedRecord.scope ===
                      "external"
                        ? "Outside the campaign"
                        : "Inside the campaign"}
                    </strong>
                  </div>
                </section>

                {selectedRecord.reviewNotes && (
                  <section className={styles.notesBlock}>
                    <strong>
                      Review notes
                    </strong>

                    <p>
                      {selectedRecord.reviewNotes}
                    </p>
                  </section>
                )}

                <section className={styles.followUpBlock}>
                  <Clock3 size={22} />

                  <div>
                    <strong>
                      Follow-through standard
                    </strong>

                    <p>
                      Record each follow-up, update the expected response date when it changes, and resolve the item only after the campaign receives what it needs.
                    </p>
                  </div>
                </section>
              </div>

              <footer className={styles.detailsFooter}>
                {selectedRecord.kind ===
                "approval" ? (
                  <button
                    className={styles.fullPrimaryButton}
                    type="button"
                    onClick={() =>
                      navigate(
                        "/approvals",
                      )
                    }
                  >
                    <ExternalLink size={16} />
                    Open Approvals
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        logFollowUp(
                          selectedRecord,
                        )
                      }
                    >
                      <Send size={16} />
                      Log follow-up
                    </button>

                    <button
                      className={styles.primaryDetailButton}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateWaitingStatus(
                          selectedRecord,
                          selectedRecord.resolved
                            ? "open"
                            : "completed",
                        )
                      }
                    >
                      <CheckCircle2 size={16} />

                      {selectedRecord.resolved
                        ? "Reopen"
                        : "Mark resolved"}
                    </button>
                  </>
                )}
              </footer>
            </aside>
          )}
        </section>
      </main>

      {modalMode && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalBackdrop}
            type="button"
            onClick={closeModal}
            aria-label="Close waiting item form"
          />

          <section
            className={styles.waitingModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="waiting-modal-title"
          >
            <header>
              <div>
                <span>
                  Campaign dependencies
                </span>

                <h2 id="waiting-modal-title">
                  {modalMode === "edit"
                    ? "Edit waiting item"
                    : "Add waiting item"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={styles.waitingForm}
              onSubmit={saveWaitingItem}
            >
              <label className={styles.fullField}>
                <span>
                  What are we waiting on?
                </span>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Example: Receive the final vendor quote"
                  maxLength={180}
                  autoFocus
                />
              </label>

              <label className={styles.fullField}>
                <span>
                  Context and impact
                </span>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Explain what is blocked and what the campaign needs to receive."
                  maxLength={5000}
                />
              </label>

              <label className={styles.fullField}>
                <span>
                  Person, team, or organization
                </span>

                <input
                  name="waitingFor"
                  value={formData.waitingFor}
                  onChange={handleFormChange}
                  placeholder="Who must respond or deliver this?"
                  maxLength={180}
                />
              </label>

              <label>
                <span>Owner</span>

                <select
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleFormChange}
                >
                  <option value="">
                    Unassigned
                  </option>

                  {team.map(
                    (member) => (
                      <option
                        key={member.id}
                        value={member.id}
                      >
                        {member.fullName}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Source</span>

                <select
                  name="source"
                  value={formData.source}
                  onChange={handleFormChange}
                >
                  {SOURCES.map(
                    (source) => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Scope</span>

                <select
                  name="scope"
                  value={formData.scope}
                  onChange={handleFormChange}
                >
                  {SCOPES.map(
                    (scope) => (
                      <option
                        key={scope.value}
                        value={scope.value}
                      >
                        {scope.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Project</span>

                <select
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                >
                  {PROJECTS.map(
                    (project) => (
                      <option
                        key={project}
                        value={project}
                      >
                        {project}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Priority</span>

                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleFormChange}
                >
                  <option value="urgent">
                    Critical
                  </option>
                  <option value="high">
                    High
                  </option>
                  <option value="normal">
                    Normal
                  </option>
                  <option value="low">
                    Low
                  </option>
                </select>
              </label>

              <label>
                <span>Status</span>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="open">
                    Waiting
                  </option>
                  <option value="in_progress">
                    Following up
                  </option>
                  <option value="completed">
                    Resolved
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Expected response date
                </span>

                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                />
              </label>

              <label>
                <span>
                  Expected response time
                </span>

                <input
                  type="time"
                  name="dueTime"
                  value={formData.dueTime}
                  onChange={handleFormChange}
                  disabled={!formData.dueDate}
                />
              </label>

              {formError && (
                <p
                  className={styles.formError}
                  role="alert"
                >
                  <AlertTriangle size={16} />
                  {formError}
                </p>
              )}

              <footer>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={saving}
                >
                  <Check size={17} />

                  {modalMode === "edit"
                    ? "Save changes"
                    : "Add waiting item"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
