import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  ArrowLeft,
  AtSign,
  CheckCircle2,
  ListTodo,
  LoaderCircle,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  Flag,
  Hash,
  Inbox,
  Image,
  Mail,
  Maximize2,
  Minimize2,
  Paperclip,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  UserPlus,
  X,
} from "lucide-react";

import { CampaignWorkspaceShell } from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";
import { useContactsCommandCenter } from "../../hooks/useContactsCommandCenter";
import { useInternalInboxThreads } from "../../hooks/useInternalInboxThreads";
import { useRealInboxMailbox } from "../../hooks/useRealInboxMailbox";
import { useWorkspaceEmailSignature } from "../../hooks/useWorkspaceEmailSignature";
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
    id: "dashboard",
    label: "Campaign Seat",
    icon: MessageSquare,
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
    label: "Mailbox Unread",
    detail: "Connected inbox unread",
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

const MAX_EMAIL_ATTACHMENTS =
  10;

const MAX_EMAIL_ATTACHMENT_BYTES =
  20 * 1024 * 1024;

function formatAttachmentSize(
  value,
) {
  const bytes =
    Number(value || 0);

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return "0 KB";
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        bytes / 1024,
      ),
    )} KB`;
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;
}

const EMPTY_CONTACT_FORM = {
  fullName: "",
  email: "",
  phone: "",
  organization: "",
  emailConsent: false,
  smsConsent: false,
};

function buildOutboundEmailBody({
  message,
  signatureText,
  includeSignature,
}) {
  const body =
    String(
      message || "",
    )
      .replace(
        /\r\n/g,
        "\n",
      )
      .replace(
        /\r/g,
        "\n",
      )
      .trim();

  const signature =
    String(
      signatureText || "",
    )
      .replace(
        /\r\n/g,
        "\n",
      )
      .replace(
        /\r/g,
        "\n",
      )
      .trim();

  if (
    !includeSignature ||
    !signature
  ) {
    return body;
  }

  return `${body}\n\n--\n${signature}`;
}


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

const LIVE_CONNECTED_CHANNELS =
  new Set([
    "all",
    "email",
    "dashboard",
  ]);

const EMPTY_CONVERSATION = {
  id: "",
  sender: "No conversation selected",
  initials: "—",
  email: "",
  phone: "",
  channel: "email",
  subject: "",
  preview: "",
  time: "",
  order: 0,
  unread: false,
  unreadCount: 0,
  priority: false,
  needsResponse: false,
  mentions: false,
  flagged: false,
  archived: false,
  tags: [],
  external: false,
  details: {},
  messages: [],
  files: [],
};

function attachmentKind(
  file,
) {
  const contentType =
    String(
      file?.contentType ||
      "",
    )
      .toLowerCase();

  const name =
    String(
      file?.name ||
      "",
    )
      .toLowerCase();

  if (
    contentType
      .startsWith(
        "image/",
      ) ||
    /\.(png|jpe?g|gif|webp|bmp|avif)$/i
      .test(
        name,
      )
  ) {
    return "image";
  }

  if (
    contentType ===
      "application/pdf" ||
    /\.pdf$/i.test(
      name,
    )
  ) {
    return "pdf";
  }

  return "file";
}


function humanFileSize(
  value,
) {
  const bytes =
    Number(
      value || 0,
    );

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <= 0
  ) {
    return "File";
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        bytes / 1024,
      ),
    )} KB`;
  }

  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;
}


function normalizeContentId(
  value,
) {
  let text =
    String(
      value || "",
    ).trim();

  try {
    text =
      decodeURIComponent(
        text,
      );
  } catch {
    // Keep the original
    // content ID.
  }

  return text
    .replace(
      /^cid:/i,
      "",
    )
    .replace(
      /^<|>$/g,
      "",
    )
    .trim()
    .toLowerCase();
}


function blobToDataUrl(
  blob,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(
          String(
            reader.result ||
            "",
          ),
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Campaign Seat could not prepare the embedded image.",
          ),
        );
      };

      reader.readAsDataURL(
        blob,
      );
    },
  );
}


function emailHasRemoteImages(
  html,
) {
  if (
    !html ||
    typeof window ===
      "undefined"
  ) {
    return false;
  }

  const documentValue =
    new DOMParser()
      .parseFromString(
        html,
        "text/html",
      );

  return Array.from(
    documentValue
      .querySelectorAll(
        "img",
      ),
  ).some(
    (image) => {
      const src =
        String(
          image.getAttribute(
            "src",
          ) || "",
        )
          .trim()
          .toLowerCase();

      const srcset =
        String(
          image.getAttribute(
            "srcset",
          ) || "",
        )
          .trim()
          .toLowerCase();

      return (
        /^https?:\/\//i.test(
          src,
        ) ||
        /https?:\/\//i.test(
          srcset,
        )
      );
    },
  );
}


function buildSafeEmailDocument({
  html,
  inlineSources,
  allowRemoteImages,
  contentScale,
}) {
  const documentValue =
    new DOMParser()
      .parseFromString(
        html ||
        "",
        "text/html",
      );

  documentValue
    .querySelectorAll(
      [
        "script",
        "iframe",
        "frame",
        "frameset",
        "object",
        "embed",
        "applet",
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "option",
        "base",
        "link",
        "svg",
        "math",
      ].join(","),
    )
    .forEach(
      (element) =>
        element.remove(),
    );

  documentValue
    .querySelectorAll(
      "*",
    )
    .forEach(
      (element) => {
        Array.from(
          element.attributes ||
          [],
        ).forEach(
          (attribute) => {
            const name =
              attribute.name
                .toLowerCase();

            const value =
              String(
                attribute.value ||
                "",
              )
                .trim();

            if (
              name.startsWith(
                "on",
              ) ||
              name ===
                "srcdoc" ||
              name ===
                "nonce"
            ) {
              element
                .removeAttribute(
                  attribute.name,
                );

              return;
            }

            if (
              name ===
                "style" &&
              (
                /javascript:/i
                  .test(
                    value,
                  ) ||
                /expression\s*\(/i
                  .test(
                    value,
                  )
              )
            ) {
              element
                .removeAttribute(
                  "style",
                );
            }
          },
        );

        if (
          element.tagName ===
          "A"
        ) {
          const href =
            String(
              element.getAttribute(
                "href",
              ) || "",
            )
              .trim();

          if (
            !(
              /^https?:\/\//i
                .test(
                  href,
                ) ||
              /^mailto:/i
                .test(
                  href,
                ) ||
              /^tel:/i
                .test(
                  href,
                )
            )
          ) {
            element.removeAttribute(
              "href",
            );
          } else {
            element.setAttribute(
              "target",
              "_blank",
            );

            element.setAttribute(
              "rel",
              "noopener noreferrer",
            );
          }
        }

        if (
          element.tagName ===
          "IMG"
        ) {
          element.removeAttribute(
            "srcset",
          );

          element.removeAttribute(
            "crossorigin",
          );

          const originalSource =
            String(
              element.getAttribute(
                "src",
              ) || "",
            )
              .trim();

          if (
            /^cid:/i.test(
              originalSource,
            )
          ) {
            const cid =
              normalizeContentId(
                originalSource,
              );

            const source =
              inlineSources[
                cid
              ];

            if (
              source
            ) {
              element.setAttribute(
                "src",
                source,
              );

              element.setAttribute(
                "data-campaign-seat-inline",
                "true",
              );
            } else {
              element.setAttribute(
                "src",
                "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
              );

              element.setAttribute(
                "data-campaign-seat-blocked",
                "inline",
              );

              element.setAttribute(
                "title",
                "Embedded image is loading",
              );
            }

            return;
          }

          if (
            /^https?:\/\//i.test(
              originalSource,
            )
          ) {
            if (
              allowRemoteImages
            ) {
              element.setAttribute(
                "data-campaign-seat-remote",
                "shown",
              );
            } else {
              element.setAttribute(
                "data-campaign-seat-remote-src",
                originalSource,
              );

              element.setAttribute(
                "src",
                "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
              );

              element.setAttribute(
                "data-campaign-seat-blocked",
                "remote",
              );

              element.setAttribute(
                "title",
                "External image protected by Campaign Seat",
              );
            }

            return;
          }

          if (
            /^data:image\//i.test(
              originalSource,
            )
          ) {
            return;
          }

          if (
            originalSource
          ) {
            element.removeAttribute(
              "src",
            );
          }
        }
      },
    );

  const csp =
    documentValue
      .createElement(
        "meta",
      );

  csp.setAttribute(
    "http-equiv",
    "Content-Security-Policy",
  );

  csp.setAttribute(
    "content",
    allowRemoteImages
      ? "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data:; media-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"
      : "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'",
  );

  documentValue.head
    .prepend(
      csp,
    );

  const campaignSeatStyle =
    documentValue
      .createElement(
        "style",
      );

  campaignSeatStyle
    .textContent = `
      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #334f67;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Arial,
          sans-serif;
        font-size: 14px;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }

      body {
        padding: 2px 3px 14px;
        zoom: ${contentScale};
      }

      img {
        max-width: 100% !important;
        height: auto;
      }

      img[data-campaign-seat-blocked] {
        min-width: 1px;
        min-height: 1px;
        opacity: 0.28;
      }

      table {
        max-width: 100% !important;
      }

      pre {
        max-width: 100%;
        overflow-x: auto;
        white-space: pre-wrap;
      }

      a {
        color: #216999;
        text-decoration: underline;
      }
    `;

  documentValue.head
    .appendChild(
      campaignSeatStyle,
    );

  return (
    "<!doctype html>\n" +
    documentValue
      .documentElement
      .outerHTML
  );
}


function SafeEmailBody({
  message,
  getAttachmentBlob,
  expanded,
}) {
  const [
    inlineSources,
    setInlineSources,
  ] = useState({});

  const [
    inlineLoading,
    setInlineLoading,
  ] = useState(false);

  const [
    allowRemoteImages,
    setAllowRemoteImages,
  ] = useState(false);

  const [
    frameHeight,
    setFrameHeight,
  ] = useState(220);

  const contentScale =
    expanded
      ? 1
      : 0.68;

  const maxFrameHeight =
    expanded
      ? 2200
      : 1800;


  const html =
    String(
      message?.htmlBody ||
      "",
    ).trim();

  const inlineAttachments =
    Array.isArray(
      message?.inlineAttachments,
    )
      ? message.inlineAttachments
      : [];

  const remoteImages =
    useMemo(
      () =>
        emailHasRemoteImages(
          html,
        ),
      [
        html,
      ],
    );


  useEffect(() => {
    let cancelled =
      false;

    async function loadInlineImages() {
      const imageAttachments =
        inlineAttachments
          .filter(
            (attachment) =>
              String(
                attachment
                  ?.contentType ||
                "",
              )
                .toLowerCase()
                .startsWith(
                  "image/",
                ) &&
              attachment
                ?.contentId &&
              attachment
                ?.providerAttachmentId &&
              attachment
                ?.providerMessageId,
          );

      if (
        !imageAttachments
          .length
      ) {
        setInlineSources(
          {},
        );

        return;
      }

      setInlineLoading(
        true,
      );

      const entries =
        await Promise.all(
          imageAttachments.map(
            async (
              attachment,
            ) => {
              try {
                const blob =
                  await getAttachmentBlob(
                    attachment,
                  );

                const dataUrl =
                  await blobToDataUrl(
                    blob,
                  );

                return [
                  normalizeContentId(
                    attachment
                      .contentId,
                  ),
                  dataUrl,
                ];
              } catch {
                return null;
              }
            },
          ),
        );

      if (
        cancelled
      ) {
        return;
      }

      setInlineSources(
        Object.fromEntries(
          entries.filter(
            Boolean,
          ),
        ),
      );

      setInlineLoading(
        false,
      );
    }

    void loadInlineImages();

    return () => {
      cancelled =
        true;
    };
  }, [
    getAttachmentBlob,
    message?.providerMessageId,
  ]);


  useEffect(() => {
    setAllowRemoteImages(
      false,
    );
  }, [
    message?.providerMessageId,
  ]);


  const safeDocument =
    useMemo(
      () => {
        if (!html) {
          return "";
        }

        return buildSafeEmailDocument({
          html,
          inlineSources,
          allowRemoteImages,
          contentScale,
        });
      },
      [
        allowRemoteImages,
        contentScale,
        html,
        inlineSources,
      ],
    );


  if (
    !html ||
    !/<[a-z][\s\S]*>/i.test(
      html,
    )
  ) {
    return (
      <p>
        {message?.body || ""}
      </p>
    );
  }


  return (
    <section
      className={
        styles.richEmail
      }
    >
      {remoteImages ? (
        <div
          className={
            styles.remoteImageProtection
          }
        >
          <span>
            {allowRemoteImages
              ? "External images are displayed."
              : "External images are protected to reduce email tracking."}
          </span>

          <button
            type="button"
            onClick={() =>
              setAllowRemoteImages(
                (current) =>
                  !current,
              )
            }
          >
            {allowRemoteImages
              ? "Hide external images"
              : "Show external images"}
          </button>
        </div>
      ) : null}

      {inlineLoading ? (
        <div
          className={
            styles.inlineImageLoading
          }
        >
          <LoaderCircle
            size={14}
            className={
              styles.attachmentPreviewSpinner
            }
          />

          Loading embedded email images…
        </div>
      ) : null}

      <iframe
        className={
          styles.richEmailFrame
        }
        title={
          message?.subject ||
          "Email message"
        }
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={
          safeDocument
        }
        style={{
          height:
            `${frameHeight}px`,
        }}
        onLoad={(
          event,
        ) => {
          try {
            const height =
              event.currentTarget
                .contentDocument
                ?.documentElement
                ?.scrollHeight ||
              event.currentTarget
                .contentDocument
                ?.body
                ?.scrollHeight ||
              220;

            setFrameHeight(
              Math.min(
                Math.max(
                  height + 12,
                  expanded
                    ? 620
                    : 520,
                ),
                maxFrameHeight,
              ),
            );
          } catch {
            setFrameHeight(
              360,
            );
          }
        }}
      />

      {frameHeight >=
      maxFrameHeight ? (
        <small
          className={
            styles.richEmailLongNotice
          }
        >
          This email is long. Scroll inside
          the message to continue reading.
        </small>
      ) : null}
    </section>
  );
}


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

    const [previewConversations, setConversations] =
    useState(STARTING_CONVERSATIONS);
  const [selectedId, setSelectedId] =
    useState(STARTING_CONVERSATIONS[0].id);

  const [
    mobileConversationActive,
    setMobileConversationActive,
  ] = useState(false);

  const liveMailboxEnabled =
    !import.meta.env.DEV ||
    new URLSearchParams(
      window.location.search,
    ).get("mailbox-live") === "enabled";

  const {
    conversations: mailboxConversations,
    connectedEmail: mailboxConnectedEmail,
    accountProvider: mailboxAccountProvider,
    inboxTotalCount: mailboxInboxTotalCount,
    inboxUnreadCount: mailboxInboxUnreadCount,
    isLoading: mailboxLoading,
    error: mailboxError,
    refresh: refreshMailbox,
    loadThread: loadMailboxThread,
    markThreadRead: markMailboxThreadRead,
    sendEmail: sendMailboxEmail,
    replyEmail: replyMailboxEmail,
    getAttachmentBlob: getMailboxAttachmentBlob,
    downloadAttachment: downloadMailboxAttachment,
  } = useRealInboxMailbox({
    workspaceId: workspace.id,
    enabled: liveMailboxEnabled,
    selectedConversationId: selectedId,
  });

  const {
    signature:
      workspaceEmailSignature,
    isLoading:
      signatureLoading,
  } =
    useWorkspaceEmailSignature({
      workspaceId:
        workspace.id,
    });


  const {
    conversations: internalConversations,
    error: internalInboxError,
    refresh: refreshInternalInbox,
    createThread: createInternalThread,
    addMessage: addInternalMessage,
  } = useInternalInboxThreads({
    workspaceId: workspace.id,
    userId: user.id,
    enabled: liveMailboxEnabled,
  });

  const conversations =
    useMemo(
      () =>
        liveMailboxEnabled
          ? [
              ...mailboxConversations,
              ...internalConversations,
            ]
          : previewConversations,
      [
        internalConversations,
        liveMailboxEnabled,
        mailboxConversations,
        previewConversations,
      ],
    );

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

  const [
    includeSignature,
    setIncludeSignature,
  ] = useState(false);

  const [
    pendingAttachments,
    setPendingAttachments,
  ] = useState([]);

  const [
    attachmentError,
    setAttachmentError,
  ] = useState("");

  const [
    attachmentPreview,
    setAttachmentPreview,
  ] = useState(null);

  const [
    attachmentPreviewLoading,
    setAttachmentPreviewLoading,
  ] = useState("");

  const attachmentInputRef =
    useRef(null);

  const [replyAllThreadId, setReplyAllThreadId] =
    useState("");

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

  const threadBodyRef =
    useRef(null);

  const [
    threadExpanded,
    setThreadExpanded,
  ] = useState(false);

  useEffect(() => {
    return () => {
      if (
        attachmentPreview
          ?.objectUrl
      ) {
        URL.revokeObjectURL(
          attachmentPreview
            .objectUrl,
        );
      }
    };
  }, [
    attachmentPreview,
  ]);


  useEffect(() => {
    if (
      !threadExpanded
    ) {
      return undefined;
    }

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setThreadExpanded(
            false,
          );
        }
      };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    threadExpanded,
  ]);


  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id === selectedId,
    ) ||
    conversations[0] ||
    EMPTY_CONVERSATION;

  const hasSelectedConversation =
    Boolean(
      selectedConversation.id,
    );

  const selectedMessageCount =
    selectedConversation
      ?.messages
      ?.length || 0;

  useEffect(() => {
    if (
      newMessageMode ||
      activeThreadTab !==
        "conversation" ||
      !hasSelectedConversation
    ) {
      return undefined;
    }

    const frameId =
      window.requestAnimationFrame(
        () => {
          const threadBody =
            threadBodyRef.current;

          if (!threadBody) {
            return;
          }

          threadBody.scrollTop =
            threadBody.scrollHeight;
        },
      );

    return () =>
      window.cancelAnimationFrame(
        frameId,
      );
  }, [
    activeThreadTab,
    hasSelectedConversation,
    newMessageMode,
    selectedConversation.id,
    selectedMessageCount,
  ]);

  const replyAllEnabled =
    Boolean(
      selectedConversation
        ?.providerThreadId &&
      replyAllThreadId ===
        selectedConversation
          .providerThreadId,
    );

  const composerNotice =
    replyChannel === "dashboard"
      ? liveMailboxEnabled
        ? internalInboxError
          ? "Campaign Seat internal messaging needs attention before this message can be saved."
          : "Campaign Seat messages stay inside this workspace and are visible only to authorized campaign users."
        : "Campaign Seat internal messaging becomes live after Communications is activated."
      : replyChannel === "email"
        ? mailboxLoading
          ? "Checking connected campaign email..."
          : mailboxConnectedEmail
            ? `Connected campaign email: ${mailboxConnectedEmail}${
                mailboxAccountProvider
                  ? ` · ${mailboxAccountProvider}`
                  : ""
              }.`
            : liveMailboxEnabled
              ? mailboxError
                ? "Campaign email is not connected yet. Connect Gmail or Outlook in Settings → Integrations."
                : "Connect Gmail or Outlook in Settings → Integrations to send and receive email here."
              : "Connect campaign email during Email & Contacts setup to send and receive messages here."
        : "Text and WhatsApp open externally. Confirm the result when you return to Campaign Seat.";

  const configuredSignatureText =
    String(
      workspaceEmailSignature
        ?.signature_text ||
      "",
    ).trim();

  const signatureEnabled =
    workspaceEmailSignature
      ?.enabled ===
      true &&
    Boolean(
      configuredSignatureText,
    );

  const defaultSignatureOnNew =
    signatureEnabled &&
    workspaceEmailSignature
      ?.include_on_new ===
      true;

  const defaultSignatureOnReply =
    signatureEnabled &&
    workspaceEmailSignature
      ?.include_on_reply ===
      true;


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

  const providerInboxTotalCount =
    liveMailboxEnabled &&
    Number.isFinite(
      mailboxInboxTotalCount,
    )
      ? mailboxInboxTotalCount
      : null;

  const providerInboxUnreadCount =
    liveMailboxEnabled &&
    Number.isFinite(
      mailboxInboxUnreadCount,
    )
      ? mailboxInboxUnreadCount
      : null;

  const summaryMetrics = useMemo(
    () =>
      SUMMARY_METRICS.map((metric) => {
        const value =
          metric.id === "unread"
            ? providerInboxUnreadCount !==
                null
              ? providerInboxUnreadCount +
                internalConversations.filter(
                  (conversation) =>
                    conversation.unread,
                ).length
              : conversations.filter(
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
    [
      conversations,
      internalConversations,
      providerInboxUnreadCount,
    ],
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
    if (
      liveMailboxEnabled &&
      providerInboxTotalCount !==
        null
    ) {
      if (
        channelId ===
        "email"
      ) {
        return providerInboxTotalCount;
      }

      if (
        channelId ===
        "all"
      ) {
        return (
          providerInboxTotalCount +
          internalConversations.length
        );
      }
    }

    if (channelId === "all") {
      return conversations.length;
    }

    return conversations.filter(
      (conversation) =>
        conversation.channel ===
        channelId,
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

  const handleAttachmentSelection =
    (event) => {
      const selected =
        Array.from(
          event.target.files ||
          [],
        );

      event.target.value =
        "";

      if (
        !selected.length
      ) {
        return;
      }

      const combined = [
        ...pendingAttachments,
        ...selected,
      ];

      const unique = [];
      const seen =
        new Set();

      combined.forEach(
        (file) => {
          const key =
            [
              file.name,
              file.size,
              file.lastModified,
            ].join(":");

          if (
            seen.has(
              key,
            )
          ) {
            return;
          }

          seen.add(
            key,
          );

          unique.push(
            file,
          );
        },
      );

      if (
        unique.length >
        MAX_EMAIL_ATTACHMENTS
      ) {
        setAttachmentError(
          `Attach up to ${MAX_EMAIL_ATTACHMENTS} files per email.`,
        );

        return;
      }

      const totalBytes =
        unique.reduce(
          (
            total,
            file,
          ) =>
            total +
            Number(
              file.size || 0,
            ),
          0,
        );

      if (
        totalBytes >
        MAX_EMAIL_ATTACHMENT_BYTES
      ) {
        setAttachmentError(
          "Attachments can total up to 20 MB per email.",
        );

        return;
      }

      setPendingAttachments(
        unique,
      );

      setAttachmentError(
        "",
      );
    };

  const removeAttachment =
    (
      attachmentIndex,
    ) => {
      setPendingAttachments(
        (current) =>
          current.filter(
            (
              _file,
              index,
            ) =>
              index !==
              attachmentIndex,
          ),
      );

      setAttachmentError(
        "",
      );
    };

  const openNewMessage = () => {
    setThreadExpanded(false);
    setNewMessageMode(true);
    setReplyText("");
    setIncludeSignature(
      defaultSignatureOnNew,
    );
    setPendingAttachments([]);
    setAttachmentError("");
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
    setIncludeSignature(
      defaultSignatureOnReply,
    );
    const conversationToOpen =
      conversations.find(
        (conversation) =>
          conversation.id ===
          id,
      );

    setSelectedId(id);
    setMobileConversationActive(true);
    setNewMessageMode(false);
    setActiveThreadTab(
      "conversation",
    );

    if (
      liveMailboxEnabled &&
      conversationToOpen
        ?.providerThreadId
    ) {
      markMailboxThreadRead(
        conversationToOpen
          .providerThreadId,
      );
    } else {
      setConversations(
        (current) =>
          current.map(
            (conversation) =>
              conversation.id === id
                ? {
                    ...conversation,
                    unread:
                      false,
                    unreadCount:
                      0,
                  }
                : conversation,
          ),
      );
    }

    setToast(
      conversationToOpen
        ?.providerThreadId
        ? "Conversation opened · read in Campaign Seat."
        : "Conversation opened.",
    );
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

  const sendReply = async () => {
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

    if (
      replyChannel === "dashboard" &&
      liveMailboxEnabled
    ) {
      try {
        if (
          selectedConversation
            ?.internalThreadId
        ) {
          await addInternalMessage({
            threadId:
              selectedConversation
                .internalThreadId,

            body:
              replyText.trim(),
          });

          setToast(
            "Campaign Seat reply saved to the internal conversation.",
          );
        } else {
          const created =
            await createInternalThread({
              contactId:
                selectedConversation
                  ?.contactId ||
                null,

              subject:
                selectedConversation
                  ?.subject ||
                "Campaign Seat conversation",

              body:
                replyText.trim(),
            });

          if (
            created?.threadId
          ) {
            setSelectedId(
              `internal-thread-${created.threadId}`,
            );
          }

          setToast(
            "New internal Campaign Seat conversation created.",
          );
        }

        setReplyText("");
        await refreshInternalInbox();
      } catch (internalError) {
        setToast(
          internalError?.message ||
          "Campaign Seat could not save this internal reply.",
        );
      }

      return;
    }

    if (
      replyChannel === "email" &&
      liveMailboxEnabled
    ) {
      if (
        !selectedConversation
          ?.providerThreadId
      ) {
        setToast(
          "Choose a connected email conversation before replying.",
        );
        return;
      }

      try {
        const hydrated =
          await loadMailboxThread(
            selectedConversation.providerThreadId,
          );

        const replySource =
          [
            ...(
              hydrated?.messages ||
              selectedConversation.messages ||
              []
            ),
          ]
            .reverse()
            .find(
              (message) =>
                message.providerMessageId,
            );

        if (
          !replySource
            ?.providerMessageId
        ) {
          throw new Error(
            "Campaign Seat could not identify the source email for this reply.",
          );
        }

        await replyMailboxEmail({
          replyToMessageId:
            replySource.providerMessageId,

          subject:
            selectedConversation.subject,

          body:
            buildOutboundEmailBody({
              message:
                replyText,
              signatureText:
                configuredSignatureText,
              includeSignature:
                includeSignature &&
                signatureEnabled,
            }),

          replyAll:
            replyAllEnabled,

          attachments:
            pendingAttachments,
        });

        setReplyText("");
        setReplyAllThreadId("");
        setPendingAttachments([]);
        setAttachmentError("");

        setToast(
          replyAllEnabled
            ? "Email Reply All sent from the connected campaign mailbox."
            : "Email reply sent from the connected campaign mailbox.",
        );

        await refreshMailbox();

        await loadMailboxThread(
          selectedConversation.providerThreadId,
        );
      } catch (sendError) {
        setToast(
          sendError?.message ||
          "Campaign Seat could not send this email reply.",
        );
      }

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

  const closeAttachmentPreview =
    () => {
      setAttachmentPreview(
        null,
      );

      setAttachmentPreviewLoading(
        "",
      );
    };


  const previewConversationFile =
    async (
      file,
    ) => {
      if (
        !file
          ?.providerAttachmentId ||
        !file
          ?.providerMessageId
      ) {
        setToast(
          "This file is not attached to a connected mailbox message.",
        );

        return;
      }

      const kind =
        attachmentKind(
          file,
        );

      if (
        kind ===
        "file"
      ) {
        await downloadConversationFile(
          file,
        );

        return;
      }

      setAttachmentPreviewLoading(
        file.id ||
        file.name,
      );

      try {
        const blob =
          await getMailboxAttachmentBlob(
            file,
          );

        const objectUrl =
          URL.createObjectURL(
            blob,
          );

        setAttachmentPreview({
          ...file,
          kind,
          objectUrl,
        });

        setToast(
          `${file.name || "Attachment"} preview opened.`,
        );
      } catch (
        previewError
      ) {
        setToast(
          previewError?.message ||
          "Campaign Seat could not preview this attachment.",
        );
      } finally {
        setAttachmentPreviewLoading(
          "",
        );
      }
    };


  const downloadConversationFile =
    async (file) => {
      if (
        !file
          ?.providerAttachmentId ||
        !file
          ?.providerMessageId
      ) {
        setToast(
          "This preview file is not attached to a connected mailbox message.",
        );
        return;
      }

      try {
        await downloadMailboxAttachment(
          file,
        );

        setToast(
          `${file.name || "Attachment"} download started.`,
        );
      } catch (downloadError) {
        setToast(
          downloadError?.message ||
          "Campaign Seat could not download this attachment.",
        );
      }
    };

  const sendNewMessage = async () => {
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

    const recipientRequired =
      !(
        replyChannel === "dashboard" &&
        liveMailboxEnabled
      );

    if (
      (
        recipientRequired &&
        (
          !recipientName ||
          !destination
        )
      ) ||
      (
        subjectEnabled &&
        !newSubject.trim()
      ) ||
      !replyText.trim()
    ) {
      setToast(
        replyChannel === "dashboard" &&
        liveMailboxEnabled
          ? "Enter a subject and message for the Campaign Seat conversation."
          : subjectEnabled
            ? "Choose a contact, then enter a subject and message."
            : "Choose a contact, then enter your message.",
      );
      return;
    }

    if (
      replyChannel === "dashboard" &&
      liveMailboxEnabled
    ) {
      try {
        const created =
          await createInternalThread({
            contactId:
              selectedContact
                ?.inboxOnly
                ? null
                : selectedContact
                    ?.id ||
                  null,

            subject:
              newSubject.trim(),

            body:
              replyText.trim(),
          });

        setReplyText("");
        setPendingAttachments([]);
        setAttachmentError("");
        setNewRecipient("");
        setNewSubject("");
        setContactQuery("");
        setSelectedContactId("");
        setNewMessageMode(false);
        setActiveThreadTab(
          "conversation",
        );

        await refreshInternalInbox();

        if (
          created?.threadId
        ) {
          setSelectedId(
            `internal-thread-${created.threadId}`,
          );
        }

        setToast(
          "Internal Campaign Seat conversation created.",
        );
      } catch (internalError) {
        setToast(
          internalError?.message ||
          "Campaign Seat could not create this internal conversation.",
        );
      }

      return;
    }

    if (
      replyChannel === "email" &&
      liveMailboxEnabled
    ) {
      try {
        await sendMailboxEmail({
          to: [
            {
              name:
                recipientName,
              email:
                recipientEmail,
            },
          ],

          subject:
            newSubject.trim(),

          body:
            buildOutboundEmailBody({
              message:
                replyText,
              signatureText:
                configuredSignatureText,
              includeSignature:
                includeSignature &&
                signatureEnabled,
            }),

          attachments:
            pendingAttachments,
        });

        setReplyText("");
        setNewRecipient("");
        setNewSubject("");
        setContactQuery("");
        setSelectedContactId("");
        setNewMessageMode(false);
        setActiveThreadTab(
          "conversation",
        );

        setToast(
          "Email sent from the connected campaign mailbox.",
        );

        const nextMailbox =
          await refreshMailbox();

        if (
          nextMailbox?.[0]?.id
        ) {
          setSelectedId(
            nextMailbox[0].id,
          );
        }
      } catch (sendError) {
        setToast(
          sendError?.message ||
          "Campaign Seat could not send this email.",
        );
      }

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

        {liveMailboxEnabled ? (
          <section
            className={[
              styles.mailboxStatus,
              mailboxError
                ? styles.mailboxStatusError
                : mailboxLoading
                  ? styles.mailboxStatusLoading
                  : mailboxConnectedEmail
                    ? styles.mailboxStatusReady
                    : styles.mailboxStatusPending,
            ]
              .filter(Boolean)
              .join(" ")}
            role={
              mailboxError
                ? "alert"
                : "status"
            }
          >
            <span
              className={
                styles.mailboxStatusIcon
              }
            >
              {mailboxLoading ? (
                <LoaderCircle
                  size={19}
                  className={
                    styles.mailboxStatusSpinner
                  }
                />
              ) : mailboxConnectedEmail ? (
                <CheckCircle2
                  size={19}
                />
              ) : (
                <Mail size={19} />
              )}
            </span>

            <div>
              <strong>
                {mailboxError
                  ? "Connected email needs attention"
                  : mailboxLoading
                    ? "Checking connected campaign email"
                    : mailboxConnectedEmail
                      ? "Live campaign email"
                      : "Waiting for live mailbox data"}
              </strong>

              <span>
                {mailboxError
                  ? mailboxError
                  : mailboxLoading
                    ? "Campaign Seat is loading the connected mailbox."
                    : mailboxConnectedEmail
                      ? `${mailboxConnectedEmail}${
                          mailboxAccountProvider
                            ? ` · ${mailboxAccountProvider}`
                            : ""
                        }`
                      : "No connected-email data has been returned yet."}
              </span>
            </div>

            <button
              type="button"
              disabled={
                mailboxLoading
              }
              onClick={() => {
                void refreshMailbox();
              }}
            >
              {mailboxLoading
                ? "Checking…"
                : "Refresh email"}
            </button>
          </section>
        ) : null}

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




        <section
          className={
            styles.inboxControlDeck
          }
        >
          <div
            className={
              styles.inboxControlRow
            }
          >
            <div
              className={
                styles.inboxControlHeading
              }
            >
              <strong>
                Channels
              </strong>

              <small>
                Choose which conversations
                appear in the Inbox
              </small>
            </div>

            <div
              className={
                styles.channelControlList
              }
            >
              {CHANNELS.map(
                (channel) => {
                  const Icon =
                    channel.icon;

                  const unavailable =
                    liveMailboxEnabled &&
                    !LIVE_CONNECTED_CHANNELS
                      .has(
                        channel.id,
                      );

                  return (
                    <button
                      key={
                        channel.id
                      }
                      className={[
                        styles.channelControlButton,

                        activeChannel ===
                          channel.id
                          ? styles.activeChannelControl
                          : "",

                        unavailable
                          ? styles.unavailableChannelControl
                          : "",
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(" ")}
                      type="button"
                      disabled={
                        unavailable
                      }
                      onClick={() => {
                        setActiveChannel(
                          channel.id,
                        );

                        setActiveFilter(
                          "",
                        );
                      }}
                    >
                      <Icon
                        size={16}
                      />

                      <span>
                        {
                          channel.label
                        }
                      </span>

                      <strong>
                        {unavailable
                          ? "Soon"
                          : getChannelCount(
                              channel.id,
                            )}
                      </strong>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div
            className={
              styles.inboxControlRow
            }
          >
            <div
              className={
                styles.inboxControlHeading
              }
            >
              <strong>
                Tags
              </strong>

              <small>
                Organize and narrow
                campaign conversations
              </small>
            </div>

            <div
              className={
                styles.tagControlList
              }
            >
              {TAGS.map(
                (tag) => (
                  <button
                    key={tag}
                    className={[
                      styles.tagControlButton,

                      activeTag ===
                        tag
                        ? styles.activeTagControl
                        : "",
                    ]
                      .filter(
                        Boolean,
                      )
                      .join(" ")}
                    type="button"
                    onClick={() =>
                      setActiveTag(
                        activeTag ===
                          tag
                          ? ""
                          : tag,
                      )
                    }
                  >
                    {tag}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>

        <section
          className={[
            styles.inboxWorkspace,
            mobileConversationActive ||
            newMessageMode
              ? styles.mobileConversationOpen
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <section className={styles.conversationPanel}>
            <header className={styles.listHeader}>
              <div
                className={
                  styles.listHeaderTitle
                }
              >
                <strong>
                  Inbox
                </strong>

                <small>
                  {
                    filteredConversations
                      .length
                  }
                  {" "}
                  conversations loaded
                </small>
              </div>

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
                    {liveMailboxEnabled &&
                    mailboxError
                      ? "Email connection needs attention"
                      : liveMailboxEnabled
                        ? "No live conversations yet"
                        : "No matching conversations"}
                  </strong>

                  <span>
                    {liveMailboxEnabled &&
                    mailboxError
                      ? "Review the connected campaign email before new mailbox conversations can load."
                      : liveMailboxEnabled
                        ? "Connected email and Campaign Seat conversations will appear here."
                        : "Adjust the selected channel, filter, tag, or search."}
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

          {threadExpanded &&
          !newMessageMode ? (
            <button
              className={
                styles.threadExpandScrim
              }
              type="button"
              tabIndex={-1}
              aria-label="Close expanded email"
              onClick={() =>
                setThreadExpanded(
                  false,
                )
              }
            />
          ) : null}

          <article
            className={[
              styles.threadPanel,
              newMessageMode
                ? styles.newMessageModal
                : "",
              threadExpanded &&
              !newMessageMode
                ? styles.threadPanelExpanded
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {!newMessageMode &&
            !hasSelectedConversation ? (
              <div
                className={
                  styles.threadEmptyOverlay
                }
              >
                <span
                  className={
                    styles.threadEmptyIcon
                  }
                >
                  <Mail size={25} />
                </span>

                <strong>
                  {mailboxError
                    ? "Campaign email needs attention"
                    : mailboxLoading
                      ? "Loading campaign email"
                      : "No conversations yet"}
                </strong>

                <p>
                  {mailboxError
                    ? mailboxError
                    : mailboxLoading
                      ? "Campaign Seat is checking the connected mailbox."
                      : "New campaign email and internal Campaign Seat conversations will appear here."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (mailboxError) {
                      window.location.assign(
                        "/workspace/settings?tab=integrations&onboarding=communications",
                      );

                      return;
                    }

                    void refreshMailbox();
                  }}
                >
                  {mailboxError
                    ? "Review email connection"
                    : "Refresh Inbox"}
                </button>
              </div>
            ) : null}

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
                <button
                  type="button"
                  className={
                    styles.mobileBackToInbox
                  }
                  onClick={() => {
                    setMobileConversationActive(
                      false,
                    );

                    setThreadExpanded(
                      false,
                    );
                  }}
                >
                  <ArrowLeft
                    size={17}
                  />

                  <span>
                    Inbox
                  </span>
                </button>

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
                      threadExpanded
                        ? "Exit expanded email view"
                        : "Open email in larger view"
                    }
                    title={
                      threadExpanded
                        ? "Exit larger view"
                        : "Open message larger"
                    }
                    onClick={() =>
                      setThreadExpanded(
                        (current) =>
                          !current,
                      )
                    }
                  >
                    {threadExpanded ? (
                      <Minimize2
                        size={17}
                      />
                    ) : (
                      <Maximize2
                        size={17}
                      />
                    )}
                  </button>

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
                    {replyChannel === "dashboard" &&
                    liveMailboxEnabled
                      ? "Related contact (optional)"
                      : "Recipient"}
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
                      placeholder={
                        replyChannel === "dashboard" &&
                        liveMailboxEnabled
                          ? "Optional: relate this conversation to a campaign contact"
                          : "Search campaign contacts"
                      }
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
              <div
                ref={threadBodyRef}
                className={styles.threadBody}
              >
                <div className={styles.dateDivider}>
                  <span>Today</span>
                </div>

                {selectedConversation.messages.map(
                  (message) => (
                    <div
                      key={message.id}
                      className={[
                        message.direction ===
                        "outbound"
                          ? styles.outboundMessage
                          : styles.inboundMessage,
                        message.htmlBody
                          ? styles.richMessage
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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

                        <SafeEmailBody
                          message={
                            message
                          }
                          getAttachmentBlob={
                            getMailboxAttachmentBlob
                          }
                          expanded={
                            threadExpanded
                          }
                        />

                        {message.attachments
                          ?.length ? (
                          <div
                            className={
                              styles.messageAttachments
                            }
                          >
                            {message.attachments
                              .map(
                                (
                                  file,
                                ) => {
                                  const kind =
                                    attachmentKind(
                                      file,
                                    );

                                  return (
                                    <button
                                      key={
                                        file.id ||
                                        file.name
                                      }
                                      type="button"
                                      className={
                                        styles.messageAttachmentCard
                                      }
                                      onClick={() =>
                                        void previewConversationFile(
                                          file,
                                        )
                                      }
                                    >
                                      <span
                                        className={
                                          styles.messageAttachmentIcon
                                        }
                                      >
                                        {kind ===
                                        "image" ? (
                                          <Image
                                            size={18}
                                          />
                                        ) : (
                                          <FileText
                                            size={18}
                                          />
                                        )}
                                      </span>

                                      <span>
                                        <strong>
                                          {
                                            file.name
                                          }
                                        </strong>

                                        <small>
                                          {kind ===
                                            "image"
                                            ? "Image · Preview"
                                            : kind ===
                                                "pdf"
                                              ? "PDF · Preview"
                                              : humanFileSize(
                                                  file.size,
                                                )}
                                        </small>
                                      </span>

                                      {attachmentPreviewLoading ===
                                      (
                                        file.id ||
                                        file.name
                                      ) ? (
                                        <LoaderCircle
                                          size={16}
                                          className={
                                            styles.attachmentPreviewSpinner
                                          }
                                        />
                                      ) : null}
                                    </button>
                                  );
                                },
                              )}
                          </div>
                        ) : null}
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
                              {humanFileSize(
                                file.size,
                              )}
                              {file.contentType
                                ? ` · ${file.contentType}`
                                : ""}
                            </small>
                          </span>

                            {file.providerAttachmentId &&
                            file.providerMessageId ? (
                              <div
                                className={
                                  styles.fileActions
                                }
                              >
                                {attachmentKind(
                                  file,
                                ) !==
                                "file" ? (
                                  <button
                                    className={
                                      styles.filePreviewButton
                                    }
                                    type="button"
                                    disabled={
                                      attachmentPreviewLoading ===
                                      (
                                        file.id ||
                                        file.name
                                      )
                                    }
                                    onClick={() =>
                                      void previewConversationFile(
                                        file,
                                      )
                                    }
                                  >
                                    {attachmentPreviewLoading ===
                                    (
                                      file.id ||
                                      file.name
                                    )
                                      ? "Loading…"
                                      : "Preview"}
                                  </button>
                                ) : null}

                                <button
                                  className={
                                    styles.fileDownloadButton
                                  }
                                  type="button"
                                  onClick={() =>
                                    downloadConversationFile(
                                      file,
                                    )
                                  }
                                >
                                  Download
                                </button>
                              </div>
                            ) : null}
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
                      Email and Campaign Seat activity can
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

                {newMessageMode ? (
                  <div
                    className={
                      styles.previewNotice
                    }
                  >
                    <CheckCircle2
                      size={16}
                    />

                    <span>
                      {composerNotice}
                    </span>
                  </div>
                ) : null}

                {replyChannel ===
                  "email" &&
                liveMailboxEnabled ? (
                  <>
                    <input
                      ref={
                        attachmentInputRef
                      }
                      className={
                        styles.attachmentInput
                      }
                      type="file"
                      multiple
                      onChange={
                        handleAttachmentSelection
                      }
                    />

                    {newMessageMode ? (
                    <div
                      className={
                        styles.attachmentToolbar
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          attachmentInputRef
                            .current
                            ?.click()
                        }
                      >
                        <Paperclip
                          size={16}
                        />
                        Attach files
                      </button>

                      <small>
                        Up to 10 files · 20 MB total
                      </small>
                    </div>
                    ) : null}

                    {pendingAttachments
                      .length ? (
                      <div
                        className={
                          styles.attachmentQueue
                        }
                      >
                        {pendingAttachments
                          .map(
                            (
                              file,
                              index,
                            ) => (
                              <div
                                key={`${file.name}-${file.lastModified}-${index}`}
                              >
                                <span>
                                  {String(
                                    file.type ||
                                    "",
                                  ).startsWith(
                                    "image/",
                                  ) ? (
                                    <Image
                                      size={17}
                                    />
                                  ) : (
                                    <FileText
                                      size={17}
                                    />
                                  )}
                                </span>

                                <span>
                                  <strong>
                                    {
                                      file.name
                                    }
                                  </strong>

                                  <small>
                                    {
                                      formatAttachmentSize(
                                        file.size,
                                      )
                                    }
                                  </small>
                                </span>

                                <button
                                  type="button"
                                  aria-label={`Remove ${file.name}`}
                                  onClick={() =>
                                    removeAttachment(
                                      index,
                                    )
                                  }
                                >
                                  <X
                                    size={14}
                                  />
                                </button>
                              </div>
                            ),
                          )}
                      </div>
                    ) : null}

                    {attachmentError ? (
                      <div
                        className={
                          styles.workflowError
                        }
                        role="alert"
                      >
                        {
                          attachmentError
                        }
                      </div>
                    ) : null}
                  </>
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

                {replyChannel ===
                  "email" &&
                liveMailboxEnabled &&
                signatureEnabled ? (
                  <section
                    className={
                      styles.composerSignature
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          includeSignature
                        }
                        onChange={(
                          event,
                        ) =>
                          setIncludeSignature(
                            event.target
                              .checked,
                          )
                        }
                      />

                      <span>
                        Include signature
                      </span>
                    </label>

                    {includeSignature ? (
                      <div>
                        <small>
                          {
                            workspaceEmailSignature
                              ?.signature_name ||
                            "Campaign signature"
                          }
                        </small>

                        <pre>
                          {
                            configuredSignatureText
                          }
                        </pre>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        window.location.assign(
                          "/workspace/settings?tab=integrations&onboarding=communications",
                        )
                      }
                    >
                      Edit signature
                    </button>
                  </section>
                ) : signatureLoading &&
                  replyChannel ===
                    "email" &&
                  liveMailboxEnabled ? (
                  <div
                    className={
                      styles.signatureLoading
                    }
                  >
                    Loading campaign signature…
                  </div>
                ) : null}

                <div className={styles.composerFooter}>
                  <div className={styles.replyOptions}>
                    {!newMessageMode &&
                    replyChannel === "email" &&
                    liveMailboxEnabled ? (
                      <button
                        type="button"
                        className={
                          styles.compactAttachButton
                        }
                        onClick={() =>
                          attachmentInputRef
                            .current
                            ?.click()
                        }
                      >
                        <Paperclip
                          size={15}
                        />
                        Attach
                      </button>
                    ) : null}

                    {!newMessageMode &&
                    replyChannel === "email" &&
                    liveMailboxEnabled &&
                    signatureEnabled ? (
                      <label
                        className={
                          styles.compactSignatureToggle
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            includeSignature
                          }
                          onChange={(
                            event,
                          ) =>
                            setIncludeSignature(
                              event.target
                                .checked,
                            )
                          }
                        />

                        <span>
                          Signature
                        </span>
                      </label>
                    ) : null}

                    {!newMessageMode &&
                    replyChannel === "email" &&
                    liveMailboxEnabled &&
                    selectedConversation
                      ?.providerThreadId ? (
                      <button
                        className={[
                          styles.replyAllButton,
                          replyAllEnabled
                            ? styles.replyAllActive
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        onClick={() =>
                          setReplyAllThreadId(
                            replyAllEnabled
                              ? ""
                              : selectedConversation
                                  .providerThreadId,
                          )
                        }
                      >
                        Reply All
                      </button>
                    ) : null}
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
                          : replyChannel === "email" &&
                              liveMailboxEnabled
                            ? replyAllEnabled
                              ? "Reply All"
                              : "Send Reply"
                            : replyChannel === "dashboard" &&
                                liveMailboxEnabled
                              ? "Send Internally"
                              : "Add Reply"}
                    <ChevronDown size={15} />
                  </button>
                </div>
              </footer>
            ) : null}
          </article>
        </section>

        {attachmentPreview ? (
          <div
            className={
              styles.attachmentPreviewOverlay
            }
            role="presentation"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeAttachmentPreview();
              }
            }}
          >
            <section
              className={
                styles.attachmentPreviewModal
              }
              role="dialog"
              aria-modal="true"
              aria-label={
                attachmentPreview
                  .name ||
                "Attachment preview"
              }
            >
              <header>
                <div>
                  <strong>
                    {
                      attachmentPreview
                        .name
                    }
                  </strong>

                  <small>
                    {humanFileSize(
                      attachmentPreview
                        .size,
                    )}
                    {attachmentPreview
                      .contentType
                      ? ` · ${attachmentPreview.contentType}`
                      : ""}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={
                    closeAttachmentPreview
                  }
                  aria-label="Close attachment preview"
                >
                  <X
                    size={18}
                  />
                </button>
              </header>

              <div
                className={
                  styles.attachmentPreviewBody
                }
              >
                {attachmentPreview
                  .kind ===
                "image" ? (
                  <img
                    src={
                      attachmentPreview
                        .objectUrl
                    }
                    alt={
                      attachmentPreview
                        .name ||
                      "Email attachment"
                    }
                  />
                ) : (
                  <iframe
                    title={
                      attachmentPreview
                        .name ||
                      "PDF preview"
                    }
                    src={
                      attachmentPreview
                        .objectUrl
                    }
                  />
                )}
              </div>

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    void downloadConversationFile(
                      attachmentPreview,
                    )
                  }
                >
                  Download
                </button>

                <button
                  type="button"
                  onClick={
                    closeAttachmentPreview
                  }
                >
                  Close
                </button>
              </footer>
            </section>
          </div>
        ) : null}

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
