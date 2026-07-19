import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const EMPTY_STATE = {
  activities: [],
  profiles: {},
  readIds: [],
};

function getActivityErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign activity could not be loaded.";

  if (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes(
      "activity_read_receipts",
    )
  ) {
    return "The Activity Center database setup has not been activated yet. Run the Activity Center SQL, then refresh.";
  }

  return message;
}

export function useActivityCenter({
  workspaceId,
  userId,
}) {
  const [state, setState] =
    useState(EMPTY_STATE);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const refreshTimerRef =
    useRef(null);

  const loadActivity =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (
          !workspaceId ||
          !userId
        ) {
          setState(
            EMPTY_STATE,
          );
          setError(
            "The active campaign workspace or user session is missing.",
          );
          setIsLoading(false);
          return EMPTY_STATE;
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const {
            data: activities,
            error: activityError,
          } = await supabase
            .from("activity_log")
            .select(
              `
                id,
                workspace_id,
                actor_user_id,
                activity_type,
                title,
                detail,
                entity_type,
                entity_id,
                route,
                metadata,
                occurred_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .order(
              "occurred_at",
              {
                ascending: false,
              },
            )
            .limit(60);

          if (activityError) {
            throw activityError;
          }

          const actorIds = [
            ...new Set(
              (activities || [])
                .map(
                  (activity) =>
                    activity.actor_user_id,
                )
                .filter(Boolean),
            ),
          ];

          const [
            readsResult,
            profilesResult,
          ] = await Promise.all([
            supabase
              .from(
                "activity_read_receipts",
              )
              .select(
                "activity_id, read_at",
              )
              .eq(
                "workspace_id",
                workspaceId,
              )
              .eq(
                "user_id",
                userId,
              ),
            actorIds.length
              ? supabase
                  .from("profiles")
                  .select(
                    "id, full_name, email",
                  )
                  .in(
                    "id",
                    actorIds,
                  )
              : Promise.resolve({
                  data: [],
                  error: null,
                }),
          ]);

          if (readsResult.error) {
            throw readsResult.error;
          }

          if (profilesResult.error) {
            throw profilesResult.error;
          }

          const profiles =
            Object.fromEntries(
              (
                profilesResult.data ||
                []
              ).map(
                (profile) => [
                  profile.id,
                  profile,
                ],
              ),
            );

          const nextState = {
            activities:
              activities || [],
            profiles,
            readIds:
              (
                readsResult.data ||
                []
              ).map(
                (receipt) =>
                  receipt.activity_id,
              ),
          };

          setState(
            nextState,
          );
          setError("");
          setLastUpdated(
            new Date(),
          );

          return nextState;
        } catch (loadError) {
          setError(
            getActivityErrorMessage(
              loadError,
            ),
          );

          return EMPTY_STATE;
        } finally {
          setIsLoading(false);
        }
      },
      [
        userId,
        workspaceId,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          loadActivity({
            showLoading: true,
          });
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadActivity]);

  useEffect(() => {
    if (
      !workspaceId ||
      !userId
    ) {
      return undefined;
    }

    const scheduleRefresh =
      () => {
        window.clearTimeout(
          refreshTimerRef.current,
        );

        refreshTimerRef.current =
          window.setTimeout(
            () => {
              loadActivity();
            },
            250,
          );
      };

    const channel = supabase
      .channel(
        `campaign-activity-center-${workspaceId}-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_log",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "activity_read_receipts",
          filter:
            `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(
        refreshTimerRef.current,
      );

      supabase.removeChannel(
        channel,
      );
    };
  }, [
    loadActivity,
    userId,
    workspaceId,
  ]);

  const readIdSet =
    useMemo(
      () =>
        new Set(
          state.readIds,
        ),
      [state.readIds],
    );

  const unreadCount =
    useMemo(
      () =>
        state.activities.filter(
          (activity) =>
            !readIdSet.has(
              activity.id,
            ),
        ).length,
      [
        readIdSet,
        state.activities,
      ],
    );

  const markActivityRead =
    useCallback(
      async (activityId) => {
        if (
          !activityId ||
          !workspaceId ||
          !userId ||
          readIdSet.has(
            activityId,
          )
        ) {
          return;
        }

        setIsSaving(true);
        setError("");

        try {
          const {
            error: saveError,
          } = await supabase
            .from(
              "activity_read_receipts",
            )
            .upsert(
              {
                workspace_id:
                  workspaceId,
                activity_id:
                  activityId,
                user_id:
                  userId,
                read_at:
                  new Date()
                    .toISOString(),
              },
              {
                onConflict:
                  "activity_id,user_id",
              },
            );

          if (saveError) {
            throw saveError;
          }

          setState(
            (current) => ({
              ...current,
              readIds: [
                ...new Set([
                  ...current.readIds,
                  activityId,
                ]),
              ],
            }),
          );
        } catch (saveError) {
          setError(
            getActivityErrorMessage(
              saveError,
            ),
          );

          throw saveError;
        } finally {
          setIsSaving(false);
        }
      },
      [
        readIdSet,
        userId,
        workspaceId,
      ],
    );

  const markAllRead =
    useCallback(async () => {
      const unreadIds =
        state.activities
          .filter(
            (activity) =>
              !readIdSet.has(
                activity.id,
              ),
          )
          .map(
            (activity) =>
              activity.id,
          );

      if (
        !unreadIds.length ||
        !workspaceId ||
        !userId
      ) {
        return;
      }

      setIsSaving(true);
      setError("");

      try {
        const readAt =
          new Date()
            .toISOString();

        const {
          error: saveError,
        } = await supabase
          .from(
            "activity_read_receipts",
          )
          .upsert(
            unreadIds.map(
              (activityId) => ({
                workspace_id:
                  workspaceId,
                activity_id:
                  activityId,
                user_id:
                  userId,
                read_at:
                  readAt,
              }),
            ),
            {
              onConflict:
                "activity_id,user_id",
            },
          );

        if (saveError) {
          throw saveError;
        }

        setState(
          (current) => ({
            ...current,
            readIds: [
              ...new Set([
                ...current.readIds,
                ...unreadIds,
              ]),
            ],
          }),
        );
      } catch (saveError) {
        setError(
          getActivityErrorMessage(
            saveError,
          ),
        );

        throw saveError;
      } finally {
        setIsSaving(false);
      }
    }, [
      readIdSet,
      state.activities,
      userId,
      workspaceId,
    ]);

  return {
    activities:
      state.activities,
    profiles:
      state.profiles,
    readIdSet,
    unreadCount,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadActivity({
        showLoading: true,
      }),
    markActivityRead,
    markAllRead,
  };
}
