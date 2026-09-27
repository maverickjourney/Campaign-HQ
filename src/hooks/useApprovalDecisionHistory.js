import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

export function useApprovalDecisionHistory({
  workspaceId,
  approvalId,
}) {
  const [
    history,
    setHistory,
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
    tableAvailable,
    setTableAvailable,
  ] = useState(false);

  const refreshTimerRef =
    useRef(null);

  const loadHistory =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (
          !workspaceId ||
          !approvalId
        ) {
          setHistory([]);
          setError("");
          setIsLoading(false);
          return [];
        }

        if (showLoading) {
          setIsLoading(true);
        }

        try {
          const {
            data,
            error:
              historyError,
          } = await supabase
            .from(
              "approval_decision_history",
            )
            .select(
              `
                id,
                workspace_id,
                approval_id,
                from_status,
                to_status,
                decision_notes,
                actor_user_id,
                occurred_at,
                created_at
              `,
            )
            .eq(
              "workspace_id",
              workspaceId,
            )
            .eq(
              "approval_id",
              approvalId,
            )
            .order(
              "occurred_at",
              {
                ascending: true,
              },
            );

          /*
           * V61 ships source before the live migration.
           * Missing-table is intentionally treated as a
           * temporary empty history rather than a page error.
           */
          if (
            historyError?.code ===
              "42P01" ||
            String(
              historyError?.message ||
              "",
            ).includes(
              "approval_decision_history",
            )
          ) {
            setHistory([]);
            setTableAvailable(false);
            setError("");
            return [];
          }

          if (historyError) {
            throw historyError;
          }

          const nextHistory =
            data || [];

          setHistory(
            nextHistory,
          );

          setTableAvailable(true);
          setError("");

          return nextHistory;
        } catch (
          loadError
        ) {
          console.error(
            "Approval decision history could not load:",
            loadError,
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Approval decision history could not be loaded.",
          );

          return [];
        } finally {
          setIsLoading(false);
        }
      },
      [
        approvalId,
        workspaceId,
      ],
    );

  useEffect(() => {
    loadHistory({
      showLoading: true,
    });
  }, [
    loadHistory,
  ]);

  useEffect(() => {
    if (
      !workspaceId ||
      !approvalId ||
      !tableAvailable
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
              loadHistory();
            },
            200,
          );
      };

    const channel =
      supabase
        .channel(
          `approval-decision-history-${approvalId}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "approval_decision_history",
            filter:
              `approval_id=eq.${approvalId}`,
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
    approvalId,
    loadHistory,
    tableAvailable,
    workspaceId,
  ]);

  return {
    history,
    isLoading,
    error,
    refresh:
      loadHistory,
  };
}
