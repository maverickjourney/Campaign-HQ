import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Clock3,
} from "lucide-react";

import styles from "./CampaignDateTime.module.css";

const CAMPAIGN_TIME_ZONE =
  "America/New_York";

export function CampaignDateTime() {
  const [now, setNow] =
    useState(
      () => new Date(),
    );

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            new Date(),
          );
        },
        30000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);

  const dateLabel =
    useMemo(
      () =>
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              CAMPAIGN_TIME_ZONE,
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        ).format(now),
      [now],
    );

  const timeLabel =
    useMemo(
      () =>
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              CAMPAIGN_TIME_ZONE,
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          },
        ).format(now),
      [now],
    );

  return (
    <div
      className={
        styles.dateTime
      }
      title={`${dateLabel} · ${timeLabel}`}
      aria-label={`Campaign date and time: ${dateLabel}, ${timeLabel}`}
    >
      <div
        className={
          styles.date
        }
      >
        <CalendarDays
          size={15}
        />

        <span>
          {dateLabel}
        </span>
      </div>

      <div
        className={
          styles.time
        }
      >
        <Clock3
          size={15}
        />

        <strong>
          {timeLabel}
        </strong>
      </div>
    </div>
  );
}
