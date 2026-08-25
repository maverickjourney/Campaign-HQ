import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Snowflake,
  Sun,
} from "lucide-react";

import {
  supabase,
} from "../../lib/supabase";

import {
  getWorkspaceLocationLabel,
} from "../../utils/workspacePresentation";

import styles from "./CampaignConditions.module.css";


const CACHE_MS =
  10 * 60 * 1000;

const REFRESH_MS =
  15 * 60 * 1000;

const sessionConditionsCache =
  new Map();


function weatherIcon(
  kind,
) {
  switch (
    kind
  ) {
    case "storm":
      return CloudLightning;

    case "rain":
      return CloudRain;

    case "snow":
      return Snowflake;

    case "cloudy":
      return Cloud;

    case "partly-cloudy":
      return CloudSun;

    default:
      return Sun;
  }
}


function safeNumber(
  value,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}


export function CampaignConditions({
  workspace,
}) {
  const location =
    useMemo(
      () =>
        getWorkspaceLocationLabel(
          workspace,
        ),
      [
        workspace,
      ],
    );


  const [
    conditions,
    setConditions,
  ] =
    useState(
      null,
    );


  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );


  const [
    error,
    setError,
  ] =
    useState(
      "",
    );


  const loadConditions =
    useCallback(
      async ({
        force =
          false,
      } = {}) => {
        if (
          !workspace
            ?.id ||
          !location ||
          location ===
            "Campaign location"
        ) {
          setConditions(
            null,
          );

          setError(
            "Campaign location not set",
          );

          setIsLoading(
            false,
          );

          return;
        }


        const cacheKey =
          `${workspace.id}:${location}`;


        const cached =
          sessionConditionsCache.get(
            cacheKey,
          );


        if (
          !force &&
          cached &&
          Date.now() -
            cached.savedAt <
            CACHE_MS
        ) {
          setConditions(
            cached
              .conditions,
          );

          setError(
            "",
          );

          setIsLoading(
            false,
          );

          return;
        }


        setIsLoading(
          true,
        );


        try {
          const {
            data,
            error:
              functionError,
          } =
            await supabase
              .functions
              .invoke(
                "campaign-conditions",
                {
                  body: {
                    workspaceId:
                      workspace.id,

                    location,
                  },
                },
              );


          if (
            functionError
          ) {
            throw functionError;
          }


          if (
            data?.ok !==
              true ||
            !data
              ?.conditions
          ) {
            throw new Error(
              data?.error ||
                "Live campaign weather is unavailable.",
            );
          }


          sessionConditionsCache.set(
            cacheKey,
            {
              savedAt:
                Date.now(),

              conditions:
                data
                  .conditions,
            },
          );


          setConditions(
            data
              .conditions,
          );

          setError(
            "",
          );
        } catch (
          loadError
        ) {
          console.error(
            "Campaign conditions could not load:",
            loadError,
          );


          setError(
            "Weather temporarily unavailable",
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        location,
        workspace
          ?.id,
      ],
    );


  useEffect(
    () => {
      void loadConditions();


      const intervalId =
        window.setInterval(
          () => {
            void loadConditions({
              force:
                true,
            });
          },
          REFRESH_MS,
        );


      return () => {
        window.clearInterval(
          intervalId,
        );
      };
    },
    [
      loadConditions,
    ],
  );


  const WeatherIcon =
    weatherIcon(
      conditions
        ?.kind,
    );


  const temperature =
    safeNumber(
      conditions
        ?.temperatureF,
    );


  const humidity =
    safeNumber(
      conditions
        ?.humidity,
    );


  const temperatureLabel =
    temperature ===
      null
      ? "—"
      : `${Math.round(
          temperature,
        )}°F`;


  return (
    <div
      className={
        styles.conditions
      }
      title={
        conditions
          ?.source
          ? `Weather source: ${conditions.source}`
          : undefined
      }
    >
      <div
        className={
          styles.locationRow
        }
      >
        <span
          className={
            styles.locationIcon
          }
          aria-hidden="true"
        >
          <MapPin
            size={15}
            strokeWidth={2}
          />
        </span>

        <span
          className={
            styles.locationText
          }
        >
          {location}
        </span>
      </div>


      {conditions ? (
        <span
          className={
            styles.livePill
          }
        >
          <i />
          LIVE
        </span>
      ) : null}


      <div
        className={
          styles.weatherRow
        }
      >
        <span
          className={
            styles.weatherIcon
          }
          aria-hidden="true"
        >
          <WeatherIcon
            size={16}
            strokeWidth={2}
          />
        </span>


        <span
          className={
            styles.temperature
          }
        >
          {temperatureLabel}
        </span>


        <span
          className={
            styles.description
          }
        >
          {isLoading &&
          !conditions
            ? "Loading live weather…"
            : error ||
              conditions
                ?.description ||
              "Current conditions"}
        </span>


        {humidity !==
          null ? (
          <span
            className={
              styles.humidity
            }
            title="Relative humidity"
          >
            <Droplets
              size={13}
              strokeWidth={2}
            />

            {Math.round(
              humidity,
            )}
            %
          </span>
        ) : null}


        <button
          className={
            styles.refreshButton
          }
          type="button"
          aria-label="Refresh campaign weather"
          title="Refresh campaign weather"
          disabled={
            isLoading
          }
          onClick={() =>
            void loadConditions({
              force:
                true,
            })
          }
        >
          <RefreshCw
            size={13}
            strokeWidth={2}
          />
        </button>
      </div>
    </div>
  );
}
