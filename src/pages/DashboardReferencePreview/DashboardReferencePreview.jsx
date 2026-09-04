import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Clock3,
  FileCheck2,
  FileText,
  Files,
  Flag,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  PackageOpen,
  Plus,
  PhoneCall,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";

import {
  getCampaignExperience,
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import { useCampaignDashboard } from "../../hooks/useCampaignDashboard";
import { useFilesCommandCenter } from "../../hooks/useFilesCommandCenter";
import { useContactsCommandCenter } from "../../hooks/useContactsCommandCenter";
import { useInternalInboxThreads } from "../../hooks/useInternalInboxThreads";
import { useRealInboxMailbox } from "../../hooks/useRealInboxMailbox";

import {
  ACTIVE_SEAT_PRODUCT,
  getSeatCoreModules,
  getSeatPlatformModules,
  getSeatProductModules,
} from "../../config/seatPlatform";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";

import {
  CampaignConditions,
} from "../../components/CampaignConditions/CampaignConditions";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";
import {
  useCandidateProfileManagement,
} from "../../hooks/useCandidateProfileManagement";

import {
  getDaysUntilElection,
} from "../../utils/electionCountdown";
import { supabase } from "../../lib/supabase";
import styles from "./DashboardReferencePreview.module.css";

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  calendar: CalendarDays,
  tasks: CheckCircle2,
  commitments: Target,
  waiting_on: Clock3,
  contacts: Users,
  documents: Files,
  approvals: FileCheck2,
  team: UserCog,
  inventory: PackageOpen,

  candidate: Vote,
  volunteers: Users,
  fundraising: CircleDollarSign,
  events: CalendarDays,
  social_media: MessageSquare,
  media_center: FolderKanban,
  reports_analytics: BarChart3,

  integrations: Link2,
  plan_usage: CreditCard,
  settings: Settings,
  support: LifeBuoy,
};

const MODULE_COUNT_KEYS = {
  tasks: "tasks",
  waiting_on: "waiting",
  approvals: "approvals",
};

function createSeatNavigation(
  modules,
) {
  return modules.map(
    (module) => ({
      ...module,

      icon:
        MODULE_ICONS[
          module.key
        ] ||
        LayoutDashboard,

      countKey:
        MODULE_COUNT_KEYS[
          module.key
        ] ||
        "",
    }),
  );
}

const PRIMARY_NAVIGATION =
  createSeatNavigation(
    getSeatCoreModules(),
  );

const CAMPAIGN_TOOLS =
  createSeatNavigation(
    getSeatProductModules(
      ACTIVE_SEAT_PRODUCT,
    ),
  );

const PLATFORM_TOOLS =
  createSeatNavigation(
    getSeatPlatformModules()
      .filter(
        (module) =>
          [
            "integrations",
            "plan_usage",
            "settings",
            "support",
          ].includes(
            module.key,
          ),
      ),
  );

// DASHBOARD HQ SHORTCUT OPTIONS — START
const HQ_SHORTCUT_LIMIT = 6;

const SPOTLIGHT_SHORTCUT_OPTIONS = [
  {
    key: "messages",
    label: "Messages for you",
    icon: Mail,
    kind: "operational",
  },
  {
    key: "decisions",
    label: "Decisions for you",
    icon: FileCheck2,
    kind: "operational",
  },
  {
    key: "contacts",
    label: "People to contact",
    icon: PhoneCall,
    kind: "operational",
  },
  {
    key: "commitments",
    label: "Commitments & follow-ups",
    icon: Target,
    kind: "operational",
  },
  {
    key: "team-brief",
    label: "Team brief",
    icon: Zap,
    kind: "operational",
  },
  {
    key: "risk",
    label: "Risk & compliance",
    icon: ShieldCheck,
    kind: "operational",
  },

  {
    key: "tasks",
    label: "Tasks",
    icon: CheckCircle2,
    kind: "module",
    route: "/tasks",
    description: "Open tasks, deadlines and campaign priorities.",
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    kind: "module",
    route: "/calendar",
    description: "Upcoming campaign events and schedule.",
  },
  {
    key: "volunteers",
    label: "Volunteers",
    icon: Users,
    kind: "module",
    route: "/volunteers",
    description: "Volunteer activity and field coordination.",
  },
  {
    key: "fundraising",
    label: "Fundraising",
    icon: CircleDollarSign,
    kind: "module",
    route: "/fundraising",
    description: "Fundraising workspace and finance activity.",
  },
  {
    key: "contact-directory",
    label: "Contacts",
    icon: Users,
    kind: "module",
    route: "/contacts",
    description: "Campaign contacts, supporters and relationships.",
  },
  {
    key: "documents",
    label: "Documents",
    icon: Files,
    kind: "module",
    route: "/files",
    description: "Files, documents and shared campaign materials.",
  },
  {
    key: "approvals",
    label: "Approvals",
    icon: FileCheck2,
    kind: "module",
    route: "/approvals",
    description: "Campaign items awaiting review and approval.",
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: PackageOpen,
    kind: "module",
    route: "/inventory",
    description: "Signs, materials, merchandise and campaign stock.",
  },
  {
    key: "candidate",
    label: "Candidate",
    icon: Vote,
    kind: "module",
    route: "/workspace/candidate-profile",
    description: "Candidate profile, identity and campaign details.",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarDays,
    kind: "module",
    route: "/events",
    description: "Campaign events and event operations.",
  },
  {
    key: "social-media",
    label: "Social media",
    icon: MessageSquare,
    kind: "module",
    route: "/social-media",
    description: "Social content and publishing workspace.",
  },
  {
    key: "media-center",
    label: "Media center",
    icon: FolderKanban,
    kind: "module",
    route: "/media-center",
    description: "Campaign media assets and content library.",
  },
  {
    key: "reports-analytics",
    label: "Reports & analytics",
    icon: BarChart3,
    kind: "module",
    route: "/reports-analytics",
    description: "Campaign reporting and performance analytics.",
  },
  {
    key: "waiting-on",
    label: "Waiting On",
    icon: Clock3,
    kind: "module",
    route: "/waiting-on",
    description: "Work blocked on people, vendors or approvals.",
  },
];

// DASHBOARD HQ SHORTCUT OPTIONS — END

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getEasternDateKey(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      },
    ).formatToParts(
      date,
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function formatTime(value) {
  if (!value) {
    return "No time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateBadge(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      month: "TBD",
      day: "—",
    };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
    })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
    }).format(date),
  };
}

function formatRelative(value) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatStatus(value = "") {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPriorityTone(value = "") {
  const normalized = String(value).toLowerCase();

  if (["urgent", "critical"].includes(normalized)) {
    return "urgent";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "medium") {
    return "medium";
  }

  return "low";
}

export default function DashboardReferencePreview() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);



  // COMMAND HEADER CLOCK — START
  const [headerNow, setHeaderNow] = useState(
    () => new Date(),
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeaderNow(new Date());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const headerDateLabel = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(headerNow);

  const headerTimeLabel = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    },
  ).format(headerNow);
  // COMMAND HEADER CLOCK — END
const [
    isEditingSpotlightShortcuts,
    setIsEditingSpotlightShortcuts,
  ] = useState(false);

  const [
    customSpotlightShortcutKeys,
    setCustomSpotlightShortcutKeys,
  ] = useState([]);

  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const experience = getCampaignExperience();
  const roleLabel = getRoleLabel();

  const normalizedRoleLabel = String(roleLabel || "")
    .trim()
    .toLowerCase();

  const effectiveExperienceKey =
    normalizedRoleLabel.includes("candidate")
      ? "candidate"
      : normalizedRoleLabel.includes("owner")
        ? "owner"
        : normalizedRoleLabel.includes("manager") ||
            normalizedRoleLabel.includes("consultant")
          ? "manager"
          : normalizedRoleLabel.includes("volunteer")
            ? "volunteer"
            : experience.key;

  const {
    data,
    isLoading,
    error,
    lastUpdated,
  } = useCampaignDashboard(workspace.id);

  /*
   * MESSAGES FOR YOU
   *
   * Production always uses the real Campaign Seat Inbox.
   * Local development opts into the real mailbox with
   * ?mailbox-live=enabled so presentation work does not
   * accidentally exercise a connected mailbox.
   */
  const dashboardInboxLiveEnabled =
    !import.meta.env.DEV ||
    (
      typeof window !== "undefined" &&
      new URLSearchParams(
        window.location.search,
      ).get("mailbox-live") ===
        "enabled"
    );

  const {
    conversations:
      dashboardMailboxConversations,
    isLoading:
      dashboardMailboxLoading,
  } = useRealInboxMailbox({
    workspaceId:
      workspace.id,
    enabled:
      dashboardInboxLiveEnabled,
    selectedConversationId:
      "",
  });

  const {
    conversations:
      dashboardInternalConversations,
    isLoading:
      dashboardInternalInboxLoading,
  } = useInternalInboxThreads({
    workspaceId:
      workspace.id,
    userId:
      user.id,
    enabled:
      dashboardInboxLiveEnabled,
  });

  const {
    contacts:
      dashboardCampaignContacts,
    isLoading:
      dashboardContactsLoading,
  } = useContactsCommandCenter({
    workspaceId:
      workspace.id,
    userId:
      user.id,
  });

  const dashboardContactEmailSet =
    useMemo(
      () =>
        new Set(
          dashboardCampaignContacts
            .map(
              (contact) =>
                String(
                  contact.email ||
                    "",
                )
                  .trim()
                  .toLowerCase(),
            )
            .filter(Boolean),
        ),
      [
        dashboardCampaignContacts,
      ],
    );

  const dashboardMessageConversations =
    useMemo(
      () =>
        [
          ...dashboardMailboxConversations,
          ...dashboardInternalConversations,
        ]
          .filter(
            (conversation) =>
              !conversation.archived,
          )
          .sort(
            (
              left,
              right,
            ) =>
              Number(
                right.order || 0,
              ) -
              Number(
                left.order || 0,
              ),
          ),
      [
        dashboardInternalConversations,
        dashboardMailboxConversations,
      ],
    );

  const isLikelyAutomatedInboxConversation =
    (
      conversation,
    ) => {
      const sender =
        String(
          conversation.sender ||
            "",
        )
          .trim()
          .toLowerCase();

      const email =
        String(
          conversation.email ||
            "",
        )
          .trim()
          .toLowerCase();

      const subject =
        String(
          conversation.subject ||
            "",
        )
          .trim()
          .toLowerCase();

      const combined = [
        sender,
        email,
        subject,
      ].join(" ");

      const automatedSignals = [
        "no-reply",
        "noreply",
        "do-not-reply",
        "donotreply",
        "mailer-daemon",
        "postmaster",
        "notifications@",
        "notification@",
        "alerts@",
        "alert@",
        "newsletter",
        "daily digest",
        "weekly digest",
        "email digest",
        "automated message",
        "job alert",
        "job alerts",
        "glassdoor jobs",
        "linkedin jobs",
        "indeed jobs",
      ];

      const promotionalSignals = [
        "learn how to",
        "webinar",
        "register now",
        "register today",
        "market-ready",
        "product update",
        "product updates",
        "release notes",
        "special offer",
        "limited-time",
        "limited time",
        "new features",
        "what's new",
        "whats new",
        "introducing",
        "announcement",
        "download now",
        "whitepaper",
        "case study",
        "free trial",
        "training session",
        "training course",
        "course invitation",
        "developer training",
      ];

      const bulkSenderSignals = [
        "microsoft azure",
        "glassdoor",
        "indeed",
        "linkedin learning",
        "linkedin jobs",
        "mailchimp",
        "substack",
        "constant contact",
      ];

      return (
        automatedSignals.some(
          (signal) =>
            combined.includes(
              signal,
            ),
        ) ||
        promotionalSignals.some(
          (signal) =>
            subject.includes(
              signal,
            ),
        ) ||
        bulkSenderSignals.some(
          (signal) =>
            sender.includes(
              signal,
            ),
        )
      );
    };

  const isTrustedMessageConversation =
    (
      conversation,
    ) => {
      const channel =
        String(
          conversation.channel ||
            "",
        )
          .trim()
          .toLowerCase();

      const email =
        String(
          conversation.email ||
            "",
        )
          .trim()
          .toLowerCase();

      const internalConversation =
        channel ===
          "dashboard" ||
        Boolean(
          conversation
            .internalThreadId,
        );

      const knownCampaignContact =
        Boolean(
          email &&
          dashboardContactEmailSet.has(
            email,
          ),
        );

      return (
        internalConversation ||
        knownCampaignContact
      );
    };

  const isMessageReplyAction =
    (
      conversation,
    ) =>
      Boolean(
        conversation.needsResponse &&
        isTrustedMessageConversation(
          conversation,
        ) &&
        !isLikelyAutomatedInboxConversation(
          conversation,
        ),
      );

  const dashboardActionableConversations =
    useMemo(
      () =>
        dashboardMessageConversations
          .filter(
            (conversation) =>
              conversation.priority ||
              isMessageReplyAction(
                conversation,
              ),
          )
          .sort(
            (
              left,
              right,
            ) => {
              const score = (
                conversation,
              ) =>
                (
                  conversation.priority
                    ? 10
                    : 0
                ) +
                (
                  isMessageReplyAction(
                    conversation,
                  )
                    ? 6
                    : 0
                ) +
                (
                  conversation.unread
                    ? 1
                    : 0
                );

              const difference =
                score(right) -
                score(left);

              if (
                difference !==
                0
              ) {
                return difference;
              }

              return (
                Number(
                  right.order || 0,
                ) -
                Number(
                  left.order || 0,
                )
              );
            },
          ),
      [
        dashboardContactEmailSet,
        dashboardMessageConversations,
      ],
    );

  const messageAttentionCount =
    dashboardActionableConversations.length;

  const messageNeedsResponseCount =
    dashboardMessageConversations.filter(
      (conversation) =>
        isMessageReplyAction(
          conversation,
        ),
    ).length;

  const messagePriorityCount =
    dashboardMessageConversations.filter(
      (conversation) =>
        conversation.priority,
    ).length;

  /*
   * Recent unread remains informational.
   *
   * It does not automatically mean Campaign Seat
   * thinks a reply is required.
   */
  const messageUnreadCount =
    dashboardMessageConversations.reduce(
      (
        total,
        conversation,
      ) =>
        total +
        (
          conversation.unread
            ? 1
            : 0
        ),
      0,
    );

  const messageSummaryLoading =
    dashboardInboxLiveEnabled &&
    (
      dashboardMailboxLoading ||
      dashboardInternalInboxLoading ||
      dashboardContactsLoading
    );

  const messagePrimaryConversation =
    dashboardActionableConversations[
      0
    ] ||
    null;

  const messageChannelLabels = {
    email:
      "Email",
    dashboard:
      "Campaign Seat",
    sms:
      "Text",
    text:
      "Text",
    whatsapp:
      "WhatsApp",
    facebook:
      "Facebook",
    instagram:
      "Instagram",
    x:
      "X",
  };

  const messagePrimaryChannel =
    messagePrimaryConversation
      ? (
          messageChannelLabels[
            String(
              messagePrimaryConversation.channel ||
                "",
            ).toLowerCase()
          ] ||
          "Message"
        )
      : "";

  const messagePrimaryInitials =
    messagePrimaryConversation
      ? (
          messagePrimaryConversation.initials ||
          String(
            messagePrimaryConversation.sender ||
              "",
          )
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              (part) =>
                part[0] ||
                "",
            )
            .join("")
            .toUpperCase() ||
          "CS"
        )
      : "";

  const {
    files:
      dashboardDocumentFiles,
    isLoading:
      dashboardDocumentsLoading,
  } = useFilesCommandCenter({
    workspaceId:
      workspace.id,
    userId:
      user.id,
  });

  const [
    dashboardInventoryItems,
    setDashboardInventoryItems,
  ] = useState([]);

  const [
    dashboardInventoryLoading,
    setDashboardInventoryLoading,
  ] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadDashboardInventory =
      async () => {
        if (!workspace.id) {
          setDashboardInventoryItems([]);
          setDashboardInventoryLoading(false);
          return;
        }

        setDashboardInventoryLoading(true);

        const {
          data,
          error:
            inventoryError,
        } = await supabase
          .from(
            "workspace_inventory_items",
          )
          .select(
            [
              "id",
              "item_name",
              "category",
              "status",
              "quantity_on_hand",
              "quantity_reserved",
              "quantity_available",
              "reorder_point",
              "storage_location",
              "vendor_name",
              "metadata",
            ].join(","),
          )
          .eq(
            "workspace_id",
            workspace.id,
          )
          .order(
            "item_name",
            {
              ascending:
                true,
            },
          );

        if (
          !cancelled
        ) {
          setDashboardInventoryItems(
            inventoryError
              ? []
              : data || [],
          );

          setDashboardInventoryLoading(
            false,
          );
        }
      };

    void loadDashboardInventory();

    return () => {
      cancelled = true;
    };
  }, [
    workspace.id,
  ]);

  const {
    profile:
      dashboardCandidateProfile,

    photoPreviewUrl:
      dashboardCandidatePhotoUrl,

    isLoading:
      dashboardCandidateLoading,
  } = useCandidateProfileManagement({
    workspaceId:
      workspace.id,
    initialWorkspace:
      workspace,
  });

  const firstName = user.name.split(" ")[0] || "there";
  const initials = getUserInitials(user.name);
  const daysUntilElection = useMemo(
    () =>
      getDaysUntilElection(
        workspace.electionDateRaw,
        workspace.timezone ||
          workspace.timeZone,
      ),
    [
      workspace.electionDateRaw,
      workspace.timezone,
      workspace.timeZone,
    ],
  );

  const openTasks = data.tasks.filter((task) =>
    ["open", "in_progress"].includes(task.status),
  );

  const visibleTasks = [
    "owner",
    "manager",
    "candidate",
  ].includes(experience.key)
    ? openTasks
    : openTasks.filter(
        (task) =>
          task.assigned_to === user.id ||
          task.created_by === user.id,
      );

  const priorities = visibleTasks.slice(0, 5);

  const overdueReferenceTime =
    lastUpdated?.getTime() ?? 0;

  const overdueTasks = openTasks.filter(
    (task) =>
      task.due_at &&
      new Date(task.due_at).getTime() <
        overdueReferenceTime,
  );

  const pendingApprovals = data.approvals.filter((approval) =>
    ["draft", "pending", "changes_requested"].includes(
      approval.status,
    ),
  );

  /*
   * DECISIONS FOR YOU
   *
   * Drafts are preparation work, not yet a decision request.
   * The HQ decision queue focuses on submitted approvals and
   * items returned with changes requested.
   */
  const decisionNow =
    headerNow.getTime();

  const decisionTodayKey =
    getEasternDateKey(
      headerNow,
    );

  const decisionDueTimestamp =
    (approval) => {
      if (!approval?.due_at) {
        return null;
      }

      const timestamp =
        new Date(
          approval.due_at,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const isDecisionOverdue =
    (approval) => {
      const timestamp =
        decisionDueTimestamp(
          approval,
        );

      return (
        timestamp !== null &&
        timestamp <
          decisionNow
      );
    };

  const isDecisionDueToday =
    (approval) =>
      Boolean(
        approval?.due_at &&
        !isDecisionOverdue(
          approval,
        ) &&
        getEasternDateKey(
          approval.due_at,
        ) ===
          decisionTodayKey,
      );

  const isDecisionDueSoon =
    (approval) => {
      const timestamp =
        decisionDueTimestamp(
          approval,
        );

      if (
        timestamp === null ||
        timestamp <=
          decisionNow
      ) {
        return false;
      }

      return (
        timestamp -
          decisionNow <=
        48 *
          60 *
          60 *
          1000
      );
    };

  const decisionActionApprovals =
    pendingApprovals
      .filter(
        (approval) =>
          [
            "pending",
            "changes_requested",
          ].includes(
            String(
              approval.status ||
                "",
            ).toLowerCase(),
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            approval,
          ) => {
            if (
              isDecisionOverdue(
                approval,
              )
            ) {
              return 0;
            }

            if (
              approval.status ===
              "changes_requested"
            ) {
              return 1;
            }

            if (
              isDecisionDueToday(
                approval,
              )
            ) {
              return 2;
            }

            if (
              isDecisionDueSoon(
                approval,
              )
            ) {
              return 3;
            }

            return 4;
          };

          const rankDifference =
            rank(left) -
            rank(right);

          if (
            rankDifference !==
            0
          ) {
            return rankDifference;
          }

          const leftDue =
            decisionDueTimestamp(
              left,
            );

          const rightDue =
            decisionDueTimestamp(
              right,
            );

          if (
            leftDue !== null ||
            rightDue !== null
          ) {
            return (
              (
                leftDue ??
                Number.MAX_SAFE_INTEGER
              ) -
              (
                rightDue ??
                Number.MAX_SAFE_INTEGER
              )
            );
          }

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
        },
      );

  const decisionOverdueCount =
    decisionActionApprovals.filter(
      (approval) =>
        isDecisionOverdue(
          approval,
        ),
    ).length;

  const decisionDueTodayCount =
    decisionActionApprovals.filter(
      (approval) =>
        isDecisionDueToday(
          approval,
        ),
    ).length;

  const decisionChangesRequestedCount =
    decisionActionApprovals.filter(
      (approval) =>
        approval.status ===
        "changes_requested",
    ).length;

  const decisionPrimaryApproval =
    decisionActionApprovals[
      0
    ] ||
    null;

  const decisionRemainingCount =
    Math.max(
      0,
      decisionActionApprovals.length -
        1,
    );

  const formatDecisionDue =
    (
      value,
      {
        timeOnly =
          false,
      } = {},
    ) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        timeOnly
          ? {
              timeZone:
                "America/New_York",
              hour:
                "numeric",
              minute:
                "2-digit",
            }
          : {
              timeZone:
                "America/New_York",
              month:
                "short",
              day:
                "numeric",
              hour:
                "numeric",
              minute:
                "2-digit",
            },
      ).format(
        date,
      );
    };

  const decisionPrimaryType =
    decisionPrimaryApproval
      ? formatStatus(
          decisionPrimaryApproval
            .approval_type ||
            "Decision",
        )
      : "";

  const decisionPrimarySummary =
    decisionPrimaryApproval
      ? (
          decisionPrimaryApproval
            .description ||
          decisionPrimaryApproval
            .review_notes ||
          (
            decisionPrimaryApproval
              .status ===
            "changes_requested"
              ? "Changes were requested before this can be approved."
              : "Ready for your review."
          )
        )
      : "";

  const decisionPrimaryTiming =
    decisionPrimaryApproval
      ? (
          isDecisionOverdue(
            decisionPrimaryApproval,
          )
            ? `Overdue${
                decisionPrimaryApproval
                  .due_at
                  ? ` · ${formatDecisionDue(
                      decisionPrimaryApproval
                        .due_at,
                    )}`
                  : ""
              }`
            : isDecisionDueToday(
                  decisionPrimaryApproval,
                )
              ? `Due today${
                  decisionPrimaryApproval
                    .due_at
                    ? ` · ${formatDecisionDue(
                        decisionPrimaryApproval
                          .due_at,
                        {
                          timeOnly:
                            true,
                        },
                      )}`
                    : ""
                }`
              : decisionPrimaryApproval
                    .status ===
                  "changes_requested"
                ? "Changes requested"
                : isDecisionDueSoon(
                      decisionPrimaryApproval,
                    )
                  ? `Due soon${
                      decisionPrimaryApproval
                        .due_at
                        ? ` · ${formatDecisionDue(
                            decisionPrimaryApproval
                              .due_at,
                          )}`
                        : ""
                    }`
                  : decisionPrimaryApproval
                        .due_at
                    ? `Due ${formatDecisionDue(
                        decisionPrimaryApproval
                          .due_at,
                      )}`
                    : "Awaiting review"
        )
      : "";

  const todayScheduleDateKey =
    getEasternDateKey(
      headerNow,
    );

  const todayScheduleEvents =
    (() => {
      const seenScheduleKeys =
        new Set();

      return data.events
        .filter(
          (event) =>
            getEasternDateKey(
              event.starts_at,
            ) ===
            todayScheduleDateKey,
        )
        .filter((event) => {
          const normalizedTitle =
            String(
              event.title || "",
            )
              .trim()
              .replace(/\s+/g, " ")
              .toLowerCase();

          const normalizedLocation =
            String(
              event.location || "",
            )
              .trim()
              .replace(/\s+/g, " ")
              .toLowerCase();

          const rawStart =
            String(
              event.starts_at || "",
            ).trim();

          const normalizedDisplayedTime =
            rawStart
              ? String(
                  formatTime(
                    rawStart,
                  ),
                )
                  .trim()
                  .toLowerCase()
              : "";

          const scheduleKey = [
            normalizedTitle,
            normalizedDisplayedTime,
            normalizedLocation,
          ].join("|");

          if (
            seenScheduleKeys.has(
              scheduleKey,
            )
          ) {
            return false;
          }

          seenScheduleKeys.add(
            scheduleKey,
          );

          return true;
        })
        .slice(0, 6);
    })();

  const displayedScheduleEvents =
    todayScheduleEvents;

  const hasScheduleConflict =
    displayedScheduleEvents.some(
      (event) => event.conflict,
    );

  const lowerEvents = data.events.slice(0, 3);

  const prioritySeverityRank = {
    urgent: 0,
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const displayedPriorities = [
    ...priorities,
  ].sort(
    (left, right) => {
      const leftRank =
        prioritySeverityRank[
          String(
            left.priority || "",
          ).toLowerCase()
        ] ?? 4;

      const rightRank =
        prioritySeverityRank[
          String(
            right.priority || "",
          ).toLowerCase()
        ] ?? 4;

      return (
        leftRank -
        rightRank
      );
    },
  );
  /*
   * PEOPLE TO CONTACT
   *
   * Real Campaign Contacts with next_follow_up_at are the
   * authoritative relationship queue.
   *
   * Contact-related campaign tasks remain a fallback when a
   * workspace has not yet structured all follow-ups in Contacts.
   */

  const relationshipNow =
    headerNow.getTime();

  const relationshipTodayKey =
    getEasternDateKey(
      headerNow,
    );

  const relationshipWeekHorizon =
    relationshipNow +
    (
      7 *
      24 *
      60 *
      60 *
      1000
    );

  const relationshipTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const relationshipIsOverdue =
    (item) => {
      const timestamp =
        relationshipTimestamp(
          item.followUpAt,
        );

      return (
        timestamp !== null &&
        timestamp <
          relationshipNow
      );
    };

  const relationshipIsDueToday =
    (item) =>
      Boolean(
        item.followUpAt &&
        !relationshipIsOverdue(
          item,
        ) &&
        getEasternDateKey(
          item.followUpAt,
        ) ===
          relationshipTodayKey,
      );

  const relationshipIsThisWeek =
    (item) => {
      const timestamp =
        relationshipTimestamp(
          item.followUpAt,
        );

      return (
        timestamp !== null &&
        timestamp >
          relationshipNow &&
        timestamp <=
          relationshipWeekHorizon &&
        !relationshipIsDueToday(
          item,
        )
      );
    };

  const formatRelationshipDate =
    (
      value,
      {
        timeOnly =
          false,
      } = {},
    ) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        timeOnly
          ? {
              timeZone:
                "America/New_York",
              hour:
                "numeric",
              minute:
                "2-digit",
            }
          : {
              timeZone:
                "America/New_York",
              month:
                "short",
              day:
                "numeric",
            },
      ).format(
        date,
      );
    };

  const activeRelationshipContacts =
    dashboardCampaignContacts
      .filter(
        (contact) =>
          String(
            contact.status ||
              "active",
          ).toLowerCase() !==
            "inactive" &&
          contact.next_follow_up_at &&
          (
            !contact.assigned_to ||
            contact.assigned_to ===
              user.id
          ),
      )
      .map(
        (contact) => {
          const channel =
            contact.phone
              ? "Call"
              : contact.email
                ? "Email"
                : "Follow up";

          const contactType =
            formatStatus(
              contact.contact_type ||
                "Contact",
            );

          const organization =
            String(
              contact.organization ||
                "",
            ).trim();

          const lastContact =
            contact.last_contact_at
              ? `Last contact ${formatRelationshipDate(
                  contact.last_contact_at,
                )}`
              : "No recent contact recorded";

          return {
            kind:
              "contact",

            id:
              `relationship-contact-${contact.id}`,

            title:
              contact.full_name ||
              organization ||
              "Campaign contact",

            detail:
              organization
                ? `${organization} · ${lastContact}`
                : lastContact,

            relationshipType:
              contactType,

            channel,

            followUpAt:
              contact.next_follow_up_at,

            priority:
              "normal",

            route:
              "/contacts",
          };
        },
      )
      .filter(
        (item) => {
          const timestamp =
            relationshipTimestamp(
              item.followUpAt,
            );

          return (
            timestamp !== null &&
            (
              timestamp <=
                relationshipWeekHorizon ||
              relationshipIsOverdue(
                item,
              )
            )
          );
        },
      );

  const relationshipContactNames =
    activeRelationshipContacts
      .map(
        (item) =>
          String(
            item.title ||
              "",
          )
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean);

  const relationshipTaskPattern =
    /reporter|donor|community|supporter|leader|call|thank|introduction|follow[\s-]?up|outreach|meeting/i;

  const relationshipTaskFallbacks =
    displayedPriorities
      .filter(
        (task) =>
          relationshipTaskPattern.test(
            [
              task.title,
              task.detail,
              task.description,
            ]
              .filter(Boolean)
              .join(" "),
          ),
      )
      .filter(
        (task) => {
          const haystack =
            [
              task.title,
              task.detail,
              task.description,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return !relationshipContactNames
            .some(
              (name) =>
                name &&
                haystack.includes(
                  name,
                ),
            );
        },
      )
      .map(
        (task) => ({
          kind:
            "task",

          id:
            `relationship-task-${task.id}`,

          title:
            task.title ||
            "Campaign outreach",

          detail:
            task.detail ||
            task.description ||
            "Personal campaign follow-up",

          relationshipType:
            (() => {
              const relationshipText =
                [
                  task.title,
                  task.detail,
                  task.description,
                ]
                  .filter(Boolean)
                  .join(" ");

              if (
                /reporter|press|media/i.test(
                  relationshipText,
                )
              ) {
                return "Press";
              }

              if (
                /donor|fundrais/i.test(
                  relationshipText,
                )
              ) {
                return "Donor";
              }

              if (
                /volunteer/i.test(
                  relationshipText,
                )
              ) {
                return "Volunteer";
              }

              if (
                /community|leader|supporter/i.test(
                  relationshipText,
                )
              ) {
                return "Community";
              }

              return "Follow-up";
            })(),

          channel:
            /email|reporter|media|press/i.test(
              [
                task.title,
                task.detail,
                task.description,
              ]
                .filter(Boolean)
                .join(" "),
            )
              ? "Email"
              : "Call",

          followUpAt:
            task.due_at ||
            null,

          priority:
            String(
              task.priority ||
                "",
            ).toLowerCase(),

          route:
            "/tasks",
        }),
      );

  const relationshipFollowupQueue =
    [
      ...activeRelationshipContacts,
      ...relationshipTaskFallbacks,
    ]
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            item,
          ) => {
            if (
              relationshipIsOverdue(
                item,
              )
            ) {
              return 0;
            }

            if (
              relationshipIsDueToday(
                item,
              )
            ) {
              return 1;
            }

            if (
              [
                "urgent",
                "critical",
                "high",
              ].includes(
                item.priority,
              )
            ) {
              return 2;
            }

            if (
              relationshipIsThisWeek(
                item,
              )
            ) {
              return 3;
            }

            return 4;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          const leftTime =
            relationshipTimestamp(
              left.followUpAt,
            );

          const rightTime =
            relationshipTimestamp(
              right.followUpAt,
            );

          if (
            leftTime !== null ||
            rightTime !== null
          ) {
            return (
              (
                leftTime ??
                Number.MAX_SAFE_INTEGER
              ) -
              (
                rightTime ??
                Number.MAX_SAFE_INTEGER
              )
            );
          }

          return 0;
        },
      );

  const relationshipOverdueCount =
    relationshipFollowupQueue
      .filter(
        (item) =>
          relationshipIsOverdue(
            item,
          ),
      )
      .length;

  const relationshipDueTodayCount =
    relationshipFollowupQueue
      .filter(
        (item) =>
          relationshipIsDueToday(
            item,
          ),
      )
      .length;

  const relationshipThisWeekCount =
    relationshipFollowupQueue
      .filter(
        (item) =>
          relationshipIsThisWeek(
            item,
          ),
      )
      .length;

  const relationshipHighPriorityCount =
    relationshipFollowupQueue
      .filter(
        (item) =>
          [
            "urgent",
            "critical",
            "high",
          ].includes(
            String(
              item.priority ||
                "",
            ).toLowerCase(),
          ),
      )
      .length;

  const relationshipPrimary =
    relationshipFollowupQueue[
      0
    ] ||
    null;

  const relationshipRemainingCount =
    Math.max(
      0,
      relationshipFollowupQueue.length -
        1,
    );

  const relationshipPrimaryTiming =
    relationshipPrimary
      ? (
          relationshipIsOverdue(
            relationshipPrimary,
          )
            ? `Overdue${
                relationshipPrimary.followUpAt
                  ? ` · ${formatRelationshipDate(
                      relationshipPrimary.followUpAt,
                    )}`
                  : ""
              }`
            : relationshipIsDueToday(
                  relationshipPrimary,
                )
              ? `Due today${
                  relationshipPrimary.followUpAt
                    ? ` · ${formatRelationshipDate(
                        relationshipPrimary.followUpAt,
                        {
                          timeOnly:
                            true,
                        },
                      )}`
                    : ""
                }`
              : relationshipIsThisWeek(
                    relationshipPrimary,
                  )
                ? `Due ${formatRelationshipDate(
                    relationshipPrimary.followUpAt,
                  )}`
                : [
                    "urgent",
                    "critical",
                    "high",
                  ].includes(
                    relationshipPrimary.priority,
                  )
                  ? "High-priority outreach"
                  : "Follow-up waiting"
        )
      : "";

  /*
   * COMMITMENTS & FOLLOW-UPS
   *
   * A commitment is not just an open task.
   * It must carry the canonical "commitment" tag used by
   * the Commitments command center.
   */

  const commitmentNow =
    headerNow.getTime();

  const commitmentTagValue =
    (
      tags,
      prefix,
    ) => {
      const normalizedPrefix =
        String(
          prefix ||
            "",
        ).toLowerCase();

      const match =
        (
          Array.isArray(tags)
            ? tags
            : []
        ).find(
          (tag) =>
            String(
              tag ||
                "",
            )
              .toLowerCase()
              .startsWith(
                normalizedPrefix,
              ),
        );

      return match
        ? String(
            match,
          )
            .slice(
              String(
                prefix,
              ).length,
            )
            .trim()
        : "";
    };

  const isDashboardCommitment =
    (task) =>
      (
        Array.isArray(
          task.tags,
        )
          ? task.tags
          : []
      ).some(
        (tag) =>
          String(
            tag ||
              "",
          ).toLowerCase() ===
            "commitment",
      );

  const commitmentTimestamp =
    (record) => {
      if (!record?.due_at) {
        return null;
      }

      const timestamp =
        new Date(
          record.due_at,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const commitmentIsOverdue =
    (record) => {
      const timestamp =
        commitmentTimestamp(
          record,
        );

      return (
        timestamp !== null &&
        timestamp <
          commitmentNow
      );
    };

  const commitmentIsDueSoon =
    (record) => {
      const timestamp =
        commitmentTimestamp(
          record,
        );

      return (
        timestamp !== null &&
        timestamp >=
          commitmentNow &&
        timestamp <=
          commitmentNow +
            (
              7 *
              24 *
              60 *
              60 *
              1000
            )
      );
    };

  const commitmentIsAtRisk =
    (record) => {
      if (
        commitmentIsOverdue(
          record,
        )
      ) {
        return false;
      }

      const priority =
        String(
          record.priority ||
            "",
        ).toLowerCase();

      if (
        [
          "urgent",
          "critical",
        ].includes(
          priority,
        )
      ) {
        return true;
      }

      const timestamp =
        commitmentTimestamp(
          record,
        );

      return (
        priority ===
          "high" &&
        timestamp !== null &&
        timestamp <=
          commitmentNow +
            (
              48 *
              60 *
              60 *
              1000
            )
      );
    };

  const formatCommitmentDate =
    (value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        },
      ).format(
        date,
      );
    };

  const commitmentQueue =
    data.tasks
      .filter(
        (task) =>
          isDashboardCommitment(
            task,
          ) &&
          ![
            "completed",
            "archived",
          ].includes(
            String(
              task.status ||
                "",
            ).toLowerCase(),
          ),
      )
      .map(
        (task) => ({
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
            "Campaign commitment",
        }),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            record,
          ) => {
            if (
              commitmentIsOverdue(
                record,
              )
            ) {
              return 0;
            }

            if (
              commitmentIsAtRisk(
                record,
              )
            ) {
              return 1;
            }

            if (
              commitmentIsDueSoon(
                record,
              )
            ) {
              return 2;
            }

            if (
              record.status ===
                "in_progress"
            ) {
              return 3;
            }

            return 4;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          return (
            (
              commitmentTimestamp(
                left,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              commitmentTimestamp(
                right,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const commitmentOverdueCount =
    commitmentQueue.filter(
      (record) =>
        commitmentIsOverdue(
          record,
        ),
    ).length;

  const commitmentAtRiskCount =
    commitmentQueue.filter(
      (record) =>
        commitmentIsAtRisk(
          record,
        ),
    ).length;

  const commitmentDueSoonCount =
    commitmentQueue.filter(
      (record) =>
        commitmentIsDueSoon(
          record,
        ),
    ).length;

  const commitmentPrimary =
    commitmentQueue[
      0
    ] ||
    null;

  const commitmentRemainingCount =
    Math.max(
      0,
      commitmentQueue.length -
        1,
    );

  const commitmentPrimaryHealth =
    commitmentPrimary
      ? (
          commitmentIsOverdue(
            commitmentPrimary,
          )
            ? "Overdue"
            : commitmentIsAtRisk(
                  commitmentPrimary,
                )
              ? "At risk"
              : commitmentIsDueSoon(
                    commitmentPrimary,
                  )
                ? "Due soon"
                : commitmentPrimary
                      .status ===
                    "in_progress"
                  ? "In progress"
                  : "On track"
        )
      : "";

  const commitmentPrimaryTiming =
    commitmentPrimary
      ? (
          commitmentPrimary
            .due_at
            ? `${commitmentPrimaryHealth} · ${formatCommitmentDate(
                commitmentPrimary
                  .due_at,
              )}`
            : commitmentPrimaryHealth
        )
      : "";

  const recentActivity = data.activity.slice(0, 4);

  /*
   * TEAM BRIEF
   *
   * This is an executive briefing, not a raw activity log.
   * It summarizes meaningful changes from the last 24 hours
   * and intentionally removes obvious testing/noise.
   */

  const teamBriefWindowStart =
    headerNow.getTime() -
    (
      24 *
      60 *
      60 *
      1000
    );

  const teamBriefActivityText =
    (activity) =>
      [
        activity?.title,
        activity?.detail,
        activity?.activity_type,
        activity?.entity_type,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

  const teamBriefCoreSubject =
    (activity) => {
      const title =
        String(
          activity?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      const detail =
        String(
          activity?.detail ||
            "",
        )
          .trim()
          .toLowerCase();

      const cleanedTitle =
        title
          .replace(
            /^(task|event|approval|commitment|contact|document|file|team invitation|invitation)\s+(created|added|updated|changed|completed|submitted|uploaded|scheduled)\s*:?\s*/i,
            "",
          )
          .replace(
            /^(created|updated|completed|submitted|uploaded|scheduled)\s*:?\s*/i,
            "",
          )
          .trim();

      return {
        title,
        detail,
        cleanedTitle,
      };
    };

  const isMeaningfulTeamBriefActivity =
    (activity) => {
      const {
        title,
        detail,
        cleanedTitle,
      } =
        teamBriefCoreSubject(
          activity,
        );

      const placeholderValues =
        new Set([
          "",
          "test",
          "testing",
          "test task",
          "task test",
          "asdf",
          "asdfasdf",
          "demo",
          "sample",
          "sample task",
          "untitled",
          "new task",
          "new item",
          "placeholder",
          "temp",
          "temporary",
        ]);

      if (
        placeholderValues.has(
          cleanedTitle,
        )
      ) {
        return false;
      }

      /*
       * Catch common test records even when the activity
       * title contains a prefix such as "Task created:".
       */
      if (
        /^(task|event|approval|commitment|contact|document|file)?\s*(created|added|updated)?\s*:?\s*(test|testing|asdf|demo|sample|placeholder|temp|temporary)\s*$/i
          .test(
            title,
          )
      ) {
        return false;
      }

      /*
       * Also reject records where the meaningful subject
       * lives in the detail field and is only placeholder
       * content.
       */
      if (
        !cleanedTitle &&
        placeholderValues.has(
          detail,
        )
      ) {
        return false;
      }

      return Boolean(
        teamBriefActivityText(
          activity,
        ),
      );
    };

  const teamBriefClassify =
    (activity) => {
      const text =
        teamBriefActivityText(
          activity,
        ).toLowerCase();

      if (
        /completed|fulfilled|resolved|approved|finished|published|sent\b|closed\b/.test(
          text,
        )
      ) {
        return {
          key:
            "completed",
          label:
            "Completed",
        };
      }

      if (
        /invitation|invited|team member|member added|role|permission|access/.test(
          text,
        )
      ) {
        return {
          key:
            "team",
          label:
            "Team change",
        };
      }

      if (
        /created|added|scheduled|uploaded|submitted|new task|new event|new approval/.test(
          text,
        )
      ) {
        return {
          key:
            "new",
          label:
            "New work",
        };
      }

      return {
        key:
          "updated",
        label:
          "Updated",
      };
    };

  const teamBriefOccurredAt =
    (activity) => {
      const timestamp =
        new Date(
          activity?.occurred_at ||
            0,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : 0;
    };

  const teamBriefExecutiveScore =
    (activity) => {
      const text =
        teamBriefActivityText(
          activity,
        ).toLowerCase();

      const type =
        teamBriefClassify(
          activity,
        ).key;

      let score = 0;

      if (
        type ===
        "completed"
      ) {
        score += 40;
      }

      if (
        type ===
        "team"
      ) {
        score += 32;
      }

      if (
        /approved|approval|decision|changes requested|overdue|urgent|critical|high priority|compliance|risk/.test(
          text,
        )
      ) {
        score += 30;
      }

      if (
        /commitment|donor|fundrais|press|reporter|media|event|volunteer|candidate/.test(
          text,
        )
      ) {
        score += 16;
      }

      if (
        type ===
        "new"
      ) {
        score += 8;
      }

      /*
       * Routine low-priority task creation can remain in
       * the 24-hour count, but it should not lead the brief.
       */
      if (
        /low priority/.test(
          text,
        )
      ) {
        score -= 12;
      }

      return score;
    };

  const teamBriefUpdates =
    data.activity
      .filter(
        (activity) =>
          teamBriefOccurredAt(
            activity,
          ) >=
            teamBriefWindowStart &&
          isMeaningfulTeamBriefActivity(
            activity,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const scoreDifference =
            teamBriefExecutiveScore(
              right,
            ) -
            teamBriefExecutiveScore(
              left,
            );

          if (
            scoreDifference !==
            0
          ) {
            return scoreDifference;
          }

          return (
            teamBriefOccurredAt(
              right,
            ) -
            teamBriefOccurredAt(
              left,
            )
          );
        },
      );

  const teamBriefCompletedCount =
    teamBriefUpdates.filter(
      (activity) =>
        teamBriefClassify(
          activity,
        ).key ===
        "completed",
    ).length;

  const teamBriefNewWorkCount =
    teamBriefUpdates.filter(
      (activity) =>
        teamBriefClassify(
          activity,
        ).key ===
        "new",
    ).length;

  const teamBriefTeamChangeCount =
    teamBriefUpdates.filter(
      (activity) =>
        teamBriefClassify(
          activity,
        ).key ===
        "team",
    ).length;

  const teamBriefPrimary =
    teamBriefUpdates[
      0
    ] ||
    null;

  const teamBriefRemainingCount =
    Math.max(
      0,
      teamBriefUpdates.length -
        1,
    );

  const teamBriefPrimaryType =
    teamBriefPrimary
      ? teamBriefClassify(
          teamBriefPrimary,
        )
      : {
          key:
            "",
          label:
            "",
        };

  const teamBriefAge =
    (activity) => {
      const timestamp =
        teamBriefOccurredAt(
          activity,
        );

      if (!timestamp) {
        return "";
      }

      const difference =
        Math.max(
          0,
          headerNow.getTime() -
            timestamp,
        );

      const minutes =
        Math.floor(
          difference /
            (
              60 *
              1000
            ),
        );

      if (
        minutes <
        1
      ) {
        return "Just now";
      }

      if (
        minutes <
        60
      ) {
        return `${minutes}m ago`;
      }

      const hours =
        Math.floor(
          minutes /
            60,
        );

      if (
        hours <
        24
      ) {
        return `${hours}h ago`;
      }

      return `${Math.floor(
        hours /
          24,
      )}d ago`;
    };

  const teamBriefRoute =
    (activity) => {
      const text =
        teamBriefActivityText(
          activity,
        ).toLowerCase();

      if (
        /approval/.test(
          text,
        )
      ) {
        return "/approvals";
      }

      if (
        /commitment/.test(
          text,
        )
      ) {
        return "/commitments";
      }

      if (
        /contact/.test(
          text,
        )
      ) {
        return "/contacts";
      }

      if (
        /event|calendar|schedule/.test(
          text,
        )
      ) {
        return "/calendar";
      }

      if (
        /invitation|team|member|role/.test(
          text,
        )
      ) {
        return "/team";
      }

      if (
        /message|inbox|email/.test(
          text,
        )
      ) {
        return "/inbox";
      }

      if (
        /document|file|upload/.test(
          text,
        )
      ) {
        return "/files";
      }

      return "/tasks";
    };

  /*
   * RISK & COMPLIANCE
   *
   * Risk is evidence-driven.
   *
   * A finance/legal/security keyword by itself does not make
   * something urgent. Campaign Seat requires an additional
   * operational signal such as an overdue deadline, due-soon
   * deadline, high priority, changes requested, schedule
   * conflict, or an at-risk commitment.
   *
   * This is a tracked-risk radar, not legal certification.
   */

  const campaignRiskNow =
    headerNow.getTime();

  const campaignRiskText =
    (item) =>
      [
        item?.title,
        item?.detail,
        item?.description,
        item?.category,
        item?.approval_type,
        item?.type,
        ...(Array.isArray(
          item?.tags,
        )
          ? item.tags
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

  const campaignRiskTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const campaignRiskIsPlaceholder =
    (item) => {
      const title =
        String(
          item?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      return [
        "",
        "test",
        "testing",
        "test task",
        "asdf",
        "demo",
        "sample",
        "placeholder",
      ].includes(
        title,
      );
    };

  const campaignRiskCategory =
    (item) => {
      const text =
        campaignRiskText(
          item,
        ).toLowerCase();

      if (
        /security|permission|access|authentication|credential|account/.test(
          text,
        )
      ) {
        return "Security";
      }

      if (
        /filing|campaign finance|compliance|disclaimer|legal|treasurer/.test(
          text,
        )
      ) {
        return "Compliance";
      }

      if (
        /budget|major spending|payment|invoice|financial|finance/.test(
          text,
        )
      ) {
        return "Financial";
      }

      if (
        /public statement|endorsement|reputation|press|media/.test(
          text,
        )
      ) {
        return "Reputation";
      }

      return "Operational";
    };

  const campaignRiskIsSensitive =
    (item) => {
      const text =
        campaignRiskText(
          item,
        ).toLowerCase();

      return (
        /treasurer|filing|campaign finance|compliance|disclaimer|legal|security|permission|access|authentication|credential|public statement|endorsement|major spending|budget/.test(
          text,
        )
      );
    };

  const campaignRiskDueState =
    (value) => {
      const timestamp =
        campaignRiskTimestamp(
          value,
        );

      if (
        timestamp === null
      ) {
        return {
          overdue:
            false,
          today:
            false,
          soon:
            false,
        };
      }

      const overdue =
        timestamp <
        campaignRiskNow;

      const today =
        !overdue &&
        getEasternDateKey(
          value,
        ) ===
          getEasternDateKey(
            headerNow,
          );

      const soon =
        !overdue &&
        !today &&
        timestamp <=
          campaignRiskNow +
            (
              72 *
              60 *
              60 *
              1000
            );

      return {
        overdue,
        today,
        soon,
      };
    };

  const campaignRiskTaskEntries =
    openTasks
      .filter(
        (task) =>
          !campaignRiskIsPlaceholder(
            task,
          ),
      )
      .map(
        (task) => {
          const priority =
            String(
              task.priority ||
                "",
            ).toLowerCase();

          const due =
            campaignRiskDueState(
              task.due_at,
            );

          const sensitive =
            campaignRiskIsSensitive(
              task,
            );

          const highPriority =
            [
              "urgent",
              "critical",
              "high",
            ].includes(
              priority,
            );

          const qualifies =
            (
              sensitive &&
              (
                due.overdue ||
                due.today ||
                due.soon ||
                highPriority
              )
            ) ||
            (
              highPriority &&
              due.overdue
            );

          if (!qualifies) {
            return null;
          }

          const severity =
            due.overdue ||
            [
              "urgent",
              "critical",
            ].includes(
              priority,
            )
              ? "critical"
              : "high";

          return {
            id:
              `risk-task-${task.id}`,

            title:
              task.title ||
              "Campaign task risk",

            detail:
              task.detail ||
              task.description ||
              "Campaign work requires review.",

            category:
              sensitive
                ? campaignRiskCategory(
                    task,
                  )
                : "Deadline",

            severity,

            route:
              "/tasks",

            dueAt:
              task.due_at ||
              null,

            deadline:
              due.overdue ||
              due.today ||
              due.soon,
          };
        },
      )
      .filter(Boolean);

  const campaignRiskApprovalEntries =
    decisionActionApprovals
      .filter(
        (approval) =>
          campaignRiskIsSensitive(
            approval,
          ),
      )
      .map(
        (approval) => {
          const due =
            campaignRiskDueState(
              approval.due_at,
            );

          const changesRequested =
            String(
              approval.status ||
                "",
            ).toLowerCase() ===
            "changes_requested";

          return {
            id:
              `risk-approval-${approval.id}`,

            title:
              approval.title ||
              "Sensitive approval",

            detail:
              approval.review_notes ||
              approval.description ||
              (
                changesRequested
                  ? "Changes were requested on a sensitive campaign decision."
                  : "A sensitive campaign decision is awaiting review."
              ),

            category:
              campaignRiskCategory(
                approval,
              ),

            severity:
              due.overdue
                ? "critical"
                : (
                    changesRequested ||
                    due.today ||
                    due.soon
                  )
                  ? "high"
                  : "watch",

            route:
              "/approvals",

            dueAt:
              approval.due_at ||
              null,

            deadline:
              due.overdue ||
              due.today ||
              due.soon,
          };
        },
      );

  const campaignRiskCommitmentEntries =
    commitmentQueue
      .filter(
        (record) =>
          commitmentIsOverdue(
            record,
          ) ||
          commitmentIsAtRisk(
            record,
          ),
      )
      .map(
        (record) => ({
          id:
            `risk-commitment-${record.id}`,

          title:
            record.title ||
            "Commitment at risk",

          detail:
            `${record.stakeholder || "Campaign stakeholder"} · ${
              commitmentIsOverdue(
                record,
              )
                ? "Commitment is overdue."
                : "Commitment is at risk."
            }`,

          category:
            "Commitment",

          severity:
            commitmentIsOverdue(
              record,
            )
              ? "critical"
              : "high",

          route:
            "/commitments",

          dueAt:
            record.due_at ||
            null,

          deadline:
            Boolean(
              record.due_at,
            ),
        }),
      );

  const campaignScheduleRisk =
    hasScheduleConflict
      ? {
          id:
            "risk-schedule-conflict",

          title:
            "Schedule conflict requires attention",

          detail:
            "Two campaign commitments overlap today.",

          category:
            "Schedule",

          severity:
            "critical",

          route:
            "/calendar",

          dueAt:
            null,

          deadline:
            true,
        }
      : null;

  const campaignRiskQueue =
    [
      campaignScheduleRisk,
      ...campaignRiskTaskEntries,
      ...campaignRiskApprovalEntries,
      ...campaignRiskCommitmentEntries,
    ]
      .filter(Boolean)
      .filter(
        (
          item,
          index,
          items,
        ) =>
          items.findIndex(
            (candidate) =>
              candidate.title ===
                item.title &&
              candidate.route ===
                item.route,
          ) ===
          index,
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = {
            critical:
              0,
            high:
              1,
            watch:
              2,
          };

          const severityDifference =
            (
              rank[
                left.severity
              ] ?? 3
            ) -
            (
              rank[
                right.severity
              ] ?? 3
            );

          if (
            severityDifference !==
            0
          ) {
            return severityDifference;
          }

          return (
            (
              campaignRiskTimestamp(
                left.dueAt,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              campaignRiskTimestamp(
                right.dueAt,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const campaignRiskCriticalCount =
    campaignRiskQueue.filter(
      (item) =>
        item.severity ===
        "critical",
    ).length;

  const campaignRiskDeadlineCount =
    campaignRiskQueue.filter(
      (item) =>
        item.deadline,
    ).length;

  const campaignRiskComplianceCount =
    campaignRiskQueue.filter(
      (item) =>
        [
          "Compliance",
          "Security",
          "Financial",
        ].includes(
          item.category,
        ),
    ).length;

  const campaignRiskPrimary =
    campaignRiskQueue[
      0
    ] ||
    null;

  const campaignRiskRemainingCount =
    Math.max(
      0,
      campaignRiskQueue.length -
        1,
    );

  const campaignRiskDueLabel =
    (risk) => {
      if (!risk) {
        return "";
      }

      if (
        risk.id ===
        "risk-schedule-conflict"
      ) {
        return "Today";
      }

      if (!risk.dueAt) {
        return risk.severity ===
          "critical"
          ? "Immediate review"
          : "Review recommended";
      }

      const due =
        campaignRiskDueState(
          risk.dueAt,
        );

      const formatted =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            month:
              "short",
            day:
              "numeric",
            hour:
              "numeric",
            minute:
              "2-digit",
          },
        ).format(
          new Date(
            risk.dueAt,
          ),
        );

      if (
        due.overdue
      ) {
        return `Overdue · ${formatted}`;
      }

      if (
        due.today
      ) {
        return `Due today · ${formatted}`;
      }

      if (
        due.soon
      ) {
        return `Due soon · ${formatted}`;
      }

      return `Review · ${formatted}`;
    };

  /*
   * TASK EXECUTION PULSE
   *
   * Today's Priorities answers "what matters most?"
   * This card answers "is the campaign executing?"
   *
   * It measures open workload, overdue work, work due today
   * and work already in progress.
   */

  const taskExecutionNow =
    headerNow.getTime();

  const taskExecutionIsPlaceholder =
    (task) => {
      const title =
        String(
          task?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      return [
        "",
        "test",
        "testing",
        "test task",
        "task test",
        "asdf",
        "demo",
        "sample",
        "placeholder",
        "untitled",
      ].includes(
        title,
      );
    };

  const taskExecutionTimestamp =
    (task) => {
      if (!task?.due_at) {
        return null;
      }

      const timestamp =
        new Date(
          task.due_at,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const taskExecutionIsOverdue =
    (task) => {
      const timestamp =
        taskExecutionTimestamp(
          task,
        );

      return (
        timestamp !== null &&
        timestamp <
          taskExecutionNow
      );
    };

  const taskExecutionIsDueToday =
    (task) =>
      Boolean(
        task?.due_at &&
        !taskExecutionIsOverdue(
          task,
        ) &&
        getEasternDateKey(
          task.due_at,
        ) ===
          getEasternDateKey(
            headerNow,
          ),
      );

  const taskExecutionIsDueSoon =
    (task) => {
      const timestamp =
        taskExecutionTimestamp(
          task,
        );

      return (
        timestamp !== null &&
        timestamp >=
          taskExecutionNow &&
        timestamp <=
          taskExecutionNow +
            (
              72 *
              60 *
              60 *
              1000
            )
      );
    };

  const taskExecutionQueue =
    visibleTasks
      .filter(
        (task) =>
          !taskExecutionIsPlaceholder(
            task,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            task,
          ) => {
            const priority =
              String(
                task.priority ||
                  "",
              ).toLowerCase();

            if (
              taskExecutionIsOverdue(
                task,
              )
            ) {
              return 0;
            }

            if (
              taskExecutionIsDueToday(
                task,
              )
            ) {
              return 1;
            }

            if (
              [
                "urgent",
                "critical",
              ].includes(
                priority,
              )
            ) {
              return 2;
            }

            if (
              priority ===
              "high"
            ) {
              return 3;
            }

            if (
              task.status ===
              "in_progress"
            ) {
              return 4;
            }

            if (
              taskExecutionIsDueSoon(
                task,
              )
            ) {
              return 5;
            }

            return 6;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          return (
            (
              taskExecutionTimestamp(
                left,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              taskExecutionTimestamp(
                right,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const taskExecutionOverdueCount =
    taskExecutionQueue.filter(
      (task) =>
        taskExecutionIsOverdue(
          task,
        ),
    ).length;

  const taskExecutionDueTodayCount =
    taskExecutionQueue.filter(
      (task) =>
        taskExecutionIsDueToday(
          task,
        ),
    ).length;

  const taskExecutionInProgressCount =
    taskExecutionQueue.filter(
      (task) =>
        task.status ===
        "in_progress",
    ).length;

  const taskExecutionPrimary =
    taskExecutionQueue[
      0
    ] ||
    null;

  const taskExecutionRemainingCount =
    Math.max(
      0,
      taskExecutionQueue.length -
        1,
    );

  const taskExecutionCategory =
    taskExecutionPrimary
      ? formatStatus(
          taskExecutionPrimary.category ||
            "Campaign work",
        )
      : "";

  const taskExecutionPriority =
    taskExecutionPrimary
      ? formatStatus(
          taskExecutionPrimary.priority ||
            "Normal",
        )
      : "";

  const formatTaskExecutionDue =
    (
      value,
      {
        timeOnly =
          false,
      } = {},
    ) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        timeOnly
          ? {
              timeZone:
                "America/New_York",
              hour:
                "numeric",
              minute:
                "2-digit",
            }
          : {
              timeZone:
                "America/New_York",
              month:
                "short",
              day:
                "numeric",
              hour:
                "numeric",
              minute:
                "2-digit",
            },
      ).format(
        date,
      );
    };

  const taskExecutionTiming =
    taskExecutionPrimary
      ? (
          taskExecutionIsOverdue(
            taskExecutionPrimary,
          )
            ? `Overdue${
                taskExecutionPrimary
                  .due_at
                  ? ` · ${formatTaskExecutionDue(
                      taskExecutionPrimary
                        .due_at,
                    )}`
                  : ""
              }`
            : taskExecutionIsDueToday(
                  taskExecutionPrimary,
                )
              ? `Due today${
                  taskExecutionPrimary
                    .due_at
                    ? ` · ${formatTaskExecutionDue(
                        taskExecutionPrimary
                          .due_at,
                        {
                          timeOnly:
                            true,
                        },
                      )}`
                    : ""
                }`
              : taskExecutionIsDueSoon(
                    taskExecutionPrimary,
                  )
                ? `Due soon${
                    taskExecutionPrimary
                      .due_at
                      ? ` · ${formatTaskExecutionDue(
                          taskExecutionPrimary
                            .due_at,
                        )}`
                      : ""
                  }`
                : taskExecutionPrimary
                      .status ===
                    "in_progress"
                  ? "In progress"
                  : taskExecutionPrimary
                        .due_at
                    ? `Due ${formatTaskExecutionDue(
                        taskExecutionPrimary
                          .due_at,
                      )}`
                    : "Open · No deadline"
        )
      : "";

  /*
   * CALENDAR PLANNING PULSE
   *
   * Today's Schedule answers "what is happening today?"
   * Calendar answers "what is coming next after today?"
   */

  const calendarPlanningNow =
    headerNow.getTime();

  const calendarTodayKey =
    getEasternDateKey(
      headerNow,
    );

  const calendarTomorrowDate =
    new Date(
      headerNow.getTime() +
        (
          24 *
          60 *
          60 *
          1000
        ),
    );

  const calendarTomorrowKey =
    getEasternDateKey(
      calendarTomorrowDate,
    );

  const calendarSevenDayHorizon =
    calendarPlanningNow +
    (
      7 *
      24 *
      60 *
      60 *
      1000
    );

  const calendarEventTimestamp =
    (event) => {
      if (!event?.starts_at) {
        return null;
      }

      const timestamp =
        new Date(
          event.starts_at,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const calendarPlanningQueue =
    data.events
      .filter(
        (event) => {
          const timestamp =
            calendarEventTimestamp(
              event,
            );

          return (
            timestamp !== null &&
            timestamp >
              calendarPlanningNow &&
            getEasternDateKey(
              event.starts_at,
            ) !==
              calendarTodayKey
          );
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            calendarEventTimestamp(
              left,
            ) ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            calendarEventTimestamp(
              right,
            ) ??
            Number.MAX_SAFE_INTEGER
          ),
      );

  const calendarTomorrowCount =
    calendarPlanningQueue.filter(
      (event) =>
        getEasternDateKey(
          event.starts_at,
        ) ===
        calendarTomorrowKey,
    ).length;

  const calendarNextSevenDaysCount =
    calendarPlanningQueue.filter(
      (event) => {
        const timestamp =
          calendarEventTimestamp(
            event,
          );

        return (
          timestamp !== null &&
          timestamp <=
            calendarSevenDayHorizon
        );
      },
    ).length;

  const calendarLocationTbdCount =
    calendarPlanningQueue
      .filter(
        (event) => {
          const timestamp =
            calendarEventTimestamp(
              event,
            );

          const location =
            String(
              event.location ||
                "",
            )
              .trim()
              .toLowerCase();

          return (
            timestamp !== null &&
            timestamp <=
              calendarSevenDayHorizon &&
            (
              !location ||
              [
                "tbd",
                "location pending",
                "pending",
                "to be determined",
              ].includes(
                location,
              )
            )
          );
        },
      )
      .length;

  const calendarPrimary =
    calendarPlanningQueue[
      0
    ] ||
    null;

  const calendarRemainingCount =
    Math.max(
      0,
      calendarPlanningQueue.length -
        1,
    );

  const calendarEventType =
    calendarPrimary
      ? formatStatus(
          calendarPrimary.event_type ||
            "Campaign event",
        )
      : "";

  const formatCalendarPlanningDate =
    (value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          weekday:
            "short",
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        },
      ).format(
        date,
      );
    };

  const calendarPrimaryDetail =
    calendarPrimary
      ? (
          calendarPrimary.location ||
          "Location pending"
        )
      : "";

  /*
   * FUNDRAISING RELATIONSHIP PIPELINE
   *
   * This workspace does not yet expose a contribution ledger
   * or fundraising-dollar goal to HQ.
   *
   * Do not invent money metrics.
   *
   * Until that financial layer exists, Fundraising HQ uses
   * real donor relationships and follow-up dates from Contacts.
   */

  const fundraisingNow =
    headerNow.getTime();

  const fundraisingSevenDayHorizon =
    fundraisingNow +
    (
      7 *
      24 *
      60 *
      60 *
      1000
    );

  const isFundraisingContact =
    (contact) => {
      const type =
        String(
          contact.contact_type ||
            "",
        )
          .trim()
          .toLowerCase();

      const organization =
        String(
          contact.organization ||
            "",
        )
          .trim()
          .toLowerCase();

      return (
        /donor|fundrais|sponsor|finance|contributor/.test(
          `${type} ${organization}`,
        ) &&
        String(
          contact.status ||
            "active",
        ).toLowerCase() !==
          "inactive"
      );
    };

  const fundraisingTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const fundraisingDonorContacts =
    dashboardCampaignContacts
      .filter(
        isFundraisingContact,
      );

  const fundraisingFollowupQueue =
    fundraisingDonorContacts
      .filter(
        (contact) =>
          contact.next_follow_up_at,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            fundraisingTimestamp(
              left.next_follow_up_at,
            ) ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            fundraisingTimestamp(
              right.next_follow_up_at,
            ) ??
            Number.MAX_SAFE_INTEGER
          ),
      );

  const fundraisingDueFollowupCount =
    fundraisingFollowupQueue
      .filter(
        (contact) => {
          const timestamp =
            fundraisingTimestamp(
              contact.next_follow_up_at,
            );

          return (
            timestamp !== null &&
            timestamp <=
              fundraisingNow
          );
        },
      )
      .length;

  const fundraisingThisWeekCount =
    fundraisingFollowupQueue
      .filter(
        (contact) => {
          const timestamp =
            fundraisingTimestamp(
              contact.next_follow_up_at,
            );

          return (
            timestamp !== null &&
            timestamp >
              fundraisingNow &&
            timestamp <=
              fundraisingSevenDayHorizon
          );
        },
      )
      .length;

  const fundraisingUnassignedCount =
    fundraisingDonorContacts
      .filter(
        (contact) =>
          !contact.assigned_to,
      )
      .length;

  const fundraisingPrimary =
    fundraisingFollowupQueue[
      0
    ] ||
    fundraisingDonorContacts[
      0
    ] ||
    null;

  const fundraisingPrimaryChannel =
    fundraisingPrimary
      ? fundraisingPrimary.phone
        ? "Call"
        : fundraisingPrimary.email
          ? "Email"
          : "Follow up"
      : "";

  const fundraisingPrimaryType =
    fundraisingPrimary
      ? formatStatus(
          fundraisingPrimary.contact_type ||
            "Donor",
        )
      : "";

  const formatFundraisingFollowup =
    (value) => {
      if (!value) {
        return "Follow-up not scheduled";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "Follow-up date pending";
      }

      const timestamp =
        date.getTime();

      const formatted =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            month:
              "short",
            day:
              "numeric",
            hour:
              "numeric",
            minute:
              "2-digit",
          },
        ).format(
          date,
        );

      return timestamp <=
        fundraisingNow
        ? `Follow-up overdue · ${formatted}`
        : `Follow up · ${formatted}`;
    };

  /*
   * CONTACT RELATIONSHIP HEALTH
   *
   * People to Contact answers:
   * "Who should I reach out to next?"
   *
   * Contacts answers:
   * "Is our relationship database organized and usable?"
   */

  const contactDirectoryActiveContacts =
    dashboardCampaignContacts
      .filter(
        (contact) =>
          String(
            contact.status ||
              "active",
          ).toLowerCase() !==
            "inactive",
      );

  const contactDirectoryUnassignedCount =
    contactDirectoryActiveContacts
      .filter(
        (contact) =>
          !contact.assigned_to,
      )
      .length;

  const contactDirectoryFollowupScheduledCount =
    contactDirectoryActiveContacts
      .filter(
        (contact) =>
          Boolean(
            contact.next_follow_up_at,
          ),
      )
      .length;

  const contactDirectoryMissingDetailsCount =
    contactDirectoryActiveContacts
      .filter(
        (contact) =>
          !String(
            contact.email ||
              "",
          ).trim() &&
          !String(
            contact.phone ||
              "",
          ).trim(),
      )
      .length;

  const contactDirectoryIssueContacts =
    contactDirectoryActiveContacts
      .map(
        (contact) => {
          const missingMethod =
            !String(
              contact.email ||
                "",
            ).trim() &&
            !String(
              contact.phone ||
                "",
            ).trim();

          const unassigned =
            !contact.assigned_to;

          if (
            !missingMethod &&
            !unassigned
          ) {
            return null;
          }

          return {
            contact,

            issue:
              missingMethod
                ? "Missing phone or email"
                : "No owner assigned",

            rank:
              missingMethod
                ? 0
                : 1,
          };
        },
      )
      .filter(Boolean)
      .sort(
        (
          left,
          right,
        ) =>
          left.rank -
          right.rank,
      );

  const contactDirectoryPrimaryIssue =
    contactDirectoryIssueContacts[
      0
    ] ||
    null;

  const contactDirectoryPrimary =
    contactDirectoryPrimaryIssue
      ?.contact ||
    null;

  const contactDirectoryPrimaryType =
    contactDirectoryPrimary
      ? formatStatus(
          contactDirectoryPrimary.contact_type ||
            "Contact",
        )
      : "";

  const contactDirectoryHealthIssueCount =
    contactDirectoryIssueContacts.length;

  /*
   * DOCUMENT LIBRARY READINESS
   *
   * The live campaign_files schema currently exposes file
   * metadata, not AI-extracted document intelligence.
   *
   * Keep HQ honest: show library readiness now. Later this
   * card can add AI indexing, extracted facts, deadlines,
   * linked people/tasks and document importance.
   */

  const documentLibraryNow =
    headerNow.getTime();

  const documentLibraryWeekStart =
    documentLibraryNow -
    (
      7 *
      24 *
      60 *
      60 *
      1000
    );

  const documentLibraryFiles =
    Array.isArray(
      dashboardDocumentFiles,
    )
      ? dashboardDocumentFiles
      : [];

  const documentLibraryRecentCount =
    documentLibraryFiles.filter(
      (file) => {
        const timestamp =
          new Date(
            file.created_at ||
              0,
          ).getTime();

        return (
          Number.isFinite(
            timestamp,
          ) &&
          timestamp >=
            documentLibraryWeekStart
        );
      },
    ).length;

  const documentLibraryUncategorizedCount =
    documentLibraryFiles.filter(
      (file) => {
        const category =
          String(
            file.category ||
              "",
          )
            .trim()
            .toLowerCase();

        return (
          !category ||
          category ===
            "other" ||
          category ===
            "uncategorized"
        );
      },
    ).length;

  const documentLibraryCategoryCount =
    new Set(
      documentLibraryFiles
        .map(
          (file) =>
            String(
              file.category ||
                "",
            ).trim(),
        )
        .filter(
          (category) =>
            category &&
            ![
              "other",
              "uncategorized",
            ].includes(
              category.toLowerCase(),
            ),
        ),
    ).size;

  const documentLibraryLatest =
    [...documentLibraryFiles]
      .sort(
        (
          left,
          right,
        ) =>
          new Date(
            right.created_at ||
              0,
          ).getTime() -
          new Date(
            left.created_at ||
              0,
          ).getTime(),
      )[
        0
      ] ||
    null;

  const documentLibraryFileType =
    (file) => {
      const mime =
        String(
          file?.mime_type ||
            "",
        ).toLowerCase();

      const name =
        String(
          file?.file_name ||
            "",
        ).toLowerCase();

      if (
        mime.includes(
          "pdf",
        ) ||
        name.endsWith(
          ".pdf",
        )
      ) {
        return "PDF";
      }

      if (
        mime.includes(
          "spreadsheet",
        ) ||
        mime.includes(
          "excel",
        ) ||
        /\.(xlsx?|csv)$/.test(
          name,
        )
      ) {
        return "Spreadsheet";
      }

      if (
        mime.startsWith(
          "image/",
        )
      ) {
        return "Image";
      }

      if (
        mime.includes(
          "word",
        ) ||
        /\.docx?$/.test(
          name,
        )
      ) {
        return "Document";
      }

      if (
        mime.includes(
          "zip",
        ) ||
        /\.zip$/.test(
          name,
        )
      ) {
        return "Archive";
      }

      return "File";
    };

  const formatDocumentLibraryBytes =
    (value) => {
      const bytes =
        Number(
          value ||
            0,
        );

      if (
        !bytes
      ) {
        return "Size unavailable";
      }

      if (
        bytes <
        1024 *
          1024
      ) {
        return `${Math.max(
          1,
          Math.round(
            bytes /
              1024,
          ),
        )} KB`;
      }

      return `${(
        bytes /
        (
          1024 *
          1024
        )
      ).toFixed(
        bytes >=
          10 *
            1024 *
            1024
          ? 0
          : 1,
      )} MB`;
    };

  const formatDocumentLibraryDate =
    (value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          month:
            "short",
          day:
            "numeric",
        },
      ).format(
        date,
      );
    };

  /*
   * APPROVAL WORKFLOW HEALTH
   *
   * Decisions for You answers:
   * "What decision should I make next?"
   *
   * Approvals answers:
   * "Is the campaign review pipeline flowing or stuck?"
   */

  const approvalWorkflowNow =
    headerNow.getTime();

  const approvalWorkflowIsPlaceholder =
    (approval) => {
      const title =
        String(
          approval?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      return [
        "",
        "test",
        "testing",
        "test approval",
        "asdf",
        "demo",
        "sample",
        "placeholder",
        "untitled",
      ].includes(
        title,
      );
    };

  const approvalWorkflowTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const approvalWorkflowIsOverdue =
    (approval) => {
      const timestamp =
        approvalWorkflowTimestamp(
          approval.due_at,
        );

      return (
        timestamp !== null &&
        timestamp <
          approvalWorkflowNow
      );
    };

  const approvalWorkflowQueue =
    pendingApprovals
      .filter(
        (approval) =>
          !approvalWorkflowIsPlaceholder(
            approval,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            approval,
          ) => {
            const status =
              String(
                approval.status ||
                  "",
              ).toLowerCase();

            if (
              status ===
              "changes_requested"
            ) {
              return 0;
            }

            if (
              status ===
                "pending" &&
              approvalWorkflowIsOverdue(
                approval,
              )
            ) {
              return 1;
            }

            if (
              status ===
              "pending"
            ) {
              return 2;
            }

            return 3;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          const leftUpdated =
            approvalWorkflowTimestamp(
              left.updated_at ||
                left.created_at,
            ) ??
            0;

          const rightUpdated =
            approvalWorkflowTimestamp(
              right.updated_at ||
                right.created_at,
            ) ??
            0;

          return (
            leftUpdated -
            rightUpdated
          );
        },
      );

  const approvalWorkflowPendingCount =
    approvalWorkflowQueue
      .filter(
        (approval) =>
          String(
            approval.status ||
              "",
          ).toLowerCase() ===
          "pending",
      )
      .length;

  const approvalWorkflowChangesCount =
    approvalWorkflowQueue
      .filter(
        (approval) =>
          String(
            approval.status ||
              "",
          ).toLowerCase() ===
          "changes_requested",
      )
      .length;

  const approvalWorkflowDraftCount =
    approvalWorkflowQueue
      .filter(
        (approval) =>
          String(
            approval.status ||
              "",
          ).toLowerCase() ===
          "draft",
      )
      .length;

  const approvalWorkflowPrimary =
    approvalWorkflowQueue[
      0
    ] ||
    null;

  const approvalWorkflowRemainingCount =
    Math.max(
      0,
      approvalWorkflowQueue.length -
        1,
    );

  const approvalWorkflowPrimaryStatus =
    approvalWorkflowPrimary
      ? formatStatus(
          approvalWorkflowPrimary.status ||
            "Pending",
        )
      : "";

  const approvalWorkflowPrimaryType =
    approvalWorkflowPrimary
      ? formatStatus(
          approvalWorkflowPrimary.approval_type ||
            "Approval",
        )
      : "";

  const approvalWorkflowPrimaryDetail =
    approvalWorkflowPrimary
      ? (
          approvalWorkflowPrimary.review_notes ||
          approvalWorkflowPrimary.description ||
          (
            approvalWorkflowPrimary.status ===
            "changes_requested"
              ? "Changes were requested before this item can move forward."
              : approvalWorkflowPrimary.status ===
                  "draft"
                ? "This approval is still being prepared."
                : "This campaign item is waiting for review."
          )
        )
      : "";

  const approvalWorkflowAge =
    (approval) => {
      if (!approval) {
        return "";
      }

      const timestamp =
        approvalWorkflowTimestamp(
          approval.updated_at ||
            approval.created_at,
        );

      if (
        timestamp === null
      ) {
        return "Waiting for review";
      }

      const difference =
        Math.max(
          0,
          approvalWorkflowNow -
            timestamp,
        );

      const minutes =
        Math.floor(
          difference /
            (
              60 *
              1000
            ),
        );

      if (
        minutes <
        60
      ) {
        return minutes <=
          1
          ? "Updated just now"
          : `Updated ${minutes}m ago`;
      }

      const hours =
        Math.floor(
          minutes /
            60,
        );

      if (
        hours <
        24
      ) {
        return `Updated ${hours}h ago`;
      }

      const days =
        Math.floor(
          hours /
            24,
        );

      return `Updated ${days}d ago`;
    };

  /*
   * INVENTORY SUPPLY READINESS
   *
   * HQ answers:
   * "Can the campaign physically execute without running
   * out of signs, literature, apparel or field supplies?"
   */

  const inventoryAvailable =
    (item) =>
      Number(
        item.quantity_available ??
          (
            Number(
              item.quantity_on_hand ||
                0,
            ) -
            Number(
              item.quantity_reserved ||
                0,
            )
          ),
      );

  const inventoryActiveItems =
    dashboardInventoryItems
      .filter(
        (item) =>
          String(
            item.status ||
              "active",
          ).toLowerCase() ===
          "active",
      );

  const inventoryAvailableUnits =
    inventoryActiveItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        Math.max(
          0,
          inventoryAvailable(
            item,
          ),
        ),
      0,
    );

  const inventoryOutOfStockItems =
    inventoryActiveItems.filter(
      (item) =>
        inventoryAvailable(
          item,
        ) <=
        0,
    );

  const inventoryLowStockItems =
    inventoryActiveItems.filter(
      (item) => {
        const available =
          inventoryAvailable(
            item,
          );

        const reorder =
          Number(
            item.reorder_point ||
              0,
          );

        return (
          available >
            0 &&
          reorder >
            0 &&
          available <=
            reorder
        );
      },
    );

  const inventoryAttentionItems =
    [
      ...inventoryOutOfStockItems,
      ...inventoryLowStockItems,
    ]
      .filter(
        (
          item,
          index,
          items,
        ) =>
          items.findIndex(
            (candidate) =>
              candidate.id ===
              item.id,
          ) ===
          index,
      )
      .sort(
        (
          left,
          right,
        ) => {
          const leftAvailable =
            inventoryAvailable(
              left,
            );

          const rightAvailable =
            inventoryAvailable(
              right,
            );

          if (
            leftAvailable <=
              0 &&
            rightAvailable >
              0
          ) {
            return -1;
          }

          if (
            rightAvailable <=
              0 &&
            leftAvailable >
              0
          ) {
            return 1;
          }

          return (
            leftAvailable -
            rightAvailable
          );
        },
      );

  const inventoryPrimary =
    inventoryAttentionItems[
      0
    ] ||
    null;

  const inventoryPurchaseOrder =
    inventoryPrimary
      ?.metadata
      ?.purchase_order ||
    {};

  const inventoryPurchaseStatus =
    String(
      inventoryPurchaseOrder.status ||
        "not_ordered",
    );

  const inventoryPurchaseStatusLabel =
    formatStatus(
      inventoryPurchaseStatus,
    );

  const inventoryPrimaryCategory =
    inventoryPrimary
      ? formatStatus(
          inventoryPrimary.category ||
            "Inventory",
        )
      : "";

  const inventoryPrimaryAvailable =
    inventoryPrimary
      ? inventoryAvailable(
          inventoryPrimary,
        )
      : 0;

  const inventoryPrimaryReorder =
    inventoryPrimary
      ? Number(
          inventoryPrimary.reorder_point ||
            0,
        )
      : 0;

  const inventoryExpectedDelivery =
    inventoryPurchaseOrder
      .expected_delivery_date
      ? new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            month:
              "short",
            day:
              "numeric",
          },
        ).format(
          new Date(
            `${inventoryPurchaseOrder.expected_delivery_date}T12:00:00`,
          ),
        )
      : "";

  /*
   * CANDIDATE PROFILE READINESS
   *
   * Candidate HQ answers:
   * "Is the campaign's canonical candidate identity complete?"
   *
   * These fields also form foundational context for future
   * Campaign Memory and Ask Campaign HQ intelligence.
   */

  const candidateProfile =
    dashboardCandidateProfile ||
    {};

  const candidateHasValue =
    (value) =>
      Boolean(
        String(
          value ||
            "",
        ).trim(),
      );

  const candidateReadinessChecks =
    [
      {
        key:
          "candidate-name",
        group:
          "identity",
        label:
          "Candidate name",
        ready:
          candidateHasValue(
            candidateProfile.candidateName,
          ),
        description:
          "Add the candidate’s full public name.",
      },
      {
        key:
          "candidate-photo",
        group:
          "identity",
        label:
          "Candidate photo",
        ready:
          candidateHasValue(
            candidateProfile.candidatePhotoPath,
          ),
        description:
          "Add the approved candidate photo used across Campaign Seat.",
      },
      {
        key:
          "candidate-bio",
        group:
          "identity",
        label:
          "Candidate biography",
        ready:
          candidateHasValue(
            candidateProfile.candidateBio,
          ),
        description:
          "Add a candidate biography so campaign context and public materials stay consistent.",
      },
      {
        key:
          "campaign-name",
        group:
          "identity",
        label:
          "Public campaign name",
        ready:
          candidateHasValue(
            candidateProfile.publicCampaignName,
          ),
        description:
          "Set the official public campaign or workspace name.",
      },

      {
        key:
          "office-sought",
        group:
          "race",
        label:
          "Office sought",
        ready:
          candidateHasValue(
            candidateProfile.officeSought,
          ),
        description:
          "Add the office the candidate is running for.",
      },
      {
        key:
          "jurisdiction",
        group:
          "race",
        label:
          "Campaign jurisdiction",
        ready:
          candidateHasValue(
            candidateProfile.jurisdictionName,
          ),
        description:
          "Add the county, city, district or jurisdiction where the campaign is running.",
      },
      {
        key:
          "election-date",
        group:
          "race",
        label:
          "Election date",
        ready:
          candidateHasValue(
            candidateProfile.generalElectionDate,
          ) ||
          candidateHasValue(
            candidateProfile.primaryElectionDate,
          ),
        description:
          "Add the campaign’s election date so timing and countdown intelligence stays accurate.",
      },

      {
        key:
          "public-contact",
        group:
          "public",
        label:
          "Public contact",
        ready:
          candidateHasValue(
            candidateProfile.candidatePublicEmail,
          ) ||
          candidateHasValue(
            candidateProfile.candidatePublicPhone,
          ),
        description:
          "Add a public candidate email or phone number.",
      },
      {
        key:
          "campaign-website",
        group:
          "public",
        label:
          "Campaign website",
        ready:
          candidateHasValue(
            candidateProfile.websiteUrl,
          ),
        description:
          "Add the public campaign website so Campaign Seat has a canonical campaign source.",
      },
      {
        key:
          "disclaimer",
        group:
          "public",
        label:
          "Campaign disclaimer",
        ready:
          candidateHasValue(
            candidateProfile.disclaimerText,
          ),
        description:
          "Add the campaign’s approved disclaimer text for consistent public materials.",
      },
    ];

  const candidateReadinessReadyCount =
    candidateReadinessChecks.filter(
      (check) =>
        check.ready,
    ).length;

  const candidateReadinessTotalCount =
    candidateReadinessChecks.length;

  const candidateReadinessMissingCount =
    Math.max(
      0,
      candidateReadinessTotalCount -
        candidateReadinessReadyCount,
    );

  const candidateReadinessPercent =
    candidateReadinessTotalCount
      ? Math.round(
          (
            candidateReadinessReadyCount /
            candidateReadinessTotalCount
          ) *
            100,
        )
      : 0;

  const candidateIdentityChecks =
    candidateReadinessChecks.filter(
      (check) =>
        check.group ===
        "identity",
    );

  const candidateRaceChecks =
    candidateReadinessChecks.filter(
      (check) =>
        check.group ===
        "race",
    );

  const candidatePublicChecks =
    candidateReadinessChecks.filter(
      (check) =>
        check.group ===
        "public",
    );

  const candidateIdentityReadyCount =
    candidateIdentityChecks.filter(
      (check) =>
        check.ready,
    ).length;

  const candidateRaceReadyCount =
    candidateRaceChecks.filter(
      (check) =>
        check.ready,
    ).length;

  const candidatePublicReadyCount =
    candidatePublicChecks.filter(
      (check) =>
        check.ready,
    ).length;

  const candidateReadinessPrimaryGap =
    candidateReadinessChecks.find(
      (check) =>
        !check.ready,
    ) ||
    null;

  const candidateReadinessGroupLabel =
    candidateReadinessPrimaryGap
      ? candidateReadinessPrimaryGap.group ===
          "identity"
        ? "Identity"
        : candidateReadinessPrimaryGap.group ===
            "race"
          ? "Race"
          : "Public"
      : "";

  /*
   * EVENT OPERATIONS READINESS
   *
   * Calendar answers:
   * "What is coming up and when?"
   *
   * Events answers:
   * "Are those events operationally ready?"
   */

  const eventOperationsNow =
    headerNow.getTime();

  const eventOperationsIsPlaceholder =
    (event) => {
      const title =
        String(
          event?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      return [
        "",
        "test",
        "testing",
        "test event",
        "asdf",
        "demo",
        "sample",
        "placeholder",
        "untitled",
      ].includes(
        title,
      );
    };

  const eventOperationsTimestamp =
    (event) => {
      if (!event?.starts_at) {
        return null;
      }

      const timestamp =
        new Date(
          event.starts_at,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const eventOperationsScheduled =
    data.events
      .filter(
        (event) =>
          !eventOperationsIsPlaceholder(
            event,
          ) &&
          String(
            event.status ||
              "scheduled",
          ).toLowerCase() ===
            "scheduled" &&
          (
            eventOperationsTimestamp(
              event,
            ) ??
            0
          ) >=
            eventOperationsNow,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            eventOperationsTimestamp(
              left,
            ) ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            eventOperationsTimestamp(
              right,
            ) ??
            Number.MAX_SAFE_INTEGER
          ),
      );

  const eventOperationsLocationMissing =
    (event) => {
      const location =
        String(
          event?.location ||
            "",
        )
          .trim()
          .toLowerCase();

      return (
        !location ||
        [
          "tbd",
          "pending",
          "location pending",
          "to be determined",
        ].includes(
          location,
        )
      );
    };

  const eventOperationsCapacityRatio =
    (event) => {
      const capacity =
        Number(
          event?.capacity ||
            0,
        );

      const rsvps =
        Number(
          event?.rsvp_count ||
            0,
        );

      if (
        capacity <=
        0
      ) {
        return 0;
      }

      return (
        rsvps /
        capacity
      );
    };

  const eventOperationsNearCapacity =
    (event) =>
      Number(
        event?.capacity ||
          0,
      ) >
        0 &&
      eventOperationsCapacityRatio(
        event,
      ) >=
        0.8;

  const eventOperationsLocationTbdCount =
    eventOperationsScheduled
      .filter(
        eventOperationsLocationMissing,
      )
      .length;

  const eventOperationsNearCapacityCount =
    eventOperationsScheduled
      .filter(
        eventOperationsNearCapacity,
      )
      .length;

  const eventOperationsTotalRsvps =
    eventOperationsScheduled.reduce(
      (
        total,
        event,
      ) =>
        total +
        Number(
          event.rsvp_count ||
            0,
        ),
      0,
    );

  const eventOperationsAttentionQueue =
    eventOperationsScheduled
      .filter(
        (event) =>
          eventOperationsLocationMissing(
            event,
          ) ||
          eventOperationsNearCapacity(
            event,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            event,
          ) => {
            if (
              eventOperationsLocationMissing(
                event,
              )
            ) {
              return 0;
            }

            if (
              eventOperationsCapacityRatio(
                event,
              ) >=
                1
            ) {
              return 1;
            }

            if (
              eventOperationsNearCapacity(
                event,
              )
            ) {
              return 2;
            }

            return 3;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          return (
            (
              eventOperationsTimestamp(
                left,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              eventOperationsTimestamp(
                right,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const eventOperationsPrimary =
    eventOperationsAttentionQueue[
      0
    ] ||
    null;

  const eventOperationsRemainingCount =
    Math.max(
      0,
      eventOperationsAttentionQueue.length -
        1,
    );

  const eventOperationsPrimaryType =
    eventOperationsPrimary
      ? formatStatus(
          eventOperationsPrimary.event_type ||
            "Campaign event",
        )
      : "";

  const eventOperationsPrimaryStatus =
    eventOperationsPrimary
      ? eventOperationsLocationMissing(
          eventOperationsPrimary,
        )
        ? "Location needed"
        : eventOperationsCapacityRatio(
              eventOperationsPrimary,
            ) >=
            1
          ? "At capacity"
          : eventOperationsNearCapacity(
                eventOperationsPrimary,
              )
            ? "Near capacity"
            : "Planning on track"
      : "";

  const formatEventOperationsDate =
    (value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          weekday:
            "short",
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        },
      ).format(
        date,
      );
    };

  const eventOperationsPrimaryDetail =
    eventOperationsPrimary
      ? [
          formatEventOperationsDate(
            eventOperationsPrimary.starts_at,
          ),
          eventOperationsLocationMissing(
            eventOperationsPrimary,
          )
            ? "Location pending"
            : eventOperationsPrimary.location,
          Number(
            eventOperationsPrimary.capacity ||
              0,
          ) >
            0
            ? `${Number(
                eventOperationsPrimary.rsvp_count ||
                  0,
              )}/${Number(
                eventOperationsPrimary.capacity,
              )} RSVPs`
            : Number(
                  eventOperationsPrimary.rsvp_count ||
                    0,
                ) >
                0
              ? `${Number(
                  eventOperationsPrimary.rsvp_count,
                )} RSVPs`
              : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  /*
   * SOCIAL CONTENT WORKFLOW
   *
   * The dedicated Social Media publishing module is not yet
   * live, so HQ must not invent channel or engagement data.
   *
   * Until then, this card uses real campaign Tasks and
   * Approvals to answer:
   * "What social content needs to move next?"
   */

  const socialContentNow =
    headerNow.getTime();

  const socialContentText =
    (item) =>
      [
        item?.title,
        item?.description,
        item?.detail,
        item?.category,
        item?.approval_type,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

  const socialContentMatches =
    (item) => {
      const text =
        socialContentText(
          item,
        ).toLowerCase();

      const category =
        String(
          item?.category ||
            item?.approval_type ||
            "",
        )
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_");

      if (
        [
          "social_media",
          "social",
          "digital_content",
          "communications",
        ].includes(
          category,
        )
      ) {
        return true;
      }

      /*
       * Deliberately avoid standalone "post" so a contact/task
       * mentioning the Palm Beach Post is not treated as social
       * media content.
       */
      return /social media|facebook|instagram|tiktok|twitter|\bx\b account|reel|caption|content calendar|social copy|social campaign|digital content/.test(
        text,
      );
    };

  const socialContentIsPlaceholder =
    (item) => {
      const title =
        String(
          item?.title ||
            "",
        )
          .trim()
          .toLowerCase();

      return [
        "",
        "test",
        "testing",
        "test task",
        "test approval",
        "asdf",
        "demo",
        "sample",
        "placeholder",
        "untitled",
      ].includes(
        title,
      );
    };

  const socialContentTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const socialContentIsOverdue =
    (item) => {
      const timestamp =
        socialContentTimestamp(
          item.due_at,
        );

      return (
        timestamp !== null &&
        timestamp <
          socialContentNow
      );
    };

  const socialContentTasks =
    visibleTasks
      .filter(
        (task) =>
          !socialContentIsPlaceholder(
            task,
          ) &&
          socialContentMatches(
            task,
          ),
      )
      .map(
        (task) => ({
          ...task,

          socialKind:
            "Task",

          socialRoute:
            "/tasks",

          socialStatus:
            formatStatus(
              task.priority ||
                task.status ||
                "Open",
            ),
        }),
      );

  const socialContentApprovals =
    pendingApprovals
      .filter(
        (approval) =>
          !socialContentIsPlaceholder(
            approval,
          ) &&
          socialContentMatches(
            approval,
          ),
      )
      .map(
        (approval) => ({
          ...approval,

          socialKind:
            "Approval",

          socialRoute:
            "/approvals",

          socialStatus:
            formatStatus(
              approval.status ||
                "Pending",
            ),
        }),
      );

  const socialContentActionQueue =
    [
      ...socialContentTasks,
      ...socialContentApprovals,
    ]
      .sort(
        (
          left,
          right,
        ) => {
          const rank = (
            item,
          ) => {
            const status =
              String(
                item.status ||
                  "",
              ).toLowerCase();

            if (
              socialContentIsOverdue(
                item,
              )
            ) {
              return 0;
            }

            if (
              status ===
              "changes_requested"
            ) {
              return 1;
            }

            if (
              item.socialKind ===
              "Approval"
            ) {
              return 2;
            }

            if (
              [
                "urgent",
                "critical",
                "high",
              ].includes(
                String(
                  item.priority ||
                    "",
                ).toLowerCase(),
              )
            ) {
              return 3;
            }

            return 4;
          };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          return (
            (
              socialContentTimestamp(
                left.due_at,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              socialContentTimestamp(
                right.due_at,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const socialContentTaskCount =
    socialContentTasks.length;

  const socialContentApprovalCount =
    socialContentApprovals
      .filter(
        (approval) =>
          [
            "pending",
            "changes_requested",
          ].includes(
            String(
              approval.status ||
                "",
            ).toLowerCase(),
          ),
      )
      .length;

  const socialContentOverdueCount =
    socialContentActionQueue
      .filter(
        socialContentIsOverdue,
      )
      .length;

  const socialContentPrimary =
    socialContentActionQueue[
      0
    ] ||
    null;

  const socialContentRemainingCount =
    Math.max(
      0,
      socialContentActionQueue.length -
        1,
    );

  const socialContentPrimaryDetail =
    socialContentPrimary
      ? (
          socialContentPrimary.description ||
          socialContentPrimary.review_notes ||
          (
            socialContentPrimary.socialKind ===
              "Approval"
              ? "Social content is waiting for campaign review."
              : "Social content work needs campaign action."
          )
        )
      : "";

  const socialContentPrimaryTiming =
    socialContentPrimary
      ? socialContentIsOverdue(
          socialContentPrimary,
        )
        ? `Overdue${
            socialContentPrimary.due_at
              ? ` · ${new Intl.DateTimeFormat(
                  "en-US",
                  {
                    timeZone:
                      "America/New_York",
                    month:
                      "short",
                    day:
                      "numeric",
                    hour:
                      "numeric",
                    minute:
                      "2-digit",
                  },
                ).format(
                  new Date(
                    socialContentPrimary.due_at,
                  ),
                )}`
              : ""
          }`
        : socialContentPrimary.socialKind ===
            "Approval"
          ? socialContentPrimary.status ===
              "changes_requested"
            ? "Changes requested"
            : "Awaiting approval"
          : socialContentPrimary.due_at
            ? `Due ${new Intl.DateTimeFormat(
                "en-US",
                {
                  timeZone:
                    "America/New_York",
                  month:
                    "short",
                  day:
                    "numeric",
                },
              ).format(
                new Date(
                  socialContentPrimary.due_at,
                ),
              )}`
            : "Content action open"
      : "";

  /*
   * MEDIA ASSET LIBRARY
   *
   * Documents answers:
   * "What files does the campaign have?"
   *
   * Media Center answers:
   * "What reusable creative/media assets does the
   * campaign have available?"
   *
   * The dedicated Media Center module is not live yet,
   * so this card uses the real campaign_files library.
   */

  const mediaCenterNow =
    headerNow.getTime();

  const mediaCenterWeekStart =
    mediaCenterNow -
    (
      7 *
      24 *
      60 *
      60 *
      1000
    );

  const mediaCenterAssetType =
    (file) => {
      const mime =
        String(
          file?.mime_type ||
            "",
        ).toLowerCase();

      const name =
        String(
          file?.file_name ||
            "",
        ).toLowerCase();

      if (
        mime.startsWith(
          "image/",
        ) ||
        /\.(png|jpe?g|gif|webp|svg)$/.test(
          name,
        )
      ) {
        return "Image";
      }

      if (
        mime.startsWith(
          "video/",
        ) ||
        /\.(mp4|mov|m4v|webm|avi)$/.test(
          name,
        )
      ) {
        return "Video";
      }

      if (
        mime.startsWith(
          "audio/",
        ) ||
        /\.(mp3|wav|m4a|aac)$/.test(
          name,
        )
      ) {
        return "Audio";
      }

      return "";
    };

  const mediaCenterAssets =
    documentLibraryFiles
      .filter(
        (file) =>
          Boolean(
            mediaCenterAssetType(
              file,
            ),
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          new Date(
            right.created_at ||
              0,
          ).getTime() -
          new Date(
            left.created_at ||
              0,
          ).getTime(),
      );

  const mediaCenterImageCount =
    mediaCenterAssets.filter(
      (file) =>
        mediaCenterAssetType(
          file,
        ) ===
        "Image",
    ).length;

  const mediaCenterMotionCount =
    mediaCenterAssets.filter(
      (file) =>
        [
          "Video",
          "Audio",
        ].includes(
          mediaCenterAssetType(
            file,
          ),
        ),
    ).length;

  const mediaCenterRecentCount =
    mediaCenterAssets.filter(
      (file) => {
        const timestamp =
          new Date(
            file.created_at ||
              0,
          ).getTime();

        return (
          Number.isFinite(
            timestamp,
          ) &&
          timestamp >=
            mediaCenterWeekStart
        );
      },
    ).length;

  const mediaCenterLatest =
    mediaCenterAssets[
      0
    ] ||
    null;

  const mediaCenterLatestType =
    mediaCenterLatest
      ? mediaCenterAssetType(
          mediaCenterLatest,
        )
      : "";

  const mediaCenterLatestCategory =
    mediaCenterLatest
      ? formatStatus(
          mediaCenterLatest.category ||
            "Media",
        )
      : "";

  /*
   * WAITING ON — BLOCKER & ESCALATION RADAR
   *
   * Tasks answer:
   * "What work do we need to execute?"
   *
   * Waiting On answers:
   * "What cannot move because somebody or something
   * outside the task owner still owes us something?"
   *
   * Canonical metadata comes from:
   * waiting-on
   * waiting-for:
   * waiting-source:
   * waiting-scope:
   * waiting-last-follow-up:
   */

  const waitingOnNow =
    headerNow.getTime();

  const waitingOnHour =
    60 *
    60 *
    1000;

  const waitingOnTagValue =
    (
      tags,
      prefix,
    ) => {
      const normalizedPrefix =
        String(
          prefix ||
            "",
        ).toLowerCase();

      const match =
        (
          Array.isArray(tags)
            ? tags
            : []
        ).find(
          (tag) =>
            String(
              tag ||
                "",
            )
              .toLowerCase()
              .startsWith(
                normalizedPrefix,
              ),
        );

      return match
        ? String(
            match,
          )
            .slice(
              String(
                prefix,
              ).length,
            )
            .trim()
        : "";
    };

  const waitingOnIsCanonical =
    (task) =>
      (
        Array.isArray(
          task.tags,
        )
          ? task.tags
          : []
      ).some(
        (tag) =>
          String(
            tag ||
              "",
          ).toLowerCase() ===
            "waiting-on",
      );

  const waitingOnTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const waitingOnDueTimestamp =
    (record) =>
      waitingOnTimestamp(
        record.due_at,
      );

  const waitingOnIsOverdue =
    (record) => {
      const timestamp =
        waitingOnDueTimestamp(
          record,
        );

      return (
        timestamp !== null &&
        timestamp <
          waitingOnNow
      );
    };

  const waitingOnLastFollowup =
    (record) =>
      waitingOnTagValue(
        record.tags,
        "waiting-last-follow-up:",
      );

  const waitingOnNeedsFollowup =
    (record) => {
      if (
        waitingOnIsOverdue(
          record,
        )
      ) {
        return true;
      }

      const lastFollowup =
        waitingOnTimestamp(
          waitingOnLastFollowup(
            record,
          ),
        );

      const reference =
        lastFollowup ??
        waitingOnTimestamp(
          record.created_at ||
            record.updated_at,
        );

      return (
        reference !== null &&
        waitingOnNow -
          reference >=
            48 *
              waitingOnHour
      );
    };

  const waitingOnQueue =
    visibleTasks
      .filter(
        (task) =>
          waitingOnIsCanonical(
            task,
          ),
      )
      .map(
        (task) => ({
          ...task,

          waitingFor:
            waitingOnTagValue(
              task.tags,
              "waiting-for:",
            ) ||
            "Response pending",

          waitingSource:
            waitingOnTagValue(
              task.tags,
              "waiting-source:",
            ) ||
            "Other",

          waitingScope:
            waitingOnTagValue(
              task.tags,
              "waiting-scope:",
            ) ||
            "internal",
        }),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const rank =
            (record) => {
              if (
                waitingOnIsOverdue(
                  record,
                )
              ) {
                return 0;
              }

              if (
                waitingOnNeedsFollowup(
                  record,
                )
              ) {
                return 1;
              }

              const priority =
                String(
                  record.priority ||
                    "",
                ).toLowerCase();

              if (
                [
                  "urgent",
                  "critical",
                ].includes(
                  priority,
                )
              ) {
                return 2;
              }

              if (
                priority ===
                "high"
              ) {
                return 3;
              }

              return 4;
            };

          const difference =
            rank(left) -
            rank(right);

          if (
            difference !==
            0
          ) {
            return difference;
          }

          return (
            (
              waitingOnDueTimestamp(
                left,
              ) ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              waitingOnDueTimestamp(
                right,
              ) ??
              Number.MAX_SAFE_INTEGER
            )
          );
        },
      );

  const waitingOnOverdueCount =
    waitingOnQueue.filter(
      waitingOnIsOverdue,
    ).length;

  const waitingOnFollowupCount =
    waitingOnQueue.filter(
      waitingOnNeedsFollowup,
    ).length;

  const waitingOnExternalCount =
    waitingOnQueue.filter(
      (record) =>
        String(
          record.waitingScope ||
            "",
        ).toLowerCase() ===
        "external",
    ).length;

  const waitingOnPrimary =
    waitingOnQueue[
      0
    ] ||
    null;

  const waitingOnRemainingCount =
    Math.max(
      0,
      waitingOnQueue.length -
        1,
    );

  const waitingOnPrimaryCategory =
    waitingOnPrimary
      ? formatStatus(
          waitingOnPrimary.category ||
            "General",
        )
      : "";

  const waitingOnPrimarySource =
    waitingOnPrimary
      ? waitingOnPrimary.waitingSource ||
        "Other"
      : "";

  const waitingOnPrimaryStatus =
    waitingOnPrimary
      ? waitingOnIsOverdue(
          waitingOnPrimary,
        )
        ? "Overdue"
        : waitingOnNeedsFollowup(
              waitingOnPrimary,
            )
          ? "Follow-up needed"
          : waitingOnPrimary.status ===
              "in_progress"
            ? "Following up"
            : "Waiting"
      : "";

  const formatWaitingOnDue =
    (value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(
          value,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        },
      ).format(
        date,
      );
    };

  const waitingOnPrimaryTiming =
    waitingOnPrimary
      ? [
          waitingOnPrimaryStatus,

          waitingOnPrimary.due_at
            ? formatWaitingOnDue(
                waitingOnPrimary.due_at,
              )
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const latestMetric =
    data.metrics[data.metrics.length - 1] || {};

  const campaignHealth = Number(
    latestMetric.campaign_health || 0,
  );

  const shiftsFilled = Number(
    latestMetric.volunteer_shifts_filled || 0,
  );

  const shiftsGoal = Number(
    latestMetric.volunteer_shifts_goal || 0,
  );

  const volunteerCoverage =
    shiftsGoal > 0
      ? Math.round((shiftsFilled / shiftsGoal) * 100)
      : 0;
  const volunteerOpenShiftCount =
    Math.max(
      0,
      shiftsGoal -
        shiftsFilled,
    );

  const volunteerRosterAvailable =
    data.volunteerCount >
    0;

  /*
   * Shift coverage comes from campaign_metrics while the
   * volunteer count comes from the live volunteer roster.
   *
   * Do not combine those signals when the live roster is
   * empty; that can make historical/stale shift metrics look
   * like current staffing capacity.
   */
  const volunteerCoverageConfigured =
    volunteerRosterAvailable &&
    shiftsGoal >
      0;

  const volunteerCoverageHealthy =
    volunteerCoverageConfigured &&
    volunteerOpenShiftCount ===
      0;

  const volunteerCoverageNeedsStaffing =
    volunteerCoverageConfigured &&
    volunteerOpenShiftCount >
      0;


  const messagesSent = Number(
    latestMetric.messages_sent || 0,
  );

  const messagesOpened = Number(
    latestMetric.messages_opened || 0,
  );

  const responseRate =
    messagesSent > 0
      ? Math.round((messagesOpened / messagesSent) * 100)
      : 0;

  /*
   * REPORTS & ANALYTICS PERFORMANCE PULSE
   *
   * HQ answers:
   * "Is the campaign getting stronger or weaker, and
   * which operating area deserves attention?"
   *
   * Uses only real campaign_metrics values already loaded
   * by useCampaignDashboard.
   */

  const reportsAnalyticsPreviousMetric =
    data.metrics.length >
      1
      ? data.metrics[
          data.metrics.length -
            2
        ]
      : {};

  const reportsAnalyticsValue =
    (
      metric,
      key,
    ) => {
      const raw =
        metric?.[
          key
        ];

      if (
        raw === null ||
        raw === undefined ||
        raw === ""
      ) {
        return null;
      }

      const value =
        Number(
          raw,
        );

      return Number.isFinite(
        value,
      )
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                value,
              ),
            ),
          )
        : null;
    };

  const reportsAnalyticsOverall =
    reportsAnalyticsValue(
      latestMetric,
      "campaign_health",
    ) ??
    reportsAnalyticsValue(
      latestMetric,
      "campaign_readiness",
    );

  const reportsAnalyticsSignals =
    [
      {
        key:
          "field",
        label:
          "Field",
        value:
          reportsAnalyticsValue(
            latestMetric,
            "field_health",
          ),
        previous:
          reportsAnalyticsValue(
            reportsAnalyticsPreviousMetric,
            "field_health",
          ),
        route:
          "/field-operations",
      },
      {
        key:
          "communications",
        label:
          "Communications",
        value:
          reportsAnalyticsValue(
            latestMetric,
            "communications_health",
          ),
        previous:
          reportsAnalyticsValue(
            reportsAnalyticsPreviousMetric,
            "communications_health",
          ),
        route:
          "/inbox",
      },
      {
        key:
          "volunteers",
        label:
          "Volunteers",
        value:
          reportsAnalyticsValue(
            latestMetric,
            "volunteers_health",
          ),
        previous:
          reportsAnalyticsValue(
            reportsAnalyticsPreviousMetric,
            "volunteers_health",
          ),
        route:
          "/volunteers",
      },
      {
        key:
          "events",
        label:
          "Events",
        value:
          reportsAnalyticsValue(
            latestMetric,
            "events_health",
          ),
        previous:
          reportsAnalyticsValue(
            reportsAnalyticsPreviousMetric,
            "events_health",
          ),
        route:
          "/events",
      },
    ];

  const reportsAnalyticsConfiguredSignals =
    reportsAnalyticsSignals
      .filter(
        (signal) =>
          signal.value !==
          null,
      );

  /*
   * All-zero rows are commonly an unestablished baseline.
   * Do not present them as a dramatic campaign failure.
   */
  const reportsAnalyticsHasBaseline =
    data.metrics.length >
      0 &&
    (
      (
        reportsAnalyticsOverall ??
        0
      ) >
        0 ||
      reportsAnalyticsConfiguredSignals.some(
        (signal) =>
          (
            signal.value ??
            0
          ) >
          0,
      )
    );

  const reportsAnalyticsWeakest =
    reportsAnalyticsHasBaseline
      ? [
          ...reportsAnalyticsConfiguredSignals,
        ]
          .sort(
            (
              left,
              right,
            ) =>
              (
                left.value ??
                101
              ) -
              (
                right.value ??
                101
              ),
          )[
            0
          ] ||
        null
      : null;

  const reportsAnalyticsWeakestChange =
    reportsAnalyticsWeakest &&
    reportsAnalyticsWeakest.previous !==
      null &&
    reportsAnalyticsWeakest.previous !==
      undefined
      ? reportsAnalyticsWeakest.value -
        reportsAnalyticsWeakest.previous
      : null;

  const reportsAnalyticsOverallPrevious =
    reportsAnalyticsValue(
      reportsAnalyticsPreviousMetric,
      "campaign_health",
    ) ??
    reportsAnalyticsValue(
      reportsAnalyticsPreviousMetric,
      "campaign_readiness",
    );

  const reportsAnalyticsOverallChange =
    reportsAnalyticsOverall !==
      null &&
    reportsAnalyticsOverallPrevious !==
      null
      ? reportsAnalyticsOverall -
        reportsAnalyticsOverallPrevious
      : null;

  const reportsAnalyticsPointLabel =
    (value) =>
      Math.abs(
        Number(
          value ||
            0,
        ),
      ) ===
      1
        ? "pt"
        : "pts";

  const reportsAnalyticsTrendLabel =
    reportsAnalyticsOverallChange ===
      null
      ? "Current baseline"
      : reportsAnalyticsOverallChange >
          0
        ? `Up ${reportsAnalyticsOverallChange} ${reportsAnalyticsPointLabel(
            reportsAnalyticsOverallChange,
          )}`
        : reportsAnalyticsOverallChange <
            0
          ? `Down ${Math.abs(
              reportsAnalyticsOverallChange,
            )} ${reportsAnalyticsPointLabel(
              reportsAnalyticsOverallChange,
            )}`
          : "Holding steady";

  const reportsAnalyticsWeakestTrend =
    reportsAnalyticsWeakestChange ===
      null
      ? "Current performance signal"
      : reportsAnalyticsWeakestChange >
          0
        ? `Up ${reportsAnalyticsWeakestChange} ${reportsAnalyticsPointLabel(
            reportsAnalyticsWeakestChange,
          )} vs prior reading`
        : reportsAnalyticsWeakestChange <
            0
          ? `Down ${Math.abs(
              reportsAnalyticsWeakestChange,
            )} ${reportsAnalyticsPointLabel(
              reportsAnalyticsWeakestChange,
            )} vs prior reading`
          : "Unchanged from prior reading";

  const reportsAnalyticsSignalByKey =
    Object.fromEntries(
      reportsAnalyticsSignals.map(
        (signal) => [
          signal.key,
          signal,
        ],
      ),
    );

  const navigationCounts = {
    tasks: openTasks.length,
    waiting: overdueTasks.length,
    approvals: pendingApprovals.length,
  };

  const quickActionsByExperience = {
    owner: [
      {
        label: "Manage users",
        icon: UserCog,
        route: "/team/access",
      },
      {
        label: "Review approvals",
        icon: FileCheck2,
        route: "/approvals",
      },
      {
        label: "Add event",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Upload file",
        icon: Files,
        route: "/files",
      },
    ],
    manager: [
      {
        label: "Field operations",
        icon: MapPin,
        route: "/field-operations",
      },
      {
        label: "View calendar",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Message team",
        icon: Mail,
        route: "/communications",
      },
      {
        label: "Manage team",
        icon: UserCog,
        route: "/team",
      },
    ],
    candidate: [
      {
        label: "Review approvals",
        icon: FileCheck2,
        route: "/approvals",
      },
      {
        label: "View calendar",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Open files",
        icon: Files,
        route: "/files",
      },
      {
        label: "Message managers",
        icon: Mail,
        route: "/communications",
      },
    ],
    volunteer: [
      {
        label: "My tasks",
        icon: CheckCircle2,
        route: "/tasks",
      },
      {
        label: "My schedule",
        icon: CalendarDays,
        route: "/calendar",
      },
      {
        label: "Campaign files",
        icon: Files,
        route: "/files",
      },
      {
        label: "Message coordinator",
        icon: Mail,
        route: "/communications",
      },
    ],
  };

  const quickActions =
    quickActionsByExperience[effectiveExperienceKey] ||
    quickActionsByExperience.volunteer;

  // EDITABLE DASHBOARD HQ SHORTCUTS — START
  const recommendedSpotlightShortcutKeys = [
    "messages",
    "decisions",
    "contacts",
    "commitments",
    "team-brief",
    "risk",
  ];

  const activeSpotlightShortcutKeys =
    customSpotlightShortcutKeys.length > 0
      ? customSpotlightShortcutKeys
      : recommendedSpotlightShortcutKeys;


  /* =========================================================
   * HQ CROSS-CAMPAIGN COMMAND BRIEF
   *
   * Converts existing live operational signals into one
   * ranked queue. This does not invent new campaign data.
   * ========================================================= */

  const hqBriefNow =
    headerNow.getTime();

  const hqBriefTodayKey =
    getEasternDateKey(
      headerNow,
    );

  const hqBriefTimestamp =
    (value) => {
      if (!value) {
        return null;
      }

      const timestamp =
        new Date(
          value,
        ).getTime();

      return Number.isFinite(
        timestamp,
      )
        ? timestamp
        : null;
    };

  const hqBriefIsDueToday =
    (value) =>
      Boolean(
        value &&
        getEasternDateKey(
          value,
        ) ===
          hqBriefTodayKey,
      );

  const hqBriefCandidates =
    [];

  const pushHqBriefItem =
    ({
      id,
      title,
      detail,
      category,
      status,
      route,
      rank = 4,
      tone = "info",
      icon = AlertCircle,
      dueToday = false,
      followup = false,
    }) => {
      const normalizedTitle =
        String(
          title ||
          "",
        )
          .trim()
          .replace(
            /\s+/g,
            " ",
          );

      if (!normalizedTitle) {
        return;
      }

      hqBriefCandidates.push({
        id:
          id ||
          `${route}-${normalizedTitle}`,

        title:
          normalizedTitle,

        detail:
          String(
            detail ||
            "",
          )
            .trim()
            .replace(
              /\s+/g,
              " ",
            ),

        category:
          category ||
          "Campaign",

        status:
          status ||
          "Needs review",

        route:
          route ||
          "/dashboard",

        rank,
        tone,
        icon,
        dueToday,
        followup,
      });
    };

  /*
   * Risk radar gets first priority because it already requires
   * evidence beyond a keyword match.
   */
  campaignRiskQueue
    .slice(
      0,
      5,
    )
    .forEach(
      (risk) => {
        pushHqBriefItem({
          id:
            `hq-${risk.id}`,

          title:
            risk.title,

          detail:
            risk.detail,

          category:
            risk.category ||
            "Risk",

          status:
            campaignRiskDueLabel(
              risk,
            ),

          route:
            risk.route,

          rank:
            risk.severity ===
            "critical"
              ? 0
              : risk.severity ===
                  "high"
                ? 1
                : 3,

          tone:
            risk.severity ===
            "critical"
              ? "danger"
              : "warning",

          icon:
            ShieldCheck,

          dueToday:
            hqBriefIsDueToday(
              risk.dueAt,
            ),
        });
      },
    );

  /*
   * Decisions requiring campaign action.
   */
  decisionActionApprovals
    .slice(
      0,
      5,
    )
    .forEach(
      (approval) => {
        const dueTime =
          hqBriefTimestamp(
            approval.due_at,
          );

        const overdue =
          dueTime !==
            null &&
          dueTime <
            hqBriefNow;

        const dueToday =
          hqBriefIsDueToday(
            approval.due_at,
          );

        const changesRequested =
          String(
            approval.status ||
            "",
          ).toLowerCase() ===
          "changes_requested";

        pushHqBriefItem({
          id:
            `hq-approval-${approval.id}`,

          title:
            approval.title ||
            "Campaign approval",

          detail:
            approval.review_notes ||
            approval.description ||
            "Campaign decision is awaiting review.",

          category:
            "Decision",

          status:
            changesRequested
              ? "Changes requested"
              : overdue
                ? "Overdue"
                : dueToday
                  ? "Due today"
                  : "Awaiting review",

          route:
            "/approvals",

          rank:
            overdue
              ? 0
              : changesRequested ||
                  dueToday
                ? 1
                : 3,

          tone:
            overdue
              ? "danger"
              : changesRequested ||
                  dueToday
                ? "warning"
                : "info",

          icon:
            FileCheck2,

          dueToday,
        });
      },
    );

  /*
   * Task execution: only items with a real attention signal.
   */
  openTasks
    .filter(
      (task) => {
        const dueTime =
          hqBriefTimestamp(
            task.due_at,
          );

        const priority =
          String(
            task.priority ||
            "",
          ).toLowerCase();

        return (
          (
            dueTime !==
              null &&
            (
              dueTime <
                hqBriefNow ||
              hqBriefIsDueToday(
                task.due_at,
              )
            )
          ) ||
          [
            "urgent",
            "critical",
            "high",
          ].includes(
            priority,
          ) ||
          !task.assigned_to
        );
      },
    )
    .slice(
      0,
      8,
    )
    .forEach(
      (task) => {
        const dueTime =
          hqBriefTimestamp(
            task.due_at,
          );

        const overdue =
          dueTime !==
            null &&
          dueTime <
            hqBriefNow;

        const dueToday =
          hqBriefIsDueToday(
            task.due_at,
          );

        const priority =
          String(
            task.priority ||
            "",
          ).toLowerCase();

        const urgent =
          [
            "urgent",
            "critical",
          ].includes(
            priority,
          );

        const unassigned =
          !task.assigned_to;

        const statusParts =
          [];

        if (overdue) {
          statusParts.push(
            "Overdue",
          );
        } else if (dueToday) {
          statusParts.push(
            "Due today",
          );
        } else if (urgent) {
          statusParts.push(
            "Urgent",
          );
        } else if (
          priority ===
          "high"
        ) {
          statusParts.push(
            "High priority",
          );
        }

        if (unassigned) {
          statusParts.push(
            "Unassigned",
          );
        }

        pushHqBriefItem({
          id:
            `hq-task-${task.id}`,

          title:
            task.title ||
            "Campaign task",

          detail:
            task.description ||
            task.category ||
            "Campaign work requires attention.",

          category:
            "Task",

          status:
            statusParts.join(
              " · ",
            ) ||
            "Needs review",

          route:
            `/tasks?task=${encodeURIComponent(
              task.id,
            )}`,

          rank:
            overdue ||
            urgent
              ? 0
              : dueToday ||
                  priority ===
                    "high"
                ? 1
                : unassigned
                  ? 2
                  : 3,

          tone:
            overdue ||
            urgent
              ? "danger"
              : dueToday ||
                  priority ===
                    "high"
                ? "warning"
                : "setup",

          icon:
            CheckCircle2,

          dueToday,
        });
      },
    );

  /*
   * Actionable inbox conversations.
   */
  dashboardActionableConversations
    .slice(
      0,
      4,
    )
    .forEach(
      (
        conversation,
        index,
      ) => {
        const sender =
          conversation.sender ||
          conversation.email ||
          "Campaign contact";

        pushHqBriefItem({
          id:
            `hq-message-${conversation.id || index}`,

          title:
            conversation.subject ||
            `Message from ${sender}`,

          detail:
            conversation.preview ||
            conversation.snippet ||
            sender,

          category:
            "Inbox",

          status:
            conversation.priority
              ? "High priority"
              : conversation.needsResponse
                ? "Reply needed"
                : "Needs review",

          route:
            "/inbox",

          rank:
            conversation.priority
              ? 1
              : 2,

          tone:
            conversation.priority
              ? "warning"
              : "info",

          icon:
            Mail,

          followup:
            Boolean(
              conversation.needsResponse,
            ),
        });
      },
    );

  /*
   * Relationship follow-ups due now/today.
   */
  relationshipFollowupQueue
    .filter(
      (item) =>
        relationshipIsOverdue(
          item,
        ) ||
        relationshipIsDueToday(
          item,
        ),
    )
    .slice(
      0,
      4,
    )
    .forEach(
      (item) => {
        const overdue =
          relationshipIsOverdue(
            item,
          );

        const dueToday =
          relationshipIsDueToday(
            item,
          );

        pushHqBriefItem({
          id:
            `hq-relationship-${item.id}`,

          title:
            item.title ||
            "Campaign contact",

          detail:
            item.detail ||
            `${item.relationshipType || "Contact"} · ${item.channel || "Follow up"}`,

          category:
            "Relationship",

          status:
            overdue
              ? "Follow-up overdue"
              : "Follow up today",

          route:
            item.route ||
            "/contacts",

          rank:
            overdue
              ? 1
              : 2,

          tone:
            overdue
              ? "warning"
              : "info",

          icon:
            PhoneCall,

          dueToday,
          followup:
            true,
        });
      },
    );

  /*
   * Public/stakeholder commitments.
   */
  commitmentQueue
    .filter(
      (record) =>
        commitmentIsOverdue(
          record,
        ) ||
        commitmentIsAtRisk(
          record,
        ),
    )
    .slice(
      0,
      4,
    )
    .forEach(
      (record) => {
        const overdue =
          commitmentIsOverdue(
            record,
          );

        pushHqBriefItem({
          id:
            `hq-commitment-${record.id}`,

          title:
            record.title ||
            "Campaign commitment",

          detail:
            record.stakeholder ||
            "Campaign stakeholder",

          category:
            "Commitment",

          status:
            overdue
              ? "Commitment overdue"
              : "At risk",

          route:
            "/commitments",

          rank:
            overdue
              ? 0
              : 1,

          tone:
            overdue
              ? "danger"
              : "warning",

          icon:
            Target,

          dueToday:
            hqBriefIsDueToday(
              record.due_at,
            ),

          followup:
            true,
        });
      },
    );

  /*
   * Things blocked on outside people/vendors/decisions.
   */
  waitingOnQueue
    .filter(
      (record) =>
        waitingOnIsOverdue(
          record,
        ) ||
        waitingOnNeedsFollowup(
          record,
        ),
    )
    .slice(
      0,
      4,
    )
    .forEach(
      (record) => {
        const overdue =
          waitingOnIsOverdue(
            record,
          );

        pushHqBriefItem({
          id:
            `hq-waiting-${record.id}`,

          title:
            record.title ||
            "Waiting on follow-up",

          detail:
            record.waitingSource ||
            record.description ||
            "Campaign work is blocked.",

          category:
            "Waiting on",

          status:
            overdue
              ? "Overdue"
              : "Follow-up needed",

          route:
            "/waiting-on",

          rank:
            overdue
              ? 1
              : 2,

          tone:
            overdue
              ? "warning"
              : "setup",

          icon:
            Clock3,

          dueToday:
            hqBriefIsDueToday(
              record.due_at,
            ),

          followup:
            true,
        });
      },
    );

  /*
   * Event operations issues already detected by HQ.
   */
  eventOperationsAttentionQueue
    .slice(
      0,
      3,
    )
    .forEach(
      (event) => {
        const locationMissing =
          eventOperationsLocationMissing(
            event,
          );

        const atCapacity =
          eventOperationsCapacityRatio(
            event,
          ) >=
          1;

        pushHqBriefItem({
          id:
            `hq-event-${event.id}`,

          title:
            event.title ||
            "Campaign event",

          detail:
            [
              formatEventOperationsDate(
                event.starts_at,
              ),
              event.location ||
                "Location pending",
            ]
              .filter(Boolean)
              .join(
                " · ",
              ),

          category:
            "Event",

          status:
            locationMissing
              ? "Location needed"
              : atCapacity
                ? "At capacity"
                : "Near capacity",

          route:
            "/calendar",

          rank:
            locationMissing ||
            atCapacity
              ? 1
              : 2,

          tone:
            locationMissing ||
            atCapacity
              ? "warning"
              : "info",

          icon:
            CalendarDays,

          dueToday:
            hqBriefIsDueToday(
              event.starts_at,
            ),
        });
      },
    );

  const hqCommandBriefItems =
    hqBriefCandidates
      .sort(
        (
          left,
          right,
        ) => {
          if (
            left.rank !==
            right.rank
          ) {
            return (
              left.rank -
              right.rank
            );
          }

          return String(
            left.title ||
            "",
          ).localeCompare(
            String(
              right.title ||
              "",
            ),
          );
        },
      )
      .filter(
        (
          item,
          index,
          items,
        ) => {
          const key =
            `${String(
              item.route ||
              "",
            ).split("?")[0]}|${String(
              item.title ||
              "",
            )
              .trim()
              .toLowerCase()}`;

          return (
            items.findIndex(
              (candidate) =>
                `${String(
                  candidate.route ||
                  "",
                ).split("?")[0]}|${String(
                  candidate.title ||
                  "",
                )
                  .trim()
                  .toLowerCase()}` ===
                key,
            ) ===
            index
          );
        },
      );

  const hqCommandBriefCriticalCount =
    hqCommandBriefItems.filter(
      (item) =>
        item.rank ===
        0,
    ).length;

  const hqCommandBriefTodayCount =
    hqCommandBriefItems.filter(
      (item) =>
        item.dueToday,
    ).length;

  const hqCommandBriefFollowupCount =
    hqCommandBriefItems.filter(
      (item) =>
        item.followup,
    ).length;

  const hqCommandBriefTop =
    hqCommandBriefItems[
      0
    ] ||
    null;

  // SAFE LIVE SCHEDULE SYNC — START
  useEffect(() => {
    let intervalId = 0;
    let animationFrameId = 0;
    let observer = null;
    let observedTimeline = null;
    let lastSelectedKey = "";
    let synchronizationPending = false;

    const easternMinutesNow = () => {
      const parts =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            hour:
              "2-digit",
            minute:
              "2-digit",
            hour12:
              false,
          },
        ).formatToParts(
          new Date(),
        );

      const values =
        Object.fromEntries(
          parts.map(
            (part) => [
              part.type,
              part.value,
            ],
          ),
        );

      let hour =
        Number(values.hour);

      const minute =
        Number(values.minute);

      if (hour === 24) {
        hour = 0;
      }

      return (
        hour * 60 +
        minute
      );
    };

    const parseDisplayedTime = (
      value,
    ) => {
      const match =
        String(value || "")
          .trim()
          .match(
            /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
          );

      if (!match) {
        return null;
      }

      let hour =
        Number(match[1]);

      const minute =
        Number(match[2]);

      const period =
        match[3].toUpperCase();

      if (hour === 12) {
        hour = 0;
      }

      if (period === "PM") {
        hour += 12;
      }

      return (
        hour * 60 +
        minute
      );
    };

    const findScrollableContainer = (
      timeline,
    ) => {
      const scheduleCard =
        timeline.closest(
          `.${styles.scheduleCard}`,
        );

      const candidates = [
        timeline,
        timeline.parentElement,
        scheduleCard,
      ];

      for (
        const candidate
        of candidates
      ) {
        if (
          !(
            candidate instanceof
            HTMLElement
          )
        ) {
          continue;
        }

        const computed =
          window.getComputedStyle(
            candidate,
          );

        const permitsScrolling =
          computed.overflowY ===
            "auto" ||
          computed.overflowY ===
            "scroll";

        if (
          permitsScrolling &&
          candidate.scrollHeight >
            candidate.clientHeight + 3
        ) {
          return candidate;
        }
      }

      return timeline;
    };

    const synchronizeSchedule = ({
      forceScroll = false,
    } = {}) => {
      synchronizationPending = false;

      const timeline =
        document.querySelector(
          `.${styles.scheduleTimeline}`,
        );

      if (
        !(
          timeline instanceof
          HTMLElement
        )
      ) {
        return;
      }

      if (
        observedTimeline !==
        timeline
      ) {
        observer?.disconnect();

        observer =
          new MutationObserver(
            () => {
              if (
                synchronizationPending
              ) {
                return;
              }

              synchronizationPending =
                true;

              window.requestAnimationFrame(
                () =>
                  synchronizeSchedule(),
              );
            },
          );

        observer.observe(
          timeline,
          {
            childList:
              true,
            subtree:
              true,
            attributes:
              true,
            attributeFilter: [
              "class",
            ],
          },
        );

        observedTimeline =
          timeline;
      }

      const rows =
        Array.from(
          timeline.children,
        ).filter(
          (element) =>
            element instanceof
              HTMLButtonElement,
        );

      if (!rows.length) {
        return;
      }

      const currentMinutes =
        easternMinutesNow();

      const rowMinutes =
        rows.map(
          (row) =>
            parseDisplayedTime(
              row.querySelector(
                "time",
              )?.textContent,
            ),
        );

      let selectedIndex = 0;

      const firstTime =
        rowMinutes[0];

      if (
        firstTime !== null &&
        currentMinutes >= firstTime
      ) {
        rowMinutes.forEach(
          (
            eventMinutes,
            index,
          ) => {
            if (
              eventMinutes !== null &&
              eventMinutes <=
                currentMinutes
            ) {
              selectedIndex =
                index;
            }
          },
        );
      }

      const selectedRow =
        rows[selectedIndex];

      if (!selectedRow) {
        return;
      }

      rows.forEach(
        (
          row,
          index,
        ) => {
          const shouldBeActive =
            index === selectedIndex;

          if (
            row.classList.contains(
              styles.activeSchedule,
            ) !== shouldBeActive
          ) {
            row.classList.toggle(
              styles.activeSchedule,
              shouldBeActive,
            );
          }

          if (shouldBeActive) {
            if (
              row.getAttribute(
                "data-live-schedule",
              ) !== "current"
            ) {
              row.setAttribute(
                "data-live-schedule",
                "current",
              );
            }

            if (
              row.getAttribute(
                "aria-current",
              ) !== "time"
            ) {
              row.setAttribute(
                "aria-current",
                "time",
              );
            }
          } else {
            if (
              row.hasAttribute(
                "data-live-schedule",
              )
            ) {
              row.removeAttribute(
                "data-live-schedule",
              );
            }

            if (
              row.hasAttribute(
                "aria-current",
              )
            ) {
              row.removeAttribute(
                "aria-current",
              );
            }
          }
        },
      );

      const selectedTime =
        selectedRow.querySelector(
          "time",
        )?.textContent
          ?.trim() || "";

      const selectedTitle =
        selectedRow.querySelector(
          "strong",
        )?.textContent
          ?.trim() || "";

      const selectedKey =
        `${selectedTime}|${selectedTitle}`;

      if (
        forceScroll ||
        selectedKey !==
          lastSelectedKey
      ) {
        lastSelectedKey =
          selectedKey;

        const scrollContainer =
          findScrollableContainer(
            timeline,
          );

        const containerRect =
          scrollContainer
            .getBoundingClientRect();

        const rowRect =
          selectedRow
            .getBoundingClientRect();

        const maximumScroll =
          Math.max(
            0,
            scrollContainer
              .scrollHeight -
            scrollContainer
              .clientHeight,
          );

        const requestedScroll =
          scrollContainer.scrollTop +
          (
            rowRect.top -
            containerRect.top
          ) -
          (
            scrollContainer
              .clientHeight -
            rowRect.height
          ) /
            2;

        const nextScroll =
          Math.max(
            0,
            Math.min(
              maximumScroll,
              requestedScroll,
            ),
          );

        scrollContainer.scrollTo({
          top:
            nextScroll,
          behavior:
            "auto",
        });
      }
    };

    const queueSynchronization = ({
      forceScroll = false,
    } = {}) => {
      window.cancelAnimationFrame(
        animationFrameId,
      );

      animationFrameId =
        window.requestAnimationFrame(
          () =>
            window.requestAnimationFrame(
              () =>
                synchronizeSchedule({
                  forceScroll,
                }),
            ),
        );
    };

    queueSynchronization({
      forceScroll:
        true,
    });

    intervalId =
      window.setInterval(
        () =>
          queueSynchronization(),
        15000,
      );

    const handleReturn = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        queueSynchronization({
          forceScroll:
            true,
        });
      }
    };

    window.addEventListener(
      "focus",
      handleReturn,
    );

    document.addEventListener(
      "visibilitychange",
      handleReturn,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      window.cancelAnimationFrame(
        animationFrameId,
      );

      observer?.disconnect();

      window.removeEventListener(
        "focus",
        handleReturn,
      );

      document.removeEventListener(
        "visibilitychange",
        handleReturn,
      );
    };
  }, []);
  // SAFE LIVE SCHEDULE SYNC — END

  const toggleSpotlightShortcut = (key) => {
    setCustomSpotlightShortcutKeys((current) => {
      const selection =
        current.length > 0
          ? current
          : recommendedSpotlightShortcutKeys;

      if (selection.includes(key)) {
        if (selection.length === 1) {
          return selection;
        }

        return selection.filter(
          (selectedKey) => selectedKey !== key,
        );
      }

      if (selection.length >= HQ_SHORTCUT_LIMIT) {
        return selection;
      }

      return [...selection, key];
    });
  };

  const resetSpotlightShortcuts = () => {
    setCustomSpotlightShortcutKeys([]);
  };
  // EDITABLE DASHBOARD HQ SHORTCUTS — END

  // PRESENTATION SPOTLIGHT ACTIONS — START
  // PRESENTATION SPOTLIGHT ACTIONS — END


  // OPERATIONAL CARD INTERACTION — START
  const activateOperationalCard = (event) => {
    const interactiveElement = event.target.closest(
      "button, a, input, select, textarea",
    );

    if (
      interactiveElement &&
      interactiveElement !== event.currentTarget
    ) {
      return;
    }

    event.currentTarget.focus();

    if (
      !window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      event.currentTarget.animate(
        [
          {
            transform:
              "translateY(-2px) scale(1)",
          },
          {
            transform:
              "translateY(0) scale(0.992)",
          },
          {
            transform:
              "translateY(-2px) scale(1)",
          },
        ],
        {
          duration: 220,
          easing: "ease-out",
        },
      );
    }
  };

  const handleOperationalCardKeyDown = (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      activateOperationalCard(event);
    }
  };
  // OPERATIONAL CARD INTERACTION — END


  return (
    <CampaignWorkspaceShell
      activeItem="HQ"
    >
      <main className={styles.main}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <section
            className={
              styles.hqCommandBrief
            }
            aria-label="Campaign command brief"
          >
            <header
              className={
                styles.hqCommandBriefHeader
              }
            >
              <div
                className={
                  styles.hqCommandBriefTitle
                }
              >
                <span>
                  <Sparkles
                    size={15}
                  />
                  Campaign command brief
                </span>

                <h1>
                  What needs attention now
                </h1>

                <p>
                  Campaign Seat is ranking live work,
                  decisions, risks and follow-ups across
                  the campaign.
                </p>
              </div>

              <div
                className={
                  styles.hqCommandBriefMetrics
                }
                aria-label="Command brief summary"
              >
                <span
                  className={
                    hqCommandBriefCriticalCount
                      ? styles.hqBriefMetricDanger
                      : ""
                  }
                >
                  <strong>
                    {
                      hqCommandBriefCriticalCount
                    }
                  </strong>

                  <small>
                    Critical
                  </small>
                </span>

                <span>
                  <strong>
                    {
                      hqCommandBriefTodayCount
                    }
                  </strong>

                  <small>
                    Due today
                  </small>
                </span>

                <span>
                  <strong>
                    {
                      hqCommandBriefFollowupCount
                    }
                  </strong>

                  <small>
                    Follow-ups
                  </small>
                </span>

                <span>
                  <strong>
                    {
                      todayScheduleEvents
                        .length
                    }
                  </strong>

                  <small>
                    Events today
                  </small>
                </span>
              </div>
            </header>

            {hqCommandBriefItems.length ? (
              <div
                className={
                  styles.hqCommandBriefList
                }
              >
                {hqCommandBriefItems
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (item) => {
                      const BriefIcon =
                        item.icon ||
                        AlertCircle;

                      return (
                        <button
                          key={
                            item.id
                          }
                          className={
                            styles[
                              `hqBrief_${item.tone}`
                            ] ||
                            ""
                          }
                          type="button"
                          onClick={() =>
                            navigate(
                              item.route,
                            )
                          }
                        >
                          <span
                            className={
                              styles.hqCommandBriefIcon
                            }
                          >
                            <BriefIcon
                              size={16}
                            />
                          </span>

                          <span
                            className={
                              styles.hqCommandBriefCopy
                            }
                          >
                            <small>
                              {
                                item.category
                              }
                            </small>

                            <strong>
                              {
                                item.title
                              }
                            </strong>

                            {item.detail ? (
                              <p>
                                {
                                  item.detail
                                }
                              </p>
                            ) : null}
                          </span>

                          <span
                            className={
                              styles.hqCommandBriefStatus
                            }
                          >
                            {
                              item.status
                            }
                          </span>

                          <ArrowRight
                            size={15}
                          />
                        </button>
                      );
                    },
                  )}
              </div>
            ) : (
              <div
                className={
                  styles.hqCommandBriefClear
                }
              >
                <CheckCircle2
                  size={19}
                />

                <span>
                  <strong>
                    No urgent campaign work is
                    currently surfaced.
                  </strong>

                  <small>
                    HQ will continue watching live
                    tasks, approvals, commitments,
                    inbox activity and campaign risk.
                  </small>
                </span>
              </div>
            )}

            <footer
              className={
                styles.hqCommandBriefFooter
              }
            >
              <span>
                {hqCommandBriefItems.length
                  ? `${hqCommandBriefItems.length} campaign ${
                      hqCommandBriefItems.length ===
                      1
                        ? "item needs"
                        : "items need"
                    } attention`
                  : "Campaign attention queue is clear"}
              </span>

              <div>
                <small>
                  Updated{" "}
                  {formatRelative(
                    lastUpdated ||
                    headerNow,
                  )}
                </small>

                {hqCommandBriefTop ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        hqCommandBriefTop.route,
                      )
                    }
                  >
                    Open top priority
                    <ArrowRight
                      size={14}
                    />
                  </button>
                ) : null}
              </div>
            </footer>
          </section>

          <section className={styles.heroGrid}>
<article
              className={`${styles.compactCard} ${styles.heroPriorityCard}`}
              tabIndex={0}
              aria-label="Today’s campaign priorities"
            >
              <div className={styles.cardHeading}>
                <span>
                  <Flag size={15} />
                  Today&apos;s priorities
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/tasks")}
                >
                  View all
                </button>
              </div>

              <div className={styles.priorityList}>
                {displayedPriorities.map((task) => {
                  const tone =
                    getPriorityTone(task.priority);

                  const PriorityIcon =
                    task.icon || CheckCircle2;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() =>
                        navigate("/tasks")
                      }
                    >
                      <span
                        className={`${styles.priorityIcon} ${
                          styles[tone]
                        }`}
                      >
                        <PriorityIcon size={14} />
                      </span>

                      <span className={styles.priorityCopy}>
                        <strong>{task.title}</strong>
                        <small>
                          {task.detail ||
                            task.description ||
                            task.category ||
                            "Campaign task"}
                        </small>
                      </span>

                      <span
                        className={`${styles.priorityBadge} ${
                          styles[tone]
                        }`}
                      >
                        {task.priority || "Normal"}
                      </span>
                    </button>
                  );
                })}
              </div>

            </article>
            <div className={styles.centerHeroStack}>
              <article
                className={`${styles.heroCard} ${styles.simpleSpotlight}`}
              >
                <div className={styles.simpleSpotlightCopy}>
                  <div className={styles.simpleSpotlightMessage}>
                    <h2>
                      Building momentum for
                      <strong>
                        {workspace.description ||
                          workspace.name ||
                          "your campaign"}
                      </strong>
                    </h2>

                    <p>
                      {workspace.location ||
                        "Campaign workspace"}
                    </p>
                  </div>

                  <div className={styles.simpleSpotlightInfoStack}>
                    <div className={styles.simpleSpotlightInfoCard}>
                      <span
                        className={
                          styles.simpleSpotlightInfoIcon
                        }
                      >
                        <CalendarDays size={18} />
                      </span>

                      <div
                        className={
                          styles.simpleSpotlightInfoBody
                        }
                      >
                        <small>
                          {workspace.electionLabel ||
                            "Election day"}
                        </small>

                        <strong>
                          {workspace.electionDate ||
                            "Date pending"}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.simpleSpotlightInfoCard}>
                      <span
                        className={
                          styles.simpleSpotlightInfoIcon
                        }
                      >
                        <Clock3 size={18} />
                      </span>

                      <div
                        className={
                          styles.simpleSpotlightInfoBody
                        }
                      >
                        <small>
                          Countdown
                        </small>

                        <strong>
                          {daysUntilElection}{" "}
                          {daysUntilElection === 1
                            ? "day"
                            : "days"}
                        </strong>
                      </div>
                    </div>

                    <div
                      className={
                        styles.simpleSpotlightWeatherCard
                      }
                    >
                      <CampaignConditions
                        workspace={workspace}
                        variant="hero"
                      />
                    </div>


                  </div>

                  <div className={styles.simpleSpotlightCustomize}>
                    <div
                      className={
                        styles.simpleSpotlightCustomizeCopy
                      }
                    >
                      <small>
                        Customize your HQ
                      </small>

                      <span>
                        Choose up to 6 cards below to shape
                        the information you see first.
                      </span>
                    </div>

                    <div className={styles.heroShortcutArea}>
                      <button
                        className={
                          styles.editShortcutsButton
                        }
                        type="button"
                        aria-expanded={
                          isEditingSpotlightShortcuts
                        }
                        onClick={() =>
                          setIsEditingSpotlightShortcuts(
                            (current) => !current,
                          )
                        }
                      >
                        <Settings size={13} />
                        Customize HQ
                      </button>

                      {isEditingSpotlightShortcuts && (
                        <div
                          className={styles.shortcutEditor}
                          role="dialog"
                          aria-modal="true"
                          aria-label="Edit Dashboard HQ shortcuts"
                        >
                          <div
                            className={
                              styles.shortcutEditorHeader
                            }
                          >
                            <div>
                              <strong>
                                Your HQ cards
                              </strong>

                              <small>
                                Choose up to 6 items to
                                appear on your main HQ.
                              </small>
                            </div>

                            <button
                              type="button"
                              aria-label="Close shortcut editor"
                              onClick={() =>
                                setIsEditingSpotlightShortcuts(
                                  false,
                                )
                              }
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <div
                            className={
                              styles.shortcutOptions
                            }
                          >
                            {SPOTLIGHT_SHORTCUT_OPTIONS.map(
                              (option) => {
                                const Icon =
                                  option.icon;

                                const isSelected =
                                  activeSpotlightShortcutKeys.includes(
                                    option.key,
                                  );

                                return (
                                  <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={
                                      isSelected
                                    }
                                    disabled={
                                      !isSelected &&
                                      activeSpotlightShortcutKeys.length >=
                                        HQ_SHORTCUT_LIMIT
                                    }
                                    className={
                                      isSelected
                                        ? styles.selectedShortcut
                                        : ""
                                    }
                                    onClick={() =>
                                      toggleSpotlightShortcut(
                                        option.key,
                                      )
                                    }
                                  >
                                    <Icon size={15} />

                                    <span>
                                      {option.label}
                                    </span>

                                    {isSelected && (
                                      <CheckCircle2
                                        size={14}
                                      />
                                    )}
                                  </button>
                                );
                              },
                            )}
                          </div>

                          <div
                            className={
                              styles.shortcutEditorFooter
                            }
                          >
                            <span>
                              {
                                activeSpotlightShortcutKeys.length
                              }
                              /{HQ_SHORTCUT_LIMIT} selected
                              {" · "}
                              {activeSpotlightShortcutKeys.length >=
                              HQ_SHORTCUT_LIMIT
                                ? "Remove one to choose another"
                                : "Choose your HQ cards"}
                            </span>

                            <button
                              type="button"
                              onClick={
                                resetSpotlightShortcuts
                              }
                            >
                              Reset recommended
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={styles.simpleSpotlightMedia}
                  data-candidate-photo-frame="hq"
                >
                  {dashboardCandidatePhotoUrl ? (
                    <img
                      className={
                        styles.simpleSpotlightBackdrop
                      }
                      src={
                        dashboardCandidatePhotoUrl
                      }
                      alt=""
                      aria-hidden="true"
                      data-candidate-photo="hq-backdrop"
                      decoding="async"
                      draggable="false"
                    />
                  ) : (
                    <div
                      className={
                        styles.simpleSpotlightPhotoFallback
                      }
                      aria-label="Candidate photo not uploaded"
                    >
                      <strong>
                        {getUserInitials(
                          dashboardCandidateProfile
                            ?.candidateName ||
                          workspace.name,
                        )}
                      </strong>

                      <span>
                        Upload candidate photo
                      </span>
                    </div>
                  )}

                  <div
                    className={
                      styles.simpleSpotlightMediaShade
                    }
                    aria-hidden="true"
                  />

                  {dashboardCandidatePhotoUrl ? (
                    <img
                      className={
                        styles.simpleSpotlightPortrait
                      }
                      src={
                        dashboardCandidatePhotoUrl
                      }
                      alt={
                        dashboardCandidateProfile
                          ?.candidateName ||
                        workspace.name
                      }
                      data-candidate-photo="hq-portrait"
                      decoding="async"
                      loading="eager"
                      fetchPriority="high"
                      draggable="false"
                    />
                  ) : null}
                </div>
              </article>

              <section
                className={styles.campaignAiPanel}
                aria-label="Ask Campaign HQ"

              data-campaign-ai-panel="true"
            >
                <span className={styles.campaignAiIcon}>
                  <Sparkles size={18} />
                </span>

                <div className={styles.campaignAiCopy}>
      <span className={styles.campaignAiLive}>
        <i aria-hidden="true" />
        Live campaign intelligence
      </span>

                  <strong>Insights, answers &amp; next steps</strong>

                </div>

                <div className={styles.campaignAiAction}>
                  <button
                    className={styles.campaignAiLauncher}
                    type="button"
                    aria-label="Open Ask Campaign HQ"
                    onClick={() => {
                      const aiPanel =
                        document.querySelector(
                          '[data-campaign-ai-panel="true"]',
                        );

                      const globalLauncher =
                        Array.from(
                          document.querySelectorAll("button"),
                        ).find((button) => {
                          if (aiPanel?.contains(button)) {
                            return false;
                          }

                          const label = [
                            button.getAttribute("aria-label") || "",
                            button.textContent || "",
                          ]
                            .join(" ")
                            .replace(/\s+/g, " ")
                            .trim()
                            .toLowerCase();

                          return label.includes(
                            "ask campaign hq",
                          );
                        });

                      if (globalLauncher) {
                        globalLauncher.click();
                        return;
                      }

                      window.dispatchEvent(
                        new KeyboardEvent("keydown", {
                          key: "k",
                          code: "KeyK",
                          metaKey: true,
                          ctrlKey: true,
                          bubbles: true,
                        }),
                      );
                    }}
                  >
                    <Sparkles size={18} />
                    <span>Ask Campaign HQ</span>
                    <kbd>⌘K</kbd>
                  </button>
                </div>
              </section>
            </div>

            <article
              className={styles.scheduleCard}
              tabIndex={0}
              aria-label="Today’s campaign schedule"
            >
              <div className={styles.cardHeading}>
                <span>
                  <CalendarDays size={15} />
                  Today&apos;s schedule
                </span>

                <button
                  type="button"
                  onClick={() => navigate("/calendar")}
                >
                  View calendar
                </button>
              </div>

              <div
                className={`${styles.scheduleTimeline} ${
                  !displayedScheduleEvents.length
                    ? styles.emptyTimeline
                    : ""
                }`}
              >
                {displayedScheduleEvents.length ? (
                  displayedScheduleEvents.map(
                    (event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() =>
                          navigate("/calendar")
                        }
                        className={
                          event.highlight
                            ? styles.activeSchedule
                            : ""
                        }
                      >
                        <time>
                          {formatTime(event.starts_at)}
                        </time>

                        <span
                          className={styles.timelineDot}
                        />

                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {event.location ||
                              "Location pending"}
                          </small>
                        </span>

                        {event.phone ? (
                          <span
                            className={styles.phoneAction}
                            aria-label="Phone call"
                          >
                            <PhoneCall size={14} />
                          </span>
                        ) : event.attendeeLabels?.length ? (
                          <span
                            className={
                              styles.attendeeStack
                            }
                            aria-label="Scheduled attendees"
                          >
                            {event.attendeeLabels.map(
                              (label) => (
                                <i key={label}>
                                  {label}
                                </i>
                              ),
                            )}

                            {event.attendeeOverflow > 0 && (
                              <i>
                                +{event.attendeeOverflow}
                              </i>
                            )}
                          </span>
                        ) : (
                          <ArrowRight size={14} />
                        )}
                      </button>
                    ),
                  )
                ) : (
                  <div className={styles.emptyState}>
                    <CalendarDays size={22} />
                    <strong>
                      {isLoading
                        ? "Loading schedule…"
                        : "No upcoming events"}
                    </strong>
                    <p>
                      No events scheduled for today.
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`${styles.scheduleFooter} ${
                  hasScheduleConflict
                    ? styles.scheduleConflict
                    : ""
                }`}
              >
                <Clock3 size={14} />

                {hasScheduleConflict
                  ? "You have 1 conflict"
                  : displayedScheduleEvents.length
                    ? `${displayedScheduleEvents.length} upcoming ${
                        displayedScheduleEvents.length === 1
                          ? "event"
                          : "events"
                      }`
                    : "No events today"}

                {hasScheduleConflict && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/calendar")
                    }
                  >
                    Resolve
                  </button>
                )}
              </div>
            </article>
          </section>

                                        {/* CAMPAIGN SEAT DECISION GRID — START */}
          <section className={styles.decisionGrid}>
            {activeSpotlightShortcutKeys.includes("messages") && (
              <article
                className={`${styles.compactCard} ${styles.candidateMessagesCard}`}
                aria-label="Messages requiring attention"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Mail size={15} />
                    Messages for you
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/inbox")
                    }
                  >
                    View inbox
                  </button>
                </div>

                <div
                  className={
                    styles.candidateMessageMetric
                  }
                >
                  <strong>
                    {messageAttentionCount}
                  </strong>

                  <span>
                    {messageAttentionCount === 0
                      ? "No conversations need attention"
                      : messageAttentionCount === 1
                        ? "Conversation needs your attention"
                        : "Conversations need your attention"}
                  </span>
                </div>

                <div
                  className={
                    styles.messageSummaryStats
                  }
                  aria-label="Inbox attention summary"
                >
                  <span
                    className={
                      styles.messageSummaryStat
                    }
                  >
                    <strong>
                      {messageNeedsResponseCount}
                    </strong>

                    <span>
                      Need reply
                    </span>
                  </span>

                  <span
                    className={
                      styles.messageSummaryStat
                    }
                  >
                    <strong>
                      {messagePriorityCount}
                    </strong>

                    <span>
                      High priority
                    </span>
                  </span>

                  <span
                    className={
                      styles.messageSummaryStat
                    }
                  >
                    <strong>
                      {messageUnreadCount}
                    </strong>

                    <span>
                      Recent unread
                    </span>
                  </span>
                </div>

                {messagePrimaryConversation ? (
                  <button
                    className={
                      styles.messageSummaryNext
                    }
                    type="button"
                    onClick={() =>
                      navigate("/inbox")
                    }
                    aria-label={`Open conversation with ${messagePrimaryConversation.sender || "campaign contact"}`}
                  >
                    <span
                      className={
                        styles.messageSummaryAvatar
                      }
                    >
                      {messagePrimaryInitials}
                    </span>

                    <span
                      className={
                        styles.messageSummaryNextCopy
                      }
                    >
                      <small>
                        {messagePrimaryConversation
                          .needsResponse
                          ? "Next to respond"
                          : "Next to review"}
                        {" · "}
                        {messagePrimaryChannel}
                      </small>

                      <strong>
                        {messagePrimaryConversation
                          .sender ||
                          "Campaign contact"}
                      </strong>

                      <span>
                        {messagePrimaryConversation
                          .subject ||
                          messagePrimaryConversation
                            .preview ||
                          "Open conversation"}
                      </span>
                    </span>

                    <span
                      className={
                        styles.messageSummaryTime
                      }
                    >
                      {messagePrimaryConversation
                        .time ||
                        ""}
                    </span>

                    <ArrowRight
                      size={14}
                    />
                  </button>
                ) : (
                  <div
                    className={
                      styles.messageSummaryEmpty
                    }
                  >
                    <CheckCircle2
                      size={18}
                    />

                    <span>
                      <strong>
                        {messageSummaryLoading
                          ? "Checking inbox…"
                          : "You're caught up"}
                      </strong>

                      <small>
                        {messageSummaryLoading
                          ? "Campaign Seat is refreshing messages."
                          : "No priority or known-contact conversations need action."}
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("decisions") && (
              <article
                className={`${styles.compactCard} ${styles.candidateDecisionsCard}`}
                aria-label="Decisions requiring action"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <FileCheck2 size={15} />
                    Decisions for you
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/approvals")
                    }
                  >
                    Review decisions
                  </button>
                </div>

                <div
                  className={
                    styles.candidateDecisionMetric
                  }
                >
                  <strong>
                    {decisionActionApprovals.length}
                  </strong>

                  <span>
                    {decisionActionApprovals.length === 0
                      ? "No decisions need action"
                      : decisionActionApprovals.length === 1
                        ? "Decision needs action"
                        : "Decisions need action"}
                  </span>
                </div>

                <div
                  className={
                    styles.decisionSummaryStats
                  }
                  aria-label="Decision urgency summary"
                >
                  <span
                    className={
                      styles.decisionSummaryStat
                    }
                  >
                    <strong>
                      {decisionDueTodayCount}
                    </strong>

                    <span>
                      Due today
                    </span>
                  </span>

                  <span
                    className={
                      styles.decisionSummaryStat
                    }
                  >
                    <strong>
                      {decisionOverdueCount}
                    </strong>

                    <span>
                      Overdue
                    </span>
                  </span>

                  <span
                    className={
                      styles.decisionSummaryStat
                    }
                  >
                    <strong>
                      {decisionChangesRequestedCount}
                    </strong>

                    <span>
                      Changes requested
                    </span>
                  </span>
                </div>

                {decisionPrimaryApproval ? (
                  <>
                    <button
                      className={
                        styles.decisionNext
                      }
                      type="button"
                      onClick={() =>
                        navigate("/approvals")
                      }
                    >
                      <span
                        className={
                          styles.decisionNextIcon
                        }
                      >
                        <FileCheck2
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.decisionNextCopy
                        }
                      >
                        <small>
                          Next decision
                          {decisionPrimaryType
                            ? ` · ${decisionPrimaryType}`
                            : ""}
                        </small>

                        <strong>
                          {decisionPrimaryApproval
                            .title ||
                            "Campaign decision"}
                        </strong>

                        <span>
                          {decisionPrimarySummary}
                        </span>

                        <em
                          data-tone={
                            isDecisionOverdue(
                              decisionPrimaryApproval,
                            )
                              ? "danger"
                              : decisionPrimaryApproval
                                    .status ===
                                  "changes_requested"
                                ? "warning"
                                : isDecisionDueToday(
                                      decisionPrimaryApproval,
                                    )
                                  ? "today"
                                  : "normal"
                          }
                        >
                          {decisionPrimaryTiming}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {decisionRemainingCount > 0 ? (
                      <button
                        type="button"
                        className={
                          styles.decisionMore
                        }
                        onClick={() =>
                          navigate("/approvals")
                        }
                      >
                        <span>
                          {decisionRemainingCount} more{" "}
                          {decisionRemainingCount === 1
                            ? "decision"
                            : "decisions"}{" "}
                          waiting
                        </span>

                        <ArrowRight
                          size={13}
                        />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.decisionEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        You're clear
                      </strong>

                      <small>
                        No approvals currently require your decision.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("contacts") && (
              <article
                className={`${styles.compactCard} ${styles.candidateContactsCard}`}
                aria-label="Relationship follow-ups requiring attention"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <PhoneCall size={15} />
                    People to contact
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    View contacts
                  </button>
                </div>

                <div className={styles.relationshipMetric}>
                  <strong>
                    {relationshipFollowupQueue.length}
                  </strong>

                  <span>
                    {relationshipFollowupQueue.length === 0
                      ? "No follow-ups need attention"
                      : relationshipFollowupQueue.length === 1
                        ? "Follow-up needs attention"
                        : "Follow-ups need attention"}
                  </span>
                </div>

                <div
                  className={styles.relationshipStats}
                  aria-label="Relationship follow-up summary"
                >
                  <span className={styles.relationshipStat}>
                    <strong>
                      {relationshipOverdueCount}
                    </strong>
                    <span>Overdue</span>
                  </span>

                  <span className={styles.relationshipStat}>
                    <strong>
                      {relationshipDueTodayCount}
                    </strong>
                    <span>Due today</span>
                  </span>

                  <span className={styles.relationshipStat}>
                    <strong>
                      {relationshipHighPriorityCount}
                    </strong>
                    <span>High priority</span>
                  </span>
                </div>

                {relationshipPrimary ? (
                  <>
                    <button
                      type="button"
                      className={styles.relationshipNext}
                      onClick={() =>
                        navigate(
                          relationshipPrimary.route,
                        )
                      }
                    >
                      <span className={styles.relationshipNextIcon}>
                        <PhoneCall size={17} />
                      </span>

                      <span className={styles.relationshipNextCopy}>
                        <small>
                          Next contact
                          {" · "}
                          {relationshipPrimary.relationshipType}
                          {" · "}
                          {relationshipPrimary.channel}
                        </small>

                        <strong>
                          {relationshipPrimary.title}
                        </strong>

                        <span>
                          {relationshipPrimary.detail}
                        </span>

                        <em
                          data-tone={
                            relationshipIsOverdue(
                              relationshipPrimary,
                            )
                              ? "danger"
                              : relationshipIsDueToday(
                                    relationshipPrimary,
                                  )
                                ? "today"
                                : "normal"
                          }
                        >
                          {relationshipPrimaryTiming}
                        </em>
                      </span>

                      <ArrowRight size={15} />
                    </button>

                    {relationshipRemainingCount > 0 ? (
                      <button
                        type="button"
                        className={styles.relationshipMore}
                        onClick={() =>
                          navigate("/contacts")
                        }
                      >
                        <span>
                          {relationshipRemainingCount} more{" "}
                          {relationshipRemainingCount === 1
                            ? "follow-up"
                            : "follow-ups"}{" "}
                          waiting
                        </span>

                        <ArrowRight size={13} />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className={styles.relationshipEmpty}>
                    <CheckCircle2 size={19} />

                    <span>
                      <strong>
                        Relationships are current
                      </strong>

                      <small>
                        No personal follow-ups are due right now.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("commitments") && (
              <article
                className={`${styles.compactCard} ${styles.candidateCommitmentsCard}`}
                aria-label="Campaign commitments requiring follow-through"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Target size={15} />
                    Commitments &amp; follow-ups
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/commitments")
                    }
                  >
                    View commitments
                  </button>
                </div>

                <div className={styles.commitmentMetric}>
                  <strong>
                    {commitmentQueue.length}
                  </strong>

                  <span>
                    {commitmentQueue.length === 0
                      ? "No commitments need follow-through"
                      : commitmentQueue.length === 1
                        ? "Commitment still open"
                        : "Commitments still open"}
                  </span>
                </div>

                <div
                  className={styles.commitmentStats}
                  aria-label="Commitment health summary"
                >
                  <span className={styles.commitmentStat}>
                    <strong>
                      {commitmentOverdueCount}
                    </strong>
                    <span>Overdue</span>
                  </span>

                  <span className={styles.commitmentStat}>
                    <strong>
                      {commitmentAtRiskCount}
                    </strong>
                    <span>At risk</span>
                  </span>

                  <span className={styles.commitmentStat}>
                    <strong>
                      {commitmentDueSoonCount}
                    </strong>
                    <span>Due soon</span>
                  </span>
                </div>

                {commitmentPrimary ? (
                  <>
                    <button
                      type="button"
                      className={styles.commitmentNext}
                      onClick={() =>
                        navigate("/commitments")
                      }
                    >
                      <span className={styles.commitmentNextIcon}>
                        <Target size={17} />
                      </span>

                      <span className={styles.commitmentNextCopy}>
                        <small>
                          Next commitment
                          {" · "}
                          {commitmentPrimary.source}
                        </small>

                        <strong>
                          {commitmentPrimary.title}
                        </strong>

                        <span>
                          {commitmentPrimary.stakeholder}
                        </span>

                        <em
                          data-tone={
                            commitmentIsOverdue(
                              commitmentPrimary,
                            )
                              ? "danger"
                              : commitmentIsAtRisk(
                                    commitmentPrimary,
                                  )
                                ? "warning"
                                : "normal"
                          }
                        >
                          {commitmentPrimaryTiming}
                        </em>
                      </span>

                      <ArrowRight size={15} />
                    </button>

                    {commitmentRemainingCount > 0 ? (
                      <button
                        type="button"
                        className={styles.commitmentMore}
                        onClick={() =>
                          navigate("/commitments")
                        }
                      >
                        <span>
                          {commitmentRemainingCount} more{" "}
                          {commitmentRemainingCount === 1
                            ? "commitment"
                            : "commitments"}{" "}
                          open
                        </span>

                        <ArrowRight size={13} />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className={styles.commitmentEmpty}>
                    <CheckCircle2 size={19} />

                    <span>
                      <strong>
                        Commitments are current
                      </strong>

                      <small>
                        No campaign promises currently need follow-through.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("team-brief") && (
              <article
                className={`${styles.compactCard} ${styles.teamBriefCard}`}
                aria-label="Team executive brief"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Zap size={15} />
                    Team brief
                  </span>

                  <span
                    className={
                      styles.teamBriefWindow
                    }
                  >
                    Last 24 hours
                  </span>
                </div>

                <div
                  className={
                    styles.teamBriefMetric
                  }
                >
                  <strong>
                    {teamBriefUpdates.length}
                  </strong>

                  <span>
                    {teamBriefUpdates.length === 0
                      ? "No meaningful changes to brief"
                      : teamBriefUpdates.length === 1
                        ? "Meaningful team update"
                        : "Meaningful team updates"}
                  </span>
                </div>

                <div
                  className={
                    styles.teamBriefStats
                  }
                  aria-label="Team activity summary"
                >
                  <span
                    className={
                      styles.teamBriefStat
                    }
                  >
                    <strong>
                      {teamBriefCompletedCount}
                    </strong>
                    <span>
                      Completed
                    </span>
                  </span>

                  <span
                    className={
                      styles.teamBriefStat
                    }
                  >
                    <strong>
                      {teamBriefNewWorkCount}
                    </strong>
                    <span>
                      New work
                    </span>
                  </span>

                  <span
                    className={
                      styles.teamBriefStat
                    }
                  >
                    <strong>
                      {teamBriefTeamChangeCount}
                    </strong>
                    <span>
                      Team changes
                    </span>
                  </span>
                </div>

                {teamBriefPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.teamBriefNext
                      }
                      onClick={() =>
                        navigate(
                          teamBriefRoute(
                            teamBriefPrimary,
                          ),
                        )
                      }
                    >
                      <span
                        className={
                          styles.teamBriefNextIcon
                        }
                      >
                        <Zap
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.teamBriefNextCopy
                        }
                      >
                        <small>
                          Latest change
                          {" · "}
                          {teamBriefPrimaryType.label}
                        </small>

                        <strong>
                          {teamBriefPrimary.title ||
                            "Campaign update"}
                        </strong>

                        <span>
                          {teamBriefPrimary.detail ||
                            "Campaign activity was updated."}
                        </span>

                        <em>
                          {teamBriefAge(
                            teamBriefPrimary,
                          )}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {teamBriefRemainingCount > 0 ? (
                      <div
                        className={
                          styles.teamBriefMore
                        }
                      >
                        {teamBriefRemainingCount} more{" "}
                        {teamBriefRemainingCount === 1
                          ? "meaningful update"
                          : "meaningful updates"}{" "}
                        in the last 24 hours
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.teamBriefEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        You're up to date
                      </strong>

                      <small>
                        No significant team changes were recorded in the last 24 hours.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("risk") && (
              <article
                className={`${styles.compactCard} ${styles.candidateRiskCard} ${styles.riskRadarCard} ${
                  campaignRiskQueue.length
                    ? styles.riskRadarAttention
                    : styles.riskRadarClear
                }`}
                aria-label="Campaign risk and compliance radar"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <ShieldCheck size={15} />
                    Risk &amp; compliance
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        campaignRiskPrimary?.route ||
                          "/tasks",
                      )
                    }
                  >
                    {campaignRiskQueue.length
                      ? "Review risks"
                      : "View risk center"}
                  </button>
                </div>

                <div
                  className={
                    styles.riskRadarMetric
                  }
                >
                  <strong>
                    {campaignRiskQueue.length}
                  </strong>

                  <span>
                    {campaignRiskQueue.length === 0
                      ? "No tracked risks need attention"
                      : campaignRiskQueue.length === 1
                        ? "Tracked risk needs attention"
                        : "Tracked risks need attention"}
                  </span>
                </div>

                <div
                  className={
                    styles.riskRadarStats
                  }
                  aria-label="Campaign risk summary"
                >
                  <span
                    className={
                      styles.riskRadarStat
                    }
                  >
                    <strong>
                      {campaignRiskCriticalCount}
                    </strong>
                    <span>
                      Critical
                    </span>
                  </span>

                  <span
                    className={
                      styles.riskRadarStat
                    }
                  >
                    <strong>
                      {campaignRiskDeadlineCount}
                    </strong>
                    <span>
                      Deadline
                    </span>
                  </span>

                  <span
                    className={
                      styles.riskRadarStat
                    }
                  >
                    <strong>
                      {campaignRiskComplianceCount}
                    </strong>
                    <span>
                      Compliance
                    </span>
                  </span>
                </div>

                {campaignRiskPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.riskRadarNext
                      }
                      onClick={() =>
                        navigate(
                          campaignRiskPrimary.route,
                        )
                      }
                    >
                      <span
                        className={
                          styles.riskRadarNextIcon
                        }
                      >
                        <ShieldCheck
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.riskRadarNextCopy
                        }
                      >
                        <small>
                          Top risk
                          {" · "}
                          {campaignRiskPrimary.category}
                          {" · "}
                          {campaignRiskPrimary.severity}
                        </small>

                        <strong>
                          {campaignRiskPrimary.title}
                        </strong>

                        <span>
                          {campaignRiskPrimary.detail}
                        </span>

                        <em
                          data-tone={
                            campaignRiskPrimary.severity
                          }
                        >
                          {campaignRiskDueLabel(
                            campaignRiskPrimary,
                          )}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {campaignRiskRemainingCount > 0 ? (
                      <div
                        className={
                          styles.riskRadarMore
                        }
                      >
                        {campaignRiskRemainingCount} more{" "}
                        {campaignRiskRemainingCount === 1
                          ? "tracked risk"
                          : "tracked risks"}{" "}
                        need review
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.riskRadarEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Risk radar clear
                      </strong>

                      <small>
                        No tracked compliance or operational risks currently need attention.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("tasks") && (
              <article
                className={`${styles.compactCard} ${styles.taskExecutionCard}`}
                aria-label="Task execution pulse"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <CheckCircle2 size={15} />
                    Tasks
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/tasks")
                    }
                  >
                    Open task board
                  </button>
                </div>

                <div
                  className={
                    styles.taskExecutionMetric
                  }
                >
                  <strong>
                    {taskExecutionQueue.length}
                  </strong>

                  <span>
                    {taskExecutionQueue.length === 0
                      ? "No open tasks need execution"
                      : taskExecutionQueue.length === 1
                        ? "Open task"
                        : "Open tasks"}
                  </span>
                </div>

                <div
                  className={
                    styles.taskExecutionStats
                  }
                  aria-label="Task execution summary"
                >
                  <span
                    className={
                      styles.taskExecutionStat
                    }
                  >
                    <strong>
                      {taskExecutionOverdueCount}
                    </strong>
                    <span>
                      Overdue
                    </span>
                  </span>

                  <span
                    className={
                      styles.taskExecutionStat
                    }
                  >
                    <strong>
                      {taskExecutionDueTodayCount}
                    </strong>
                    <span>
                      Due today
                    </span>
                  </span>

                  <span
                    className={
                      styles.taskExecutionStat
                    }
                  >
                    <strong>
                      {taskExecutionInProgressCount}
                    </strong>
                    <span>
                      In progress
                    </span>
                  </span>
                </div>

                {taskExecutionPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.taskExecutionNext
                      }
                      onClick={() =>
                        navigate("/tasks")
                      }
                    >
                      <span
                        className={
                          styles.taskExecutionNextIcon
                        }
                      >
                        <CheckCircle2
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.taskExecutionNextCopy
                        }
                      >
                        <small>
                          Next task
                          {" · "}
                          {taskExecutionPriority}
                          {" · "}
                          {taskExecutionCategory}
                        </small>

                        <strong>
                          {taskExecutionPrimary.title ||
                            "Campaign task"}
                        </strong>

                        <span>
                          {taskExecutionPrimary.detail ||
                            taskExecutionPrimary.description ||
                            "Campaign work needs attention."}
                        </span>

                        <em
                          data-tone={
                            taskExecutionIsOverdue(
                              taskExecutionPrimary,
                            )
                              ? "danger"
                              : taskExecutionIsDueToday(
                                    taskExecutionPrimary,
                                  )
                                ? "today"
                                : "normal"
                          }
                        >
                          {taskExecutionTiming}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {taskExecutionRemainingCount > 0 ? (
                      <div
                        className={
                          styles.taskExecutionMore
                        }
                      >
                        {taskExecutionRemainingCount} more{" "}
                        {taskExecutionRemainingCount === 1
                          ? "open task"
                          : "open tasks"}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.taskExecutionEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Task board clear
                      </strong>

                      <small>
                        No open campaign tasks currently need execution.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("calendar") && (
              <article
                className={`${styles.compactCard} ${styles.calendarPlanningCard}`}
                aria-label="Calendar planning pulse"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <CalendarDays size={15} />
                    Calendar
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/calendar")
                    }
                  >
                    Open calendar
                  </button>
                </div>

                <div
                  className={
                    styles.calendarPlanningMetric
                  }
                >
                  <strong>
                    {calendarPlanningQueue.length}
                  </strong>

                  <span>
                    {calendarPlanningQueue.length === 0
                      ? "No future events scheduled"
                      : calendarPlanningQueue.length === 1
                        ? "Upcoming event"
                        : "Upcoming events"}
                  </span>
                </div>

                <div
                  className={
                    styles.calendarPlanningStats
                  }
                  aria-label="Upcoming calendar summary"
                >
                  <span
                    className={
                      styles.calendarPlanningStat
                    }
                  >
                    <strong>
                      {calendarTomorrowCount}
                    </strong>
                    <span>
                      Tomorrow
                    </span>
                  </span>

                  <span
                    className={
                      styles.calendarPlanningStat
                    }
                  >
                    <strong>
                      {calendarNextSevenDaysCount}
                    </strong>
                    <span>
                      Next 7 days
                    </span>
                  </span>

                  <span
                    className={
                      styles.calendarPlanningStat
                    }
                  >
                    <strong>
                      {calendarLocationTbdCount}
                    </strong>
                    <span>
                      Location TBD
                    </span>
                  </span>
                </div>

                {calendarPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.calendarPlanningNext
                      }
                      onClick={() =>
                        navigate("/calendar")
                      }
                    >
                      <span
                        className={
                          styles.calendarPlanningNextIcon
                        }
                      >
                        <CalendarDays
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.calendarPlanningNextCopy
                        }
                      >
                        <small>
                          Next event
                          {" · "}
                          {calendarEventType}
                        </small>

                        <strong>
                          {calendarPrimary.title ||
                            "Campaign event"}
                        </strong>

                        <span>
                          {calendarPrimaryDetail}
                        </span>

                        <em>
                          {formatCalendarPlanningDate(
                            calendarPrimary.starts_at,
                          )}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {calendarRemainingCount > 0 ? (
                      <div
                        className={
                          styles.calendarPlanningMore
                        }
                      >
                        {calendarRemainingCount} more{" "}
                        {calendarRemainingCount === 1
                          ? "upcoming event"
                          : "upcoming events"}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.calendarPlanningEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Calendar clear ahead
                      </strong>

                      <small>
                        No future campaign events are currently scheduled.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("volunteers") && (
              <article
                className={`${styles.compactCard} ${styles.volunteerCapacityCard}`}
                aria-label="Volunteer field capacity pulse"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Users size={15} />
                    Volunteers
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/volunteers")
                    }
                  >
                    Open volunteer hub
                  </button>
                </div>

                <div
                  className={
                    styles.volunteerCapacityMetric
                  }
                >
                  <strong>
                    {data.volunteerCount}
                  </strong>

                  <span>
                    {data.volunteerCount === 0
                      ? "No active volunteers"
                      : data.volunteerCount === 1
                        ? "Active volunteer"
                        : "Active volunteers"}
                  </span>
                </div>

                <div
                  className={
                    styles.volunteerCapacityStats
                  }
                  aria-label="Volunteer field coverage summary"
                >
                  <span
                    className={
                      styles.volunteerCapacityStat
                    }
                  >
                    <strong>
                      {volunteerRosterAvailable
                        ? shiftsFilled
                        : "—"}
                    </strong>
                    <span>
                      Filled shifts
                    </span>
                  </span>

                  <span
                    className={
                      styles.volunteerCapacityStat
                    }
                  >
                    <strong>
                      {volunteerCoverageConfigured
                        ? volunteerOpenShiftCount
                        : "—"}
                    </strong>
                    <span>
                      Open shifts
                    </span>
                  </span>

                  <span
                    className={
                      styles.volunteerCapacityStat
                    }
                  >
                    <strong>
                      {volunteerCoverageConfigured
                        ? `${volunteerCoverage}%`
                        : "—"}
                    </strong>
                    <span>
                      Coverage
                    </span>
                  </span>
                </div>

                {!volunteerRosterAvailable ? (
                  <button
                    type="button"
                    className={
                      styles.volunteerCapacitySetup
                    }
                    onClick={() =>
                      navigate("/volunteers")
                    }
                  >
                    <span
                      className={
                        styles.volunteerCapacityNextIcon
                      }
                    >
                      <Users size={17} />
                    </span>

                    <span
                      className={
                        styles.volunteerCapacityNextCopy
                      }
                    >
                      <small>
                        Volunteer capacity
                        {" · "}
                        Roster needed
                      </small>

                      <strong>
                        Volunteer roster needs attention
                      </strong>

                      <span>
                        Add active volunteers before Campaign Seat evaluates current field coverage.
                      </span>
                    </span>

                    <ArrowRight size={15} />
                  </button>
                ) : volunteerCoverageNeedsStaffing ? (
                  <button
                    type="button"
                    className={
                      styles.volunteerCapacityNext
                    }
                    onClick={() =>
                      navigate("/volunteers")
                    }
                  >
                    <span
                      className={
                        styles.volunteerCapacityNextIcon
                      }
                    >
                      <Users
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.volunteerCapacityNextCopy
                      }
                    >
                      <small>
                        Field coverage
                        {" · "}
                        Needs staffing
                      </small>

                      <strong>
                        {volunteerOpenShiftCount}{" "}
                        {volunteerOpenShiftCount === 1
                          ? "volunteer shift still needs coverage"
                          : "volunteer shifts still need coverage"}
                      </strong>

                      <span>
                        {shiftsFilled} of {shiftsGoal} planned shifts are filled.
                      </span>

                      <em
                        data-tone="warning"
                      >
                        {volunteerCoverage}% covered
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : volunteerCoverageHealthy ? (
                  <div
                    className={
                      styles.volunteerCapacityEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Volunteer coverage on track
                      </strong>

                      <small>
                        All {shiftsGoal} planned volunteer shifts are currently covered.
                      </small>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.volunteerCapacitySetup
                    }
                    onClick={() =>
                      navigate("/volunteers")
                    }
                  >
                    <span
                      className={
                        styles.volunteerCapacityNextIcon
                      }
                    >
                      <Users
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.volunteerCapacityNextCopy
                      }
                    >
                      <small>
                        Field coverage
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Shift coverage is not configured
                      </strong>

                      <span>
                        Set a volunteer shift goal to monitor field staffing readiness from HQ.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("fundraising") && (
              <article
                className={`${styles.compactCard} ${styles.fundraisingPipelineCard}`}
                aria-label="Fundraising relationship pipeline"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <CircleDollarSign size={15} />
                    Fundraising
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/fundraising")
                    }
                  >
                    Open fundraising
                  </button>
                </div>

                <div
                  className={
                    styles.fundraisingPipelineMetric
                  }
                >
                  <strong>
                    {fundraisingDonorContacts.length}
                  </strong>

                  <span>
                    {fundraisingDonorContacts.length === 0
                      ? "No donor relationships tracked"
                      : fundraisingDonorContacts.length === 1
                        ? "Donor relationship"
                        : "Donor relationships"}
                  </span>
                </div>

                <div
                  className={
                    styles.fundraisingPipelineStats
                  }
                  aria-label="Fundraising relationship summary"
                >
                  <span
                    className={
                      styles.fundraisingPipelineStat
                    }
                  >
                    <strong>
                      {fundraisingDueFollowupCount}
                    </strong>
                    <span>
                      Need follow-up
                    </span>
                  </span>

                  <span
                    className={
                      styles.fundraisingPipelineStat
                    }
                  >
                    <strong>
                      {fundraisingThisWeekCount}
                    </strong>
                    <span>
                      This week
                    </span>
                  </span>

                  <span
                    className={
                      styles.fundraisingPipelineStat
                    }
                  >
                    <strong>
                      {fundraisingUnassignedCount}
                    </strong>
                    <span>
                      Unassigned
                    </span>
                  </span>
                </div>

                {fundraisingPrimary ? (
                  <button
                    type="button"
                    className={
                      styles.fundraisingPipelineNext
                    }
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    <span
                      className={
                        styles.fundraisingPipelineNextIcon
                      }
                    >
                      <CircleDollarSign
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.fundraisingPipelineNextCopy
                      }
                    >
                      <small>
                        Next fundraising action
                        {" · "}
                        {fundraisingPrimaryType}
                        {" · "}
                        {fundraisingPrimaryChannel}
                      </small>

                      <strong>
                        {fundraisingPrimary.full_name ||
                          fundraisingPrimary.organization ||
                          "Donor relationship"}
                      </strong>

                      <span>
                        {fundraisingPrimary.organization ||
                          fundraisingPrimary.email ||
                          "Fundraising relationship"}
                      </span>

                      <em
                        data-tone={
                          fundraisingPrimary.next_follow_up_at &&
                          (
                            fundraisingTimestamp(
                              fundraisingPrimary.next_follow_up_at,
                            ) ??
                            Number.MAX_SAFE_INTEGER
                          ) <=
                            fundraisingNow
                            ? "warning"
                            : "normal"
                        }
                      >
                        {formatFundraisingFollowup(
                          fundraisingPrimary.next_follow_up_at,
                        )}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.fundraisingPipelineSetup
                    }
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    <span
                      className={
                        styles.fundraisingPipelineNextIcon
                      }
                    >
                      <CircleDollarSign
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.fundraisingPipelineNextCopy
                      }
                    >
                      <small>
                        Fundraising pipeline
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Fundraising pipeline needs setup
                      </strong>

                      <span>
                        Add donor relationships to Contacts to begin tracking fundraising follow-through.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("contact-directory") && (
              <article
                className={`${styles.compactCard} ${styles.contactHealthCard}`}
                aria-label="Contact relationship health"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Users size={15} />
                    Contacts
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    Open contacts
                  </button>
                </div>

                <div
                  className={
                    styles.contactHealthMetric
                  }
                >
                  <strong>
                    {contactDirectoryActiveContacts.length}
                  </strong>

                  <span>
                    {contactDirectoryActiveContacts.length === 0
                      ? "No active relationships"
                      : contactDirectoryActiveContacts.length === 1
                        ? "Active relationship"
                        : "Active relationships"}
                  </span>
                </div>

                <div
                  className={
                    styles.contactHealthStats
                  }
                  aria-label="Contact relationship health summary"
                >
                  <span
                    className={
                      styles.contactHealthStat
                    }
                  >
                    <strong>
                      {contactDirectoryUnassignedCount}
                    </strong>
                    <span>
                      Unassigned
                    </span>
                  </span>

                  <span
                    className={
                      styles.contactHealthStat
                    }
                  >
                    <strong>
                      {contactDirectoryFollowupScheduledCount}
                    </strong>
                    <span>
                      Follow-up set
                    </span>
                  </span>

                  <span
                    className={
                      styles.contactHealthStat
                    }
                  >
                    <strong>
                      {contactDirectoryMissingDetailsCount}
                    </strong>
                    <span>
                      Missing details
                    </span>
                  </span>
                </div>

                {contactDirectoryPrimaryIssue ? (
                  <button
                    type="button"
                    className={
                      styles.contactHealthNext
                    }
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    <span
                      className={
                        styles.contactHealthNextIcon
                      }
                    >
                      <Users
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.contactHealthNextCopy
                      }
                    >
                      <small>
                        Relationship gap
                        {" · "}
                        {contactDirectoryPrimaryType}
                      </small>

                      <strong>
                        {contactDirectoryPrimary.full_name ||
                          contactDirectoryPrimary.organization ||
                          "Campaign contact"}
                      </strong>

                      <span>
                        {contactDirectoryPrimary.organization ||
                          contactDirectoryPrimary.email ||
                          contactDirectoryPrimary.phone ||
                          "Campaign relationship"}
                      </span>

                      <em
                        data-tone="warning"
                      >
                        {contactDirectoryPrimaryIssue.issue}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : contactDirectoryActiveContacts.length ? (
                  <div
                    className={
                      styles.contactHealthEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Contact network organized
                      </strong>

                      <small>
                        Active relationships have owners and usable contact information.
                      </small>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.contactHealthSetup
                    }
                    onClick={() =>
                      navigate("/contacts")
                    }
                  >
                    <span
                      className={
                        styles.contactHealthNextIcon
                      }
                    >
                      <Users
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.contactHealthNextCopy
                      }
                    >
                      <small>
                        Contact network
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Contact network needs setup
                      </strong>

                      <span>
                        Add supporters, donors, press, volunteers and community relationships to build your campaign network.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}

                {contactDirectoryHealthIssueCount > 1 ? (
                  <div
                    className={
                      styles.contactHealthMore
                    }
                  >
                    {contactDirectoryHealthIssueCount - 1} more{" "}
                    {contactDirectoryHealthIssueCount - 1 === 1
                      ? "relationship needs cleanup"
                      : "relationships need cleanup"}
                  </div>
                ) : null}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("documents") && (
              <article
                className={`${styles.compactCard} ${styles.documentReadinessCard}`}
                aria-label="Document library readiness"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Files size={15} />
                    Documents
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    Open documents
                  </button>
                </div>

                <div
                  className={
                    styles.documentReadinessMetric
                  }
                >
                  <strong>
                    {documentLibraryFiles.length}
                  </strong>

                  <span>
                    {documentLibraryFiles.length === 0
                      ? "No campaign files stored"
                      : documentLibraryFiles.length === 1
                        ? "Campaign file"
                        : "Campaign files"}
                  </span>
                </div>

                <div
                  className={
                    styles.documentReadinessStats
                  }
                  aria-label="Document library summary"
                >
                  <span
                    className={
                      styles.documentReadinessStat
                    }
                  >
                    <strong>
                      {documentLibraryRecentCount}
                    </strong>
                    <span>
                      Added this week
                    </span>
                  </span>

                  <span
                    className={
                      styles.documentReadinessStat
                    }
                  >
                    <strong>
                      {documentLibraryUncategorizedCount}
                    </strong>
                    <span>
                      Uncategorized
                    </span>
                  </span>

                  <span
                    className={
                      styles.documentReadinessStat
                    }
                  >
                    <strong>
                      {documentLibraryCategoryCount}
                    </strong>
                    <span>
                      Categories
                    </span>
                  </span>
                </div>

                {documentLibraryLatest ? (
                  <button
                    type="button"
                    className={
                      styles.documentReadinessNext
                    }
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    <span
                      className={
                        styles.documentReadinessNextIcon
                      }
                    >
                      <FileText
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.documentReadinessNextCopy
                      }
                    >
                      <small>
                        Latest document
                        {" · "}
                        {documentLibraryLatest.category ||
                          "Uncategorized"}
                        {" · "}
                        {documentLibraryFileType(
                          documentLibraryLatest,
                        )}
                      </small>

                      <strong>
                        {documentLibraryLatest.file_name ||
                          "Campaign file"}
                      </strong>

                      <span>
                        {formatDocumentLibraryBytes(
                          documentLibraryLatest.size_bytes,
                        )}
                      </span>

                      <em>
                        Added{" "}
                        {formatDocumentLibraryDate(
                          documentLibraryLatest.created_at,
                        )}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.documentReadinessSetup
                    }
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    <span
                      className={
                        styles.documentReadinessNextIcon
                      }
                    >
                      <Files
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.documentReadinessNextCopy
                      }
                    >
                      <small>
                        Document library
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Document library needs setup
                      </strong>

                      <span>
                        Upload campaign plans, research, compliance files and shared materials to build the campaign source library.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("approvals") && (
              <article
                className={`${styles.compactCard} ${styles.approvalWorkflowCard}`}
                aria-label="Approval workflow health"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <FileCheck2 size={15} />
                    Approvals
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/approvals")
                    }
                  >
                    Open approvals
                  </button>
                </div>

                <div
                  className={
                    styles.approvalWorkflowMetric
                  }
                >
                  <strong>
                    {approvalWorkflowQueue.length}
                  </strong>

                  <span>
                    {approvalWorkflowQueue.length === 0
                      ? "No items in review workflow"
                      : approvalWorkflowQueue.length === 1
                        ? "Item in review workflow"
                        : "Items in review workflow"}
                  </span>
                </div>

                <div
                  className={
                    styles.approvalWorkflowStats
                  }
                  aria-label="Approval workflow summary"
                >
                  <span
                    className={
                      styles.approvalWorkflowStat
                    }
                  >
                    <strong>
                      {approvalWorkflowPendingCount}
                    </strong>
                    <span>
                      Pending review
                    </span>
                  </span>

                  <span
                    className={
                      styles.approvalWorkflowStat
                    }
                  >
                    <strong>
                      {approvalWorkflowChangesCount}
                    </strong>
                    <span>
                      Changes requested
                    </span>
                  </span>

                  <span
                    className={
                      styles.approvalWorkflowStat
                    }
                  >
                    <strong>
                      {approvalWorkflowDraftCount}
                    </strong>
                    <span>
                      Drafts
                    </span>
                  </span>
                </div>

                {approvalWorkflowPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.approvalWorkflowNext
                      }
                      onClick={() =>
                        navigate("/approvals")
                      }
                    >
                      <span
                        className={
                          styles.approvalWorkflowNextIcon
                        }
                      >
                        <FileCheck2
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.approvalWorkflowNextCopy
                        }
                      >
                        <small>
                          Workflow attention
                          {" · "}
                          {approvalWorkflowPrimaryStatus}
                          {" · "}
                          {approvalWorkflowPrimaryType}
                        </small>

                        <strong>
                          {approvalWorkflowPrimary.title ||
                            "Campaign approval"}
                        </strong>

                        <span>
                          {approvalWorkflowPrimaryDetail}
                        </span>

                        <em
                          data-tone={
                            approvalWorkflowPrimary.status ===
                            "changes_requested"
                              ? "warning"
                              : approvalWorkflowIsOverdue(
                                    approvalWorkflowPrimary,
                                  )
                                ? "danger"
                                : "normal"
                          }
                        >
                          {approvalWorkflowIsOverdue(
                            approvalWorkflowPrimary,
                          )
                            ? "Past due"
                            : approvalWorkflowAge(
                                approvalWorkflowPrimary,
                              )}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {approvalWorkflowRemainingCount > 0 ? (
                      <div
                        className={
                          styles.approvalWorkflowMore
                        }
                      >
                        {approvalWorkflowRemainingCount} more{" "}
                        {approvalWorkflowRemainingCount === 1
                          ? "approval item"
                          : "approval items"}{" "}
                        in workflow
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.approvalWorkflowEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Approval workflow clear
                      </strong>

                      <small>
                        No campaign items are currently waiting in the review pipeline.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("inventory") && (
              <article
                className={`${styles.compactCard} ${styles.inventoryReadinessCard}`}
                aria-label="Inventory supply readiness"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <PackageOpen size={15} />
                    Inventory
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/inventory")
                    }
                  >
                    Open inventory
                  </button>
                </div>

                <div
                  className={
                    styles.inventoryReadinessMetric
                  }
                >
                  <strong>
                    {inventoryActiveItems.length}
                  </strong>

                  <span>
                    {inventoryActiveItems.length === 0
                      ? "No active inventory items"
                      : inventoryActiveItems.length === 1
                        ? "Active inventory item"
                        : "Active inventory items"}
                  </span>
                </div>

                <div
                  className={
                    styles.inventoryReadinessStats
                  }
                >
                  <span
                    className={
                      styles.inventoryReadinessStat
                    }
                  >
                    <strong>
                      {inventoryAvailableUnits}
                    </strong>
                    <span>
                      Available units
                    </span>
                  </span>

                  <span
                    className={
                      styles.inventoryReadinessStat
                    }
                  >
                    <strong>
                      {inventoryLowStockItems.length}
                    </strong>
                    <span>
                      Low stock
                    </span>
                  </span>

                  <span
                    className={
                      styles.inventoryReadinessStat
                    }
                  >
                    <strong>
                      {inventoryOutOfStockItems.length}
                    </strong>
                    <span>
                      Out of stock
                    </span>
                  </span>
                </div>

                {inventoryPrimary ? (
                  <button
                    type="button"
                    className={
                      styles.inventoryReadinessNext
                    }
                    onClick={() =>
                      navigate("/inventory")
                    }
                  >
                    <span
                      className={
                        styles.inventoryReadinessNextIcon
                      }
                    >
                      <PackageOpen
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.inventoryReadinessNextCopy
                      }
                    >
                      <small>
                        Restock priority
                        {" · "}
                        {inventoryPrimaryCategory}
                        {inventoryPurchaseStatus !==
                          "not_ordered"
                          ? ` · ${inventoryPurchaseStatusLabel}`
                          : ""}
                      </small>

                      <strong>
                        {inventoryPrimary.item_name ||
                          "Campaign material"}
                      </strong>

                      <span>
                        {inventoryPrimaryAvailable} available
                        {inventoryPrimaryReorder
                          ? ` · reorder at ${inventoryPrimaryReorder}`
                          : ""}
                        {inventoryPrimary.vendor_name
                          ? ` · ${inventoryPrimary.vendor_name}`
                          : ""}
                      </span>

                      <em
                        data-tone={
                          inventoryPrimaryAvailable <=
                          0
                            ? "danger"
                            : "warning"
                        }
                      >
                        {inventoryPrimaryAvailable <=
                        0
                          ? "Out of stock"
                          : "Low stock"}
                        {inventoryExpectedDelivery
                          ? ` · Expected ${inventoryExpectedDelivery}`
                          : ""}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : inventoryActiveItems.length ? (
                  <div
                    className={
                      styles.inventoryReadinessEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Inventory ready
                      </strong>

                      <small>
                        Active campaign materials are currently above their reorder thresholds.
                      </small>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.inventoryReadinessSetup
                    }
                    onClick={() =>
                      navigate("/inventory")
                    }
                  >
                    <span
                      className={
                        styles.inventoryReadinessNextIcon
                      }
                    >
                      <PackageOpen
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.inventoryReadinessNextCopy
                      }
                    >
                      <small>
                        Supply readiness
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Inventory needs setup
                      </strong>

                      <span>
                        Add signs, palm cards, shirts, canvassing supplies and other campaign materials to track stock readiness.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("candidate") && (
              <article
                className={`${styles.compactCard} ${styles.candidateReadinessCard}`}
                aria-label="Candidate profile readiness"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <BadgeCheck size={15} />
                    Candidate
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/workspace/candidate-profile",
                      )
                    }
                  >
                    Open profile
                  </button>
                </div>

                <div
                  className={
                    styles.candidateReadinessMetric
                  }
                >
                  <strong>
                    {dashboardCandidateLoading
                      ? "—"
                      : `${candidateReadinessPercent}%`}
                  </strong>

                  <span>
                    Profile completeness
                  </span>
                </div>

                <div
                  className={
                    styles.candidateReadinessStats
                  }
                  aria-label="Candidate profile completeness summary"
                >
                  <span
                    className={
                      styles.candidateReadinessStat
                    }
                  >
                    <strong>
                      {dashboardCandidateLoading
                        ? "—"
                        : `${candidateIdentityReadyCount}/${candidateIdentityChecks.length}`}
                    </strong>
                    <span>
                      Identity
                    </span>
                  </span>

                  <span
                    className={
                      styles.candidateReadinessStat
                    }
                  >
                    <strong>
                      {dashboardCandidateLoading
                        ? "—"
                        : `${candidateRaceReadyCount}/${candidateRaceChecks.length}`}
                    </strong>
                    <span>
                      Race
                    </span>
                  </span>

                  <span
                    className={
                      styles.candidateReadinessStat
                    }
                  >
                    <strong>
                      {dashboardCandidateLoading
                        ? "—"
                        : `${candidatePublicReadyCount}/${candidatePublicChecks.length}`}
                    </strong>
                    <span>
                      Public
                    </span>
                  </span>
                </div>

                {!dashboardCandidateLoading &&
                candidateReadinessPrimaryGap ? (
                  <button
                    type="button"
                    className={
                      styles.candidateReadinessNext
                    }
                    onClick={() =>
                      navigate(
                        "/workspace/candidate-profile",
                      )
                    }
                  >
                    <span
                      className={
                        styles.candidateReadinessNextIcon
                      }
                    >
                      <BadgeCheck
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.candidateReadinessNextCopy
                      }
                    >
                      <small>
                        Next profile gap
                        {" · "}
                        {candidateReadinessGroupLabel}
                      </small>

                      <strong>
                        {candidateReadinessPrimaryGap.label}
                      </strong>

                      <span>
                        {candidateReadinessPrimaryGap.description}
                      </span>

                      <em>
                        {candidateReadinessMissingCount}{" "}
                        {candidateReadinessMissingCount === 1
                          ? "core detail missing"
                          : "core details missing"}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : !dashboardCandidateLoading ? (
                  <div
                    className={
                      styles.candidateReadinessEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Candidate profile ready
                      </strong>

                      <small>
                        Core candidate, race and public campaign information is complete.
                      </small>
                    </span>
                  </div>
                ) : (
                  <div
                    className={
                      styles.candidateReadinessLoading
                    }
                  >
                    Loading candidate profile…
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("events") && (
              <article
                className={`${styles.compactCard} ${styles.eventOperationsCard}`}
                aria-label="Event operations readiness"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <CalendarDays size={15} />
                    Events
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/events")
                    }
                  >
                    Open events
                  </button>
                </div>

                <div
                  className={
                    styles.eventOperationsMetric
                  }
                >
                  <strong>
                    {eventOperationsAttentionQueue.length}
                  </strong>

                  <span>
                    {eventOperationsAttentionQueue.length === 0
                      ? "No event operations issues"
                      : eventOperationsAttentionQueue.length === 1
                        ? "Event needs attention"
                        : "Events need attention"}
                  </span>
                </div>

                <div
                  className={
                    styles.eventOperationsStats
                  }
                  aria-label="Event operations summary"
                >
                  <span
                    className={
                      styles.eventOperationsStat
                    }
                  >
                    <strong>
                      {eventOperationsScheduled.length}
                    </strong>
                    <span>
                      Scheduled
                    </span>
                  </span>

                  <span
                    className={
                      styles.eventOperationsStat
                    }
                  >
                    <strong>
                      {eventOperationsLocationTbdCount}
                    </strong>
                    <span>
                      Location TBD
                    </span>
                  </span>

                  <span
                    className={
                      styles.eventOperationsStat
                    }
                  >
                    <strong>
                      {eventOperationsNearCapacityCount}
                    </strong>
                    <span>
                      Near capacity
                    </span>
                  </span>
                </div>

                {eventOperationsPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.eventOperationsNext
                      }
                      onClick={() =>
                        navigate("/events")
                      }
                    >
                      <span
                        className={
                          styles.eventOperationsNextIcon
                        }
                      >
                        <CalendarDays
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.eventOperationsNextCopy
                        }
                      >
                        <small>
                          Event attention
                          {" · "}
                          {eventOperationsPrimaryStatus}
                          {" · "}
                          {eventOperationsPrimaryType}
                        </small>

                        <strong>
                          {eventOperationsPrimary.title ||
                            "Campaign event"}
                        </strong>

                        <span>
                          {eventOperationsPrimaryDetail}
                        </span>

                        <em
                          data-tone={
                            eventOperationsPrimaryStatus ===
                              "At capacity"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {eventOperationsPrimaryStatus}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {eventOperationsRemainingCount > 0 ? (
                      <div
                        className={
                          styles.eventOperationsMore
                        }
                      >
                        {eventOperationsRemainingCount} more{" "}
                        {eventOperationsRemainingCount === 1
                          ? "event needs attention"
                          : "events need attention"}
                      </div>
                    ) : null}
                  </>
                ) : eventOperationsScheduled.length ? (
                  <div
                    className={
                      styles.eventOperationsEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Event operations ready
                      </strong>

                      <small>
                        Scheduled events have their core location and capacity logistics in place.
                      </small>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.eventOperationsSetup
                    }
                    onClick={() =>
                      navigate("/events")
                    }
                  >
                    <span
                      className={
                        styles.eventOperationsNextIcon
                      }
                    >
                      <CalendarDays
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.eventOperationsNextCopy
                      }
                    >
                      <small>
                        Event operations
                        {" · "}
                        No events scheduled
                      </small>

                      <strong>
                        Event pipeline is empty
                      </strong>

                      <span>
                        Add campaign events to begin tracking logistics, locations and RSVP readiness.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("social-media") && (
              <article
                className={`${styles.compactCard} ${styles.socialContentCard}`}
                aria-label="Social content workflow"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <MessageSquare size={15} />
                    Social media
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        socialContentPrimary?.socialRoute ||
                          "/tasks",
                      )
                    }
                  >
                    Review content
                  </button>
                </div>

                <div
                  className={
                    styles.socialContentMetric
                  }
                >
                  <strong>
                    {socialContentActionQueue.length}
                  </strong>

                  <span>
                    {socialContentActionQueue.length === 0
                      ? "No social content needs action"
                      : socialContentActionQueue.length === 1
                        ? "Content item needs action"
                        : "Content items need action"}
                  </span>
                </div>

                <div
                  className={
                    styles.socialContentStats
                  }
                  aria-label="Social content workflow summary"
                >
                  <span
                    className={
                      styles.socialContentStat
                    }
                  >
                    <strong>
                      {socialContentTaskCount}
                    </strong>
                    <span>
                      Tasks
                    </span>
                  </span>

                  <span
                    className={
                      styles.socialContentStat
                    }
                  >
                    <strong>
                      {socialContentApprovalCount}
                    </strong>
                    <span>
                      Awaiting approval
                    </span>
                  </span>

                  <span
                    className={
                      styles.socialContentStat
                    }
                  >
                    <strong>
                      {socialContentOverdueCount}
                    </strong>
                    <span>
                      Overdue
                    </span>
                  </span>
                </div>

                {socialContentPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.socialContentNext
                      }
                      onClick={() =>
                        navigate(
                          socialContentPrimary.socialRoute,
                        )
                      }
                    >
                      <span
                        className={
                          styles.socialContentNextIcon
                        }
                      >
                        <MessageSquare
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.socialContentNextCopy
                        }
                      >
                        <small>
                          Next content action
                          {" · "}
                          {socialContentPrimary.socialKind}
                          {" · "}
                          {socialContentPrimary.socialStatus}
                        </small>

                        <strong>
                          {socialContentPrimary.title ||
                            "Social content"}
                        </strong>

                        <span>
                          {socialContentPrimaryDetail}
                        </span>

                        <em
                          data-tone={
                            socialContentIsOverdue(
                              socialContentPrimary,
                            )
                              ? "danger"
                              : socialContentPrimary.status ===
                                  "changes_requested"
                                ? "warning"
                                : "normal"
                          }
                        >
                          {socialContentPrimaryTiming}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {socialContentRemainingCount > 0 ? (
                      <div
                        className={
                          styles.socialContentMore
                        }
                      >
                        {socialContentRemainingCount} more{" "}
                        {socialContentRemainingCount === 1
                          ? "content item needs action"
                          : "content items need action"}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.socialContentEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        Social content workflow clear
                      </strong>

                      <small>
                        No tracked social-media tasks or approvals currently need action.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("media-center") && (
              <article
                className={`${styles.compactCard} ${styles.mediaCenterCard}`}
                aria-label="Media asset library"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <FolderKanban size={15} />
                    Media center
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    Open media library
                  </button>
                </div>

                <div
                  className={
                    styles.mediaCenterMetric
                  }
                >
                  <strong>
                    {mediaCenterAssets.length}
                  </strong>

                  <span>
                    {mediaCenterAssets.length === 0
                      ? "No media assets stored"
                      : mediaCenterAssets.length === 1
                        ? "Media asset"
                        : "Media assets"}
                  </span>
                </div>

                <div
                  className={
                    styles.mediaCenterStats
                  }
                  aria-label="Media library summary"
                >
                  <span
                    className={
                      styles.mediaCenterStat
                    }
                  >
                    <strong>
                      {mediaCenterImageCount}
                    </strong>
                    <span>
                      Images
                    </span>
                  </span>

                  <span
                    className={
                      styles.mediaCenterStat
                    }
                  >
                    <strong>
                      {mediaCenterMotionCount}
                    </strong>
                    <span>
                      Video / audio
                    </span>
                  </span>

                  <span
                    className={
                      styles.mediaCenterStat
                    }
                  >
                    <strong>
                      {mediaCenterRecentCount}
                    </strong>
                    <span>
                      Added this week
                    </span>
                  </span>
                </div>

                {mediaCenterLatest ? (
                  <button
                    type="button"
                    className={
                      styles.mediaCenterNext
                    }
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    <span
                      className={
                        styles.mediaCenterNextIcon
                      }
                    >
                      <FolderKanban
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.mediaCenterNextCopy
                      }
                    >
                      <small>
                        Latest media
                        {" · "}
                        {mediaCenterLatestType}
                        {" · "}
                        {mediaCenterLatestCategory}
                      </small>

                      <strong>
                        {mediaCenterLatest.file_name ||
                          "Campaign media asset"}
                      </strong>

                      <span>
                        {formatDocumentLibraryBytes(
                          mediaCenterLatest.size_bytes,
                        )}
                      </span>

                      <em>
                        Added{" "}
                        {formatDocumentLibraryDate(
                          mediaCenterLatest.created_at,
                        )}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={
                      styles.mediaCenterSetup
                    }
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    <span
                      className={
                        styles.mediaCenterNextIcon
                      }
                    >
                      <FolderKanban
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.mediaCenterNextCopy
                      }
                    >
                      <small>
                        Media library
                        {" · "}
                        Setup needed
                      </small>

                      <strong>
                        Media library needs assets
                      </strong>

                      <span>
                        Upload campaign photos, graphics, video and audio to build your reusable media library.
                      </span>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("reports-analytics") && (
              <article
                className={`${styles.compactCard} ${styles.reportsAnalyticsCard}`}
                aria-label="Campaign performance pulse"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <BarChart3 size={15} />
                    Reports &amp; analytics
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/reports-analytics",
                      )
                    }
                  >
                    Open reports
                  </button>
                </div>

                <div
                  className={
                    styles.reportsAnalyticsMetric
                  }
                >
                  <strong>
                    {reportsAnalyticsHasBaseline &&
                    reportsAnalyticsOverall !==
                      null
                      ? `${reportsAnalyticsOverall}%`
                      : "—"}
                  </strong>

                  <span>
                    {reportsAnalyticsHasBaseline
                      ? "Campaign health"
                      : "Performance baseline not established"}
                  </span>
                </div>

                <div
                  className={
                    styles.reportsAnalyticsStats
                  }
                  aria-label="Campaign performance summary"
                >
                  {[
                    reportsAnalyticsSignalByKey.field,
                    reportsAnalyticsSignalByKey.communications,
                    reportsAnalyticsSignalByKey.volunteers,
                  ].map(
                    (signal) => (
                      <span
                        key={signal.key}
                        className={
                          styles.reportsAnalyticsStat
                        }
                      >
                        <strong>
                          {reportsAnalyticsHasBaseline &&
                          signal.value !==
                            null
                            ? `${signal.value}%`
                            : "—"}
                        </strong>

                        <span>
                          {signal.label}
                        </span>
                      </span>
                    ),
                  )}
                </div>

                {reportsAnalyticsWeakest ? (
                  <button
                    type="button"
                    className={
                      styles.reportsAnalyticsNext
                    }
                    onClick={() =>
                      navigate(
                        reportsAnalyticsWeakest.route,
                      )
                    }
                  >
                    <span
                      className={
                        styles.reportsAnalyticsNextIcon
                      }
                    >
                      <BarChart3
                        size={17}
                      />
                    </span>

                    <span
                      className={
                        styles.reportsAnalyticsNextCopy
                      }
                    >
                      <small>
                        Performance watch
                        {" · "}
                        {reportsAnalyticsWeakest.label}
                      </small>

                      <strong>
                        {reportsAnalyticsWeakest.label} is the lowest current operating signal
                      </strong>

                      <span>
                        {reportsAnalyticsWeakest.value}% health
                        {" · "}
                        {reportsAnalyticsTrendLabel}
                      </span>

                      <em
                        data-tone={
                          reportsAnalyticsWeakest.value <
                          60
                            ? "danger"
                            : reportsAnalyticsWeakest.value <
                                75
                              ? "warning"
                              : "normal"
                        }
                      >
                        {reportsAnalyticsWeakestTrend}
                      </em>
                    </span>

                    <ArrowRight
                      size={15}
                    />
                  </button>
                ) : (
                  <div
                    className={
                      styles.reportsAnalyticsEmpty
                    }
                  >
                    <BarChart3
                      size={19}
                    />

                    <span>
                      <strong>
                        Performance baseline needs data
                      </strong>

                      <small>
                        Campaign health analytics will appear as operational metrics accumulate.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {activeSpotlightShortcutKeys.includes("waiting-on") && (
              <article
                className={`${styles.compactCard} ${styles.waitingOnRadarCard}`}
                aria-label="Waiting On blocker radar"
              >
                <div className={styles.cardHeading}>
                  <span>
                    <Clock3 size={15} />
                    Waiting On
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/waiting-on",
                      )
                    }
                  >
                    Open Waiting On
                  </button>
                </div>

                <div
                  className={
                    styles.waitingOnRadarMetric
                  }
                >
                  <strong>
                    {waitingOnQueue.length}
                  </strong>

                  <span>
                    {waitingOnQueue.length === 0
                      ? "No tracked blockers"
                      : waitingOnQueue.length === 1
                        ? "Active blocker"
                        : "Active blockers"}
                  </span>
                </div>

                <div
                  className={
                    styles.waitingOnRadarStats
                  }
                  aria-label="Waiting On blocker summary"
                >
                  <span
                    className={
                      styles.waitingOnRadarStat
                    }
                  >
                    <strong>
                      {waitingOnOverdueCount}
                    </strong>
                    <span>
                      Overdue
                    </span>
                  </span>

                  <span
                    className={
                      styles.waitingOnRadarStat
                    }
                  >
                    <strong>
                      {waitingOnFollowupCount}
                    </strong>
                    <span>
                      Follow-up due
                    </span>
                  </span>

                  <span
                    className={
                      styles.waitingOnRadarStat
                    }
                  >
                    <strong>
                      {waitingOnExternalCount}
                    </strong>
                    <span>
                      External
                    </span>
                  </span>
                </div>

                {waitingOnPrimary ? (
                  <>
                    <button
                      type="button"
                      className={
                        styles.waitingOnRadarNext
                      }
                      onClick={() =>
                        navigate(
                          "/waiting-on",
                        )
                      }
                    >
                      <span
                        className={
                          styles.waitingOnRadarNextIcon
                        }
                      >
                        <Clock3
                          size={17}
                        />
                      </span>

                      <span
                        className={
                          styles.waitingOnRadarNextCopy
                        }
                      >
                        <small>
                          Top blocker
                          {" · "}
                          {waitingOnPrimarySource}
                          {" · "}
                          {waitingOnPrimaryCategory}
                        </small>

                        <strong>
                          {waitingOnPrimary.title ||
                            "Campaign blocker"}
                        </strong>

                        <span>
                          Waiting on{" "}
                          {waitingOnPrimary.waitingFor}
                        </span>

                        <em
                          data-tone={
                            waitingOnIsOverdue(
                              waitingOnPrimary,
                            )
                              ? "danger"
                              : waitingOnNeedsFollowup(
                                    waitingOnPrimary,
                                  )
                                ? "warning"
                                : "normal"
                          }
                        >
                          {waitingOnPrimaryTiming}
                        </em>
                      </span>

                      <ArrowRight
                        size={15}
                      />
                    </button>

                    {waitingOnRemainingCount > 0 ? (
                      <div
                        className={
                          styles.waitingOnRadarMore
                        }
                      >
                        {waitingOnRemainingCount} more{" "}
                        {waitingOnRemainingCount === 1
                          ? "blocker is waiting"
                          : "blockers are waiting"}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={
                      styles.waitingOnRadarEmpty
                    }
                  >
                    <CheckCircle2
                      size={19}
                    />

                    <span>
                      <strong>
                        No active blockers
                      </strong>

                      <small>
                        No tracked campaign work is currently waiting on an outside response or dependency.
                      </small>
                    </span>
                  </div>
                )}
              </article>
            )}

            {SPOTLIGHT_SHORTCUT_OPTIONS
              .filter(
                (option) =>
                  option.kind === "module" &&
                  option.key !== "tasks" &&
                  option.key !== "calendar" &&
                  option.key !== "volunteers" &&
                  option.key !== "fundraising" &&
                  option.key !== "contact-directory" &&
                  option.key !== "documents" &&
                  option.key !== "approvals" &&
                  option.key !== "inventory" &&
                  option.key !== "candidate" &&
                  option.key !== "events" &&
                  option.key !== "social-media" &&
                  option.key !== "media-center" &&
                  option.key !== "reports-analytics" &&
                  option.key !== "waiting-on" &&
                  activeSpotlightShortcutKeys.includes(
                    option.key,
                  ),
              )
              .map((option) => {
                const Icon = option.icon;

                return (
                  <article
                    key={`hq-module-${option.key}`}
                    className={`${styles.compactCard} ${styles.hqModuleShortcutCard}`}
                    aria-label={`${option.label} HQ widget`}
                  >
                    <div className={styles.cardHeading}>
                      <span>
                        <Icon size={15} />
                        {option.label}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(option.route)
                        }
                      >
                        Open
                      </button>
                    </div>

                    <div
                      className={
                        styles.hqModuleShortcutBody
                      }
                    >
                      <span
                        className={
                          styles.hqModuleShortcutIcon
                        }
                      >
                        <Icon size={24} />
                      </span>

                      <div>
                        <strong>
                          {option.label}
                        </strong>

                        <p>
                          {option.description}
                        </p>
                      </div>
                    </div>

                    <button
                      className={
                        styles.hqModuleShortcutAction
                      }
                      type="button"
                      onClick={() =>
                        navigate(option.route)
                      }
                    >
                      <span>
                        Open {option.label}
                      </span>

                      <ArrowRight size={14} />
                    </button>
                  </article>
                );
              })}
          </section>
          {/* CAMPAIGN SEAT DECISION GRID — END */}

          <footer className={styles.footer}>
            <span>
              © 2026 Campaign Seat Technologies LLC
            </span>

            <span>
              Authorized campaign use only
            </span>
          </footer>
      </main>
    </CampaignWorkspaceShell>
  );
}
