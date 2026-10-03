
import {
  ArrowLeft,
  Bug,
  Check,
  Clipboard,
  ExternalLink,
  KeyRound,
  Layers3,
  LifeBuoy,
  Lightbulb,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import styles from "./SupportCommandCenter.module.css";


const SUPPORT_EMAIL =
  "support@campaignseat.com";

const SUPPORT_VIEWS =
  new Set([
    "overview",
    "request",
    "safety",
  ]);

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
    icon:
      Bug,

    title:
      "Technical issue",

    category:
      "Technical problem or bug",

    description:
      "Broken page, error message, missing button or unexpected behavior.",
  },

  {
    icon:
      KeyRound,

    title:
      "Login or account",

    category:
      "Login, password or MFA",

    description:
      "Sign-in, password, MFA or account-access help.",
  },

  {
    icon:
      Layers3,

    title:
      "Workspace access",

    category:
      "Workspace or permissions",

    description:
      "Campaign, role, permission or team-access questions.",
  },

  {
    icon:
      Lightbulb,

    title:
      "Product feedback",

    category:
      "Feature request",

    description:
      "Feature requests and ideas that would improve Campaign Seat.",
  },

  {
    icon:
      ShieldAlert,

    title:
      "Privacy or security",

    category:
      "Privacy or security concern",

    description:
      "Report a concern without including passwords or private campaign data.",
  },

  {
    icon:
      Wrench,

    title:
      "Other support",

    category:
      "Other",

    description:
      "Anything else preventing your campaign team from moving forward.",
  },
];


function getSafeReturnPath(search) {
  const requested =
    new URLSearchParams(
      search,
    ).get(
      "from",
    );

  if (
    !requested ||
    !requested.startsWith(
      "/",
    ) ||
    requested.startsWith(
      "//",
    ) ||
    requested.startsWith(
      "/support",
    )
  ) {
    return "/dashboard";
  }

  return requested;
}


function readSupportView() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "overview";
  }

  const url =
    new URL(
      window.location.href,
    );

  const requested =
    url.searchParams.get(
      "support-view",
    );

  return SUPPORT_VIEWS.has(
    requested,
  )
    ? requested
    : "overview";
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
  ].join(
    "\n",
  );
}


export default function SupportCommandCenter() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const returnPath =
    useMemo(
      () =>
        getSafeReturnPath(
          location.search,
        ),
      [
        location.search,
      ],
    );

  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        readSupportView(),
    );

  const [
    status,
    setStatus,
  ] =
    useState("");

  const formCardRef =
    useRef(
      null,
    );

  const categoryRef =
    useRef(
      null,
    );

  const affectedPage =
    typeof window !==
      "undefined"
      ? `${window.location.origin}${returnPath}`
      : returnPath;

  const [
    form,
    setForm,
  ] =
    useState(
      () => ({
        name:
          user.name ===
          "Campaign User"
            ? ""
            : user.name ||
              "",

        email:
          user.email ||
          "",

        campaign:
          workspace.name ||
          "",

        category:
          CATEGORY_OPTIONS[0],

        urgency:
          URGENCY_OPTIONS[0],

        pageUrl:
          affectedPage,

        subject:
          "",

        details:
          "",

        context:
          "",
      }),
    );


  const applyView =
    (
      nextView,
      {
        replace = false,
      } = {},
    ) => {
      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.set(
        "support-view",
        nextView,
      );

      const nextUrl =
        `${url.pathname}${url.search}${url.hash}`;

      window.history[
        replace
          ? "replaceState"
          : "pushState"
      ](
        {},
        "",
        nextUrl,
      );

      setActiveView(
        nextView,
      );
    };


  useEffect(
    () => {
      const syncHistory =
        () => {
          setActiveView(
            readSupportView(),
          );
        };

      window.addEventListener(
        "popstate",
        syncHistory,
      );

      return () => {
        window.removeEventListener(
          "popstate",
          syncHistory,
        );
      };
    },
    [],
  );


  const handleChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setForm(
        (current) => ({
          ...current,
          [name]:
            value,
        }),
      );

      setStatus(
        "",
      );
    };


  const handleTopicSelect =
    (
      category,
    ) => {
      setForm(
        (current) => ({
          ...current,
          category,
        }),
      );

      setStatus(
        "",
      );

      applyView(
        "request",
      );

      window.requestAnimationFrame(
        () => {
          formCardRef.current?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });

          categoryRef.current?.focus({
            preventScroll:
              true,
          });
        },
      );
    };


  const browserDetails =
    typeof navigator !==
      "undefined"
      ? navigator.userAgent
      : "Unavailable";

  const requestText =
    buildRequestText({
      form,
      browserDetails,
    });


  const handleSubmit =
    (event) => {
      event.preventDefault();

      const subject =
        `[Campaign Seat Support] ${form.category}: ${form.subject}`;

      const mailto = [
        `mailto:${SUPPORT_EMAIL}`,
        `?subject=${encodeURIComponent(
          subject,
        )}`,
        `&body=${encodeURIComponent(
          requestText,
        )}`,
      ].join(
        "",
      );

      setStatus(
        "Your email app should open. Review the message, attach screenshots if helpful, and send it to Campaign Seat Support.",
      );

      window.location.assign(
        mailto,
      );
    };


  const handleCopy =
    async () => {
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
    <CampaignWorkspaceShell
      activeItem="Support"
    >
      <main
        className={
          styles.main
        }
        data-support-command-center="true"
        data-support-delivery="email-handoff"
      >
        <div
          className={
            styles.canvas
          }
        >
          <section
            className={
              styles.hero
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Campaign Seat assistance
              </span>

              <h1>
                Support Command Center
              </h1>

              <p>
                Diagnose an issue, prepare a support request, and review
                safe-sharing guidance without exposing campaign secrets
                or pretending an in-app ticket has been created.
              </p>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={() =>
                  navigate(
                    returnPath,
                  )
                }
              >
                <ArrowLeft
                  size={18}
                />
                Return
              </button>
            </div>
          </section>


          <div
            className={
              styles.liveStatus
            }
          >
            <ShieldCheck
              size={16}
            />

            <span>
              Campaign Seat support handoff ready
            </span>

            <small>
              Email delivery
            </small>
          </div>


          {status ? (
            <div
              className={
                styles.notice
              }
              role="status"
            >
              <Check
                size={16}
              />

              <span>
                {status}
              </span>

              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() =>
                  setStatus(
                    "",
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            </div>
          ) : null}


          <section
            className={
              styles.metrics
            }
            aria-label="Support summary"
          >
            <button
              type="button"
              onClick={() =>
                applyView(
                  "request",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <Mail
                  size={22}
                />
              </span>

              <span>
                <small>
                  Delivery
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  Email
                </strong>

                <em>
                  User reviews before sending
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyView(
                  "overview",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <LifeBuoy
                  size={22}
                />
              </span>

              <span>
                <small>
                  Support topics
                </small>

                <strong>
                  {SUPPORT_TOPICS.length}
                </strong>

                <em>
                  Common assistance categories
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                applyView(
                  "safety",
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <ShieldAlert
                  size={22}
                />
              </span>

              <span>
                <small>
                  Sensitive data
                </small>

                <strong
                  className={
                    styles.metricWord
                  }
                >
                  Protected
                </strong>

                <em>
                  Never include passwords or MFA codes
                </em>
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                navigate(
                  returnPath,
                )
              }
            >
              <span
                className={
                  styles.metricIcon
                }
              >
                <ExternalLink
                  size={22}
                />
              </span>

              <span>
                <small>
                  Affected context
                </small>

                <strong
                  className={
                    styles.metricPath
                  }
                >
                  {returnPath}
                </strong>

                <em>
                  Return destination
                </em>
              </span>
            </button>
          </section>


          <section
            className={
              styles.workspace
            }
          >
            <div
              className={
                styles.primaryColumn
              }
            >
              <nav
                className={
                  styles.tabs
                }
                aria-label="Support views"
              >
                <button
                  type="button"
                  className={
                    activeView ===
                    "overview"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "overview",
                    )
                  }
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "request"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "request",
                    )
                  }
                >
                  Create request
                </button>

                <button
                  type="button"
                  className={
                    activeView ===
                    "safety"
                      ? styles.tabActive
                      : ""
                  }
                  onClick={() =>
                    applyView(
                      "safety",
                    )
                  }
                >
                  Safe sharing
                </button>
              </nav>


              {activeView ===
              "overview" ? (
                <>
                  <section
                    className={
                      styles.snapshotPanel
                    }
                  >
                    <header>
                      <span
                        className={
                          styles.sectionIcon
                        }
                      >
                        <LifeBuoy
                          size={19}
                        />
                      </span>

                      <div>
                        <h2>
                          What do you need help with?
                        </h2>

                        <p>
                          Choose a topic to prefill the support request category.
                        </p>
                      </div>
                    </header>

                    <div
                      className={
                        styles.topicGrid
                      }
                    >
                      {SUPPORT_TOPICS.map(
                        ({
                          icon:
                            Icon,

                          title,
                          category,
                          description,
                        }) => (
                          <button
                            key={
                              title
                            }
                            type="button"
                            className={
                              styles.topicCard
                            }
                            onClick={() =>
                              handleTopicSelect(
                                category,
                              )
                            }
                          >
                            <span>
                              <Icon
                                size={18}
                              />
                            </span>

                            <div>
                              <strong>
                                {title}
                              </strong>

                              <small>
                                {description}
                              </small>
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  </section>


                  <section
                    className={
                      styles.returnContext
                    }
                  >
                    <ArrowLeft
                      size={19}
                    />

                    <div>
                      <strong>
                        Current support context
                      </strong>

                      <p>
                        This support visit will return to{" "}
                        <code>
                          {returnPath}
                        </code>
                        .
                      </p>
                    </div>
                  </section>
                </>
              ) : null}


              {activeView ===
              "request" ? (
                <section
                  className={
                    styles.requestPanel
                  }
                  ref={
                    formCardRef
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <Mail
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Create a support request
                      </h2>

                      <p>
                        Campaign Seat prepares an email for you to review
                        before you send it.
                      </p>
                    </div>
                  </header>

                  <form
                    className={
                      styles.requestForm
                    }
                    onSubmit={
                      handleSubmit
                    }
                  >
                    <div
                      className={
                        styles.formRow
                      }
                    >
                      <label>
                        <span>
                          Name
                        </span>

                        <input
                          name="name"
                          type="text"
                          value={
                            form.name
                          }
                          onChange={
                            handleChange
                          }
                          placeholder="Your name"
                        />
                      </label>

                      <label>
                        <span>
                          Reply email
                        </span>

                        <input
                          name="email"
                          type="email"
                          value={
                            form.email
                          }
                          onChange={
                            handleChange
                          }
                          placeholder="you@example.com"
                          required
                        />
                      </label>
                    </div>


                    <div
                      className={
                        styles.formRow
                      }
                    >
                      <label>
                        <span>
                          Campaign or workspace
                        </span>

                        <input
                          name="campaign"
                          type="text"
                          value={
                            form.campaign
                          }
                          onChange={
                            handleChange
                          }
                          placeholder="Campaign name"
                        />
                      </label>

                      <label>
                        <span>
                          Issue type
                        </span>

                        <select
                          ref={
                            categoryRef
                          }
                          name="category"
                          value={
                            form.category
                          }
                          onChange={
                            handleChange
                          }
                        >
                          {CATEGORY_OPTIONS.map(
                            (
                              option,
                            ) => (
                              <option
                                key={
                                  option
                                }
                                value={
                                  option
                                }
                              >
                                {option}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>


                    <div
                      className={
                        styles.formRow
                      }
                    >
                      <label>
                        <span>
                          Urgency
                        </span>

                        <select
                          name="urgency"
                          value={
                            form.urgency
                          }
                          onChange={
                            handleChange
                          }
                        >
                          {URGENCY_OPTIONS.map(
                            (
                              option,
                            ) => (
                              <option
                                key={
                                  option
                                }
                                value={
                                  option
                                }
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
                          value={
                            form.pageUrl
                          }
                          onChange={
                            handleChange
                          }
                          placeholder="/dashboard, calendar..."
                        />
                      </label>
                    </div>


                    <label>
                      <span>
                        Subject
                      </span>

                      <input
                        name="subject"
                        type="text"
                        value={
                          form.subject
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="A short description of the problem"
                        maxLength={140}
                        required
                      />
                    </label>


                    <label>
                      <span>
                        What happened?
                      </span>

                      <textarea
                        name="details"
                        value={
                          form.details
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Describe the issue, error message or behavior you saw."
                        rows={4}
                        maxLength={2400}
                        required
                      />
                    </label>


                    <label>
                      <span>
                        Steps, expected result or other context
                      </span>

                      <textarea
                        name="context"
                        value={
                          form.context
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="What were you trying to do? What should have happened?"
                        rows={3}
                        maxLength={1800}
                      />
                    </label>


                    <div
                      className={
                        styles.deliveryNote
                      }
                    >
                      <ShieldCheck
                        size={17}
                      />

                      <span>
                        No in-app support ticket is created by this form.
                        Your email application opens so you can review the
                        request before sending.
                      </span>
                    </div>


                    <div
                      className={
                        styles.actions
                      }
                    >
                      <button
                        type="submit"
                        className={
                          styles.primaryAction
                        }
                      >
                        <Mail
                          size={17}
                        />
                        Open email to send request
                      </button>

                      <button
                        type="button"
                        className={
                          styles.secondaryAction
                        }
                        onClick={
                          handleCopy
                        }
                      >
                        <Clipboard
                          size={17}
                        />
                        Copy request details
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}


              {activeView ===
              "safety" ? (
                <section
                  className={
                    styles.safetyPanel
                  }
                >
                  <header>
                    <span
                      className={
                        styles.sectionIcon
                      }
                    >
                      <ShieldAlert
                        size={19}
                      />
                    </span>

                    <div>
                      <h2>
                        Safe sharing guidance
                      </h2>

                      <p>
                        Share enough information to diagnose the issue
                        without exposing sensitive credentials or data.
                      </p>
                    </div>
                  </header>

                  <div
                    className={
                      styles.safetyGrid
                    }
                  >
                    <SafetyCell
                      title="Do not send"
                      text="Passwords, MFA codes, API keys, refresh tokens or payment credentials."
                      tone="warning"
                    />

                    <SafetyCell
                      title="Avoid private records"
                      text="Do not include private campaign or constituent data unless support specifically requires a minimal example."
                      tone="warning"
                    />

                    <SafetyCell
                      title="Useful context"
                      text="Include the affected page, what you expected, what happened and any visible error message."
                    />

                    <SafetyCell
                      title="Screenshots"
                      text="Screenshots can help when they do not expose credentials, private records or unrelated personal information."
                    />
                  </div>

                  <div
                    className={
                      styles.supportEmailCard
                    }
                  >
                    <Mail
                      size={20}
                    />

                    <div>
                      <strong>
                        Campaign Seat Support
                      </strong>

                      <span>
                        {SUPPORT_EMAIL}
                      </span>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>


            <aside
              className={
                styles.rightRail
              }
            >
              <section
                className={
                  styles.attentionCard
                }
              >
                <header>
                  <span>
                    <ShieldAlert
                      size={19}
                    />
                  </span>

                  <div>
                    <h2>
                      Before sending
                    </h2>

                    <p>
                      Keep the request useful and safe.
                    </p>
                  </div>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "safety",
                    )
                  }
                >
                  <div>
                    <strong>
                      Never share credentials
                    </strong>

                    <span>
                      Passwords, MFA codes, API keys or tokens
                    </span>
                  </div>

                  <em>
                    !
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "request",
                    )
                  }
                >
                  <div>
                    <strong>
                      Review before sending
                    </strong>

                    <span>
                      Email handoff stays under your control
                    </span>
                  </div>

                  <em>
                    ✓
                  </em>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "overview",
                    )
                  }
                >
                  <div>
                    <strong>
                      {SUPPORT_TOPICS.length} support categories
                    </strong>

                    <span>
                      Choose the closest issue type
                    </span>
                  </div>

                  <em>
                    {SUPPORT_TOPICS.length}
                  </em>
                </button>
              </section>


              <section
                className={
                  styles.quickCard
                }
              >
                <header>
                  <h2>
                    Quick actions
                  </h2>
                </header>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "request",
                    )
                  }
                >
                  <Mail
                    size={16}
                  />
                  Create request
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyView(
                      "safety",
                    )
                  }
                >
                  <ShieldAlert
                    size={16}
                  />
                  Safe sharing
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      returnPath,
                    )
                  }
                >
                  <ArrowLeft
                    size={16}
                  />
                  Return to previous page
                </button>
              </section>


              <section
                className={
                  styles.connectionCard
                }
              >
                <span>
                  <Mail
                    size={21}
                  />
                </span>

                <div>
                  <strong>
                    Email handoff
                  </strong>

                  <p>
                    Support requests are currently prepared for your
                    email application rather than stored as Campaign Seat tickets.
                  </p>

                  <small>
                    V81 does not claim a ticket was submitted until you send the email.
                  </small>
                </div>
              </section>
            </aside>
          </section>


          <div
            className={
              styles.footerNote
            }
          >
            <ShieldCheck
              size={16}
            />

            <span>
              V81 introduces no support-ticket database or provider write.
              The existing support email handoff remains authoritative.
            </span>
          </div>
        </div>
      </main>
    </CampaignWorkspaceShell>
  );
}


function SafetyCell({
  title,
  text,
  tone = "neutral",
}) {
  return (
    <article
      className={
        styles.safetyCell
      }
      data-tone={
        tone
      }
    >
      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>
    </article>
  );
}
