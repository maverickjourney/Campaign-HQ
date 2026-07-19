import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ContactRound,
  FileSpreadsheet,
  Filter,
  LoaderCircle,
  MailCheck,
  Menu,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Upload,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { useContactsCommandCenter } from "../../hooks/useContactsCommandCenter";
import { useTeamAccessCommandCenter } from "../../hooks/useTeamAccessCommandCenter";
import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import shellStyles from "../Team/Team.module.css";
import styles from "./Contacts.module.css";

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
  lastContactAt: "",
  nextFollowUpAt: "",
  emailConsent: false,
  smsConsent: false,
  consentSource: "",
};

const IMPORT_FIELDS = [
  ["fullName", "Full name"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["organization", "Organization"],
  ["contactType", "Contact type"],
  ["assignedTo", "Assigned member"],
  ["precinct", "Precinct / area"],
  ["source", "Source"],
  ["status", "Status"],
  ["tags", "Tags"],
  ["notes", "Notes"],
  ["nextFollowUpAt", "Next follow-up"],
  ["emailConsent", "Email consent"],
  ["smsConsent", "Text consent"],
  ["consentSource", "Consent source"],
];

const ALIASES = {
  fullName: ["full name", "fullname", "name", "contact name"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone"],
  organization: ["organization", "company", "business", "employer"],
  contactType: ["contact type", "type", "category"],
  assignedTo: ["assigned to", "assignee", "owner", "campaign member"],
  precinct: ["precinct", "district", "area", "neighborhood"],
  source: ["source", "origin", "signup source"],
  status: ["status", "contact status"],
  tags: ["tags", "labels", "groups"],
  notes: ["notes", "comments", "comment"],
  nextFollowUpAt: ["next follow-up", "follow up", "follow-up date", "next contact"],
  emailConsent: ["email consent", "email opt in", "email opt-in"],
  smsConsent: ["sms consent", "text consent", "text opt in", "sms opt-in"],
  consentSource: ["consent source", "opt-in source"],
};

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function parseTags(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CONTACT_TYPES.some(([key]) => key === normalized)
    ? normalized
    : "supporter";
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return STATUSES.some(([key]) => key === normalized)
    ? normalized
    : "active";
}

function autoMap(headers) {
  const normalized = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header),
  }));

  return Object.fromEntries(
    IMPORT_FIELDS.map(([key]) => {
      const match = normalized.find((item) =>
        (ALIASES[key] || []).includes(item.normalized),
      );
      return [key, match?.header || ""];
    }),
  );
}

async function readSpreadsheet(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("The spreadsheet does not contain a worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
  });

  if (!rows.length) {
    throw new Error("The spreadsheet does not contain any contact rows.");
  }

  if (rows.length > 5000) {
    throw new Error("Import up to 5,000 contacts at a time.");
  }

  return {
    headers: Object.keys(rows[0]),
    rows,
  };
}

function resolveMember(value, members) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    members.find(
      (member) =>
        member.userId === value ||
        member.fullName.toLowerCase() === normalized ||
        member.email.toLowerCase() === normalized,
    )?.userId || null
  );
}

function buildImport({
  rows,
  mapping,
  members,
  contacts,
  defaults,
}) {
  const existingEmails = new Set(
    contacts.map((contact) => normalizeEmail(contact.email)).filter(Boolean),
  );
  const existingPhones = new Set(
    contacts.map((contact) => normalizePhone(contact.phone)).filter(Boolean),
  );
  const seenEmails = new Set();
  const seenPhones = new Set();
  const records = [];
  let duplicates = 0;
  let invalid = 0;

  rows.forEach((row) => {
    const value = (key) => (mapping[key] ? row[mapping[key]] : "");
    const fullName = String(
      value("fullName") ||
        [value("firstName"), value("lastName")].filter(Boolean).join(" "),
    ).trim();

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

    const emailConsent = parseBoolean(value("emailConsent"));
    const smsConsent = parseBoolean(value("smsConsent"));
    const now = new Date().toISOString();

    records.push({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      organization: String(value("organization") || "").trim() || null,
      contact_type: normalizeType(value("contactType") || defaults.contactType),
      assigned_to:
        resolveMember(value("assignedTo"), members) ||
        defaults.assignedTo ||
        null,
      precinct: String(value("precinct") || "").trim() || null,
      source:
        String(value("source") || defaults.source || "").trim() || null,
      status: normalizeStatus(value("status")),
      notes: String(value("notes") || "").trim() || null,
      tags: parseTags(value("tags")),
      next_follow_up_at: parseDate(value("nextFollowUpAt")),
      email_consent: emailConsent,
      email_consent_at: emailConsent ? now : null,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? now : null,
      consent_source: String(value("consentSource") || "").trim() || null,
    });
  });

  return { records, duplicates, invalid };
}

export default function Contacts() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
  const leadershipAccess =
    /candidate|consultant|manager|owner|administrator/i.test(roleLabel);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [importState, setImportState] = useState({
    fileName: "",
    headers: [],
    rows: [],
    mapping: {},
    error: "",
    summary: null,
    isReading: false,
  });
  const [importDefaults, setImportDefaults] = useState({
    contactType: "supporter",
    assignedTo: "",
    source: "Spreadsheet import",
  });

  const {
    contacts,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    saveContact,
    importContacts,
    archiveContact,
  } = useContactsCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const { members, isLoading: membersLoading } =
    useTeamAccessCommandCenter({
      workspaceId: workspace.id,
    });

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const referenceTime = lastUpdated?.getTime() || 0;

  const filteredContacts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return contacts.filter((contact) => {
      const searchValues = [
        contact.full_name,
        contact.email,
        contact.phone,
        contact.organization,
        contact.precinct,
        contact.source,
        ...(contact.tags || []),
      ];

      const matchesSearch =
        !search ||
        searchValues
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      const matchesType =
        typeFilter === "all" || contact.contact_type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned"
          ? !contact.assigned_to
          : contact.assigned_to === assigneeFilter);

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesAssignee
      );
    });
  }, [
    assigneeFilter,
    contacts,
    searchTerm,
    statusFilter,
    typeFilter,
  ]);

  const followUpsDue = contacts.filter(
    (contact) =>
      contact.next_follow_up_at &&
      new Date(contact.next_follow_up_at).getTime() <= referenceTime &&
      contact.status !== "inactive",
  ).length;

  const unassigned = contacts.filter(
    (contact) => !contact.assigned_to && contact.status !== "inactive",
  ).length;

  const consentRecorded = contacts.filter(
    (contact) => contact.email_consent || contact.sms_consent,
  ).length;

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditorOpen(true);
  };

  const openEdit = (contact) => {
    setForm({
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
      tags: (contact.tags || []).join(", "),
      lastContactAt: contact.last_contact_at
        ? new Date(contact.last_contact_at).toISOString().slice(0, 16)
        : "",
      nextFollowUpAt: contact.next_follow_up_at
        ? new Date(contact.next_follow_up_at).toISOString().slice(0, 16)
        : "",
      emailConsent: Boolean(contact.email_consent),
      smsConsent: Boolean(contact.sms_consent),
      consentSource: contact.consent_source || "",
    });
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditorOpen(false);
    setFormError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      await saveContact({
        ...form,
        tags: parseTags(form.tags),
        lastContactAt: form.lastContactAt
          ? new Date(form.lastContactAt).toISOString()
          : null,
        nextFollowUpAt: form.nextFollowUpAt
          ? new Date(form.nextFollowUpAt).toISOString()
          : null,
      });
      setEditorOpen(false);
      setForm(EMPTY_FORM);
    } catch (saveError) {
      setFormError(saveError?.message || "The contact could not be saved.");
    }
  };

  const handleArchive = async (contact) => {
    if (!window.confirm(`Move ${contact.full_name} to inactive contacts?`)) {
      return;
    }

    try {
      await archiveContact(contact.id);
    } catch (archiveError) {
      setFormError(
        archiveError?.message || "The contact could not be archived.",
      );
    }
  };

  const resetImport = () => {
    setImportState({
      fileName: "",
      headers: [],
      rows: [],
      mapping: {},
      error: "",
      summary: null,
      isReading: false,
    });
  };

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

  const importPreview = useMemo(
    () =>
      importState.rows.length
        ? buildImport({
            rows: importState.rows,
            mapping: importState.mapping,
            members,
            contacts,
            defaults: importDefaults,
          })
        : { records: [], duplicates: 0, invalid: 0 },
    [
      contacts,
      importDefaults,
      importState.mapping,
      importState.rows,
      members,
    ],
  );

  const handleImport = async () => {
    if (!importPreview.records.length) {
      setImportState((current) => ({
        ...current,
        error: "No valid, non-duplicate rows are ready to import.",
      }));
      return;
    }

    try {
      const imported = await importContacts(importPreview.records);
      setImportState((current) => ({
        ...current,
        error: "",
        summary: {
          imported: imported.length,
          duplicates: importPreview.duplicates,
          invalid: importPreview.invalid,
        },
      }));
    } catch (importError) {
      setImportState((current) => ({
        ...current,
        error:
          importError?.message || "The contacts could not be imported.",
      }));
    }
  };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Contacts"
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        styles={shellStyles}
        accessDescription="Organize supporters, volunteers, donors and campaign relationships."
        showLeadership={leadershipAccess}
        adminAccent={leadershipAccess}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span className={styles.breadcrumb}>
                Campaign HQ
                <ChevronRight size={13} />
                Contacts
              </span>
              <strong>Relationship directory</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />

            <div className={styles.syncStatus}>
              <span />
              {isLoading
                ? "Synchronizing contacts"
                : lastUpdated
                  ? `Updated ${formatTime(lastUpdated)}`
                  : "Waiting for sync"}
            </div>

          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>
                Campaign relationships
              </span>
              <h1>Contacts</h1>
              <p>
                Organize supporters, volunteers, donors, vendors, media
                and community relationships with clear ownership,
                consent and follow-up.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={18} />
                Import contacts
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={openNew}
              >
                <UserPlus size={18} />
                Add contact
              </button>
            </div>
          </section>

          {error && (
            <section className={styles.errorBanner} role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Contacts need attention</strong>
                <p>{error}</p>
              </div>
            </section>
          )}

          <section className={styles.securityNotice}>
            <ShieldCheck size={22} />
            <div>
              <strong>Consent-aware campaign records</strong>
              <p>
                Email and text consent are tracked separately. Recording
                consent here does not send a message.
              </p>
            </div>
          </section>

          <section className={styles.summaryGrid}>
            <article>
              <div><UsersRound size={21} /></div>
              <span>Total contacts</span>
              <strong>{isLoading ? "—" : contacts.length}</strong>
              <p>Campaign relationships</p>
            </article>
            <article>
              <div><CalendarClock size={21} /></div>
              <span>Follow-ups due</span>
              <strong>{isLoading ? "—" : followUpsDue}</strong>
              <p>Ready for outreach</p>
            </article>
            <article>
              <div><ContactRound size={21} /></div>
              <span>Unassigned</span>
              <strong>{isLoading ? "—" : unassigned}</strong>
              <p>Need a campaign owner</p>
            </article>
            <article>
              <div><MailCheck size={21} /></div>
              <span>Consent recorded</span>
              <strong>{isLoading ? "—" : consentRecorded}</strong>
              <p>Email or text permission</p>
            </article>
          </section>

          <section className={styles.directoryPanel}>
            <header className={styles.panelHeader}>
              <div>
                <span>Contact directory</span>
                <h2>Campaign relationships</h2>
              </div>
              <button
                type="button"
                onClick={refresh}
                disabled={isLoading}
                title="Refresh contacts"
              >
                <RefreshCw
                  className={isLoading ? styles.spinning : ""}
                  size={18}
                />
              </button>
            </header>

            <div className={styles.controls}>
              <label className={styles.searchWrap}>
                <Search size={18} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, email, phone, organization or tag"
                />
              </label>

              <label className={styles.selectWrap}>
                <Filter size={17} />
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  aria-label="Filter contact type"
                >
                  <option value="all">All types</option>
                  {CONTACT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter contact status"
              >
                <option value="active">Active contacts</option>
                <option value="follow_up">Follow-up</option>
                <option value="do_not_contact">Do not contact</option>
                <option value="inactive">Inactive</option>
                <option value="all">All statuses</option>
              </select>

              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
                aria-label="Filter assigned campaign member"
              >
                <option value="all">All assignments</option>
                <option value="unassigned">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </select>

              <strong className={styles.resultCount}>
                {filteredContacts.length}{" "}
                {filteredContacts.length === 1 ? "contact" : "contacts"}
              </strong>
            </div>

            {isLoading || membersLoading ? (
              <div className={styles.loadingState}>
                <LoaderCircle className={styles.spinning} size={28} />
                <strong>Loading campaign contacts…</strong>
              </div>
            ) : filteredContacts.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.contactTable}>
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Relationship</th>
                      <th>Assigned to</th>
                      <th>Follow-up</th>
                      <th>Consent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => {
                      const assigned = memberMap.get(contact.assigned_to);
                      const due =
                        contact.next_follow_up_at &&
                        new Date(contact.next_follow_up_at).getTime() <=
                          referenceTime &&
                        contact.status !== "inactive";

                      return (
                        <tr key={contact.id}>
                          <td>
                            <div className={styles.contactIdentity}>
                              <div className={styles.contactAvatar}>
                                {getUserInitials(contact.full_name)}
                              </div>
                              <div>
                                <strong>{contact.full_name}</strong>
                                <span>
                                  {contact.email ||
                                    contact.phone ||
                                    "No email or phone"}
                                </span>
                                {contact.tags?.length > 0 && (
                                  <small>
                                    {contact.tags.slice(0, 3).join(" · ")}
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={styles.typeBadge}>
                              {formatLabel(contact.contact_type)}
                            </span>
                            <small>
                              {contact.organization ||
                                contact.precinct ||
                                contact.source ||
                                "No organization"}
                            </small>
                          </td>
                          <td>
                            {assigned ? (
                              <div className={styles.assignee}>
                                <span>{getUserInitials(assigned.fullName)}</span>
                                <div>
                                  <strong>{assigned.fullName}</strong>
                                  <small>{assigned.displayTitle}</small>
                                </div>
                              </div>
                            ) : (
                              <span className={styles.unassignedBadge}>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={due ? styles.dueDate : styles.dateText}
                            >
                              {formatDate(contact.next_follow_up_at)}
                            </span>
                            <small>{formatLabel(contact.status)}</small>
                          </td>
                          <td>
                            <div className={styles.consentBadges}>
                              <span
                                className={
                                  contact.email_consent
                                    ? styles.consentYes
                                    : styles.consentNo
                                }
                              >
                                Email
                              </span>
                              <span
                                className={
                                  contact.sms_consent
                                    ? styles.consentYes
                                    : styles.consentNo
                                }
                              >
                                Text
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                onClick={() => openEdit(contact)}
                                title="Edit contact"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(contact)}
                                disabled={contact.status === "inactive"}
                                title="Move to inactive contacts"
                              >
                                <Archive size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <ContactRound size={34} />
                <h3>No contacts match this view</h3>
                <p>Add a contact, import a spreadsheet or adjust the filters.</p>
              </div>
            )}
          </section>

          <footer className={styles.footer}>
            <span>Campaign HQ Contacts</span>
            <span>Consent-aware relationship management</span>
          </footer>
        </main>
      </div>

      {editorOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeEditor}
            aria-label="Close contact editor"
          />

          <section
            className={styles.contactModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-editor-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span>Contact record</span>
                <h2 id="contact-editor-title">
                  {form.id ? "Edit contact" : "Add contact"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Close contact editor"
              >
                <X size={20} />
              </button>
            </header>

            <form className={styles.contactForm} onSubmit={handleSave}>
              <label className={styles.fullField}>
                <span>Full name</span>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  required
                  maxLength={160}
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </label>

              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                />
              </label>

              <label>
                <span>Organization</span>
                <input
                  type="text"
                  value={form.organization}
                  onChange={(event) =>
                    updateForm("organization", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Contact type</span>
                <select
                  value={form.contactType}
                  onChange={(event) =>
                    updateForm("contactType", event.target.value)
                  }
                >
                  {CONTACT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Assigned campaign member</span>
                <select
                  value={form.assignedTo}
                  onChange={(event) =>
                    updateForm("assignedTo", event.target.value)
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value)
                  }
                >
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Precinct / area</span>
                <input
                  type="text"
                  value={form.precinct}
                  onChange={(event) =>
                    updateForm("precinct", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Source</span>
                <input
                  type="text"
                  value={form.source}
                  onChange={(event) => updateForm("source", event.target.value)}
                  placeholder="Event, website, referral…"
                />
              </label>

              <label className={styles.fullField}>
                <span>Tags</span>
                <div className={styles.iconInput}>
                  <Tags size={17} />
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(event) => updateForm("tags", event.target.value)}
                    placeholder="Wellington, event attendee, high priority"
                  />
                </div>
              </label>

              <label>
                <span>Last contact</span>
                <input
                  type="datetime-local"
                  value={form.lastContactAt}
                  onChange={(event) =>
                    updateForm("lastContactAt", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Next follow-up</span>
                <input
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={(event) =>
                    updateForm("nextFollowUpAt", event.target.value)
                  }
                />
              </label>

              <label className={styles.fullField}>
                <span>Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  rows={4}
                  maxLength={4000}
                />
              </label>

              <fieldset className={styles.consentPanel}>
                <legend>Communication consent</legend>

                <label>
                  <input
                    type="checkbox"
                    checked={form.emailConsent}
                    onChange={(event) =>
                      updateForm("emailConsent", event.target.checked)
                    }
                  />
                  <span>Email consent recorded</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.smsConsent}
                    onChange={(event) =>
                      updateForm("smsConsent", event.target.checked)
                    }
                  />
                  <span>Text-message consent recorded</span>
                </label>

                <label className={styles.fullField}>
                  <span>Consent source</span>
                  <input
                    type="text"
                    value={form.consentSource}
                    onChange={(event) =>
                      updateForm("consentSource", event.target.value)
                    }
                    placeholder="Website form, event sign-in, written permission…"
                  />
                </label>
              </fieldset>

              {formError && (
                <div className={styles.formError} role="alert">
                  <AlertTriangle size={17} />
                  {formError}
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving contact…" : "Save contact"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {importOpen && (
        <div className={styles.modalLayer}>
          <button
            className={styles.modalOverlay}
            type="button"
            onClick={closeImport}
            aria-label="Close contact import"
          />

          <section
            className={styles.importModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-import-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span>Spreadsheet import</span>
                <h2 id="contact-import-title">Import contacts</h2>
              </div>
              <button
                type="button"
                onClick={closeImport}
                aria-label="Close contact import"
              >
                <X size={20} />
              </button>
            </header>

            <div className={styles.importBody}>
              <label className={styles.uploadZone}>
                <FileSpreadsheet size={30} />
                <strong>Choose a CSV, XLS or XLSX file</strong>
                <span>Up to 5,000 rows. The first worksheet will be used.</span>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFile}
                />
              </label>

              {importState.isReading && (
                <div className={styles.importLoading}>
                  <LoaderCircle className={styles.spinning} size={22} />
                  Reading spreadsheet…
                </div>
              )}

              {importState.fileName && (
                <div className={styles.fileSummary}>
                  <FileSpreadsheet size={18} />
                  <div>
                    <strong>{importState.fileName}</strong>
                    <span>{importState.rows.length} rows detected</span>
                  </div>
                </div>
              )}

              {importState.headers.length > 0 && (
                <>
                  <section className={styles.importDefaults}>
                    <label>
                      <span>Default type</span>
                      <select
                        value={importDefaults.contactType}
                        onChange={(event) =>
                          setImportDefaults((current) => ({
                            ...current,
                            contactType: event.target.value,
                          }))
                        }
                      >
                        {CONTACT_TYPES.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Default assignment</span>
                      <select
                        value={importDefaults.assignedTo}
                        onChange={(event) =>
                          setImportDefaults((current) => ({
                            ...current,
                            assignedTo: event.target.value,
                          }))
                        }
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Default source</span>
                      <input
                        type="text"
                        value={importDefaults.source}
                        onChange={(event) =>
                          setImportDefaults((current) => ({
                            ...current,
                            source: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </section>

                  <section className={styles.mappingSection}>
                    <header>
                      <div>
                        <span>Column mapping</span>
                        <h3>Match spreadsheet columns</h3>
                      </div>
                      <small>Name is required.</small>
                    </header>

                    <div className={styles.mappingGrid}>
                      {IMPORT_FIELDS.map(([key, label]) => (
                        <label key={key}>
                          <span>{label}</span>
                          <select
                            value={importState.mapping[key] || ""}
                            onChange={(event) =>
                              setImportState((current) => ({
                                ...current,
                                mapping: {
                                  ...current.mapping,
                                  [key]: event.target.value,
                                },
                                error: "",
                                summary: null,
                              }))
                            }
                          >
                            <option value="">Not mapped</option>
                            {importState.headers.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className={styles.importPreview}>
                    <div>
                      <CheckCircle2 size={19} />
                      <strong>{importPreview.records.length} ready</strong>
                    </div>
                    <div>
                      <AlertTriangle size={19} />
                      <strong>{importPreview.duplicates} duplicates skipped</strong>
                    </div>
                    <div>
                      <Archive size={19} />
                      <strong>{importPreview.invalid} invalid rows skipped</strong>
                    </div>
                  </section>
                </>
              )}

              {importState.summary && (
                <div className={styles.importSuccess}>
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Import complete</strong>
                    <p>
                      {importState.summary.imported} contacts added,{" "}
                      {importState.summary.duplicates} duplicates skipped and{" "}
                      {importState.summary.invalid} invalid rows skipped.
                    </p>
                  </div>
                </div>
              )}

              {importState.error && (
                <div className={styles.formError} role="alert">
                  <AlertTriangle size={17} />
                  {importState.error}
                </div>
              )}
            </div>

            <footer className={styles.importFooter}>
              <button
                type="button"
                onClick={closeImport}
                disabled={isSaving}
              >
                {importState.summary ? "Done" : "Cancel"}
              </button>
              <button
                className={styles.saveButton}
                type="button"
                onClick={handleImport}
                disabled={
                  isSaving ||
                  Boolean(importState.summary) ||
                  !importPreview.records.length
                }
              >
                {isSaving
                  ? "Importing…"
                  : `Import ${importPreview.records.length} contacts`}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
