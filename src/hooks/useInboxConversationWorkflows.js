import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function clean(
  value,
) {
  return String(
    value || "",
  ).trim();
}


function normalizedEmail(
  value,
) {
  return clean(
    value,
  ).toLowerCase();
}


export function inboxWorkflowKey(
  conversation,
) {
  if (!conversation) {
    return "";
  }

  const channel =
    clean(
      conversation.channel ||
        "conversation",
    )
      .toLowerCase();

  const providerThreadId =
    clean(
      conversation
        .providerThreadId,
    );

  if (
    channel === "email" &&
    providerThreadId
  ) {
    const mailboxEmail =
      normalizedEmail(
        conversation
          .mailboxEmail ||
        "",
      );

    return [
      "email",
      mailboxEmail ||
        "mailbox",
      providerThreadId,
    ].join(":");
  }

  const conversationId =
    clean(
      conversation.id,
    );

  if (!conversationId) {
    return "";
  }

  return [
    channel,
    conversationId,
  ].join(":");
}


export function useInboxConversationWorkflows({
  workspaceId,
  userId,
  enabled = true,
}) {
  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    activityRows,
    setActivityRows,
  ] = useState([]);


  const refreshActivity =
    useCallback(
      async () => {
        if (
          !enabled ||
          !workspaceId
        ) {
          setActivityRows([]);

          return [];
        }

        try {
          const {
            data,
            error:
              activityError,
          } =
            await supabase
              .from(
                "inbox_conversation_activity",
              )
              .select(
                `
                  id,
                  workspace_id,
                  conversation_key,
                  channel,
                  event_type,
                  event_label,
                  event_detail,
                  actor_user_id,
                  metadata,
                  created_at
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              )
              .limit(
                1000,
              );

          if (activityError) {
            throw activityError;
          }

          setActivityRows(
            data || [],
          );

          return data || [];
        } catch (
          activityError
        ) {
          console.error(
            "Inbox activity could not load:",
            activityError,
          );

          return [];
        }
      },
      [
        enabled,
        workspaceId,
      ],
    );


  const refresh =
    useCallback(
      async () => {
        if (
          !enabled ||
          !workspaceId
        ) {
          setRows([]);
          setError("");

          return [];
        }

        setIsLoading(
          true,
        );

        try {
          const {
            data,
            error:
              loadError,
          } =
            await supabase
              .from(
                "inbox_conversation_workflows",
              )
              .select(
                `
                  id,
                  workspace_id,
                  conversation_key,
                  channel,
                  provider_thread_id,
                  mailbox_email,
                  account_provider,
                  workflow_status,
                  assigned_to,
                  is_vip,
                  follow_up_at,
                  snoozed_until,
                  linked_task_id,
                  note,
                  metadata,
                  created_by,
                  updated_by,
                  created_at,
                  updated_at
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              );

          if (loadError) {
            throw loadError;
          }

          const nextRows =
            data || [];

          setRows(
            nextRows,
          );

          setError(
            "",
          );

          return nextRows;
        } catch (
          loadError
        ) {
          console.error(
            "Inbox workflow state could not load:",
            loadError,
          );

          setError(
            loadError?.message ||
              "Campaign Inbox workflow could not load.",
          );

          return [];
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        enabled,
        workspaceId,
      ],
    );


  useEffect(() => {
    if (
      !enabled ||
      !workspaceId
    ) {
      return undefined;
    }

    void refresh();

    const channel =
      supabase
        .channel(
          `inbox-command-center-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "inbox_conversation_workflows",

            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
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

    void refreshActivity();

    const activityChannel =
      supabase
        .channel(
          `inbox-activity-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "inbox_conversation_activity",

            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          () => {
            void refreshActivity();
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        activityChannel,
      );
    };
  }, [
    enabled,
    refreshActivity,
    workspaceId,
  ]);


  const byKey =
    useMemo(
      () =>
        new Map(
          rows.map(
            (row) => [
              row
                .conversation_key,
              row,
            ],
          ),
        ),
      [
        rows,
      ],
    );


  const activityByKey =
    useMemo(
      () => {
        const map =
          new Map();

        activityRows.forEach(
          (row) => {
            const key =
              row
                .conversation_key;

            if (!key) {
              return;
            }

            if (
              !map.has(
                key,
              )
            ) {
              map.set(
                key,
                [],
              );
            }

            map.get(
              key,
            ).push(
              row,
            );
          },
        );

        return map;
      },
      [
        activityRows,
      ],
    );


  const getWorkflow =
    useCallback(
      (
        conversation,
      ) =>
        byKey.get(
          inboxWorkflowKey(
            conversation,
          ),
        ) ||
        null,
      [
        byKey,
      ],
    );


  const upsertWorkflow =
    useCallback(
      async (
        conversation,
        updates = {},
      ) => {
        if (
          !enabled ||
          !workspaceId ||
          !userId
        ) {
          throw new Error(
            "Inbox workflow is not available.",
          );
        }

        const conversationKey =
          inboxWorkflowKey(
            conversation,
          );

        if (
          !conversationKey
        ) {
          throw new Error(
            "Campaign Seat could not identify this conversation.",
          );
        }

        const existing =
          byKey.get(
            conversationKey,
          ) ||
          null;

        const payload = {
          workspace_id:
            workspaceId,

          conversation_key:
            conversationKey,

          channel:
            clean(
              conversation
                ?.channel ||
              existing
                ?.channel ||
              "email",
            )
              .toLowerCase(),

          provider_thread_id:
            clean(
              conversation
                ?.providerThreadId ||
              existing
                ?.provider_thread_id,
            ) ||
            null,

          mailbox_email:
            normalizedEmail(
              conversation
                ?.mailboxEmail ||
              existing
                ?.mailbox_email,
            ) ||
            null,

          account_provider:
            clean(
              conversation
                ?.accountProvider ||
              existing
                ?.account_provider,
            )
              .toLowerCase() ||
            null,

          workflow_status:
            updates
              .workflow_status ??
            existing
              ?.workflow_status ??
            (
              conversation
                ?.needsResponse
                ? "needs_reply"
                : "open"
            ),

          assigned_to:
            updates
              .assigned_to !==
            undefined
              ? updates
                  .assigned_to
              : existing
                  ?.assigned_to ??
                null,

          is_vip:
            updates
              .is_vip !==
            undefined
              ? Boolean(
                  updates
                    .is_vip,
                )
              : Boolean(
                  existing
                    ?.is_vip,
                ),

          follow_up_at:
            updates
              .follow_up_at !==
            undefined
              ? updates
                  .follow_up_at
              : existing
                  ?.follow_up_at ??
                null,

          snoozed_until:
            updates
              .snoozed_until !==
            undefined
              ? updates
                  .snoozed_until
              : existing
                  ?.snoozed_until ??
                null,

          linked_task_id:
            updates
              .linked_task_id !==
            undefined
              ? updates
                  .linked_task_id
              : existing
                  ?.linked_task_id ??
                null,

          note:
            updates
              .note !==
            undefined
              ? updates.note
              : existing
                  ?.note ??
                null,

          metadata: {
            ...(
              existing
                ?.metadata ||
              {}
            ),

            ...(
              updates
                .metadata ||
              {}
            ),
          },

          created_by:
            existing
              ?.created_by ||
            userId,

          updated_by:
            userId,
        };

        const {
          data,
          error:
            saveError,
        } =
          await supabase
            .from(
              "inbox_conversation_workflows",
            )
            .upsert(
              payload,
              {
                onConflict:
                  "workspace_id,conversation_key",
              },
            )
            .select()
            .single();

        if (saveError) {
          throw saveError;
        }

        setRows(
          (current) => {
            const found =
              current.some(
                (row) =>
                  row
                    .conversation_key ===
                  conversationKey,
              );

            if (!found) {
              return [
                data,
                ...current,
              ];
            }

            return current.map(
              (row) =>
                row
                  .conversation_key ===
                conversationKey
                  ? data
                  : row,
            );
          },
        );

        return data;
      },
      [
        byKey,
        enabled,
        userId,
        workspaceId,
      ],
    );


  const logActivity =
    useCallback(
      async (
        conversation,
        {
          eventType,
          eventLabel,
          eventDetail = "",
          metadata = {},
          actorUserId =
            userId,
        },
      ) => {
        if (
          !enabled ||
          !workspaceId ||
          !userId
        ) {
          return null;
        }

        const conversationKey =
          inboxWorkflowKey(
            conversation,
          );

        if (
          !conversationKey ||
          !clean(
            eventType,
          ) ||
          !clean(
            eventLabel,
          )
        ) {
          return null;
        }

        const payload = {
          workspace_id:
            workspaceId,

          conversation_key:
            conversationKey,

          channel:
            clean(
              conversation
                ?.channel ||
              "email",
            )
              .toLowerCase(),

          event_type:
            clean(
              eventType,
            ),

          event_label:
            clean(
              eventLabel,
            ),

          event_detail:
            clean(
              eventDetail,
            ) ||
            null,

          actor_user_id:
            actorUserId ===
              undefined
              ? userId
              : actorUserId,

          metadata: {
            sender:
              clean(
                conversation
                  ?.sender,
              ),

            email:
              normalizedEmail(
                conversation
                  ?.email,
              ),

            subject:
              clean(
                conversation
                  ?.subject,
              ),

            ...metadata,
          },
        };

        const {
          data,
          error:
            insertError,
        } =
          await supabase
            .from(
              "inbox_conversation_activity",
            )
            .insert(
              payload,
            )
            .select()
            .single();

        if (insertError) {
          throw insertError;
        }

        setActivityRows(
          (current) => [
            data,
            ...current.filter(
              (row) =>
                row.id !==
                data.id,
            ),
          ],
        );

        return data;
      },
      [
        enabled,
        userId,
        workspaceId,
      ],
    );


  return {
    rows,
    byKey,
    activityRows,
    activityByKey,
    isLoading,
    error,

    refresh,
    refreshActivity,
    getWorkflow,
    upsertWorkflow,
    logActivity,
  };
}
