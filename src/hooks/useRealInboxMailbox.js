import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

const THREAD_PREFIX =
  "nylas-thread-";

const MAILBOX_PAGE_SIZE =
  20;

const MAILBOX_TARGET_THREAD_COUNT =
  50;

const MICROSOFT_MAILBOX_PAGE_SIZE =
  10;

const MICROSOFT_MAILBOX_TARGET_THREAD_COUNT =
  20;

const QUIET_REFRESH_INTERVAL_MS =
  30000;

const QUIET_REFRESH_COOLDOWN_MS =
  20000;

const RATE_LIMIT_BACKOFF_MS =
  180000;

const MAILBOX_REQUEST_TIMEOUT_MS =
  12000;

const SEND_REQUEST_TIMEOUT_MS =
  25000;


/*
 * CAMPAIGN SEAT FAST MAILBOX HYDRATION V1
 *
 * The newest message is already present in the thread-list
 * payload. Render that immediately, then hydrate the conversation
 * after first paint with one filtered provider request.
 */
const THREAD_HYDRATION_DELAY_MS =
  300;

async function withRequestTimeout(
  promise,
  timeoutMs,
  message,
) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,

      new Promise(
        (
          _resolve,
          reject,
        ) => {
          timeoutId =
            window.setTimeout(
              () => {
                reject(
                  new Error(
                    message,
                  ),
                );
              },
              timeoutMs,
            );
        },
      ),
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(
        timeoutId,
      );
    }
  }
}


function clean(value) {
  return String(
    value || "",
  ).trim();
}

async function edgeFunctionErrorMessage(
  error,
  fallback,
) {
  let providerMessage = "";

  if (
    error?.context instanceof
      Response
  ) {
    try {
      const payload =
        await error.context
          .clone()
          .json();

      providerMessage =
        clean(
          payload?.error ||
          payload?.message,
        );
    } catch {
      // Use the normal Supabase
      // function error below.
    }
  }

  return (
    providerMessage ||
    clean(error?.message) ||
    fallback
  );
}

function normalizedEmail(value) {
  return clean(value)
    .toLowerCase();
}

function stripHtml(value) {
  const text =
    clean(value);

  if (!text) {
    return "";
  }

  if (
    typeof window ===
      "undefined"
  ) {
    return clean(
      text
        .replace(
          /<(style|script|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi,
          " ",
        )
        .replace(
          /<br\s*\/?\s*>/gi,
          "\n",
        )
        .replace(
          /<\/(p|div|section|article|header|footer|li|tr|blockquote|h[1-6])>/gi,
          "\n",
        )
        .replace(
          /<[^>]*>/g,
          " ",
        )
        .replace(
          /[ \t]+/g,
          " ",
        )
        .replace(
          /\n[ \t]+/g,
          "\n",
        )
        .replace(
          /\n{3,}/g,
          "\n\n",
        ),
    );
  }

  const documentValue =
    new DOMParser()
      .parseFromString(
        text,
        "text/html",
      );

  documentValue
    .querySelectorAll(
      "style, script, noscript, template, head, meta, link, svg, canvas, iframe, object, embed",
    )
    .forEach(
      (element) =>
        element.remove(),
    );

  documentValue
    .querySelectorAll(
      "[hidden], [aria-hidden='true']",
    )
    .forEach(
      (element) =>
        element.remove(),
    );

  documentValue
    .querySelectorAll(
      "[style]",
    )
    .forEach(
      (element) => {
        const style =
          String(
            element.getAttribute(
              "style",
            ) || "",
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              "",
            );

        if (
          style.includes(
            "display:none",
          ) ||
          style.includes(
            "visibility:hidden",
          )
        ) {
          element.remove();
        }
      },
    );

  documentValue
    .querySelectorAll(
      "br",
    )
    .forEach(
      (element) =>
        element.replaceWith(
          "\n",
        ),
    );

  documentValue
    .querySelectorAll(
      "p, div, section, article, header, footer, li, tr, blockquote, h1, h2, h3, h4, h5, h6",
    )
    .forEach(
      (element) =>
        element.append(
          "\n",
        ),
    );

  documentValue
    .querySelectorAll(
      "img[alt]",
    )
    .forEach(
      (image) => {
        const alt =
          clean(
            image.getAttribute(
              "alt",
            ),
          );

        if (
          alt &&
          !image.parentElement
            ?.textContent
            ?.includes(
              alt,
            )
        ) {
          image.replaceWith(
            ` ${alt} `,
          );
        }
      },
    );

  return clean(
    String(
      documentValue
        .body
        .textContent || "",
    )
      .replace(
        /\u00a0/g,
        " ",
      )
      .replace(
        /[\u200B-\u200D\uFEFF]/g,
        "",
      )
      .replace(
        /\r/g,
        "",
      )
      .replace(
        /[ \t]+/g,
        " ",
      )
      .replace(
        / *\n */g,
        "\n",
      )
      .replace(
        /\n{3,}/g,
        "\n\n",
      ),
  );
}

function stripQuotedEmailHistory(
  value,
) {
  let text =
    clean(
      value,
    )
      .replace(
        /\r/g,
        "",
      )
      .trim();

  if (!text) {
    return "";
  }

  const patterns = [
    /\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i,

    /\nFrom:\s*[^\n]+\n(?:Sent|Date):\s*[^\n]+\nTo:\s*[^\n]+\nSubject:\s*[^\n]+[\s\S]*$/i,

    /\nOn\s.+?\swrote:\s*[\s\S]*$/i,

    /\n_{5,}[\s\S]*$/i,
  ];

  for (
    const pattern
    of patterns
  ) {
    const cleaned =
      text.replace(
        pattern,
        "",
      ).trim();

    if (
      cleaned !==
      text
    ) {
      text =
        cleaned;

      break;
    }
  }

  return text;
}


function initials(value) {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0] || "",
    )
    .join("")
    .toUpperCase() ||
    "EM";
}

function unixMilliseconds(value) {
  const numeric =
    Number(value || 0);

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return Date.now();
  }

  return numeric < 100000000000
    ? numeric * 1000
    : numeric;
}

function relativeTime(value) {
  const timestamp =
    unixMilliseconds(value);

  const difference =
    Date.now() -
    timestamp;

  if (difference < 60000) {
    return "Just now";
  }

  if (
    difference <
    60 * 60000
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
        60000,
      ),
    )}m`;
  }

  if (
    difference <
    24 * 60 * 60000
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
        (
          60 *
          60000
        ),
      ),
    )}h`;
  }

  return new Date(
    timestamp,
  ).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  );
}

function recipientList(value) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map((item) => {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return null;
      }

      const email =
        normalizedEmail(
          item.email,
        );

      if (!email) {
        return null;
      }

      return {
        email,
        name:
          clean(
            item.name,
          ),
      };
    })
    .filter(Boolean);
}

function externalParticipant({
  participants,
  latest,
  connectedEmail,
}) {
  const own =
    normalizedEmail(
      connectedEmail,
    );

  const candidates = [
    ...recipientList(
      latest?.from,
    ),
    ...recipientList(
      participants,
    ),
    ...recipientList(
      latest?.to,
    ),
    ...recipientList(
      latest?.cc,
    ),
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate.email !==
        own,
    ) ||
    candidates[0] ||
    {
      email: "",
      name: "Email contact",
    }
  );
}

function normalizeMessageAttachment({
  message,
  attachment,
}) {
  return {
    id:
      `nylas-attachment-${
        attachment.id
      }`,

    providerAttachmentId:
      attachment.id,

    providerMessageId:
      message.id,

    name:
      clean(
        attachment.filename,
      ) ||
      "Attachment",

    size:
      Number(
        attachment.size ||
        0,
      ),

    contentType:
      clean(
        attachment.content_type,
      ),

    contentId:
      clean(
        attachment.content_id,
      ),

    isInline:
      attachment.is_inline ===
      true,
  };
}


function messageAttachments(
  message,
) {
  if (
    !Array.isArray(
      message?.attachments,
    )
  ) {
    return [];
  }

  return message.attachments
    .filter(
      (attachment) =>
        attachment &&
        !attachment.is_inline,
    )
    .map(
      (attachment) =>
        normalizeMessageAttachment({
          message,
          attachment,
        }),
    );
}


function messageInlineAttachments(
  message,
) {
  if (
    !Array.isArray(
      message?.attachments,
    )
  ) {
    return [];
  }

  return message.attachments
    .filter(
      (attachment) =>
        attachment &&
        attachment.is_inline,
    )
    .map(
      (attachment) =>
        normalizeMessageAttachment({
          message,
          attachment,
        }),
    );
}


function transformMessage({
  message,
  connectedEmail,
}) {
  const own =
    normalizedEmail(
      connectedEmail,
    );

  const from =
    recipientList(
      message?.from,
    );

  const to =
    recipientList(
      message?.to,
    );

  const cc =
    recipientList(
      message?.cc,
    );

  const bcc =
    recipientList(
      message?.bcc,
    );

  const replyTo =
    recipientList(
      message?.reply_to ||
      message?.replyTo,
    );

  const sender =
    from[0] || {
      email: "",
      name: "Email contact",
    };

  const outbound =
    sender.email === own;

  const fullTextBody =
    stripHtml(
      message.body ||
      message.snippet,
    );

  const displayBody =
    stripQuotedEmailHistory(
      fullTextBody,
    );

  return {
    id:
      `nylas-message-${
        message.id
      }`,

    providerMessageId:
      message.id,

    providerThreadId:
      message.thread_id,

    folderIds:
      Array.isArray(
        message.folders,
      )
        ? message.folders
            .map(
              clean,
            )
            .filter(
              Boolean,
            )
        : [],

    unread:
      Boolean(
        message.unread,
      ),

    starred:
      Boolean(
        message.starred,
      ),

    direction:
      outbound
        ? "outbound"
        : "inbound",

    fromRecipients:
      from,

    toRecipients:
      to,

    ccRecipients:
      cc,

    bccRecipients:
      bcc,

    replyToRecipients:
      replyTo,

    author:
      outbound
        ? "You"
        : (
            sender.name ||
            sender.email ||
            "Email contact"
          ),

    initials:
      outbound
        ? "ME"
        : initials(
            sender.name ||
            sender.email,
          ),

    time:
      relativeTime(
        message.date ||
        message.created_at,
      ),

    order:
      unixMilliseconds(
        message.date ||
        message.created_at,
      ),

    channel:
      "Email",

    body:
      displayBody,

    quotedHistoryHidden:
      Boolean(
        fullTextBody &&
        displayBody &&
        fullTextBody !==
          displayBody,
      ),

    htmlBody:
      clean(
        message.body,
      ),

    inlineAttachments:
      messageInlineAttachments(
        message,
      ),

    subject:
      clean(
        message.subject,
      ),

    attachments:
      messageAttachments(
        message,
      ).map(
        (file) => ({
          ...file,

          source:
            "provider-attachment",

          sourceChannel:
            "Email",

          sourceDirection:
            outbound
              ? "outbound"
              : "inbound",

          sourceAuthor:
            outbound
              ? "You"
              : (
                  sender.name ||
                  sender.email ||
                  "Email contact"
                ),

          sourceTime:
            relativeTime(
              message.date ||
              message.created_at,
            ),

          sourceTimestamp:
            unixMilliseconds(
              message.date ||
              message.created_at,
            ),
        }),
      ),
  };
}

function transformThread({
  thread,
  connectedEmail,
}) {
  const latest =
    thread
      ?.latest_draft_or_message ||
    {};

  const person =
    externalParticipant({
      participants:
        thread?.participants,
      latest,
      connectedEmail,
    });

  const timestamp =
    thread
      ?.latest_draft_or_message
      ?.date ||
    thread
      ?.latest_message_received_date ||
    thread
      ?.latest_message_sent_date ||
    Date.now();

  const latestFrom =
    recipientList(
      latest?.from,
    )[0];

  const own =
    normalizedEmail(
      connectedEmail,
    );

  const needsResponse =
    Boolean(
      latestFrom?.email &&
      latestFrom.email !==
        own,
    );

  const latestReceivedOrder =
    thread
      ?.latest_message_received_date
      ? unixMilliseconds(
          thread
            .latest_message_received_date,
        )
      : 0;

  const latestSentOrder =
    thread
      ?.latest_message_sent_date
      ? unixMilliseconds(
          thread
            .latest_message_sent_date,
        )
      : 0;

  const latestCommunicationOrder =
    Math.max(
      latestReceivedOrder,
      latestSentOrder,
    );

  const latestCommunicationDirection =
    latestCommunicationOrder <=
      0
      ? (
          needsResponse
            ? "inbound"
            : ""
        )
      : latestReceivedOrder >=
          latestSentOrder
        ? "inbound"
        : "outbound";

  const initialMessages =
    latest?.id
      ? [
          transformMessage({
            message:
              latest,
            connectedEmail,
          }),
        ]
      : [];

  return {
    id:
      `${THREAD_PREFIX}${
        thread.id
      }`,

    providerThreadId:
      thread.id,

    latestProviderMessageId:
      clean(
        latest?.id,
      ),

    folderIds:
      Array.isArray(
        thread.folders,
      )
        ? thread.folders
            .map(
              clean,
            )
            .filter(
              Boolean,
            )
        : [],

    contactId:
      null,

    sender:
      person.name ||
      person.email ||
      "Email contact",

    initials:
      initials(
        person.name ||
        person.email,
      ),

    email:
      person.email || "",

    phone:
      "",

    channel:
      "email",

    subject:
      clean(
        thread.subject ||
        latest.subject,
      ) ||
      "(No subject)",

    preview:
      stripHtml(
        thread.snippet ||
        latest.snippet ||
        latest.body,
      )
        .slice(
          0,
          180,
        ),

    time:
      relativeTime(
        timestamp,
      ),

    order:
      unixMilliseconds(
        timestamp,
      ),

    unread:
      Boolean(
        thread.unread,
      ),

    unreadCount:
      thread.unread
        ? 1
        : 0,

    priority:
      Boolean(
        thread.starred,
      ),

    needsResponse,

    latestReceivedOrder,

    latestSentOrder,

    latestCommunicationOrder,

    latestCommunicationDirection,

    mentions:
      false,

    flagged:
      Boolean(
        thread.starred,
      ),

    archived:
      false,

    tags: [
      "Email",
    ],

    external:
      true,

    details: {
      organization:
        "Connected email",

      role:
        "Email contact",

      location:
        "",

      lastContact:
        relativeTime(
          timestamp,
        ),
    },

    messages:
      initialMessages,

    files:
      initialMessages
        .flatMap(
          (message) =>
            message.attachments ||
            [],
        ),

    mailboxHydrated:
      false,
  };
}

function findInboxFolder(
  folders,
) {
  if (
    !Array.isArray(
      folders,
    )
  ) {
    return null;
  }

  return (
    folders.find(
      (folder) => {
        const values = [
          folder?.id,
          folder?.name,
          folder?.display_name,
          folder?.system_folder,
        ]
          .map(
            (value) =>
              clean(value)
                .toLowerCase(),
          )
          .filter(Boolean);

        return values.some(
          (value) =>
            value ===
              "inbox" ||
            value.endsWith(
              "/inbox",
            ),
        );
      },
    ) ||
    null
  );
}

function mailboxCount(
  value,
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric,
    ) ||
    numeric < 0
  ) {
    return null;
  }

  return Math.floor(
    numeric,
  );
}

function publishInboxUnreadCount(
  workspaceId,
  count,
  {
    authoritativeForMs = 0,
  } = {},
) {
  if (
    typeof window ===
      "undefined" ||
    !workspaceId ||
    count ===
      null
  ) {
    return;
  }

  const safeCount =
    Math.max(
      0,
      Math.floor(
        Number(
          count,
        ) ||
        0,
      ),
    );

  try {
    window.localStorage
      .setItem(
        `campaign-seat:inbox-unread:${workspaceId}`,
        String(
          safeCount,
        ),
      );

    if (
      authoritativeForMs >
        0
    ) {
      window.localStorage
        .setItem(
          `campaign-seat:inbox-unread-authority:${workspaceId}`,
          String(
            Date.now() +
            authoritativeForMs,
          ),
        );
    }
  } catch {
    // Badge persistence is optional.
  }

  window.dispatchEvent(
    new CustomEvent(
      "campaign-seat-inbox-unread-count",
      {
        detail: {
          workspaceId,
          count:
            safeCount,
        },
      },
    ),
  );
}


function errorMessage(
  error,
  fallback,
) {
  return (
    error?.message ||
    fallback
  );
}

function mergeMailboxConversationState(
  existing,
  incoming,
) {
  if (!existing) {
    return incoming;
  }

  const preserveHydrated =
    existing
      .mailboxHydrated ===
    true;

  return {
    ...existing,
    ...incoming,

    messages:
      preserveHydrated &&
      Array.isArray(
        existing.messages,
      ) &&
      existing.messages.length
        ? existing.messages
        : incoming.messages,

    files:
      preserveHydrated &&
      Array.isArray(
        existing.files,
      )
        ? existing.files
        : incoming.files,

    mailboxHydrated:
      preserveHydrated ||
      incoming
        .mailboxHydrated ===
        true,
  };
}


export function useRealInboxMailbox({
  workspaceId,
  enabled,
  selectedConversationId,
  selectedFolderId = "",
}) {
  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    connectedEmail,
    setConnectedEmail,
  ] = useState("");

  const [
    accountProvider,
    setAccountProvider,
  ] = useState("");

  const [
    mailboxFolders,
    setMailboxFolders,
  ] = useState([]);

  const [
    inboxTotalCount,
    setInboxTotalCount,
  ] = useState(null);

  const [
    inboxUnreadCount,
    setInboxUnreadCount,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const loadingThreadsRef =
    useRef(
      new Set(),
    );

  const sendKeysRef =
    useRef(
      new Map(),
    );

  const refreshInFlightRef =
    useRef(
      false,
    );

  const lastQuietRefreshAtRef =
    useRef(
      0,
    );

  const rateLimitBackoffUntilRef =
    useRef(
      0,
    );

  const conversationsRef =
    useRef(
      [],
    );

  const connectedEmailRef =
    useRef(
      "",
    );

  const hasMailboxSnapshotRef =
    useRef(
      false,
    );

  useEffect(
    () => {
      conversationsRef.current =
        conversations;
    },
    [
      conversations,
    ],
  );

  useEffect(
    () => {
      connectedEmailRef.current =
        connectedEmail;
    },
    [
      connectedEmail,
    ],
  );

  const invokeMailbox =
    useCallback(
      async (
        requestBody,
      ) => {
        const {
          data,
          error:
            invokeError,
        } =
          await withRequestTimeout(
            supabase
              .functions
              .invoke(
                "nylas-mailbox",
                {
                  body: {
                    workspaceId,
                    ...requestBody,
                  },
                },
              ),

            MAILBOX_REQUEST_TIMEOUT_MS,

            "The connected mailbox took too long to respond. Campaign Seat kept the email already loaded and will retry.",
          );

        if (
          invokeError
        ) {
          throw new Error(
            await edgeFunctionErrorMessage(
              invokeError,
              "Campaign Seat could not reach the connected mailbox.",
            ),
          );
        }

        if (
          data?.success !==
          true
        ) {
          throw new Error(
            data?.error ||
            "Campaign Seat could not load the connected mailbox.",
          );
        }

        return data;
      },
      [
        workspaceId,
      ],
    );

  const refresh =
    useCallback(
      async ({
        showLoading = true,
      } = {}) => {
        if (
          !enabled ||
          !workspaceId
        ) {
          setConversations(
            [],
          );

          setMailboxFolders(
            [],
          );

          setInboxTotalCount(
            null,
          );

          setInboxUnreadCount(
            null,
          );

          setError(
            "",
          );

          return [];
        }

        const deepRefresh =
          !hasMailboxSnapshotRef
            .current;

        const shouldShowLoading =
          showLoading &&
          deepRefresh;

        if (
          shouldShowLoading
        ) {
          setIsLoading(
            true,
          );
        }

        refreshInFlightRef.current =
          true;

        try {
          let folders =
            [];

          let inboxId =
            "";

          let refreshProvider =
            "";

          try {
            const folderResult =
              await invokeMailbox({
                action:
                  "list_folders",
              });

            folders =
              Array.isArray(
                folderResult.data,
              )
                ? folderResult.data
                : [];

            setMailboxFolders(
              folders,
            );

            const inboxFolder =
              findInboxFolder(
                folders,
              );

            inboxId =
              clean(
                inboxFolder?.id,
              );

            setInboxTotalCount(
              mailboxCount(
                inboxFolder
                  ?.total_count,
              ),
            );

            const nextInboxUnreadCount =
              mailboxCount(
                inboxFolder
                  ?.unread_count,
              );

            setInboxUnreadCount(
              nextInboxUnreadCount,
            );

            publishInboxUnreadCount(
              workspaceId,
              nextInboxUnreadCount,
            );

            if (
              folderResult
                .connectedEmail
            ) {
              setConnectedEmail(
                folderResult
                  .connectedEmail,
              );
            }

            if (
              folderResult
                .accountProvider
            ) {
              setAccountProvider(
                folderResult
                  .accountProvider,
              );

              refreshProvider =
                clean(
                  folderResult
                    .accountProvider,
                )
                  .toLowerCase();
            }
          } catch {
            // A thread request below
            // remains authoritative.
          }

          const pageSize =
            refreshProvider ===
              "microsoft"
              ? MICROSOFT_MAILBOX_PAGE_SIZE
              : MAILBOX_PAGE_SIZE;

          const targetThreadCount =
            refreshProvider ===
              "microsoft"
              ? (
                  deepRefresh
                    ? MICROSOFT_MAILBOX_TARGET_THREAD_COUNT
                    : MICROSOFT_MAILBOX_PAGE_SIZE
                )
              : (
                  deepRefresh
                    ? MAILBOX_TARGET_THREAD_COUNT
                    : MAILBOX_PAGE_SIZE
                );

          const requestedFolderId =
            clean(
              selectedFolderId,
            );

          const targetFolderId =
            requestedFolderId ||
            inboxId;

          let threadResult =
            null;

          let pageToken =
            "";

          const threadRows =
            [];

          const seenThreadIds =
            new Set();

          while (
            threadRows.length <
              targetThreadCount
          ) {
            const pageResult =
              await invokeMailbox({
                action:
                  "list_threads",

                limit:
                  pageSize,

                ...(targetFolderId
                  ? {
                      folderId:
                        targetFolderId,
                    }
                  : {}),

                ...(pageToken
                  ? {
                      pageToken,
                    }
                  : {}),
              });

            if (!threadResult) {
              threadResult =
                pageResult;
            }

            const pageRows =
              Array.isArray(
                pageResult.data,
              )
                ? pageResult.data
                : [];

            for (
              const thread
              of pageRows
            ) {
              const providerId =
                clean(
                  thread?.id,
                );

              if (
                providerId &&
                seenThreadIds.has(
                  providerId,
                )
              ) {
                continue;
              }

              if (providerId) {
                seenThreadIds.add(
                  providerId,
                );
              }

              threadRows.push(
                thread,
              );

              if (
                threadRows.length >=
                  targetThreadCount
              ) {
                break;
              }
            }

            if (
              deepRefresh &&
              threadRows.length
            ) {
              const progressiveMailboxEmail =
                clean(
                  pageResult
                    .connectedEmail,
                ) ||
                connectedEmailRef
                  .current;

              const progressive =
                threadRows
                  .slice(
                    0,
                    targetThreadCount,
                  )
                  .map(
                    (thread) =>
                      transformThread({
                        thread,
                        connectedEmail:
                          progressiveMailboxEmail,
                      }),
                  )
                  .sort(
                    (
                      left,
                      right,
                    ) =>
                      right.order -
                      left.order,
                  );

              setConversations(
                (current) => {
                  const existingById =
                    new Map(
                      current.map(
                        (
                          conversation,
                        ) => [
                          conversation.id,
                          conversation,
                        ],
                      ),
                    );

                  return progressive.map(
                    (
                      conversation,
                    ) =>
                      mergeMailboxConversationState(
                        existingById.get(
                          conversation.id,
                        ),
                        conversation,
                      ),
                  );
                },
              );

              hasMailboxSnapshotRef.current =
                true;

              setIsLoading(
                false,
              );
            }


            const nextCursor =
              clean(
                pageResult
                  .nextCursor,
              );

            if (
              !nextCursor ||
              pageRows.length === 0
            ) {
              break;
            }

            pageToken =
              nextCursor;
          }

          threadResult =
            threadResult ||
            {};

          const mailboxEmail =
            clean(
              threadResult
                .connectedEmail,
            );

          if (
            mailboxEmail
          ) {
            setConnectedEmail(
              mailboxEmail,
            );
          }

          if (
            threadResult
              .accountProvider
          ) {
            setAccountProvider(
              threadResult
                .accountProvider,
            );
          }

          const next =
            threadRows
              .slice(
                0,
                targetThreadCount,
              )
              .map(
                (thread) => {
                  const transformed =
                    transformThread({
                      thread,
                      connectedEmail:
                        mailboxEmail ||
                        connectedEmailRef
                          .current,
                    });
return transformed;
                },
              )
              .sort(
                (
                  left,
                  right,
                ) =>
                  right.order -
                  left.order,
              );

          setConversations(
            (current) => {
              const existingById =
                new Map(
                  current.map(
                    (
                      conversation,
                    ) => [
                      conversation.id,
                      conversation,
                    ],
                  ),
                );

              if (
                deepRefresh
              ) {
                return next
                  .map(
                    (
                      conversation,
                    ) =>
                      mergeMailboxConversationState(
                        existingById.get(
                          conversation.id,
                        ),
                        conversation,
                      ),
                  )
                  .sort(
                    (
                      left,
                      right,
                    ) =>
                      right.order -
                      left.order,
                  );
              }

              const merged =
                new Map(
                  current.map(
                    (
                      conversation,
                    ) => [
                      conversation.id,
                      conversation,
                    ],
                  ),
                );

              next.forEach(
                (
                  conversation,
                ) => {
                  merged.set(
                    conversation.id,
                    mergeMailboxConversationState(
                      merged.get(
                        conversation.id,
                      ),
                      conversation,
                    ),
                  );
                },
              );

              return [
                ...merged.values(),
              ].sort(
                (
                  left,
                  right,
                ) =>
                  right.order -
                  left.order,
              );
            },
          );

          hasMailboxSnapshotRef.current =
            true;

          rateLimitBackoffUntilRef.current =
            0;

          setError(
            "",
          );

          setLastUpdated(
            new Date(),
          );

          return next;
        } catch (
          loadError
        ) {
          const nextError =
            errorMessage(
              loadError,
              "Campaign Seat could not load the connected mailbox.",
            );

          if (
            /rate limit/i.test(
              nextError,
            )
          ) {
            rateLimitBackoffUntilRef.current =
              Date.now() +
              RATE_LIMIT_BACKOFF_MS;
          }

          setError(
            nextError,
          );

          return [];
        } finally {
          refreshInFlightRef.current =
            false;

          setIsLoading(
            false,
          );
        }
      },
      [
        enabled,
        invokeMailbox,
        selectedFolderId,
        workspaceId,
      ],
    );

  const updateMessage =
    useCallback(
      async (
        messageId,
        updates,
      ) => {
        const providerMessageId =
          clean(
            messageId,
          ).replace(
            "nylas-message-",
            "",
          );

        if (
          !enabled ||
          !providerMessageId
        ) {
          return null;
        }


        return invokeMailbox({
          action:
            "update_message",

          messageId:
            providerMessageId,

          ...updates,
        });
      },
      [
        enabled,
        invokeMailbox,
      ],
    );


  const updateThread =
    useCallback(
      async (
        threadIdOrConversationId,
        updates,
        {
          refreshAfter =
            false,
        } = {},
      ) => {
        const providerThreadId =
          clean(
            threadIdOrConversationId,
          ).replace(
            THREAD_PREFIX,
            "",
          );

        if (
          !enabled ||
          !providerThreadId
        ) {
          return null;
        }


        const result =
          await invokeMailbox({
            action:
              "update_thread",

            threadId:
              providerThreadId,

            ...updates,
          });


        if (refreshAfter) {
          await refresh({
            showLoading:
              false,
          });
        }


        return result;
      },
      [
        enabled,
        invokeMailbox,
        refresh,
      ],
    );


  const markThreadRead =
    useCallback(
      async (
        threadIdOrConversationId,
      ) => {
        const providerThreadId =
          clean(
            threadIdOrConversationId,
          ).replace(
            THREAD_PREFIX,
            "",
          );

        if (
          !enabled ||
          !providerThreadId
        ) {
          return null;
        }


        let wasUnread =
          false;


        setConversations(
          (current) =>
            current.map(
              (conversation) => {
                if (
                  conversation
                    .providerThreadId !==
                  providerThreadId
                ) {
                  return conversation;
                }

                wasUnread =
                  Boolean(
                    conversation
                      .unread,
                  );

                return {
                  ...conversation,

                  unread:
                    false,

                  unreadCount:
                    0,
                };
              },
            ),
        );


        if (wasUnread) {
          setInboxUnreadCount(
            (current) => {
              const next =
                Number.isFinite(
                  current,
                )
                  ? Math.max(
                      0,
                      current - 1,
                    )
                  : current;

              if (
                Number.isFinite(
                  next,
                )
              ) {
                publishInboxUnreadCount(
                  workspaceId,
                  next,
                  {
                    authoritativeForMs:
                      20000,
                  },
                );
              }

              return next;
            },
          );
        }


        try {
          const result =
            await updateThread(
              providerThreadId,
              {
                unread:
                  false,
              },
            );

          setError("");

          return result;
        } catch (
          updateError
        ) {
          /*
           * Provider truth wins.
           * Reload instead of leaving a false local read state.
           */
          await refresh({
            showLoading:
              false,
          });

          const message =
            errorMessage(
              updateError,
              "Campaign Seat could not mark this email read in the connected mailbox.",
            );

          setError(
            message,
          );

          throw new Error(
            message,
            {
              cause:
                updateError,
            },
          );
        }
      },
      [
        enabled,
        refresh,
        updateThread,
        workspaceId,
      ],
    );


  const markThreadUnread =
    useCallback(
      async (
        threadIdOrConversationId,
      ) => {
        const result =
          await updateThread(
            threadIdOrConversationId,
            {
              unread:
                true,
            },
            {
              refreshAfter:
                true,
            },
          );

        return result;
      },
      [
        updateThread,
      ],
    );


  const setThreadStarred =
    useCallback(
      async (
        threadIdOrConversationId,
        starred,
      ) => {
        return updateThread(
          threadIdOrConversationId,
          {
            starred:
              Boolean(
                starred,
              ),
          },
          {
            refreshAfter:
              true,
          },
        );
      },
      [
        updateThread,
      ],
    );


  const setThreadFolders =
    useCallback(
      async (
        threadIdOrConversationId,
        folders,
      ) => {
        return updateThread(
          threadIdOrConversationId,
          {
            folders:
              Array.from(
                new Set(
                  (
                    Array.isArray(
                      folders,
                    )
                      ? folders
                      : []
                  )
                    .map(
                      clean,
                    )
                    .filter(
                      Boolean,
                    ),
                ),
              ),
          },
          {
            refreshAfter:
              true,
          },
        );
      },
      [
        updateThread,
      ],
    );


  const emptyTrashBatch =
    useCallback(
      async (
        folderId,
      ) => {
        const providerFolderId =
          clean(
            folderId,
          );

        if (
          !enabled ||
          !providerFolderId
        ) {
          return {
            deleted:
              0,

            complete:
              true,
          };
        }


        return invokeMailbox({
          action:
            "empty_trash_batch",

          folderId:
            providerFolderId,

          confirmation:
            "PERMANENTLY_EMPTY_TRASH",
        });
      },
      [
        enabled,
        invokeMailbox,
      ],
    );


  const trashThread =
    useCallback(
      async (
        threadIdOrConversationId,
      ) => {
        const providerThreadId =
          clean(
            threadIdOrConversationId,
          ).replace(
            THREAD_PREFIX,
            "",
          );

        if (
          !enabled ||
          !providerThreadId
        ) {
          return null;
        }


        const result =
          await invokeMailbox({
            action:
              "delete_thread",

            threadId:
              providerThreadId,
          });


        await refresh({
          showLoading:
            false,
        });


        return result;
      },
      [
        enabled,
        invokeMailbox,
        refresh,
      ],
    );


  const createFolder =
    useCallback(
      async ({
        name,
        parentId = "",
      }) => {
        const result =
          await invokeMailbox({
            action:
              "create_folder",

            name,

            parentId,
          });


        await refresh({
          showLoading:
            false,
        });


        return result;
      },
      [
        invokeMailbox,
        refresh,
      ],
    );


  const renameFolder =
    useCallback(
      async ({
        folderId,
        name,
        parentId = "",
      }) => {
        const result =
          await invokeMailbox({
            action:
              "update_folder",

            folderId,

            name,

            parentId,
          });


        await refresh({
          showLoading:
            false,
        });


        return result;
      },
      [
        invokeMailbox,
        refresh,
      ],
    );


  const deleteFolder =
    useCallback(
      async (
        folderId,
      ) => {
        const result =
          await invokeMailbox({
            action:
              "delete_folder",

            folderId,
          });


        await refresh({
          showLoading:
            false,
        });


        return result;
      },
      [
        invokeMailbox,
        refresh,
      ],
    );


  const loadThread =
    useCallback(
      async (
        threadIdOrConversationId,
      ) => {
        const providerThreadId =
          clean(
            threadIdOrConversationId,
          ).replace(
            THREAD_PREFIX,
            "",
          );

        if (
          !enabled ||
          !providerThreadId
        ) {
          return null;
        }

        if (
          loadingThreadsRef
            .current
            .has(
              providerThreadId,
            )
        ) {
          return (
            conversationsRef
              .current
              .find(
                (item) =>
                  item
                    .providerThreadId ===
                  providerThreadId,
              ) ||
            null
          );
        }

        loadingThreadsRef
          .current
          .add(
            providerThreadId,
          );

        try {
          /*
           * CAMPAIGN SEAT SINGLE-REQUEST THREAD HYDRATION V2
           *
           * Nylas can return the messages for one conversation
           * directly with thread_id. Do that once instead of
           * requesting each message independently.
           */
          const messageResult =
            await invokeMailbox({
              action:
                "list_thread_messages",

              threadId:
                providerThreadId,
            });

          const messages =
            (
              Array.isArray(
                messageResult.data,
              )
                ? messageResult.data
                : []
            )
              .map(
                (message) =>
                  transformMessage({
                    message,

                    connectedEmail:
                      connectedEmailRef
                        .current ||
                      messageResult
                        .connectedEmail,
                  }),
              )
              .sort(
                (
                  left,
                  right,
                ) =>
                  right.order -
                  left.order,
              );

          const files =
            messages.flatMap(
              (message) =>
                message.attachments ||
                [],
            );

          let hydrated =
            null;

          setConversations(
            (current) =>
              current.map(
                (conversation) => {
                  if (
                    conversation
                      .providerThreadId !==
                    providerThreadId
                  ) {
                    return conversation;
                  }

                  hydrated = {
                    ...conversation,
                    messages:
                      messages.length
                        ? messages
                        : conversation.messages,

                    files,

                    mailboxHydrated:
                      true,
                  };

                  return hydrated;
                },
              ),
          );

          return hydrated;
        } finally {
          loadingThreadsRef
            .current
            .delete(
              providerThreadId,
            );
        }
      },
      [
        enabled,
        invokeMailbox,
      ],
    );


  const moveThreadMessages =
    useCallback(
      async ({
        threadIdOrConversationId,
        fromFolderId,
        targetFolderId = "",
      }) => {
        const providerThreadId =
          clean(
            threadIdOrConversationId,
          ).replace(
            THREAD_PREFIX,
            "",
          );

        const sourceFolderId =
          clean(
            fromFolderId,
          );

        const destinationFolderId =
          clean(
            targetFolderId,
          );


        if (
          !enabled ||
          !providerThreadId ||
          !sourceFolderId
        ) {
          return {
            updated:
              0,
          };
        }


        const hydrated =
          await loadThread(
            providerThreadId,
          );


        const messages =
          Array.isArray(
            hydrated?.messages,
          )
            ? hydrated.messages
            : [];


        const matchingMessages =
          messages.filter(
            (message) =>
              message
                ?.providerMessageId &&
              Array.isArray(
                message.folderIds,
              ) &&
              message.folderIds.includes(
                sourceFolderId,
              ),
          );


        if (
          !matchingMessages.length
        ) {
          await refresh({
            showLoading:
              false,
          });

          return {
            updated:
              0,
          };
        }


        let updated =
          0;


        for (
          const message
          of matchingMessages
        ) {
          let nextFolders;


          if (
            accountProvider ===
            "microsoft"
          ) {
            if (
              !destinationFolderId
            ) {
              throw new Error(
                "Microsoft requires a destination folder.",
              );
            }

            nextFolders = [
              destinationFolderId,
            ];
          } else {
            nextFolders =
              Array.from(
                new Set(
                  (
                    message
                      .folderIds ||
                    []
                  )
                    .filter(
                      (folderId) =>
                        folderId !==
                        sourceFolderId,
                    )
                    .concat(
                      destinationFolderId
                        ? [
                            destinationFolderId,
                          ]
                        : [],
                    ),
                ),
              );
          }


          const currentFolders =
            Array.from(
              new Set(
                message
                  .folderIds ||
                [],
              ),
            );


          if (
            JSON.stringify(
              currentFolders,
            ) ===
            JSON.stringify(
              nextFolders,
            )
          ) {
            continue;
          }


          await updateMessage(
            message
              .providerMessageId,
            {
              folders:
                nextFolders,
            },
          );

          updated +=
            1;
        }


        await refresh({
          showLoading:
            false,
        });


        return {
          updated,
        };
      },
      [
        accountProvider,
        enabled,
        loadThread,
        refresh,
        updateMessage,
      ],
    );


  const archiveThreadMessages =
    useCallback(
      async (
        threadIdOrConversationId,
        {
          inboxFolderId,
          archiveFolderId = "",
        },
      ) => {
        const inboxId =
          clean(
            inboxFolderId,
          );

        const archiveId =
          clean(
            archiveFolderId,
          );


        if (!inboxId) {
          throw new Error(
            "Campaign Seat could not identify the provider Inbox folder.",
          );
        }


        if (
          accountProvider ===
            "microsoft" &&
          !archiveId
        ) {
          throw new Error(
            "Campaign Seat could not identify the Microsoft Archive folder.",
          );
        }


        return moveThreadMessages({
          threadIdOrConversationId,
          fromFolderId:
            inboxId,

          targetFolderId:
            accountProvider ===
              "microsoft"
              ? archiveId
              : "",
        });
      },
      [
        accountProvider,
        moveThreadMessages,
      ],
    );



  useEffect(() => {
    if (
      !enabled ||
      !workspaceId
    ) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          refresh();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    enabled,
    refresh,
    workspaceId,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !workspaceId
    ) {
      return undefined;
    }

    const refreshQuietly =
      () => {
        if (
          document.visibilityState !==
            "visible" ||
          refreshInFlightRef.current
        ) {
          return;
        }

        const now =
          Date.now();

        if (
          now <
          rateLimitBackoffUntilRef.current
        ) {
          return;
        }

        if (
          now -
            lastQuietRefreshAtRef.current <
          QUIET_REFRESH_COOLDOWN_MS
        ) {
          return;
        }

        lastQuietRefreshAtRef.current =
          now;

        void refresh({
          showLoading:
            false,
        });
      };

    const intervalId =
      window.setInterval(
        refreshQuietly,
        QUIET_REFRESH_INTERVAL_MS,
      );

    const handleFocus =
      () => {
        refreshQuietly();
      };

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
            "visible"
        ) {
          refreshQuietly();
        }
      };

    window.addEventListener(
      "focus",
      handleFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [
    enabled,
    refresh,
    workspaceId,
  ]);

  useEffect(
    () => {
      if (
        !enabled ||
        !workspaceId
      ) {
        return undefined;
      }

      let timerId;

      const handleProviderChange =
        (
          event,
        ) => {
          if (
            event?.detail
              ?.workspaceId !==
            workspaceId ||
            document
              .visibilityState ===
              "hidden"
          ) {
            return;
          }

          if (
            rateLimitBackoffUntilRef
              .current >
            Date.now()
          ) {
            return;
          }

          window.clearTimeout(
            timerId,
          );

          timerId =
            window.setTimeout(
              () => {
                if (
                  refreshInFlightRef
                    .current
                ) {
                  return;
                }

                lastQuietRefreshAtRef.current =
                  Date.now();

                void refresh({
                  showLoading:
                    false,
                });
              },
              250,
            );
        };

      window.addEventListener(
        "campaign-seat-email-provider-change",
        handleProviderChange,
      );

      return () => {
        window.clearTimeout(
          timerId,
        );

        window.removeEventListener(
          "campaign-seat-email-provider-change",
          handleProviderChange,
        );
      };
    },
    [
      enabled,
      refresh,
      workspaceId,
    ],
  );


  const selectedLatestProviderMessageId =
    conversations.find(
      (
        conversation,
      ) =>
        conversation.id ===
        selectedConversationId,
    )
      ?.latestProviderMessageId ||
    "";


  useEffect(() => {
    if (
      !enabled ||
      !selectedConversationId
        ?.startsWith(
          THREAD_PREFIX,
        )
    ) {
      return undefined;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          loadThread(
            selectedConversationId,
          );
        },
        THREAD_HYDRATION_DELAY_MS,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    enabled,
    loadThread,
    selectedConversationId,
    selectedLatestProviderMessageId,
  ]);

  const invokeSend =
    useCallback(
      async (
        payload,
      ) => {
        const attachments =
          Array.isArray(
            payload?.attachments,
          )
            ? payload.attachments.filter(
                (attachment) =>
                  typeof File !==
                    "undefined" &&
                  attachment instanceof File,
              )
            : [];

        const requestPayload = {
          ...payload,
        };

        delete requestPayload
          .attachments;

        const fingerprint =
          JSON.stringify({
            payload:
              requestPayload,

            attachments:
              attachments.map(
                (file) => ({
                  name:
                    file.name,
                  size:
                    file.size,
                  type:
                    file.type,
                  lastModified:
                    file.lastModified,
                }),
              ),
          });

        let idempotencyKey =
          sendKeysRef
            .current
            .get(
              fingerprint,
            );

        if (
          !idempotencyKey
        ) {
          idempotencyKey =
            crypto.randomUUID();

          sendKeysRef
            .current
            .set(
              fingerprint,
              idempotencyKey,
            );
        }

        let functionBody;

        if (
          attachments.length
        ) {
          const formData =
            new FormData();

          formData.append(
            "payload",
            JSON.stringify({
              workspaceId,
              ...requestPayload,
              idempotencyKey,
            }),
          );

          attachments.forEach(
            (file) => {
              formData.append(
                "attachment",
                file,
                file.name,
              );
            },
          );

          functionBody =
            formData;
        } else {
          functionBody = {
            workspaceId,
            ...requestPayload,
            idempotencyKey,
          };
        }

        const {
          data,
          error:
            invokeError,
        } =
          await withRequestTimeout(
            supabase
              .functions
              .invoke(
                "nylas-send",
                {
                  body:
                    functionBody,
                },
              ),

            SEND_REQUEST_TIMEOUT_MS,

            "Campaign Seat could not confirm this email send within 25 seconds. The same send identifier is preserved so retrying the exact message remains protected from intentional duplication.",
          );

        if (
          invokeError
        ) {
          throw new Error(
            await edgeFunctionErrorMessage(
              invokeError,
              "Campaign Seat could not send this email.",
            ),
          );
        }

        if (
          data?.success !==
          true
        ) {
          throw new Error(
            data?.error ||
            "Campaign Seat could not send this email.",
          );
        }

        sendKeysRef
          .current
          .delete(
            fingerprint,
          );

        return data;
      },
      [
        workspaceId,
      ],
    );

  const sendEmail =
    useCallback(
      async ({
        to,
        cc = [],
        bcc = [],
        subject,
        body,
        attachments = [],
      }) =>
        invokeSend({
          mode:
            "compose",

          to,
          cc,
          bcc,
          subject,
          body,
          attachments,
        }),
      [
        invokeSend,
      ],
    );

  const replyEmail =
    useCallback(
      async ({
        replyToMessageId,
        subject,
        body,
        replyAll = false,
        attachments = [],
      }) =>
        invokeSend({
          mode:
            "reply",

          replyToMessageId,
          subject,
          body,
          replyAll,
          attachments,
        }),
      [
        invokeSend,
      ],
    );

  const getAttachmentBlob =
    useCallback(
      async ({
        providerAttachmentId,
        providerMessageId,
        contentType,
      }) => {
        const {
          data,
          error:
            invokeError,
        } =
          await supabase
            .functions
            .invoke(
              "nylas-mailbox",
              {
                body: {
                  workspaceId,

                  action:
                    "download_attachment",

                  attachmentId:
                    providerAttachmentId,

                  messageId:
                    providerMessageId,
                },
              },
            );

        if (
          invokeError
        ) {
          throw new Error(
            await edgeFunctionErrorMessage(
              invokeError,
              "Campaign Seat could not load this attachment.",
            ),
          );
        }

        let blob;

        if (
          data instanceof
            Blob
        ) {
          blob =
            data;
        } else if (
          data instanceof
            ArrayBuffer
        ) {
          blob =
            new Blob([
              data,
            ]);
        } else if (
          ArrayBuffer.isView(
            data,
          )
        ) {
          blob =
            new Blob([
              data.buffer,
            ]);
        } else {
          throw new Error(
            "The attachment response was not returned as binary data.",
          );
        }

        if (
          !blob.size
        ) {
          throw new Error(
            "The attachment downloaded from the email provider was empty.",
          );
        }

        const preferredType =
          clean(
            contentType,
          );

        if (
          preferredType &&
          blob.type !==
            preferredType
        ) {
          blob =
            new Blob(
              [
                await blob
                  .arrayBuffer(),
              ],
              {
                type:
                  preferredType,
              },
            );
        }

        return blob;
      },
      [
        workspaceId,
      ],
    );


  const downloadAttachment =
    useCallback(
      async (file) => {
        const blob =
          await getAttachmentBlob(
            file,
          );

        const objectUrl =
          URL.createObjectURL(
            blob,
          );

        const anchor =
          document.createElement(
            "a",
          );

        anchor.href =
          objectUrl;

        anchor.download =
          clean(
            file?.name,
          ) ||
          "attachment";

        document.body
          .appendChild(
            anchor,
          );

        anchor.click();
        anchor.remove();

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              objectUrl,
            ),
          1000,
        );
      },
      [
        getAttachmentBlob,
      ],
    );


  return {
    conversations,
    connectedEmail,
    accountProvider,
    folders:
      mailboxFolders,
    inboxTotalCount,
    inboxUnreadCount,
    isLoading,
    error,
    lastUpdated,

    refresh,
    loadThread,
    markThreadRead,
    markThreadUnread,
    setThreadStarred,
    setThreadFolders,
    moveThreadMessages,
    archiveThreadMessages,
    trashThread,
    emptyTrashBatch,
    createFolder,
    renameFolder,
    deleteFolder,
    sendEmail,
    replyEmail,
    getAttachmentBlob,
    downloadAttachment,
  };
}
