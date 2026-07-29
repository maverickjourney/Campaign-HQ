import {
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
  Download,
  FileSpreadsheet,
  Filter,
  ListPlus,
  Mail,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Upload,
  UserRound,
  UsersRound,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

import * as XLSX from "xlsx";

import { useLocation } from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useContactsCommandCenter,
} from "../../hooks/useContactsCommandCenter";

import {
  useTeamAccessCommandCenter,
} from "../../hooks/useTeamAccessCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getUserInitials,
} from "../../utils/campaignSession";

import ContactChannelModal from "./ContactChannelModal";
import styles from "./ContactsReferencePreview.module.css";

const CONTACTS_REFERENCE_TIME = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const CONTACT_TYPES = [
  ["supporter", "Supporter"],
  ["volunteer", "Volunteer"],
  ["donor", "Donor"],
  ["vendor", "Vendor"],
  ["media", "Media"],
  ["endorser", "Endorser"],
  ["community_leader", "Community leader"],
  ["elected_official", "Elected official"],
  ["other", "Other"],
];

const STATUSES = [
  ["active", "Active"],
  ["follow_up", "Follow-up"],
  ["do_not_contact", "Do not contact"],
  ["inactive", "Inactive"],
];

const SUPPORT_LEVELS = [
  ["unknown", "Unknown"],
  ["strong_supporter", "Strong supporter"],
  ["lean_supporter", "Lean supporter"],
  ["undecided", "Undecided"],
  ["opposed", "Opposed"],
];

const PRIORITIES = [
  ["normal", "Normal"],
  ["high", "High"],
  ["low", "Low"],
];

const ROLE_OPTIONS = [
  "Supporter",
  "Volunteer",
  "Donor",
  "Voter",
  "Resident",
  "Endorser",
  "Media",
  "Vendor",
  "Community leader",
  "Event attendee",
];

const IMPORT_FIELDS = [
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["organization", "Organization"],
  ["contactType", "Contact type"],
  ["precinct", "Location / precinct"],
  ["status", "Status"],
  ["tags", "Tags"],
  ["notes", "Notes"],
  ["nextFollowUpAt", "Next follow-up"],
  ["emailConsent", "Email consent"],
  ["smsConsent", "Text consent"],
];

const IMPORT_ALIASES = {
  fullName: ["full name", "fullname", "name", "contact name"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "cell"],
  organization: ["organization", "company", "business", "employer"],
  contactType: ["contact type", "type", "category"],
  precinct: ["precinct", "district", "area", "location", "city"],
  status: ["status", "contact status"],
  tags: ["tags", "labels", "groups"],
  notes: ["notes", "comments", "comment"],
  nextFollowUpAt: ["next follow-up", "follow-up date", "next contact"],
  emailConsent: ["email consent", "email opt in", "email opt-in"],
  smsConsent: ["sms consent", "text consent", "text opt in"],
};

const EMPTY_FORM = {
  id: "",
  fullName: "",
  email: "",
  phone: "",
  organization: "",
  contactType: "supporter",
  assignedTo: "",
  precinct: "",
  source: "",
  status: "active",
  notes: "",
  tags: "",
  lists: "",
  roles: "Supporter",
  supportLevel: "unknown",
  priority: "normal",
  lastContactAt: "",
  nextFollowUpAt: "",
  emailConsent: false,
  smsConsent: false,
  consentSource: "",
};

const EMPTY_IMPORT = {
  fileName: "",
  headers: [],
  rows: [],
  mapping: {},
  error: "",
  summary: null,
  isReading: false,
};

const DEMO_CONTACTS = [
  {
    fullName: "Maria Torres",
    email: "maria.torres@example.com",
    phone: "(561) 555-0123",
    organization: "District 6 Neighborhood Coalition",
    contactType: "supporter",
    status: "follow_up",
    precinct: "Wellington, FL 33414",
    source: "Community forum",
    notes: "Strong supporter who is active on transportation and neighborhood-growth issues.",
    lists: ["Supporters", "District 6"],
    roles: ["Supporter", "Voter", "Event attendee"],
    tags: ["Early voter", "Newsletter"],
    supportLevel: "strong_supporter",
    priority: "high",
    emailConsent: true,
    smsConsent: true,
    consentSource: "Community forum sign-in",
    nextFollowUpOffsetDays: -1,
    lastContactOffsetDays: -3,
    activity: [
      ["email", "Opened last campaign email", -13],
      ["message", "Replied to campaign text", -15],
      ["event", "RSVP’d for community event", -17],
    ],
    related: [
      ["Daniel Torres", "Spouse", "Supporter"],
    ],
  },
  {
    fullName: "James Klein",
    email: "james.klein@example.com",
    phone: "(561) 555-0198",
    organization: "",
    contactType: "volunteer",
    status: "active",
    precinct: "West Palm Beach, FL",
    source: "Website volunteer form",
    notes: "Weekend canvassing volunteer and event setup lead.",
    lists: ["Volunteers"],
    roles: ["Volunteer", "Resident"],
    tags: ["Canvassing", "Events"],
    supportLevel: "strong_supporter",
    priority: "normal",
    emailConsent: true,
    smsConsent: true,
    consentSource: "Website volunteer form",
    nextFollowUpOffsetDays: 2,
    lastContactOffsetDays: -2,
    activity: [
      ["event", "Checked in for canvass launch", -4],
      ["message", "Confirmed weekend availability", -7],
    ],
    related: [],
  },
  {
    fullName: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    phone: "(561) 555-0142",
    organization: "Johnson Family Foundation",
    contactType: "donor",
    status: "active",
    precinct: "Palm Beach Gardens, FL",
    source: "Fundraising reception",
    notes: "Major donor prospect interested in public safety and infrastructure.",
    lists: ["Donors"],
    roles: ["Donor", "Supporter"],
    tags: ["Major donor", "PAC"],
    supportLevel: "lean_supporter",
    priority: "high",
    emailConsent: true,
    smsConsent: false,
    consentSource: "Reception registration",
    nextFollowUpOffsetDays: 5,
    lastContactOffsetDays: -6,
    activity: [
      ["note", "Finance team added donor briefing notes", -6],
      ["event", "Attended campaign reception", -10],
    ],
    related: [],
  },
  {
    fullName: "David Chen",
    email: "david.chen@example.com",
    phone: "(561) 555-0176",
    organization: "Palm Beach Small Business Alliance",
    contactType: "supporter",
    status: "inactive",
    precinct: "Lake Worth, FL",
    source: "Candidate introduction",
    notes: "Requested small-business policy updates but has not responded recently.",
    lists: ["Supporters", "Small business"],
    roles: ["Supporter", "Community leader"],
    tags: ["Transportation", "Growth"],
    supportLevel: "lean_supporter",
    priority: "normal",
    emailConsent: true,
    smsConsent: false,
    consentSource: "Email confirmation",
    nextFollowUpOffsetDays: null,
    lastContactOffsetDays: -31,
    activity: [
      ["email", "Sent small-business position summary", -31],
    ],
    related: [],
  },
  {
    fullName: "Emily Rodriguez",
    email: "emily.rodriguez@example.com",
    phone: "(561) 555-0133",
    organization: "",
    contactType: "volunteer",
    status: "active",
    precinct: "Jupiter, FL",
    source: "Community event",
    notes: "Available for social media support and event photography.",
    lists: ["Volunteers"],
    roles: ["Volunteer", "Event attendee"],
    tags: ["Events", "Social"],
    supportLevel: "strong_supporter",
    priority: "normal",
    emailConsent: true,
    smsConsent: true,
    consentSource: "Event sign-in",
    nextFollowUpOffsetDays: 4,
    lastContactOffsetDays: -1,
    activity: [
      ["message", "Shared event photos with communications", -1],
      ["event", "Attended community event", -3],
    ],
    related: [],
  },
  {
    fullName: "Michael Stone",
    email: "michael.stone@example.com",
    phone: "(561) 555-0164",
    organization: "",
    contactType: "supporter",
    status: "active",
    precinct: "Delray Beach, FL",
    source: "Voter outreach",
    notes: "Resident focused on transportation access and family services.",
    lists: ["Voters", "District 6"],
    roles: ["Voter", "Resident"],
    tags: ["Early voter", "Family"],
    supportLevel: "undecided",
    priority: "normal",
    emailConsent: false,
    smsConsent: true,
    consentSource: "Door-to-door opt-in",
    nextFollowUpOffsetDays: 7,
    lastContactOffsetDays: -5,
    activity: [
      ["note", "Canvasser recorded issue priorities", -5],
    ],
    related: [],
  },
  {
    fullName: "Jennifer Lee",
    email: "jennifer.lee@example.com",
    phone: "(561) 555-0189",
    organization: "The County Ledger",
    contactType: "media",
    status: "active",
    precinct: "Wellington, FL",
    source: "Press inquiry",
    notes: "Reporter covering county government and local elections.",
    lists: ["Media"],
    roles: ["Media"],
    tags: ["Press", "News"],
    supportLevel: "unknown",
    priority: "high",
    emailConsent: true,
    smsConsent: false,
    consentSource: "Direct professional contact",
    nextFollowUpOffsetDays: 1,
    lastContactOffsetDays: -1,
    activity: [
      ["email", "Requested candidate availability", -1],
    ],
    related: [],
  },
  {
    fullName: "Robert Martinez",
    email: "robert.martinez@example.com",
    phone: "(561) 555-0112",
    organization: "Palm Springs Civic Association",
    contactType: "community_leader",
    status: "active",
    precinct: "Palm Springs, FL",
    source: "Community referral",
    notes: "Neighborhood leader interested in community growth and drainage improvements.",
    lists: ["Supporters", "Community leaders"],
    roles: ["Supporter", "Community leader", "Resident"],
    tags: ["Community", "Growth"],
    supportLevel: "lean_supporter",
    priority: "normal",
    emailConsent: true,
    smsConsent: false,
    consentSource: "Community referral email",
    nextFollowUpOffsetDays: 3,
    lastContactOffsetDays: -4,
    activity: [
      ["note", "Added neighborhood drainage concerns", -4],
    ],
    related: [],
  },
];

function displayName(user) {
  return user?.fullName || user?.full_name || user?.name || user?.email || "Campaign member";
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y", "opted in", "consented"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function parseCommaList(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function prefixedValues(tags, prefix) {
  const normalizedPrefix = `${prefix.toLowerCase()}:`;

  return (tags || [])
    .map((tag) => String(tag))
    .filter((tag) => tag.toLowerCase().startsWith(normalizedPrefix))
    .map((tag) => tag.slice(normalizedPrefix.length).trim())
    .filter(Boolean);
}

function singlePrefixedValue(tags, prefix, fallback) {
  return prefixedValues(tags, prefix)[0] || fallback;
}

function visibleTags(tags) {
  return (tags || []).filter((tag) => {
    const normalized = String(tag).toLowerCase();
    return !["list:", "role:", "support:", "priority:"].some((prefix) =>
      normalized.startsWith(prefix),
    );
  });
}

function buildMetadataTags({ tags, lists, roles, supportLevel, priority }) {
  return [
    ...visibleTags(parseCommaList(tags)),
    ...parseCommaList(lists).map((list) => `list:${list}`),
    ...parseCommaList(roles).map((role) => `role:${role}`),
    `support:${supportLevel || "unknown"}`,
    `priority:${priority || "normal"}`,
  ];
}

function contactLists(contact) {
  return contact.demo_lists || prefixedValues(contact.tags, "list");
}

function contactRoles(contact) {
  const roles = contact.demo_roles || prefixedValues(contact.tags, "role");
  return roles.length ? roles : [formatLabel(contact.contact_type || "supporter")];
}

function contactSupportLevel(contact) {
  return contact.demo_support_level || singlePrefixedValue(contact.tags, "support", "unknown");
}

function contactPriority(contact) {
  return contact.demo_priority || singlePrefixedValue(contact.tags, "priority", "normal");
}

function contactLocation(contact) {
  return contact.demo_location || contact.precinct || contact.organization || "Location not recorded";
}

function followUpDue(contact, referenceTime) {
  return Boolean(contact.next_follow_up_at) &&
    new Date(contact.next_follow_up_at).getTime() <= referenceTime &&
    !["inactive", "do_not_contact"].includes(contact.status);
}

function formatDateTime(value) {
  if (!value) {
    return { date: "Not scheduled", time: "" };
  }

  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function localDateTimeValue(value) {
  if (!value) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function buildDemoContacts(user, workspace) {
  return DEMO_CONTACTS.map((item, index) => {
    const nextFollowUpAt = item.nextFollowUpOffsetDays === null
      ? null
      : new Date(CONTACTS_REFERENCE_TIME + item.nextFollowUpOffsetDays * DAY).toISOString();

    const lastContactAt = new Date(
      CONTACTS_REFERENCE_TIME + item.lastContactOffsetDays * DAY,
    ).toISOString();

    const createdAt = new Date(CONTACTS_REFERENCE_TIME - (index + 18) * DAY).toISOString();
    const updatedAt = new Date(CONTACTS_REFERENCE_TIME - (index + 1) * 4 * 60 * 60 * 1000).toISOString();

    return {
      id: `demo-contact-${index + 1}`,
      workspace_id: workspace?.id || "",
      full_name: item.fullName,
      email: item.email || null,
      phone: item.phone || null,
      organization: item.organization || null,
      contact_type: item.contactType,
      assigned_to: index === 3 ? null : user?.id || null,
      precinct: item.precinct || null,
      source: item.source || null,
      status: item.status,
      notes: item.notes || null,
      tags: buildMetadataTags({
        tags: item.tags.join(", "),
        lists: item.lists.join(", "),
        roles: item.roles.join(", "),
        supportLevel: item.supportLevel,
        priority: item.priority,
      }),
      demo_lists: item.lists,
      demo_roles: item.roles,
      demo_support_level: item.supportLevel,
      demo_priority: item.priority,
      demo_location: item.precinct,
      demo_activity: item.activity.map(([kind, label, offsetDays], activityIndex) => ({
        id: `demo-activity-${index + 1}-${activityIndex + 1}`,
        kind,
        label,
        occurred_at: new Date(CONTACTS_REFERENCE_TIME + offsetDays * DAY).toISOString(),
      })),
      demo_related: item.related.map(([name, relationship, type], relatedIndex) => ({
        id: `demo-related-${index + 1}-${relatedIndex + 1}`,
        name,
        relationship,
        type,
      })),
      last_contact_at: lastContactAt,
      next_follow_up_at: nextFollowUpAt,
      email_consent: item.emailConsent,
      email_consent_at: item.emailConsent ? new Date(CONTACTS_REFERENCE_TIME - 20 * DAY).toISOString() : null,
      sms_consent: item.smsConsent,
      sms_consent_at: item.smsConsent ? new Date(CONTACTS_REFERENCE_TIME - 20 * DAY).toISOString() : null,
      consent_source: item.consentSource || null,
      created_by: user?.id || "",
      updated_by: user?.id || "",
      created_at: createdAt,
      updated_at: updatedAt,
      is_demo: true,
    };
  });
}

function activityItems(contact, sessionItems = []) {
  const storedItems = Array.isArray(contact.demo_activity)
    ? contact.demo_activity
    : [
        contact.last_contact_at && {
          id: `last-contact-${contact.id}`,
          kind: "contact",
          label: "Last contact recorded",
          occurred_at: contact.last_contact_at,
        },
        contact.updated_at && {
          id: `updated-${contact.id}`,
          kind: "note",
          label: "Contact record updated",
          occurred_at: contact.updated_at,
        },
        contact.created_at && {
          id: `created-${contact.id}`,
          kind: "created",
          label: "Contact added to Campaign Seat",
          occurred_at: contact.created_at,
        },
      ].filter(Boolean);

  return [...sessionItems, ...storedItems].sort(
    (left, right) =>
      new Date(right.occurred_at || 0).getTime() -
      new Date(left.occurred_at || 0).getTime(),
  );
}

function channelLabel(value) {
  const labels = {
    campaign_seat: "Campaign Seat",
    email: "Email",
    text: "Text",
    whatsapp: "WhatsApp",
    call: "Call",
    message: "Text",
    contact: "Contact update",
  };

  return labels[value] || "Not recorded";
}

function suggestedChannelLabel(contact) {
  if (contact.email && contact.email_consent) {
    return "Email";
  }

  if (contact.phone && contact.sms_consent) {
    return "Text";
  }

  if (contact.phone) {
    return "Call";
  }

  return "Campaign Seat";
}

function lastChannelLabel(contact, sessionItems = []) {
  const item = activityItems(
    contact,
    sessionItems,
  ).find(
    (activity) =>
      !activity.internal_only &&
      [
        "campaign_seat",
        "email",
        "message",
        "text",
        "whatsapp",
        "call",
        "contact",
      ].includes(
        activity.channel ||
        activity.kind,
      ),
  );

  return item
    ? channelLabel(item.channel || item.kind)
    : "Not recorded";
}

function contactToForm(contact) {
  return {
    id: contact.id,
    fullName: contact.full_name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    organization: contact.organization || "",
    contactType: contact.contact_type || "supporter",
    assignedTo: contact.assigned_to || "",
    precinct: contact.precinct || "",
    source: contact.source || "",
    status: contact.status || "active",
    notes: contact.notes || "",
    tags: visibleTags(contact.tags).join(", "),
    lists: contactLists(contact).join(", "),
    roles: contactRoles(contact).join(", "),
    supportLevel: contactSupportLevel(contact),
    priority: contactPriority(contact),
    lastContactAt: localDateTimeValue(contact.last_contact_at),
    nextFollowUpAt: localDateTimeValue(contact.next_follow_up_at),
    emailConsent: Boolean(contact.email_consent),
    smsConsent: Boolean(contact.sms_consent),
    consentSource: contact.consent_source || "",
  };
}

function savePayload(form) {
  return {
    ...form,
    tags: buildMetadataTags(form),
    lastContactAt: form.lastContactAt
      ? new Date(form.lastContactAt).toISOString()
      : null,
    nextFollowUpAt: form.nextFollowUpAt
      ? new Date(form.nextFollowUpAt).toISOString()
      : null,
  };
}

function demoRecordFromForm({ form, existing, workspaceId, userId }) {
  const timestamp = new Date().toISOString();
  const payload = savePayload(form);

  return {
    id: existing?.id || `demo-contact-${
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now()
    }`,
    workspace_id: workspaceId,
    full_name: form.fullName.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    organization: form.organization.trim() || null,
    contact_type: form.contactType,
    assigned_to: form.assignedTo || null,
    precinct: form.precinct.trim() || null,
    source: form.source.trim() || null,
    status: form.status,
    notes: form.notes.trim() || null,
    tags: payload.tags,
    last_contact_at: payload.lastContactAt,
    next_follow_up_at: payload.nextFollowUpAt,
    email_consent: Boolean(form.emailConsent),
    email_consent_at: form.emailConsent ? existing?.email_consent_at || timestamp : null,
    sms_consent: Boolean(form.smsConsent),
    sms_consent_at: form.smsConsent ? existing?.sms_consent_at || timestamp : null,
    consent_source: form.consentSource.trim() || null,
    created_by: existing?.created_by || userId,
    updated_by: userId,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
    demo_activity: existing?.demo_activity || [],
    demo_related: existing?.demo_related || [],
    is_demo: true,
  };
}

function normalizeType(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CONTACT_TYPES.some(([key]) => key === normalized) ? normalized : "supporter";
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUSES.some(([key]) => key === normalized) ? normalized : "active";
}

function parseImportDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function autoMap(headers) {
  const normalized = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header),
  }));

  return Object.fromEntries(
    IMPORT_FIELDS.map(([key]) => {
      const match = normalized.find((item) => (IMPORT_ALIASES[key] || []).includes(item.normalized));
      return [key, match?.header || ""];
    }),
  );
}

async function readSpreadsheet(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("The spreadsheet does not contain a worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });

  if (!rows.length) {
    throw new Error("The spreadsheet does not contain any contact rows.");
  }

  if (rows.length > 5000) {
    throw new Error("Import up to 5,000 contacts at a time.");
  }

  return { headers: Object.keys(rows[0]), rows };
}

function buildImport({ rows, mapping, contacts }) {
  const existingEmails = new Set(contacts.map((contact) => normalizeEmail(contact.email)).filter(Boolean));
  const existingPhones = new Set(contacts.map((contact) => normalizePhone(contact.phone)).filter(Boolean));
  const seenEmails = new Set();
  const seenPhones = new Set();
  const records = [];
  let duplicates = 0;
  let invalid = 0;

  rows.forEach((row) => {
    const value = (key) => (mapping[key] ? row[mapping[key]] : "");
    const fullName = String(value("fullName") || "").trim();
    const email = String(value("email") || "").trim();
    const phone = String(value("phone") || "").trim();
    const emailKey = normalizeEmail(email);
    const phoneKey = normalizePhone(phone);

    if (!fullName) {
      invalid += 1;
      return;
    }

    const duplicate =
      (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) ||
      (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey)));

    if (duplicate) {
      duplicates += 1;
      return;
    }

    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);

    records.push({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      organization: String(value("organization") || "").trim() || null,
      contact_type: normalizeType(value("contactType")),
      assigned_to: null,
      precinct: String(value("precinct") || "").trim() || null,
      source: "Spreadsheet import",
      status: normalizeStatus(value("status")),
      notes: String(value("notes") || "").trim() || null,
      tags: parseCommaList(value("tags")),
      next_follow_up_at: parseImportDate(value("nextFollowUpAt")),
      email_consent: parseBoolean(value("emailConsent")),
      sms_consent: parseBoolean(value("smsConsent")),
      consent_source: null,
    });
  });

  return { records, duplicates, invalid };
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(contacts, memberMap) {
  const headers = [
    "Full name",
    "Email",
    "Phone",
    "Location / precinct",
    "Organization",
    "Relationship type",
    "Roles",
    "Lists",
    "Tags",
    "Support level",
    "Priority",
    "Status",
    "Owner",
    "Next follow-up",
    "Email consent",
    "Text consent",
    "Notes",
  ];

  const rows = contacts.map((contact) => [
    contact.full_name,
    contact.email || "",
    contact.phone || "",
    contactLocation(contact),
    contact.organization || "",
    formatLabel(contact.contact_type),
    contactRoles(contact).join("; "),
    contactLists(contact).join("; "),
    visibleTags(contact.tags).join("; "),
    formatLabel(contactSupportLevel(contact)),
    formatLabel(contactPriority(contact)),
    formatLabel(contact.status),
    memberMap.get(contact.assigned_to)?.fullName || "Unassigned",
    contact.next_follow_up_at || "",
    contact.email_consent ? "Yes" : "No",
    contact.sms_consent ? "Yes" : "No",
    contact.notes || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `campaign-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ActivityIcon({ kind }) {
  if (kind === "email") return <Mail size={15} />;

  if (
    ["message", "text", "whatsapp", "campaign_seat"].includes(kind)
  ) {
    return <MessageSquareText size={15} />;
  }

  if (kind === "call") return <Phone size={15} />;
  if (kind === "event") return <CalendarClock size={15} />;
  return <CircleDot size={15} />;
}

export default function ContactsReferencePreview() {
  const location = useLocation();
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const demoMode = new URLSearchParams(location.search).get("contacts-demo") === "1";

  const [demoContacts, setDemoContacts] = useState(() => buildDemoContacts(user, workspace));
  const [selectedContactId, setSelectedContactId] = useState("");

  const [
    detailsTab,
    setDetailsTab,
  ] = useState("overview");

  const [
    detailsExpanded,
    setDetailsExpanded,
  ] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [importState, setImportState] = useState(EMPTY_IMPORT);
  const [bulkList, setBulkList] = useState("");
  const [bulkOwner, setBulkOwner] = useState("");
  const [channelContactId, setChannelContactId] = useState("");
  const [sessionActivityByContact, setSessionActivityByContact] = useState({});

  const {
    contacts: liveContacts,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    saveContact,
    importContacts,
    archiveContact,
  } = useContactsCommandCenter({
    workspaceId: demoMode ? "" : workspace.id,
    userId: user.id,
  });

  const {
    members: liveMembers,
    isLoading: membersLoading,
  } = useTeamAccessCommandCenter({
    workspaceId: workspace.id,
  });

  const members = useMemo(() => {
    const map = new Map();

    (Array.isArray(liveMembers) ? liveMembers : []).forEach((member) => {
      map.set(member.userId, member);
    });

    if (user.id) {
      map.set(user.id, {
        userId: user.id,
        fullName: displayName(user),
        email: user.email || "",
        displayTitle: "Candidate",
      });
    }

    return Array.from(map.values()).sort((left, right) =>
      String(left.fullName || "").localeCompare(String(right.fullName || "")),
    );
  }, [liveMembers, user]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const contacts = useMemo(
    () => (demoMode ? demoContacts : Array.isArray(liveContacts) ? liveContacts : []),
    [demoContacts, demoMode, liveContacts],
  );

  const referenceTime = Math.max(lastUpdated?.getTime() || 0, CONTACTS_REFERENCE_TIME);

  const listOptions = useMemo(
    () => [...new Set(contacts.flatMap(contactLists))].sort((a, b) => a.localeCompare(b)),
    [contacts],
  );

  const tagOptions = useMemo(
    () => [...new Set(contacts.flatMap((contact) => visibleTags(contact.tags)))].sort((a, b) => a.localeCompare(b)),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return contacts
      .filter((contact) => {
        const roles = contactRoles(contact).map((role) => role.toLowerCase());
        const lists = contactLists(contact);
        const tags = visibleTags(contact.tags);

        if (activeTab === "supporters" && !(
          contact.contact_type === "supporter" || roles.includes("supporter")
        )) return false;

        if (activeTab === "volunteers" && !(
          contact.contact_type === "volunteer" || roles.includes("volunteer")
        )) return false;

        if (activeTab === "donors" && !(
          contact.contact_type === "donor" || roles.includes("donor")
        )) return false;

        if (activeTab === "voters" && !(
          roles.includes("voter") || roles.includes("resident")
        )) return false;

        if (activeTab === "media" && !(
          contact.contact_type === "media" || roles.includes("media")
        )) return false;

        if (activeTab === "events" && !roles.includes("event attendee")) return false;
        if (activeTab === "lists" && !lists.length) return false;
        if (listFilter !== "all" && !lists.includes(listFilter)) return false;
        if (tagFilter !== "all" && !tags.includes(tagFilter)) return false;
        if (statusFilter !== "all" && contact.status !== statusFilter) return false;

        if (!search) return true;

        return [
          contact.full_name,
          contact.email,
          contact.phone,
          contact.organization,
          contact.precinct,
          contact.source,
          ...roles,
          ...lists,
          ...tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((left, right) =>
        String(left.full_name || "").localeCompare(String(right.full_name || "")),
      );
  }, [activeTab, contacts, listFilter, searchTerm, statusFilter, tagFilter]);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;
  const channelContact = contacts.find((contact) => contact.id === channelContactId) || null;
  const selectedContactSessionActivity = selectedContact
    ? sessionActivityByContact[selectedContact.id] || []
    : [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = Boolean(filteredContacts.length) && filteredContacts.every((contact) => selectedSet.has(contact.id));
  const selectedContacts = contacts.filter((contact) => selectedSet.has(contact.id));

  const totalContacts = contacts.length;
  const activeSupporters = contacts.filter((contact) =>
    contact.status !== "inactive" && (
      contact.contact_type === "supporter" ||
      contactRoles(contact).map((role) => role.toLowerCase()).includes("supporter")
    ),
  ).length;
  const volunteerCount = contacts.filter((contact) =>
    contact.status !== "inactive" && (
      contact.contact_type === "volunteer" ||
      contactRoles(contact).map((role) => role.toLowerCase()).includes("volunteer")
    ),
  ).length;
  const eventAttendees = contacts.filter((contact) =>
    contactRoles(contact).map((role) => role.toLowerCase()).includes("event attendee"),
  ).length;
  const dueCount = contacts.filter((contact) => followUpDue(contact, referenceTime)).length;

  const importPreview = useMemo(
    () => importState.rows.length
      ? buildImport({ rows: importState.rows, mapping: importState.mapping, contacts })
      : { records: [], duplicates: 0, invalid: 0 },
    [contacts, importState.mapping, importState.rows],
  );

  useEffect(() => {
    const body = document.body;

    if (
      selectedContactId ||
      editorOpen ||
      importOpen ||
      channelContactId
    ) {
      body.dataset.contactsFocusMode = "true";
    } else {
      delete body.dataset.contactsFocusMode;
    }

    return () => {
      delete body.dataset.contactsFocusMode;
    };
  }, [
    channelContactId,
    editorOpen,
    importOpen,
    selectedContactId,
  ]);

  const clearDirectoryFilters = () => {
    setSearchTerm("");
    setListFilter("all");
    setTagFilter("all");
    setStatusFilter("all");
  };

  const openContactDetails = (
    contactId,
  ) => {
    setSelectedContactId(
      contactId,
    );
    setDetailsTab(
      "overview",
    );
    setDetailsExpanded(
      false,
    );
  };

  const closeContactDetails = () => {
    setSelectedContactId("");
    setDetailsTab(
      "overview",
    );
    setDetailsExpanded(
      false,
    );
  };

  const openNew = () => {
    setForm({
      ...EMPTY_FORM,
      assignedTo: user.id || "",
    });
    setFormError("");
    setEditorOpen(true);
  };

  const openEdit = (contact) => {
    setForm(contactToForm(contact));
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditorOpen(false);
    setFormError("");
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setFormError("Enter the contact’s full name.");
      return;
    }

    try {
      if (demoMode) {
        const existing = demoContacts.find((contact) => contact.id === form.id);
        const nextContact = demoRecordFromForm({
          form,
          existing,
          workspaceId: workspace.id,
          userId: user.id,
        });

        setDemoContacts((current) => existing
          ? current.map((contact) => contact.id === existing.id ? nextContact : contact)
          : [nextContact, ...current],
        );
        setSelectedContactId(nextContact.id);
      } else {
        const saved = await saveContact(savePayload(form));
        if (saved?.id) setSelectedContactId(saved.id);
      }

      setEditorOpen(false);
      setFormError("");
    } catch (saveError) {
      setFormError(saveError?.message || "The contact could not be saved.");
    }
  };

  const changeStatus = async (contact, nextStatus) => {
    try {
      if (demoMode) {
        setDemoContacts((current) => current.map((item) =>
          item.id === contact.id
            ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
            : item,
        ));
      } else if (nextStatus === "inactive") {
        await archiveContact(contact.id);
      } else {
        await saveContact({
          ...savePayload(contactToForm(contact)),
          status: nextStatus,
        });
      }
    } catch (statusError) {
      setFormError(statusError?.message || "The contact status could not be changed.");
    }
  };

  const handleRefresh = () => {
    setSelectedContactId("");
    setSelectedIds([]);
    if (demoMode) {
      setDemoContacts(buildDemoContacts(user, workspace));
    } else {
      refresh();
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id],
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(filteredContacts.map((contact) => contact.id));
      setSelectedIds((current) => current.filter((id) => !visible.has(id)));
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...filteredContacts.map((contact) => contact.id)]),
    ]);
  };

  const updateManyContacts = async (transform) => {
    const targets = contacts.filter((contact) => selectedSet.has(contact.id));

    if (demoMode) {
      setDemoContacts((current) => current.map((contact) =>
        selectedSet.has(contact.id) ? transform(contact) : contact,
      ));
      return;
    }

    for (const contact of targets) {
      const transformed = transform(contact);
      await saveContact(savePayload(contactToForm(transformed)));
    }
  };

  const applyBulkList = async () => {
    if (!bulkList.trim() || !selectedIds.length) return;

    try {
      await updateManyContacts((contact) => {
        const nextLists = [...new Set([...contactLists(contact), bulkList.trim()])];
        return {
          ...contact,
          demo_lists: contact.is_demo ? nextLists : contact.demo_lists,
          tags: buildMetadataTags({
            tags: visibleTags(contact.tags).join(", "),
            lists: nextLists.join(", "),
            roles: contactRoles(contact).join(", "),
            supportLevel: contactSupportLevel(contact),
            priority: contactPriority(contact),
          }),
        };
      });
      setBulkList("");
    } catch (bulkError) {
      setFormError(bulkError?.message || "The selected contacts could not be updated.");
    }
  };

  const applyBulkOwner = async () => {
    if (!bulkOwner || !selectedIds.length) return;

    try {
      await updateManyContacts((contact) => ({ ...contact, assigned_to: bulkOwner }));
      setBulkOwner("");
    } catch (bulkError) {
      setFormError(bulkError?.message || "The selected contacts could not be assigned.");
    }
  };

  const archiveSelected = async () => {
    if (!selectedIds.length) return;

    try {
      if (demoMode) {
        setDemoContacts((current) => current.map((contact) =>
          selectedSet.has(contact.id)
            ? { ...contact, status: "inactive", updated_at: new Date().toISOString() }
            : contact,
        ));
      } else {
        for (const contact of selectedContacts) {
          await archiveContact(contact.id);
        }
      }
      setSelectedIds([]);
    } catch (bulkError) {
      setFormError(bulkError?.message || "The selected contacts could not be archived.");
    }
  };

  const addSelectedContactToList = async () => {
    if (!selectedContact) return;
    const listName = window.prompt("List name");
    if (!listName?.trim()) return;

    try {
      const nextLists = [...new Set([...contactLists(selectedContact), listName.trim()])];
      const updated = {
        ...selectedContact,
        demo_lists: selectedContact.is_demo ? nextLists : selectedContact.demo_lists,
        tags: buildMetadataTags({
          tags: visibleTags(selectedContact.tags).join(", "),
          lists: nextLists.join(", "),
          roles: contactRoles(selectedContact).join(", "),
          supportLevel: contactSupportLevel(selectedContact),
          priority: contactPriority(selectedContact),
        }),
      };

      if (demoMode) {
        setDemoContacts((current) => current.map((contact) =>
          contact.id === selectedContact.id ? updated : contact,
        ));
      } else {
        await saveContact(savePayload(contactToForm(updated)));
      }
    } catch (listError) {
      setFormError(listError?.message || "The contact could not be added to the list.");
    }
  };

  const recordContactInteraction = async ({
    channel,
    outcome,
    notes,
    message,
    nextFollowUpAt,
    actorName,
    internalOnly = false,
  }) => {
    if (!channelContact) {
      throw new Error("The selected contact is no longer available.");
    }

    const timestamp = new Date().toISOString();
    const outcomeLabel = {
      reached: "Reached",
      replied: "Replied",
      left_voicemail: "Left voicemail",
      no_answer: "No answer",
      follow_up_needed: "Follow-up needed",
      wrong_number: "Wrong number",
      opted_out: "Opted out",
      internal_note: "Internal note",
    }[outcome] || formatLabel(outcome);

    const activity = {
      id: `contact-channel-${channelContact.id}-${Date.now()}`,
      kind: channel,
      channel,
      label: `${channelLabel(channel)} · ${outcomeLabel}`,
      detail: notes || message || "",
      occurred_at: timestamp,
      actor: actorName,
      outcome,
      internal_only:
        internalOnly,
    };

    if (demoMode) {
      setDemoContacts((current) =>
        current.map((contact) =>
          contact.id === channelContact.id
            ? {
                ...contact,
                status:
                  outcome === "opted_out"
                    ? "do_not_contact"
                    : contact.status,
                last_contact_at:
                  internalOnly
                    ? contact.last_contact_at
                    : timestamp,
                next_follow_up_at:
                  internalOnly
                    ? contact.next_follow_up_at ??
                      null
                    : nextFollowUpAt ??
                      contact.next_follow_up_at ??
                      null,
                updated_at: timestamp,
                demo_activity: [
                  activity,
                  ...(contact.demo_activity || []),
                ],
              }
            : contact,
        ),
      );
    } else {
      const currentForm = contactToForm(channelContact);

      await saveContact({
        ...savePayload(currentForm),
        status:
          outcome === "opted_out"
            ? "do_not_contact"
            : channelContact.status,
        lastContactAt:
          internalOnly
            ? channelContact.last_contact_at
            : timestamp,
        nextFollowUpAt:
          internalOnly
            ? channelContact.next_follow_up_at ??
              null
            : nextFollowUpAt ??
              channelContact.next_follow_up_at ??
              null,
      });

      setSessionActivityByContact((current) => ({
        ...current,
        [channelContact.id]: [
          activity,
          ...(current[channelContact.id] || []),
        ],
      }));
    }

    setChannelContactId("");
  };

  const resetImport = () => setImportState(EMPTY_IMPORT);

  const closeImport = () => {
    if (isSaving) return;
    setImportOpen(false);
    resetImport();
  };

  const handleFile = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    if (!file) return;

    setImportState((current) => ({
      ...current,
      fileName: file.name,
      error: "",
      summary: null,
      isReading: true,
    }));

    try {
      const result = await readSpreadsheet(file);
      setImportState({
        fileName: file.name,
        headers: result.headers,
        rows: result.rows,
        mapping: autoMap(result.headers),
        error: "",
        summary: null,
        isReading: false,
      });
    } catch (readError) {
      setImportState({
        fileName: file.name,
        headers: [],
        rows: [],
        mapping: {},
        error: readError?.message || "The spreadsheet could not be read.",
        summary: null,
        isReading: false,
      });
    }
  };

  const handleImport = async () => {
    if (!importPreview.records.length) {
      setImportState((current) => ({
        ...current,
        error: "No valid, non-duplicate rows are ready to import.",
      }));
      return;
    }

    try {
      let importedCount = 0;

      if (demoMode) {
        const timestamp = new Date().toISOString();
        const imported = importPreview.records.map((record, index) => ({
          id: `demo-import-${Date.now()}-${index}`,
          workspace_id: workspace.id,
          ...record,
          created_by: user.id,
          updated_by: user.id,
          created_at: timestamp,
          updated_at: timestamp,
          email_consent_at: record.email_consent ? timestamp : null,
          sms_consent_at: record.sms_consent ? timestamp : null,
          is_demo: true,
        }));
        setDemoContacts((current) => [...imported, ...current]);
        importedCount = imported.length;
      } else {
        const imported = await importContacts(importPreview.records);
        importedCount = imported.length;
      }

      setImportState((current) => ({
        ...current,
        error: "",
        summary: {
          imported: importedCount,
          duplicates: importPreview.duplicates,
          invalid: importPreview.invalid,
        },
      }));
    } catch (importError) {
      setImportState((current) => ({
        ...current,
        error: importError?.message || "The contacts could not be imported.",
      }));
    }
  };

  const loading = !demoMode && (isLoading || membersLoading);
  const pageError = demoMode ? "" : error;
  const updatedLabel = demoMode
    ? "Local preview data"
    : lastUpdated
      ? `Updated ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(lastUpdated)}`
      : "Ready";

  const summaryCards = [
    ["all", "Total contacts", totalContacts, "Campaign relationships", UsersRound],
    ["supporters", "Active supporters", activeSupporters, "Supporter relationships", Mail],
    ["volunteers", "Volunteers", volunteerCount, "Volunteer relationships", UserRound],
    ["events", "Event attendees", eventAttendees, "Event-connected contacts", CalendarClock],
  ];

  const showClearFilters = Boolean(searchTerm) || listFilter !== "all" || tagFilter !== "all" || statusFilter !== "all";

  return (
    <CampaignWorkspaceShell activeItem="Contacts">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Campaign relationships</span>
            <h1>Contacts</h1>
            <p>Manage supporters, volunteers, donors, voters, media, vendors, and community relationships in one clear workspace.</p>
            <small className={styles.updated}><span />{updatedLabel}</small>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
              <RefreshCw size={18} />Refresh
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => downloadCsv(filteredContacts, memberMap)} disabled={!filteredContacts.length}>
              <Download size={18} />Export
            </button>
            <button className={styles.primaryButton} type="button" onClick={openNew}>
              <Plus size={19} />New Contact
            </button>
          </div>
        </header>

        {pageError && (
          <section className={styles.errorBanner} role="alert">
            <AlertTriangle size={18} />
            <div><strong>Contacts need attention</strong><p>{pageError}</p></div>
          </section>
        )}

        <section className={styles.summaryGrid}>
          {summaryCards.map(([key, label, value, caption, Icon]) => {
            const active = activeTab === key;

            return (
              <button
                key={key}
                className={`${styles.summaryCard} ${active ? styles.summaryCardActive : ""}`}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedContactId("");
                  clearDirectoryFilters();
                  setActiveTab(key);
                }}
              >
                <span className={styles.summaryIcon}><Icon size={22} /></span>
                <span className={styles.summaryCopy}>
                  <small>{label}</small>
                  <strong>{loading ? "—" : value}</strong>
                  <em>{caption}</em>
                </span>
              </button>
            );
          })}
        </section>

        <section className={styles.directoryToolbar}>
          <label className={styles.searchBox}>
            <Search size={19} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, phone, organization, location, or tag…"
            />
          </label>

          <label className={styles.filterControl}>
            <ListPlus size={16} />
            <select value={listFilter} onChange={(event) => setListFilter(event.target.value)}>
              <option value="all">All Lists</option>
              {listOptions.map((list) => <option key={list} value={list}>{list}</option>)}
            </select>
          </label>

          <label className={styles.filterControl}>
            <Tags size={16} />
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">All Tags</option>
              {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>

          <label className={styles.filterControl}>
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All Statuses</option>
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <button className={styles.importButton} type="button" onClick={() => setImportOpen(true)}>
            <Upload size={18} />Import Contacts
          </button>
        </section>

        <div className={styles.followUpStrip}>
          <CalendarClock size={17} />
          <strong>{dueCount} follow-up{dueCount === 1 ? "" : "s"} due</strong>
          <span>Use the contact panel to see the next action, owner, and consent record.</span>
        </div>

        {selectedIds.length > 0 && (
          <section className={styles.bulkToolbar}>
            <strong>{selectedIds.length} selected</strong>

            <div>
              <select value={bulkList} onChange={(event) => setBulkList(event.target.value)}>
                <option value="">Choose list</option>
                {listOptions.map((list) => <option key={list} value={list}>{list}</option>)}
              </select>
              <button type="button" onClick={applyBulkList} disabled={!bulkList}>Add to list</button>
            </div>

            <div>
              <select value={bulkOwner} onChange={(event) => setBulkOwner(event.target.value)}>
                <option value="">Choose owner</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
              </select>
              <button type="button" onClick={applyBulkOwner} disabled={!bulkOwner}>Assign</button>
            </div>

            <button type="button" onClick={() => downloadCsv(selectedContacts, memberMap)}>
              <Download size={15} />Export selected
            </button>
            <button type="button" onClick={archiveSelected}>
              <Archive size={15} />Archive
            </button>
            <button type="button" onClick={() => setSelectedIds([])}>Clear</button>
          </section>
        )}

        <section className={`${styles.contactsWorkspace} ${selectedContact ? styles.hasDetails : ""}`}>
          <div className={styles.directoryPanel}>
            <nav className={styles.tabs} aria-label="Contact directory views">
              {[
                ["all", "All Contacts"],
                ["supporters", "Supporters"],
                ["volunteers", "Volunteers"],
                ["donors", "Donors"],
                ["voters", "Voters / Residents"],
                ["media", "Media"],
                ["lists", "Custom Lists"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={activeTab === key ? styles.activeTab : ""}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    setSelectedContactId("");
                    clearDirectoryFilters();
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className={styles.resultsLine}>
              <div><strong>{filteredContacts.length}</strong><span>{filteredContacts.length === 1 ? "contact" : "contacts"}</span></div>
              {showClearFilters && <button type="button" onClick={clearDirectoryFilters}>Clear filters</button>}
            </div>

            <div className={styles.tableScroller}>
              <table className={styles.contactTable}>
                <thead>
                  <tr>
                    <th className={styles.checkboxColumn}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible contacts" />
                    </th>
                    <th>Name</th>
                    <th>Email / Phone</th>
                    <th>Location</th>
                    <th>Lists</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr><td className={styles.emptyCell} colSpan="8">Loading campaign contacts…</td></tr>
                  ) : !filteredContacts.length ? (
                    <tr>
                      <td className={styles.emptyCell} colSpan="8">
                        <UsersRound size={28} />
                        <strong>No contacts match this view</strong>
                        <span>Adjust the filters, import a spreadsheet, or add a contact.</span>
                      </td>
                    </tr>
                  ) : filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`${styles.contactRow} ${selectedContactId === contact.id ? styles.selectedRow : ""}`}
                      onClick={() => openContactDetails(contact.id)}
                    >
                      <td className={styles.checkboxColumn} onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(contact.id)}
                          onChange={() => toggleSelected(contact.id)}
                          aria-label={`Select ${contact.full_name}`}
                        />
                      </td>
                      <td>
                        <button className={styles.contactIdentity} type="button" onClick={() => openContactDetails(contact.id)}>
                          <span className={styles.avatar}>{getUserInitials(contact.full_name)}</span>
                          <span>
                            <strong>{contact.full_name}</strong>
                            <small>{formatLabel(contact.contact_type)}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className={styles.contactChannel}>
                          <strong>{contact.email || "No email"}</strong>
                          <small>{contact.phone || "No phone"}</small>
                        </span>
                      </td>
                      <td><span className={styles.locationCell}>{contactLocation(contact)}</span></td>
                      <td>
                        <span className={styles.chipGroup}>
                          {contactLists(contact).slice(0, 2).map((list) => <span key={list} className={styles.listChip}>{list}</span>)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.chipGroup}>
                          {visibleTags(contact.tags).slice(0, 2).map((tag) => <span key={tag} className={styles.tagChip}>{tag}</span>)}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[contact.status]}`}>
                          <CircleDot size={11} />{formatLabel(contact.status)}
                        </span>
                      </td>
                      <td>
                        <button className={styles.moreButton} type="button" onClick={(event) => {
                          event.stopPropagation();
                          openContactDetails(contact.id);
                        }} aria-label={`Open ${contact.full_name} details`}>
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className={styles.tableFooter}>
              <span>Showing 1–{filteredContacts.length} of {contacts.length} contacts</span>
              <span>Consent-aware campaign relationship management</span>
            </footer>
          </div>

          {selectedContact && (
            <aside
              className={`${styles.detailsPanel} ${
                detailsExpanded
                  ? styles.detailsPanelExpanded
                  : ""
              }`}
            >
              <header className={styles.detailsHeader}>
                <div className={styles.detailsProfile}>
                  <span>{getUserInitials(selectedContact.full_name)}</span>
                  <div>
                    <h2>{selectedContact.full_name}</h2>
                    <p>{formatLabel(selectedContact.contact_type)}</p>
                  </div>
                </div>
                <div className={styles.detailsHeaderActions}>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailsExpanded(
                        (current) =>
                          !current,
                      )
                    }
                    aria-label={
                      detailsExpanded
                        ? "Collapse contact details"
                        : "Expand contact details"
                    }
                    title={
                      detailsExpanded
                        ? "Collapse details"
                        : "Expand details"
                    }
                  >
                    {detailsExpanded ? (
                      <Minimize2 size={18} />
                    ) : (
                      <Maximize2 size={18} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={closeContactDetails}
                    aria-label="Close contact details"
                    title="Close details"
                  >
                    <X size={19} />
                  </button>
                </div>
              </header>

              <div className={styles.quickActions}>
                <button
                  className={styles.contactPrimaryAction}
                  type="button"
                  onClick={() => setChannelContactId(selectedContact.id)}
                >
                  <MessageSquareText size={15} />
                  Contact
                </button>

                <button
                  type="button"
                  onClick={addSelectedContactToList}
                >
                  <ListPlus size={15} />
                  Add to List
                </button>
              </div>

              <nav
                className={styles.detailTabs}
                aria-label="Contact detail sections"
              >
                {[
                  [
                    "overview",
                    "Overview",
                  ],
                  [
                    "activity",
                    "Activity",
                  ],
                  [
                    "notes",
                    "Notes",
                  ],
                  [
                    "relationships",
                    "Relationships",
                  ],
                ].map(
                  ([key, label]) => (
                    <button
                      key={key}
                      className={
                        detailsTab === key
                          ? styles.activeDetailTab
                          : ""
                      }
                      type="button"
                      aria-pressed={
                        detailsTab === key
                      }
                      onClick={() =>
                        setDetailsTab(key)
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
              </nav>

              <div className={styles.contactMethodSummary}>
                <div>
                  <span>Suggested channel</span>
                  <strong>
                    {suggestedChannelLabel(selectedContact)}
                  </strong>
                </div>

                <div>
                  <span>Last contacted through</span>
                  <strong>
                    {lastChannelLabel(
                      selectedContact,
                      selectedContactSessionActivity,
                    )}
                  </strong>
                </div>
              </div>

              <div
                className={styles.detailsBody}
                data-active-tab={detailsTab}
              >
                <section data-detail-section="overview" className={styles.nextActionCard}>
                  <div>
                    <span>Next action</span>
                    <strong>{formatDateTime(selectedContact.next_follow_up_at).date}</strong>
                    <small>{formatDateTime(selectedContact.next_follow_up_at).time || "No time scheduled"}</small>
                  </div>
                  <div>
                    <span>Owner</span>
                    <strong>{memberMap.get(selectedContact.assigned_to)?.fullName || "Unassigned"}</strong>
                    <small>{contactPriority(selectedContact) === "high" ? "High priority" : "Standard priority"}</small>
                  </div>
                  <button type="button" onClick={() => openEdit(selectedContact)}>Update follow-up</button>
                </section>

                <section data-detail-section="overview" className={styles.detailSection}>
                  <header><h3>Contact Information</h3><button type="button" onClick={() => openEdit(selectedContact)}>Edit</button></header>
                  <div className={styles.infoRows}>
                    <div><Mail size={15} /><span>{selectedContact.email || "Not provided"}</span></div>
                    <div><Phone size={15} /><span>{selectedContact.phone || "Not provided"}</span></div>
                    <div><MapPin size={15} /><span>{contactLocation(selectedContact)}</span></div>
                    <div><UserRound size={15} /><span>{memberMap.get(selectedContact.assigned_to)?.fullName || "Unassigned"}</span></div>
                  </div>
                </section>

                <section data-detail-section="overview" className={styles.detailSection}>
                  <header><h3>Lists & Tags</h3><button type="button" onClick={() => openEdit(selectedContact)}>Edit</button></header>
                  <div className={styles.detailChips}>
                    {contactLists(selectedContact).map((list) => <span key={`list-${list}`} className={styles.listChip}>{list}</span>)}
                    {visibleTags(selectedContact.tags).map((tag) => <span key={`tag-${tag}`} className={styles.tagChip}>{tag}</span>)}
                  </div>
                </section>

                <section data-detail-section="overview" className={styles.detailSection}>
                  <header><h3>Support & Roles</h3><button type="button" onClick={() => openEdit(selectedContact)}>Edit</button></header>
                  <dl className={styles.compactDetails}>
                    <div><dt>Support level</dt><dd>{formatLabel(contactSupportLevel(selectedContact))}</dd></div>
                    <div><dt>Priority</dt><dd>{formatLabel(contactPriority(selectedContact))}</dd></div>
                    <div><dt>Roles</dt><dd>{contactRoles(selectedContact).join(", ")}</dd></div>
                    <div><dt>Source</dt><dd>{selectedContact.source || "Not recorded"}</dd></div>
                  </dl>
                </section>

                <section data-detail-section="overview" className={styles.detailSection}>
                  <header><h3>Communication Consent</h3></header>
                  <div className={styles.consentGrid}>
                    <span className={selectedContact.email_consent ? styles.consentYes : styles.consentNo}>Email {selectedContact.email_consent ? "allowed" : "not recorded"}</span>
                    <span className={selectedContact.sms_consent ? styles.consentYes : styles.consentNo}>Text {selectedContact.sms_consent ? "allowed" : "not recorded"}</span>
                  </div>
                  <p className={styles.consentSource}>{selectedContact.consent_source ? `Source: ${selectedContact.consent_source}` : "No consent source recorded."}</p>
                  {selectedContact.status === "do_not_contact" && (
                    <div className={styles.restrictionWarning}><AlertTriangle size={16} />Do not contact this person.</div>
                  )}
                </section>

                <section data-detail-section="activity" className={styles.detailSection}>
                  <header><h3>Activity</h3></header>
                  <div className={styles.timeline}>
                    {activityItems(
                      selectedContact,
                      selectedContactSessionActivity,
                    ).map((activity) => (
                      <div key={activity.id}>
                        <span><ActivityIcon kind={activity.kind} /></span>
                        <div><strong>{activity.label}</strong><small>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(activity.occurred_at))}</small></div>
                      </div>
                    ))}
                  </div>
                </section>

                <section data-detail-section="notes" className={styles.detailSection}>
                  <header><h3>Notes</h3><button type="button" onClick={() => openEdit(selectedContact)}>Edit</button></header>
                  <p className={styles.notes}>{selectedContact.notes || "No campaign notes have been recorded."}</p>
                </section>

                <section data-detail-section="relationships" className={styles.detailSection}>
                  <header><h3>Related Contacts</h3></header>
                  {selectedContact.demo_related?.length ? (
                    <div className={styles.relatedContacts}>
                      {selectedContact.demo_related.map((related) => (
                        <div key={related.id}>
                          <span>{getUserInitials(related.name)}</span>
                          <div><strong>{related.relationship}: {related.name}</strong><small>{related.type}</small></div>
                          <button type="button">View Profile</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptySection}>No related contacts recorded.</p>
                  )}
                </section>
              </div>

              <footer className={styles.detailsFooter}>
                <button type="button" onClick={() => openEdit(selectedContact)}><CalendarClock size={16} />Schedule follow-up</button>
                <button className={styles.primaryDetailButton} type="button" onClick={() => changeStatus(selectedContact, selectedContact.status === "inactive" ? "active" : "inactive")}>
                  {selectedContact.status === "inactive" ? <><CheckCircle2 size={16} />Reactivate</> : <><Archive size={16} />Archive</>}
                </button>
              </footer>
            </aside>
          )}
        </section>
      </main>

      {channelContact && (
        <ContactChannelModal
          contact={channelContact}
          actorName={displayName(user)}
          isSaving={isSaving}
          onClose={() => setChannelContactId("")}
          onRecord={recordContactInteraction}
        />
      )}

      {editorOpen && (
        <div className={styles.modalLayer}>
          <button className={styles.modalBackdrop} type="button" onClick={closeEditor} aria-label="Close contact editor" />
          <section className={styles.contactModal} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
            <header>
              <div><span>Campaign relationships</span><h2 id="contact-modal-title">{form.id ? "Edit contact" : "Add contact"}</h2></div>
              <button type="button" onClick={closeEditor} disabled={isSaving} aria-label="Close"><X size={20} /></button>
            </header>

            <form className={styles.contactForm} onSubmit={handleSave}>
              <label className={styles.fullField}><span>Full name</span><input value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} autoFocus /></label>
              <label><span>Email</span><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} /></label>
              <label><span>Phone</span><input type="tel" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} /></label>
              <label><span>Organization</span><input value={form.organization} onChange={(event) => updateForm("organization", event.target.value)} /></label>
              <label><span>Location / precinct</span><input value={form.precinct} onChange={(event) => updateForm("precinct", event.target.value)} /></label>
              <label><span>Relationship type</span><select value={form.contactType} onChange={(event) => updateForm("contactType", event.target.value)}>{CONTACT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Status</span><select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Owner</span><select value={form.assignedTo} onChange={(event) => updateForm("assignedTo", event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}</select></label>
              <label><span>Support level</span><select value={form.supportLevel} onChange={(event) => updateForm("supportLevel", event.target.value)}>{SUPPORT_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Priority</span><select value={form.priority} onChange={(event) => updateForm("priority", event.target.value)}>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={styles.fullField}><span>Roles</span><input value={form.roles} onChange={(event) => updateForm("roles", event.target.value)} placeholder={ROLE_OPTIONS.join(", ")} /></label>
              <label className={styles.fullField}><span>Lists</span><input value={form.lists} onChange={(event) => updateForm("lists", event.target.value)} placeholder="Supporters, District 6, Event attendees" /></label>
              <label className={styles.fullField}><span>Tags</span><input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} placeholder="Early voter, newsletter, transportation" /></label>
              <label><span>Source</span><input value={form.source} onChange={(event) => updateForm("source", event.target.value)} /></label>
              <label><span>Last contact</span><input type="datetime-local" value={form.lastContactAt} onChange={(event) => updateForm("lastContactAt", event.target.value)} /></label>
              <label><span>Next follow-up</span><input type="datetime-local" value={form.nextFollowUpAt} onChange={(event) => updateForm("nextFollowUpAt", event.target.value)} /></label>
              <label className={styles.fullField}><span>Notes</span><textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>

              <fieldset className={styles.consentPanel}>
                <legend>Communication consent</legend>
                <label><input type="checkbox" checked={form.emailConsent} onChange={(event) => updateForm("emailConsent", event.target.checked)} /><span>Email consent recorded</span></label>
                <label><input type="checkbox" checked={form.smsConsent} onChange={(event) => updateForm("smsConsent", event.target.checked)} /><span>Text consent recorded</span></label>
                <label className={styles.fullField}><span>Consent source</span><input value={form.consentSource} onChange={(event) => updateForm("consentSource", event.target.value)} /></label>
              </fieldset>

              {formError && <p className={styles.formError} role="alert"><AlertTriangle size={16} />{formError}</p>}

              <footer>
                <button type="button" onClick={closeEditor} disabled={isSaving}>Cancel</button>
                <button className={styles.saveButton} type="submit" disabled={isSaving}><Check size={17} />{form.id ? "Save changes" : "Add contact"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {importOpen && (
        <div className={styles.modalLayer}>
          <button className={styles.modalBackdrop} type="button" onClick={closeImport} aria-label="Close contact import" />
          <section className={styles.importModal} role="dialog" aria-modal="true" aria-labelledby="contact-import-title">
            <header>
              <div><span>Spreadsheet import</span><h2 id="contact-import-title">Import contacts</h2></div>
              <button type="button" onClick={closeImport} disabled={isSaving} aria-label="Close"><X size={20} /></button>
            </header>

            <div className={styles.importBody}>
              <label className={styles.uploadZone}>
                <FileSpreadsheet size={30} />
                <strong>Choose a CSV, XLS, or XLSX file</strong>
                <span>Up to 5,000 rows. The first worksheet will be used.</span>
                <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile} />
              </label>

              {importState.isReading && <div className={styles.importMessage}>Reading spreadsheet…</div>}
              {importState.fileName && <div className={styles.fileSummary}><FileSpreadsheet size={18} /><div><strong>{importState.fileName}</strong><span>{importState.rows.length} rows detected</span></div></div>}

              {importState.headers.length > 0 && (
                <>
                  <section className={styles.mappingSection}>
                    <header><div><span>Column mapping</span><h3>Match spreadsheet columns</h3></div><small>Name is required.</small></header>
                    <div className={styles.mappingGrid}>
                      {IMPORT_FIELDS.map(([key, label]) => (
                        <label key={key}>
                          <span>{label}</span>
                          <select value={importState.mapping[key] || ""} onChange={(event) => setImportState((current) => ({ ...current, mapping: { ...current.mapping, [key]: event.target.value }, error: "", summary: null }))}>
                            <option value="">Not mapped</option>
                            {importState.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className={styles.importPreview}>
                    <div><CheckCircle2 size={18} /><strong>{importPreview.records.length} ready</strong></div>
                    <div><AlertTriangle size={18} /><strong>{importPreview.duplicates} duplicates</strong></div>
                    <div><Archive size={18} /><strong>{importPreview.invalid} invalid</strong></div>
                  </section>
                </>
              )}

              {importState.summary && <div className={styles.importSuccess}><CheckCircle2 size={20} /><div><strong>Import complete</strong><p>{importState.summary.imported} contacts added, {importState.summary.duplicates} duplicates skipped, and {importState.summary.invalid} invalid rows skipped.</p></div></div>}
              {importState.error && <p className={styles.formError} role="alert"><AlertTriangle size={16} />{importState.error}</p>}
            </div>

            <footer className={styles.importFooter}>
              <button type="button" onClick={closeImport} disabled={isSaving}>{importState.summary ? "Done" : "Cancel"}</button>
              <button className={styles.saveButton} type="button" onClick={handleImport} disabled={isSaving || Boolean(importState.summary) || !importPreview.records.length}>Import {importPreview.records.length} contacts</button>
            </footer>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
