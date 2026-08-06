import { LifeBuoy } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Link,
  useLocation,
} from "react-router-dom";

import styles from "./SupportLauncher.module.css";

export default function SupportLauncher() {
  const location = useLocation();

  if (
    location.pathname === "/support" ||
    location.pathname === "/dashboard" ||
    location.pathname === "/volunteers" ||
    location.pathname === "/inbox" ||
    location.pathname === "/fundraising" ||
    location.pathname === "/events" ||
    location.pathname === "/social-media" ||
    location.pathname === "/media-center" ||
    location.pathname === "/reports-analytics" ||
    location.pathname === "/profile/settings" ||
    location.pathname === "/workspace/settings" ||
    location.pathname === "/workspace/campaign-settings" ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const currentLocation = [
    location.pathname,
    location.search,
    location.hash,
  ].join("");

  const destination =
    `/support?from=${encodeURIComponent(
      currentLocation,
    )}`;

  const isAuthenticatedPage =
    location.pathname !== "/";

  const isInboxPage =
    location.pathname === "/inbox";

  const launcherClassName = [
    styles.launcher,
    isAuthenticatedPage
      ? styles.compact
      : "",
    isInboxPage
      ? styles.inbox
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <Link
      className={launcherClassName}
      to={destination}
      aria-label="Open Campaign Seat Support"
      title="Support"
    >
      <LifeBuoy
        size={18}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span>Support</span>
    </Link>,
    document.body,
  );
}
