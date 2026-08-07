import { useMemo, useState } from "react";
import {
  Archive,
  AtSign,
  Bot,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  LoaderCircle,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Filter,
  Flag,
  Hash,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Tag,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { CampaignWorkspaceShell } from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";
import { useContactsCommandCenter } from "../../hooks/useContactsCommandCenter";
import { useTasksCommandCenter } from "../../hooks/useTasksCommandCenter";
import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./InboxReferencePreview.module.css";

const CHANNELS = [
  {
    id: "all",
    label: "All Messages",
    icon: Inbox,
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
  },
  {
    id: "sms",
    label: "SMS / Text",
    icon: Phone,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: MessageSquare,
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: AtSign,
  },
  {
    id: "x",
    label: "X / Twitter",
    icon: Hash,
  },
];

const FILTERS = [
  {
    id: "unread",
    label: "Unread",
    icon: Mail,
  },
  {
    id: "priority",
    label: "High Priority",
    icon: Star,
  },
  {
    id: "needs-response",
    label: "Needs Response",
    icon: Clock3,
  },
  {
    id: "mentions",
    label: "Mentions Me",
    icon: AtSign,
  },
  {
    id: "flagged",
    label: "Flagged",
    icon: Flag,
  },
  {
    id: "archived",
    label: "Archived",
    icon: Archive,
  },
];

const TAGS = [
  "Voters",
  "Donors",
  "Volunteers",
  "Media",
  "Events",
  "Press",
];

const SUMMARY_METRICS = [
  {
    id: "unread",
    label: "Unread",
    detail: "New conversations",
    icon: Mail,
    tone: "red",
  },
  {
    id: "needs-response",
    label: "Needs Reply",
    detail: "Waiting on the campaign",
    icon: Clock3,
    tone: "blue",
  },
  {
    id: "priority",
    label: "High Priority",
    detail: "Requires action",
    icon: Star,
    tone: "gold",
  },
];

const EMPTY_CONTACT_FORM = {
  fullName: "",
  email: "",
  phone: "",
  organization: "",
  emailConsent: false,
  smsConsent: false,
};

function getEasternDateInput(daysAhead = 0) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    },
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ["year", "month", "day"].includes(
          part.type,
        ),
      )
      .map((part) => [
        part.type,
        Number(part.value),
      ]),
  );

  const date = new Date(
    Date.UTC(
      values.year,
      values.month - 1,
      values.day + daysAhead,
    ),
  );

  return date.toISOString().slice(0, 10);
}

function defaultTaskForm(conversation, userId) {
  return {
    title: `Follow up with ${conversation?.sender || "contact"}`,
    description: conversation?.subject
      ? `Inbox follow-up: ${conversation.subject}`
      : "Inbox follow-up",
    dueDate: getEasternDateInput(1),
    dueTime: "17:00",
    priority: conversation?.priority ? "high" : "normal",
    assignedTo: userId || "",
  };
}

function toTaskDueIso(dateValue, timeValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(
    `${dateValue}T${timeValue || "17:00"}:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function contactName(contact) {
  return (
    contact?.full_name ||
    contact?.name ||
    contact?.email ||
    contact?.phone ||
    "Campaign contact"
  );
}

function contactInitials(contact) {
  return contactName(contact)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const STARTING_CONVERSATIONS = [
  {
    id: "reporter",
    sender: "Palm Beach Post Reporter",
    initials: "PB",
    email: "pbreporter@pbpost.com",
    phone: "+15615550148",
    channel: "email",
    subject: "Interview request for Elizabeth",
    preview:
      "Interview request regarding District 6 and upcoming initiatives.",
    time: "11:15 AM",
    order: 8,
    unread: true,
    unreadCount: 1,
    priority: true,
    needsResponse: true,
    mentions: true,
    flagged: false,
    archived: false,
    tags: ["Media", "Press"],
    external: true,
    details: {
      organization: "Palm Beach Post",
      role: "Political Reporter",
      location: "Palm Beach County, Florida",
      lastContact: "Today at 11:15 AM",
    },
    messages: [
      {
        id: "reporter-inbound",
        direction: "inbound",
        author: "Palm Beach Post Reporter",
        initials: "PB",
        time: "11:15 AM",
        channel: "Email",
        body:
          "Hi Chris,\n\nI'm reaching out to request an interview with Elizabeth Accomando regarding her vision for District 6 and upcoming initiatives.\n\nWould she be available sometime this week?\n\nBest,\nSarah Klein\nPolitical Reporter\nPalm Beach Post",
      },
      {
        id: "reporter-outbound",
        direction: "outbound",
        author: "You",
        initials: "CI",
        time: "11:18 AM",
        channel: "Dashboard",
        body:
          "Hi Sarah,\n\nThanks for reaching out. Elizabeth is available Wednesday afternoon or Thursday morning. Let me know which works best for you.\n\nBest,\nChris",
      },
    ],
    files: [
      {
        name: "Interview Questions.pdf",
        size: "245 KB",
      },
      {
        name: "Campaign Bio — Elizabeth.docx",
        size: "1.2 MB",
      },
    ],
  },
  {
    id: "john",
    sender: "John Smith",
    initials: "JS",
    email: "john.smith@example.com",
    phone: "+15615550219",
    channel: "sms",
    subject: "Following up on yard sign delivery",
    preview:
      "Checking whether the yard signs can be delivered Friday.",
    time: "10:45 AM",
    order: 7,
    unread: true,
    unreadCount: 2,
    priority: false,
    needsResponse: true,
    mentions: false,
    flagged: false,
    archived: false,
    tags: ["Voters", "Events"],
    external: true,
    details: {
      organization: "Community Supporter",
      role: "Event Volunteer",
      location: "Wellington, Florida",
      lastContact: "Today at 10:45 AM",
    },
    messages: [
      {
        id: "john-inbound",
        direction: "inbound",
        author: "John Smith",
        initials: "JS",
        time: "10:45 AM",
        channel: "SMS",
        body:
          "Hi Chris, just checking whether the yard signs can be delivered Friday before the neighborhood event.",
      },
    ],
    files: [],
  },
  {
    id: "volunteer",
    sender: "Volunteer Coordinator",
    initials: "VC",
    email: "volunteers@campaignseat.local",
    phone: "+15615550361",
    channel: "email",
    subject: "Can you send the updated schedule?",
    preview:
      "Three routes still need captains and the schedule needs approval.",
    time: "9:15 AM",
    order: 6,
    unread: false,
    unreadCount: 0,
    priority: true,
    needsResponse: true,
    mentions: true,
    flagged: true,
    archived: false,
    tags: ["Volunteers", "Events"],
    external: false,
    details: {
      organization: "Accomando Campaign",
      role: "Volunteer Coordinator",
      location: "District 6",
      lastContact: "Today at 9:15 AM",
    },
    messages: [
      {
        id: "volunteer-inbound",
        direction: "inbound",
        author: "Volunteer Coordinator",
        initials: "VC",
        time: "9:15 AM",
        channel: "Email",
        body:
          "The weekend schedule is almost complete. Can you send the approved version after the final route captains are assigned?",
      },
    ],
    files: [
      {
        name: "Weekend Volunteer Schedule.xlsx",
        size: "486 KB",
      },
    ],
  },
  {
    id: "chamber",
    sender: "Wellington Chamber",
    initials: "WC",
    email: "events@wellingtonchamber.com",
    phone: "+15615550542",
    channel: "email",
    subject: "Partnership opportunity discussion",
    preview:
      "Invitation to discuss a partnership for the community forum.",
    time: "Yesterday",
    order: 5,
    unread: false,
    unreadCount: 0,
    priority: false,
    needsResponse: false,
    mentions: false,
    flagged: false,
    archived: false,
    tags: ["Events", "Donors"],
    external: true,
    details: {
      organization: "Wellington Chamber",
      role: "Community Partner",
      location: "Wellington, Florida",
      lastContact: "Yesterday",
    },
    messages: [
      {
        id: "chamber-inbound",
        direction: "inbound",
        author: "Wellington Chamber",
        initials: "WC",
        time: "Yesterday",
        channel: "Email",
        body:
          "We would like to discuss partnering on the upcoming community forum and July luncheon.",
      },
    ],
    files: [
      {
        name: "Community Partnership Outline.pdf",
        size: "318 KB",
      },
    ],
  },
  {
    id: "jane",
    sender: "Jane Doe",
    initials: "JD",
    email: "jane.doe@example.com",
    phone: "+15615550427",
    channel: "whatsapp",
    subject: "Re: Event this Saturday",
    preview:
      "Confirming attendance and volunteer check-in time.",
    time: "Yesterday",
    order: 4,
    unread: true,
    unreadCount: 1,
    priority: false,
    needsResponse: false,
    mentions: false,
    flagged: false,
    archived: false,
    tags: ["Volunteers", "Events"],
    external: true,
    details: {
      organization: "Community Volunteer",
      role: "Event Support",
      location: "Palm Beach County",
      lastContact: "Yesterday",
    },
    messages: [
      {
        id: "jane-inbound",
        direction: "inbound",
        author: "Jane Doe",
        initials: "JD",
        time: "Yesterday",
        channel: "WhatsApp",
        body:
          "I can attend Saturday. What time should volunteers arrive for check-in?",
      },
    ],
    files: [],
  },
  {
    id: "printing",
    sender: "Acme Printing",
    initials: "AP",
    email: "proofs@acmeprinting.com",
    phone: "+15615550688",
    channel: "email",
    subject: "Yard sign proofs are ready for review",
    preview:
      "Updated sign proofs are ready for final campaign approval.",
    time: "Jul 15",
    order: 3,
    unread: false,
    unreadCount: 0,
    priority: true,
    needsResponse: true,
    mentions: false,
    flagged: true,
    archived: false,
    tags: ["Media"],
    external: true,
    details: {
      organization: "Acme Printing",
      role: "Campaign Vendor",
      location: "Palm Beach County",
      lastContact: "July 15",
    },
    messages: [
      {
        id: "printing-inbound",
        direction: "inbound",
        author: "Acme Printing",
        initials: "AP",
        time: "Jul 15",
        channel: "Email",
        body:
          "The updated yard sign proofs are attached and ready for final approval.",
      },
    ],
    files: [
      {
        name: "Yard Sign Proof — Final.pdf",
        size: "3.8 MB",
      },
    ],
  },
  {
    id: "emily",
    sender: "Emily R.",
    initials: "ER",
    email: "emily.r@example.com",
    phone: "+15615550713",
    channel: "instagram",
    subject: "Interested in volunteering",
    preview:
      "New volunteer asking about canvassing and community events.",
    time: "Jul 15",
    order: 2,
    unread: false,
    unreadCount: 0,
    priority: false,
    needsResponse: true,
    mentions: false,
    flagged: false,
    archived: false,
    tags: ["Volunteers"],
    external: true,
    details: {
      organization: "District 6 Resident",
      role: "Prospective Volunteer",
      location: "District 6",
      lastContact: "July 15",
    },
    messages: [
      {
        id: "emily-inbound",
        direction: "inbound",
        author: "Emily R.",
        initials: "ER",
        time: "Jul 15",
        channel: "Instagram",
        body:
          "I live in District 6 and would like to volunteer. How can I help with canvassing or events?",
      },
    ],
    files: [],
  },
  {
    id: "david",
    sender: "David Johnson",
    initials: "DJ",
    email: "david.johnson@example.com",
    phone: "+15615550866",
    channel: "sms",
    subject: "Question about upcoming debate",
    preview:
      "Question about the debate location and attendance.",
    time: "Jul 14",
    order: 1,
    unread: false,
    unreadCount: 0,
    priority: false,
    needsResponse: false,
    mentions: false,
    flagged: false,
    archived: true,
    tags: ["Voters", "Press"],
    external: true,
    details: {
      organization: "District 6 Resident",
      role: "Voter",
      location: "Wellington, Florida",
      lastContact: "July 14",
    },
    messages: [
      {
        id: "david-inbound",
        direction: "inbound",
        author: "David Johnson",
        initials: "DJ",
        time: "Jul 14",
        channel: "Phone",
        body:
          "Where is the upcoming debate being held, and is advance registration required?",
      },
    ],
    files: [],
  },
];

const REPLY_CHANNELS = [
  {
    id: "email",
    label: "Email",
    icon: Mail,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Inbox,
  },
  {
    id: "text",
    label: "Text",
    icon: Phone,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
  },
];

const QUICK_REPLIES = [
  "Sounds good",
  "Let me confirm",
  "Can you send details?",
];

function getChannelLabel(channel) {
  return (
    CHANNELS.find((item) => item.id === channel)
      ?.label || channel
  );
}

export default function InboxReferencePreview() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();

  const {
    contacts: liveContacts,
    isLoading: contactsLoading,
    isSaving: contactsSaving,
    error: contactsError,
    saveContact,
  } = useContactsCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const {
    team,
    isSaving: taskSaving,
    error: taskError,
    createTask,
  } = useTasksCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
    selectedTaskId: "",
  });

  const [conversations, setConversations] =
    useState(STARTING_CONVERSATIONS);

  const [selectedId, setSelectedId] =
    useState(STARTING_CONVERSATIONS[0].id);

  const [activeChannel, setActiveChannel] =
    useState("all");

  const [activeFilter, setActiveFilter] =
    useState("");

  const [activeTag, setActiveTag] = useState("");

  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);

  const [query, setQuery] = useState("");

  const [sortDirection, setSortDirection] =
    useState("newest");

  const [activeThreadTab, setActiveThreadTab] =
    useState("conversation");

  const [replyChannel, setReplyChannel] =
    useState("email");

  const [replyText, setReplyText] = useState("");

  const [newMessageMode, setNewMessageMode] =
    useState(false);

  const [newRecipient, setNewRecipient] =
    useState("");

  const [newSubject, setNewSubject] =
    useState("");

  const [contactQuery, setContactQuery] =
    useState("");

  const [selectedContactId, setSelectedContactId] =
    useState("");

  const [contactCreateMode, setContactCreateMode] =
    useState(false);

  const [contactForm, setContactForm] =
    useState(EMPTY_CONTACT_FORM);

  const [contactFormError, setContactFormError] =
    useState("");

  const [quickTaskOpen, setQuickTaskOpen] =
    useState(false);

  const [quickTaskForm, setQuickTaskForm] =
    useState(() =>
      defaultTaskForm(
        STARTING_CONVERSATIONS[0],
        user.id,
      ),
    );

  const [quickTaskError, setQuickTaskError] =
    useState("");

  const [activityLog, setActivityLog] =
    useState([
      {
        id: "initial-activity",
        action: "Conversation opened",
        detail:
          "Campaign Seat is tracking whether this request receives a response.",
        time: "Today",
      },
    ]);

  const [toast, setToast] = useState(
    "Inbox ready.",
  );

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id === selectedId,
    ) || conversations[0];

  const contacts = useMemo(() => {
    const savedContacts =
      Array.isArray(liveContacts)
        ? liveContacts
        : [];

    const inboxContacts =
      conversations.map((conversation) => ({
        id:
          conversation.contactId ||
          `inbox-${conversation.id}`,
        full_name: conversation.sender,
        email: conversation.email || "",
        phone: conversation.phone || "",
        organization:
          conversation.details?.organization ||
          "",
        contact_type: "inbox_contact",
        precinct:
          conversation.details?.location ||
          "",
        tags:
          Array.isArray(conversation.tags)
            ? conversation.tags
            : [],
        inboxOnly: true,
      }));

    const uniqueContacts = [];
    const seen = new Set();

    [
      ...savedContacts,
      ...inboxContacts,
    ].forEach((contact) => {
      const key =
        String(contact.email || "")
          .trim()
          .toLowerCase() ||
        String(contact.phone || "")
          .replace(/\D/g, "") ||
        contactName(contact)
          .trim()
          .toLowerCase();

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      uniqueContacts.push(contact);
    });

    return uniqueContacts.sort(
      (left, right) =>
        contactName(left).localeCompare(
          contactName(right),
        ),
    );
  }, [liveContacts, conversations]);

  const selectedContact =
    contacts.find(
      (contact) =>
        contact.id === selectedContactId,
    ) || null;

  const subjectEnabled =
    replyChannel === "email" ||
    replyChannel === "dashboard";

  const filteredContacts = useMemo(() => {
    const term = contactQuery
      .trim()
      .toLowerCase();

    if (!term) {
      return contacts;
    }

    return contacts.filter((contact) =>
      [
        contact.full_name,
        contact.email,
        contact.phone,
        contact.organization,
        contact.contact_type,
        ...(Array.isArray(contact.tags)
          ? contact.tags
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [contactQuery, contacts]);

  const summaryMetrics = useMemo(
    () =>
      SUMMARY_METRICS.map((metric) => {
        const value =
          metric.id === "unread"
            ? conversations.filter(
                (conversation) =>
                  conversation.unread,
              ).length
            : metric.id === "needs-response"
              ? conversations.filter(
                  (conversation) =>
                    conversation.needsResponse &&
                    !conversation.archived,
                ).length
              : conversations.filter(
                  (conversation) =>
                    conversation.priority &&
                    !conversation.archived,
                ).length;

        return {
          ...metric,
          value,
        };
      }),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    const filtered = conversations.filter(
      (conversation) => {
        if (
          activeChannel !== "all" &&
          conversation.channel !== activeChannel
        ) {
          return false;
        }

        if (
          activeFilter === "unread" &&
          !conversation.unread
        ) {
          return false;
        }

        if (
          activeFilter === "priority" &&
          !conversation.priority
        ) {
          return false;
        }

        if (
          activeFilter === "needs-response" &&
          !conversation.needsResponse
        ) {
          return false;
        }

        if (
          activeFilter === "mentions" &&
          !conversation.mentions
        ) {
          return false;
        }

        if (
          activeFilter === "flagged" &&
          !conversation.flagged
        ) {
          return false;
        }

        if (
          activeFilter === "archived" &&
          !conversation.archived
        ) {
          return false;
        }

        if (
          activeTag &&
          !conversation.tags.includes(activeTag)
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          conversation.sender,
          conversation.email,
          conversation.subject,
          conversation.preview,
          ...conversation.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      },
    );

    return [...filtered].sort((a, b) =>
      sortDirection === "newest"
        ? b.order - a.order
        : a.order - b.order,
    );
  }, [
    activeChannel,
    activeFilter,
    activeTag,
    conversations,
    query,
    sortDirection,
  ]);

  const getChannelCount = (channelId) => {
    if (channelId === "all") {
      return conversations.length;
    }

    return conversations.filter(
      (conversation) =>
        conversation.channel === channelId,
    ).length;
  };

  const getFilterCount = (filterId) => {
    if (filterId === "unread") {
      return conversations.filter(
        (conversation) => conversation.unread,
      ).length;
    }

    if (filterId === "priority") {
      return conversations.filter(
        (conversation) =>
          conversation.priority,
      ).length;
    }

    if (filterId === "needs-response") {
      return conversations.filter(
        (conversation) =>
          conversation.needsResponse,
      ).length;
    }

    if (filterId === "mentions") {
      return conversations.filter(
        (conversation) =>
          conversation.mentions,
      ).length;
    }

    if (filterId === "flagged") {
      return conversations.filter(
        (conversation) =>
          conversation.flagged,
      ).length;
    }

    if (filterId === "archived") {
      return conversations.filter(
        (conversation) =>
          conversation.archived,
      ).length;
    }

    return 0;
  };

  const openNewMessage = () => {
    setNewMessageMode(true);
    setReplyText("");
    setNewRecipient("");
    setNewSubject("");
    setContactQuery("");
    setSelectedContactId("");
    setContactCreateMode(false);
    setContactForm(EMPTY_CONTACT_FORM);
    setContactFormError("");
    setActiveThreadTab("conversation");
  };

  const selectContact = (contact) => {
    const name = contactName(contact);

    setSelectedContactId(contact.id);
    setContactQuery(name);
    setNewRecipient(
      contact.email ||
        contact.phone ||
        name,
    );
    setContactCreateMode(false);
    setContactFormError("");

    if (
      !contact.email &&
      contact.phone
    ) {
      setReplyChannel("text");
    } else {
      setReplyChannel("email");
    }
  };

  const handleCreateContact = async (event) => {
    event.preventDefault();
    setContactFormError("");

    if (!contactForm.fullName.trim()) {
      setContactFormError(
        "Enter the contact’s full name.",
      );
      return;
    }

    if (
      !contactForm.email.trim() &&
      !contactForm.phone.trim()
    ) {
      setContactFormError(
        "Enter an email address or phone number.",
      );
      return;
    }

    try {
      const created = await saveContact({
        fullName: contactForm.fullName,
        email: contactForm.email,
        phone: contactForm.phone,
        organization:
          contactForm.organization,
        contactType: "supporter",
        assignedTo: user.id,
        precinct: "",
        source: "Inbox",
        status: "active",
        notes:
          "Created while starting a new Inbox conversation.",
        tags: ["Inbox"],
        lastContactAt: null,
        nextFollowUpAt: null,
        emailConsent:
          contactForm.emailConsent,
        smsConsent:
          contactForm.smsConsent,
        consentSource: "Inbox",
      });

      if (created) {
        selectContact(created);
        setContactForm(EMPTY_CONTACT_FORM);
        setToast(
          `${contactName(created)} added to Contacts.`,
        );
      }
    } catch (createError) {
      setContactFormError(
        createError?.message ||
          "The contact could not be created.",
      );
    }
  };

  const openQuickTask = () => {
    setQuickTaskForm(
      defaultTaskForm(
        selectedConversation,
        user.id,
      ),
    );
    setQuickTaskError("");
    setQuickTaskOpen(true);
  };

  const handleCreateQuickTask = async (event) => {
    event.preventDefault();
    setQuickTaskError("");

    if (!quickTaskForm.title.trim()) {
      setQuickTaskError(
        "Enter a task title.",
      );
      return;
    }

    const dueAt = toTaskDueIso(
      quickTaskForm.dueDate,
      quickTaskForm.dueTime,
    );

    try {
      await createTask({
        title: quickTaskForm.title.trim(),
        description: [
          quickTaskForm.description.trim(),
          selectedConversation?.email
            ? `Email: ${selectedConversation.email}`
            : "",
          selectedConversation?.phone
            ? `Phone: ${selectedConversation.phone}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        category: "Communications",
        priority: quickTaskForm.priority,
        status: "open",
        visibility: "workspace",
        tags: [
          "Inbox",
          "Follow-up",
          selectedConversation?.sender ||
            "Campaign contact",
        ],
        due_at: dueAt,
        assigned_to:
          quickTaskForm.assignedTo ||
          user.id ||
          null,
      });

      setQuickTaskOpen(false);

      addActivity(
        "Quick task created",
        `Follow-up task created for ${selectedConversation.sender}.`,
      );

      setToast(
        `Task created for ${selectedConversation.sender}.`,
      );
    } catch (createError) {
      setQuickTaskError(
        createError?.message ||
          "The task could not be created.",
      );
    }
  };

  const openConversation = (id) => {
    setSelectedId(id);
    setNewMessageMode(false);
    setActiveThreadTab("conversation");

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              unread: false,
              unreadCount: 0,
            }
          : conversation,
      ),
    );

    setToast("Conversation opened.");
  };

  const addActivity = (action, detail) => {
    setActivityLog((current) => [
      {
        id: `${Date.now()}-${action}`,
        action,
        detail,
        time: "Just now",
      },
      ...current,
    ]);
  };

  const openExternalChannel = (channel) => {
    const body = encodeURIComponent(
      replyText.trim() ||
        `Hi ${selectedConversation.sender}, following up regarding ${selectedConversation.subject}.`,
    );

    if (channel === "text") {
      window.open(
        `sms:${selectedConversation.phone}?&body=${body}`,
        "_self",
      );
    }

    if (channel === "whatsapp") {
      const phone =
        selectedConversation.phone.replace(
          /\D/g,
          "",
        );

      window.open(
        `https://wa.me/${phone}?text=${body}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    addActivity(
      `${channel} opened`,
      "External messaging activity requires confirmation because Campaign Seat cannot yet read the reply.",
    );

    setToast(
      `${channel} opened. Confirm the result when you return.`,
    );
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      setToast("Write a reply first.");
      return;
    }

    if (
      replyChannel === "text" ||
      replyChannel === "whatsapp"
    ) {
      openExternalChannel(replyChannel);
      return;
    }

    const newThreadMessage = {
      id: `reply-${selectedConversation.id}-${(selectedConversation.messages?.length || 0) + 1}`,
      direction: "outbound",
      author: "You",
      initials: "CI",
      time: "Just now",
      channel:
        replyChannel === "dashboard"
          ? "Dashboard"
          : "Email",
      body: replyText.trim(),
    };

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id ===
        selectedConversation.id
          ? {
              ...conversation,
              needsResponse: false,
              messages: [
                ...conversation.messages,
                newThreadMessage,
              ],
            }
          : conversation,
      ),
    );

    addActivity(
      `${newThreadMessage.channel} sent`,
      "This preview records the reply in the current browser session. External email delivery is not connected yet.",
    );

    setReplyText("");

    setToast(
      `${newThreadMessage.channel} reply added.`,
    );
  };

  const sendNewMessage = () => {
    const recipientName =
      selectedContact
        ? contactName(selectedContact)
        : contactQuery.trim() ||
          newRecipient.trim();

    const recipientEmail =
      selectedContact?.email ||
      (
        newRecipient.includes("@")
          ? newRecipient.trim()
          : ""
      );

    const recipientPhone =
      selectedContact?.phone ||
      (
        !newRecipient.includes("@")
          ? newRecipient.trim()
          : ""
      );

    const destination =
      replyChannel === "text" ||
      replyChannel === "whatsapp"
        ? recipientPhone
        : replyChannel === "dashboard"
          ? recipientName
          : recipientEmail;

    if (
      !recipientName ||
      !destination ||
      (
        subjectEnabled &&
        !newSubject.trim()
      ) ||
      !replyText.trim()
    ) {
      setToast(
        subjectEnabled
          ? "Choose a contact, then enter a subject and message."
          : "Choose a contact, then enter your message.",
      );
      return;
    }

    const nextConversationOrder =
      conversations.reduce(
        (highest, conversation) =>
          Math.max(
            highest,
            Number(conversation.order) || 0,
          ),
        0,
      ) + 1;

    const newConversation = {
      id: `new-${nextConversationOrder}`,
      contactId:
        selectedContact?.inboxOnly
          ? null
          : selectedContact?.id || null,
      sender: recipientName,
      initials:
        selectedContact
          ? contactInitials(selectedContact)
          : recipientName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
      email: recipientEmail,
      phone: recipientPhone,
      channel:
        replyChannel === "dashboard"
          ? "email"
          : replyChannel === "text"
            ? "sms"
            : replyChannel,
      subject:
        subjectEnabled
          ? newSubject.trim()
          : replyText.trim().slice(0, 72),
      preview: replyText.trim().slice(0, 90),
      time: "Just now",
      order: nextConversationOrder,
      unread: false,
      unreadCount: 0,
      priority: false,
      needsResponse: true,
      mentions: false,
      flagged: false,
      archived: false,
      tags:
        Array.isArray(selectedContact?.tags)
          ? selectedContact.tags
          : [],
      external:
        replyChannel !== "dashboard",
      details: {
        organization:
          selectedContact?.organization ||
          "Campaign contact",
        role:
          selectedContact?.contact_type
            ? String(
                selectedContact.contact_type,
              ).replaceAll("_", " ")
            : "Campaign contact",
        location:
          selectedContact?.precinct ||
          "Not provided",
        lastContact: "Just now",
      },
      messages: [
        {
          id: `new-message-${nextConversationOrder}`,
          direction: "outbound",
          author: "You",
          initials: "CI",
          time: "Just now",
          channel:
            replyChannel === "dashboard"
              ? "Dashboard"
              : getChannelLabel(
                  replyChannel === "text"
                    ? "sms"
                    : replyChannel,
                ),
          body: replyText.trim(),
        },
      ],
      files: [],
    };

    setConversations((current) => [
      newConversation,
      ...current,
    ]);

    setSelectedId(newConversation.id);
    setNewMessageMode(false);
    setNewRecipient("");
    setNewSubject("");
    setReplyText("");
    setContactQuery("");
    setSelectedContactId("");

    addActivity(
      "New conversation created",
      "This preview records the conversation in the current browser session. External delivery is not connected yet.",
    );

    setToast(
      "Conversation added to the Inbox preview.",
    );
  };

  const toggleConversationField = (field) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id ===
        selectedConversation.id
          ? {
              ...conversation,
              [field]: !conversation[field],
            }
          : conversation,
      ),
    );

    setToast(`${field} updated.`);
  };

  return (
    <CampaignWorkspaceShell activeItem="Inbox">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1>Inbox</h1>
            <p>
              All campaign messages in one place.
            </p>
          </div>

          <div className={styles.pageActions}>
            <label className={styles.globalSearch}>
              <Search size={18} />

              <input
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search messages..."
              />

              <kbd>⌘K</kbd>
            </label>

            <button
              className={styles.quickTaskButton}
              type="button"
              onClick={openQuickTask}
            >
              <ListTodo size={18} />
              Quick Task
            </button>

            <button
              className={styles.newMessageButton}
              type="button"
              onClick={openNewMessage}
            >
              <Plus size={18} />
              New Message
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <section className={styles.metricsGrid}>
          {summaryMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <button
                key={metric.id}
                className={`${styles.metricCard} ${
                  activeFilter === metric.id
                    ? styles.activeMetricCard
                    : ""
                }`}
                type="button"
                aria-pressed={
                  activeFilter === metric.id
                }
                onClick={() => {
                  setActiveFilter(
                    activeFilter === metric.id
                      ? ""
                      : metric.id,
                  );
                  setActiveChannel("all");
                }}
              >
                <span
                  className={`${styles.metricIcon} ${
                    styles[
                      `metricIcon${metric.tone}`
                    ]
                  }`}
                >
                  <Icon size={20} />
                </span>

                <span className={styles.metricCopy}>
                  <small>{metric.label}</small>

                  <span>
                    <strong>{metric.value}</strong>
                  </span>

                  <small>{metric.detail}</small>
                </span>
              </button>
            );
          })}
        </section>


        {/* CAMPAIGN SEAT MOBILE INBOX FILTER TOGGLE — START */}
        <button
          className={styles.mobileFilterToggle}
          type="button"
          aria-controls="inbox-mobile-filters"
          aria-expanded={mobileFiltersOpen}
          onClick={() =>
            setMobileFiltersOpen(
              (current) => !current,
            )
          }
        >
          <span className={styles.mobileFilterToggleLabel}>
            <Filter size={17} />
            <strong>Filter messages</strong>
          </span>

          <span className={styles.mobileFilterToggleMeta}>
            <small>
              {
                activeChannel !== "all" ||
                activeFilter ||
                activeTag
                  ? "Active"
                  : "All"
              }
            </small>

            <ChevronDown
              size={17}
              className={
                mobileFiltersOpen
                  ? styles.mobileFilterChevronOpen
                  : ""
              }
            />
          </span>
        </button>
        {/* CAMPAIGN SEAT MOBILE INBOX FILTER TOGGLE — END */}

        <section className={styles.inboxWorkspace}>
          <aside
            id="inbox-mobile-filters"
            className={`${styles.utilityPanel} ${
              mobileFiltersOpen
                ? styles.mobileFiltersOpen
                : ""
            }`}
          >
            <section>
              <header>
                <strong>Channels</strong>

              </header>

              <div className={styles.utilityList}>
                {CHANNELS.map((channel) => {
                  const Icon = channel.icon;

                  return (
                    <button
                      key={channel.id}
                      className={
                        activeChannel === channel.id
                          ? styles.activeUtility
                          : ""
                      }
                      type="button"
                      onClick={() => {
                        setActiveChannel(channel.id);
                        setActiveFilter("");
                      }}
                    >
                      <Icon size={16} />
                      <span>{channel.label}</span>

                      <strong>
                        {getChannelCount(channel.id)}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <header>
                <strong>Filters</strong>

              </header>

              <div className={styles.utilityList}>
                {FILTERS.map((filter) => {
                  const Icon = filter.icon;

                  return (
                    <button
                      key={filter.id}
                      className={
                        activeFilter === filter.id
                          ? styles.activeUtility
                          : ""
                      }
                      type="button"
                      onClick={() =>
                        setActiveFilter(
                          activeFilter === filter.id
                            ? ""
                            : filter.id,
                        )
                      }
                    >
                      <Icon size={16} />
                      <span>{filter.label}</span>

                      <strong>
                        {getFilterCount(filter.id)}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <header>
                <strong>Tags</strong>

              </header>

              <div className={styles.tags}>
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    className={
                      activeTag === tag
                        ? styles.activeTag
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setActiveTag(
                        activeTag === tag ? "" : tag,
                      )
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className={styles.conversationPanel}>
            <header className={styles.listHeader}>
              <label>
                Sort by:

                <select
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(
                      event.target.value,
                    )
                  }
                >
                  <option value="newest">
                    Newest
                  </option>

                  <option value="oldest">
                    Oldest
                  </option>
                </select>
              </label>

            </header>

            <div className={styles.conversationList}>
              {filteredConversations.length ? (
                filteredConversations.map(
                  (conversation) => (
                    <button
                      key={conversation.id}
                      className={
                        selectedConversation.id ===
                        conversation.id
                          ? styles.selectedConversation
                          : ""
                      }
                      type="button"
                      aria-label={`Open conversation with ${conversation.sender}`}
                      onClick={() =>
                        openConversation(
                          conversation.id,
                        )
                      }
                    >
                      <span
                        className={styles.avatar}
                      >
                        {conversation.initials}
                      </span>

                      <span
                        className={
                          styles.conversationCopy
                        }
                      >
                        <span
                          className={
                            styles.conversationTopline
                          }
                        >
                          <strong>
                            {conversation.sender}
                          </strong>

                          <time>
                            {conversation.time}
                          </time>
                        </span>

                        <span
                          className={
                            styles.conversationSubject
                          }
                        >
                          {conversation.subject}
                        </span>

                        <small>
                          {getChannelLabel(
                            conversation.channel,
                          )}
                        </small>
                      </span>

                      <span
                        className={
                          styles.conversationStatus
                        }
                      >
                        {conversation.priority ? (
                          <strong>High</strong>
                        ) : null}

                        {conversation.unreadCount ? (
                          <em>
                            {
                              conversation.unreadCount
                            }
                          </em>
                        ) : null}
                      </span>
                    </button>
                  ),
                )
              ) : (
                <div className={styles.emptyState}>
                  <Inbox size={28} />

                  <strong>
                    No matching conversations
                  </strong>

                  <span>
                    Adjust the selected channel,
                    filter, tag, or search.
                  </span>
                </div>
              )}
            </div>

          </section>

          {newMessageMode ? (
            <button
              className={styles.newMessageScrim}
              type="button"
              tabIndex={-1}
              aria-label="Close New Message"
              onClick={() =>
                setNewMessageMode(false)
              }
            />
          ) : null}

          <article
            className={[
              styles.threadPanel,
              newMessageMode
                ? styles.newMessageModal
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {newMessageMode ? (
              <header className={styles.threadHeader}>
                <div>
                  <span className={styles.avatar}>
                    NM
                  </span>

                  <span>
                    <strong>
                      New Campaign Message
                    </strong>

                    <small>
                      Start a new conversation
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNewMessageMode(false)
                  }
                >
                  Cancel
                </button>
              </header>
            ) : (
              <header className={styles.threadHeader}>
                <div>
                  <span className={styles.avatar}>
                    {selectedConversation.initials}
                  </span>

                  <span>
                    <strong>
                      {selectedConversation.sender}
                    </strong>

                    <small>
                      {selectedConversation.email}
                    </small>
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    aria-label={
                      selectedConversation.flagged
                        ? "Remove conversation flag"
                        : "Flag conversation"
                    }
                    title={
                      selectedConversation.flagged
                        ? "Remove flag"
                        : "Flag conversation"
                    }
                    onClick={() =>
                      toggleConversationField(
                        "flagged",
                      )
                    }
                  >
                    <Flag size={17} />
                  </button>

                  <button
                    type="button"
                    aria-label="Reply by email"
                    title="Reply by email"
                    onClick={() => {
                      setReplyChannel("email");
                      setActiveThreadTab(
                        "conversation",
                      );
                    }}
                  >
                    <Mail size={17} />
                  </button>

                </div>
              </header>
            )}

            {!newMessageMode ? (
              <nav className={styles.threadTabs}>
                {[
                  "conversation",
                  "details",
                  "files",
                  "activity",
                ].map((tab) => (
                  <button
                    key={tab}
                    className={
                      activeThreadTab === tab
                        ? styles.activeThreadTab
                        : ""
                    }
                    type="button"
                    onClick={() =>
                      setActiveThreadTab(tab)
                    }
                  >
                    {tab === "conversation"
                      ? "Conversation"
                      : tab === "details"
                        ? "Details"
                        : tab === "files"
                          ? `Files (${selectedConversation.files.length})`
                          : "Activity"}
                  </button>
                ))}
              </nav>
            ) : null}

            {newMessageMode ? (
              <div
                className={[
                  styles.newMessageFields,
                  !subjectEnabled
                    ? styles.newMessageFieldsSingle
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.contactPickerField}>
                  <span className={styles.fieldLabel}>
                    Recipient
                  </span>

                  <div className={styles.contactSearchControl}>
                    <Search size={17} />

                    <input
                      value={contactQuery}
                      onChange={(event) => {
                        setContactQuery(
                          event.target.value,
                        );
                        setNewRecipient(
                          event.target.value,
                        );
                        setSelectedContactId("");
                      }}
                      placeholder="Search campaign contacts"
                      autoComplete="off"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setContactCreateMode(
                          (current) => !current,
                        );
                        setContactFormError("");
                      }}
                    >
                      <UserPlus size={16} />
                      New contact
                    </button>
                  </div>

                  {selectedContact ? (
                    <div className={styles.selectedContactCard}>
                      <span className={styles.avatar}>
                        {contactInitials(
                          selectedContact,
                        )}
                      </span>

                      <span>
                        <strong>
                          {contactName(
                            selectedContact,
                          )}
                        </strong>

                        <small>
                          {[
                            selectedContact.email,
                            selectedContact.phone,
                            selectedContact.organization,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedContactId("");
                          setContactQuery("");
                          setNewRecipient("");
                        }}
                        aria-label="Clear selected contact"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={[
                        styles.contactResults,
                        !contactQuery.trim()
                          ? styles.contactResultsHidden
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {contactsLoading ? (
                        <div className={styles.contactLoading}>
                          <LoaderCircle size={17} />
                          Loading campaign contacts…
                        </div>
                      ) : filteredContacts.length ? (
                        filteredContacts.map(
                          (contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() =>
                                selectContact(
                                  contact,
                                )
                              }
                            >
                              <span className={styles.avatar}>
                                {contactInitials(
                                  contact,
                                )}
                              </span>

                              <span>
                                <strong>
                                  {contactName(
                                    contact,
                                  )}
                                </strong>

                                <small>
                                  {[
                                    contact.email,
                                    contact.phone,
                                    contact.organization,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                    "No delivery channel saved"}
                                </small>
                              </span>

                              <em>
                                {String(
                                  contact.contact_type ||
                                    "contact",
                                ).replaceAll(
                                  "_",
                                  " ",
                                )}
                              </em>
                            </button>
                          ),
                        )
                      ) : (
                        <div className={styles.noContactResults}>
                          <UserPlus size={18} />
                          {contacts.length
                            ? "No matching contacts. Try another name, email, phone number, organization, or tag."
                            : "No Contacts are saved yet. Add a new contact or enter an address manually."}
                        </div>
                      )}
                    </div>
                  )}

                  {contactsError ? (
                    <div
                      className={styles.workflowError}
                      role="alert"
                    >
                      {contactsError}
                    </div>
                  ) : null}

                  {contactCreateMode ? (
                    <>
                      <button
                        className={styles.newContactScrim}
                        type="button"
                        tabIndex={-1}
                        aria-label="Close new contact form"
                        onClick={() =>
                          setContactCreateMode(false)
                        }
                      />

                      <form
                        className={styles.newContactForm}
                      onSubmit={handleCreateContact}
                    >
                      <header>
                        <div>
                          <strong>
                            Add campaign contact
                          </strong>
                          <small>
                            The person will also appear in Contacts.
                          </small>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setContactCreateMode(false)
                          }
                          aria-label="Close new contact form"
                        >
                          <X size={16} />
                        </button>
                      </header>

                      <div>
                        <label>
                          Full name
                          <input
                            value={
                              contactForm.fullName
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  fullName:
                                    event.target.value,
                                }),
                              )
                            }
                            required
                          />
                        </label>

                        <label>
                          Organization
                          <input
                            value={
                              contactForm.organization
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  organization:
                                    event.target.value,
                                }),
                              )
                            }
                          />
                        </label>

                        <label>
                          Email
                          <input
                            type="email"
                            value={
                              contactForm.email
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  email:
                                    event.target.value,
                                }),
                              )
                            }
                          />
                        </label>

                        <label>
                          Phone
                          <input
                            type="tel"
                            value={
                              contactForm.phone
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  phone:
                                    event.target.value,
                                }),
                              )
                            }
                          />
                        </label>
                      </div>

                      <div className={styles.consentOptions}>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              contactForm.emailConsent
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  emailConsent:
                                    event.target.checked,
                                }),
                              )
                            }
                          />
                          Email consent confirmed
                        </label>

                        <label>
                          <input
                            type="checkbox"
                            checked={
                              contactForm.smsConsent
                            }
                            onChange={(event) =>
                              setContactForm(
                                (current) => ({
                                  ...current,
                                  smsConsent:
                                    event.target.checked,
                                }),
                              )
                            }
                          />
                          Text consent confirmed
                        </label>
                      </div>

                      {contactFormError ? (
                        <div
                          className={styles.workflowError}
                          role="alert"
                        >
                          {contactFormError}
                        </div>
                      ) : null}

                      <footer>
                        <button
                          type="button"
                          onClick={() =>
                            setContactCreateMode(false)
                          }
                          disabled={contactsSaving}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={contactsSaving}
                        >
                          {contactsSaving
                            ? "Saving…"
                            : "Add contact"}
                        </button>
                      </footer>
                      </form>
                    </>
                  ) : null}
                </div>

                {subjectEnabled ? (
                  <label className={styles.subjectField}>
                    <span className={styles.fieldLabel}>
                      Subject
                    </span>

                    <input
                      value={newSubject}
                      onChange={(event) =>
                        setNewSubject(
                          event.target.value,
                        )
                      }
                      placeholder="Enter a message subject"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {!newMessageMode &&
            activeThreadTab === "conversation" ? (
              <div className={styles.threadBody}>
                <div className={styles.dateDivider}>
                  <span>Today</span>
                </div>

                {selectedConversation.messages.map(
                  (message) => (
                    <div
                      key={message.id}
                      className={
                        message.direction ===
                        "outbound"
                          ? styles.outboundMessage
                          : styles.inboundMessage
                      }
                    >
                      <span className={styles.avatar}>
                        {message.initials}
                      </span>

                      <div>
                        <header>
                          <strong>
                            {message.author}
                          </strong>

                          <time>
                            {message.time}
                          </time>
                        </header>

                        <small>
                          {message.channel}
                        </small>

                        <p>{message.body}</p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : null}

            {!newMessageMode &&
            activeThreadTab === "details" ? (
              <div className={styles.detailsPanel}>
                <div>
                  <small>Organization</small>
                  <strong>
                    {
                      selectedConversation.details
                        .organization
                    }
                  </strong>
                </div>

                <div>
                  <small>Role</small>
                  <strong>
                    {
                      selectedConversation.details
                        .role
                    }
                  </strong>
                </div>

                <div>
                  <small>Email</small>
                  <strong>
                    {selectedConversation.email}
                  </strong>
                </div>

                <div>
                  <small>Phone</small>
                  <strong>
                    {selectedConversation.phone}
                  </strong>
                </div>

                <div>
                  <small>Location</small>
                  <strong>
                    {
                      selectedConversation.details
                        .location
                    }
                  </strong>
                </div>

                <div>
                  <small>Last Contact</small>
                  <strong>
                    {
                      selectedConversation.details
                        .lastContact
                    }
                  </strong>
                </div>
              </div>
            ) : null}

            {!newMessageMode &&
            activeThreadTab === "files" ? (
              <div className={styles.filesPanel}>
                <header>
                  <strong>
                    Conversation files
                  </strong>

                  {selectedConversation.files.length ? (
                    <span className={styles.fileCount}>
                      {selectedConversation.files.length}
                      {" "}
                      {selectedConversation.files.length === 1
                        ? "attachment"
                        : "attachments"}
                    </span>
                  ) : null}
                </header>

                {selectedConversation.files.length ? (
                  <div>
                    {selectedConversation.files.map(
                      (file) => (
                        <div
                          key={file.name}
                          className={styles.fileCard}
                        >
                          <span>
                            <FileText size={20} />
                          </span>

                          <span>
                            <strong>
                              {file.name}
                            </strong>

                            <small>
                              {file.size}
                            </small>
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p>
                    No files are attached to this
                    conversation.
                  </p>
                )}
              </div>
            ) : null}

            {!newMessageMode &&
            activeThreadTab === "activity" ? (
              <div className={styles.activityPanel}>
                <div className={styles.aiFollowUp}>
                  <span>
                    <Sparkles size={20} />
                  </span>

                  <div>
                    <strong>
                      AI follow-up tracking
                    </strong>

                    <p>
                      Email and Dashboard activity can
                      eventually update automatically.
                      Text and WhatsApp activity remains
                      pending until a team member confirms
                      what happened.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openQuickTask}
                  >
                    <ListTodo size={16} />
                    Create follow-up task
                  </button>
                </div>

                <div className={styles.activityList}>
                  {activityLog.map((activity) => (
                    <div key={activity.id}>
                      <span>
                        <Clock3 size={16} />
                      </span>

                      <span>
                        <strong>
                          {activity.action}
                        </strong>

                        <small>
                          {activity.detail}
                        </small>
                      </span>

                      <time>{activity.time}</time>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeThreadTab === "conversation" ||
            newMessageMode ? (
              <footer className={styles.replyComposer}>
                {!newMessageMode ? (
                  <div className={styles.quickReplies}>
                    {QUICK_REPLIES.map(
                      (quickReply) => (
                        <button
                          key={quickReply}
                          type="button"
                          onClick={() =>
                            setReplyText(quickReply)
                          }
                        >
                          {quickReply}
                        </button>
                      ),
                    )}
                  </div>
                ) : null}

                <div className={styles.previewNotice}>
                  <CheckCircle2 size={16} />

                  <span>
                    {replyChannel === "dashboard"
                      ? "Dashboard preview uses a subject and records the conversation in this browser session."
                      : replyChannel === "email"
                        ? "Email uses a subject line. External email delivery is not connected yet."
                        : "Text and WhatsApp use only a recipient and message. External delivery is not connected yet."}
                  </span>
                </div>

                <textarea
                  value={replyText}
                  onChange={(event) =>
                    setReplyText(
                      event.target.value,
                    )
                  }
                  rows={4}
                  placeholder={
                    newMessageMode
                      ? "Write your message..."
                      : "Type your reply..."
                  }
                />

                <div className={styles.composerFooter}>
                  <div>
                  </div>

                  <div className={styles.replyChannels}>
                    {REPLY_CHANNELS.map(
                      (channel) => {
                        const Icon = channel.icon;

                        return (
                          <button
                            key={channel.id}
                            className={
                              replyChannel ===
                              channel.id
                                ? styles.activeReplyChannel
                                : ""
                            }
                            type="button"
                            onClick={() =>
                              setReplyChannel(
                                channel.id,
                              )
                            }
                          >
                            <Icon size={15} />
                            {channel.label}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <button
                    className={styles.sendButton}
                    type="button"
                    onClick={
                      newMessageMode
                        ? sendNewMessage
                        : sendReply
                    }
                  >
                    <Send size={17} />
                    {newMessageMode
                      ? "Start Conversation"
                      : replyChannel === "text"
                        ? "Open Text"
                        : replyChannel === "whatsapp"
                          ? "Open WhatsApp"
                          : "Add Reply"}
                    <ChevronDown size={15} />
                  </button>
                </div>
              </footer>
            ) : null}
          </article>
        </section>

        {quickTaskOpen ? (
          <div
            className={styles.modalOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setQuickTaskOpen(false);
              }
            }}
          >
            <form
              className={styles.quickTaskModal}
              onSubmit={handleCreateQuickTask}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-task-title"
            >
              <header>
                <div>
                  <span>
                    <ListTodo size={20} />
                  </span>

                  <div>
                    <small>
                      Inbox follow-up
                    </small>
                    <h2 id="quick-task-title">
                      Create Quick Task
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setQuickTaskOpen(false)
                  }
                  aria-label="Close Quick Task"
                >
                  <X size={18} />
                </button>
              </header>

              <div className={styles.quickTaskContact}>
                <span className={styles.avatar}>
                  {
                    selectedConversation.initials
                  }
                </span>

                <span>
                  <strong>
                    {
                      selectedConversation.sender
                    }
                  </strong>

                  <small>
                    {
                      selectedConversation.subject
                    }
                  </small>
                </span>
              </div>

              <label>
                Task title
                <input
                  value={quickTaskForm.title}
                  onChange={(event) =>
                    setQuickTaskForm(
                      (current) => ({
                        ...current,
                        title:
                          event.target.value,
                      }),
                    )
                  }
                  required
                />
              </label>

              <label>
                Notes
                <textarea
                  rows={3}
                  value={
                    quickTaskForm.description
                  }
                  onChange={(event) =>
                    setQuickTaskForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <div className={styles.quickTaskGrid}>
                <label>
                  Due date
                  <input
                    type="date"
                    value={
                      quickTaskForm.dueDate
                    }
                    onChange={(event) =>
                      setQuickTaskForm(
                        (current) => ({
                          ...current,
                          dueDate:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Due time
                  <input
                    type="time"
                    value={
                      quickTaskForm.dueTime
                    }
                    onChange={(event) =>
                      setQuickTaskForm(
                        (current) => ({
                          ...current,
                          dueTime:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Priority
                  <select
                    value={
                      quickTaskForm.priority
                    }
                    onChange={(event) =>
                      setQuickTaskForm(
                        (current) => ({
                          ...current,
                          priority:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option value="low">
                      Low
                    </option>
                    <option value="normal">
                      Normal
                    </option>
                    <option value="high">
                      High
                    </option>
                    <option value="urgent">
                      Critical
                    </option>
                  </select>
                </label>

                <label>
                  Assign to
                  <select
                    value={
                      quickTaskForm.assignedTo
                    }
                    onChange={(event) =>
                      setQuickTaskForm(
                        (current) => ({
                          ...current,
                          assignedTo:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option value={user.id}>
                      {user.name || "Me"}
                    </option>

                    {team
                      .filter(
                        (member) =>
                          member.id !== user.id,
                      )
                      .map((member) => (
                        <option
                          key={member.id}
                          value={member.id}
                        >
                          {member.fullName}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {quickTaskError ||
              taskError ? (
                <div
                  className={styles.workflowError}
                  role="alert"
                >
                  {quickTaskError ||
                    taskError}
                </div>
              ) : null}

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setQuickTaskOpen(false)
                  }
                  disabled={taskSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={taskSaving}
                >
                  {taskSaving ? (
                    <>
                      <LoaderCircle
                        size={16}
                        className={
                          styles.spinning
                        }
                      />
                      Creating…
                    </>
                  ) : (
                    <>
                      <ListTodo size={16} />
                      Create Task
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        ) : null}

        <div
          className={styles.toast}
          role="status"
          aria-live="polite"
        >
          <span />
          {toast}
        </div>
      </main>
    </CampaignWorkspaceShell>
  );
}
