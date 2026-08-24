import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getWorkspaceProviderSyncStatus,
  retryWorkspaceProviderSync,
} from "../services/seatOnboarding";


const STALE_AFTER_MS =
  15 *
  60 *
  1000;

const CHECK_INTERVAL_MS =
  15 *
  60 *
  1000;

const RETRY_THROTTLE_MS =
  5 *
  60 *
  1000;


function getRefreshableIntegrations(
  status,
) {
  return (
    status
      ?.integrations ||
    []
  ).filter(
    (integration) =>
      integration
        ?.status ===
        "connected" &&
      [
        "calendar",
        "contacts",
      ].includes(
        String(
          integration
            ?.type ||
          "",
        ).toLowerCase(),
      ),
  );
}


function getFreshness(
  status,
) {
  const integrations =
    getRefreshableIntegrations(
      status,
    );


  if (!integrations.length) {
    return {
      connected: false,
      stale: false,
      oldestSuccessAt: null,
    };
  }


  const successTimes =
    integrations
      .map(
        (integration) => {
          const value =
            integration
              .last_success_at ||
            integration
              .last_sync_at ||
            "";

          const timestamp =
            value
              ? new Date(
                  value,
                ).getTime()
              : NaN;


          return Number.isFinite(
            timestamp,
          )
            ? timestamp
            : null;
        },
      );


  const missingSuccess =
    successTimes.some(
      (timestamp) =>
        timestamp ===
        null,
    );


  const validTimes =
    successTimes.filter(
      (timestamp) =>
        timestamp !==
        null,
    );


  const oldestSuccessAt =
    validTimes.length
      ? Math.min(
          ...validTimes,
        )
      : null;


  return {
    connected: true,

    stale:
      missingSuccess ||
      oldestSuccessAt ===
        null ||
      Date.now() -
        oldestSuccessAt >=
        STALE_AFTER_MS,

    oldestSuccessAt,
  };
}


function storageKey(
  workspaceId,
) {
  return (
    "campaign-seat:" +
    "provider-refresh:" +
    workspaceId
  );
}


export function useWorkspaceProviderFreshness({
  workspaceId,
  enabled = true,
}) {
  const [
    syncState,
    setSyncState,
  ] =
    useState({
      status:
        "idle",

      lastCheckedAt:
        null,

      lastSyncedAt:
        null,

      error:
        "",
    });


  const inFlightRef =
    useRef(false);


  const checkFreshness =
    useCallback(
      async ({
        force = false,
      } = {}) => {
        if (
          !enabled ||
          !workspaceId ||
          inFlightRef.current
        ) {
          return null;
        }


        if (
          typeof document !==
            "undefined" &&
          document
            .visibilityState ===
            "hidden"
        ) {
          return null;
        }


        inFlightRef.current =
          true;


        try {
          setSyncState(
            (current) => ({
              ...current,

              status:
                "checking",

              error:
                "",
            }),
          );


          const status =
            await getWorkspaceProviderSyncStatus(
              workspaceId,
            );


          const freshness =
            getFreshness(
              status,
            );


          const checkedAt =
            new Date();


          if (
            !freshness.connected
          ) {
            setSyncState({
              status:
                "not_connected",

              lastCheckedAt:
                checkedAt,

              lastSyncedAt:
                freshness
                  .oldestSuccessAt
                  ? new Date(
                      freshness.oldestSuccessAt,
                    )
                  : null,

              error:
                "",
            });


            return status;
          }


          if (
            !force &&
            !freshness.stale
          ) {
            setSyncState({
              status:
                "current",

              lastCheckedAt:
                checkedAt,

              lastSyncedAt:
                freshness
                  .oldestSuccessAt
                  ? new Date(
                      freshness.oldestSuccessAt,
                    )
                  : null,

              error:
                "",
            });


            return status;
          }


          let lastAttempt =
            0;


          try {
            lastAttempt =
              Number(
                window
                  .sessionStorage
                  .getItem(
                    storageKey(
                      workspaceId,
                    ),
                  ) ||
                0,
              );
          } catch {
            lastAttempt =
              0;
          }


          if (
            !force &&
            Number.isFinite(
              lastAttempt,
            ) &&
            Date.now() -
              lastAttempt <
              RETRY_THROTTLE_MS
          ) {
            setSyncState({
              status:
                "stale_throttled",

              lastCheckedAt:
                checkedAt,

              lastSyncedAt:
                freshness
                  .oldestSuccessAt
                  ? new Date(
                      freshness.oldestSuccessAt,
                    )
                  : null,

              error:
                "",
            });


            return status;
          }


          try {
            window
              .sessionStorage
              .setItem(
                storageKey(
                  workspaceId,
                ),
                String(
                  Date.now(),
                ),
              );
          } catch {
            // Session throttling is optional.
          }


          setSyncState(
            (current) => ({
              ...current,

              status:
                "syncing",
            }),
          );


          const result =
            await retryWorkspaceProviderSync(
              workspaceId,
            );


          const refreshedStatus =
            await getWorkspaceProviderSyncStatus(
              workspaceId,
            );


          const refreshedFreshness =
            getFreshness(
              refreshedStatus,
            );


          const syncedAt =
            refreshedFreshness
              .oldestSuccessAt
              ? new Date(
                  refreshedFreshness
                    .oldestSuccessAt,
                )
              : new Date();


          setSyncState({
            status:
              result?.success ===
                false
                ? "partial"
                : "current",

            lastCheckedAt:
              new Date(),

            lastSyncedAt:
              syncedAt,

            error:
              result?.success ===
                false
                ? "One or more connected providers need attention."
                : "",
          });


          if (
            typeof window !==
            "undefined"
          ) {
            window.dispatchEvent(
              new CustomEvent(
                "campaign-seat-provider-sync-complete",
                {
                  detail: {
                    workspaceId,
                    result,
                  },
                },
              ),
            );
          }


          return refreshedStatus;
        } catch (
          syncError
        ) {
          console.error(
            "Campaign Seat provider freshness check failed:",
            syncError,
          );


          setSyncState(
            (current) => ({
              ...current,

              status:
                "error",

              lastCheckedAt:
                new Date(),

              error:
                syncError
                  ?.message ||
                "Connected campaign data could not be refreshed.",
            }),
          );


          return null;
        } finally {
          inFlightRef.current =
            false;
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


    const startupTimer =
      window.setTimeout(
        () => {
          void checkFreshness();
        },
        800,
      );


    const intervalId =
      window.setInterval(
        () => {
          void checkFreshness();
        },
        CHECK_INTERVAL_MS,
      );


    const handleVisibility =
      () => {
        if (
          document
            .visibilityState ===
            "visible"
        ) {
          void checkFreshness();
        }
      };


    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );


    return () => {
      window.clearTimeout(
        startupTimer,
      );

      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [
    checkFreshness,
    enabled,
    workspaceId,
  ]);


  return {
    ...syncState,

    refresh:
      () =>
        checkFreshness({
          force: true,
        }),
  };
}
