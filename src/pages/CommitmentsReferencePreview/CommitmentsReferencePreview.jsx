import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Filter,
  Handshake,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useLocation,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useTasksCommandCenter,
} from "../../hooks/useTasksCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./CommitmentsReferencePreview.module.css";

const COMMITMENTS_REFERENCE_TIME = Date.now();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

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

const STATUSES = {
  open: {
    label: "Pending",
    progress: 10,
  },
  in_progress: {
    label: "In progress",
    progress: 55,
  },
  completed: {
    label: "Fulfilled",
    progress: 100,
  },
  archived: {
    label: "Archived",
    progress: 100,
  },
};

const SOURCES = [
  "Candidate conversation",
  "Community meeting",
  "Donor follow-up",
  "Volunteer request",
  "Campaign event",
  "Internal decision",
  "Other",
];

const PROJECTS = [
  "Candidate",
  "Communications",
  "Events",
  "Field",
  "Fundraising",
  "Operations",
  "Volunteer",
  "General",
];

const EMPTY_FORM = {
  title: "",
  description: "",
  stakeholder: "",
  source: "Candidate conversation",
  category: "General",
  priority: "normal",
  status: "open",
  assignedTo: "",
  dueDate: "",
  dueTime: "17:00",
};

const DEMO_BLUEPRINTS = [
  {
    title: "Send revised traffic plan to neighborhood leaders",
    description:
      "Provide the revised traffic and public-safety summary discussed at the community roundtable.",
    stakeholder: "Palm Beach County neighborhood leaders",
    source: "Community meeting",
    category: "Communications",
    priority: "urgent",
    status: "in_progress",
    dueOffsetHours: -18,
  },
  {
    title: "Return donor budget breakdown",
    description:
      "Share the campaign budget categories and event sponsorship information requested during the donor call.",
    stakeholder: "High-priority donor group",
    source: "Donor follow-up",
    category: "Fundraising",
    priority: "high",
    status: "open",
    dueOffsetHours: 14,
  },
  {
    title: "Confirm volunteer leadership assignments",
    description:
      "Send final team-lead responsibilities and arrival instructions before Saturday’s event.",
    stakeholder: "Weekend volunteer captains",
    source: "Volunteer request",
    category: "Volunteer",
    priority: "high",
    status: "in_progress",
    dueOffsetHours: 32,
  },
  {
    title: "Deliver candidate position summary",
    description:
      "Prepare and send the concise District 6 position summary requested after the candidate forum.",
    stakeholder: "District 6 civic association",
    source: "Candidate conversation",
    category: "Candidate",
    priority: "normal",
    status: "open",
    dueOffsetHours: 58,
  },
  {
    title: "Follow up on venue accessibility plan",
    description:
      "Confirm accessible parking, entry routes, seating, and restroom access with the venue manager.",
    stakeholder: "Community forum venue",
    source: "Campaign event",
    category: "Events",
    priority: "high",
    status: "open",
    dueOffsetHours: 82,
  },
  {
    title: "Provide canvassing map corrections",
    description:
      "Send corrected street boundaries and access notes to field leadership.",
    stakeholder: "Field leadership team",
    source: "Internal decision",
    category: "Field",
    priority: "normal",
    status: "open",
    dueOffsetHours: 128,
  },
  {
    title: "Share updated event sponsorship packet",
    description:
      "Deliver the revised sponsorship levels and recognition details requested by local business owners.",
    stakeholder: "Local business coalition",
    source: "Donor follow-up",
    category: "Fundraising",
    priority: "normal",
    status: "completed",
    dueOffsetHours: -96,
  },
  {
    title: "Send post-forum resource links",
    description:
      "Provide the public records, issue sources, and campaign contact information promised at the forum.",
    stakeholder: "Candidate forum attendees",
    source: "Community meeting",
    category: "Communications",
    priority: "low",
    status: "completed",
    dueOffsetHours: -44,
  },
];

function userName(user) {
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

function commitmentTagValue(tags, prefix) {
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

function isCommitment(task) {
  return (task.tags || []).some(
    (tag) =>
      String(tag).toLowerCase() ===
      "commitment",
  );
}

function isActive(record) {
  return ![
    "completed",
    "archived",
  ].includes(record.status);
}

function dueTimestamp(record) {
  if (!record.due_at) {
    return Number.POSITIVE_INFINITY;
  }

  return new Date(
    record.due_at,
  ).getTime();
}

function isOverdue(
  record,
  referenceTime,
) {
  return (
    isActive(record) &&
    Boolean(record.due_at) &&
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
    isActive(record) &&
    Number.isFinite(due) &&
    due >= referenceTime &&
    due <=
      referenceTime +
        7 *
          DAY
  );
}

function isAtRisk(
  record,
  referenceTime,
) {
  if (!isActive(record)) {
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

  if (record.priority === "urgent") {
    return true;
  }

  const due = dueTimestamp(record);

  return (
    record.priority === "high" &&
    Number.isFinite(due) &&
    due <=
      referenceTime +
        48 *
          HOUR
  );
}

function healthFor(
  record,
  referenceTime,
) {
  if (record.status === "completed") {
    return {
      label: "Fulfilled",
      tone: "fulfilled",
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
    isAtRisk(
      record,
      referenceTime,
    )
  ) {
    return {
      label: "At risk",
      tone: "risk",
    };
  }

  if (
    record.status === "in_progress"
  ) {
    return {
      label: "Moving",
      tone: "moving",
    };
  }

  return {
    label: "On track",
    tone: "track",
  };
}

function formatDue(value) {
  if (!value) {
    return {
      date: "No deadline",
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

function buildDemoRecords(
  user,
  workspace,
) {
  return DEMO_BLUEPRINTS.map(
    (item, index) => {
      const dueAt =
        new Date(
          COMMITMENTS_REFERENCE_TIME +
            item.dueOffsetHours *
              HOUR,
        ).toISOString();

      return {
        id: `demo-commitment-${index + 1}`,
        workspace_id: workspace?.id || "",
        title: item.title,
        description: item.description,
        stakeholder: item.stakeholder,
        source: item.source,
        category: item.category,
        priority: item.priority,
        status: item.status,
        assigned_to: user?.id || "",
        owner_name: userName(user),
        created_by: user?.id || "",
        due_at: dueAt,
        visibility: "workspace",
        tags: [
          "commitment",
          `stakeholder:${item.stakeholder}`,
          `source:${item.source}`,
        ],
        created_at:
          new Date(
            COMMITMENTS_REFERENCE_TIME -
              (index + 2) *
                DAY,
          ).toISOString(),
        updated_at:
          new Date(
            COMMITMENTS_REFERENCE_TIME -
              (index + 1) *
                3 *
                HOUR,
          ).toISOString(),
        completed_at:
          item.status === "completed"
            ? new Date(
                COMMITMENTS_REFERENCE_TIME -
                  12 *
                    HOUR,
              ).toISOString()
            : null,
        is_demo: true,
      };
    },
  );
}

function normalizeRecord(task) {
  return {
    ...task,
    stakeholder:
      commitmentTagValue(
        task.tags,
        "stakeholder:",
      ) ||
      "Campaign stakeholder",

    source:
      commitmentTagValue(
        task.tags,
        "source:",
      ) ||
      task.category ||
      "Campaign work",
  };
}

function metadataTags(
  existingTags,
  stakeholder,
  source,
) {
  const preserved = (
    existingTags || []
  ).filter((tag) => {
    const normalized =
      String(tag).toLowerCase();

    return (
      normalized !== "commitment" &&
      !normalized.startsWith(
        "stakeholder:",
      ) &&
      !normalized.startsWith(
        "source:",
      )
    );
  });

  return [
    ...preserved,
    "commitment",
    `stakeholder:${stakeholder.trim()}`,
    `source:${source.trim()}`,
  ];
}

export default function CommitmentsReferencePreview() {
  const location = useLocation();

  const user = getCurrentUser();
  const workspace =
    getCurrentWorkspace();

  const demoMode =
    new URLSearchParams(
      location.search,
    ).get("commitments-demo") ===
    "1";

  const [
    demoCommitments,
    setDemoCommitments,
  ] = useState(
    () =>
      buildDemoRecords(
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

  const [statusFilter, setStatusFilter] =
    useState("active");

  const [ownerFilter, setOwnerFilter] =
    useState("all");

  const [sortMode, setSortMode] =
    useState("due");

  const [
    selectedCommitmentId,
    setSelectedCommitmentId,
  ] = useState("");

  const [modalMode, setModalMode] =
    useState("");

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [formError, setFormError] =
    useState("");

  const {
    tasks: liveTasks,
    team,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    createTask,
    updateTask,
    changeTaskStatus,
  } = useTasksCommandCenter({
    workspaceId:
      demoMode
        ? ""
        : workspace.id,

    userId: user.id,

    selectedTaskId:
      demoMode
        ? ""
        : selectedCommitmentId,
  });

  const commitments = useMemo(
    () => {
      if (demoMode) {
        return demoCommitments;
      }

      return (
        Array.isArray(liveTasks)
          ? liveTasks
          : []
      )
        .filter(isCommitment)
        .map(normalizeRecord);
    },
    [
      demoCommitments,
      demoMode,
      liveTasks,
    ],
  );

  const referenceTime =
    lastUpdated?.getTime() ??
    COMMITMENTS_REFERENCE_TIME;

  const memberMap = useMemo(
    () =>
      new Map(
        (team || []).map(
          (member) => [
            member.id,
            member,
          ],
        ),
      ),
    [team],
  );

  const ownerName = useCallback(
    (record) =>
      record.owner_name ||
      memberMap.get(
        record.assigned_to,
      )?.fullName ||
      (
        record.assigned_to === user.id
          ? userName(user)
          : "Unassigned"
      ),
    [
      memberMap,
      user,
    ],
  );

  const activeCommitments = useMemo(
    () =>
      commitments.filter(isActive),
    [commitments],
  );

  const dueSoonCommitments = useMemo(
    () =>
      commitments.filter(
        (record) =>
          isDueSoon(
            record,
            referenceTime,
          ),
      ),
    [
      commitments,
      referenceTime,
    ],
  );

  const atRiskCommitments = useMemo(
    () =>
      commitments.filter(
        (record) =>
          isAtRisk(
            record,
            referenceTime,
          ),
      ),
    [
      commitments,
      referenceTime,
    ],
  );

  const overdueCommitments = useMemo(
    () =>
      commitments.filter(
        (record) =>
          isOverdue(
            record,
            referenceTime,
          ),
      ),
    [
      commitments,
      referenceTime,
    ],
  );

  const fulfilledCommitments = useMemo(
    () =>
      commitments.filter(
        (record) =>
          record.status ===
          "completed",
      ),
    [commitments],
  );

  const ownerOptions = useMemo(
    () => {
      const options = new Map();

      commitments.forEach(
        (record) => {
          if (!record.assigned_to) {
            return;
          }

          options.set(
            record.assigned_to,
            ownerName(record),
          );
        },
      );

      return Array.from(
        options.entries(),
      ).sort((left, right) =>
        left[1].localeCompare(
          right[1],
        ),
      );
    },
    [
      commitments,
      ownerName,
    ],
  );

  const visibleCommitments = useMemo(
    () => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return commitments
        .filter((record) => {
          if (
            activeTab === "all" &&
            !isActive(record)
          ) {
            return false;
          }

          if (
            activeTab === "mine" &&
            (
              record.assigned_to !==
                user.id ||
              !isActive(record)
            )
          ) {
            return false;
          }

          if (
            activeTab === "team" &&
            (
              !record.assigned_to ||
              record.assigned_to ===
                user.id ||
              !isActive(record)
            )
          ) {
            return false;
          }

          if (
            activeTab === "fulfilled" &&
            record.status !==
              "completed"
          ) {
            return false;
          }

          if (
            statusFilter === "active" &&
            !isActive(record)
          ) {
            return false;
          }

          if (
            ![
              "all",
              "active",
            ].includes(statusFilter) &&
            record.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            ownerFilter !== "all" &&
            record.assigned_to !==
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
              "at-risk" &&
            !isAtRisk(
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
              "fulfilled" &&
            record.status !==
              "completed"
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            record.title,
            record.description,
            record.stakeholder,
            record.source,
            record.category,
            ownerName(record),
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
                right.updated_at ||
                  right.created_at ||
                  0,
              ).getTime() -
              new Date(
                left.updated_at ||
                  left.created_at ||
                  0,
              ).getTime()
            );
          }

          const leftOverdue =
            isOverdue(
              left,
              referenceTime,
            );

          const rightOverdue =
            isOverdue(
              right,
              referenceTime,
            );

          if (
            leftOverdue !==
            rightOverdue
          ) {
            return leftOverdue
              ? -1
              : 1;
          }

          return (
            dueTimestamp(left) -
            dueTimestamp(right)
          );
        });
    },
    [
      activeTab,
      commitments,
      ownerFilter,
      ownerName,
      referenceTime,
      search,
      sortMode,
      statusFilter,
      summaryFilter,
      user.id,
    ],
  );

  const selectedCommitment =
    visibleCommitments.find(
      (record) =>
        record.id ===
        selectedCommitmentId,
    ) || null;

  useEffect(() => {
    if (
      typeof document ===
      "undefined"
    ) {
      return undefined;
    }

    const body = document.body;

    if (
      selectedCommitmentId ||
      modalMode
    ) {
      body.dataset.commitmentsFocusMode =
        "true";
    } else {
      delete body.dataset
        .commitmentsFocusMode;
    }

    return () => {
      delete body.dataset
        .commitmentsFocusMode;
    };
  }, [
    modalMode,
    selectedCommitmentId,
  ]);

  const chooseTab = (tab) => {
    setActiveTab(tab);
    setSelectedCommitmentId("");
    setSearch("");
    setOwnerFilter("all");
    setSortMode("due");

    if (tab === "fulfilled") {
      setStatusFilter("completed");
      setSummaryFilter("fulfilled");
    } else {
      setStatusFilter("active");
      setSummaryFilter("all");
    }
  };

  const chooseSummary = (key) => {
    setSelectedCommitmentId("");
    setSearch("");
    setOwnerFilter("all");
    setSortMode("due");

    if (key === "fulfilled") {
      setActiveTab("fulfilled");
      setStatusFilter("completed");
    } else {
      setActiveTab("all");
      setStatusFilter("active");
    }

    setSummaryFilter(key);
  };

  const clearFilters = () => {
    setSearch("");
    setOwnerFilter("all");
    setSortMode("due");

    if (
      activeTab === "fulfilled"
    ) {
      setStatusFilter("completed");
      setSummaryFilter("fulfilled");
    } else {
      setStatusFilter("active");
      setSummaryFilter("all");
    }
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
    const due =
      formDateParts(
        record.due_at,
      );

    setFormData({
      title: record.title || "",
      description:
        record.description || "",
      stakeholder:
        record.stakeholder || "",
      source:
        record.source ||
        "Candidate conversation",
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
        record.assigned_to || "",
      dueDate: due.date,
      dueTime: due.time,
    });

    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) {
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

  const saveCommitment = async (
    event,
  ) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setFormError(
        "Enter the campaign commitment.",
      );
      return;
    }

    if (
      !formData.stakeholder.trim()
    ) {
      setFormError(
        "Enter the person or group receiving this commitment.",
      );
      return;
    }

    const dueAt = buildDueAt();

    const existingTags =
      selectedCommitment?.tags ||
      [];

    const tags = metadataTags(
      existingTags,
      formData.stakeholder,
      formData.source,
    );

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
          selectedCommitment
        ) {
          setDemoCommitments(
            (current) =>
              current.map(
                (record) =>
                  record.id ===
                  selectedCommitment.id
                    ? {
                        ...record,
                        ...payload,
                        stakeholder:
                          formData
                            .stakeholder
                            .trim(),
                        source:
                          formData.source,
                        owner_name:
                          formData.assignedTo ===
                          user.id
                            ? userName(user)
                            : record.owner_name,
                        updated_at:
                          timestamp,
                        completed_at:
                          formData.status ===
                          "completed"
                            ? (
                                record.completed_at ||
                                timestamp
                              )
                            : null,
                      }
                    : record,
              ),
          );
        } else {
          const id =
            typeof crypto !==
              "undefined" &&
            crypto.randomUUID
              ? `demo-commitment-${crypto.randomUUID()}`
              : `demo-commitment-created-${Date.now()}`;

          setDemoCommitments(
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
                owner_name:
                  formData.assignedTo ===
                  user.id
                    ? userName(user)
                    : "Campaign member",
                stakeholder:
                  formData
                    .stakeholder
                    .trim(),
                source:
                  formData.source,
                ...payload,
              },
              ...current,
            ],
          );

          setSelectedCommitmentId(
            id,
          );
        }
      } else if (
        modalMode === "edit" &&
        selectedCommitment
      ) {
        await updateTask(
          selectedCommitment.id,
          payload,
        );
      } else {
        const created =
          await createTask(payload);

        if (created?.id) {
          setSelectedCommitmentId(
            created.id,
          );
        }
      }

      setModalMode("");
      setFormError("");
    } catch (saveError) {
      console.error(
        "Commitment could not be saved:",
        saveError,
      );

      setFormError(
        saveError?.message ||
        "The commitment could not be saved.",
      );
    }
  };

  const updateCommitmentStatus =
    async (
      record,
      nextStatus,
    ) => {
      try {
        if (demoMode) {
          const timestamp =
            new Date().toISOString();

          setDemoCommitments(
            (current) =>
              current.map(
                (item) =>
                  item.id === record.id
                    ? {
                        ...item,
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
                    : item,
              ),
          );

          return;
        }

        await changeTaskStatus(
          record,
          nextStatus,
        );
      } catch (statusError) {
        console.error(
          "Commitment status could not be changed:",
          statusError,
        );
      }
    };

  const handleRefresh = () => {
    setSelectedCommitmentId("");

    if (demoMode) {
      setDemoCommitments(
        buildDemoRecords(
          user,
          workspace,
        ),
      );
      return;
    }

    refresh();
  };

  const summaryCards = [
    {
      key: "all",
      label: "Open commitments",
      value:
        activeCommitments.length,
      caption:
        "Promises still in motion",
      icon: Handshake,
    },
    {
      key: "due-soon",
      label: "Due soon",
      value:
        dueSoonCommitments.length,
      caption:
        "Next seven days",
      icon: CalendarClock,
    },
    {
      key: "at-risk",
      label: "At risk",
      value:
        atRiskCommitments.length,
      caption:
        "Needs leadership attention",
      icon: ShieldAlert,
      tone: "warning",
    },
    {
      key: "overdue",
      label: "Overdue",
      value:
        overdueCommitments.length,
      caption:
        "Past the promised deadline",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      key: "fulfilled",
      label: "Fulfilled",
      value:
        fulfilledCommitments.length,
      caption:
        "Promises delivered",
      icon: CheckCircle2,
      tone: "success",
    },
  ];

  const showClearFilters =
    Boolean(search) ||
    ownerFilter !== "all" ||
    sortMode !== "due" ||
    statusFilter !==
      (
        activeTab === "fulfilled"
          ? "completed"
          : "active"
      ) ||
    ![
      "all",
      "fulfilled",
    ].includes(summaryFilter);

  const updatedLabel =
    demoMode
      ? "Local preview data"
      : lastUpdated
        ? `Updated ${new Intl.DateTimeFormat(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
            },
          ).format(lastUpdated)}`
        : "Ready";

  return (
    <CampaignWorkspaceShell activeItem="Commitments">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>
              Campaign accountability
            </span>

            <h1>Commitments</h1>

            <p>
              Track every promise made by the candidate and campaign—and make sure it is delivered.
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
                placeholder="Search commitments…"
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
              New commitment
            </button>
          </div>
        </header>

        {error && !demoMode && (
          <div
            className={styles.errorBanner}
            role="alert"
          >
            <AlertTriangle size={18} />
            {error}
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
                  <span
                    className={styles.summaryIcon}
                  >
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
          className={`${styles.commitmentsWorkspace} ${
            selectedCommitment
              ? styles.hasDetails
              : ""
          }`}
        >
          <div className={styles.commitmentPanel}>
            <div className={styles.tabsBar}>
              <nav
                className={styles.tabs}
                aria-label="Commitment views"
              >
                {[
                  [
                    "all",
                    "All commitments",
                  ],
                  [
                    "mine",
                    "My commitments",
                  ],
                  [
                    "team",
                    "Team commitments",
                  ],
                  [
                    "fulfilled",
                    "Fulfilled",
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
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(
                        event.target.value,
                      );
                      setSummaryFilter("");
                    }}
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="all">
                      All statuses
                    </option>
                    <option value="open">
                      Pending
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Fulfilled
                    </option>
                    <option value="archived">
                      Archived
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
                      Promise date
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
                  {visibleCommitments.length}
                </strong>

                <span>
                  {visibleCommitments.length ===
                  1
                    ? "commitment"
                    : "commitments"}
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
              <table className={styles.commitmentTable}>
                <thead>
                  <tr>
                    <th>Commitment</th>
                    <th>Stakeholder</th>
                    <th>Owner</th>
                    <th>Promise date</th>
                    <th>Health</th>
                    <th>Source</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading &&
                  !demoMode ? (
                    <tr>
                      <td
                        className={styles.emptyCell}
                        colSpan="6"
                      >
                        Loading campaign commitments…
                      </td>
                    </tr>
                  ) : !visibleCommitments.length ? (
                    <tr>
                      <td
                        className={styles.emptyCell}
                        colSpan="6"
                      >
                        <Handshake size={28} />
                        <strong>
                          No commitments match this view
                        </strong>
                        <span>
                          Adjust the filters or create a new campaign commitment.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    visibleCommitments.map(
                      (record) => {
                        const due =
                          formatDue(
                            record.due_at,
                          );

                        const health =
                          healthFor(
                            record,
                            referenceTime,
                          );

                        return (
                          <tr
                            key={record.id}
                            className={`${styles.commitmentRow} ${
                              selectedCommitmentId ===
                              record.id
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
                              setSelectedCommitmentId(
                                record.id,
                              )
                            }
                          >
                            <td>
                              <button
                                className={styles.commitmentName}
                                type="button"
                                onClick={() =>
                                  setSelectedCommitmentId(
                                    record.id,
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
                              <span className={styles.stakeholder}>
                                {record.stakeholder}
                              </span>
                            </td>

                            <td>
                              <span className={styles.owner}>
                                <span>
                                  {initials(
                                    ownerName(
                                      record,
                                    ),
                                  )}
                                </span>

                                <strong>
                                  {ownerName(
                                    record,
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
                              <span className={styles.source}>
                                {record.source}
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
                Showing {visibleCommitments.length} of{" "}
                {commitments.length} commitments
              </span>

              <span>
                Campaign promise accountability
              </span>
            </footer>
          </div>

          {selectedCommitment && (
            <aside className={styles.detailsPanel}>
              <header className={styles.detailsHeader}>
                <div>
                  <span>
                    Commitment details
                  </span>

                  <strong>
                    Campaign promise
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedCommitmentId(
                      "",
                    )
                  }
                  aria-label="Close commitment details"
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
                          selectedCommitment.priority ||
                          "normal"
                        ]
                      }`}
                    >
                      {
                        (
                          PRIORITIES[
                            selectedCommitment.priority
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
                          selectedCommitment,
                        )
                      }
                      disabled={isSaving}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                  </div>

                  <h2>
                    {selectedCommitment.title}
                  </h2>

                  <p>
                    {selectedCommitment.description ||
                      "No additional context was provided."}
                  </p>
                </section>

                <section className={styles.detailFields}>
                  <div>
                    <span>
                      <UsersRound size={15} />
                      Stakeholder
                    </span>

                    <strong>
                      {selectedCommitment.stakeholder}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <UserRound size={15} />
                      Owner
                    </span>

                    <strong>
                      {ownerName(
                        selectedCommitment,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CalendarClock size={15} />
                      Promise date
                    </span>

                    <strong
                      className={
                        isOverdue(
                          selectedCommitment,
                          referenceTime,
                        )
                          ? styles.redText
                          : ""
                      }
                    >
                      {
                        formatDue(
                          selectedCommitment.due_at,
                        ).date
                      }{" "}
                      ·{" "}
                      {
                        formatDue(
                          selectedCommitment.due_at,
                        ).time
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      <CircleDot size={15} />
                      Status
                    </span>

                    <select
                      value={
                        selectedCommitment.status ||
                        "open"
                      }
                      disabled={isSaving}
                      onChange={(event) =>
                        updateCommitmentStatus(
                          selectedCommitment,
                          event.target.value,
                        )
                      }
                    >
                      <option value="open">
                        Pending
                      </option>
                      <option value="in_progress">
                        In progress
                      </option>
                      <option value="completed">
                        Fulfilled
                      </option>
                    </select>
                  </div>

                  <div>
                    <span>
                      <Target size={15} />
                      Source
                    </span>

                    <strong>
                      {selectedCommitment.source}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <Tag size={15} />
                      Project
                    </span>

                    <strong>
                      {selectedCommitment.category ||
                        "General"}
                    </strong>
                  </div>
                </section>

                <section className={styles.progressBlock}>
                  <div>
                    <strong>
                      Commitment progress
                    </strong>

                    <span>
                      {
                        (
                          STATUSES[
                            selectedCommitment.status
                          ] ||
                          STATUSES.open
                        ).progress
                      }
                      %
                    </span>
                  </div>

                  <span className={styles.progressTrack}>
                    <span
                      style={{
                        width: `${
                          (
                            STATUSES[
                              selectedCommitment.status
                            ] ||
                            STATUSES.open
                          ).progress
                        }%`,
                      }}
                    />
                  </span>
                </section>

                <section className={styles.accountabilityBlock}>
                  <Handshake size={22} />

                  <div>
                    <strong>
                      Accountability standard
                    </strong>

                    <p>
                      Keep the stakeholder informed, record any changed deadline, and close the commitment only after the promised item has been delivered.
                    </p>
                  </div>
                </section>
              </div>

              <footer className={styles.detailsFooter}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    updateCommitmentStatus(
                      selectedCommitment,
                      "archived",
                    )
                  }
                >
                  <Archive size={16} />
                  Archive
                </button>

                <button
                  className={styles.primaryDetailButton}
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    updateCommitmentStatus(
                      selectedCommitment,
                      selectedCommitment.status ===
                        "completed"
                        ? "open"
                        : "completed",
                    )
                  }
                >
                  <CheckCircle2 size={16} />

                  {selectedCommitment.status ===
                  "completed"
                    ? "Reopen"
                    : "Mark fulfilled"}
                </button>
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
            aria-label="Close commitment form"
          />

          <section
            className={styles.commitmentModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="commitment-modal-title"
          >
            <header>
              <div>
                <span>
                  Campaign commitments
                </span>

                <h2 id="commitment-modal-title">
                  {modalMode === "edit"
                    ? "Edit commitment"
                    : "Create commitment"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={styles.commitmentForm}
              onSubmit={saveCommitment}
            >
              <label className={styles.fullField}>
                <span>Commitment</span>

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Example: Send the revised traffic plan"
                  maxLength={180}
                  autoFocus
                />
              </label>

              <label className={styles.fullField}>
                <span>Context and delivery notes</span>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Record exactly what was promised and what successful delivery requires."
                  maxLength={5000}
                />
              </label>

              <label className={styles.fullField}>
                <span>Stakeholder</span>

                <input
                  name="stakeholder"
                  value={formData.stakeholder}
                  onChange={handleFormChange}
                  placeholder="Person, organization, neighborhood, or campaign group"
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

                  {demoMode && (
                    <option value={user.id}>
                      {userName(user)}
                    </option>
                  )}

                  {!demoMode &&
                    team.map(
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
                    Pending
                  </option>
                  <option value="in_progress">
                    In progress
                  </option>
                  <option value="completed">
                    Fulfilled
                  </option>
                </select>
              </label>

              <label>
                <span>Promise date</span>

                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                />
              </label>

              <label>
                <span>Promise time</span>

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
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={isSaving}
                >
                  <Check size={17} />

                  {modalMode === "edit"
                    ? "Save changes"
                    : "Add commitment"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
