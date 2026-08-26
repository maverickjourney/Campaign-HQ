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
  Bell,
  CheckCircle2,
  ListTodo,
  LoaderCircle,
  ChevronDown,
  Clock3,
  FileText,
  Folder,
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
  Reply,
  ReplyAll,
  Forward,
  Search,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";

import { CampaignWorkspaceShell } from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";
import { useContactsCommandCenter } from "../../hooks/useContactsCommandCenter";
import { useInternalInboxThreads } from "../../hooks/useInternalInboxThreads";
import { useCommunicationAttachments } from "../../hooks/useCommunicationAttachments";
import { useExternalOutreachHandoff } from "../../hooks/useExternalOutreachHandoff";
import { MAX_CAMPAIGN_FILE_SIZE } from "../../hooks/useFilesCommandCenter";
import { useRealInboxMailbox } from "../../hooks/useRealInboxMailbox";
import {
  inboxWorkflowKey,
  useInboxConversationWorkflows,
} from "../../hooks/useInboxConversationWorkflows";
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
    "sms",
    "whatsapp",
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


function parseComposerRecipients(value) {
  return String(value || "")
    .split(/[;,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((email) => ({
      email,
    }));
}


const STANDARD_MAILBOX_FOLDERS = [
  {
    kind: "inbox",
    label: "Inbox",
  },
  {
    kind: "drafts",
    label: "Drafts",
  },
  {
    kind: "sent",
    label: "Sent",
  },
  {
    kind: "archive",
    label: "Archive",
  },
  {
    kind: "trash",
    label: "Trash",
  },
  {
    kind: "junk",
    label: "Junk",
  },
];

function mailboxFolderKind(folder) {
  const values = [
    folder?.system_folder,
    folder?.display_name,
    folder?.name,
    folder?.id,
  ]
    .map(
      (value) =>
        String(
          value || "",
        )
          .trim()
          .toLowerCase(),
    )
    .filter(Boolean);

  const combined =
    values.join(" ");

  if (/(^|\W)inbox(\W|$)/.test(combined)) {
    return "inbox";
  }

  if (/draft/.test(combined)) {
    return "drafts";
  }

  if (
    /(^|\W)sent(\W|$)|sent items|sent mail/.test(
      combined,
    )
  ) {
    return "sent";
  }

  if (/archive|all mail/.test(combined)) {
    return "archive";
  }

  if (
    /trash|deleted|deleted items|recycle bin/.test(
      combined,
    )
  ) {
    return "trash";
  }

  if (/spam|junk/.test(combined)) {
    return "junk";
  }

  return "folder";
}

function mailboxFolderLabel(folder) {
  const kind =
    mailboxFolderKind(
      folder,
    );

  const standard =
    STANDARD_MAILBOX_FOLDERS.find(
      (item) =>
        item.kind === kind,
    );

  if (standard) {
    return standard.label;
  }

  return (
    String(
      folder?.display_name ||
        folder?.name ||
        "",
    ).trim() ||
    "Folder"
  );
}

function mailboxFolderCount(folder) {
  const raw =
    folder?.total_count ??
    folder?.unread_count;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }

  const value =
    Number(raw);

  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.floor(value),
      )
    : null;
}

function mailboxFolderIcon(kind) {
  switch (kind) {
    case "inbox":
      return Inbox;

    case "drafts":
      return FileText;

    case "sent":
      return Send;

    case "archive":
      return Archive;

    case "trash":
      return Trash2;

    case "junk":
      return ShieldAlert;

    default:
      return Folder;
  }
}

function normalizeEmailAccountKey(
  value,
) {
  return String(
    value || "",
  )
    .trim()
    .toLowerCase();
}

function emailAccountTone(
  value,
) {
  const key =
    normalizeEmailAccountKey(
      value,
    );

  if (!key) {
    return "1";
  }

  let hash =
    0;

  for (
    let index = 0;
    index < key.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        key.charCodeAt(
          index,
        )
      ) >>> 0;
  }

  return String(
    (
      hash %
      6
    ) +
      1,
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
    createTaskReminder,
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

  const [
    selectedMailboxFolderId,
    setSelectedMailboxFolderId,
  ] = useState("");

  /*
   * LOCAL LIVE INBOX
   *
   * The Inbox development workspace on localhost uses the real
   * connected campaign mailbox by default. The explicit query
   * parameter remains supported for other development hosts.
   */
  const liveMailboxEnabled =
    !import.meta.env.DEV ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost" ||
    new URLSearchParams(
      window.location.search,
    ).get("mailbox-live") === "enabled";

  /*
   * Command Center persistence is prepared in this pass,
   * but remains disabled until the additive database
   * migration is reviewed and applied.
   */
  const inboxWorkflowRuntimeEnabled =
    false;

  const {
    rows:
      inboxWorkflowRows,

    byKey:
      inboxWorkflowByKey,

    error:
      inboxWorkflowError,
  } =
    useInboxConversationWorkflows({
      workspaceId:
        workspace.id,

      userId:
        user.id,

      enabled:
        inboxWorkflowRuntimeEnabled,
    });

  const {
    conversations: mailboxConversations,
    connectedEmail: mailboxConnectedEmail,
    accountProvider: mailboxAccountProvider,
    folders: mailboxFolders,
    inboxTotalCount: mailboxInboxTotalCount,
    inboxUnreadCount: mailboxInboxUnreadCount,
    isLoading: mailboxLoading,
    error: mailboxError,
    refresh: refreshMailbox,
    loadThread: loadMailboxThread,
    markThreadRead: markMailboxThreadRead,
    markThreadUnread: markMailboxThreadUnread,
    setThreadStarred: setMailboxThreadStarred,
    moveThreadMessages: moveMailboxThreadMessages,
    archiveThreadMessages: archiveMailboxThreadMessages,
    trashThread: trashMailboxThread,
    createFolder: createMailboxFolder,
    renameFolder: renameMailboxFolder,
    deleteFolder: deleteMailboxFolder,
    sendEmail: sendMailboxEmail,
    replyEmail: replyMailboxEmail,
    getAttachmentBlob: getMailboxAttachmentBlob,
    downloadAttachment: downloadMailboxAttachment,
  } = useRealInboxMailbox({
    workspaceId: workspace.id,
    enabled: liveMailboxEnabled,
    selectedConversationId: selectedId,
    selectedFolderId:
      selectedMailboxFolderId,
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

  const {
    attachFilesToInternalMessage,
    attachFilesToExternalOutreach,
    getCommunicationFileUrl,
    downloadCommunicationFile,
  } = useCommunicationAttachments({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const {
    outreachConversations,
    prepareExternalOutreach,
    markExternalOutreachOpened,
    confirmExternalOutreachSent,
  } = useExternalOutreachHandoff({
    workspaceId: workspace.id,
  });

  const conversations =
    useMemo(
      () =>
        liveMailboxEnabled
          ? [
              ...mailboxConversations,
              ...internalConversations,
              ...outreachConversations,
            ]
          : previewConversations,
      [
        internalConversations,
        liveMailboxEnabled,
        mailboxConversations,
        outreachConversations,
        previewConversations,
      ],
    );

  const [activeChannel, setActiveChannel] =
    useState("all");

  const [
    mailboxMenuOpen,
    setMailboxMenuOpen,
  ] = useState(false);

  const [
    emailAccountMenuOpen,
    setEmailAccountMenuOpen,
  ] = useState(false);

  const [
    selectedEmailAccountKeys,
    setSelectedEmailAccountKeys,
  ] = useState([]);

  const [
    sourceMenuOpen,
    setSourceMenuOpen,
  ] = useState(false);

  const [
    tagMenuOpen,
    setTagMenuOpen,
  ] = useState(false);

  const sourceToolbarRef =
    useRef(null);

  useEffect(() => {
    const handleSourceToolbarPointerDown =
      (event) => {
        if (
          sourceToolbarRef.current &&
          !sourceToolbarRef.current.contains(
            event.target,
          )
        ) {
          setMailboxMenuOpen(false);
          setEmailAccountMenuOpen(false);
          setSourceMenuOpen(false);
          setTagMenuOpen(false);
        }
      };

    document.addEventListener(
      "pointerdown",
      handleSourceToolbarPointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleSourceToolbarPointerDown,
      );
    };
  }, []);

  const [activeFilter, setActiveFilter] =
    useState("");

  const [
    activeCommandFilter,
    setActiveCommandFilter,
  ] = useState("");

  const [activeTag, setActiveTag] = useState("");

  const [
    mailboxActionBusy,
    setMailboxActionBusy,
  ] = useState("");

  const [
    threadMoveMenuOpen,
    setThreadMoveMenuOpen,
  ] = useState(false);

  const [
    createFolderOpen,
    setCreateFolderOpen,
  ] = useState(false);

  const [
    newFolderName,
    setNewFolderName,
  ] = useState("");

  const [
    renamingFolderId,
    setRenamingFolderId,
  ] = useState("");

  const [
    renamingFolderName,
    setRenamingFolderName,
  ] = useState("");

  const mailboxMenuItems =
    useMemo(
      () => {
        const providerItems =
          (
            Array.isArray(
              mailboxFolders,
            )
              ? mailboxFolders
              : []
          ).map(
            (folder) => ({
              id:
                String(
                  folder?.id || "",
                ).trim(),

              kind:
                mailboxFolderKind(
                  folder,
                ),

              label:
                mailboxFolderLabel(
                  folder,
                ),

              count:
                mailboxFolderCount(
                  folder,
                ),

              folder,

              available:
                Boolean(
                  folder?.id,
                ),

              synthetic:
                false,
            }),
          );

        const standardItems =
          STANDARD_MAILBOX_FOLDERS.map(
            (definition) => {
              const match =
                providerItems.find(
                  (item) =>
                    item.kind ===
                    definition.kind,
                );

              if (match) {
                return match;
              }

              return {
                id:
                  `missing:${definition.kind}`,

                kind:
                  definition.kind,

                label:
                  definition.label,

                count:
                  null,

                folder:
                  null,

                available:
                  !liveMailboxEnabled &&
                  definition.kind ===
                    "inbox",

                synthetic:
                  true,
              };
            },
          );

        const customItems =
          providerItems.filter(
            (item) =>
              item.kind ===
                "folder" &&
              item.folder
                ?.system_folder !==
                true,
          );

        return [
          ...standardItems,
          ...customItems,
        ];
      },
      [
        liveMailboxEnabled,
        mailboxFolders,
      ],
    );

  const inboxMailboxItem =
    mailboxMenuItems.find(
      (item) =>
        item.kind ===
        "inbox",
    ) ||
    null;

  const activeMailboxItem =
    (
      selectedMailboxFolderId
        ? mailboxMenuItems.find(
            (item) =>
              item.id ===
              selectedMailboxFolderId,
          )
        : null
    ) ||
    inboxMailboxItem ||
    mailboxMenuItems[0] ||
    {
      id: "",
      kind: "inbox",
      label: "Inbox",
      count: null,
      available: true,
      synthetic: true,
    };

  const activeMailboxKind =
    activeMailboxItem.kind ||
    "inbox";

  const archiveMailboxItem =
    mailboxMenuItems.find(
      (item) =>
        item.kind ===
          "archive" &&
        item.available &&
        !item.synthetic,
    ) ||
    null;

  const selectedMailboxSourceFolderId =
    (
      activeMailboxItem
        ?.available &&
      !activeMailboxItem
        ?.synthetic
    )
      ? activeMailboxItem.id
      : (
          inboxMailboxItem
            ?.available &&
          !inboxMailboxItem
            ?.synthetic
            ? inboxMailboxItem.id
            : ""
        );

  const threadMoveTargets =
    mailboxMenuItems.filter(
      (item) =>
        item.available &&
        !item.synthetic &&
        item.id &&
        (
          item.kind !==
            "folder" ||
          item.folder
            ?.system_folder !==
            true
        ) &&
        item.id !==
          selectedMailboxSourceFolderId &&
        ![
          "drafts",
          "sent",
          "junk",
          "trash",
        ].includes(
          item.kind,
        ),
    );

  const mailboxQuickKinds = [
    "inbox",
    "drafts",
    "sent",
    "trash",
  ];

  const mailboxQuickItems =
    mailboxQuickKinds
      .map(
        (kind) =>
          mailboxMenuItems.find(
            (item) =>
              item.kind === kind,
          ),
      )
      .filter(Boolean);

  const mailboxFolderMenuItems =
    mailboxMenuItems.filter(
      (item) =>
        !mailboxQuickKinds.includes(
          item.kind,
        ),
    );

  const activeMailboxUsesFolderMenu =
    !mailboxQuickKinds.includes(
      activeMailboxKind,
    );

  const emailAccountOptions =
    useMemo(
      () => {
        const accounts =
          new Map();

        const addAccount =
          (
            email,
            provider = "",
          ) => {
            const key =
              normalizeEmailAccountKey(
                email,
              );

            if (!key) {
              return;
            }

            const existing =
              accounts.get(
                key,
              );

            accounts.set(
              key,
              {
                key,
                email:
                  String(
                    email,
                  ).trim(),
                provider:
                  String(
                    provider ||
                    existing?.provider ||
                    "",
                  ).trim(),
                tone:
                  emailAccountTone(
                    key,
                  ),
              },
            );
          };

        addAccount(
          mailboxConnectedEmail,
          mailboxAccountProvider,
        );

        conversations.forEach(
          (conversation) => {
            if (
              conversation.channel !==
              "email"
            ) {
              return;
            }

            addAccount(
              conversation.mailboxEmail ||
                mailboxConnectedEmail,

              conversation
                .mailboxAccountProvider ||
                conversation
                  .accountProvider ||
                mailboxAccountProvider,
            );
          },
        );

        return Array.from(
          accounts.values(),
        ).sort(
          (
            left,
            right,
          ) =>
            left.email.localeCompare(
              right.email,
            ),
        );
      },
      [
        conversations,
        mailboxAccountProvider,
        mailboxConnectedEmail,
      ],
    );

  const selectedEmailAccountSet =
    useMemo(
      () =>
        new Set(
          selectedEmailAccountKeys,
        ),
      [
        selectedEmailAccountKeys,
      ],
    );

  const emailAccountFilterActive =
    emailAccountOptions.length >
      1 &&
    selectedEmailAccountKeys.length >
      0;

  const conversationEmailAccountKey =
    (conversation) => {
      if (
        conversation?.channel !==
        "email"
      ) {
        return "";
      }

      return normalizeEmailAccountKey(
        conversation.mailboxEmail ||
          mailboxConnectedEmail,
      );
    };

  const emailAccountScopedConversations =
    useMemo(
      () => {
        if (
          !selectedEmailAccountKeys.length
        ) {
          return conversations;
        }

        return conversations.filter(
          (conversation) => {
            if (
              conversation.channel !==
              "email"
            ) {
              return true;
            }

            return selectedEmailAccountSet
              .has(
                normalizeEmailAccountKey(
                  conversation.mailboxEmail ||
                    mailboxConnectedEmail,
                ),
              );
          },
        );
      },
      [
        conversations,
        mailboxConnectedEmail,
        selectedEmailAccountKeys,
        selectedEmailAccountSet,
      ],
    );

  const emailAccountButtonLabel =
    selectedEmailAccountKeys.length ===
      0
      ? "All Email Accounts"
      : selectedEmailAccountKeys.length ===
          1
        ? (
            emailAccountOptions.find(
              (account) =>
                account.key ===
                selectedEmailAccountKeys[
                  0
                ],
            )?.email ||
            "Email Account"
          )
        : `${selectedEmailAccountKeys.length} Email Accounts`;

  const [query, setQuery] = useState("");

  const [sortDirection, setSortDirection] =
    useState("newest");

  const [activeThreadTab, setActiveThreadTab] =
    useState("conversation");

  const [replyChannel, setReplyChannel] =
    useState("email");

  const [replyText, setReplyText] = useState("");

  const [
    replyRichHtml,
    setReplyRichHtml,
  ] = useState("");

  const richComposerRef =
    useRef(null);

  const [
    replyComposerOpen,
    setReplyComposerOpen,
  ] = useState(false);

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

  const [newCc, setNewCc] =
    useState("");

  const [newBcc, setNewBcc] =
    useState("");

  const [showCcBcc, setShowCcBcc] =
    useState(false);

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

  const [
    quickTaskMode,
    setQuickTaskMode,
  ] = useState("task");

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

  const [
    pendingExternalHandoff,
    setPendingExternalHandoff,
  ] = useState(null);

  const [
    externalHandoffOpen,
    setExternalHandoffOpen,
  ] = useState(false);

  const [
    externalHandoffStage,
    setExternalHandoffStage,
  ] = useState("ready");

  const [
    externalHandoffBusy,
    setExternalHandoffBusy,
  ] = useState(false);

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

  const selectedProviderThread =
    Boolean(
      selectedConversation
        ?.providerThreadId,
    );

  const selectedThreadInInbox =
    Boolean(
      inboxMailboxItem
        ?.id &&
      Array.isArray(
        selectedConversation
          ?.folderIds,
      ) &&
      selectedConversation
        .folderIds
        .includes(
          inboxMailboxItem.id,
        ),
    );

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
    const seenEmails =
      new Set();
    const seenPhones =
      new Set();
    const seenFallbackNames =
      new Set();

    [
      ...savedContacts,
      ...inboxContacts,
    ].forEach((contact) => {
      const email =
        String(
          contact.email ||
          "",
        )
          .trim()
          .toLowerCase();

      const phone =
        String(
          contact.phone ||
          "",
        )
          .replace(
            /\D/g,
            "",
          );

      const fallbackName =
        contactName(
          contact,
        )
          .trim()
          .toLowerCase();

      const duplicate =
        (
          email &&
          seenEmails.has(
            email,
          )
        ) ||
        (
          phone &&
          seenPhones.has(
            phone,
          )
        ) ||
        (
          !email &&
          !phone &&
          fallbackName &&
          seenFallbackNames.has(
            fallbackName,
          )
        );

      if (
        duplicate
      ) {
        return;
      }

      if (
        email
      ) {
        seenEmails.add(
          email,
        );
      }

      if (
        phone
      ) {
        seenPhones.add(
          phone,
        );
      }

      if (
        !email &&
        !phone &&
        fallbackName
      ) {
        seenFallbackNames.add(
          fallbackName,
        );
      }

      uniqueContacts.push(
        contact,
      );
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

    /*
   * SOURCE-AWARE INBOX METRICS
   *
   * All Messages = combined communication health.
   * A selected source = health for that source only.
   */
  const metricScopeConversations =
    useMemo(
      () =>
        activeChannel ===
          "all"
          ? emailAccountScopedConversations
          : emailAccountScopedConversations
              .filter(
                (conversation) =>
                  conversation.channel ===
                  activeChannel,
              ),
      [
        activeChannel,
        emailAccountScopedConversations,
      ],
    );

  const sourceNonEmailUnreadCount =
    useMemo(
      () =>
        conversations.filter(
          (conversation) =>
            conversation.channel !==
              "email" &&
            conversation.unread,
        ).length,
      [
        conversations,
      ],
    );

  const summaryMetrics =
    useMemo(
      () =>
        SUMMARY_METRICS.map(
          (metric) => {
            let value = 0;

            if (
              metric.id ===
              "unread"
            ) {
              if (
                activeChannel ===
                  "email" &&
                !selectedEmailAccountKeys.length &&
                providerInboxUnreadCount !==
                  null
              ) {
                value =
                  providerInboxUnreadCount;
              } else if (
                activeChannel ===
                  "all" &&
                !selectedEmailAccountKeys.length &&
                providerInboxUnreadCount !==
                  null
              ) {
                value =
                  providerInboxUnreadCount +
                  sourceNonEmailUnreadCount;
              } else {
                value =
                  metricScopeConversations
                    .filter(
                      (
                        conversation,
                      ) =>
                        conversation.unread,
                    )
                    .length;
              }
            } else if (
              metric.id ===
              "needs-response"
            ) {
              value =
                metricScopeConversations
                  .filter(
                    (
                      conversation,
                    ) =>
                      conversation
                        .needsResponse,
                  )
                  .length;
            } else if (
              metric.id ===
              "priority"
            ) {
              value =
                metricScopeConversations
                  .filter(
                    (
                      conversation,
                    ) =>
                      conversation
                        .priority,
                  )
                  .length;
            }

            return {
              ...metric,
              value,
            };
          },
        ),
      [
        activeChannel,
        metricScopeConversations,
        providerInboxUnreadCount,
        selectedEmailAccountKeys.length,
        sourceNonEmailUnreadCount,
      ],
    );

  const inboxCommandMetrics =
    useMemo(
      () => {
        const todayKey =
          new Intl.DateTimeFormat(
            "en-CA",
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
          ).format(
            new Date(),
          );

        const commandRows =
          emailAccountScopedConversations
            .filter(
              (conversation) =>
                Boolean(
                  conversation
                    .providerThreadId,
                ),
            )
            .map(
              (conversation) => {
                const workflow =
                  inboxWorkflowByKey.get(
                    inboxWorkflowKey(
                      conversation,
                    ),
                  ) ||
                  null;

                const status =
                  workflow
                    ?.workflow_status ||
                  (
                    conversation
                      .needsResponse
                      ? "needs_reply"
                      : "open"
                  );

                const followUpKey =
                  workflow
                    ?.follow_up_at
                    ? new Intl.DateTimeFormat(
                        "en-CA",
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
                      ).format(
                        new Date(
                          workflow
                            .follow_up_at,
                        ),
                      )
                    : "";

                const dueToday =
                  Boolean(
                    followUpKey &&
                    followUpKey ===
                      todayKey,
                  );

                const actionable =
                  status ===
                    "needs_reply" ||
                  status ===
                    "waiting_on" ||
                  dueToday;

                return {
                  conversation,
                  workflow,
                  status,
                  dueToday,
                  actionable,
                };
              },
            );

        return [
          {
            id:
              "needs_reply",

            label:
              "Needs Reply",

            icon:
              Mail,

            value:
              commandRows.filter(
                (item) =>
                  item.status ===
                  "needs_reply",
              ).length,
          },

          {
            id:
              "waiting_on",

            label:
              "Waiting On",

            icon:
              Clock3,

            value:
              commandRows.filter(
                (item) =>
                  item.status ===
                  "waiting_on",
              ).length,
          },

          {
            id:
              "due_today",

            label:
              "Due Today",

            icon:
              Bell,

            value:
              commandRows.filter(
                (item) =>
                  item.dueToday,
              ).length,
          },

          {
            id:
              "unassigned",

            label:
              "Unassigned",

            icon:
              UserPlus,

            value:
              commandRows.filter(
                (item) =>
                  item.actionable &&
                  !item.workflow
                    ?.assigned_to,
              ).length,
          },

          {
            id:
              "vip",

            label:
              "VIP",

            icon:
              Star,

            value:
              commandRows.filter(
                (item) =>
                  item.workflow
                    ?.is_vip ===
                  true,
              ).length,
          },
        ];
      },
      [
        emailAccountScopedConversations,
        inboxWorkflowByKey,
      ],
    );


  const filteredConversations = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    const filtered = emailAccountScopedConversations.filter(
      (conversation) => {
        const workflow =
          inboxWorkflowByKey.get(
            inboxWorkflowKey(
              conversation,
            ),
          ) ||
          null;

        const commandStatus =
          workflow
            ?.workflow_status ||
          (
            conversation
              .needsResponse
              ? "needs_reply"
              : "open"
          );

        const followUpToday =
          workflow
            ?.follow_up_at
            ? new Intl.DateTimeFormat(
                "en-CA",
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
              ).format(
                new Date(
                  workflow
                    .follow_up_at,
                ),
              ) ===
              new Intl.DateTimeFormat(
                "en-CA",
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
              ).format(
                new Date(),
              )
            : false;

        const commandActionable =
          commandStatus ===
            "needs_reply" ||
          commandStatus ===
            "waiting_on" ||
          followUpToday;

        if (
          activeCommandFilter ===
            "needs_reply" &&
          commandStatus !==
            "needs_reply"
        ) {
          return false;
        }

        if (
          activeCommandFilter ===
            "waiting_on" &&
          commandStatus !==
            "waiting_on"
        ) {
          return false;
        }

        if (
          activeCommandFilter ===
            "due_today" &&
          !followUpToday
        ) {
          return false;
        }

        if (
          activeCommandFilter ===
            "unassigned" &&
          (
            !commandActionable ||
            workflow
              ?.assigned_to
          )
        ) {
          return false;
        }

        if (
          activeCommandFilter ===
            "vip" &&
          workflow
            ?.is_vip !==
            true
        ) {
          return false;
        }

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
    activeCommandFilter,
    activeFilter,
    activeTag,
    emailAccountScopedConversations,
    inboxWorkflowByKey,
    query,
    sortDirection,
  ]);

  useEffect(() => {
    const campaignSeatSourceSelectionSync =
      window.requestAnimationFrame(
        () => {
          if (
            newMessageMode ||
            !filteredConversations.length
          ) {
            return;
          }

          const selectedStillVisible =
            filteredConversations.some(
              (conversation) =>
                conversation.id ===
                selectedId,
            );

          if (selectedStillVisible) {
            return;
          }

          const nextConversation =
            filteredConversations[0];

          setSelectedId(
            nextConversation.id,
          );

          setReplyComposerOpen(
            false,
          );

          setReplyAllThreadId(
            "",
          );

          setReplyText(
            "",
          );

          setPendingAttachments(
            [],
          );

          setAttachmentError(
            "",
          );

          setActiveThreadTab(
            "conversation",
          );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        campaignSeatSourceSelectionSync,
      );
    };
  }, [
    filteredConversations,
    newMessageMode,
    selectedId,
  ]);

  const getChannelCount = (channelId) => {
    if (
      liveMailboxEnabled &&
      providerInboxTotalCount !==
        null &&
      !selectedEmailAccountKeys.length
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
          conversations.filter(
            (conversation) =>
              conversation.channel !==
              "email",
          ).length
        );
      }
    }

    if (
      channelId ===
      "all"
    ) {
      return emailAccountScopedConversations
        .length;
    }

    return emailAccountScopedConversations
      .filter(
        (conversation) =>
          conversation.channel ===
          channelId,
      )
      .length;
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

  const richComposerEnabled =
    replyChannel ===
      "email" ||
    replyChannel ===
      "dashboard";

  const syncRichComposerState =
    () => {
      const editor =
        richComposerRef.current;

      if (!editor) {
        return;
      }

      setReplyRichHtml(
        editor.innerHTML,
      );

      setReplyText(
        String(
          editor.innerText ||
          "",
        )
          .replace(
            /\u00a0/g,
            " ",
          )
          .trimEnd(),
      );
    };

  const focusRichComposer =
    () => {
      richComposerRef
        .current
        ?.focus();
    };

  const applyComposerCommand =
    (
      command,
      value = null,
    ) => {
      focusRichComposer();

      document.execCommand(
        command,
        false,
        value,
      );

      syncRichComposerState();
    };

  const addComposerLink =
    () => {
      focusRichComposer();

      const rawUrl =
        window.prompt(
          "Enter the link URL",
          "https://",
        );

      if (!rawUrl) {
        return;
      }

      const trimmed =
        rawUrl.trim();

      if (
        !/^https?:\/\//i.test(
          trimmed,
        )
      ) {
        setToast(
          "Links must start with http:// or https://.",
        );

        return;
      }

      document.execCommand(
        "createLink",
        false,
        trimmed,
      );

      syncRichComposerState();
    };

  const handleAttachmentSelection =
    (event) => {
      const selected =
        Array.from(
          event.target.files ||
          [],
        );

      event.target.value = "";

      if (!selected.length) {
        return;
      }

      const combined = [
        ...pendingAttachments,
        ...selected,
      ];

      const unique = [];
      const seen = new Set();

      combined.forEach(
        (file) => {
          const key = [
            file.name,
            file.size,
            file.lastModified,
          ].join(":");

          if (seen.has(key)) {
            return;
          }

          seen.add(key);
          unique.push(file);
        },
      );

      if (
        unique.length >
        MAX_EMAIL_ATTACHMENTS
      ) {
        setAttachmentError(
          `Attach up to ${MAX_EMAIL_ATTACHMENTS} files per message.`,
        );

        return;
      }

      if (
        replyChannel === "email"
      ) {
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
            "Email attachments can total up to 20 MB.",
          );

          return;
        }
      } else {
        const oversizedFile =
          unique.find(
            (file) =>
              Number(
                file.size || 0,
              ) >
              MAX_CAMPAIGN_FILE_SIZE,
          );

        if (oversizedFile) {
          setAttachmentError(
            `${oversizedFile.name} is larger than the 50 MB Campaign Seat file limit.`,
          );

          return;
        }
      }

      setPendingAttachments(
        unique,
      );

      setAttachmentError("");
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

  const openComposerAttachmentPicker = () => {
    const attachmentChannel =
      replyChannel === "dashboard" ||
      replyChannel === "text" ||
      replyChannel === "whatsapp" ||
      (
        replyChannel === "email" &&
        liveMailboxEnabled
      );

    if (
      attachmentChannel
    ) {
      attachmentInputRef
        .current
        ?.click();

      return;
    }

    setToast(
      "File attachments are not available for this channel yet.",
    );
  };


  const openNewMessage = () => {
    setThreadExpanded(false);
    setNewMessageMode(true);
    setReplyText("");
    setReplyRichHtml("");
    setIncludeSignature(
      defaultSignatureOnNew,
    );
    setPendingAttachments([]);
    setAttachmentError("");
    setNewRecipient("");
    setNewSubject("");
    setNewCc("");
    setNewBcc("");
    setShowCcBcc(false);
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

    /*
     * Preserve the message channel the user already selected.
     *
     * Choosing a contact should populate the recipient only.
     * It must not switch Dashboard, Text, or WhatsApp back
     * to Email just because the contact also has an email.
     */
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
    setQuickTaskMode(
      "task",
    );
    setQuickTaskForm(
      defaultTaskForm(
        selectedConversation,
        user.id,
      ),
    );
    setQuickTaskError("");
    setQuickTaskOpen(true);
  };

  const openQuickReminder = () => {
    setQuickTaskMode(
      "reminder",
    );

    const reminderForm =
      defaultTaskForm(
        selectedConversation,
        user.id,
      );

    setQuickTaskForm({
      ...reminderForm,

      title:
        selectedConversation?.sender
          ? `Follow up with ${selectedConversation.sender}`
          : "Reminder",

      dueDate:
        getEasternDateInput(1),

      dueTime:
        "09:00",

      assignedTo:
        user.id,
    });

    setQuickTaskError(
      "",
    );

    setQuickTaskOpen(
      true,
    );
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
      const createdTask =
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

      if (
        quickTaskMode ===
        "reminder"
      ) {
        if (
          !createdTask?.id
        ) {
          throw new Error(
            "The reminder task was created without a task ID.",
          );
        }

        if (!dueAt) {
          throw new Error(
            "Choose a reminder date and time.",
          );
        }

        await createTaskReminder(
          createdTask.id,
          {
            schedule_type:
              "exact",

            exact_at:
              dueAt,

            recipient_scope:
              "assignee",

            message:
              quickTaskForm
                .title
                .trim(),

            is_enabled:
              true,
          },
        );
      }


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

  const startInlineReply =
    ({
      replyAll = false,
    } = {}) => {
      setNewMessageMode(false);

      setActiveThreadTab(
        "conversation",
      );

      const conversationChannel =
        String(
          selectedConversation
            ?.channel ||
            "email",
        ).toLowerCase();

      if (
        conversationChannel ===
        "email"
      ) {
        setReplyChannel(
          "email",
        );
      }

      const nextReplyChannel =
        conversationChannel ===
          "sms"
          ? "text"
          : conversationChannel ===
              "dashboard"
            ? "dashboard"
            : conversationChannel ===
                "whatsapp"
              ? "whatsapp"
              : "email";

      setReplyChannel(
        nextReplyChannel,
      );

      setReplyAllThreadId(
        replyAll &&
        selectedConversation
          ?.providerThreadId
          ? selectedConversation
              .providerThreadId
          : "",
      );

      setReplyComposerOpen(
        true,
      );

      window.requestAnimationFrame(
        () => {
          document
            .querySelector(
              '[data-inline-reply="true"] textarea',
            )
            ?.focus();
        },
      );
    };

  const cancelInlineReply =
    () => {
      setReplyComposerOpen(
        false,
      );

      setReplyAllThreadId(
        "",
      );

      setReplyText(
        "",
      );

      setPendingAttachments(
        [],
      );

      setAttachmentError(
        "",
      );
    };

  const forwardSelectedMessage =
    () => {
      const messages =
        Array.isArray(
          selectedConversation
            ?.messages,
        )
          ? selectedConversation
              .messages
          : [];

      const latestMessage =
        messages[
          messages.length - 1
        ] ||
        null;

      const subject =
        String(
          selectedConversation
            ?.subject ||
            "",
        ).trim();

      const forwardSubject =
        /^fwd:/i.test(
          subject,
        )
          ? subject
          : `Fwd: ${
              subject ||
              "(No subject)"
            }`;

      const forwardBody = [
        "",
        "",
        "---------- Forwarded message ----------",
        `From: ${
          latestMessage
            ?.author ||
          selectedConversation
            ?.sender ||
          "Campaign contact"
        }`,
        `Subject: ${
          subject ||
          "(No subject)"
        }`,
        "",
        String(
          latestMessage
            ?.body ||
          "",
        ).trim(),
      ]
        .join("\n")
        .trim();

      openNewMessage();

      setReplyChannel(
        "email",
      );

      setNewSubject(
        forwardSubject,
      );

      setReplyText(
        forwardBody,
      );
    };

  const openConversation = (id) => {
    setReplyComposerOpen(
      false,
    );

    setReplyAllThreadId(
      "",
    );

    setReplyText(
      "",
    );

    setPendingAttachments(
      [],
    );

    setAttachmentError(
      "",
    );
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
    setReplyRichHtml("");
    setActiveThreadTab(
      "conversation",
    );

    if (
      liveMailboxEnabled &&
      conversationToOpen
        ?.providerThreadId
    ) {
      void markMailboxThreadRead(
        conversationToOpen
          .providerThreadId,
      ).catch(
        () => {
          setToast(
            "The email opened, but Campaign Seat could not sync the read state to the connected mailbox.",
          );
        },
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
        ? "Conversation opened · syncing read status with connected email."
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

  const externalChannelLabel =
    (channel) =>
      channel === "whatsapp"
        ? "WhatsApp"
        : "Text";


  const openDirectExternalChannel =
    ({
      channel,
      phone,
      message,
    }) => {
      const encodedMessage =
        encodeURIComponent(
          String(
            message || "",
          ),
        );

      const normalizedPhone =
        String(
          phone || "",
        )
          .replace(
            /[^0-9+]/g,
            "",
          );

      if (
        channel === "text"
      ) {
        window.location.assign(
          `sms:${normalizedPhone}?&body=${encodedMessage}`,
        );

        return;
      }

      if (
        channel === "whatsapp"
      ) {
        const digits =
          normalizedPhone
            .replace(
              /\D/g,
              "",
            );

        window.open(
          `https://wa.me/${digits}?text=${encodedMessage}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
    };


  const prepareExternalHandoffFromComposer =
    async ({
      channel,
      contactId,
      recipientName,
      recipientPhone,
      messageBody,
      files,
      source,
    }) => {
      if (
        !contactId
      ) {
        setToast(
          "Save or select this person as a Campaign Seat contact before Text or WhatsApp outreach.",
        );

        return false;
      }

      setExternalHandoffBusy(
        true,
      );

      try {
        const prepared =
          await prepareExternalOutreach({
            contactId,
            channel,
            messageBody,
          });

        const outreachId =
          prepared?.outreachId;

        if (
          !outreachId
        ) {
          throw new Error(
            "Campaign Seat could not identify the prepared outreach.",
          );
        }

        const preparedFiles = [
          ...(files || []),
        ];

        if (
          preparedFiles.length
        ) {
          await attachFilesToExternalOutreach({
            outreachId,
            files:
              preparedFiles,
          });
        }

        const handoff = {
          outreachId,

          channel,

          recipientName:
            prepared?.recipientName ||
            recipientName ||
            "Campaign contact",

          recipientPhone:
            prepared?.recipientPhone ||
            recipientPhone ||
            "",

          messageBody:
            prepared?.messageBody ||
            messageBody,

          files:
            preparedFiles,

          source,
        };

        setPendingExternalHandoff(
          handoff,
        );

        setExternalHandoffStage(
          "ready",
        );

        setExternalHandoffOpen(
          true,
        );

        addActivity(
          `${externalChannelLabel(channel)} prepared`,
          preparedFiles.length
            ? `Campaign Seat saved the prepared message and ${preparedFiles.length} attachment${preparedFiles.length === 1 ? "" : "s"} before the external handoff.`
            : "Campaign Seat saved the exact prepared message before the external handoff.",
        );

        setToast(
          `${externalChannelLabel(channel)} outreach prepared in Campaign Seat. Continue when ready.`,
        );

        return true;
      } catch (
        handoffError
      ) {
        setToast(
          handoffError?.message ||
          "Campaign Seat could not prepare this external outreach.",
        );

        return false;
      } finally {
        setExternalHandoffBusy(
          false,
        );
      }
    };


  const openPreparedExternalHandoff =
    async () => {
      const handoff =
        pendingExternalHandoff;

      if (
        !handoff
          ?.outreachId
      ) {
        return;
      }

      setExternalHandoffBusy(
        true,
      );

      try {
        await markExternalOutreachOpened({
          outreachId:
            handoff.outreachId,
        });

        const files =
          Array.from(
            handoff.files ||
            [],
          );

        const canUseFileShare =
          files.length > 0 &&
          typeof navigator !==
            "undefined" &&
          typeof navigator.share ===
            "function" &&
          (
            typeof navigator.canShare !==
              "function" ||
            navigator.canShare({
              files,
            })
          );

        addActivity(
          `${externalChannelLabel(handoff.channel)} handoff opened`,
          files.length
            ? "Campaign Seat opened the device handoff with the prepared message and selected files where the browser supports native file sharing."
            : "Campaign Seat opened the prepared message in the selected external channel.",
        );

        if (
          canUseFileShare
        ) {
          try {
            await navigator.share({
              title:
                `Campaign Seat ${externalChannelLabel(handoff.channel)} message`,

              text:
                handoff.messageBody,

              files,
            });

            setExternalHandoffStage(
              "confirm",
            );

            setToast(
              `Share sheet closed. Confirm whether the ${externalChannelLabel(handoff.channel)} message was actually sent.`,
            );
          } catch (
            shareError
          ) {
            if (
              shareError?.name ===
                "AbortError"
            ) {
              setExternalHandoffStage(
                "ready",
              );

              setToast(
                "Share canceled. The prepared message and files remain saved in Campaign Seat.",
              );

              return;
            }

            throw shareError;
          }

          return;
        }

        openDirectExternalChannel({
          channel:
            handoff.channel,

          phone:
            handoff.recipientPhone,

          message:
            handoff.messageBody,
        });

        setExternalHandoffStage(
          "confirm",
        );

        setToast(
          files.length
            ? `${externalChannelLabel(handoff.channel)} opened. This browser could not inject the selected files automatically, but they remain saved in Campaign Seat for the handoff record.`
            : `${externalChannelLabel(handoff.channel)} opened. Confirm whether it was sent when you return.`,
        );
      } catch (
        handoffError
      ) {
        setExternalHandoffStage(
          "ready",
        );

        setToast(
          handoffError?.message ||
          "Campaign Seat could not open the external handoff.",
        );
      } finally {
        setExternalHandoffBusy(
          false,
        );
      }
    };


  const confirmPreparedExternalHandoff =
    async () => {
      const handoff =
        pendingExternalHandoff;

      if (
        !handoff
          ?.outreachId
      ) {
        return;
      }

      setExternalHandoffBusy(
        true,
      );

      try {
        await confirmExternalOutreachSent({
          outreachId:
            handoff.outreachId,
        });

        addActivity(
          `${externalChannelLabel(handoff.channel)} confirmed sent`,
          "A campaign user confirmed the external send. Campaign Seat preserved the prepared message and attachment record as durable outreach history.",
        );

        setReplyText("");
        setPendingAttachments([]);
        setAttachmentError("");

        if (
          handoff.source ===
            "new"
        ) {
          setNewRecipient("");
          setNewSubject("");
          setNewCc("");
          setNewBcc("");
          setShowCcBcc(false);
          setContactQuery("");
          setSelectedContactId("");
          setNewMessageMode(false);
        }

        setExternalHandoffOpen(
          false,
        );

        setExternalHandoffStage(
          "ready",
        );

        setPendingExternalHandoff(
          null,
        );

        setToast(
          `${externalChannelLabel(handoff.channel)} confirmed sent and saved to Campaign Seat history.`,
        );
      } catch (
        confirmError
      ) {
        setToast(
          confirmError?.message ||
          "Campaign Seat could not confirm this external send.",
        );
      } finally {
        setExternalHandoffBusy(
          false,
        );
      }
    };


  const closePreparedExternalHandoff =
    () => {
      setExternalHandoffOpen(
        false,
      );

      setPendingExternalHandoff(
        null,
      );

      setExternalHandoffStage(
        "ready",
      );

      setToast(
        "The prepared outreach remains saved in Campaign Seat, but it has not been confirmed as sent.",
      );
    };


  const getSavedContactIdForConversation =
    (conversation) => {
      if (
        conversation
          ?.contactId
      ) {
        return conversation
          .contactId;
      }

      const conversationEmail =
        String(
          conversation
            ?.email ||
          "",
        )
          .trim()
          .toLowerCase();

      const conversationPhone =
        String(
          conversation
            ?.phone ||
          "",
        )
          .replace(
            /\D/g,
            "",
          );

      const matchingContact =
        (
          Array.isArray(
            liveContacts,
          )
            ? liveContacts
            : []
        ).find(
          (contact) => {
            const contactEmail =
              String(
                contact
                  ?.email ||
                "",
              )
                .trim()
                .toLowerCase();

            const contactPhone =
              String(
                contact
                  ?.phone ||
                "",
              )
                .replace(
                  /\D/g,
                  "",
                );

            return (
              (
                conversationEmail &&
                contactEmail ===
                  conversationEmail
              ) ||
              (
                conversationPhone &&
                contactPhone ===
                  conversationPhone
              )
            );
          },
        );

      return (
        matchingContact
          ?.id ||
        null
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
      await prepareExternalHandoffFromComposer({
        channel:
          replyChannel,

        contactId:
          getSavedContactIdForConversation(
            selectedConversation,
          ),

        recipientName:
          selectedConversation
            ?.sender ||
          "Campaign contact",

        recipientPhone:
          selectedConversation
            ?.phone ||
          "",

        messageBody:
          replyText.trim(),

        files:
          pendingAttachments,

        source:
          "reply",
      });

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
          const created =
            await addInternalMessage({
              threadId:
                selectedConversation
                  .internalThreadId,

              body:
                replyText.trim(),
            });

          if (
            pendingAttachments.length
          ) {
            await attachFilesToInternalMessage({
              messageId:
                created?.messageId,

              files:
                pendingAttachments,
            });
          }

          setToast(
            pendingAttachments.length
              ? "Campaign Seat reply and attachments saved to the internal conversation."
              : "Campaign Seat reply saved to the internal conversation.",
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
            pendingAttachments.length
          ) {
            await attachFilesToInternalMessage({
              messageId:
                created?.messageId,

              files:
                pendingAttachments,
            });
          }

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
        setPendingAttachments([]);
        setAttachmentError("");
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
        file?.source ===
          "campaign-file" &&
        file?.storagePath
      ) {
        const kind =
          attachmentKind(
            file,
          );

        if (
          kind === "file"
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
          const signedUrl =
            await getCommunicationFileUrl(
              file,
            );

          setAttachmentPreview({
            ...file,
            kind,
            objectUrl:
              signedUrl,
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

        return;
      }

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
        file?.source ===
          "campaign-file" &&
        file?.storagePath
      ) {
        try {
          await downloadCommunicationFile(
            file,
          );

          setToast(
            `${file.name || "Attachment"} download started.`,
          );
        } catch (
          downloadError
        ) {
          setToast(
            downloadError?.message ||
            "Campaign Seat could not download this attachment.",
          );
        }

        return;
      }

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
      replyChannel === "text" ||
      replyChannel === "whatsapp"
    ) {
      await prepareExternalHandoffFromComposer({
        channel:
          replyChannel,

        contactId:
          selectedContact
            ?.inboxOnly
            ? null
            : selectedContact
                ?.id ||
              null,

        recipientName,

        recipientPhone,

        messageBody:
          replyText.trim(),

        files:
          pendingAttachments,

        source:
          "new",
      });

      return;
    }

    if (
      replyChannel === "dashboard" &&
      liveMailboxEnabled
    ) {
      try {
        const dashboardAttachments = [
          ...pendingAttachments,
        ];

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

        if (
          dashboardAttachments.length
        ) {
          if (
            !created?.messageId
          ) {
            throw new Error(
              "Campaign Seat created the conversation but did not return the message ID required for attachments.",
            );
          }

          await attachFilesToInternalMessage({
            messageId:
              created.messageId,

            files:
              dashboardAttachments,
          });
        }

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
          dashboardAttachments.length
            ? "Internal Campaign Seat conversation and attachments created."
            : "Internal Campaign Seat conversation created.",
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

          cc:
            parseComposerRecipients(
              newCc,
            ),

          bcc:
            parseComposerRecipients(
              newBcc,
            ),

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
        setNewCc("");
        setNewBcc("");
        setShowCcBcc(false);
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

  const runMailboxAction =
    async (
      actionKey,
      action,
      successMessage,
    ) => {
      if (
        mailboxActionBusy
      ) {
        return;
      }

      setMailboxActionBusy(
        actionKey,
      );

      try {
        await action();

        setToast(
          successMessage,
        );

        setThreadMoveMenuOpen(
          false,
        );
      } catch (
        actionError
      ) {
        setToast(
          actionError?.message ||
            "Campaign Seat could not update the connected mailbox.",
        );
      } finally {
        setMailboxActionBusy(
          "",
        );
      }
    };


  const handleMailboxReadToggle =
    () => {
      if (
        !selectedConversation
          ?.providerThreadId
      ) {
        return;
      }

      const markUnread =
        !selectedConversation
          .unread;

      void runMailboxAction(
        "read",
        () =>
          markUnread
            ? markMailboxThreadUnread(
                selectedConversation
                  .providerThreadId,
              )
            : markMailboxThreadRead(
                selectedConversation
                  .providerThreadId,
              ),
        markUnread
          ? "Marked unread in the connected mailbox."
          : "Marked read in the connected mailbox.",
      );
    };


  const handleMailboxStarToggle =
    () => {
      if (
        !selectedConversation
          ?.providerThreadId
      ) {
        return;
      }

      const nextStarred =
        !selectedConversation
          .priority;

      void runMailboxAction(
        "star",
        () =>
          setMailboxThreadStarred(
            selectedConversation
              .providerThreadId,
            nextStarred,
          ),
        nextStarred
          ? "Starred in the connected mailbox."
          : "Star removed from the connected mailbox.",
      );
    };


  const handleMailboxArchive =
    () => {
      if (
        !selectedConversation
          ?.providerThreadId ||
        !inboxMailboxItem
          ?.id
      ) {
        return;
      }

      void runMailboxAction(
        "archive",
        () =>
          archiveMailboxThreadMessages(
            selectedConversation
              .providerThreadId,
            {
              inboxFolderId:
                inboxMailboxItem.id,

              archiveFolderId:
                archiveMailboxItem
                  ?.id ||
                "",
            },
          ),
        "Conversation archived in the connected mailbox.",
      );
    };


  const handleMailboxMove =
    (
      targetItem,
    ) => {
      if (
        !selectedConversation
          ?.providerThreadId ||
        !selectedMailboxSourceFolderId ||
        !targetItem?.id
      ) {
        return;
      }

      void runMailboxAction(
        `move:${targetItem.id}`,
        () =>
          moveMailboxThreadMessages({
            threadIdOrConversationId:
              selectedConversation
                .providerThreadId,

            fromFolderId:
              selectedMailboxSourceFolderId,

            targetFolderId:
              targetItem.id,
          }),
        `Moved to ${targetItem.label} in the connected mailbox.`,
      );
    };


  const handleMailboxTrash =
    () => {
      if (
        !selectedConversation
          ?.providerThreadId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          "Move this entire email conversation to the connected mailbox Trash?",
        );

      if (!confirmed) {
        return;
      }

      void runMailboxAction(
        "trash",
        async () => {
          await trashMailboxThread(
            selectedConversation
              .providerThreadId,
          );

          setSelectedId(
            "",
          );
        },
        "Conversation moved to the connected mailbox Trash.",
      );
    };


  const handleCreateMailboxFolder =
    async (
      event,
    ) => {
      event.preventDefault();

      const name =
        newFolderName
          .trim();

      if (!name) {
        return;
      }

      await runMailboxAction(
        "create-folder",
        () =>
          createMailboxFolder({
            name,
          }),
        `Folder "${name}" created in the connected mailbox.`,
      );

      setNewFolderName(
        "",
      );

      setCreateFolderOpen(
        false,
      );
    };


  const startRenameMailboxFolder =
    (
      item,
    ) => {
      setRenamingFolderId(
        item.id,
      );

      setRenamingFolderName(
        item.label,
      );
    };


  const saveMailboxFolderRename =
    async (
      item,
    ) => {
      const name =
        renamingFolderName
          .trim();

      if (
        !name ||
        !item?.id
      ) {
        return;
      }

      await runMailboxAction(
        `rename-folder:${item.id}`,
        () =>
          renameMailboxFolder({
            folderId:
              item.id,

            name,
          }),
        `Folder renamed to "${name}".`,
      );

      setRenamingFolderId(
        "",
      );

      setRenamingFolderName(
        "",
      );
    };


  const handleDeleteMailboxFolder =
    (
      item,
    ) => {
      if (
        !item?.id ||
        item.kind !==
          "folder"
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete the mailbox folder "${item.label}"? This affects the real connected mailbox.`,
        );

      if (!confirmed) {
        return;
      }

      void runMailboxAction(
        `delete-folder:${item.id}`,
        async () => {
          await deleteMailboxFolder(
            item.id,
          );

          if (
            selectedMailboxFolderId ===
            item.id
          ) {
            setSelectedMailboxFolderId(
              "",
            );
          }
        },
        `Folder "${item.label}" deleted from the connected mailbox.`,
      );
    };

  return (
    <CampaignWorkspaceShell activeItem="Inbox">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div
            className={
              styles.inboxHeaderSummary
            }
          >
            <h1>Inbox</h1>

            <div
              className={
                styles.headerMetrics
              }
              aria-label="Inbox status"
            >
              {summaryMetrics
              .filter(
                (metric) =>
                  metric.id ===
                  "unread",
              )
              .map(
                (metric) => {
                  const Icon =
                    metric.icon;

                  const compactLabel =
                    metric.id ===
                    "unread"
                      ? "Unread"
                      : metric.id ===
                          "needs-response"
                        ? "Needs Reply"
                        : "High Priority";

                  return (
                    <button
                      key={metric.id}
                      className={[
                        styles.headerMetricButton,

                        activeFilter ===
                          metric.id
                          ? styles.headerMetricButtonActive
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      aria-pressed={
                        activeFilter ===
                        metric.id
                      }
                      onClick={() => {
                        setActiveFilter(
                          activeFilter ===
                            metric.id
                            ? ""
                            : metric.id,
                        );

                        setActiveChannel(
                          "all",
                        );
                      }}
                    >
                      <Icon
                        size={14}
                      />

                      <strong>
                        {metric.value}
                      </strong>

                      <span>
                        {compactLabel}
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            {liveMailboxEnabled ? (
              <button
                className={[
                  styles.topLiveMailboxButton,

                  mailboxError
                    ? styles.topLiveMailboxError
                    : mailboxLoading
                      ? styles.topLiveMailboxLoading
                      : mailboxConnectedEmail
                        ? styles.topLiveMailboxReady
                        : styles.topLiveMailboxPending,
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                title={
                  mailboxConnectedEmail
                    ? `${mailboxConnectedEmail}${
                        mailboxAccountProvider
                          ? ` · ${mailboxAccountProvider}`
                          : ""
                      }`
                    : "Connected campaign email"
                }
                disabled={
                  mailboxLoading
                }
                onClick={() => {
                  void refreshMailbox();
                }}
              >
                {mailboxLoading ? (
                  <LoaderCircle
                    size={14}
                    className={
                      styles.mailboxStatusSpinner
                    }
                  />
                ) : mailboxConnectedEmail &&
                  !mailboxError ? (
                  <RefreshCw
                    size={14}
                  />
                ) : (
                  <RefreshCw
                    size={14}
                  />
                )}

                <span>
                  {mailboxError
                    ? "Email Issue"
                    : mailboxLoading
                      ? "Checking Email"
                      : mailboxConnectedEmail
                        ? "Live Email"
                        : "Email"}
                </span>
              </button>
            ) : null}
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
              className={
                styles.reminderButton
              }
              type="button"
              onClick={
                openQuickReminder
              }
              title="Create a timed reminder"
            >
              <Bell
                size={18}
              />

              Reminder
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

        <section
          className={
            styles.inboxCommandBar
          }
          aria-label="Inbox command queue"
        >
          <div
            className={
              styles.inboxCommandBarLabel
            }
          >
            <strong>
              Command Queue
            </strong>

            <span>
              Campaign follow-up
            </span>
          </div>

          <div
            className={
              styles.inboxCommandMetrics
            }
          >
            {inboxCommandMetrics.map(
              (metric) => {
                const Icon =
                  metric.icon;

                const active =
                  activeCommandFilter ===
                  metric.id;

                return (
                  <button
                    key={
                      metric.id
                    }
                    className={
                      active
                        ? styles.inboxCommandMetricActive
                        : ""
                    }
                    type="button"
                    aria-pressed={
                      active
                    }
                    onClick={() => {
                      setActiveCommandFilter(
                        (current) =>
                          current ===
                            metric.id
                            ? ""
                            : metric.id,
                      );

                      setActiveFilter(
                        "",
                      );
                    }}
                  >
                    <Icon
                      size={15}
                    />

                    <span>
                      {
                        metric.label
                      }
                    </span>

                    <strong>
                      {
                        metric.value
                      }
                    </strong>
                  </button>
                );
              },
            )}
          </div>

          {activeCommandFilter ? (
            <button
              className={
                styles.inboxCommandClear
              }
              type="button"
              onClick={() =>
                setActiveCommandFilter(
                  "",
                )
              }
            >
              <X
                size={13}
              />

              Clear
            </button>
          ) : null}
        </section>

        <section
          className={
            styles.inboxSourceToolbar
          }
          data-active-channel={
            activeChannel
          }
          ref={sourceToolbarRef}
          aria-label="Inbox message sources and tags"
        >
          <div
            className={
              styles.inboxMailboxQuickBar
            }
            aria-label="Mailbox shortcuts"
          >
            {mailboxQuickItems.map(
              (item) => {
                const ItemIcon =
                  mailboxFolderIcon(
                    item.kind,
                  );

                const active =
                  activeMailboxItem.id ===
                    item.id ||
                  (
                    !selectedMailboxFolderId &&
                    item.kind ===
                      "inbox"
                  );

                return (
                  <button
                    key={
                      item.kind
                    }
                    className={[
                      styles.inboxMailboxQuickButton,

                      active
                        ? styles.inboxMailboxQuickButtonActive
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    disabled={
                      !item.available
                    }
                    onClick={() => {
                      if (
                        !item.available
                      ) {
                        return;
                      }

                      setSelectedMailboxFolderId(
                        item.synthetic
                          ? ""
                          : item.id,
                      );

                      setMailboxMenuOpen(
                        false,
                      );

                      setSourceMenuOpen(
                        false,
                      );

                      setTagMenuOpen(
                        false,
                      );

                      setActiveFilter(
                        "",
                      );

                      if (
                        item.kind !==
                        "inbox"
                      ) {
                        setActiveChannel(
                          "email",
                        );
                      }
                    }}
                  >
                    <ItemIcon
                      size={15}
                    />

                    <span>
                      {item.label}
                    </span>

                    {item.count !==
                    null ? (
                      <strong>
                        {item.count}
                      </strong>
                    ) : null}
                  </button>
                );
              },
            )}
          </div>

          <div
            className={
              styles.inboxMailboxPicker
            }
          >
            <button
              className={[
                styles.inboxMailboxTrigger,

                activeMailboxUsesFolderMenu
                  ? styles.inboxMailboxTriggerActive
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              aria-expanded={
                mailboxMenuOpen
              }
              onClick={() => {
                setMailboxMenuOpen(
                  (current) =>
                    !current,
                );

                setSourceMenuOpen(
                  false,
                );

                setTagMenuOpen(
                  false,
                );
              }}
            >
              <Folder
                size={15}
              />

              <span>
                {activeMailboxUsesFolderMenu
                  ? activeMailboxItem.label
                  : "Folders"}
              </span>

              {activeMailboxUsesFolderMenu &&
              activeMailboxItem.count !==
                null ? (
                <strong>
                  {activeMailboxItem.count}
                </strong>
              ) : null}

              <ChevronDown
                size={14}
              />
            </button>

            {mailboxMenuOpen ? (
              <div
                className={
                  styles.inboxMailboxMenu
                }
              >
                <header
                  className={
                    styles.mailboxFolderMenuHeader
                  }
                >
                  <strong>
                    Folders
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      setCreateFolderOpen(
                        (current) =>
                          !current,
                      )
                    }
                  >
                    <Plus
                      size={14}
                    />

                    New
                  </button>
                </header>

                {createFolderOpen ? (
                  <form
                    className={
                      styles.mailboxFolderCreate
                    }
                    onSubmit={
                      handleCreateMailboxFolder
                    }
                  >
                    <input
                      value={
                        newFolderName
                      }
                      maxLength={120}
                      autoFocus
                      onChange={(
                        event,
                      ) =>
                        setNewFolderName(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Folder name"
                    />

                    <button
                      type="submit"
                      disabled={
                        !newFolderName
                          .trim() ||
                        Boolean(
                          mailboxActionBusy,
                        )
                      }
                    >
                      Create
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreateFolderOpen(
                          false,
                        );

                        setNewFolderName(
                          "",
                        );
                      }}
                    >
                      <X
                        size={14}
                      />
                    </button>
                  </form>
                ) : null}

                <div>
                  {mailboxFolderMenuItems.length ? (
                    mailboxFolderMenuItems.map(
                      (item) => {
                        const ItemIcon =
                          mailboxFolderIcon(
                            item.kind,
                          );

                        const active =
                          activeMailboxItem.id ===
                          item.id;

                        const customFolder =
                          item.kind ===
                            "folder" &&
                          !item.synthetic;

                        const renaming =
                          renamingFolderId ===
                          item.id;

                        return (
                          <div
                            key={
                              item.id
                            }
                            className={
                              styles.mailboxFolderRow
                            }
                          >
                            {renaming ? (
                              <div
                                className={
                                  styles.mailboxFolderRename
                                }
                              >
                                <input
                                  value={
                                    renamingFolderName
                                  }
                                  maxLength={120}
                                  autoFocus
                                  onChange={(
                                    event,
                                  ) =>
                                    setRenamingFolderName(
                                      event.target
                                        .value,
                                    )
                                  }
                                  onKeyDown={(
                                    event,
                                  ) => {
                                    if (
                                      event.key ===
                                      "Enter"
                                    ) {
                                      event.preventDefault();

                                      void saveMailboxFolderRename(
                                        item,
                                      );
                                    }

                                    if (
                                      event.key ===
                                      "Escape"
                                    ) {
                                      setRenamingFolderId(
                                        "",
                                      );

                                      setRenamingFolderName(
                                        "",
                                      );
                                    }
                                  }}
                                />

                                <button
                                  type="button"
                                  disabled={
                                    !renamingFolderName
                                      .trim() ||
                                    Boolean(
                                      mailboxActionBusy,
                                    )
                                  }
                                  onClick={() =>
                                    void saveMailboxFolderRename(
                                      item,
                                    )
                                  }
                                >
                                  Save
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingFolderId(
                                      "",
                                    );

                                    setRenamingFolderName(
                                      "",
                                    );
                                  }}
                                >
                                  <X
                                    size={14}
                                  />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  className={[
                                    styles.inboxMailboxMenuItem,

                                    active
                                      ? styles.inboxMailboxMenuItemActive
                                      : "",

                                    !item.available
                                      ? styles.inboxMailboxMenuItemDisabled
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  type="button"
                                  disabled={
                                    !item.available
                                  }
                                  onClick={() => {
                                    if (
                                      !item.available
                                    ) {
                                      return;
                                    }

                                    setSelectedMailboxFolderId(
                                      item.synthetic
                                        ? ""
                                        : item.id,
                                    );

                                    setMailboxMenuOpen(
                                      false,
                                    );

                                    setSourceMenuOpen(
                                      false,
                                    );

                                    setTagMenuOpen(
                                      false,
                                    );

                                    setActiveFilter(
                                      "",
                                    );

                                    setActiveChannel(
                                      "email",
                                    );
                                  }}
                                >
                                  <span
                                    className={
                                      styles.inboxMailboxMenuIcon
                                    }
                                  >
                                    <ItemIcon
                                      size={16}
                                    />
                                  </span>

                                  <strong>
                                    {
                                      item.label
                                    }
                                  </strong>

                                  {item.count !==
                                  null ? (
                                    <em>
                                      {
                                        item.count
                                      }
                                    </em>
                                  ) : null}
                                </button>

                                {customFolder ? (
                                  <span
                                    className={
                                      styles.mailboxFolderRowActions
                                    }
                                  >
                                    <button
                                      type="button"
                                      title="Rename folder"
                                      aria-label={`Rename ${item.label}`}
                                      disabled={
                                        Boolean(
                                          mailboxActionBusy,
                                        )
                                      }
                                      onClick={() =>
                                        startRenameMailboxFolder(
                                          item,
                                        )
                                      }
                                    >
                                      <Pencil
                                        size={13}
                                      />
                                    </button>

                                    <button
                                      className={
                                        styles.mailboxFolderDeleteButton
                                      }
                                      type="button"
                                      title="Delete folder"
                                      aria-label={`Delete ${item.label}`}
                                      disabled={
                                        Boolean(
                                          mailboxActionBusy,
                                        )
                                      }
                                      onClick={() =>
                                        handleDeleteMailboxFolder(
                                          item,
                                        )
                                      }
                                    >
                                      <Trash2
                                        size={13}
                                      />
                                    </button>
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        );
                      },
                    )
                  ) : (
                    <div
                      className={
                        styles.inboxMailboxMenuEmpty
                      }
                    >
                      No additional folders
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={
              styles.inboxSourcePicker
            }
          >
            <button
              className={[
                styles.inboxSourceTrigger,

                activeChannel !== "all"
                  ? styles.inboxSourceTriggerActive
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              aria-expanded={
                sourceMenuOpen
              }
              onClick={() => {
                setSourceMenuOpen(
                  (current) =>
                    !current,
                );

                setMailboxMenuOpen(
                  false,
                );

                setTagMenuOpen(
                  false,
                );
              }}
            >
              {(() => {
                const activeDefinition =
                  CHANNELS.find(
                    (channel) =>
                      channel.id ===
                      activeChannel,
                  ) ||
                  CHANNELS[0];

                const ActiveIcon =
                  activeDefinition.icon;

                return (
                  <>
                    <ActiveIcon
                      size={15}
                    />

                    <span>
                      {
                        activeDefinition.label
                      }
                    </span>

                    <strong>
                      {getChannelCount(
                        activeDefinition.id,
                      )}
                    </strong>

                    <ChevronDown
                      size={14}
                    />
                  </>
                );
              })()}
            </button>

            {sourceMenuOpen ? (
              <div
                className={
                  styles.inboxSourceMenu
                }
              >
                <header>
                  <strong>
                    Message sources
                  </strong>
                </header>

                <div>
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

                      const isEmail =
                        channel.id ===
                        "email";

                      return (
                        <button
                          key={
                            channel.id
                          }
                          className={[
                            styles.inboxSourceMenuItem,

                            activeChannel ===
                              channel.id
                              ? styles.inboxSourceMenuItemActive
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          type="button"
                          disabled={
                            unavailable
                          }
                          onClick={() => {
                            setActiveChannel(
                              channel.id,
                            );

                            if (
                              channel.id !==
                                "email" &&
                              activeMailboxKind !==
                                "inbox"
                            ) {
                              setSelectedMailboxFolderId(
                                inboxMailboxItem &&
                                inboxMailboxItem.available &&
                                !inboxMailboxItem.synthetic
                                  ? inboxMailboxItem.id
                                  : "",
                              );
                            }

                            setActiveFilter(
                              "",
                            );

                            setSourceMenuOpen(
                              false,
                            );
                          }}
                        >
                          <span
                            className={
                              styles.inboxSourceMenuIcon
                            }
                          >
                            <Icon
                              size={15}
                            />
                          </span>

                          <span
                            className={
                              styles.inboxSourceMenuCopy
                            }
                          >
                            <strong>
                              {
                                channel.label
                              }
                            </strong>
                          </span>

                          <em>
                            {unavailable
                              ? "Soon"
                              : getChannelCount(
                                  channel.id,
                                )}
                          </em>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {(
            activeChannel === "all" ||
            activeChannel === "email"
          ) &&
          emailAccountOptions.length ? (
            <div
              className={
                styles.inboxEmailAccountPicker
              }
            >
              <button
                className={[
                  styles.inboxEmailAccountTrigger,

                  selectedEmailAccountKeys.length
                    ? styles.inboxEmailAccountTriggerActive
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                aria-expanded={
                  emailAccountMenuOpen
                }
                onClick={() => {
                  setEmailAccountMenuOpen(
                    (current) =>
                      !current,
                  );

                  setSourceMenuOpen(
                    false,
                  );

                  setTagMenuOpen(
                    false,
                  );
                }}
              >
                <span
                  className={
                    styles.emailAccountStackIcon
                  }
                >
                  <Mail size={14} />
                </span>

                <span
                  className={
                    styles.emailAccountTriggerLabel
                  }
                >
                  {emailAccountButtonLabel}
                </span>

                <ChevronDown
                  size={14}
                />
              </button>

              {emailAccountMenuOpen ? (
                <div
                  className={
                    styles.inboxEmailAccountMenu
                  }
                >
                  <header>
                    <strong>
                      Email Accounts
                    </strong>
                  </header>

                  <div>
                    <button
                      className={[
                        styles.emailAccountMenuItem,

                        !selectedEmailAccountKeys
                          .length
                          ? styles.emailAccountMenuItemActive
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      onClick={() => {
                        setSelectedEmailAccountKeys(
                          [],
                        );

                        setEmailAccountMenuOpen(
                          false,
                        );
                      }}
                    >
                      <span
                        className={
                          styles.emailAccountAllIcon
                        }
                      >
                        <Mail size={15} />
                      </span>

                      <span>
                        <strong>
                          All Email Accounts
                        </strong>
                      </span>

                      {!selectedEmailAccountKeys
                        .length ? (
                        <CheckCircle2
                          size={16}
                        />
                      ) : null}
                    </button>

                    {emailAccountOptions.map(
                      (account) => {
                        const selected =
                          selectedEmailAccountSet
                            .has(
                              account.key,
                            );

                        return (
                          <button
                            key={
                              account.key
                            }
                            className={[
                              styles.emailAccountMenuItem,

                              selected
                                ? styles.emailAccountMenuItemActive
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-mailbox-tone={
                              account.tone
                            }
                            type="button"
                            onClick={() => {
                              setSelectedEmailAccountKeys(
                                (current) => {
                                  if (
                                    !current.length
                                  ) {
                                    return [
                                      account.key,
                                    ];
                                  }

                                  if (
                                    current.includes(
                                      account.key,
                                    )
                                  ) {
                                    return current.filter(
                                      (key) =>
                                        key !==
                                        account.key,
                                    );
                                  }

                                  return [
                                    ...current,
                                    account.key,
                                  ];
                                },
                              );
                            }}
                          >
                            <span
                              className={
                                styles.emailAccountColorDot
                              }
                            />

                            <span>
                              <strong>
                                {account.email}
                              </strong>

                              {account.provider ? (
                                <small>
                                  {account.provider}
                                </small>
                              ) : null}
                            </span>

                            {selected ? (
                              <CheckCircle2
                                size={16}
                              />
                            ) : null}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <footer>
                    <button
                      type="button"
                      onClick={() =>
                        window.location.assign(
                          "/workspace/settings?tab=integrations&onboarding=communications",
                        )
                      }
                    >
                      Manage email accounts
                    </button>
                  </footer>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className={
              styles.inboxTagPicker
            }
          >
            <button
              className={[
                styles.inboxTagTrigger,

                activeTag
                  ? styles.inboxTagTriggerActive
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              aria-expanded={
                tagMenuOpen
              }
              onClick={() => {
                setTagMenuOpen(
                  (current) =>
                    !current,
                );

                setMailboxMenuOpen(
                  false,
                );

                setSourceMenuOpen(
                  false,
                );
              }}
            >
              <Filter
                size={14}
              />

              <span>
                {activeTag ||
                  "All Tags"}
              </span>

              <ChevronDown
                size={14}
              />
            </button>

            {tagMenuOpen ? (
              <div
                className={
                  styles.inboxTagMenu
                }
              >
                <button
                  className={
                    !activeTag
                      ? styles.inboxTagMenuActive
                      : ""
                  }
                  type="button"
                  onClick={() => {
                    setActiveTag("");
                    setTagMenuOpen(false);
                  }}
                >
                  All Tags
                </button>

                {TAGS.map(
                  (tag) => (
                    <button
                      key={tag}
                      className={
                        activeTag ===
                        tag
                          ? styles.inboxTagMenuActive
                          : ""
                      }
                      type="button"
                      onClick={() => {
                        setActiveTag(
                          tag,
                        );

                        setTagMenuOpen(
                          false,
                        );
                      }}
                    >
                      {tag}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>

          {(
            activeChannel !== "all" ||
            activeTag
          ) ? (
            <button
              className={
                styles.inboxClearSourceFilters
              }
              type="button"
              onClick={() => {
                setActiveChannel(
                  "all",
                );

                setActiveTag(
                  "",
                );

                setActiveFilter(
                  "",
                );

                setSourceMenuOpen(
                  false,
                );

                setTagMenuOpen(
                  false,
                );
              }}
            >
              <X
                size={13}
              />
              Clear
            </button>
          ) : null}

          <span
            className={
              styles.inboxSourceHint
            }
          >
            {activeChannel ===
              "email" &&
            mailboxConnectedEmail
              ? `Showing email from ${mailboxConnectedEmail}`
              : activeChannel ===
                  "all"
                ? "All communication sources"
                : `Showing ${
                    CHANNELS.find(
                      (channel) =>
                        channel.id ===
                        activeChannel,
                    )?.label ||
                    "selected source"
                  }`}
          </span>
        </section>

        <section
          className={[
            styles.inboxWorkspace,

            mobileConversationActive
              ? styles.mobileConversationOpen
              : "",

            newMessageMode
              ? styles.newMessageWorkspace
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
                      data-channel={
                        conversation.channel
                      }
                      className={
                        selectedConversation.id ===
                        conversation.id
                          ? styles.selectedConversation
                          : ""
                      }
                                            data-mailbox-tone={
                        conversation.channel ===
                          "email"
                          ? emailAccountTone(
                              conversation.mailboxEmail ||
                                mailboxConnectedEmail,
                            )
                          : undefined
                      }
                      data-mailbox-email={
                        conversation.channel ===
                          "email"
                          ? normalizeEmailAccountKey(
                              conversation.mailboxEmail ||
                                mailboxConnectedEmail,
                            )
                          : undefined
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

                        <small
                          className={
                            styles.conversationSource
                          }
                        >
                          {getChannelLabel(
                            conversation.channel,
                          )}

                          {conversation.channel ===
                            "email" &&
                          (
                            conversation.mailboxEmail ||
                            mailboxConnectedEmail
                          )
                            ? ` · ${
                                conversation.mailboxEmail ||
                                mailboxConnectedEmail
                              }`
                            : ""}
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

                    <small
                      className={
                        styles.selectedConversationSource
                      }
                    >
                      {selectedConversation.channel ===
                        "email"
                        ? [
                            "Email",
                            selectedConversation.mailboxEmail ||
                              mailboxConnectedEmail,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : getChannelLabel(
                            selectedConversation.channel,
                          )}

                      {selectedConversation.email
                        ? ` · ${selectedConversation.email}`
                        : ""}
                    </small>
                  </span>
                </div>

                <div
                  className={
                    styles.threadHeaderActions
                  }
                >
                  {selectedProviderThread ? (
                    <>
                      <button
                        type="button"
                        aria-label={
                          selectedConversation
                            .unread
                            ? "Mark email read"
                            : "Mark email unread"
                        }
                        title={
                          selectedConversation
                            .unread
                            ? "Mark read"
                            : "Mark unread"
                        }
                        disabled={
                          Boolean(
                            mailboxActionBusy,
                          )
                        }
                        onClick={
                          handleMailboxReadToggle
                        }
                      >
                        <Mail
                          size={17}
                        />
                      </button>

                      <button
                        className={
                          selectedConversation
                            .priority
                            ? styles.mailboxActionActive
                            : ""
                        }
                        type="button"
                        aria-label={
                          selectedConversation
                            .priority
                            ? "Remove star"
                            : "Star email"
                        }
                        aria-pressed={
                          selectedConversation
                            .priority
                        }
                        title={
                          selectedConversation
                            .priority
                            ? "Remove star"
                            : "Star"
                        }
                        disabled={
                          Boolean(
                            mailboxActionBusy,
                          )
                        }
                        onClick={
                          handleMailboxStarToggle
                        }
                      >
                        <Star
                          size={17}
                          fill={
                            selectedConversation
                              .priority
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>

                      <button
                        type="button"
                        aria-label="Archive email"
                        title="Archive"
                        disabled={
                          Boolean(
                            mailboxActionBusy,
                          ) ||
                          !selectedThreadInInbox ||
                          (
                            mailboxAccountProvider ===
                              "microsoft" &&
                            !archiveMailboxItem
                              ?.id
                          )
                        }
                        onClick={
                          handleMailboxArchive
                        }
                      >
                        <Archive
                          size={17}
                        />
                      </button>

                      <span
                        className={
                          styles.threadMoveAction
                        }
                      >
                        <button
                          type="button"
                          aria-label="Move email"
                          title="Move"
                          aria-expanded={
                            threadMoveMenuOpen
                          }
                          disabled={
                            Boolean(
                              mailboxActionBusy,
                            ) ||
                            !selectedMailboxSourceFolderId ||
                            !threadMoveTargets
                              .length
                          }
                          onClick={() =>
                            setThreadMoveMenuOpen(
                              (current) =>
                                !current,
                            )
                          }
                        >
                          <Folder
                            size={17}
                          />
                        </button>

                        {threadMoveMenuOpen ? (
                          <div
                            className={
                              styles.threadMoveMenu
                            }
                          >
                            <header>
                              Move to
                            </header>

                            {threadMoveTargets.map(
                              (item) => (
                                <button
                                  key={
                                    item.id
                                  }
                                  type="button"
                                  disabled={
                                    Boolean(
                                      mailboxActionBusy,
                                    )
                                  }
                                  onClick={() =>
                                    handleMailboxMove(
                                      item,
                                    )
                                  }
                                >
                                  <Folder
                                    size={15}
                                  />

                                  <span>
                                    {
                                      item.label
                                    }
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                      </span>

                      <button
                        className={
                          styles.mailboxActionDanger
                        }
                        type="button"
                        aria-label="Move email conversation to Trash"
                        title="Move to Trash"
                        disabled={
                          Boolean(
                            mailboxActionBusy,
                          )
                        }
                        onClick={
                          handleMailboxTrash
                        }
                      >
                        <Trash2
                          size={17}
                        />
                      </button>

                      <span
                        className={
                          styles.threadActionDivider
                        }
                        aria-hidden="true"
                      />
                    </>
                  ) : null}

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
                    aria-label="Reply to conversation"
                    title="Reply"
                    onClick={() =>
                      startInlineReply()
                    }
                  >
                    <Reply
                      size={17}
                    />
                  </button>

                  {selectedConversation
                    ?.channel ===
                      "email" &&
                  selectedConversation
                    ?.providerThreadId ? (
                    <button
                      type="button"
                      aria-label="Reply all"
                      title="Reply All"
                      onClick={() =>
                        startInlineReply({
                          replyAll:
                            true,
                        })
                      }
                    >
                      <ReplyAll
                        size={17}
                      />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    aria-label="Forward conversation"
                    title="Forward"
                    onClick={
                      forwardSelectedMessage
                    }
                  >
                    <Forward
                      size={17}
                    />
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

                {replyChannel === "email" &&
                liveMailboxEnabled ? (
                  <div
                    className={
                      styles.copyRecipientSection
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.copyRecipientToggle
                      }
                      onClick={() =>
                        setShowCcBcc(
                          (current) =>
                            !current,
                        )
                      }
                    >
                      {showCcBcc
                        ? "Hide Cc / Bcc"
                        : "Add Cc / Bcc"}
                    </button>

                    {showCcBcc ? (
                      <div
                        className={
                          styles.copyRecipientFields
                        }
                      >
                        <label>
                          <span
                            className={
                              styles.fieldLabel
                            }
                          >
                            Cc
                          </span>

                          <input
                            value={newCc}
                            onChange={(event) =>
                              setNewCc(
                                event.target.value,
                              )
                            }
                            placeholder="person@example.com"
                            autoComplete="off"
                          />
                        </label>

                        <label>
                          <span
                            className={
                              styles.fieldLabel
                            }
                          >
                            Bcc
                          </span>

                          <input
                            value={newBcc}
                            onChange={(event) =>
                              setNewBcc(
                                event.target.value,
                              )
                            }
                            placeholder="private@example.com"
                            autoComplete="off"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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

                {!replyComposerOpen &&
                selectedConversation
                  ?.messages
                  ?.length ? (
                  <div
                    className={
                      styles.messageReadActions
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        startInlineReply()
                      }
                    >
                      <Mail
                        size={16}
                      />
                      Reply
                    </button>

                    {selectedConversation
                      ?.channel ===
                        "email" &&
                    selectedConversation
                      ?.providerThreadId ? (
                      <button
                        type="button"
                        onClick={() =>
                          startInlineReply({
                            replyAll:
                              true,
                          })
                        }
                      >
                        <MessageCircle
                          size={16}
                        />
                        Reply All
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={
                        forwardSelectedMessage
                      }
                    >
                      <Send
                        size={16}
                      />
                      Forward
                    </button>
                  </div>
                ) : null}
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

                            {(file.source ===
                              "campaign-file" ||
                            (
                              file.providerAttachmentId &&
                              file.providerMessageId
                            )) ? (
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
                  {(
                    selectedConversation
                      ?.activity ||
                    activityLog
                  ).map((activity) => (
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

            {newMessageMode ||
            (
              activeThreadTab ===
                "conversation" &&
              replyComposerOpen
            ) ? (
              <footer
                className={
                  styles.replyComposer
                }
                data-inline-reply={
                  !newMessageMode
                    ? "true"
                    : undefined
                }
              >

                {!newMessageMode ? (
                  <div
                    className={
                      styles.inlineReplyTopbar
                    }
                  >
                    <strong>
                      {replyAllEnabled
                        ? "Reply All"
                        : "Reply"}
                    </strong>

                    <button
                      type="button"
                      onClick={
                        cancelInlineReply
                      }
                    >
                      <X
                        size={14}
                      />
                      Cancel
                    </button>
                  </div>
                ) : null}

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

                {!newMessageMode &&
                (
                  replyChannel ===
                    "email" ||
                  replyChannel ===
                    "dashboard"
                ) ? (
                  <section
                    className={
                      styles.replyAddressing
                    }
                  >
                    <div>
                      <span>
                        To
                      </span>

                      <strong>
                        {replyChannel ===
                        "email"
                          ? (
                              selectedConversation
                                ?.email ||
                              selectedConversation
                                ?.sender ||
                              "Email recipient"
                            )
                          : (
                              selectedConversation
                                ?.sender ||
                              "Campaign Seat"
                            )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Subject
                      </span>

                      <strong>
                        {replyChannel ===
                        "email"
                          ? (
                              /^re:/i.test(
                                selectedConversation
                                  ?.subject ||
                                "",
                              )
                                ? selectedConversation
                                    ?.subject
                                : `Re: ${
                                    selectedConversation
                                      ?.subject ||
                                    "(No subject)"
                                  }`
                            )
                          : (
                              selectedConversation
                                ?.subject ||
                              "Campaign Seat conversation"
                            )}
                      </strong>
                    </div>
                  </section>
                ) : null}

                {(
                  replyChannel ===
                    "dashboard" ||
                  replyChannel ===
                    "text" ||
                  replyChannel ===
                    "whatsapp" ||
                  (
                    replyChannel ===
                      "email" &&
                    liveMailboxEnabled
                  )
                ) ? (
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

                {richComposerEnabled ? (
                  <section
                    className={
                      styles.richComposerShell
                    }
                  >
                    <div
                      className={
                        styles.richComposerToolbar
                      }
                      aria-label="Message formatting"
                    >
                      <button
                        type="button"
                        title="Undo"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "undo",
                          )
                        }
                      >
                        ↶
                      </button>

                      <button
                        type="button"
                        title="Redo"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "redo",
                          )
                        }
                      >
                        ↷
                      </button>

                      <span
                        className={
                          styles.richToolbarDivider
                        }
                      />

                      <select
                        aria-label="Font"
                        defaultValue="Aptos"
                        onChange={(
                          event,
                        ) =>
                          applyComposerCommand(
                            "fontName",
                            event.target.value,
                          )
                        }
                      >
                        <option value="Aptos">
                          Aptos
                        </option>

                        <option value="Arial">
                          Arial
                        </option>

                        <option value="Georgia">
                          Georgia
                        </option>

                        <option value="Times New Roman">
                          Times New Roman
                        </option>

                        <option value="Courier New">
                          Courier New
                        </option>
                      </select>

                      <select
                        aria-label="Font size"
                        defaultValue="3"
                        onChange={(
                          event,
                        ) =>
                          applyComposerCommand(
                            "fontSize",
                            event.target.value,
                          )
                        }
                      >
                        <option value="2">
                          12
                        </option>

                        <option value="3">
                          14
                        </option>

                        <option value="4">
                          18
                        </option>

                        <option value="5">
                          24
                        </option>

                        <option value="6">
                          32
                        </option>
                      </select>

                      <span
                        className={
                          styles.richToolbarDivider
                        }
                      />

                      <button
                        type="button"
                        className={
                          styles.richToolbarBold
                        }
                        title="Bold"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "bold",
                          )
                        }
                      >
                        B
                      </button>

                      <button
                        type="button"
                        className={
                          styles.richToolbarItalic
                        }
                        title="Italic"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "italic",
                          )
                        }
                      >
                        I
                      </button>

                      <button
                        type="button"
                        className={
                          styles.richToolbarUnderline
                        }
                        title="Underline"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "underline",
                          )
                        }
                      >
                        U
                      </button>

                      <label
                        className={
                          styles.richColorControl
                        }
                        title="Text color"
                      >
                        <span>
                          A
                        </span>

                        <input
                          type="color"
                          defaultValue="#173d62"
                          onChange={(
                            event,
                          ) =>
                            applyComposerCommand(
                              "foreColor",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label
                        className={
                          styles.richHighlightControl
                        }
                        title="Highlight"
                      >
                        <span>
                          ▰
                        </span>

                        <input
                          type="color"
                          defaultValue="#fff2a8"
                          onChange={(
                            event,
                          ) =>
                            applyComposerCommand(
                              "hiliteColor",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <span
                        className={
                          styles.richToolbarDivider
                        }
                      />

                      <button
                        type="button"
                        title="Bulleted list"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "insertUnorderedList",
                          )
                        }
                      >
                        •≡
                      </button>

                      <button
                        type="button"
                        title="Numbered list"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyComposerCommand(
                            "insertOrderedList",
                          )
                        }
                      >
                        1.
                      </button>

                      <button
                        type="button"
                        title="Add link"
                        onMouseDown={(
                          event,
                        ) =>
                          event.preventDefault()
                        }
                        onClick={
                          addComposerLink
                        }
                      >
                        🔗
                      </button>
                    </div>

                    <div
                      ref={
                        richComposerRef
                      }
                      className={
                        styles.richComposerEditor
                      }
                      contentEditable
                      role="textbox"
                      aria-multiline="true"
                      data-placeholder={
                        newMessageMode
                          ? "Write your message..."
                          : "Type your reply..."
                      }
                      suppressContentEditableWarning
                      onInput={
                        syncRichComposerState
                      }
                      onBlur={
                        syncRichComposerState
                      }
                    />
                  </section>
                ) : (
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
                )}

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
                    {(newMessageMode ||
                    replyChannel === "dashboard" ||
                    replyChannel === "text" ||
                    replyChannel === "whatsapp" ||
                    (
                      replyChannel === "email" &&
                      liveMailboxEnabled
                    )) ? (
                      <button
                        type="button"
                        className={
                          styles.compactAttachButton
                        }
                        onClick={
                          openComposerAttachmentPicker
                        }
                      >
                        <Paperclip
                          size={15}
                        />
                        {newMessageMode
                          ? "Attach files"
                          : "Attach"}
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

                  {newMessageMode ? (
                    <div
                      className={
                        styles.replyChannels
                      }
                    >
                      {REPLY_CHANNELS.map(
                        (channel) => {
                          const Icon =
                            channel.icon;

                          return (
                            <button
                              key={
                                channel.id
                              }
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
                              <Icon
                                size={15}
                              />
                              {
                                channel.label
                              }
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : selectedConversation
                      ?.channel ===
                    "email" ? (
                    <div
                      className={
                        styles.lockedReplyChannel
                      }
                      title="Replies to an email conversation are sent by email."
                    >
                      <Mail
                        size={15}
                      />

                      <span>
                        Email
                      </span>

                      <small>
                        Reply channel
                      </small>
                    </div>
                  ) : (
                    <div
                      className={
                        styles.replyChannels
                      }
                    >
                      {REPLY_CHANNELS.map(
                        (channel) => {
                          const Icon =
                            channel.icon;

                          return (
                            <button
                              key={
                                channel.id
                              }
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
                              <Icon
                                size={15}
                              />
                              {
                                channel.label
                              }
                            </button>
                          );
                        },
                      )}
                    </div>
                  )}

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
                      ? replyChannel === "text"
                        ? "Prepare Text"
                        : replyChannel === "whatsapp"
                          ? "Prepare WhatsApp"
                          : "Send Message"
                      : replyChannel === "text"
                        ? "Prepare Text"
                        : replyChannel === "whatsapp"
                          ? "Prepare WhatsApp"
                          : replyChannel === "email" &&
                              liveMailboxEnabled
                            ? replyAllEnabled
                              ? "Reply All"
                              : "Send Reply"
                            : replyChannel === "dashboard" &&
                                liveMailboxEnabled
                              ? "Send Internally"
                              : "Add Reply"}
                    {!newMessageMode ? (
                      <ChevronDown
                        size={15}
                      />
                    ) : null}
                  </button>
                </div>
              </footer>
            ) : null}
          </article>
        </section>

        {externalHandoffOpen &&
        pendingExternalHandoff ? (
          <div
            className={
              styles.handoffOverlay
            }
            role="presentation"
          >
            <section
              className={
                styles.handoffModal
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="external-handoff-title"
            >
              <header>
                <span>
                  {pendingExternalHandoff
                    .channel ===
                  "whatsapp" ? (
                    <MessageCircle
                      size={21}
                    />
                  ) : (
                    <Phone
                      size={21}
                    />
                  )}
                </span>

                <div>
                  <small>
                    External handoff
                  </small>

                  <h2 id="external-handoff-title">
                    {externalHandoffStage ===
                    "confirm"
                      ? `Did you send this ${externalChannelLabel(
                          pendingExternalHandoff.channel,
                        )}?`
                      : `${externalChannelLabel(
                          pendingExternalHandoff.channel,
                        )} is ready`}
                  </h2>
                </div>
              </header>

              <div
                className={
                  styles.handoffBody
                }
              >
                <div
                  className={
                    styles.handoffRecipient
                  }
                >
                  <small>
                    Recipient
                  </small>

                  <strong>
                    {
                      pendingExternalHandoff
                        .recipientName
                    }
                  </strong>

                  <span>
                    {
                      pendingExternalHandoff
                        .recipientPhone
                    }
                  </span>
                </div>

                <div
                  className={
                    styles.handoffMessagePreview
                  }
                >
                  <small>
                    Prepared message
                  </small>

                  <p>
                    {
                      pendingExternalHandoff
                        .messageBody
                    }
                  </p>
                </div>

                {pendingExternalHandoff
                  .files
                  ?.length ? (
                  <div
                    className={
                      styles.handoffFiles
                    }
                  >
                    <Paperclip
                      size={16}
                    />

                    <span>
                      {
                        pendingExternalHandoff
                          .files.length
                      }
                      {" "}
                      {
                        pendingExternalHandoff
                          .files.length ===
                        1
                          ? "file"
                          : "files"
                      }
                      {" "}
                      ready to share
                    </span>
                  </div>
                ) : null}

                <p
                  className={
                    styles.handoffDisclosure
                  }
                >
                  {externalHandoffStage ===
                  "confirm"
                    ? "Campaign Seat has not marked this as sent yet. Confirm only if you actually completed the send in the external app."
                    : "Campaign Seat already saved this prepared message and its files. The external send will not be recorded as sent until you confirm it afterward."}
                </p>
              </div>

              <footer
                className={
                  styles.handoffActions
                }
              >
                {externalHandoffStage ===
                "confirm" ? (
                  <>
                    <button
                      type="button"
                      disabled={
                        externalHandoffBusy
                      }
                      onClick={() =>
                        setExternalHandoffStage(
                          "ready",
                        )
                      }
                    >
                      No, not sent
                    </button>

                    <button
                      type="button"
                      disabled={
                        externalHandoffBusy
                      }
                      onClick={() =>
                        void confirmPreparedExternalHandoff()
                      }
                    >
                      <CheckCircle2
                        size={16}
                      />

                      {externalHandoffBusy
                        ? "Saving…"
                        : "Yes, sent"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={
                        externalHandoffBusy
                      }
                      onClick={
                        closePreparedExternalHandoff
                      }
                    >
                      Back to Campaign Seat
                    </button>

                    <button
                      type="button"
                      disabled={
                        externalHandoffBusy
                      }
                      onClick={() =>
                        void openPreparedExternalHandoff()
                      }
                    >
                      {pendingExternalHandoff
                        .channel ===
                      "whatsapp" ? (
                        <MessageCircle
                          size={16}
                        />
                      ) : (
                        <Phone
                          size={16}
                        />
                      )}

                      {externalHandoffBusy
                        ? "Opening…"
                        : pendingExternalHandoff
                            .files
                            ?.length
                          ? "Open share sheet"
                          : `Open ${externalChannelLabel(
                              pendingExternalHandoff.channel,
                            )}`}
                    </button>
                  </>
                )}
              </footer>
            </section>
          </div>
        ) : null}

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
                      {quickTaskMode ===
                      "reminder"
                        ? "Timed follow-up"
                        : "Inbox follow-up"}
                    </small>

                    <h2 id="quick-task-title">
                      {quickTaskMode ===
                      "reminder"
                        ? "Create Reminder"
                        : "Create Quick Task"}
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

              {quickTaskMode ===
              "reminder" ? (
                <div
                  className={
                    styles.reminderModeNotice
                  }
                >
                  <Bell
                    size={16}
                  />

                  <span>
                    This creates a task for you and
                    schedules a Campaign Seat reminder
                    at the date and time below.
                  </span>
                </div>
              ) : null}

              <label>
                {quickTaskMode ===
                "reminder"
                  ? "Remind me to"
                  : "Task title"}
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
