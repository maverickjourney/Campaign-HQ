import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Users,
} from "lucide-react";

import hero1 from "../../../assets/images/login/hero.jpg";
import hero2 from "../../../assets/images/login/hero2.jpg";
import hero3 from "../../../assets/images/login/hero3.jpg";

import styles from "./Hero.module.css";

const heroImages = [hero1, hero2, hero3];

const features = [
  {
    icon: Users,
    title: "Team",
    description: "Keep leadership and volunteers aligned.",
  },
  {
    icon: CalendarDays,
    title: "Events",
    description: "Manage schedules, meetings and fundraisers.",
  },
  {
    icon: FileText,
    title: "Files",
    description: "Store every campaign asset in one place.",
  },
  {
    icon: CheckCircle2,
    title: "Approvals",
    description: "Review, approve and publish quickly.",
  },
];

export default function Hero() {
  const [heroImage, setHeroImage] = useState(heroImages[0]);

  useEffect(() => {
    const randomImage =
      heroImages[Math.floor(Math.random() * heroImages.length)];

    setHeroImage(randomImage);
  }, []);

  return (
    <div
      className={styles.hero}
      style={{
        backgroundImage: `
          linear-gradient(
            90deg,
            rgba(5, 17, 38, 0.95),
            rgba(5, 17, 38, 0.78),
            rgba(5, 17, 38, 0.28)
          ),
          url(${heroImage})
        `,
      }}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.brand}>Campaign HQ</span>

          <p className={styles.campaign}>
            Elizabeth Accomando Campaign
          </p>
        </div>

        <div className={styles.office}>
          Palm Beach County Commission
          <span>District 6</span>
        </div>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>
          Campaign Operating System
        </p>

        <h1>
          Organize.
          <br />
          Communicate.
          <br />
          <span>Win.</span>
        </h1>

        <p className={styles.description}>
          One secure workspace for campaign leadership,
          volunteers, files, approvals, events and communications.
        </p>

        <div className={styles.countdown}>
          <span>Election Countdown</span>

          <div className={styles.timeGrid}>
            <div>
              <strong>39</strong>
              <small>Days</small>
            </div>

            <div>
              <strong>12</strong>
              <small>Hours</small>
            </div>

            <div>
              <strong>45</strong>
              <small>Minutes</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cards}>
        {features.map(({ icon: Icon, title, description }) => (
          <article key={title} className={styles.card}>
            <Icon size={22} />
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
