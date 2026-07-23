import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  Megaphone,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import hero1 from "../../../assets/images/platform-login/platform-hero1.png";
import hero2 from "../../../assets/images/platform-login/platform-hero2.png";
import hero3 from "../../../assets/images/platform-login/platform-hero3.png";

import styles from "./Hero.module.css";

const ELECTION_DATES = {
  primary: new Date("2026-08-18T00:00:00"),
  general: new Date("2026-11-03T00:00:00"),
};

const slides = [
  {
    image: hero1,
    eyebrow: "Campaign Command",
    title: "Keep the campaign organized.",
    description:
      "Coordinate priorities, approvals, schedules, communications, and responsibilities from one secure workspace.",
    icon: Layers3,
  },
  {
    image: hero2,
    eyebrow: "Team Coordination",
    title: "Keep every person moving together.",
    description:
      "Give leadership, staff, consultants, and volunteers the information they need without exposing sensitive campaign work.",
    icon: UsersRound,
  },
  {
    image: hero3,
    eyebrow: "Campaign Readiness",
    title: "Know what needs attention next.",
    description:
      "Surface important deadlines, decisions, and follow-ups before they become problems.",
    icon: CalendarDays,
  },
];

const features = [
  {
    icon: UsersRound,
    title: "Teams",
    description:
      "Connect leadership, staff, consultants, and volunteers.",
    slide: 1,
  },
  {
    icon: CalendarDays,
    title: "Operations",
    description:
      "Coordinate schedules, events, deadlines, and responsibilities.",
    slide: 0,
  },
  {
    icon: FileText,
    title: "Campaign Assets",
    description:
      "Organize files, materials, approvals, and shared resources.",
    slide: 2,
  },
  {
    icon: Megaphone,
    title: "Communications",
    description:
      "Keep messages, reminders, and follow-ups moving.",
    slide: 1,
  },
];

function formatTime(date) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    },
  ).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function getTimeZoneLabel() {
  const zone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone || "Local time";

  const friendlyZones = {
    "America/New_York": "Eastern Time",
    "America/Detroit": "Eastern Time",
    "America/Indiana/Indianapolis": "Eastern Time",
    "America/Kentucky/Louisville": "Eastern Time",
    "America/Chicago": "Central Time",
    "America/Denver": "Mountain Time",
    "America/Phoenix": "Arizona Time",
    "America/Los_Angeles": "Pacific Time",
    "America/Anchorage": "Alaska Time",
    "Pacific/Honolulu": "Hawaii Time",
  };

  return (
    friendlyZones[zone] ||
    zone
      .replaceAll("_", " ")
      .replace("/", " · ")
  );
}

function daysUntil(targetDate, now) {
  const target = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return Math.max(
    0,
    Math.ceil(
      (target - today) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

export default function Hero() {
  const [activeSlide, setActiveSlide] =
    useState(0);

  const [now, setNow] =
    useState(() => new Date());

  useEffect(() => {
    const slideTimer =
      window.setInterval(() => {
        setActiveSlide(
          (current) =>
            (current + 1) %
            slides.length,
        );
      }, 7000);

    const clockTimer =
      window.setInterval(() => {
        setNow(new Date());
      }, 30000);

    return () => {
      window.clearInterval(slideTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const slide = slides[activeSlide];
  const SlideIcon = slide.icon;

  const localTime =
    useMemo(
      () => formatTime(now),
      [now],
    );

  const timeZone =
    useMemo(
      () => getTimeZoneLabel(),
      [],
    );

  const primaryDays =
    useMemo(
      () =>
        daysUntil(
          ELECTION_DATES.primary,
          now,
        ),
      [now],
    );

  const generalDays =
    useMemo(
      () =>
        daysUntil(
          ELECTION_DATES.general,
          now,
        ),
      [now],
    );

  return (
    <section
      className={styles.hero}
      style={{
        backgroundImage: `
          linear-gradient(
            90deg,
            rgba(3, 15, 34, 0.98),
            rgba(3, 15, 34, 0.82) 48%,
            rgba(3, 15, 34, 0.36)
          ),
          url(${slide.image})
        `,
      }}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.brand}>
            Campaign Seat
          </span>

          <p className={styles.platform}>
            Campaign Operations Platform
          </p>
        </div>

        <div className={styles.headerDetails}>
          <div className={styles.headerTime}>
            <div>
              <Clock3 size={15} />
              <span>{timeZone}</span>
            </div>

            <div>
              <Clock3 size={15} />
              <span>{localTime}</span>
            </div>
          </div>

          <div className={styles.security}>
            <ShieldCheck size={18} />

            <div>
              <span>
                Secure. Role-Based.
              </span>

              <strong>
                Built for every campaign team
              </strong>
            </div>
          </div>

          <div className={styles.headerElections}>
            <article>
              <div className={styles.dateIcon}>
                <CalendarDays size={18} />
              </div>

              <div className={styles.headerElectionCopy}>
                <span>Primary election</span>

                <strong>
                  {formatDate(
                    ELECTION_DATES.primary,
                  )}
                </strong>
              </div>

              <div className={styles.countdown}>
                <strong>{primaryDays}</strong>
                <span>days</span>
              </div>
            </article>

            <article>
              <div className={styles.dateIcon}>
                <CalendarDays size={18} />
              </div>

              <div className={styles.headerElectionCopy}>
                <span>General election</span>

                <strong>
                  {formatDate(
                    ELECTION_DATES.general,
                  )}
                </strong>
              </div>

              <div className={styles.countdown}>
                <strong>{generalDays}</strong>
                <span>days</span>
              </div>
            </article>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <p className={styles.eyebrow}>
          One organized campaign workspace
        </p>

        <h1>
          Build the campaign.
          <br />
          <span>Win the seat.</span>
        </h1>

        <p className={styles.description}>
          One secure platform for campaign teams
          to organize the work that moves a
          campaign forward.
        </p>

        <article className={styles.overview}>
          <div className={styles.overviewHeader}>
            <div>
              <Layers3 size={17} />
              <span>
                Inside Campaign Seat
              </span>
            </div>

            <div className={styles.status}>
              <span />
              Platform overview
            </div>
          </div>

          <div className={styles.overviewBody}>
            <div className={styles.overviewIcon}>
              <SlideIcon size={22} />
            </div>

            <div>
              <span>{slide.eyebrow}</span>
              <strong>{slide.title}</strong>
              <p>{slide.description}</p>
            </div>
          </div>

          <div className={styles.dots}>
            {slides.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                className={
                  index === activeSlide
                    ? styles.activeDot
                    : ""
                }
                onClick={() =>
                  setActiveSlide(index)
                }
                aria-label={`Show ${item.eyebrow}`}
              />
            ))}
          </div>
        </article>

      </div>

      <div className={styles.features}>
        {features.map(
          ({
            icon: Icon,
            title,
            description,
            slide: slideIndex,
          }) => (
            <button
              key={title}
              type="button"
              className={styles.featureCard}
              onClick={() =>
                setActiveSlide(slideIndex)
              }
            >
              <div className={styles.featureIcon}>
                <Icon size={20} />
              </div>

              <h3>{title}</h3>
              <p>{description}</p>

              <CheckCircle2
                className={styles.check}
                size={15}
              />
            </button>
          ),
        )}
      </div>
    </section>
  );
}
