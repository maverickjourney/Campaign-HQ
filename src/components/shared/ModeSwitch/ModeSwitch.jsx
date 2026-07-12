import { ShieldCheck, UserRound } from "lucide-react";

import styles from "./ModeSwitch.module.css";

export default function ModeSwitch({
  mode,
  onChange,
  compact = false,
}) {
  return (
    <div
      className={`${styles.switcher} ${
        compact ? styles.compact : ""
      }`}
      aria-label="Campaign access mode"
    >
      <button
        className={mode === "client" ? styles.active : ""}
        type="button"
        onClick={() => onChange("client")}
        aria-pressed={mode === "client"}
      >
        <UserRound size={compact ? 14 : 15} strokeWidth={2} />
        <span>Client</span>
      </button>

      <button
        className={mode === "admin" ? styles.activeAdmin : ""}
        type="button"
        onClick={() => onChange("admin")}
        aria-pressed={mode === "admin"}
      >
        <ShieldCheck size={compact ? 14 : 15} strokeWidth={2} />
        <span>Admin</span>
      </button>
    </div>
  );
}
