import {
  useEffect,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers3,
  Megaphone,
  Radio,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import hero1 from "../../../assets/images/platform-login/platform-hero1.png";
import hero2 from "../../../assets/images/platform-login/platform-hero2.png";
import hero3 from "../../../assets/images/platform-login/platform-hero3.png";

import styles from "./Hero.module.css";

const slides = [
  {
    image: hero1,
    eyebrow: "Leadership & Strategy",
    title: "Coordinate every campaign decision.",
    description:
      "Give candidates, managers and consultants one secure place to lead the campaign.",
    position: "center",
  },
  {
    image: hero2,
    eyebrow: "Campaign Command",
    title: "Turn plans into organized action.",
    description:
      "Track responsibilities, approvals, events, communications and campaign progress.",
    position: "center",
  },
  {
    image: hero3,
    eyebrow: "Community Mobilization",
    title: "Keep every team member connected.",
    description:
      "Bring staff, captains and volunteers together without exposing sensitive campaign information.",
    position: "center",
  },
];

const features = [
  {
    icon: UsersRound,
    title: "Teams",
    description:
      "Connect leadership, staff and volunteers.",
  },
  {
    icon: CalendarDays,
    title: "Operations",
    description:
      "Coordinate schedules, events and responsibilities.",
  },
  {
    icon: FileText,
    title: "Campaign Assets",
    description:
      "Organize files, materials and approvals.",
  },
  {
    icon: Megaphone,
    title: "Communications",
    description:
      "Keep campaign messages and reminders moving.",
  },
];

export default function Hero() {
  const [activeSlide, setActiveSlide] =
    useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => {
        return (current + 1) % slides.length;
      });
    }, 6500);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const slide = slides[activeSlide];

  return (
    <div
      className={styles.hero}
      style={{
        backgroundImage: `
          linear-gradient(
            90deg,
            rgba(3, 15, 34, 0.97),
            rgba(3, 15, 34, 0.8) 46%,
            rgba(3, 15, 34, 0.3)
          ),
          url(${slide.image})
        `,
        backgroundPosition: slide.position,
      }}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.brand}>
            Campaign HQ
          </span>

          <p className={styles.platform}>
            Political Operations Platform
          </p>
        </div>

        <div className={styles.securityMessage}>
          <ShieldCheck
            size={18}
            strokeWidth={1.8}
          />

          <div>
            <span>
              Secure. Role-Based.
            </span>

            <strong>
              Built for every campaign team
            </strong>
          </div>
        </div>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>
          Campaign Operating System
        </p>

        <h1>
          Plan.
          <br />
          Mobilize.
          <br />
          <span>Win.</span>
        </h1>

        <p className={styles.description}>
          One secure platform for candidates,
          consultants, staff and volunteers to
          organize the work that moves a campaign
          forward.
        </p>

        <div className={styles.platformPulse}>
          <div className={styles.pulseHeader}>
            <div>
              <Radio
                size={16}
                strokeWidth={2}
              />

              <span>
                Inside Campaign HQ
              </span>
            </div>

            <div className={styles.platformStatus}>
              <span />
              Platform Overview
            </div>
          </div>

          <div className={styles.pulseContent}>
            <div className={styles.pulseIcon}>
              <Layers3
                size={21}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <span>
                {slide.eyebrow}
              </span>

              <strong>
                {slide.title}
              </strong>

              <p>
                {slide.description}
              </p>
            </div>
          </div>

          <div
            className={styles.slideDots}
            aria-label="Login background slides"
          >
            {slides.map((item, index) => (
              <button
                key={item.eyebrow}
                className={
                  index === activeSlide
                    ? styles.activeDot
                    : ""
                }
                type="button"
                onClick={() =>
                  setActiveSlide(index)
                }
                aria-label={`Show ${item.eyebrow}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cards}>
        {features.map(
          ({
            icon: Icon,
            title,
            description,
          }) => (
            <article
              key={title}
              className={styles.card}
            >
              <div className={styles.cardIcon}>
                <Icon
                  size={21}
                  strokeWidth={1.8}
                />
              </div>

              <h3>{title}</h3>

              <p>{description}</p>

              <CheckCircle2
                className={styles.cardCheck}
                size={15}
                strokeWidth={2}
              />
            </article>
          ),
        )}
      </section>
    </div>
  );
}
