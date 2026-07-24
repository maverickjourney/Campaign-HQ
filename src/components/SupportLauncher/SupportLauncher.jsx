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

  const launcherClassName = [
    styles.launcher,
    isAuthenticatedPage
      ? styles.compact
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <Link
      className={launcherClassName}
      to={destination}
      aria-label="Open Campaign Seat Support"
      title="Campaign Seat Support"
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
