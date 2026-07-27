import { useMemo, useState } from "react";
import {
  Archive,
  AtSign,
  Bot,
  CalendarDays,
  CheckCircle2,
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
  Users,
} from "lucide-react";

import { CampaignWorkspaceShell } from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

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
    label: "Unseen Messages",
    value: "24",
    comparison: "18%",
    detail: "vs yesterday",
    icon: Mail,
    tone: "red",
  },
  {
    label: "Total Conversations",
    value: "128",
    comparison: "12%",
    detail: "vs last 7 days",
    icon: MessageSquare,
    tone: "purple",
  },
  {
    label: "Messages Sent",
    value: "302",
    comparison: "",
    detail: "This week",
    icon: Send,
    tone: "blue",
  },
  {
    label: "Avg. Response Time",
    value: "2.4h",
    comparison: "18%",
    detail: "vs last 7 days",
    icon: Clock3,
    tone: "green",
  },
  {
    label: "High Priority",
    value: "7",
    comparison: "",
    detail: "Requires action",
    icon: Star,
    tone: "gold",
  },
];

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
  const [conversations, setConversations] =
    useState(STARTING_CONVERSATIONS);

  const [selectedId, setSelectedId] =
    useState(STARTING_CONVERSATIONS[0].id);

  const [activeChannel, setActiveChannel] =
    useState("all");

  const [activeFilter, setActiveFilter] =
    useState("");

  const [activeTag, setActiveTag] = useState("");

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
      window.location.href =
        `sms:${selectedConversation.phone}?&body=${body}`;
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
      `${channel} opened. AI follow-up reminder created.`,
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
      id: `reply-${Date.now()}`,
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
      "Campaign Seat will monitor this connected conversation for a response.",
    );

    setReplyText("");

    setToast(
      `${newThreadMessage.channel} reply added.`,
    );
  };

  const sendNewMessage = () => {
    if (
      !newRecipient.trim() ||
      !newSubject.trim() ||
      !replyText.trim()
    ) {
      setToast(
        "Recipient, subject, and message are required.",
      );
      return;
    }

    const newConversation = {
      id: `new-${Date.now()}`,
      sender: newRecipient.trim(),
      initials: newRecipient
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      email: newRecipient.trim(),
      phone: "",
      channel:
        replyChannel === "dashboard"
          ? "email"
          : replyChannel,
      subject: newSubject.trim(),
      preview: replyText.trim().slice(0, 90),
      time: "Just now",
      order: Date.now(),
      unread: false,
      unreadCount: 0,
      priority: false,
      needsResponse: true,
      mentions: false,
      flagged: false,
      archived: false,
      tags: [],
      external: true,
      details: {
        organization: "New conversation",
        role: "Campaign contact",
        location: "Not provided",
        lastContact: "Just now",
      },
      messages: [
        {
          id: `new-message-${Date.now()}`,
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

    addActivity(
      "New conversation created",
      "Campaign Seat will track whether this person responds.",
    );

    setToast("New conversation created.");
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
              className={styles.newMessageButton}
              type="button"
              onClick={() => {
                setNewMessageMode(true);
                setReplyText("");
                setNewRecipient("");
                setNewSubject("");
              }}
            >
              <Plus size={18} />
              New Message
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <section className={styles.metricsGrid}>
          {SUMMARY_METRICS.map((metric) => {
            const Icon = metric.icon;

            return (
              <button
                key={metric.label}
                className={styles.metricCard}
                type="button"
                onClick={() =>
                  setToast(
                    `${metric.label} selected.`,
                  )
                }
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

                    {metric.comparison ? (
                      <em>
                        ↑ {metric.comparison}
                      </em>
                    ) : null}
                  </span>

                  <small>{metric.detail}</small>
                </span>
              </button>
            );
          })}
        </section>

        <section className={styles.inboxWorkspace}>
          <aside className={styles.utilityPanel}>
            <section>
              <header>
                <strong>Channels</strong>

                <button
                  type="button"
                  onClick={() =>
                    setToast(
                      "Channel settings selected.",
                    )
                  }
                >
                  <Settings size={16} />
                </button>
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

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("");
                    setToast("Filters cleared.");
                  }}
                >
                  <Plus size={16} />
                </button>
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

                <button
                  type="button"
                  onClick={() => {
                    setActiveTag("");
                    setToast("Tag filter cleared.");
                  }}
                >
                  <Plus size={16} />
                </button>
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

              <button
                type="button"
                onClick={() =>
                  setToast(
                    "Advanced filters selected.",
                  )
                }
              >
                <Filter size={16} />
                Filter
              </button>
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

            <button
              className={styles.loadMore}
              type="button"
              onClick={() =>
                setToast(
                  "All showcase conversations are loaded.",
                )
              }
            >
              Load more conversations
              <ChevronDown size={15} />
            </button>
          </section>

          <article className={styles.threadPanel}>
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
                    onClick={() => {
                      setReplyChannel("email");
                      setActiveThreadTab(
                        "conversation",
                      );
                    }}
                  >
                    <Mail size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setToast(
                        "Conversation tags selected.",
                      )
                    }
                  >
                    <Tag size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setToast(
                        "Conversation options selected.",
                      )
                    }
                  >
                    <MoreVertical size={17} />
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
              <div className={styles.newMessageFields}>
                <label>
                  Recipient

                  <input
                    value={newRecipient}
                    onChange={(event) =>
                      setNewRecipient(
                        event.target.value,
                      )
                    }
                    placeholder="Email, contact, or campaign member"
                  />
                </label>

                <label>
                  Subject

                  <input
                    value={newSubject}
                    onChange={(event) =>
                      setNewSubject(
                        event.target.value,
                      )
                    }
                    placeholder="Message subject"
                  />
                </label>
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
                    <button
                      type="button"
                      onClick={() =>
                        setToast(
                          "Download all selected.",
                        )
                      }
                    >
                      <Download size={17} />
                      Download all
                    </button>
                  ) : null}
                </header>

                {selectedConversation.files.length ? (
                  <div>
                    {selectedConversation.files.map(
                      (file) => (
                        <button
                          key={file.name}
                          type="button"
                          onClick={() =>
                            setToast(
                              `${file.name} selected.`,
                            )
                          }
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
                        </button>
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
                    onClick={() => {
                      addActivity(
                        "Follow-up reminder created",
                        `Check whether ${selectedConversation.sender} replied or whether the request was completed.`,
                      );

                      setToast(
                        "AI follow-up reminder created.",
                      );
                    }}
                  >
                    <Bot size={16} />
                    Create reminder
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
                    <button
                      type="button"
                      onClick={() =>
                        setToast(
                          "Attach file selected.",
                        )
                      }
                    >
                      <Paperclip size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setToast(
                          "Schedule message selected.",
                        )
                      }
                    >
                      <CalendarDays size={17} />
                    </button>
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
                    Send
                    <ChevronDown size={15} />
                  </button>
                </div>
              </footer>
            ) : null}
          </article>
        </section>

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
