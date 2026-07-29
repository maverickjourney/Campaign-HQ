import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDollarSign,
  FileCheck2,
  FilePenLine,
  FileText,
  FolderKanban,
  History,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Palette,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useApprovalsCommandCenter,
} from "../../hooks/useApprovalsCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
} from "../../utils/campaignSession";

import styles from "./ApprovalsReferencePreview.module.css";

/* APPROVALS COMMAND CENTER V1 */

const APPROVALS_REFERENCE_TIME =
  Date.now();

const HOUR =
  60 * 60 * 1000;

const DAY =
  24 * HOUR;

const OPEN_STATUSES = [
  "draft",
  "pending",
  "changes_requested",
];

const TYPE_OPTIONS = [
  {
    value: "general",
    label: "General",
    icon: FileText,
  },
  {
    value: "communications",
    label: "Communications",
    icon: MessageSquareText,
  },
  {
    value: "event",
    label: "Event",
    icon: CalendarClock,
  },
  {
    value: "design",
    label: "Design",
    icon: Palette,
  },
  {
    value: "finance",
    label: "Finance",
    icon: CircleDollarSign,
  },
  {
    value: "volunteer",
    label: "Volunteer",
    icon: UsersRound,
  },
  {
    value: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
  },
];

const STATUS_META = {
  draft: {
    label: "Draft",
    note: "Not submitted",
  },
  pending: {
    label: "Pending review",
    note: "Awaiting a decision",
  },
  approved: {
    label: "Approved",
    note: "Final decision recorded",
  },
  changes_requested: {
    label: "Changes requested",
    note: "Revision required",
  },
  rejected: {
    label: "Rejected",
    note: "Request closed",
  },
};

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  approvalType: "general",
  status: "pending",
  dueAt: "",
  assignedTo: "",
};

const EMPTY_REVIEW = {
  approvalId: "",
  action: "approved",
  notes: "",
};

function offsetIso(offset) {
  return new Date(
    APPROVALS_REFERENCE_TIME +
      offset,
  ).toISOString();
}

function buildDemoTeam(user) {
  return [
    {
      id: user.id,
      fullName:
        user.name ||
        "Elizabeth Accomando",
      email: user.email || "",
    },
    {
      id: "demo-chris",
      fullName: "Chris Herrerias",
      email:
        "chris@campaignseat.local",
    },
    {
      id: "demo-patrick",
      fullName: "Patrick Campaign",
      email:
        "patrick@campaignseat.local",
    },
    {
      id: "demo-mary",
      fullName: "Mary Operations",
      email:
        "mary@campaignseat.local",
    },
  ];
}

function buildDemoApprovals(user) {
  return [
    {
      id: "demo-yard-sign",
      workspace_id:
        "demo-workspace",
      title:
        "District 6 yard sign final proof",
      description:
        "Confirm candidate logo placement, disclaimer size, colors, and printer-ready dimensions before production.",
      approval_type: "design",
      status: "pending",
      due_at: offsetIso(5 * HOUR),
      submitted_by:
        "demo-chris",
      assigned_to: user.id,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at:
        offsetIso(-28 * HOUR),
      updated_at:
        offsetIso(-2 * HOUR),
    },
    {
      id: "demo-mail-piece",
      workspace_id:
        "demo-workspace",
      title:
        "July vote-by-mail piece",
      description:
        "Review the final mail copy, image crop, call to action, and legal disclaimer before the vendor deadline.",
      approval_type:
        "communications",
      status: "pending",
      due_at: offsetIso(30 * HOUR),
      submitted_by:
        "demo-patrick",
      assigned_to:
        "demo-chris",
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at:
        offsetIso(-52 * HOUR),
      updated_at:
        offsetIso(-8 * HOUR),
    },
    {
      id: "demo-reception-materials",
      workspace_id:
        "demo-workspace",
      title:
        "Community reception materials",
      description:
        "The invitation, event signage, and guest handout need one coordinated final review.",
      approval_type: "event",
      status:
        "changes_requested",
      due_at: offsetIso(-8 * HOUR),
      submitted_by:
        "demo-mary",
      assigned_to: user.id,
      reviewed_by: user.id,
      reviewed_at:
        offsetIso(-13 * HOUR),
      review_notes:
        "Increase the RSVP deadline visibility and replace the older campaign logo on the handout.",
      created_at:
        offsetIso(-4 * DAY),
      updated_at:
        offsetIso(-13 * HOUR),
    },
    {
      id: "demo-volunteer-form",
      workspace_id:
        "demo-workspace",
      title:
        "Volunteer welcome form",
      description:
        "Confirm the final volunteer intake language and consent acknowledgement.",
      approval_type: "volunteer",
      status: "draft",
      due_at: offsetIso(3 * DAY),
      submitted_by: user.id,
      assigned_to:
        "demo-mary",
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at:
        offsetIso(-18 * HOUR),
      updated_at:
        offsetIso(-18 * HOUR),
    },
    {
      id: "demo-compliance",
      workspace_id:
        "demo-workspace",
      title:
        "Weekly compliance checklist",
      description:
        "Final review of contribution reporting, disclaimer use, and document retention requirements.",
      approval_type:
        "compliance",
      status: "approved",
      due_at: offsetIso(-2 * DAY),
      submitted_by:
        "demo-chris",
      assigned_to: user.id,
      reviewed_by: user.id,
      reviewed_at:
        offsetIso(-2 * DAY),
      review_notes:
        "Approved. All required records and disclaimers are present.",
      created_at:
        offsetIso(-5 * DAY),
      updated_at:
        offsetIso(-2 * DAY),
    },
    {
      id: "demo-budget",
      workspace_id:
        "demo-workspace",
      title:
        "August event budget",
      description:
        "Review the venue, catering, printing, and volunteer support budget before confirming vendors.",
      approval_type: "finance",
      status: "rejected",
      due_at: offsetIso(-3 * DAY),
      submitted_by:
        "demo-patrick",
      assigned_to: user.id,
      reviewed_by: user.id,
      reviewed_at:
        offsetIso(-3 * DAY),
      review_notes:
        "The venue estimate exceeds the approved event allocation. Revise and resubmit.",
      created_at:
        offsetIso(-7 * DAY),
      updated_at:
        offsetIso(-3 * DAY),
    },
  ];
}

function getTypeMeta(value) {
  return (
    TYPE_OPTIONS.find(
      (option) =>
        option.value === value,
    ) ||
    TYPE_OPTIONS[0]
  );
}

function getStatusMeta(value) {
  return (
    STATUS_META[value] ||
    STATUS_META.pending
  );
}

function getPersonName(
  userId,
  team,
) {
  if (!userId) {
    return "Unassigned";
  }

  return (
    team.find(
      (member) =>
        member.id === userId,
    )?.fullName ||
    "Campaign member"
  );
}

function getInitials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join("") || "CM";
}

function formatDateTime(value) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function formatUpdated(value) {
  if (!value) {
    return "Ready";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(value);
}

function toLocalInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() *
        60 *
        1000,
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function toIsoValue(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function isOpenApproval(approval) {
  return OPEN_STATUSES.includes(
    approval.status,
  );
}

function isOverdue(
  approval,
  referenceTime,
) {
  return Boolean(
    approval.due_at &&
      isOpenApproval(approval) &&
      new Date(
        approval.due_at,
      ).getTime() <
        referenceTime,
  );
}

export default function ApprovalsReferencePreview() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = getCurrentUser();
  const workspace =
    getCurrentWorkspace();
  const roleLabel = getRoleLabel();

  const demoMode =
    new URLSearchParams(
      location.search,
    ).get("approvals-demo") === "1";

  const leadershipAccess =
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const [
    demoApprovals,
    setDemoApprovals,
  ] = useState(() =>
    buildDemoApprovals(user),
  );

  const [
    demoUpdatedAt,
    setDemoUpdatedAt,
  ] = useState(
    () => new Date(),
  );

  const [
    selectedApprovalId,
    setSelectedApprovalId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("open");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("all");

  const [
    reviewerFilter,
    setReviewerFilter,
  ] = useState("all");

  const [
    sortMode,
    setSortMode,
  ] = useState("due");

  const [
    drawerTab,
    setDrawerTab,
  ] = useState("overview");

  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false);

  const [
    reviewOpen,
    setReviewOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);

  const [
    review,
    setReview,
  ] = useState(EMPTY_REVIEW);

  const [
    actionError,
    setActionError,
  ] = useState("");

  const command =
    useApprovalsCommandCenter({
      workspaceId: demoMode
        ? ""
        : workspace.id,
      userId: user.id,
    });

  const approvals = demoMode
    ? demoApprovals
    : command.approvals;

  const team = useMemo(() => {
    const source = demoMode
      ? buildDemoTeam(user)
      : Array.isArray(command.team)
        ? command.team
        : [];

    if (
      source.some(
        (member) =>
          member.id === user.id,
      )
    ) {
      return source;
    }

    return [
      {
        id: user.id,
        fullName:
          user.name ||
          "Elizabeth Accomando",
        email: user.email || "",
      },
      ...source,
    ];
  }, [
    command.team,
    demoMode,
    user,
  ]);

  const isLoading =
    !demoMode &&
    command.isLoading;

  const isSaving =
    !demoMode &&
    command.isSaving;

  const pageError =
    demoMode
      ? actionError
      : actionError ||
        command.error;

  const referenceTime =
    demoMode
      ? APPROVALS_REFERENCE_TIME
      : command.lastUpdated
          ?.getTime() ||
        APPROVALS_REFERENCE_TIME;

  const selectedApproval =
    approvals.find(
      (approval) =>
        approval.id ===
        selectedApprovalId,
    ) || null;

  const openCount =
    approvals.filter(
      isOpenApproval,
    ).length;

  const assignedToMeCount =
    approvals.filter(
      (approval) =>
        isOpenApproval(approval) &&
        approval.assigned_to ===
          user.id,
    ).length;

  const changesCount =
    approvals.filter(
      (approval) =>
        approval.status ===
        "changes_requested",
    ).length;

  const approvedCount =
    approvals.filter(
      (approval) =>
        approval.status ===
        "approved",
    ).length;

  const filteredApprovals =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      const matches =
        approvals.filter(
          (approval) => {
            const reviewer =
              getPersonName(
                approval.assigned_to,
                team,
              );

            const submitter =
              getPersonName(
                approval.submitted_by,
                team,
              );

            const matchesSearch =
              !normalizedSearch ||
              [
                approval.title,
                approval.description,
                approval.review_notes,
                reviewer,
                submitter,
                getTypeMeta(
                  approval.approval_type,
                ).label,
                getStatusMeta(
                  approval.status,
                ).label,
              ]
                .filter(Boolean)
                .some((value) =>
                  String(value)
                    .toLowerCase()
                    .includes(
                      normalizedSearch,
                    ),
                );

            const matchesTab =
              activeTab === "all" ||
              (
                activeTab === "mine" &&
                approval.assigned_to ===
                  user.id
              ) ||
              (
                activeTab ===
                  "changes" &&
                approval.status ===
                  "changes_requested"
              ) ||
              (
                activeTab ===
                  "history" &&
                [
                  "approved",
                  "rejected",
                ].includes(
                  approval.status,
                )
              );

            const matchesStatus =
              statusFilter ===
                "all" ||
              (
                statusFilter ===
                  "open" &&
                isOpenApproval(
                  approval,
                )
              ) ||
              approval.status ===
                statusFilter;

            const matchesType =
              typeFilter === "all" ||
              approval.approval_type ===
                typeFilter;

            const matchesReviewer =
              reviewerFilter ===
                "all" ||
              (
                reviewerFilter ===
                  "mine" &&
                approval.assigned_to ===
                  user.id
              ) ||
              (
                reviewerFilter ===
                  "unassigned" &&
                !approval.assigned_to
              ) ||
              approval.assigned_to ===
                reviewerFilter;

            return (
              matchesSearch &&
              matchesTab &&
              matchesStatus &&
              matchesType &&
              matchesReviewer
            );
          },
        );

      return [...matches].sort(
        (left, right) => {
          if (sortMode === "newest") {
            return (
              new Date(
                right.created_at ||
                  0,
              ).getTime() -
              new Date(
                left.created_at ||
                  0,
              ).getTime()
            );
          }

          if (sortMode === "oldest") {
            return (
              new Date(
                left.created_at ||
                  0,
              ).getTime() -
              new Date(
                right.created_at ||
                  0,
              ).getTime()
            );
          }

          const leftDue =
            left.due_at
              ? new Date(
                  left.due_at,
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          const rightDue =
            right.due_at
              ? new Date(
                  right.due_at,
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          return leftDue - rightDue;
        },
      );
    }, [
      activeTab,
      approvals,
      reviewerFilter,
      search,
      sortMode,
      statusFilter,
      team,
      typeFilter,
      user.id,
    ]);

  const summaryCards = [
    {
      key: "open",
      label: "Open approvals",
      value: openCount,
      note: "Requests still in motion",
      icon: FileCheck2,
      active:
        activeTab === "all" &&
        statusFilter === "open",
    },
    {
      key: "mine",
      label: "Assigned to me",
      value: assignedToMeCount,
      note: "Your open decisions",
      icon: UserCheck,
      active:
        activeTab === "mine",
    },
    {
      key: "changes",
      label: "Changes requested",
      value: changesCount,
      note: "Revision required",
      icon: FilePenLine,
      active:
        activeTab === "changes",
    },
    {
      key: "approved",
      label: "Approved",
      value: approvedCount,
      note: "Final decisions recorded",
      icon: CheckCircle2,
      active:
        activeTab ===
          "history" &&
        statusFilter ===
          "approved",
    },
  ];

  const updatedLabel =
    demoMode
      ? "Local preview data"
      : command.lastUpdated
        ? `Updated ${formatUpdated(
            command.lastUpdated,
          )}`
        : "Ready";

  const focusActive =
    Boolean(
      selectedApprovalId ||
      editorOpen ||
      reviewOpen,
    );

  useEffect(() => {
    if (
      typeof document ===
      "undefined"
    ) {
      return undefined;
    }

    const body = document.body;
    const previousOverflow =
      body.style.overflow;

    if (focusActive) {
      body.dataset.approvalsFocus =
        "true";
      body.style.overflow =
        "hidden";
    } else {
      delete body.dataset
        .approvalsFocus;
    }

    return () => {
      delete body.dataset
        .approvalsFocus;
      body.style.overflow =
        previousOverflow;
    };
  }, [focusActive]);

  useEffect(() => {
    const handleEscape = (
      event,
    ) => {
      if (event.key !== "Escape") {
        return;
      }

      if (reviewOpen) {
        setReviewOpen(false);
        return;
      }

      if (editorOpen) {
        setEditorOpen(false);
        return;
      }

      if (selectedApprovalId) {
        setSelectedApprovalId("");
        setExpanded(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [
    editorOpen,
    reviewOpen,
    selectedApprovalId,
  ]);

  const selectSummary =
    (key) => {
      if (key === "mine") {
        setActiveTab("mine");
        setStatusFilter("open");
        return;
      }

      if (key === "changes") {
        setActiveTab("changes");
        setStatusFilter(
          "changes_requested",
        );
        return;
      }

      if (key === "approved") {
        setActiveTab("history");
        setStatusFilter("approved");
        return;
      }

      setActiveTab("all");
      setStatusFilter("open");
    };

  const selectTab =
    (key) => {
      setActiveTab(key);

      if (key === "history") {
        setStatusFilter("all");
      } else if (
        key === "changes"
      ) {
        setStatusFilter(
          "changes_requested",
        );
      } else {
        setStatusFilter("open");
      }
    };

  const handleRefresh =
    async () => {
      setActionError("");

      if (demoMode) {
        setDemoUpdatedAt(
          new Date(),
        );
        return;
      }

      try {
        await command.refresh();
      } catch (refreshError) {
        setActionError(
          refreshError?.message ||
            "Approvals could not be refreshed.",
        );
      }
    };

  const openEditor =
    (approval = null) => {
      setActionError("");

      if (approval) {
        setForm({
          id: approval.id,
          title:
            approval.title || "",
          description:
            approval.description ||
            "",
          approvalType:
            approval.approval_type ||
            "general",
          status:
            [
              "draft",
              "pending",
            ].includes(
              approval.status,
            )
              ? approval.status
              : "pending",
          dueAt:
            toLocalInputValue(
              approval.due_at,
            ),
          assignedTo:
            approval.assigned_to ||
            "",
        });
      } else {
        setForm(EMPTY_FORM);
      }

      setEditorOpen(true);
    };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }

    setEditorOpen(false);
    setActionError("");
  };

  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setForm(
        (current) => ({
          ...current,
          [name]: value,
        }),
      );
    };

  const handleSave =
    async (event) => {
      event.preventDefault();
      setActionError("");

      const title =
        form.title.trim();

      if (!title) {
        setActionError(
          "Enter an approval title.",
        );
        return;
      }

      const payload = {
        id: form.id || undefined,
        title,
        description:
          form.description.trim(),
        approvalType:
          form.approvalType,
        status: form.status,
        dueAt:
          toIsoValue(form.dueAt),
        assignedTo:
          form.assignedTo ||
          null,
      };

      try {
        let savedApproval;

        if (demoMode) {
          const timestamp =
            new Date().toISOString();

          if (form.id) {
            savedApproval = {
              ...demoApprovals.find(
                (approval) =>
                  approval.id ===
                  form.id,
              ),
              title:
                payload.title,
              description:
                payload.description ||
                null,
              approval_type:
                payload.approvalType,
              status:
                payload.status,
              due_at:
                payload.dueAt,
              assigned_to:
                payload.assignedTo,
              reviewed_by: null,
              reviewed_at: null,
              review_notes: null,
              updated_at:
                timestamp,
            };

            setDemoApprovals(
              (current) =>
                current.map(
                  (approval) =>
                    approval.id ===
                    form.id
                      ? savedApproval
                      : approval,
                ),
            );
          } else {
            savedApproval = {
              id:
                `demo-approval-${Date.now()}`,
              workspace_id:
                workspace.id,
              title:
                payload.title,
              description:
                payload.description ||
                null,
              approval_type:
                payload.approvalType,
              status:
                payload.status,
              due_at:
                payload.dueAt,
              submitted_by:
                user.id,
              assigned_to:
                payload.assignedTo,
              reviewed_by: null,
              reviewed_at: null,
              review_notes: null,
              created_at:
                timestamp,
              updated_at:
                timestamp,
            };

            setDemoApprovals(
              (current) => [
                savedApproval,
                ...current,
              ],
            );
          }

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          savedApproval =
            await command.saveApproval(
              payload,
            );
        }

        setEditorOpen(false);
        setForm(EMPTY_FORM);

        if (savedApproval?.id) {
          setDrawerTab(
            "overview",
          );
          setSelectedApprovalId(
            savedApproval.id,
          );
        }
      } catch (saveError) {
        setActionError(
          saveError?.message ||
            "The approval could not be saved.",
        );
      }
    };

  const openReview =
    (action) => {
      if (!selectedApproval) {
        return;
      }

      setActionError("");
      setReview({
        approvalId:
          selectedApproval.id,
        action,
        notes:
          selectedApproval
            .review_notes || "",
      });
      setReviewOpen(true);
    };

  const closeReview = () => {
    if (isSaving) {
      return;
    }

    setReviewOpen(false);
    setActionError("");
  };

  const handleReview =
    async (event) => {
      event.preventDefault();
      setActionError("");

      const notes =
        review.notes.trim();

      if (
        [
          "changes_requested",
          "rejected",
        ].includes(
          review.action,
        ) &&
        !notes
      ) {
        setActionError(
          "Add review notes explaining the requested changes or rejection.",
        );
        return;
      }

      try {
        if (demoMode) {
          const timestamp =
            new Date().toISOString();

          setDemoApprovals(
            (current) =>
              current.map(
                (approval) =>
                  approval.id ===
                  review.approvalId
                    ? {
                        ...approval,
                        status:
                          review.action,
                        review_notes:
                          notes || null,
                        reviewed_by:
                          user.id,
                        reviewed_at:
                          timestamp,
                        updated_at:
                          timestamp,
                      }
                    : approval,
              ),
          );

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          await command.reviewApproval({
            approvalId:
              review.approvalId,
            status:
              review.action,
            reviewNotes:
              notes,
          });
        }

        setReviewOpen(false);
        setReview(EMPTY_REVIEW);
      } catch (reviewError) {
        setActionError(
          reviewError?.message ||
            "The decision could not be saved.",
        );
      }
    };

  const handleDelete =
    async () => {
      if (!selectedApproval) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete "${selectedApproval.title}"? This cannot be undone.`,
        );

      if (!confirmed) {
        return;
      }

      setActionError("");

      try {
        if (demoMode) {
          setDemoApprovals(
            (current) =>
              current.filter(
                (approval) =>
                  approval.id !==
                  selectedApproval.id,
              ),
          );

          setDemoUpdatedAt(
            new Date(),
          );
        } else {
          await command.deleteApproval(
            selectedApproval.id,
          );
        }

        setSelectedApprovalId("");
        setExpanded(false);
      } catch (deleteError) {
        setActionError(
          deleteError?.message ||
            "The approval could not be deleted.",
        );
      }
    };

  const canReviewSelected =
    Boolean(
      selectedApproval &&
        (
          leadershipAccess ||
          selectedApproval
            .assigned_to ===
            user.id
        ),
    );

  return (
    <CampaignWorkspaceShell
      activeItem="Approvals"
    >
      <main className={styles.page}>
        <section
          className={
            styles.pageHeader
          }
        >
          <div
            className={
              styles.headerCopy
            }
          >
            <span
              className={
                styles.eyebrow
              }
            >
              Campaign decisions
            </span>

            <h1>Approvals</h1>

            <p>
              Review campaign
              materials, request
              changes, assign
              decision owners and
              preserve a clear
              sign-off record.
            </p>

            <div
              className={
                styles.updatedStatus
              }
            >
              <span />

              {demoMode
                ? "Local preview data"
                : updatedLabel}

              {demoMode &&
                demoUpdatedAt && (
                  <small>
                    Updated{" "}
                    {formatUpdated(
                      demoUpdatedAt,
                    )}
                  </small>
                )}
            </div>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <label
              className={
                styles.searchBox
              }
            >
              <Search size={20} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search approvals..."
              />
            </label>

            <button
              className={
                styles.secondaryButton
              }
              type="button"
              onClick={
                handleRefresh
              }
              disabled={isLoading}
            >
              <RefreshCw
                size={19}
                className={
                  isLoading
                    ? styles.spinning
                    : ""
                }
              />
              Refresh
            </button>

            {leadershipAccess && (
              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={() =>
                  openEditor()
                }
              >
                <Plus size={20} />
                New approval
              </button>
            )}
          </div>
        </section>

        {pageError && (
          <section
            className={
              styles.errorBanner
            }
            role="alert"
          >
            <AlertTriangle
              size={19}
            />

            <div>
              <strong>
                Approvals need
                attention
              </strong>

              <p>{pageError}</p>
            </div>
          </section>
        )}

        <section
          className={
            styles.summaryGrid
          }
          aria-label="Approvals summary"
        >
          {summaryCards.map(
            (card) => {
              const Icon =
                card.icon;

              return (
                <button
                  className={`${styles.summaryCard} ${
                    card.active
                      ? styles.summaryCardActive
                      : ""
                  }`}
                  type="button"
                  key={card.key}
                  onClick={() =>
                    selectSummary(
                      card.key,
                    )
                  }
                  aria-pressed={
                    card.active
                  }
                >
                  <span
                    className={
                      styles.summaryIcon
                    }
                  >
                    <Icon
                      size={21}
                    />
                  </span>

                  <span>
                    <small>
                      {card.label}
                    </small>

                    <strong>
                      {isLoading
                        ? "—"
                        : card.value}
                    </strong>

                    <em>
                      {card.note}
                    </em>
                  </span>
                </button>
              );
            },
          )}
        </section>

        <section
          className={
            styles.workflowBar
          }
        >
          <div>
            <ShieldCheck
              size={18}
            />

            <strong>
              Decision flow
            </strong>
          </div>

          <span>Draft</span>
          <i />
          <span>Pending review</span>
          <i />
          <span>
            Approved or revised
          </span>

          <p>
            Requested changes and
            rejections require a
            written decision note.
          </p>
        </section>

        <section
          className={
            styles.queuePanel
          }
        >
          <nav
            className={styles.tabs}
            aria-label="Approval views"
          >
            {[
              [
                "all",
                "All approvals",
              ],
              [
                "mine",
                "Assigned to me",
              ],
              [
                "changes",
                "Needs revision",
              ],
              [
                "history",
                "Decision history",
              ],
            ].map(
              ([
                key,
                label,
              ]) => (
                <button
                  type="button"
                  key={key}
                  className={
                    activeTab === key
                      ? styles.activeTab
                      : ""
                  }
                  onClick={() =>
                    selectTab(key)
                  }
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          <div
            className={
              styles.toolbar
            }
          >
            <label>
              <span>Status</span>

              <select
                value={
                  statusFilter
                }
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="open">
                  Open approvals
                </option>
                <option value="all">
                  All statuses
                </option>
                <option value="draft">
                  Draft
                </option>
                <option value="pending">
                  Pending review
                </option>
                <option value="changes_requested">
                  Changes requested
                </option>
                <option value="approved">
                  Approved
                </option>
                <option value="rejected">
                  Rejected
                </option>
              </select>
            </label>

            <label>
              <span>Type</span>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All types
                </option>

                {TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>Reviewer</span>

              <select
                value={
                  reviewerFilter
                }
                onChange={(event) =>
                  setReviewerFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All reviewers
                </option>
                <option value="mine">
                  Assigned to me
                </option>
                <option value="unassigned">
                  Unassigned
                </option>

                {team.map(
                  (member) => (
                    <option
                      key={
                        member.id
                      }
                      value={
                        member.id
                      }
                    >
                      {
                        member.fullName
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>Sort</span>

              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(
                    event.target
                      .value,
                  )
                }
              >
                <option value="due">
                  Due date
                </option>
                <option value="newest">
                  Newest
                </option>
                <option value="oldest">
                  Oldest
                </option>
              </select>
            </label>
          </div>

          <div
            className={
              styles.resultBar
            }
          >
            <strong>
              {
                filteredApprovals.length
              }
            </strong>

            <span>
              {filteredApprovals.length ===
              1
                ? "approval"
                : "approvals"}
            </span>

            <p>
              Click a row to review
              its decision record.
            </p>
          </div>

          <div
            className={
              styles.tableScroll
            }
          >
            <div
              className={
                styles.tableHeader
              }
              aria-hidden="true"
            >
              <span>Approval</span>
              <span>Status</span>
              <span>Reviewer</span>
              <span>Due</span>
              <span>Submitted by</span>
              <span>Type</span>
              <span />
            </div>

            {isLoading && (
              <div
                className={
                  styles.loadingState
                }
              >
                <RefreshCw
                  size={25}
                  className={
                    styles.spinning
                  }
                />

                <strong>
                  Loading campaign
                  approvals…
                </strong>
              </div>
            )}

            {!isLoading &&
              filteredApprovals.map(
                (approval) => {
                  const type =
                    getTypeMeta(
                      approval.approval_type,
                    );

                  const TypeIcon =
                    type.icon;

                  const status =
                    getStatusMeta(
                      approval.status,
                    );

                  const reviewer =
                    getPersonName(
                      approval.assigned_to,
                      team,
                    );

                  const submitter =
                    getPersonName(
                      approval.submitted_by,
                      team,
                    );

                  const overdue =
                    isOverdue(
                      approval,
                      referenceTime,
                    );

                  return (
                    <button
                      className={`${styles.approvalRow} ${
                        selectedApprovalId ===
                        approval.id
                          ? styles.selectedRow
                          : ""
                      } ${
                        overdue
                          ? styles.overdueRow
                          : ""
                      }`}
                      type="button"
                      key={approval.id}
                      onClick={() => {
                        setDrawerTab(
                          "overview",
                        );
                        setSelectedApprovalId(
                          approval.id,
                        );
                      }}
                    >
                      <span
                        className={
                          styles.approvalIdentity
                        }
                      >
                        <span
                          className={
                            styles.typeIcon
                          }
                        >
                          <TypeIcon
                            size={19}
                          />
                        </span>

                        <span>
                          <strong>
                            {
                              approval.title
                            }
                          </strong>

                          <small>
                            {approval.description ||
                              "No description provided."}
                          </small>
                        </span>
                      </span>

                      <span>
                        <em
                          className={`${styles.statusBadge} ${
                            styles[
                              `status_${approval.status}`
                            ] || ""
                          }`}
                        >
                          {
                            status.label
                          }
                        </em>
                      </span>

                      <span
                        className={
                          styles.personCell
                        }
                      >
                        <i>
                          {getInitials(
                            reviewer,
                          )}
                        </i>

                        <strong>
                          {reviewer}
                        </strong>
                      </span>

                      <span
                        className={
                          overdue
                            ? styles.overdueDate
                            : styles.dateCell
                        }
                      >
                        {overdue && (
                          <small>
                            Overdue
                          </small>
                        )}

                        <strong>
                          {formatDateTime(
                            approval.due_at,
                          )}
                        </strong>
                      </span>

                      <span
                        className={
                          styles.submitterCell
                        }
                      >
                        {submitter}
                      </span>

                      <span>
                        <em
                          className={
                            styles.typeBadge
                          }
                        >
                          {type.label}
                        </em>
                      </span>

                      <ArrowUpRight
                        size={17}
                      />
                    </button>
                  );
                },
              )}

            {!isLoading &&
              filteredApprovals.length ===
                0 && (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <span>
                    <CircleDashed
                      size={29}
                    />
                  </span>

                  <h3>
                    {approvals.length
                      ? "No matching approvals"
                      : "No campaign approvals yet"}
                  </h3>

                  <p>
                    {approvals.length
                      ? "Adjust the current search or filters."
                      : "Create the first campaign review request."}
                  </p>

                  {leadershipAccess &&
                    !approvals.length && (
                      <button
                        type="button"
                        onClick={() =>
                          openEditor()
                        }
                      >
                        <Plus
                          size={17}
                        />
                        New approval
                      </button>
                    )}
                </div>
              )}
          </div>
        </section>
      </main>

      {selectedApproval && (
        <>
          <button
            className={
              styles.drawerBackdrop
            }
            type="button"
            aria-label="Close approval details"
            onClick={() => {
              setSelectedApprovalId(
                "",
              );
              setExpanded(false);
            }}
          />

          <aside
            className={`${styles.drawer} ${
              expanded
                ? styles.drawerExpanded
                : ""
            }`}
            aria-label="Approval details"
          >
            <header
              className={
                styles.drawerHeader
              }
            >
              <div>
                <span>
                  Approval details
                </span>

                <h2>
                  {
                    selectedApproval.title
                  }
                </h2>

                <div>
                  <em
                    className={`${styles.statusBadge} ${
                      styles[
                        `status_${selectedApproval.status}`
                      ] || ""
                    }`}
                  >
                    {
                      getStatusMeta(
                        selectedApproval.status,
                      ).label
                    }
                  </em>

                  <em
                    className={
                      styles.typeBadge
                    }
                  >
                    {
                      getTypeMeta(
                        selectedApproval.approval_type,
                      ).label
                    }
                  </em>
                </div>
              </div>

              <nav>
                <button
                  type="button"
                  title={
                    expanded
                      ? "Restore drawer"
                      : "Expand drawer"
                  }
                  onClick={() =>
                    setExpanded(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {expanded ? (
                    <Minimize2
                      size={18}
                    />
                  ) : (
                    <Maximize2
                      size={18}
                    />
                  )}
                </button>

                <button
                  type="button"
                  title="Close details"
                  onClick={() => {
                    setSelectedApprovalId(
                      "",
                    );
                    setExpanded(false);
                  }}
                >
                  <X size={20} />
                </button>
              </nav>
            </header>

            <div
              className={
                styles.decisionBar
              }
            >
              {canReviewSelected &&
                isOpenApproval(
                  selectedApproval,
                ) && (
                  <>
                    <button
                      className={
                        styles.approveButton
                      }
                      type="button"
                      onClick={() =>
                        openReview(
                          "approved",
                        )
                      }
                    >
                      <CheckCircle2
                        size={17}
                      />
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openReview(
                          "changes_requested",
                        )
                      }
                    >
                      <FilePenLine
                        size={17}
                      />
                      Request changes
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openReview(
                          "rejected",
                        )
                      }
                    >
                      <XCircle
                        size={17}
                      />
                      Reject
                    </button>
                  </>
                )}

              {leadershipAccess && (
                <button
                  className={
                    styles.editButton
                  }
                  type="button"
                  onClick={() =>
                    openEditor(
                      selectedApproval,
                    )
                  }
                >
                  Edit request
                </button>
              )}
            </div>

            <nav
              className={
                styles.drawerTabs
              }
            >
              {[
                [
                  "overview",
                  "Overview",
                ],
                [
                  "history",
                  "History",
                ],
                [
                  "connections",
                  "Related work",
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <button
                    type="button"
                    key={key}
                    className={
                      drawerTab === key
                        ? styles.activeDrawerTab
                        : ""
                    }
                    onClick={() =>
                      setDrawerTab(
                        key,
                      )
                    }
                  >
                    {key ===
                    "history" ? (
                      <History
                        size={16}
                      />
                    ) : null}

                    {label}
                  </button>
                ),
              )}
            </nav>

            <div
              className={
                styles.drawerBody
              }
            >
              {drawerTab ===
                "overview" && (
                <div
                  className={
                    styles.overviewWorkspace
                  }
                >
                  <section
                    className={
                      styles.detailSection
                    }
                  >
                    <span>
                      Decision brief
                    </span>

                    <p>
                      {selectedApproval.description ||
                        "No description was provided."}
                    </p>
                  </section>

                  <section
                    className={
                      styles.detailGrid
                    }
                  >
                    <article>
                      <span>
                        Reviewer
                      </span>

                      <strong>
                        {getPersonName(
                          selectedApproval.assigned_to,
                          team,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>
                        Submitted by
                      </span>

                      <strong>
                        {getPersonName(
                          selectedApproval.submitted_by,
                          team,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>
                        Due
                      </span>

                      <strong>
                        {formatDateTime(
                          selectedApproval.due_at,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>
                        Current status
                      </span>

                      <strong>
                        {
                          getStatusMeta(
                            selectedApproval.status,
                          ).label
                        }
                      </strong>
                    </article>
                  </section>

                  <section
                    className={
                      styles.nextStep
                    }
                  >
                    <ShieldCheck
                      size={20}
                    />

                    <div>
                      <strong>
                        Next decision
                        step
                      </strong>

                      <p>
                        {
                          getStatusMeta(
                            selectedApproval.status,
                          ).note
                        }
                      </p>
                    </div>
                  </section>

                  <section
                    className={
                      styles.reviewRecord
                    }
                  >
                    <span>
                      Review notes
                    </span>

                    <p>
                      {selectedApproval.review_notes ||
                        "No decision notes have been recorded."}
                    </p>
                  </section>
                </div>
              )}

              {drawerTab ===
                "history" && (
                <section
                  className={
                    styles.timeline
                  }
                >
                  <article>
                    <i />

                    <div>
                      <strong>
                        Request created
                      </strong>

                      <p>
                        Submitted by{" "}
                        {getPersonName(
                          selectedApproval.submitted_by,
                          team,
                        )}
                      </p>

                      <span>
                        {formatDateTime(
                          selectedApproval.created_at,
                        )}
                      </span>
                    </div>
                  </article>

                  <article>
                    <i />

                    <div>
                      <strong>
                        Review owner
                        assigned
                      </strong>

                      <p>
                        {getPersonName(
                          selectedApproval.assigned_to,
                          team,
                        )}
                      </p>

                      <span>
                        {formatDateTime(
                          selectedApproval.updated_at,
                        )}
                      </span>
                    </div>
                  </article>

                  <article>
                    <i />

                    <div>
                      <strong>
                        {selectedApproval.reviewed_at
                          ? getStatusMeta(
                              selectedApproval.status,
                            ).label
                          : "Decision pending"}
                      </strong>

                      <p>
                        {selectedApproval.reviewed_at
                          ? `Reviewed by ${getPersonName(
                              selectedApproval.reviewed_by,
                              team,
                            )}`
                          : "No final decision has been recorded."}
                      </p>

                      <span>
                        {selectedApproval.reviewed_at
                          ? formatDateTime(
                              selectedApproval.reviewed_at,
                            )
                          : "Awaiting review"}
                      </span>
                    </div>
                  </article>
                </section>
              )}

              {drawerTab ===
                "connections" && (
                <section
                  className={
                    styles.connections
                  }
                >
                  <header>
                    <strong>
                      Related campaign
                      work
                    </strong>

                    <p>
                      Open the workspaces
                      commonly used to
                      review source files,
                      deadlines and blocked
                      follow-up.
                    </p>
                  </header>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    <FolderKanban
                      size={20}
                    />

                    <span>
                      <strong>
                        Documents
                      </strong>

                      <small>
                        Review source
                        materials and final
                        files
                      </small>
                    </span>

                    <ArrowUpRight
                      size={18}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/waiting-on",
                      )
                    }
                  >
                    <CalendarClock
                      size={20}
                    />

                    <span>
                      <strong>
                        Waiting On
                      </strong>

                      <small>
                        Check blocked
                        responses and
                        dependencies
                      </small>
                    </span>

                    <ArrowUpRight
                      size={18}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/tasks")
                    }
                  >
                    <FileCheck2
                      size={20}
                    />

                    <span>
                      <strong>
                        Tasks
                      </strong>

                      <small>
                        Open campaign
                        execution work
                      </small>
                    </span>

                    <ArrowUpRight
                      size={18}
                    />
                  </button>
                </section>
              )}
            </div>

            {leadershipAccess && (
              <footer
                className={
                  styles.drawerFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    handleDelete
                  }
                  disabled={isSaving}
                >
                  <Trash2
                    size={16}
                  />
                  Delete approval
                </button>

                <span>
                  Decision history is
                  preserved until this
                  request is deleted.
                </span>
              </footer>
            )}
          </aside>
        </>
      )}

      {editorOpen && (
        <div
          className={
            styles.modalLayer
          }
          role="presentation"
        >
          <button
            className={
              styles.modalOverlay
            }
            type="button"
            aria-label="Close approval editor"
            onClick={
              closeEditor
            }
          />

          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-editor-title"
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div>
                <span>
                  Approval request
                </span>

                <h2
                  id="approval-editor-title"
                >
                  {form.id
                    ? "Edit approval"
                    : "Create approval"}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeEditor
                }
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={
                styles.approvalForm
              }
              onSubmit={
                handleSave
              }
            >
              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Approval title
                </span>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={
                    handleFormChange
                  }
                  placeholder="What needs review?"
                  autoFocus
                />
              </label>

              <label>
                <span>Type</span>

                <select
                  name="approvalType"
                  value={
                    form.approvalType
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  {TYPE_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Status</span>

                <select
                  name="status"
                  value={form.status}
                  onChange={
                    handleFormChange
                  }
                >
                  <option value="pending">
                    Pending review
                  </option>
                  <option value="draft">
                    Draft
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Assigned reviewer
                </span>

                <select
                  name="assignedTo"
                  value={
                    form.assignedTo
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {team.map(
                    (member) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {
                          member.fullName
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Due date</span>

                <input
                  type="datetime-local"
                  name="dueAt"
                  value={form.dueAt}
                  onChange={
                    handleFormChange
                  }
                />
              </label>

              <label
                className={
                  styles.fullField
                }
              >
                <span>
                  Review brief
                </span>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Describe what needs to be reviewed and the decision criteria."
                  rows={7}
                />
              </label>

              {actionError && (
                <p
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={16}
                  />
                  {actionError}
                </p>
              )}

              <footer
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    closeEditor
                  }
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving…"
                    : form.id
                      ? "Save changes"
                      : "Create approval"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {reviewOpen && (
        <div
          className={
            styles.modalLayer
          }
          role="presentation"
        >
          <button
            className={
              styles.modalOverlay
            }
            type="button"
            aria-label="Close review decision"
            onClick={
              closeReview
            }
          />

          <section
            className={`${styles.modal} ${styles.reviewModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-review-title"
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div>
                <span>
                  Review decision
                </span>

                <h2
                  id="approval-review-title"
                >
                  {selectedApproval?.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeReview
                }
              >
                <X size={20} />
              </button>
            </header>

            <form
              className={
                styles.reviewForm
              }
              onSubmit={
                handleReview
              }
            >
              <div
                className={
                  styles.decisionOptions
                }
              >
                <button
                  className={
                    review.action ===
                    "approved"
                      ? styles.selectedDecision
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setReview(
                      (current) => ({
                        ...current,
                        action:
                          "approved",
                      }),
                    )
                  }
                >
                  <CheckCircle2
                    size={20}
                  />
                  Approve
                </button>

                <button
                  className={
                    review.action ===
                    "changes_requested"
                      ? styles.selectedDecision
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setReview(
                      (current) => ({
                        ...current,
                        action:
                          "changes_requested",
                      }),
                    )
                  }
                >
                  <FilePenLine
                    size={20}
                  />
                  Request changes
                </button>

                <button
                  className={
                    review.action ===
                    "rejected"
                      ? styles.selectedDecision
                      : ""
                  }
                  type="button"
                  onClick={() =>
                    setReview(
                      (current) => ({
                        ...current,
                        action:
                          "rejected",
                      }),
                    )
                  }
                >
                  <XCircle
                    size={20}
                  />
                  Reject
                </button>
              </div>

              <label>
                <span>
                  Decision notes
                </span>

                <textarea
                  value={review.notes}
                  onChange={(event) =>
                    setReview(
                      (current) => ({
                        ...current,
                        notes:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Record the decision, required changes, or final approval notes."
                  rows={7}
                  required={[
                    "changes_requested",
                    "rejected",
                  ].includes(
                    review.action,
                  )}
                />
              </label>

              {actionError && (
                <p
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  <AlertTriangle
                    size={16}
                  />
                  {actionError}
                </p>
              )}

              <footer
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    closeReview
                  }
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving decision…"
                    : "Save decision"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
