import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  tasks: [],
  team: [],
  comments: [],
};

function buildStatusFields(task, nextStatus, userId) {
  if (nextStatus === "in_progress") {
    return {
      status: nextStatus,
      started_at:
        task?.started_at || new Date().toISOString(),
      completed_at: null,
      completed_by: null,
      archived_at: null,
    };
  }

  if (nextStatus === "completed") {
    return {
      status: nextStatus,
      started_at:
        task?.started_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      completed_by: userId,
      archived_at: null,
    };
  }

  if (nextStatus === "archived") {
    return {
      status: nextStatus,
      archived_at: new Date().toISOString(),
    };
  }

  return {
    status: "open",
    completed_at: null,
    completed_by: null,
    archived_at: null,
  };
}

export function useTasksCommandCenter({
  workspaceId,
  userId,
  selectedTaskId,
}) {

  // CAMPAIGN SEAT TASK REMINDER RUNTIME
  const [
    taskReminders,
    setTaskReminders,
  ] = useState([]);

  const [
    isRemindersLoading,
    setIsRemindersLoading,
  ] = useState(false);

  const [
    taskReminderOverview,
    setTaskReminderOverview,
  ] = useState([]);

  const [
    taskSubtaskOverview,
    setTaskSubtaskOverview,
  ] = useState([]);

  // CAMPAIGN SEAT TASK TEMPLATE / PLAYBOOK RUNTIME
  const [
    taskTemplates,
    setTaskTemplates,
  ] = useState([]);

  const [
    isTaskTemplatesLoading,
    setIsTaskTemplatesLoading,
  ] = useState(false);

  const [
    taskTemplateError,
    setTaskTemplateError,
  ] = useState("");

  // CAMPAIGN SEAT TASK DEPENDENCY RUNTIME
  const [
    taskDependencies,
    setTaskDependencies,
  ] = useState([]);

  const [
    isDependenciesLoading,
    setIsDependenciesLoading,
  ] = useState(false);


  // CAMPAIGN SEAT TASK ATTACHMENT RUNTIME
  const [
    taskAttachments,
    setTaskAttachments,
  ] = useState([]);

  const [
    isAttachmentsLoading,
    setIsAttachmentsLoading,
  ] = useState(false);

  const [
    taskAttachmentError,
    setTaskAttachmentError,
  ] = useState("");


  // CAMPAIGN SEAT TASK CHECKLIST RUNTIME
  const [subtasks, setSubtasks] =
    useState([]);

  const [
    isSubtasksLoading,
    setIsSubtasksLoading,
  ] = useState(false);

  const [state, setState] = useState(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshTimerRef = useRef(null);
  const teamRef = useRef([]);

  const loadTaskTemplates =
    useCallback(
      async () => {
        if (!workspaceId) {
          setTaskTemplates([]);
          setTaskTemplateError("");
          return [];
        }

        setIsTaskTemplatesLoading(
          true,
        );

        setTaskTemplateError("");

        try {
          const {
            data: templates,
            error: templateError,
          } = await supabase
            .from("task_templates")
            .select(
              `
                id,
                workspace_id,
                name,
                task_title,
                task_description,
                category,
                priority,
                visibility,
                tags,
                estimated_minutes,
                created_by,
                updated_by,
                is_active,
                created_at,
                updated_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "is_active",
              true,
            )
            .order(
              "name",
              {
                ascending: true,
              },
            );

          if (templateError) {
            throw templateError;
          }

          const templateRows =
            templates || [];

          if (!templateRows.length) {
            setTaskTemplates([]);
            return [];
          }

          const templateIds =
            templateRows.map(
              (template) =>
                template.id,
            );

          const {
            data: checklistItems,
            error: checklistError,
          } = await supabase
            .from(
              "task_template_items",
            )
            .select(
              `
                id,
                workspace_id,
                template_id,
                title,
                sort_order,
                created_by,
                created_at,
                updated_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .in(
              "template_id",
              templateIds,
            )
            .order(
              "sort_order",
              {
                ascending: true,
              },
            )
            .order(
              "created_at",
              {
                ascending: true,
              },
            );

          if (checklistError) {
            throw checklistError;
          }

          const itemsByTemplate =
            new Map();

          for (
            const item of
            checklistItems || []
          ) {
            const current =
              itemsByTemplate.get(
                item.template_id,
              ) || [];

            current.push(item);

            itemsByTemplate.set(
              item.template_id,
              current,
            );
          }

          const hydratedTemplates =
            templateRows.map(
              (template) => ({
                ...template,

                checklistItems:
                  itemsByTemplate.get(
                    template.id,
                  ) || [],
              }),
            );

          setTaskTemplates(
            hydratedTemplates,
          );

          return hydratedTemplates;
        } catch (templateLoadError) {
          console.error(
            "Task templates could not be loaded:",
            templateLoadError,
          );

          setTaskTemplates([]);

          setTaskTemplateError(
            templateLoadError?.message ||
              "Campaign playbooks could not be loaded.",
          );

          throw templateLoadError;
        } finally {
          setIsTaskTemplatesLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );

  useEffect(() => {
    if (!workspaceId) {
      setTaskTemplates([]);
      setTaskTemplateError("");
      return;
    }

    loadTaskTemplates().catch(
      () => {
        /*
         * Error state is handled inside
         * loadTaskTemplates.
         */
      },
    );
  }, [
    loadTaskTemplates,
    workspaceId,
  ]);

  const createTaskTemplate =
    useCallback(
      async (
        templateData,
        checklistTitles = [],
      ) => {
        setIsSaving(true);
        setTaskTemplateError("");

        const titles =
          (checklistTitles || [])
            .map(
              (title) =>
                String(title || "")
                  .trim(),
            )
            .filter(Boolean);

        let createdTemplate = null;

        try {
          const {
            data,
            error: createError,
          } = await supabase
            .from("task_templates")
            .insert({
              workspace_id:
                workspaceId,

              name:
                templateData.name,

              task_title:
                templateData
                  .task_title,

              task_description:
                templateData
                  .task_description ||
                null,

              category:
                templateData.category ||
                "General",

              priority:
                templateData.priority ||
                "normal",

              visibility:
                templateData.visibility ||
                "workspace",

              tags:
                templateData.tags ||
                [],

              estimated_minutes:
                templateData
                  .estimated_minutes ||
                null,

              created_by:
                userId,

              is_active:
                true,
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          createdTemplate = data;

          if (titles.length) {
            const {
              error: itemError,
            } = await supabase
              .from(
                "task_template_items",
              )
              .insert(
                titles.map(
                  (
                    title,
                    index,
                  ) => ({
                    workspace_id:
                      workspaceId,

                    template_id:
                      data.id,

                    title,

                    sort_order:
                      index,

                    created_by:
                      userId,
                  }),
                ),
              );

            if (itemError) {
              /*
               * Avoid leaving a half-created
               * playbook if checklist creation
               * fails.
               */
              await supabase
                .from(
                  "task_templates",
                )
                .delete()
                .eq(
                  "id",
                  data.id,
                )
                .eq(
                  "workspace_id",
                  workspaceId,
                );

              throw itemError;
            }
          }

          await loadTaskTemplates();

          return createdTemplate;
        } catch (templateSaveError) {
          setTaskTemplateError(
            templateSaveError?.message ||
              "The campaign playbook could not be created.",
          );

          throw templateSaveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskTemplates,
        userId,
        workspaceId,
      ],
    );


  const updateTaskTemplate =
    useCallback(
      async (
        templateId,
        templateData,
        checklistTitles = [],
      ) => {
        if (!templateId) {
          return null;
        }

        setIsSaving(true);
        setTaskTemplateError("");

        const titles =
          (checklistTitles || [])
            .map(
              (title) =>
                String(title || "")
                  .trim(),
            )
            .filter(Boolean);

        try {
          const {
            data,
            error: updateError,
          } = await supabase
            .from("task_templates")
            .update({
              name:
                templateData.name,

              task_title:
                templateData
                  .task_title,

              task_description:
                templateData
                  .task_description ||
                null,

              category:
                templateData.category ||
                "General",

              priority:
                templateData.priority ||
                "normal",

              visibility:
                templateData.visibility ||
                "workspace",

              tags:
                templateData.tags ||
                [],

              estimated_minutes:
                templateData
                  .estimated_minutes ||
                null,

              updated_by:
                userId,
            })
            .eq(
              "id",
              templateId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          const {
            error: deleteError,
          } = await supabase
            .from(
              "task_template_items",
            )
            .delete()
            .eq(
              "template_id",
              templateId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (deleteError) {
            throw deleteError;
          }

          if (titles.length) {
            const {
              error: itemError,
            } = await supabase
              .from(
                "task_template_items",
              )
              .insert(
                titles.map(
                  (
                    title,
                    index,
                  ) => ({
                    workspace_id:
                      workspaceId,

                    template_id:
                      templateId,

                    title,

                    sort_order:
                      index,

                    created_by:
                      userId,
                  }),
                ),
              );

            if (itemError) {
              throw itemError;
            }
          }

          await loadTaskTemplates();

          return data;
        } catch (templateSaveError) {
          setTaskTemplateError(
            templateSaveError?.message ||
              "The campaign playbook could not be updated.",
          );

          throw templateSaveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskTemplates,
        userId,
        workspaceId,
      ],
    );


  const archiveTaskTemplate =
    useCallback(
      async (templateId) => {
        if (!templateId) {
          return null;
        }

        setIsSaving(true);
        setTaskTemplateError("");

        try {
          const {
            data,
            error: archiveError,
          } = await supabase
            .from("task_templates")
            .update({
              is_active:
                false,

              updated_by:
                userId,
            })
            .eq(
              "id",
              templateId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();

          if (archiveError) {
            throw archiveError;
          }

          await loadTaskTemplates();

          return data;
        } catch (templateArchiveError) {
          setTaskTemplateError(
            templateArchiveError?.message ||
              "The campaign playbook could not be archived.",
          );

          throw templateArchiveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskTemplates,
        userId,
        workspaceId,
      ],
    );


  const loadTeam = useCallback(async () => {
    if (!workspaceId) {
      return [];
    }

    const { data: memberships, error: membershipError } =
      await supabase
        .from("workspace_members")
        .select(
          `
            user_id,
            role,
            role_key,
            display_title,
            dashboard_type,
            seat_type,
            status
          `,
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "active");

    if (membershipError) {
      throw membershipError;
    }

    const userIds = (memberships || []).map(
      (membership) => membership.user_id,
    );

    if (!userIds.length) {
      teamRef.current = [];
      return [];
    }

    const { data: profiles, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const team = (memberships || [])
      .map((membership) => {
        const profile = profileMap.get(
          membership.user_id,
        );

        return {
          id: membership.user_id,

          role:
            membership.role_key ||
            membership.role ||
            "campaign_member",

          roleKey:
            membership.role_key ||
            membership.role ||
            "campaign_member",

          roleName:
            membership.display_title ||
            "Campaign Member",

          displayTitle:
            membership.display_title ||
            "Campaign Member",

          dashboardType:
            membership.dashboard_type ||
            "volunteer",

          seatType:
            membership.seat_type ||
            "volunteer",

          fullName:
            profile?.full_name ||
            "Campaign User",

          email:
            profile?.email || "",
        };
      })
      .sort((left, right) => {
        const authorityOrder = {
          campaign_owner: 0,
          campaign_consultant: 1,
          campaign_manager: 2,
          department_lead: 3,
          staff: 4,
          team_captain: 5,
          reviewer: 6,
          volunteer: 7,
        };

        const leftRank =
          authorityOrder[left.roleKey] ?? 99;

        const rightRank =
          authorityOrder[right.roleKey] ?? 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.fullName.localeCompare(
          right.fullName,
        );
      });

    teamRef.current = team;

    return team;
  }, [workspaceId]);

  const loadTasks = useCallback(async () => {
    if (!workspaceId) {
      return [];
    }

    const { data, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
          id,
          workspace_id,
          title,
          description,
          category,
          priority,
          status,
          visibility,
          tags,
          estimated_minutes,
          sort_order,
          due_at,
          assigned_to,
          created_by,
          started_at,
          completed_at,
          completed_by,
          archived_at,
          created_at,
          updated_at
        `,
      )
      .eq("workspace_id", workspaceId)
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", { ascending: false });

    if (taskError) {
      throw taskError;
    }

    return data || [];
  }, [workspaceId]);

  const loadSubtasks = useCallback(
    async (taskId) => {
      if (!taskId || !workspaceId) {
        setSubtasks([]);
        return [];
      }

      setIsSubtasksLoading(true);

      try {
        const {
          data,
          error: subtasksError,
        } = await supabase
          .from("task_subtasks")
          .select(
            `
              id,
              workspace_id,
              task_id,
              title,
              is_completed,
              sort_order,
              created_by,
              completed_by,
              completed_at,
              created_at,
              updated_at
            `,
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "task_id",
            taskId,
          )
          .order(
            "sort_order",
            {
              ascending: true,
            },
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          );

        if (subtasksError) {
          throw subtasksError;
        }

        const nextSubtasks =
          data || [];

        setSubtasks(
          nextSubtasks,
        );

        return nextSubtasks;
      } finally {
        setIsSubtasksLoading(false);
      }
    },
    [workspaceId],
  );

  const loadTaskReminderOverview =
    useCallback(async () => {
      if (!workspaceId) {
        setTaskReminderOverview([]);
        return [];
      }

      const {
        data,
        error: reminderOverviewError,
      } = await supabase
        .from("task_reminders")
        .select(
          `
            id,
            workspace_id,
            task_id,
            schedule_type,
            next_fire_at,
            is_enabled,
            fired_at
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        );

      if (reminderOverviewError) {
        throw reminderOverviewError;
      }

      const nextOverview =
        data || [];

      setTaskReminderOverview(
        nextOverview,
      );

      return nextOverview;
    }, [workspaceId]);

  const loadTaskSubtaskOverview =
    useCallback(async () => {
      if (!workspaceId) {
        setTaskSubtaskOverview([]);
        return [];
      }

      const {
        data,
        error: subtaskOverviewError,
      } = await supabase
        .from("task_subtasks")
        .select(
          `
            id,
            workspace_id,
            task_id,
            is_completed
          `,
        )
        .eq(
          "workspace_id",
          workspaceId,
        );

      if (subtaskOverviewError) {
        throw subtaskOverviewError;
      }

      const nextOverview =
        data || [];

      setTaskSubtaskOverview(
        nextOverview,
      );

      return nextOverview;
    }, [workspaceId]);

  const loadTaskReminders =
    useCallback(
      async (taskId) => {
        if (
          !taskId ||
          !workspaceId
        ) {
          setTaskReminders([]);
          return [];
        }

        setIsRemindersLoading(
          true,
        );

        try {
          const {
            data,
            error: reminderError,
          } = await supabase
            .from(
              "task_reminders",
            )
            .select(
              `
                id,
                workspace_id,
                task_id,
                schedule_type,
                offset_minutes,
                exact_at,
                next_fire_at,
                recipient_scope,
                message,
                is_enabled,
                fired_at,
                created_by,
                created_at,
                updated_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "task_id",
              taskId,
            )
            .order(
              "next_fire_at",
              {
                ascending: true,
                nullsFirst: false,
              },
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            );

          if (reminderError) {
            throw reminderError;
          }

          const nextReminders =
            data || [];

          setTaskReminders(
            nextReminders,
          );

          return nextReminders;
        } finally {
          setIsRemindersLoading(
            false,
          );
        }
      },
      [workspaceId],
    );

  const loadComments = useCallback(
    async (taskId) => {
      if (!taskId) {
        setState((current) => ({
          ...current,
          comments: [],
        }));

        return [];
      }

      const { data, error: commentError } =
        await supabase
          .from("task_comments")
          .select(
            `
              id,
              workspace_id,
              task_id,
              author_id,
              body,
              is_edited,
              created_at,
              updated_at
            `,
          )
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });

      if (commentError) {
        throw commentError;
      }

      const teamMap = new Map(
        teamRef.current.map((member) => [
          member.id,
          member,
        ]),
      );

      const comments = (data || []).map((comment) => {
        const author = teamMap.get(comment.author_id);

        return {
          ...comment,
          authorName:
            author?.fullName || "Campaign User",
          authorRole:
            author?.displayTitle ||
            "Campaign Member",
        };
      });

      setState((current) => ({
        ...current,
        comments,
      }));

      return comments;
    },
    [],
  );

  const loadCommandCenter = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId) {
        setError("No campaign workspace is selected.");
        setIsLoading(false);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const [
          team,
          tasks,
        ] = await Promise.all([
          loadTeam(),
          loadTasks(),
          loadTaskReminderOverview(),
          loadTaskSubtaskOverview(),
        ]);

        setState((current) => ({
          ...current,
          team,
          tasks,
        }));

        setError("");
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error(
          "Task Command Center could not load:",
          loadError,
        );

        setError(
          "Campaign tasks could not be refreshed. Check the connection and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loadTasks, loadTeam, workspaceId],
  );

  useEffect(() => {
    loadCommandCenter({ showLoading: true });
  }, [loadCommandCenter]);

  useEffect(() => {
    if (!selectedTaskId) {
      setState((current) => ({
        ...current,
        comments: [],
      }));

      return;
    }

    loadComments(selectedTaskId).catch(
      (commentError) => {
        console.error(
          "Task comments could not load:",
          commentError,
        );
      },
    );
  }, [loadComments, selectedTaskId]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);

      refreshTimerRef.current = window.setTimeout(
        () => {
          loadCommandCenter();

          if (selectedTaskId) {
            loadComments(selectedTaskId);
          }
        },
        300,
      );
    };

    const channel = supabase
      .channel(`task-command-center-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_reminders",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_subtasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [
    loadCommandCenter,
    loadComments,
    selectedTaskId,
    workspaceId,
  ]);

  useEffect(() => {
    if (
      !workspaceId ||
      !selectedTaskId
    ) {
      setSubtasks([]);
      return undefined;
    }

    loadSubtasks(
      selectedTaskId,
    ).catch((subtaskError) => {
      console.error(
        "Task checklist could not be loaded:",
        subtaskError,
      );
    });

    const channel =
      supabase
        .channel(
          `task-subtasks-${workspaceId}-${selectedTaskId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_subtasks",
            filter:
              `task_id=eq.${selectedTaskId}`,
          },
          () => {
            loadSubtasks(
              selectedTaskId,
            ).catch(
              (subtaskError) => {
                console.error(
                  "Task checklist could not be refreshed:",
                  subtaskError,
                );
              },
            );
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, [
    loadSubtasks,
    selectedTaskId,
    workspaceId,
  ]);

  useEffect(() => {
    if (
      !workspaceId ||
      !selectedTaskId
    ) {
      setTaskReminders([]);
      return;
    }

    loadTaskReminders(
      selectedTaskId,
    ).catch(
      (reminderError) => {
        console.error(
          "Task reminders could not be loaded:",
          reminderError,
        );
      },
    );
  }, [
    loadTaskReminders,
    selectedTaskId,
    workspaceId,
  ]);

  // CAMPAIGN SEAT TASK REMINDER REALTIME
  useEffect(() => {
    if (
      !workspaceId ||
      !selectedTaskId
    ) {
      return undefined;
    }

    const reminderChannel =
      supabase
        .channel(
          `task-reminders-live-${workspaceId}-${selectedTaskId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "task_reminders",
            filter:
              `task_id=eq.${selectedTaskId}`,
          },
          () => {
            loadTaskReminders(
              selectedTaskId,
            ).catch(
              (reminderError) => {
                console.error(
                  "Task reminders could not be refreshed:",
                  reminderError,
                );
              },
            );
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        reminderChannel,
      );
    };
  }, [
    loadTaskReminders,
    selectedTaskId,
    workspaceId,
  ]);

  // CAMPAIGN SEAT TASK RECURRENCE HOOK
  const [
    taskRecurrenceRule,
    setTaskRecurrenceRule,
  ] = useState(null);

  const [
    isRecurrenceLoading,
    setIsRecurrenceLoading,
  ] = useState(false);

  const loadTaskRecurrenceRule =
    useCallback(
      async (
        taskId = selectedTaskId,
      ) => {
        if (
          !workspaceId ||
          !taskId
        ) {
          setTaskRecurrenceRule(
            null,
          );

          return null;
        }

        setIsRecurrenceLoading(
          true,
        );

        try {
          const {
            data: taskRecord,
            error: taskError,
          } = await supabase
            .from("tasks")
            .select(
              "recurrence_rule_id",
            )
            .eq(
              "id",
              taskId,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .maybeSingle();

          if (taskError) {
            throw taskError;
          }

          if (
            !taskRecord
              ?.recurrence_rule_id
          ) {
            setTaskRecurrenceRule(
              null,
            );

            return null;
          }

          const {
            data: recurrence,
            error: recurrenceError,
          } = await supabase
            .from(
              "task_recurrence_rules",
            )
            .select("*")
            .eq(
              "id",
              taskRecord
                .recurrence_rule_id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .maybeSingle();

          if (recurrenceError) {
            throw recurrenceError;
          }

          setTaskRecurrenceRule(
            recurrence || null,
          );

          return recurrence || null;
        } finally {
          setIsRecurrenceLoading(
            false,
          );
        }
      },
      [
        selectedTaskId,
        workspaceId,
      ],
    );

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskRecurrenceRule(
        null,
      );

      return;
    }

    loadTaskRecurrenceRule(
      selectedTaskId,
    ).catch(
      (recurrenceError) => {
        console.error(
          "Task recurrence could not be loaded:",
          recurrenceError,
        );
      },
    );
  }, [
    loadTaskRecurrenceRule,
    selectedTaskId,
  ]);

  const createTask = useCallback(
    async (taskData) => {
      setIsSaving(true);
      setError("");

      try {
        const statusFields = buildStatusFields(
          null,
          taskData.status || "open",
          userId,
        );

        const { data, error: createError } =
          await supabase
            .from("tasks")
            .insert({
              workspace_id: workspaceId,
              created_by: userId,
              title: taskData.title,
              description: taskData.description || null,
              category: taskData.category || "General",
              priority: taskData.priority || "normal",
              visibility:
                taskData.visibility || "workspace",
              tags: taskData.tags || [],
              estimated_minutes:
                taskData.estimated_minutes || null,
              due_at: taskData.due_at || null,
              assigned_to:
                taskData.assigned_to || null,
              is_sample: false,
              ...statusFields,
            })
            .select()
            .single();

        if (createError) {
          throw createError;
        }

        await loadCommandCenter();

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCommandCenter,
      userId,
      workspaceId,
    ],
  );

  const updateTask = useCallback(
    async (taskId, taskData) => {
      setIsSaving(true);
      setError("");

      try {
        const currentTask = state.tasks.find(
          (task) => task.id === taskId,
        );

        const statusFields =
          taskData.status &&
          taskData.status !== currentTask?.status
            ? buildStatusFields(
                currentTask,
                taskData.status,
                userId,
              )
            : {};

        const { data, error: updateError } =
          await supabase
            .from("tasks")
            .update({
              ...taskData,
              ...statusFields,
            })
            .eq("id", taskId)
            .eq("workspace_id", workspaceId)
            .select()
            .single();

        if (updateError) {
          throw updateError;
        }

        await loadCommandCenter();

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCommandCenter,
      state.tasks,
      userId,
      workspaceId,
    ],
  );

  const changeTaskStatus = useCallback(
    async (task, nextStatus) => {
      return updateTask(task.id, {
        ...buildStatusFields(
          task,
          nextStatus,
          userId,
        ),
      });
    },
    [updateTask, userId],
  );

  // CAMPAIGN SEAT TASK BULK ACTIONS
  const bulkUpdateTasks = useCallback(
    async (
      taskIds,
      taskChanges,
    ) => {
      const ids = [
        ...new Set(
          (taskIds || []).filter(Boolean),
        ),
      ];

      if (!ids.length) {
        return [];
      }

      setIsSaving(true);
      setError("");

      try {
        const selectedTasks =
          state.tasks.filter(
            (task) =>
              ids.includes(task.id),
          );

        if (!selectedTasks.length) {
          return [];
        }

        const updateIds = async (
          targetIds,
          payload,
        ) => {
          if (!targetIds.length) {
            return [];
          }

          const {
            data,
            error: bulkError,
          } = await supabase
            .from("tasks")
            .update(payload)
            .eq(
              "workspace_id",
              workspaceId,
            )
            .in(
              "id",
              targetIds,
            )
            .select("id");

          if (bulkError) {
            throw bulkError;
          }

          return data || [];
        };

        const {
          status: nextStatus,
          ...ordinaryChanges
        } = taskChanges || {};

        let updated = [];

        if (!nextStatus) {
          updated = await updateIds(
            ids,
            ordinaryChanges,
          );
        } else {
          const now =
            new Date().toISOString();

          if (
            nextStatus ===
            "in_progress"
          ) {
            const alreadyStarted =
              selectedTasks
                .filter(
                  (task) =>
                    Boolean(
                      task.started_at,
                    ),
                )
                .map(
                  (task) => task.id,
                );

            const notStarted =
              selectedTasks
                .filter(
                  (task) =>
                    !task.started_at,
                )
                .map(
                  (task) => task.id,
                );

            const commonPayload = {
              ...ordinaryChanges,
              status: "in_progress",
              completed_at: null,
              completed_by: null,
              archived_at: null,
            };

            const first =
              await updateIds(
                alreadyStarted,
                commonPayload,
              );

            const second =
              await updateIds(
                notStarted,
                {
                  ...commonPayload,
                  started_at: now,
                },
              );

            updated = [
              ...first,
              ...second,
            ];
          } else if (
            nextStatus ===
            "completed"
          ) {
            const alreadyStarted =
              selectedTasks
                .filter(
                  (task) =>
                    Boolean(
                      task.started_at,
                    ),
                )
                .map(
                  (task) => task.id,
                );

            const notStarted =
              selectedTasks
                .filter(
                  (task) =>
                    !task.started_at,
                )
                .map(
                  (task) => task.id,
                );

            const commonPayload = {
              ...ordinaryChanges,
              status: "completed",
              completed_at: now,
              completed_by: userId,
              archived_at: null,
            };

            const first =
              await updateIds(
                alreadyStarted,
                commonPayload,
              );

            const second =
              await updateIds(
                notStarted,
                {
                  ...commonPayload,
                  started_at: now,
                },
              );

            updated = [
              ...first,
              ...second,
            ];
          } else if (
            nextStatus ===
            "archived"
          ) {
            updated = await updateIds(
              ids,
              {
                ...ordinaryChanges,
                status: "archived",
                archived_at: now,
              },
            );
          } else {
            updated = await updateIds(
              ids,
              {
                ...ordinaryChanges,
                status: "open",
                completed_at: null,
                completed_by: null,
                archived_at: null,
              },
            );
          }
        }

        await loadCommandCenter();

        return updated;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadCommandCenter,
      state.tasks,
      userId,
      workspaceId,
    ],
  );

  // CAMPAIGN SEAT BULK ARCHIVE RECURRENCE SAFETY
  const loadActiveTaskRecurrencesForTasks =
    useCallback(
      async (taskIds) => {
        const ids = [
          ...new Set(
            (taskIds || []).filter(Boolean),
          ),
        ];

        if (
          !workspaceId ||
          !ids.length
        ) {
          return [];
        }

        const {
          data: taskRows,
          error: taskError,
        } = await supabase
          .from("tasks")
          .select(
            "id, recurrence_rule_id",
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .in(
            "id",
            ids,
          );

        if (taskError) {
          throw taskError;
        }

        const ruleIds = [
          ...new Set(
            (taskRows || [])
              .map(
                (task) =>
                  task.recurrence_rule_id,
              )
              .filter(Boolean),
          ),
        ];

        if (!ruleIds.length) {
          return [];
        }

        const {
          data: activeRules,
          error: recurrenceError,
        } = await supabase
          .from(
            "task_recurrence_rules",
          )
          .select(
            "id, is_enabled",
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "is_enabled",
            true,
          )
          .in(
            "id",
            ruleIds,
          );

        if (recurrenceError) {
          throw recurrenceError;
        }

        const activeRuleIds =
          new Set(
            (activeRules || []).map(
              (rule) => rule.id,
            ),
          );

        return (
          taskRows || []
        ).filter(
          (task) =>
            task.recurrence_rule_id &&
            activeRuleIds.has(
              task.recurrence_rule_id,
            ),
        );
      },
      [
        workspaceId,
      ],
    );

  const removeTaskRecurrencesForTasks =
    useCallback(
      async (taskIds) => {
        const activeLinks =
          await loadActiveTaskRecurrencesForTasks(
            taskIds,
          );

        const ruleIds = [
          ...new Set(
            activeLinks
              .map(
                (task) =>
                  task.recurrence_rule_id,
              )
              .filter(Boolean),
          ),
        ];

        if (!ruleIds.length) {
          return [];
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: recurrenceError,
          } = await supabase
            .from(
              "task_recurrence_rules",
            )
            .delete()
            .eq(
              "workspace_id",
              workspaceId,
            )
            .in(
              "id",
              ruleIds,
            )
            .select("id");

          if (recurrenceError) {
            throw recurrenceError;
          }

          setTaskRecurrenceRule(
            (current) =>
              current &&
              ruleIds.includes(
                current.id,
              )
                ? null
                : current,
          );

          await loadCommandCenter();

          return data || [];
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadActiveTaskRecurrencesForTasks,
        loadCommandCenter,
        workspaceId,
      ],
    );

  const loadTaskAttachments =
    useCallback(
      async (taskId) => {
        if (
          !workspaceId ||
          !taskId
        ) {
          setTaskAttachments([]);
          setTaskAttachmentError("");
          return [];
        }

        setIsAttachmentsLoading(
          true,
        );

        setTaskAttachmentError(
          "",
        );

        try {
          const {
            data,
            error: attachmentError,
          } = await supabase
            .from(
              "task_attachments",
            )
            .select(
              `
                id,
                workspace_id,
                task_id,
                file_id,
                created_by,
                created_at,
                file:campaign_files (
                  id,
                  workspace_id,
                  file_name,
                  storage_path,
                  mime_type,
                  size_bytes,
                  category,
                  uploaded_by,
                  created_at
                )
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "task_id",
              taskId,
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            );

          if (attachmentError) {
            throw attachmentError;
          }

          const nextAttachments =
            data || [];

          setTaskAttachments(
            nextAttachments,
          );

          return nextAttachments;
        } catch (
          attachmentLoadError
        ) {
          console.error(
            "Task attachments could not be loaded:",
            attachmentLoadError,
          );

          setTaskAttachmentError(
            attachmentLoadError
              ?.message ||
              "Task attachments could not be loaded.",
          );

          throw attachmentLoadError;
        } finally {
          setIsAttachmentsLoading(
            false,
          );
        }
      },
      [
        workspaceId,
      ],
    );


  const attachTaskFile =
    useCallback(
      async (
        taskId,
        fileId,
      ) => {
        if (
          !workspaceId ||
          !taskId ||
          !fileId
        ) {
          return null;
        }

        setIsSaving(true);
        setTaskAttachmentError("");

        try {
          const {
            data,
            error: attachError,
          } = await supabase
            .from(
              "task_attachments",
            )
            .insert({
              workspace_id:
                workspaceId,

              task_id:
                taskId,

              file_id:
                fileId,

              created_by:
                userId,
            })
            .select(
              `
                id,
                workspace_id,
                task_id,
                file_id,
                created_by,
                created_at,
                file:campaign_files (
                  id,
                  workspace_id,
                  file_name,
                  storage_path,
                  mime_type,
                  size_bytes,
                  category,
                  uploaded_by,
                  created_at
                )
              `,
            )
            .single();

          if (attachError) {
            throw attachError;
          }

          await loadTaskAttachments(
            taskId,
          );

          return data;
        } catch (
          attachmentSaveError
        ) {
          console.error(
            "Campaign file could not be attached to task:",
            attachmentSaveError,
          );

          const message =
            attachmentSaveError
              ?.code === "23505"
              ? "That campaign file is already attached to this task."
              : attachmentSaveError
                  ?.message ||
                "The campaign file could not be attached to this task.";

          setTaskAttachmentError(
            message,
          );

          throw attachmentSaveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskAttachments,
        userId,
        workspaceId,
      ],
    );


  const unlinkTaskAttachment =
    useCallback(
      async (attachment) => {
        if (
          !attachment?.id ||
          !workspaceId
        ) {
          return;
        }

        setIsSaving(true);
        setTaskAttachmentError("");

        try {
          const {
            error: unlinkError,
          } = await supabase
            .from(
              "task_attachments",
            )
            .delete()
            .eq(
              "id",
              attachment.id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "task_id",
              attachment.task_id,
            );

          if (unlinkError) {
            throw unlinkError;
          }

          await loadTaskAttachments(
            attachment.task_id,
          );
        } catch (
          attachmentDeleteError
        ) {
          console.error(
            "Task attachment could not be unlinked:",
            attachmentDeleteError,
          );

          setTaskAttachmentError(
            attachmentDeleteError
              ?.message ||
              "The attachment could not be removed from this task.",
          );

          throw attachmentDeleteError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskAttachments,
        workspaceId,
      ],
    );


  // CAMPAIGN SEAT TASK ATTACHMENT LOAD + REALTIME
  useEffect(() => {
    if (
      !workspaceId ||
      !selectedTaskId
    ) {
      setTaskAttachments([]);
      setTaskAttachmentError("");
      return undefined;
    }

    loadTaskAttachments(
      selectedTaskId,
    ).catch(
      (attachmentError) => {
        console.error(
          "Task attachments could not be loaded:",
          attachmentError,
        );
      },
    );

    const attachmentChannel =
      supabase
        .channel(
          `task-attachments-${workspaceId}-${selectedTaskId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "task_attachments",
            filter:
              `task_id=eq.${selectedTaskId}`,
          },
          () => {
            loadTaskAttachments(
              selectedTaskId,
            ).catch(
              (attachmentError) => {
                console.error(
                  "Task attachments could not be refreshed:",
                  attachmentError,
                );
              },
            );
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        attachmentChannel,
      );
    };
  }, [
    loadTaskAttachments,
    selectedTaskId,
    workspaceId,
  ]);


  const loadTaskDependencies = useCallback(
    async () => {
      if (!workspaceId) {
        setTaskDependencies([]);
        return [];
      }

      setIsDependenciesLoading(
        true,
      );

      try {
        const {
          data,
          error: dependencyError,
        } = await supabase
          .from("task_dependencies")
          .select(
            `
              id,
              workspace_id,
              task_id,
              depends_on_task_id,
              created_by,
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
              ascending: true,
            },
          );

        if (dependencyError) {
          throw dependencyError;
        }

        const nextDependencies =
          data || [];

        setTaskDependencies(
          nextDependencies,
        );

        return nextDependencies;
      } finally {
        setIsDependenciesLoading(
          false,
        );
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!workspaceId) {
      setTaskDependencies([]);
      return undefined;
    }

    loadTaskDependencies().catch(
      (dependencyError) => {
        console.error(
          "Task dependencies could not be loaded:",
          dependencyError,
        );
      },
    );

    const dependencyChannel =
      supabase
        .channel(
          `task-dependencies-${workspaceId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "task_dependencies",
            filter:
              `workspace_id=eq.${workspaceId}`,
          },
          () => {
            loadTaskDependencies().catch(
              (dependencyError) => {
                console.error(
                  "Task dependencies could not be refreshed:",
                  dependencyError,
                );
              },
            );
          },
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        dependencyChannel,
      );
    };
  }, [
    loadTaskDependencies,
    workspaceId,
  ]);

  const createSubtasksBatch =
    useCallback(
      async (
        taskId,
        titles,
      ) => {
        const normalizedTitles =
          (titles || [])
            .map(
              (title) =>
                String(title || "")
                  .trim(),
            )
            .filter(Boolean);

        if (
          !taskId ||
          !normalizedTitles.length
        ) {
          return [];
        }

        setIsSaving(true);
        setError("");

        try {
          const rows =
            normalizedTitles.map(
              (title, index) => ({
                workspace_id:
                  workspaceId,

                task_id:
                  taskId,

                title,

                sort_order:
                  index,

                created_by:
                  userId,
              }),
            );

          const {
            data,
            error: createError,
          } = await supabase
            .from("task_subtasks")
            .insert(rows)
            .select();

          if (createError) {
            throw createError;
          }

          await loadSubtasks(
            taskId,
          );

          await loadCommandCenter();

          return data || [];
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadCommandCenter,
        loadSubtasks,
        userId,
        workspaceId,
      ],
    );

  const addSubtask = useCallback(
    async (taskId, title) => {
      const trimmedTitle =
        title.trim();

      if (
        !taskId ||
        !trimmedTitle
      ) {
        return null;
      }

      setIsSaving(true);

      try {
        const highestSortOrder =
          subtasks.reduce(
            (highest, subtask) =>
              Math.max(
                highest,
                Number(
                  subtask.sort_order ||
                  0,
                ),
              ),
            -1,
          );

        const {
          data,
          error: createError,
        } = await supabase
          .from("task_subtasks")
          .insert({
            workspace_id:
              workspaceId,

            task_id:
              taskId,

            title:
              trimmedTitle,

            sort_order:
              highestSortOrder + 1,

            created_by:
              userId,
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        await loadSubtasks(
          taskId,
        );

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadSubtasks,
      subtasks,
      userId,
      workspaceId,
    ],
  );

  const toggleSubtask = useCallback(
    async (subtask) => {
      if (!subtask?.id) {
        return null;
      }

      setIsSaving(true);

      try {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("task_subtasks")
          .update({
            is_completed:
              !subtask.is_completed,
          })
          .eq(
            "id",
            subtask.id,
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "task_id",
            subtask.task_id,
          )
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        await loadSubtasks(
          subtask.task_id,
        );

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadSubtasks,
      workspaceId,
    ],
  );

  const renameSubtask = useCallback(
    async (
      subtask,
      title,
    ) => {
      const trimmedTitle =
        title.trim();

      if (
        !subtask?.id ||
        !trimmedTitle
      ) {
        return null;
      }

      setIsSaving(true);

      try {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("task_subtasks")
          .update({
            title:
              trimmedTitle,
          })
          .eq(
            "id",
            subtask.id,
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "task_id",
            subtask.task_id,
          )
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        await loadSubtasks(
          subtask.task_id,
        );

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadSubtasks,
      workspaceId,
    ],
  );

  const deleteSubtask = useCallback(
    async (subtask) => {
      if (!subtask?.id) {
        return;
      }

      setIsSaving(true);

      try {
        const {
          error: deleteError,
        } = await supabase
          .from("task_subtasks")
          .delete()
          .eq(
            "id",
            subtask.id,
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "task_id",
            subtask.task_id,
          );

        if (deleteError) {
          throw deleteError;
        }

        await loadSubtasks(
          subtask.task_id,
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadSubtasks,
      workspaceId,
    ],
  );

  const addTaskDependency = useCallback(
    async (
      taskId,
      dependsOnTaskId,
    ) => {
      if (
        !taskId ||
        !dependsOnTaskId
      ) {
        return null;
      }

      setIsSaving(true);

      try {
        const {
          data,
          error: createError,
        } = await supabase
          .from(
            "task_dependencies",
          )
          .insert({
            workspace_id:
              workspaceId,

            task_id:
              taskId,

            depends_on_task_id:
              dependsOnTaskId,

            created_by:
              userId,
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        await loadTaskDependencies();

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadTaskDependencies,
      userId,
      workspaceId,
    ],
  );

  const deleteTaskDependency =
    useCallback(
      async (dependency) => {
        if (!dependency?.id) {
          return;
        }

        setIsSaving(true);

        try {
          const {
            error: deleteError,
          } = await supabase
            .from(
              "task_dependencies",
            )
            .delete()
            .eq(
              "id",
              dependency.id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (deleteError) {
            throw deleteError;
          }

          await loadTaskDependencies();
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskDependencies,
        workspaceId,
      ],
    );

  const createTaskReminder =
    useCallback(
      async (
        taskId,
        reminderData,
      ) => {
        if (!taskId) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: createError,
          } = await supabase
            .from(
              "task_reminders",
            )
            .insert({
              workspace_id:
                workspaceId,

              task_id:
                taskId,

              schedule_type:
                reminderData
                  .schedule_type,

              offset_minutes:
                reminderData
                  .offset_minutes ??
                null,

              exact_at:
                reminderData
                  .exact_at ||
                null,

              recipient_scope:
                reminderData
                  .recipient_scope ||
                "assignee",

              message:
                reminderData
                  .message ||
                null,

              is_enabled:
                reminderData
                  .is_enabled ??
                true,

              created_by:
                userId,
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          await loadTaskReminders(
            taskId,
          );

          return data;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskReminders,
        userId,
        workspaceId,
      ],
    );

  const updateTaskReminder =
    useCallback(
      async (
        reminder,
        updates,
      ) => {
        if (!reminder?.id) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: updateError,
          } = await supabase
            .from(
              "task_reminders",
            )
            .update(
              updates,
            )
            .eq(
              "id",
              reminder.id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          await loadTaskReminders(
            reminder.task_id,
          );

          return data;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskReminders,
        workspaceId,
      ],
    );

  const deleteTaskReminder =
    useCallback(
      async (reminder) => {
        if (!reminder?.id) {
          return;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            error: deleteError,
          } = await supabase
            .from(
              "task_reminders",
            )
            .delete()
            .eq(
              "id",
              reminder.id,
            )
            .eq(
              "workspace_id",
              workspaceId,
            );

          if (deleteError) {
            throw deleteError;
          }

          await loadTaskReminders(
            reminder.task_id,
          );
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadTaskReminders,
        workspaceId,
      ],
    );

  const createTaskRecurrence =
    useCallback(
      async (
        taskId,
        recurrenceData,
      ) => {
        if (!taskId) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: recurrenceError,
          } = await supabase.rpc(
            "create_task_recurrence_from_task",
            {
              p_task_id:
                taskId,

              p_recurrence_unit:
                recurrenceData
                  .recurrence_unit,

              p_interval_count:
                Number(
                  recurrenceData
                    .interval_count ||
                  1,
                ),

              p_end_at:
                recurrenceData
                  .end_at ||
                null,

              p_schedule_timezone:
                recurrenceData
                  .schedule_timezone ||
                "America/New_York",
            },
          );

          if (recurrenceError) {
            throw recurrenceError;
          }

          await loadCommandCenter();

          await loadTaskRecurrenceRule(
            taskId,
          );

          return data;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadCommandCenter,
        loadTaskRecurrenceRule,
      ],
    );

  const setTaskRecurrenceEnabled =
    useCallback(
      async (
        recurrence,
        enabled,
      ) => {
        if (!recurrence?.id) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: recurrenceError,
          } = await supabase.rpc(
            "set_task_recurrence_enabled",
            {
              p_rule_id:
                recurrence.id,

              p_enabled:
                Boolean(enabled),
            },
          );

          if (recurrenceError) {
            throw recurrenceError;
          }

          setTaskRecurrenceRule(
            data || null,
          );

          await loadCommandCenter();

          return data;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadCommandCenter,
      ],
    );

  const removeTaskRecurrence =
    useCallback(
      async (recurrence) => {
        if (!recurrence?.id) {
          return null;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            data,
            error: recurrenceError,
          } = await supabase
            .from("task_recurrence_rules")
            .delete()
            .eq("id", recurrence.id)
            .select("id")
            .single();

          if (recurrenceError) {
            throw recurrenceError;
          }

          setTaskRecurrenceRule(null);

          await loadCommandCenter();

          return data;
        } finally {
          setIsSaving(false);
        }
      },
      [
        loadCommandCenter,
      ],
    );

  const addComment = useCallback(
    async (taskId, body) => {
      const trimmedBody = body.trim();

      if (!trimmedBody) {
        return null;
      }

      setIsSaving(true);

      try {
        const { data, error: commentError } =
          await supabase
            .from("task_comments")
            .insert({
              workspace_id: workspaceId,
              task_id: taskId,
              author_id: userId,
              body: trimmedBody,
            })
            .select()
            .single();

        if (commentError) {
          throw commentError;
        }

        await loadComments(taskId);

        return data;
      } finally {
        setIsSaving(false);
      }
    },
    [
      loadComments,
      userId,
      workspaceId,
    ],
  );

  return {
    tasks: state.tasks,
    team: state.team,
    comments: state.comments,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadCommandCenter({ showLoading: true }),
    createTask,
    updateTask,
    changeTaskStatus,
    bulkUpdateTasks,
    loadActiveTaskRecurrencesForTasks,
    removeTaskRecurrencesForTasks,
    addComment,
    subtasks,
    isSubtasksLoading,
    loadSubtasks,
    createSubtasksBatch,
    addSubtask,
    toggleSubtask,
    renameSubtask,
    deleteSubtask,

    taskDependencies,
    isDependenciesLoading,
    loadTaskDependencies,
    addTaskDependency,
    deleteTaskDependency,

    taskAttachments,
    isAttachmentsLoading,
    taskAttachmentError,
    loadTaskAttachments,
    attachTaskFile,
    unlinkTaskAttachment,

    taskReminders,
    isRemindersLoading,
    loadTaskReminders,
    createTaskReminder,
    updateTaskReminder,
    deleteTaskReminder,

    taskReminderOverview,
    taskSubtaskOverview,

    taskTemplates,
    isTaskTemplatesLoading,
    taskTemplateError,
    loadTaskTemplates,
    createTaskTemplate,
    updateTaskTemplate,
    archiveTaskTemplate,

    taskRecurrenceRule,
    isRecurrenceLoading,
    loadTaskRecurrenceRule,
    createTaskRecurrence,
    setTaskRecurrenceEnabled,
    removeTaskRecurrence,

  };
}
