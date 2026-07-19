import {
  useMemo,
  useState,
} from "react";

import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  FilePenLine,
  Mail,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UsersRound,
  X,
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
  useCommunicationsCommandCenter,
} from "../../hooks/useCommunicationsCommandCenter";

import shellStyles from "../Tasks/Tasks.module.css";
import styles from "./Communications.module.css";

const CHANNELS = [
  { value: "internal", label: "Internal update", icon: UsersRound },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "Text / SMS", icon: Smartphone },
  { value: "social", label: "Social media", icon: MessageSquareText },
  { value: "press", label: "Press / media", icon: FilePenLine },
  { value: "web", label: "Website", icon: Clipboard },
];

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready for review" },
  { value: "scheduled", label: "Scheduled" },
];

const EMPTY_FORM = {
  id: "",
  title: "",
  channel: "internal",
  audience: "Campaign team",
  subject: "",
  messageBody: "",
  status: "draft",
  scheduledAt: "",
};

function formatTime(value) {
  if (!value) {
    return "Waiting for sync";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function getChannel(value) {
  return CHANNELS.find((item) => item.value === value) || CHANNELS[0];
}

function getStatusLabel(value) {
  if (value === "archived") {
    return "Archived";
  }

  return STATUSES.find((item) => item.value === value)?.label || "Draft";
}

function clipboardText(item) {
  return [
    item.subject ? `Subject: ${item.subject}` : "",
    item.message_body,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function Communications() {
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
  const leadershipAccess =
    /candidate|consultant|manager|owner/i.test(roleLabel);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [copiedId, setCopiedId] = useState("");

  const {
    communications,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh,
    saveCommunication,
    duplicateCommunication,
    archiveCommunication,
  } = useCommunicationsCommandCenter({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const activeItems = communications.filter(
    (item) => item.status !== "archived",
  );
  const draftCount = activeItems.filter(
    (item) => item.status === "draft",
  ).length;
  const readyCount = activeItems.filter(
    (item) => item.status === "ready",
  ).length;
  const scheduledCount = activeItems.filter(
    (item) => item.status === "scheduled",
  ).length;

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return communications.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.title,
          item.subject,
          item.audience,
          item.message_body,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(term),
          );

      const matchesChannel =
        channelFilter === "all" ||
        item.channel === channelFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? item.status !== "archived"
          : item.status === statusFilter);

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [channelFilter, communications, search, statusFilter]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setComposerOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      title: item.title || "",
      channel: item.channel || "internal",
      audience: item.audience || "Campaign team",
      subject: item.subject || "",
      messageBody: item.message_body || "",
      status: item.status === "archived" ? "draft" : item.status,
      scheduledAt: toLocalInput(item.scheduled_at),
    });
    setFormError("");
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (!isSaving) {
      setComposerOpen(false);
      setFormError("");
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      await saveCommunication({
        ...form,
        scheduledAt:
          form.status === "scheduled"
            ? toIso(form.scheduledAt)
            : null,
      });
      setComposerOpen(false);
      setForm(EMPTY_FORM);
    } catch (saveError) {
      setFormError(
        saveError?.message ||
          "The communication could not be saved.",
      );
    }
  };

  const handleCopy = async (item) => {
    try {
      await navigator.clipboard.writeText(clipboardText(item));
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setCopiedId("");
    }
  };

  const handleArchive = async (item) => {
    if (!window.confirm(`Archive "${item.title}"?`)) {
      return;
    }

    try {
      await archiveCommunication(item.id);
    } catch {
      // The hook displays the detailed error.
    }
  };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage="Communications"
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        styles={shellStyles}
        accessDescription="Plan, review and organize campaign messages across every channel."
        showLeadership={leadershipAccess}
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
                Communications
              </span>
              <strong>Message planning center</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <CampaignDateTime />

            <CampaignSearch />

            <ActivityCenter />
            <div className={styles.syncStatus}>
              <span />
              {isLoading
                ? "Synchronizing messages"
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
                Campaign messaging
              </span>
              <h1>Communications</h1>
              <p>
                Draft, review, schedule and organize campaign
                messages before they move into an external delivery
                platform.
              </p>
            </div>

            <button
              className={styles.createButton}
              type="button"
              onClick={openNew}
            >
              <Plus size={18} />
              New message
            </button>
          </section>

          <section className={styles.planningNotice}>
            <ShieldCheck size={22} />
            <div>
              <strong>Planning workspace</strong>
              <p>
                External email, SMS and social delivery are not
                connected yet. Prepare content here, coordinate review,
                then copy approved messages into the correct platform.
              </p>
            </div>
          </section>

          {error && (
            <section className={styles.errorBanner} role="alert">
              <MessageSquareText size={20} />
              <div>
                <strong>Communications need attention</strong>
                <p>{error}</p>
              </div>
              <button type="button" onClick={refresh}>
                Retry
              </button>
            </section>
          )}

          <section className={styles.summaryGrid}>
            <article>
              <MessageSquareText size={21} />
              <span>Active messages</span>
              <strong>{isLoading ? "—" : activeItems.length}</strong>
              <p>Current planning items</p>
            </article>
            <article>
              <FilePenLine size={21} />
              <span>Drafts</span>
              <strong>{isLoading ? "—" : draftCount}</strong>
              <p>Still being written</p>
            </article>
            <article>
              <CheckCircle2 size={21} />
              <span>Ready for review</span>
              <strong>{isLoading ? "—" : readyCount}</strong>
              <p>Prepared for approval</p>
            </article>
            <article>
              <CalendarClock size={21} />
              <span>Scheduled</span>
              <strong>{isLoading ? "—" : scheduledCount}</strong>
              <p>Planned release times</p>
            </article>
          </section>

          {composerOpen && (
            <section className={styles.composerPanel}>
              <header>
                <div>
                  <span>Message editor</span>
                  <h2>{form.id ? "Edit communication" : "Create communication"}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeComposer}
                  aria-label="Close editor"
                >
                  <X size={19} />
                </button>
              </header>

              <form className={styles.composerForm} onSubmit={handleSave}>
                <label className={styles.fullField}>
                  <span>Internal title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      updateForm("title", event.target.value)
                    }
                    placeholder="Example: WOB event reminder"
                    required
                  />
                </label>

                <label>
                  <span>Channel</span>
                  <select
                    value={form.channel}
                    onChange={(event) =>
                      updateForm("channel", event.target.value)
                    }
                  >
                    {CHANNELS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Audience</span>
                  <input
                    type="text"
                    value={form.audience}
                    onChange={(event) =>
                      updateForm("audience", event.target.value)
                    }
                    placeholder="Campaign team, volunteers, supporters…"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>Subject or headline</span>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(event) =>
                      updateForm("subject", event.target.value)
                    }
                    placeholder="Optional subject line or social headline"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>Message</span>
                  <textarea
                    value={form.messageBody}
                    onChange={(event) =>
                      updateForm("messageBody", event.target.value)
                    }
                    rows={8}
                    placeholder="Write the campaign communication here…"
                    required
                  />
                  <small>{form.messageBody.length} characters</small>
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value)
                    }
                  >
                    {STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Planned date and time</span>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(event) =>
                      updateForm("scheduledAt", event.target.value)
                    }
                    disabled={form.status !== "scheduled"}
                    required={form.status === "scheduled"}
                  />
                </label>

                {formError && (
                  <div className={styles.formError} role="alert">
                    {formError}
                  </div>
                )}

                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={closeComposer}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : form.id
                        ? "Save changes"
                        : "Create message"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className={styles.libraryPanel}>
            <header className={styles.libraryHeader}>
              <div>
                <span>Message library</span>
                <h2>Campaign communications</h2>
              </div>
              <button
                className={styles.refreshButton}
                type="button"
                disabled={isLoading}
                onClick={refresh}
                title="Refresh communications"
              >
                <RefreshCw
                  size={17}
                  className={isLoading ? styles.spinning : ""}
                />
              </button>
            </header>

            <div className={styles.controls}>
              <label className={styles.searchWrap}>
                <Search size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, subject, audience or message"
                />
              </label>

              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                aria-label="Filter by channel"
              >
                <option value="all">All channels</option>
                {CHANNELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="active">Active messages</option>
                <option value="all">All messages</option>
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
                <option value="archived">Archived</option>
              </select>

              <span className={styles.resultCount}>
                {filteredItems.length} {filteredItems.length === 1 ? "message" : "messages"}
              </span>
            </div>

            {isLoading && (
              <div className={styles.loadingState}>
                <RefreshCw size={24} className={styles.spinning} />
                <strong>Loading campaign communications…</strong>
              </div>
            )}

            {!isLoading && filteredItems.length > 0 && (
              <div className={styles.messageGrid}>
                {filteredItems.map((item) => {
                  const channel = getChannel(item.channel);
                  const ChannelIcon = channel.icon;

                  return (
                    <article className={styles.messageCard} key={item.id}>
                      <header>
                        <div className={styles.channelIcon}>
                          <ChannelIcon size={20} />
                        </div>
                        <div>
                          <div className={styles.badges}>
                            <span>{channel.label}</span>
                            <em className={styles[`status${item.status}`] || ""}>
                              {getStatusLabel(item.status)}
                            </em>
                          </div>
                          <h3>{item.title}</h3>
                        </div>
                      </header>

                      <dl>
                        <div>
                          <dt>Audience</dt>
                          <dd>{item.audience || "Campaign team"}</dd>
                        </div>
                        {item.subject && (
                          <div>
                            <dt>Subject</dt>
                            <dd>{item.subject}</dd>
                          </div>
                        )}
                      </dl>

                      <p>{item.message_body}</p>

                      <div className={styles.cardTime}>
                        <CalendarClock size={15} />
                        {item.status === "scheduled"
                          ? formatDate(item.scheduled_at)
                          : `Updated ${formatDate(item.updated_at)}`}
                      </div>

                      <footer>
                        <button type="button" onClick={() => openEdit(item)}>
                          <Pencil size={16} /> Edit
                        </button>
                        <button type="button" onClick={() => handleCopy(item)}>
                          {copiedId === item.id ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Clipboard size={16} />
                          )}
                          {copiedId === item.id ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateCommunication(item)}
                          title="Duplicate message"
                        >
                          <Copy size={16} />
                        </button>
                        {item.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => handleArchive(item)}
                            title="Archive message"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}

            {!isLoading && filteredItems.length === 0 && (
              <div className={styles.emptyState}>
                <MessageSquareText size={30} />
                <h3>
                  {communications.length
                    ? "No matching communications"
                    : "No campaign messages yet"}
                </h3>
                <p>
                  {communications.length
                    ? "Adjust the search or filters."
                    : "Create the first internal update, email, text, social post or press message."}
                </p>
                {!communications.length && (
                  <button type="button" onClick={openNew}>
                    <Plus size={17} /> New message
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
