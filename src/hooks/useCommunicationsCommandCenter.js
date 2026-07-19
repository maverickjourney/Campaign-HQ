import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

function getErrorMessage(error) {
  const message =
    error?.message ||
    "Campaign communications could not be loaded.";

  if (
    error?.code === "42P01" ||
    message.includes("campaign_communications")
  ) {
    return "Communications storage has not been activated yet. Run the Communications database setup SQL, then refresh this page.";
  }

  return message;
}

function clean(value) {
  return String(value || "").trim();
}

export function useCommunicationsCommandCenter({
  workspaceId,
  userId,
}) {
  const [communications, setCommunications] =
    useState([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);
  const [error, setError] =
    useState("");
  const [lastUpdated, setLastUpdated] =
    useState(null);
  const refreshTimerRef = useRef(null);

  const loadCommunications = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!workspaceId) {
        setCommunications([]);
        setError("No campaign workspace is selected.");
        setIsLoading(false);
        return [];
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const { data, error: loadError } =
          await supabase
            .from("campaign_communications")
            .select(
              `
                id,
                workspace_id,
                title,
                channel,
                audience,
                subject,
                message_body,
                status,
                scheduled_at,
                created_by,
                updated_by,
                created_at,
                updated_at
              `,
            )
            .eq("workspace_id", workspaceId)
            .order("updated_at", {
              ascending: false,
            });

        if (loadError) {
          throw loadError;
        }

        const nextItems = data || [];
        setCommunications(nextItems);
        setError("");
        setLastUpdated(new Date());
        return nextItems;
      } catch (loadError) {
        setError(getErrorMessage(loadError));
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCommunications({ showLoading: true });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadCommunications]);

  useEffect(() => {
    if (!workspaceId) {
      return undefined;
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadCommunications();
      }, 300);
    };

    const channel = supabase
      .channel(`campaign-communications-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_communications",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadCommunications, workspaceId]);

  const saveCommunication = useCallback(
    async ({
      id,
      title,
      channel,
      audience,
      subject,
      messageBody,
      status,
      scheduledAt,
    }) => {
      if (!workspaceId || !userId) {
        throw new Error(
          "The active campaign workspace or user session is missing.",
        );
      }

      const cleanedTitle = clean(title);
      const cleanedBody = clean(messageBody);

      if (!cleanedTitle) {
        throw new Error("Enter a communication title.");
      }

      if (!cleanedBody) {
        throw new Error("Enter the message content.");
      }

      if (status === "scheduled" && !scheduledAt) {
        throw new Error(
          "Choose a planned date and time for the scheduled communication.",
        );
      }

      const payload = {
        workspace_id: workspaceId,
        title: cleanedTitle,
        channel: channel || "internal",
        audience: clean(audience) || "Campaign team",
        subject: clean(subject) || null,
        message_body: cleanedBody,
        status: status || "draft",
        scheduled_at:
          status === "scheduled" ? scheduledAt : null,
        updated_by: userId,
      };

      setIsSaving(true);
      setError("");

      try {
        let result;

        if (id) {
          result = await supabase
            .from("campaign_communications")
            .update(payload)
            .eq("id", id)
            .eq("workspace_id", workspaceId)
            .select()
            .single();
        } else {
          result = await supabase
            .from("campaign_communications")
            .insert({
              ...payload,
              created_by: userId,
            })
            .select()
            .single();
        }

        if (result.error) {
          throw result.error;
        }

        await loadCommunications();
        return result.data;
      } catch (saveError) {
        setError(getErrorMessage(saveError));
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadCommunications, userId, workspaceId],
  );

  const duplicateCommunication = useCallback(
    async (item) =>
      saveCommunication({
        title: `${item.title} (Copy)`,
        channel: item.channel,
        audience: item.audience,
        subject: item.subject,
        messageBody: item.message_body,
        status: "draft",
        scheduledAt: null,
      }),
    [saveCommunication],
  );

  const archiveCommunication = useCallback(
    async (itemId) => {
      if (!workspaceId || !userId) {
        return null;
      }

      setIsSaving(true);
      setError("");

      try {
        const { data, error: archiveError } =
          await supabase
            .from("campaign_communications")
            .update({
              status: "archived",
              scheduled_at: null,
              updated_by: userId,
            })
            .eq("id", itemId)
            .eq("workspace_id", workspaceId)
            .select()
            .single();

        if (archiveError) {
          throw archiveError;
        }

        await loadCommunications();
        return data;
      } catch (archiveError) {
        setError(getErrorMessage(archiveError));
        throw archiveError;
      } finally {
        setIsSaving(false);
      }
    },
    [loadCommunications, userId, workspaceId],
  );

  return {
    communications,
    isLoading,
    isSaving,
    error,
    lastUpdated,
    refresh: () =>
      loadCommunications({ showLoading: true }),
    saveCommunication,
    duplicateCommunication,
    archiveCommunication,
  };
}
