import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";


function clean(value) {
  return String(value || "").trim();
}


export function useContactOperationsContext({
  workspaceId,
  threadIds,
  enabled = true,
}) {
  const [
    workflows,
    setWorkflows,
  ] = useState([]);

  const [
    tasks,
    setTasks,
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
    lastUpdated,
    setLastUpdated,
  ] = useState(null);


  const threadSignature =
    useMemo(
      () =>
        [
          ...new Set(
            (
              Array.isArray(threadIds)
                ? threadIds
                : []
            )
              .map(clean)
              .filter(Boolean),
          ),
        ]
          .sort()
          .join("|"),
      [
        threadIds,
      ],
    );


  const refresh =
    useCallback(
      async () => {
        const ids =
          threadSignature
            ? threadSignature.split("|")
            : [];

        if (
          !enabled ||
          !workspaceId ||
          !ids.length
        ) {
          setWorkflows([]);
          setTasks([]);
          setError("");
          setIsLoading(false);

          return {
            workflows: [],
            tasks: [],
          };
        }

        setIsLoading(true);
        setError("");

        try {
          const {
            data:
              workflowRows,
            error:
              workflowError,
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
                  updated_at
                `,
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .in(
                "provider_thread_id",
                ids,
              );

          if (workflowError) {
            throw workflowError;
          }

          const nextWorkflows =
            workflowRows || [];

          const taskIds =
            [
              ...new Set(
                nextWorkflows
                  .map(
                    (row) =>
                      clean(
                        row
                          ?.linked_task_id,
                      ),
                  )
                  .filter(Boolean),
              ),
            ];

          let nextTasks =
            [];

          if (taskIds.length) {
            const {
              data:
                taskRows,
              error:
                taskError,
            } =
              await supabase
                .from(
                  "tasks",
                )
                .select(
                  `
                    id,
                    workspace_id,
                    title,
                    description,
                    category,
                    priority,
                    status,
                    due_at,
                    assigned_to,
                    created_at,
                    updated_at
                  `,
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                )
                .in(
                  "id",
                  taskIds,
                );

            if (taskError) {
              throw taskError;
            }

            nextTasks =
              taskRows || [];
          }

          setWorkflows(
            nextWorkflows,
          );

          setTasks(
            nextTasks,
          );

          setLastUpdated(
            new Date(),
          );

          return {
            workflows:
              nextWorkflows,

            tasks:
              nextTasks,
          };
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            "Campaign Seat could not load this contact’s operational context.";

          setError(
            message,
          );

          return {
            workflows: [],
            tasks: [],
          };
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        enabled,
        threadSignature,
        workspaceId,
      ],
    );


  useEffect(
    () => {
      void refresh();
    },
    [
      refresh,
    ],
  );


  const workflowByThread =
    useMemo(
      () =>
        new Map(
          workflows
            .filter(
              (row) =>
                Boolean(
                  row
                    ?.provider_thread_id,
                ),
            )
            .map(
              (row) => [
                row.provider_thread_id,
                row,
              ],
            ),
        ),
      [
        workflows,
      ],
    );


  const taskById =
    useMemo(
      () =>
        new Map(
          tasks.map(
            (task) => [
              task.id,
              task,
            ],
          ),
        ),
      [
        tasks,
      ],
    );


  return {
    workflows,

    workflowByThread,

    tasks,

    taskById,

    isLoading,

    error,

    lastUpdated,

    refresh,
  };
}


export default useContactOperationsContext;
