import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ContactRound,
  FileCheck2,
  FileText,
  FolderKanban,
  LoaderCircle,
  MessageSquareText,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getCurrentUser,
  getCurrentWorkspace,
} from "../../utils/campaignSession";

import {
  useCampaignSearch,
} from "../../hooks/useCampaignSearch";

import styles from "./CampaignSearch.module.css";

const QUICK_QUESTIONS = [
  "Show Wellington volunteers assigned to Patrick",
  "Find the latest reception materials",
  "What approvals are waiting on me?",
  "Show contacts needing follow-up this week",
];

const RESULT_LABELS = {
  activity: "Activity",
  approval: "Approval",
  communication:
    "Communication",
  contact: "Contact",
  event: "Calendar event",
  file: "File",
  member: "Team member",
  task: "Task",
  workspace: "Workspace",
};

const ENTITY_RULES = [
  {
    type: "contact",
    terms: [
      "contact",
      "contacts",
      "supporter",
      "supporters",
      "volunteer",
      "volunteers",
      "donor",
      "donors",
      "vendor",
      "vendors",
      "media",
      "endorser",
      "endorsers",
    ],
  },
  {
    type: "file",
    terms: [
      "file",
      "files",
      "document",
      "documents",
      "flyer",
      "flyers",
      "material",
      "materials",
      "image",
      "images",
      "pdf",
      "spreadsheet",
    ],
  },
  {
    type: "task",
    terms: [
      "task",
      "tasks",
      "assignment",
      "assignments",
      "responsibility",
    ],
  },
  {
    type: "event",
    terms: [
      "event",
      "events",
      "calendar",
      "meeting",
      "meetings",
      "reception",
    ],
  },
  {
    type: "approval",
    terms: [
      "approval",
      "approvals",
      "review",
      "reviews",
    ],
  },
  {
    type:
      "communication",
    terms: [
      "communication",
      "communications",
      "message",
      "messages",
      "email",
      "emails",
      "text",
      "texts",
      "social post",
      "social posts",
    ],
  },
  {
    type: "member",
    terms: [
      "team member",
      "team members",
      "staff",
      "campaign member",
      "campaign members",
    ],
  },
  {
    type: "activity",
    terms: [
      "activity",
      "activities",
      "update",
      "updates",
      "changed",
    ],
  },
];

const CONVERSATIONAL_PHRASES = [
  "ask campaign hq",
  "can you",
  "could you",
  "please",
  "show me",
  "show",
  "find me",
  "find",
  "tell me",
  "what are",
  "what is",
  "what",
  "who are",
  "who is",
  "who",
  "where are",
  "where is",
  "where",
  "give me",
  "list",
  "all of",
  "all",
];

const STOP_WORDS =
  new Set([
    "a",
    "an",
    "and",
    "are",
    "at",
    "for",
    "from",
    "in",
    "is",
    "me",
    "my",
    "of",
    "on",
    "our",
    "that",
    "the",
    "this",
    "to",
    "with",
  ]);

function getResultIcon(type) {
  const icons = {
    activity: Activity,
    approval: FileCheck2,
    communication:
      MessageSquareText,
    contact: ContactRound,
    event: CalendarDays,
    file: FolderKanban,
    member: UsersRound,
    task: ClipboardCheck,
    workspace: FileText,
  };

  return (
    icons[type] ||
    Search
  );
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        new Date()
          .getFullYear()
          ? "numeric"
          : undefined,
    },
  ).format(date);
}

function normalizeQuestion(
  question,
  userId,
) {
  const lower =
    String(
      question || "",
    )
      .trim()
      .toLowerCase();

  const entityMatches =
    ENTITY_RULES.filter(
      (rule) =>
        rule.terms.some(
          (term) =>
            lower.includes(
              term,
            ),
        ),
    );

  const entityType =
    entityMatches.length ===
    1
      ? entityMatches[0]
          .type
      : "";

  const pending =
    /\b(waiting|pending|needs approval|awaiting|to review)\b/.test(
      lower,
    );

  const completed =
    /\b(completed|complete|done|approved)\b/.test(
      lower,
    );

  const scheduled =
    /\b(scheduled|upcoming)\b/.test(
      lower,
    );

  const followUp =
    /\b(follow[- ]?up|followups)\b/.test(
      lower,
    );

  const unassigned =
    /\b(unassigned|without an owner|no owner)\b/.test(
      lower,
    );

  const assignedToMe =
    /\b(assigned to me|waiting on me|for me|my tasks|my approvals)\b/.test(
      lower,
    );

  const thisWeek =
    /\b(this week|next seven days|next 7 days)\b/.test(
      lower,
    );

  const recent =
    /\b(latest|recent|newest|most recent)\b/.test(
      lower,
    );

  let cleaned =
    lower;

  CONVERSATIONAL_PHRASES.forEach(
    (phrase) => {
      cleaned =
        cleaned.replaceAll(
          phrase,
          " ",
        );
    },
  );

  ENTITY_RULES.forEach(
    (rule) => {
      rule.terms.forEach(
        (term) => {
          cleaned =
            cleaned.replaceAll(
              term,
              " ",
            );
        },
      );
    },
  );

  [
    "assigned to me",
    "waiting on me",
    "for me",
    "my tasks",
    "my approvals",
    "needs approval",
    "next seven days",
    "next 7 days",
    "this week",
    "follow-up",
    "follow up",
    "followups",
    "latest",
    "recent",
    "newest",
    "most recent",
    "waiting",
    "pending",
    "awaiting",
    "to review",
    "completed",
    "complete",
    "done",
    "approved",
    "scheduled",
    "upcoming",
    "unassigned",
    "without an owner",
    "no owner",
  ].forEach(
    (phrase) => {
      cleaned =
        cleaned.replaceAll(
          phrase,
          " ",
        );
    },
  );

  const searchText =
    cleaned
      .replace(
        /[^a-z0-9@._ -]+/g,
        " ",
      )
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 1 &&
          !STOP_WORDS.has(
            word,
          ),
      )
      .join(" ")
      .trim();

  return {
    question:
      String(
        question || "",
      ).trim(),
    searchText,
    entityType,
    pending,
    completed,
    scheduled,
    followUp,
    unassigned,
    assignedToMe:
      assignedToMe &&
      Boolean(userId),
    thisWeek,
    recent,
  };
}

function filterResults(
  rows,
  intent,
  userId,
) {
  let next =
    [...rows];

  if (intent.entityType) {
    next =
      next.filter(
        (row) =>
          row.result_type ===
          intent.entityType,
      );
  }

  if (intent.pending) {
    next =
      next.filter(
        (row) =>
          [
            "draft",
            "pending",
            "changes_requested",
            "ready",
          ].includes(
            row.status,
          ),
      );
  }

  if (intent.completed) {
    next =
      next.filter(
        (row) =>
          [
            "completed",
            "approved",
          ].includes(
            row.status,
          ),
      );
  }

  if (intent.scheduled) {
    next =
      next.filter(
        (row) =>
          row.status ===
            "scheduled" ||
          row.result_type ===
            "event",
      );
  }

  if (intent.followUp) {
    next =
      next.filter(
        (row) =>
          row.result_type ===
            "contact" &&
          (
            row.status ===
              "follow_up" ||
            row.metadata
              ?.next_follow_up_at
          ),
      );
  }

  if (intent.unassigned) {
    next =
      next.filter(
        (row) =>
          !row.metadata
            ?.assignee_id,
      );
  }

  if (
    intent.assignedToMe &&
    userId
  ) {
    next =
      next.filter(
        (row) =>
          row.metadata
            ?.assignee_id ===
          userId,
      );
  }

  if (intent.thisWeek) {
    const now =
      new Date();

    const weekEnd =
      new Date(
        now.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000,
      );

    next =
      next.filter(
        (row) => {
          if (
            !row.result_date
          ) {
            return false;
          }

          const date =
            new Date(
              row.result_date,
            );

          return (
            date >= now &&
            date <=
              weekEnd
          );
        },
      );
  }

  if (intent.recent) {
    next.sort(
      (left, right) =>
        new Date(
          right.result_date ||
            0,
        ).getTime() -
        new Date(
          left.result_date ||
            0,
        ).getTime(),
    );
  }

  return next;
}

function buildAnswer(
  results,
  intent,
) {
  if (!results.length) {
    return "I couldn’t find a matching campaign record. Try a person’s name, file title, event, task, approval, contact detail or a broader phrase.";
  }

  const counts =
    results.reduce(
      (summary, result) => {
        summary[
          result.result_type
        ] =
          (
            summary[
              result
                .result_type
            ] || 0
          ) + 1;

        return summary;
      },
      {},
    );

  const leadingTypes =
    Object.entries(
      counts,
    )
      .sort(
        (
          left,
          right,
        ) =>
          right[1] -
          left[1],
      )
      .slice(0, 3)
      .map(
        ([
          type,
          count,
        ]) =>
          `${count} ${
            RESULT_LABELS[
              type
            ] ||
            type
          }${
            count === 1
              ? ""
              : "s"
          }`,
      )
      .join(", ");

  const topResult =
    results[0];

  const qualifier =
    intent.recent
      ? " The newest match"
      : " The strongest match";

  return `I found ${results.length} matching campaign ${
    results.length === 1
      ? "record"
      : "records"
  }: ${leadingTypes}.${qualifier} is “${topResult.title}.”`;
}

export function CampaignSearch() {
  const navigate =
    useNavigate();

  const inputRef =
    useRef(null);

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    results,
    setResults,
  ] = useState([]);

  const [
    answer,
    setAnswer,
  ] = useState("");

  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);

  const {
    isSearching,
    error,
    clearError,
    searchCampaign,
  } =
    useCampaignSearch({
      workspaceId:
        workspace.id,
    });

  const openSearch =
    () => {
      setIsOpen(true);

      window.setTimeout(
        () =>
          inputRef.current
            ?.focus(),
        30,
      );
    };

  const closeSearch =
    () => {
      setIsOpen(false);
    };

  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          (
            event.metaKey ||
            event.ctrlKey
          ) &&
          event.key
            .toLowerCase() ===
            "k"
        ) {
          event.preventDefault();
          openSearch();
        }

        if (
          event.key ===
            "Escape" &&
          isOpen
        ) {
          closeSearch();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
  }, [isOpen]);

  const runSearch =
    async (nextQuestion) => {
      const trimmed =
        String(
          nextQuestion || "",
        ).trim();

      if (!trimmed) {
        return;
      }

      const intent =
        normalizeQuestion(
          trimmed,
          user.id,
        );

      setQuestion(
        trimmed,
      );
      setHasSearched(true);
      setAnswer("");
      setResults([]);
      clearError();

      try {
        const rows =
          await searchCampaign({
            query:
              intent.searchText,
            limit: 100,
          });

        const filtered =
          filterResults(
            rows,
            intent,
            user.id,
          );

        setResults(
          filtered.slice(
            0,
            60,
          ),
        );

        setAnswer(
          buildAnswer(
            filtered,
            intent,
          ),
        );
      } catch {
        setAnswer("");
      }
    };

  const handleSubmit =
    (event) => {
      event.preventDefault();
      runSearch(question);
    };

  const openResult =
    (result) => {
      if (
        !result.route
      ) {
        return;
      }

      closeSearch();
      navigate(
        result.route,
      );
    };

  return (
    <div
      className={
        styles.searchRoot
      }
    >
      <button
        className={
          styles.searchButton
        }
        type="button"
        onClick={
          openSearch
        }
        aria-label="Ask Campaign HQ"
        title="Ask Campaign HQ — Command K"
      >
        <Sparkles
          size={17}
        />

        <span
          className={
            styles.searchButtonText
          }
        >
          Ask Campaign HQ
        </span>

        <kbd>
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <>
          <button
            className={
              styles.overlay
            }
            type="button"
            onClick={
              closeSearch
            }
            aria-label="Close Campaign Search"
          />

          <section
            className={
              styles.searchModal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-search-title"
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div
                className={
                  styles.headerIcon
                }
              >
                <Sparkles
                  size={21}
                />
              </div>

              <div>
                <span>
                  Campaign intelligence
                </span>

                <h2
                  id="campaign-search-title"
                >
                  Ask Campaign HQ
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeSearch
                }
                aria-label="Close Campaign Search"
              >
                <X
                  size={20}
                />
              </button>
            </header>

            <form
              className={
                styles.searchForm
              }
              onSubmit={
                handleSubmit
              }
            >
              <Search
                size={21}
              />

              <input
                ref={
                  inputRef
                }
                type="search"
                value={
                  question
                }
                onChange={(
                  event,
                ) =>
                  setQuestion(
                    event.target
                      .value,
                  )
                }
                placeholder="Ask about files, contacts, tasks, events, approvals or campaign activity…"
              />

              <button
                type="submit"
                disabled={
                  isSearching ||
                  !question.trim()
                }
              >
                {isSearching
                  ? "Searching…"
                  : "Ask"}
              </button>
            </form>

            {!hasSearched && (
              <div
                className={
                  styles.startState
                }
              >
                <div
                  className={
                    styles.startCopy
                  }
                >
                  <Sparkles
                    size={28}
                  />

                  <h3>
                    Search the whole
                    campaign
                  </h3>

                  <p>
                    Campaign HQ searches
                    the records your
                    account is allowed to
                    view and returns
                    clickable results.
                  </p>
                </div>

                <div
                  className={
                    styles.suggestions
                  }
                >
                  <span>
                    Try asking
                  </span>

                  {QUICK_QUESTIONS.map(
                    (
                      suggestion,
                    ) => (
                      <button
                        key={
                          suggestion
                        }
                        type="button"
                        onClick={() =>
                          runSearch(
                            suggestion,
                          )
                        }
                      >
                        <Search
                          size={
                            15
                          }
                        />

                        {
                          suggestion
                        }
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {isSearching && (
              <div
                className={
                  styles.loadingState
                }
              >
                <LoaderCircle
                  className={
                    styles.spinning
                  }
                  size={30}
                />

                <strong>
                  Searching Campaign
                  HQ…
                </strong>

                <span>
                  Checking campaign
                  records and
                  permissions
                </span>
              </div>
            )}

            {!isSearching &&
              error && (
                <div
                  className={
                    styles.errorState
                  }
                  role="alert"
                >
                  <FileCheck2
                    size={24}
                  />

                  <div>
                    <strong>
                      Campaign Search
                      needs setup
                    </strong>

                    <p>
                      {error}
                    </p>
                  </div>
                </div>
              )}

            {!isSearching &&
              !error &&
              hasSearched && (
                <>
                  <section
                    className={
                      styles.answerCard
                    }
                  >
                    <div>
                      <Sparkles
                        size={20}
                      />
                    </div>

                    <div>
                      <span>
                        Campaign HQ
                        summary
                      </span>

                      <p>
                        {answer}
                      </p>
                    </div>
                  </section>

                  <div
                    className={
                      styles.resultsHeader
                    }
                  >
                    <strong>
                      {results.length}
                      {" "}
                      {results.length ===
                      1
                        ? "result"
                        : "results"}
                    </strong>

                    <span>
                      Open a result to
                      continue in its
                      module
                    </span>
                  </div>

                  <div
                    className={
                      styles.resultsList
                    }
                  >
                    {results.map(
                      (result) => {
                        const Icon =
                          getResultIcon(
                            result.result_type,
                          );

                        return (
                          <button
                            className={
                              styles.resultCard
                            }
                            type="button"
                            key={`${result.result_type}-${result.result_id}`}
                            onClick={() =>
                              openResult(
                                result,
                              )
                            }
                          >
                            <div
                              className={
                                styles.resultIcon
                              }
                            >
                              <Icon
                                size={
                                  19
                                }
                              />
                            </div>

                            <div
                              className={
                                styles.resultCopy
                              }
                            >
                              <div
                                className={
                                  styles.resultTitleRow
                                }
                              >
                                <span>
                                  {RESULT_LABELS[
                                    result
                                      .result_type
                                  ] ||
                                    result
                                      .result_type}
                                </span>

                                {result.status && (
                                  <em>
                                    {
                                      result.status
                                    }
                                  </em>
                                )}
                              </div>

                              <strong>
                                {
                                  result.title
                                }
                              </strong>

                              {result.subtitle && (
                                <small>
                                  {
                                    result.subtitle
                                  }
                                </small>
                              )}

                              {result.detail && (
                                <p>
                                  {
                                    result.detail
                                  }
                                </p>
                              )}
                            </div>

                            <div
                              className={
                                styles.resultMeta
                              }
                            >
                              {result.result_date && (
                                <time>
                                  {formatDate(
                                    result.result_date,
                                  )}
                                </time>
                              )}

                              <CheckCircle2
                                size={
                                  16
                                }
                              />
                            </div>
                          </button>
                        );
                      },
                    )}

                    {!results.length && (
                      <div
                        className={
                          styles.emptyState
                        }
                      >
                        <Search
                          size={31}
                        />

                        <h3>
                          No matching
                          records
                        </h3>

                        <p>
                          Try fewer words,
                          a person’s name
                          or a broader
                          campaign topic.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

            <footer
              className={
                styles.modalFooter
              }
            >
              <span>
                Searches the active
                workspace only
              </span>

              <span>
                File names and metadata
                are searchable; file
                contents come later
              </span>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}
