import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clipboard,
  KeyRound,
  Layers3,
  LifeBuoy,
  Lightbulb,
  Mail,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./Support.module.css";

const SUPPORT_EMAIL =
  "support@campaignseat.com";

const CATEGORY_OPTIONS = [
  "Technical problem or bug",
  "Login, password or MFA",
  "Workspace or permissions",
  "Data, file or communication issue",
  "Feature request",
  "Privacy or security concern",
  "Other",
];

const URGENCY_OPTIONS = [
  "Normal",
  "Blocking my work",
  "Security or privacy concern",
];

const SUPPORT_TOPICS = [
  {
    icon: Bug,
    title: "Technical issue",
    category: "Technical problem or bug",
    description:
      "Broken page, error message, missing button or unexpected behavior.",
  },
  {
    icon: KeyRound,
    title: "Login or account",
    category: "Login, password or MFA",
    description:
      "Sign-in, password, MFA or account-access help.",
  },
  {
    icon: Layers3,
    title: "Workspace access",
    category: "Workspace or permissions",
    description:
      "Campaign, role, permission or team-access questions.",
  },
  {
    icon: Lightbulb,
    title: "Product feedback",
    category: "Feature request",
    description:
      "Feature requests and ideas that would improve Campaign Seat.",
  },
  {
    icon: ShieldAlert,
    title: "Privacy or security",
    category: "Privacy or security concern",
    description:
      "Report a concern without including passwords or private campaign data.",
  },
  {
    icon: Wrench,
    title: "Other support",
    category: "Other",
    description:
      "Anything else preventing your campaign team from moving forward.",
  },
];

function getSafeReturnPath(search) {
  const requested =
    new URLSearchParams(search).get("from");

  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.startsWith("/support")
  ) {
    return "/";
  }

  return requested;
}

function getReturnLabel(returnPath) {
  if (returnPath === "/") {
    return "Back to sign in";
  }

  if (returnPath.startsWith("/workspaces")) {
    return "Back to workspaces";
  }

  return "Back to Campaign HQ";
}

function buildRequestText({
  form,
  browserDetails,
}) {
  return [
    "CAMPAIGN SEAT SUPPORT REQUEST",
    "",
    `Name: ${form.name || "Not provided"}`,
    `Reply email: ${form.email}`,
    `Campaign / workspace: ${form.campaign || "Not provided"}`,
    `Issue type: ${form.category}`,
    `Urgency: ${form.urgency}`,
    `Affected page or feature: ${form.pageUrl || "Not provided"}`,
    "",
    `Subject: ${form.subject}`,
    "",
    "WHAT HAPPENED",
    form.details,
    "",
    "STEPS, EXPECTED RESULT OR OTHER CONTEXT",
    form.context || "Not provided",
    "",
    "BROWSER DETAILS",
    browserDetails,
  ].join("\n");
}

export default function Support() {
  const location = useLocation();

  const returnPath = useMemo(
    () => getSafeReturnPath(location.search),
    [location.search],
  );

  const user = getCurrentUser();

  const hasCampaignSession = Boolean(
    user.id ||
      user.email ||
      user.workspaceId,
  );

  const workspace = hasCampaignSession
    ? getCurrentWorkspace()
    : null;

  const affectedPage =
    typeof window !== "undefined" &&
    returnPath !== "/"
      ? `${window.location.origin}${returnPath}`
      : "";

  const [form, setForm] = useState({
    name:
      hasCampaignSession &&
      user.name !== "Campaign User"
        ? user.name
        : "",
    email:
      hasCampaignSession
        ? user.email || ""
        : "",
    campaign: workspace?.name || "",
    category: CATEGORY_OPTIONS[0],
    urgency: URGENCY_OPTIONS[0],
    pageUrl: affectedPage,
    subject: "",
    details: "",
    context: "",
  });

  const [status, setStatus] =
    useState("");

  const formCardRef = useRef(null);
  const categoryRef = useRef(null);

  const browserDetails =
    typeof navigator !== "undefined"
      ? navigator.userAgent
      : "Unavailable";

  const returnLabel =
    getReturnLabel(returnPath);

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setStatus("");
  };

  const handleTopicSelect = (
    category,
  ) => {
    setForm((current) => ({
      ...current,
      category,
    }));

    setStatus("");

    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      categoryRef.current?.focus({
        preventScroll: true,
      });
    });
  };

  const requestText =
    buildRequestText({
      form,
      browserDetails,
    });

  const handleSubmit = (event) => {
    event.preventDefault();

    const subject =
      `[Campaign Seat Support] ${form.category}: ${form.subject}`;

    const mailto = [
      `mailto:${SUPPORT_EMAIL}`,
      `?subject=${encodeURIComponent(subject)}`,
      `&body=${encodeURIComponent(requestText)}`,
    ].join("");

    setStatus(
      "Your email app should open. Review the message, attach screenshots if helpful, and send it to Campaign Seat Support.",
    );

    window.location.assign(mailto);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        requestText,
      );

      setStatus(
        "Support request copied. Paste it into an email to support@campaignseat.com.",
      );
    } catch {
      setStatus(
        "Copying was unavailable. Email support@campaignseat.com directly.",
      );
    }
  };

  return (
    <div className={styles.page}>
      <div
        className={styles.backgroundGlow}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.backLink}
            to={returnPath}
          >
            <ArrowLeft
              size={17}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{returnLabel}</span>
          </Link>

          <div className={styles.brand}>
            <div
              className={styles.brandMark}
              aria-hidden="true"
            >
              <LifeBuoy
                size={22}
                strokeWidth={2}
              />
            </div>

            <div>
              <strong>Campaign Seat</strong>
              <span>Support Center</span>
            </div>
          </div>

          <a
            className={styles.emailLink}
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            <Mail
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{SUPPORT_EMAIL}</span>
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <div className={styles.eyebrow}>
            <LifeBuoy
              size={15}
              strokeWidth={2}
              aria-hidden="true"
            />
            Campaign Seat Support
          </div>

          <h1>
            Tell us what is getting in
            your way.
          </h1>

          <p className={styles.lead}>
            Share the page, what you
            expected and what happened.
            Your request opens in your
            email app so you can review
            it and attach screenshots
            before sending.
          </p>

          <div className={styles.topicGrid}>
            {SUPPORT_TOPICS.map(
              ({
                icon: Icon,
                title,
                category,
                description,
              }) => (
                <button
                  key={title}
                  className={styles.topicCard}
                  type="button"
                  onClick={() =>
                    handleTopicSelect(category)
                  }
                >
                  <Icon
                    size={19}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />

                  <span className={styles.topicCopy}>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </span>
                </button>
              ),
            )}
          </div>

          <div className={styles.securityNote}>
            <ShieldAlert
              size={18}
              strokeWidth={2}
              aria-hidden="true"
            />

            <p>
              Do not send passwords,
              MFA codes, payment
              information or private
              voter data. Include only
              what support needs to
              diagnose the issue.
            </p>
          </div>
        </section>

        <section
          className={styles.formCard}
          ref={formCardRef}
        >
          <div className={styles.formHeading}>
            <div>
              <span>Contact support</span>
              <h2>
                Create a support request
              </h2>
            </div>

            <CheckCircle2
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <form
            className={styles.form}
            onSubmit={handleSubmit}
          >
            <div className={styles.formRow}>
              <label>
                <span>Name</span>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  placeholder="Your name"
                />
              </label>

              <label>
                <span>Reply email</span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
            </div>

            <div className={styles.formRow}>
              <label>
                <span>
                  Campaign or workspace
                </span>
                <input
                  name="campaign"
                  type="text"
                  value={form.campaign}
                  onChange={handleChange}
                  placeholder="Campaign name"
                />
              </label>

              <label>
                <span>Issue type</span>
                <select
                  ref={categoryRef}
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  {CATEGORY_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className={styles.formRow}>
              <label>
                <span>Urgency</span>
                <select
                  name="urgency"
                  value={form.urgency}
                  onChange={handleChange}
                >
                  {URGENCY_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Page or feature affected
                </span>
                <input
                  name="pageUrl"
                  type="text"
                  value={form.pageUrl}
                  onChange={handleChange}
                  placeholder="/dashboard, login, calendar..."
                />
              </label>
            </div>

            <label>
              <span>Subject</span>
              <input
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                placeholder="A short description of the problem"
                maxLength={140}
                required
              />
            </label>

            <label>
              <span>What happened?</span>
              <textarea
                name="details"
                value={form.details}
                onChange={handleChange}
                placeholder="Describe the issue, error message or behavior you saw."
                rows={4}
                maxLength={2400}
                required
              />
            </label>

            <label>
              <span>
                Steps, expected result or
                other context
              </span>
              <textarea
                name="context"
                value={form.context}
                onChange={handleChange}
                placeholder="What were you trying to do? What should have happened?"
                rows={3}
                maxLength={1800}
              />
            </label>

            <p className={styles.browserNote}>
              Basic browser details will
              be included to help diagnose
              technical issues.
            </p>

            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="submit"
              >
                <Mail
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Open email to send request
              </button>

              <button
                className={styles.secondaryButton}
                type="button"
                onClick={handleCopy}
              >
                <Clipboard
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Copy request details
              </button>
            </div>

            {status && (
              <div
                className={styles.statusMessage}
                role="status"
              >
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>{status}</span>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          © 2026 Campaign Seat
          Technologies LLC
        </span>

        <a href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </footer>
    </div>
  );
}
