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
    .map((attachment) => ({
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
    }));
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

  const sender =
    from[0] || {
      email: "",
      name: "Email contact",
    };

  const outbound =
    sender.email === own;

  return {
    id:
      `nylas-message-${
        message.id
      }`,

    providerMessageId:
      message.id,

    providerThreadId:
      message.thread_id,

    direction:
      outbound
        ? "outbound"
        : "inbound",

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
      stripHtml(
        message.body ||
        message.snippet,
      ),

    subject:
      clean(
        message.subject,
      ),

    attachments:
      messageAttachments(
        message,
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

function errorMessage(
  error,
  fallback,
) {
  return (
    error?.message ||
    fallback
  );
}

export function useRealInboxMailbox({
  workspaceId,
  enabled,
  selectedConversationId,
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

  const readThreadsRef =
    useRef(
      new Set(),
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
          await supabase
            .functions
            .invoke(
              "nylas-mailbox",
              {
                body: {
                  workspaceId,
                  ...requestBody,
                },
              },
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

        if (
          showLoading
        ) {
          setIsLoading(
            true,
          );
        }

        try {
          let folders =
            [];

          let inboxId =
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

            setInboxUnreadCount(
              mailboxCount(
                inboxFolder
                  ?.unread_count,
              ),
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
            }
          } catch {
            // A thread request below
            // remains authoritative.
          }

          const threadResult =
            await invokeMailbox({
              action:
                "list_threads",

              limit:
                20,

              ...(inboxId
                ? {
                    folderId:
                      inboxId,
                  }
                : {}),
            });

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
            (
              Array.isArray(
                threadResult.data,
              )
                ? threadResult.data
                : []
            )
              .map(
                (thread) => {
                  const transformed =
                    transformThread({
                      thread,
                      connectedEmail:
                        mailboxEmail ||
                        connectedEmail,
                    });

                  if (
                    readThreadsRef
                      .current
                      .has(
                        clean(
                          thread?.id,
                        ),
                      )
                  ) {
                    return {
                      ...transformed,
                      unread:
                        false,
                      unreadCount:
                        0,
                    };
                  }

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
            next,
          );

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
          setConversations(
            [],
          );

          setError(
            errorMessage(
              loadError,
              "Campaign Seat could not load the connected mailbox.",
            ),
          );

          return [];
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        connectedEmail,
        enabled,
        invokeMailbox,
        workspaceId,
      ],
    );

  const markThreadRead =
    useCallback(
      (
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
          return;
        }

        readThreadsRef
          .current
          .add(
            providerThreadId,
          );

        if (
          typeof window !==
            "undefined"
        ) {
          try {
            const storageKey =
              `campaign-seat-mailbox-read:${workspaceId}`;

            const stored =
              Array.from(
                readThreadsRef
                  .current,
              )
                .slice(
                  -1000,
                );

            window.localStorage
              .setItem(
                storageKey,
                JSON.stringify(
                  stored,
                ),
              );
          } catch {
            // Browser storage is only
            // an enhancement.
          }
        }

        setConversations(
          (current) =>
            current.map(
              (conversation) =>
                conversation
                  .providerThreadId ===
                providerThreadId
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
      },
      [
        enabled,
        workspaceId,
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
            conversations.find(
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
          const threadResult =
            await invokeMailbox({
              action:
                "get_thread",

              threadId:
                providerThreadId,
            });

          const thread =
            threadResult.data ||
            {};

          const messageIds =
            (
              Array.isArray(
                thread.message_ids,
              )
                ? thread.message_ids
                : []
            )
              .filter(Boolean)
              .slice(
                -20,
              );

          const messageResults =
            await Promise.all(
              messageIds.map(
                async (
                  messageId,
                ) => {
                  try {
                    const result =
                      await invokeMailbox({
                        action:
                          "get_message",

                        messageId,
                      });

                    return (
                      result.data ||
                      null
                    );
                  } catch {
                    return null;
                  }
                },
              ),
            );

          const messages =
            messageResults
              .filter(Boolean)
              .map(
                (message) =>
                  transformMessage({
                    message,
                    connectedEmail:
                      connectedEmail ||
                      threadResult
                        .connectedEmail,
                  }),
              )
              .sort(
                (
                  left,
                  right,
                ) =>
                  left.order -
                  right.order,
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
        connectedEmail,
        conversations,
        enabled,
        invokeMailbox,
      ],
    );

  useEffect(() => {
    if (
      !enabled ||
      !workspaceId ||
      typeof window ===
        "undefined"
    ) {
      return;
    }

    try {
      const stored =
        JSON.parse(
          window.localStorage
            .getItem(
              `campaign-seat-mailbox-read:${workspaceId}`,
            ) ||
          "[]",
        );

      readThreadsRef.current =
        new Set(
          Array.isArray(
            stored,
          )
            ? stored
                .map(clean)
                .filter(Boolean)
            : [],
        );
    } catch {
      readThreadsRef.current =
        new Set();
    }
  }, [
    enabled,
    workspaceId,
  ]);


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
            "visible"
        ) {
          return;
        }

        void refresh({
          showLoading:
            false,
        });
      };

    const intervalId =
      window.setInterval(
        refreshQuietly,
        60000,
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
        0,
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
          await supabase
            .functions
            .invoke(
              "nylas-send",
              {
                body:
                  functionBody,
              },
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
        } else {
          throw new Error(
            "The attachment response was not a readable file.",
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
    inboxTotalCount,
    inboxUnreadCount,
    isLoading,
    error,
    lastUpdated,

    refresh,
    loadThread,
    markThreadRead,
    sendEmail,
    replyEmail,
    getAttachmentBlob,
    downloadAttachment,
  };
}
