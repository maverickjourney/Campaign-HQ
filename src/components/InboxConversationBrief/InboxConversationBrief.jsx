import {
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  ChevronDown,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import {
  useInboxConversationBrief,
} from "../../hooks/useInboxConversationBrief";

import styles from "./InboxConversationBrief.module.css";


function urgencyLabel(
  value,
) {
  const key =
    String(
      value ||
      "normal",
    ).toLowerCase();

  return key
    .charAt(0)
    .toUpperCase() +
    key.slice(1);
}


export function InboxConversationBrief({
  workspaceId,
  conversationKey,
  conversation,
  contact,
  workflow,
  onUseDraft,
}) {
  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const {
    briefsByKey,
    loadingKey,
    errorsByKey,
    generateBrief,
  } =
    useInboxConversationBrief({
      workspaceId,
    });

  const brief =
    briefsByKey[
      conversationKey
    ] ||
    null;

  const loading =
    loadingKey ===
    conversationKey;

  const error =
    errorsByKey[
      conversationKey
    ] ||
    "";


  useEffect(
    () => {
      setExpanded(
        false,
      );
    },
    [
      conversationKey,
    ],
  );


  const runBrief =
    async () => {
      setExpanded(
        true,
      );

      await generateBrief({
        conversationKey,
        conversation,
        contact,
        workflow,
      });
    };


  return (
    <section
      className={
        styles.brief
      }
      data-expanded={
        expanded
          ? "true"
          : "false"
      }
      aria-label="Campaign Seat Brief"
    >
      <header
        className={
          styles.header
        }
      >
        <span
          className={
            styles.icon
          }
        >
          <Sparkles
            size={18}
          />
        </span>

        <div
          className={
            styles.headerCopy
          }
        >
          <small>
            Campaign Seat AI
          </small>

          <strong>
            Campaign Seat Brief
          </strong>

          <p>
            {brief
              ? brief.summary
              : "Summarize the conversation, identify the request and prepare the next action."}
          </p>
        </div>

        {brief ? (
          <span
            className={
              styles[
                `urgency${urgencyLabel(
                  brief.urgency,
                )}`
              ] ||
              styles.urgencyNormal
            }
          >
            {urgencyLabel(
              brief.urgency,
            )}
          </span>
        ) : null}

        <div
          className={
            styles.headerActions
          }
        >
          {!brief ? (
            <button
              type="button"
              disabled={
                loading
              }
              onClick={() =>
                void runBrief()
              }
            >
              {loading ? (
                <RefreshCw
                  size={15}
                  className={
                    styles.spinner
                  }
                />
              ) : (
                <Sparkles
                  size={15}
                />
              )}

              {loading
                ? "Generating…"
                : "Generate Brief"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  void runBrief()
                }
              >
                <RefreshCw
                  size={15}
                  className={
                    loading
                      ? styles.spinner
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                className={
                  styles.expandButton
                }
                type="button"
                aria-expanded={
                  expanded
                }
                aria-label={
                  expanded
                    ? "Collapse Campaign Seat Brief"
                    : "Expand Campaign Seat Brief"
                }
                onClick={() =>
                  setExpanded(
                    (current) =>
                      !current,
                  )
                }
              >
                <ChevronDown
                  size={17}
                />
              </button>
            </>
          )}
        </div>
      </header>

      {expanded ? (
        <div
          className={
            styles.body
          }
        >
          {loading &&
          !brief ? (
            <div
              className={
                styles.loading
              }
            >
              <RefreshCw
                size={18}
                className={
                  styles.spinner
                }
              />

              Reviewing this conversation…
            </div>
          ) : null}

          {error ? (
            <div
              className={
                styles.error
              }
              role="alert"
            >
              <AlertCircle
                size={18}
              />

              <div>
                <strong>
                  Brief unavailable
                </strong>

                <p>
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {brief ? (
            <>
              <div
                className={
                  styles.grid
                }
              >
                <article>
                  <small>
                    Summary
                  </small>

                  <p>
                    {
                      brief.summary
                    }
                  </p>
                </article>

                <article>
                  <small>
                    What they need
                  </small>

                  <p>
                    {
                      brief.request
                    }
                  </p>
                </article>

                <article>
                  <small>
                    Last commitment
                  </small>

                  <p>
                    {
                      brief.last_commitment
                    }
                  </p>
                </article>

                <article>
                  <small>
                    Recommended next action
                  </small>

                  <p>
                    {
                      brief.recommended_action
                    }
                  </p>
                </article>
              </div>

              <section
                className={
                  styles.draft
                }
              >
                <header>
                  <div>
                    <MessageSquare
                      size={17}
                    />

                    <strong>
                      Draft Reply
                    </strong>
                  </div>

                  {brief.draft_reply ? (
                    <button
                      type="button"
                      onClick={() =>
                        onUseDraft?.(
                          brief.draft_reply,
                        )
                      }
                    >
                      Use Draft Reply
                    </button>
                  ) : null}
                </header>

                {brief.draft_reply ? (
                  <p>
                    {
                      brief.draft_reply
                    }
                  </p>
                ) : (
                  <div
                    className={
                      styles.blockedDraft
                    }
                  >
                    <AlertCircle
                      size={17}
                    />

                    <span>
                      {
                        brief
                          .draft_blocked_reason ||
                        "A draft reply requires manual campaign review."
                      }
                    </span>
                  </div>
                )}
              </section>

              <p
                className={
                  styles.disclaimer
                }
              >
                AI-generated briefing. Review the conversation before acting. Draft Reply never sends automatically.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
