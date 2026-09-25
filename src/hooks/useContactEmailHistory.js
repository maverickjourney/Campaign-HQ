import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function clean(
  value,
) {
  return String(
    value ||
      "",
  ).trim();
}


function normalizedEmail(
  value,
) {
  return clean(
    value,
  ).toLowerCase();
}


function unixMilliseconds(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const numeric =
    Number(
      value,
    );

  if (
    Number.isFinite(
      numeric,
    ) &&
    numeric >
      0
  ) {
    return numeric <
      1_000_000_000_000
      ? numeric *
          1000
      : numeric;
  }

  const parsed =
    Date.parse(
      String(
        value,
      ),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function recipientList(
  value,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item,
      ) => {
        const email =
          normalizedEmail(
            item?.email,
          );

        if (
          !email
        ) {
          return null;
        }

        return {
          email,

          name:
            clean(
              item?.name,
            ),
        };
      },
    )
    .filter(
      Boolean,
    );
}


function stripHtml(
  value,
) {
  return String(
    value ||
      "",
  )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " ",
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " ",
    )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function normalizeThread({
  thread,
  connectedEmail,
}) {
  const latest =
    thread
      ?.latest_draft_or_message ||
    {};

  const receivedAt =
    unixMilliseconds(
      thread
        ?.latest_message_received_date,
    );

  const sentAt =
    unixMilliseconds(
      thread
        ?.latest_message_sent_date,
    );

  const latestMessageAt =
    unixMilliseconds(
      latest?.date ||
        latest?.created_at,
    );

  const occurredAt =
    Math.max(
      receivedAt,
      sentAt,
      latestMessageAt,
    );

  let direction =
    "";

  if (
    receivedAt ||
    sentAt
  ) {
    direction =
      receivedAt >=
      sentAt
        ? "inbound"
        : "outbound";
  }

  if (
    !direction
  ) {
    const from =
      recipientList(
        latest?.from,
      )[0];

    if (
      from?.email
    ) {
      direction =
        from.email ===
        normalizedEmail(
          connectedEmail,
        )
          ? "outbound"
          : "inbound";
    }
  }

  const subject =
    clean(
      thread?.subject ||
        latest?.subject,
    ) ||
    "(No subject)";

  const preview =
    stripHtml(
      thread?.snippet ||
        latest?.snippet ||
        latest?.body,
    )
      .slice(
        0,
        240,
      );

  const messageIds =
    Array.isArray(
      thread?.message_ids,
    )
      ? thread.message_ids
      : [];

  return {
    id:
      clean(
        thread?.id,
      ),

    providerThreadId:
      clean(
        thread?.id,
      ),

    subject,

    preview,

    direction,

    unread:
      Boolean(
        thread?.unread,
      ),

    starred:
      Boolean(
        thread?.starred,
      ),

    hasAttachments:
      Boolean(
        thread?.has_attachments,
      ),

    messageCount:
      messageIds.length ||
      Number(
        thread
          ?.message_count ||
        0,
      ) ||
      null,

    occurredAt:
      occurredAt
        ? new Date(
            occurredAt,
          ).toISOString()
        : null,

    order:
      occurredAt,
  };
}


function historyError(
  error,
) {
  const message =
    error?.message ||
    "";

  if (
    /rate.?limit/i.test(
      message,
    )
  ) {
    return "Email history is temporarily rate limited. Try Refresh again shortly.";
  }

  if (
    /authorization/i.test(
      message,
    )
  ) {
    return "The connected mailbox authorization needs attention.";
  }

  return (
    message ||
    "Campaign Seat could not load this contact’s email history."
  );
}


export function useContactEmailHistory({
  workspaceId,
  email,
  enabled = true,
}) {
  const [
    threads,
    setThreads,
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

  const requestIdRef =
    useRef(0);

  const normalizedContactEmail =
    normalizedEmail(
      email,
    );


  const refresh =
    useCallback(
      async () => {
        const requestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          requestId;

        if (
          !enabled ||
          !workspaceId ||
          !normalizedContactEmail
        ) {
          setThreads(
            [],
          );

          setError(
            "",
          );

          setConnectedEmail(
            "",
          );

          setAccountProvider(
            "",
          );

          setIsLoading(
            false,
          );

          return [];
        }

        setIsLoading(
          true,
        );

        setError(
          "",
        );

        try {
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
                      "list_threads",

                    anyEmail:
                      normalizedContactEmail,

                    limit:
                      20,
                  },
                },
              );

          if (
            invokeError
          ) {
            throw invokeError;
          }

          if (
            data?.success !==
              true
          ) {
            throw new Error(
              data?.error ||
              "The connected mailbox could not load contact history.",
            );
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return [];
          }

          const nextConnectedEmail =
            clean(
              data
                ?.connectedEmail,
            );

          const nextThreads =
            (
              Array.isArray(
                data?.data,
              )
                ? data.data
                : []
            )
              .map(
                (
                  thread,
                ) =>
                  normalizeThread({
                    thread,

                    connectedEmail:
                      nextConnectedEmail,
                  }),
              )
              .filter(
                (
                  thread,
                ) =>
                  Boolean(
                    thread.id,
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

          setThreads(
            nextThreads,
          );

          setConnectedEmail(
            nextConnectedEmail,
          );

          setAccountProvider(
            clean(
              data
                ?.accountProvider,
            ),
          );

          setLastUpdated(
            new Date(),
          );

          return nextThreads;
        } catch (
          loadError
        ) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return [];
          }

          setThreads(
            [],
          );

          setError(
            historyError(
              loadError,
            ),
          );

          return [];
        } finally {
          if (
            requestId ===
            requestIdRef.current
          ) {
            setIsLoading(
              false,
            );
          }
        }
      },
      [
        enabled,
        normalizedContactEmail,
        workspaceId,
      ],
    );


  useEffect(
    () => {
      void refresh();

      return () => {
        requestIdRef.current +=
          1;
      };
    },
    [
      refresh,
    ],
  );


  return {
    threads,

    connectedEmail,

    accountProvider,

    isLoading,

    error,

    lastUpdated,

    refresh,
  };
}


export default useContactEmailHistory;
