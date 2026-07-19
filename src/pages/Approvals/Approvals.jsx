import {
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  FileCheck2,
  FilePenLine,
  Filter,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

import {
  CampaignSidebar,
} from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import {
  useApprovalsCommandCenter,
} from "../../hooks/useApprovalsCommandCenter";

import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./Approvals.module.css";

const APPROVAL_TYPES = [
  {
    value: "general",
    label: "General",
  },
  {
    value: "communications",
    label: "Communications",
  },
  {
    value: "event",
    label: "Event",
  },
  {
    value: "design",
    label: "Design",
  },
  {
    value: "finance",
    label: "Finance",
  },
  {
    value: "volunteer",
    label: "Volunteer",
  },
  {
    value: "compliance",
    label: "Compliance",
  },
];

const STATUS_OPTIONS = [
  {
    value: "pending",
    label: "Pending review",
  },
  {
    value: "draft",
    label: "Draft",
  },
];

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  approvalType:
    "general",
  status: "pending",
  dueAt: "",
  assignedTo: "",
};

const EMPTY_REVIEW = {
  approvalId: "",
  title: "",
  action: "approved",
  reviewNotes: "",
};

function formatUpdatedTime(
  value,
) {
  if (!value) {
    return "Waiting for sync";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(value);
}

function formatDateTime(value) {
  if (!value) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function toLocalInputValue(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  const offset =
    date.getTimezoneOffset() *
    60000;

  return new Date(
    date.getTime() - offset,
  )
    .toISOString()
    .slice(0, 16);
}

function toIsoValue(value) {
  if (!value) {
    return null;
  }

  return new Date(
    value,
  ).toISOString();
}

function getTypeLabel(value) {
  return (
    APPROVAL_TYPES.find(
      (item) =>
        item.value === value,
    )?.label ||
    "General"
  );
}

function getStatusLabel(value) {
  const labels = {
    draft: "Draft",
    pending:
      "Pending review",
    approved: "Approved",
    changes_requested:
      "Changes requested",
    rejected: "Rejected",
  };

  return (
    labels[value] ||
    "Pending review"
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

function isOverdue(
  approval,
  referenceMs,
) {
  return Boolean(
    approval.due_at &&
      referenceMs &&
      [
        "draft",
        "pending",
        "changes_requested",
      ].includes(
        approval.status,
      ) &&
      new Date(
        approval.due_at,
      ).getTime() <
        referenceMs,
  );
}

export default function Approvals() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const roleLabel =
    getRoleLabel();

  const leadershipAccess =
    /candidate|consultant|manager|owner/i.test(
      roleLabel,
    );

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("open");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("all");

  const [
    assigneeFilter,
    setAssigneeFilter,
  ] = useState("all");

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    reviewOpen,
    setReviewOpen,
  ] = useState(false);

  const [
    review,
    setReview,
  ] = useState(
    EMPTY_REVIEW,
  );

  const [
    reviewError,
    setReviewError,
  ] = useState("");

  const {
    approvals,
    team,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    saveApproval,
    reviewApproval,
    deleteApproval,
  } =
    useApprovalsCommandCenter({
      workspaceId:
        workspace.id,
      userId:
        user.id,
    });

  const referenceMs =
    lastUpdated?.getTime() ||
    0;

  const openApprovals =
    approvals.filter(
      (approval) =>
        [
          "draft",
          "pending",
          "changes_requested",
        ].includes(
          approval.status,
        ),
    );

  const pendingCount =
    approvals.filter(
      (approval) =>
        approval.status ===
        "pending",
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

  const assignedToMeCount =
    openApprovals.filter(
      (approval) =>
        approval.assigned_to ===
        user.id,
    ).length;

  const filteredApprovals =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return approvals.filter(
        (approval) => {
          const matchesSearch =
            !normalizedSearch ||
            [
              approval.title,
              approval.description,
              approval.review_notes,
              getTypeLabel(
                approval.approval_type,
              ),
              getPersonName(
                approval.assigned_to,
                team,
              ),
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            (statusFilter ===
              "open"
              ? [
                  "draft",
                  "pending",
                  "changes_requested",
                ].includes(
                  approval.status,
                )
              : approval.status ===
                statusFilter);

          const matchesType =
            typeFilter ===
              "all" ||
            approval.approval_type ===
              typeFilter;

          const matchesAssignee =
            assigneeFilter ===
              "all" ||
            (assigneeFilter ===
              "mine"
              ? approval.assigned_to ===
                user.id
              : assigneeFilter ===
                  "unassigned"
                ? !approval.assigned_to
                : approval.assigned_to ===
                  assigneeFilter);

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType &&
            matchesAssignee
          );
        },
      );
    }, [
      approvals,
      assigneeFilter,
      search,
      statusFilter,
      team,
      typeFilter,
      user.id,
    ]);

  const canReview =
    (approval) =>
      leadershipAccess ||
      approval.assigned_to ===
        user.id;

  const openCreateForm =
    () => {
      setForm(
        EMPTY_FORM,
      );
      setFormError("");
      setFormOpen(true);
    };

  const openEditForm =
    (approval) => {
      setForm({
        id:
          approval.id,
        title:
          approval.title ||
          "",
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

      setFormError("");
      setFormOpen(true);
    };

  const closeForm =
    () => {
      if (isSaving) {
        return;
      }

      setFormOpen(false);
      setFormError("");
    };

  const updateForm =
    (field, value) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      );
    };

  const handleSave =
    async (event) => {
      event.preventDefault();
      setFormError("");

      try {
        await saveApproval({
          ...form,
          dueAt:
            toIsoValue(
              form.dueAt,
            ),
        });

        setFormOpen(false);
        setForm(
          EMPTY_FORM,
        );
      } catch (saveError) {
        setFormError(
          saveError?.message ||
            "The approval could not be saved.",
        );
      }
    };

  const openReviewForm =
    (
      approval,
      action = "approved",
    ) => {
      setReview({
        approvalId:
          approval.id,
        title:
          approval.title,
        action,
        reviewNotes:
          approval.review_notes ||
          "",
      });

      setReviewError("");
      setReviewOpen(true);
    };

  const closeReview =
    () => {
      if (isSaving) {
        return;
      }

      setReviewOpen(false);
      setReviewError("");
    };

  const handleReview =
    async (event) => {
      event.preventDefault();
      setReviewError("");

      try {
        await reviewApproval({
          approvalId:
            review.approvalId,
          status:
            review.action,
          reviewNotes:
            review.reviewNotes,
        });

        setReviewOpen(false);
        setReview(
          EMPTY_REVIEW,
        );
      } catch (saveError) {
        setReviewError(
          saveError?.message ||
            "The review decision could not be saved.",
        );
      }
    };

  const handleDelete =
    async (approval) => {
      const confirmed =
        window.confirm(
          `Delete "${approval.title}"? This cannot be undone.`,
        );

      if (!confirmed) {
        return;
      }

      try {
        await deleteApproval(
          approval.id,
        );
      } catch {
        // The hook shows the
        // detailed error.
      }
    };

  return (
    <div
      className={
        styles.app
      }
    >
      <CampaignSidebar
        activePage="Approvals"
        sidebarOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(false)
        }
        styles={
          shellStyles
        }
        accessDescription="Submit campaign materials for review, request changes and record final decisions."
        showLeadership={
          leadershipAccess
        }
      />

      <div
        className={
          styles.workspace
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.topbarLeft
            }
          >
            <button
              className={
                styles.menuButton
              }
              type="button"
              onClick={() =>
                setSidebarOpen(
                  true,
                )
              }
              aria-label="Open navigation"
            >
              <Menu
                size={21}
              />
            </button>

            <div>
              <span
                className={
                  styles.breadcrumb
                }
              >
                Campaign HQ
                <ChevronRight
                  size={13}
                />
                Approvals
              </span>

              <strong>
                Review and sign-off center
              </strong>
            </div>
          </div>

          <div
            className={
              styles.topbarActions
            }
          >
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            <div
              className={
                styles.syncStatus
              }
            >
              <span />

              {isLoading
                ? "Synchronizing approvals"
                : lastUpdated
                  ? `Updated ${formatUpdatedTime(
                      lastUpdated,
                    )}`
                  : "Waiting for sync"}
            </div>

          </div>
        </header>

        <main
          className={
            styles.main
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Campaign review
              </span>

              <h1>
                Approvals
              </h1>

              <p>
                Keep campaign materials
                moving through review,
                requested changes and
                final sign-off with a
                clear decision record.
              </p>
            </div>

            {leadershipAccess && (
              <button
                className={
                  styles.createButton
                }
                type="button"
                onClick={
                  openCreateForm
                }
              >
                <Plus
                  size={18}
                />
                New approval
              </button>
            )}
          </section>

          <section
            className={
              styles.workflowNotice
            }
          >
            <ShieldCheck
              size={22}
            />

            <div>
              <strong>
                Review workflow
              </strong>

              <p>
                Campaign leadership can
                create requests. Assigned
                reviewers and leadership
                can approve, reject or
                request changes.
              </p>
            </div>
          </section>

          {error && (
            <section
              className={
                styles.errorBanner
              }
              role="alert"
            >
              <AlertCircle
                size={20}
              />

              <div>
                <strong>
                  Approvals need
                  attention
                </strong>

                <p>
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  refresh
                }
              >
                Retry
              </button>
            </section>
          )}

          <section
            className={
              styles.summaryGrid
            }
            aria-label="Approvals summary"
          >
            <article>
              <div>
                <Clock3
                  size={21}
                />
              </div>

              <span>
                Pending review
              </span>

              <strong>
                {isLoading
                  ? "—"
                  : pendingCount}
              </strong>

              <p>
                Awaiting a decision
              </p>
            </article>

            <article>
              <div>
                <FilePenLine
                  size={21}
                />
              </div>

              <span>
                Changes requested
              </span>

              <strong>
                {isLoading
                  ? "—"
                  : changesCount}
              </strong>

              <p>
                Needs revision
              </p>
            </article>

            <article>
              <div>
                <CheckCircle2
                  size={21}
                />
              </div>

              <span>
                Approved
              </span>

              <strong>
                {isLoading
                  ? "—"
                  : approvedCount}
              </strong>

              <p>
                Final decisions recorded
              </p>
            </article>

            <article>
              <div>
                <UserCheck
                  size={21}
                />
              </div>

              <span>
                Assigned to me
              </span>

              <strong>
                {isLoading
                  ? "—"
                  : assignedToMeCount}
              </strong>

              <p>
                Your open reviews
              </p>
            </article>
          </section>

          <section
            className={
              styles.queuePanel
            }
          >
            <header
              className={
                styles.queueHeader
              }
            >
              <div>
                <span>
                  Review queue
                </span>

                <h2>
                  Campaign approvals
                </h2>
              </div>

              <button
                className={
                  styles.refreshButton
                }
                type="button"
                disabled={
                  isLoading
                }
                onClick={
                  refresh
                }
                title="Refresh approvals"
              >
                <RefreshCw
                  size={17}
                  className={
                    isLoading
                      ? styles.spinning
                      : ""
                  }
                />
              </button>
            </header>

            <div
              className={
                styles.controls
              }
            >
              <label
                className={
                  styles.searchWrap
                }
              >
                <Search
                  size={18}
                />

                <input
                  type="search"
                  value={
                    search
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search approvals, notes or reviewers"
                />
              </label>

              <label
                className={
                  styles.selectWrap
                }
              >
                <Filter
                  size={16}
                />

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event.target
                        .value,
                    )
                  }
                  aria-label="Filter by status"
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

              <select
                value={
                  typeFilter
                }
                onChange={(
                  event,
                ) =>
                  setTypeFilter(
                    event.target
                      .value,
                  )
                }
                aria-label="Filter by approval type"
              >
                <option value="all">
                  All types
                </option>

                {APPROVAL_TYPES.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </option>
                  ),
                )}
              </select>

              <select
                value={
                  assigneeFilter
                }
                onChange={(
                  event,
                ) =>
                  setAssigneeFilter(
                    event.target
                      .value,
                  )
                }
                aria-label="Filter by reviewer"
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
                      {member.fullName}
                    </option>
                  ),
                )}
              </select>

              <span
                className={
                  styles.resultCount
                }
              >
                {filteredApprovals.length}
                {" "}
                {filteredApprovals.length ===
                1
                  ? "approval"
                  : "approvals"}
              </span>
            </div>

            {isLoading && (
              <div
                className={
                  styles.loadingState
                }
              >
                <RefreshCw
                  size={24}
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
              filteredApprovals.length >
                0 && (
                <div
                  className={
                    styles.approvalGrid
                  }
                >
                  {filteredApprovals.map(
                    (approval) => {
                      const overdue =
                        isOverdue(
                          approval,
                          referenceMs,
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

                      return (
                        <article
                          className={`${styles.approvalCard} ${
                            overdue
                              ? styles.overdueCard
                              : ""
                          }`}
                          key={
                            approval.id
                          }
                        >
                          <header>
                            <div
                              className={
                                styles.typeIcon
                              }
                            >
                              <FileCheck2
                                size={
                                  21
                                }
                              />
                            </div>

                            <div
                              className={
                                styles.cardTitle
                              }
                            >
                              <div>
                                <span
                                  className={
                                    styles.typeBadge
                                  }
                                >
                                  {getTypeLabel(
                                    approval.approval_type,
                                  )}
                                </span>

                                <span
                                  className={`${styles.statusBadge} ${
                                    styles[
                                      `status_${approval.status}`
                                    ] || ""
                                  }`}
                                >
                                  {getStatusLabel(
                                    approval.status,
                                  )}
                                </span>
                              </div>

                              <h3>
                                {
                                  approval.title
                                }
                              </h3>
                            </div>
                          </header>

                          <p
                            className={
                              styles.description
                            }
                          >
                            {approval.description ||
                              "No description was provided."}
                          </p>

                          <div
                            className={
                              styles.detailGrid
                            }
                          >
                            <div>
                              <span>
                                Reviewer
                              </span>
                              <strong>
                                {
                                  reviewer
                                }
                              </strong>
                            </div>

                            <div>
                              <span>
                                Submitted by
                              </span>
                              <strong>
                                {
                                  submitter
                                }
                              </strong>
                            </div>
                          </div>

                          <div
                            className={`${styles.deadlineRow} ${
                              overdue
                                ? styles.overdueText
                                : ""
                            }`}
                          >
                            <CalendarClock
                              size={16}
                            />

                            <span>
                              {overdue
                                ? `Overdue · ${formatDateTime(
                                    approval.due_at,
                                  )}`
                                : formatDateTime(
                                    approval.due_at,
                                  )}
                            </span>
                          </div>

                          {approval.review_notes && (
                            <div
                              className={
                                styles.reviewNotes
                              }
                            >
                              <span>
                                Review notes
                              </span>

                              <p>
                                {
                                  approval.review_notes
                                }
                              </p>
                            </div>
                          )}

                          <footer>
                            {canReview(
                              approval,
                            ) &&
                              [
                                "draft",
                                "pending",
                                "changes_requested",
                              ].includes(
                                approval.status,
                              ) && (
                                <>
                                  <button
                                    className={
                                      styles.approveButton
                                    }
                                    type="button"
                                    onClick={() =>
                                      openReviewForm(
                                        approval,
                                        "approved",
                                      )
                                    }
                                  >
                                    <CheckCircle2
                                      size={
                                        16
                                      }
                                    />
                                    Approve
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openReviewForm(
                                        approval,
                                        "changes_requested",
                                      )
                                    }
                                  >
                                    <FilePenLine
                                      size={
                                        16
                                      }
                                    />
                                    Changes
                                  </button>
                                </>
                              )}

                            {leadershipAccess && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditForm(
                                      approval,
                                    )
                                  }
                                  title="Edit approval"
                                >
                                  <Pencil
                                    size={
                                      16
                                    }
                                  />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      approval,
                                    )
                                  }
                                  title="Delete approval"
                                >
                                  <Trash2
                                    size={
                                      16
                                    }
                                  />
                                </button>
                              </>
                            )}
                          </footer>
                        </article>
                      );
                    },
                  )}
                </div>
              )}

            {!isLoading &&
              filteredApprovals.length ===
                0 && (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <div>
                    <CircleDashed
                      size={29}
                    />
                  </div>

                  <h3>
                    {approvals.length
                      ? "No matching approvals"
                      : "No campaign approvals yet"}
                  </h3>

                  <p>
                    {approvals.length
                      ? "Adjust the search or filters."
                      : leadershipAccess
                        ? "Create the first campaign review request."
                        : "There are no review requests assigned to this workspace."}
                  </p>

                  {leadershipAccess &&
                    !approvals.length && (
                      <button
                        type="button"
                        onClick={
                          openCreateForm
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
          </section>

          <footer
            className={
              styles.footer
            }
          >
            <span>
              Campaign HQ Approvals
            </span>

            <span>
              Review and decision
              history
            </span>
          </footer>
        </main>
      </div>

      {formOpen && (
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
            onClick={
              closeForm
            }
            aria-label="Close approval editor"
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
                  closeForm
                }
                aria-label="Close editor"
              >
                <X
                  size={20}
                />
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
                  value={
                    form.title
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "title",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Example: Final event invitation"
                  required
                />
              </label>

              <label>
                <span>
                  Type
                </span>

                <select
                  value={
                    form.approvalType
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "approvalType",
                      event.target
                        .value,
                    )
                  }
                >
                  {APPROVAL_TYPES.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  value={
                    form.status
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "status",
                      event.target
                        .value,
                    )
                  }
                >
                  {STATUS_OPTIONS.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Assigned reviewer
                </span>

                <select
                  value={
                    form.assignedTo
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "assignedTo",
                      event.target
                        .value,
                    )
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
                        {member.fullName}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Deadline
                </span>

                <input
                  type="datetime-local"
                  value={
                    form.dueAt
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "dueAt",
                      event.target
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
                  Description
                </span>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "description",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Describe what needs to be reviewed and any decision criteria."
                  rows={7}
                />
              </label>

              {formError && (
                <div
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    closeForm
                  }
                  disabled={
                    isSaving
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={
                    isSaving
                  }
                >
                  {isSaving
                    ? "Saving…"
                    : form.id
                      ? "Save changes"
                      : "Create approval"}
                </button>
              </div>
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
            onClick={
              closeReview
            }
            aria-label="Close review decision"
          />

          <section
            className={`${styles.modal} ${styles.reviewModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-decision-title"
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
                  id="review-decision-title"
                >
                  {review.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeReview
                }
                aria-label="Close review"
              >
                <X
                  size={20}
                />
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
                    size={19}
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
                    size={19}
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
                    size={19}
                  />
                  Reject
                </button>
              </div>

              <label>
                <span>
                  Review notes
                </span>

                <textarea
                  value={
                    review.reviewNotes
                  }
                  onChange={(
                    event,
                  ) =>
                    setReview(
                      (current) => ({
                        ...current,
                        reviewNotes:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Record the decision, required changes or final approval notes."
                  rows={7}
                  required={[
                    "changes_requested",
                    "rejected",
                  ].includes(
                    review.action,
                  )}
                />
              </label>

              {reviewError && (
                <div
                  className={
                    styles.formError
                  }
                  role="alert"
                >
                  {reviewError}
                </div>
              )}

              <div
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    closeReview
                  }
                  disabled={
                    isSaving
                  }
                >
                  Cancel
                </button>

                <button
                  className={
                    styles.saveButton
                  }
                  type="submit"
                  disabled={
                    isSaving
                  }
                >
                  {isSaving
                    ? "Saving decision…"
                    : "Save decision"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
