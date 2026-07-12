import { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { restoreCampaignSession } from "../../../services/auth";
import styles from "./ProtectedRoute.module.css";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      const session = await restoreCampaignSession();

      if (!isMounted) {
        return;
      }

      setStatus(session ? "authorized" : "signed-out");
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingMark}>
          <ShieldCheck size={28} strokeWidth={1.8} />
        </div>

        <strong>Opening Campaign HQ</strong>
        <span>Verifying your secure campaign access…</span>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
