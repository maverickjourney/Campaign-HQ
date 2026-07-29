import {
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Mail,
  MessageSquareText,
  Phone,
  X,
} from "lucide-react";

import styles from "./ContactChannelModal.module.css";

const CHANNELS = [
  {
    id: "campaign_seat",
    label: "Campaign Seat",
    description: "Open the campaign communications workspace.",
  },
  {
    id: "email",
    label: "Email",
    description: "Compose an email in the device email application.",
  },
  {
    id: "text",
    label: "Text",
    description: "Compose an SMS message using the contact’s phone number.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Open a WhatsApp conversation using the contact’s phone number.",
  },
  {
    id: "call",
    label: "Call",
    description: "Start a phone call and then record the result.",
  },
];

const OUTCOMES = [
  ["reached", "Reached"],
  ["replied", "Replied"],
  ["left_voicemail", "Left voicemail"],
  ["no_answer", "No answer"],
  ["follow_up_needed", "Follow-up needed"],
  ["wrong_number", "Wrong number"],
  ["opted_out", "Opted out"],
];

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function suggestedChannel(contact) {
  if (contact?.email && contact?.email_consent) {
    return "email";
  }

  if (contact?.phone && contact?.sms_consent) {
    return "text";
  }

  if (contact?.phone) {
    return "call";
  }

  return "campaign_seat";
}

function channelAccess(contact, channel) {
  if (contact.status === "do_not_contact") {
    if (channel === "campaign_seat") {
      return {
        allowed: true,
        internalOnly: true,
        reason:
          "This person is marked Do not contact. You may save an internal campaign note, but no outreach will be opened.",
      };
    }

    return {
      allowed: false,
      internalOnly: false,
      reason:
        "This person is marked Do not contact. External outreach is blocked.",
    };
  }

  if (channel === "email") {
    if (!contact.email) {
      return {
        allowed: false,
        reason: "No email address is recorded.",
      };
    }

    if (!contact.email_consent) {
      return {
        allowed: false,
        reason: "Email consent is not recorded.",
      };
    }
  }

  if (["text", "whatsapp"].includes(channel)) {
    if (!phoneDigits(contact.phone)) {
      return {
        allowed: false,
        reason: "No usable phone number is recorded.",
      };
    }

    if (!contact.sms_consent) {
      return {
        allowed: false,
        reason: "Text-message consent is not recorded.",
      };
    }
  }

  if (channel === "call" && !phoneDigits(contact.phone)) {
    return {
      allowed: false,
      reason: "No usable phone number is recorded.",
    };
  }

  return {
    allowed: true,
    internalOnly: false,
    reason: "",
  };
}

export default function ContactChannelModal({
  contact,
  actorName,
  isSaving,
  onClose,
  onRecord,
}) {
  const [channel, setChannel] = useState(
    () => suggestedChannel(contact),
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState("reached");
  const [notes, setNotes] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    contact.next_follow_up_at
      ? new Date(contact.next_follow_up_at)
          .toISOString()
          .slice(0, 16)
      : "",
  );
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState("");

  const selectedChannel = useMemo(
    () =>
      CHANNELS.find((item) => item.id === channel) ||
      CHANNELS[0],
    [channel],
  );

  const access = channelAccess(contact, channel);

  const chooseChannel = (value) => {
    setChannel(value);
    setLaunched(false);
    setError("");
  };

  const launch = () => {
    if (!access.allowed) {
      setError(access.reason);
      return;
    }

    const encodedSubject = encodeURIComponent(subject.trim());
    const encodedMessage = encodeURIComponent(message.trim());
    const phone = phoneDigits(contact.phone);

    if (channel === "campaign_seat") {
      const params = new URLSearchParams({
        contact_id: contact.id,
        contact_name: contact.full_name,
        channel: "campaign-seat",
      });

      window.open(
        `/communications?${params.toString()}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    if (channel === "email") {
      window.location.href =
        `mailto:${contact.email}?subject=${encodedSubject}&body=${encodedMessage}`;
    }

    if (channel === "text") {
      window.location.href =
        `sms:${phone}?&body=${encodedMessage}`;
    }

    if (channel === "whatsapp") {
      window.open(
        `https://wa.me/${phone}?text=${encodedMessage}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    if (channel === "call") {
      window.location.href = `tel:${phone}`;
    }

    setLaunched(true);
  };

  const saveInteraction = async () => {
    try {
      await onRecord({
        channel,
        outcome,
        notes: notes.trim(),
        message: message.trim(),
        nextFollowUpAt: nextFollowUpAt
          ? new Date(nextFollowUpAt).toISOString()
          : null,
        actorName,
        internalOnly: false,
      });
    } catch (recordError) {
      setError(
        recordError?.message ||
          "The interaction could not be recorded.",
      );
    }
  };

  const saveInternalNote = async () => {
    if (!message.trim()) {
      setError(
        "Enter an internal note before saving.",
      );
      return;
    }

    try {
      await onRecord({
        channel: "campaign_seat",
        outcome: "internal_note",
        notes: message.trim(),
        message: "",
        nextFollowUpAt: null,
        actorName,
        internalOnly: true,
      });
    } catch (recordError) {
      setError(
        recordError?.message ||
          "The internal note could not be saved.",
      );
    }
  };

  return (
    <div className={styles.layer}>
      <button
        className={styles.backdrop}
        type="button"
        onClick={onClose}
        aria-label="Close contact workflow"
      />

      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-channel-title"
      >
        <header className={styles.header}>
          <div>
            <span>Campaign contact</span>
            <h2 id="contact-channel-title">
              Contact {contact.full_name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className={styles.body}>
          <aside className={styles.rail}>
            <strong>Choose a channel</strong>

            {CHANNELS.map((item) => {
              const itemAccess = channelAccess(contact, item.id);

              return (
                <button
                  key={item.id}
                  className={
                    channel === item.id
                      ? styles.activeChannel
                      : ""
                  }
                  type="button"
                  onClick={() => chooseChannel(item.id)}
                >
                  <span>{item.label}</span>
                  <small>
                    {itemAccess.allowed
                      ? "Available"
                      : itemAccess.reason}
                  </small>
                </button>
              );
            })}
          </aside>

          <main className={styles.composer}>
            <section className={styles.contactSummary}>
              <div>
                <strong>{contact.full_name}</strong>
                <span>
                  {contact.email || "No email"} ·{" "}
                  {contact.phone || "No phone"}
                </span>
              </div>

              <span>
                Suggested:{" "}
                {
                  CHANNELS.find(
                    (item) =>
                      item.id === suggestedChannel(contact),
                  )?.label
                }
              </span>
            </section>

            <section
              className={`${styles.access} ${
                access.allowed
                  ? styles.allowed
                  : styles.blocked
              }`}
            >
              {access.allowed ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}

              <div>
                <strong>
                  {selectedChannel.label}
                  {access.internalOnly
                    ? " allows internal notes only"
                    : access.allowed
                      ? " is available"
                      : " is blocked"}
                </strong>

                <p>
                  {access.internalOnly
                    ? access.reason
                    : access.allowed
                      ? selectedChannel.description
                      : access.reason}
                </p>
              </div>
            </section>

            {channel !== "call" && (
              <section className={styles.fields}>
                {channel === "email" && (
                  <label>
                    <span>Subject</span>
                    <input
                      value={subject}
                      onChange={(event) =>
                        setSubject(event.target.value)
                      }
                      placeholder="Campaign follow-up"
                    />
                  </label>
                )}

                <label>
                  <span>
                    {channel === "campaign_seat"
                      ? access.internalOnly
                        ? "Internal note"
                        : "Communication note"
                      : "Message"}
                  </span>

                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder={
                      channel === "campaign_seat"
                        ? access.internalOnly
                          ? "Record an internal campaign note. No outreach will be opened."
                          : "Add context before opening Communications."
                        : "Write the message before opening the channel."
                    }
                  />
                </label>
              </section>
            )}

            {channel === "call" && (
              <section className={styles.callPreview}>
                <Phone size={22} />

                <div>
                  <strong>{contact.phone}</strong>
                  <p>
                    Start the call, then return here to record
                    the result.
                  </p>
                </div>
              </section>
            )}

            {launched && !access.internalOnly && (
              <section className={styles.outcome}>
                <header>
                  <div>
                    <span>Interaction result</span>
                    <h3>Record what happened</h3>
                  </div>

                  <small>
                    Live mode updates last contact and follow-up.
                  </small>
                </header>

                <div className={styles.outcomeGrid}>
                  <label>
                    <span>Outcome</span>

                    <select
                      value={outcome}
                      onChange={(event) =>
                        setOutcome(event.target.value)
                      }
                    >
                      {OUTCOMES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Next follow-up</span>

                    <input
                      type="datetime-local"
                      value={nextFollowUpAt}
                      onChange={(event) =>
                        setNextFollowUpAt(event.target.value)
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Interaction notes</span>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="What happened, and what should happen next?"
                  />
                </label>
              </section>
            )}

            {error && (
              <p className={styles.error} role="alert">
                <AlertTriangle size={16} />
                {error}
              </p>
            )}
          </main>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          {access.internalOnly ? (
            <button
              className={styles.primary}
              type="button"
              onClick={saveInternalNote}
              disabled={
                isSaving ||
                !message.trim()
              }
            >
              <MessageSquareText size={17} />
              Save internal note
            </button>
          ) : launched ? (
            <button
              className={styles.primary}
              type="button"
              onClick={saveInteraction}
              disabled={isSaving}
            >
              <Check size={17} />
              Save interaction
            </button>
          ) : (
            <button
              className={styles.primary}
              type="button"
              onClick={launch}
              disabled={!access.allowed}
            >
              {channel === "email" && <Mail size={17} />}

              {["campaign_seat", "text", "whatsapp"].includes(
                channel,
              ) && <MessageSquareText size={17} />}

              {channel === "call" && <Phone size={17} />}

              {channel === "campaign_seat"
                ? "Open Communications"
                : `Open ${selectedChannel.label}`}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
