import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const INTERNAL_PREFIX = "internal-thread-";

function clean(value) {
  return String(value || "").trim();
}

function timestamp(value) {
  const numeric = new Date(value || Date.now()).getTime();

  return Number.isFinite(numeric)
    ? numeric
    : Date.now();
}

function relativeTime(value) {
  const difference = Date.now() - timestamp(value);

  if (difference < 60000) {
    return "Just now";
  }

  if (difference < 60 * 60000) {
    return `${Math.max(
      1,
      Math.floor(difference / 60000),
    )}m`;
  }

  if (difference < 24 * 60 * 60000) {
    return `${Math.max(
      1,
      Math.floor(difference / (60 * 60000)),
    )}h`;
  }

  return new Date(timestamp(value)).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  );
}

function transformMessage({
  message,
  userId,
}) {
  const own = message.created_by === userId;

  return {
    id: `internal-message-${message.id}`,
    internalMessageId: message.id,
    direction: own ? "outbound" : "inbound",
    author: own ? "You" : "Campaign team",
    initials: own ? "ME" : "CS",
    time: relativeTime(message.created_at),
    order: timestamp(message.created_at),
    channel: "Campaign Seat",
    body: clean(message.body),
    attachments: [],
  };
}

function transformThread({
  thread,
  messages,
  contact,
  userId,
}) {
  const transformedMessages = messages
    .map((message) =>
      transformMessage({
        message,
        userId,
      }),
    )
    .sort((left, right) => left.order - right.order);

  const latest =
    transformedMessages[transformedMessages.length - 1];

  const updated = thread.updated_at || thread.created_at;
  const relatedContact = clean(contact?.full_name);

  return {
    id: `${INTERNAL_PREFIX}${thread.id}`,
    internalThreadId: thread.id,
    contactId: thread.contact_id || null,
    sender: relatedContact
      ? `Campaign Seat · ${relatedContact}`
      : "Campaign Seat Team",
    initials: "CS",
    email: clean(contact?.email),
    phone: clean(contact?.phone),
    channel: "dashboard",
    subject:
      clean(thread.subject) || "Campaign Seat conversation",
    preview: clean(latest?.body).slice(0, 180),
    time: relativeTime(updated),
    order: timestamp(updated),
    unread: false,
    unreadCount: 0,
    priority: false,
    needsResponse: thread.status === "waiting",
    mentions: false,
    flagged: false,
    archived: thread.status === "archived",
    tags: ["Campaign Seat"],
    external: false,
    details: {
      organization:
        clean(contact?.organization) || "Campaign Seat",
      role: "Internal conversation",
      location: "",
      lastContact: relativeTime(updated),
    },
    messages: transformedMessages,
    files: [],
  };
}

export function useInternalInboxThreads({
  workspaceId,
  userId,
  enabled,
}) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshTimerRef = useRef(null);

  const refresh = useCallback(
    async ({ showLoading = true } = {}) => {
      if (!enabled || !workspaceId) {
        setConversations([]);
        setError("");
        return [];
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const {
          data: threadRows,
          error: threadError,
        } = await supabase
          .from("campaign_internal_threads")
          .select(
            `
              id,
              workspace_id,
              contact_id,
              subject,
              status,
              assigned_to,
              created_by,
              resolved_by,
              resolved_at,
              created_at,
              updated_at
            `,
          )
          .eq("workspace_id", workspaceId)
          .neq("status", "archived")
          .order("updated_at", {
            ascending: false,
          });

        if (threadError) {
          throw threadError;
        }

        const threads = threadRows || [];

        if (threads.length === 0) {
          setConversations([]);
          setError("");
          setLastUpdated(new Date());
          return [];
        }

        const threadIds = threads.map((thread) => thread.id);
        const contactIds = [
          ...new Set(
            threads
              .map((thread) => thread.contact_id)
              .filter(Boolean),
          ),
        ];

        const [messageResult, contactResult] = await Promise.all([
          supabase
            .from("campaign_internal_messages")
            .select(
              `
                id,
                workspace_id,
                thread_id,
                message_kind,
                body,
                created_by,
                created_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .in("thread_id", threadIds)
            .order("created_at", {
              ascending: true,
            }),

          contactIds.length
            ? supabase
                .from("campaign_contacts")
                .select(
                  `
                    id,
                    full_name,
                    email,
                    phone,
                    organization
                  `,
                )
                .eq("workspace_id", workspaceId)
                .in("id", contactIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (messageResult.error) {
          throw messageResult.error;
        }

        if (contactResult.error) {
          throw contactResult.error;
        }

        const messagesByThread = new Map();

        for (const message of messageResult.data || []) {
          const existing =
            messagesByThread.get(message.thread_id) || [];

          existing.push(message);
          messagesByThread.set(message.thread_id, existing);
        }

        const contactsById = new Map(
          (contactResult.data || []).map((contact) => [
            contact.id,
            contact,
          ]),
        );

        const next = threads.map((thread) =>
          transformThread({
            thread,
            messages:
              messagesByThread.get(thread.id) || [],
            contact:
              contactsById.get(thread.contact_id) || null,
            userId,
          }),
        );

        setConversations(next);
        setError("");
        setLastUpdated(new Date());
        return next;
      } catch (loadError) {
        setConversations([]);
        setError(
          loadError?.message ||
            "Campaign Seat internal messages could not be loaded.",
        );
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, userId, workspaceId],
  );

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      refresh();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled, refresh, workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refresh({ showLoading: false });
      }, 250);
    };

    const channel = supabase
      .channel(`internal-inbox-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_internal_threads",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_internal_messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, refresh, workspaceId]);

  const createThread = useCallback(
    async ({ contactId, subject, body }) => {
      if (!workspaceId || !userId) {
        throw new Error(
          "The active Campaign Seat workspace or user is missing.",
        );
      }

      const { data, error: createError } = await supabase.rpc(
        "create_internal_inbox_thread",
        {
          target_workspace_id: workspaceId,
          target_contact_id: contactId || null,
          target_subject: clean(subject),
          target_body: clean(body),
        },
      );

      if (createError) {
        throw createError;
      }

      await refresh({ showLoading: false });
      return data;
    },
    [refresh, userId, workspaceId],
  );

  const addMessage = useCallback(
    async ({ threadId, body }) => {
      if (!workspaceId || !userId || !threadId) {
        throw new Error(
          "The active Campaign Seat conversation is missing.",
        );
      }

      const { data, error: replyError } = await supabase.rpc(
        "add_internal_inbox_message",
        {
          target_workspace_id: workspaceId,
          target_thread_id: threadId,
          target_body: clean(body),
        },
      );

      if (replyError) {
        throw replyError;
      }

      await refresh({ showLoading: false });
      return data;
    },
    [refresh, userId, workspaceId],
  );

  return {
    conversations,
    isLoading,
    error,
    lastUpdated,
    refresh,
    createThread,
    addMessage,
  };
}
